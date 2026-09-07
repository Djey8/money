import { computeFireCoverage } from './fire-coverage';
import { ApiTransaction } from '../transactions/transaction';

function tx(overrides: Partial<ApiTransaction>): ApiTransaction {
  return {
    id: 'tx_1',
    account: 'Daily',
    amountMinor: -1000,
    date: '2026-06-15',
    time: '12:00',
    category: '@Groceries',
    comment: '',
    currency: 'EUR',
    ...overrides,
  };
}

describe('computeFireCoverage', () => {
  const now = new Date(2026, 8, 7); // 2026-09-07

  it('averages expense-account spending across historical months, excluding the current month', () => {
    const transactions = [
      tx({ id: '1', date: '2026-07-10', amountMinor: -10000 }),
      tx({ id: '2', date: '2026-08-05', amountMinor: -20000 }),
      tx({ id: '3', date: '2026-09-01', amountMinor: -99999 }), // current month, excluded
    ];
    const report = computeFireCoverage(transactions, 45000, now);
    expect(report.monthsConsidered).toBe(2);
    expect(report.averageMonthlyExpensesMinor).toBe(15000);
    expect(report.coverageRatio).toBe(3);
    expect(report.mojoAmountMinor).toBe(45000);
  });

  it('sums multiple transactions within the same month before averaging', () => {
    const transactions = [
      tx({ id: '1', date: '2026-07-01', amountMinor: -5000 }),
      tx({ id: '2', date: '2026-07-20', amountMinor: -5000 }),
    ];
    const report = computeFireCoverage(transactions, 10000, now);
    expect(report.monthsConsidered).toBe(1);
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
    expect(report.coverageRatio).toBe(1);
  });

  it('only counts Daily/Splurge/Smile/Fire accounts, not Income or Mojo', () => {
    const transactions = [
      tx({ id: '1', account: 'Daily', date: '2026-07-01', amountMinor: -10000 }),
      tx({ id: '2', account: 'Income', date: '2026-07-02', amountMinor: -5000 }),
      tx({ id: '3', account: 'Mojo', date: '2026-07-03', amountMinor: -5000 }),
    ];
    const report = computeFireCoverage(transactions, 10000, now);
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
  });

  it('ignores inflows (amountMinor >= 0) on expense accounts', () => {
    const transactions = [
      tx({ id: '1', date: '2026-07-01', amountMinor: -10000 }),
      tx({ id: '2', date: '2026-07-02', amountMinor: 5000 }), // e.g. a refund
    ];
    const report = computeFireCoverage(transactions, 10000, now);
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
  });

  it('excludes inter-account transfers, unlike the original UI gauge', () => {
    const transactions = [
      tx({ id: '1', date: '2026-07-01', amountMinor: -10000, category: '@Groceries' }),
      // An Income -> Smile transfer posted from Smile: category `Smile` is a transfer, must not count.
      tx({ id: '2', date: '2026-07-02', amountMinor: -20000, category: 'Smile', account: 'Smile' }),
    ];
    const report = computeFireCoverage(transactions, 10000, now);
    expect(report.averageMonthlyExpensesMinor).toBe(10000);
  });

  it('returns a null coverageRatio, not a fabricated ratio, when there is no expense history', () => {
    const report = computeFireCoverage([], 50000, now);
    expect(report.monthsConsidered).toBe(0);
    expect(report.averageMonthlyExpensesMinor).toBe(0);
    expect(report.coverageRatio).toBeNull();
  });

  it('returns a null coverageRatio when the only expense data is in the current month', () => {
    const transactions = [tx({ id: '1', date: '2026-09-05', amountMinor: -10000 })];
    const report = computeFireCoverage(transactions, 50000, now);
    expect(report.coverageRatio).toBeNull();
  });

  it('handles a zero Mojo balance as a valid, non-null zero ratio', () => {
    const transactions = [tx({ id: '1', date: '2026-07-01', amountMinor: -10000 })];
    const report = computeFireCoverage(transactions, 0, now);
    expect(report.coverageRatio).toBe(0);
  });
});
