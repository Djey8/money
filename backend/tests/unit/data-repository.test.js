'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  recalculateUserData,
  RecalculateError,
  exportUserData,
} = require('../../repositories/data-repository');

describe('exportUserData', () => {
  it('returns the document data as-is, plus createdAt/updatedAt, for an unencrypted account', async () => {
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          _rev: '1-a',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
          data: { transactions: [{ id: 'tx_1', amount: -12.5 }], meta: { schemaVersion: 1 } },
        })),
      },
      authDb: { get: jest.fn(async () => ({})) },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result).toEqual({
      data: { transactions: [{ id: 'tx_1', amount: -12.5 }], meta: { schemaVersion: 1 } },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('decrypts every encrypted value in the document, unlike the legacy as-stored export', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            transactions: [{ id: 'tx_1', amount: session.encrypt('-12.5') }],
            smile: [{ title: session.encrypt('Vacation') }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    // A real number, not the stringified form encryption stores it as —
    // matches what an unencrypted account's export returns for the same field.
    expect(result.data.transactions[0].amount).toBe(-12.5);
    expect(typeof result.data.transactions[0].amount).toBe('number');
    expect(result.data.smile[0].title).toBe('Vacation');
  });

  it('recovers quantity/riskScore as numbers too, not just documented money fields', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            grow: [{ riskScore: session.encrypt('4'), share: { quantity: session.encrypt('12') } }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result.data.grow[0].riskScore).toBe(4);
    expect(result.data.grow[0].share.quantity).toBe(12);
  });

  it('recovers settings.allocation fields as numbers and boolean fields as real booleans', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            settings: {
              isEuropeanFormat: session.encrypt('true'),
              allocation: {
                daily: session.encrypt('60'),
                splurge: session.encrypt('10'),
                smile: session.encrypt('10'),
                fire: session.encrypt('20'),
              },
            },
            grow: [{ isAsset: session.encrypt('false') }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result.data.settings.allocation).toEqual({
      daily: 60,
      splurge: 10,
      smile: 10,
      fire: 20,
    });
    expect(result.data.settings.isEuropeanFormat).toBe(true);
    expect(result.data.grow[0].isAsset).toBe(false);
  });

  it('recovers manuallyAdjusted on a Smile/Fire payment plan as a real boolean', async () => {
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: {
            smile: [{ plannedSubscriptions: [{ manuallyAdjusted: session.encrypt('true') }] }],
          },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await exportUserData(deps, 'user_1');

    expect(result.data.smile[0].plannedSubscriptions[0].manuallyAdjusted).toBe(true);
  });

  it('throws rather than silently returning leftover ciphertext when encryptDatabase was toggled off', async () => {
    // PUT /encryption-config allows turning encryptDatabase off without re-encrypting
    // already-stored data — getEncryptionSession then returns null even though the
    // document can still hold real ciphertext from when it was on.
    const session = new EncryptionSession('secret');
    const deps = {
      usersDb: {
        get: jest.fn(async () => ({
          _id: 'user_1',
          data: { transactions: [{ id: 'tx_1', amount: session.encrypt('-12.5') }] },
        })),
      },
      authDb: {
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: false },
        })),
      },
    };

    await expect(exportUserData(deps, 'user_1')).rejects.toThrow(/no decrypt callback/);
  });

  it('never includes the encryption config or key, since it only ever reads usersDb data', async () => {
    const usersDb = {
      get: jest.fn(async () => ({ _id: 'user_1', data: { transactions: [] } })),
    };
    const authDb = {
      get: jest.fn(async () => ({
        encryptionConfig: { key: 'super-secret-key', encryptLocal: true, encryptDatabase: true },
      })),
    };

    const result = await exportUserData({ usersDb, authDb }, 'user_1');

    expect(JSON.stringify(result)).not.toContain('super-secret-key');
    expect(result.encryptionConfig).toBeUndefined();
  });

  it('returns an empty document for a user with no data yet, matching the legacy 404 fallback', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    const result = await exportUserData({ usersDb, authDb }, 'user_1');

    expect(result).toEqual({ data: {}, createdAt: null, updatedAt: null });
  });

  it('propagates a real (non-404) database error rather than masking it as empty data', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    await expect(exportUserData({ usersDb, authDb }, 'user_1')).rejects.toThrow('ECONNRESET');
  });
});

