import { balanceSheet, incomeStatement, standings } from './table-statements';

const sub = (title: string, amountMinor: number) => ({ title, amountMinor });
const books = (over: Record<string, unknown> = {}) =>
  ({
    state: { professionId: 'p', gameSubscriptionTitles: ['Salary', 'Rent'], children: 1 },
    subscriptions: [
      sub('Salary', 500000),
      sub('Rent', -150000),
      sub('EFH Cashflow', 40000),
      sub('Other', 99),
    ],
    transactions: [
      { account: 'Daily', amountMinor: 250000, category: '', comment: '', date: '', time: '' },
    ],
    allocation: { daily: 100, splurge: 0, smile: 0, fire: 0 },
    shares: [{ tag: 'ACME', quantity: 10, priceMinor: 2500 }],
    investments: [{ tag: 'EFH', depositMinor: 300000, amountMinor: 1200000 }],
    assets: [{ tag: 'Gold', amountMinor: 100000 }],
    liabilities: [{ tag: 'Mortgage', amountMinor: 1200000, investment: true }],
    ...over,
  }) as never;

describe('incomeStatement', () => {
  it('splits the game subscriptions into salary, passive income and expenses', () => {
    const i = incomeStatement(books());
    expect(i.salary).toEqual([{ label: 'Salary', amountMinor: 500000 }]);
    expect(i.expenses).toEqual([{ label: 'Rent', amountMinor: 150000 }]);
    expect(i.totalExpensesMinor).toBe(150000);
    expect(i.totalIncomeMinor).toBe(500000);
    expect(i.cashflowMinor).toBe(350000);
  });

  it('counts a cashflow subscription of the game as passive income', () => {
    const b = books({
      state: { professionId: 'p', gameSubscriptionTitles: ['Salary', 'EFH Cashflow'], children: 0 },
    });
    const i = incomeStatement(b);
    expect(i.passive).toEqual([{ label: 'EFH Cashflow', amountMinor: 40000 }]);
    expect(i.totalIncomeMinor).toBe(540000);
  });
});

describe('balanceSheet', () => {
  it('adds up what is owned and owed', () => {
    const s = balanceSheet(books(), 'Cash');
    expect(s.assets.map((l) => l.label)).toEqual(['Cash', 'ACME × 10', 'EFH', 'Gold']);
    expect(s.assets.find((l) => l.label === 'ACME × 10')!.amountMinor).toBe(25000);
    expect(s.totalLiabilitiesMinor).toBe(1200000);
    expect(s.netWorthMinor).toBe(s.totalAssetsMinor - 1200000);
  });
});

describe('standings', () => {
  const player = (seat: number, name: string, b: unknown) => ({
    seat,
    name,
    color: '#000',
    books: b,
  });
  const titles = ['Salary', 'Rent', 'EFH Cashflow'];
  const escaped = books({
    state: { professionId: 'p', gameSubscriptionTitles: titles, children: 0 },
    subscriptions: [sub('Salary', 1000), sub('Rent', -100), sub('EFH Cashflow', 500)],
  });
  const behind = books({
    state: { professionId: 'p', gameSubscriptionTitles: titles, children: 0 },
    subscriptions: [sub('Salary', 500000), sub('Rent', -150000), sub('EFH Cashflow', 10000)],
  });

  it('puts the one out of the rat race first, then by how much passive income covers', () => {
    const view = {
      players: [player(0, 'Ann', behind), player(1, 'Bob', escaped), player(2, 'Cy', null)],
    } as never;
    const rows = standings(view);
    expect(rows.map((r) => r.name)).toEqual(['Bob', 'Ann']);
    expect(rows[0].outcome).toBe('escaped');
    expect(rows[1].coverage).toBeCloseTo(10000 / 150000);
  });
});
