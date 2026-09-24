'use strict';

/**
 * Putting money into a Smile project, Fire fund, or Mojo — the only way a
 * bucket/Mojo amount ever changes, since those amounts are rebuilt from
 * transactions on every write (services/rebuild-derived.js).
 *
 * A contribution is one transaction in the app's own convention (the same
 * shape an activated payment plan's subscription generates —
 * subscription-activation.service.ts): money leaves `account`, so the
 * amount is negative; the category is `@<project>` (or `@Mojo`); and a
 * split across chosen buckets is written as `#bucket:<Title>:<amount>`
 * tags. The server writes those tags, so agents never hand-write them.
 * It goes through the ordinary transaction write, which caps it at the
 * room left and reports `effects`.
 */

const { parseBucketAllocations, fromMinorUnits, distributeEvenly } = require('@money/domain');
const { createTransaction, listTransactions } = require('./transaction-repository');
const smile = require('./smile-repository');
const fire = require('./fire-repository');

const REPOSITORIES = { smile: smile.repository, fire: fire.repository };
const DEFAULT_ACCOUNT = { smile: 'Smile', fire: 'Fire', mojo: 'Fire' };

function contributionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

function dateTime(input) {
  const defaults = today();
  return { date: input.date || defaults.date, time: input.time || defaults.time };
}

function roomLeft(bucket) {
  return Math.max(0, bucket.targetMinor - bucket.amountMinor);
}

function tagsFor(buckets, amountsById) {
  return buckets
    .filter((bucket) => (amountsById.get(bucket.id) || 0) > 0)
    .map(
      (bucket) =>
        `#bucket:${bucket.title}:${fromMinorUnits(amountsById.get(bucket.id)).toFixed(2)}`,
    )
    .join(' ');
}

/**
 * Resolves the requested split to `{totalMinor, tags}`.
 *
 * Without `buckets`, the engine's default applies — but for Smile it's
 * computed now and written as explicit tags: an untagged Smile
 * contribution is re-split across whatever buckets exist each time amounts
 * are rebuilt, so adding a bucket later would silently move money that was
 * already saved. Fire's default (the first bucket) doesn't shift, so it
 * stays untagged, exactly like the app writes it.
 */
function resolveSplit(kind, project, input) {
  if (!input.buckets || input.buckets.length === 0) {
    const room = project.buckets.reduce((sum, bucket) => sum + roomLeft(bucket), 0);
    if (room === 0) {
      throw contributionError('FUND_FULL', `Every bucket of "${project.title}" is already full.`);
    }
    if (kind === 'fire') return { totalMinor: input.amountMinor, tags: '' };
    const split = distributeEvenly(project.buckets, input.amountMinor);
    const applied = new Map(
      split.map((bucket, index) => [
        bucket.id,
        bucket.amountMinor - project.buckets[index].amountMinor,
      ]),
    );
    return { totalMinor: input.amountMinor, tags: tagsFor(project.buckets, applied) };
  }
  const tags = [];
  let totalMinor = 0;
  for (const { bucketId, amountMinor } of input.buckets) {
    const bucket = project.buckets.find((candidate) => candidate.id === bucketId);
    if (!bucket) {
      throw contributionError(
        'FUND_INVALID_INPUT',
        `Bucket ${bucketId} doesn't exist on "${project.title}".`,
      );
    }
    if (roomLeft(bucket) === 0) {
      throw contributionError('FUND_FULL', `Bucket "${bucket.title}" is already full.`);
    }
    tags.push(`#bucket:${bucket.title}:${fromMinorUnits(amountMinor).toFixed(2)}`);
    totalMinor += amountMinor;
  }
  if (input.amountMinor !== undefined && input.amountMinor !== totalMinor) {
    throw contributionError(
      'FUND_INVALID_INPUT',
      `amountMinor (${input.amountMinor}) must equal the sum of the bucket amounts (${totalMinor}), or be omitted.`,
    );
  }
  return { totalMinor, tags: tags.join(' ') };
}

async function contributeToProject(deps, userId, kind, projectId, input) {
  const repository = REPOSITORIES[kind];
  const project = await repository.getProject(deps, userId, projectId);
  if (!project) return null;
  const { totalMinor, tags } = resolveSplit(kind, project, input);
  const transaction = await createTransaction(deps, userId, {
    account: input.account || DEFAULT_ACCOUNT[kind],
    amountMinor: -totalMinor,
    ...dateTime(input),
    category: `@${project.title}`,
    comment: [input.comment, tags].filter(Boolean).join('\n'),
  });
  const { effects, ...stored } = transaction;
  return {
    transaction: stored,
    requestedMinor: totalMinor,
    // The fund engine caps a contribution at the room left, rewriting the stored amount.
    appliedMinor: Math.abs(stored.amountMinor),
    project: await repository.getProject(deps, userId, projectId),
    effects,
  };
}

async function contributeToMojo(deps, userId, input) {
  const transaction = await createTransaction(deps, userId, {
    account: input.account || DEFAULT_ACCOUNT.mojo,
    amountMinor: -input.amountMinor,
    ...dateTime(input),
    category: '@Mojo',
    comment: input.comment || '',
  });
  const { effects, ...stored } = transaction;
  return { transaction: stored, requestedMinor: input.amountMinor, effects };
}

async function allTransactions(deps, userId) {
  const { transactions } = await listTransactions(deps, userId, {
    limit: Number.MAX_SAFE_INTEGER,
    order: 'asc',
  });
  return transactions;
}

/** Which transactions the fund engine counts toward a project (fund-state.ts). */
function countsToward(kind, project, category) {
  if (category === `@${project.title}`) return true;
  return kind === 'fire' && project.buckets.some((bucket) => category === `@${bucket.title}`);
}

async function listProjectTransactions(deps, userId, kind, projectId) {
  const project = await REPOSITORIES[kind].getProject(deps, userId, projectId);
  if (!project) return null;
  return (await allTransactions(deps, userId))
    .filter((transaction) => countsToward(kind, project, transaction.category))
    .map((transaction) => ({
      ...transaction,
      bucketAllocations: parseBucketAllocations(transaction.comment || ''),
    }));
}

async function listMojoTransactions(deps, userId) {
  return (await allTransactions(deps, userId)).filter(
    (transaction) => transaction.category === '@Mojo' || transaction.account === 'Mojo',
  );
}

module.exports = {
  contributeToProject,
  contributeToMojo,
  listProjectTransactions,
  listMojoTransactions,
};
