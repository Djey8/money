'use strict';

// The clock service of the multiplayer tables (todo/cashflow-multiplayer.md slice S4): timeouts, restarts, races and rewinding,
// against a real CouchDB with a fake clock and a fake scheduler, so nothing waits. The service is used directly (no HTTP).
const { checkDb } = require('./setup');
const { getGameRoomsDb } = require('../../config/db');
const store = require('../../repositories/game-room-store');
const { createGameRoomService } = require('../../services/game-rooms');
const { createGameRoomHub } = require('../../services/game-room-hub');
const { createRoomClocks } = require('../../services/game-room-clocks');

const T0 = Date.parse('2026-10-15T09:00:00.000Z');
const SEC = 1000;
let dbAvailable = false;
let now = T0;
const roomIds = [];
const clock = {
  nowIso: () => new Date(now).toISOString(),
  todayIso: () => new Date(now).toISOString().slice(0, 10),
};
const stamp = Date.now();
const users = { host: `u_${stamp}_host`, anna: `u_${stamp}_anna`, ben: `u_${stamp}_ben` };

function fakeScheduler() {
  const timers = [];
  return {
    timers,
    set: (fn, delay) => {
      const timer = { fn, delay, cleared: false, fired: false, unref() {} };
      timers.push(timer);
      return timer;
    },
    clear: (timer) => {
      timer.cleared = true;
    },
    live: () => timers.filter((t) => !t.cleared && !t.fired),
    /** Rings every timer that is waiting, and waits for the service to finish. */
    ring: async () => {
      for (const timer of timers.filter((t) => !t.cleared && !t.fired)) {
        timer.fired = true;
        await timer.fn();
      }
    },
  };
}

/** A service wired like the server's - hub, clocks, scheduler - over the real database. */
function build() {
  const scheduler = fakeScheduler();
  const hub = createGameRoomHub();
  let service;
  const clocks = createRoomClocks({
    onDue: (roomId) => service.runTimeout(roomId),
    now: () => now,
    scheduler,
  });
  service = createGameRoomService({ db: getGameRoomsDb(), clock, hub, clocks });
  return { service, clocks, hub, scheduler };
}

async function startedTable(service, settings = {}) {
  const made = await service.createRoom(users.host, {
    nickname: 'Host',
    settings: {
      name: 'Clock table',
      professions: 'random',
      turnOrder: 'seat',
      clock: { mode: 'per-move', secondsPerMove: 60 },
      ...settings,
    },
  });
  const id = made.table.id;
  roomIds.push(id);
  for (const [user, name] of [
    [users.anna, 'Anna'],
    [users.ben, 'Ben'],
  ]) {
    await service.joinRoom(user, { roomId: id, nickname: name });
    await service.runCommand(user, id, { type: 'set_ready', ready: true });
  }
  const started = await service.runCommand(users.host, id, { type: 'start' });
  expect(started.view.table.phase).toBe('playing');
  return id;
}

const stored = async (id) => (await store.getRoom(getGameRoomsDb(), id)).table;

/** The active player plays their turn the quickest way. */
async function quickTurn(service, id) {
  const view = (await service.getRoom(users.host, id)).table;
  const seatUser = [users.host, users.anna, users.ben];
  const startSeat = view.activeSeat;
  const who = seatUser[startSeat];
  for (let step = 0; step < 8; step += 1) {
    const room = await service.getRoom(who, id);
    if (room.table.activeSeat !== startSeat || room.table.phase !== 'playing') return room;
    const legal = room.legalActions.map((a) => a.action);
    const type = legal.includes('pass_card')
      ? 'pass_card'
      : legal.includes('roll_decision')
        ? 'roll_decision'
        : 'roll';
    await service.runCommand(who, id, { type });
  }
  return service.getRoom(who, id);
}

beforeAll(async () => {
  dbAvailable = await checkDb();
  // these tests open many tables for the same three accounts
  process.env.GAME_ROOMS_MAX_HOSTED = '100';
  process.env.GAME_ROOMS_MAX_SEATED = '100';
});

