'use strict';

/**
 * Recurring transfers: "move 50 EUR into the shared account every week", stored at `data.recurringTransfers`
 * (todo/locations.md section 19).
 *
 * A recurring transfer is NOT a subscription. It is its own list, so nothing that reads subscriptions as income or
 * expense (budget, plans, charts, exports) can see it, and it only ever generates TRANSFERS (`data.transfers`),
 * never transactions - Cashflow cannot change. It reuses the subscription engine for the shared parts (occurrence
 * dates, recognising what it generated, editing in place) through `@money/domain`'s recurring-transfers adapter.
 *
 * Every write is one document insert that stores the rule, the transfers it generated or changed, and the two
 * location balances each of those moved, so they can never disagree.
 */

const crypto = require('crypto');
const {
  generateDueTransfers,
  reconcileGeneratedTransfers,
  toMinorUnits,
} = require('@money/domain');
const { getEncryptionSession } = require('../services/encryption-session');
const { applyTransferDeltas } = require('../services/location-balance');
const { writeValue, toStoredMoney } = require('../services/transaction-derived-state');
const {
  decryptValue,
  readLocationIds,
  locationNotFoundError,
} = require('./transaction-repository');
const { decryptAllTransfers, encryptTransfer } = require('./transfer-repository');

const MAX_WRITE_RETRIES = 10;
const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

function ruleError(message) {
  const error = new Error(message);
  error.code = 'TRANSFER_INVALID';
  return error;
}

function decryptMoney(value, session, schemaVersion) {
  const numeric = Number(decryptValue(value, session));
  return schemaVersion >= 2 ? numeric : toMinorUnits(numeric);
}

function decryptRule(raw, session, schemaVersion) {
  const endDate = raw.endDate === undefined ? '' : decryptValue(raw.endDate, session);
  return {
    id: decryptValue(raw.id, session),
    title: raw.title === undefined ? '' : decryptValue(raw.title, session),
    fromLocationId: decryptValue(raw.fromLocationId, session),
    toLocationId: decryptValue(raw.toLocationId, session),
    amountMinor: decryptMoney(raw.amount, session, schemaVersion),
    startDate: decryptValue(raw.startDate, session),
    endDate: endDate === '' ? null : endDate,
    frequency: decryptValue(raw.frequency, session),
    comment: raw.comment === undefined ? '' : decryptValue(raw.comment, session),
  };
}

function encryptRule(rule, session, schemaVersion) {
  return {
    id: writeValue(rule.id, session),
    title: writeValue(rule.title || '', session),
    fromLocationId: writeValue(rule.fromLocationId, session),
    toLocationId: writeValue(rule.toLocationId, session),
    amount: writeValue(toStoredMoney(rule.amountMinor, schemaVersion), session),
    startDate: writeValue(rule.startDate, session),
    endDate: writeValue(rule.endDate || '', session),
    frequency: writeValue(rule.frequency, session),
    comment: writeValue(rule.comment || '', session),
  };
}

function decryptAllRules(rawRules, session, schemaVersion) {
  return rawRules.map((raw) => {
    if (raw.id === undefined) throw new Error('Recurring transfer is missing a stable ID');
    return decryptRule(raw, session, schemaVersion);
  });
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
  return { data, session, schemaVersion };
}

async function listRecurringTransfers(deps, userId) {
  const { data, session, schemaVersion } = await loadUserData(deps, userId);
  const raw = data.recurringTransfers || [];
  if (!Array.isArray(raw)) throw new Error('Stored recurring transfers must be an array');
  return decryptAllRules(raw, session, schemaVersion);
}

async function getRecurringTransfer(deps, userId, ruleId) {
  const rules = await listRecurringTransfers(deps, userId);
  return rules.find((rule) => rule.id === ruleId) || null;
}

