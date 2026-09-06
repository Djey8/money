import { ApiTransaction } from './transaction';
import { summarizeTransactionAccounting } from './accounting';

function transaction(overrides: Partial<ApiTransaction>): ApiTransaction {
  return {
    id: 'tx',
    account: 'Daily',
    amountMinor: -100,
    currency: 'EUR',
    date: '2026-09-06',
    time: '09:00',
    category: '@Food',
    comment: '',
    ...overrides,
  };
}

describe('summarizeTransactionAccounting', () => {
  it('aggregates income and each expense account in minor units', () => {
    const summary = summarizeTransactionAccounting([
      transaction({ id: 'income-1', account: 'Income', amountMinor: 100000, category: '@Salary' }),
      transaction({ id: 'income-2', account: 'Income', amountMinor: 2500, category: '@Salary' }),
      transaction({ id: 'daily', account: 'Daily', amountMinor: -1250, category: '@Food' }),
      transaction({ id: 'fire', account: 'Fire', amountMinor: -500, category: '@Insurance' }),
    ]);
    expect(summary.revenues).toEqual([{ tag: 'Salary', amountMinor: 102500 }]);
    expect(summary.expenses.Daily).toEqual([{ tag: 'Food', amountMinor: -1250 }]);
    expect(summary.expenses.Fire).toEqual([{ tag: 'Insurance', amountMinor: -500 }]);
  });

  it('skips zero values and does not create entries for unsupported accounts', () => {
    const summary = summarizeTransactionAccounting([
      transaction({ amountMinor: 0 }),
      transaction({ id: 'other', account: 'Transfer', amountMinor: 100 }),
    ]);
    expect(summary.revenues).toEqual([]);
    expect(summary.expenses.Daily).toEqual([]);
  });
});
