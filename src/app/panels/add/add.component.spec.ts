import { AddComponent } from './add.component';
import { AppStateService } from '../../shared/services/app-state.service';

describe('AddComponent', () => {

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    AddComponent.selectedOption = 'Daily';
    AddComponent.amountTextField = '';
    AddComponent.categoryTextField = '@';
    AddComponent.commentTextField = '';
    AddComponent.isLiabilitie = false;
    AddComponent.loanTextField = '';
    AddComponent.creditTextField = '';
    AddComponent.isShare = false;
    AddComponent.shareTextField = '50';
    AddComponent.isTaxExpense = false;
    AddComponent.url = '/transactions';
    AddComponent.zIndex = 0;
    AddComponent.isAdd = false;
    AddComponent.isError = false;
    AddComponent.categoryOptions = [];
  });

  it('populateCategoryOptions should build categories from allTransactions', () => {
    AppStateService.instance.allTransactions = [
      { account: 'Daily', amount: -10, category: '@food', date: '2025-01-01' },
      { account: 'Splurge', amount: -20, category: '@entertainment', date: '2025-01-02' },
      { account: 'Daily', amount: -5, category: '@food', date: '2025-01-03' },
    ] as any;

    AddComponent.populateCategoryOptions();

    expect(AddComponent.categoryOptions).toHaveLength(2);
    const values = AddComponent.categoryOptions.map((o: any) => o.value);
    expect(values).toContain('@food');
    expect(values).toContain('@entertainment');
  });

  it('populateCategoryOptions should handle empty transactions', () => {
    AppStateService.instance.allTransactions = [];
    AddComponent.populateCategoryOptions();
    expect(AddComponent.categoryOptions).toHaveLength(0);
  });

  it('populateCategoryOptions should handle undefined allTransactions', () => {
    AppStateService.instance.allTransactions = undefined as any;
    AddComponent.populateCategoryOptions();
    expect(AddComponent.categoryOptions).toHaveLength(0);
  });

  it('populateCategoryOptions should strip @ from label', () => {
    AppStateService.instance.allTransactions = [
      { account: 'Daily', amount: -10, category: '@groceries', date: '2025-01-01' },
    ] as any;

    AddComponent.populateCategoryOptions();

    expect(AddComponent.categoryOptions[0].value).toBe('@groceries');
    expect(AddComponent.categoryOptions[0].label).toBe('groceries');
  });

  it('should have correct initial static defaults', () => {
    expect(AddComponent.selectedOption).toBe('Daily');
    expect(AddComponent.categoryTextField).toBe('@');
    expect(AddComponent.isLiabilitie).toBe(false);
    expect(AddComponent.isShare).toBe(false);
    expect(AddComponent.isTaxExpense).toBe(false);
    expect(AddComponent.url).toBe('/transactions');
  });
});
