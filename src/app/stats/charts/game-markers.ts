import { hasGameTag } from '@money/domain';

/** Which Dreamer-game marker a transaction gets on the account charts. */
export type GameMarkerKind =
  | 'loanTaken'
  | 'loanRepaid'
  | 'doodad'
  | 'opportunity'
  | 'harvest'
  | 'life'
  | 'emergency'
  | 'career';
export type GameMarker = GameMarkerKind | null;

/** How each game marker looks: the symbol in the circle and its colour (the "+" / "-" badge shows the direction of the money). */
export const GAME_MARKER_STYLE: Record<
  GameMarkerKind,
  { emoji: string; color: string; label: string }
> = {
  loanTaken: { emoji: '🏦', color: '#e67e22', label: 'Bank loan taken' },
  loanRepaid: { emoji: '🏦', color: '#2e8b57', label: 'Bank loan repaid' },
  doodad: { emoji: '🛍️', color: '#8e44ad', label: 'Doodad' },
  opportunity: { emoji: '🌱', color: '#2e8b57', label: 'Opportunity' },
  harvest: { emoji: '🌾', color: '#b8860b', label: 'Harvest' },
  life: { emoji: '❤️', color: '#d63384', label: 'Life' },
  emergency: { emoji: '🚨', color: '#d9342b', label: 'Emergency' },
  career: { emoji: '🎓', color: '#1d4ed8', label: 'Career' },
};

/**
 * What the card a booking belongs to is, by its title: the game's own cards are booked under `@<card title>`. The chart passes
 * a lookup built from the printed content (it is empty until the game content has loaded, and in the Firebase builds).
 */
export type CardKindOf = (
  title: string,
) => 'opportunity' | 'harvest' | 'life' | 'emergency' | 'career' | null;

/**
 * The game's own chart markers (the Bank loan symbol, the Doodad bag, the cards of the Dreamer) belong to the game and nothing
 * else: they are only ever drawn while a game is running, so a normal account never gets one however its categories or comments
 * happen to read (JFK, 2026-10-04: no game feature in a normal account). Only the loan being taken or repaid counts - the
 * monthly interest Payday books under the same category has no "Bank loan" comment - and a Doodad is an expense tagged
 * `#doodad`. A Dreamer card is a booking tagged `#dreamfund` whose category is the card's title (JFK, 2026-11-07: the history
 * of the game is read off the chart - the Opportunity taken, the Emergency, the Life event, the Career step, the Harvest).
 */
export function gameMarkerFor(
  transaction: { amount: number; category?: string; comment?: string },
  gameRunning: boolean,
  cardKindOf?: CardKindOf,
): GameMarker {
  if (!gameRunning) return null;
  const category = (transaction.category || '').toLowerCase();
  const comment = transaction.comment || '';
  if (category === '@bank loan' && /^bank loan/i.test(comment)) {
    return transaction.amount > 0 ? 'loanTaken' : 'loanRepaid';
  }
  if (transaction.amount < 0 && /#doodad\b/.test(comment)) return 'doodad';
  if (cardKindOf && hasGameTag(comment) && category.startsWith('@')) {
    return cardKindOf((transaction.category || '').slice(1));
  }
  return null;
}
