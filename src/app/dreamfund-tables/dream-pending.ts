import type { GameBooks } from '@money/domain';
import type { DreamPending } from './dream-session.service';

/**
 * What a Dreamfund table wants from a player next, in the shape the solo screen keeps it (todo/dreamfund-tables-solo-ui.md, R4): the
 * card drawn for the tile the token stands on is written into the turn's pending decision, so the solo views (the Emergency card, the
 * Life card, the dreams offered, the Opportunity cards) show it exactly as they do in a solo game - the server drew it, the screen
 * only reads it. Only the player's own decision is known in full; a pending decision of somebody else has just its kind.
 */
export function withDreamPending(
  books: GameBooks,
  pending: DreamPending | { kind: string } | null | undefined,
): GameBooks {
  const turn = books.state.turn;
  const open = turn?.pending;
  if (!pending || !turn || !open || open.kind !== 'story') return books;
  const card = pending as DreamPending & { cardId?: string; offers?: string[]; pile?: string };
  let next = open;
  switch (card.kind) {
    case 'emergency':
      if (card.cardId) next = { ...open, emergency: { cardId: card.cardId, skipped: [] } };
      break;
    case 'life':
      if (card.cardId) next = { ...open, life: { cardId: card.cardId, skipped: [] } };
      break;
    case 'dream':
      next = { ...open, dream: { offers: card.offers ?? [] } };
      break;
    case 'opportunity':
      next = { ...open, opportunity: { pile: card.pile, offers: card.offers ?? [], told: [] } };
      break;
    default:
      break;
  }
  if (next === open) return books;
  return { ...books, state: { ...books.state, turn: { ...turn, pending: next } } };
}
