'use strict';

/**
 * Adds stable `id` fields to Smile/Fire projects, mirroring
 * `backfill-transaction-ids.js`'s approach exactly (explicit, backup-first,
 * idempotent, dry-run-able) — needed because `GET/PATCH/DELETE /smile/{id}`
 * and `/fire/{id}` require addressing a project by a stable id, but the
 * legacy storage shape only ever matched a project by `title` (see
 * docs/discovery/DOMAIN_MODEL.md §1/§4 — entities are keyed by string, not
 * id). Buckets *within* a project already have stable ids; only the
 * project itself was missing one.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getEncryptionSession } = require('../../services/encryption-session');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', '..', 'migration-backups');
const MAX_WRITE_RETRIES = 10;
const COLLECTIONS = new Set(['smile', 'fire']);

function writeBackup(backupDir, userId, collection, userDoc) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `${userId}-${collection}-ids-${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(userDoc, null, 2), 'utf8');
  return backupFile;
}

function addMissingIds(projects, collection, session) {
  let count = 0;
  const updated = projects.map((project) => {
    if (typeof project.id === 'string' && project.id.length > 0) return project;
    count += 1;
    const id = `${collection}_${crypto.randomUUID()}`;
    return { ...project, id: session ? session.encrypt(id) : id };
  });
  return { projects: updated, count };
}

async function backfillFundProjectIds(
  { usersDb, authDb },
  { userId, collection, dryRun = false, backupDir = DEFAULT_BACKUP_DIR },
) {
  if (!userId) throw new Error('--user <id> is required');
  if (!COLLECTIONS.has(collection)) {
    throw new Error(`--collection must be one of: ${[...COLLECTIONS].join(', ')}`);
  }
  let attempts = 0;
  while (attempts < MAX_WRITE_RETRIES) {
    const userDoc = await usersDb.get(userId);
    const projects = userDoc.data?.[collection];
    if (!Array.isArray(projects)) return { status: `no-${collection}`, userId, idsAdded: 0 };
    const session = await getEncryptionSession(authDb, userId);
    const { projects: updatedProjects, count } = addMissingIds(projects, collection, session);
    if (count === 0) return { status: 'already-backfilled', userId, idsAdded: 0 };
    if (dryRun) return { status: 'dry-run', userId, idsAdded: count };

    const backupFile = writeBackup(backupDir, userId, collection, userDoc);
    try {
      await usersDb.insert({
        ...userDoc,
        data: { ...userDoc.data, [collection]: updatedProjects },
        updatedAt: new Date().toISOString(),
      });
      return { status: 'backfilled', userId, idsAdded: count, backupFile };
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempts += 1;
    }
  }
  throw new Error(`Could not backfill ${collection} project IDs for ${userId}: CouchDB conflict`);
}

module.exports = { backfillFundProjectIds, addMissingIds };
