'use strict';

/**
 * Carries a Smile/Fire project or bucket rename over to everything that
 * refers to it by name. The fund engine matches contributions by string
 * (fund-state.ts): a transaction counts toward a project when its category
 * is `@<project title>` (Fire also `@<bucket title>`), and `#bucket:<title>:`
 * tags route it to a bucket. A rename that only changed the project would
 * orphan every contribution, and the next rebuild would silently drop the
 * buckets to zero. So a rename also rewrites, for that project only:
 *
 * - transactions and subscriptions: the `@<project>` (and Fire's
 *   `@<bucket>`) category and the `#bucket:` tags in the comment;
 * - the project's own payment plans (see `renamePlan`).
 *
 * The caller rebuilds derived state afterwards (rebuild-derived.js).
 */

const { transactionFromApi, isEncryptedValue } = require('@money/domain');
const { toApiTransactions, encryptTransaction } = require('../repositories/transaction-repository');
const { writeValue } = require('./transaction-derived-state');

function decryptValue(value, session) {
  if (!isEncryptedValue(value)) return value;
  if (!session) throw new Error('Encrypted data requires a configured encryption key');
  return session.decrypt(value);
}

/**
 * Bucket renames by lower-cased old title (tags match bucket titles
 * case-insensitively). A removed bucket (its id gone from `after`) maps to
 * `to: null`: its tags are stripped, so the engine distributes that money
 * under the project's default rule instead of re-capping it to zero.
 */
function bucketRenamesOf(before, after) {
  const renames = new Map();
  for (const bucket of before.buckets) {
    const renamed = after.buckets.find((candidate) => candidate.id === bucket.id);
    if (!renamed || renamed.title !== bucket.title) {
      renames.set(bucket.title.toLocaleLowerCase(), {
        from: bucket.title,
        to: renamed ? renamed.title : null,
      });
    }
  }
  return renames;
}

function renameBucketTags(comment, renames) {
  if (!comment || renames.size === 0) return comment;
  const renamed = comment.replace(/#bucket:([^:]+):([\d.]+)/g, (tag, title, amount) => {
    const rename = renames.get(title.toLocaleLowerCase());
    if (!rename) return tag;
    return rename.to === null ? '' : `#bucket:${rename.to}:${amount}`;
  });
  return renamed === comment ? comment : renamed.replace(/[ \t]{2,}/g, ' ').trim();
}

function createRenamer(kind, before, after) {
  const bucketRenames = bucketRenamesOf(before, after);
  const counts = (category) =>
    category === `@${before.title}` ||
    (kind === 'fire' && before.buckets.some((bucket) => category === `@${bucket.title}`));
  const renameCategory = (category) => {
    if (category === `@${before.title}`) return `@${after.title}`;
    if (kind === 'fire') {
      const rename = [...bucketRenames.values()].find(({ from }) => category === `@${from}`);
      // A removed Fire bucket's own category moves to the fund itself (its first bucket).
      if (rename) return `@${rename.to ?? after.title}`;
    }
    return category;
  };
  return {
    changed: before.title !== after.title || bucketRenames.size > 0,
    /** Renames one `{category, comment}` if it counts toward this project; `null` otherwise. */
    rename(category, comment) {
      if (!counts(category)) return null;
      return {
        category: renameCategory(category),
        comment: renameBucketTags(comment, bucketRenames),
      };
    },
    renameComment: (comment) => renameBucketTags(comment, bucketRenames),
  };
}

/** The project's own payment plan, renamed along with it (the plan stays attached to the project either way). */
function renamePlan(plan, renamer, after) {
  const bucketIds = new Set(after.buckets.map((bucket) => bucket.id));
  return {
    ...plan,
    projectTitle: after.title,
    category: `@${after.title}`,
    comment: renamer.renameComment(plan.comment),
    targetBucketIds: plan.targetBucketIds.filter((id) => bucketIds.has(id)),
  };
}

/**
 * @param {object} before / after — the decrypted project before and after the edit
 * @returns {object} `data` with transactions and subscriptions renamed (unchanged when nothing was renamed)
 */
function cascadeFundRename(data, kind, before, after, session, schemaVersion) {
  const renamer = createRenamer(kind, before, after);
  if (!renamer.changed) return data;
  const currency = data.meta?.currency || 'EUR';

  const transactions = toApiTransactions(data.transactions || [], session, schemaVersion, currency);
  let transactionsChanged = false;
  const renamedTransactions = transactions.map((transaction) => {
    const renamed = renamer.rename(transaction.category, transaction.comment || '');
    if (!renamed) return transaction;
    transactionsChanged = true;
    return { ...transaction, ...renamed };
  });

  const subscriptions = (data.subscriptions || []).map((raw) => {
    const category = decryptValue(raw.category, session);
    const comment = decryptValue(raw.comment, session) || '';
    const renamed = renamer.rename(category, comment);
    if (!renamed) return raw;
    return {
      ...raw,
      category: writeValue(renamed.category, session),
      comment: writeValue(renamed.comment, session),
    };
  });

  return {
    ...data,
    ...(transactionsChanged && {
      transactions: renamedTransactions.map((transaction) =>
        encryptTransaction(transactionFromApi(transaction, schemaVersion), session),
      ),
    }),
    ...(data.subscriptions && { subscriptions }),
  };
}

module.exports = { cascadeFundRename, createRenamer, renamePlan };
