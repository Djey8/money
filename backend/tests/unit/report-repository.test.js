'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  getIncomeStatement,
  getCashflow,
  getBalanceSheet,
  getKpis,
  getFireCoverage,
  getGrowPnl,
} = require('../../repositories/report-repository');

// Fixed reference date so period boundaries are deterministic regardless of
// the actual day this suite runs — transactions below are dated inside
// September 2026, "the current month" as of this fixture.
const NOW = new Date(2026, 8, 15);

function dependencies(data, encryptionConfig) {
  return {
    usersDb: { get: jest.fn(async () => ({ data })) },
    authDb: { get: jest.fn(async () => ({ encryptionConfig })) },
  };
}

describe('getIncomeStatement', () => {
  it('computes totals from the caller-owned transaction list for the given period', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Income',
          amount: 1000,
          date: '2026-09-10',
          time: '09:00',
          category: '@Salary',
          comment: '',
        },
        {
          id: 'tx_2',
          account: 'Daily',
          amount: -400,
          date: '2026-09-11',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
      ],
    });
    const statement = await getIncomeStatement(deps, 'user_1', {
      period: 'month',
      offset: 0,
      now: NOW,
    });
    expect(statement.period).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      label: 'Sep 2026',
    });
    expect(statement.revenues.current).toBe(100000);
    expect(statement.expensesByAccount.Daily.current).toBe(40000);
    expect(statement.netResult.current).toBe(60000);
  });

  it('classifies income using tags from balance/shares and income/revenue entries', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Income',
          amount: 5,
          date: '2026-09-10',
          time: '09:00',
          category: '@AAPL',
          comment: '',
        },
      ],
      balance: { asset: { shares: [{ tag: 'AAPL', quantity: 1, price: 100 }] } },
    });
    const statement = await getIncomeStatement(deps, 'user_1', {
      period: 'month',
      offset: 0,
      now: NOW,
    });
    expect(statement.interests.current).toBe(500);
    expect(statement.revenues.current).toBe(0);
  });

  it('decrypts transactions and tag fields when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        transactions: [
          {
            id: encryptField('tx_1'),
            account: encryptField('Income'),
            amount: encryptField('250'),
            date: encryptField('2026-09-10'),
            time: encryptField('09:00'),
            category: encryptField('@Rental'),
            comment: encryptField(''),
          },
        ],
        income: { revenue: { properties: [{ tag: encryptField('Rental') }] } },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const statement = await getIncomeStatement(deps, 'user_1', {
      period: 'month',
      offset: 0,
      now: NOW,
    });
    expect(statement.propertyIncome.current).toBe(25000);
  });

  it('returns an all-zero statement for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    const statement = await getIncomeStatement(deps, 'user_1', {
      period: 'month',
      offset: 0,
      now: NOW,
    });
    expect(statement.totalIncome.current).toBe(0);
    expect(statement.totalExpenses.current).toBe(0);
  });

  it('computes the previous period as one period before the requested offset', async () => {
    const deps = dependencies({ transactions: [] });
    const statement = await getIncomeStatement(deps, 'user_1', {
      period: 'month',
      offset: 0,
      now: NOW,
    });
    expect(statement.previousPeriod).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      label: 'Aug 2026',
    });
  });

  it('does not crash on a legacy transaction with an empty category', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -300,
          date: '2026-09-10',
          time: '09:00',
          category: '',
          comment: '',
        },
      ],
    });
    const statement = await getIncomeStatement(deps, 'user_1', {
      period: 'month',
      offset: 0,
      now: NOW,
    });
    expect(statement.expensesByAccount.Daily.current).toBe(30000);
  });

  it('defaults now to the real current time when omitted', async () => {
    const deps = dependencies({ transactions: [] });
    const statement = await getIncomeStatement(deps, 'user_1', { period: 'year', offset: 0 });
    expect(statement.period.label).toBe(String(new Date().getFullYear()));
  });
});

