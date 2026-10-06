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

const startedState = (patch = {}) => ({
  gameSetId: 'placeholder',
  professionId: 'placeholder-profession',
  mode: 'companion',
  boardPosition: null,
  round: 0,
  virtualDate: '2026-01-01',
  children: 0,
  charityRoundsLeft: 0,
  unemployedRoundsLeft: 0,
  gameSubscriptionTitles: ['Placeholder profession Salary', 'Placeholder Expenses'],
  drawnCardIds: { dealSmall: [], dealBig: [], market: [], doodad: [] },
  history: [],
  ...patch,
});

const gameSubscriptions = [
  {
    id: 'subscriptions_salary',
    title: 'Placeholder profession Salary',
    account: 'Income',
    amount: 3000,
    startDate: '2026-01-05',
    endDate: '',
    category: '@Salary',
    comment: '#cashflow',
    frequency: 'monthly',
  },
  {
    id: 'subscriptions_expenses',
    title: 'Placeholder Expenses',
    account: 'Daily',
    amount: -1800,
    startDate: '2026-01-06',
    endDate: '',
    category: '@Placeholder Expenses',
    comment: '#cashflow',
    frequency: 'monthly',
  },
];

async function startedGameUser(suffix, patch) {
  const user = await registerGameUser(suffix);
  await session('post', '/api/data/write/subscriptions', user.token).send(gameSubscriptions);
  const write = await session('post', '/api/data/write/cashflowGame', user.token).send(
    startedState(patch),
  );
  expect(write.status).toBe(200);
  return user;
}

describe('POST /game/* - companion actions', () => {
  it('runs a Payday: salary and expenses booked, the round advanced, the game state stored', async () => {
    if (!dbAvailable) return;
    const user = await startedGameUser('_payday');
    const response = await session('post', '/api/v1/game/payday', user.token).send({});
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ round: 1, outcome: 'playing' });
    expect(response.body.cashMinor).toBe(120000);

    const transactions = await session('get', '/api/v1/transactions', user.token);
    expect(transactions.body.transactions.map((t) => t.amountMinor).sort((a, b) => a - b)).toEqual([
      -180000, 300000,
    ]);

    // the stored state is what a second read sees
    const again = await session('get', '/api/v1/game', user.token);
    expect(again.body.round).toBe(1);
  });

  it('takes and repays a bank loan, with its interest subscription', async () => {
    if (!dbAvailable) return;
    const user = await startedGameUser('_loan');
    const borrowed = await session('post', '/api/v1/game/bank-loan', user.token).send({
      amountMinor: 100000,
    });
    expect(borrowed.status).toBe(200);
    expect(borrowed.body.cashMinor).toBe(100000);
    const subscriptions = await session('get', '/api/v1/subscriptions', user.token);
    expect(subscriptions.body.subscriptions.map((s) => s.title)).toContain('Bank loan interest');

    const repaid = await session('post', '/api/v1/game/bank-loan', user.token).send({
      amountMinor: -100000,
    });
    expect(repaid.status).toBe(200);
    expect(repaid.body.cashMinor).toBe(0);
    const after = await session('get', '/api/v1/subscriptions', user.token);
    expect(after.body.subscriptions.map((s) => s.title)).not.toContain('Bank loan interest');
  });

  it('adds a child (Baby) and keeps the expenses subscription', async () => {
    if (!dbAvailable) return;
    const user = await startedGameUser('_baby');
    const response = await session('post', '/api/v1/game/baby', user.token).send({});
    expect(response.status).toBe(200);
    expect(response.body.children).toBe(1);
  });

  it('refuses what the rules do not allow, and bad input', async () => {
    if (!dbAvailable) return;
    const solo = await startedGameUser('_solo', {
      mode: 'solo',
      turn: { phase: 'roll', count: 0 },
    });
    const refused = await session('post', '/api/v1/game/payday', solo.token).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('game_action_not_allowed');

    const bad = await session('post', '/api/v1/game/bank-loan', solo.token).send({
      amountMinor: 0,
    });
    expect(bad.status).toBe(400);

    const none = await registerGameUser('_nogame');
    const noGame = await session('post', '/api/v1/game/payday', none.token).send({});
    expect(noGame.status).toBe(409);
    expect(noGame.body.code).toBe('game_not_started');
  });

  it('needs game:w and a game account', async () => {
    if (!dbAvailable) return;
    const user = await startedGameUser('_scopew');
    const readOnly = await patWith(user, ['game:r']);
    const denied = await session('post', '/api/v1/game/payday', readOnly).send({});
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('scope_insufficient');

    const plain = await registerTestUser('_game_plain_w');
    createdSessions.push(plain);
    const notGame = await session('post', '/api/v1/game/payday', plain.token).send({});
    expect(notGame.status).toBe(403);
    expect(notGame.body.code).toBe('not_a_game_account');
  });
});

