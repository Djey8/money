'use strict';

const { isEncryptedValue, transactionToApi } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');

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
  const apiTransactions = transactions.map((transaction) =>
    transactionToApi(decryptTransaction(transaction, session), schemaVersion, currency, () => {
      throw new Error(
        'Transaction is missing a stable ID; run mm-admin migrate-transaction-ids first',
      );
    }),
  );
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

module.exports = {
  listTransactions,
  getTransaction,
  decryptTransaction,
  decodeCursor,
  filterAndSortTransactions,
};
