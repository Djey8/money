'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  getSettings,
  updateSettings,
  DEFAULT_SETTINGS,
} = require('../../repositories/settings-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

function writableDeps(initialDocument) {
  let document = initialDocument;
  return {
    deps: {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    },
    current: () => document,
  };
}

describe('getSettings', () => {
  it('returns the confirmed original defaults when no settings have ever been saved', async () => {
    const deps = dependencies({});
    const settings = await getSettings(deps, 'user_1');
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns an empty-default set for a user with no data document at all', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(getSettings(deps, 'user_1')).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('decrypts and normalizes stored settings', async () => {
    const deps = dependencies({
      settings: {
        username: 'jkluess',
        currency: '$',
        theme: 'dark',
        language: 'de',
        dateFormat: 'yyyy-MM-dd',
        isEuropeanFormat: false,
        allocation: { daily: 50, splurge: 20, smile: 10, fire: 20 },
      },
    });
    const settings = await getSettings(deps, 'user_1');
    expect(settings).toEqual({
      username: 'jkluess',
      currency: '$',
      theme: 'dark',
      language: 'de',
      dateFormat: 'yyyy-MM-dd',
      isEuropeanFormat: false,
      allocation: { daily: 50, splurge: 20, smile: 10, fire: 20 },
    });
  });

  it('decrypts every field, including the boolean isEuropeanFormat, when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        settings: {
          username: encryptField('jkluess'),
          isEuropeanFormat: encryptField(false),
          allocation: {
            daily: encryptField(50),
            splurge: encryptField(20),
            smile: encryptField(10),
            fire: encryptField(20),
          },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const settings = await getSettings(deps, 'user_1');
    expect(settings.username).toBe('jkluess');
    expect(settings.isEuropeanFormat).toBe(false);
    expect(settings.allocation).toEqual({ daily: 50, splurge: 20, smile: 10, fire: 20 });
  });

  it('falls back to the default for a field missing from an older/partial stored object', async () => {
    const deps = dependencies({ settings: { username: 'jkluess' } });
    const settings = await getSettings(deps, 'user_1');
    expect(settings.username).toBe('jkluess');
    expect(settings.currency).toBe(DEFAULT_SETTINGS.currency);
    expect(settings.allocation).toEqual(DEFAULT_SETTINGS.allocation);
  });

  it('falls back to the default for a corrupted isEuropeanFormat value that is neither true/false nor "true"/"false"', async () => {
    const deps = dependencies({ settings: { isEuropeanFormat: 0 } });
    const settings = await getSettings(deps, 'user_1');
    expect(settings.isEuropeanFormat).toBe(DEFAULT_SETTINGS.isEuropeanFormat);
  });
});

describe('updateSettings', () => {
  it('applies a partial patch, leaving every other field untouched', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: {} };
    const { deps, current } = writableDeps(document);
    const updated = await updateSettings(deps, 'user_1', { currency: '$' });
    expect(updated.currency).toBe('$');
    expect(updated.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(current().data.settings.currency).toBe('$');
  });

  it('replaces allocation as a whole unit when provided', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: {} };
    const { deps } = writableDeps(document);
    const updated = await updateSettings(deps, 'user_1', {
      allocation: { daily: 40, splurge: 20, smile: 20, fire: 20 },
    });
    expect(updated.allocation).toEqual({ daily: 40, splurge: 20, smile: 20, fire: 20 });
  });

  it('persists across repeated reads', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: {} };
    const { deps } = writableDeps(document);
    await updateSettings(deps, 'user_1', { username: 'jkluess', theme: 'dark' });
    const settings = await getSettings(deps, 'user_1');
    expect(settings.username).toBe('jkluess');
    expect(settings.theme).toBe('dark');
  });
});
