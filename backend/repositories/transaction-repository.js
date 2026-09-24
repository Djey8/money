'use strict';

const crypto = require('crypto');
const {
  isEncryptedValue,
  stateChangingGrowStatements,
  parseSettlements,
  parseBucketAllocations,
  transactionFromApi,
  transactionToApi,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { applyDerivedState } = require('../services/transaction-derived-state');
const { reverseGrowTransaction } = require('../services/grow-reversal');
const { computeWriteEffects } = require('../services/write-effects');

const MAX_WRITE_RETRIES = 10;

function decryptValue(value, session) {
  if (!isEncryptedValue(value)) return value;
  if (!session) throw new Error('Encrypted transaction data requires a configured encryption key');
  return session.decrypt(value);
}

function decryptTransaction(transaction, session) {
  const decrypted = {};
  for (const [key, value] of Object.entries(transaction)) {
    decrypted[key] = decryptValue(value, session);
  }
  if (typeof decrypted.amount === 'string') decrypted.amount = Number(decrypted.amount);
  // Legacy UI-written transactions (notably subscription-generated ones,
  // see packages/domain/src/transactions/subscription-generation.ts) store
  // '' for "no specific time of day" — normalizeTransaction requires a
  // non-empty time for API writes, but a read must still surface this
  // real, valid legacy data rather than reject it outright.
  if (!decrypted.time) decrypted.time = '00:00';
  return decrypted;
}

function encryptTransaction(transaction, session) {
  if (!session) return transaction;
  return Object.fromEntries(
    Object.entries(transaction).map(([key, value]) => [key, session.encrypt(String(value))]),
  );
}

function toApiTransactions(transactions, session, schemaVersion, currency) {
  return transactions.map((transaction) =>
    transactionToApi(decryptTransaction(transaction, session), schemaVersion, currency, () => {
      throw new Error(
        'Transaction is missing a stable ID; run mm-admin migrate-transaction-ids first',
      );
    }),
  );
}

function transactionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Grow trades (`Buy Share X 10 x 25;`, `Liabilitie ...; Buy Asset ...`,
 * `Payback Liabilitie ...`) only ever enter through the typed Grow actions,
 * which apply their effect to the Grow project and balance sheet in the
 * same write (PLAN.md D-16). A plain transaction carrying such a statement
 * would look like a trade in the app but have changed nothing, so it's
 * refused, pointing the caller at the typed action instead.
 */
function assertNoNewGrowTrade(comment) {
  // Bucket settlements are the same kind of typed-only statement: the
  // difference they carry is computed by the server.
  if (parseSettlements(comment || '').length > 0) {
    throw transactionError(
      'TRANSACTION_GROW_TRADE',
      'This comment contains a #settle: tag. Settle a bucket with POST /{smile|fire}/{id}/buckets/{bucketId}/settle (MCP settle_bucket), which computes the difference to what was saved.',
    );
  }
  if (stateChangingGrowStatements(comment).length > 0) {
    throw transactionError(
      'TRANSACTION_GROW_TRADE',
      'This comment contains a Grow trade statement (e.g. "Buy Share ..."). Record Grow trades with the typed Grow actions (POST /grow/{id}/buy, /sell, /payback; MCP manage_grow) so the project and balance sheet stay in sync.',
    );
  }
}

/**
 * An existing Grow trade's amount, comment, and category are exactly what
 * its Grow/balance-sheet effect was computed from, so they can only change
 * through PATCH /grow/{id}/transactions/{txId}, which undoes the old effect
 * and applies the new one. Other fields (date, time, account) are free.
 */
function assertTransactionPatchAllowed(existingTransaction, patch) {
  const isGrowTrade = stateChangingGrowStatements(existingTransaction.comment).length > 0;
  const touchesTrade = ['amountMinor', 'comment', 'category'].some((field) =>
    Object.prototype.hasOwnProperty.call(patch, field),
  );
  if (isGrowTrade && touchesTrade) {
    throw transactionError(
      'TRANSACTION_GROW_LOCKED',
      'This is a Grow trade: change its amount, comment, or category with PATCH /grow/{id}/transactions/{transactionId} (MCP manage_grow update_transaction), which also updates the project and balance sheet. Deleting it undoes its effect.',
    );
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'comment')) assertNoNewGrowTrade(patch.comment);
}

function hasBucketTags(comment) {
  return parseBucketAllocations(comment || '').length > 0;
}

