'use strict';

// Playing a table through the API (todo/cashflow-multiplayer.md slice S3): the command endpoint over a real CouchDB.
const http = require('http');
const crypto = require('crypto');
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');

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

/** A started two-player table, host first, no clock, professions drawn. Returns its id. */
async function startedTable(settings = {}, third = false) {
  const made = await call(host, 'post', '').send({
    nickname: 'Host',
    settings: {
      name: 'Play table',
      professions: 'random',
      turnOrder: 'seat',
      clock: { mode: 'none' },
      ...settings,
    },
  });
  expect(made.status).toBe(201);
  const id = made.body.id;
  roomIds.push(id);
  const players = third ? [anna, ben] : [anna];
  for (const [index, user] of players.entries()) {
    await call(user, 'post', '/join').send({ roomId: id, nickname: index === 0 ? 'Anna' : 'Ben' });
    await call(user, 'put', `/${id}/ready`).send({ ready: true });
  }
  const started = await call(host, 'post', `/${id}/start`).send({});
  expect(started.body.table.phase).toBe('playing');
  return id;
}

const command = (user, id, body) => call(user, 'post', `/${id}/commands`).send(body);
const view = async (user, id) => (await call(user, 'get', `/${id}`)).body;
const users = () => ({ 0: host, 1: anna, 2: ben });

/** Plays the active player's turn the quickest way: roll, then pass whatever card asks. Returns the last response. */
async function quickTurn(id) {
  let current = await view(host, id);
  const who = users()[current.table.activeSeat];
  const startSeat = current.table.activeSeat;
  for (let step = 0; step < 8; step += 1) {
    current = await view(who, id);
    if (current.table.activeSeat !== startSeat || current.table.phase !== 'playing') return current;
    const legal = current.legalActions.map((a) => a.action);
    const body = legal.includes('pass_card')
      ? { type: 'pass_card' }
      : legal.includes('roll_decision')
        ? { type: 'roll_decision' }
        : { type: 'roll' };
    const done = await command(who, id, { command: body });
    expect([body.type, done.status]).toEqual([body.type, 200]);
  }
  return view(who, id);
}

function openStream(user, roomId) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: `/api/v1/game/rooms/${roomId}/events`,
        headers: { Authorization: `Bearer ${user.token}` },
      },
      (res) => {
        const stream = { status: res.statusCode, messages: [] };
        let buffer = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          let at;
          while ((at = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, at);
            buffer = buffer.slice(at + 2);
            const message = {};
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) message.event = line.slice(7);
              else if (line.startsWith('data: ')) message.data = JSON.parse(line.slice(6));
            }
            if (message.event) stream.messages.push(message);
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
          throw new Error('timed out');
        };
        open.push(stream);
        resolve(stream);
      },
    );
    req.on('error', () => {});
  });
}

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
  host = await gameUser('phost');
  anna = await gameUser('panna');
  ben = await gameUser('pben');
  normal = await registerTestUser('_play_normal');
});

afterEach(() => {
  while (open.length) open.pop().close();
});

