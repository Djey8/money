'use strict';

/**
 * Adds stable `id` fields to balance-sheet entities (assets/shares/
 * investments/liabilities), mirroring `backfill-fund-project-ids.js`'s
 * approach exactly (explicit, backup-first, idempotent, dry-run-able) —
 * needed because `GET/PATCH/DELETE /balance/{collection}/{id}` requires
 * addressing an entry by a stable id, but the legacy storage shape only
 * ever matched an entry by its `tag` (see docs/discovery/DOMAIN_MODEL.md
 * §1/§4 — entities are keyed by string, not id).
 *
 * Unlike Smile/Fire projects (each a single top-level `data[collection]`
 * array), balance entities live at a nested path — `data.balance.asset.assets`,
 * not `data.assets` — so this command takes a path per collection rather
 * than assuming a flat top-level key.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getEncryptionSession } = require('../../services/encryption-session');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', '..', 'migration-backups');
const MAX_WRITE_RETRIES = 10;

const COLLECTION_PATHS = {
  assets: ['balance', 'asset', 'assets'],
  shares: ['balance', 'asset', 'shares'],
  investments: ['balance', 'asset', 'investments'],
  liabilities: ['balance', 'liabilities'],
};

function getAtPath(data, pathSegments) {
  return pathSegments.reduce((acc, key) => (acc == null ? acc : acc[key]), data);
}

function setAtPath(data, pathSegments, value) {
  const [head, ...rest] = pathSegments;
  if (rest.length === 0) return { ...data, [head]: value };
  return { ...data, [head]: setAtPath(data[head] || {}, rest, value) };
}

function writeBackup(backupDir, userId, collection, userDoc) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `${userId}-${collection}-ids-${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(userDoc, null, 2), 'utf8');
  return backupFile;
}

function addMissingIds(entries, collection, session) {
  let count = 0;
  const updated = entries.map((entry) => {
    if (typeof entry.id === 'string' && entry.id.length > 0) return entry;
    count += 1;
    const id = `${collection}_${crypto.randomUUID()}`;
    return { ...entry, id: session ? session.encrypt(id) : id };
  });
  return { entries: updated, count };
}

async function backfillBalanceEntityIds(
  { usersDb, authDb },
  { userId, collection, dryRun = false, backupDir = DEFAULT_BACKUP_DIR },
) {
  if (!userId) throw new Error('--user <id> is required');
  const pathSegments = COLLECTION_PATHS[collection];
  if (!pathSegments) {
    throw new Error(`--collection must be one of: ${Object.keys(COLLECTION_PATHS).join(', ')}`);
  }
  let attempts = 0;
  while (attempts < MAX_WRITE_RETRIES) {
    const userDoc = await usersDb.get(userId);
    const entries = getAtPath(userDoc.data, pathSegments);
    if (!Array.isArray(entries)) return { status: `no-${collection}`, userId, idsAdded: 0 };
    const session = await getEncryptionSession(authDb, userId);
    const { entries: updatedEntries, count } = addMissingIds(entries, collection, session);
    if (count === 0) return { status: 'already-backfilled', userId, idsAdded: 0 };
    if (dryRun) return { status: 'dry-run', userId, idsAdded: count };

    const backupFile = writeBackup(backupDir, userId, collection, userDoc);
    try {
      await usersDb.insert({
        ...userDoc,
        data: setAtPath(userDoc.data || {}, pathSegments, updatedEntries),
        updatedAt: new Date().toISOString(),
      });
      return { status: 'backfilled', userId, idsAdded: count, backupFile };
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempts += 1;
    }
  }
  throw new Error(`Could not backfill ${collection} IDs for ${userId}: CouchDB conflict`);
}

module.exports = { backfillBalanceEntityIds, addMissingIds, COLLECTION_PATHS };
