'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  listGrow,
  getGrow,
  createGrow,
  updateGrow,
  deleteGrow,
} = require('../../repositories/grow-repository');

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

function minimalRawGrow(overrides = {}) {
  return {
    id: 'grow_1',
    title: 'MSFT',
    sub: '',
    phase: 'execute',
    description: '',
    strategy: '',
    riskScore: 3,
    risks: '',
    links: [],
    actionItems: [],
    notes: [],
    cashflow: 0,
    amount: 100,
    isAsset: false,
    share: { tag: 'MSFT', quantity: 10, price: 415 },
    investment: null,
    liabilitie: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('listGrow', () => {
  it('decrypts and normalizes a stored grow project', async () => {
    const deps = dependencies({ grow: [minimalRawGrow()] });
    const [project] = await listGrow(deps, 'user_1');
    expect(project.id).toBe('grow_1');
    expect(project.title).toBe('MSFT');
    expect(project.amountMinor).toBe(10000);
    expect(project.share).toEqual({ tag: 'MSFT', quantity: 10, priceMinor: 41500 });
    expect(project.investment).toBeNull();
    expect(project.liabilitie).toBeNull();
    expect(project.type).toBeUndefined();
    expect(project.category).toBeUndefined();
  });

  it('throws a clear error for a grow project missing a stable id', async () => {
    const raw = minimalRawGrow();
    delete raw.id;
    const deps = dependencies({ grow: [raw] });
    await expect(listGrow(deps, 'user_1')).rejects.toThrow('migrate-balance-entity-ids');
  });

  it('decrypts optional metadata fields when present', async () => {
    const deps = dependencies({
      grow: [
        minimalRawGrow({
          type: 'income-growth',
          category: 'Subscriptions',
          currentCost: 15,
          status: 'bought',
        }),
      ],
    });
    const [project] = await listGrow(deps, 'user_1');
    expect(project.type).toBe('income-growth');
    expect(project.category).toBe('Subscriptions');
    expect(project.currentCostMinor).toBe(1500);
    expect(project.status).toBe('bought');
  });

  it('decrypts an array-valued category', async () => {
    const deps = dependencies({
      grow: [minimalRawGrow({ category: ['Streaming', 'Music'] })],
    });
    const [project] = await listGrow(deps, 'user_1');
    expect(project.category).toEqual(['Streaming', 'Music']);
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        grow: [
          {
            ...minimalRawGrow(),
            id: encryptField('grow_1'),
            title: encryptField('MSFT'),
            amount: encryptField('100'),
            isAsset: encryptField('false'),
            share: {
              tag: encryptField('MSFT'),
              quantity: encryptField('10'),
              price: encryptField('415'),
            },
          },
        ],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const [project] = await listGrow(deps, 'user_1');
    expect(project.title).toBe('MSFT');
    expect(project.amountMinor).toBe(10000);
    expect(project.share.quantity).toBe(10);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      grow: [minimalRawGrow({ amount: 10000, share: { tag: 'MSFT', quantity: 10, price: 41500 } })],
    });
    const [project] = await listGrow(deps, 'user_1');
    expect(project.amountMinor).toBe(10000);
    expect(project.share.priceMinor).toBe(41500);
  });

  it('returns an empty list for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    await expect(listGrow(deps, 'user_1')).resolves.toEqual([]);
  });
});

