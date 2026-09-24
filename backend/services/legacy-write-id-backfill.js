'use strict';

/**
 * Backfills a stable `id` onto any entry missing one, on the way into a
 * legacy raw write (`backend/routes/data.js`'s `/write/*` and
 * `/write/batch`). Those endpoints replace a whole collection wholesale
 * from whatever the calling client currently has in memory — and the
 * Angular app's own interfaces (`Transaction`, `Smile`, `Share`, ...) have
 * never carried an `id` field, so any such write from an already-open
 * session silently drops ids the Pro API/MCP layer depends on, even for
 * entries the client never touched. Confirmed in production: JFK's
 * transactions lost every backfilled id the first time the app wrote the
 * collection back after `mm-admin migrate-transaction-ids` ran, because the
 * browser's copy of `transactions` predated that run.
 *
 * Making every write self-healing here closes that permanently, instead of
 * requiring a repeated manual `mm-admin migrate-*-ids` run each time it
 * regresses. ID generation mirrors the existing one-time backfill CLIs
 * (`backend/cli/commands/backfill-{transaction,fund-project,balance-entity}-ids.js`)
 * exactly — `tx_` for transactions, `<collection>_` for everything else —
 * so ids produced either way are indistinguishable.
 */

const crypto = require('crypto');
const { getEncryptionSession } = require('./encryption-session');
const { decryptValue } = require('../repositories/transaction-repository');

const ID_PREFIX_BY_PATH = {
  transactions: 'tx',
  smile: 'smile',
  fire: 'fire',
  subscriptions: 'subscriptions',
  budget: 'budget',
  grow: 'grow',
  'balance/asset/assets': 'assets',
  'balance/asset/shares': 'shares',
  'balance/asset/investments': 'investments',
  'balance/liabilities': 'liabilities',
};

function hasStableId(entry) {
  return typeof entry.id === 'string' && entry.id.length > 0;
}

/**
 * The natural key the Angular app itself matches each collection's entries
 * by (see CLAUDE.md's "entities are keyed by string" note) — used to hand an
 * id-less incoming entry back the id its stored counterpart already has,
 * rather than minting a new one. Minting on every write broke every id an
 * agent was holding the moment the app saved: confirmed in production when a
 * Grow save from the app re-keyed all three Grow projects.
 */
const NATURAL_KEY_FIELDS_BY_PATH = {
  transactions: ['account', 'amount', 'date', 'time', 'category', 'comment'],
  smile: ['title'],
  fire: ['title'],
  subscriptions: ['title'],
  budget: ['tag', 'date'],
  grow: ['title'],
  'balance/asset/assets': ['tag'],
  'balance/asset/shares': ['tag'],
  'balance/asset/investments': ['tag'],
  'balance/liabilities': ['tag'],
};

function naturalKey(entry, fields, session) {
  return JSON.stringify(
    fields.map((field) => {
      const value = decryptValue(entry[field], session);
      return value === undefined || value === null ? '' : String(value);
    }),
  );
}

/**
 * Stored ids by natural key, each list in stored order. Every id is handed
 * out at most once, so two incoming entries sharing a key (e.g. two
 * identical transactions) can't both claim the same stored id.
 */
function storedIdsByKey(existing, fields, session) {
  const byKey = new Map();
  for (const entry of Array.isArray(existing) ? existing : []) {
    if (entry === null || typeof entry !== 'object' || !hasStableId(entry)) continue;
    const key = naturalKey(entry, fields, session);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ stored: entry.id, plain: decryptValue(entry.id, session) });
  }
  return byKey;
}

/**
 * @param {object} authDb
 * @param {string} userId
 * @param {string} path - the write path as given to /write/{path} or a /write/batch entry
 * @param {unknown} data - the request body for that path
 * @param {unknown} [existing] - what is currently stored at `path`, if known — an id-less entry whose natural key matches a stored one gets that stored id back instead of a new one
 * @returns {Promise<unknown>} `data` unchanged unless it's an array at a known id-bearing path with at least one entry missing an id
 */
async function backfillMissingIdsForWrite(authDb, userId, path, data, existing) {
  const prefix = ID_PREFIX_BY_PATH[path];
  if (!prefix || !Array.isArray(data)) return data;

  const needsBackfill = data.some(
    (entry) => entry !== null && typeof entry === 'object' && !hasStableId(entry),
  );
  if (!needsBackfill) return data;

  const session = await getEncryptionSession(authDb, userId);
  const fields = NATURAL_KEY_FIELDS_BY_PATH[path];
  const available = storedIdsByKey(existing, fields, session);
  // Ids the incoming write already carries explicitly are taken (compared
  // decrypted — the same id encrypts to a different ciphertext each time).
  const taken = new Set(
    data.filter((e) => e && hasStableId(e)).map((e) => decryptValue(e.id, session)),
  );
  return data.map((entry) => {
    if (entry === null || typeof entry !== 'object' || hasStableId(entry)) return entry;
    const candidates = available.get(naturalKey(entry, fields, session)) || [];
    while (candidates.length > 0) {
      const reused = candidates.shift();
      if (!taken.has(reused.plain)) {
        taken.add(reused.plain);
        return { ...entry, id: reused.stored };
      }
    }
    const id = `${prefix}_${crypto.randomUUID()}`;
    return { ...entry, id: session ? session.encrypt(id) : id };
  });
}

module.exports = { backfillMissingIdsForWrite, ID_PREFIX_BY_PATH };