/**
 * amountMinor and a comment's `#bucket:` tags are one coupled value to the
 * fund-allocation engine (packages/domain/src/transactions/fund-state.ts):
 * when tags are present they win over amountMinor entirely. A PATCH that
 * touches only one of the two against a tagged transaction would otherwise
 * silently revert the caller's amount change or silently reallocate funds
 * neither field's edit asked for.
 */
function assertBucketPatchIsConsistent(existingTransaction, patch) {
  const touchesAmount = Object.prototype.hasOwnProperty.call(patch, 'amountMinor');
  const touchesComment = Object.prototype.hasOwnProperty.call(patch, 'comment');
  if (touchesAmount === touchesComment) return;
  const commentsToCheck = touchesComment
    ? [existingTransaction.comment, patch.comment]
    : [existingTransaction.comment];
  if (commentsToCheck.some(hasBucketTags)) {
    const error = new Error(
      'amountMinor and comment must be updated together when the transaction has #bucket: allocation tags.',
    );
    error.code = 'BUCKET_PATCH_REQUIRES_BOTH_FIELDS';
    throw error;
  }
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  const offset = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid transaction cursor');
  return offset;
}

function filterAndSortTransactions(
  transactions,
  { account, category, from, to, sort = 'date', order = 'desc' },
) {
  const filtered = transactions.filter((transaction) => {
    if (account && transaction.account !== account) return false;
    if (category && transaction.category !== category) return false;
    if (from && transaction.date < from) return false;
    if (to && transaction.date > to) return false;
    return true;
  });
  const direction = order === 'asc' ? 1 : -1;
  return filtered.sort((left, right) => {
    const comparison =
      sort === 'amount'
        ? left.amountMinor - right.amountMinor
        : `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`);
    return comparison === 0 ? left.id.localeCompare(right.id) : comparison * direction;
  });
}

async function listTransactions({ usersDb, authDb }, userId, options = {}) {
  const { cursor, limit = 50 } = options;
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode === 404) return { transactions: [], nextCursor: null };
    throw error;
  }
  const transactions = userDoc.data?.transactions || [];
  if (!Array.isArray(transactions)) throw new Error('Stored transactions must be an array');
  const session = await getEncryptionSession(authDb, userId);
  const schemaVersion = userDoc.data?.meta?.schemaVersion || 1;
  const currency = userDoc.data?.meta?.currency || 'EUR';
  const apiTransactions = toApiTransactions(transactions, session, schemaVersion, currency);
  const matchingTransactions = filterAndSortTransactions(apiTransactions, options);
  const offset = decodeCursor(cursor);
  const page = matchingTransactions.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    transactions: page,
    nextCursor:
      nextOffset < matchingTransactions.length
        ? Buffer.from(String(nextOffset)).toString('base64url')
        : null,
  };
}

async function getTransaction(deps, userId, transactionId) {
  const result = await listTransactions(deps, userId, { limit: Number.MAX_SAFE_INTEGER });
  return result.transactions.find((transaction) => transaction.id === transactionId) || null;
}

/**
 * Shared read → recalculate-derived-state → write-with-retry-on-409 loop
 * used by every transaction write (create/copy/update/delete/batch). `mutate`
 * receives the current API-form transaction list and either returns:
 * - `null` — nothing to do (e.g. the target id doesn't exist); no write happens.
 * - `{ skipWrite: true, buildResult }` — a no-op outcome (e.g. an atomic batch
 *   that rolled back); no write happens, `buildResult` is called with the
 *   unchanged existing transactions.
 * - `{ allTransactions, buildResult }` — the new full transaction list to
 *   persist; `buildResult` is called with the post-recalculation ("effective",
 *   possibly fund-capped) transactions once the write succeeds.
 *
 * `createIfMissing` controls whether a 404 (no document for this user yet)
 * starts a fresh document (create/batch) or is treated as "nothing to find"
 * (copy/update/delete acting on a specific existing id).
 */
