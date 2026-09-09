'use strict';

const {
  buyGrow,
  sellGrow,
  dividendGrow,
  paybackGrow,
  cashflowGrow,
  depositGrow,
} = require('../../repositories/grow-action-repository');

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
    amount: 0,
    isAsset: false,
    share: null,
    investment: null,
    liabilitie: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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

function lastTransaction(document) {
  const transactions = document.data.transactions || [];
  return transactions[transactions.length - 1];
}

describe('buyGrow', () => {
  it('asset kind: creates the asset, reduces Grow.amount and the transaction by any financing loan', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps, current } = writableDeps(document);
    const result = await buyGrow(deps, 'user_1', 'grow_1', {
      totalAmountMinor: 150000,
      liabilitie: { loanMinor: 100000, creditMinor: 5000 },
    });

    expect(result.grow.amountMinor).toBe(50000);
    expect(result.grow.status).toBe('bought');
    expect(result.transaction.amountMinor).toBe(-50000);
    expect(result.transaction.account).toBe('Fire');
    expect(result.transaction.category).toBe('@Car');
    expect(result.transaction.comment).toBe('Liabilitie 1000 50; Buy Asset Car 1 x 1500;');

    const doc = current();
    expect(doc.data.balance.asset.assets[0]).toMatchObject({ tag: 'Car', amount: 1500 });
    expect(doc.data.balance.liabilities[0]).toMatchObject({ tag: 'Car', amount: 1000, credit: 50 });
    expect(lastTransaction(doc).comment).toBe('Liabilitie 1000 50; Buy Asset Car 1 x 1500;');
  });

  it('a financed buy reflects the resulting debt onto Grow.liabilitie too, so a later payback has something to act on', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps } = writableDeps(document);
    const result = await buyGrow(deps, 'user_1', 'grow_1', {
      totalAmountMinor: 150000,
      liabilitie: { loanMinor: 100000, creditMinor: 5000 },
    });

    expect(result.grow.liabilitie).toEqual({
      tag: 'Car',
      amountMinor: 100000,
      investment: true,
      creditMinor: 5000,
    });
  });

  it('share kind: accumulates onto an existing position and syncs the embedded copy', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 5, price: 200 } })],
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 5, price: 200 }] } },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await buyGrow(deps, 'user_1', 'grow_1', { quantity: 10, priceMinor: 25000 });

    expect(result.grow.share).toEqual({ tag: 'MSFT', quantity: 15, priceMinor: 25000 });
    expect(result.transaction.amountMinor).toBe(-250000);

    const doc = current();
    expect(doc.data.balance.asset.shares[0]).toMatchObject({ quantity: 15, price: 250 });
  });

  it('investment kind: creates the companion M-<title> mortgage liability', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            title: 'Rental Flat',
            investment: { tag: 'Rental Flat', deposit: 0, amount: 0 },
          }),
        ],
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await buyGrow(deps, 'user_1', 'grow_1', {
      depositMinor: 2000000,
      mortgageMinor: 30000000,
    });

    expect(result.grow.investment).toEqual({
      tag: 'Rental Flat',
      depositMinor: 2000000,
      amountMinor: 30000000,
    });
    expect(result.transaction.amountMinor).toBe(-2000000);

    const doc = current();
    expect(doc.data.balance.asset.investments[0]).toMatchObject({ deposit: 20000, amount: 300000 });
    expect(doc.data.balance.liabilities[0]).toMatchObject({ tag: 'M-Rental Flat', amount: 300000 });
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        meta: { schemaVersion: 2 },
        grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 5, price: 20000 } })],
        balance: {
          asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 5, price: 20000 }] },
        },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await buyGrow(deps, 'user_1', 'grow_1', { quantity: 10, priceMinor: 25000 });

    expect(result.grow.share.priceMinor).toBe(25000);
    expect(result.transaction.amountMinor).toBe(-250000);
    expect(current().data.balance.asset.shares[0]).toMatchObject({ price: 25000 });
  });

  it('rejects a buy on a grow project with no kind', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    await expect(
      buyGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: 100 }),
    ).rejects.toMatchObject({
      code: 'GROW_NO_KIND',
    });
  });

  it('rejects an action against a grow id that does not exist', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    await expect(
      buyGrow(deps, 'user_1', 'grow_missing', { totalAmountMinor: 100 }),
    ).rejects.toMatchObject({ code: 'GROW_NOT_FOUND' });
  });

  it('rejects a share-shaped body sent to an asset-kind grow project instead of silently producing NaN', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      buyGrow(deps, 'user_1', 'grow_1', { quantity: 10, priceMinor: 25000 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('rejects a non-integer totalAmountMinor', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      buyGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: 100.5 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('rejects a malformed liabilitie attachment', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      buyGrow(deps, 'user_1', 'grow_1', {
        totalAmountMinor: 150000,
        liabilitie: { loanMinor: 'not-a-number', creditMinor: 5000 },
      }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('rejects a zero or negative totalAmountMinor', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps } = writableDeps(document);
    await expect(buyGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: 0 })).rejects.toMatchObject({
      code: 'GROW_INVALID_INPUT',
    });
    await expect(buyGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: -1 })).rejects.toMatchObject(
      { code: 'GROW_INVALID_INPUT' },
    );
  });

  it('rejects a financing loan of 0', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true, title: 'Car' })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      buyGrow(deps, 'user_1', 'grow_1', {
        totalAmountMinor: 150000,
        liabilitie: { loanMinor: 0, creditMinor: 0 },
      }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });
});

