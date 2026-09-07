'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  filterAndSortTransactions,
  createTransaction,
  getTransaction,
  listTransactions,
} = require('../../repositories/transaction-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('transaction repository', () => {
  it('creates a transaction and rebuilds its derived ledger in one document write', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: { mojo: { amount: 0, target: 100 }, smile: [], fire: [] },
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
    const created = await createTransaction(deps, 'user_1', {
      account: 'Income',
      amountMinor: 125000,
      date: '2026-09-06',
      time: '09:00',
      category: '@Salary',
      comment: 'Pay',
    });
    expect(created.id).toMatch(/^tx_/);
    expect(document.data.transactions[0]).toMatchObject({ id: created.id, amount: 1250 });
    expect(document.data.income.revenue.revenues).toEqual([{ tag: 'Salary', amount: 1250 }]);
  });

  it('encrypts created transactions and derived values when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        mojo: { amount: session.encrypt('0'), target: session.encrypt('100') },
        smile: [],
        fire: [],
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
        get: jest.fn(async () => ({ encryptionConfig: { key: 'secret', encryptDatabase: true } })),
      },
    };
    await createTransaction(deps, 'user_1', {
      account: 'Daily',
      amountMinor: -1234,
      date: '2026-09-06',
      time: '09:00',
      category: '@Food',
      comment: 'Shop',
    });
    expect(session.decrypt(document.data.transactions[0].amount)).toBe('-12.34');
    expect(session.decrypt(document.data.income.expenses.daily[0].amount)).toBe('-12.34');
  });

  it('persists a capped Smile transaction amount and allocation tag', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        mojo: { amount: 0, target: 100 },
        smile: [
          {
            title: 'Holiday',
            buckets: [{ id: 'flight', title: 'Flights', target: 100, amount: 0 }],
          },
        ],
        fire: [],
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
    const created = await createTransaction(deps, 'user_1', {
      account: 'Smile',
      amountMinor: -12000,
      date: '2026-09-06',
      time: '09:00',
      category: '@Holiday',
      comment: 'Fund #bucket:Flights:120',
    });
    expect(created).toMatchObject({ amountMinor: -10000, comment: 'Fund\n#bucket:Flights:100.00' });
    expect(document.data.transactions[0]).toMatchObject({
      amount: -100,
      comment: 'Fund\n#bucket:Flights:100.00',
    });
    expect(document.data.smile[0].buckets[0].amount).toBe(100);
  });

  it('retries a CouchDB conflict using a fresh document read', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: { mojo: { amount: 0, target: 100 }, smile: [], fire: [] },
    };
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
    await expect(
      createTransaction(deps, 'user_1', {
        account: 'Daily',
        amountMinor: -100,
        date: '2026-09-06',
        time: '09:00',
        category: '@Food',
        comment: 'Shop',
      }),
    ).resolves.toMatchObject({ id: expect.stringMatching(/^tx_/) });
    expect(writes).toBe(2);
    expect(deps.usersDb.get).toHaveBeenCalledTimes(2);
  });
  it('returns an empty paginated result when the user has no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = { usersDb: { get: jest.fn(async () => Promise.reject(error)) }, authDb: {} };
    await expect(listTransactions(deps, 'user_1')).resolves.toEqual({
      transactions: [],
      nextCursor: null,
    });
  });

  it('maps v1 decimal transactions to API minor units without touching storage', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -12.5,
          date: '2026-09-06',
          time: '09:30',
          category: '@Food',
          comment: 'Shop',
        },
      ],
    });
    await expect(listTransactions(deps, 'user_1')).resolves.toEqual({
      transactions: [expect.objectContaining({ id: 'tx_1', amountMinor: -1250, currency: 'EUR' })],
      nextCursor: null,
    });
  });

  it('decrypts per-field transaction values before mapping', async () => {
    const session = new EncryptionSession('secret');
    const encrypted = Object.fromEntries(
      Object.entries({
        id: 'tx_1',
        account: 'Daily',
        amount: '-12.5',
        date: '2026-09-06',
        time: '09:30',
        category: '@Food',
        comment: 'Shop',
      }).map(([key, value]) => [key, session.encrypt(value)]),
    );
    const result = await listTransactions(
      dependencies({ transactions: [encrypted] }, { key: 'secret', encryptDatabase: true }),
      'user_1',
    );
    expect(result.transactions[0]).toMatchObject({
      id: 'tx_1',
      amountMinor: -1250,
      comment: 'Shop',
    });
  });

  it('finds one transaction without exposing another record', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -1,
          date: '2026-09-06',
          time: '09:30',
          category: '@Food',
          comment: 'One',
        },
        {
          id: 'tx_2',
          account: 'Daily',
          amount: -2,
          date: '2026-09-06',
          time: '09:31',
          category: '@Food',
          comment: 'Two',
        },
      ],
    });
    await expect(getTransaction(deps, 'user_1', 'tx_2')).resolves.toMatchObject({
      id: 'tx_2',
      amountMinor: -200,
      comment: 'Two',
    });
    await expect(getTransaction(deps, 'user_1', 'tx_missing')).resolves.toBeNull();
  });

  it('filters and sorts without mutating the API transaction collection', () => {
    const transactions = [
      {
        id: 'tx_1',
        account: 'Daily',
        category: '@Food',
        date: '2026-09-02',
        time: '09:00',
        amountMinor: -100,
      },
      {
        id: 'tx_2',
        account: 'Income',
        category: '@Salary',
        date: '2026-09-01',
        time: '10:00',
        amountMinor: 200,
      },
    ];
    expect(
      filterAndSortTransactions(transactions, { account: 'Daily', sort: 'date', order: 'asc' }),
    ).toEqual([transactions[0]]);
    expect(
      filterAndSortTransactions(transactions, { sort: 'amount', order: 'asc' }).map(
        (transaction) => transaction.id,
      ),
    ).toEqual(['tx_1', 'tx_2']);
    expect(transactions.map((transaction) => transaction.id)).toEqual(['tx_1', 'tx_2']);
  });
});
