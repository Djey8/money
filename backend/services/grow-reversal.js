'use strict';

/**
 * Undoes the Grow/balance-sheet effect of a transaction that is being
 * deleted (`DELETE /transactions/{id}`, a batch delete, or
 * `DELETE /grow/{id}/transactions/{txId}`), using the domain package's
 * `reverseGrowStatements` — the exact inverse of the typed Grow actions.
 * Without this, deleting a "Buy Share" transaction left the share
 * position, the Grow project and any financing loan inflated forever.
 *
 * Operates on the raw (possibly encrypted) stored user `data` and returns
 * the updated `data`; the caller rebuilds the income statement and fund
 * state from the remaining transactions afterwards, like any other write.
 */

const crypto = require('crypto');
const {
  toMinorUnits,
  isEncryptedValue,
  stateChangingGrowStatements,
  growTitleOfStatements,
  reverseGrowStatements,
} = require('@money/domain');
const { writeValue, toStoredMoney } = require('./transaction-derived-state');

// Local rather than transaction-repository's decryptValue: that module
// requires this one, so importing back would be a require cycle.
function decryptValue(value, session) {
  if (!isEncryptedValue(value)) return value;
  if (!session) throw new Error('Encrypted data requires a configured encryption key');
  return session.decrypt(value);
}

function readMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session) ?? 0) || 0;
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function storeMoney(amountMinor, session, schemaVersion) {
  return writeValue(toStoredMoney(amountMinor, schemaVersion), session);
}

function findByTag(entries, tag, session) {
  return (entries || []).findIndex((raw) => decryptValue(raw.tag, session) === tag);
}

/**
 * Writes `value` back into `entries` for `tag`: removes the entry when
 * `value` is null, updates it in place when it exists, and appends a new
 * one (with a fresh stable id) otherwise.
 */
function putByTag(entries, tag, value, idPrefix, encode, session) {
  const list = entries || [];
  const index = findByTag(list, tag, session);
  if (value === null) return index === -1 ? list : list.filter((_, i) => i !== index);
  const fields = encode(value);
  if (index !== -1) return list.map((raw, i) => (i === index ? { ...raw, ...fields } : raw));
  const id = `${idPrefix}_${crypto.randomUUID()}`;
  return [...list, { id: writeValue(id, session), tag: writeValue(tag, session), ...fields }];
}

function readPair(raw, session, schemaVersion) {
  return raw
    ? {
        amountMinor: readMoney(raw.amount, session, schemaVersion),
        creditMinor: readMoney(raw.credit, session, schemaVersion),
      }
    : null;
}

function snapshotOf(data, rawGrow, title, session, schemaVersion) {
  const asset = data.balance?.asset || {};
  const liabilities = data.balance?.liabilities || [];
  const at = (entries, tag) => {
    const index = findByTag(entries, tag, session);
    return index === -1 ? null : entries[index];
  };
  const assetRaw = at(asset.assets, title);
  const shareRaw = at(asset.shares, title);
  const investmentRaw = at(asset.investments, title);
  const mortgageRaw = at(liabilities, `M-${title}`);
  return {
    growAmountMinor: rawGrow ? readMoney(rawGrow.amount, session, schemaVersion) : 0,
    growShare: rawGrow?.share
      ? {
          quantity: Number(decryptValue(rawGrow.share.quantity, session)) || 0,
          priceMinor: readMoney(rawGrow.share.price, session, schemaVersion),
        }
      : null,
    growInvestment: rawGrow?.investment
      ? {
          depositMinor: readMoney(rawGrow.investment.deposit, session, schemaVersion),
          amountMinor: readMoney(rawGrow.investment.amount, session, schemaVersion),
        }
      : null,
    growLiabilitie: readPair(rawGrow?.liabilitie, session, schemaVersion),
    asset: assetRaw ? { amountMinor: readMoney(assetRaw.amount, session, schemaVersion) } : null,
    share: shareRaw
      ? {
          quantity: Number(decryptValue(shareRaw.quantity, session)) || 0,
          priceMinor: readMoney(shareRaw.price, session, schemaVersion),
        }
      : null,
    investment: investmentRaw
      ? {
          depositMinor: readMoney(investmentRaw.deposit, session, schemaVersion),
          amountMinor: readMoney(investmentRaw.amount, session, schemaVersion),
        }
      : null,
    liability: readPair(at(liabilities, title), session, schemaVersion),
    mortgage: mortgageRaw
      ? { amountMinor: readMoney(mortgageRaw.amount, session, schemaVersion) }
      : null,
  };
}

