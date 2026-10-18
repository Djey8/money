'use strict';

// Bot seats (todo/cashflow-tournament-and-bots.md B2): a person and two bots of the server at one table, played to the end through
// the public API and the live stream, over a real CouchDB. The bots move by themselves, one visible step at a time, through the
// same rules, save and log as the person; they hold no account, so nothing of them leaks and no seat marker is made for them.
const http = require('http');
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');
const gameRooms = require('../../routes/game-rooms');
const { TableBot, playTable } = require('../helpers/table-bots');

jest.setTimeout(180000);

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let server;
let port;
let host;
let guest;
const roomIds = [];
const baseUrl = () => `http://127.0.0.1:${port}`;

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

const call = (user, method, path, body) => {
  const req = request(baseUrl())
    [method](`/api/v1${path}`)
    .set('Authorization', `Bearer ${user.token}`);
  return body === undefined ? req : req.send(body);
};

async function openTable(settings = {}) {
  const made = await call(host, 'post', '/game/rooms', {
    nickname: 'Human',
    settings: {
      name: 'With bots',
      professions: 'duplicates',
      maxSeats: 6,
      clock: { mode: 'none' },
      endCondition: 'round-limit',
      roundLimit: 3,
      ...settings,
    },
  });
  expect(made.status).toBe(201);
  roomIds.push(made.body.id);
  return made.body.id;
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  process.env.GAME_BOT_DELAY_MS = '0';
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
  process.env.GAME_ROOMS_MAX_SEATED = '50';
  process.env.GAME_ROOMS_MAX_STREAMS = '50';
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
  host = await gameUser('human');
  guest = await gameUser('guest');
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  for (const name of [
    'GAME_BOT_DELAY_MS',
    'GAME_ROOMS_MAX_HOSTED',
    'GAME_ROOMS_MAX_SEATED',
    'GAME_ROOMS_MAX_STREAMS',
  ])
    delete process.env[name];
  if (!dbAvailable) return;
  gameRooms.bots.clearAll();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  gameRooms.clocks.clearAll();
  for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
  for (const user of [host, guest]) {
    if (user)
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ confirm: true });
  }
});

describe('the catalog and the lobby', () => {
  it('lists the bots a host can seat, each with an id, a name, a difficulty and how it plays', async () => {
    if (!dbAvailable) return;
    const res = await call(host, 'get', '/game/rooms/bots');
    expect(res.status).toBe(200);
    const ids = res.body.items.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(['all-rounder', 'never-buy', 'best-found']));
    for (const bot of res.body.items) {
      expect(Object.keys(bot).sort()).toEqual([
        'description',
        'difficulty',
        'id',
        'name',
        'ratings',
      ]);
    }
  });

  it('the host seats bots; they are ready, flagged, and have no account', async () => {
    if (!dbAvailable) return;
    const roomId = await openTable();
    const added = await call(host, 'post', `/game/rooms/${roomId}/bots`, {
      policyId: 'all-rounder',
    });
    expect(added.status).toBe(200);
    const view = added.body.table || added.body;
    const players = view.players;
    expect(players).toHaveLength(2);
    expect(players[1]).toMatchObject({
      name: 'Allie All-Round',
      ready: true,
      bot: { policyId: 'all-rounder' },
    });
    expect(players[0].bot).toBeNull();
    expect(JSON.stringify(added.body)).not.toContain('bot:');
    // no seat marker is made for a bot: only the host holds one
    const markers = await store.seatMarkers(getGameRoomsDb(), host.userId);
    expect(markers.filter((m) => m.roomId === roomId)).toHaveLength(1);
    const room = await store.getRoom(getGameRoomsDb(), roomId);
    expect(room.seatsTaken).toBe(2);
  });

  it('a bot can be seated at a skill level, which is part of its strategy id and name', async () => {
    if (!dbAvailable) return;
    const roomId = await openTable();
    const catalog = (await call(host, 'get', '/game/rooms/bots')).body;
    expect(catalog.levels.map((l) => l.id)).toEqual(['master', 'strong', 'casual', 'beginner']);
    const added = await call(host, 'post', `/game/rooms/${roomId}/bots`, {
      policyId: 'champion-v1',
      level: 'casual',
    });
    expect(added.status).toBe(200);
    const bot = (added.body.table || added.body).players[1];
    expect(bot.bot).toEqual({ policyId: 'champion-v1--casual' });
    expect(bot.name).toBe('Champion Cleo (casual)');
    const refused = (body) => call(host, 'post', `/game/rooms/${roomId}/bots`, body);
    expect((await refused({ policyId: 'all-rounder', level: 'genius' })).status).toBe(400);
    expect((await refused({ policyId: 'all-rounder--genius' })).status).toBe(400);
  });

  it('refuses an unknown bot, a guest adding one, a bot in a running game and a taken name', async () => {
    if (!dbAvailable) return;
    const roomId = await openTable();
    expect(
      (await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'nope' })).status,
    ).toBe(400);
    expect((await call(host, 'post', `/game/rooms/${roomId}/bots`, {})).status).toBe(400);
    await call(guest, 'post', '/game/rooms/join', { roomId, nickname: 'Guest' });
    const notHost = await call(guest, 'post', `/game/rooms/${roomId}/bots`, {
      policyId: 'all-rounder',
    });
    expect(notHost.status).toBe(403);
    await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'all-rounder' });
    const taken = await call(host, 'post', `/game/rooms/${roomId}/bots`, {
      policyId: 'best-found',
      name: 'allie all-round',
    });
    expect(taken.status).toBeGreaterThanOrEqual(400);
    // the catalog route is not mistaken for a table
    expect((await call(host, 'get', '/game/rooms/bots')).status).toBe(200);
  });

  it('the host can remove a bot with a kick of its seat', async () => {
    if (!dbAvailable) return;
    const roomId = await openTable();
    await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'never-buy' });
    const kicked = await call(host, 'post', `/game/rooms/${roomId}/kick`, { seat: 1 });
    expect(kicked.status).toBe(200);
    expect((kicked.body.table || kicked.body).players).toHaveLength(1);
  });
});

