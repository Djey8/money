'use strict';

const { EncryptionSession } = require('@money/domain');

const DEFAULT_ENCRYPTION_CONFIG = {
  key: 'default',
  encryptLocal: true,
  encryptDatabase: false,
};

async function getEncryptionConfig(authDb, userId) {
  try {
    const authDoc = await authDb.get(userId);
    return authDoc.encryptionConfig || DEFAULT_ENCRYPTION_CONFIG;
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    return DEFAULT_ENCRYPTION_CONFIG;
  }
}

/**
 * Overwrites the stored encryption config wholesale — never re-encrypts any
 * already-stored ciphertext. Callers that allow changing an already-active
 * `key` (not just the two boolean flags) must arrange for re-encryption
 * themselves; the only place that does today is `mm-admin
 * rotate-encryption-key`, deliberately not this function or any HTTP route.
 */
async function setEncryptionConfig(authDb, userId, config) {
  const userDoc = await authDb.get(userId);
  userDoc.encryptionConfig = {
    key: config.key || 'default',
    encryptLocal: !!config.encryptLocal,
    encryptDatabase: !!config.encryptDatabase,
  };
  userDoc.updatedAt = new Date().toISOString();
  await authDb.insert(userDoc);
  return userDoc.encryptionConfig;
}

async function getEncryptionSession(authDb, userId) {
  const encryptionConfig = await getEncryptionConfig(authDb, userId);
  if (!encryptionConfig.encryptDatabase || encryptionConfig.key === 'default') return null;
  return new EncryptionSession(encryptionConfig.key);
}

module.exports = {
  getEncryptionConfig,
  setEncryptionConfig,
  getEncryptionSession,
  DEFAULT_ENCRYPTION_CONFIG,
};
