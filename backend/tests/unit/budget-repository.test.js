'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listBudget,
  getBudgetRow,
  upsertBudget,
  updateBudgetRow,
  deleteBudgetRow,
  deleteBudgetMonth,
  fillForwardBudget,
  copyBudget,
  fromSubscriptionsBudget,
} = require('../../repositories/budget-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

function minimalRawRow(overrides = {}) {
  return { id: 'budget_1', date: '2026-01', tag: '@Groceries', amount: 300, ...overrides };
}

function minimalRawSubscription(overrides = {}) {
  return {
    id: 'subscriptions_1',
    title: 'Spotify',
    account: 'Daily',
    amount: -10,
    startDate: '2026-01-01',
    endDate: '',
    category: '@Streaming',
    comment: '',
    frequency: 'monthly',
    ...overrides,
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

describe('listBudget', () => {
  it('decrypts and normalizes stored budget rows', async () => {
    const deps = dependencies({ budget: [minimalRawRow()] });
    const rows = await listBudget(deps, 'user_1');
    expect(rows).toEqual([
      { id: 'budget_1', date: '2026-01', tag: '@Groceries', amountMinor: 30000 },
    ]);
  });

  it('filters by month when given', async () => {
    const deps = dependencies({
      budget: [
        minimalRawRow({ id: 'budget_1', date: '2026-01' }),
        minimalRawRow({ id: 'budget_2', date: '2026-02' }),
      ],
    });
    const rows = await listBudget(deps, 'user_1', { month: '2026-02' });
    expect(rows).toEqual([
      { id: 'budget_2', date: '2026-02', tag: '@Groceries', amountMinor: 30000 },
    ]);
  });

  it('throws a clear error for a row missing a stable id', async () => {
    const raw = minimalRawRow();
    delete raw.id;
    const deps = dependencies({ budget: [raw] });
    await expect(listBudget(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        budget: [{ ...minimalRawRow(), id: encryptField('budget_1'), amount: encryptField('300') }],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [row] = await listBudget(deps, 'user_1');
    expect(row.amountMinor).toBe(30000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      budget: [minimalRawRow({ amount: 30000 })],
    });
    const [row] = await listBudget(deps, 'user_1');
    expect(row.amountMinor).toBe(30000);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listBudget(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getBudgetRow', () => {
  it('finds a row by id among several', async () => {
    const deps = dependencies({
      budget: [
        minimalRawRow({ id: 'budget_1', tag: '@Groceries' }),
        minimalRawRow({ id: 'budget_2', tag: '@Rent' }),
      ],
    });
    const row = await getBudgetRow(deps, 'user_1', 'budget_2');
    expect(row.tag).toBe('@Rent');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({ budget: [minimalRawRow()] });
    await expect(getBudgetRow(deps, 'user_1', 'budget_missing')).resolves.toBeNull();
  });
});

describe('upsertBudget', () => {
  it('creates a new row with a stable id when no (date, tag) match exists', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const row = await upsertBudget(deps, 'user_1', {
      date: '2026-01',
      tag: '@Groceries',
      amountMinor: 30000,
    });
    expect(row.id).toMatch(/^budget_/);
    expect(current().data.budget).toHaveLength(1);
  });

  it('overwrites the amount of an existing (date, tag) match, keeping its id', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [minimalRawRow()] } };
    const { deps, current } = writableDeps(document);
    const row = await upsertBudget(deps, 'user_1', {
      date: '2026-01',
      tag: '@Groceries',
      amountMinor: 50000,
    });
    expect(row.id).toBe('budget_1');
    expect(row.amountMinor).toBe(50000);
    expect(current().data.budget).toHaveLength(1);
  });
});

describe('updateBudgetRow', () => {
  it('updates the amount without a collision check when (date, tag) is unchanged', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [minimalRawRow()] } };
    const { deps } = writableDeps(document);
    const row = await updateBudgetRow(deps, 'user_1', 'budget_1', { amountMinor: 40000 });
    expect(row.amountMinor).toBe(40000);
  });

  it('rejects a (date, tag) collision with another existing row', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [
          minimalRawRow({ id: 'budget_1', date: '2026-01', tag: '@Groceries' }),
          minimalRawRow({ id: 'budget_2', date: '2026-02', tag: '@Rent' }),
        ],
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      updateBudgetRow(deps, 'user_1', 'budget_2', { date: '2026-01', tag: '@Groceries' }),
    ).rejects.toThrow('already exists');
  });

  it('allows changing date/tag when no other row collides', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [minimalRawRow()] } };
    const { deps } = writableDeps(document);
    const row = await updateBudgetRow(deps, 'user_1', 'budget_1', { date: '2026-02' });
    expect(row.date).toBe('2026-02');
  });

  it('returns null for an id that does not exist', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [minimalRawRow()] } };
    const { deps } = writableDeps(document);
    await expect(
      updateBudgetRow(deps, 'user_1', 'budget_missing', { amountMinor: 1 }),
    ).resolves.toBeNull();
  });
});

describe('deleteBudgetRow', () => {
  it('removes the row and returns its id', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [minimalRawRow()] } };
    const { deps, current } = writableDeps(document);
    const result = await deleteBudgetRow(deps, 'user_1', 'budget_1');
    expect(result).toEqual({ id: 'budget_1' });
    expect(current().data.budget).toEqual([]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [minimalRawRow()] } };
    const { deps } = writableDeps(document);
    await expect(deleteBudgetRow(deps, 'user_1', 'budget_missing')).resolves.toBeNull();
  });
});