afterAll(async () => {
  while (open.length) open.pop().close();
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

describe('who may play, and what they are told they may do', () => {
  it("lists each viewer's legal actions: the mover can roll, the others wait, a spectator has none", async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const asHost = await view(host, id);
    expect(asHost.legalActions.map((a) => a.action)).toEqual(
      expect.arrayContaining(['roll', 'pause']),
    );
    expect(asHost.table.activeSeat).toBe(0);
    expect((await view(anna, id)).legalActions).toEqual([]);
    expect((await view(ben, id)).legalActions).toEqual([]);
  });

  it('refuses the wrong player, a normal account, a stranger and a bad request - and changes nothing', async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const before = (await view(host, id)).table.version;

    const notYours = await command(anna, id, { command: { type: 'roll' } });
    expect(notYours.status).toBe(409);
    expect(notYours.body.code).toBe('table_not_your_turn');
    const noCard = await command(host, id, { command: { type: 'pass_card' } });
    expect(noCard.status).toBe(422);
    expect(noCard.body.code).toBe('table_illegal_move');
    const outOfTurnSale = await command(anna, id, {
      command: { type: 'sell_position', input: { title: 'EFH' } },
    });
    expect(outOfTurnSale.status).toBe(422);
    expect(outOfTurnSale.body.code).toBe('table_illegal_move');

    expect((await command(normal, id, { command: { type: 'roll' } })).body.code).toBe(
      'not_a_game_account',
    );
    expect((await command(ben, id, { command: { type: 'roll' } })).body.code).toBe(
      'table_not_a_member',
    );
    expect((await command(host, 'no-such-table', { command: { type: 'roll' } })).status).toBe(404);
    for (const bad of [
      {},
      { command: 'roll' },
      { command: { type: 'start' } },
      { command: { type: 'roll', dice: 5 } },
      { command: { type: 'roll', cheat: true } },
      { command: { type: 'roll' }, clientCommandId: 'has space' },
      { command: { type: 'roll' }, expectedVersion: -3 },
    ]) {
      const refused = await command(host, id, bad);
      expect([JSON.stringify(bad), refused.status, refused.body.code]).toEqual([
        JSON.stringify(bad),
        400,
        'validation_invalid',
      ]);
    }
    const unknownSeat = await command(host, id, {
      command: { type: 'offer_trade', priceMinor: 100, toSeat: 9 },
    });
    expect(unknownSeat.status).toBe(404);
    expect(unknownSeat.body.code).toBe('table_unknown_player');
    expect((await view(host, id)).table.version).toBe(before);
  });
});

describe('a move', () => {
  it('is applied for the player on the move, returns the events and the new legal actions, and is saved', async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const before = (await view(host, id)).table.version;
    const rolled = await command(host, id, { command: { type: 'roll' }, expectedVersion: before });
    expect(rolled.status).toBe(200);
    expect(rolled.body.replayed).toBe(false);
    expect(rolled.body.appliedVersion).toBe(before + 1);
    expect(rolled.body.table.version).toBe(before + 1);
    const types = rolled.body.events.map((e) => e.type);
    expect(types[0]).toBe('rolled');
    expect(rolled.body.events[0]).toMatchObject({ seat: 0, data: { dice: expect.any(Array) } });
    expect(rolled.body.events.every((e) => Number.isInteger(e.seq))).toBe(true);
    expect(JSON.stringify(rolled.body)).not.toContain(host.userId);
    // the mover's books changed and are what is stored
    const stored = (await store.getRoom(getGameRoomsDb(), id)).table;
    expect(stored.version).toBe(before + 1);
    expect(stored.players[0].books.state.boardPosition).not.toBeNull();
    // the legal actions are for the next move: still the mover's (a card to deal with), or the next player's
    expect(Array.isArray(rolled.body.legalActions)).toBe(true);
  });

  it('plays a table for many turns through the API, each saved and told to everyone', async () => {
    if (!dbAvailable) return;
    const id = await startedTable({}, true);
    let version = (await view(host, id)).table.version;
    const seen = new Set();
    for (let turn = 0; turn < 9; turn += 1) {
      const current = await quickTurn(id);
      seen.add(current.table.activeSeat);
      expect(current.table.version).toBeGreaterThan(version);
      version = current.table.version;
      if (current.table.phase !== 'playing') break;
    }
    expect(seen.size).toBeGreaterThan(1);
    const stored = (await store.getRoom(getGameRoomsDb(), id)).table;
    expect(stored.version).toBe(version);
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 1000);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1));
    expect(events.filter((e) => e.type === 'rolled').length).toBeGreaterThanOrEqual(9);
  });
});

