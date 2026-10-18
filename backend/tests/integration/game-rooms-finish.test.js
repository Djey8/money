'use strict';

// After the game (todo/cashflow-multiplayer.md slice S5): the result, the list of recent tables, filing the final books as a
// saved game, and the record of a table. Real CouchDB, real routes.
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');
const { quickMove } = require('../helpers/quick-move');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
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
  return { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId };
}

const rooms = (user, method, path) =>
  request(app)[method](`/api/v1/game/rooms${path}`).set('Authorization', `Bearer ${user.token}`);
const api = (user, method, path) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);
const view = async (user, id) => (await rooms(user, 'get', `/${id}`)).body;

/** A two-player table that ends after one round: each player plays one turn. Returns its id. */
async function finishedTable(name = 'Short game') {
  const made = await rooms(host, 'post', '').send({
    nickname: 'Host',
    settings: {
      name,
      professions: 'random',
      turnOrder: 'seat',
      turnGate: false, // these tests move by raw commands; the gate has its own tests
      clock: { mode: 'none' },
      endCondition: 'round-limit',
      roundLimit: 1,
    },
  });
  expect(made.status).toBe(201);
  const id = made.body.id;
  roomIds.push(id);
  await rooms(anna, 'post', '/join').send({ roomId: id, nickname: 'Anna' });
  await rooms(anna, 'put', `/${id}/ready`).send({ ready: true });
  await rooms(host, 'post', `/${id}/start`).send({});
  const users = [host, anna];
  for (let turn = 0; turn < 2; turn += 1) {
    const who = users[turn];
    for (let step = 0; step < 8; step += 1) {
      const current = await view(who, id);
      if (current.table.phase !== 'playing' || current.table.activeSeat !== turn) break;
      const done = await rooms(who, 'post', `/${id}/commands`).send({
        command: quickMove(current),
      });
      expect(done.status).toBe(200);
    }
  }
  const end = await view(host, id);
  expect(end.table.phase).toBe('finished');
  return id;
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
  process.env.GAME_ROOMS_MAX_SEATED = '50';
  host = await gameUser('fhost');
  anna = await gameUser('fanna');
  ben = await gameUser('fben');
  normal = await registerTestUser('_finish_normal');
});

afterEach(() => {
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  delete process.env.GAME_ROOMS_MAX_HOSTED;
  delete process.env.GAME_ROOMS_MAX_SEATED;
  if (!dbAvailable) return;
  for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
  for (const user of [host, anna, ben, normal]) {
    if (user) await api(user, 'delete', '/account').send({ confirm: true });
  }
});

describe('the end of a game', () => {
  it('shows the result and the ranking to everyone, by seat', async () => {
    if (!dbAvailable) return;
    const id = await finishedTable();
    const room = await view(anna, id);
    expect(room.table.result).toMatchObject({ reason: 'round-limit' });
    expect(room.table.result.ranking).toHaveLength(2);
    expect(room.table.result.ranking.map((r) => r.rank)).toEqual([1, 2]);
    expect(room.table.result.ranking.map((r) => r.seat).sort()).toEqual([0, 1]);
    expect(JSON.stringify(room)).not.toContain(host.userId);
    expect(room.legalActions).toEqual([]);
    // nothing more can be played
    const after = await rooms(host, 'post', `/${id}/commands`).send({ command: { type: 'roll' } });
    expect(after.status).toBe(409);
    expect(after.body.code).toBe('table_wrong_phase');
  });

  it('moves the table from "my tables" to "recent tables" and stops it counting against the limits', async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Recent game');
    const mine = await rooms(host, 'get', '?scope=mine');
    expect(mine.body.items.map((i) => i.id)).not.toContain(id);
    const recent = await rooms(host, 'get', '?scope=recent');
    const item = recent.body.items.find((i) => i.id === id);
    expect(item).toMatchObject({ name: 'Recent game', phase: 'finished', joined: true });
    expect(item.result).toMatchObject({ reason: 'round-limit' });
    expect(['Host', 'Anna']).toContain(item.result.winnerName);
    expect((await rooms(anna, 'get', '?scope=recent')).body.items.map((i) => i.id)).toContain(id);
    expect((await rooms(ben, 'get', '?scope=recent')).body.items.map((i) => i.id)).not.toContain(
      id,
    );
    expect((await rooms(host, 'get', '?scope=everything')).status).toBe(400);

    // a host who may keep one open table can open another: the finished one no longer counts
    process.env.GAME_ROOMS_MAX_HOSTED = '1';
    const next = await rooms(host, 'post', '').send({
      nickname: 'Host',
      settings: { name: 'Next' },
    });
    expect(next.status).toBe(201);
    roomIds.push(next.body.id);
    expect(
      (await rooms(host, 'post', '').send({ nickname: 'Host', settings: { name: 'Third' } }))
        .status,
    ).toBe(429);
    await rooms(host, 'delete', `/${next.body.id}?confirm=true`);
  });
});

