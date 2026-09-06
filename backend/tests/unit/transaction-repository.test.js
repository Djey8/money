'use strict';

const { EncryptionSession } = require('@money/domain');
const { listTransactions } = require('../../repositories/transaction-repository');

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
});
