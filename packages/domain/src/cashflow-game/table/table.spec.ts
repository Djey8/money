import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { seededRng } from '../rng';
import { whyCannotRoll } from '../turn';
import { applyCommand, createTable } from './reducer';
import { deepFreeze, testContext } from './testing';
import { normalizeTableSettings } from './settings';
import { tableRng } from './table-rng';
import {
  TABLE_COLORS,
  TABLE_SEAT_CEILING,
  TableCommandError,
  type Table,
  type TableCommand,
  type TableErrorCode,
  type TableEvent,
} from './types';

const ctx = testContext;
const CLASSIC = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;

function newTable(settings = {}, seed = 1234): Table {
  return createTable(
    { id: 't1', hostId: 'host', hostName: 'Host', settings: { name: 'Friday', ...settings }, seed },
    ctx,
  ).table;
}

/** Applies commands in order, each as `[playerId, command]`; returns the table and every event. */
function run(
  table: Table,
  steps: [string, TableCommand][],
): { table: Table; events: TableEvent[] } {
  const events: TableEvent[] = [];
  let current = table;
  for (const [who, command] of steps) {
    const result = applyCommand(current, who, command, ctx);
    current = result.table;
    events.push(...result.events);
  }
  return { table: current, events };
}

const join = (id: string, name = id): [string, TableCommand] => [id, { type: 'join', name }];
const ready = (id: string): [string, TableCommand] => [id, { type: 'set_ready', ready: true }];
const pickAs = (id: string, professionId: string): [string, TableCommand] => [
  id,
  { type: 'pick_profession', professionId },
];