describe('filing the game', () => {
  it("files a player's final books as an ordinary saved game, once", async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Filed game');
    const room = await view(host, id);
    const mySeat = room.table.youSeat;
    const finalCash = room.table.players[mySeat].books.transactions.reduce(
      (sum, t) => sum + t.amountMinor,
      0,
    );
    expect(typeof finalCash).toBe('number');

    const filed = await rooms(host, 'post', `/${id}/save`).send({});
    expect(filed.status).toBe(200);
    expect(filed.body.alreadyFiled).toBe(false);
    expect(filed.body.summary).toMatchObject({ status: 'ended' });
    expect(filed.body.summary.name).toMatch(/^Filed game · /);
    expect(filed.body.summary.endedAt).toBeTruthy();

    // it is in the saved games list, as a game that ended, and can be read
    const list = await api(host, 'get', '/game/saves');
    const entry = list.body.games.find((g) => g.id === filed.body.id);
    expect(entry).toMatchObject({ status: 'ended', gameSetId: 'cashflow' });
    // it remembers it was played with others: which table, how many players, the place won (the list shows them apart)
    expect(entry.multiplayer).toMatchObject({ table: 'Filed game', players: 2, roomId: id });
    // a saved game keeps its table: the host can no longer remove it
    const kept = await rooms(host, 'delete', `/${id}?confirm=true&remove=true`);
    expect(kept.status).toBe(409);
    expect(kept.body.code).toBe('room_kept');
    expect([1, 2]).toContain(entry.multiplayer.rank);
    expect(['escaped', 'playing', 'bankrupt', 'left']).toContain(entry.multiplayer.outcome);
    expect(entry.professionId).toBe(room.table.players[mySeat].professionId);
    const read = await api(host, 'get', `/game/saves/${filed.body.id}`);
    expect(read.status).toBe(200);

    // it loads like any saved game, and the account's game is that game
    const loaded = await api(host, 'post', `/game/saves/${filed.body.id}/load`).send({});
    expect(loaded.status).toBe(200);
    const running = await api(host, 'get', '/game');
    expect(running.body.professionId ?? running.body.state?.professionId).toBe(
      room.table.players[mySeat].professionId,
    );
    await api(host, 'post', '/game/reset').send({ confirm: true });

    // a second request is answered with the game already filed
    const again = await rooms(host, 'post', `/${id}/save`).send({});
    expect(again.body).toMatchObject({ id: filed.body.id, alreadyFiled: true });
    const count = (await api(host, 'get', '/game/saves')).body.games.filter((g) =>
      g.name.startsWith('Filed game'),
    ).length;
    expect(count).toBe(1);
  });

  it('names the saved game as the player asks', async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Named game');
    const filed = await rooms(anna, 'post', `/${id}/save`).send({ name: 'Friday night, my best' });
    expect(filed.body.summary.name).toBe('Friday night, my best');
    expect((await rooms(anna, 'post', `/${id}/save`).send({ name: 'x'.repeat(200) })).status).toBe(
      400,
    );
  });

  it('files once even when two requests arrive together', async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Race game');
    const [a, b] = await Promise.all([
      rooms(host, 'post', `/${id}/save`).send({}),
      rooms(host, 'post', `/${id}/save`).send({}),
    ]);
    expect([a.status, b.status].every((status) => status === 200 || status === 409)).toBe(true);
    expect([a, b].some((r) => r.status === 200 && r.body.alreadyFiled === false)).toBe(true);
    const count = (await api(host, 'get', '/game/saves')).body.games.filter((g) =>
      g.name.startsWith('Race game'),
    ).length;
    expect(count).toBe(1);
    const late = await rooms(host, 'post', `/${id}/save`).send({});
    expect(late.body.alreadyFiled).toBe(true);
  });

  it('is only for a finished game, only for a player of it, only for a game account', async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Guarded game');
    const stranger = await rooms(ben, 'post', `/${id}/save`).send({});
    expect(stranger.status).toBe(403);
    expect(stranger.body.code).toBe('room_forbidden');
    expect((await rooms(normal, 'post', `/${id}/save`).send({})).body.code).toBe(
      'not_a_game_account',
    );
    expect((await rooms(host, 'post', '/no-such-table/save').send({})).status).toBe(404);

    const running = await rooms(host, 'post', '').send({
      nickname: 'Host',
      settings: { name: 'Running', professions: 'random', clock: { mode: 'none' } },
    });
    roomIds.push(running.body.id);
    await rooms(anna, 'post', '/join').send({ roomId: running.body.id, nickname: 'Anna' });
    await rooms(anna, 'put', `/${running.body.id}/ready`).send({ ready: true });
    await rooms(host, 'post', `/${running.body.id}/start`).send({});
    const early = await rooms(host, 'post', `/${running.body.id}/save`).send({});
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('room_not_over');
    // a table closed in its lobby has no books to file
    const lobby = await rooms(host, 'post', '').send({
      nickname: 'Host',
      settings: { name: 'Empty lobby' },
    });
    roomIds.push(lobby.body.id);
    await rooms(host, 'delete', `/${lobby.body.id}?confirm=true`);
    expect((await rooms(host, 'post', `/${lobby.body.id}/save`).send({})).status).toBe(403);
  });
});

