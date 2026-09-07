'use strict';

const { EncryptionSession } = require('@money/domain');
const {
  getIncomeStatement,
  getCashflow,
  getBalanceSheet,
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