/** A rule needs two different, existing locations (an unchanged end that has since vanished is tolerated). */
function assertRule(data, session, rule, current) {
  const known = readLocationIds(data, session);
  for (const field of ['fromLocationId', 'toLocationId']) {
    if (!rule[field]) throw ruleError(`${field} is required.`);
    if (!known.has(rule[field]) && current?.[field] !== rule[field]) {
      throw locationNotFoundError(rule[field]);
    }
  }
  if (rule.fromLocationId === rule.toLocationId) {
    throw ruleError('A transfer needs two different locations.');
  }
  if (!FREQUENCIES.includes(rule.frequency)) throw ruleError('Invalid frequency.');
  if (rule.endDate && rule.endDate < rule.startDate) {
    throw ruleError('endDate cannot be before startDate.');
  }
}

/** Presents a stored transfer list (API shape) to the engine: it only needs these fields. */
const forEngine = (transfers) => transfers.map((t) => ({ ...t }));

const newTransferFrom = (generated) => ({
  id: `xfer_${crypto.randomUUID()}`,
  fromLocationId: generated.fromLocationId,
  toLocationId: generated.toLocationId,
  amountMinor: generated.amountMinor,
  date: generated.date,
  time: generated.time,
  comment: generated.comment,
});

/**
 * Read -> mutate -> write-with-retry-on-409. `mutate` gets `{ data, session, schemaVersion, rules, transfers }`
 * (decrypted, API shape) and returns `null` (nothing to do) or `{ rules, transfers, result }` - the full new lists.
 * The balances follow from the difference between the old and the new transfer lists.
 */
async function withRecurringWrite({ usersDb, authDb }, userId, mutate) {
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
    const rawRules = data.recurringTransfers || [];
    const rawTransfers = data.transfers || [];
    if (!Array.isArray(rawRules)) throw new Error('Stored recurring transfers must be an array');
    if (!Array.isArray(rawTransfers)) throw new Error('Stored transfers must be an array');
    const rules = decryptAllRules(rawRules, session, schemaVersion);
    const transfers = decryptAllTransfers(rawTransfers, session, schemaVersion);

    const mutation = mutate({ data, session, schemaVersion, rules, transfers });
    if (mutation === null) return null;
    if (mutation.skipWrite) return mutation.result;

    // Keep an untouched transfer's stored form as it is (no needless re-encryption).
    const before = new Map(transfers.map((t, i) => [t.id, { json: JSON.stringify(t), i }]));
    const nextRaw = mutation.transfers.map((t) => {
      const old = before.get(t.id);
      return old && old.json === JSON.stringify(t)
        ? rawTransfers[old.i]
        : encryptTransfer(t, session, schemaVersion);
    });
    const withLists = {
      ...data,
      recurringTransfers: mutation.rules.map((rule) => encryptRule(rule, session, schemaVersion)),
      transfers: nextRaw,
    };
    const updatedData = applyTransferDeltas(
      withLists,
      transfers,
      mutation.transfers,
      session,
      schemaVersion,
    );
    try {
      await usersDb.insert({ ...userDoc, data: updatedData, updatedAt: new Date().toISOString() });
      return mutation.result;
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error('Failed to write recurring transfers after maximum retries');
}

/** Applies a reconciliation (in-place updates and removals) to a transfer list. */
function applyReconciliation(transfers, { updates, removals }) {
  const removed = new Set(removals);
  const updateOf = new Map(updates.map((update) => [update.index, update]));
  return transfers.flatMap((transfer, index) => {
    if (removed.has(index)) return [];
    const update = updateOf.get(index);
    if (!update) return [transfer];
    const { index: _index, ...changes } = update;
    return [{ ...transfer, ...changes }];
  });
}

async function createRecurringTransfer(deps, userId, input, { now = new Date() } = {}) {
  return withRecurringWrite(deps, userId, ({ data, session, rules, transfers }) => {
    const rule = {
      id: `rtransfer_${crypto.randomUUID()}`,
      title: input.title || '',
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      amountMinor: input.amountMinor,
      startDate: input.startDate,
      endDate: input.endDate || null,
      frequency: input.frequency || 'monthly',
      comment: input.comment || '',
    };
    assertRule(data, session, rule);
    const due = generateDueTransfers([rule], forEngine(transfers), now).map(newTransferFrom);
    return {
      rules: [...rules, rule],
      transfers: [...transfers, ...due],
      result: { ...rule, transfersCreated: due.length },
    };
  });
}

async function updateRecurringTransfer(deps, userId, ruleId, patch, { now = new Date() } = {}) {
  return withRecurringWrite(deps, userId, ({ data, session, rules, transfers }) => {
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) return null;
    const current = rules[index];
    const updated = { ...current, ...patch };
    if ('endDate' in patch) updated.endDate = patch.endDate || null;
    assertRule(data, session, updated, current);

    // What the old rule generated follows the new one; then whatever is due and missing is generated.
    const reconciled = applyReconciliation(
      transfers,
      reconcileGeneratedTransfers(current, updated, forEngine(transfers), now),
    );
    const due = generateDueTransfers([updated], forEngine(reconciled), now).map(newTransferFrom);
    return {
      rules: rules.map((rule, i) => (i === index ? updated : rule)),
      transfers: [...reconciled, ...due],
      result: { ...updated, transfersCreated: due.length },
    };
  });
}