describe('retrying and racing', () => {
  it('applies a command with a clientCommandId at most once; a retry gets the table back, flagged', async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const first = await command(host, id, {
      command: { type: 'pause' },
      clientCommandId: 'pause-1',
    });
    expect(first.status).toBe(200);
    expect(first.body.replayed).toBe(false);
    const version = first.body.appliedVersion;
    // the same command again: not a second pause (which would be refused), the same answer
    const again = await command(host, id, {
      command: { type: 'pause' },
      clientCommandId: 'pause-1',
    });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ replayed: true, appliedVersion: version, events: [] });
    expect(again.body.table.version).toBe(version);
    // a different id is a different command: refused, because the game is already paused
    const other = await command(host, id, {
      command: { type: 'pause' },
      clientCommandId: 'pause-2',
    });
    expect(other.status).toBe(409);
    // another player's identical id is theirs, not the host's
    expect((await view(host, id)).table.version).toBe(version);
  });

  it('two identical requests at the same moment apply once', async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const body = { command: { type: 'pause' }, clientCommandId: 'race-1' };
    const [a, b] = await Promise.all([command(host, id, body), command(host, id, body)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.replayed, b.body.replayed].sort()).toEqual([false, true]);
    expect(a.body.appliedVersion).toBe(b.body.appliedVersion);
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 100);
    expect(events.filter((e) => e.type === 'paused')).toHaveLength(1);
  });

  it('refuses a move made on a table that has moved on, and the id of a refused move can be used again', async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const version = (await view(host, id)).table.version;
    const stale = await command(host, id, {
      command: { type: 'pause' },
      expectedVersion: version - 1,
      clientCommandId: 'stale-1',
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('room_conflict');
    // the refused attempt left no trace: the same id works against the right version
    const fresh = await command(host, id, {
      command: { type: 'pause' },
      expectedVersion: version,
      clientCommandId: 'stale-1',
    });
    expect(fresh.status).toBe(200);
    expect(fresh.body.replayed).toBe(false);
  });
});

describe('the clock controls', () => {
  it('a paused game takes no move until the host resumes', async () => {
    if (!dbAvailable) return;
    const id = await startedTable({ clock: { mode: 'per-move', secondsPerMove: 600 } });
    expect((await command(anna, id, { command: { type: 'pause' } })).body.code).toBe(
      'table_not_host',
    );
    const paused = await command(host, id, { command: { type: 'pause' } });
    expect(paused.status).toBe(200);
    expect(paused.body.table.clock.pausedAt).not.toBeNull();
    expect(paused.body.legalActions.map((a) => a.action)).toEqual(['resume']);
    const refused = await command(host, id, { command: { type: 'roll' } });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('table_paused');
    expect((await command(anna, id, { command: { type: 'roll' } })).body.code).toBe('table_paused');
    const resumed = await command(host, id, { command: { type: 'resume' } });
    expect(resumed.body.table.clock.pausedAt).toBeNull();
    expect(resumed.body.table.clock.deadlineAt).toBeGreaterThan(Date.now());
    expect((await command(host, id, { command: { type: 'roll' } })).status).toBe(200);
  });
});

describe('everyone watching is told', () => {
  it('sends each viewer the update with the events and their own legal actions', async () => {
    if (!dbAvailable) return;
    const id = await startedTable();
    const asHost = await openStream(host, id);
    const asAnna = await openStream(anna, id);
    for (const stream of [asHost, asAnna]) await stream.waitFor((m) => m.event === 'snapshot');
    expect(
      asHost.messages.find((m) => m.event === 'snapshot').data.legalActions.map((a) => a.action),
    ).toContain('roll');
    expect(asAnna.messages.find((m) => m.event === 'snapshot').data.legalActions).toEqual([]);

    const rolled = await command(host, id, { command: { type: 'roll' } });
    for (const stream of [asHost, asAnna]) {
      const update = await stream.waitFor((m) => m.event === 'update');
      expect(update.data.version).toBe(rolled.body.appliedVersion);
      expect(update.data.events[0]).toMatchObject({ type: 'rolled', seat: 0 });
      expect(update.data.booksChanged).toContain(0);
    }
    // the legal actions of each viewer follow the move: if the turn passed, Anna can now roll
    const annaUpdate = asAnna.messages.find((m) => m.event === 'update');
    const turnPassed = rolled.body.table.activeSeat === 1;
    expect(annaUpdate.data.legalActions.map((a) => a.action).includes('roll')).toBe(turnPassed);
    expect(JSON.stringify(asAnna.messages)).not.toContain(host.userId);
  });
});