describe('a person and two bots play a whole table', () => {
  it('the bots move by themselves, visibly, to the end; nothing of them leaks', async () => {
    if (!dbAvailable) return;
    const roomId = await openTable();
    await call(host, 'post', `/game/rooms/${roomId}/bots`, {
      policyId: 'all-rounder',
      professionId: 'lehrer',
    });
    await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'mlm-then-properties' });
    const human = new TableBot({ name: 'human', token: host.token, baseUrl, roomId });
    await human.connect();
    await call(host, 'put', `/game/rooms/${roomId}/ready`, { ready: true });
    const started = await call(host, 'post', `/game/rooms/${roomId}/start`, {});
    expect(started.status).toBe(200);
    expect((started.body.table || started.body).phase).toBe('picking');
    await call(host, 'put', `/game/rooms/${roomId}/profession`, { professionId: 'manager' });
    await human.waitFor((b) => b.view && b.view.phase === 'playing');
    // the bots chose their own professions
    expect(human.view.players.map((p) => p.professionId)).toEqual(
      expect.arrayContaining(['manager', 'lehrer']),
    );

    const stats = await playTable([human], { maxMoves: 400, maxIdleMs: 30000 });
    expect(stats.moves).toBeGreaterThanOrEqual(3); // the person plays a round-limited game: about one move per round
    await human.waitFor((b) => b.view.phase === 'finished', 30000);

    const served = (await human.get()).body;
    expect(served.table.phase).toBe('finished');
    expect(served.table.result.ranking).toHaveLength(3);
    expect(served.table.players.filter((p) => p.bot)).toHaveLength(2);

    // the log shows the bots' moves like anyone's, by seat; and no account or bot id anywhere
    const log = [];
    for (let after = 0; ;) {
      const page = (await human.get(`/log?after=${after}&limit=1000`)).body;
      log.push(...page.events);
      after = page.next;
      if (page.end) break;
    }
    const rolls = log.filter((e) => e.type === 'rolled');
    expect(new Set(rolls.map((e) => e.seat)).size).toBe(3);
    expect(log.some((e) => e.type === 'bot_added')).toBe(true);
    const everything = JSON.stringify([human.view, log]);
    expect(everything).not.toContain('bot:');
    expect(everything).not.toContain(host.userId);

    // the finished game is the human's to file; a bot has no saved games
    const filed = await human.post('/save', {});
    expect(filed.status).toBe(200);
    human.disconnect();
  });
});