async function withTransactionsWrite(
  { usersDb, authDb },
  userId,
  mutate,
  { createIfMissing = true } = {},
) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      if (!createIfMissing) return null;
      userDoc = {
        _id: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {},
      };
    }
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = userDoc.data?.meta?.schemaVersion || 1;
    const currency = userDoc.data?.meta?.currency || 'EUR';
    const existingRawTransactions = userDoc.data?.transactions || [];
    if (!Array.isArray(existingRawTransactions)) {
      throw new Error('Stored transactions must be an array');
    }
    const existingTransactions = toApiTransactions(
      existingRawTransactions,
      session,
      schemaVersion,
      currency,
    );
    const mutation = mutate({ existingTransactions, currency });
    if (mutation === null) return null;
    if (mutation.skipWrite) return mutation.buildResult(existingTransactions);
    const { allTransactions, buildResult } = mutation;
    // A deleted Grow trade's effect on the project and balance sheet is
    // undone before the income statement is rebuilt (grow-reversal.js).
    const remainingIds = new Set(allTransactions.map((transaction) => transaction.id));
    const baseData = existingTransactions
      .filter((transaction) => !remainingIds.has(transaction.id))
      .reduce(
        (current, removed) => reverseGrowTransaction(current, removed, session, schemaVersion),
        userDoc.data || {},
      );
    const derived = applyDerivedState(baseData, allTransactions, session, schemaVersion);
    const data = derived.data;
    data.transactions = derived.transactions.map((effectiveTransaction) =>
      encryptTransaction(transactionFromApi(effectiveTransaction, schemaVersion), session),
    );
    try {
      await usersDb.insert({ ...userDoc, data, updatedAt: new Date().toISOString() });
      const effects = computeWriteEffects(userDoc.data, data, session, schemaVersion);
      return buildResult(derived.transactions, effects);
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(`Could not write transactions for ${userId}: CouchDB conflict`);
}

async function createTransaction(deps, userId, input) {
  return withTransactionsWrite(deps, userId, ({ existingTransactions, currency }) => {
    assertNoNewGrowTrade(input.comment);
    const transaction = { ...input, id: `tx_${crypto.randomUUID()}`, currency };
    return {
      allTransactions: [...existingTransactions, transaction],
      buildResult: (effectiveTransactions, effects) => ({
        ...effectiveTransactions.find((effective) => effective.id === transaction.id),
        effects,
      }),
    };
  });
}

function copyDefaults() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

async function copyTransaction({ usersDb, authDb }, userId, transactionId, overrides = {}) {
  return withTransactionsWrite(
    { usersDb, authDb },
    userId,
    ({ existingTransactions, currency }) => {
      const source = existingTransactions.find((transaction) => transaction.id === transactionId);
      if (!source) return null;
      assertBucketPatchIsConsistent(source, overrides);
      const newTransaction = {
        account: source.account,
        amountMinor: source.amountMinor,
        category: source.category,
        comment: source.comment,
        ...copyDefaults(),
        ...overrides,
        id: `tx_${crypto.randomUUID()}`,
        currency,
      };
      assertNoNewGrowTrade(newTransaction.comment);
      return {
        allTransactions: [...existingTransactions, newTransaction],
        buildResult: (effectiveTransactions, effects) => ({
          ...effectiveTransactions.find((effective) => effective.id === newTransaction.id),
          effects,
        }),
      };
    },
    { createIfMissing: false },
  );
}

async function updateTransaction({ usersDb, authDb }, userId, transactionId, patch) {
  return withTransactionsWrite(
    { usersDb, authDb },
    userId,
    ({ existingTransactions }) => {
      const index = existingTransactions.findIndex(
        (transaction) => transaction.id === transactionId,
      );
      if (index === -1) return null;
      assertTransactionPatchAllowed(existingTransactions[index], patch);
      assertBucketPatchIsConsistent(existingTransactions[index], patch);
      return {
        allTransactions: existingTransactions.map((transaction, candidateIndex) =>
          candidateIndex === index ? { ...transaction, ...patch } : transaction,
        ),
        buildResult: (effectiveTransactions, effects) => ({
          ...effectiveTransactions.find((effective) => effective.id === transactionId),
          effects,
        }),
      };
    },
    { createIfMissing: false },
  );
}

async function deleteTransaction({ usersDb, authDb }, userId, transactionId) {
  const result = await withTransactionsWrite(
    { usersDb, authDb },
    userId,
    ({ existingTransactions }) => {
      if (!existingTransactions.some((transaction) => transaction.id === transactionId))
        return null;
      return {
        allTransactions: existingTransactions.filter(
          (transaction) => transaction.id !== transactionId,
        ),
        buildResult: (_effectiveTransactions, effects) => ({ effects }),
      };
    },
    { createIfMissing: false },
  );
  return result === null ? false : result;
}

/**
 * Trusted internal write for typed actions that compose transactions
 * themselves (bucket settlement): removes `removeIds` and appends `add`
 * (`add[i].id` may reuse a removed id, to edit in place) in one write,
 * without the public endpoints' guards. Returns the effective added
 * transactions and `effects`.
 */
