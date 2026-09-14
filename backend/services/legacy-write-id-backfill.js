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
 * @param {object} authDb
 * @param {string} userId
 * @param {string} path - the write path as given to /write/{path} or a /write/batch entry
 * @param {unknown} data - the request body for that path
 * @returns {Promise<unknown>} `data` unchanged unless it's an array at a known id-bearing path with at least one entry missing an id
 */
async function backfillMissingIdsForWrite(authDb, userId, path, data) {
  const prefix = ID_PREFIX_BY_PATH[path];
  if (!prefix || !Array.isArray(data)) return data;

  const needsBackfill = data.some(
    (entry) => entry !== null && typeof entry === 'object' && !hasStableId(entry),
  );
  if (!needsBackfill) return data;

  const session = await getEncryptionSession(authDb, userId);
  return data.map((entry) => {
    if (entry === null || typeof entry !== 'object' || hasStableId(entry)) return entry;
    const id = `${prefix}_${crypto.randomUUID()}`;
    return { ...entry, id: session ? session.encrypt(id) : id };
  });
}

module.exports = { backfillMissingIdsForWrite, ID_PREFIX_BY_PATH };
