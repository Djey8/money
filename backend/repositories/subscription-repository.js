'use strict';

/**
 * Subscriptions (SUB-1..4) are `{tag-less title, account, amountMinor,
 * startDate, endDate, category, comment, frequency}` recurring-transaction
 * templates. `changeHistory`/`SubscriptionChange` exists on the original
 * `Subscription` interface but is confirmed dead — `add-subscription.component.ts`
 * initializes it to `[]` and nothing anywhere ever pushes to it, on create or
 * edit — so it isn't carried into this API.
 *
 * **`PATCH` cascades a stale-transaction cleanup, with a tighter match than
 * the original.** `info-subscription.component.ts`'s `updateSubscription()`
 * deletes every transaction matching just `account+amount+category` (3
 * fields) whenever almost any field changes — confirmed by reading it
 * directly — which can delete manually-entered transactions that happen to
 * coincide on those three fields alone, with no relation to this
 * subscription. This repository matches on `account+amountMinor+category+comment`
 * instead (the same 4 identifying fields `SubscriptionProcessingService`'s
 * own dedup check uses, minus `date` since every past occurrence should be
 * cleaned up, not just one), meaningfully reducing false-positive deletions.
 * Triggers on the same field list as the original (title/category/amount/
 * account/comment/startDate/frequency — NOT `endDate`, confirmed by reading
 * the exact `if` condition), and only deletes — regeneration stays deferred
 * to an explicit `POST /subscriptions/refresh` call, matching the original's
 * own two-step design (`deleteTransactions()` never regenerates anything
 * itself either).
 *
 * **`DELETE` takes an explicit `deleteTransactions` option** instead of a UI
 * checkbox's implicit state (`InfoSubscriptionComponent.isRefresh`) — same
 * optional behavior, just an explicit parameter.
 *
 * Any transaction-list change here runs through the same `applyDerivedState`
 * recompute every other transaction write goes through, so deleting
 * subscription-generated transactions correctly unwinds their effect on
 * Mojo/Smile/Fire fund state and the Income accounting rebuild.
 */

const crypto = require('crypto');
const { toMinorUnits, transactionFromApi, generateDueSubscriptionTransactions } = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const {
  decryptValue,
  toApiTransactions,
  encryptTransaction,
} = require('./transaction-repository');
const {
  writeValue,
  toStoredMoney,
  applyDerivedState,
  buildDerivedStateContext,
} = require('../services/transaction-derived-state');

const MAX_WRITE_RETRIES = 10;

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptEndDate(raw, session) {
  if (raw === undefined) return null;
  const value = decryptValue(raw, session);
  return value === '' ? null : value;
}

function decryptSubscription(raw, session, schemaVersion) {
  return {
    id: decryptValue(raw.id, session),
    title: decryptValue(raw.title, session),
    account: decryptValue(raw.account, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    startDate: decryptValue(raw.startDate, session),
    endDate: decryptEndDate(raw.endDate, session),
    category: decryptValue(raw.category, session),
    comment: raw.comment !== undefined ? decryptValue(raw.comment, session) : '',
    frequency: decryptValue(raw.frequency, session),
  };
}

function encryptSubscription(subscription, session, schemaVersion) {
  return {
    id: writeValue(subscription.id, session),
    title: writeValue(subscription.title, session),
    account: writeValue(subscription.account, session),
    amount: writeValue(toStoredMoney(subscription.amountMinor, schemaVersion), session),
    startDate: writeValue(subscription.startDate, session),
    endDate: writeValue(subscription.endDate || '', session),
    category: writeValue(subscription.category, session),
    comment: writeValue(subscription.comment || '', session),
    frequency: writeValue(subscription.frequency, session),
  };
}

function assertStableId(rawSubscription) {
  if (rawSubscription.id === undefined) {
    throw new Error(
      'Subscription is missing a stable ID; run mm-admin migrate-balance-entity-ids --collection subscriptions first',
    );
  }
}

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
  return { userDoc, data, session, schemaVersion };
}

function decryptAllSubscriptions(rawSubscriptions, session, schemaVersion) {
  return rawSubscriptions.map((raw) => {
    assertStableId(raw);
    return decryptSubscription(raw, session, schemaVersion);
  });
}

async function listSubscriptions(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const rawSubscriptions = data.subscriptions || [];
  if (!Array.isArray(rawSubscriptions)) throw new Error('Stored subscriptions must be an array');
  return decryptAllSubscriptions(rawSubscriptions, session, schemaVersion);
}

