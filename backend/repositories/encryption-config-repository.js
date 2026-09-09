'use strict';

/**
 * `GET/PUT /encryption-config` (SET-6). Wraps the same
 * `getEncryptionConfig`/`setEncryptionConfig` the legacy session-only
 * `/auth/encryption-config` routes and `getEncryptionSession` already share
 * (`services/encryption-session.js`) — no separate copy of the read/write
 * logic.
 *
 * Two corrections versus the legacy route, both deliberate:
 *
 * 1. **`GET` never returns the raw key.** The legacy route returns
 *    `{key, encryptLocal, encryptDatabase}` verbatim — fine for the user's
 *    own browser, but an MCP tool or agent reading this endpoint would put
 *    the plaintext key in its own context, directly contradicting
 *    ADR-0001's "keys never appear in a prompt" principle. This returns
 *    `{encryptLocal, encryptDatabase, keyConfigured}` instead.
 * 2. **`PUT` cannot change an already-active key.** The backend has no
 *    re-encryption logic anywhere — nothing here ever re-processes
 *    already-stored ciphertext, only the config metadata. The legacy route
 *    gets away with this because the Angular client already holds
 *    decrypted data in memory and rewrites every collection after the swap
 *    (`cryptic.service.ts`'s `save()` → `updateStorage()`); a bare API call
 *    has no such safety net, so changing a key that's already protecting
 *    real data here would make every existing encrypted field permanently
 *    unreadable. Toggling `encryptLocal`/`encryptDatabase` alone, or
 *    setting an initial key when none is active yet (current key is
 *    `'default'` or unset), is always allowed. Real key rotation requires
 *    `mm-admin rotate-encryption-key`, which decrypts-and-re-encrypts the
 *    whole document under its own dry-run/backup/verify/rollback cycle.
 *
 * `updatePublicEncryptionConfig` reads, validates, and writes within one
 * retry-on-409 loop (rather than delegating to `setEncryptionConfig`, which
 * does its own independent read) — closes a same-user race where two
 * concurrent `PUT`s could both observe no active key, both pass the
 * rotation guard, and the second write would silently clobber the first
 * with a stale-`current` write. Each retry re-reads and re-validates
 * against the latest document instead.
 */

const {
  getEncryptionConfig,
  DEFAULT_ENCRYPTION_CONFIG,
} = require('../services/encryption-session');

const MAX_WRITE_RETRIES = 10;

function toPublicConfig(config) {
  return {
    encryptLocal: !!config.encryptLocal,
    encryptDatabase: !!config.encryptDatabase,
    keyConfigured: !!config.key && config.key !== 'default',
  };
}

async function getPublicEncryptionConfig({ authDb }, userId) {
  const config = await getEncryptionConfig(authDb, userId);
  return toPublicConfig(config);
}

async function updatePublicEncryptionConfig({ authDb }, userId, input) {
  let attempt = 0;
  while (attempt < MAX_WRITE_RETRIES) {
    const userDoc = await authDb.get(userId);
    const current = userDoc.encryptionConfig || DEFAULT_ENCRYPTION_CONFIG;
    const hasActiveKey = !!current.key && current.key !== 'default';
    const requestedKey = input.key === undefined ? current.key : input.key;

    if (hasActiveKey && requestedKey !== current.key) {
      const error = new Error(
        'Changing an already-active encryption key requires mm-admin rotate-encryption-key — ' +
          'changing it here would make all existing encrypted data permanently unreadable.',
      );
      error.code = 'ENCRYPTION_KEY_ROTATION_REQUIRES_CLI';
      throw error;
    }

    const updated = {
      key: requestedKey || 'default',
      encryptLocal: !!(input.encryptLocal === undefined
        ? current.encryptLocal
        : input.encryptLocal),
      encryptDatabase: !!(input.encryptDatabase === undefined
        ? current.encryptDatabase
        : input.encryptDatabase),
    };
    userDoc.encryptionConfig = updated;
    userDoc.updatedAt = new Date().toISOString();
    try {
      await authDb.insert(userDoc);
      return toPublicConfig(updated);
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      attempt += 1;
    }
  }
  throw new Error(
    'Failed to update encryption config after maximum retries due to write conflicts',
  );
}

module.exports = { getPublicEncryptionConfig, updatePublicEncryptionConfig };
