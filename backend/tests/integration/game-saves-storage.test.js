'use strict';

// A small document limit, set before the app loads, so the storage guard can be reached in a test.
process.env.COUCHDB_MAX_DOCUMENT_BYTES = '150000';

const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let user;

const api = (method, path) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);

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

it('watches how much room is left: saves are refused when the budget is used up, and delete makes room', async () => {
  if (!dbAvailable) return;
  const saved = [];
  let refusal = null;
  let lastRemaining = Infinity;
  for (let i = 0; i < 80 && !refusal; i += 1) {
    const start = await api('post', '/game/start').send({
      gameSetId: 'cashflow',
      professionId: 'hausmeister',
    });
    expect(start.status).toBe(200);
    await api('post', '/game/payday').send({});
    await api('post', '/game/payday').send({});
    const result = await api('post', '/game/saves').send({ name: `game ${i}` });
    if (result.status === 200) {
      saved.push(result.body.game.id);
      expect(result.body.storage.remainingBytes).toBeLessThanOrEqual(lastRemaining);
      lastRemaining = result.body.storage.remainingBytes;
      await api('post', '/game/reset').send({ confirm: true });
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
  expect((await api('get', '/game')).body.active).toBe(true);

  // making room lets the same save through
  const pruned = await api('post', '/game/saves/prune').send({ keepLatest: 1, confirm: true });
  expect(pruned.body.deleted).toHaveLength(saved.length - 1);
  expect(pruned.body.storage.remainingBytes).toBeGreaterThan(0);
  const again = await api('post', '/game/saves').send({ name: 'after cleanup' });
  expect(again.status).toBe(200);
}, 300000);
