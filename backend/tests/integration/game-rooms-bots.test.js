'use strict';

// The bot harness (todo/cashflow-multiplayer.md slice S6): scripted clients play whole multiplayer tables through the public HTTP
// API and the live stream, over a real CouchDB, while the network misbehaves and the server restarts - and a normal account
// goes about its business next to them.
const http = require('http');
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');
const gameRooms = require('../../routes/game-rooms');
const { TableBot, playTable, verifyBots, sleep } = require('../helpers/table-bots');

jest.setTimeout(180000);

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let server;
let port;
let players = [];
let normal;
const roomIds = [];
const baseUrl = () => `http://127.0.0.1:${port}`;

async function gameUser(label) {
  const email = `jest_${Date.now()}_${label}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD });
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

/** Opens a table with `count` bots at it, each following its stream, and starts it. */
async function seatedBots(count, settings) {
  const made = await call(players[0], 'post', '/game/rooms', {
    nickname: 'Bot0',
    settings: {
      name: 'Bot table',
      professions: 'random',
      maxSeats: 8,
      turnOrder: 'random',
      ...settings,
    },
  });
  expect(made.status).toBe(201);
  const roomId = made.body.id;
  roomIds.push(roomId);
  const bots = [];
  const bot0 = new TableBot({ name: 'bot0', token: players[0].token, baseUrl, roomId });
  await bot0.connect();
  bots.push(bot0);
  for (let i = 1; i < count; i += 1) {
    const joined = await call(players[i], 'post', '/game/rooms/join', {
      roomId,
      nickname: `Bot${i}`,
    });
    expect(joined.status).toBe(200);
    const bot = new TableBot({ name: `bot${i}`, token: players[i].token, baseUrl, roomId });
    await bot.connect();
    bots.push(bot);
    await call(players[i], 'put', `/game/rooms/${roomId}/ready`, { ready: true });
  }
  const started = await call(players[0], 'post', `/game/rooms/${roomId}/start`, {});
  expect(started.body.table.phase).toBe('playing');
  await Promise.all(bots.map((bot) => bot.waitFor((b) => b.view && b.view.phase === 'playing')));
  return { roomId, bots };
}

async function restartServer() {
  gameRooms.clocks.clearAll(); // the timers are gone with the process
  server.closeAllConnections(); // every stream drops
  await new Promise((resolve) => server.close(resolve));
  await sleep(300); // down for a moment
  gameRooms.resetServiceForTests(); // everything the process held in memory is gone
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(port, resolve));
  await gameRooms.startClocks();
}

/** What a regular, non-game account does with the API, over and over, while tables are being played. */
function startNormalWork(user) {
  const results = { statuses: [], transactions: null, stop: false, down: 0 };
  results.done = (async () => {
    const created = await call(user, 'post', '/transactions', {
      account: 'Daily',
      amountMinor: -1234,
      date: '2026-10-15',
      time: '10:00',
      category: '@Test',
      comment: 'a normal account next to a table',
    });
    results.created = created.status;
    results.snapshot = JSON.stringify((await call(user, 'get', '/transactions?limit=50')).body);
    while (!results.stop) {
      try {
        const me = await call(user, 'get', '/me');
        const list = await call(user, 'get', '/transactions?limit=50');
        results.statuses.push(me.status, list.status);
        if (JSON.stringify(list.body) !== results.snapshot) results.transactions = 'changed';
      } catch {
        // the server is restarting - for everyone, not just for the tables; only what it answers is judged
        results.down += 1;
      }
      await sleep(40);
    }
  })();
  return results;
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
  process.env.GAME_ROOMS_MAX_STREAMS = '50';
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
  for (let i = 0; i < 6; i += 1) players.push(await gameUser(`bot${i}`));
  normal = await registerTestUser('_bots_normal');
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  for (const name of ['GAME_ROOMS_MAX_HOSTED', 'GAME_ROOMS_MAX_SEATED', 'GAME_ROOMS_MAX_STREAMS'])
    delete process.env[name];
  if (!dbAvailable) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  gameRooms.clocks.clearAll();
  for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
  for (const user of [...players, normal]) {
    if (user)
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ confirm: true });
  }
});

describe('six bots play a whole table', () => {
  it('to the end, through duplicate sends, dropped streams and a server restart, next to a normal account', async () => {
    if (!dbAvailable) return;
    const work = startNormalWork(normal);
    const { roomId, bots } = await seatedBots(6, {
      clock: { mode: 'none' },
      endCondition: 'round-limit',
      roundLimit: 3,
    });
    expect(bots.map((b) => b.seat).sort()).toEqual([0, 1, 2, 3, 4, 5]);

    const stats = await playTable(bots, {
      chaos: { duplicateEvery: 6, blipEvery: 9, restartAt: 25 },
      restart: restartServer,
    });
    expect(stats).toMatchObject({ restarts: 1 });
    expect(stats.duplicates).toBeGreaterThanOrEqual(3);
    expect(stats.replays).toBeGreaterThanOrEqual(3);
    expect(stats.blips).toBeGreaterThanOrEqual(2);

    // the table finished, and everybody knows
    await Promise.all(bots.map((bot) => bot.waitFor((b) => b.view.phase === 'finished', 15000)));
    const served = (await bots[0].get()).body;
    expect(served.table.phase).toBe('finished');
    expect(served.table.result.reason).toBe('round-limit');
    expect(served.table.result.ranking.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(served.table.tableRound).toBeLessThanOrEqual(3);

    // every bot rebuilt the same table from snapshot + updates, saw every event, saw versions in order
    expect(await verifyBots(bots)).toEqual([]);
    // the streams really were dropped and came back: every bot reconnected at least once after the restart
    expect(bots.every((bot) => bot.connections >= 2)).toBe(true);
    // nobody ever saw an account id
    const everything = JSON.stringify(bots.map((bot) => [bot.view, [...bot.events.values()]]));
    for (const user of players) expect(everything).not.toContain(user.userId);

    // the finished game is filed by the players who ask, each in their own saved games
    for (const bot of bots.slice(0, 3)) {
      const filed = await bot.post('/save', {});
      expect(filed.status).toBe(200);
      expect(filed.body.alreadyFiled).toBe(false);
    }
    const saves = await call(players[0], 'get', '/game/saves');
    expect(saves.body.games.some((g) => g.status === 'ended')).toBe(true);
    expect(
      (await call(players[0], 'get', '/game/rooms?scope=recent')).body.items.map((i) => i.id),
    ).toContain(roomId);

    // the normal account went on exactly as before, and the tables are not its business
    work.stop = true;
    await work.done;
    expect(work.created).toBe(201);
    expect(work.statuses.length).toBeGreaterThan(10);
    expect(work.statuses.every((status) => status === 200)).toBe(true);
    expect(work.transactions).toBeNull();
    expect(work.down).toBeGreaterThan(0); // it did feel the restart, like everyone
    const refused = await call(normal, 'get', '/game/rooms');
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('not_a_game_account');
    bots.forEach((bot) => bot.disconnect());
  });
});

describe('a bot that does not answer', () => {
  it('is timed out by the server, marked away, and the table plays on without waiting for it', async () => {
    if (!dbAvailable) return;
    const { roomId, bots } = await seatedBots(3, {
      clock: { mode: 'per-move', secondsPerMove: 10 },
      awayAfterTimeouts: 1,
      endCondition: 'round-limit',
      roundLimit: 2,
    });
    const sleeper = bots[1];
    sleeper.slow = true; // connected and watching, but never acts

    const stats = await playTable(bots, { maxIdleMs: 30000 });
    expect(stats.moves).toBeGreaterThan(5);
    await Promise.all(bots.map((bot) => bot.waitFor((b) => b.view.phase === 'finished', 15000)));

    const log = [];
    for (let after = 0; ;) {
      const page = (await bots[0].get(`/log?after=${after}&limit=1000`)).body;
      log.push(...page.events);
      after = page.next;
      if (page.end) break;
    }
    const timeouts = log.filter((e) => e.type === 'turn_timeout');
    expect(timeouts.length).toBeGreaterThanOrEqual(1);
    expect(timeouts.every((e) => e.seat === sleeper.seat)).toBe(true);
    expect(log.filter((e) => e.type === 'player_away')).toHaveLength(1);
    // its later turns were played at once, by the table, without waiting a clock: the sleeper rolled for itself never
    const sleeperRolls = log.filter((e) => e.type === 'rolled' && e.seat === sleeper.seat);
    expect(sleeperRolls.length).toBeGreaterThanOrEqual(2);
    expect(sleeper.commandCount).toBe(0);
    expect(await verifyBots(bots)).toEqual([]);
    const served = (await bots[0].get()).body;
    expect(served.table.players[sleeper.seat].away).toBe(true);
    expect(served.table.result.reason).toBe('round-limit');
    bots.forEach((bot) => bot.disconnect());
    expect(roomIds).toContain(roomId);
  });
});
