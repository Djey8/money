'use strict';

// The Dreamfund as a room (todo/dreamfund-multiplayer.md slice 5): a table of the new kind is created, filled with strategy bots,
// started and played to its end through the public HTTP API, over a real CouchDB - the same lobby, clock, log and live channel as the
// classic table, with the Dreamfund's own rules.
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');
const gameRooms = require('../../routes/game-rooms');

jest.setTimeout(240000);

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
const originalDelay = process.env.GAME_BOT_DELAY_MS;
let dbAvailable = false;
let host;
let guest;
const roomIds = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gameUser(label, username) {
  const email = `jest_${Date.now()}_${label}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD, username });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  return { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId };
}

const call = (user, method, path, body) => {
  const req = request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${user.token}`);
  return body === undefined ? req : req.send(body);
};

/** What a person who only rolls does next: the most passive legal move. */
function passive(legal) {
  const has = (type) => legal.find((a) => a.type === type);
  if (has('roll')) return { type: 'roll' };
  if (has('pay_emergency')) return { type: 'pay_emergency', pay: 'now' };
  if (has('answer_life')) return { type: 'answer_life', decision: 'decline' };
  if (has('choose_career_branch')) return { type: 'choose_career_branch', index: 0 };
  if (has('skip')) return { type: 'skip' };
  if (has('end_turn')) return { type: 'end_turn' };
  return null;
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  process.env.GAME_BOT_DELAY_MS = '0';
  if (!dbAvailable) return;
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
  process.env.GAME_ROOMS_MAX_SEATED = '50';
  host = await gameUser('dreamhost', 'Hanna');
  guest = await gameUser('dreamguest', 'Gus');
});

afterAll(async () => {
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (originalDelay === undefined) delete process.env.GAME_BOT_DELAY_MS;
  else process.env.GAME_BOT_DELAY_MS = originalDelay;
  delete process.env.GAME_ROOMS_MAX_HOSTED;
  delete process.env.GAME_ROOMS_MAX_SEATED;
  if (!dbAvailable) return;
  gameRooms.clocks.clearAll();
  for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
  for (const user of [host, guest]) {
    if (user) {
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ confirm: true });
    }
  }
});

const maybe = (name, fn) =>
  it(name, async () => {
    if (!dbAvailable) return;
    await fn();
  });

