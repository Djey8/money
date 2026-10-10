'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  refreshSubscriptions,
  batchSubscriptions,
} = require('../../repositories/subscription-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

function minimalRawSubscription(overrides = {}) {
  return {
    id: 'subscriptions_1',
    title: 'Spotify',
    account: 'Daily',
    amount: 10,
    startDate: '2026-01-01',
    endDate: '',
    category: '@Streaming',
    comment: '',
    frequency: 'monthly',
    ...overrides,
  };
}

describe('listSubscriptions', () => {
  it('decrypts and normalizes a stored subscription', async () => {
    const deps = dependencies({ subscriptions: [minimalRawSubscription()] });
    const [subscription] = await listSubscriptions(deps, 'user_1');
    expect(subscription).toEqual({
      id: 'subscriptions_1',
      title: 'Spotify',
      account: 'Daily',
      amountMinor: 1000,
      startDate: '2026-01-01',
      endDate: null,
      category: '@Streaming',
      comment: '',
      frequency: 'monthly',
    });
  });

  it('treats an empty-string endDate as null', async () => {
    const deps = dependencies({ subscriptions: [minimalRawSubscription({ endDate: '' })] });
    const [subscription] = await listSubscriptions(deps, 'user_1');
    expect(subscription.endDate).toBeNull();
  });

  it('preserves a set endDate', async () => {
    const deps = dependencies({
      subscriptions: [minimalRawSubscription({ endDate: '2026-12-31' })],
    });
    const [subscription] = await listSubscriptions(deps, 'user_1');
    expect(subscription.endDate).toBe('2026-12-31');
  });

  it('throws a clear error for a subscription missing a stable id', async () => {
    const raw = minimalRawSubscription();
    delete raw.id;
    const deps = dependencies({ subscriptions: [raw] });
    await expect(listSubscriptions(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        subscriptions: [
          {
            ...minimalRawSubscription(),
            id: encryptField('subscriptions_1'),
            title: encryptField('Spotify'),
            amount: encryptField('10'),
          },
        ],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [subscription] = await listSubscriptions(deps, 'user_1');
    expect(subscription.title).toBe('Spotify');
    expect(subscription.amountMinor).toBe(1000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      subscriptions: [minimalRawSubscription({ amount: 1000 })],
    });
    const [subscription] = await listSubscriptions(deps, 'user_1');
    expect(subscription.amountMinor).toBe(1000);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listSubscriptions(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getSubscription', () => {
  it('finds a subscription by id among several', async () => {
    const deps = dependencies({
      subscriptions: [
        minimalRawSubscription({ id: 'subscriptions_1', title: 'Spotify' }),
        minimalRawSubscription({ id: 'subscriptions_2', title: 'Netflix' }),
      ],
    });
    const subscription = await getSubscription(deps, 'user_1', 'subscriptions_2');
    expect(subscription.title).toBe('Netflix');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({ subscriptions: [minimalRawSubscription()] });
    await expect(getSubscription(deps, 'user_1', 'subscriptions_missing')).resolves.toBeNull();
  });
});

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

describe('createSubscription', () => {
  it('creates a new subscription with a stable id and defaults', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const subscription = await createSubscription(deps, 'user_1', {
      account: 'Daily',
      amountMinor: -1000,
      category: '@Streaming',
      startDate: '2026-01-01',
    });
    expect(subscription.id).toMatch(/^subscriptions_/);
    expect(subscription.title).toBe('');
    expect(subscription.comment).toBe('');
    expect(subscription.frequency).toBe('monthly');
    expect(subscription.endDate).toBeNull();
    expect(current().data.subscriptions).toHaveLength(1);
  });

  it('keeps an explicit frequency and endDate', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const subscription = await createSubscription(deps, 'user_1', {
      title: 'Gym',
      account: 'Daily',
      amountMinor: -3000,
      category: '@Fitness',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      frequency: 'yearly',
    });
    expect(subscription.frequency).toBe('yearly');
    expect(subscription.endDate).toBe('2026-12-31');
  });
});

describe('updateSubscription', () => {
  function existingSubscriptionDocument(overrides = {}) {
    return {
      _id: 'user_1',
      _rev: '1-a',
      data: { subscriptions: [minimalRawSubscription(overrides)] },
    };
  }

  // Spotify, monthly from 2026-01-01: due Jan 1, Feb 1, Mar 1 and Apr 1 by NOW.
  const NOW = new Date('2026-04-15');
  const generatedOn = (date, overrides = {}) => ({
    id: `transactions_${date}`,
    account: 'Daily',
    amount: 10,
    date,
    time: '00:00',
    category: '@Streaming',
    comment: 'Spotify',
    ...overrides,
  });
  const allGenerated = () =>
    ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'].map((date) => generatedOn(date));
  const datesOf = (transactions) => transactions.map((transaction) => transaction.date).sort();

  it('leaves the transactions alone when nothing that matters changed', async () => {
    const document = existingSubscriptionDocument();
    document.data.transactions = allGenerated();
    const { deps, current } = writableDeps(document);
    await updateSubscription(
      deps,
      'user_1',
      'subscriptions_1',
      { frequency: 'monthly' },
      { now: NOW },
    );
    expect(datesOf(current().data.transactions)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
  });

  it('replaces everything the old subscription generated when the amount changes, using the OLD identity', async () => {
    const document = existingSubscriptionDocument();
    document.data.transactions = [
      ...allGenerated(),
      {
        id: 'transactions_other',
        account: 'Daily',
        amount: -5,
        date: '2026-02-01',
        time: '09:00',
        category: '@Groceries',
        comment: 'unrelated',
      },
    ];
    const { deps, current } = writableDeps(document);
    await updateSubscription(
      deps,
      'user_1',
      'subscriptions_1',
      { amountMinor: -1500 },
      { now: NOW },
    );
    const transactions = current().data.transactions;
    const streaming = transactions.filter((transaction) => transaction.category === '@Streaming');
    expect(streaming).toHaveLength(4);
    expect(streaming.every((transaction) => Number(transaction.amount) === -15)).toBe(true);
    expect(datesOf(streaming)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']);
    expect(transactions.some((transaction) => transaction.comment === 'unrelated')).toBe(true);
  });

  it('does not remove a hand-made transaction that merely looks like a generated one', async () => {
    const document = existingSubscriptionDocument();
    document.data.transactions = [
      generatedOn('2026-01-01', { id: 'transactions_note', comment: 'A manually entered note' }),
      generatedOn('2026-01-02', { id: 'transactions_other_day' }),
    ];
    const { deps, current } = writableDeps(document);
    await updateSubscription(
      deps,
      'user_1',
      'subscriptions_1',
      { amountMinor: -1500 },
      { now: NOW },
    );
    const ids = current().data.transactions.map((transaction) => transaction.id);
    expect(ids).toContain('transactions_note');
    expect(ids).toContain('transactions_other_day');
  });

  it('removes the transactions after an end date moved into the past', async () => {
    const document = existingSubscriptionDocument();
    document.data.transactions = allGenerated();
    const { deps, current } = writableDeps(document);
    const subscription = await updateSubscription(
      deps,
      'user_1',
      'subscriptions_1',
      { endDate: '2026-02-15' },
      { now: NOW },
    );
    expect(subscription.endDate).toBe('2026-02-15');
    expect(datesOf(current().data.transactions)).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('adds the missing transactions when the end date moves into the future again', async () => {
    const document = existingSubscriptionDocument({ endDate: '2026-02-15' });
    document.data.transactions = [generatedOn('2026-01-01'), generatedOn('2026-02-01')];
    const { deps, current } = writableDeps(document);
    await updateSubscription(
      deps,
      'user_1',
      'subscriptions_1',
      { endDate: '2026-12-31' },
      { now: NOW },
    );
    expect(datesOf(current().data.transactions)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
  });

  it('adds the missing transactions when the end date is removed', async () => {
    const document = existingSubscriptionDocument({ endDate: '2026-02-15' });
    document.data.transactions = [generatedOn('2026-01-01'), generatedOn('2026-02-01')];
    const { deps, current } = writableDeps(document);
    await updateSubscription(deps, 'user_1', 'subscriptions_1', { endDate: null }, { now: NOW });
    expect(current().data.transactions).toHaveLength(4);
  });

  it('returns null for an id that does not exist', async () => {
    const { deps } = writableDeps(existingSubscriptionDocument());
    await expect(
      updateSubscription(deps, 'user_1', 'subscriptions_missing', { title: 'X' }),
    ).resolves.toBeNull();
  });
});

describe('deleteSubscription', () => {
  it('removes the subscription and returns its id, leaving transactions untouched by default', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [minimalRawSubscription()],
        transactions: [
          {
            account: 'Daily',
            amount: 10,
            date: '2026-01-01',
            time: '09:00',
            category: '@Streaming',
            comment: 'Spotify',
          },
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await deleteSubscription(deps, 'user_1', 'subscriptions_1');
    expect(result).toEqual({ id: 'subscriptions_1' });
    expect(current().data.subscriptions).toEqual([]);
    expect(current().data.transactions).toHaveLength(1);
  });

  it('deletes the transactions the subscription generated when deleteTransactions is true, and only those', async () => {
    const NOW = new Date('2026-04-15');
    const base = {
      account: 'Daily',
      amount: 10,
      time: '00:00',
      category: '@Streaming',
      comment: 'Spotify',
    };
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [minimalRawSubscription()],
        transactions: [
          { ...base, id: 'transactions_1', date: '2026-01-01' },
          { ...base, id: 'transactions_2', date: '2026-02-01' },
          { ...base, id: 'transactions_other_day', date: '2026-02-02' },
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await deleteSubscription(deps, 'user_1', 'subscriptions_1', {
      deleteTransactions: true,
      now: NOW,
    });
    expect(current().data.transactions.map((transaction) => transaction.id)).toEqual([
      'transactions_other_day',
    ]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { subscriptions: [minimalRawSubscription()] },
    };
    const { deps } = writableDeps(document);
    await expect(deleteSubscription(deps, 'user_1', 'subscriptions_missing')).resolves.toBeNull();
  });
});

describe('refreshSubscriptions', () => {
  const NOW = new Date('2026-03-15');

  it('generates due transactions and appends them, reporting counts', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [
          minimalRawSubscription({ startDate: '2026-01-15', amount: -10, frequency: 'monthly' }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(result.subscriptionsProcessed).toBe(1);
    expect(result.transactionsCreated).toBeGreaterThan(0);
    const stored = current().data.transactions;
    expect(stored).toHaveLength(result.transactionsCreated);
    expect(stored[0]).toMatchObject({ account: 'Daily', category: '@Streaming' });
  });

  it('does not write anything when no subscription is due yet', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [minimalRawSubscription({ startDate: '2026-12-01' })],
      },
    };
    const { deps } = writableDeps(document);
    const result = await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(result).toEqual({ transactionsCreated: 0, subscriptionsProcessed: 0 });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });

  it('does not regenerate a transaction that was already created for an occurrence', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [
          minimalRawSubscription({ startDate: '2026-01-15', endDate: '2026-01-15', amount: -10 }),
        ],
        transactions: [
          {
            id: 'transactions_1',
            account: 'Daily',
            amount: -10,
            date: '2026-01-15',
            time: '00:00',
            category: '@Streaming',
            comment: 'Spotify',
          },
        ],
      },
    };
    const { deps } = writableDeps(document);
    const result = await refreshSubscriptions(deps, 'user_1', { now: NOW });
    expect(result).toEqual({ transactionsCreated: 0, subscriptionsProcessed: 1 });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });
});

describe('batchSubscriptions', () => {
  it('applies a mix of create/update/delete in one document write', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { subscriptions: [minimalRawSubscription({ id: 'subscriptions_existing' })] },
    };
    const { deps, current } = writableDeps(document);
    const results = await batchSubscriptions(deps, 'user_1', [
      {
        op: 'create',
        fields: { account: 'Daily', amountMinor: -500, startDate: '2026-01-01', category: '@Gym' },
      },
      { op: 'update', id: 'subscriptions_existing', fields: { amountMinor: -2000 } },
      { op: 'delete', id: 'subscriptions_never_mind' },
    ]);
    expect(results[0]).toMatchObject({ op: 'create', status: 'created' });
    expect(results[0].subscription).toMatchObject({ amountMinor: -500 });
    expect(results[1]).toMatchObject({
      op: 'update',
      id: 'subscriptions_existing',
      status: 'updated',
    });
    expect(results[1].subscription).toMatchObject({ amountMinor: -2000 });
    expect(results[2]).toMatchObject({
      op: 'delete',
      id: 'subscriptions_never_mind',
      status: 'error',
    });
    expect(deps.usersDb.insert).toHaveBeenCalledTimes(1);
    expect(current().data.subscriptions).toHaveLength(2);
  });

  it('applies successful items and reports failures independently in non-atomic mode', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { subscriptions: [minimalRawSubscription({ id: 'subscriptions_existing' })] },
    };
    const { deps } = writableDeps(document);
    const results = await batchSubscriptions(deps, 'user_1', [
      { op: 'update', id: 'subscriptions_missing', fields: { amountMinor: -500 } },
      { op: 'delete', id: 'subscriptions_existing' },
    ]);
    expect(results[0]).toMatchObject({ status: 'error' });
    expect(results[1]).toMatchObject({ status: 'deleted' });
    expect(deps.usersDb.insert).toHaveBeenCalledTimes(1);
  });

  it('rolls back everything in atomic mode when any operation fails', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { subscriptions: [minimalRawSubscription({ id: 'subscriptions_existing' })] },
    };
    const { deps, current } = writableDeps(document);
    const results = await batchSubscriptions(
      deps,
      'user_1',
      [
        { op: 'delete', id: 'subscriptions_existing' },
        { op: 'update', id: 'subscriptions_missing', fields: { amountMinor: -500 } },
      ],
      { atomic: true },
    );
    expect(results[0]).toMatchObject({ status: 'not_applied' });
    expect(results[1]).toMatchObject({ status: 'error' });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
    expect(current().data.subscriptions).toHaveLength(1);
  });

  it('does not cascade transaction cleanup for a batch update touching an identifying field', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [minimalRawSubscription({ id: 'subscriptions_existing' })],
        transactions: [
          {
            id: 'transactions_1',
            account: 'Daily',
            amount: 10,
            date: '2026-01-01',
            time: '09:00',
            category: '@Streaming',
            comment: 'Spotify',
          },
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await batchSubscriptions(deps, 'user_1', [
      { op: 'update', id: 'subscriptions_existing', fields: { amountMinor: -1500 } },
    ]);
    expect(current().data.transactions).toHaveLength(1);
  });
});
