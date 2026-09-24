'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  filterAndSortTransactions,
  batchTransactions,
  copyTransaction,
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
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

  it('copies a transaction with a new id and today as the default date/time', async () => {
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
    const source = await createTransaction(deps, 'user_1', {
      account: 'Daily',
      amountMinor: -1500,
      date: '2020-01-01',
      time: '08:00',
      category: '@Food',
      comment: 'Original',
    });
    const copy = await copyTransaction(deps, 'user_1', source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({
      account: 'Daily',
      amountMinor: -1500,
      category: '@Food',
      comment: 'Original',
    });
    expect(copy.date).not.toBe('2020-01-01');
    expect(document.data.transactions).toHaveLength(2);
  });

  it('applies overrides on top of the copied source transaction', async () => {
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
    const source = await createTransaction(deps, 'user_1', {
      account: 'Daily',
      amountMinor: -1500,
      date: '2026-09-06',
      time: '08:00',
      category: '@Food',
      comment: 'Original',
    });
    const copy = await copyTransaction(deps, 'user_1', source.id, {
      amountMinor: -900,
      comment: 'Overridden',
    });
    expect(copy).toMatchObject({ amountMinor: -900, comment: 'Overridden', category: '@Food' });
  });

  it('rejects a copy override that touches only one of a coupled bucket-tagged pair', async () => {
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
            buckets: [{ id: 'flight', title: 'Flights', target: 10000, amount: 0 }],
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
    const source = await createTransaction(deps, 'user_1', {
      account: 'Smile',
      amountMinor: -5000,
      date: '2026-09-06',
      time: '09:00',
      category: '@Holiday',
      comment: '#bucket:Flights:50.00',
    });
    await expect(
      copyTransaction(deps, 'user_1', source.id, { amountMinor: -7000 }),
    ).rejects.toMatchObject({ code: 'BUCKET_PATCH_REQUIRES_BOTH_FIELDS' });
  });

  it('returns null copying a transaction id that does not exist', async () => {
    const deps = dependencies({ transactions: [] });
    await expect(copyTransaction(deps, 'user_1', 'tx_missing')).resolves.toBeNull();
  });

  it('updates a transaction field and rebuilds derived state from the merged record', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Income',
            amount: 1000,
            date: '2026-09-06',
            time: '09:00',
            category: '@Salary',
            comment: '',
          },
        ],
        mojo: { amount: 0, target: 100 },
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
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    const updated = await updateTransaction(deps, 'user_1', 'tx_1', { amountMinor: 150000 });
    expect(updated).toMatchObject({ id: 'tx_1', amountMinor: 150000 });
    expect(document.data.transactions[0]).toMatchObject({ id: 'tx_1', amount: 1500 });
    expect(document.data.income.revenue.revenues).toEqual([{ tag: 'Salary', amount: 1500 }]);
  });

  it('returns null when updating a transaction id that does not exist', async () => {
    const deps = dependencies({ transactions: [] });
    await expect(
      updateTransaction(deps, 'user_1', 'tx_missing', { comment: 'x' }),
    ).resolves.toBeNull();
  });

  it('rejects an amountMinor-only patch that would silently revert to stale bucket tags', async () => {
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
            buckets: [{ id: 'flight', title: 'Flights', target: 10000, amount: 0 }],
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
      amountMinor: -5000,
      date: '2026-09-06',
      time: '09:00',
      category: '@Holiday',
      comment: '#bucket:Flights:50.00',
    });
    await expect(
      updateTransaction(deps, 'user_1', created.id, { amountMinor: -7000 }),
    ).rejects.toMatchObject({ code: 'BUCKET_PATCH_REQUIRES_BOTH_FIELDS' });
    await expect(
      updateTransaction(deps, 'user_1', created.id, { comment: 'no more tags' }),
    ).rejects.toMatchObject({ code: 'BUCKET_PATCH_REQUIRES_BOTH_FIELDS' });
    const updated = await updateTransaction(deps, 'user_1', created.id, {
      amountMinor: -7000,
      comment: '#bucket:Flights:70.00',
    });
    expect(updated).toMatchObject({ amountMinor: -7000 });
  });

  it('retries a CouchDB conflict on update using a fresh document read', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -1,
            date: '2026-09-06',
            time: '09:00',
            category: '@Food',
            comment: '',
          },
        ],
        mojo: { amount: 0, target: 100 },
        smile: [],
        fire: [],
      },
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
      updateTransaction(deps, 'user_1', 'tx_1', { amountMinor: -200 }),
    ).resolves.toMatchObject({ amountMinor: -200 });
    expect(writes).toBe(2);
  });

  it('deletes a transaction and rebuilds derived state without it', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Income',
            amount: 1000,
            date: '2026-09-06',
            time: '09:00',
            category: '@Salary',
            comment: '',
          },
        ],
        mojo: { amount: 0, target: 100 },
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
        get: jest.fn(async () => ({
          encryptionConfig: { key: 'default', encryptDatabase: false },
        })),
      },
    };
    await expect(deleteTransaction(deps, 'user_1', 'tx_1')).resolves.toMatchObject({
      effects: expect.any(Object),
    });
    expect(document.data.transactions).toEqual([]);
    expect(document.data.income.revenue.revenues).toEqual([]);
  });

  it('retries a CouchDB conflict on delete using a fresh document read', async () => {
    let document = {
      _id: 'user_1',
      _rev: '1-a',
      createdAt: 't',
      updatedAt: 't',
      data: {
        transactions: [
          {
            id: 'tx_1',
            account: 'Daily',
            amount: -1,
            date: '2026-09-06',
            time: '09:00',
            category: '@Food',
            comment: '',
          },
        ],
        mojo: { amount: 0, target: 100 },
        smile: [],
        fire: [],
      },
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
    await expect(deleteTransaction(deps, 'user_1', 'tx_1')).resolves.toMatchObject({
      effects: expect.any(Object),
    });
    expect(writes).toBe(2);
    expect(document.data.transactions).toEqual([]);
  });

  it('returns false when deleting a transaction id that does not exist', async () => {
    const deps = dependencies({ transactions: [] });
    await expect(deleteTransaction(deps, 'user_1', 'tx_missing')).resolves.toBe(false);
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

  it("defaults a legacy transaction's empty time to '00:00' instead of rejecting the whole list", async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -9.99,
          date: '2026-09-06',
          time: '',
          category: '@music',
          comment: 'Spotify + Paypal',
        },
      ],
    });
    await expect(listTransactions(deps, 'user_1')).resolves.toEqual({
      transactions: [expect.objectContaining({ id: 'tx_1', time: '00:00' })],
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

describe('batchTransactions', () => {
  function batchDeps(document) {
    let current = document;
    return {
      deps: {
        usersDb: {
          get: jest.fn(async () => structuredClone(current)),
          insert: jest.fn(async (next) => {
            current = { ...next, _rev: '2-b' };
          }),
        },
        authDb: {
          get: jest.fn(async () => ({
            encryptionConfig: { key: 'default', encryptDatabase: false },
          })),
        },
      },
      getDocument: () => current,
    };
  }

  const baseDocument = () => ({
    _id: 'user_1',
    _rev: '1-a',
    createdAt: 't',
    updatedAt: 't',
    data: {
      transactions: [
        {
          id: 'tx_existing',
          account: 'Daily',
          amount: -10,
          date: '2026-09-06',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
      ],
      mojo: { amount: 0, target: 100 },
      smile: [],
      fire: [],
    },
  });

  it('applies a mix of create/update/delete in one document write', async () => {
    const { deps, getDocument } = batchDeps(baseDocument());
    const { results } = await batchTransactions(deps, 'user_1', [
      {
        op: 'create',
        fields: {
          account: 'Income',
          amountMinor: 100000,
          date: '2026-09-06',
          time: '10:00',
          category: '@Salary',
          comment: '',
        },
      },
      { op: 'update', id: 'tx_existing', fields: { amountMinor: -2000 } },
      { op: 'delete', id: 'tx_existing_never_mind' },
    ]);
    expect(results[0]).toMatchObject({ op: 'create', status: 'created' });
    expect(results[0].transaction).toMatchObject({ amountMinor: 100000 });
    expect(results[1]).toMatchObject({ op: 'update', id: 'tx_existing', status: 'updated' });
    expect(results[1].transaction).toMatchObject({ amountMinor: -2000 });
    expect(results[2]).toMatchObject({
      op: 'delete',
      id: 'tx_existing_never_mind',
      status: 'error',
    });
    expect(deps.usersDb.insert).toHaveBeenCalledTimes(1);
    expect(getDocument().data.transactions).toHaveLength(2);
  });

  it('applies successful items and reports failures independently in non-atomic mode', async () => {
    const { deps } = batchDeps(baseDocument());
    const { results } = await batchTransactions(deps, 'user_1', [
      { op: 'update', id: 'tx_missing', fields: { amountMinor: -500 } },
      { op: 'delete', id: 'tx_existing' },
    ]);
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(results[1]).toMatchObject({ status: 'deleted' });
    expect(deps.usersDb.insert).toHaveBeenCalledTimes(1);
  });

  it('rolls back everything in atomic mode when any operation fails', async () => {
    const { deps, getDocument } = batchDeps(baseDocument());
    const { results } = await batchTransactions(
      deps,
      'user_1',
      [
        { op: 'delete', id: 'tx_existing' },
        { op: 'update', id: 'tx_missing', fields: { amountMinor: -500 } },
      ],
      { atomic: true },
    );
    expect(results[0]).toMatchObject({ status: 'not_applied' });
    expect(results[1]).toMatchObject({ status: 'error' });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
    expect(getDocument().data.transactions).toHaveLength(1);
  });

  it('rolls back everything in atomic mode when a bucket-tag coupling violation is the failure', async () => {
    const document = baseDocument();
    document.data.smile = [
      {
        title: 'Holiday',
        buckets: [{ id: 'flight', title: 'Flights', target: 10000, amount: 0 }],
      },
    ];
    document.data.transactions.push({
      id: 'tx_bucket',
      account: 'Smile',
      amount: -50,
      date: '2026-09-06',
      time: '09:00',
      category: '@Holiday',
      comment: '#bucket:Flights:50.00',
    });
    const { deps, getDocument } = batchDeps(document);
    const { results } = await batchTransactions(
      deps,
      'user_1',
      [
        { op: 'delete', id: 'tx_existing' },
        { op: 'update', id: 'tx_bucket', fields: { amountMinor: -7000 } },
      ],
      { atomic: true },
    );
    expect(results[0]).toMatchObject({ status: 'not_applied' });
    expect(results[1]).toMatchObject({ status: 'error' });
    expect(results[1].error).toMatch(/must be updated together/);
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
    expect(getDocument().data.transactions).toHaveLength(2);
  });

  it('never writes when every operation is a pre-existing validation error', async () => {
    const { deps } = batchDeps(baseDocument());
    const { results } = await batchTransactions(deps, 'user_1', [
      { op: 'create', error: 'amountMinor must be an integer.' },
    ]);
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });

  it('reports a bucket-tag coupling violation as a per-item error without aborting the batch', async () => {
    const document = baseDocument();
    document.data.smile = [
      {
        title: 'Holiday',
        buckets: [{ id: 'flight', title: 'Flights', target: 10000, amount: 0 }],
      },
    ];
    document.data.transactions.push({
      id: 'tx_bucket',
      account: 'Smile',
      amount: -50,
      date: '2026-09-06',
      time: '09:00',
      category: '@Holiday',
      comment: '#bucket:Flights:50.00',
    });
    const { deps } = batchDeps(document);
    const { results } = await batchTransactions(deps, 'user_1', [
      { op: 'update', id: 'tx_bucket', fields: { amountMinor: -7000 } },
      { op: 'delete', id: 'tx_existing' },
    ]);
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(results[0].error).toMatch(/must be updated together/);
    expect(results[1]).toMatchObject({ status: 'deleted' });
  });

  it('retries a CouchDB conflict on batch using a fresh document read', async () => {
    const { deps } = batchDeps(baseDocument());
    let writes = 0;
    const originalInsert = deps.usersDb.insert;
    deps.usersDb.insert = jest.fn(async (next) => {
      writes += 1;
      if (writes === 1) {
        const error = new Error('conflict');
        error.statusCode = 409;
        throw error;
      }
      return originalInsert(next);
    });
    const { results } = await batchTransactions(deps, 'user_1', [
      { op: 'delete', id: 'tx_existing' },
    ]);
    expect(results[0]).toMatchObject({ status: 'deleted' });
    expect(writes).toBe(2);
  });
});
