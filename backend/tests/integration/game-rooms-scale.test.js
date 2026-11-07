'use strict';

// Tables must stay fast however many games are stored (JFK, 2026-11-04): every query of the game database is answered from an
// index - never by reading all documents - and the history of long-finished games goes, in small steps, off the request path.
const request = require('supertest');
const crypto = require('crypto');
const { app, checkDb } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const { createGameRoomService } = require('../../services/game-rooms');
const store = require('../../repositories/game-room-store');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let user;

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
      email: `jest_${Date.now()}_scale_cashflow@test.local`,
      password: 'TestPassword123!',
      gamePassword: GAME_PASSWORD,
      username: 'Scale',
    });
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  user = { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId };
});

afterAll(async () => {
  delete process.env.GAME_ROOMS_HISTORY_MS;
  delete process.env.GAME_ROOMS_LOBBY_IDLE_MS;
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  if (dbAvailable && user) {
    await request(app)
      .delete('/api/v1/account')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ confirm: true });
  }
});

describe('the game database at scale', () => {
  it('answers every query of the game store from an index', async () => {
    if (!dbAvailable) return;
    const db = getGameRoomsDb();
    const warnings = [];
    // CouchDB says "No matching index found" in the answer of a query that has to read every document
    const spy = new Proxy(db, {
      get(target, key) {
        if (key === 'find') {
          return async (query) => {
            const result = await target.find(query);
            if (result.warning)
              warnings.push({ selector: query.selector, warning: result.warning });
            return result;
          };
        }
        const value = target[key];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const now = new Date().toISOString();
    await store.findByInviteCode(spy, 'NOCODE');
    await store.listPublicRooms(spy, 'lobby', 10);
    await store.listPublicRooms(spy, 'playing', 10);
    await store.findIdleRooms(spy, now, 5);
    await store.findIdleRooms(spy, now, 5, '2000-01-01');
    await store.listOpenRoomEntries(spy);
    await store.countOpenRooms(spy);
    await store.listPlayingRooms(spy);
    await store.findCompactable(spy, now, 5);
    await store.syncMarkers(spy, 'no-such-room', new Map());
    await store.deleteRoom(spy, 'no-such-room');
    expect(warnings).toEqual([]);
  });

  it('removes the history of a finished table after a while, keeps the table, and does it outside the requests', async () => {
    if (!dbAvailable) return;
    const made = await request(app)
      .post('/api/v1/game/rooms')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ nickname: 'Scale', settings: { name: 'Scale table' } });
    expect(made.status).toBe(201);
    const id = made.body.id;
    const service = createGameRoomService({ db: getGameRoomsDb() });
    process.env.GAME_ROOMS_HISTORY_MS = '1';
    process.env.GAME_ROOMS_LOBBY_IDLE_MS = '1';
    await new Promise((resolve) => setTimeout(resolve, 20));
    // the first sweep closes the idle table (it is over now: its history is due after a moment)
    await service.sweep();
    const closed = await store.getRoom(getGameRoomsDb(), id);
    expect(closed.phase).toBe('abandoned');
    expect(closed.compactAfter).toBeTruthy();
    expect((await store.readEvents(getGameRoomsDb(), id, 0, 50)).length).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await service.sweep();
    expect(second.compacted).toBeGreaterThanOrEqual(1);
    const kept = await store.getRoom(getGameRoomsDb(), id);
    expect(kept).toMatchObject({ phase: 'abandoned', compacted: true });
    expect(kept.compactAfter).toBeUndefined();
    expect(await store.readEvents(getGameRoomsDb(), id, 0, 50)).toEqual([]);
    await store.deleteRoom(getGameRoomsDb(), id);
  });
});