describe('getCashflow', () => {
  it('computes operating, investing, financing, and mojo totals for the given period', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Income',
          amount: 1000,
          date: '2026-09-10',
          time: '09:00',
          category: '@Salary',
          comment: '',
        },
        {
          id: 'tx_2',
          account: 'Income',
          amount: -200,
          date: '2026-09-11',
          time: '09:00',
          category: '@Fire',
          comment: '',
        },
        {
          id: 'tx_3',
          account: 'Daily',
          amount: -150,
          date: '2026-09-12',
          time: '09:00',
          category: '@Loan',
          comment: 'Payback Liabilitie Mortgage;',
        },
        {
          id: 'tx_4',
          account: 'Mojo',
          amount: 50,
          date: '2026-09-13',
          time: '09:00',
          category: '',
          comment: '',
        },
      ],
    });
    const statement = await getCashflow(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(statement.period).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      label: 'Sep 2026',
    });
    expect(statement.operating.current).toBe(100000);
    expect(statement.investing.current).toBe(20000);
    expect(statement.financing.current).toBe(15000);
    expect(statement.mojo.current).toBe(5000);
    expect(statement.netCashflow.current).toBe(100000 - 20000 - 15000 - 5000);
  });

  it('decrypts transactions and comments when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        transactions: [
          {
            id: encryptField('tx_1'),
            account: encryptField('Daily'),
            amount: encryptField('-150'),
            date: encryptField('2026-09-10'),
            time: encryptField('09:00'),
            category: encryptField('@Loan'),
            comment: encryptField('Payback Liabilitie Mortgage;'),
          },
        ],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const statement = await getCashflow(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(statement.financing.current).toBe(15000);
  });

  it('returns an all-zero statement for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    const statement = await getCashflow(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(statement.netCashflow.current).toBe(0);
  });

  it('defaults now to the real current time when omitted', async () => {
    const deps = dependencies({ transactions: [] });
    const statement = await getCashflow(deps, 'user_1', { period: 'year', offset: 0 });
    expect(statement.period.label).toBe(String(new Date().getFullYear()));
  });
});

describe('getBalanceSheet', () => {
  it('aggregates assets, shares, investments, properties, and liabilities into one snapshot', async () => {
    const deps = dependencies({
      balance: {
        asset: {
          assets: [{ tag: 'Car', amount: 8000 }],
          shares: [{ tag: 'MSFT', quantity: 10, price: 415 }],
          investments: [{ tag: 'Rental Unit A', amount: 180000, deposit: 30000 }],
        },
        liabilities: [{ tag: 'Mortgage', amount: 150000 }],
      },
      income: { revenue: { properties: [{ tag: 'Rental Unit A', amount: 800 }] } },
    });
    const sheet = await getBalanceSheet(deps, 'user_1');
    expect(sheet.assets.cash).toBe(800000);
    expect(sheet.assets.shares).toBe(415000);
    expect(sheet.assets.investments).toBe(21000000);
    expect(sheet.assets.properties).toBe(80000);
    expect(sheet.liabilities.debts).toBe(15000000);
    expect(sheet.assets.total).toBe(22295000);
    expect(sheet.equity).toBe(7295000);
    expect(sheet.netWorth).toBe(7295000);
  });

  it('decrypts every entry field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        balance: {
          asset: {
            assets: [{ tag: encryptField('Car'), amount: encryptField('8000') }],
          },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const sheet = await getBalanceSheet(deps, 'user_1');
    expect(sheet.assets.cash).toBe(800000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      balance: {
        asset: {
          assets: [{ tag: 'Car', amount: 800000 }],
          shares: [{ tag: 'MSFT', quantity: 10, price: 41500 }],
          investments: [{ tag: 'Rental Unit A', amount: 18000000, deposit: 3000000 }],
        },
      },
    });
    const sheet = await getBalanceSheet(deps, 'user_1');
    expect(sheet.assets.cash).toBe(800000);
    expect(sheet.assets.shares).toBe(415000);
    expect(sheet.assets.investments).toBe(21000000);
  });

  it('returns an all-zero snapshot for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    const sheet = await getBalanceSheet(deps, 'user_1');
    expect(sheet.assets.total).toBe(0);
    expect(sheet.equity).toBe(0);
  });
});