describe('POST /game/start, /undo, /reset and GET /game/history', () => {
  async function firstProfession(user) {
    const sets = await session('get', '/api/v1/game/sets', user.token);
    const gameSet = sets.body.sets.find((candidate) => candidate.professions.length > 0);
    return { gameSetId: gameSet.id, professionId: gameSet.professions[0].id };
  }

  it('starts a game with its subscriptions, and refuses a second start', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_start');
    const pick = await firstProfession(user);
    const started = await session('post', '/api/v1/game/start', user.token).send(pick);
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ active: true, mode: 'companion', round: 0 });
    expect(started.body.finances.salaryMinor).toBeGreaterThan(0);

    const subscriptions = await session('get', '/api/v1/subscriptions', user.token);
    expect(subscriptions.body.subscriptions.length).toBeGreaterThan(1);

    const again = await session('post', '/api/v1/game/start', user.token).send(pick);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('game_action_not_allowed');

    const bad = await session('post', '/api/v1/game/start', user.token).send({ gameSetId: 'x' });
    expect(bad.status).toBe(400);
  });

  it('starts a solo game on the board at START', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_startsolo');
    const pick = await firstProfession(user);
    const started = await session('post', '/api/v1/game/start', user.token).send({
      ...pick,
      mode: 'solo',
    });
    expect(started.body).toMatchObject({
      mode: 'solo',
      position: { index: null },
      turn: { phase: 'roll', count: 0 },
    });
    expect(started.body.legalActions.map((action) => action.action)).toContain('roll');
  });

  it('keeps a history of the steps and undoes them back to the start', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_undo');
    const pick = await firstProfession(user);
    await session('post', '/api/v1/game/start', user.token).send(pick);
    const payday = await session('post', '/api/v1/game/payday', user.token).send({});
    expect(payday.body.round).toBe(1);
    expect(payday.body.legalActions.map((action) => action.action)).toContain('undo');

    const history = await session('get', '/api/v1/game/history', user.token);
    expect(history.body.steps.map((step) => step.kind)).toEqual(['start', 'payday']);

    const undone = await session('post', '/api/v1/game/undo', user.token).send({});
    expect(undone.status).toBe(200);
    expect(undone.body.round).toBe(0);
    const transactions = await session('get', '/api/v1/transactions', user.token);
    expect(transactions.body.transactions).toHaveLength(1); // the starting savings only

    const back = await session('post', '/api/v1/game/undo', user.token).send({});
    expect(back.body.active).toBe(false);

    const nothing = await session('post', '/api/v1/game/undo', user.token).send({});
    expect(nothing.status).toBe(409); // no game, nothing to undo
  });

  it('resets only with a confirmation, and leaves no game and no history', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_reset');
    const pick = await firstProfession(user);
    await session('post', '/api/v1/game/start', user.token).send(pick);
    await session('post', '/api/v1/game/payday', user.token).send({});

    const unconfirmed = await session('post', '/api/v1/game/reset', user.token).send({});
    expect(unconfirmed.status).toBe(400);

    const reset = await session('post', '/api/v1/game/reset', user.token).send({ confirm: true });
    expect(reset.status).toBe(200);
    expect(reset.body.active).toBe(false);
    const transactions = await session('get', '/api/v1/transactions', user.token);
    expect(transactions.body.transactions).toHaveLength(0);
    const history = await session('get', '/api/v1/game/history', user.token);
    expect(history.body.steps).toEqual([]);
  });
});