function expectError(fn: () => unknown, code: TableErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TableCommandError);
    expect((error as TableCommandError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}, nothing was thrown`);
}

/** A lobby with the host plus `n - 1` ready players. */
function lobbyOf(n: number, settings = {}): Table {
  const steps: [string, TableCommand][] = [];
  for (let i = 1; i < n; i += 1) steps.push(join(`p${i}`), ready(`p${i}`));
  return run(newTable(settings), steps).table;
}

describe('tableRng', () => {
  it('gives the same sequence as seededRng and can be resumed from its state', () => {
    const reference = seededRng(99);
    const stream = tableRng(99);
    const first = Array.from({ length: 5 }, () => stream.rng());
    expect(first).toEqual(Array.from({ length: 5 }, () => reference()));
    const resumed = tableRng(stream.state());
    expect(resumed.rng()).toBe(reference());
    expect(resumed.rng()).toBe(reference());
  });
});

describe('table settings', () => {
  it('fills in defaults and forces the cheat-relevant rules', () => {
    const settings = normalizeTableSettings({ name: '  Friday  ' });
    expect(settings).toMatchObject({
      name: 'Friday',
      visibility: 'public',
      maxSeats: 6,
      gameSetId: 'cashflow',
      rulesBase: 'guided',
      professions: 'duplicates',
      turnOrder: 'random',
      clock: { mode: 'none' },
      awayAfterTimeouts: 2,
      endCondition: 'first-escape',
      spectators: false,
    });
    expect(settings.rules).toMatchObject({
      cardChoice: 'offered-once',
      buy: 'with-card',
      reportRolls: 'forbidden',
      manualTransactions: 'forbidden',
      maxFreeAmountMinor: 0,
    });
  });

  it('lets the host tune the rules that are theirs', () => {
    const settings = normalizeTableSettings({
      name: 'x',
      rulesBase: 'guided',
      rules: { passDoodads: 'forbidden', sell: 'never', maxLoanMinor: 5_000_000 },
    });
    expect(settings.rules).toMatchObject({
      passDoodads: 'forbidden',
      sell: 'never',
      maxLoanMinor: 5_000_000,
    });
  });

  it.each([
    [{ reportRolls: 'allowed' }],
    [{ manualTransactions: 'allowed' }],
    [{ cardChoice: 'free' }],
    [{ buy: 'always' }],
    [{ sell: 'always' }],
    [{ maxFreeAmountMinor: 100 }],
  ])('refuses %j instead of overruling it silently', (rules) => {
    expectError(
      () => normalizeTableSettings({ name: 'x', rules: rules as never }),
      'INVALID_SETTINGS',
    );
  });

  it('refuses a free-for-all preset and bad values', () => {
    expectError(
      () => normalizeTableSettings({ name: 'x', rulesBase: 'free' as never }),
      'INVALID_SETTINGS',
    );
    expectError(() => normalizeTableSettings({ name: '' }), 'INVALID_SETTINGS');
    expectError(() => normalizeTableSettings({ name: 'x', maxSeats: 1 }), 'INVALID_SETTINGS');
    expectError(
      () => normalizeTableSettings({ name: 'x', maxSeats: TABLE_SEAT_CEILING + 1 }),
      'INVALID_SETTINGS',
    );
    expectError(() => normalizeTableSettings({ name: 'x', gameSetId: 'nope' }), 'INVALID_SETTINGS');
    expectError(
      () => normalizeTableSettings({ name: 'x', turnOrder: 'host' as never }),
      'INVALID_SETTINGS',
    );
  });

  it('limits unique professions to the size of the game set', () => {
    const pool = CLASSIC.professions.length;
    expect(
      normalizeTableSettings({ name: 'x', professions: 'unique', maxSeats: pool }).maxSeats,
    ).toBe(pool);
    expectError(
      () => normalizeTableSettings({ name: 'x', professions: 'unique', maxSeats: pool + 1 }),
      'INVALID_SETTINGS',
    );
  });

  it('needs a round limit exactly when the end condition is round-limit', () => {
    expect(
      normalizeTableSettings({ name: 'x', endCondition: 'round-limit', roundLimit: 30 }).roundLimit,
    ).toBe(30);
    expectError(
      () => normalizeTableSettings({ name: 'x', endCondition: 'round-limit' }),
      'INVALID_SETTINGS',
    );
    expectError(() => normalizeTableSettings({ name: 'x', roundLimit: 30 }), 'INVALID_SETTINGS');
  });

  it('validates the clock modes', () => {
    expect(
      normalizeTableSettings({ name: 'x', clock: { mode: 'per-move', secondsPerMove: 45 } }).clock,
    ).toEqual({
      mode: 'per-move',
      secondsPerMove: 45,
    });
    expect(
      normalizeTableSettings({
        name: 'x',
        clock: { mode: 'bank', bankSeconds: 600, incrementSeconds: 5 },
      }).clock,
    ).toEqual({ mode: 'bank', bankSeconds: 600, incrementSeconds: 5 });
    expect(
      normalizeTableSettings({ name: 'x', clock: { mode: 'daily', hoursPerMove: 24 } }).clock,
    ).toEqual({
      mode: 'daily',
      hoursPerMove: 24,
    });
    expectError(
      () => normalizeTableSettings({ name: 'x', clock: { mode: 'per-move', secondsPerMove: 1 } }),
      'INVALID_SETTINGS',
    );
    expectError(
      () => normalizeTableSettings({ name: 'x', clock: { mode: 'sundial' } as never }),
      'INVALID_SETTINGS',
    );
  });
});

describe('the lobby', () => {
  it('seats the host ready, and a joiner gets a free colour', () => {
    const { table, events } = createTable(
      { id: 't', hostId: 'host', hostName: 'Anna', settings: { name: 'T' }, seed: 7 },
      ctx,
    );
    expect(table).toMatchObject({ phase: 'lobby', version: 1, hostId: 'host' });
    expect(table.players).toHaveLength(1);
    expect(table.players[0]).toMatchObject({ name: 'Anna', ready: true, books: null });
    expect(events.map((e) => e.type)).toEqual(['table_created']);

    const joined = applyCommand(table, 'p1', { type: 'join', name: 'Ben' }, ctx);
    expect(joined.table.version).toBe(2);
    expect(joined.table.players.map((p) => p.color)).toEqual([TABLE_COLORS[0], TABLE_COLORS[1]]);
    expect(joined.events[0]).toMatchObject({ type: 'player_joined', playerId: 'p1', version: 2 });
  });

  it('refuses a second join, a taken name or colour, a full table and a bad name', () => {
    const table = run(newTable({ maxSeats: 2 }), [join('p1', 'Ben')]).table;
    expectError(
      () => applyCommand(table, 'p1', { type: 'join', name: 'Ben' }, ctx),
      'ALREADY_JOINED',
    );
    expectError(() => applyCommand(table, 'p2', { type: 'join', name: 'Ben' }, ctx), 'TABLE_FULL');
    const roomy = run(newTable(), [join('p1', 'Ben')]).table;
    expectError(
      () => applyCommand(roomy, 'p2', { type: 'join', name: ' ben ' }, ctx),
      'NAME_TAKEN',
    );
    expectError(
      () => applyCommand(roomy, 'p2', { type: 'join', name: 'Cy', color: TABLE_COLORS[0] }, ctx),
      'COLOR_TAKEN',
    );
    expectError(
      () => applyCommand(roomy, 'p2', { type: 'join', name: '   ' }, ctx),
      'INVALID_NAME',
    );
    expectError(
      () => applyCommand(roomy, 'p2', { type: 'join', name: 'x'.repeat(25) }, ctx),
      'INVALID_NAME',
    );
  });

  it('only members may act, and a refused command changes nothing', () => {
    const table = deepFreeze(newTable());
    expectError(
      () => applyCommand(table, 'stranger', { type: 'set_ready', ready: true }, ctx),
      'NOT_A_MEMBER',
    );
    expectError(() => applyCommand(table, 'stranger', { type: 'leave' }, ctx), 'NOT_A_MEMBER');
    expect(table.version).toBe(1);
  });

  it('start needs the host, two players and everyone ready', () => {
    const solo = newTable();
    expectError(() => applyCommand(solo, 'host', { type: 'start' }, ctx), 'NOT_ENOUGH_PLAYERS');
    const unready = run(newTable(), [join('p1')]).table;
    expectError(() => applyCommand(unready, 'host', { type: 'start' }, ctx), 'NOT_READY');
    const readyTable = run(unready, [ready('p1')]).table;
    expectError(() => applyCommand(readyTable, 'p1', { type: 'start' }, ctx), 'NOT_HOST');
  });

  it('changing the settings resets everyone but the host to not ready, and only the host may', () => {
    const table = lobbyOf(3);
    expect(table.players.every((p) => p.ready)).toBe(true);
    expectError(
      () => applyCommand(table, 'p1', { type: 'update_settings', settings: { maxSeats: 8 } }, ctx),
      'NOT_HOST',
    );
    const changed = applyCommand(
      table,
      'host',
      {
        type: 'update_settings',
        settings: { maxSeats: 8, clock: { mode: 'per-move', secondsPerMove: 30 } },
      },
      ctx,
    ).table;
    expect(changed.settings).toMatchObject({
      maxSeats: 8,
      clock: { mode: 'per-move', secondsPerMove: 30 },
    });
    expect(changed.players.map((p) => p.ready)).toEqual([true, false, false]);
  });

  it('keeps the host tuned rules across a settings change and resets them with a new base preset', () => {
    const table = run(newTable({ rules: { passDoodads: 'forbidden' } }), []).table;
    const same = applyCommand(
      table,
      'host',
      { type: 'update_settings', settings: { maxSeats: 4 } },
      ctx,
    ).table;
    expect(same.settings.rules.passDoodads).toBe('forbidden');
    const strict = applyCommand(
      table,
      'host',
      { type: 'update_settings', settings: { rulesBase: 'strict' } },
      ctx,
    ).table;
    expect(strict.settings.rulesBase).toBe('strict');
    expect(strict.settings.rules.sellOfferRolls).toBe(1);
  });

  it('refuses fewer seats than players, and switching away from a round limit drops it', () => {
    const table = lobbyOf(3);
    expectError(
      () =>
        applyCommand(table, 'host', { type: 'update_settings', settings: { maxSeats: 2 } }, ctx),
      'INVALID_SETTINGS',
    );
    const limited = applyCommand(
      table,
      'host',
      { type: 'update_settings', settings: { endCondition: 'round-limit', roundLimit: 20 } },
      ctx,
    ).table;
    const back = applyCommand(
      limited,
      'host',
      { type: 'update_settings', settings: { endCondition: 'all-done' } },
      ctx,
    ).table;
    expect(back.settings.roundLimit).toBeUndefined();
  });

  it('leaving and kicking in the lobby, with host hand-over', () => {
    const table = lobbyOf(3);
    const afterLeave = applyCommand(table, 'p1', { type: 'leave' }, ctx);
    expect(afterLeave.table.players.map((p) => p.id)).toEqual(['host', 'p2']);

    const hostLeft = applyCommand(table, 'host', { type: 'leave' }, ctx);
    expect(hostLeft.table.hostId).toBe('p1');
    expect(hostLeft.events.map((e) => e.type)).toEqual(['player_left', 'host_changed']);

    expectError(() => applyCommand(table, 'p1', { type: 'kick', target: 'p2' }, ctx), 'NOT_HOST');
    expectError(
      () => applyCommand(table, 'host', { type: 'kick', target: 'host' }, ctx),
      'CANNOT_KICK_HOST',
    );
    expectError(
      () => applyCommand(table, 'host', { type: 'kick', target: 'ghost' }, ctx),
      'UNKNOWN_PLAYER',
    );
    const kicked = applyCommand(table, 'host', { type: 'kick', target: 'p2' }, ctx);
    expect(kicked.table.players.map((p) => p.id)).toEqual(['host', 'p1']);
    expect(kicked.events[0]).toMatchObject({ type: 'player_kicked', playerId: 'p2' });
  });

  it('the last player leaving abandons the table; the host can close it', () => {
    const empty = applyCommand(newTable(), 'host', { type: 'leave' }, ctx);
    expect(empty.table.phase).toBe('abandoned');
    const closed = applyCommand(lobbyOf(2), 'host', { type: 'close' }, ctx);
    expect(closed.table.phase).toBe('abandoned');
    expectError(() => applyCommand(closed.table, 'host', { type: 'close' }, ctx), 'WRONG_PHASE');
    expectError(() => applyCommand(lobbyOf(2), 'p1', { type: 'close' }, ctx), 'NOT_HOST');
  });
});

describe('picking professions and starting play', () => {
  const ids = CLASSIC.professions.map((p) => p.id);

  it('walks lobby -> picking -> playing, dealing every player their own books', () => {
    const table = lobbyOf(3);
    const picking = applyCommand(table, 'host', { type: 'start' }, ctx).table;
    expect(picking.phase).toBe('picking');
    expect(picking.players.every((p) => p.books === null && p.pick === null)).toBe(true);

    const { table: playing, events } = run(picking, [
      pickAs('host', ids[0]),
      pickAs('p1', ids[1]),
      pickAs('p2', ids[0]), // duplicates are allowed
    ]);
    expect(playing.phase).toBe('playing');
    expect(playing.tableRound).toBe(1);
    expect([...playing.order].sort()).toEqual(['host', 'p1', 'p2']);
    expect(playing.activePlayerId).toBe(playing.order[0]);
    expect(playing.players.map((p) => p.professionId)).toEqual([ids[0], ids[1], ids[0]]);
    expect(events.map((e) => e.type)).toEqual([
      'profession_picked',
      'profession_picked',
      'profession_picked',
      'professions_revealed',
      'play_started',
    ]);

    for (const player of playing.players) {
      const books = player.books!;
      expect(books.state).toMatchObject({
        mode: 'solo',
        professionId: player.professionId,
        boardPosition: null,
      });
      expect(books.state.rules).toMatchObject(playing.settings.rules);
      expect(books.subscriptions.length).toBeGreaterThan(0);
      expect(books.transactions.length).toBeGreaterThan(0);
      expect(whyCannotRoll(books.state)).toBeNull();
    }
    // two players with the same profession still own separate books
    expect(playing.players[0].books).not.toBe(playing.players[2].books);
    expect(playing.players[0].books).toEqual(playing.players[2].books);
  });

  it('hides a secret pick in the event log of a duplicates table, shows it at a unique one', () => {
    const picking = applyCommand(lobbyOf(3), 'host', { type: 'start' }, ctx).table;
    expect(
      applyCommand(picking, 'p1', { type: 'pick_profession', professionId: ids[2] }, ctx).events[0]
        .data,
    ).toBeUndefined();

    const uniquePicking = applyCommand(
      lobbyOf(3, { professions: 'unique' }),
      'host',
      { type: 'start' },
      ctx,
    ).table;
    expect(
      applyCommand(uniquePicking, 'p1', { type: 'pick_profession', professionId: ids[2] }, ctx)
        .events[0].data,
    ).toEqual({ professionId: ids[2] });
  });

  it('a player may change their pick until the last one is in', () => {
    const picking = applyCommand(lobbyOf(3), 'host', { type: 'start' }, ctx).table;
    const { table } = run(picking, [pickAs('p1', ids[0]), pickAs('p1', ids[3])]);
    expect(table.players.find((p) => p.id === 'p1')!.pick).toBe(ids[3]);
    expect(table.phase).toBe('picking');
  });

  it('refuses unknown or taken professions and picks outside the picking phase', () => {
    const lobby = lobbyOf(3, { professions: 'unique' });
    expectError(
      () => applyCommand(lobby, 'p1', { type: 'pick_profession', professionId: ids[0] }, ctx),
      'WRONG_PHASE',
    );
    const picking = applyCommand(lobby, 'host', { type: 'start' }, ctx).table;
    expectError(
      () =>
        applyCommand(picking, 'p1', { type: 'pick_profession', professionId: 'astronaut' }, ctx),
      'UNKNOWN_PROFESSION',
    );
    const one = applyCommand(
      picking,
      'p1',
      { type: 'pick_profession', professionId: ids[0] },
      ctx,
    ).table;
    expectError(
      () => applyCommand(one, 'p2', { type: 'pick_profession', professionId: ids[0] }, ctx),
      'PROFESSION_TAKEN',
    );
    // the one who took it may pick it again
    expect(
      applyCommand(one, 'p1', { type: 'pick_profession', professionId: ids[0] }, ctx).table.version,
    ).toBe(one.version + 1);
  });

  it('resolves "random" picks without clashing at a unique table', () => {
    const picking = applyCommand(
      lobbyOf(3, { professions: 'unique' }),
      'host',
      { type: 'start' },
      ctx,
    ).table;
    const { table } = run(picking, [
      pickAs('host', ids[0]),
      pickAs('p1', 'random'),
      pickAs('p2', 'random'),
    ]);
    const chosen = table.players.map((p) => p.professionId);
    expect(new Set(chosen).size).toBe(3);
    expect(chosen[0]).toBe(ids[0]);
  });

  it('a "random" professions table goes straight to play with nobody picking', () => {
    const table = applyCommand(
      lobbyOf(4, { professions: 'random' }),
      'host',
      { type: 'start' },
      ctx,
    );
    expect(table.table.phase).toBe('playing');
    expect(table.table.players.every((p) => p.professionId && p.books)).toBe(true);
    expect(table.events.map((e) => e.type)).toEqual(['professions_revealed', 'play_started']);
  });

  it('assigns every profession once to a table as big as the pool', () => {
    const n = ids.length;
    const picking = applyCommand(
      lobbyOf(n, { professions: 'unique', maxSeats: n }),
      'host',
      { type: 'start' },
      ctx,
    ).table;
    const { table } = run(
      picking,
      picking.players.map((p) => pickAs(p.id, 'random')),
    );
    expect(table.phase).toBe('playing');
    expect(new Set(table.players.map((p) => p.professionId)).size).toBe(n);
  });

  it('the turn order follows the seats, or a shuffle, as the table asks', () => {
    const seats = applyCommand(
      lobbyOf(4, { professions: 'random', turnOrder: 'seat' }),
      'host',
      { type: 'start' },
      ctx,
    ).table;
    expect(seats.order).toEqual(['host', 'p1', 'p2', 'p3']);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 12; seed += 1) {
      const lobby = {
        ...lobbyOf(4, { professions: 'random', turnOrder: 'random' }),
        rngState: seed,
      };
      orders.add(applyCommand(lobby, 'host', { type: 'start' }, ctx).table.order.join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('a player leaving while picking: the rest carry on, or fall back to the lobby', () => {
    const picking = applyCommand(lobbyOf(3), 'host', { type: 'start' }, ctx).table;
    // everyone else has picked, the last one leaves -> reveal for the rest
    const { table: waiting } = run(picking, [pickAs('host', ids[0]), pickAs('p1', ids[1])]);
    expect(waiting.phase).toBe('picking');
    const revealed = applyCommand(waiting, 'p2', { type: 'leave' }, ctx);
    expect(revealed.table.phase).toBe('playing');
    expect(revealed.table.players).toHaveLength(2);
    expect(revealed.events.map((e) => e.type)).toEqual([
      'player_left',
      'professions_revealed',
      'play_started',
    ]);

    // down to one player -> back to the lobby, picks cleared, only the host ready
    const two = applyCommand(lobbyOf(2), 'host', { type: 'start' }, ctx).table;
    const back = applyCommand(two, 'p1', { type: 'leave' }, ctx);
    expect(back.table.phase).toBe('lobby');
    expect(back.table.players).toHaveLength(1);
    expect(back.events.map((e) => e.type)).toEqual(['player_left', 'back_to_lobby']);
  });

  it('leaving mid-game keeps the seat and its books; when only one is left they win', () => {
    const playing = applyCommand(
      lobbyOf(3, { professions: 'random' }),
      'host',
      { type: 'start' },
      ctx,
    ).table;
    const one = applyCommand(playing, 'host', { type: 'leave' }, ctx);
    expect(one.table.phase).toBe('playing');
    expect(one.table.players).toHaveLength(3);
    expect(one.table.players[0]).toMatchObject({ status: 'left' });
    expect(one.table.players[0].books).not.toBeNull();
    expect(one.table.hostId).toBe('p1');

    const out = applyCommand(one.table, 'p1', { type: 'leave' }, ctx);
    expect(out.table.phase).toBe('finished');
    expect(out.table.result).toMatchObject({ reason: 'last-standing', winnerId: 'p2' });
    expect(out.events.map((e) => e.type)).toEqual(['player_left', 'host_changed', 'game_finished']);
    expectError(() => applyCommand(out.table, 'p2', { type: 'leave' }, ctx), 'WRONG_PHASE');
  });

  it('nothing but close/leave works once the game runs, and the settings are frozen', () => {
    const playing = applyCommand(
      lobbyOf(2, { professions: 'random' }),
      'host',
      { type: 'start' },
      ctx,
    ).table;
    expectError(
      () => applyCommand(playing, 'late', { type: 'join', name: 'Late' }, ctx),
      'WRONG_PHASE',
    );
    expectError(() => applyCommand(playing, 'host', { type: 'start' }, ctx), 'WRONG_PHASE');
    expectError(
      () =>
        applyCommand(playing, 'host', { type: 'update_settings', settings: { maxSeats: 9 } }, ctx),
      'WRONG_PHASE',
    );
    expectError(
      () => applyCommand(playing, 'p1', { type: 'set_ready', ready: false }, ctx),
      'WRONG_PHASE',
    );
    expectError(
      () => applyCommand(playing, 'host', { type: 'kick', target: 'p1' }, ctx),
      'WRONG_PHASE',
    );
    expect(applyCommand(playing, 'host', { type: 'close' }, ctx).table.phase).toBe('abandoned');
  });

  it('seats and starts a table as big as the ceiling, with a colour each', () => {
    const lobby = lobbyOf(TABLE_SEAT_CEILING, {
      maxSeats: TABLE_SEAT_CEILING,
      professions: 'random',
    });
    expect(new Set(lobby.players.map((p) => p.color)).size).toBe(TABLE_SEAT_CEILING);
    const playing = applyCommand(lobby, 'host', { type: 'start' }, ctx).table;
    expect(playing.phase).toBe('playing');
    expect(playing.order).toHaveLength(TABLE_SEAT_CEILING);
  });
});

describe('purity and replay', () => {
  const script: [string, TableCommand][] = [
    join('p1'),
    join('p2'),
    ready('p1'),
    ready('p2'),
    ['host', { type: 'start' }],
    pickAs('host', 'pilot'),
    pickAs('p1', 'random'),
    pickAs('p2', 'lehrer'),
  ];

  it('never mutates its inputs', () => {
    let table = deepFreeze(newTable());
    for (const [who, command] of script) {
      table = deepFreeze(applyCommand(table, who, deepFreeze(command), ctx).table);
    }
    expect(table.phase).toBe('playing');
  });

  it('replaying the same commands from the same seed gives the identical table', () => {
    const first = run(newTable({}, 4242), script);
    const second = run(newTable({}, 4242), script);
    expect(second.table).toEqual(first.table);
    expect(second.events).toEqual(first.events);
    const other = run(newTable({}, 4243), script);
    expect(other.table.rngState).not.toBe(first.table.rngState);
  });

  it('numbers every accepted command and stamps its events with that version', () => {
    const { table, events } = run(newTable(), script);
    expect(table.version).toBe(1 + script.length);
    expect(events.every((e) => e.version >= 2 && e.version <= table.version)).toBe(true);
    const versions = events.map((e) => e.version);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
  });
});