describe('recalculateUserData', () => {
  it('forces a full derived-state recalculation and reports the transaction count', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        mojo: { amount: 0, target: 100 },
        smile: [],
        fire: [],
        transactions: [
          {
            id: 'tx_1',
            account: 'Income',
            amount: 1250,
            date: '2026-09-06',
            time: '09:00',
            category: '@Salary',
            comment: 'Pay',
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

    const result = await recalculateUserData(deps, 'user_1');

    expect(result).toEqual({ transactionCount: 1 });
    // The recalculation actually ran and wrote the derived accounting state
    // back, not just re-saved the transactions untouched.
    expect(document.data.income.revenue.revenues).toEqual([{ tag: 'Salary', amount: 1250 }]);
  });

  it('does not add, remove, or otherwise change the stored transactions themselves', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -12.5,
            date: '2026-01-01',
            time: '08:00',
            category: '@Food',
            comment: '',
          },
          {
            id: 'tx_2',
            account: 'Income',
            amount: 3000,
            date: '2026-01-02',
            time: '09:00',
            category: '@Salary',
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
      authDb: { get: jest.fn(async () => ({})) },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result.transactionCount).toBe(2);
    expect(document.data.transactions).toHaveLength(2);
    expect(document.data.transactions.map((tx) => tx.id).sort()).toEqual(['tx_1', 'tx_2']);
  });

  it('recalculates an encrypted document, decrypting and re-encrypting the derived fields', async () => {
    const session = new EncryptionSession('secret');
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: session.encrypt('tx_1'),
            account: session.encrypt('Income'),
            amount: session.encrypt('1250'),
            date: session.encrypt('2026-09-06'),
            time: session.encrypt('09:00'),
            category: session.encrypt('@Salary'),
            comment: session.encrypt('Pay'),
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
          encryptionConfig: { key: 'secret', encryptLocal: true, encryptDatabase: true },
        })),
      },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result.transactionCount).toBe(1);
    expect(session.decrypt(document.data.income.revenue.revenues[0].tag)).toBe('Salary');
  });

  it('returns a zero count without writing anything for a user with no document yet', async () => {
    const usersDb = {
      get: jest.fn(async () => {
        const err = new Error('not_found');
        err.statusCode = 404;
        throw err;
      }),
      insert: jest.fn(),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    const result = await recalculateUserData({ usersDb, authDb }, 'user_1');

    expect(result).toEqual({ transactionCount: 0 });
    expect(usersDb.insert).not.toHaveBeenCalled();
  });

  it('refuses to recalculate rather than silently dropping a zero-amount transaction', async () => {
    // recalculateFundState (packages/domain/src/transactions/fund-state.ts) excludes any
    // transaction with amountMinor === 0 from its output, and withTransactionsWrite writes back
    // exactly what that engine returns — so recalculating an account holding a zero-amount
    // transaction (impossible to create through this API, but reachable via legacy or imported
    // data) would otherwise silently delete it on write. This must refuse instead.
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: 0,
            date: '2026-01-01',
            time: '08:00',
            category: '@Log',
            comment: '',
          },
          {
            id: 'tx_2',
            account: 'Income',
            amount: 3000,
            date: '2026-01-02',
            time: '09:00',
            category: '@Salary',
            comment: '',
          },
        ],
      },
    };
    const usersDb = {
      get: jest.fn(async () => structuredClone(document)),
      insert: jest.fn(async (next) => {
        document = { ...next, _rev: '2-b' };
      }),
    };
    const authDb = { get: jest.fn(async () => ({})) };

    await expect(recalculateUserData({ usersDb, authDb }, 'user_1')).rejects.toThrow(
      RecalculateError,
    );
    await expect(recalculateUserData({ usersDb, authDb }, 'user_1')).rejects.toMatchObject({
      code: 'RECALCULATE_WOULD_DROP_TRANSACTIONS',
    });

    // Nothing was written — both transactions are still exactly as stored.
    expect(usersDb.insert).not.toHaveBeenCalled();
    expect(document.data.transactions).toHaveLength(2);
  });

  it('retries on a CouchDB write conflict', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -5,
            date: '2026-01-01',
            time: '08:00',
            category: '@Food',
            comment: '',
          },
        ],
      },
    };
    let insertAttempts = 0;
    const deps = {
      usersDb: {
        get: jest.fn(async () => structuredClone(document)),
        insert: jest.fn(async (next) => {
          insertAttempts += 1;
          if (insertAttempts === 1) {
            const err = new Error('conflict');
            err.statusCode = 409;
            throw err;
          }
          document = { ...next, _rev: '2-b' };
        }),
      },
      authDb: { get: jest.fn(async () => ({})) },
    };

    const result = await recalculateUserData(deps, 'user_1');

    expect(result.transactionCount).toBe(1);
    expect(insertAttempts).toBeGreaterThanOrEqual(2);
  });
});
