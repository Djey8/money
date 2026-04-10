import { AccountingComponent } from './accounting.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('AccountingComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    AccountingComponent.roundCount = 0;
  });

  describe('calculateroundCount()', () => {
    it('should return 0 when allTransactions is empty', () => {
      AppStateService.instance.allTransactions = [];
      AccountingComponent.calculateroundCount();
      expect(AccountingComponent.roundCount).toBe(0);
    });

    it('should return 0 when allTransactions is undefined', () => {
      AppStateService.instance.allTransactions = undefined as any;
      AccountingComponent.calculateroundCount();
      expect(AccountingComponent.roundCount).toBe(0);
    });

    it('should calculate months between first and last transaction', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-01-15', comment: '' },
        { account: 'Daily', amount: -30, category: '@Food', date: '2024-04-15', comment: '' },
        { account: 'Income', amount: 1000, category: 'Salary', date: '2024-02-01', comment: '' },
      ] as any;
      AccountingComponent.calculateroundCount();
      // Jan to Apr = 3 months
      expect(AccountingComponent.roundCount).toBe(3);
    });

    it('should return 0 for single transaction', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-01-15', comment: '' },
      ] as any;
      AccountingComponent.calculateroundCount();
      expect(AccountingComponent.roundCount).toBe(0);
    });

    it('should return 0 when all transactions are in same month', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-03-01', comment: '' },
        { account: 'Daily', amount: -30, category: '@Food', date: '2024-03-15', comment: '' },
      ] as any;
      AccountingComponent.calculateroundCount();
      expect(AccountingComponent.roundCount).toBe(0);
    });
  });

  it('should have expected available accounts', () => {
    expect(AccountingComponent.availableAccounts).toEqual(['Income', 'Daily', 'Splurge', 'Smile', 'Fire', 'Mojo']);
  });
});
