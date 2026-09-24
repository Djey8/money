'use strict';

/**
 * Rebuilds everything derived from transactions — income statement,
 * Smile/Fire bucket amounts, Mojo balance — against the given (already
 * updated) user `data`, exactly like every transaction write does.
 *
 * Bucket and Mojo amounts are never stored input: the fund-state engine
 * resets them to zero and replays every transaction (capping each one at
 * its bucket's/Mojo's target). So any write that changes what that replay
 * depends on — a bucket target, a project or bucket title, the Mojo
 * target — must rebuild too, or the stored amounts would disagree with
 * what the next transaction write recomputes. A rebuild can also re-cap
 * stored transactions (e.g. after lowering a target), which is why the
 * transactions are rewritten as well.
 */

const { transactionFromApi } = require('@money/domain');
const { toApiTransactions, encryptTransaction } = require('../repositories/transaction-repository');
const { applyDerivedState } = require('./transaction-derived-state');

/** @returns {object} the updated user `data` with derived state and (possibly re-capped) transactions rebuilt */
function rebuildDerivedState(data, session, schemaVersion) {
  const currency = data.meta?.currency || 'EUR';
  const transactions = toApiTransactions(data.transactions || [], session, schemaVersion, currency);
  const derived = applyDerivedState(data, transactions, session, schemaVersion);
  return {
    ...derived.data,
    transactions: derived.transactions.map((effective) =>
      encryptTransaction(transactionFromApi(effective, schemaVersion), session),
    ),
  };
}

module.exports = { rebuildDerivedState };
