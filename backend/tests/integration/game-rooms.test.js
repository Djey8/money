'use strict';

// Multiplayer Cashflow tables, the lobby (todo/cashflow-multiplayer.md slice S1): real CouchDB, real routes.
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { getGameRoomsDb, getAuthDb } = require('../../config/db');
const { createToken } = require('../../cli/commands/token');
const { createGameRoomService } = require('../../services/game-rooms');
const store = require('../../repositories/game-room-store');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
const limitVars = [
  'GAME_ROOMS_MAX_HOSTED',
  'GAME_ROOMS_MAX_SEATED',
  'GAME_ROOMS_LOBBY_IDLE_MS',
  'GAME_ROOMS_RETENTION_MS',
];
let dbAvailable = false;
let host;
let anna;
let ben;
let normal;
const roomIds = [];

/** The account's nickname is the name at a table: Host, Anna, Ben ... from the label. */
const nameOf = (label) => {
  const word = (label.match(/(host|anna|ben|cy|dan)$/) || [label])[0];
  return word.charAt(0).toUpperCase() + word.slice(1);
};

async function gameUser(label) {
  const email = `jest_${Date.now()}_${label}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password: 'TestPassword123!',
      gamePassword: GAME_PASSWORD,
      username: nameOf(label),
    });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  return { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId, email };
}

const call = (user, method, path) =>
  request(app)[method](`/api/v1/game/rooms${path}`).set('Authorization', `Bearer ${user.token}`);

async function createRoom(user, settings = {}, extra = {}) {
  const res = await call(user, 'post', '').send({
    nickname: 'Host',
    settings: { name: 'Friday table', ...settings },
    ...extra,
  });
  if (res.status === 201) roomIds.push(res.body.id);
  return res;
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  host = await gameUser('host');
  anna = await gameUser('anna');
  ben = await gameUser('ben');
  normal = await registerTestUser('_room_normal');
});

// The per-account limits are lowered on purpose in one test; every other test hosts and sits at many tables.
beforeEach(() => {
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
  process.env.GAME_ROOMS_MAX_SEATED = '50';
});

afterEach(() => {
  for (const name of limitVars) delete process.env[name];
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (!dbAvailable) return;
  const db = getGameRoomsDb();
  for (const id of roomIds) await store.deleteRoom(db, id);
  for (const user of [host, anna, ben, normal]) {
    if (user) {
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ confirm: true });
    }
  }
});

describe('who may use the tables', () => {
  it('turns away a normal account on every route, and a request with no sign-in', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const routes = [
      ['get', ''],
      ['post', ''],
      ['post', '/join'],
      ['get', `/${room.body.id}`],
      ['post', `/${room.body.id}/leave`],
      ['put', `/${room.body.id}/ready`],
      ['post', `/${room.body.id}/kick`],
      ['put', `/${room.body.id}/settings`],
      ['post', `/${room.body.id}/start`],
      ['put', `/${room.body.id}/profession`],
      ['delete', `/${room.body.id}?confirm=true`],
    ];
    for (const [method, path] of routes) {
      const refused = await call(normal, method, path).send({});
      expect([method, path, refused.status, refused.body.code]).toEqual([
        method,
        path,
        403,
        'not_a_game_account',
      ]);
      const anonymous = await request(app)[method](`/api/v1/game/rooms${path}`).send({});
      expect([method, path, anonymous.status]).toEqual([method, path, 401]);
    }
    // and the table is untouched
    expect((await call(host, 'get', `/${room.body.id}`)).body.table.version).toBe(1);
  });

  it('a read-only token cannot change a table; a token with the scope can', async () => {
    if (!dbAvailable) return;
    const readOnly = await createToken(
      { authDb: getAuthDb() },
      { userId: host.userId, name: 'reader', scopes: ['game:r'] },
    );
    const asReader = (method, path) =>
      request(app)
        [method](`/api/v1/game/rooms${path}`)
        .set('Authorization', `Bearer ${readOnly.token}`);
    expect((await asReader('get', '')).status).toBe(200);
    const refused = await asReader('post', '').send({ nickname: 'x', settings: { name: 'x' } });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('scope_insufficient');
    const writer = await createToken(
      { authDb: getAuthDb() },
      { userId: host.userId, name: 'writer', scopes: ['game:w'] },
    );
    const created = await request(app)
      .post('/api/v1/game/rooms')
      .set('Authorization', `Bearer ${writer.token}`)
      .send({ nickname: 'Agent', settings: { name: 'Agent table', visibility: 'private' } });
    expect(created.status).toBe(201);
    roomIds.push(created.body.id);
  });
});

describe('creating and finding tables', () => {
  it('creates a table with the host seated, and never shows an account id', async () => {
    if (!dbAvailable) return;
    const res = await createRoom(
      host,
      { maxSeats: 4, clock: { mode: 'per-move', secondsPerMove: 45 } },
      { language: 'de' },
    );
    expect(res.status).toBe(201);
    expect(res.body.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(res.body.language).toBe('de');
    expect(res.body.table).toMatchObject({
      phase: 'lobby',
      version: 1,
      youSeat: 0,
      hostSeat: 0,
      settings: {
        name: 'Friday table',
        maxSeats: 4,
        clock: { mode: 'per-move', secondsPerMove: 45 },
      },
    });
    expect(res.body.table.players).toEqual([
      expect.objectContaining({ seat: 0, name: 'Host', ready: true, away: false }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain(host.userId);
    expect(res.body.table.settings.rules).toMatchObject({
      reportRolls: 'forbidden',
      manualTransactions: 'forbidden',
    });
  });

  it('refuses bad settings and bad bodies with Problem Details', async () => {
    if (!dbAvailable) return;
    const noName = await createRoom(host, { name: '' });
    expect(noName.status).toBe(400);
    expect(noName.body.code).toBe('table_invalid_settings');
    expect(noName.headers['content-type']).toContain('application/problem+json');
    const forced = await createRoom(host, { rules: { reportRolls: 'allowed' } });
    expect(forced.status).toBe(400);
    expect(forced.body.detail).toMatch(/reportRolls/);
    const always = await createRoom(host, { rules: { sell: 'always' } });
    expect(always.status).toBe(400);
    expect((await call(host, 'post', '').send({ nickname: 'x' })).body.code).toBe(
      'validation_invalid',
    );
    expect((await call(host, 'get', '?scope=everything')).status).toBe(400);
  });

  it('lists public tables with a free seat; private ones only by invite code', async () => {
    if (!dbAvailable) return;
    const open = await createRoom(anna, { name: 'Open table' }, { nickname: 'Anna' });
    const hidden = await createRoom(
      anna,
      { name: 'Hidden table', visibility: 'private' },
      { nickname: 'Anna' },
    );
    // closing the third hosted table later frees the limit; for now Anna hosts two
    const seen = await call(ben, 'get', '');
    expect(seen.status).toBe(200);
    const names = seen.body.items.map((item) => item.name);
    expect(names).toContain('Open table');
    expect(names).not.toContain('Hidden table');
    const item = seen.body.items.find((i) => i.name === 'Open table');
    expect(item).toMatchObject({
      hostName: 'Anna',
      phase: 'lobby',
      seatsTaken: 1,
      maxSeats: 6,
      joined: false,
    });
    expect(JSON.stringify(seen.body)).not.toContain(anna.userId);

    // a stranger can look at a public table, but not at a private one
    const peek = await call(ben, 'get', `/${open.body.id}`);
    expect(peek.status).toBe(200);
    expect(peek.body.table.youSeat).toBeNull();
    expect(peek.body.inviteCode).toBeUndefined();
    expect((await call(ben, 'get', `/${hidden.body.id}`)).status).toBe(404);
    expect(
      (await call(ben, 'post', '/join').send({ roomId: hidden.body.id, nickname: 'Ben' })).status,
    ).toBe(404);

    const byCode = await call(ben, 'post', '/join').send({
      code: hidden.body.inviteCode.toLowerCase(),
      nickname: 'Ben',
    });
    expect(byCode.status).toBe(200);
    expect(byCode.body.table.youSeat).toBe(1);
    expect((await call(ben, 'get', `/${hidden.body.id}`)).status).toBe(200);

    const mine = await call(ben, 'get', '?scope=mine');
    expect(mine.body.items.map((i) => i.name)).toEqual(['Hidden table']);
    expect(mine.body.items[0].joined).toBe(true);
    await call(anna, 'delete', `/${open.body.id}?confirm=true`);
    await call(anna, 'delete', `/${hidden.body.id}?confirm=true`);
  });
});

describe('the lobby, before play', () => {
  it('joins, readies, starts, picks professions and begins play', async () => {
    if (!dbAvailable) return;
    const made = await createRoom(host, { professions: 'duplicates', turnOrder: 'seat' });
    const id = made.body.id;

    const joined = await call(anna, 'post', '/join').send({ roomId: id, nickname: 'Anna' });
    expect(joined.status).toBe(200);
    expect(joined.body.table.players.map((p) => p.name)).toEqual(['Host', 'Anna']);
    expect(joined.body.inviteCode).toBe(made.body.inviteCode);
    expect(joined.body.table.version).toBe(2);

    // one name per account: the nickname of the account is the name at the table, whatever the request says
    const joinedBen = await call(ben, 'post', '/join').send({ roomId: id, nickname: ' anna ' });
    expect(joinedBen.body.table.players).toHaveLength(3);
    expect(joinedBen.body.table.players.map((p) => p.name)).toEqual(['Host', 'Anna', 'Ben']);

    // not everyone is ready
    expect((await call(host, 'post', `/${id}/start`).send({})).body.code).toBe('table_not_ready');
    expect((await call(anna, 'put', `/${id}/ready`).send({ ready: true })).status).toBe(200);
    expect((await call(ben, 'put', `/${id}/ready`).send({ ready: 'yes' })).status).toBe(400);
    await call(ben, 'put', `/${id}/ready`).send({ ready: true });
    const notHost = await call(anna, 'post', `/${id}/start`).send({});
    expect(notHost.status).toBe(403);
    expect(notHost.body.code).toBe('table_not_host');

    const started = await call(host, 'post', `/${id}/start`).send({});
    expect(started.status).toBe(200);
    expect(started.body.table.phase).toBe('picking');

    // picks are secret until everyone has picked
    const first = await call(anna, 'put', `/${id}/profession`).send({ professionId: 'pilot' });
    expect(first.body.table.players[1]).toMatchObject({ hasPicked: true, pick: 'pilot' });
    const asBen = await call(ben, 'get', `/${id}`);
    expect(asBen.body.table.players[1]).toMatchObject({ hasPicked: true, pick: null });
    expect(
      (await call(host, 'put', `/${id}/profession`).send({ professionId: 'astronaut' })).body.code,
    ).toBe('table_unknown_profession');
    await call(host, 'put', `/${id}/profession`).send({ professionId: 'lehrer' });
    const playing = await call(ben, 'put', `/${id}/profession`).send({ professionId: 'arzt' });
    expect(playing.body.table.phase).toBe('playing');
    expect(playing.body.table.activeSeat).toBe(0);
    const books = playing.body.table.players.map((p) => p.books);
    expect(books.every((b) => b && b.subscriptions.length > 0)).toBe(true);
    // nobody's account id is in anything a table shows
    const json = JSON.stringify(playing.body);
    for (const user of [host, anna, ben]) expect(json).not.toContain(user.userId);

    // the events are on disk in order, with sequence numbers
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 100);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'table_created',
        'player_joined',
        'picking_started',
        'professions_revealed',
        'play_started',
      ]),
    );
    expect((await store.getRoom(getGameRoomsDb(), id)).eventSeq).toBe(events.length);
  });

  it('kicks by seat, changes settings, leaves, and closes only on confirmation', async () => {
    if (!dbAvailable) return;
    const made = await createRoom(host);
    const id = made.body.id;
    await call(anna, 'post', '/join').send({ roomId: id, nickname: 'Anna' });
    await call(ben, 'post', '/join').send({ roomId: id, nickname: 'Ben' });

    const changed = await call(host, 'put', `/${id}/settings`).send({
      settings: { maxSeats: 8, clock: { mode: 'daily', hoursPerMove: 24 } },
    });
    expect(changed.body.table.settings).toMatchObject({
      maxSeats: 8,
      clock: { mode: 'daily', hoursPerMove: 24 },
    });
    expect(changed.body.table.players.map((p) => p.ready)).toEqual([true, false, false]);
    expect(
      (await call(anna, 'put', `/${id}/settings`).send({ settings: { maxSeats: 3 } })).body.code,
    ).toBe('table_not_host');

    expect((await call(host, 'post', `/${id}/kick`).send({ seat: 'x' })).status).toBe(400);
    expect((await call(host, 'post', `/${id}/kick`).send({ seat: 0 })).body.code).toBe(
      'table_cannot_kick_host',
    );
    expect((await call(host, 'post', `/${id}/kick`).send({ seat: 9 })).body.code).toBe(
      'table_unknown_player',
    );
    const kicked = await call(host, 'post', `/${id}/kick`).send({ seat: 2 });
    expect(kicked.body.table.players.map((p) => p.name)).toEqual(['Host', 'Anna']);
    // Ben is out: the table no longer lists him, and a public table he was kicked from still shows as a spectator view
    expect((await call(ben, 'get', '?scope=mine')).body.items.map((i) => i.id)).not.toContain(id);

    const left = await call(anna, 'post', `/${id}/leave`).send({});
    expect(left.body.table.players.map((p) => p.name)).toEqual(['Host']);
    expect((await call(anna, 'post', `/${id}/leave`).send({})).body.code).toBe(
      'table_not_a_member',
    );

    expect((await call(host, 'delete', `/${id}`)).status).toBe(400);
    const closed = await call(host, 'delete', `/${id}?confirm=true`);
    expect(closed.body.table.phase).toBe('abandoned');
    expect((await call(host, 'post', `/${id}/start`).send({})).status).toBe(409);
  });

  it('lets the host take a table away altogether, and nobody else; it says who opened it', async () => {
    if (!dbAvailable) return;
    const made = await createRoom(host);
    const id = made.body.id;
    await call(anna, 'post', '/join').send({ roomId: id, nickname: 'Anna' });
    expect(
      (await call(host, 'get', '?scope=mine')).body.items.find((i) => i.id === id),
    ).toMatchObject({
      hosting: true,
    });
    expect(
      (await call(anna, 'get', '?scope=mine')).body.items.find((i) => i.id === id),
    ).toMatchObject({
      hosting: false,
    });
    const denied = await call(anna, 'delete', `/${id}?confirm=true&remove=true`);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('table_not_host');
    expect((await call(host, 'delete', `/${id}?remove=true`)).status).toBe(400);
    // with another person at the table it is not the host's to take away: that person leaves (or the host resigns) first
    const crowded = await call(host, 'delete', `/${id}?confirm=true&remove=true`);
    expect(crowded.status).toBe(409);
    expect(crowded.body.code).toBe('room_has_players');
    await call(anna, 'post', `/${id}/leave`).send({});
    const gone = await call(host, 'delete', `/${id}?confirm=true&remove=true`);
    expect(gone.status).toBe(200);
    expect(gone.body).toEqual({ removed: true });
    expect((await call(host, 'get', `/${id}`)).status).toBe(404);
    expect((await call(anna, 'get', '?scope=mine')).body.items.map((i) => i.id)).not.toContain(id);
  });

  it('guards a change with the table version the caller last saw', async () => {
    if (!dbAvailable) return;
    const made = await createRoom(host);
    const id = made.body.id;
    await call(anna, 'post', '/join').send({ roomId: id, nickname: 'Anna' });
    const stale = await call(host, 'put', `/${id}/ready`).send({ ready: true, expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('room_conflict');
    const fresh = await call(host, 'put', `/${id}/ready`).send({ ready: true, expectedVersion: 2 });
    expect(fresh.status).toBe(200);
    expect(
      (await call(host, 'put', `/${id}/ready`).send({ ready: true, expectedVersion: -1 })).status,
    ).toBe(400);
  });

  it('two players pressing at the same moment both get their seat', async () => {
    if (!dbAvailable) return;
    const made = await createRoom(host);
    const id = made.body.id;
    const [a, b] = await Promise.all([
      call(anna, 'post', '/join').send({ roomId: id, nickname: 'Anna' }),
      call(ben, 'post', '/join').send({ roomId: id, nickname: 'Ben' }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const table = (await call(host, 'get', `/${id}`)).body.table;
    expect(table.players.map((p) => p.name).sort()).toEqual(['Anna', 'Ben', 'Host']);
    expect(table.version).toBe(3);
    expect(new Set(table.players.map((p) => p.color)).size).toBe(3);
  });
});

describe('limits and tidying up', () => {
  it('limits the tables an account hosts and sits at, and frees them again', async () => {
    if (!dbAvailable) return;
    process.env.GAME_ROOMS_MAX_HOSTED = '1';
    const first = await createRoom(ben, {}, { nickname: 'Ben' });
    expect(first.status).toBe(201);
    const second = await createRoom(ben, {}, { nickname: 'Ben' });
    expect(second.status).toBe(429);
    expect(second.body.code).toBe('room_limit');
    expect(second.body.detail).toMatch(/host 1 open table/);
    expect((await call(ben, 'delete', `/${first.body.id}?confirm=true`)).status).toBe(200);
    expect((await createRoom(ben, {}, { nickname: 'Ben' })).status).toBe(201);

    process.env.GAME_ROOMS_MAX_HOSTED = '50';
    const target = await createRoom(host);
    process.env.GAME_ROOMS_MAX_SEATED = '1';
    const refused = await call(ben, 'post', '/join').send({
      roomId: target.body.id,
      nickname: 'Ben',
    });
    expect(refused.status).toBe(429);
    expect(refused.body.detail).toMatch(/sit at 1 open table/);
  });

  it('closes idle tables and deletes old closed ones when swept', async () => {
    if (!dbAvailable) return;
    const made = await createRoom(anna, { name: 'Idle table' }, { nickname: 'Anna' });
    const id = made.body.id;
    const service = createGameRoomService({ db: getGameRoomsDb() });
    process.env.GAME_ROOMS_LOBBY_IDLE_MS = '1';
    process.env.GAME_ROOMS_RETENTION_MS = '60000';
    await new Promise((resolve) => setTimeout(resolve, 20));
    const swept = await service.sweep();
    expect(swept.closed).toBeGreaterThanOrEqual(1);
    const closed = await call(anna, 'get', `/${id}`);
    expect(closed.body.table.phase).toBe('abandoned');
    expect((await store.getRoom(getGameRoomsDb(), id)).phase).toBe('abandoned');
    // a closed table keeps a closed marker (the recent-tables list reads it; it counts toward no limit) until it is deleted
    const markers = await store.seatMarkers(getGameRoomsDb(), anna.userId);
    expect(markers.filter((m) => m.roomId === id).map((m) => m.closed)).toEqual([true]);
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 50);
    expect(events[events.length - 1]).toMatchObject({
      type: 'table_closed',
      data: { reason: 'idle' },
    });

    process.env.GAME_ROOMS_RETENTION_MS = '1';
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await service.sweep();
    expect(second.deleted).toBeGreaterThanOrEqual(1);
    expect(await store.getRoom(getGameRoomsDb(), id)).toBeNull();
    expect(
      (await store.seatMarkers(getGameRoomsDb(), anna.userId)).map((m) => m.roomId),
    ).not.toContain(id);
    expect(await store.readEvents(getGameRoomsDb(), id, 0, 50)).toEqual([]);
    expect((await call(anna, 'get', `/${id}`)).status).toBe(404);
  });
});
