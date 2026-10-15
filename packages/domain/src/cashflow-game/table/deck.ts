import { drawCardAction } from '../actions';
import type { CashflowDeckKind } from '../types';
import { runPlan, type PlayDeps, type PlayedMove } from './play';
import type { Table } from './types';

/**
 * The table's shared card piles (todo/cashflow-multiplayer.md slice T2). In solo play each game keeps its own discard pile
 * (`CashflowGameState.drawnCardIds`); at a table there is one pile per deck for everybody, so the spike's finding - four
 * players holding the same card - cannot happen: a card drawn by anyone is gone for everyone until the deck runs out and is
 * reshuffled, which clears the pile for the whole table.
 *
 * The draw itself is the solo rule, unchanged (`drawCardAction`: which pile the space asks for, `offered-once`, the dice-first
 * rule, a cost card's payment). `runPlan` lends it the table's pile and the table's dice stream and takes them back.
 */

export type TableDrawDeps = PlayDeps;
export type TableDraw = PlayedMove;

/**
 * Draws a card for `playerId` from the table's pile, exactly as a solo draw would for that player's own books. Throws what the
 * solo rules throw (as `ILLEGAL_MOVE`) and changes nothing then. The version is the calling command's job.
 */
export function drawTableCard(
  table: Table,
  playerId: string,
  input: { deck: CashflowDeckKind },
  deps: TableDrawDeps,
): TableDraw {
  return runPlan(table, playerId, (books, rng) => drawCardAction(books, input, { ...deps, rng }));
}

/** How many cards of a deck are still in the pile (not drawn since the last reshuffle). */
export function cardsLeft(table: Table, deck: CashflowDeckKind): number {
  const first = table.players.find((p) => p.books?.gameSet);
  const total = first?.books?.gameSet?.decks?.[deck]?.length ?? 0;
  return Math.max(0, total - table.drawnCardIds[deck].length);
}
