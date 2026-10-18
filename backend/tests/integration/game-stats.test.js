'use strict';

// The leaderboard's recorder (todo/cashflow-leaderboard.md): a finished table becomes one result and moves the profiles. Real
// CouchDB, real routes.
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { getGameRoomsDb, getGameStatsDb } = require('../../config/db');
const roomStore = require('../../repositories/game-room-store');
const statsStore = require('../../repositories/game-stats-store');
const { stats } = require('../../routes/game-rooms');
const { botPlayerId } = require('../../services/game-stats');
const { quickMove } = require('../helpers/quick-move');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let host;
let anna;
let normal;
const roomIds = [];

async function gameUser(label, username) {
  const email = `jest_${Date.now()}_${label}_cashflow@test.local`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: 'TestPassword123!',
    gamePassword: GAME_PASSWORD,
    username,
  });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  return { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId };
}

const rooms = (user, method, path) =>
  request(app)[method](`/api/v1/game/rooms${path}`).set('Authorization', `Bearer ${user.token}`);
const view = async (user, id) => (await rooms(user, 'get', `/${id}`)).body;

/** Plays a two-player table to its end. */
async function playTable(settings) {
  const made = await rooms(host, 'post', '').send({
    settings: {
      name: 'Stats table',
      professions: 'random',
      turnOrder: 'seat',
      turnGate: false,
      clock: { mode: 'none' },
      endCondition: 'round-limit',
      ...settings,
    },
  });
  expect(made.status).toBe(201);
  const id = made.body.id;
  roomIds.push(id);
  await rooms(anna, 'post', '/join').send({ roomId: id });
  await rooms(anna, 'put', `/${id}/ready`).send({ ready: true });
  await rooms(host, 'post', `/${id}/start`).send({});
  const users = [host, anna];
  for (let guard = 0; guard < 600; guard += 1) {
    const current = await view(host, id);
    if (current.table.phase !== 'playing') break;
    const who = users[current.table.activeSeat];
    const me = await view(who, id);
    const done = await rooms(who, 'post', `/${id}/commands`).send({ command: quickMove(me) });
    expect(done.status).toBe(200);
  }
  expect((await view(host, id)).table.phase).toBe('finished');
  return id;
}

/** The recorder runs after the game is saved: wait for the result to appear. */
async function resultOf(id) {
  for (let i = 0; i < 80; i += 1) {
    const found = await statsStore.getResult(getGameStatsDb(), id);
    if (found && found.applied) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('no applied result');
}

const profileOf = (accountId) => statsStore.findHumanProfile(getGameStatsDb(), accountId);

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
  process.env.GAME_ROOMS_MAX_SEATED = '50';
  host = await gameUser('shost', 'Stathost');
  anna = await gameUser('sanna', 'Statanna');
  normal = await registerTestUser('_stats_normal');
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  delete process.env.GAME_ROOMS_MAX_HOSTED;
  delete process.env.GAME_ROOMS_MAX_SEATED;
  if (!dbAvailable) return;
  const statsDb = getGameStatsDb();
  for (const id of roomIds) {
    await roomStore.deleteRoom(getGameRoomsDb(), id);
    const result = await statsStore.getResult(statsDb, id);
    if (result) await statsDb.destroy(result._id, result._rev);
  }
  for (const user of [host, anna]) {
    const profile = user && (await profileOf(user.userId));
    if (profile) await statsDb.destroy(profile._id, profile._rev);
    if (user) {
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ confirm: true });
    }
  }
  if (normal) {
    await request(app)
      .delete('/api/v1/account')
      .set('Authorization', `Bearer ${normal.token}`)
      .send({ confirm: true });
  }
});

