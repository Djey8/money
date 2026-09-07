'use strict';

const {
  computeIncomeStatement,
  computeCashflow,
  computeBalanceSheet,
  getPeriodRange,
  toMinorUnits,
  MONEY_FIELD_NAMES,
} = require('@money/domain');
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
 * Shared load step for every report endpoint: the caller's user document,
 * decryption session, and schema version. 404 (no document yet) resolves to
 * an empty `data: {}` rather than throwing, so every report degrades to an
 * all-zero result for a brand-new user instead of erroring.
 */
async function loadUserData({ usersDb, authDb }, userId) {
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
  return { data, session, schemaVersion };
}

/**
 * Adds the caller's decrypted transactions and the current/previous period
 * boundaries on top of `loadUserData`. `now` is an injectable "today" for
 * tests — production callers omit it so `getPeriodRange` defaults to the
 * real current time.
 * @param {{period: string, offset: number, now?: Date}} options
 */
async function loadPeriodTransactions(deps, userId, { period, offset, now }) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const currency = data.meta?.currency || 'EUR';
  const rawTransactions = data.transactions || [];
  if (!Array.isArray(rawTransactions)) throw new Error('Stored transactions must be an array');

  const transactions = toApiTransactions(rawTransactions, session, schemaVersion, currency);
  const currentRange = getPeriodRange(period, offset, now);
  const previousRange = getPeriodRange(period, offset - 1, now);
  return { data, session, transactions, currentRange, previousRange };
}

/**
 * Decrypts one balance-sheet entry field-by-field and normalizes its money
 * fields (per the domain package's own canonical `MONEY_FIELD_NAMES`, the
 * same list `mm-admin migrate` uses) to integer minor units — the same
 * per-field encryption and schema-version handling `toApiTransactions`
 * applies to transactions, ported here since assets/shares/investments/
 * properties/liabilities are encrypted and schema-versioned the same way
 * but aren't transactions. Reusing the canonical list (rather than a
 * hand-picked subset of just the fields this endpoint happens to read) means
 * a field like `Liability.credit` converts correctly the moment some future
 * endpoint starts reading it too, instead of silently staying a raw decimal.
 */
function decryptEntry(entry, session, schemaVersion) {
  const result = {};
  for (const [key, value] of Object.entries(entry)) {
    const decrypted = decryptValue(value, session);
    if (MONEY_FIELD_NAMES.has(key)) {
      const numeric = Number(decrypted);
      result[key] = schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
    } else if (key === 'quantity') {
      result[key] = Number(decrypted);
    } else {
      result[key] = decrypted;
    }
  }
  return result;
}

async function getIncomeStatement(deps, userId, options) {
  const { data, session, transactions, currentRange, previousRange } = await loadPeriodTransactions(
    deps,
    userId,
    options,
  );
  const tags = loadIncomeClassificationTags(data, session);
  const statement = computeIncomeStatement(transactions, currentRange, previousRange, tags);
  return { period: currentRange, previousPeriod: previousRange, ...statement };
}

async function getCashflow(deps, userId, options) {
  const { transactions, currentRange, previousRange } = await loadPeriodTransactions(
    deps,
    userId,
    options,
  );
  const statement = computeCashflow(transactions, currentRange, previousRange);
  return { period: currentRange, previousPeriod: previousRange, ...statement };
}

/**
 * `GET /reports/balance-sheet` is a current snapshot, not period-scoped —
 * unlike income-statement/cashflow it takes no `period`/`offset`, matching
 * the original `computeBalanceSheet`'s own signature.
 */
async function getBalanceSheet(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const decryptEntries = (entries) =>
    (entries || []).map((entry) => decryptEntry(entry, session, schemaVersion));

  const assets = decryptEntries(data.balance?.asset?.assets).map((e) => ({
    amountMinor: e.amount || 0,
  }));
  const shares = decryptEntries(data.balance?.asset?.shares).map((e) => ({
    quantity: e.quantity || 0,
    priceMinor: e.price || 0,
  }));
  const investments = decryptEntries(data.balance?.asset?.investments).map((e) => ({
    amountMinor: e.amount || 0,
    depositMinor: e.deposit || 0,
  }));
  const properties = decryptEntries(data.income?.revenue?.properties).map((e) => ({
    amountMinor: e.amount || 0,
  }));
  const liabilities = decryptEntries(data.balance?.liabilities).map((e) => ({
    amountMinor: e.amount || 0,
  }));

  return computeBalanceSheet({ assets, shares, investments, properties, liabilities });
}

module.exports = {
  getIncomeStatement,
  getCashflow,
  getBalanceSheet,
  loadIncomeClassificationTags,
};
