import { TableCommandError, type Table, type TableClock, type TableErrorCode } from './types';

/**
 * The table's chess clock (todo/cashflow-multiplayer.md slice T5). Pure: every function takes the server's `now` in epoch
 * milliseconds and returns a new table; nothing here sets a timer. The server reads `nextDeadline` and fires `applyTimeout`
 * (reducer.ts) when it passes.
 *
 *  - `none`: no deadline.
 *  - `per-move`: every turn has the same time, from the moment it starts to the moment the player's turn ends.
 *  - `bank`: each player has a bank of time that runs down only on their own turn; finishing a turn adds the increment back
 *    (a Fischer clock). A player whose bank is empty has no time: their turn is up at once.
 *  - `daily`: like `per-move`, in hours - for games that last days.
 *
 * An away player has no waiting time at all (their turn is due immediately), and a paused game has no deadline until resumed.
 */

/** A move that reaches the server this much after the deadline still counts (latency). */
export const CLOCK_GRACE_MS = 2000;

export function emptyClock(): TableClock {
  return { turnStartedAt: null, deadlineAt: null, banksMs: {}, pausedAt: null, timeouts: {} };
}

/** At the start of play: bank mode gives everybody their bank. */
export function initClock(table: Table): Table {
  const { clock } = table.settings;
  const banksMs: Record<string, number> =
    clock.mode === 'bank'
      ? Object.fromEntries(table.players.map((p) => [p.id, clock.bankSeconds * 1000]))
      : {};
  return { ...table, clock: { ...emptyClock(), banksMs } };
}

const incrementMs = (table: Table) =>
  table.settings.clock.mode === 'bank' ? table.settings.clock.incrementSeconds * 1000 : 0;

/** The active player's turn begins: their deadline is set from the clock mode. */
export function startTurnClock(table: Table, playerId: string, now: number): Table {
  const { clock: mode } = table.settings;
  const player = table.players.find((p) => p.id === playerId);
  let deadlineAt: number | null = null;
  switch (mode.mode) {
    case 'per-move':
      deadlineAt = now + mode.secondsPerMove * 1000;
      break;
    case 'daily':
      deadlineAt = now + mode.hoursPerMove * 3_600_000;
      break;
    case 'bank':
      deadlineAt = now + (table.clock.banksMs[playerId] ?? 0);
      break;
    case 'none':
      deadlineAt = null;
      break;
  }
  // Nobody waits for an away player.
  if (player?.away && deadlineAt !== null) deadlineAt = now;
  return { ...table, clock: { ...table.clock, turnStartedAt: now, deadlineAt } };
}

/** The player's turn is over: in bank mode what is left of their time, plus the increment, goes back into their bank. */
export function endTurnClock(table: Table, playerId: string, now: number): Table {
  const { clock } = table;
  const banksMs =
    table.settings.clock.mode === 'bank' && clock.deadlineAt !== null
      ? {
          ...clock.banksMs,
          [playerId]: Math.max(0, clock.deadlineAt - now) + incrementMs(table),
        }
      : clock.banksMs;
  return { ...table, clock: { ...clock, banksMs, turnStartedAt: null, deadlineAt: null } };
}

/** The game is over: no more deadlines. */
export function stopClock(table: Table): Table {
  return {
    ...table,
    clock: { ...table.clock, turnStartedAt: null, deadlineAt: null, pausedAt: null },
  };
}

/** When the server should next call `applyTimeout`, or null (no clock, nobody on the move, paused, game over). */
export function nextDeadline(table: Table): number | null {
  if (table.phase !== 'playing' || table.clock.pausedAt !== null) return null;
  return table.clock.deadlineAt;
}

/** The active player's time is up. */
export function isDue(table: Table, now: number): boolean {
  const deadline = nextDeadline(table);
  return deadline !== null && now >= deadline;
}

/** Why the active player's move cannot be accepted right now because of the clock, or null. */
export function whyClockBlocks(
  table: Table,
  now: number,
): { code: TableErrorCode; message: string } | null {
  if (table.clock.pausedAt !== null) return { code: 'PAUSED', message: 'The game is paused.' };
  const deadline = table.clock.deadlineAt;
  if (deadline !== null && now > deadline + CLOCK_GRACE_MS) {
    return { code: 'TIME_UP', message: 'Your time is up: a move is played for you.' };
  }
  return null;
}

export function pauseClock(table: Table, now: number): Table {
  if (table.clock.pausedAt !== null) {
    throw new TableCommandError('WRONG_PHASE', 'The game is already paused.');
  }
  return { ...table, clock: { ...table.clock, pausedAt: now } };
}

/** Resuming gives the active player back the time that went by while paused. */
export function resumeClock(table: Table, now: number): Table {
  const { clock } = table;
  if (clock.pausedAt === null)
    throw new TableCommandError('WRONG_PHASE', 'The game is not paused.');
  const paused = Math.max(0, now - clock.pausedAt);
  return {
    ...table,
    clock: {
      ...clock,
      pausedAt: null,
      turnStartedAt: clock.turnStartedAt === null ? null : clock.turnStartedAt + paused,
      deadlineAt: clock.deadlineAt === null ? null : clock.deadlineAt + paused,
    },
  };
}

/** Another timeout for this player; returns the table and the new count. */
export function countTimeout(table: Table, playerId: string): { table: Table; count: number } {
  const count = (table.clock.timeouts[playerId] ?? 0) + 1;
  return {
    count,
    table: {
      ...table,
      clock: { ...table.clock, timeouts: { ...table.clock.timeouts, [playerId]: count } },
    },
  };
}

export function resetTimeouts(table: Table, playerId: string): Table {
  if (!table.clock.timeouts[playerId]) return table;
  return {
    ...table,
    clock: { ...table.clock, timeouts: { ...table.clock.timeouts, [playerId]: 0 } },
  };
}
