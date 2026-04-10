import { HomeComponent } from './home.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('HomeComponent', () => {
  beforeEach(() => {
    // Reset AppStateService singleton before each test
    (AppStateService as any)._instance = undefined;
  });

  describe('getAmount()', () => {
    it('should return 0 when allTransactions is null/undefined', () => {
      AppStateService.instance.allTransactions = undefined as any;
      expect(HomeComponent.getAmount('Daily', 0.6)).toBe(0.0);
    });

    it('should sum amounts for matching account', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-01-01', comment: '' },
        { account: 'Daily', amount: -30, category: '@Transport', date: '2024-01-02', comment: '' },
        { account: 'Splurge', amount: -20, category: '@Fun', date: '2024-01-02', comment: '' },
      ] as any;
      expect(HomeComponent.getAmount('Daily', 0.6)).toBe(-80);
    });

    it('should add Income × percentage for Income transactions', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 1000, category: 'Salary', date: '2024-01-01', comment: '' },
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-01-01', comment: '' },
      ] as any;
      // Income: round((1000 * 0.6 + EPSILON) * 100) / 100 = 600
      // Daily: -50
      // Total: 550
      expect(HomeComponent.getAmount('Daily', 0.6)).toBe(550);
    });

    it('should correctly handle multiple Income transactions with rounding', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 333, category: 'Salary', date: '2024-01-01', comment: '' },
        { account: 'Income', amount: 333, category: 'Bonus', date: '2024-01-02', comment: '' },
      ] as any;
      // Each: round((333 * 0.33 + EPSILON) * 100) / 100 = round(109.89 + eps) = 109.89
      const result = HomeComponent.getAmount('Daily', 0.33);
      expect(result).toBeCloseTo(219.78);
    });

    it('should return 0 when there are no transactions', () => {
      AppStateService.instance.allTransactions = [];
      expect(HomeComponent.getAmount('Daily', 0.6)).toBe(0);
    });
  });

  describe('getAmounts()', () => {
    it('should calculate all four amounts and total', () => {
      AppStateService.instance.daily = 60;
      AppStateService.instance.splurge = 10;
      AppStateService.instance.smile = 10;
      AppStateService.instance.fire = 20;
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 1000, category: 'Salary', date: '2024-01-01', comment: '' },
      ] as any;

      HomeComponent.getAmounts();

      expect(HomeComponent.dailyValue).toBe(600);
      expect(HomeComponent.splurgeValue).toBe(100);
      expect(HomeComponent.smileValue).toBe(100);
      expect(HomeComponent.fireValue).toBe(200);
      expect(HomeComponent.totalAmount).toBe(1000);
    });

    it('should handle empty transactions', () => {
      AppStateService.instance.allTransactions = [];
      AppStateService.instance.daily = 60;
      AppStateService.instance.splurge = 10;
      AppStateService.instance.smile = 10;
      AppStateService.instance.fire = 20;

      HomeComponent.getAmounts();

      expect(HomeComponent.dailyValue).toBe(0);
      expect(HomeComponent.totalAmount).toBe(0);
    });
  });
});
