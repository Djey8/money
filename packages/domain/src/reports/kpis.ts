import { ApiTransaction } from '../transactions/transaction';
import { PeriodRange } from './period-range';
import { BalanceSheet } from './balance-sheet';
import {
  EXPENSE_ACCOUNTS,
  cleanCategory,
  isTransfer,
  inRange,
  sumIncomeInRange,
  sumExpensesInRange,
} from './statement-shared';

/**
 * Ports `computeRatiosForRange`/`topCategories` from
 * `src/app/stats/statement/statement-calculations.ts` (canonical per
 * PLAN.md D-22) as `KeyRatios`/`topExpenses`/`topIncomes`, PLUS a second,
 * genuinely different pair of formulas ported from
 * `src/app/stats/stats-calculations.ts` (STATS-1's KPI dashboard):
 * `calculateSavingsRate`/`calculateFixedCostsRatio`.
 *
 * D-7 already documented that the Financial Statement's savings rate
 * (`ratios.savingsRatePercent` here, same value as
 * `/reports/income-statement`'s `savingsRatePercent`) and the KPI
 * dashboard's savings rate (`dashboardSavingsRatePercent` here) are
 * independently computed and must stay that way, exposed distinctly rather
 * than unified. Building this endpoint surfaced a second, previously
 * undocumented instance of the same pattern for fixed-cost ratio — see
 * PLAN.md D-23. Both dashboard formulas deliberately exclude
 * `Daily`/`Splurge`/`Smile`/`Fire`/`Income` from their transfer check but
 * NOT `Mojo` (unlike `isTransfer`'s five-plus-Mojo set) — that gap is
 * ported faithfully, not fixed, per the same reasoning as D-7/D-22.
 */

export interface KeyRatios {
  savingsRatePercent: number;
  fixedCostRatioPercent: number;
  /** Identical formula/value to `savingsRatePercent` in the original — a pre-existing redundancy in `KeyRatios`, ported faithfully rather than removed. */
  netMarginPercent: number;
  /** `liabilities.total / assets.total`, not a percentage (0 when assets total is 0). */
  debtRatio: number;
  equityRatioPercent: number;
  /** `netResult / interestExpenses`, not a percentage (0 when there are no matching "payback liabilitie" transactions in range). */
  interestCoverage: number;
}

export interface CategoryAggregate {
  category: string;
  amountMinor: number;
  percent: number;
}

export interface KpiReport {
  ratios: KeyRatios;
  previousRatios: KeyRatios;
  dashboardSavingsRatePercent: number;
  previousDashboardSavingsRatePercent: number;
  dashboardFixedCostRatioPercent: number;
  previousDashboardFixedCostRatioPercent: number;
  topExpenses: CategoryAggregate[];
  topIncomes: CategoryAggregate[];
}

function computeKeyRatios(
  transactions: ApiTransaction[],
  range: PeriodRange,
  balance: BalanceSheet,
  fixedCostCategories: string[],
): KeyRatios {
  const income = sumIncomeInRange(transactions, range);
  const expenses = sumExpensesInRange(transactions, range);
  const net = income - expenses;

  const fixedSet = new Set(fixedCostCategories.map(cleanCategory));
  let fixedTotal = 0;
  for (const transaction of transactions) {
    if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account)) continue;
    if (transaction.amountMinor >= 0) continue;
    if (isTransfer(transaction.category)) continue;
    if (!inRange(transaction, range)) continue;
    if (fixedSet.has(cleanCategory(transaction.category))) {
      fixedTotal += Math.abs(transaction.amountMinor);
    }
  }

  let interestExpenses = 0;
  for (const transaction of transactions) {
    if (!inRange(transaction, range)) continue;
    if ((transaction.comment || '').toLowerCase().includes('payback liabilitie')) {
      interestExpenses += Math.abs(transaction.amountMinor);
    }
  }

  const assetsPlusLiabilities = balance.assets.total + balance.liabilities.total;

  return {
    savingsRatePercent: income > 0 ? (net / income) * 100 : 0,
    fixedCostRatioPercent: expenses > 0 ? (fixedTotal / expenses) * 100 : 0,
    netMarginPercent: income > 0 ? (net / income) * 100 : 0,
    debtRatio: balance.assets.total > 0 ? balance.liabilities.total / balance.assets.total : 0,
    equityRatioPercent:
      assetsPlusLiabilities > 0 ? (balance.equity / assetsPlusLiabilities) * 100 : 0,
    interestCoverage: interestExpenses > 0 ? net / interestExpenses : 0,
  };
}

