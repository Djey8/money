import { CASHFLOW_GAME_SETS } from '@money/domain';
import { CashflowGameComponent } from './cashflow-game.component';
import { AppStateService } from '../../shared/services/app-state.service';
import { CashflowGameService } from '../../shared/services/cashflow-game.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

function makeComponent(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const router = { navigate: jest.fn() };
  const appData = { loadCashflowGameData: jest.fn() };
  const cashflowGameService = {
    gameSets: CASHFLOW_GAME_SETS,
    pickProfession: jest.fn(),
    payday: jest.fn(),
    undoLastAction: jest.fn(),
    canUndo: false,
    resolveBaby: jest.fn(),
    resolveCharity: jest.fn(),
    resolveDownsized: jest.fn(),
    adjustBankLoan: jest.fn(),
    clearStatus: jest.fn(),
    planDeal: jest.fn(),
    executeDeal: jest.fn(),
    findCardsInDeck: jest.fn(() => []),
    drawCard: jest.fn(),
    applyDealCard: jest.fn(),
    applyDoodadCard: jest.fn(),
    resetGame: jest.fn(),
    monthlyCashflow: 0,
    cash: 0,
    plannedDeals: [],
    ...overrides,
  };
  const toastService = { show: jest.fn() };
  const translate = { instant: (key: string) => key };

  const component = new CashflowGameComponent(
    router as any,
    appData as any,
    cashflowGameService as any,
    toastService as any,
    translate as any,
  );
  return { component, router, appData, cashflowGameService, toastService };
}

