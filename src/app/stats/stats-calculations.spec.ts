/**
 * Unit tests for stats-calculations.ts
 *
 * The stats-calculations module imports StatsComponent for static flags.
 * We mock the StatsComponent module to control those statics without
 * pulling in the full Angular component (which uses deferred imports).
 */
import { AppStateService } from '../shared/services/app-state.service';
import { Transaction } from '../interfaces/transaction';

// Mock StatsComponent statics used by the calculations
jest.mock('./stats.component', () => ({
  StatsComponent: {
    showAverageView: false,
    selectedMonth: 'all',
    filterType: 'all',
  }
}));

// Mock ChartFilterService (imported but not directly used in the functions we test)
jest.mock('../shared/services/chart-filter.service', () => ({
  ChartFilterService: {}
}));

import {
  addMonths,
  calculateSavingsRate,
  calculateBudgetCompliance,
  calculateFixedCostsRatio,
  getMonthlyData,
} from './stats-calculations';
import { StatsComponent } from './stats.component';

function tx(account: string, amount: number, date: string, category: string = 'Misc'): Transaction {
  return { account, amount, date, time: '', category, comment: '' };
}

describe('stats-calculations', () => {
  beforeEach(() => {
    // Fresh AppStateService for every test
    (AppStateService as any)._instance = undefined;
    AppStateService.instance.allTransactions = [];
    AppStateService.instance.allSubscriptions = [];
    (StatsComponent as any).showAverageView = false;
    (StatsComponent as any).selectedMonth = 'all';
    (StatsComponent as any).filterType = 'all';
  });

  // --- addMonths -----------------------------------------------------------

  describe('addMonths()', () => {
    it('adds months within the same year', () => {
      expect(addMonths('2026-01', 3)).toBe('2026-04');
    });

    it('crosses a year boundary forward', () => {
      expect(addMonths('2026-11', 3)).toBe('2027-02');
    });

    it('subtracts months (negative)', () => {
      expect(addMonths('2026-03', -2)).toBe('2026-01');
    });

    it('crosses a year boundary backward', () => {
      expect(addMonths('2026-01', -1)).toBe('2025-12');
    });

    it('adds 0 months → same month', () => {
      expect(addMonths('2026-06', 0)).toBe('2026-06');
    });

    it('pads single-digit months', () => {
      expect(addMonths('2026-08', 1)).toBe('2026-09');
    });

    it('December + 1 → January next year', () => {
      expect(addMonths('2025-12', 1)).toBe('2026-01');
    });
  });

  // --- calculateSavingsRate ------------------------------------------------

  describe('calculateSavingsRate()', () => {
    it('returns 0 when there are no transactions', () => {
      expect(calculateSavingsRate()).toBe(0);
    });

    it('returns 0 when income is 0', () => {
      AppStateService.instance.allTransactions = [
        tx('Daily', -100, '2026-01-15', 'Food'),
      ];
      expect(calculateSavingsRate()).toBe(0);
    });

    it('calculates 100% when no expenses', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2026-01-01', '@Salary'),
      ];
      expect(calculateSavingsRate()).toBe(100);
    });

    it('calculates correct rate with expenses', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2026-01-01', '@Salary'),
        tx('Daily', -200, '2026-01-10', 'Food'),
        tx('Splurge', -100, '2026-01-15', 'Fun'),
      ];
      // (1000 - 300) / 1000 * 100 = 70
      expect(calculateSavingsRate()).toBe(70);
    });

    it('excludes inter-account transfers (@ categories)', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2026-01-01', '@Salary'),
        tx('Daily', -200, '2026-01-10', '@Splurge'),     // transfer → excluded
        tx('Daily', -100, '2026-01-15', 'Groceries'),    // real expense
      ];
      // Only -100 counts. (1000 - 100) / 1000 * 100 = 90
      expect(calculateSavingsRate()).toBe(90);
    });

    it('excludes zero-amount transactions', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2026-01-01', '@Salary'),
        tx('Daily', 0, '2026-01-05', 'Empty'),
        tx('Daily', -300, '2026-01-10', 'Rent'),
      ];
      expect(calculateSavingsRate()).toBe(70);
    });

    it('filters by month (YYYY-MM)', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2026-01-01', '@Salary'),
        tx('Daily', -400, '2026-01-15', 'Rent'),
        tx('Income', 2000, '2026-02-01', '@Salary'),    // different month
        tx('Daily', -100, '2026-02-15', 'Food'),        // different month
      ];
      // January only: (1000 - 400) / 1000 * 100 = 60
      expect(calculateSavingsRate('2026-01')).toBe(60);
    });

    it('filters by year (YYYY)', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 500, '2025-06-01', '@Salary'),
        tx('Daily', -100, '2025-06-15', 'Food'),
        tx('Income', 1000, '2026-03-01', '@Salary'),
      ];
      // 2025 only: (500 - 100) / 500 * 100 = 80
      expect(calculateSavingsRate('2025')).toBe(80);
    });

    it('filters by quarter (YYYY-Qn)', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 3000, '2026-01-15', '@Salary'),   // Q1
        tx('Daily', -300, '2026-02-01', 'Food'),        // Q1
        tx('Income', 5000, '2026-04-01', '@Salary'),    // Q2 - excluded
      ];
      // Q1: (3000 - 300) / 3000 * 100 = 90
      expect(calculateSavingsRate('2026-Q1')).toBe(90);
    });

    it('filters by half-year (YYYY-Hn)', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 2000, '2026-01-01', '@Salary'),   // H1
        tx('Daily', -500, '2026-03-15', 'Bills'),       // H1
        tx('Income', 4000, '2026-07-01', '@Salary'),    // H2 - excluded
      ];
      // H1: (2000 - 500) / 2000 * 100 = 75
      expect(calculateSavingsRate('2026-H1')).toBe(75);
    });

    it('filters by custom range', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1500, '2026-01-15', '@Salary'),
        tx('Daily', -500, '2026-01-20', 'Rent'),
        tx('Income', 2000, '2026-02-15', '@Salary'),    // out of range
      ];
      expect(calculateSavingsRate('custom:2026-01-01:2026-01-31')).toBe(
        ((1500 - 500) / 1500) * 100
      );
    });
  });

  // --- calculateBudgetCompliance -------------------------------------------

  describe('calculateBudgetCompliance()', () => {
    it('returns 0 when no expenses', () => {
      expect(calculateBudgetCompliance('Daily', 60)).toBe(0);
    });

    it('returns 100 when actual % matches target %', () => {
      AppStateService.instance.allTransactions = [
        tx('Daily', -60, '2026-01-10', 'Food'),
        tx('Splurge', -40, '2026-01-10', 'Fun'),
      ];
      // Daily = 60/100 = 60%, target = 60%. Deviation = 0 → 100
      expect(calculateBudgetCompliance('Daily', 60)).toBe(100);
    });

    it('returns 0 when deviation exceeds 20 percentage points', () => {
      AppStateService.instance.allTransactions = [
        tx('Daily', -100, '2026-01-10', 'Food'),
        tx('Splurge', -100, '2026-01-10', 'Fun'),
      ];
      // Daily = 50%, target = 10%. Deviation = 40 > 20 → max(0, 100 - 200) = 0
      expect(calculateBudgetCompliance('Daily', 10)).toBe(0);
    });

    it('returns partial compliance for moderate deviation', () => {
      AppStateService.instance.allTransactions = [
        tx('Daily', -70, '2026-01-10', 'Food'),
        tx('Splurge', -30, '2026-01-10', 'Fun'),
      ];
      // Daily = 70%, target = 60%. Deviation = 10 / 20 * 100 = 50 → 100 - 50 = 50
      expect(calculateBudgetCompliance('Daily', 60)).toBe(50);
    });
  });

  // --- calculateFixedCostsRatio --------------------------------------------

  describe('calculateFixedCostsRatio()', () => {
    it('returns 0 when no transactions', () => {
      expect(calculateFixedCostsRatio()).toBe(0);
    });

    it('returns 0 when no subscriptions (nothing is fixed)', () => {
      AppStateService.instance.allTransactions = [
        tx('Daily', -100, '2026-01-10', 'Food'),
      ];
      expect(calculateFixedCostsRatio()).toBe(0);
    });

    it('identifies subscription categories as fixed costs', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Netflix', account: 'Splurge', amount: -15, startDate: '2026-01-01', endDate: '', category: 'Streaming', comment: '', frequency: 'monthly' },
      ];
      AppStateService.instance.allTransactions = [
        tx('Daily', -100, '2026-01-10', 'Food'),
        tx('Splurge', -15, '2026-01-10', 'Streaming'),
      ];
      // Fixed = 15, Total = 115. Ratio = 15/115 * 100 ≈ 13.04
      const ratio = calculateFixedCostsRatio();
      expect(ratio).toBeCloseTo(13.04, 1);
    });

    it('filters by month', () => {
      AppStateService.instance.allSubscriptions = [
        { title: 'Gym', account: 'Daily', amount: -40, startDate: '2026-01-01', endDate: '', category: 'Health', comment: '', frequency: 'monthly' },
      ];
      AppStateService.instance.allTransactions = [
        tx('Daily', -40, '2026-01-05', 'Health'),
        tx('Daily', -60, '2026-01-15', 'Food'),
        tx('Daily', -200, '2026-02-01', 'Food'),     // excluded
      ];
      // Fixed = 40, Total = 100. 40%
      expect(calculateFixedCostsRatio('2026-01')).toBe(40);
    });
  });

  // --- getMonthlyData ------------------------------------------------------

  describe('getMonthlyData()', () => {
    it('returns empty array when no transactions', () => {
      expect(getMonthlyData()).toEqual([]);
    });

    it('aggregates income and expenses per month', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 3000, '2025-01-01', '@Salary'),
        tx('Daily', -500, '2025-01-10', 'Rent'),
        tx('Splurge', -200, '2025-01-15', 'Fun'),
        tx('Income', 3500, '2025-02-01', '@Salary'),
        tx('Fire', -100, '2025-02-10', 'Insurance'),
      ];

      const data = getMonthlyData();
      expect(data).toHaveLength(2);
      expect(data[0].month).toBe('2025-01');
      expect(data[0].income).toBe(3000);
      expect(data[0].expenses).toBe(700);
      expect(data[0].savings).toBe(2300);
      expect(data[1].month).toBe('2025-02');
    });

    it('sorts by date ascending', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2025-03-01', '@Pay'),
        tx('Income', 2000, '2025-01-01', '@Pay'),
      ];

      const data = getMonthlyData();
      expect(data[0].month).toBe('2025-01');
      expect(data[1].month).toBe('2025-03');
    });

    it('excludes inter-account transfers', () => {
      AppStateService.instance.allTransactions = [
        tx('Income', 1000, '2025-01-01', '@Salary'),
        tx('Daily', -200, '2025-01-10', '@Splurge'),  // transfer → excluded
        tx('Daily', -300, '2025-01-15', 'Food'),       // real expense
      ];

      const data = getMonthlyData();
      expect(data[0].expenses).toBe(300);  // only real expense
    });
  });
});
