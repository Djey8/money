import { summarizeGameFinances } from '../saved-games';
import { currentTurn } from '../turn';
import { endTurnClock, startTurnClock, stopClock } from './clock';
import type {
  Table,
  TableEndReason,
  TableEventType,
  TablePlayer,
  TableResult,
  TableStanding,
} from './types';

/**
 * Whose turn it is and when the game is over (todo/cashflow-multiplayer.md slice T3). After every move `settleTable` notes who
 * has escaped or gone bankrupt, ends the game when its end condition says so, and passes the turn on when the active player
 * is done: they rolled and their space is settled, or they are out. Passing skips players who left, who are out, and - for
 * real, now that there are other players - those sitting out Downsized, one turn at a time.
 */

export type EmitEvent = (
  type: TableEventType,
  playerId: string | null,
  data?: Record<string, unknown>,
) => unknown;

const outOf = (player: TablePlayer) =>
  player.status !== 'active' || !player.books || currentTurn(player.books.state).phase === 'over';

/** A player still in the game: seated, with books, not escaped, not bankrupt. */
export const isAlive = (player: TablePlayer) => !outOf(player);

function standingOf(table: Table, player: TablePlayer): TableStanding {
  const finisher = table.finishers.find((f) => f.playerId === player.id);
  const finances = player.books
    ? summarizeGameFinances(player.books.state, player.books.subscriptions)
    : { passiveIncomeMinor: 0, monthlyCashflowMinor: 0 };
  const outcome: TableStanding['outcome'] = finisher
    ? finisher.outcome
    : player.status === 'left'
      ? 'left'
      : 'playing';
  return {
    playerId: player.id,
    rank: 0,
    outcome,
    passiveIncomeMinor: finances.passiveIncomeMinor,
    monthlyCashflowMinor: finances.monthlyCashflowMinor,
  };
}

const GROUP: Record<TableStanding['outcome'], number> = {
  escaped: 0,
  playing: 1,
  bankrupt: 2,
  left: 3,
};

/**
 * Escapees first (the earliest out wins), then those still playing by passive income and monthly cashflow, then the bankrupt
 * (whoever lasted longest ranks higher), then those who left.
 */
export function rankPlayers(table: Table): TableStanding[] {
  const standings = table.players.map((player) => standingOf(table, player));
  const escapeIndex = (playerId: string) =>
    table.finishers.findIndex((f) => f.playerId === playerId);
  standings.sort(
    (a, b) =>
      GROUP[a.outcome] - GROUP[b.outcome] ||
      (a.outcome === 'escaped' ? escapeIndex(a.playerId) - escapeIndex(b.playerId) : 0) ||
      (a.outcome === 'bankrupt' ? escapeIndex(b.playerId) - escapeIndex(a.playerId) : 0) ||
      b.passiveIncomeMinor - a.passiveIncomeMinor ||
      b.monthlyCashflowMinor - a.monthlyCashflowMinor,
  );
  return standings.map((standing, index) => ({ ...standing, rank: index + 1 }));
}

function finish(
  table: Table,
  reason: TableEndReason,
  winnerId: string | null | undefined,
  emit: EmitEvent,
): Table {
  const ranking = rankPlayers(table);
  const winner =
    winnerId !== undefined
      ? winnerId
      : ranking[0] && ranking[0].outcome !== 'left' && ranking[0].outcome !== 'bankrupt'
        ? ranking[0].playerId
        : null;
  const result: TableResult = { reason, winnerId: winner, ranking };
  emit('game_finished', winner, { reason });
  return { ...stopClock(table), phase: 'finished', activePlayerId: null, result };
}

/** Records the first time a player is seen escaped or bankrupt. */
function noteFinishers(table: Table, emit: EmitEvent): Table {
  let next = table;
  for (const player of table.players) {
    const turn = player.books ? currentTurn(player.books.state) : null;
    if (turn?.phase !== 'over' || !turn.outcome) continue;
    if (next.finishers.some((f) => f.playerId === player.id)) continue;
    next = {
      ...next,
      finishers: [...next.finishers, { playerId: player.id, outcome: turn.outcome }],
    };
    emit(turn.outcome === 'escaped' ? 'player_escaped' : 'player_bankrupt', player.id);
  }
  return next;
}

