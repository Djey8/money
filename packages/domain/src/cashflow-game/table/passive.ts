import { openDecisions, whyDiceFirst } from '../asset-deals';
import { whyCannotSkipCard } from '../rules';
import { currentTurn } from '../turn';
import type { Table, TableCommand } from './types';

/**
 * The most passive legal move (todo/cashflow-multiplayer.md §3.4): what is played for a player whose time ran out, or who is
 * away. It lets the table move on and nothing else - no buying, no selling, no loans of its own, no trade offers or answers:
 *
 *  1. roll, with one die (rolling is the only way a turn advances); Payday, Baby, Charity, Downsized and a Market card
 *     resolve on their own, as for anyone;
 *  2. a Deal space: pass; a Doodad space: pass - unless the table's rules forbid passing a payment, then draw the Doodad and
 *     pay it (the Bank loan covers a short purse, like any forced payment).
 *
 * Returns the next command for the active player, one at a time (what comes next depends on what the last one did), or null
 * when their turn is over.
 */
export function nextPassiveCommand(table: Table, playerId: string): TableCommand | null {
  if (table.phase !== 'playing' || table.activePlayerId !== playerId) return null;
  const books = table.players.find((p) => p.id === playerId)?.books;
  if (!books) return null;
  const turn = currentTurn(books.state);
  if (turn.phase === 'over') return null;
  if (turn.phase === 'roll') return table.turnRolled ? null : { type: 'roll', dice: 1 };

  const pending = turn.pending;
  if (!pending) return null;
  // A Market card takes effect for the whole table when it is opened - a passive turn opens it (what it costs is paid) and ticks it
  // off; leaving it shut would let the player escape a cost and keep the others from a buyer (after any dice decision, first).
  if (pending.kind === 'market') {
    const open = openDecisions(books.state);
    if (whyDiceFirst(books.state) && open.length > 0) {
      return { type: 'roll_decision', title: open[0].title };
    }
    if (pending.played) return { type: 'finish_card' };
    // a cost the player drew is paid (the game waits for it): what a clock that runs out does for them
    if (pending.offered && pending.paymentDue) {
      return { type: 'pay_market', cardId: pending.offered.cardId };
    }
    return { type: 'draw_card', deck: 'market' };
  }
  if (whyCannotSkipCard(books.state) === null) return { type: 'pass_card' };
  // a card that was planned (or sold) cannot be passed any more, only ticked off
  if (pending.played && pending.kind !== 'doodad') return { type: 'finish_card' };
  // A payment that cannot be passed comes after any dice decision that is open (the dice-first rule); the server rolls it.
  const waiting = openDecisions(books.state);
  if (whyDiceFirst(books.state) && waiting.length > 0) {
    return { type: 'roll_decision', title: waiting[0].title };
  }
  if (pending.kind === 'doodad') {
    return pending.offered
      ? { type: 'pay_doodad', cardId: pending.offered.cardId }
      : { type: 'draw_card', deck: 'doodad' };
  }
  return { type: 'pass_card' };
}