describe('CashflowGameComponent', () => {
  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    ProfileComponent.mail = '';
    CashflowGameComponent.isOpen = false;
    CashflowGameComponent.zIndex = 0;
  });

  describe('field defaults', () => {
    it('pre-selects the first playable profession at construction time, independent of auth/profile timing', () => {
      // This component is hosted eagerly at app bootstrap (like every other panel), so its
      // constructor can run before login/profile data has loaded — defaults must not depend on
      // `ProfileComponent.mail`/`isCashflowGame()` being accurate yet.
      ProfileComponent.mail = '';
      const { component } = makeComponent();

      const cashflowSet = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!;
      expect(component.selectedGameSetId).toBe(cashflowSet.id);
      expect(component.selectedProfessionId).toBe(cashflowSet.professions[0].id);
    });
  });

  describe('static open()', () => {
    it('does nothing for a non-cashflow account', () => {
      ProfileComponent.mail = 'jfk@example.com';
      const { appData } = makeComponent();

      CashflowGameComponent.open();

      expect(CashflowGameComponent.isOpen).toBe(false);
      expect(appData.loadCashflowGameData).not.toHaveBeenCalled();
    });

    it('opens the panel and loads the persisted game state for a cashflow account', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      const { appData } = makeComponent();

      CashflowGameComponent.open();

      expect(CashflowGameComponent.isOpen).toBe(true);
      expect(appData.loadCashflowGameData).toHaveBeenCalled();
    });
  });

  describe('overlay panel: highlight / closeWindow', () => {
    it('highlight bumps its own zIndex; closeWindow resets it and clears the viewed profession', () => {
      const { component } = makeComponent();
      CashflowGameComponent.zIndex = 0;
      component.viewedProfession = CASHFLOW_GAME_SETS[0].professions[0];

      component.highlight();
      expect(CashflowGameComponent.zIndex).toBe(1);

      component.closeWindow();
      expect(CashflowGameComponent.isOpen).toBe(false);
      expect(CashflowGameComponent.zIndex).toBe(0);
      expect(component.viewedProfession).toBeNull();
    });
  });

  describe('profession card: view / shuffle', () => {
    it('openProfessionCard/closeProfessionCard toggle the viewed profession', () => {
      const { component } = makeComponent();
      const profession = CASHFLOW_GAME_SETS[0].professions[0];

      component.openProfessionCard(profession);
      expect(component.viewedProfession).toBe(profession);

      component.closeProfessionCard();
      expect(component.viewedProfession).toBeNull();
    });

    it('openProfessionCard defaults to the starting scenario with no active game, live once one exists', () => {
      const { component } = makeComponent();
      const profession = CASHFLOW_GAME_SETS[0].professions[0];

      component.openProfessionCard(profession);
      expect(component.professionCardView).toBe('start');

      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'cashflow',
        professionId: profession.id,
      };
      component.openProfessionCard(profession);
      expect(component.professionCardView).toBe('live');
    });

    it('shuffleProfession also opens the card on the correct default view', () => {
      const { component } = makeComponent();
      component.selectedGameSetId = CASHFLOW_GAME_SETS[0].id;

      component.shuffleProfession();

      expect(component.viewedProfession).not.toBeNull();
      expect(component.professionCardView).toBe('start');
    });

    it('shuffleProfession picks a profession from the selected game set and opens its card', () => {
      const { component } = makeComponent();
      component.selectedGameSetId = CASHFLOW_GAME_SETS[0].id;

      component.shuffleProfession();

      const picked = CASHFLOW_GAME_SETS[0].professions.find(
        (p) => p.id === component.selectedProfessionId,
      );
      expect(picked).toBeDefined();
      expect(component.viewedProfession).toBe(picked);
    });

    it('professionStartingCash is savings plus one month of cashflow, in decimal', () => {
      const { component } = makeComponent();
      const profession = CASHFLOW_GAME_SETS.find((set) => set.id === 'placeholder')!.professions[0];

      // salary 3000 - expenses 1800 + savings 0
      expect(component.professionStartingCash(profession)).toBe(1200);
    });

    it('professionTotalExpenses sums every expense line, in decimal', () => {
      const { component } = makeComponent();
      const profession = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions[0];

      // Hausmeister/in: 300 + 200 + 0 + 100 + 100 + 300 + 0
      expect(component.professionTotalExpenses(profession)).toBe(1000);
    });

    it('professionMonthlyCashflow is salary minus total expenses, in decimal', () => {
      const { component } = makeComponent();
      const profession = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions[0];

      // salary 1600 - expenses 1000
      expect(component.professionMonthlyCashflow(profession)).toBe(600);
    });
  });

  describe('live financial statement (todo/cashflow-game.md decision 30)', () => {
    function startGame() {
      const hausmeister = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions[0];
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'cashflow',
        professionId: hausmeister.id,
        gameSubscriptionTitles: ['Hausmeister/in Salary', 'Steuern', 'Autokreditzahlung'],
      };
    }

    it('liveSalary reads the current amount of the Salary subscription, even if the player edited it', () => {
      const { component } = makeComponent();
      startGame();
      AppStateService.instance.allSubscriptions = [
        { title: 'Hausmeister/in Salary', account: 'Income', amount: 1700 } as any,
      ];

      expect(component.liveSalary).toBe(1700);
    });

    it('liveSalary is 0 when there is no active game or no matching subscription', () => {
      const { component } = makeComponent();
      expect(component.liveSalary).toBe(0);
    });

    it('livePassiveIncome sums only investment-kind (property) Grow project cashflow, not shares', () => {
      const { component } = makeComponent();
      AppStateService.instance.allGrowProjects = [
        { title: 'Villa', investment: { tag: 'Villa' }, cashflow: 600 } as any,
        { title: 'TestCo', share: { tag: 'TestCo' }, cashflow: 999 } as any, // a share, ignored
      ];

      expect(component.livePassiveIncome).toBe(600);
    });

    it('liveExpenseLines only includes negative game subscriptions, itemized with their own titles', () => {
      const { component } = makeComponent();
      startGame();
      AppStateService.instance.allSubscriptions = [
        { title: 'Hausmeister/in Salary', account: 'Income', amount: 1600 } as any,
        { title: 'Steuern', account: 'Daily', amount: -300 } as any,
        { title: 'Autokreditzahlung', account: 'Daily', amount: -100 } as any,
        { title: 'Not part of this game', account: 'Daily', amount: -50 } as any,
      ];

      expect(component.liveExpenseLines).toEqual([
        { title: 'Steuern', amount: -300 },
        { title: 'Autokreditzahlung', amount: -100 },
      ]);
      expect(component.liveTotalExpenses).toBe(400);
    });

    it('liveTotalIncome and liveCashflow combine salary, passive income, and expenses', () => {
      const { component } = makeComponent();
      startGame();
      AppStateService.instance.allSubscriptions = [
        { title: 'Hausmeister/in Salary', account: 'Income', amount: 1600 } as any,
        { title: 'Steuern', account: 'Daily', amount: -300 } as any,
      ];
      AppStateService.instance.allGrowProjects = [
        { title: 'Villa', investment: { tag: 'Villa' }, cashflow: 600 } as any,
      ];

      expect(component.liveTotalIncome).toBe(2200); // 1600 salary + 600 passive
      expect(component.liveCashflow).toBe(1900); // 2200 - 300 expenses
    });

    it('liveLiabilities reads straight from AppStateService — the whole account is the game', () => {
      const { component } = makeComponent();
      const liabilities = [{ tag: 'Bank loan', amount: 2000, investment: false, credit: 0 }];
      AppStateService.instance.liabilities = liabilities;

      expect(component.liveLiabilities).toBe(liabilities);
    });
  });

  describe('playableGameSets', () => {
    it('never offers the domain package’s "placeholder" test fixture to a player', () => {
      const { component } = makeComponent();

      expect(component.playableGameSets.some((set) => set.id === 'placeholder')).toBe(false);
      expect(component.playableGameSets.some((set) => set.id === 'cashflow')).toBe(true);
    });
  });

  describe('hasActiveGame / currentProfession', () => {
    it('is false with no game, true once a profession is picked', () => {
      const { component } = makeComponent();
      expect(component.hasActiveGame).toBe(false);
      expect(component.currentProfession).toBeUndefined();

      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'placeholder',
        professionId: 'placeholder-profession',
      };

      expect(component.hasActiveGame).toBe(true);
      expect(component.currentProfession?.id).toBe('placeholder-profession');
    });
  });

  describe('cash', () => {
    it('reads straight from the service — the single source of truth (JFK, 2026-09-26)', () => {
      const { component } = makeComponent({ cash: 950 } as any);
      expect(component.cash).toBe(950);
    });
  });

  describe('startGame / payday / undoLastAction', () => {
    it('delegates to the service, closes the panel, and navigates to Home on success', () => {
      const { component, cashflowGameService, toastService, router } = makeComponent();
      component.selectedGameSetId = 'placeholder';
      component.selectedProfessionId = 'placeholder-profession';
      CashflowGameComponent.isOpen = true;

      component.startGame();
      const startCall = cashflowGameService.pickProfession.mock.calls[0];
      expect(startCall[0]).toBe('placeholder');
      expect(startCall[1]).toBe('placeholder-profession');
      startCall[2].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.started', 'success');
      expect(CashflowGameComponent.isOpen).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/home']);

      CashflowGameComponent.isOpen = true;
      component.payday();
      cashflowGameService.payday.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.paydayDone', 'success');
      // The main Payday button never closes the panel — it stays open for running several rounds in a row.
      expect(CashflowGameComponent.isOpen).toBe(true);

      component.undoLastAction();
      cashflowGameService.undoLastAction.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.undoDone', 'update');
    });

    it('shows the error message on failure instead of throwing', () => {
      const { component, cashflowGameService, toastService } = makeComponent();
      component.selectedGameSetId = 'placeholder';
      component.selectedProfessionId = 'placeholder-profession';

      component.startGame();
      cashflowGameService.pickProfession.mock.calls[0][2].onError('Could not start the game.');
      expect(toastService.show).toHaveBeenCalledWith('Could not start the game.', 'error');
    });

    it('canUndo reads straight from the service — not tied to Payday specifically', () => {
      const { component } = makeComponent({ canUndo: true } as any);
      expect(component.canUndo).toBe(true);
    });
  });

  describe('landing on a space (companion mode)', () => {
    it('delegates baby/charity/downsized to the service and toasts on success', () => {
      const { component, cashflowGameService, toastService } = makeComponent();

      component.landOnBaby();
      cashflowGameService.resolveBaby.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.babyDone', 'success');

      component.landOnCharity();
      cashflowGameService.resolveCharity.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.charityDone', 'success');

      component.landOnDownsized();
      cashflowGameService.resolveDownsized.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.downsizedDone', 'success');
    });

    it('canLandOnBaby is false once there are already 3 children', () => {
      const { component } = makeComponent();
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        children: 3,
      };
      expect(component.canLandOnBaby).toBe(false);
    });

    it('landOnDeals opens the pile-choice sub-view, and chooseDealPile moves on to Cards, clearing any stale card', () => {
      const { component } = makeComponent();
      component.activeCard = { id: '1', title: 'Stale' } as any;
      component.cardQuery = 'stale';

      component.landOnDeals();
      expect(component.dashboardView).toBe('dealPile');

      component.chooseDealPile('dealBig');

      expect(component.dashboardView).toBe('cards');
      expect(component.activeDeckKind).toBe('dealBig');
      expect(component.activeCard).toBeNull();
      expect(component.cardQuery).toBe('');
    });

    it('landOnDoodad and landOnMarket open the Cards sub-view directly, no pile choice needed', () => {
      const { component } = makeComponent();

      component.landOnDoodad();
      expect(component.dashboardView).toBe('cards');
      expect(component.activeDeckKind).toBe('doodad');

      component.landOnMarket();
      expect(component.dashboardView).toBe('cards');
      expect(component.activeDeckKind).toBe('market');
    });

    it('baby/charity/downsized close the panel once the service confirms success', () => {
      const { component, cashflowGameService } = makeComponent();
      CashflowGameComponent.isOpen = true;

      component.landOnBaby();
      cashflowGameService.resolveBaby.mock.calls[0][0].onSuccess();
      expect(CashflowGameComponent.isOpen).toBe(false);

      CashflowGameComponent.isOpen = true;
      component.landOnCharity();
      cashflowGameService.resolveCharity.mock.calls[0][0].onSuccess();
      expect(CashflowGameComponent.isOpen).toBe(false);

      CashflowGameComponent.isOpen = true;
      component.landOnDownsized();
      cashflowGameService.resolveDownsized.mock.calls[0][0].onSuccess();
      expect(CashflowGameComponent.isOpen).toBe(false);
    });

    it('backToMain resets the dashboard view and clears transient card-selection state', () => {
      const { component } = makeComponent();
      component.dashboardView = 'cards';
      component.activeCard = { id: '1', title: 'Duplex' } as any;
      component.cardQuery = 'dup';
      component.showCardFind = true;

      component.backToMain();

      expect(component.dashboardView).toBe('main');
      expect(component.activeCard).toBeNull();
      expect(component.cardQuery).toBe('');
      expect(component.showCardFind).toBe(false);
    });

    it('activeDeckLabel translates the currently active deck', () => {
      const { component } = makeComponent();

      component.activeDeckKind = 'dealSmall';
      expect(component.activeDeckLabel).toBe('CashflowGame.deckDealSmall');

      component.activeDeckKind = 'doodad';
      expect(component.activeDeckLabel).toBe('CashflowGame.deckDoodad');
    });
  });

  describe('openMenu', () => {
    it('closes the panel and opens the app menu', () => {
      const { component } = makeComponent();
      CashflowGameComponent.isOpen = true;

      component.openMenu();

      expect(CashflowGameComponent.isOpen).toBe(false);
    });
  });

  describe('dismissing a Charity/Downsized reminder', () => {
    it('clearCharity/clearUnemployed delegate to the service and toast on success', () => {
      const { component, cashflowGameService, toastService } = makeComponent();

      component.clearCharity();
      expect(cashflowGameService.clearStatus).toHaveBeenCalledWith('charity', expect.anything());
      cashflowGameService.clearStatus.mock.calls[0][1].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.dismiss', 'update');

      component.clearUnemployed();
      expect(cashflowGameService.clearStatus).toHaveBeenCalledWith('unemployed', expect.anything());
    });
  });

  describe('monthlyCashflow', () => {
    it('reads straight from the service', () => {
      const { component } = makeComponent({ monthlyCashflow: -50 } as any);
      expect(component.monthlyCashflow).toBe(-50);
    });
  });

  describe('bank loan', () => {
    it('borrowLoan multiplies the increments by the game set’s increment amount', () => {
      const { component, cashflowGameService } = makeComponent();
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'placeholder',
      };
      component.loanIncrements = 2;

      component.borrowLoan();

      expect(cashflowGameService.adjustBankLoan).toHaveBeenCalledWith(
        2 * component.loanIncrementAmount,
        expect.anything(),
      );
    });

    it('repayLoan never offers to repay more than what is outstanding', () => {
      const { component, cashflowGameService } = makeComponent();
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'placeholder',
      };
      AppStateService.instance.liabilities = [
        { tag: 'Bank loan', amount: 500, investment: false, credit: 0 },
      ];
      component.loanIncrements = 5; // 5 * 1000 = 5000, far more than the 500 owed

      component.repayLoan();

      expect(cashflowGameService.adjustBankLoan).toHaveBeenCalledWith(-500, expect.anything());
    });

    it('does nothing when there is no loan to repay', () => {
      const { component, cashflowGameService } = makeComponent();
      component.loanIncrements = 1;

      component.repayLoan();

      expect(cashflowGameService.adjustBankLoan).not.toHaveBeenCalled();
    });

    it('openBankLoan/openPayLoan switch to their own focused sub-view, hidden behind their trigger buttons', () => {
      const { component } = makeComponent();

      component.openBankLoan();
      expect(component.dashboardView).toBe('bankLoan');

      component.openPayLoan();
      expect(component.dashboardView).toBe('payLoan');
    });

    it('openHistory switches to the history sub-view, same pattern', () => {
      const { component } = makeComponent();

      component.openHistory();

      expect(component.dashboardView).toBe('history');
    });

    it('borrowLoan/repayLoan return to the main dashboard once the service confirms success', () => {
      const { component, cashflowGameService } = makeComponent();
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'placeholder',
      };
      component.loanIncrements = 2;
      component.openBankLoan();

      component.borrowLoan();
      cashflowGameService.adjustBankLoan.mock.calls[0][1].onSuccess();

      expect(component.dashboardView).toBe('main');
    });
  });

  describe('Deal card: execute a planned deal', () => {
    it('executeDeal delegates to the service and toasts on success', () => {
      const { component, cashflowGameService, toastService } = makeComponent();

      component.executeDeal('TestCo');

      expect(cashflowGameService.executeDeal).toHaveBeenCalledWith('TestCo', expect.anything());
      cashflowGameService.executeDeal.mock.calls[0][1].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.dealDone', 'success');
    });

    it('plannedDeals reads straight from the service', () => {
      const projects = [{ title: 'TestCo' }];
      const { component } = makeComponent({ plannedDeals: projects } as any);
      expect(component.plannedDeals).toBe(projects);
    });
  });

  describe('cards: find, draw, apply', () => {
    it('cardSearchResults is empty until a query is typed, then delegates to the service', () => {
      const results = [{ id: '1', title: 'Duplex' }];
      const { component, cashflowGameService } = makeComponent({
        findCardsInDeck: jest.fn(() => results),
      } as any);
      component.activeDeckKind = 'dealSmall';

      expect(component.cardSearchResults).toEqual([]);
      component.cardQuery = 'dup';
      expect(component.cardSearchResults).toBe(results);
      expect(cashflowGameService.findCardsInDeck).toHaveBeenCalledWith('dealSmall', 'dup');
    });

    it('selectCard sets the active card and clears the search', () => {
      const { component } = makeComponent();
      component.cardQuery = 'dup';
      const card = { id: '1', title: 'Duplex' };

      component.selectCard(card as any);

      expect(component.activeCard).toBe(card);
      expect(component.cardQuery).toBe('');
    });

    it('changeDeck clears whatever was found/active for the previous deck', () => {
      const { component } = makeComponent();
      component.activeCard = { id: '1', title: 'Duplex' } as any;
      component.cardQuery = 'dup';

      component.changeDeck();

      expect(component.activeCard).toBeNull();
      expect(component.cardQuery).toBe('');
    });

    it('drawActiveCard sets the drawn card as active on success', () => {
      const card = { id: '1', title: 'Duplex' };
      const { component, cashflowGameService } = makeComponent();
      cashflowGameService.drawCard.mockImplementation((_kind: string, callbacks: any) =>
        callbacks.onSuccess(card),
      );

      component.drawActiveCard();

      expect(component.activeCard).toBe(card);
    });

    it('applyActiveCard plans a Deal-deck card', () => {
      const { component, cashflowGameService } = makeComponent();
      component.activeDeckKind = 'dealSmall';
      const card = { id: '1', title: 'Duplex', assetKind: 'investment' };
      component.activeCard = card as any;

      component.applyActiveCard();

      expect(cashflowGameService.applyDealCard).toHaveBeenCalledWith(card, expect.anything());
    });

    it('applyActiveCard pays a Doodad-deck card', () => {
      const { component, cashflowGameService } = makeComponent();
      component.activeDeckKind = 'doodad';
      const card = { id: '1', title: 'Gadget', costMinor: 1000 };
      component.activeCard = card as any;

      component.applyActiveCard();

      expect(cashflowGameService.applyDoodadCard).toHaveBeenCalledWith(card, expect.anything());
    });

    it('applyActiveCard clears the active card, toasts, and returns to the main dashboard view', () => {
      const { component, cashflowGameService, toastService } = makeComponent();
      component.activeDeckKind = 'doodad';
      component.activeCard = { id: '1', title: 'Gadget', costMinor: 1000 } as any;
      component.dashboardView = 'cards';

      component.applyActiveCard();
      cashflowGameService.applyDoodadCard.mock.calls[0][1].onSuccess();

      expect(component.activeCard).toBeNull();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.cardApplied', 'success');
      expect(component.dashboardView).toBe('main');
    });
  });
});