/** The end condition, checked after anything that could end the game. Returns the finished table or null. */
function checkEnd(table: Table, emit: EmitEvent): Table | null {
  const escaped = table.finishers.filter((f) => f.outcome === 'escaped');
  if (table.settings.endCondition === 'first-escape' && escaped.length > 0) {
    return finish(table, 'escaped', escaped[0].playerId, emit);
  }
  const alive = table.players.filter(isAlive);
  if (alive.length === 0) {
    return escaped.length > 0
      ? finish(table, 'all-done', undefined, emit)
      : finish(table, 'everyone-out', null, emit);
  }
  // Everyone else went bankrupt or left, nobody got out: the one still standing wins.
  if (alive.length === 1 && escaped.length === 0 && table.players.length >= 2) {
    return finish(table, 'last-standing', alive[0].id, emit);
  }
  return null;
}

function mapPlayer(table: Table, playerId: string, fn: (p: TablePlayer) => TablePlayer): Table {
  return { ...table, players: table.players.map((p) => (p.id === playerId ? fn(p) : p)) };
}

/**
 * Passes the turn to the next player who can play. Wrapping past the end of the order starts a new table round (and with a
 * round limit may end the game). A player sitting out Downsized loses this turn and one of their `unemployedRoundsLeft`.
 */
function advance(table: Table, emit: EmitEvent, now: number): Table {
  const order = table.order;
  const ended = table.activePlayerId ? endTurnClock(table, table.activePlayerId, now) : table;
  let next: Table = { ...ended, turnRolled: false };
  let index = Math.max(0, order.indexOf(table.activePlayerId ?? ''));
  for (let guard = 0; guard < order.length * 4; guard += 1) {
    index = (index + 1) % order.length;
    if (index === 0) {
      const round = next.tableRound + 1;
      if (next.settings.endCondition === 'round-limit' && round > (next.settings.roundLimit ?? 0)) {
        return finish(next, 'round-limit', undefined, emit);
      }
      next = { ...next, tableRound: round };
      emit('round_started', null, { round });
    }
    const candidate = next.players.find((p) => p.id === order[index]);
    if (!candidate || outOf(candidate)) continue;
    const books = candidate.books!;
    if (books.state.unemployedRoundsLeft > 0) {
      const left = books.state.unemployedRoundsLeft - 1;
      next = mapPlayer(next, candidate.id, (p) => ({
        ...p,
        books: { ...books, state: { ...books.state, unemployedRoundsLeft: left } },
      }));
      emit('turn_skipped', candidate.id, { reason: 'downsized', roundsLeft: left });
      continue;
    }
    emit('turn_started', candidate.id);
    return startTurnClock({ ...next, activePlayerId: candidate.id }, candidate.id, now);
  }
  return { ...next, activePlayerId: null };
}

/**
 * After any change to the table's books or seats: note who is out, end the game if it is over, pass the turn on if the active
 * player is finished. Pure; events go to `emit`.
 */
function settleCore(table: Table, emit: EmitEvent, now: number): Table {
  let next = noteFinishers(table, emit);
  let ended = checkEnd(next, emit);
  if (ended) return ended;

  const active = next.players.find((p) => p.id === next.activePlayerId);
  const turnDone =
    !active ||
    outOf(active) ||
    (next.turnRolled && currentTurn(active.books!.state).phase === 'roll');
  if (turnDone) {
    next = advance(next, emit, now);
    if (next.phase === 'finished') return next;
    ended = checkEnd(next, emit);
    if (ended) return ended;
    if (next.activePlayerId === null) return finish(next, 'everyone-out', null, emit);
  }
  return next;
}

/** A trade offer that is no longer on: the card left the seller's hand, or their turn is over (T7). */
export function expireTrade(table: Table, emit: EmitEvent): Table {
  const offer = table.trade;
  if (!offer) return table;
  const seller = table.players.find((p) => p.id === offer.sellerId);
  const pending = seller?.books?.state.turn?.pending;
  const open =
    table.phase === 'playing' &&
    table.activePlayerId === offer.sellerId &&
    pending?.offered?.cardId === offer.cardId &&
    !pending.played &&
    !pending.closed &&
    !pending.purchased;
  if (open) return table;
  emit('trade_expired', offer.sellerId, { cardId: offer.cardId });
  return { ...table, trade: null };
}

/**
 * After any change to the table's books or seats: note who is out, end the game if it is over, pass the turn on if the active
 * player is finished, and drop a trade offer whose card has left the seller's hand. Pure; events go to `emit`.
 */
export function settleTable(table: Table, emit: EmitEvent, now: number): Table {
  return expireTrade(settleCore(table, emit, now), emit);
}
