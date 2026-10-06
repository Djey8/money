'use strict';

const crypto = require('crypto');
const { transactionFromApi } = require('@money/domain');
const {
  decryptValue,
  toApiTransactions,
  encryptTransaction,
} = require('../repositories/transaction-repository');
const {
  decryptSubscription,
  encryptSubscription,
} = require('../repositories/subscription-repository');
const { decryptLiability, encryptLiability } = require('../repositories/liability-repository');
const { decryptGrow, encryptGrow } = require('../repositories/grow-repository');
const { applyDerivedState } = require('./transaction-derived-state');
const { encodeGameState } = require('./game-state-codec');

/**
 * The server's side of `GameEffects` (todo/cashflow-game-pro.md, slice D2): reads an account's stored data into the
 * minor-unit books the game rules take, and writes the effects a rule returns back into the stored document - the same
 * decisions the Angular service applies to its own entities (`applyGameEffects`), stored the way the browser stores them.
 * Effects this does not apply yet throw instead of being dropped, so a rule that grows a new kind of effect cannot lose
 * changes quietly.
 */

const toMinor = (value, schemaVersion) => {
  const number = Number(value) || 0;
  return schemaVersion >= 2 ? number : Math.round(number * 100);
};

function list(value) {
  return Array.isArray(value) ? value : [];
}

/** The slice of the account the game rules read. `data` is the stored user document's `data`. */
function readBooks(data, session, { state, allocation, gameSet }) {
  const schemaVersion = data.meta?.schemaVersion || 1;
  const currency = data.meta?.currency || 'EUR';
  const subscriptions = list(data.subscriptions).map((raw) =>
    decryptSubscription(raw, session, schemaVersion),
  );
  const liabilities = list(data.balance?.liabilities).map((raw) =>
    decryptLiability(raw, session, schemaVersion),
  );
  const asset = data.balance?.asset || {};
  return {
    state,
    allocation,
    gameSet,
    subscriptions: subscriptions.map((sub) => ({
      title: sub.title,
      account: sub.account,
      amountMinor: sub.amountMinor,
      startDate: sub.startDate,
      endDate: sub.endDate ?? '',
      category: sub.category,
      comment: sub.comment,
      frequency: sub.frequency,
    })),
    transactions: toApiTransactions(list(data.transactions), session, schemaVersion, currency),
    liabilities: liabilities.map((liability) => ({
      tag: liability.tag,
      amountMinor: liability.amountMinor,
      investment: liability.investment,
    })),
    shares: list(asset.shares).map((raw) => ({
      tag: decryptValue(raw.tag, session),
      quantity: Number(decryptValue(raw.quantity, session)) || 0,
      priceMinor: toMinor(decryptValue(raw.price, session), schemaVersion),
    })),
    investments: list(asset.investments).map((raw) => ({
      tag: decryptValue(raw.tag, session),
      depositMinor: toMinor(decryptValue(raw.deposit, session), schemaVersion),
      amountMinor: toMinor(decryptValue(raw.amount, session), schemaVersion),
    })),
    assets: list(asset.assets).map((raw) => ({
      tag: decryptValue(raw.tag, session),
      amountMinor: toMinor(decryptValue(raw.amount, session), schemaVersion),
    })),
    growProjects: list(data.grow).map((raw) => {
      const grow = decryptGrow(raw, session, schemaVersion);
      return {
        title: grow.title,
        sub: grow.sub ?? '',
        phase: grow.phase,
        status: grow.status ?? '',
        description: grow.description,
        strategy: grow.strategy,
        notes: grow.notes,
        cashflowMinor: grow.cashflowMinor,
        amountMinor: grow.amountMinor,
        isAsset: grow.isAsset,
        share: null,
        investment: null,
        loan: null,
        updatedAt: grow.updatedAt,
      };
    }),
  };
}

function upsertSubscription(rawSubscriptions, upsert, session, schemaVersion) {
  const index = rawSubscriptions.findIndex(
    (raw) => decryptValue(raw.title, session) === upsert.title,
  );
  if (index === -1) {
    return [
      ...rawSubscriptions,
      encryptSubscription(
        {
          id: `subscriptions_${crypto.randomUUID()}`,
          title: upsert.title,
          account: upsert.account,
          amountMinor: upsert.amountMinor,
          startDate: upsert.startDate,
          endDate: upsert.endDate,
          category: upsert.category,
          comment: upsert.comment,
          frequency: upsert.frequency,
        },
        session,
        schemaVersion,
      ),
    ];
  }
  // An existing subscription keeps everything the rule does not touch (its id, dates).
  const existing = decryptSubscription(rawSubscriptions[index], session, schemaVersion);
  const merged = {
    ...existing,
    id: existing.id ?? `subscriptions_${crypto.randomUUID()}`,
    account: upsert.account,
    amountMinor: upsert.amountMinor,
    frequency: upsert.frequency,
    category: upsert.category,
    comment: upsert.comment,
  };
  return rawSubscriptions.map((raw, i) =>
    i === index ? encryptSubscription(merged, session, schemaVersion) : raw,
  );
}

