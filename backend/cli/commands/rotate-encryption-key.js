'use strict';

/**
 * `mm-admin rotate-encryption-key` — changes a user's already-active
 * database encryption key, decrypting and re-encrypting every encrypted
 * field in their document AND every encrypted audit-log payload
 * (`docs/adr/0001-pro-api-encryption-handling.md`: "Audit log entries
 * encrypt any payload/diff content with the same per-user key"). This is
 * the only place in the codebase allowed to do that: `PUT
 * /api/v1/encryption-config` (`encryption-config-repository.js`)
 * deliberately rejects any attempt to change an already-active key, because
 * nothing in that path re-processes existing ciphertext — changing the key
 * there would make all previously-encrypted data (and, just as easily
 * forgotten, all previously-encrypted audit payloads) permanently
 * unreadable. This tool exists specifically to do that re-processing
 * safely, for both databases.
 *
 * Modeled on `mm-admin migrate`'s safety cycle (JFK's explicit requirement:
 * "nothing I use today may break, must be reversible"):
 *   - Rejects rotation for a user with no active key/encryption enabled —
 *     there's nothing to re-encrypt, and setting an initial key doesn't
 *     need this tool (use `PUT /encryption-config` directly).
 *   - No-op if `--new-key` equals the current key.
 *   - Backed up before any write: the `usersDb` data document, the `authDb`
 *     encryption-config document, and every encrypted audit entry for this
 *     user — all three change, to one combined JSON file.
 *   - Verified after write by independently re-reading everything written
 *     and decrypting it with the *new* key, then comparing against a full
 *     plaintext snapshot decrypted with the *old* key before the rewrite —
 *     not just a count or a spot check. Any mismatch triggers an automatic
 *     restore from the backup (all three) and a non-zero exit.
 *   - Write order is: data document (written + verified) → audit entries
 *     (written + verified) → `authDb`'s `encryptionConfig.key` last. Any
 *     later step failing rolls back everything written by earlier steps,
 *     so `authDb` is only ever updated once both databases' ciphertext is
 *     confirmed re-keyed — minimizing (never fully eliminating — a process
 *     kill between the last write and the return can't be caught here) the
 *     window where the databases could disagree about which key is active.
 *   - `--dry-run` never writes or backs up anything.
 */

const fs = require('fs');
const path = require('path');
const { EncryptionSession, rewriteEncryptedValues } = require('@money/domain');
const { DEFAULT_ENCRYPTION_CONFIG } = require('../../services/encryption-session');

const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', '..', 'migration-backups');
const MAX_WRITE_RETRIES = 10;
// Audit logs are expected to stay small per user (same assumption
// `queryAuditEntries` in config/audit.js makes) — this is generous headroom,
// not a soft cap; hitting it aborts the rotation rather than silently
// re-keying only part of the log (see the check right after the fetch).
const AUDIT_OVERFETCH_LIMIT = 5000;

class RotationError extends Error {}

