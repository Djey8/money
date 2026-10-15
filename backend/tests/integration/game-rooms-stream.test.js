'use strict';

// The live channel of the multiplayer tables (todo/cashflow-multiplayer.md slice S2): a real server, real sockets, real CouchDB.
const http = require('http');
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');
const { hub } = require('../../routes/game-rooms');

const GAME_PASSWORD = 'integration-test-only';
const originalHash = process.env.CASHFLOW_GAME_PASSWORD_SHA256;
let dbAvailable = false;
let server;
let port;
let host;
let anna;
let ben;
let normal;
const roomIds = [];
const open = [];

async function gameUser(label) {
  const email = `jest_${Date.now()}_${label}_cashflow@test.local`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'TestPassword123!', gamePassword: GAME_PASSWORD });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('access_token='));
  return { token: cookie.split(';')[0].split('=')[1], userId: res.body.userId };
}

const call = (user, method, path) =>
  request(app)[method](`/api/v1/game/rooms${path}`).set('Authorization', `Bearer ${user.token}`);

async function createRoom(user, settings = {}, nickname = 'Host') {
  const res = await call(user, 'post', '').send({
    nickname,
    settings: { name: 'Stream table', ...settings },
  });
  expect(res.status).toBe(201);
  roomIds.push(res.body.id);
  return res.body;
}

/**
 * Opens the stream over a real socket and collects what arrives: `messages` are `{ id, event, data }` and `comments` the
 * heartbeat lines. Resolves with the status and headers (and the problem body when it is not a stream).
 */
