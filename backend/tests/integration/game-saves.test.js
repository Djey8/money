'use strict';

const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;

let dbAvailable = false;
const created = [];

async function registerGameUser(suffix) {
  const email = `jest_${Date.now()}${suffix}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  const user = { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId, email };
  created.push(user);
  return user;
}

const api = (method, path, user) =>
  request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);

async function startGame(user, mode = 'companion') {
  const response = await api('post', '/game/start', user).send({
    gameSetId: 'cashflow',
    professionId: 'hausmeister',
    mode,
  });
  expect(response.status).toBe(200);
  return response.body;
}

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

describe('saved games', () => {
  it('saves the running game, keeps the slot on a second save, and lists it with the storage left', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_save');
    await startGame(user);
    await api('post', '/game/payday', user).send({});

    const first = await api('post', '/game/saves', user).send({ name: 'Janitor run' });
    expect(first.status).toBe(200);
    expect(first.body.game).toMatchObject({ name: 'Janitor run', round: 1, status: 'playing' });
    expect(first.body.storage.remainingBytes).toBeGreaterThan(0);

    await api('post', '/game/payday', user).send({});
    const second = await api('post', '/game/saves', user).send({});
    expect(second.body.game.id).toBe(first.body.game.id);
    expect(second.body.game).toMatchObject({ name: 'Janitor run', round: 2 });

    const list = await api('get', '/game/saves', user);
    expect(list.body.games).toHaveLength(1);
    expect(list.body.currentGameId).toBe(first.body.game.id);
    expect(list.body.storage).toMatchObject({ gameCount: 1, keepAtMost: 100, overKeepBy: 0 });

    const one = await api('get', `/game/saves/${first.body.game.id}`, user);
    expect(one.body.steps.map((step) => step.kind)).toEqual(['start', 'payday', 'payday']);
  });

  it('ends a game (saved as ended, account cleared) and continues it later with its history', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_end');
    await startGame(user);
    await api('post', '/game/payday', user).send({});
    const ended = await api('post', '/game/end', user).send({});
    expect(ended.status).toBe(200);
    expect(ended.body.game.status).toBe('ended');
    const cleared = await api('get', '/game', user);
    expect(cleared.body.active).toBe(false);

    const loaded = await api('post', `/game/saves/${ended.body.game.id}/load`, user).send({});
    expect(loaded.status).toBe(200);
    const game = await api('get', '/game', user);
    expect(game.body).toMatchObject({ active: true, round: 1, gameId: ended.body.game.id });
    expect(game.body.legalActions.map((a) => a.action)).toContain('undo');

    // the history came back with it: one undo takes the payday back
    const undone = await api('post', '/game/undo', user).send({});
    expect(undone.body.round).toBe(0);
    const list = await api('get', '/game/saves', user);
    expect(list.body.games[0].status).toBe('playing'); // continuing an ended game un-ends it
  });

  it('saves the running game before another one is loaded', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_switch');
    await startGame(user);
    const first = await api('post', '/game/saves', user).send({ name: 'First' });
    await api('post', '/game/reset', user).send({ confirm: true });
    await startGame(user, 'solo');
    await api('post', '/game/turn', user).send({});

    const loaded = await api('post', `/game/saves/${first.body.game.id}/load`, user).send({});
    expect(loaded.status).toBe(200);
    const list = await api('get', '/game/saves', user);
    expect(list.body.games).toHaveLength(2); // the solo game was saved on the way out
    expect(list.body.games.map((game) => game.name)).toContain('First');
    const live = await api('get', '/game', user);
    expect(live.body.mode).toBe('companion');
  });

  it('renames, deletes (only confirmed) and prunes', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_manage');
    await startGame(user);
    const ids = [];
    for (const name of ['a', 'b', 'c', 'd']) {
      const saved = await api('post', '/game/saves', user).send({ name });
      ids.push(saved.body.game.id);
      await api('post', '/game/reset', user).send({ confirm: true });
      await startGame(user);
    }
    // each save was made from the same slot after a reset, so they are different games
    expect(new Set(ids).size).toBe(4);

    const renamed = await api('patch', `/game/saves/${ids[0]}`, user).send({ name: 'Renamed' });
    expect(renamed.status).toBe(200);

    const unconfirmed = await api('delete', `/game/saves/${ids[1]}`, user);
    expect(unconfirmed.status).toBe(400);
    const deleted = await api('delete', `/game/saves/${ids[1]}?confirm=true`, user);
    expect(deleted.body.deleted).toEqual([ids[1]]);
    const missing = await api('get', `/game/saves/${ids[1]}`, user);
    expect(missing.status).toBe(404);

    const refused = await api('post', '/game/saves/prune', user).send({ keepLatest: 1 });
    expect(refused.status).toBe(400);
    const pruned = await api('post', '/game/saves/prune', user).send({
      keepIds: [ids[0]],
      keepLatest: 0,
      confirm: true,
    });
    expect(pruned.body.deleted.sort()).toEqual([ids[2], ids[3]].sort());
    const list = await api('get', '/game/saves', user);
    expect(list.body.games.map((game) => game.id)).toEqual([ids[0]]);
    expect(list.body.games[0].name).toBe('Renamed');
  });

  it('is for game accounts with the right scope, and nobody sees another account saves', async () => {
    if (!dbAvailable) return;
    const owner = await registerGameUser('_own');
    const other = await registerGameUser('_other');
    await startGame(owner);
    const saved = await api('post', '/game/saves', owner).send({});
    const stolen = await api('get', `/game/saves/${saved.body.game.id}`, other);
    expect(stolen.status).toBe(404);
    expect((await api('get', '/game/saves', other)).body.games).toEqual([]);

    const token = (
      await api('post', '/auth/tokens', owner).send({ name: 'reader', scopes: ['game:r'] })
    ).body.token;
    const asReader = (method, path) =>
      request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
    expect((await asReader('get', '/game/saves')).status).toBe(200);
    const write = await asReader('post', '/game/saves').send({});
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('scope_insufficient');
  });

  it('refuses a save with no game, and a game that was never started', async () => {
    if (!dbAvailable) return;
    const user = await registerGameUser('_none');
    const none = await api('post', '/game/saves', user).send({});
    expect(none.status).toBe(409);
    expect(none.body.code).toBe('game_not_started');
  });
});