describe('deleteBudgetMonth', () => {
  it('deletes every row for the given month only', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [
          minimalRawRow({ id: 'budget_1', date: '2026-01', tag: '@Groceries' }),
          minimalRawRow({ id: 'budget_2', date: '2026-01', tag: '@Rent' }),
          minimalRawRow({ id: 'budget_3', date: '2026-02', tag: '@Rent' }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await deleteBudgetMonth(deps, 'user_1', '2026-01');
    expect(result).toEqual({ month: '2026-01', deletedCount: 2 });
    expect(current().data.budget).toHaveLength(1);
  });
});

describe('fillForwardBudget', () => {
  it('finds the nearest prior populated month and chain-fills forward, add-only', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [minimalRawRow({ id: 'budget_1', date: '2026-01', tag: '@Groceries' })],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await fillForwardBudget(deps, 'user_1', '2026-04');
    expect(result).toEqual({ targetMonth: '2026-04', rowsAdded: 3 });
    const dates = current()
      .data.budget.map((row) => row.date)
      .sort();
    expect(dates).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });

  it('chain-fills correctly across a December-to-January year rollover', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [minimalRawRow({ id: 'budget_1', date: '2026-11', tag: '@Groceries' })],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await fillForwardBudget(deps, 'user_1', '2027-01');
    expect(result).toEqual({ targetMonth: '2027-01', rowsAdded: 2 });
    const dates = current()
      .data.budget.map((row) => row.date)
      .sort();
    expect(dates).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('does not overwrite a row that already exists for (date, tag) in an intermediate month', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [
          minimalRawRow({ id: 'budget_1', date: '2026-01', tag: '@Groceries', amount: 300 }),
          minimalRawRow({ id: 'budget_2', date: '2026-02', tag: '@Groceries', amount: 999 }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await fillForwardBudget(deps, 'user_1', '2026-03');
    const february = current().data.budget.find((row) => row.date === '2026-02');
    expect(february.amount).toBe(999);
    const march = current().data.budget.find((row) => row.date === '2026-03');
    expect(march.amount).toBe(999);
  });

  it('does not write anything when no prior month within 120 months has any row', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [] } };
    const { deps } = writableDeps(document);
    const result = await fillForwardBudget(deps, 'user_1', '2026-04');
    expect(result).toEqual({ targetMonth: '2026-04', rowsAdded: 0 });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });
});

describe('copyBudget', () => {
  it('copies every row from the source month into an empty target month', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [
          minimalRawRow({ id: 'budget_1', date: '2026-01', tag: '@Groceries', amount: 300 }),
          minimalRawRow({ id: 'budget_2', date: '2026-01', tag: '@Rent', amount: 1200 }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await copyBudget(deps, 'user_1', { fromMonth: '2026-01', toMonth: '2026-02' });
    expect(result).toEqual({ fromMonth: '2026-01', toMonth: '2026-02', rowsCopied: 2 });
    const february = current().data.budget.filter((row) => row.date === '2026-02');
    expect(february).toHaveLength(2);
  });

  it('overwrites an existing target row amount when (date, tag) already exists', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        budget: [
          minimalRawRow({ id: 'budget_1', date: '2026-01', tag: '@Groceries', amount: 300 }),
          minimalRawRow({ id: 'budget_2', date: '2026-02', tag: '@Groceries', amount: 999 }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await copyBudget(deps, 'user_1', { fromMonth: '2026-01', toMonth: '2026-02' });
    const february = current().data.budget.find((row) => row.date === '2026-02');
    expect(february.id).toBe('budget_2');
    expect(february.amount).toBe(300);
  });

  it('does not write anything when the source month has no rows', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { budget: [] } };
    const { deps } = writableDeps(document);
    const result = await copyBudget(deps, 'user_1', { fromMonth: '2026-01', toMonth: '2026-02' });
    expect(result).toEqual({ fromMonth: '2026-01', toMonth: '2026-02', rowsCopied: 0 });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });
});

describe('fromSubscriptionsBudget', () => {
  const NOW = new Date('2026-01-15');

  it('creates a new budget row using the monthly-equivalent amount, not the full nominal amount', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [
          minimalRawSubscription({
            amount: -300,
            startDate: '2026-01-01',
            endDate: '2026-01-01',
            category: '@Insurance',
            frequency: 'quarterly',
          }),
        ],
        budget: [],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await fromSubscriptionsBudget(deps, 'user_1', { now: NOW });
    expect(result).toEqual({ rowsWritten: 1 });
    const row = current().data.budget[0];
    expect(row.date).toBe('2026-01');
    expect(row.tag).toBe('@Insurance');
    expect(row.amount).toBe(100);
  });

  it('unconditionally overwrites an existing row for the computed (date, tag) pair', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        subscriptions: [
          minimalRawSubscription({
            amount: -1000,
            startDate: '2026-01-01',
            endDate: '2026-01-01',
            category: '@Streaming',
            frequency: 'monthly',
          }),
        ],
        budget: [
          minimalRawRow({ id: 'budget_existing', date: '2026-01', tag: '@Streaming', amount: 1 }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    await fromSubscriptionsBudget(deps, 'user_1', { now: NOW });
    const rows = current().data.budget;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('budget_existing');
    expect(rows[0].amount).toBe(1000);
  });

  it('does not write anything when there are no subscriptions to compute rows from', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { subscriptions: [], budget: [] } };
    const { deps } = writableDeps(document);
    const result = await fromSubscriptionsBudget(deps, 'user_1', { now: NOW });
    expect(result).toEqual({ rowsWritten: 0 });
    expect(deps.usersDb.insert).not.toHaveBeenCalled();
  });
});