beforeEach(() => {
  now = T0;
});

afterAll(async () => {
  delete process.env.GAME_ROOMS_MAX_HOSTED;
  delete process.env.GAME_ROOMS_MAX_SEATED;
  if (!dbAvailable) return;
  for (const id of roomIds) await store.deleteRoom(getGameRoomsDb(), id);
});

describe('the clock rings', () => {
  it('arms a timer when play starts, plays the passive turn when it rings, and arms for the next player', async () => {
    if (!dbAvailable) return;
    const { service, clocks, hub, scheduler } = build();
    const id = await startedTable(service);
    const table = await stored(id);
    expect(clocks.deadlineOf(id)).toBe(T0 + 60 * SEC);
    expect(scheduler.live()).toHaveLength(1);

    // a viewer is connected: the timeout reaches them like any change
    const sent = [];
    hub
      .subscribe(id, users.anna, 1)
      .attach(
        { send: (name, eventId, data) => sent.push({ name, data }), end() {} },
        table.version,
      );

    now = T0 + 61 * SEC;
    await scheduler.ring();
    const after = await stored(id);
    expect(after.version).toBeGreaterThan(table.version);
    expect(after.activePlayerId).toBe(users.anna);
    expect(after.clock.timeouts[users.host]).toBe(1);
    expect(clocks.deadlineOf(id)).toBe(now + 60 * SEC);
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 200);
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['turn_timeout', 'rolled', 'turn_started']),
    );
    expect(events.find((e) => e.type === 'turn_timeout')).toMatchObject({
      playerId: users.host,
      seat: 0,
    });
    const update = sent.find((m) => m.name === 'update');
    expect(update.data.events.map((e) => e.type)).toContain('turn_timeout');
    expect(update.data.legalActions.map((a) => a.action)).toContain('roll');
  });

  it('a player who moves in time moves the timer with them: the old deadline never rings', async () => {
    if (!dbAvailable) return;
    const { service, clocks, scheduler } = build();
    const id = await startedTable(service);
    const first = scheduler.live()[0];
    now = T0 + 20 * SEC;
    await quickTurn(service, id);
    expect(first.cleared).toBe(true);
    expect(clocks.deadlineOf(id)).toBe(T0 + 20 * SEC + 60 * SEC);
    expect(scheduler.live()).toHaveLength(1);
    // the timer rang a hair early or for a deadline that has moved: nothing is played, it arms again
    const before = (await stored(id)).version;
    clocks.disarm(id); // as if this ring were the only thing that knew about the table
    expect(await service.runTimeout(id)).toEqual({ fired: false });
    expect((await stored(id)).version).toBe(before);
    expect(clocks.deadlineOf(id)).toBe(T0 + 80 * SEC);
  });

  it('a paused game has no timer until it is resumed, with the time it had left', async () => {
    if (!dbAvailable) return;
    const { service, clocks } = build();
    const id = await startedTable(service);
    now = T0 + 10 * SEC;
    await service.runCommand(users.host, id, { type: 'pause' });
    expect(clocks.deadlineOf(id)).toBeNull();
    now = T0 + 100 * SEC;
    expect(await service.runTimeout(id)).toEqual({ fired: false });
    await service.runCommand(users.host, id, { type: 'resume' });
    expect(clocks.deadlineOf(id)).toBe(T0 + 60 * SEC + 90 * SEC);
  });

  it('a table without a clock, a finished one and a deleted one have no timer', async () => {
    if (!dbAvailable) return;
    const { service, clocks } = build();
    const id = await startedTable(service, { clock: { mode: 'none' } });
    expect(clocks.deadlineOf(id)).toBeNull();
    expect(await service.runTimeout(id)).toEqual({ fired: false });
    expect(await service.runTimeout('no-such-table')).toEqual({ fired: false });
    await service.runCommand(users.host, id, { type: 'close' });
    expect(clocks.deadlineOf(id)).toBeNull();
  });

  it('a late move and the timeout at the same moment: one wins, the turn is played once', async () => {
    if (!dbAvailable) return;
    const { service } = build();
    const id = await startedTable(service);
    const before = await stored(id);
    now = T0 + 70 * SEC;
    const [move, timeout] = await Promise.allSettled([
      service.runCommand(users.host, id, { type: 'roll' }),
      service.runTimeout(id),
    ]);
    // the player is 10 s late (the grace is 2 s): the move is refused, the server plays the turn
    expect(move.status).toBe('rejected');
    expect(['TIME_UP', 'NOT_YOUR_TURN']).toContain(move.reason.code);
    expect(timeout).toMatchObject({ status: 'fulfilled', value: { fired: true } });
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 200);
    expect(events.filter((e) => e.type === 'turn_timeout')).toHaveLength(1);
    expect((await stored(id)).version).toBeGreaterThan(before.version);
  });

  it('a player who keeps timing out is marked away and their turns are played at once', async () => {
    if (!dbAvailable) return;
    const { service, clocks, scheduler } = build();
    const id = await startedTable(service, { awayAfterTimeouts: 1 });
    now = T0 + 61 * SEC;
    await scheduler.ring();
    const table = await stored(id);
    expect(table.players[0].away).toBe(true);
    expect(clocks.deadlineOf(id)).not.toBeNull();
    // when the turn comes round again the host does not make anyone wait
    await quickTurn(service, id);
    await quickTurn(service, id);
    const events = await store.readEvents(getGameRoomsDb(), id, 0, 400);
    expect(events.filter((e) => e.type === 'player_away')).toHaveLength(1);
    const lastTable = await stored(id);
    expect(lastTable.activePlayerId).not.toBe(users.host);
  });
});