async function getSubscription(deps, userId, subscriptionId) {
  const subscriptions = await listSubscriptions(deps, userId);
  return subscriptions.find((subscription) => subscription.id === subscriptionId) || null;
}

/** Matches `transactionExistsForDate`'s 4 identifying fields (everything but `date`) — see this file's header comment for why it's a tighter match than the original's own PATCH-time cleanup. */
function buildConstructedComment(title, comment) {
  return comment ? `${title} + ${comment}` : title;
}

function deleteMatchingTransactions(subscription, existingTransactions) {
  const constructedComment = buildConstructedComment(subscription.title, subscription.comment);
  return existingTransactions.filter(
    (transaction) =>
      !(
        transaction.account === subscription.account &&
        transaction.amountMinor === subscription.amountMinor &&
        transaction.category === subscription.category &&
        transaction.comment === constructedComment
      ),
  );
}

/**
 * Shared read → mutate → write-with-retry-on-409 loop. `mutate` receives the
 * still-encrypted `rawSubscriptions` plus the full `data` document (needed
 * to reach `data.transactions` for the PATCH/DELETE cascade) and returns one
 * of:
 * - `null` — nothing to do (e.g. the target id doesn't exist); no write happens.
 * - `{ skipWrite: true, result }` — a no-op outcome (e.g. a refresh that had
 *   nothing due); no write happens, `result` is returned as-is.
 * - `{ updatedData, result }` — the new full data document to persist.
 *   `mutate` builds `updatedData` itself (rather than this loop assembling it
 *   from named parts) since a cascade needs to overlay
 *   `subscriptions`/`transactions` on top of `applyDerivedState`'s own full
 *   data patch, not just `data`.
 */
async function withSubscriptionsWrite({ usersDb, authDb }, userId, mutate) {
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
    const data = userDoc.data || {};
    const session = await getEncryptionSession(authDb, userId);
    const schemaVersion = data.meta?.schemaVersion || 1;
    const currency = data.meta?.currency || 'EUR';
    const rawSubscriptions = data.subscriptions || [];
    if (!Array.isArray(rawSubscriptions)) throw new Error('Stored subscriptions must be an array');

    const mutation = mutate({ data, rawSubscriptions, session, schemaVersion, currency });
    if (mutation === null) return null;
    if (mutation.skipWrite) return mutation.result;
    const { updatedData, result } = mutation;
    const now = new Date().toISOString();
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: now });
      return result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write subscriptions after maximum retries due to write conflicts');
}

async function createSubscription(deps, userId, input) {
  return withSubscriptionsWrite(deps, userId, ({ data, rawSubscriptions, session, schemaVersion }) => {
    const newSubscription = {
      id: `subscriptions_${crypto.randomUUID()}`,
      title: input.title || '',
      account: input.account,
      amountMinor: input.amountMinor,
      startDate: input.startDate,
      endDate: input.endDate || null,
      category: input.category,
      comment: input.comment || '',
      frequency: input.frequency || 'monthly',
    };
    return {
      updatedData: {
        ...data,
        subscriptions: [...rawSubscriptions, encryptSubscription(newSubscription, session, schemaVersion)],
      },
      result: newSubscription,
    };
  });
}

const TRIGGER_FIELDS = [
  'title',
  'category',
  'amountMinor',
  'account',
  'comment',
  'startDate',
  'frequency',
];

async function updateSubscription(deps, userId, subscriptionId, patch) {
  return withSubscriptionsWrite(
    deps,
    userId,
    ({ data, rawSubscriptions, session, schemaVersion, currency }) => {
      const existing = decryptAllSubscriptions(rawSubscriptions, session, schemaVersion);
      const index = existing.findIndex((subscription) => subscription.id === subscriptionId);
      if (index === -1) return null;
      const current = existing[index];
      const updated = { ...current, ...patch };

      const updatedRawSubscriptions = rawSubscriptions.map((raw, i) =>
        i === index ? encryptSubscription(updated, session, schemaVersion) : raw,
      );

      const triggersCleanup = TRIGGER_FIELDS.some(
        (field) => patch[field] !== undefined && patch[field] !== current[field],
      );
      if (!triggersCleanup) {
        return {
          updatedData: { ...data, subscriptions: updatedRawSubscriptions },
          result: updated,
        };
      }

      const rawTransactions = data.transactions || [];
      const existingTransactions = toApiTransactions(
        rawTransactions,
        session,
        schemaVersion,
        currency,
      );
      const remainingTransactions = deleteMatchingTransactions(current, existingTransactions);
      if (remainingTransactions.length === existingTransactions.length) {
        return {
          updatedData: { ...data, subscriptions: updatedRawSubscriptions },
          result: updated,
        };
      }

      const derived = applyDerivedState(data, remainingTransactions, session, schemaVersion);
      const updatedRawTransactions = derived.transactions.map((effective) =>
        encryptTransaction(transactionFromApi(effective, schemaVersion), session),
      );
      return {
        updatedData: {
          ...derived.data,
          subscriptions: updatedRawSubscriptions,
          transactions: updatedRawTransactions,
        },
        result: updated,
      };
    },
  );
}

