import { DailyComponent } from './daily.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('DailyComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  describe('static properties', () => {
    it('should have allowedAccounts of Daily and Income', () => {
      expect(DailyComponent.allowedAccounts).toEqual(['Daily', 'Income']);
    });
  });

  describe('updateDailyAmount()', () => {
    it('should recalculate dailyAmount from AppStateService', () => {
      AppStateService.instance.daily = 60;
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 1000, category: 'Salary', date: '2024-01-01', comment: '' },
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-01-15', comment: '' },
      ] as any;

      DailyComponent.updateDailyAmount();

      // Income: round((1000 * 0.6 + eps) * 100) / 100 = 600, Daily: -50, total = 550
      expect(DailyComponent.dailyAmount).toBe(550);
    });

    it('should return 0 with no transactions', () => {
      AppStateService.instance.daily = 60;
      AppStateService.instance.allTransactions = [];

      DailyComponent.updateDailyAmount();

      expect(DailyComponent.dailyAmount).toBe(0);
    });
  });
});
