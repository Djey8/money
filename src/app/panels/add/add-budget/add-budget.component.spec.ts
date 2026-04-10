import { AddBudgetComponent } from './add-budget.component';
import { AppStateService } from '../../../shared/services/app-state.service';
import { PlanComponent } from '../../../main/budget/plan/plan.component';

describe('AddBudgetComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
  });

  describe('populateCategoryOptions()', () => {
    it('should extract unique non-Income categories from transactions', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-01-01', comment: '' },
        { account: 'Daily', amount: -20, category: '@Transport', date: '2024-01-02', comment: '' },
        { account: 'Income', amount: 1000, category: 'Salary', date: '2024-01-01', comment: '' },
        { account: 'Daily', amount: -30, category: '@Food', date: '2024-01-03', comment: '' },
      ] as any;
      AppStateService.instance.allBudgets = [];
      PlanComponent.selectedMonthYear = '2024-01';

      AddBudgetComponent.populateCategoryOptions();

      const labels = AddBudgetComponent.categoryOptions.map(o => o.label);
      expect(labels).toContain('Food');
      expect(labels).toContain('Transport');
      expect(labels).not.toContain('Salary');
    });

    it('should exclude categories already budgeted for the selected month', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -50, category: '@Food', date: '2024-02-01', comment: '' },
        { account: 'Daily', amount: -20, category: '@Transport', date: '2024-02-02', comment: '' },
      ] as any;
      AppStateService.instance.allBudgets = [
        { date: '2024-02', tag: '@Food', amount: 100 }
      ] as any;
      PlanComponent.selectedMonthYear = 'February 2024';

      AddBudgetComponent.populateCategoryOptions();

      const labels = AddBudgetComponent.categoryOptions.map(o => o.label);
      expect(labels).not.toContain('Food');
      expect(labels).toContain('Transport');
    });

    it('should handle empty transactions array', () => {
      AppStateService.instance.allTransactions = [];
      AppStateService.instance.allBudgets = [];
      PlanComponent.selectedMonthYear = 'January 2024';

      AddBudgetComponent.populateCategoryOptions();

      expect(AddBudgetComponent.categoryOptions).toEqual([]);
    });
  });
});
