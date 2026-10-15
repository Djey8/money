'use strict';

// The tables have a rate-limit bucket of their own (todo/cashflow-multiplayer.md, isolation): table traffic neither uses up
// nor is starved by the normal API's budget. The limit is set before the app loads, the limiters are switched on after the
// test accounts exist.
process.env.GAME_ROOMS_RATE_LIMIT = '4';

const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let user;

const api = (path) =>
  request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `jest_${Date.now()}_limits_cashflow@test.local`,
      password: 'TestPassword123!',
      gamePassword: GAME_PASSWORD,
    });
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  user = { token: cookie.split(';')[0].split('=')[1] };
  process.env.SKIP_RATE_LIMIT = 'false';
});

afterAll(async () => {
  process.env.SKIP_RATE_LIMIT = 'true';
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (dbAvailable && user) {
    await request(app)
      .delete('/api/v1/account')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ confirm: true });
  }
});

it("stops table traffic at its own limit without touching the normal API's budget", async () => {
  if (!dbAvailable) return;
  const before = await api('/me');
  expect(before.status).toBe(200);
  const remainingBefore = Number(before.headers['ratelimit-remaining']);

  for (let i = 0; i < 4; i += 1) expect((await api('/game/rooms')).status).toBe(200);
  const refused = await api('/game/rooms');
  expect(refused.status).toBe(429);

  // the normal API still answers, and the four table requests cost it nothing: only this one call
  const after = await api('/me');
  expect(after.status).toBe(200);
  expect(Number(after.headers['ratelimit-remaining'])).toBe(remainingBefore - 1);
});
