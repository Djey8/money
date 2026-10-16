import { fixedClock } from '../clock';
import type { GameBooks } from '../books';
import { nextDeadline } from './clock';
import { nextPassiveCommand } from './passive';
import {
  applyCommand,
  applyTimeout,
  createTable,
  type CommandResult,
  type TableContext,
} from './reducer';
import { deepFreeze, testContext } from './testing';
import {
  TableCommandError,
  type Table,
  type TableCommand,
  type TableErrorCode,
  type TableEvent,
} from './types';
import { projectFor } from './view';

const T0 = Date.parse('2026-10-15T09:00:00.000Z');
const SEC = 1000;
/** A context whose clock reads `T0 + offset` milliseconds. */
const at = (offsetMs: number): TableContext => ({
  ...testContext,
  clock: fixedClock('2026-10-15', new Date(T0 + offsetMs).toISOString()),
});

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

/** A started table (seat order, random professions) whose clock started at T0. */
function playingTable(settings: object = {}, players = 3, seed = 1): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: {
        name: 'T',
        professions: 'random',
        turnOrder: 'seat',
        maxSeats: 8,
        clock: { mode: 'per-move', secondsPerMove: 30 },
        ...settings,
      },
      seed,
    },
    at(0),
  ).table;
  const steps: [string, TableCommand][] = [];
  for (let i = 1; i < players; i += 1) {
    steps.push(
      [`p${i}`, { type: 'join', name: `P${i}` }],
      [`p${i}`, { type: 'set_ready', ready: true }],
    );
  }
  steps.push(['host', { type: 'start' }]);
  for (const [who, command] of steps) table = applyCommand(table, who, command, at(0)).table;
  return table;
}

const booksOf = (table: Table, id: string) => table.players.find((p) => p.id === id)!.books!;
const types = (events: TableEvent[]) => events.map((e) => e.type);
const player = (table: Table, id: string) => table.players.find((p) => p.id === id)!;
const rolled = (events: TableEvent[]) =>
  events.find((e) => e.type === 'rolled')?.data as { landed: string } | undefined;

function editBooks(table: Table, playerId: string, edit: (books: GameBooks) => GameBooks): Table {
  return {
    ...table,
    players: table.players.map((p) =>
      p.id === playerId && p.books ? { ...p, books: edit(p.books) } : p,
    ),
  };
}

/** The first dice stream for which the active player's timeout turn lands on `wanted`. */
function timeoutWhere(
  table: Table,
  offsetMs: number,
  wanted: (landed: string) => boolean,
): CommandResult {
  for (let seed = 1; seed <= 4000; seed += 1) {
    const result = applyTimeout({ ...table, rngState: seed }, at(offsetMs));
    const landed = rolled(result.events)?.landed;
    if (landed && wanted(landed)) return result;
  }
  throw new Error('no dice stream gives that roll');
}

/** A whole turn played by hand the quickest way (a roll that settles itself or is passed), at `offsetMs`. */
function quickTurn(table: Table, offsetMs: number): CommandResult {
  const who = table.activePlayerId!;
  for (let seed = 1; seed <= 4000; seed += 1) {
    const result = applyCommand({ ...table, rngState: seed }, who, { type: 'roll' }, at(offsetMs));
    const landed = rolled(result.events)!.landed;
    if (landed === 'downsized' || landed === 'doodad') continue; // a Doodad cannot be passed at a table
    const pending = booksOf(result.table, who).state.turn?.pending;
    if (!pending || result.table.activePlayerId !== who) return result;
    const passed = applyCommand(result.table, who, { type: 'pass_card' }, at(offsetMs));
    return { table: passed.table, events: [...result.events, ...passed.events] };
  }
  throw new Error('no dice stream');
}