async function deleteRecurringTransfer(
  deps,
  userId,
  ruleId,
  { deleteTransfers = false, now = new Date() } = {},
) {
  return withRecurringWrite(deps, userId, ({ rules, transfers }) => {
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) return null;
    const next = deleteTransfers
      ? applyReconciliation(
          transfers,
          reconcileGeneratedTransfers(rules[index], null, forEngine(transfers), now),
        )
      : transfers;
    return {
      rules: rules.filter((_, i) => i !== index),
      transfers: next,
      result: { id: ruleId, transfersDeleted: transfers.length - next.length },
    };
  });
}

/** Generates every due transfer of every rule (what the app does on start, exposed for agents and cron-like use). */
async function refreshRecurringTransfers(deps, userId, { now = new Date() } = {}) {
  return withRecurringWrite(deps, userId, ({ rules, transfers }) => {
    const due = generateDueTransfers(rules, forEngine(transfers), now).map(newTransferFrom);
    const result = { transfersCreated: due.length, rulesProcessed: rules.length };
    if (due.length === 0) return { skipWrite: true, result };
    return { rules, transfers: [...transfers, ...due], result };
  });
}

/** Whole-account import: validates plaintext rules and returns them in stored (encrypted) form. */
function prepareImportedRecurringTransfers(list, session, schemaVersion) {
  const ids = new Set();
  for (const rule of list) {
    if (!rule || typeof rule !== 'object')
      throw new Error('Each recurring transfer must be an object');
    if (typeof rule.id !== 'string' || rule.id === '') {
      throw new Error('Each recurring transfer needs a string id');
    }
    if (ids.has(rule.id)) throw new Error(`Duplicate recurring transfer id ${rule.id}`);
    ids.add(rule.id);
    if (typeof rule.amount !== 'number' || !Number.isFinite(rule.amount)) {
      throw new Error(`Recurring transfer ${rule.id} needs a finite numeric amount`);
    }
    if (!FREQUENCIES.includes(rule.frequency)) {
      throw new Error(`Recurring transfer ${rule.id} has an invalid frequency`);
    }
  }
  return decryptAllRules(list, null, schemaVersion).map((rule) =>
    encryptRule(rule, session, schemaVersion),
  );
}

module.exports = {
  FREQUENCIES,
  listRecurringTransfers,
  getRecurringTransfer,
  createRecurringTransfer,
  updateRecurringTransfer,
  deleteRecurringTransfer,
  refreshRecurringTransfers,
  prepareImportedRecurringTransfers,
  decryptRule,
};
