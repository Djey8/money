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

const {
  parseBucketAllocations,
  parseSettlements,
  fromMinorUnits,
  distributeEvenly,
  bucketCapacity,
} = require('@money/domain');
const {
  createTransaction,
  listTransactions,
  replaceTransactions,
} = require('./transaction-repository');
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

/** Room left in a bucket: a settled bucket's capacity is its actual cost, so it has none. */
function roomLeft(bucket) {
  return Math.max(0, bucketCapacity(bucket) - bucket.amountMinor);
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
    if (bucket.status === 'settled') {
      throw contributionError(
        'FUND_FULL',
        `Bucket "${bucket.title}" is settled (paid ${bucket.settledMinor}); unsettle it first to save more.`,
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

// --- Settling a bucket: the real bill was paid ---------------------------------

/** The transaction that currently settles `bucket` (by its #settle: tag), if any. */
function findSettlement(transactions, project, bucket) {
  return transactions.find(
    (transaction) =>
      transaction.category === `@${project.title}` &&
      parseSettlements(transaction.comment || '').some(
        (settlement) =>
          settlement.bucketTitle.toLocaleLowerCase() === bucket.title.toLocaleLowerCase(),
      ),
  );
}

async function loadBucket(deps, userId, kind, projectId, bucketId) {
  const project = await REPOSITORIES[kind].getProject(deps, userId, projectId);
  if (!project) return null;
  const bucket = project.buckets.find((candidate) => candidate.id === bucketId);
  if (!bucket) {
    throw contributionError(
      'FUND_INVALID_INPUT',
      `Bucket ${bucketId} doesn't exist on "${project.title}".`,
    );
  }
  return { project, bucket };
}

/**
 * Records the settlement of a bucket: one transaction tagged
 * `#settle:<Bucket>:<actual>` whose amount the fund engine sets to the
 * difference against what was saved (top-up negative, surplus released
 * positive, 0 when exact). Settling a settled bucket again edits that same
 * transaction in place. With `surplus.moveToBucketId`, a surplus is moved
 * into another bucket of the project (a matching contribution) instead of
 * being released to the account.
 */
async function settleBucket(deps, userId, kind, projectId, bucketId, input) {
  const found = await loadBucket(deps, userId, kind, projectId, bucketId);
  if (!found) return null;
  const { project, bucket } = found;
  const existing = findSettlement(await allTransactions(deps, userId), project, bucket);
  // What was saved before this settlement: a settled bucket's amount is its
  // previous actual cost, so look at the contributions' total instead.
  // (the existing settlement's amount is -(previous actual - saved)).
  const savedMinor = existing ? bucket.amountMinor + existing.amountMinor : bucket.amountMinor;
  const surplusMinor = Math.max(0, savedMinor - input.actualMinor);

  let moveTo = null;
  if (input.surplus?.moveToBucketId) {
    moveTo = project.buckets.find((candidate) => candidate.id === input.surplus.moveToBucketId);
    if (!moveTo || moveTo.id === bucket.id) {
      throw contributionError(
        'FUND_INVALID_INPUT',
        'surplus.moveToBucketId must be another bucket of this project.',
      );
    }
    if (moveTo.status === 'settled') {
      throw contributionError(
        'FUND_INVALID_INPUT',
        `Bucket "${moveTo.title}" is settled and can't take the surplus.`,
      );
    }
  }

  const when = dateTime(input);
  const account = input.account || existing?.account || DEFAULT_ACCOUNT[kind];
  const settlement = {
    ...(existing && { id: existing.id }),
    account,
    amountMinor: -(input.actualMinor - savedMinor),
    date: input.date || existing?.date || when.date,
    time: input.time || existing?.time || when.time,
    category: `@${project.title}`,
    comment: [
      input.receipt,
      `#settle:${bucket.title}:${fromMinorUnits(input.actualMinor).toFixed(2)}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
  const add = [settlement];
  if (moveTo && surplusMinor > 0) {
    add.push({
      account,
      amountMinor: -surplusMinor,
      date: settlement.date,
      time: settlement.time,
      category: `@${project.title}`,
      comment: `Surplus from ${bucket.title}\n#bucket:${moveTo.title}:${fromMinorUnits(surplusMinor).toFixed(2)}`,
    });
  }
  const { transactions, effects } = await replaceTransactions(deps, userId, {
    removeIds: existing ? [existing.id] : [],
    add,
  });
  const updated = await REPOSITORIES[kind].getProject(deps, userId, projectId);
  return {
    settlement: transactions[0],
    ...(transactions[1] && { surplusContribution: transactions[1] }),
    // Negative: topped up from the account; positive: released back to it.
    differenceMinor: transactions[0].amountMinor,
    bucket: updated.buckets.find((candidate) => candidate.id === bucketId),
    project: updated,
    effects,
  };
}

/** Removes a bucket's settlement; it reopens with the savings it had before. */
async function unsettleBucket(deps, userId, kind, projectId, bucketId) {
  const found = await loadBucket(deps, userId, kind, projectId, bucketId);
  if (!found) return null;
  const { project, bucket } = found;
  const existing = findSettlement(await allTransactions(deps, userId), project, bucket);
  if (!existing) {
    throw contributionError('FUND_INVALID_INPUT', `Bucket "${bucket.title}" isn't settled.`);
  }
  const { effects } = await replaceTransactions(deps, userId, { removeIds: [existing.id] });
  const updated = await REPOSITORIES[kind].getProject(deps, userId, projectId);
  return {
    removedSettlementId: existing.id,
    bucket: updated.buckets.find((candidate) => candidate.id === bucketId),
    project: updated,
    effects,
  };
}

module.exports = {
  settleBucket,
  unsettleBucket,
  contributeToProject,
  contributeToMojo,
  listProjectTransactions,
  listMojoTransactions,
};
