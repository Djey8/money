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

// One EncryptionSession per user, reused across requests: its derived-key
// cache is what makes decrypting a large collection cheap (one PBKDF2 per
// distinct salt, not per request). Keyed by the password too, so changing the
// stored key (mm-admin rotate-encryption-key) transparently gets a fresh
// session. Bounded so a many-user server can't grow it without limit.
const MAX_CACHED_SESSIONS = 50;
const sessionCache = new Map();

function cachedSession(userId, key) {
  const hit = sessionCache.get(userId);
  if (hit && hit.key === key) {
    sessionCache.delete(userId); // refresh recency
    sessionCache.set(userId, hit);
    return hit.session;
  }
  const session = new EncryptionSession(key);
  sessionCache.delete(userId);
  sessionCache.set(userId, { key, session });
  if (sessionCache.size > MAX_CACHED_SESSIONS) {
    sessionCache.delete(sessionCache.keys().next().value);
  }
  return session;
}

async function getEncryptionSession(authDb, userId) {
  const encryptionConfig = await getEncryptionConfig(authDb, userId);
  if (!encryptionConfig.encryptDatabase || encryptionConfig.key === 'default') return null;
  return cachedSession(userId, encryptionConfig.key);
}

module.exports = {
  getEncryptionConfig,
  setEncryptionConfig,
  getEncryptionSession,
  DEFAULT_ENCRYPTION_CONFIG,
};
