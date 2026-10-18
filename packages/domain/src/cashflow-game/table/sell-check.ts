import { openPriceCardFor } from '../actions';
import { legalActions as soloLegalActions } from '../legal-actions';
import { currentTurn } from '../turn';
import type { Table } from './types';

/**
 * Whether one player could sell a position into a buyer's offer that is open for them right now (a Market card or a stock price
 * card somebody drew). A one-roll offer is closed by the solo rule once the player's own space is settled; at a table it stays
 * until their next roll, so the question is asked as if they were still deciding.
 */
export function canSellNow(table: Table, playerId: string): boolean {
  const me = table.players.find((p) => p.id === playerId);
  if (!me || me.status !== 'active' || !me.books) return false;
  const state = me.books.state;
  const turn = currentTurn(state);
  if (turn.phase === 'over') return false;
  const asking =
    turn.phase === 'roll' ? { ...state, turn: { ...turn, phase: 'decide' as const } } : state;
  return soloLegalActions(asking).some((entry) => entry.action === 'sell_position');
}

/** Which offer a card made to a player, as the key a player's `seenOffers` remember it by. */
export function offerKeys(table: Table, playerId: string): string[] {
  const me = table.players.find((p) => p.id === playerId);
  return (me?.books?.state.marketOffers ?? []).map(
    (offer) => `${offer.cardId}:${offer.title}:${offer.offeredAtRoll ?? ''}`,
  );
}

/**
 * Whether a held turn has to wait for this player: they can sell into an offer they have not yet said Continue to. Saying Continue
 * once is enough for a card - an offer that stays open for several turns does not hold every later turn (JFK, 2026-10-17).
 */
export function mustConfirmOffer(table: Table, playerId: string): boolean {
  if (!canSellNow(table, playerId)) return false;
  const me = table.players.find((p) => p.id === playerId);
  const seen = new Set(me?.seenOffers ?? []);
  return offerKeys(table, playerId).some((key) => !seen.has(key));
}

/** The players have now seen what is open for them: a held turn will not ask them about the same cards again. */
export function markOffersSeen(table: Table, playerIds: string[]): Table {
  return {
    ...table,
    players: table.players.map((p) => {
      if (!playerIds.includes(p.id)) return p;
      const keys = offerKeys(table, p.id);
      if (keys.length === 0) return p;
      return { ...p, seenOffers: [...new Set([...(p.seenOffers ?? []), ...keys])].slice(-40) };
    }),
  };
}

/** Whether this player may buy more of `title` at the price of a stock card that is open for them (they hold the share). */
export function canBuyAtPriceCard(table: Table, playerId: string, title?: string): boolean {
  const me = table.players.find((p) => p.id === playerId);
  if (!me || me.status !== 'active' || !me.books) return false;
  if (currentTurn(me.books.state).phase === 'over') return false;
  const books = me.books;
  if (title !== undefined) return openPriceCardFor(books, title) !== undefined;
  return (books.state.marketOffers ?? []).some(
    (offer) => openPriceCardFor(books, offer.title) !== undefined,
  );
}
