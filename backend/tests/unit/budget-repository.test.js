'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listBudget,
  getBudgetRow,
  upsertBudget,
  updateBudgetRow,
  deleteBudgetRow,
  deleteBudgetMonth,
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
    expect(rows).toEqual([{ id: 'budget_1', date: '2026-01', tag: '@Groceries', amountMinor: 30000 }]);
  });

  it('filters by month when given', async () => {
    const deps = dependencies({
      budget: [
        minimalRawRow({ id: 'budget_1', date: '2026-01' }),
        minimalRawRow({ id: 'budget_2', date: '2026-02' }),
      ],
    });
    const rows = await listBudget(deps, 'user_1', { month: '2026-02' });
    expect(rows).toEqual([{ id: 'budget_2', date: '2026-02', tag: '@Groceries', amountMinor: 30000 }]);
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
      { budget: [{ ...minimalRawRow(), id: encryptField('budget_1'), amount: encryptField('300') }] },
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