describe('the clock modes', () => {
  it('per-move: every turn gets the same time from when it starts', () => {
    const table = playingTable();
    expect(table.clock).toMatchObject({ turnStartedAt: T0, deadlineAt: T0 + 30 * SEC });
    expect(nextDeadline(table)).toBe(T0 + 30 * SEC);
    const next = quickTurn(table, 10 * SEC).table;
    expect(next.activePlayerId).toBe('p1');
    expect(next.clock).toMatchObject({ turnStartedAt: T0 + 10 * SEC, deadlineAt: T0 + 40 * SEC });
  });

  it('daily: the time is hours', () => {
    const table = playingTable({ clock: { mode: 'daily', hoursPerMove: 24 } });
    expect(nextDeadline(table)).toBe(T0 + 24 * 3_600_000);
  });

  it('none: there is no deadline and nothing can time out', () => {
    const table = playingTable({ clock: { mode: 'none' } });
    expect(nextDeadline(table)).toBeNull();
    expectError(() => applyTimeout(table, at(10 * 3_600_000)), 'NOT_DUE');
  });

  it('bank: time runs down on your own turn only, and the increment is added back', () => {
    const table = playingTable({ clock: { mode: 'bank', bankSeconds: 120, incrementSeconds: 5 } });
    expect(table.clock.banksMs).toEqual({ host: 120 * SEC, p1: 120 * SEC, p2: 120 * SEC });
    expect(nextDeadline(table)).toBe(T0 + 120 * SEC);
    // the host takes 20 s: 100 s left + 5 s increment
    const after = quickTurn(table, 20 * SEC).table;
    expect(after.clock.banksMs.host).toBe(105 * SEC);
    expect(after.clock.banksMs.p1).toBe(120 * SEC);
    expect(nextDeadline(after)).toBe(T0 + 20 * SEC + 120 * SEC);
  });

  it('the clock is part of what everyone sees', () => {
    const table = playingTable({ clock: { mode: 'bank', bankSeconds: 120, incrementSeconds: 5 } });
    const view = projectFor(table, 'p1');
    expect(view.clock).toEqual({
      deadlineAt: T0 + 120 * SEC,
      pausedAt: null,
      banksMs: [120 * SEC, 120 * SEC, 120 * SEC],
      timeouts: [0, 0, 0],
    });
    expect(view.players.every((p) => p.away === false)).toBe(true);
  });
});

describe('a timeout plays the most passive turn', () => {
  it('is refused before the time is up', () => {
    const table = playingTable();
    expectError(() => applyTimeout(table, at(10 * SEC)), 'NOT_DUE');
    expectError(() => applyTimeout(table, at(30 * SEC - 1)), 'NOT_DUE');
  });

  it('rolls with one die, passes the card, and hands the turn on', () => {
    const table = playingTable();
    const result = timeoutWhere(table, 31 * SEC, (landed) => landed === 'deal');
    expect(types(result.events)).toEqual(
      expect.arrayContaining(['turn_timeout', 'rolled', 'card_passed', 'turn_started']),
    );
    expect(result.events[0]).toMatchObject({
      type: 'turn_timeout',
      playerId: 'host',
      data: { count: 1 },
    });
    // nothing was bought, drawn or sold for them
    expect(types(result.events)).not.toContain('card_drawn');
    expect(types(result.events)).not.toContain('card_played');
    expect(booksOf(result.table, 'host').shares).toEqual([]);
    expect(result.table.activePlayerId).toBe('p1');
    expect(result.table.version).toBe(table.version + 1);
    expect(result.table.clock.timeouts.host).toBe(1);
    expect(result.table.clock.deadlineAt).toBe(T0 + 31 * SEC + 30 * SEC);
  });

  it('pays a Doodad when time runs out under any rules: nobody can pass one at a table', () => {
    for (const rulesBase of ['guided', 'strict'] as const) {
      const table = playingTable({ rulesBase });
      expect(table.settings.rules.passDoodads).toBe('forbidden');
      const paid = timeoutWhere(table, 31 * SEC, (landed) => landed === 'doodad');
      expect(types(paid.events)).toEqual(
        expect.arrayContaining(['rolled', 'card_drawn', 'card_played', 'turn_started']),
      );
      expect(types(paid.events)).not.toContain('card_passed');
      expect(paid.table.activePlayerId).toBe('p1');
    }
  });

  it('a Market space is drawn for the table by the roll itself - nobody can pass it', () => {
    let table = playingTable({ clock: { mode: 'none' } });
    // host stands 4 before the Market space (7) and has started
    table = editBooks(table, 'host', (books) => ({
      ...books,
      state: { ...books.state, boardPosition: 3, turn: { phase: 'roll', count: 1 } },
    }));
    let result: CommandResult | null = null;
    for (let seed = 1; seed <= 4000 && !result; seed += 1) {
      const attempt = applyCommand({ ...table, rngState: seed }, 'host', { type: 'roll' }, at(0));
      if (rolled(attempt.events)?.landed === 'market') result = attempt;
    }
    expect(types(result!.events)).toEqual(
      expect.arrayContaining(['rolled', 'card_drawn', 'market_card_played', 'turn_started']),
    );
    expect(result!.table.activePlayerId).toBe('p1');
    expect(result!.table.drawnCardIds.market).toHaveLength(1);
  });

  it('the passive policy only ever rolls, passes, or pays a forced Doodad', () => {
    const table = playingTable();
    expect(nextPassiveCommand(table, 'host')).toEqual({ type: 'roll', dice: 1 });
    expect(nextPassiveCommand(table, 'p1')).toBeNull();
    const deciding = editBooks({ ...table, turnRolled: true }, 'host', (books) => ({
      ...books,
      state: {
        ...books.state,
        turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 0 } },
      },
    }));
    expect(nextPassiveCommand(deciding, 'host')).toEqual({ type: 'pass_card' });
    const strict = playingTable({ rulesBase: 'strict' });
    const doodad = editBooks({ ...strict, turnRolled: true }, 'host', (books) => ({
      ...books,
      state: {
        ...books.state,
        turn: { phase: 'decide', count: 1, pending: { kind: 'doodad', spaceIndex: 1 } },
      },
    }));
    expect(nextPassiveCommand(doodad, 'host')).toEqual({ type: 'draw_card', deck: 'doodad' });
  });
});

