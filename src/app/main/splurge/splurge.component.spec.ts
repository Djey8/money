import { SplurgeComponent } from './splurge.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('SplurgeComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  describe('static properties', () => {
    it('should have allowedAccounts of Splurge and Income', () => {
      expect(SplurgeComponent.allowedAccounts).toEqual(['Splurge', 'Income']);
    });
  });

  describe('splurgeAmount calculation', () => {
    it('should compute splurgeAmount from AppStateService', () => {
      AppStateService.instance.splurge = 10;
      AppStateService.instance.allTransactions = [
        { account: 'Income', amount: 1000, category: 'Salary', date: '2024-01-01', comment: '' },
        { account: 'Splurge', amount: -30, category: '@Fun', date: '2024-01-15', comment: '' },
      ] as any;

      // Manually recalculate since static initializer already ran
      const result = AppStateService.instance.getAmount('Splurge', AppStateService.instance.splurge / 100);
      // Income: round((1000 * 0.1 + eps) * 100) / 100 = 100, Splurge: -30, total = 70
      expect(result).toBe(70);
    });
  });
});
