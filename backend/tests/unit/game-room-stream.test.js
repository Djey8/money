/**
 * Unit tests for what a viewer of a table is sent over the live channel (backend/services/game-room-stream.js) and for the
 * connection registry (backend/services/game-room-hub.js). The tables come from the domain package's own reducer.
 */
'use strict';

const { applyCommand, createTable, systemClock } = require('@money/domain');
const {
  eventSeat,
  changedSeats,
  projectUpdate,
  projectLog,
} = require('../../services/game-room-stream');
const { createGameRoomHub } = require('../../services/game-room-hub');

const ctx = {
  clock: systemClock,
  text: (key) => key,
  money: (minor) => `${minor / 100}`,
  plainMoney: (minor) => `${minor / 100}`,
  cards: {
    textFor: () => ({}),
    symbolFor: (symbol) => symbol,
    sharedText: () => '',
    groupName: (group) => group,
  },
};

const HOST = 'acct-host-secret';
const ANNA = 'acct-anna-secret';
const BEN = 'acct-ben-secret';

/** A lobby with three players; `professions` decides whether starting it goes into play at once. */
function lobby(professions = 'random') {
  let table = createTable(
    {
      id: 't',
      hostId: HOST,
      hostName: 'Host',
      settings: { name: 'T', professions, turnOrder: 'seat', clock: { mode: 'none' } },
      seed: 5,
    },
    ctx,
  ).table;
  for (const [id, name] of [
    [ANNA, 'Anna'],
    [BEN, 'Ben'],
  ]) {
    table = applyCommand(table, id, { type: 'join', name }, ctx).table;
    table = applyCommand(table, id, { type: 'set_ready', ready: true }, ctx).table;
  }
  return table;
}

const playing = () => applyCommand(lobby(), HOST, { type: 'start' }, ctx).table;

/** A roll by the active player that lands on a space which only affects the roller. */
function roll(table) {
  for (let seed = 1; seed < 500; seed += 1) {
    const result = applyCommand(
      { ...table, rngState: seed },
      table.activePlayerId,
      { type: 'roll' },
      ctx,
    );
    const landed = result.events.find((e) => e.type === 'rolled').data.landed;
    if (landed !== 'market') return result;
  }
  throw new Error('no dice stream');
}

const withSeq = (events, first = 1) => events.map((event, i) => ({ seq: first + i, event }));

describe('which seat an event is about', () => {
  it('is the seat the player had when it happened, even if they have left since', () => {
    const before = lobby();
    const joined = applyCommand(before, 'acct-new', { type: 'join', name: 'New' }, ctx);
    expect(eventSeat(before, joined.table, joined.events[0])).toBe(3);
    const left = applyCommand(joined.table, ANNA, { type: 'leave' }, ctx);
    expect(left.table.players.map((p) => p.name)).toEqual(['Host', 'Ben', 'New']);
    // Anna sat at seat 1 before; after her leaving nobody has that id any more
    expect(eventSeat(joined.table, left.table, left.events[0])).toBe(1);
    expect(
      eventSeat(joined.table, left.table, { type: 'play_started', playerId: null }),
    ).toBeNull();
  });
});

describe("which players' books changed", () => {
  it('lists everyone for the first version, nobody for a lobby change, and only the mover after a move', () => {
    const table = playing();
    expect(changedSeats(null, table)).toEqual([0, 1, 2]);
    const ready = applyCommand(
      lobby(),
      HOST,
      { type: 'update_settings', settings: { maxSeats: 8 } },
      ctx,
    );
    expect(changedSeats(lobby(), ready.table)).toEqual([]);

    const moved = roll(table);
    expect(changedSeats(table, moved.table)).toEqual([
      table.players.findIndex((p) => p.id === table.activePlayerId),
    ]);
  });

  it('treats equal books that are separate objects (a table read back from the database) as unchanged', () => {
    const table = playing();
    const reloaded = JSON.parse(JSON.stringify(table));
    expect(changedSeats(table, reloaded)).toEqual([]);
  });

  it('notices a player whose books appeared (the start of play)', () => {
    expect(changedSeats(lobby(), playing())).toEqual([0, 1, 2]);
  });
});