async function replaceTransactions(deps, userId, { removeIds = [], add = [] }) {
  return withTransactionsWrite(deps, userId, ({ existingTransactions, currency }) => {
    const removed = new Set(removeIds);
    const added = add.map((fields) => ({
      ...fields,
      id: fields.id || `tx_${crypto.randomUUID()}`,
      currency,
    }));
    return {
      allTransactions: [
        ...existingTransactions.filter((transaction) => !removed.has(transaction.id)),
        ...added,
      ],
      buildResult: (effectiveTransactions, effects) => ({
        transactions: added.map((transaction) =>
          effectiveTransactions.find((effective) => effective.id === transaction.id),
        ),
        effects,
      }),
    };
  });
}

const MAX_BATCH_OPERATIONS = 100;

/**
 * Applies a list of pre-validated create/update/delete operations
 * (`{op, id?, fields?, error?}` — an `error` already present means the
 * request-layer validator rejected this item before any data was touched)
 * against the caller's transactions in one document write. Non-atomic:
 * operations that fail (structurally or because their target id doesn't
 * exist) are skipped and reported per-item; everything else is applied and
 * persisted together. Atomic: if any operation fails, none are applied —
 * every item is reported as either `error` or `not_applied`.
 */
async function batchTransactions({ usersDb, authDb }, userId, items, { atomic = false } = {}) {
  return withTransactionsWrite(
    { usersDb, authDb },
    userId,
    ({ existingTransactions, currency }) => {
      let workingTransactions = existingTransactions;
      let anyApplied = false;
      const outcomes = items.map((item) => {
        if (item.error) return { op: item.op, id: item.id, status: 'error', error: item.error };
        try {
          if (item.op === 'create') {
            assertNoNewGrowTrade(item.fields.comment);
            const transaction = { ...item.fields, id: `tx_${crypto.randomUUID()}`, currency };
            workingTransactions = [...workingTransactions, transaction];
            anyApplied = true;
            return { op: 'create', status: 'created', id: transaction.id };
          }
          if (item.op === 'update') {
            const index = workingTransactions.findIndex(
              (transaction) => transaction.id === item.id,
            );
            if (index === -1) throw new Error('No matching transaction exists.');
            assertTransactionPatchAllowed(workingTransactions[index], item.fields);
            assertBucketPatchIsConsistent(workingTransactions[index], item.fields);
            workingTransactions = workingTransactions.map((transaction, candidateIndex) =>
              candidateIndex === index ? { ...transaction, ...item.fields } : transaction,
            );
            anyApplied = true;
            return { op: 'update', status: 'updated', id: item.id };
          }
          if (!workingTransactions.some((transaction) => transaction.id === item.id)) {
            throw new Error('No matching transaction exists.');
          }
          workingTransactions = workingTransactions.filter(
            (transaction) => transaction.id !== item.id,
          );
          anyApplied = true;
          return { op: 'delete', status: 'deleted', id: item.id };
        } catch (error) {
          return { op: item.op, id: item.id, status: 'error', error: error.message };
        }
      });

      const hasErrors = outcomes.some((outcome) => outcome.status === 'error');
      if ((atomic && hasErrors) || !anyApplied) {
        const results = outcomes.map((outcome) =>
          outcome.status === 'error' ? outcome : { ...outcome, status: 'not_applied' },
        );
        return { skipWrite: true, buildResult: () => ({ results, effects: null }) };
      }

      return {
        allTransactions: workingTransactions,
        buildResult: (effectiveTransactions, effects) => ({
          results: outcomes.map((outcome) => {
            if (outcome.status === 'error' || outcome.op === 'delete') return outcome;
            const transaction = effectiveTransactions.find(
              (effective) => effective.id === outcome.id,
            );
            return { ...outcome, transaction };
          }),
          effects,
        }),
      };
    },
  );
}

module.exports = {
  listTransactions,
  getTransaction,
  createTransaction,
  copyTransaction,
  updateTransaction,
  deleteTransaction,
  batchTransactions,
  replaceTransactions,
  MAX_BATCH_OPERATIONS,
  decryptTransaction,
  encryptTransaction,
  decryptValue,
  toApiTransactions,
  decodeCursor,
  filterAndSortTransactions,
  // Re-exported for data-repository.js's recalculateUserData, which reuses
  // this exact read -> recalculate-derived-state -> write-with-retry loop
  // rather than duplicating it, per D-9.
  withTransactionsWrite,
};
