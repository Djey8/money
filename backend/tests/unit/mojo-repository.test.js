'use strict';

const { EncryptionSession } = require('@money/domain');
const { getMojoStatus, updateMojoTarget } = require('../../repositories/mojo-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('getMojoStatus', () => {
  it('computes status from the stored decimal Mojo balance', async () => {
    const deps = dependencies({ mojo: { amount: 1500, target: 2000 } });
    const status = await getMojoStatus(deps, 'user_1');
    expect(status).toEqual({
      amountMinor: 150000,
      targetMinor: 200000,
      remainingMinor: 50000,
      percentFilled: 75,
    });
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      mojo: { amount: 150000, target: 200000 },
    });
    const status = await getMojoStatus(deps, 'user_1');
    expect(status.amountMinor).toBe(150000);
    expect(status.targetMinor).toBe(200000);
  });

  it('decrypts Mojo fields when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      { mojo: { amount: encryptField('1500'), target: encryptField('2000') } },
      { key: 'secret', encryptDatabase: true },
    );
    const status = await getMojoStatus(deps, 'user_1');
    expect(status.amountMinor).toBe(150000);
    expect(status.targetMinor).toBe(200000);
  });

  it('returns an all-zero status for a document that exists but has no mojo field yet', async () => {
    const deps = dependencies({ transactions: [] });
    const status = await getMojoStatus(deps, 'user_1');
    expect(status).toEqual({ amountMinor: 0, targetMinor: 0, remainingMinor: 0, percentFilled: 0 });
  });

  it('returns an all-zero status for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    const status = await getMojoStatus(deps, 'user_1');
    expect(status).toEqual({ amountMinor: 0, targetMinor: 0, remainingMinor: 0, percentFilled: 0 });
  });
});

describe('updateMojoTarget', () => {
  it('updates the target and rebuilds the balance from @Mojo transactions, capped at the target', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        mojo: { amount: 1500, target: 2000 },
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -1500,
            date: '2026-09-01',
            time: '10:00',
            category: '@Mojo',
            comment: '',
          },
        ],
      },
    };
    const deps = {
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
    };
    const status = await updateMojoTarget(deps, 'user_1', 300000);
    expect(status).toMatchObject({
      amountMinor: 150000,
      targetMinor: 300000,
      remainingMinor: 150000,
      percentFilled: 50,
    });
    expect(status.effects.mojo).toBeNull();
    expect(document.data.mojo.amount).toBe(1500);
    expect(document.data.mojo.target).toBe(3000);

    const lowered = await updateMojoTarget(deps, 'user_1', 100000);
    expect(lowered.amountMinor).toBe(100000);
    expect(lowered.effects.mojo).toEqual({ beforeMinor: 150000, afterMinor: 100000 });
  });

  it('creates a fresh document for a user with none yet', async () => {
    const notFound = new Error('not_found');
    notFound.statusCode = 404;
    let inserted;
    const deps = {
      usersDb: {
        get: jest.fn(async () => Promise.reject(notFound)),
        insert: jest.fn(async (next) => {
          inserted = next;
        }),
      },
      authDb: { get: jest.fn(async () => Promise.reject(notFound)) },
    };
    const status = await updateMojoTarget(deps, 'user_1', 200000);
    expect(status).toMatchObject({
      amountMinor: 0,
      targetMinor: 200000,
      remainingMinor: 200000,
      percentFilled: 0,
    });
    expect(inserted.data.mojo.target).toBe(2000);
  });

  it('retries on a CouchDB write conflict', async () => {
    let document = { _id: 'user_1', _rev: '1-a', data: { mojo: { amount: 0, target: 100 } } };
    let writes = 0;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          writes += 1;
          if (writes === 1) {
            const error = new Error('conflict');
            error.statusCode = 409;
            throw error;
          }
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(updateMojoTarget(deps, 'user_1', 500)).resolves.toMatchObject({
      targetMinor: 500,
    });
    expect(writes).toBe(2);
    expect(deps.usersDb.get).toHaveBeenCalledTimes(2);
  });

  it('encrypts the stored target when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { mojo: { amount: session.encrypt('1500'), target: session.encrypt('2000') } },
    };
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: {
        get: jest.fn(async () => ({ encryptionConfig: { key: 'secret', encryptDatabase: true } })),
      },
    };
    const status = await updateMojoTarget(deps, 'user_1', 300000);
    expect(status.targetMinor).toBe(300000);
    expect(typeof document.data.mojo.target).toBe('string');
    expect(document.data.mojo.target).toMatch(/^v2:/);
  });
});
