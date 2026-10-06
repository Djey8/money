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
const { decryptShare, encryptShare } = require('../repositories/share-repository');
const { decryptInvestment, encryptInvestment } = require('../repositories/investment-repository');
const { decryptAsset, encryptAsset } = require('../repositories/asset-repository');
const { decryptGrow, encryptGrow } = require('../repositories/grow-repository');
const { applyDerivedState } = require('./transaction-derived-state');
const { encodeGameState } = require('./game-state-codec');

/**
 * The server's side of `GameEffects` (todo/cashflow-game-pro.md, slice D2): reads an account's stored data into the
 * minor-unit books the game rules take, and writes the effects a rule returns back into the stored document - the same
 * decisions the Angular service applies to its own entities (`applyGameEffects`), stored the way the browser stores them.
 * Every kind of effect the rules produce is applied.
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
        share: grow.share
          ? {
              tag: grow.share.tag,
              quantity: grow.share.quantity,
              priceMinor: grow.share.priceMinor,
            }
          : null,
        investment: grow.investment
          ? {
              tag: grow.investment.tag,
              depositMinor: grow.investment.depositMinor,
              amountMinor: grow.investment.amountMinor,
            }
          : null,
        loan: grow.liabilitie
          ? {
              tag: grow.liabilitie.tag,
              amountMinor: grow.liabilitie.amountMinor,
              creditMinor: grow.liabilitie.creditMinor,
              investment: grow.liabilitie.investment,
            }
          : null,
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

/**
 * Creates or replaces one entry of a balance-sheet list, matched by tag; an existing entry keeps its id.
 * `decode`/`encode` are the entity repository's own, `fresh` builds the entry from the rule's description.
 */
function upsertByTag(rawList, tag, { prefix, decode, encode, build }, session, schemaVersion) {
  const index = rawList.findIndex((raw) => decryptValue(raw.tag, session) === tag);
  const existing = index === -1 ? null : decode(rawList[index], session, schemaVersion);
  const entry = {
    ...(existing ?? {}),
    ...build(existing),
    id: existing?.id ?? `${prefix}_${crypto.randomUUID()}`,
  };
  const encoded = encode(entry, session, schemaVersion);
  return index === -1
    ? [...rawList, encoded]
    : rawList.map((raw, i) => (i === index ? encoded : raw));
}

const SHARES = { prefix: 'shares', decode: decryptShare, encode: encryptShare };
const INVESTMENTS = { prefix: 'investments', decode: decryptInvestment, encode: encryptInvestment };
const ASSETS = { prefix: 'assets', decode: decryptAsset, encode: encryptAsset };

function removeByTag(rawList, tags, session) {
  const removed = new Set(tags);
  return rawList.filter((raw) => !removed.has(decryptValue(raw.tag, session)));
}

/** A Grow project as the game has always created one. */
function newGrow(title, createdAt) {
  return {
    id: `grow_${crypto.randomUUID()}`,
    title,
    sub: '',
    phase: 'execute',
    description: '',
    strategy: '',
    riskScore: 0,
    risks: '',
    links: [],
    actionItems: [],
    notes: [],
    cashflowMinor: 0,
    amountMinor: 0,
    isAsset: false,
    share: null,
    investment: null,
    liabilitie: null,
    createdAt,
    updatedAt: createdAt,
    type: 'income-growth',
  };
}

