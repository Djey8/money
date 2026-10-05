/**
 * Stable transaction ids for the self-hosted edition.
 *
 * The backend rewrites a whole collection from whatever the app sends, and
 * for every entry without a string `id` it has to decrypt the stored
 * collection to hand back the id it already has (`legacy-write-id-backfill.js`).
 * With ~1,900 encrypted transactions that was 13-26 s per save on the
 * self-hosted server. Sending an id with every transaction makes that step a
 * no-op, so the app mints one itself - same `tx_<uuid>` shape the backend
 * generates, so nothing downstream can tell them apart.
 */

function randomUuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  // randomUUID only exists in secure contexts; a self-hosted install served
  // over plain http on a LAN address has to take the fallback below.
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newTransactionId(): string {
  return `tx_${randomUuid()}`;
}

/**
 * Gives every transaction a unique string `id`, in place. Existing ids are
 * kept; a missing, non-string or empty id - or one already used earlier in
 * the list (a cloned `{ ...tx }`, a re-imported export) - gets a fresh one.
 * Returns whether anything changed.
 */
export function ensureTransactionIds(transactions: { id?: unknown }[]): boolean {
  const seen = new Set<string>();
  let changed = false;
  for (const transaction of transactions) {
    if (transaction === null || typeof transaction !== 'object') continue;
    const id = transaction.id;
    if (typeof id === 'string' && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      continue;
    }
    const fresh = newTransactionId();
    transaction.id = fresh;
    seen.add(fresh);
    changed = true;
  }
  return changed;
}
