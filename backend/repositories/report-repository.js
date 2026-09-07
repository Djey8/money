'use strict';

const { computeIncomeStatement, getPeriodRange } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { decryptValue, toApiTransactions } = require('./transaction-repository');

/**
 * Loads the tag lists `computeIncomeStatement` needs to classify Income-account
 * transactions the same way `statement-calculations.ts`'s `classifyIncome`
 * does (see packages/domain/src/reports/income-statement.ts's own doc for why
 * this is a different, dedicated set of tags from Slice 1's accounting.ts).
 */
function loadIncomeClassificationTags(data, session) {
  const decryptTag = (entry) => decryptValue(entry.tag, session);
  return {
    interestTags: (data.income?.revenue?.interests || []).map(decryptTag),
    shareTags: (data.balance?.asset?.shares || []).map(decryptTag),
    propertyTags: (data.income?.revenue?.properties || []).map(decryptTag),
    investmentTags: (data.balance?.asset?.investments || []).map(decryptTag),
  };
}

/**
 * @param {{period: string, offset: number, now?: Date}} options `now` is an
 *   injectable "today" for tests — production callers omit it so
 *   `getPeriodRange` defaults to the real current time.
 */
async function getIncomeStatement({ usersDb, authDb }, userId, { period, offset, now }) {
  let userDoc;
  try {
    userDoc = await usersDb.get(userId);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    userDoc = { data: {} };
  }
  const data = userDoc.data || {};
  const session = await getEncryptionSession(authDb, userId);
  const schemaVersion = data.meta?.schemaVersion || 1;
  const currency = data.meta?.currency || 'EUR';
  const rawTransactions = data.transactions || [];
  if (!Array.isArray(rawTransactions)) throw new Error('Stored transactions must be an array');

  const transactions = toApiTransactions(rawTransactions, session, schemaVersion, currency);
  const tags = loadIncomeClassificationTags(data, session);
  const currentRange = getPeriodRange(period, offset, now);
  const previousRange = getPeriodRange(period, offset - 1, now);
  const statement = computeIncomeStatement(transactions, currentRange, previousRange, tags);

  return { period: currentRange, previousPeriod: previousRange, ...statement };
}

module.exports = { getIncomeStatement, loadIncomeClassificationTags };