function writeBackupFile(backupDir, userId, backup) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(backupDir, `${userId}-key-rotation-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8');
  return filePath;
}

/** Writes via `mutate(current)`, retrying on CouchDB 409 conflicts by re-fetching the latest revision. */
async function writeWithRetry(db, docId, mutate) {
  let attempt = 0;
  let lastError;
  while (attempt < MAX_WRITE_RETRIES) {
    try {
      const current = await db.get(docId);
      const mutated = mutate(current);
      return await db.insert(mutated);
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
 * Rolls back from `backupFile` and throws a `RotationError` describing the
 * original problem. If the rollback write itself also fails (a truly broken
 * database, not just a transient rotation issue), that failure is appended
 * rather than replacing the original message — otherwise an operator
 * debugging a double-failure would lose both the original cause and the
 * backup file path, their only remaining recovery route.
 */
async function rollbackOrExplain(usersDb, authDb, auditDb, userId, backupFile, reason) {
  try {
    await restoreFromBackup(usersDb, authDb, auditDb, userId, backupFile);
  } catch (rollbackErr) {
    throw new RotationError(
      `${reason} Automatic rollback from ${backupFile} ALSO FAILED (${rollbackErr.message}) — ` +
        `data, audit log, and/or the active-key record may now be inconsistent. Restore ${backupFile} manually.`,
    );
  }
  throw new RotationError(`${reason} Automatically rolled back from ${backupFile}.`);
}

async function restoreFromBackup(usersDb, authDb, auditDb, userId, backupFile) {
  const raw = fs.readFileSync(backupFile, 'utf8');
  const { userDoc, authDoc, auditEntries } = JSON.parse(raw);
  await writeWithRetry(usersDb, userId, (current) => ({
    ...userDoc,
    _rev: current._rev,
    updatedAt: new Date().toISOString(),
  }));
  await writeWithRetry(authDb, userId, (current) => ({
    ...authDoc,
    _rev: current._rev,
    updatedAt: new Date().toISOString(),
  }));
  for (const entry of auditEntries || []) {
    await writeWithRetry(auditDb, entry._id, (current) => ({
      ...current,
      payload: entry.payload,
      payloadEncrypted: entry.payloadEncrypted,
    }));
  }
  return { status: 'rolled-back', userId, backupFile };
}

/**
 * @param {object} deps - { usersDb, authDb, auditDb } (injected for testability)
 * @param {object} options - { userId, newKey, dryRun, backupDir, rollbackFile }
 */
async function runRotateEncryptionKey(deps, options) {
  const { usersDb, authDb, auditDb } = deps;
  const { userId, newKey, dryRun = false, backupDir = DEFAULT_BACKUP_DIR, rollbackFile } = options;

  if (!userId) throw new RotationError('--user <id> is required');

  if (rollbackFile) {
    return restoreFromBackup(usersDb, authDb, auditDb, userId, rollbackFile);
  }

  if (typeof newKey !== 'string' || newKey.trim() === '') {
    throw new RotationError('--new-key <key> is required');
  }
  const trimmedNewKey = newKey.trim();

  const authDoc = await authDb.get(userId);
  const currentConfig = authDoc.encryptionConfig || DEFAULT_ENCRYPTION_CONFIG;
  const hasActiveKey = !!currentConfig.key && currentConfig.key !== 'default';

  if (!hasActiveKey || !currentConfig.encryptDatabase) {
    throw new RotationError(
      `User ${userId} has no active database encryption key to rotate. This tool only re-keys already-encrypted data — use PUT /api/v1/encryption-config to set an initial key instead.`,
    );
  }

  if (trimmedNewKey === currentConfig.key) {
    return { status: 'already-active', userId };
  }

  const oldSession = new EncryptionSession(currentConfig.key);
  const newSession = new EncryptionSession(trimmedNewKey);

  const userDoc = await usersDb.get(userId);
  const { data: beforePlaintext } = rewriteEncryptedValues(userDoc.data, (v) =>
    oldSession.decrypt(v),
  );
  const { data: reencryptedData, rewrittenPaths } = rewriteEncryptedValues(userDoc.data, (v) =>
    newSession.encrypt(oldSession.decrypt(v)),
  );

  const auditResult = await auditDb.find({
    selector: { userId, payloadEncrypted: true },
    limit: AUDIT_OVERFETCH_LIMIT,
  });
  const auditEntries = auditResult.docs;
  if (auditEntries.length === AUDIT_OVERFETCH_LIMIT) {
    throw new RotationError(
      `User ${userId} has at least ${AUDIT_OVERFETCH_LIMIT} encrypted audit entries — refusing to ` +
        'rotate without a way to guarantee all of them get re-keyed. Raise AUDIT_OVERFETCH_LIMIT in ' +
        'rotate-encryption-key.js and retry.',
    );
  }
  const auditBeforePlaintext = auditEntries.map((entry) => oldSession.decrypt(entry.payload));

  if (dryRun) {
    return {
      status: 'dry-run',
      userId,
      fieldsReencrypted: rewrittenPaths.length,
      auditEntriesReencrypted: auditEntries.length,
    };
  }

  const backupFile = writeBackupFile(backupDir, userId, {
    userDoc,
    authDoc,
    auditEntries: auditEntries.map((entry) => ({
      _id: entry._id,
      payload: entry.payload,
      payloadEncrypted: entry.payloadEncrypted,
    })),
  });
  // Printed before any write that could be interrupted, so an operator
  // whose process gets killed mid-rotation still has the one thing needed
  // to recover manually: `mm-admin rotate-encryption-key --user <id>
  // --rollback <backupFile>`. Nothing below this line is logged on success —
  // the final `return` is the normal, non-interrupted completion report.
  console.error(`Backup written to ${backupFile}`);

  await writeWithRetry(usersDb, userId, (current) => ({
    ...current,
    data: reencryptedData,
    updatedAt: new Date().toISOString(),
  }));

  // Independent verification: re-read what was actually persisted, decrypt
  // it with the *new* key, and compare against the plaintext snapshot taken
  // (with the *old* key) before the rewrite — not just trusting the
  // in-memory `reencryptedData` we just wrote.
  const writtenUserDoc = await usersDb.get(userId);
  const { data: afterPlaintext } = rewriteEncryptedValues(writtenUserDoc.data, (v) =>
    newSession.decrypt(v),
  );

  if (JSON.stringify(afterPlaintext) !== JSON.stringify(beforePlaintext)) {
    await rollbackOrExplain(
      usersDb,
      authDb,
      auditDb,
      userId,
      backupFile,
      `Verification failed for user ${userId}: decrypted content before and after rotation did not match.`,
    );
  }

  for (const entry of auditEntries) {
    try {
      await writeWithRetry(auditDb, entry._id, (current) => ({
        ...current,
        payload: newSession.encrypt(oldSession.decrypt(current.payload)),
      }));
    } catch (err) {
      await rollbackOrExplain(
        usersDb,
        authDb,
        auditDb,
        userId,
        backupFile,
        `Data was re-encrypted and verified, but re-encrypting audit entry ${entry._id} failed (${err.message}).`,
      );
    }
  }

  for (let i = 0; i < auditEntries.length; i += 1) {
    const written = await auditDb.get(auditEntries[i]._id);
    if (newSession.decrypt(written.payload) !== auditBeforePlaintext[i]) {
      await rollbackOrExplain(
        usersDb,
        authDb,
        auditDb,
        userId,
        backupFile,
        `Verification failed for audit entry ${auditEntries[i]._id}: decrypted content before and after rotation did not match.`,
      );
    }
  }

  try {
    await writeWithRetry(authDb, userId, (current) => ({
      ...current,
      encryptionConfig: { ...currentConfig, key: trimmedNewKey },
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    await rollbackOrExplain(
      usersDb,
      authDb,
      auditDb,
      userId,
      backupFile,
      `Data and audit entries were re-encrypted and verified, but recording the new active key failed (${err.message}).`,
    );
  }

  return {
    status: 'rotated',
    userId,
    fieldsReencrypted: rewrittenPaths.length,
    auditEntriesReencrypted: auditEntries.length,
    backupFile,
  };
}

module.exports = { runRotateEncryptionKey, restoreFromBackup, RotationError };