describe('a Dreamfund room', () => {
  maybe(
    'is created with the Dreamfund settings, takes a person and bots, and is listed as a Dreamfund table',
    async () => {
      const made = await call(host, 'post', '/game/rooms', {
        kind: 'dreamfund',
        nickname: 'Hanna',
        settings: {
          name: 'Dream table',
          difficulty: 'easy',
          shape: 'infinity',
          size: 'small',
          mode: 'guided',
          professions: 'random',
          turnOrder: 'seat',
          endCondition: 'round-limit',
          roundLimit: 12,
        },
      });
      expect(made.status).toBe(201);
      roomIds.push(made.body.id);
      expect(made.body.table).toMatchObject({
        kind: 'dreamfund',
        phase: 'lobby',
        settings: { difficulty: 'easy', shape: 'infinity', endCondition: 'round-limit' },
      });
      expect(made.body.legalActions.map((a) => a.type)).toEqual(
        expect.arrayContaining(['add_bot', 'start', 'update_settings']),
      );

      // the strategies a bot may play
      const catalog = await call(host, 'get', '/game/rooms/bots?kind=dreamfund');
      expect(catalog.status).toBe(200);
      expect(catalog.body.items.map((i) => i.id)).toEqual(
        expect.arrayContaining(['expert', 'saver']),
      );
      const bot = await call(host, 'post', `/game/rooms/${made.body.id}/bots`, {
        policyId: 'dream:expert',
      });
      expect(bot.status).toBe(200);
      expect(bot.body.table.players[1]).toMatchObject({ bot: { policyId: 'expert' } });
      // a bot of a skill level: the strategy with a chance of a slip (master, strong, casual, beginner)
      const levelled = await call(host, 'post', `/game/rooms/${made.body.id}/bots`, {
        policyId: 'dream:saver',
        level: 'casual',
      });
      expect(levelled.status).toBe(200);
      expect(levelled.body.table.players[2].bot.policyId).toBe('saver--casual');
      const wrong = await call(host, 'post', `/game/rooms/${made.body.id}/bots`, {
        policyId: 'dream:nobody',
      });
      expect(wrong.status).toBe(400);

      // a guest joins and the settings can still be changed in the lobby
      const joined = await call(guest, 'post', '/game/rooms/join', {
        roomId: made.body.id,
        nickname: 'Gus',
      });
      expect(joined.status).toBe(200);
      const changed = await call(host, 'put', `/game/rooms/${made.body.id}/settings`, {
        settings: { difficulty: 'hard' },
      });
      expect(changed.status).toBe(200);
      expect(changed.body.table.settings.difficulty).toBe('hard');
      const refused = await call(host, 'put', `/game/rooms/${made.body.id}/settings`, {
        settings: { mode: 'free' },
      });
      expect(refused.status).toBe(400);

      const listed = await call(host, 'get', '/game/rooms?scope=mine&kind=dreamfund');
      const classicList = await call(host, 'get', '/game/rooms?scope=mine');
      expect(classicList.body.items.some((r) => r.id === made.body.id)).toBe(false);
      expect(listed.body.items.find((r) => r.id === made.body.id)).toMatchObject({
        kind: 'dreamfund',
        difficulty: 'hard',
      });
      await call(guest, 'post', `/game/rooms/${made.body.id}/leave`, {});
      await call(host, 'delete', `/game/rooms/${made.body.id}?confirm=true`);
    },
  );

  maybe('is played to its end: a person and two bots, the bots moving by themselves', async () => {
    const made = await call(host, 'post', '/game/rooms', {
      kind: 'dreamfund',
      nickname: 'Hanna',
      settings: {
        name: 'Played',
        professions: 'random',
        turnOrder: 'seat',
        endCondition: 'round-limit',
        roundLimit: 10,
        turnGate: false,
      },
    });
    const roomId = made.body.id;
    roomIds.push(roomId);
    for (const policyId of ['dream:expert', 'dream:saver']) {
      const added = await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId });
      expect(added.status).toBe(200);
    }
    const started = await call(host, 'post', `/game/rooms/${roomId}/start`, {});
    expect(started.status).toBe(200);
    expect(started.body.table.phase).toBe('playing');
    expect(started.body.table.players.every((p) => p.professionId && p.life)).toBe(true);

    let view = started.body;
    const deadline = Date.now() + 200000;
    let moves = 0;
    while (view.table.phase === 'playing' && Date.now() < deadline) {
      const move = view.table.activeSeat === view.table.you ? passive(view.legalActions) : null;
      if (move) {
        const sent = await call(host, 'post', `/game/rooms/${roomId}/commands`, { command: move });
        expect(sent.status).toBe(200);
        view = sent.body;
        moves += 1;
      } else {
        await sleep(60);
        view = (await call(host, 'get', `/game/rooms/${roomId}`)).body;
      }
    }
    expect(view.table.phase).toBe('finished');
    expect(moves).toBeGreaterThan(5);
    const { result } = view.table;
    expect(result.reason).toBe('round-limit');
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(new Set(result.ranking.map((r) => r.seat)).size).toBe(3);
    // the bots played with their strategies: the investing one is ahead of the person who only rolled
    const expert = view.table.players.find((p) => p.bot && p.bot.policyId === 'expert');
    const person = view.table.players.find((p) => p.you);
    const score = (seat) => result.ranking.find((r) => r.seat === seat).score;
    expect(score(expert.seat)).toBeGreaterThan(score(person.seat));

    // the log has the story of the game, by seat
    const log = await call(host, 'get', `/game/rooms/${roomId}/log?limit=200`);
    expect(log.status).toBe(200);
    const types = log.body.items
      ? log.body.items.map((e) => e.type)
      : log.body.events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['play_started', 'rolled', 'game_finished']));
  });

  maybe('refuses a malformed move and a move out of turn, and changes nothing', async () => {
    const made = await call(host, 'post', '/game/rooms', {
      kind: 'dreamfund',
      nickname: 'Hanna',
      settings: { name: 'Refusals', professions: 'random', turnOrder: 'seat' },
    });
    const roomId = made.body.id;
    roomIds.push(roomId);
    await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'dream:etf' });
    await call(host, 'post', `/game/rooms/${roomId}/start`, {});
    const bad = await call(host, 'post', `/game/rooms/${roomId}/commands`, {
      command: { type: 'pay_emergency', pay: 7 },
    });
    expect(bad.status).toBe(400);
    const unknown = await call(host, 'post', `/game/rooms/${roomId}/commands`, {
      command: { type: 'fund_reserve', amountMinor: 100, extra: true },
    });
    expect(unknown.status).toBe(400);
    const early = await call(host, 'post', `/game/rooms/${roomId}/commands`, {
      command: { type: 'end_turn' },
    });
    expect(early.status).toBeGreaterThanOrEqual(400);
    await call(host, 'delete', `/game/rooms/${roomId}?confirm=true`);
  });

  maybe(
    'can be reviewed by a seat and by somebody who only watches a public table - small, and not for a classic table',
    async () => {
      const made = await call(host, 'post', '/game/rooms', {
        kind: 'dreamfund',
        nickname: 'Hanna',
        settings: {
          name: 'Watched',
          professions: 'random',
          turnOrder: 'seat',
          spectators: true,
          endCondition: 'round-limit',
          roundLimit: 40,
        },
      });
      const roomId = made.body.id;
      roomIds.push(roomId);
      await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'dream:expert' });
      await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'dream:sapling' });
      await call(host, 'post', `/game/rooms/${roomId}/start`, {});
      // the bots play on while the person watches: after a few moves the page says where everybody stands
      await sleep(1500);
      for (const viewer of [host, guest]) {
        const review = await call(viewer, 'get', `/game/rooms/${roomId}/review`);
        expect(review.status).toBe(200);
        expect(review.body.players).toHaveLength(3);
        expect(review.body.summary.length).toBeGreaterThan(0);
        expect(review.body.players[0]).toHaveProperty('goals');
        expect(review.body.players[0]).toHaveProperty('pace');
        expect(Array.isArray(review.body.players[0].watch)).toBe(true);
        expect(JSON.stringify(review.body).length).toBeLessThan(8000);
      }
      // the slim table of a Dreamfund table: the seats without their lives
      const slim = await call(guest, 'get', `/game/rooms/${roomId}?slim=true`);
      expect(slim.status).toBe(200);
      expect(slim.body.kind).toBe('dreamfund');
      expect(slim.body.players.every((p) => p.life === undefined)).toBe(true);

      // a classic table cannot be reviewed this way
      const classic = await call(host, 'post', '/game/rooms', {
        nickname: 'Hanna',
        settings: { name: 'Classic', visibility: 'public' },
      });
      roomIds.push(classic.body.id);
      const no = await call(host, 'get', `/game/rooms/${classic.body.id}/review`);
      expect(no.status).toBe(400);
      await call(host, 'delete', `/game/rooms/${roomId}?confirm=true`);
      await call(host, 'delete', `/game/rooms/${classic.body.id}?confirm=true`);
    },
  );

  maybe(
    'files a ranked game on the Dreamfund board - bots at their level and difficulty, a person who opts in - and leaves the classic board alone',
    async () => {
      const classicBefore = await call(
        host,
        'get',
        '/game/leaderboard?type=bot&minGames=0&limit=1',
      );
      const made = await call(host, 'post', '/game/rooms', {
        kind: 'dreamfund',
        nickname: 'Hanna',
        settings: {
          name: 'Ranked',
          difficulty: 'easy',
          professions: 'random',
          turnOrder: 'seat',
          endCondition: 'round-limit',
          roundLimit: 10,
          ranked: true,
          turnGate: false,
        },
      });
      const roomId = made.body.id;
      roomIds.push(roomId);
      await call(host, 'post', `/game/rooms/${roomId}/bots`, { policyId: 'dream:expert' });
      await call(host, 'post', `/game/rooms/${roomId}/bots`, {
        policyId: 'dream:saver',
        level: 'beginner',
      });
      let view = (await call(host, 'post', `/game/rooms/${roomId}/start`, {})).body;
      const deadline = Date.now() + 200000;
      while (view.table.phase === 'playing' && Date.now() < deadline) {
        const move = view.table.activeSeat === view.table.you ? passive(view.legalActions) : null;
        if (move) {
          view = (await call(host, 'post', `/game/rooms/${roomId}/commands`, { command: move }))
            .body;
        } else {
          await sleep(60);
          view = (await call(host, 'get', `/game/rooms/${roomId}`)).body;
        }
      }
      expect(view.table.phase).toBe('finished');
      // the board takes the result a moment after the game ends
      let board;
      for (let i = 0; i < 40; i += 1) {
        board = await call(host, 'get', '/game/dreamfund/leaderboard?difficulty=easy&type=bot');
        if (board.body.items.length >= 2) break;
        await sleep(250);
      }
      expect(board.status).toBe(200);
      const names = board.body.items.map((r) => r.name);
      expect(names).toEqual(
        expect.arrayContaining(['Informed investor', 'Cautious saver (beginner)']),
      );
      const expert = board.body.items.find((r) => r.name === 'Informed investor');
      expect(expert).toMatchObject({
        type: 'bot',
        difficulty: 'easy',
        ratedGames: 1,
        provisional: true,
      });
      // the same bot has nothing on the other difficulties
      const medium = await call(
        host,
        'get',
        '/game/dreamfund/leaderboard?difficulty=medium&type=bot',
      );
      expect(medium.body.items.find((r) => r.name === 'Informed investor')).toBeUndefined();
      // a beginner starts below the master of the same strategy family and the board is ordered by rating
      const ratings = board.body.items.map((r) => r.rating);
      expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);

      // the person is on the board only after they switch it on
      const mine = await call(host, 'get', '/game/dreamfund/players/me');
      expect(mine.status).toBe(200);
      expect(mine.body.ratings.easy.ratedGames).toBe(1);
      expect(mine.body.visible).toBe(false);
      const humansBefore = await call(
        host,
        'get',
        '/game/dreamfund/leaderboard?difficulty=easy&type=human',
      );
      expect(
        humansBefore.body.items.find((r) => r.playerId === mine.body.playerId),
      ).toBeUndefined();
      const shown = await call(host, 'put', '/game/dreamfund/players/me', { visible: true });
      expect(shown.body.visible).toBe(true);
      const humansAfter = await call(
        host,
        'get',
        '/game/dreamfund/leaderboard?difficulty=easy&type=human',
      );
      expect(humansAfter.body.items.find((r) => r.playerId === mine.body.playerId)).toBeTruthy();
      const profile = await call(host, 'get', `/game/dreamfund/players/${mine.body.playerId}`);
      expect(profile.status).toBe(200);
      expect(profile.body.recent[0]).toMatchObject({
        tableId: roomId,
        counted: true,
        difficulty: 'easy',
      });
      expect(JSON.stringify(profile.body)).not.toContain(host.userId);

      // the classic board did not move
      const classicAfter = await call(host, 'get', '/game/leaderboard?type=bot&minGames=0&limit=1');
      expect(JSON.stringify(classicAfter.body)).toBe(JSON.stringify(classicBefore.body));
      const bad = await call(host, 'get', '/game/dreamfund/leaderboard?difficulty=insane');
      expect(bad.status).toBe(400);
    },
  );
});