describe('getGrow', () => {
  it('finds a project by id among several', async () => {
    const deps = dependencies({
      grow: [
        minimalRawGrow({ id: 'grow_1', title: 'MSFT' }),
        minimalRawGrow({ id: 'grow_2', title: 'AAPL' }),
      ],
    });
    const project = await getGrow(deps, 'user_1', 'grow_2');
    expect(project.title).toBe('AAPL');
  });

  it('returns null for an id that does not exist', async () => {
    const deps = dependencies({ grow: [minimalRawGrow()] });
    await expect(getGrow(deps, 'user_1', 'grow_missing')).resolves.toBeNull();
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

describe('createGrow', () => {
  it('creates a new share-kind grow project with zeroed money fields', async () => {
    const { deps, current } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const project = await createGrow(deps, 'user_1', { title: 'MSFT', share: true });
    expect(project.id).toMatch(/^grow_/);
    expect(project.amountMinor).toBe(0);
    expect(project.share).toEqual({ tag: 'MSFT', quantity: 0, priceMinor: 0 });
    expect(current().data.grow).toHaveLength(1);
  });

  it('creates an asset-kind grow project with no share/investment', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const project = await createGrow(deps, 'user_1', { title: 'Car', isAsset: true });
    expect(project.isAsset).toBe(true);
    expect(project.share).toBeNull();
    expect(project.investment).toBeNull();
  });

  it('creates a share-kind project with a full plan and status in one call', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const project = await createGrow(deps, 'user_1', {
      title: 'IOTA',
      kind: 'share',
      share: { quantity: 3713, priceMinor: 22 },
      cashflowMinor: 0,
      status: 'Active - Start Oct 1',
    });
    expect(project.share).toEqual({ tag: 'IOTA', quantity: 3713, priceMinor: 22 });
    expect(project.amountMinor).toBe(81686);
    expect(project.status).toBe('Active - Start Oct 1');
  });

  it('creates an investment-kind project with a planned deposit, mortgage, and loan', async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const project = await createGrow(deps, 'user_1', {
      title: 'Rental Flat',
      investment: { depositMinor: 5000000, amountMinor: 20000000 },
      liabilitie: { amountMinor: 1000000, creditMinor: 50000 },
    });
    expect(project.investment).toEqual({
      tag: 'Rental Flat',
      depositMinor: 5000000,
      amountMinor: 20000000,
    });
    expect(project.liabilitie).toMatchObject({ tag: 'Rental Flat', investment: true });
  });

  it('rejects a title that collides with an existing grow project', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    await expect(createGrow(deps, 'user_1', { title: 'MSFT' })).rejects.toMatchObject({
      code: 'GROW_DUPLICATE_TITLE',
    });
  });
});