describe('the update one viewer receives', () => {
  it('carries the events by seat and books only for the seats that changed', () => {
    const table = playing();
    const moved = roll(table);
    const mover = table.players.findIndex((p) => p.id === table.activePlayerId);
    const update = projectUpdate(table, moved.table, withSeq(moved.events, 10), BEN);

    expect(update.version).toBe(moved.table.version);
    expect(update.booksChanged).toEqual([mover]);
    update.view.players.forEach((player, seat) => {
      if (seat === mover) expect(player.books).toBeTruthy();
      else expect(Object.prototype.hasOwnProperty.call(player, 'books')).toBe(false);
    });
    expect(update.events[0]).toMatchObject({ seq: 10, type: 'rolled', seat: mover });
    expect(update.view.youSeat).toBe(2);
    expect(update.view.activeSeat).not.toBeNull();
  });

  it('sends everything for the first version, and keeps a player with no books as null', () => {
    const first = lobby();
    const update = projectUpdate(null, first, [], HOST);
    expect(update.booksChanged).toEqual([]);
    expect(update.view.players.every((p) => p.books === null)).toBe(true);
    const started = playing();
    expect(projectUpdate(first, started, [], HOST).booksChanged).toEqual([0, 1, 2]);
  });

  it('shows each viewer only what they may see, and never an account id', () => {
    const picking = applyCommand(lobby('duplicates'), HOST, { type: 'start' }, ctx).table;
    const picked = applyCommand(
      picking,
      ANNA,
      { type: 'pick_profession', professionId: 'pilot' },
      ctx,
    );
    const forAnna = projectUpdate(picking, picked.table, withSeq(picked.events), ANNA);
    const forBen = projectUpdate(picking, picked.table, withSeq(picked.events), BEN);
    expect(forAnna.view.players[1].pick).toBe('pilot');
    expect(forBen.view.players[1]).toMatchObject({ hasPicked: true, pick: null });
    for (const update of [forAnna, forBen]) {
      const json = JSON.stringify(update);
      for (const id of [HOST, ANNA, BEN]) expect(json).not.toContain(id);
      expect(json).not.toContain('rngState');
    }
    expect(JSON.stringify(forBen)).not.toContain('pilot');
  });
});

describe('the log a reconnecting viewer replays', () => {
  it('turns stored event documents into public events with their seat', () => {
    const log = projectLog([
      { seq: 4, version: 4, at: 'x', type: 'player_left', playerId: ANNA, seat: 1 },
      {
        seq: 5,
        version: 5,
        at: 'y',
        type: 'play_started',
        playerId: null,
        seat: null,
        data: { order: ['Host'] },
      },
      { seq: 6, version: 6, at: 'z', type: 'paused', playerId: HOST },
    ]);
    expect(log).toEqual([
      { seq: 4, version: 4, at: 'x', type: 'player_left', seat: 1 },
      { seq: 5, version: 5, at: 'y', type: 'play_started', seat: null, data: { order: ['Host'] } },
      { seq: 6, version: 6, at: 'z', type: 'paused', seat: null },
    ]);
    expect(JSON.stringify(log)).not.toContain(ANNA);
  });
});

