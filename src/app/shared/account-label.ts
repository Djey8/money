/**
 * What an account is called on screen. The stored name of the third bucket stays `Smile` (it is the key of the books, of the
 * backend and of every saved transaction: docs/adr and CLAUDE.md "Ask before" - the storage is not renamed); the person sees
 * `Dream` (JFK, 2026-11-07).
 */
export function accountLabel(account: string | null | undefined): string {
  return account === 'Smile' ? 'Dream' : (account ?? '');
}
