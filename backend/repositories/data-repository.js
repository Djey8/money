'use strict';

/**
 * `POST /data/recalculate` (SET-11) — the server-side equivalent of the
 * original app's "Fix Accounting" button
 * (`IncomeStatementService.recalculate()`). Reuses
 * `transaction-repository.js`'s `withTransactionsWrite` read ->
 * recalculate-derived-state -> write-with-retry loop unchanged (per D-9,
 * rather than duplicating it here), passing the existing transactions back
 * as-is so the mutation is a pure forced recalculation — every write
 * already runs `applyDerivedState` (`services/transaction-derived-state.js`)
 * on write, so this endpoint's only job is to force that same recalculation
 * to happen again against whatever is currently stored, useful after a
 * direct data edit (e.g. `POST /data/import`, or manual CouchDB surgery)
 * that could have left the derived aggregates (accounting totals, Mojo,
 * Smile/Fire fund buckets) stale.
 *
 * Guards against a real data-loss trap in the shared recalculation engine:
 * `recalculateFundState` (packages/domain/src/transactions/fund-state.ts)
 * silently excludes any transaction with `amountMinor === 0` from its
 * output — and `withTransactionsWrite` writes back exactly what that
 * engine returns. The Pro API itself never lets a zero-amount transaction
 * be created (`POST`/`PATCH /transactions` both reject `amountMinor: 0`),
 * so this can't happen through normal use of this API — but this endpoint
 * is explicitly meant to run against "whatever is currently stored",
 * including legacy-origin or (once it exists) imported data that predates
 * that validation. Without this guard, calling this endpoint on such an
 * account would silently delete those transactions — the opposite of its
 * "recalculates derived state, never touches your transactions" contract.
 */

const { decryptDocumentPreservingTypes } = require('@money/domain');
const { withTransactionsWrite } = require('./transaction-repository');
const { getEncryptionSession } = require('../services/encryption-session');

class RecalculateError extends Error {}

/**
 * `GET /data/export` (SET-8) — wraps the same full-document read the
 * legacy, session-only `GET /api/data/document` does, with two deliberate
 * corrections:
 *
 * 1. **Always returns plaintext, with correct JSON types**, even when
 *    `encryptDatabase` is on. The legacy route returns the document
 *    exactly as stored — still ciphertext, since only the Angular client
 *    (which already holds the key) can make sense of it. Every other Pro
 *    API read decrypts server-side (ADR-0001), and an exported file is
 *    explicitly meant to be portable/human-readable, so this does too —
 *    using `decryptDocumentPreservingTypes` (packages/domain), which both
 *    decrypts every encrypted leaf regardless of shape/name AND recovers
 *    the original number type for known-numeric fields (encryption always
 *    stores a number as its stringified form, so a naive decrypt-only walk
 *    would hand back `"-12.5"` instead of `-12.5`). Throws if a value looks
 *    encrypted but no key is configured — reachable if `encryptDatabase`
 *    was toggled off without re-encrypting already-stored data (allowed by
 *    `PUT /encryption-config`) — rather than silently returning leftover
 *    ciphertext inside an otherwise-plaintext export.
 * 2. **Never includes the encryption key or config.** This isn't an active
 *    filtering step — `encryptionConfig` lives only on the separate
 *    `authDb` document (`services/encryption-session.js`), never inside
 *    `usersDb`'s `data`, and this function never reads `authDb` for
 *    anything but the decryption session — but it's called out because the
 *    original client-side export (`settings.component.ts`
 *    `exportMigrationData`, SET-8) does bundle the raw key into the
 *    downloaded file, which this deliberately does not replicate.
 */
async function exportUserData({ usersDb, authDb }, userId) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    return { data: {}, createdAt: null, updatedAt: null };
  }
  const session = await getEncryptionSession(authDb, userId);
  const { data } = decryptDocumentPreservingTypes(userDoc.data || {}, {
    decrypt: session ? (value) => session.decrypt(value) : undefined,
  });
  return {
    data,
    createdAt: userDoc.createdAt || null,
    updatedAt: userDoc.updatedAt || null,
  };
}

async function recalculateUserData(deps, userId) {
  const result = await withTransactionsWrite(
    deps,
    userId,
    ({ existingTransactions }) => {
      const zeroAmountCount = existingTransactions.filter((tx) => tx.amountMinor === 0).length;
      if (zeroAmountCount > 0) {
        const error = new RecalculateError(
          `Cannot recalculate: ${zeroAmountCount} stored transaction(s) have a zero amount, which ` +
            'the recalculation engine excludes rather than preserves. Remove or correct them first.',
        );
        error.code = 'RECALCULATE_WOULD_DROP_TRANSACTIONS';
        throw error;
      }
      return {
        allTransactions: existingTransactions,
        buildResult: (effectiveTransactions) => ({
          transactionCount: effectiveTransactions.length,
        }),
      };
    },
    { createIfMissing: false },
  );
  // No document exists yet for this user — nothing to recalculate, same
  // "empty, not an error" treatment listTransactions gives a missing doc.
  return result || { transactionCount: 0 };
}

module.exports = { recalculateUserData, RecalculateError, exportUserData };
