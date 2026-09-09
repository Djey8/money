'use strict';

const {
  getPublicEncryptionConfig,
  updatePublicEncryptionConfig,
} = require('../../repositories/encryption-config-repository');

function writableAuthDb(initialDoc) {
  let doc = initialDoc;
  return {
    authDb: {
      get: jest.fn(async () => structuredClone(doc)),
      insert: jest.fn(async (next) => {
        doc = next;
      }),
    },
    current: () => doc,
  };
}

describe('getPublicEncryptionConfig', () => {
  it('never returns the raw key', async () => {
    const { authDb } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'super-secret', encryptLocal: true, encryptDatabase: true },
    });
    const config = await getPublicEncryptionConfig({ authDb }, 'user_1');
    expect(config).toEqual({ encryptLocal: true, encryptDatabase: true, keyConfigured: true });
    expect(config.key).toBeUndefined();
  });

  it('reports keyConfigured: false for the default/unset key', async () => {
    const { authDb } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'default', encryptLocal: true, encryptDatabase: false },
    });
    const config = await getPublicEncryptionConfig({ authDb }, 'user_1');
    expect(config.keyConfigured).toBe(false);
  });

  it('returns the default config for a user with no auth doc yet', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const authDb = { get: jest.fn(async () => Promise.reject(error)) };
    const config = await getPublicEncryptionConfig({ authDb }, 'user_1');
    expect(config).toEqual({ encryptLocal: true, encryptDatabase: false, keyConfigured: false });
  });
});

describe('updatePublicEncryptionConfig', () => {
  it('sets an initial key freely when none is active yet', async () => {
    const { authDb, current } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'default', encryptLocal: true, encryptDatabase: false },
    });
    const result = await updatePublicEncryptionConfig({ authDb }, 'user_1', {
      key: 'my-new-key',
      encryptDatabase: true,
    });
    expect(result).toEqual({ encryptLocal: true, encryptDatabase: true, keyConfigured: true });
    expect(current().encryptionConfig.key).toBe('my-new-key');
  });

  it('toggles encryptLocal/encryptDatabase freely without touching an already-active key', async () => {
    const { authDb, current } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'active-key', encryptLocal: true, encryptDatabase: true },
    });
    const result = await updatePublicEncryptionConfig({ authDb }, 'user_1', {
      encryptDatabase: false,
    });
    expect(result.encryptDatabase).toBe(false);
    expect(current().encryptionConfig.key).toBe('active-key');
  });

  it('allows resubmitting the exact same already-active key', async () => {
    const { authDb, current } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'active-key', encryptLocal: true, encryptDatabase: true },
    });
    await updatePublicEncryptionConfig({ authDb }, 'user_1', {
      key: 'active-key',
      encryptLocal: false,
    });
    expect(current().encryptionConfig.key).toBe('active-key');
    expect(current().encryptionConfig.encryptLocal).toBe(false);
  });

  it('rejects changing an already-active key to a different value', async () => {
    const { authDb, current } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'active-key', encryptLocal: true, encryptDatabase: true },
    });
    await expect(
      updatePublicEncryptionConfig({ authDb }, 'user_1', { key: 'different-key' }),
    ).rejects.toThrow('mm-admin rotate-encryption-key');
    expect(current().encryptionConfig.key).toBe('active-key');
  });

  it('sets the error code ENCRYPTION_KEY_ROTATION_REQUIRES_CLI on rejection', async () => {
    const { authDb } = writableAuthDb({
      _id: 'user_1',
      encryptionConfig: { key: 'active-key', encryptLocal: true, encryptDatabase: true },
    });
    await expect(
      updatePublicEncryptionConfig({ authDb }, 'user_1', { key: 'different-key' }),
    ).rejects.toMatchObject({ code: 'ENCRYPTION_KEY_ROTATION_REQUIRES_CLI' });
  });

  it('retries on a write conflict and re-validates against the freshly re-read document, closing the same-user TOCTOU race', async () => {
    // Simulates two concurrent PUTs racing: this call's first read sees no active key, but by
    // the time it tries to write, a concurrent write has already set one (surfaced as a 409,
    // then a second read returning the now-current document) — the retry must re-validate
    // against that fresh state, not silently clobber it using the stale first read.
    let getCallCount = 0;
    const docs = [
      {
        _id: 'user_1',
        encryptionConfig: { key: 'default', encryptLocal: true, encryptDatabase: false },
      },
      {
        _id: 'user_1',
        encryptionConfig: { key: 'winner-key', encryptLocal: true, encryptDatabase: true },
      },
    ];
    const authDb = {
      get: jest.fn(async () => structuredClone(docs[Math.min(getCallCount++, docs.length - 1)])),
      insert: jest.fn(async () => {
        const error = new Error('conflict');
        error.statusCode = 409;
        throw error;
      }),
    };

    await expect(
      updatePublicEncryptionConfig({ authDb }, 'user_1', { key: 'loser-key' }),
    ).rejects.toMatchObject({ code: 'ENCRYPTION_KEY_ROTATION_REQUIRES_CLI' });
    expect(authDb.get).toHaveBeenCalledTimes(2);
  });

  it('gives up after the maximum number of write-conflict retries', async () => {
    const authDb = {
      get: jest.fn(async () => ({
        _id: 'user_1',
        encryptionConfig: { key: 'default', encryptLocal: true, encryptDatabase: false },
      })),
      insert: jest.fn(async () => {
        const error = new Error('conflict');
        error.statusCode = 409;
        throw error;
      }),
    };
    await expect(
      updatePublicEncryptionConfig({ authDb }, 'user_1', { encryptDatabase: true }),
    ).rejects.toThrow('maximum retries');
  });
});
