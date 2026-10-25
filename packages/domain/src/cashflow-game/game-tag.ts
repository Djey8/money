/**
 * The tag every transaction and subscription of a game carries in its comment (JFK, 2026-10-25: the game is Dreamfund, so its tag is
 * too). Games saved before the rename carry `#cashflow`: it is still recognised, nothing is rewritten.
 */
export const GAME_TAG = '#dreamfund';
export const LEGACY_GAME_TAG = '#cashflow';

/** Whether a comment marks a game transaction or subscription, by the tag of today or of the games before the rename. */
export function hasGameTag(comment: string | undefined | null): boolean {
  const text = comment ?? '';
  return text.includes(GAME_TAG) || text.includes(LEGACY_GAME_TAG);
}