describe('sellGrow', () => {
  it('asset kind: removes the asset entirely when the sale zeroes it out', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ isAsset: true, title: 'Car' })],
        balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 1200 }] } },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await sellGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: 120000 });

    expect(result.grow.status).toBe('sold');
    expect(result.transaction.amountMinor).toBe(120000);
    expect(result.transaction.account).toBe('Income');
    expect(current().data.balance.asset.assets).toEqual([]);
  });

  it('asset kind: rejects overselling past the current position instead of persisting a negative balance', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ isAsset: true, title: 'Car' })],
        balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 1200 }] } },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: 999999 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('rejects a zero or negative totalAmountMinor', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ isAsset: true, title: 'Car' })],
        balance: { asset: { assets: [{ id: 'assets_1', tag: 'Car', amount: 1200 }] } },
      },
    };
    const { deps } = writableDeps(document);
    await expect(sellGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: 0 })).rejects.toMatchObject(
      { code: 'GROW_INVALID_INPUT' },
    );
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', { totalAmountMinor: -100 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('share kind: rejects overselling past the current position', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 5, price: 200 } })],
        balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 5, price: 200 }] } },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', { quantity: 10, priceMinor: 20000 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('share kind: rejects selling a position that does not exist', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 5, price: 200 } })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', { quantity: 5, priceMinor: 20000 }),
    ).rejects.toMatchObject({ code: 'GROW_NO_POSITION' });
  });

  it('investment kind with a payback: settles the attached liability atomically with the sale', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            title: 'Rental Flat',
            investment: { tag: 'Rental Flat', deposit: 20000, amount: 300000 },
            liabilitie: { tag: 'Rental Flat', amount: 2315, investment: true, credit: 463 },
            amount: 20000,
          }),
        ],
        balance: {
          asset: {
            investments: [
              { id: 'investments_1', tag: 'Rental Flat', deposit: 20000, amount: 300000 },
            ],
          },
          liabilities: [
            {
              id: 'liabilities_1',
              tag: 'Rental Flat',
              amount: 2315,
              investment: true,
              credit: 463,
            },
            {
              id: 'liabilities_2',
              tag: 'M-Rental Flat',
              amount: 300000,
              investment: true,
              credit: 0,
            },
          ],
        },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await sellGrow(deps, 'user_1', 'grow_1', {
      depositMinor: 500000,
      mortgageMinor: 2900000,
      payback: { amountMinor: 231500, creditMinor: 46300 },
    });

    expect(result.grow.liabilitie).toBeNull();
    expect(result.transaction.comment).toBe(
      'Payback Liabilitie 2315 463; Sell Investment Rental Flat 5000 29000;',
    );
    expect(result.transaction.amountMinor).toBe(500000 - 231500 - 46300);

    const doc = current();
    const liabilities = doc.data.balance.liabilities;
    expect(liabilities.find((l) => l.tag === 'Rental Flat')).toBeUndefined();
    expect(liabilities.find((l) => l.tag === 'M-Rental Flat')).toMatchObject({ amount: 271000 });
  });

  it('investment kind: rejects overselling deposit/mortgage past the current position', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            title: 'Rental Flat',
            investment: { tag: 'Rental Flat', deposit: 20000, amount: 300000 },
          }),
        ],
        balance: {
          asset: {
            investments: [
              { id: 'investments_1', tag: 'Rental Flat', deposit: 20000, amount: 300000 },
            ],
          },
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', { depositMinor: 99999999, mortgageMinor: 1 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('investment kind with a payback: rejects a payback that exceeds the attached liability', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            title: 'Rental Flat',
            investment: { tag: 'Rental Flat', deposit: 20000, amount: 300000 },
            liabilitie: { tag: 'Rental Flat', amount: 2315, investment: true, credit: 463 },
          }),
        ],
        balance: {
          asset: {
            investments: [
              { id: 'investments_1', tag: 'Rental Flat', deposit: 20000, amount: 300000 },
            ],
          },
          liabilities: [
            {
              id: 'liabilities_1',
              tag: 'Rental Flat',
              amount: 2315,
              investment: true,
              credit: 463,
            },
          ],
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', {
        depositMinor: 500000,
        mortgageMinor: 2900000,
        payback: { amountMinor: 999999999, creditMinor: 0 },
      }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('rejects a payback when the grow project has no attached liability', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            title: 'Rental Flat',
            investment: { tag: 'Rental Flat', deposit: 20000, amount: 300000 },
          }),
        ],
        balance: {
          asset: {
            investments: [
              { id: 'investments_1', tag: 'Rental Flat', deposit: 20000, amount: 300000 },
            ],
          },
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      sellGrow(deps, 'user_1', 'grow_1', {
        depositMinor: 500000,
        mortgageMinor: 2900000,
        payback: { amountMinor: 1, creditMinor: 1 },
      }),
    ).rejects.toMatchObject({ code: 'GROW_NO_LIABILITY' });
  });
});