async function deleteSubscription(deps, userId, subscriptionId, { deleteTransactions = false } = {}) {
  return withSubscriptionsWrite(
    deps,
    userId,
    ({ data, rawSubscriptions, session, schemaVersion, currency }) => {
      const existing = decryptAllSubscriptions(rawSubscriptions, session, schemaVersion);
      const index = existing.findIndex((subscription) => subscription.id === subscriptionId);
      if (index === -1) return null;
      const current = existing[index];
      const updatedRawSubscriptions = rawSubscriptions.filter((_, i) => i !== index);

      if (!deleteTransactions) {
        return {
          updatedData: { ...data, subscriptions: updatedRawSubscriptions },
          result: { id: subscriptionId },
        };
      }

      const rawTransactions = data.transactions || [];
      const existingTransactions = toApiTransactions(
        rawTransactions,
        session,
        schemaVersion,
        currency,
      );
      const remainingTransactions = deleteMatchingTransactions(current, existingTransactions);
      if (remainingTransactions.length === existingTransactions.length) {
        return {
          updatedData: { ...data, subscriptions: updatedRawSubscriptions },
          result: { id: subscriptionId },
        };
      }

      const derived = applyDerivedState(data, remainingTransactions, session, schemaVersion);
      const updatedRawTransactions = derived.transactions.map((effective) =>
        encryptTransaction(transactionFromApi(effective, schemaVersion), session),
      );
      return {
        updatedData: {
          ...derived.data,
          subscriptions: updatedRawSubscriptions,
          transactions: updatedRawTransactions,
        },
        result: { id: subscriptionId },
      };
    },
  );
}

/**
 * `POST /subscriptions/refresh` — generates whatever transactions are due
 * from active subscriptions and haven't already been generated
 * (`generateDueSubscriptionTransactions`, `packages/domain/src/transactions/
 * subscription-generation.ts`), then appends them in the same write every
 * other transaction mutation goes through (`applyDerivedState`), so Mojo/
 * Smile/Fire fund state and the Income accounting rebuild reflect the new
 * transactions atomically alongside them — an improvement over the original
 * app's per-transaction sequential persistence.
 */
async function refreshSubscriptions(deps, userId, { now = new Date() } = {}) {
  return withSubscriptionsWrite(
    deps,
    userId,
    ({ data, rawSubscriptions, session, schemaVersion, currency }) => {
      const subscriptions = decryptAllSubscriptions(rawSubscriptions, session, schemaVersion);
      const rawTransactions = data.transactions || [];
      const existingTransactions = toApiTransactions(
        rawTransactions,
        session,
        schemaVersion,
        currency,
      );
      const fundState = buildDerivedStateContext(data, session, schemaVersion).funds;
      const generation = generateDueSubscriptionTransactions(
        subscriptions,
        existingTransactions,
        fundState,
        now,
      );
      const result = {
        transactionsCreated: generation.transactionsCreated,
        subscriptionsProcessed: generation.subscriptionsProcessed,
      };
      if (generation.transactionsCreated === 0) {
        return { skipWrite: true, result };
      }

      const newTransactions = generation.transactions.map((transaction) => ({
        ...transaction,
        id: `tx_${crypto.randomUUID()}`,
        currency,
      }));
      const derived = applyDerivedState(
        data,
        [...existingTransactions, ...newTransactions],
        session,
        schemaVersion,
      );
      const updatedRawTransactions = derived.transactions.map((effective) =>
        encryptTransaction(transactionFromApi(effective, schemaVersion), session),
      );
      return {
        updatedData: { ...derived.data, transactions: updatedRawTransactions },
        result,
      };
    },
  );
}

module.exports = {
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  refreshSubscriptions,
  // Internals re-exported for the batch/export/import modules.
  decryptMoney,
  decryptSubscription,
  encryptSubscription,
  decryptAllSubscriptions,
  assertStableId,
  loadUserData,
  withSubscriptionsWrite,
  buildConstructedComment,
  MAX_WRITE_RETRIES,
};
