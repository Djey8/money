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

const { withTransactionsWrite } = require('./transaction-repository');

class RecalculateError extends Error {}

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

module.exports = { recalculateUserData, RecalculateError };