describe('recording a finished table', () => {
  it('writes the result once, counts the games, and a table that is too short does not move the rating', async () => {
    if (!dbAvailable) return;
    const id = await playTable({ roundLimit: 1 });
    const result = await resultOf(id);
    expect(result).toMatchObject({ counted: false, rankedWhy: 'too-short', reason: 'round-limit' });
    expect(result.participants).toHaveLength(2);
    expect(result.participants.map((p) => p.delta)).toEqual([0, 0]);
    expect(JSON.stringify(result)).not.toContain(host.userId);

    const profile = await profileOf(host.userId);
    expect(profile).toMatchObject({
      type: 'human',
      displayName: 'Stathost',
      visible: false,
      rating: 1500,
      rated: 0,
    });
    expect(profile.counters).toMatchObject({ played: 1, rankedPlayed: 0 });
    expect(profile.playerId).toMatch(/^[0-9a-f-]{36}$/);

    // recording the same table again changes nothing
    await stats().record(await roomStore.getRoom(getGameRoomsDb(), id));
    expect((await profileOf(host.userId)).counters.played).toBe(1);
  });

  it('a long enough ranked game moves the ratings of the two humans, one up and one down', async () => {
    if (!dbAvailable) return;
    const before = { host: await profileOf(host.userId), anna: await profileOf(anna.userId) };
    const id = await playTable({ roundLimit: 8 });
    const result = await resultOf(id);
    expect(result).toMatchObject({ counted: true, rankedWhy: null, scoringVersion: 2 });
    const [winner, loser] = [...result.participants].sort((a, b) => a.rank - b.rank);
    expect(winner.delta).toBeGreaterThan(0);
    expect(loser.delta).toBeLessThan(0);
    expect(winner.delta + loser.delta).toBeCloseTo(0, 1);

    const after = { host: await profileOf(host.userId), anna: await profileOf(anna.userId) };
    for (const who of ['host', 'anna']) {
      expect(after[who].rated).toBe(before[who].rated + 1);
      expect(after[who].counters.rankedPlayed).toBe(before[who].counters.rankedPlayed + 1);
      expect(after[who].counters.played).toBe(before[who].counters.played + 1);
    }
    const winnerProfile = after.host.playerId === winner.playerId ? after.host : after.anna;
    expect(winnerProfile.counters.wins).toBeGreaterThan(0);
    expect(winnerProfile.rating).toBeGreaterThan(1500);
  });

  it('an unranked table keeps the statistics but not the rating', async () => {
    if (!dbAvailable) return;
    const before = await profileOf(host.userId);
    const id = await playTable({ roundLimit: 8, ranked: false });
    const result = await resultOf(id);
    expect(result).toMatchObject({ counted: false, rankedWhy: 'not-ranked' });
    const after = await profileOf(host.userId);
    expect(after.rating).toBe(before.rating);
    expect(after.counters.played).toBe(before.counters.played + 1);
    expect(after.counters.rankedPlayed).toBe(before.counters.rankedPlayed);
  });

  it('finishes a half-applied result without counting the game twice', async () => {
    if (!dbAvailable) return;
    const id = await playTable({ roundLimit: 1 });
    await resultOf(id);
    const played = (await profileOf(anna.userId)).counters.played;
    // a crash before the result was marked: the profiles have taken it up, the result says not applied
    const half = await statsStore.getResult(getGameStatsDb(), id);
    await statsStore.saveResult(getGameStatsDb(), { ...half, applied: false });
    const repaired = await stats().repair();
    expect(repaired.repaired).toBeGreaterThanOrEqual(1);
    expect((await statsStore.getResult(getGameStatsDb(), id)).applied).toBe(true);
    expect((await profileOf(anna.userId)).counters.played).toBe(played);
  });
});

describe('the bot profiles', () => {
  it('are made once for every strategy at every level, with a stable id and the calibrated rating', async () => {
    if (!dbAvailable) return;
    await stats().seedBots();
    const again = await stats().seedBots();
    expect(again.made).toBe(0);
    const id = botPlayerId('champion-latest--casual');
    expect(id).toBe(botPlayerId('champion-latest--casual'));
    expect(id).not.toBe(botPlayerId('champion-latest'));
    const profile = await statsStore.getProfile(getGameStatsDb(), id);
    expect(profile).toMatchObject({
      type: 'bot',
      botId: 'champion-latest--casual',
      visible: true,
      rated: 0,
    });
    expect(profile.rating).toBeGreaterThan(1000);
    expect(profile.displayName).toContain('casual');
    expect(profile.accountId).toBeUndefined();
  });
});

const board = (user, query = '') =>
  request(app).get(`/api/v1/game/leaderboard${query}`).set('Authorization', `Bearer ${user.token}`);
const me = (user, method = 'get') =>
  request(app)[method]('/api/v1/game/players/me').set('Authorization', `Bearer ${user.token}`);