describe('dividendGrow', () => {
  it('records a dividend transaction with no Share/Grow mutation', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 10, price: 415 } })] },
    };
    const { deps, current } = writableDeps(document);
    const result = await dividendGrow(deps, 'user_1', 'grow_1', { quantity: 10, priceMinor: 5000 });

    expect(result.transaction.amountMinor).toBe(50000);
    expect(result.transaction.comment).toBe('Dividende Share MSFT 10 x 50;');
    expect(result.grow.share).toEqual({ tag: 'MSFT', quantity: 10, priceMinor: 41500 });
    expect(current().data.balance).toBeUndefined();
  });

  it('rejects a dividend on a non-share-kind grow project', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ isAsset: true })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      dividendGrow(deps, 'user_1', 'grow_1', { quantity: 1, priceMinor: 100 }),
    ).rejects.toMatchObject({ code: 'GROW_NOT_SHARE_KIND' });
  });

  it('rejects a zero or negative quantity/priceMinor', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: { grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 10, price: 415 } })] },
    };
    const { deps } = writableDeps(document);
    await expect(
      dividendGrow(deps, 'user_1', 'grow_1', { quantity: 0, priceMinor: 100 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
    await expect(
      dividendGrow(deps, 'user_1', 'grow_1', { quantity: 1, priceMinor: -100 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });
});

describe('paybackGrow', () => {
  it('partial payback reduces the liability and Grow.liabilitie without removing it', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            liabilitie: { tag: 'MSFT', amount: 5000, investment: true, credit: 200 },
          }),
        ],
        balance: {
          liabilities: [
            { id: 'liabilities_1', tag: 'MSFT', amount: 5000, investment: true, credit: 200 },
          ],
        },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await paybackGrow(deps, 'user_1', 'grow_1', {
      amountMinor: 50000,
      creditMinor: 10000,
    });

    expect(result.grow.status).toBe('paid back');
    expect(result.grow.liabilitie.amountMinor).toBe(450000);
    expect(result.transaction.amountMinor).toBe(-60000);
    expect(current().data.balance.liabilities[0]).toMatchObject({ amount: 4500, credit: 100 });
  });

  it('rejects a payback that exceeds the current liability amount/credit instead of persisting a negative balance', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            liabilitie: { tag: 'MSFT', amount: 5000, investment: true, credit: 200 },
          }),
        ],
        balance: {
          liabilities: [
            { id: 'liabilities_1', tag: 'MSFT', amount: 5000, investment: true, credit: 200 },
          ],
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      paybackGrow(deps, 'user_1', 'grow_1', { amountMinor: 99999999, creditMinor: 0 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('rejects a payback where both amountMinor and creditMinor are 0', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            liabilitie: { tag: 'MSFT', amount: 5000, investment: true, credit: 200 },
          }),
        ],
        balance: {
          liabilities: [
            { id: 'liabilities_1', tag: 'MSFT', amount: 5000, investment: true, credit: 200 },
          ],
        },
      },
    };
    const { deps } = writableDeps(document);
    await expect(
      paybackGrow(deps, 'user_1', 'grow_1', { amountMinor: 0, creditMinor: 0 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });

  it('a final payback that zeroes both amount and credit removes the liability and nulls Grow.liabilitie', async () => {
    const document = {
      _id: 'user_1',
      _rev: '1-a',
      data: {
        grow: [
          minimalRawGrow({
            liabilitie: { tag: 'MSFT', amount: 500, investment: true, credit: 100 },
          }),
        ],
        balance: {
          liabilities: [
            { id: 'liabilities_1', tag: 'MSFT', amount: 500, investment: true, credit: 100 },
          ],
        },
      },
    };
    const { deps, current } = writableDeps(document);
    const result = await paybackGrow(deps, 'user_1', 'grow_1', {
      amountMinor: 50000,
      creditMinor: 10000,
    });

    expect(result.grow.status).toBe('paid off');
    expect(result.grow.liabilitie).toBeNull();
    expect(current().data.balance.liabilities).toEqual([]);
  });

  it('rejects a payback when the grow project has no attached liability', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    await expect(
      paybackGrow(deps, 'user_1', 'grow_1', { amountMinor: 1, creditMinor: 1 }),
    ).rejects.toMatchObject({ code: 'GROW_NO_LIABILITY' });
  });
});

