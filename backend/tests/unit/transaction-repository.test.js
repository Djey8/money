'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  filterAndSortTransactions,
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