/** The fields of a rule's project update written onto a project (Grow's own field names). */
function patchGrow(project, update) {
  const next = { ...project };
  if (update.sub !== undefined) next.sub = update.sub;
  if (update.phase !== undefined) next.phase = update.phase;
  if (update.status !== undefined) next.status = update.status;
  if (update.description !== undefined) next.description = update.description;
  if (update.strategy !== undefined) next.strategy = update.strategy;
  if (update.isAsset !== undefined) next.isAsset = update.isAsset;
  if (update.amountMinor !== undefined) next.amountMinor = update.amountMinor;
  if (update.cashflowMinor !== undefined) next.cashflowMinor = update.cashflowMinor;
  if (update.share !== undefined) next.share = update.share;
  if (update.sharePriceMinor !== undefined && next.share) {
    next.share = { ...next.share, priceMinor: update.sharePriceMinor };
  }
  if (update.investment !== undefined) next.investment = update.investment;
  if (update.loan !== undefined) next.liabilitie = update.loan;
  if (update.notes !== undefined) next.notes = update.notes;
  if (update.updatedAt !== undefined) next.updatedAt = update.updatedAt;
  return next;
}

function applyGrowUpdates(rawGrow, updates, session, schemaVersion) {
  let result = rawGrow;
  for (const update of updates) {
    const index = result.findIndex((raw) => decryptValue(raw.title, session) === update.title);
    let current;
    if (index === -1) {
      if (!update.create) continue;
      current = newGrow(update.title, update.createdAt ?? new Date().toISOString());
    } else {
      current = decryptGrow(result[index], session, schemaVersion);
      if (current.id === undefined) current = { ...current, id: `grow_${crypto.randomUUID()}` };
    }
    const encoded = encryptGrow(patchGrow(current, update), session, schemaVersion);
    result =
      index === -1 ? [...result, encoded] : result.map((raw, i) => (i === index ? encoded : raw));
  }
  return result;
}

/**
 * The stored document's `data` after one rule's effects. Pure over its inputs apart from generated ids.
 * @returns the new `data`
 */
function applyEffectsToData(data, effects, { session }) {
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
  const rawAsset = next.balance?.asset || {};
  let rawShares = list(rawAsset.shares);
  for (const { tag, priceMinor } of effects.sharePrices) {
    if (rawShares.some((raw) => decryptValue(raw.tag, session) === tag)) {
      rawShares = upsertByTag(
        rawShares,
        tag,
        { ...SHARES, build: () => ({ priceMinor }) },
        session,
        schemaVersion,
      );
    }
  }
  for (const upsert of effects.shareUpserts) {
    rawShares = upsertByTag(
      rawShares,
      upsert.tag,
      {
        ...SHARES,
        build: () => ({
          tag: upsert.tag,
          quantity: upsert.quantity,
          priceMinor: upsert.priceMinor,
        }),
      },
      session,
      schemaVersion,
    );
  }
  if (effects.shareRemovals.length > 0) {
    rawShares = removeByTag(rawShares, effects.shareRemovals, session);
  }
  let rawInvestments = list(rawAsset.investments);
  for (const upsert of effects.investmentUpserts) {
    rawInvestments = upsertByTag(
      rawInvestments,
      upsert.tag,
      {
        ...INVESTMENTS,
        build: () => ({
          tag: upsert.tag,
          depositMinor: upsert.depositMinor,
          amountMinor: upsert.amountMinor,
        }),
      },
      session,
      schemaVersion,
    );
  }
  if (effects.investmentRemovals.length > 0) {
    rawInvestments = removeByTag(rawInvestments, effects.investmentRemovals, session);
  }
  let rawAssets = list(rawAsset.assets);
  for (const upsert of effects.assetUpserts) {
    rawAssets = upsertByTag(
      rawAssets,
      upsert.tag,
      { ...ASSETS, build: () => ({ tag: upsert.tag, amountMinor: upsert.amountMinor }) },
      session,
      schemaVersion,
    );
  }
  if (effects.assetRemovals.length > 0)
    rawAssets = removeByTag(rawAssets, effects.assetRemovals, session);
  next.balance = {
    ...next.balance,
    liabilities: rawLiabilities,
    asset: { ...rawAsset, shares: rawShares, investments: rawInvestments, assets: rawAssets },
  };

  if (effects.growUpdates.length > 0) {
    next.grow = applyGrowUpdates(list(next.grow), effects.growUpdates, session, schemaVersion);
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