describe('updateGrow', () => {
  it('updates only the metadata fields provided', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow()] },
    });
    const project = await updateGrow(deps, 'user_1', 'grow_1', { phase: 'monitor', riskScore: 4 });
    expect(project.phase).toBe('monitor');
    expect(project.riskScore).toBe(4);
    expect(project.title).toBe('MSFT');
  });

  it('returns null for an id that does not exist', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow()] },
    });
    await expect(
      updateGrow(deps, 'user_1', 'grow_missing', { phase: 'monitor' }),
    ).resolves.toBeNull();
  });

  it('rejects a title that collides with another grow project', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow(), minimalRawGrow({ id: 'grow_2', title: 'AAPL' })] },
    };
    const { deps } = writableDeps(document);
    await expect(updateGrow(deps, 'user_1', 'grow_1', { title: 'AAPL' })).rejects.toMatchObject({
      code: 'GROW_DUPLICATE_TITLE',
    });
  });

  it('switches kind, initializing the new embedded copy and clearing the old one', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, share: null })] },
    });
    const result = await updateGrow(deps, 'user_1', 'grow_1', { kind: 'share' });
    expect(result.isAsset).toBe(false);
    expect(result.share).toEqual({ tag: 'MSFT', quantity: 0, priceMinor: 0 });
    expect(result.investment).toBeNull();
  });

  it('sets the share plan, derives amountMinor as quantity * price - loan, and syncs the balance-sheet share price (not quantity)', async () => {
    const { deps, current } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        meta: { schemaVersion: 2 },
        grow: [
          minimalRawGrow({
            share: { tag: 'MSFT', quantity: 1, price: 100 },
            liabilitie: { tag: 'MSFT', amount: 5000, investment: true, credit: 0 },
          }),
        ],
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 7, price: 100 }] } },
      },
    });
    const result = await updateGrow(deps, 'user_1', 'grow_1', {
      share: { tag: 'MSFT', quantity: 3.54, priceMinor: 8833 },
    });
    expect(result.share).toEqual({ tag: 'MSFT', quantity: 3.54, priceMinor: 8833 });
    expect(result.amountMinor).toBe(31269 - 5000);
    expect(current().data.balance.asset.shares[0]).toMatchObject({ quantity: 7, price: 8833 });
  });

  it('an explicit amountMinor wins over the derived share amount', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 1, price: 1 } })] },
    });
    const result = await updateGrow(deps, 'user_1', 'grow_1', {
      share: { quantity: 2, priceMinor: 100 },
      amountMinor: 999,
    });
    expect(result.amountMinor).toBe(999);
  });

  it('sets and clears the planned loan, tagging it with the title and flagging it as an investment loan', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ share: null, investment: { tag: 'MSFT', deposit: 0, amount: 0 } })],
      },
    });
    const set = await updateGrow(deps, 'user_1', 'grow_1', {
      investment: { depositMinor: 5000000, amountMinor: 20000000 },
      liabilitie: { amountMinor: 1000000, creditMinor: 50000 },
      cashflowMinor: 80000,
    });
    expect(set.investment).toEqual({ tag: 'MSFT', depositMinor: 5000000, amountMinor: 20000000 });
    expect(set.liabilitie).toEqual({
      tag: 'MSFT',
      amountMinor: 1000000,
      creditMinor: 50000,
      investment: true,
    });
    expect(set.cashflowMinor).toBe(80000);

    const cleared = await updateGrow(deps, 'user_1', 'grow_1', { liabilitie: null });
    expect(cleared.liabilitie).toBeNull();
  });

  it('re-tags every embedded copy when the project is renamed', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 1, price: 1 } })] },
    });
    const result = await updateGrow(deps, 'user_1', 'grow_1', { title: 'Microsoft' });
    expect(result.share.tag).toBe('Microsoft');
  });

  it('carries a rename over to the balance sheet, transactions, subscriptions, and derived income', async () => {
    const { deps, current } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        meta: { schemaVersion: 2 },
        grow: [
          minimalRawGrow({
            title: 'SOL',
            share: { tag: 'SOL', quantity: 3.54, price: 8833 },
            liabilitie: { tag: 'SOL', amount: 5000, investment: true, credit: 100 },
          }),
        ],
        balance: {
          asset: { shares: [{ id: 'shares_1', tag: 'SOL', quantity: 3.54, price: 8833 }] },
          liabilities: [
            { id: 'liabilities_1', tag: 'SOL', amount: 5000, credit: 100, investment: true },
            { id: 'liabilities_2', tag: 'Car loan', amount: 1, credit: 0, investment: false },
          ],
        },
        transactions: [
          {
            id: 'tx_buy',
            account: 'Fire',
            amount: -31268,
            date: '2026-09-01',
            time: '10:00',
            category: '@SOL',
            comment: 'Liabilitie 50 1; Buy Share SOL 3.54 x 88.33;',
          },
          {
            id: 'tx_sale',
            account: 'Income',
            amount: 1000,
            date: '2026-09-02',
            time: '10:00',
            category: '@sol',
            comment: 'Sell Share SOL 0.1 x 100;',
          },
          {
            id: 'tx_other',
            account: 'Daily',
            amount: -500,
            date: '2026-09-03',
            time: '12:00',
            category: '@Food',
            comment: 'SOL lunch',
          },
        ],
        subscriptions: [
          { id: 'subscriptions_1', title: 'Monthly SOL', category: '@SOL', amount: -1000 },
          { id: 'subscriptions_2', title: 'Rent', category: '@Rent', amount: -50000 },
        ],
      },
    });

    const result = await updateGrow(deps, 'user_1', 'grow_1', { title: 'Solana' });

    expect(result.share.tag).toBe('Solana');
    expect(result.liabilitie.tag).toBe('Solana');
    const data = current().data;
    expect(data.balance.asset.shares[0]).toMatchObject({ id: 'shares_1', tag: 'Solana' });
    expect(data.balance.liabilities.map((l) => l.tag)).toEqual(['Solana', 'Car loan']);
    const byId = Object.fromEntries(data.transactions.map((t) => [t.id, t]));
    expect(byId.tx_buy).toMatchObject({
      category: '@Solana',
      comment: 'Liabilitie 50 1; Buy Share Solana 3.54 x 88.33;',
    });
    expect(byId.tx_sale).toMatchObject({
      category: '@Solana',
      comment: 'Sell Share Solana 0.1 x 100;',
    });
    expect(byId.tx_other).toMatchObject({ category: '@Food', comment: 'SOL lunch' });
    expect(data.subscriptions.map((sub) => sub.category)).toEqual(['@Solana', '@Rent']);
    // The sale is interest income on the (renamed) share, rebuilt from the transactions.
    expect(data.income.revenue.interests).toEqual([{ tag: 'Solana', amount: 1000 }]);
  });

  it("renames an investment's M-<title> mortgage too", async () => {
    const { deps, current } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            title: 'Flat',
            share: null,
            investment: { tag: 'Flat', deposit: 500, amount: 2000 },
          }),
        ],
        balance: {
          asset: {
            investments: [{ id: 'investments_1', tag: 'Flat', deposit: 500, amount: 2000 }],
          },
          liabilities: [
            { id: 'liabilities_1', tag: 'M-Flat', amount: 2000, credit: 0, investment: true },
          ],
        },
      },
    });

    await updateGrow(deps, 'user_1', 'grow_1', { title: 'Rental Flat' });

    const { balance } = current().data;
    expect(balance.asset.investments[0].tag).toBe('Rental Flat');
    expect(balance.liabilities[0].tag).toBe('M-Rental Flat');
  });

  it('refuses a rename onto a balance-sheet tag that already exists', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ title: 'SOL', share: { tag: 'SOL', quantity: 1, price: 1 } })],
        balance: {
          asset: {
            shares: [
              { id: 'shares_1', tag: 'SOL', quantity: 1, price: 1 },
              { id: 'shares_2', tag: 'IOTA', quantity: 1, price: 1 },
            ],
          },
        },
      },
    });

    await expect(updateGrow(deps, 'user_1', 'grow_1', { title: 'IOTA' })).rejects.toMatchObject({
      code: 'GROW_DUPLICATE_TITLE',
    });
  });

  it('rejects a share plan on a project that is not share-kind', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, share: null })] },
    });
    await expect(
      updateGrow(deps, 'user_1', 'grow_1', { share: { quantity: 1 } }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_PLAN' });
  });

  it('rejects an embedded tag that differs from the title', async () => {
    const { deps } = writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 1, price: 1 } })] },
    });
    await expect(
      updateGrow(deps, 'user_1', 'grow_1', { share: { tag: 'SLO', quantity: 1 } }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_PLAN' });
  });
});

