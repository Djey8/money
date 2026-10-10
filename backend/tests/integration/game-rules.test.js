'use strict';

const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
const created = [];

async function gameUser(suffix) {
  const email = `jest_${Date.now()}${suffix}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  const user = { token: cookie.split(';')[0].split('=')[1] };
  created.push(user);
  return user;
}

const api = (method, path, user) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);

const start = (user, body) =>
  api('post', '/game/start', user).send({
    gameSetId: 'cashflow',
    professionId: 'hausmeister',
    ...body,
  });

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (!dbAvailable) return;
  for (const user of created) await api('delete', '/account', user).send({ confirm: true });
});

describe('game rules', () => {
  it('starts under a preset and reports the rules; refuses a rule that is not allowed', async () => {
    if (!dbAvailable) return;
    const user = await gameUser('_start');
    const bad = await start(user, { mode: 'solo', rules: { preset: 'strict', sell: 'sometimes' } });
    expect(bad.status).toBe(400);
    const ok = await start(user, { mode: 'solo', rules: { preset: 'guided', sellOfferRolls: 2 } });
    expect(ok.status).toBe(200);
    const game = await api('get', '/game', user);
    expect(game.body.rules).toMatchObject({
      preset: 'custom',
      cardChoice: 'offered-once',
      sell: 'with-offer',
      sellOfferRolls: 2,
    });
  });

  it('a game without rules is free: transactions can be added', async () => {
    if (!dbAvailable) return;
    const user = await gameUser('_free');
    await start(user, { mode: 'companion' });
    expect((await api('get', '/game', user)).body.rules.preset).toBe('free');
    const added = await api('post', '/transactions', user).send({
      account: 'Daily',
      amountMinor: 100000000,
      date: '2026-10-01',
      time: '09:00',
      comment: 'x',
      category: '@Gift',
    });
    expect(added.status).toBe(201);
  });

  it('strict: no free-form transaction can be added by any write, only the game moves change the books', async () => {
    if (!dbAvailable) return;
    const user = await gameUser('_strict');
    await start(user, { mode: 'solo', rules: { preset: 'strict' } });
    const added = await api('post', '/transactions', user).send({
      account: 'Daily',
      amountMinor: 100000000,
      date: '2026-10-01',
      time: '09:00',
      comment: 'x',
      category: '@Gift',
    });
    expect(added.status).toBe(403);
    expect(added.body.code).toBe('game_rules_forbid');
    expect((await api('post', '/subscriptions/refresh', user).send({})).status).toBe(403);
    // a game move still works
    expect((await api('post', '/game/turn', user).send({})).status).toBe(200);
  });

  it('a cap on free amounts refuses a big transaction and takes a small one', async () => {
    if (!dbAvailable) return;
    const user = await gameUser('_cap');
    await start(user, {
      mode: 'solo',
      rules: { manualTransactions: 'allowed', maxFreeAmountMinor: 5000 },
    });
    const body = {
      account: 'Daily',
      date: '2026-10-01',
      time: '09:00',
      comment: 'x',
      category: '@Gift',
    };
    expect(
      (await api('post', '/transactions', user).send({ ...body, amountMinor: 100000000 })).status,
    ).toBe(403);
    expect(
      (await api('post', '/transactions', user).send({ ...body, amountMinor: 4000 })).status,
    ).toBe(201);
  });

  it('offered once: one card per space, only that card; no selling without an offer', async () => {
    if (!dbAvailable) return;
    const user = await gameUser('_cards');
    await start(user, { mode: 'solo', rules: { preset: 'guided' } });

    // roll until the token stands on a card space
    let game;
    for (let i = 0; i < 40; i += 1) {
      game = (await api('get', '/game', user)).body;
      if (game.pendingDecision && game.pendingDecision.kind) break;
      if (game.outcome !== 'playing') break;
      await api('post', '/game/turn', user).send({});
    }
    expect(game.pendingDecision).toBeTruthy();

    // selling: no buyer, and a named price is refused as well
    const noBuyer = await api('post', '/game/positions/sell', user).send({ title: 'NOTHING' });
    expect(noBuyer.status).toBeGreaterThanOrEqual(400);

    const deck = { deal: 'dealSmall', market: 'market', doodad: 'doodad' }[
      game.pendingDecision.kind
    ];
    // playing a card nobody offered is refused
    const play = {
      deal: ['/game/deals/buy', { cardId: 'any-card' }],
      market: ['/game/market/play', { cardId: 'any-card' }],
      doodad: ['/game/doodads/pay', { cardId: 'any-card' }],
    }[game.pendingDecision.kind];
    const early = await api('post', play[0], user).send(play[1]);
    expect(early.status).toBeGreaterThanOrEqual(400);

    const drawn = await api('post', '/game/cards/draw', user).send({ deck });
    expect(drawn.status).toBe(200);
    const again = await api('post', '/game/cards/draw', user).send({ deck });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(again.body)).toMatch(/already offered|not allowed now/);

    const offered = (await api('get', '/game', user)).body.pendingDecision.offered;
    expect(offered.cardId).toBe(drawn.body.result.card.id);
    const other = await api('post', play[0], user).send({ cardId: 'not-the-offered-card' });
    expect(other.status).toBeGreaterThanOrEqual(400);
  });
});
