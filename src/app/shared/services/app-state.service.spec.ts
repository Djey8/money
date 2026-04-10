import { AppStateService } from './app-state.service';

describe('AppStateService', () => {
  let service: AppStateService;

  beforeEach(() => {
    // Reset the static instance so each test starts fresh
    (AppStateService as any)._instance = undefined;
    service = AppStateService.instance;
  });

  describe('getAmount()', () => {
    it('returns 0 when allTransactions is empty', () => {
      service.allTransactions = [];
      expect(service.getAmount('Daily', 0.6)).toBe(0);
    });

    it('returns 0 when allTransactions is null/undefined', () => {
      service.allTransactions = null as any;
      expect(service.getAmount('Daily', 0.6)).toBe(0);
    });

    it('sums amounts for matching account', () => {
      service.allTransactions = [
        { account: 'Daily', amount: -50, date: '2026-01-01', time: '', category: 'Food', comment: '' },
        { account: 'Daily', amount: -30, date: '2026-01-02', time: '', category: 'Transport', comment: '' },
        { account: 'Splurge', amount: -20, date: '2026-01-01', time: '', category: 'Misc', comment: '' },
      ];
      expect(service.getAmount('Daily', 0.6)).toBe(-80);
    });

    it('distributes Income transactions by percentage', () => {
      service.allTransactions = [
        { account: 'Income', amount: 1000, date: '2026-01-01', time: '', category: '@Salary', comment: '' },
      ];
      // 60% of 1000 = 600
      expect(service.getAmount('Daily', 0.6)).toBe(600);
    });

    it('combines direct account transactions with Income distribution', () => {
      service.allTransactions = [
        { account: 'Daily', amount: -100, date: '2026-01-01', time: '', category: 'Food', comment: '' },
        { account: 'Income', amount: 1000, date: '2026-01-01', time: '', category: '@Work', comment: '' },
      ];
      // -100 + (1000 * 0.6) = -100 + 600 = 500
      expect(service.getAmount('Daily', 0.6)).toBe(500);
    });

    it('rounds Income distribution to 2 decimal places', () => {
      service.allTransactions = [
        { account: 'Income', amount: 333.33, date: '2026-01-01', time: '', category: '@Salary', comment: '' },
      ];
      // 333.33 * 0.6 = 199.998 → rounded to 200.00
      const result = service.getAmount('Daily', 0.6);
      // Verify precision to 2 decimal places
      expect(Math.abs(result - 200.0)).toBeLessThan(0.01);
    });

    it('ignores transactions from other accounts', () => {
      service.allTransactions = [
        { account: 'Splurge', amount: -50, date: '2026-01-01', time: '', category: 'Fun', comment: '' },
        { account: 'Fire', amount: -200, date: '2026-01-02', time: '', category: 'Emergency', comment: '' },
      ];
      expect(service.getAmount('Daily', 0.6)).toBe(0);
    });

    it('handles percentage = 0 (no income allocation)', () => {
      service.allTransactions = [
        { account: 'Income', amount: 1000, date: '2026-01-01', time: '', category: '@Salary', comment: '' },
        { account: 'Daily', amount: -50, date: '2026-01-02', time: '', category: 'Food', comment: '' },
      ];
      expect(service.getAmount('Daily', 0)).toBe(-50);
    });

    it('handles zero amount transactions', () => {
      service.allTransactions = [
        { account: 'Daily', amount: 0, date: '2026-01-01', time: '', category: 'Transfer', comment: '' },
        { account: 'Daily', amount: -20, date: '2026-01-02', time: '', category: 'Food', comment: '' },
      ];
      expect(service.getAmount('Daily', 0.6)).toBe(-20);
    });
  });

  describe('static instance pattern', () => {
    it('returns the same instance on repeated access', () => {
      const a = AppStateService.instance;
      const b = AppStateService.instance;
      expect(a).toBe(b);
    });

    it('has correct default values', () => {
      expect(service.currency).toBe('€');
      expect(service.daily).toBe(60.0);
      expect(service.allTransactions).toEqual([]);
      expect(service.mojo).toEqual({ amount: 0, target: 0 });
    });
  });
});