describe('a restart', () => {
  it('arms the clock of every table being played again, from what is stored', async () => {
    if (!dbAvailable) return;
    const first = build();
    const id = await startedTable(first.service);
    const other = await startedTable(first.service, { clock: { mode: 'none' } });
    const deadline = (await stored(id)).clock.deadlineAt;
    first.clocks.clearAll(); // the process died

    const second = build();
    expect(second.clocks.deadlineOf(id)).toBeNull();
    const looked = await second.service.rearmAll();
    expect(looked).toBeGreaterThanOrEqual(2);
    expect(second.clocks.deadlineOf(id)).toBe(deadline);
    expect(second.clocks.deadlineOf(other)).toBeNull();

    now = deadline + SEC;
    await second.scheduler.ring();
    expect((await stored(id)).clock.timeouts[users.host]).toBe(1);
  });

  it('a clock that ran out while the server was down rings at once when it comes back', async () => {
    if (!dbAvailable) return;
    const first = build();
    const id = await startedTable(first.service);
    first.clocks.clearAll();
    now = T0 + 5 * 60 * SEC;
    const second = build();
    await second.service.rearmAll();
    expect(second.scheduler.live().find((t) => t.delay < 100)).toBeTruthy();
    await second.scheduler.ring();
    expect((await stored(id)).clock.timeouts[users.host]).toBe(1);
  });
});