function writeGrow(rawGrow, next, title, session, schemaVersion) {
  const hasKind = Boolean(
    decryptValue(rawGrow.isAsset, session) === true ||
    decryptValue(rawGrow.isAsset, session) === 'true' ||
    rawGrow.share ||
    rawGrow.investment,
  );
  return {
    ...rawGrow,
    amount: storeMoney(next.growAmountMinor, session, schemaVersion),
    ...(rawGrow.share &&
      next.growShare && {
        share: {
          ...rawGrow.share,
          quantity: writeValue(next.growShare.quantity, session),
          price: storeMoney(next.growShare.priceMinor, session, schemaVersion),
        },
      }),
    ...(rawGrow.investment &&
      next.growInvestment && {
        investment: {
          ...rawGrow.investment,
          deposit: storeMoney(next.growInvestment.depositMinor, session, schemaVersion),
          amount: storeMoney(next.growInvestment.amountMinor, session, schemaVersion),
        },
      }),
    liabilitie: next.growLiabilitie
      ? {
          tag: writeValue(title, session),
          amount: storeMoney(next.growLiabilitie.amountMinor, session, schemaVersion),
          investment: writeValue(hasKind, session),
          credit: storeMoney(next.growLiabilitie.creditMinor, session, schemaVersion),
        }
      : null,
  };
}

function writeBalance(data, next, title, session, schemaVersion) {
  const asset = data.balance?.asset || {};
  const pair = (value) => ({
    amount: storeMoney(value.amountMinor, session, schemaVersion),
    credit: storeMoney(value.creditMinor, session, schemaVersion),
  });
  let liabilities = putByTag(
    data.balance?.liabilities,
    title,
    next.liability,
    'liabilities',
    (v) => ({
      ...pair(v),
      investment: writeValue(true, session),
    }),
    session,
  );
  liabilities = putByTag(
    liabilities,
    `M-${title}`,
    next.mortgage,
    'liabilities',
    (v) => ({
      amount: storeMoney(v.amountMinor, session, schemaVersion),
      credit: storeMoney(0, session, schemaVersion),
      investment: writeValue(true, session),
    }),
    session,
  );
  return {
    ...data.balance,
    asset: {
      ...asset,
      assets: putByTag(
        asset.assets,
        title,
        next.asset,
        'assets',
        (v) => ({
          amount: storeMoney(v.amountMinor, session, schemaVersion),
        }),
        session,
      ),
      shares: putByTag(
        asset.shares,
        title,
        next.share,
        'shares',
        (v) => ({
          quantity: writeValue(v.quantity, session),
          price: storeMoney(v.priceMinor, session, schemaVersion),
        }),
        session,
      ),
      investments: putByTag(
        asset.investments,
        title,
        next.investment,
        'investments',
        (v) => ({
          deposit: storeMoney(v.depositMinor, session, schemaVersion),
          amount: storeMoney(v.amountMinor, session, schemaVersion),
        }),
        session,
      ),
    },
    liabilities,
  };
}

/**
 * @param {object} data raw stored user data
 * @param {object} transaction the API-form transaction being removed
 * @returns {object} `data` with the transaction's Grow effect undone (unchanged for an ordinary transaction)
 * @throws {GrowReversalError} (`code: 'GROW_NOT_REVERSIBLE'`) for a legacy percentage amount it can't undo exactly
 */
function reverseGrowTransaction(data, transaction, session, schemaVersion) {
  const statements = stateChangingGrowStatements(transaction.comment);
  if (statements.length === 0) return data;
  const title =
    growTitleOfStatements(statements) ?? String(transaction.category || '').replace(/^@/, '');

  const rawGrowList = data.grow || [];
  const growIndex = rawGrowList.findIndex((raw) => decryptValue(raw.title, session) === title);
  const rawGrow = growIndex === -1 ? null : rawGrowList[growIndex];

  const next = reverseGrowStatements(
    statements,
    snapshotOf(data, rawGrow, title, session, schemaVersion),
  );
  return {
    ...data,
    balance: writeBalance(data, next, title, session, schemaVersion),
    ...(rawGrow && {
      grow: rawGrowList.map((raw, i) =>
        i === growIndex ? writeGrow(raw, next, title, session, schemaVersion) : raw,
      ),
    }),
  };
}

module.exports = { reverseGrowTransaction };