/** Categories the KPI dashboard's own formulas exclude — deliberately missing `Mojo`, unlike `isTransfer`. See this file's header comment. */
const DASHBOARD_EXCLUDED_CATEGORIES = new Set(['Daily', 'Splurge', 'Smile', 'Fire', 'Income']);

function isDashboardExcluded(category: string): boolean {
  return DASHBOARD_EXCLUDED_CATEGORIES.has(cleanCategory(category));
}

function computeDashboardSavingsRatePercent(
  transactions: ApiTransaction[],
  range: PeriodRange,
): number {
  let income = 0;
  let expenses = 0;
  for (const transaction of transactions) {
    if (transaction.amountMinor === 0) continue;
    if (!inRange(transaction, range)) continue;
    if ((EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account)) {
      if (isDashboardExcluded(transaction.category)) continue;
      if (transaction.amountMinor < 0) expenses += Math.abs(transaction.amountMinor);
    } else if (transaction.account === 'Income' && transaction.amountMinor > 0) {
      income += transaction.amountMinor;
    }
  }
  return income > 0 ? ((income - expenses) / income) * 100 : 0;
}

function computeDashboardFixedCostRatioPercent(
  transactions: ApiTransaction[],
  range: PeriodRange,
  fixedCostCategories: string[],
): number {
  const fixedSet = new Set(fixedCostCategories.map(cleanCategory));
  let fixedCosts = 0;
  let totalExpenses = 0;
  for (const transaction of transactions) {
    if (transaction.amountMinor === 0) continue;
    if (!inRange(transaction, range)) continue;
    if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account)) continue;
    if (isDashboardExcluded(transaction.category)) continue;
    if (transaction.amountMinor >= 0) continue;
    const amount = Math.abs(transaction.amountMinor);
    totalExpenses += amount;
    if (fixedSet.has(cleanCategory(transaction.category))) fixedCosts += amount;
  }
  return totalExpenses > 0 ? (fixedCosts / totalExpenses) * 100 : 0;
}

function computeTopCategories(
  transactions: ApiTransaction[],
  range: PeriodRange,
  side: 'expense' | 'income',
  limit = 5,
): CategoryAggregate[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (!inRange(transaction, range)) continue;
    if (isTransfer(transaction.category)) continue;
    if (transaction.amountMinor === 0) continue;
    const category = cleanCategory(transaction.category) || '—';
    if (side === 'expense') {
      if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account)) continue;
      if (transaction.amountMinor >= 0) continue;
      totals.set(category, (totals.get(category) || 0) + Math.abs(transaction.amountMinor));
    } else {
      if (transaction.account !== 'Income' || transaction.amountMinor <= 0) continue;
      totals.set(category, (totals.get(category) || 0) + transaction.amountMinor);
    }
  }
  const grandTotal = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, amountMinor]) => ({
      category,
      amountMinor,
      percent: grandTotal > 0 ? (amountMinor / grandTotal) * 100 : 0,
    }));
}

export function computeKpiReport(
  transactions: ApiTransaction[],
  currentRange: PeriodRange,
  previousRange: PeriodRange,
  balance: BalanceSheet,
  fixedCostCategories: string[] = [],
): KpiReport {
  return {
    ratios: computeKeyRatios(transactions, currentRange, balance, fixedCostCategories),
    previousRatios: computeKeyRatios(transactions, previousRange, balance, fixedCostCategories),
    dashboardSavingsRatePercent: computeDashboardSavingsRatePercent(transactions, currentRange),
    previousDashboardSavingsRatePercent: computeDashboardSavingsRatePercent(
      transactions,
      previousRange,
    ),
    dashboardFixedCostRatioPercent: computeDashboardFixedCostRatioPercent(
      transactions,
      currentRange,
      fixedCostCategories,
    ),
    previousDashboardFixedCostRatioPercent: computeDashboardFixedCostRatioPercent(
      transactions,
      previousRange,
      fixedCostCategories,
    ),
    topExpenses: computeTopCategories(transactions, currentRange, 'expense'),
    topIncomes: computeTopCategories(transactions, currentRange, 'income'),
  };
}
