import { computeKpiReport } from './kpis';
import { PeriodRange } from './period-range';
import { BalanceSheet } from './balance-sheet';
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
    amountMinor: 100000,
    currency: 'EUR',
    date: '2026-09-15',
    time: '09:00',
    category: '@Salary',
    comment: '',
    ...overrides,
  };
}

function zeroBalance(): BalanceSheet {
  return {
    assets: { cash: 0, shares: 0, investments: 0, properties: 0, total: 0 },
    liabilities: { debts: 0, total: 0 },
    equity: 0,
    netWorth: 0,
  };
}

describe('computeKpiReport', () => {
  it('computes savingsRatePercent and netMarginPercent as the same value (matching the original redundancy)', () => {
    const report = computeKpiReport(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 100000 }),
        tx({ id: 't2', account: 'Daily', category: '@Food', amountMinor: -40000 }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
    );
    expect(report.ratios.savingsRatePercent).toBe(60);
    expect(report.ratios.netMarginPercent).toBe(60);
  });

  it('computes fixedCostRatioPercent from expenses matching a subscription category', () => {
    const report = computeKpiReport(
      [
        tx({ id: 't1', account: 'Daily', category: '@Netflix', amountMinor: -1000 }),
        tx({ id: 't2', account: 'Daily', category: '@Groceries', amountMinor: -3000 }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
      ['@Netflix'],
    );
    expect(report.ratios.fixedCostRatioPercent).toBe(25);
  });

  it('computes debtRatio and equityRatioPercent from the given balance sheet', () => {
    const balance: BalanceSheet = {
      assets: { cash: 800000, shares: 0, investments: 0, properties: 0, total: 800000 },
      liabilities: { debts: 200000, total: 200000 },
      equity: 600000,
      netWorth: 600000,
    };
    const report = computeKpiReport([], currentRange, previousRange, balance);
    expect(report.ratios.debtRatio).toBe(200000 / 800000);
    expect(report.ratios.equityRatioPercent).toBe((600000 / (800000 + 200000)) * 100);
  });

  it('computes interestCoverage from net result over "payback liabilitie" transactions in range', () => {
    const report = computeKpiReport(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 100000 }),
        tx({
          id: 't2',
          account: 'Daily',
          amountMinor: -20000,
          comment: 'Payback Liabilitie Mortgage;',
        }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
    );
    expect(report.ratios.interestCoverage).toBe(80000 / 20000);
  });

  it('returns zero ratios without dividing by zero when there is no income, no expenses, and no assets', () => {
    const report = computeKpiReport([], currentRange, previousRange, zeroBalance());
    expect(report.ratios.savingsRatePercent).toBe(0);
    expect(report.ratios.fixedCostRatioPercent).toBe(0);
    expect(report.ratios.debtRatio).toBe(0);
    expect(report.ratios.equityRatioPercent).toBe(0);
    expect(report.ratios.interestCoverage).toBe(0);
  });

  it('diverges from the statement savings rate on a Mojo-tagged expense, since the dashboard formula does not exclude Mojo', () => {
    const report = computeKpiReport(
      [
        tx({ id: 't1', account: 'Income', amountMinor: 100000 }),
        tx({ id: 't2', account: 'Daily', category: '@Mojo', amountMinor: -10000 }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
    );
    // statement-side ratio excludes the @Mojo-tagged expense entirely (Mojo is a transfer category)
    expect(report.ratios.savingsRatePercent).toBe(100);
    // dashboard formula's exclude set omits Mojo, so it counts the same expense as ordinary spending
    expect(report.dashboardSavingsRatePercent).toBe(90);
  });

  it('computes dashboardFixedCostRatioPercent using the same subscription categories', () => {
    const report = computeKpiReport(
      [
        tx({ id: 't1', account: 'Daily', category: '@Netflix', amountMinor: -1000 }),
        tx({ id: 't2', account: 'Daily', category: '@Groceries', amountMinor: -3000 }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
      ['@Netflix'],
    );
    expect(report.dashboardFixedCostRatioPercent).toBe(25);
  });

  it('computes previousRatios and previousDashboard*Percent from the previous period independently', () => {
    const report = computeKpiReport(
      [
        tx({ id: 'cur', account: 'Income', amountMinor: 100000, date: '2026-09-10' }),
        tx({ id: 'prev', account: 'Income', amountMinor: 50000, date: '2026-08-10' }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
    );
    expect(report.ratios.savingsRatePercent).toBe(100);
    expect(report.previousRatios.savingsRatePercent).toBe(100);
    expect(report.dashboardSavingsRatePercent).toBe(100);
    expect(report.previousDashboardSavingsRatePercent).toBe(100);
  });

  it('ranks top expense and income categories by amount, capped at 5, with a percent of the category total', () => {
    const report = computeKpiReport(
      [
        tx({ id: 'e1', account: 'Daily', category: '@Groceries', amountMinor: -5000 }),
        tx({ id: 'e2', account: 'Daily', category: '@Fun', amountMinor: -2000 }),
        tx({ id: 'i1', account: 'Income', category: '@Salary', amountMinor: 90000 }),
        tx({ id: 'i2', account: 'Income', category: '@Bonus', amountMinor: 10000 }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
    );
    expect(report.topExpenses).toEqual([
      { category: 'Groceries', amountMinor: 5000, percent: (5000 / 7000) * 100 },
      { category: 'Fun', amountMinor: 2000, percent: (2000 / 7000) * 100 },
    ]);
    expect(report.topIncomes).toEqual([
      { category: 'Salary', amountMinor: 90000, percent: 90 },
      { category: 'Bonus', amountMinor: 10000, percent: 10 },
    ]);
  });

  it('excludes inter-account transfers from top categories and groups an empty category under "—"', () => {
    const report = computeKpiReport(
      [
        tx({ id: 't1', account: 'Income', category: '@Smile', amountMinor: 10000 }),
        tx({ id: 't2', account: 'Daily', category: '', amountMinor: -1500 }),
      ],
      currentRange,
      previousRange,
      zeroBalance(),
    );
    expect(report.topIncomes).toEqual([]);
    expect(report.topExpenses).toEqual([{ category: '—', amountMinor: 1500, percent: 100 }]);
  });
});