describe('cashflowGrow', () => {
  it('nets out an attached liability credit with no Grow mutation', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    const result = await cashflowGrow(deps, 'user_1', 'grow_1', {
      cashflowMinor: 15000,
      creditMinor: 2000,
    });

    expect(result.transaction.amountMinor).toBe(13000);
    expect(result.transaction.comment).toBe('CASHFLOW 150 - CREDIT 20;');
    expect(result.transaction.account).toBe('Income');
  });
});

describe('depositGrow', () => {
  it('records a cash outflow with no Grow mutation', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    const result = await depositGrow(deps, 'user_1', 'grow_1', { amountMinor: 30000 });

    expect(result.transaction.amountMinor).toBe(-30000);
    expect(result.transaction.comment).toBe('Deposit 300;');
    expect(result.transaction.account).toBe('Fire');
  });

  it('rejects a zero or negative amountMinor', async () => {
    const document = { _id: 'user_1', _rev: '1-a', data: { grow: [minimalRawGrow()] } };
    const { deps } = writableDeps(document);
    await expect(depositGrow(deps, 'user_1', 'grow_1', { amountMinor: 0 })).rejects.toMatchObject({
      code: 'GROW_INVALID_INPUT',
    });
    await expect(
      depositGrow(deps, 'user_1', 'grow_1', { amountMinor: -30000 }),
    ).rejects.toMatchObject({ code: 'GROW_INVALID_INPUT' });
  });
});