describe('rewinding the last turn', () => {
  it('puts the table back to the start of the previous turn and says so', async () => {
    if (!dbAvailable) return;
    const { service, clocks } = build();
    const id = await startedTable(service);
    const atHost = await stored(id); // the start of the host's turn (turn 1)
    now = T0 + 5 * SEC;
    await quickTurn(service, id); // the host plays; Anna's turn begins (turn 2)
    const atAnna = await stored(id);
    now = T0 + 10 * SEC;
    await service.runCommand(users.anna, id, { type: 'roll' }); // Anna moves
    const moved = await stored(id);
    expect(moved.players[1].books.state.boardPosition).not.toBeNull();

    // "the previous turn" depends on the dice: if Anna's roll settled by itself her turn is over and the previous turn is hers,
    // otherwise she is still in her turn and the previous one is the host's
    const expected = moved.activePlayerId === users.anna ? atHost : atAnna;
    now = T0 + 15 * SEC;
    const rewound = await service.rewind(users.host, id, {});
    expect(rewound.events.map((e) => e.type)).toEqual(expect.arrayContaining(['rewound']));
    const table = await stored(id);
    expect(table.version).toBe(moved.version + 1);
    expect(table.activePlayerId).toBe(expected.activePlayerId);
    expect(table.turnRolled).toBe(false);
    for (let seat = 0; seat < 3; seat += 1) {
      expect(table.players[seat].books).toEqual(expected.players[seat].books);
    }
    expect(table.rngState).toBe(moved.rngState);
    expect(clocks.deadlineOf(id)).toBe(T0 + 15 * SEC + 60 * SEC);
    const log = await store.readEvents(getGameRoomsDb(), id, 0, 400);
    expect(log[log.length - 1]).toMatchObject({ type: 'rewound', playerId: users.host, seat: 0 });
    // the stored room goes back one turn: there is nothing earlier to rewind to now
    await expect(service.rewind(users.host, id, {})).rejects.toMatchObject({
      code: 'ILLEGAL_MOVE',
    });
    // and the turn can be played again
    const mover = table.activePlayerId;
    await quickTurn(service, id);
    expect((await stored(id)).activePlayerId).not.toBe(mover);
  });

  it("is the host's alone, needs an earlier turn, and can be switched off", async () => {
    if (!dbAvailable) return;
    const { service } = build();
    const id = await startedTable(service);
    // turn 1 has just begun: nothing earlier
    await expect(service.rewind(users.host, id, {})).rejects.toMatchObject({
      code: 'ILLEGAL_MOVE',
    });
    await quickTurn(service, id);
    await expect(service.rewind(users.anna, id, {})).rejects.toMatchObject({ code: 'NOT_HOST' });
    expect((await stored(id)).activePlayerId).toBe(users.anna);

    const off = await startedTable(service, { allowRewind: false });
    await quickTurn(service, off);
    await expect(service.rewind(users.host, off, {})).rejects.toMatchObject({
      code: 'ILLEGAL_MOVE',
    });
  });

  it('keeps two snapshots at most, and deleting the room removes them', async () => {
    if (!dbAvailable) return;
    const { service } = build();
    const id = await startedTable(service);
    for (let i = 0; i < 4; i += 1) await quickTurn(service, id);
    const db = getGameRoomsDb();
    const snaps = await db.list({ startkey: `snap:${id}:`, endkey: `snap:${id}:￰` });
    expect(snaps.rows).toHaveLength(2);
    const room = await store.getRoom(db, id);
    expect(room.turnSeq).toBeGreaterThanOrEqual(5);
    await store.deleteRoom(db, id);
    expect((await db.list({ startkey: `snap:${id}:`, endkey: `snap:${id}:￰` })).rows).toHaveLength(
      0,
    );
  });

  it('is applied at most once with a clientCommandId, and refused on a table that has moved on', async () => {
    if (!dbAvailable) return;
    const { service } = build();
    const id = await startedTable(service);
    await quickTurn(service, id);
    await service.runCommand(users.anna, id, { type: 'roll' });
    const version = (await stored(id)).version;
    await expect(
      service.rewind(users.host, id, { expectedVersion: version - 1 }),
    ).rejects.toMatchObject({ code: 'room_conflict' });
    const first = await service.rewind(users.host, id, {
      clientCommandId: 'rw-1',
      expectedVersion: version,
    });
    const again = await service.rewind(users.host, id, { clientCommandId: 'rw-1' });
    expect(first.replayed).toBe(false);
    expect(again).toMatchObject({ replayed: true, appliedVersion: first.appliedVersion });
  });
});
