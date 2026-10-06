'use strict';

const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;

let dbAvailable = false;
const createdSessions = [];

async function registerGameUser(suffix) {
  const email = `jest_${Date.now()}${suffix}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  const user = { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId, email };
  createdSessions.push(user);
  return user;
}

function session(method, path, token) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

async function patWith(user, scopes) {
  const created = await session('post', '/api/v1/auth/tokens', user.token).send({
    name: 'game-test',
    scopes,
  });
  expect(created.status).toBe(201);
  return created.body.token;
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  // The registration gate reads this on every call; the real game password never appears in a test.
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (!dbAvailable) return;
  for (const user of createdSessions) {
    await session('delete', '/api/v1/account', user.token).send({ confirm: true });
  }
});

describe('GET /game - read surface and game-account guard', () => {
  it('refuses an account that is not a game account, whatever its scopes', async () => {
    if (!dbAvailable) return;
    const plain = await registerTestUser('_game_plain');
    createdSessions.push(plain);

    const viaSession = await session('get', '/api/v1/game', plain.token);
    expect(viaSession.status).toBe(403);
    expect(viaSession.body.code).toBe('not_a_game_account');

    const pat = await patWith(plain, ['game:r']);
    const viaPat = await session('get', '/api/v1/game', pat);
    expect(viaPat.status).toBe(403);
    expect(viaPat.body.code).toBe('not_a_game_account');
  });

  it('answers a fresh game account: no game yet, and starting one is the legal move', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_fresh');
    const response = await session('get', '/api/v1/game', user.token);
    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);
    expect(response.body.legalActions.map((action) => action.action)).toEqual(['start']);
  });

  it('needs the game:r scope', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_scope');
    const without = await session('get', '/api/v1/game', await patWith(user, ['transactions:r']));
    expect(without.status).toBe(403);
    expect(without.body.code).toBe('scope_insufficient');
    const withScope = await session('get', '/api/v1/game', await patWith(user, ['game:r']));
    expect(withScope.status).toBe(200);
  });

  it("never shows one account's game to another", async () => {
    if (!dbAvailable) return;
    const first = await registerGameUser('_iso_a');
    const second = await registerGameUser('_iso_b');
    const start = await session('post', '/api/data/write/cashflowGame', first.token).send({
      gameSetId: 'placeholder',
      professionId: 'placeholder-profession',
      mode: 'solo',
      boardPosition: null,
      round: 2,
      virtualDate: '2026-03-01',
      children: 0,
      charityRoundsLeft: 0,
      unemployedRoundsLeft: 0,
      gameSubscriptionTitles: [],
      drawnCardIds: { dealSmall: [], dealBig: [], market: [], doodad: [] },
      history: [],
    });
    expect(start.status).toBe(200);

    const mine = await session('get', '/api/v1/game', first.token);
    expect(mine.body).toMatchObject({ active: true, mode: 'solo', round: 2 });
    expect(mine.body.legalActions.map((action) => action.action)).toContain('roll');

    const theirs = await session('get', '/api/v1/game', second.token);
    expect(theirs.body.active).toBe(false);
  });
});

describe('GET /game/sets', () => {
  it('lists the sets and returns one with its board, for game accounts only', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_sets');
    const list = await session('get', '/api/v1/game/sets', user.token);
    expect(list.status).toBe(200);
    const id = list.body.sets[0].id;

    const one = await session('get', `/api/v1/game/sets/${id}`, user.token);
    expect(one.status).toBe(200);
    expect(one.body.board).toHaveLength(24);

    const missing = await session('get', '/api/v1/game/sets/nope', user.token);
    expect(missing.status).toBe(404);

    const plain = await registerTestUser('_sets_plain');
    createdSessions.push(plain);
    const refused = await session('get', '/api/v1/game/sets', plain.token);
    expect(refused.status).toBe(403);
  });
});
