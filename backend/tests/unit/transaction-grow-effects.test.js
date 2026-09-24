'use strict';

/**
 * The Grow-trade guard rails and the `effects` report on the generic
 * transaction writes (transaction-repository.js, grow-reversal.js,
 * write-effects.js). CouchDB is mocked.
 */

const {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  batchTransactions,
} = require('../../repositories/transaction-repository');

function writableDeps(data) {
  let document = { _id: 'user_1', _rev: '1-a', data };
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

/** A SOL share project after one financed buy of 1.77 @ 88.33 (loan 50, credit 1) on top of 1 unit. */
function portfolioAfterFinancedBuy() {
  return {
    meta: { schemaVersion: 2 },
    grow: [
      {
        id: 'grow_sol',
        title: 'SOL',
        amount: 10000 + 15634 - 5000,
        cashflow: 0,
        isAsset: false,
        share: { tag: 'SOL', quantity: 2.77, price: 8833 },
        investment: null,
        liabilitie: { tag: 'SOL', amount: 5000, investment: true, credit: 100 },
      },
    ],
    income: { expenses: { fire: [{ tag: 'SOL', amount: -10634 }] } },
    balance: {
      asset: { shares: [{ id: 'shares_1', tag: 'SOL', quantity: 2.77, price: 8833 }] },
      liabilities: [
        { id: 'liabilities_1', tag: 'SOL', amount: 5000, credit: 100, investment: true },
      ],
    },
    transactions: [
      {
        id: 'tx_buy',
        account: 'Fire',
        amount: -(15634 - 5000),
        date: '2026-09-20',
        time: '10:00',
        category: '@SOL',
        comment: 'Liabilitie 50 1; Buy Share SOL 1.77 x 88.33;',
      },
    ],
  };
}

describe('Grow trades on the generic transaction endpoints', () => {
  it('refuses to create a transaction carrying a Grow trade statement', async () => {
    const { deps, current } = writableDeps({ meta: { schemaVersion: 2 } });
    await expect(
      createTransaction(deps, 'user_1', {
        account: 'Fire',
        amountMinor: -1000,
        date: '2026-09-24',
        time: '10:00',
        category: '@SOL',
        comment: 'Buy Share SOL 1 x 10;',
      }),
    ).rejects.toMatchObject({ code: 'TRANSACTION_GROW_TRADE' });
    expect(current().data.transactions).toBeUndefined();
  });

  it("refuses to change a Grow trade's amount, but allows its date", async () => {
    const { deps } = writableDeps(portfolioAfterFinancedBuy());
    await expect(
      updateTransaction(deps, 'user_1', 'tx_buy', { amountMinor: -1 }),
    ).rejects.toMatchObject({ code: 'TRANSACTION_GROW_LOCKED' });
    await expect(
      updateTransaction(deps, 'user_1', 'tx_buy', { date: '2026-09-21' }),
    ).resolves.toMatchObject({ date: '2026-09-21' });
  });

  it('refuses to turn an ordinary transaction into a Grow trade via its comment', async () => {
    const data = portfolioAfterFinancedBuy();
    data.transactions.push({
      id: 'tx_lunch',
      account: 'Daily',
      amount: -500,
      date: '2026-09-22',
      time: '12:00',
      category: '@Food',
      comment: 'Lunch',
    });
    const { deps } = writableDeps(data);
    await expect(
      updateTransaction(deps, 'user_1', 'tx_lunch', { comment: 'Sell Share SOL 1 x 1;' }),
    ).rejects.toMatchObject({ code: 'TRANSACTION_GROW_TRADE' });
  });

  it('deleting a Grow trade undoes its share, project and loan, and reports every change', async () => {
    const { deps, current } = writableDeps(portfolioAfterFinancedBuy());

    const { effects } = await deleteTransaction(deps, 'user_1', 'tx_buy');

    const data = current().data;
    expect(data.balance.asset.shares[0]).toMatchObject({ quantity: 1 });
    expect(data.balance.liabilities).toEqual([]);
    expect(data.grow[0]).toMatchObject({ amount: 10000, liabilitie: null });
    expect(data.grow[0].share).toMatchObject({ quantity: 1 });

    expect(effects.balanceSheet).toEqual(
      expect.arrayContaining([
        {
          type: 'share',
          tag: 'SOL',
          before: { quantity: 2.77, priceMinor: 8833 },
          after: { quantity: 1, priceMinor: 8833 },
        },
        {
          type: 'liability',
          tag: 'SOL',
          before: { amountMinor: 5000, creditMinor: 100 },
          after: null,
        },
      ]),
    );
    expect(effects.grow).toEqual([
      expect.objectContaining({
        id: 'grow_sol',
        before: expect.objectContaining({ amountMinor: 20634 }),
        after: expect.objectContaining({ amountMinor: 10000, liabilitie: null }),
      }),
    ]);
    expect(effects.incomeStatement).toEqual([
      { section: 'expenses.fire', tag: 'SOL', beforeMinor: -10634, afterMinor: 0 },
    ]);
  });

  it('a batch delete undoes the trade too, and reports effects for the whole batch', async () => {
    const { deps, current } = writableDeps(portfolioAfterFinancedBuy());
    const { results, effects } = await batchTransactions(deps, 'user_1', [
      { op: 'delete', id: 'tx_buy' },
      {
        op: 'create',
        fields: {
          account: 'Daily',
          amountMinor: -300,
          date: '2026-09-24',
          time: '09:00',
          category: '@Food',
          comment: 'Buy Share SOL 1 x 1;',
        },
      },
    ]);
    expect(results[0]).toMatchObject({ status: 'deleted' });
    expect(results[1]).toMatchObject({ status: 'error' });
    expect(current().data.balance.asset.shares[0]).toMatchObject({ quantity: 1 });
    expect(effects.balanceSheet.length).toBeGreaterThan(0);
  });
});

describe('effects on an ordinary transaction write', () => {
  it('reports the income-statement line it changed, and nothing else', async () => {
    const { deps } = writableDeps({ meta: { schemaVersion: 2 } });
    const created = await createTransaction(deps, 'user_1', {
      account: 'Daily',
      amountMinor: -1250,
      date: '2026-09-24',
      time: '12:00',
      category: '@Food',
      comment: 'Lunch',
    });
    expect(created.effects).toEqual({
      incomeStatement: [
        { section: 'expenses.daily', tag: 'Food', beforeMinor: 0, afterMinor: -1250 },
      ],
      balanceSheet: [],
      smile: [],
      fire: [],
      mojo: null,
      grow: [],
    });
  });
});
