/**
 * The physical card decks: two ways to bring one into play (todo/
 * cashflow-game.md decision 16). Both apply to any of the four decks
 * (`CashflowDeckKind`) — generic over `{id, title}` so this module needs no
 * knowledge of a Deal/Market/Doodad card's own fields.
 *
 * - **Find a card** (companion mode with a real physical deck in hand): the
 *   player drew a real card, and searches the digitized deck by title to
 *   load its numbers into the app.
 * - **Draw a card** (no physical deck — solo mode, or a companion player who
 *   wants the app to pick): the app picks at random from whatever hasn't
 *   been drawn since the deck's last reshuffle.
 */

import { pickOne, systemRng, type Rng } from './rng';

export interface CashflowDrawResult<T> {
  card: T;
  /** The deck's new "discard pile" (drawn-since-last-reshuffle) state — persist this. */
  drawnIds: string[];
  /** True when the deck had nothing left and was reshuffled before this draw. */
  reshuffled: boolean;
}

/** Draws one card at random, skipping anything already in `drawnIds`; reshuffles (clears the discard pile) first if the deck is exhausted. Throws only if the deck itself is empty. */
export function drawRandomCard<T extends { id: string }>(
  deck: T[],
  drawnIds: string[],
  rng: Rng = systemRng,
): CashflowDrawResult<T> {
  if (deck.length === 0) {
    throw new Error('This deck has no cards yet.');
  }
  let remaining = deck.filter((card) => !drawnIds.includes(card.id));
  let reshuffled = false;
  if (remaining.length === 0) {
    remaining = deck;
    reshuffled = true;
  }
  const card = pickOne(remaining, rng);
  return {
    card,
    drawnIds: [...(reshuffled ? [] : drawnIds), card.id],
    reshuffled,
  };
}

/**
 * Case-insensitive search over title, ticker symbol and price - what "find this card" searches by,
 * since physical cards aren't numbered. Every space-separated word must match something, so
 * `ok4u 20` narrows to that stock's 20 card; a word matches a title/symbol anywhere in it, or a
 * price from its start (`2` finds 20 and 25, not 12).
 */
export function findCards<
  T extends {
    title: string;
    symbol?: string;
    priceMinor?: number;
    depositMinor?: number;
    costMinor?: number;
  },
>(deck: T[], query: string): T[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return deck.filter((card) => {
    const title = card.title.toLocaleLowerCase();
    const symbol = (card.symbol ?? '').toLocaleLowerCase();
    const shown = card.priceMinor ?? card.depositMinor ?? card.costMinor;
    const price = shown === undefined ? '' : String(shown / 100);
    return words.every(
      (word) => title.includes(word) || symbol.includes(word) || price.startsWith(word),
    );
  });
}
