import { isActualIncome, plannedBudgetFromPayday } from './budget-income';

describe('what counts as income in the budget chart', () => {
  const tx = (over: object) => ({ account: 'Income', amountMinor: 100_00, ...over });

  it('counts salary, positive subscriptions and one-time payments booked to Income', () => {
    expect(isActualIncome(tx({ category: '@Salary', comment: '#cashflow' }))).toBe(true);
    expect(isActualIncome(tx({ category: '@OK4U card sale', comment: 'sold\n#cashflow' }))).toBe(
      true,
    );
    expect(
      isActualIncome(tx({ category: '@Loan to sister', comment: 'Loan to sister paid back' })),
    ).toBe(true);
  });

  it('does not count expenses, other accounts, a sale of a position, a Bank loan, or the starting savings', () => {
    expect(isActualIncome(tx({ amountMinor: -50_00 }))).toBe(false);
    expect(isActualIncome(tx({ account: 'Daily' }))).toBe(false);
    expect(isActualIncome(tx({ comment: 'Sell Share OK4U 10 x 25;' }))).toBe(false);
    expect(isActualIncome(tx({ comment: 'Sell Investment EFH 80000 60000;' }))).toBe(false);
    expect(
      isActualIncome({ account: 'Daily', amountMinor: 1_000_00, category: '@Bank loan' }),
    ).toBe(false);
    expect(
      isActualIncome(tx({ category: '@Savings', comment: 'Teacher savings\n#cashflow' })),
    ).toBe(false);
    expect(isActualIncome(tx({ category: '@Ersparnisse', comment: 'x\n#cashflow' }))).toBe(false);
  });

  it('a savings category of the player (no game marker) is income like any other', () => {
    expect(isActualIncome(tx({ category: '@Savings', comment: 'interest' }))).toBe(true);
  });
});

describe('the budget a Payday plans', () => {
  it('plans the expenses of the month per category, never income, and adds a category up', () => {
    const rows = plannedBudgetFromPayday([
      { account: 'Income', amountMinor: 3000_00, date: '2026-10-02', category: '@Salary' },
      { account: 'Daily', amountMinor: -500_00, date: '2026-10-03', category: '@Taxes' },
      { account: 'Daily', amountMinor: -100_00, date: '2026-10-04', category: '@Taxes' },
      { account: 'Daily', amountMinor: -20_00, date: '2026-10-05', category: '' },
    ]);
    expect(rows).toEqual([
      { date: '2026-10', tag: '@Taxes', amountMinor: 600_00 },
      { date: '2026-10', tag: '@others', amountMinor: 20_00 },
    ]);
  });
});
