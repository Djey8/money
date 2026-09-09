import { computeIncomeStatement } from './income-statement';
import { PeriodRange } from './period-range';
import { ApiTransaction } from '../transactions/transaction';

const currentRange: PeriodRange = {
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  label: 'Sep 2026',
};
const previousRange: PeriodRange = {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  label: 'Aug 2026',
};

function tx(overrides: Partial<ApiTransaction>): ApiTransaction {
  return {
    id: 'tx',
    account: 'Income',
    amountMinor: 10000,
    currency: 'EUR',
    date: '2026-09-15',
    time: '09:00',
    category: '@Salary',
    comment: '',
    ...overrides,
  };
}

describe('computeIncomeStatement', () => {
  it('classifies income as revenue by default (no matching tag)', () => {
    const statement = computeIncomeStatement(
      [tx({ amountMinor: 100000 })],
      currentRange,
      previousRange,
    );
    expect(statement.revenues.current).toBe(100000);
    expect(statement.interests.current).toBe(0);
    expect(statement.propertyIncome.current).toBe(0);
    expect(statement.otherIncome.current).toBe(0);
    expect(statement.totalIncome.current).toBe(100000);
  });

  it('classifies income matching an interest or share tag as interest', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 't1', category: '@Dividend', amountMinor: 500 }),
        tx({ id: 't2', category: '@AAPL', amountMinor: 700 }),
      ],
      currentRange,
      previousRange,
      { interestTags: ['Dividend'], shareTags: ['AAPL'] },
    );
    expect(statement.interests.current).toBe(1200);
    expect(statement.revenues.current).toBe(0);
  });

  it('classifies income matching a property or investment tag as property income', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 't1', category: '@Rental', amountMinor: 90000 }),
        tx({ id: 't2', category: '@BeachHouse', amountMinor: 30000 }),
      ],
      currentRange,
      previousRange,
      { propertyTags: ['Rental'], investmentTags: ['BeachHouse'] },
    );
    expect(statement.propertyIncome.current).toBe(120000);
    expect(statement.revenues.current).toBe(0);
  });

  it('classifies income with an empty category as otherIncome, not revenue', () => {
    const statement = computeIncomeStatement(
      [tx({ category: '', amountMinor: 5000 })],
      currentRange,
      previousRange,
    );
    expect(statement.otherIncome.current).toBe(5000);
    expect(statement.revenues.current).toBe(0);
  });

  it('excludes inter-account transfers from both income and expenses', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 't1', account: 'Income', category: '@Smile', amountMinor: 1000 }),
        tx({ id: 't2', account: 'Income', category: '@Mojo', amountMinor: 1000 }),
        tx({ id: 't3', account: 'Daily', category: '@Income', amountMinor: -500 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.totalIncome.current).toBe(0);
    expect(statement.totalExpenses.current).toBe(0);
  });

  it('excludes non-positive income and non-negative expense amounts', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 0 }),
        tx({ id: 't2', account: 'Income', amountMinor: -100 }),
        tx({ id: 't3', account: 'Daily', amountMinor: 0 }),
        tx({ id: 't4', account: 'Daily', amountMinor: 100 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.totalIncome.current).toBe(0);
    expect(statement.totalExpenses.current).toBe(0);
  });

  it('aggregates expenses per account, excluding transfers and non-expense accounts', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 't1', account: 'Daily', category: '@Food', amountMinor: -1000 }),
        tx({ id: 't2', account: 'Splurge', category: '@Fun', amountMinor: -2000 }),
        tx({ id: 't3', account: 'Mojo', category: '@Whatever', amountMinor: -3000 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.expensesByAccount.Daily.current).toBe(1000);
    expect(statement.expensesByAccount.Splurge.current).toBe(2000);
    expect(statement.totalExpenses.current).toBe(3000);
  });

  it('excludes transactions outside the given period range', () => {
    const statement = computeIncomeStatement(
      [tx({ date: '2026-10-01', amountMinor: 100000 })],
      currentRange,
      previousRange,
    );
    expect(statement.totalIncome.current).toBe(0);
  });

  it('computes netResult and savingsRatePercent correctly', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 100000 }),
        tx({ id: 't2', account: 'Daily', category: '@Food', amountMinor: -40000 }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.netResult.current).toBe(60000);
    expect(statement.savingsRatePercent.current).toBe(60);
  });

  it('returns a zero savings rate when income is zero, without dividing by zero', () => {
    const statement = computeIncomeStatement([], currentRange, previousRange);
    expect(statement.savingsRatePercent.current).toBe(0);
    expect(statement.savingsRatePercent.previous).toBe(0);
  });

  it('computes changePercent as a relative change vs. previous, including the previous-is-zero case', () => {
    const statement = computeIncomeStatement(
      [
        tx({ id: 'cur', account: 'Income', amountMinor: 150000, date: '2026-09-10' }),
        tx({ id: 'prev', account: 'Income', amountMinor: 100000, date: '2026-08-10' }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.revenues.current).toBe(150000);
    expect(statement.revenues.previous).toBe(100000);
    expect(statement.revenues.changePercent).toBe(50);

    const noPrevious = computeIncomeStatement(
      [tx({ account: 'Income', amountMinor: 100000, date: '2026-09-10' })],
      currentRange,
      previousRange,
    );
    expect(noPrevious.revenues.changePercent).toBe(0);
  });

  it('computes a relative changePercent for the savings-rate row too (not a percentage-point difference)', () => {
    // previous period: income 100000, expenses 80000 -> savings rate 20%
    // current period: income 100000, expenses 75000 -> savings rate 25%
    // relative change = (25 - 20) / |20| * 100 = 25, not 5.
    const statement = computeIncomeStatement(
      [
        tx({ id: 'cur-in', account: 'Income', amountMinor: 100000, date: '2026-09-01' }),
        tx({
          id: 'cur-ex',
          account: 'Daily',
          category: '@Food',
          amountMinor: -75000,
          date: '2026-09-01',
        }),
        tx({ id: 'prev-in', account: 'Income', amountMinor: 100000, date: '2026-08-01' }),
        tx({
          id: 'prev-ex',
          account: 'Daily',
          category: '@Food',
          amountMinor: -80000,
          date: '2026-08-01',
        }),
      ],
      currentRange,
      previousRange,
    );
    expect(statement.savingsRatePercent.current).toBe(25);
    expect(statement.savingsRatePercent.previous).toBe(20);
    expect(statement.savingsRatePercent.changePercent).toBe(25);
  });
});