function upsertLiability(rawLiabilities, upsert, session, schemaVersion) {
  const index = rawLiabilities.findIndex((raw) => decryptValue(raw.tag, session) === upsert.tag);
  if (index === -1) {
    return [
      ...rawLiabilities,
      encryptLiability(
        {
          id: `liabilities_${crypto.randomUUID()}`,
          tag: upsert.tag,
          amountMinor: upsert.amountMinor,
          investment: upsert.investment,
          creditMinor: 0,
        },
        session,
        schemaVersion,
      ),
    ];
  }
  const existing = decryptLiability(rawLiabilities[index], session, schemaVersion);
  const merged = {
    ...existing,
    id: existing.id ?? `liabilities_${crypto.randomUUID()}`,
    amountMinor: upsert.amountMinor,
  };
  return rawLiabilities.map((raw, i) =>
    i === index ? encryptLiability(merged, session, schemaVersion) : raw,
  );
}

function applyGrowUpdates(rawGrow, updates, session, schemaVersion, nowIso) {
  let result = rawGrow;
  for (const update of updates) {
    const unsupported = Object.keys(update).filter(
      (key) => !['title', 'notes', 'updatedAt'].includes(key),
    );
    if (unsupported.length > 0) {
      throw new Error(`Grow update fields not supported by the API yet: ${unsupported.join(', ')}`);
    }
    const index = result.findIndex((raw) => decryptValue(raw.title, session) === update.title);
    if (index === -1) continue;
    const current = decryptGrow(result[index], session, schemaVersion);
    const next = {
      ...current,
      notes: update.notes ?? current.notes,
      updatedAt: update.updatedAt ?? nowIso,
    };
    result = result.map((raw, i) =>
      i === index ? encryptGrow(next, session, schemaVersion) : raw,
    );
  }
  return result;
}

/**
 * The stored document's `data` after one rule's effects. Pure over its inputs apart from generated ids.
 * @returns the new `data`
 */
function applyEffectsToData(data, effects, { session, nowIso }) {
  const unsupported = [
    ['sharePrices', effects.sharePrices],
    ['shareUpserts', effects.shareUpserts],
    ['investmentUpserts', effects.investmentUpserts],
    ['assetUpserts', effects.assetUpserts],
    ['assetRemovals', effects.assetRemovals],
  ].filter(([, entries]) => entries.length > 0);
  if (unsupported.length > 0) {
    throw new Error(
      `Effects not supported by the API yet: ${unsupported.map(([n]) => n).join(', ')}`,
    );
  }
  if (effects.growUpdates.some((update) => update.create)) {
    throw new Error('Creating Grow projects is not supported by the API yet');
  }

  const schemaVersion = data.meta?.schemaVersion || 1;
  const currency = data.meta?.currency || 'EUR';
  let next = { ...data };

  let rawSubscriptions = list(next.subscriptions);
  for (const upsert of effects.subscriptionUpserts) {
    rawSubscriptions = upsertSubscription(rawSubscriptions, upsert, session, schemaVersion);
  }
  if (effects.subscriptionRemovals.length > 0) {
    const removed = new Set(effects.subscriptionRemovals);
    rawSubscriptions = rawSubscriptions.filter(
      (raw) => !removed.has(decryptValue(raw.title, session)),
    );
  }
  next.subscriptions = rawSubscriptions;

  let rawLiabilities = list(next.balance?.liabilities);
  for (const upsert of effects.liabilityUpserts) {
    rawLiabilities = upsertLiability(rawLiabilities, upsert, session, schemaVersion);
  }
  if (effects.liabilityRemovals.length > 0) {
    const removed = new Set(effects.liabilityRemovals);
    rawLiabilities = rawLiabilities.filter((raw) => !removed.has(decryptValue(raw.tag, session)));
  }
  next.balance = { ...next.balance, liabilities: rawLiabilities };

  if (effects.growUpdates.length > 0) {
    next.grow = applyGrowUpdates(
      list(next.grow),
      effects.growUpdates,
      session,
      schemaVersion,
      nowIso,
    );
  }

  if (effects.transactionDates.length === 0 && effects.appendedTransactions.length === 0) {
    next.cashflowGame = encodeGameState(effects.state, session);
    return next;
  }
  const transactions = toApiTransactions(list(next.transactions), session, schemaVersion, currency);
  for (const { index, date } of effects.transactionDates)
    transactions[index] = { ...transactions[index], date };
  for (const record of effects.appendedTransactions) {
    transactions.push({
      id: `tx_${crypto.randomUUID()}`,
      account: record.account,
      amountMinor: record.amountMinor,
      date: record.date,
      time: record.time || '00:00',
      category: record.category,
      comment: record.comment,
      currency,
    });
  }
  const derived = applyDerivedState(next, transactions, session, schemaVersion);
  next = derived.data;
  next.transactions = derived.transactions.map((effective) =>
    encryptTransaction(transactionFromApi(effective, schemaVersion), session),
  );

  next.cashflowGame = encodeGameState(effects.state, session);
  return next;
}

module.exports = { readBooks, applyEffectsToData };
