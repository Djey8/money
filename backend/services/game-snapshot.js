'use strict';

const crypto = require('crypto');
const zlib = require('zlib');
const {
  decryptDocumentPreservingTypes,
  MONEY_FIELD_NAMES,
  toMinorUnits,
  fromMinorUnits,
  readLiveHistory,
  buildLiveHistory,
  LIVE_HISTORY_SCHEMA,
} = require('@money/domain');
const { decodeGameState, encodeGameState } = require('./game-state-codec');
const { rebuildDerivedState } = require('./rebuild-derived');

/**
 * The game's snapshots and its live history on the server (todo/cashflow-game-pro.md slice D2): the account as the app
 * holds it in memory - decimal amounts, the entity lists of `CashflowGameSnapshot` - which is what both Undo and the
 * history document at `cashflowGameHistory` keep, so a game played through the API and one played in the browser share
 * one history. `readSnapshot` turns the stored document into that form; `writeSnapshot` puts one back (an Undo or a
 * reset), rebuilding everything derived from the transactions.
 */

const GZIP_PREFIX = 'gz:';
const RAW_PREFIX = 'raw:';

function list(value) {
  return Array.isArray(value) ? value : [];
}

/** Stored amounts are decimal in schema 1 and minor units in schema 2; a snapshot always holds decimals. */
function toDecimalMoney(node, schemaVersion) {
  if (schemaVersion < 2) return node;
  if (Array.isArray(node)) return node.map((item) => toDecimalMoney(item, schemaVersion));
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        MONEY_FIELD_NAMES.has(key) && typeof value === 'number'
          ? fromMinorUnits(value)
          : toDecimalMoney(value, schemaVersion),
      ]),
    );
  }
  return node;
}

function toStoredMoneyTree(node, schemaVersion) {
  if (schemaVersion < 2) return node;
  if (Array.isArray(node)) return node.map((item) => toStoredMoneyTree(item, schemaVersion));
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        MONEY_FIELD_NAMES.has(key) && typeof value === 'number'
          ? toMinorUnits(value)
          : toStoredMoneyTree(value, schemaVersion),
      ]),
    );
  }
  return node;
}

function encryptTree(node, session) {
  if (Array.isArray(node)) return node.map((item) => encryptTree(item, session));
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, encryptTree(value, session)]),
    );
  }
  if (node === null || node === undefined) return null;
  return session ? session.encrypt(String(node)) : node;
}

/** The stored document as the app's in-memory snapshot (everything the live game consists of). */
function readSnapshot(data, session) {
  const schemaVersion = data.meta?.schemaVersion || 1;
  const asset = data.balance?.asset || {};
  const { data: decrypted } = decryptDocumentPreservingTypes(
    {
      allTransactions: list(data.transactions),
      allSubscriptions: list(data.subscriptions),
      allGrowProjects: list(data.grow),
      allShares: list(asset.shares),
      allInvestments: list(asset.investments),
      allAssets: list(asset.assets),
      liabilities: list(data.balance?.liabilities),
      allSmileProjects: list(data.smile),
      allFireEmergencies: list(data.fire),
      mojo: data.mojo ?? { amount: 0, target: 0 },
    },
    { decrypt: session ? (value) => session.decrypt(value) : undefined },
  );
  return {
    ...toDecimalMoney(decrypted, schemaVersion),
    cashflowGame: decodeGameState(data.cashflowGame, session),
  };
}

/** Entities the app keeps without an id still need one in the stored document (the API addresses them by id). */
function withIds(entries, prefix) {
  return list(entries).map((entry) =>
    entry && entry.id ? entry : { ...entry, id: `${prefix}_${crypto.randomUUID()}` },
  );
}

/**
 * The stored document with a snapshot put back as the live game: every list replaced, encrypted the way the browser
 * stores it, and everything derived from the transactions (income lists, Smile / Fire / Mojo amounts) rebuilt.
 */