describe('getKpis', () => {
  it('computes ratios for the period plus the balance sheet snapshot in one call', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Income',
          amount: 1000,
          date: '2026-09-10',
          time: '09:00',
          category: '@Salary',
          comment: '',
        },
        {
          id: 'tx_2',
          account: 'Daily',
          amount: -400,
          date: '2026-09-11',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
      ],
      balance: { asset: { assets: [{ tag: 'Car', amount: 8000 }] } },
    });
    const report = await getKpis(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(report.period).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      label: 'Sep 2026',
    });
    expect(report.ratios.savingsRatePercent).toBe(60);
    expect(report.ratios.debtRatio).toBe(0);
    expect(report.dashboardSavingsRatePercent).toBe(60);
    expect(report.topExpenses).toEqual([{ category: 'Food', amountMinor: 40000, percent: 100 }]);
  });

  it('matches expenses against decrypted subscription categories for the fixed-cost ratios', async () => {
    const deps = dependencies({
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -10,
          date: '2026-09-10',
          time: '09:00',
          category: '@Netflix',
          comment: '',
        },
        {
          id: 'tx_2',
          account: 'Daily',
          amount: -30,
          date: '2026-09-10',
          time: '09:00',
          category: '@Groceries',
          comment: '',
        },
      ],
      subscriptions: [{ title: 'Netflix', category: '@Netflix', amount: -10 }],
    });
    const report = await getKpis(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(report.ratios.fixedCostRatioPercent).toBe(25);
    expect(report.dashboardFixedCostRatioPercent).toBe(25);
  });

  it('decrypts subscription categories and balance-sheet entries when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        transactions: [
          {
            id: encryptField('tx_1'),
            account: encryptField('Daily'),
            amount: encryptField('-10'),
            date: encryptField('2026-09-10'),
            time: encryptField('09:00'),
            category: encryptField('@Netflix'),
            comment: encryptField(''),
          },
        ],
        subscriptions: [
          {
            title: encryptField('Netflix'),
            category: encryptField('@Netflix'),
            amount: encryptField('-10'),
          },
        ],
        balance: {
          asset: { assets: [{ tag: encryptField('Car'), amount: encryptField('8000') }] },
        },
      },
      { key: 'secret', encryptDatabase: true },
    );
    const report = await getKpis(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(report.ratios.fixedCostRatioPercent).toBe(100);
  });

  it('returns an all-zero report for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    const report = await getKpis(deps, 'user_1', { period: 'month', offset: 0, now: NOW });
    expect(report.ratios.savingsRatePercent).toBe(0);
    expect(report.topExpenses).toEqual([]);
  });

  it('defaults now to the real current time when omitted', async () => {
    const deps = dependencies({ transactions: [] });
    const report = await getKpis(deps, 'user_1', { period: 'year', offset: 0 });
    expect(report.period.label).toBe(String(new Date().getFullYear()));
  });
});

describe('getFireCoverage', () => {
  it('divides the Mojo reserve by the average of historical months with expense-account spending', async () => {
    const deps = dependencies({
      mojo: { amount: 450, target: 2000 },
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -100,
          date: '2026-07-10',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
        {
          id: 'tx_2',
          account: 'Splurge',
          amount: -200,
          date: '2026-08-05',
          time: '09:00',
          category: '@Hobby',
          comment: '',
        },
        {
          id: 'tx_3',
          account: 'Daily',
          amount: -999,
          date: '2026-09-01',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
      ],
    });
    const report = await getFireCoverage(deps, 'user_1', { now: NOW });
    expect(report.monthsConsidered).toBe(2);
    expect(report.averageMonthlyExpensesMinor).toBe(15000);
    expect(report.mojoAmountMinor).toBe(45000);
    expect(report.coverageRatio).toBe(3);
  });

  it('excludes an inter-account transfer, unlike the original UI gauge', async () => {
    const deps = dependencies({
      mojo: { amount: 100, target: 2000 },
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -100,
          date: '2026-07-10',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
        {
          id: 'tx_2',
          account: 'Smile',
          amount: -200,
          date: '2026-07-11',
          time: '09:00',
          category: 'Smile',
          comment: '',
        },
      ],
    });
    const report = await getFireCoverage(deps, 'user_1', { now: NOW });
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
  });

  it('decrypts every field when database encryption is enabled', async () => {
    const session = new EncryptionSession('secret');
    const encryptField = (value) => session.encrypt(String(value));
    const deps = dependencies(
      {
        mojo: { amount: encryptField('450'), target: encryptField('2000') },
        transactions: [
          {
            id: 'tx_1',
            account: encryptField('Daily'),
            amount: encryptField('-100'),
            date: encryptField('2026-07-10'),
            time: encryptField('09:00'),
            category: encryptField('@Food'),
            comment: encryptField(''),
          },
        ],
      },
      { key: 'secret', encryptDatabase: true },
    );
    const report = await getFireCoverage(deps, 'user_1', { now: NOW });
    expect(report.mojoAmountMinor).toBe(45000);
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
  });

  it('leaves already-minor-unit values (schema version 2) unconverted', async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      mojo: { amount: 45000, target: 200000 },
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -10000,
          date: '2026-07-10',
          time: '09:00',
          category: '@Food',
          comment: '',
        },
      ],
    });
    const report = await getFireCoverage(deps, 'user_1', { now: NOW });
    expect(report.mojoAmountMinor).toBe(45000);
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
  });

  it('returns a null coverageRatio and zero balances for a user with no data document', async () => {
    const error = new Error('not_found');
    error.statusCode = 404;
    const deps = {
      usersDb: { get: jest.fn(async () => Promise.reject(error)) },
      authDb: { get: jest.fn(async () => Promise.reject(error)) },
    };
    const report = await getFireCoverage(deps, 'user_1', { now: NOW });
    expect(report.mojoAmountMinor).toBe(0);
    expect(report.monthsConsidered).toBe(0);
    expect(report.coverageRatio).toBeNull();
  });

  it('defaults now to the real current time when omitted', async () => {
    const deps = dependencies({ transactions: [] });
    const report = await getFireCoverage(deps, 'user_1', {});
    expect(report.monthsConsidered).toBe(0);
  });
});

