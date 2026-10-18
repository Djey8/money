import { startTurnClock } from './clock';
import type { CommandResult, TableContext } from './reducer';
import { settleTable } from './turns';
import { TableCommandError, type Table, type TableEvent } from './types';

/**
 * The host rewinds the last turn (todo/cashflow-multiplayer.md slice S4, decision Q8): for a mishap - a connection that dropped
 * while a move was due, the passive turn the clock played - not for second thoughts. The table goes back to the state at the
 * **start of the previous turn**; whoever moved since, that player's moves included, is undone. Everyone sees `rewound` in the
 * log, and a host can switch the whole thing off in the settings (`allowRewind`).
 *
 * The snapshot is the table as it stood when that turn started (the server keeps the last two). Three things are not put back:
 *
 *  - **the dice stream** stays where it is, so the replayed turn rolls different dice - a rewind is a repair, never a re-roll;
 *  - **who is in the game**: a player who left since stays gone, an away player stays away, names and colours stay;
 *  - **the settings and the host**.
 *
 * Pure: the caller supplies the snapshot and the context.
 */
export function rewindTable(
  current: Table,
  snapshot: Table,
  hostId: string,
  ctx: TableContext,
): CommandResult {
  if (hostId !== current.hostId) {
    throw new TableCommandError('NOT_HOST', 'Only the host can rewind the game.');
  }
  if (current.phase !== 'playing') {
    throw new TableCommandError('WRONG_PHASE', 'The game is not being played now.');
  }
  if (!current.settings.allowRewind) {
    throw new TableCommandError('ILLEGAL_MOVE', 'This table does not allow rewinding.');
  }
  if (
    snapshot.id !== current.id ||
    snapshot.phase !== 'playing' ||
    snapshot.version >= current.version
  ) {
    throw new TableCommandError('ILLEGAL_MOVE', 'There is no earlier turn to go back to.');
  }

  const now = Date.parse(ctx.clock.nowIso());
  const version = current.version + 1;
  const events: TableEvent[] = [];
  const emit = (
    type: TableEvent['type'],
    playerId: string | null,
    data?: Record<string, unknown>,
  ) => {
    events.push({ version, at: ctx.clock.nowIso(), type, playerId, ...(data ? { data } : {}) });
  };

  const players = snapshot.players.map((earlier) => {
    const now_ = current.players.find((p) => p.id === earlier.id);
    return now_
      ? { ...earlier, status: now_.status, away: now_.away, name: now_.name, color: now_.color }
      : earlier;
  });
  const restored: Table = {
    ...snapshot,
    version,
    settings: current.settings,
    hostId: current.hostId,
    players,
    rngState: current.rngState,
    trade: null,
    result: null,
    clock: {
      ...snapshot.clock,
      pausedAt: current.clock.pausedAt,
      timeouts: current.clock.timeouts,
    },
  };
  emit('rewound', hostId, {
    toSeat:
      restored.activePlayerId === null
        ? null
        : restored.players.findIndex((p) => p.id === restored.activePlayerId),
    round: restored.tableRound,
  });

  // The player whose turn it is again gets a full turn's time; if they have left since, the turn moves on.
  const started = restored.activePlayerId
    ? startTurnClock(restored, restored.activePlayerId, now)
    : restored;
  const settled = settleTable(started, (type, who, data) => emit(type, who, data), now);
  return { table: settled, events };
}
