'use strict';

const crypto = require('crypto');
const {
  isEncryptedValue,
  parseBucketAllocations,
  transactionFromApi,
  transactionToApi,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { applyDerivedState } = require('../services/transaction-derived-state');

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

async function createTransaction({ usersDb, authDb }, userId, input) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
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
    if (!Array.isArray(existingRawTransactions))
      throw new Error('Stored transactions must be an array');
    const transaction = { ...input, id: `tx_${crypto.randomUUID()}`, currency };
    const existingTransactions = toApiTransactions(
      existingRawTransactions,
      session,
      schemaVersion,
      currency,
    );
    const allTransactions = [...existingTransactions, transaction];
    const derived = applyDerivedState(userDoc.data || {}, allTransactions, session, schemaVersion);
    const data = derived.data;
    data.transactions = derived.transactions.map((effectiveTransaction) =>
      encryptTransaction(transactionFromApi(effectiveTransaction, schemaVersion), session),
    );
    try {
      await usersDb.insert({ ...userDoc, data, updatedAt: new Date().toISOString() });
      return derived.transactions.find(
        (effectiveTransaction) => effectiveTransaction.id === transaction.id,
      );
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(`Could not create transaction for ${userId}: CouchDB conflict`);
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
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = userDoc.data?.meta?.schemaVersion || 1;
    const currency = userDoc.data?.meta?.currency || 'EUR';
    const existingRawTransactions = userDoc.data?.transactions || [];
    if (!Array.isArray(existingRawTransactions))
      throw new Error('Stored transactions must be an array');
    const existingTransactions = toApiTransactions(
      existingRawTransactions,
      session,
      schemaVersion,
      currency,
    );
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
    const allTransactions = [...existingTransactions, newTransaction];
    const derived = applyDerivedState(userDoc.data || {}, allTransactions, session, schemaVersion);
    const data = derived.data;
    data.transactions = derived.transactions.map((effectiveTransaction) =>
      encryptTransaction(transactionFromApi(effectiveTransaction, schemaVersion), session),
    );
    try {
      await usersDb.insert({ ...userDoc, data, updatedAt: new Date().toISOString() });
      return derived.transactions.find(
        (effectiveTransaction) => effectiveTransaction.id === newTransaction.id,
      );
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(`Could not copy transaction ${transactionId} for ${userId}: CouchDB conflict`);
}

async function updateTransaction({ usersDb, authDb }, userId, transactionId, patch) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = userDoc.data?.meta?.schemaVersion || 1;
    const currency = userDoc.data?.meta?.currency || 'EUR';
    const existingRawTransactions = userDoc.data?.transactions || [];
    if (!Array.isArray(existingRawTransactions))
      throw new Error('Stored transactions must be an array');
    const existingTransactions = toApiTransactions(
      existingRawTransactions,
      session,
      schemaVersion,
      currency,
    );
    const index = existingTransactions.findIndex((transaction) => transaction.id === transactionId);
    if (index === -1) return null;
    assertBucketPatchIsConsistent(existingTransactions[index], patch);
    const allTransactions = existingTransactions.map((transaction, candidateIndex) =>
      candidateIndex === index ? { ...transaction, ...patch } : transaction,
    );
    const derived = applyDerivedState(userDoc.data || {}, allTransactions, session, schemaVersion);
    const data = derived.data;
    data.transactions = derived.transactions.map((effectiveTransaction) =>
      encryptTransaction(transactionFromApi(effectiveTransaction, schemaVersion), session),
    );
    try {
      await usersDb.insert({ ...userDoc, data, updatedAt: new Date().toISOString() });
      return derived.transactions.find(
        (effectiveTransaction) => effectiveTransaction.id === transactionId,
      );
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(`Could not update transaction ${transactionId} for ${userId}: CouchDB conflict`);
}

async function deleteTransaction({ usersDb, authDb }, userId, transactionId) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    let userDoc;
    try {
      userDoc = await usersDb.get(userId);
    } catch (error) {
      if (error.statusCode === 404) return false;
      throw error;
    }
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = userDoc.data?.meta?.schemaVersion || 1;
    const currency = userDoc.data?.meta?.currency || 'EUR';
    const existingRawTransactions = userDoc.data?.transactions || [];
    if (!Array.isArray(existingRawTransactions))
      throw new Error('Stored transactions must be an array');
    const existingTransactions = toApiTransactions(
      existingRawTransactions,
      session,
      schemaVersion,
      currency,
    );
    if (!existingTransactions.some((transaction) => transaction.id === transactionId)) return false;
    const allTransactions = existingTransactions.filter(
      (transaction) => transaction.id !== transactionId,
    );
    const derived = applyDerivedState(userDoc.data || {}, allTransactions, session, schemaVersion);
    const data = derived.data;
    data.transactions = derived.transactions.map((effectiveTransaction) =>
      encryptTransaction(transactionFromApi(effectiveTransaction, schemaVersion), session),
    );
    try {
      await usersDb.insert({ ...userDoc, data, updatedAt: new Date().toISOString() });
      return true;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(`Could not delete transaction ${transactionId} for ${userId}: CouchDB conflict`);
}

module.exports = {
  listTransactions,
  getTransaction,
  createTransaction,
  copyTransaction,
  updateTransaction,
  deleteTransaction,
  decryptTransaction,
  decodeCursor,
  filterAndSortTransactions,
};