function openStream(user, roomId, { lastEventId } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${user.token}` };
    if (lastEventId !== undefined) headers['Last-Event-ID'] = String(lastEventId);
    const req = http.get(
      { host: '127.0.0.1', port, path: `/api/v1/game/rooms/${roomId}/events`, headers },
      (res) => {
        const stream = {
          status: res.statusCode,
          headers: res.headers,
          messages: [],
          comments: [],
          body: '',
        };
        let buffer = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (res.statusCode !== 200) {
            stream.body += chunk;
            return;
          }
          buffer += chunk;
          let at;
          while ((at = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, at);
            buffer = buffer.slice(at + 2);
            const message = {};
            for (const line of block.split('\n')) {
              if (line.startsWith(':')) stream.comments.push(line);
              else if (line.startsWith('id: ')) message.id = Number(line.slice(4));
              else if (line.startsWith('event: ')) message.event = line.slice(7);
              else if (line.startsWith('data: ')) message.data = JSON.parse(line.slice(6));
              else if (line.startsWith('retry: ')) message.retry = Number(line.slice(7));
            }
            if (message.event || message.retry !== undefined) stream.messages.push(message);
          }
        });
        stream.close = () => req.destroy();
        stream.waitFor = async (predicate, ms = 4000) => {
          const until = Date.now() + ms;
          while (Date.now() < until) {
            const found = stream.messages.find(predicate);
            if (found) return found;
            await new Promise((r) => setTimeout(r, 10));
          }
          throw new Error(`timed out; got ${JSON.stringify(stream.messages.map((m) => m.event))}`);
        };
        open.push(stream);
        resolve(stream);
      },
    );
    req.on('error', (error) => {
      if (error.code !== 'ECONNRESET') reject(error);
    });
  });
}

const closeAll = () => {
  while (open.length) open.pop().close();
};

beforeAll(async () => {
  dbAvailable = await checkDb();
  process.env.CASHFLOW_GAME_PASSWORD_SHA256 = crypto
    .createHash('sha256')
    .update(GAME_PASSWORD)
    .digest('hex');
  if (!dbAvailable) return;
  process.env.GAME_ROOMS_MAX_HOSTED = '50';
  process.env.GAME_ROOMS_MAX_SEATED = '50';
  server = http.createServer(app).listen(0);
  port = server.address().port;
  host = await gameUser('shost');
  anna = await gameUser('sanna');
  ben = await gameUser('sben');
  normal = await registerTestUser('_stream_normal');
});

afterEach(() => {
  closeAll();
  delete process.env.GAME_ROOMS_MAX_STREAMS;
  delete process.env.GAME_ROOMS_HEARTBEAT_MS;
});

afterAll(async () => {
  closeAll();
  if (originalHash === undefined) delete process.env.CASHFLOW_GAME_PASSWORD_SHA256;
  else process.env.CASHFLOW_GAME_PASSWORD_SHA256 = originalHash;
  delete process.env.GAME_ROOMS_MAX_HOSTED;
  delete process.env.GAME_ROOMS_MAX_SEATED;
  if (!dbAvailable) return;
  for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
  for (const user of [host, anna, ben, normal]) {
    if (user) {
      await request(app)
        .delete('/api/v1/account')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ confirm: true });
    }
  }
  await new Promise((resolve) => server.close(resolve));
});

describe('who may watch', () => {
  it('turns away a normal account, a visitor, strangers at private tables and at tables without spectators', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const priv = await createRoom(host, { visibility: 'private', name: 'Hidden' });
    const refused = await openStream(normal, room.id);
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body).code).toBe('not_a_game_account');
    const anonymous = await new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port, path: `/api/v1/game/rooms/${room.id}/events` }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
    });
    expect(anonymous).toBe(401);
    expect((await openStream(ben, priv.id)).status).toBe(404);
    const noSpectators = await openStream(ben, room.id);
    expect(noSpectators.status).toBe(403);
    expect(JSON.parse(noSpectators.body).code).toBe('room_forbidden');
    expect((await openStream(host, 'no-such-table')).status).toBe(404);
    const badId = await openStream(host, room.id, { lastEventId: 'abc' });
    expect(badId.status).toBe(400);
    // nothing was left connected
    expect(hub.size()).toBe(0);
  });

  it('lets anyone with a game account watch a public table that allows spectators', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host, { spectators: true });
    const stream = await openStream(ben, room.id);
    expect(stream.status).toBe(200);
    const snapshot = await stream.waitFor((m) => m.event === 'snapshot');
    expect(snapshot.data.view.youSeat).toBeNull();
    expect(snapshot.data.room.inviteCode).toBeUndefined();
    // a spectator holds no seat: presence lists only the players
    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    const update = await stream.waitFor((m) => m.event === 'update');
    expect(update.data.events.map((e) => e.type)).toEqual(['player_joined']);
    expect(update.data.view.players).toHaveLength(2);
  });
});

describe('the stream of a table', () => {
  it('starts with the snapshot of the table as its viewer sees it', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const stream = await openStream(host, room.id);
    expect(stream.status).toBe(200);
    expect(stream.headers['content-type']).toContain('text/event-stream');
    expect(stream.headers['cache-control']).toContain('no-cache');
    expect(stream.headers['x-accel-buffering']).toBe('no');
    await stream.waitFor((m) => m.event === 'snapshot');
    expect(stream.messages[0]).toEqual({ retry: 3000 });
    const snapshot = stream.messages.find((m) => m.event === 'snapshot');
    expect(snapshot.id).toBe(1);
    expect(snapshot.data.room).toMatchObject({
      id: room.id,
      inviteCode: room.inviteCode,
      language: 'en',
    });
    expect(snapshot.data.view).toMatchObject({
      id: room.id,
      version: 1,
      youSeat: 0,
      phase: 'lobby',
    });
    expect(JSON.stringify(snapshot.data)).not.toContain(host.userId);
  });

  it('pushes every change the moment it is made, as an update with the events by seat', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const stream = await openStream(host, room.id);
    await stream.waitFor((m) => m.event === 'snapshot');

    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    const joined = await stream.waitFor((m) => m.event === 'update');
    expect(joined.data.version).toBe(2);
    expect(joined.id).toBe(2);
    expect(joined.data.events).toEqual([
      expect.objectContaining({
        seq: 2,
        type: 'player_joined',
        seat: 1,
        data: expect.objectContaining({ name: 'Anna' }),
      }),
    ]);
    expect(joined.data.booksChanged).toEqual([]);
    expect(joined.data.view.players.map((p) => p.name)).toEqual(['Host', 'Anna']);

    await call(anna, 'put', `/${room.id}/ready`).send({ ready: true });
    const ready = await stream.waitFor((m) => m.event === 'update' && m.data.version === 3);
    expect(ready.data.events[0]).toMatchObject({ type: 'ready_changed', seat: 1 });
    expect(JSON.stringify([joined, ready])).not.toContain(anna.userId);
  });

  it('sends the books of every player at the start of play, in the update that starts it', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host, { professions: 'random', turnOrder: 'seat' });
    const stream = await openStream(host, room.id);
    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    await call(anna, 'put', `/${room.id}/ready`).send({ ready: true });
    await stream.waitFor((m) => m.event === 'update' && m.data.version === 3);
    await call(host, 'post', `/${room.id}/start`).send({});
    const started = await stream.waitFor((m) => m.event === 'update' && m.data.version === 4);
    expect(started.data.view.phase).toBe('playing');
    expect(
      started.data.view.players.every((p) => p.books && p.books.subscriptions.length > 0),
    ).toBe(true);
    expect(started.data.booksChanged).toEqual([0, 1]);
    expect(started.data.events.map((e) => e.type)).toEqual([
      'professions_revealed',
      'play_started',
    ]);
  });

  it('shows every viewer only what they may see: a secret pick reaches its owner alone', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host, { professions: 'duplicates' });
    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    await call(ben, 'post', '/join').send({ roomId: room.id, nickname: 'Ben' });
    for (const user of [anna, ben])
      await call(user, 'put', `/${room.id}/ready`).send({ ready: true });
    await call(host, 'post', `/${room.id}/start`).send({});
    const asAnna = await openStream(anna, room.id);
    const asBen = await openStream(ben, room.id);
    await asAnna.waitFor((m) => m.event === 'snapshot');
    await asBen.waitFor((m) => m.event === 'snapshot');

    await call(anna, 'put', `/${room.id}/profession`).send({ professionId: 'pilot' });
    const pick = (stream) =>
      stream.waitFor((m) => m.event === 'update').then((m) => m.data.view.players[1]);
    expect(await pick(asAnna)).toMatchObject({ hasPicked: true, pick: 'pilot' });
    expect(await pick(asBen)).toMatchObject({ hasPicked: true, pick: null });
    expect(JSON.stringify(asBen.messages)).not.toContain('pilot');
  });

  it('tells everybody which seats are connected', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    const asHost = await openStream(host, room.id);
    await asHost.waitFor((m) => m.event === 'presence' && m.data.seats.join() === '0');
    const asAnna = await openStream(anna, room.id);
    await asHost.waitFor((m) => m.event === 'presence' && m.data.seats.join() === '0,1');
    asAnna.close();
    await asHost.waitFor(
      (m) =>
        m.event === 'presence' &&
        m.data.seats.join() === '0' &&
        asHost.messages.filter((x) => x.event === 'presence').length >= 3,
    );
  });

  it('closing a table reaches the watchers, and nothing stays connected once they leave', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const stream = await openStream(host, room.id);
    await stream.waitFor((m) => m.event === 'snapshot');
    await call(host, 'delete', `/${room.id}?confirm=true`);
    const closed = await stream.waitFor(
      (m) => m.event === 'update' && m.data.events.some((e) => e.type === 'table_closed'),
    );
    expect(closed.data.view.phase).toBe('abandoned');
    expect(hub.size()).toBe(1);
    stream.close();
    for (let i = 0; i < 100 && hub.size() > 0; i += 1) await new Promise((r) => setTimeout(r, 20));
    expect(hub.size()).toBe(0);
  });
});

describe('reconnecting', () => {
  it('sends a fresh snapshot and the log lines missed since Last-Event-ID, in that order', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const first = await openStream(host, room.id);
    const snapshot = await first.waitFor((m) => m.event === 'snapshot');
    const seen = snapshot.id;
    first.close();

    // while the host is away: two changes, one of them by a player who then leaves
    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    await call(anna, 'put', `/${room.id}/ready`).send({ ready: true });
    await call(anna, 'post', `/${room.id}/leave`).send({});

    const again = await openStream(host, room.id, { lastEventId: seen });
    const names = () => again.messages.map((m) => m.event).filter(Boolean);
    await again.waitFor((m) => m.event === 'log' && m.data.type === 'player_left');
    expect(names()[0]).toBe('snapshot');
    const log = again.messages.filter((m) => m.event === 'log').map((m) => m.data);
    expect(log.map((e) => [e.type, e.seat])).toEqual([
      ['player_joined', 1],
      ['ready_changed', 1],
      ['player_left', 1],
    ]);
    expect(log.map((e) => e.seq)).toEqual([2, 3, 4]);
    // the snapshot is the table as it is now: Anna is gone
    const fresh = again.messages.find((m) => m.event === 'snapshot');
    expect(fresh.id).toBe(4);
    expect(fresh.data.view.players.map((p) => p.name)).toEqual(['Host']);
    expect(JSON.stringify(again.messages)).not.toContain(anna.userId);
  });

  it('a change made while the client is connecting is neither lost nor applied twice', async () => {
    if (!dbAvailable) return;
    const room = await createRoom(host);
    const connecting = openStream(host, room.id);
    await call(anna, 'post', '/join').send({ roomId: room.id, nickname: 'Anna' });
    const stream = await connecting;
    await call(anna, 'put', `/${room.id}/ready`).send({ ready: true });
    await stream.waitFor((m) => m.event === 'update' && m.data.version === 3);
    const snapshot = stream.messages.find((m) => m.event === 'snapshot');
    const updates = stream.messages.filter((m) => m.event === 'update').map((m) => m.data.version);
    // every update is newer than the snapshot it follows, and versions are consecutive with no repeat
    updates.forEach((version) => expect(version).toBeGreaterThan(snapshot.data.view.version));
    expect(new Set(updates).size).toBe(updates.length);
  });
});

describe('connection limits and keeping the line open', () => {
  it('limits the live connections of one account, and frees the place when one closes', async () => {
    if (!dbAvailable) return;
    process.env.GAME_ROOMS_MAX_STREAMS = '1';
    const room = await createRoom(host);
    const first = await openStream(host, room.id);
    await first.waitFor((m) => m.event === 'snapshot');
    const second = await openStream(host, room.id);
    expect(second.status).toBe(429);
    expect(JSON.parse(second.body).code).toBe('stream_limit');
    first.close();
    for (let i = 0; i < 100 && hub.size() > 0; i += 1) await new Promise((r) => setTimeout(r, 20));
    expect((await openStream(host, room.id)).status).toBe(200);
  });

  it('sends a comment line now and then so no proxy closes an idle stream', async () => {
    if (!dbAvailable) return;
    process.env.GAME_ROOMS_HEARTBEAT_MS = '40';
    const room = await createRoom(host);
    const stream = await openStream(host, room.id);
    for (let i = 0; i < 100 && stream.comments.length < 2; i += 1)
      await new Promise((r) => setTimeout(r, 20));
    expect(stream.comments.slice(0, 2)).toEqual([': heartbeat', ': heartbeat']);
  });
});