describe('getGrowPnl', () => {
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

  it('sums every transaction whose category matches the grow project title', async () => {
    const deps = dependencies({
      grow: [minimalRawGrow()],
      transactions: [
        {
          id: 'tx_1',
          account: 'Fire',
          amount: -4150,
          date: '2026-07-10',
          time: '09:00',
          category: '@MSFT',
          comment: 'Buy Share MSFT 10 x 415;',
        },
        {
          id: 'tx_2',
          account: 'Income',
          amount: 500,
          date: '2026-08-05',
          time: '09:00',
          category: '@MSFT',
          comment: 'Dividende Share MSFT 10 x 50;',
        },
        {
          id: 'tx_3',
          account: 'Daily',
          amount: -20,
          date: '2026-08-06',
          time: '09:00',
          category: '@Groceries',
          comment: '',
        },
      ],
    });
    const report = await getGrowPnl(deps, 'user_1', 'grow_1');
    expect(report.title).toBe('MSFT');
    expect(report.investedMinor).toBe(415000);
    expect(report.returnedMinor).toBe(50000);
    expect(report.netCashflowMinor).toBe(50000 - 415000);
    expect(report.transactionCount).toBe(2);
  });

  it('returns null for a grow id that does not exist', async () => {
    const deps = dependencies({ grow: [minimalRawGrow()], transactions: [] });
    const report = await getGrowPnl(deps, 'user_1', 'grow_missing');
    expect(report).toBeNull();
  });

  it('returns all zeros for a grow project with no matching transactions', async () => {
    const deps = dependencies({
      grow: [minimalRawGrow()],
      transactions: [
        {
          id: 'tx_1',
          account: 'Daily',
          amount: -20,
          date: '2026-08-06',
          time: '09:00',
          category: '@Groceries',
          comment: '',
        },
      ],
    });
    const report = await getGrowPnl(deps, 'user_1', 'grow_1');
    expect(report).toMatchObject({
      title: 'MSFT',
      netCashflowMinor: 0,
      investedMinor: 0,
      returnedMinor: 0,
      transactionCount: 0,
      realizedGainMinor: 0,
      sharePosition: null,
    });
  });

  it("values a share project's balance-sheet position against its recorded cost", async () => {
    const deps = dependencies({
      meta: { schemaVersion: 2 },
      grow: [minimalRawGrow({ share: { tag: 'MSFT', quantity: 2, price: 30000 } })],
      balance: { asset: { shares: [{ id: 'shares_1', tag: 'MSFT', quantity: 2, price: 30000 }] } },
      transactions: [
        {
          id: 'tx_1',
          account: 'Fire',
          amount: -50000,
          date: '2026-08-06',
          time: '09:00',
          category: '@MSFT',
          comment: 'Buy Share MSFT 2 x 250;',
        },
      ],
    });
    const report = await getGrowPnl(deps, 'user_1', 'grow_1');
    expect(report.sharePosition).toEqual({
      quantity: 2,
      costBasisMinor: 50000,
      averageCostMinor: 25000,
      lastPriceMinor: 30000,
      marketValueMinor: 60000,
      unrealizedGainMinor: 10000,
    });
    expect(report.incompleteHistory).toBe(false);
  });
});