describe('time and moves', () => {
  it('a move just after the deadline still counts; a late one does not', () => {
    const table = playingTable();
    // 31 s: inside the 2 s grace -> accepted
    expect(applyCommand(table, 'host', { type: 'roll' }, at(31 * SEC)).table.version).toBe(
      table.version + 1,
    );
    // 33 s: too late, the server plays the turn instead
    expectError(() => applyCommand(table, 'host', { type: 'roll' }, at(33 * SEC)), 'TIME_UP');
    expect(applyTimeout(table, at(33 * SEC)).events[0].type).toBe('turn_timeout');
  });

  it('any move of their own sets the timeouts back to zero', () => {
    const table = playingTable();
    const timedOut = timeoutWhere(table, 31 * SEC, (landed) => landed === 'payday');
    expect(timedOut.table.clock.timeouts.host).toBe(1);
    // p1 plays, then the host plays their next turn themselves
    const p1Done = quickTurn(timedOut.table, 40 * SEC).table;
    const p2Done = quickTurn(p1Done, 45 * SEC).table;
    expect(p2Done.activePlayerId).toBe('host');
    const hostDone = quickTurn(p2Done, 50 * SEC).table;
    expect(hostDone.clock.timeouts.host).toBe(0);
  });

  it('pausing stops the clock and refuses every move; resuming gives the time back', () => {
    const table = playingTable();
    expectError(() => applyCommand(table, 'p1', { type: 'pause' }, at(10 * SEC)), 'NOT_HOST');
    const paused = applyCommand(table, 'host', { type: 'pause' }, at(10 * SEC));
    expect(types(paused.events)).toEqual(['paused']);
    expect(nextDeadline(paused.table)).toBeNull();
    expectError(() => applyTimeout(paused.table, at(500 * SEC)), 'NOT_DUE');
    expectError(() => applyCommand(paused.table, 'host', { type: 'roll' }, at(20 * SEC)), 'PAUSED');
    expectError(
      () =>
        applyCommand(
          paused.table,
          'p1',
          { type: 'sell_position', input: { title: 'x' } },
          at(20 * SEC),
        ),
      'PAUSED',
    );
    expectError(
      () => applyCommand(paused.table, 'host', { type: 'pause' }, at(20 * SEC)),
      'WRONG_PHASE',
    );

    // 30 s pass while paused: the host still has the 20 s they had left
    const resumed = applyCommand(paused.table, 'host', { type: 'resume' }, at(40 * SEC));
    expect(types(resumed.events)).toEqual(['resumed']);
    expect(nextDeadline(resumed.table)).toBe(T0 + 60 * SEC);
    expectError(
      () => applyCommand(resumed.table, 'host', { type: 'resume' }, at(41 * SEC)),
      'WRONG_PHASE',
    );
    expect(
      applyCommand(resumed.table, 'host', { type: 'roll' }, at(41 * SEC)).table.version,
    ).toBeGreaterThan(resumed.table.version);
  });

  it('a bank that ran out leaves only the increment: the turn is due at once', () => {
    const table = playingTable({ clock: { mode: 'bank', bankSeconds: 60, incrementSeconds: 0 } });
    // the host lets the whole minute run out
    const timedOut = timeoutWhere(table, 61 * SEC, (landed) => landed === 'payday');
    expect(timedOut.table.clock.banksMs.host).toBe(0);
    // p1 plays; p2 plays; the host is up again with an empty bank -> due immediately
    const p1 = quickTurn(timedOut.table, 70 * SEC).table;
    const p2 = quickTurn(p1, 75 * SEC).table;
    expect(p2.activePlayerId).toBe('host');
    expect(nextDeadline(p2)).toBe(T0 + 75 * SEC);
  });
});

