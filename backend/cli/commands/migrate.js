'use strict';

/**
 * `mm-admin migrate` — converts one user's stored money fields from
 * decimal-float to integer minor units, per
 * docs/adr/0002-money-minor-units-migration.md.
 *
 * Safety properties this file is responsible for (JFK's explicit
 * requirement: "nothing I use today may break, must be reversible"):
 *   - Idempotent: a user already on schemaVersion 2 is a no-op.
 *   - Backed up before any write, to a local JSON file with everything
 *     needed to restore the exact pre-migration document.
 *   - Verified after write by independently re-reading the document back
 *     from CouchDB and re-summing all transaction amounts, comparing
 *     against the same sum computed on the pre-migration data. Any
 *     mismatch triggers an automatic restore from the backup and a
 *     non-zero exit — the migration is never left half-applied.
 *   - `--dry-run` never writes or backs up anything.
 *
 * NOTE: the transaction-sum check is a real, independent verification,
 * but not yet the full financial-statement/balance-sheet check described
 * in the ADR — that requires the calculation logic slice 2 extracts into
 * @money/domain. Tighten this once that exists (see PLAN.md rollout plan).
 */

const fs = require('fs');
const path = require('path');
const { convertDocumentToMinorUnits, EncryptionSession, fromMinorUnits } = require('@money/domain');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', '..', 'migration-backups');
const MAX_WRITE_RETRIES = 10;

class MigrationError extends Error {}

function getSchemaVersion(userDoc) {
  return userDoc?.data?.meta?.schemaVersion || 1;
}

async function getEncryptionSession(authDb, userId) {
  let encryptionConfig;
  try {
    const authDoc = await authDb.get(userId);
    encryptionConfig = authDoc.encryptionConfig || {
      key: 'default',
      encryptLocal: true,
      encryptDatabase: false,
    };
  } catch (err) {
    if (err.statusCode !== 404) throw err;
    encryptionConfig = { key: 'default', encryptLocal: true, encryptDatabase: false };
  }

  if (!encryptionConfig.encryptDatabase || encryptionConfig.key === 'default') {
    return null; // Data is stored as native types — no decrypt/encrypt needed.
  }
  return new EncryptionSession(encryptionConfig.key);
}

/**
 * Sums every `transactions[].amount`, decrypting first if `session` is
 * given. Used both before migration (values are decimals) and after
 * (values are integer minor units) — summation is the same operation
 * either way; the caller applies `fromMinorUnits` to the total once
 * (division distributes over sums, so this is equivalent to converting
 * each value individually before summing).
 */
function sumTransactionAmounts(data, session) {
  const transactions = data?.transactions;
  if (!Array.isArray(transactions)) return 0;
  return transactions.reduce((sum, tx) => {
    const raw = tx?.amount;
    const decrypted = session && typeof raw === 'string' ? session.decrypt(raw) : raw;
    const numeric = typeof decrypted === 'number' ? decrypted : parseFloat(decrypted);
    return Number.isNaN(numeric) ? sum : sum + numeric;
  }, 0);
}

function writeBackupFile(backupDir, userId, userDoc) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(backupDir, `${userId}-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(userDoc, null, 2), 'utf8');
  return filePath;
}

/**
 * Writes `newData` to the user's document, retrying on CouchDB 409
 * conflicts by re-fetching the latest revision — the same pattern used by
 * backend/routes/data.js's write endpoints.
 */
async function writeWithRetry(usersDb, userId, mutate) {
  let attempt = 0;
  let lastError;
  while (attempt < MAX_WRITE_RETRIES) {
    try {
      const current = await usersDb.get(userId);
      const mutated = mutate(current);
      return await usersDb.insert(mutated);
    } catch (err) {
      lastError = err;
      if (err.statusCode !== 409) throw err;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  throw lastError;
}

/**
 * @param {object} deps - { usersDb, authDb } (injected for testability — the real CLI passes the live nano handles)
 * @param {object} options - { userId, dryRun, currency, backupDir, rollbackFile }
 */
async function runMigration(deps, options) {
  const { usersDb, authDb } = deps;
  const {
    userId,
    dryRun = false,
    currency = 'EUR',
    backupDir = DEFAULT_BACKUP_DIR,
    rollbackFile,
  } = options;

  if (!userId) throw new MigrationError('--user <id> is required');

  if (rollbackFile) {
    return rollback(usersDb, userId, rollbackFile);
  }

  const userDoc = await usersDb.get(userId);
  const currentVersion = getSchemaVersion(userDoc);
  if (currentVersion >= 2) {
    return { status: 'already-migrated', userId, schemaVersion: currentVersion };
  }

  const session = await getEncryptionSession(authDb, userId);
  const callbacks = session
    ? { decrypt: (v) => session.decrypt(v), encrypt: (v) => session.encrypt(v) }
    : {};

  const preMigrationSum = sumTransactionAmounts(userDoc.data, session);
  const {
    data: convertedData,
    fieldsConverted,
    skippedNonNumeric,
  } = convertDocumentToMinorUnits(userDoc.data, callbacks);

  const nonRepresentable = fieldsConverted.filter((f) => !f.cleanlyRepresentable);

  if (dryRun) {
    return {
      status: 'dry-run',
      userId,
      fieldsConverted: fieldsConverted.length,
      nonRepresentable,
      skippedNonNumeric,
    };
  }

  const backupFile = writeBackupFile(backupDir, userId, userDoc);

  convertedData.meta = { ...(convertedData.meta || {}), schemaVersion: 2, currency };

  await writeWithRetry(usersDb, userId, (current) => ({
    ...current,
    data: convertedData,
    updatedAt: new Date().toISOString(),
  }));

  // Independent verification: re-read what was actually persisted and
  // re-sum transaction amounts (converted back to decimal) from scratch,
  // rather than trusting the in-memory `convertedData` we just wrote.
  const writtenDoc = await usersDb.get(userId);
  const postMigrationSumMinor = sumTransactionAmounts(writtenDoc.data, session);
  const postMigrationSum = fromMinorUnits(postMigrationSumMinor);

  if (Math.abs(postMigrationSum - preMigrationSum) > 1e-9) {
    await rollback(usersDb, userId, backupFile);
    throw new MigrationError(
      `Verification failed for user ${userId}: transaction sum before (${preMigrationSum}) != after (${postMigrationSum}). Automatically rolled back from ${backupFile}.`,
    );
  }

  return {
    status: 'migrated',
    userId,
    fieldsConverted: fieldsConverted.length,
    nonRepresentable,
    skippedNonNumeric,
    backupFile,
    preMigrationSum,
    postMigrationSum,
  };
}

async function rollback(usersDb, userId, backupFile) {
  const raw = fs.readFileSync(backupFile, 'utf8');
  const backupDoc = JSON.parse(raw);

  await writeWithRetry(usersDb, userId, (current) => ({
    ...backupDoc,
    _rev: current._rev,
    updatedAt: new Date().toISOString(),
  }));

  return { status: 'rolled-back', userId, backupFile };
}

module.exports = { runMigration, rollback, MigrationError, getSchemaVersion };
