'use strict';

// A small budget for saved games, set before the app loads, so the guard can be reached in a test.
process.env.GAME_SAVES_BUDGET_BYTES = '150000';

const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');
const { getUsersDb, getGameSavesDb } = require('../../config/db');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let user;

const api = (method, path) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);
const data = (method, path) =>
  request(app)[method](`/api/data${path}`).set('Authorization', `Bearer ${user.token}`);

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  const email = `jest_${Date.now()}_storage_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD });
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  user = { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId };
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (dbAvailable && user) await api('delete', '/account').send({ confirm: true });
});

async function saveAnotherGame(name) {
  await api('post', '/game/reset').send({ confirm: true });
  const start = await api('post', '/game/start').send({
    gameSetId: 'cashflow',
    professionId: 'hausmeister',
  });
  expect(start.status).toBe(200);
  await api('post', '/game/payday').send({});
  await api('post', '/game/payday').send({});
  const result = await api('post', '/game/saves').send({ name });
  if (result.status === 200) await api('post', '/game/reset').send({ confirm: true });
  return result;
}

it('watches how much room is left: saves are refused when the budget is used up, and delete makes room', async () => {
  if (!dbAvailable) return;
  const saved = [];
  let refusal = null;
  let lastRemaining = Infinity;
  for (let i = 0; i < 80 && !refusal; i += 1) {
    const result = await saveAnotherGame(`game ${i}`);
    if (result.status === 200) {
      saved.push(result.body.game.id);
      expect(result.body.storage.remainingBytes).toBeLessThanOrEqual(lastRemaining);
      lastRemaining = result.body.storage.remainingBytes;
    } else {
      refusal = result;
    }
  }
  expect(saved.length).toBeGreaterThan(1);
  expect(refusal).not.toBeNull();
  expect(refusal.status).toBe(409);
  expect(refusal.body.code).toBe('game_storage_full');
  expect(refusal.body.detail).toMatch(/Delete saved games/);

  // the refused save did not damage anything: the list is intact and the live game still runs
  const list = await api('get', '/game/saves');
  expect(list.body.games).toHaveLength(saved.length);
  expect(list.body.games.every((game) => game.sizeBytes > 0)).toBe(true);
  expect(list.body.storage.gamesBytes).toBe(
    list.body.games.reduce((sum, game) => sum + game.sizeBytes, 0),
  );
  expect((await api('get', '/game')).body.active).toBe(true);

  // making room lets the same save through
  const pruned = await api('post', '/game/saves/prune').send({ keepLatest: 1, confirm: true });
  expect(pruned.body.deleted).toHaveLength(saved.length - 1);
  expect(pruned.body.storage.remainingBytes).toBeGreaterThan(0);
  const again = await api('post', '/game/saves').send({ name: 'after cleanup' });
  expect(again.status).toBe(200);
}, 300000);

it('keeps each saved game in a document of its own, not in the user document', async () => {
  if (!dbAvailable) return;
  const fresh = await api('post', '/game/saves/prune').send({ keepLatest: 0, confirm: true });
  expect(fresh.status).toBe(200);
  const result = await saveAnotherGame('own document');
  expect(result.status).toBe(200);
  const id = result.body.game.id;

  const stored = await getGameSavesDb().get(`${user.userId}:${id}`);
  expect(stored.bytes).toBe(result.body.game.sizeBytes);
  const userDoc = await getUsersDb().get(user.userId);
  expect(userDoc.data.cashflowGames.games).toBeUndefined();
  expect(userDoc.data.cashflowGames.index).toBeDefined();

  // the browser's data paths still reach it
  const read = await data('get', `/read/cashflowGames/games/${id}`);
  expect(read.body.data).toEqual({ schema: stored.schema, payload: stored.payload });
  const batch = await data('post', '/read/batch').send({ paths: [`cashflowGames/games/${id}`] });
  expect(batch.body.data[`cashflowGames/games/${id}`]).toEqual(read.body.data);
});

it('moves games that still sit inside the user document into their own documents', async () => {
  if (!dbAvailable) return;
  await api('post', '/game/saves/prune').send({ keepLatest: 0, confirm: true });
  const result = await saveAnotherGame('old layout');
  expect(result.status).toBe(200);
  const id = result.body.game.id;

  // put it back the way the app stored it before: inside the user document
  const stored = await getGameSavesDb().get(`${user.userId}:${id}`);
  const userDoc = await getUsersDb().get(user.userId);
  userDoc.data.cashflowGames.games = { [id]: { schema: stored.schema, payload: stored.payload } };
  await getUsersDb().insert(userDoc);
  await getGameSavesDb().destroy(stored._id, stored._rev);

  // still readable through the browser's path before anything has moved it
  const before = await data('get', `/read/cashflowGames/games/${id}`);
  expect(before.body.data.payload).toBe(stored.payload);

  const list = await api('get', '/game/saves');
  expect(list.body.games).toHaveLength(1);
  expect(list.body.games[0].sizeBytes).toBe(stored.bytes);
  const moved = await getGameSavesDb().get(`${user.userId}:${id}`);
  expect(moved.payload).toBe(stored.payload);
  const after = await getUsersDb().get(user.userId);
  expect(after.data.cashflowGames.games).toBeUndefined();

  const loaded = await api('post', `/game/saves/${id}/load`).send({});
  expect(loaded.status).toBe(200);
});

it('writes and deletes a game through the browser path, and the account deletion takes the games with it', async () => {
  if (!dbAvailable) return;
  const value = { schema: 'a', payload: 'b'.repeat(1000) };
  const written = await data('post', '/write/cashflowGames/games/game_path_test').send(value);
  expect(written.status).toBe(200);
  expect((await getGameSavesDb().get(`${user.userId}:game_path_test`)).payload).toBe(value.payload);
  expect(
    (await data('post', '/write/cashflowGames/games/game_bad').send({ schema: 'a' })).status,
  ).toBe(400);

  expect((await data('delete', '/delete/cashflowGames/games/game_path_test')).status).toBe(200);
  expect((await data('delete', '/delete/cashflowGames/games/game_path_test')).status).toBe(404);

  // a leftover game disappears with the account
  await data('post', '/write/cashflowGames/games/game_leftover').send(value);
  await api('delete', '/account').send({ confirm: true });
  await expect(getGameSavesDb().get(`${user.userId}:game_leftover`)).rejects.toMatchObject({
    statusCode: 404,
  });
  user = null; // the account is gone; afterAll has nothing left to delete
});
