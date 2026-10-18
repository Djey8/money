import {
  generateBuyInvestmentComment,
  generateBuyShareComment,
  generateSellAssetComment,
  generateSellShareComment,
} from '@money/domain';
import { RemoteGameHook } from '../../shared/services/remote-game';
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

  describe('location picker default', () => {
    const descriptor = Object.getOwnPropertyDescriptor(AddComponent.prototype, 'locationId')!;
    const read = () =>
      descriptor.get!.call({ locations: AppStateService.instance.allLocations }) as string | null;

    beforeEach(() => {
      AddComponent.locationChoice = undefined;
      AppStateService.instance.allLocations = [
        { id: 'a', name: 'Bank 1', amount: 0 },
        { id: 'b', name: 'Cash', amount: 0 },
      ];
    });

    it('pre-selects the location of the last transaction that used one', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -1, category: '@x', date: '2025-01-01', locationId: 'b' },
        { account: 'Daily', amount: -1, category: '@x', date: '2025-01-02', locationId: 'a' },
        { account: 'Daily', amount: -1, category: '@x', date: '2025-01-03' },
      ] as any;
      expect(read()).toBe('a');
    });

    it('is None when no transaction ever used a location', () => {
      AppStateService.instance.allTransactions = [] as any;
      expect(read()).toBeNull();
    });

    it('an explicit None beats the last-used default', () => {
      AppStateService.instance.allTransactions = [
        { account: 'Daily', amount: -1, category: '@x', date: '2025-01-01', locationId: 'a' },
      ] as any;
      descriptor.set!.call({}, null);
      expect(read()).toBeNull();
    });
  });
});

describe('AddComponent at a table (the dialog of the solo game, the table books)', () => {
  const addAtTable = (
    comment: string,
    remote: Record<string, unknown>,
    toast = { show: jest.fn() },
  ) => {
    AddComponent.commentTextField = comment;
    return {
      toast,
      run: (AddComponent.prototype as any).addAtTable.call({ toastService: toast }, remote),
    };
  };
  const ok = async () => ({ ok: true, events: [] });
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    RemoteGameHook.reopen = jest.fn();
  });
  afterEach(() => {
    RemoteGameHook.reopen = null;
  });

  it('a Buy sends the planned project and its share count, and stays on the page it was made on', async () => {
    const buyPlanned = jest.fn(ok);
    await addAtTable(generateBuyShareComment('OK4U', 10, 3000), { buyPlanned }).run;
    expect(buyPlanned).toHaveBeenCalledWith('OK4U', 10);
    expect(RemoteGameHook.reopen).not.toHaveBeenCalled();
    const bought = jest.fn(ok);
    await addAtTable(generateBuyInvestmentComment('EFH', 500000, 4500000), { buyPlanned: bought })
      .run;
    expect(bought).toHaveBeenCalledWith('EFH');
  });

  it('a Sell sends the position to sell', async () => {
    const sellPosition = jest.fn(ok);
    await addAtTable(generateSellShareComment('OK4U', 4, 3500), { sellPosition }).run;
    expect(sellPosition).toHaveBeenCalledWith('OK4U', 4);
    const sellAsset = jest.fn(ok);
    await addAtTable(generateSellAssetComment('GOLD', 100000, { quantity: 2, priceMinor: 50000 }), {
      sellPosition: sellAsset,
    }).run;
    expect(sellAsset).toHaveBeenCalledWith('GOLD');
  });

  it('a Doodad payment pays the Doodad in hand', async () => {
    AppStateService.instance.cashflowGame = {
      ...AppStateService.instance.cashflowGame,
      turn: {
        phase: 'decide',
        count: 1,
        pending: { kind: 'doodad', offered: { deck: 'doodad', cardId: 'd-7' } },
      },
    } as any;
    const payDoodad = jest.fn(ok);
    await addAtTable('You buy a boat #doodad', { payDoodad }).run;
    expect(payDoodad).toHaveBeenCalledWith('d-7');
    // paying the card in hand goes on in the game screen
    expect(RemoteGameHook.reopen).toHaveBeenCalled();
  });

  it('the cost of a Market card is paid through the Add dialog: it pays the card in hand', async () => {
    AppStateService.instance.cashflowGame = {
      ...AppStateService.instance.cashflowGame,
      turn: {
        phase: 'decide',
        count: 1,
        pending: {
          kind: 'market',
          paymentDue: true,
          offered: { deck: 'market', cardId: 'm-3' },
        },
      },
    } as any;
    const payMarket = jest.fn(ok);
    await addAtTable('Sewer pipe broken #market', { payMarket }).run;
    expect(payMarket).toHaveBeenCalledWith('m-3');
  });

  it('shows why a refused move did not go through, and refuses what is no move of the game', async () => {
    const refused = {
      buyPlanned: async () => ({ ok: false, message: 'Not your turn.', events: [] }),
    };
    const first = addAtTable(generateBuyShareComment('X', 1, 100), refused);
    await first.run;
    expect(first.toast.show).toHaveBeenCalledWith('Not your turn.', 'error');
    const plain = addAtTable('lunch', {});
    await plain.run;
    expect(plain.toast.show).toHaveBeenCalledWith(expect.stringContaining('not a move'), 'error');
  });
});
