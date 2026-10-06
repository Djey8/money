import { AddComponent } from './add.component';
import { AppStateService } from '../../shared/services/app-state.service';
import { AppComponent } from '../../app.component';

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

  describe('after a transaction is saved (JFK, 2026-10-06)', () => {
    // A page showing underneath - the Stats charts, Home, an account list - draws from the data it had; navigating to
    // the page that is already open does nothing, so the dialog has to say that the transactions changed.
    const closing = () => {
      const component: any = Object.create(AddComponent.prototype);
      component.router = { navigate: jest.fn() };
      component.closeWindow = jest.fn();
      jest.spyOn(AppComponent, 'gotoTop').mockImplementation(() => undefined);
      return component;
    };

    afterEach(() => jest.restoreAllMocks());

    it('tells the pages underneath that transactions and subscriptions changed, then goes back to the page', async () => {
      // the dialog binds AppComponent lazily (to avoid a circular import): wait for that
      await new Promise((resolve) => setTimeout(resolve, 200));
      const component = closing();
      const state = AppStateService.instance;
      const transactions = jest.fn();
      const subscriptions = jest.fn();
      state.transactionsUpdated$.subscribe(transactions);
      state.subscriptionsUpdated$.subscribe(subscriptions);
      AddComponent.url = '/stats';

      component.closeWindowAndNavigate();

      expect(transactions).toHaveBeenCalledTimes(1);
      expect(subscriptions).toHaveBeenCalledTimes(1);
      expect(component.closeWindow).toHaveBeenCalled();
      expect(component.router.navigate).toHaveBeenCalledWith(['/stats']);
    });
  });
});
