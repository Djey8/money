import { fixedClock } from '../clock';
import { tableLegalActions } from './legal';
import { applyCommand, createTable, type TableContext } from './reducer';
import { rewindTable } from './rewind';
import { deepFreeze, testContext } from './testing';
import { TableCommandError, type Table, type TableCommand, type TableErrorCode } from './types';

const T0 = Date.parse('2026-10-15T09:00:00.000Z');
const at = (ms: number): TableContext => ({
  ...testContext,
  clock: fixedClock('2026-10-15', new Date(T0 + ms).toISOString()),
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

function playingTable(settings: object = {}): Table {
  let table = createTable(
    {
      id: 't',
      hostId: 'host',
      hostName: 'Host',
      settings: {
        name: 'T',
        professions: 'random',
        turnOrder: 'seat',
        clock: { mode: 'per-move', secondsPerMove: 60 },
        ...settings,
      },
      seed: 5,
    },
    at(0),
  ).table;
  const steps: [string, TableCommand][] = [];
  for (const id of ['p1', 'p2']) {
    steps.push(
      [id, { type: 'join', name: id.toUpperCase() }],
      [id, { type: 'set_ready', ready: true }],
    );
  }
  steps.push(['host', { type: 'start' }]);
  for (const [who, command] of steps) table = applyCommand(table, who, command, at(0)).table;
  return table;
}

/** The active player plays their whole turn the quickest way; returns the table at the start of the next turn. */
function quickTurn(table: Table, ms: number): Table {
  const who = table.activePlayerId!;
  let current = table;
  for (
    let step = 0;
    step < 8 && current.activePlayerId === who && current.phase === 'playing';
    step += 1
  ) {
    const legal = tableLegalActions(current, who).map((a) => a.action);
    const command: TableCommand = legal.includes('pass_card')
      ? { type: 'pass_card' }
      : legal.includes('roll_decision')
        ? { type: 'roll_decision' }
        : { type: 'roll' };
    current = applyCommand(current, who, command, at(ms)).table;
  }
  return current;
}

const books = (table: Table, id: string) => table.players.find((p) => p.id === id)!.books!;

describe('rewinding the last turn', () => {
  /** Host and p1 have played a turn each; p2 has started theirs. The snapshot is the start of p1's turn. */
  function setup() {
    const start = playingTable();
    const atP1 = quickTurn(start, 1000);
    expect(atP1.activePlayerId).toBe('p1');
    const atP2 = quickTurn(atP1, 2000);
    expect(atP2.activePlayerId).toBe('p2');
    const rolled = applyCommand(atP2, 'p2', { type: 'roll' }, at(3000)).table;
    return { start, atP1, atP2, current: rolled };
  }

  it('puts the books, the piles and the turn back to the start of the previous turn', () => {
    const { atP1, atP2, current } = setup();
    expect(books(current, 'p1').state.boardPosition).not.toBe(
      books(atP1, 'p1').state.boardPosition,
    );
    const result = rewindTable(current, atP1, 'host', at(4000));
    const table = result.table;
    expect(table.activePlayerId).toBe('p1');
    expect(table.turnRolled).toBe(false);
    expect(table.tableRound).toBe(atP1.tableRound);
    for (const id of ['host', 'p1', 'p2']) expect(books(table, id)).toEqual(books(atP1, id));
    expect(table.drawnCardIds).toEqual(atP1.drawnCardIds);
    expect(books(table, 'p2').state.boardPosition).toBeNull();
    // p1 never moved in the table that was put back, so p1 can play it again from the beginning
    expect(books(atP2, 'p1').state.boardPosition).not.toBe(books(table, 'p1').state.boardPosition);
  });

  it('is a repair, not a re-roll: the dice carry on, the version moves forward, the log says so', () => {
    const { atP1, current } = setup();
    const { table, events } = rewindTable(current, atP1, 'host', at(4000));
    expect(table.rngState).toBe(current.rngState);
    expect(table.rngState).not.toBe(atP1.rngState);
    expect(table.version).toBe(current.version + 1);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'rewound',
        playerId: 'host',
        version: current.version + 1,
        data: { toSeat: 1, round: atP1.tableRound },
      }),
    ]);
    // and the rewound table plays on
    const again = applyCommand(table, 'p1', { type: 'roll' }, at(5000));
    expect(again.table.version).toBe(table.version + 1);
  });

  it("gives the player whose turn it is again a fresh turn's time", () => {
    const { atP1, current } = setup();
    const { table } = rewindTable(current, atP1, 'host', at(50_000));
    expect(table.clock.turnStartedAt).toBe(T0 + 50_000);
    expect(table.clock.deadlineAt).toBe(T0 + 50_000 + 60_000);
  });

  it("is the host's alone, only while playing, only if allowed, and only to an earlier turn", () => {
    const { atP1, current } = setup();
    expectError(() => rewindTable(current, atP1, 'p1', at(4000)), 'NOT_HOST');
    expectError(
      () => rewindTable({ ...current, phase: 'finished' }, atP1, 'host', at(4000)),
      'WRONG_PHASE',
    );
    expectError(() => rewindTable(current, current, 'host', at(4000)), 'ILLEGAL_MOVE');
    expectError(
      () => rewindTable(current, { ...atP1, id: 'other' }, 'host', at(4000)),
      'ILLEGAL_MOVE',
    );
    expectError(
      () => rewindTable(current, { ...atP1, phase: 'lobby' }, 'host', at(4000)),
      'ILLEGAL_MOVE',
    );
    const forbidden = {
      ...current,
      settings: { ...current.settings, allowRewind: false },
    };
    expectError(() => rewindTable(forbidden, atP1, 'host', at(4000)), 'ILLEGAL_MOVE');
  });

  it('keeps who is in the game as it is now: a player who left stays gone, and the turn moves on if it was theirs', () => {
    const { atP1, current } = setup();
    const left = applyCommand(current, 'p1', { type: 'leave' }, at(3500)).table;
    const { table, events } = rewindTable(left, atP1, 'host', at(4000));
    expect(table.players.find((p) => p.id === 'p1')!.status).toBe('left');
    // p1's turn was the one put back, but they are gone: it passes on to p2
    expect(table.activePlayerId).toBe('p2');
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['rewound', 'turn_started']));
    // the away mark and the timeout count are today's, not the snapshot's
    const away: Table = {
      ...current,
      players: current.players.map((p) => (p.id === 'p2' ? { ...p, away: true } : p)),
      clock: { ...current.clock, timeouts: { p2: 2 } },
    };
    const kept = rewindTable(away, atP1, 'host', at(4000)).table;
    expect(kept.players.find((p) => p.id === 'p2')!.away).toBe(true);
    expect(kept.clock.timeouts).toEqual({ p2: 2 });
  });

  it("drops an offer that was open, and keeps the table's settings and host", () => {
    const { atP1, current } = setup();
    const offer = {
      sellerId: 'p2',
      cardId: 'x',
      deck: 'dealSmall' as const,
      to: null,
      priceMinor: 5,
      counters: [],
      declined: [],
    };
    const table = rewindTable({ ...current, trade: offer }, atP1, 'host', at(4000)).table;
    expect(table.trade).toBeNull();
    expect(table.hostId).toBe('host');
    expect(table.settings).toBe(current.settings);
  });

  it('never mutates what it is given', () => {
    const { atP1, current } = setup();
    deepFreeze(current);
    deepFreeze(atP1);
    expect(() => rewindTable(current, atP1, 'host', at(4000))).not.toThrow();
  });

  it('is a setting a host can turn off, on by default', () => {
    expect(playingTable().settings.allowRewind).toBe(true);
    expect(playingTable({ allowRewind: false }).settings.allowRewind).toBe(false);
  });
});