describe('the connection registry', () => {
  const sinkOf = () => {
    const sent = [];
    return { sent, send: (name, id, data) => sent.push({ name, id, data }), end: jest.fn() };
  };
  const afterEach_ = () => {
    delete process.env.GAME_ROOMS_MAX_STREAMS;
    delete process.env.GAME_ROOMS_MAX_STREAMS_TOTAL;
  };
  afterEach(afterEach_);

  it('holds updates until the snapshot is sent, then delivers only the newer ones', () => {
    const hub = createGameRoomHub();
    const table = playing();
    const first = roll(table);
    const second = roll(first.table);
    const connection = hub.subscribe('r1', HOST, 0);
    // two changes happen while the snapshot is being prepared; the snapshot already contains the first
    hub.publish('r1', { previous: table, table: first.table, events: withSeq(first.events) });
    hub.publish('r1', {
      previous: first.table,
      table: second.table,
      events: withSeq(second.events, 50),
    });
    const sink = sinkOf();
    connection.attach(sink, first.table.version);
    const updates = sink.sent.filter((m) => m.name === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].data.version).toBe(second.table.version);
    expect(updates[0].id).toBe(50 + second.events.length - 1);
    // then live
    const third = roll(second.table);
    hub.publish('r1', {
      previous: second.table,
      table: third.table,
      events: withSeq(third.events, 90),
    });
    expect(sink.sent.filter((m) => m.name === 'update')).toHaveLength(2);
  });

  it('does not announce a change the snapshot it already sent contains (connecting between the save and the announcement)', () => {
    const hub = createGameRoomHub();
    const table = playing();
    const first = roll(table);
    const second = roll(first.table);
    const sink = sinkOf();
    // the client's snapshot was read after the change was saved ...
    hub.subscribe('r1', HOST, 0).attach(sink, first.table.version);
    // ... and only then is the change announced: it is not sent a second time
    hub.publish('r1', { previous: table, table: first.table, events: withSeq(first.events) });
    expect(sink.sent.filter((m) => m.name === 'update')).toHaveLength(0);
    hub.publish('r1', {
      previous: first.table,
      table: second.table,
      events: withSeq(second.events, 50),
    });
    expect(sink.sent.filter((m) => m.name === 'update').map((m) => m.data.version)).toEqual([
      second.table.version,
    ]);
  });

  it('projects every change for each viewer on their own', () => {
    const hub = createGameRoomHub();
    const picking = applyCommand(lobby('duplicates'), HOST, { type: 'start' }, ctx).table;
    const picked = applyCommand(
      picking,
      ANNA,
      { type: 'pick_profession', professionId: 'pilot' },
      ctx,
    );
    const annaSink = sinkOf();
    const benSink = sinkOf();
    hub.subscribe('r1', ANNA, 1).attach(annaSink, picking.version);
    hub.subscribe('r1', BEN, 2).attach(benSink, picking.version);
    expect(
      hub.publish('r1', { previous: picking, table: picked.table, events: withSeq(picked.events) }),
    ).toBe(2);
    const seen = (sink) => sink.sent.find((m) => m.name === 'update').data.view.players[1].pick;
    expect(seen(annaSink)).toBe('pilot');
    expect(seen(benSink)).toBeNull();
    // a room nobody watches costs nothing
    expect(hub.publish('empty', { previous: picking, table: picked.table, events: [] })).toBe(0);
  });

  it('tells everyone which seats are connected, and stops when a connection closes', () => {
    const hub = createGameRoomHub();
    const hostSink = sinkOf();
    const hostConnection = hub.subscribe('r1', HOST, 0);
    hostConnection.attach(hostSink, 1);
    expect(hostSink.sent.pop()).toEqual({ name: 'presence', id: undefined, data: { seats: [0] } });
    const annaConnection = hub.subscribe('r1', ANNA, 1);
    annaConnection.attach(sinkOf(), 1);
    expect(hostSink.sent.pop().data).toEqual({ seats: [0, 1] });
    expect(hub.connectedUsers('r1')).toEqual(new Set([HOST, ANNA]));
    annaConnection.close();
    annaConnection.close();
    expect(hostSink.sent.pop().data).toEqual({ seats: [0] });
    expect(hub.size()).toBe(1);
    hostConnection.close();
    expect(hub.size()).toBe(0);
    expect(hub.presence('r1')).toEqual({ seats: [] });
  });

  it('limits the connections of one account and of the server', () => {
    const hub = createGameRoomHub();
    process.env.GAME_ROOMS_MAX_STREAMS = '2';
    const a = hub.subscribe('r1', HOST, 0);
    hub.subscribe('r2', HOST, 0);
    expect(() => hub.subscribe('r3', HOST, 0)).toThrow(/2 live connections/);
    try {
      hub.subscribe('r3', HOST, 0);
    } catch (error) {
      expect(error).toMatchObject({ code: 'stream_limit', status: 429 });
    }
    a.close();
    expect(() => hub.subscribe('r3', HOST, 0)).not.toThrow();
    process.env.GAME_ROOMS_MAX_STREAMS_TOTAL = '2';
    expect(() => hub.subscribe('r4', ANNA, 1)).toThrow(/no room for another/);
  });

  it('ends a connection that never attached and fell too far behind', () => {
    const hub = createGameRoomHub();
    const table = playing();
    const connection = hub.subscribe('r1', HOST, 0);
    for (let i = 0; i < 501; i += 1) hub.publish('r1', { previous: table, table, events: [] });
    const sink = sinkOf();
    connection.attach(sink, 1);
    expect(sink.end).toHaveBeenCalled();
    expect(sink.sent).toEqual([]);
  });

  it("follows a player's seat when seats shift", () => {
    const hub = createGameRoomHub();
    const before = lobby();
    const sink = sinkOf();
    hub.subscribe('r1', BEN, 2).attach(sink, before.version);
    const left = applyCommand(before, ANNA, { type: 'leave' }, ctx);
    hub.publish('r1', { previous: before, table: left.table, events: withSeq(left.events) });
    expect(sink.sent.filter((m) => m.name === 'presence').pop().data).toEqual({ seats: [1] });
  });
});
