'use strict';

/**
 * Carries a Grow project's rename over to everything linked to it by its
 * title — there are no foreign keys, only string matches (CLAUDE.md's
 * "entities are keyed by string" note), so a rename that only changed the
 * project would silently orphan all of it:
 *
 * - balance sheet: the Asset/Share/Investment tagged with the title, the
 *   financing Liability tagged with the title, and an Investment's
 *   `M-<title>` mortgage Liability;
 * - transactions: an `@<title>` category (matched case-insensitively, like
 *   the app) and the title inside Grow statements in the comment
 *   (`Buy Share <title> 10 x 25;`) — the app reads it back from there to
 *   undo a transaction;
 * - subscriptions whose category is `@<title>`, so future generated
 *   transactions stay linked;
 * - everything derived from transactions (income statement, Smile/Fire
 *   fund state), recomputed from the renamed transactions against the
 *   renamed balance sheet, exactly like any other transaction write.
 *
 * Pure with respect to storage: takes the decrypted-on-demand user `data`
 * and returns the updated `data` (grow excluded — the caller owns that).
 */

const { transactionFromApi, renameGrowTitleInComment } = require('@money/domain');
const {
  decryptValue,
  toApiTransactions,
  encryptTransaction,
} = require('../repositories/transaction-repository');
const { writeValue, applyDerivedState } = require('./transaction-derived-state');

function renameError(message) {
  const error = new Error(message);
  error.code = 'GROW_DUPLICATE_TITLE';
  return error;
}

function renameTags(rawEntries, renames, session) {
  return (rawEntries || []).map((raw) => {
    const tag = decryptValue(raw.tag, session);
    return renames.has(tag) ? { ...raw, tag: writeValue(renames.get(tag), session) } : raw;
  });
}

function hasTag(rawEntries, tag, session) {
  return (rawEntries || []).some((raw) => decryptValue(raw.tag, session) === tag);
}

/**
 * The new title must not land on a balance-sheet tag that already exists —
 * that entry either belongs to something else, or renaming would silently
 * merge two positions into one.
 */
function assertNoTagCollision(data, newTitle, session) {
  const asset = data.balance?.asset || {};
  const liabilities = data.balance?.liabilities || [];
  const targets = [
    [asset.assets, newTitle],
    [asset.shares, newTitle],
    [asset.investments, newTitle],
    [liabilities, newTitle],
    [liabilities, `M-${newTitle}`],
  ];
  for (const [entries, target] of targets) {
    if (hasTag(entries, target, session)) {
      throw renameError(
        `The balance sheet already has an entry tagged "${target}"; rename or remove it first.`,
      );
    }
  }
}

function isCategoryFor(category, title) {
  return (
    typeof category === 'string' && category.toLocaleLowerCase() === `@${title}`.toLocaleLowerCase()
  );
}

function renameBalance(data, oldTitle, newTitle, session) {
  const renames = new Map([[oldTitle, newTitle]]);
  const liabilityRenames = new Map([
    [oldTitle, newTitle],
    [`M-${oldTitle}`, `M-${newTitle}`],
  ]);
  const asset = data.balance?.asset || {};
  return {
    ...data.balance,
    asset: {
      ...asset,
      assets: renameTags(asset.assets, renames, session),
      shares: renameTags(asset.shares, renames, session),
      investments: renameTags(asset.investments, renames, session),
    },
    liabilities: renameTags(data.balance?.liabilities, liabilityRenames, session),
  };
}

function renameSubscriptions(rawSubscriptions, oldTitle, newTitle, session) {
  return (rawSubscriptions || []).map((raw) =>
    isCategoryFor(decryptValue(raw.category, session), oldTitle)
      ? { ...raw, category: writeValue(`@${newTitle}`, session) }
      : raw,
  );
}

/** @returns {object} the updated user `data` (everything except `data.grow`) */
function cascadeGrowRename(data, oldTitle, newTitle, session, schemaVersion) {
  if (oldTitle === newTitle) return data;
  assertNoTagCollision(data, newTitle, session);

  const currency = data.meta?.currency || 'EUR';
  const withBalance = {
    ...data,
    balance: renameBalance(data, oldTitle, newTitle, session),
    ...(data.subscriptions && {
      subscriptions: renameSubscriptions(data.subscriptions, oldTitle, newTitle, session),
    }),
  };

  const transactions = toApiTransactions(data.transactions || [], session, schemaVersion, currency);
  const renamed = transactions.map((transaction) => ({
    ...transaction,
    category: isCategoryFor(transaction.category, oldTitle) ? `@${newTitle}` : transaction.category,
    comment: renameGrowTitleInComment(transaction.comment || '', oldTitle, newTitle),
  }));
  const derived = applyDerivedState(withBalance, renamed, session, schemaVersion);
  return {
    ...derived.data,
    transactions: derived.transactions.map((effective) =>
      encryptTransaction(transactionFromApi(effective, schemaVersion), session),
    ),
  };
}

module.exports = { cascadeGrowRename };
