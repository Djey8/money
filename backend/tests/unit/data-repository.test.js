'use strict';

const { EncryptionSession } = require('@money/domain');
const { recalculateUserData, RecalculateError } = require('../../repositories/data-repository');

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
