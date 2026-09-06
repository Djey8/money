import { recalculateTransactionDerivedState } from './derived-state';
import { ApiTransaction } from './transaction';

const transaction = (overrides: Partial<ApiTransaction>): ApiTransaction => ({
  id: 'tx',
  account: 'Daily',
  amountMinor: -100,
  currency: 'EUR',
  date: '2026-09-06',
  time: '09:00',
  category: '@Food',
  comment: '',
  ...overrides,
});

describe('recalculateTransactionDerivedState', () => {
  it('rebuilds accounting and fund outputs from the same transaction sequence', () => {
    const result = recalculateTransactionDerivedState(
      [
        transaction({ id: 'income', account: 'Income', amountMinor: 100000, category: '@Salary' }),
        transaction({ id: 'mojo', account: 'Fire', amountMinor: -5000, category: '@Mojo' }),
      ],
      {
        funds: { mojo: { amountMinor: 500, targetMinor: 10000 }, smile: [], fire: [] },
      },
    );
    expect(result.accounting.revenues).toEqual([{ tag: 'Salary', amountMinor: 100000 }]);
    expect(result.funds.mojo).toEqual({ amountMinor: 5000, targetMinor: 10000 });
  });
});