describe('the leaderboard API', () => {
  it('lists a human only after they opt in, shows no account id, and pages', async () => {
    if (!dbAvailable) return;
    await playTable({ roundLimit: 8 });
    const mineBefore = await me(host);
    expect(mineBefore.status).toBe(200);
    expect(mineBefore.body).toMatchObject({ name: 'Stathost', type: 'human', visible: false });
    expect(JSON.stringify(mineBefore.body)).not.toContain(host.userId);

    const hidden = await board(anna, '?type=human&limit=200');
    expect(hidden.status).toBe(200);
    expect(hidden.body.items.map((i) => i.playerId)).not.toContain(mineBefore.body.playerId);

    const switched = await me(host, 'put').send({ visible: true });
    expect(switched.status).toBe(200);
    expect(switched.body.visible).toBe(true);

    const listed = await board(anna, '?type=human&limit=200');
    const row = listed.body.items.find((i) => i.playerId === mineBefore.body.playerId);
    expect(row).toMatchObject({ name: 'Stathost', type: 'human' });
    expect(row.place).toBeGreaterThanOrEqual(1);
    expect(row.rating).toBe(Math.round(row.rating));
    expect(row.ratedGames).toBeGreaterThanOrEqual(1);
    expect(row.provisional).toBe(row.ratedGames < 5);
    expect(JSON.stringify(listed.body)).not.toContain(host.userId);

    const one = await board(anna, '?type=human&limit=1');
    expect(one.body.items).toHaveLength(1);
    expect(one.body.items[0].place).toBe(1);

    await me(host, 'put').send({ visible: false });
  });

  it('shows a player with their recent results; a hidden human is not found by others', async () => {
    if (!dbAvailable) return;
    const own = await me(host);
    const seenByOther = await request(app)
      .get(`/api/v1/game/players/${own.body.playerId}`)
      .set('Authorization', `Bearer ${anna.token}`);
    expect(seenByOther.status).toBe(404);
    const seenBySelf = await request(app)
      .get(`/api/v1/game/players/${own.body.playerId}`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(seenBySelf.status).toBe(200);
    expect(seenBySelf.body.recent.length).toBeGreaterThan(0);
    expect(seenBySelf.body.recent[0]).toMatchObject({ table: 'Stats table' });
    expect(seenBySelf.body.recent[0].place).toBeGreaterThanOrEqual(1);
  });

  it('shows a bot only once it has a rated game, and any game account may look', async () => {
    if (!dbAvailable) return;
    const listed = await board(host, '?type=bot&limit=200');
    expect(listed.status).toBe(200);
    expect(listed.body.items).toEqual([]);
    const bots = await board(host, '?type=bot&minGames=0&limit=200');
    expect(bots.body.items.length).toBeGreaterThan(50);
    expect(bots.body.items[0]).toMatchObject({ type: 'bot' });
    expect(['master', 'strong', 'casual', 'beginner']).toContain(bots.body.items[0].level);
  });

  it('says in the room whether the game counted and what it did to each seat', async () => {
    if (!dbAvailable) return;
    const id = await playTable({ roundLimit: 8 });
    await resultOf(id);
    const room = await view(host, id);
    expect(room.rating).toMatchObject({ ranked: true });
    expect(room.rating.changes).toHaveLength(2);
    expect(room.rating.changes.map((c) => c.seat).sort()).toEqual([0, 1]);
    const slim = (await rooms(host, 'get', `/${id}?slim=true`)).body;
    expect(slim.rating.ranked).toBe(true);
  });

  it('refuses bad queries and a normal account', async () => {
    if (!dbAvailable) return;
    expect((await board(host, '?type=cats')).status).toBe(400);
    expect((await board(host, '?limit=0')).status).toBe(400);
    expect((await board(host, '?after=-1')).status).toBe(400);
    expect((await me(host, 'put').send({ visible: 'yes' })).status).toBe(400);
    expect((await board(normal)).status).toBe(403);
    expect((await me(normal)).status).toBe(403);
  });
});

describe('one name per account', () => {
  it('a new nickname follows to the profile and to the seat at a table', async () => {
    if (!dbAvailable) return;
    const made = await rooms(host, 'post', '').send({
      settings: { name: 'Rename table', professions: 'random' },
    });
    expect(made.status).toBe(201);
    const id = made.body.id;
    roomIds.push(id);
    await rooms(anna, 'post', '/join').send({ roomId: id });
    expect((await view(host, id)).table.players.map((p) => p.name)).toEqual([
      'Stathost',
      'Statanna',
    ]);

    const patched = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${anna.token}`)
      .send({ username: 'Annabelle' });
    expect(patched.status).toBe(200);

    let names = [];
    for (let i = 0; i < 40 && names[1] !== 'Annabelle'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      names = (await view(host, id)).table.players.map((p) => p.name);
    }
    expect(names).toEqual(['Stathost', 'Annabelle']);
    const profile = await profileOf(anna.userId);
    expect(profile.displayName).toBe('Annabelle');
  });

  it('a deleted account leaves its record but not the person', async () => {
    if (!dbAvailable) return;
    const leaver = await gameUser('sdel', 'Goner');
    await stats().ensureHumanProfile(leaver.userId, 'Goner');
    const before = await profileOf(leaver.userId);
    expect(before.displayName).toBe('Goner');
    await request(app)
      .delete('/api/v1/account')
      .set('Authorization', `Bearer ${leaver.token}`)
      .send({ confirm: true });
    let after = null;
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      after = await statsStore.getProfile(getGameStatsDb(), before.playerId);
      if (after.displayName === 'Deleted player') break;
    }
    expect(after).toMatchObject({ displayName: 'Deleted player', visible: false });
    expect(after.accountId).toBeUndefined();
    const statsDb = getGameStatsDb();
    await statsDb.destroy(after._id, after._rev);
  });
});

describe('the bots to seat', () => {
  it('say what each is rated at each skill level', async () => {
    if (!dbAvailable) return;
    const res = await rooms(host, 'get', '/bots');
    expect(res.status).toBe(200);
    const bot = res.body.items[0];
    expect(Object.keys(bot.ratings).sort()).toEqual(['beginner', 'casual', 'master', 'strong']);
    for (const rating of Object.values(bot.ratings)) {
      expect(Number.isInteger(rating)).toBe(true);
      expect(rating).toBeGreaterThanOrEqual(100);
    }
    // a strategy that plays well is rated higher as a master than as a beginner
    expect(res.body.items.some((b) => b.ratings.master > b.ratings.beginner)).toBe(true);
  });
});

describe('the letters on a token', () => {
  it('are chosen when joining, cleaned to two capitals, and seen by the others', async () => {
    if (!dbAvailable) return;
    const made = await rooms(host, 'post', '').send({
      initials: 'h-x7',
      settings: { name: 'Initials table', professions: 'random' },
    });
    expect(made.status).toBe(201);
    const id = made.body.id;
    roomIds.push(id);
    await rooms(anna, 'post', '/join').send({ roomId: id, initials: 'zq' });
    const seen = (await view(host, id)).table.players;
    expect(seen.map((p) => p.initials)).toEqual(['HX', 'ZQ']);
    const bad = await rooms(anna, 'post', '/join').send({ roomId: id, initials: 7 });
    expect(bad.status).toBe(400);
  });
});

describe('the profile picture', () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64')}`;
  const picture = (user, method) =>
    request(app)[method]('/api/v1/profile/picture').set('Authorization', `Bearer ${user.token}`);

  it('is set, read back, shown to the others on the board as an image, and removed again', async () => {
    if (!dbAvailable) return;
    expect((await picture(host, 'get')).body).toEqual({ picture: null, updatedAt: null });

    const set = await picture(host, 'put').send({ image: jpeg });
    expect(set.status).toBe(200);
    expect(set.body.picture).toBe(jpeg);
    expect((await picture(host, 'get')).body.picture).toBe(jpeg);

    // listed, the leaderboard says there is a picture and serves it
    await playTable({ roundLimit: 8 });
    const mine = await me(host, 'put').send({ visible: true });
    expect(mine.body.pictureVersion).toBe(set.body.updatedAt);
    const listed = await board(anna, '?type=human&limit=200');
    const row = listed.body.items.find((i) => i.playerId === mine.body.playerId);
    expect(row.pictureVersion).toBe(set.body.updatedAt);
    const image = await request(app)
      .get(`/api/v1/game/players/${mine.body.playerId}/picture?v=${row.pictureVersion}`)
      .set('Authorization', `Bearer ${anna.token}`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toMatch(/image\/jpeg/);
    expect(image.body.length).toBeGreaterThan(10);

    // a person who is not listed has no picture for the others
    await me(host, 'put').send({ visible: false });
    const hidden = await request(app)
      .get(`/api/v1/game/players/${mine.body.playerId}/picture`)
      .set('Authorization', `Bearer ${anna.token}`);
    expect(hidden.status).toBe(404);

    expect((await picture(host, 'delete')).status).toBe(204);
    expect((await picture(host, 'get')).body.picture).toBeNull();
    expect((await me(host)).body.pictureVersion).toBeUndefined();
  });

  it('refuses what is not a small picture', async () => {
    if (!dbAvailable) return;
    for (const image of [
      'not a data url',
      'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      'data:image/png;base64,AAAAAAAAAAAAAAAA',
      `data:image/jpeg;base64,${Buffer.alloc(200 * 1024, 0xff).toString('base64')}`,
    ]) {
      const res = await picture(host, 'put').send({ image });
      expect(res.status).toBe(400);
    }
    expect((await picture(host, 'put').send({})).status).toBe(400);
  });
});