function writeSnapshot(data, snapshot, session) {
  const schemaVersion = data.meta?.schemaVersion || 1;
  const store = (entries, prefix) =>
    encryptTree(toStoredMoneyTree(withIds(entries, prefix), schemaVersion), session);
  const storePlain = (entries) =>
    encryptTree(toStoredMoneyTree(list(entries), schemaVersion), session);
  const next = {
    ...data,
    transactions: storePlain(snapshot.allTransactions),
    subscriptions: store(snapshot.allSubscriptions, 'subscriptions'),
    grow: store(snapshot.allGrowProjects, 'grow'),
    smile: store(snapshot.allSmileProjects, 'smile'),
    fire: store(snapshot.allFireEmergencies, 'fire'),
    mojo: encryptTree(
      toStoredMoneyTree(snapshot.mojo ?? { amount: 0, target: 0 }, schemaVersion),
      session,
    ),
    balance: {
      ...data.balance,
      liabilities: store(snapshot.liabilities, 'liabilities'),
      asset: {
        ...data.balance?.asset,
        shares: store(snapshot.allShares, 'shares'),
        investments: store(snapshot.allInvestments, 'investments'),
        assets: store(snapshot.allAssets, 'assets'),
      },
    },
    cashflowGame: encodeGameState(snapshot.cashflowGame, session),
  };
  // Transactions the browser kept without ids get them in the rebuild (the API addresses them by id).
  return rebuildDerivedState(withTransactionIds(next, session), session, schemaVersion);
}

function withTransactionIds(data, session) {
  const encrypt = (value) => (session ? session.encrypt(String(value)) : value);
  return {
    ...data,
    transactions: list(data.transactions).map((row) =>
      row.id === undefined ? { ...row, id: encrypt(`tx_${crypto.randomUUID()}`) } : row,
    ),
  };
}

// ── The live history document: `cashflowGameHistory` = { schema, payload } ─────────────────────────

function packHistory(history) {
  const json = JSON.stringify(history);
  return GZIP_PREFIX + zlib.gzipSync(Buffer.from(json, 'utf8')).toString('base64');
}

function unpackHistory(packed) {
  if (typeof packed !== 'string') return null;
  if (packed.startsWith(RAW_PREFIX)) return JSON.parse(packed.slice(RAW_PREFIX.length));
  if (!packed.startsWith(GZIP_PREFIX)) return null;
  const bytes = zlib.gunzipSync(Buffer.from(packed.slice(GZIP_PREFIX.length), 'base64'));
  return JSON.parse(bytes.toString('utf8'));
}

/** The undo stack the account holds (empty when there is none or it cannot be read). */
function readHistoryStack(data, session) {
  const stored = data.cashflowGameHistory;
  if (!stored || stored.payload == null) return { stack: [], updatedAt: null };
  try {
    const packed = session ? session.decrypt(stored.payload) : stored.payload;
    const read = readLiveHistory(unpackHistory(packed));
    return read ? { stack: read.stack, updatedAt: read.updatedAt } : { stack: [], updatedAt: null };
  } catch {
    return { stack: [], updatedAt: null };
  }
}

/** The plain-text step log of the stored history, oldest step first (no snapshot is decoded). */
function readHistoryLog(data, session) {
  const stored = data.cashflowGameHistory;
  if (!stored || stored.payload == null) return { updatedAt: null, steps: [] };
  try {
    const packed = session ? session.decrypt(stored.payload) : stored.payload;
    const history = unpackHistory(packed);
    return { updatedAt: history.updatedAt, steps: history.steps ?? [] };
  } catch {
    return { updatedAt: null, steps: [] };
  }
}

/** The history document for `stack`, packed and encrypted as one string leaf, like the browser writes it. */
function buildHistoryDocument(stack, liveSnapshot, deps, nowIso, session) {
  const history = buildLiveHistory(stack, liveSnapshot, deps, nowIso);
  const payload = packHistory(history);
  return {
    schema: session ? session.encrypt(String(LIVE_HISTORY_SCHEMA)) : LIVE_HISTORY_SCHEMA,
    payload: session ? session.encrypt(payload) : payload,
  };
}

module.exports = {
  readSnapshot,
  writeSnapshot,
  readHistoryStack,
  readHistoryLog,
  buildHistoryDocument,
  packHistory,
  unpackHistory,
  packJson: packHistory,
  unpackJson: unpackHistory,
};
