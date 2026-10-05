/** Which Cashflow-game marker a transaction gets on the account charts. */
export type GameMarker = 'loanTaken' | 'loanRepaid' | 'doodad' | null;

/**
 * The game's own chart markers (the Bank loan symbol, the Doodad bag) belong to the game and nothing
 * else: they are only ever drawn while a game is running, so a normal account never gets one however
 * its categories or comments happen to read (JFK, 2026-10-04: no game feature in a normal account).
 * Only the loan being taken or repaid counts - the monthly interest Payday books under the same
 * category has no "Bank loan" comment - and a Doodad is an expense tagged `#doodad`.
 */
export function gameMarkerFor(
  transaction: { amount: number; category?: string; comment?: string },
  gameRunning: boolean,
): GameMarker {
  if (!gameRunning) return null;
  const category = (transaction.category || '').toLowerCase();
  const comment = transaction.comment || '';
  if (category === '@bank loan' && /^bank loan/i.test(comment)) {
    return transaction.amount > 0 ? 'loanTaken' : 'loanRepaid';
  }
  if (transaction.amount < 0 && /#doodad\b/.test(comment)) return 'doodad';
  return null;
}