describe('updateGrow — item-level list edits', () => {
  function projectWithLists() {
    return writableDeps({
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            actionItems: [
              { text: 'Set alerts', done: false, priority: 'high' },
              { text: 'Sell half', done: false, priority: 'high', dueDate: '2026-09-20' },
            ],
            notes: [{ text: 'Old note', createdAt: '2026-09-14T14:00:00Z' }],
            links: [{ label: 'Chart', url: 'https://example.com/chart' }],
          }),
        ],
      },
    });
  }

  it('updates, removes and adds single items without resending the lists', async () => {
    const { deps } = projectWithLists();
    const result = await updateGrow(deps, 'user_1', 'grow_1', {
      actionItemsUpdate: [{ index: 1, done: true, dueDate: null }],
      actionItemsRemove: [0],
      actionItemsAdd: [{ text: 'Review in Q4' }],
      notesAdd: [{ text: 'Sold 1.77 SOL' }],
      linksUpdate: [{ index: 0, url: 'https://example.com/new' }],
    });

    expect(result.actionItems).toEqual([
      { text: 'Sell half', done: true, priority: 'high' },
      { text: 'Review in Q4', done: false, priority: 'medium' },
    ]);
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0]).toEqual({ text: 'Old note', createdAt: '2026-09-14T14:00:00Z' });
    expect(result.notes[1].text).toBe('Sold 1.77 SOL');
    expect(Date.parse(result.notes[1].createdAt)).not.toBeNaN();
    expect(result.links).toEqual([{ label: 'Chart', url: 'https://example.com/new' }]);
  });

  it('rejects an index that does not exist', async () => {
    const { deps } = projectWithLists();
    await expect(updateGrow(deps, 'user_1', 'grow_1', { notesRemove: [5] })).rejects.toMatchObject({
      code: 'GROW_INVALID_PLAN',
    });
  });
});

describe('createGrow — list defaults', () => {
  it("fills the app's defaults for action items and notes", async () => {
    const { deps } = writableDeps({ _id: 'user_1', _rev: '1-a', data: {} });
    const project = await createGrow(deps, 'user_1', {
      title: 'Plan',
      actionItems: [{ text: 'Do it' }],
      notes: [{ text: 'Why' }],
    });
    expect(project.actionItems).toEqual([{ text: 'Do it', done: false, priority: 'medium' }]);
    expect(Date.parse(project.notes[0].createdAt)).not.toBeNaN();
  });
});

describe('deleteGrow', () => {
  it('removes the grow project and returns its id', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps, current } = writableDeps(document);
    const result = await deleteGrow(deps, 'user_1', 'grow_1');
    expect(result).toEqual({ id: 'grow_1' });
    expect(current().data.grow).toEqual([]);
  });

  it('returns null for an id that does not exist', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    await expect(deleteGrow(deps, 'user_1', 'grow_missing')).resolves.toBeNull();
  });
});
