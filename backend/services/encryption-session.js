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

async function getEncryptionSession(authDb, userId) {
  const encryptionConfig = await getEncryptionConfig(authDb, userId);
  if (!encryptionConfig.encryptDatabase || encryptionConfig.key === 'default') return null;
  return new EncryptionSession(encryptionConfig.key);
}

module.exports = { getEncryptionConfig, getEncryptionSession, DEFAULT_ENCRYPTION_CONFIG };