describe('the record of a table', () => {
  it('lists the events by seat, oldest first, in pages', async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Logged game');
    const all = await rooms(host, 'get', `/${id}/log`);
    expect(all.status).toBe(200);
    expect(all.body.end).toBe(true);
    const seqs = all.body.events.map((e) => e.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
    const types = all.body.events.map((e) => e.type);
    expect(types[0]).toBe('table_created');
    expect(types).toEqual(
      expect.arrayContaining(['player_joined', 'play_started', 'rolled', 'game_finished']),
    );
    expect(all.body.events.find((e) => e.type === 'player_joined')).toMatchObject({ seat: 1 });
    expect(JSON.stringify(all.body)).not.toContain(host.userId);

    const page = await rooms(host, 'get', `/${id}/log?limit=3`);
    expect(page.body.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(page.body).toMatchObject({ next: 3, end: false });
    const rest = await rooms(host, 'get', `/${id}/log?after=${page.body.next}&limit=1000`);
    expect(rest.body.events[0].seq).toBe(4);
    expect(rest.body.end).toBe(true);
    expect(rest.body.events.length + 3).toBe(all.body.events.length);
  });

  it("follows the live channel's access: players, and spectators of a public table that allows them", async () => {
    if (!dbAvailable) return;
    const id = await finishedTable('Closed record');
    expect((await rooms(ben, 'get', `/${id}/log`)).status).toBe(403);
    expect((await rooms(normal, 'get', `/${id}/log`)).body.code).toBe('not_a_game_account');
    expect((await rooms(host, 'get', `/${id}/log?after=-1`)).status).toBe(400);
    expect((await rooms(host, 'get', `/${id}/log?limit=0`)).status).toBe(400);
    expect((await rooms(host, 'get', '/no-such-table/log')).status).toBe(404);
  });
});