describe('away players', () => {
  it('too many timeouts in a row mark a player away, and their turns are then played at once', () => {
    let table = playingTable({ awayAfterTimeouts: 2 }, 2);
    // 1st timeout
    table = timeoutWhere(table, 31 * SEC, (l) => l === 'payday').table;
    expect(player(table, 'host').away).toBe(false);
    // p1 plays by hand, the host's turn starts and runs out again: 2nd timeout -> away
    table = quickTurn(table, 40 * SEC).table;
    expect(table.activePlayerId).toBe('host');
    const second = timeoutWhere(table, 80 * SEC, () => true);
    expect(types(second.events)).toContain('player_away');
    expect(player(second.table, 'host').away).toBe(true);
    expect(projectFor(second.table, 'p1').players[0].away).toBe(true);
    // p1 plays: the host is away, so their turn is played in the same command and it is p1's turn again
    const hand = quickTurn(second.table, 90 * SEC);
    const hostRolls = hand.events.filter((e) => e.type === 'rolled' && e.playerId === 'host');
    expect(hostRolls).toHaveLength(1);
    expect(hand.table.activePlayerId).toBe('p1');
    expect(hand.table.version).toBe(second.table.version + 1);
  });

  it('"back" returns an away player to their own turns', () => {
    let table = playingTable({ awayAfterTimeouts: 1 }, 3);
    table = timeoutWhere(table, 31 * SEC, (l) => l === 'payday').table;
    expect(player(table, 'host').away).toBe(true);
    expectError(() => applyCommand(table, 'p1', { type: 'back' }, at(32 * SEC)), 'WRONG_PHASE');
    const back = applyCommand(table, 'host', { type: 'back' }, at(32 * SEC));
    expect(types(back.events)).toEqual(['player_returned']);
    expect(player(back.table, 'host').away).toBe(false);
    expect(back.table.clock.timeouts.host).toBe(0);
  });

  it('when everyone left in the game is away the table closes instead of playing itself', () => {
    let table = playingTable({ awayAfterTimeouts: 1 }, 2);
    table = {
      ...table,
      players: table.players.map((p) => (p.id === 'p1' ? { ...p, away: true } : p)),
    };
    const result = timeoutWhere(table, 31 * SEC, (l) => l === 'payday');
    expect(result.table.phase).toBe('abandoned');
    expect(result.events.find((e) => e.type === 'table_closed')).toMatchObject({
      data: { reason: 'everyone_away' },
    });
    expect(nextDeadline(result.table)).toBeNull();
  });
});

describe('purity and replay', () => {
  it('a timeout never mutates its input and is repeatable', () => {
    const table = deepFreeze(playingTable());
    const a = applyTimeout(table, at(31 * SEC));
    const b = applyTimeout(table, at(31 * SEC));
    expect(b.table).toEqual(a.table);
    expect(b.events).toEqual(a.events);
    expect(table.activePlayerId).toBe('host');
  });
});
