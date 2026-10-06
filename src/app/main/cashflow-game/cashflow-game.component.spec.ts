import { Subject } from 'rxjs';
import { CLASSIC_RAT_RACE_BOARD } from '@money/domain';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { CASHFLOW_GAME_SETS } from '../../shared/cashflow-content';
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
    undoSteps: jest.fn(),
    openDecisions: [],
    rollDie: jest.fn(() => 6),
    paydayRollCount: jest.fn(() => 1),
    spacePreview: jest.fn(() => null),
    doodadLoanNote: jest.fn(() => '🏦 note'),
    resolveGamble: jest.fn(),
    historySteps: jest.fn(() => []),
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
    resetGame: jest.fn(),
    monthlyCashflow: 0,
    cash: 0,
    plannedDeals: [],
    translateProfessionTitle: jest.fn((profession: any) => profession.title),
    translateExpenseLineTitle: jest.fn((_profession: any, line: any) => line.title),
    translateLiabilityTag: jest.fn((_profession: any, liability: any) => liability.tag),
    ...overrides,
  };
  const toastService = { show: jest.fn() };
  const savedGames = {
    games: [] as any[],
    currentGameId: undefined as string | undefined,
    tooMany: false,
    refresh: jest.fn(async () => undefined),
    saveCurrent: jest.fn(async () => null),
    startNewGame: jest.fn(async () => undefined),
    loadGame: jest.fn(async () => undefined),
    renameGame: jest.fn(async () => undefined),
    deleteGame: jest.fn(async () => undefined),
    exportGame: jest.fn(async () => ({ fileName: 'x.json', text: '{}' })),
    importGame: jest.fn(async () => ({})),
  };
  // The confirm dialog answers yes at once, so tests see what happens after "yes".
  const confirm = { confirm: jest.fn((_message: string, onConfirm: () => void) => onConfirm()) };
  const translate = { instant: (key: string) => key };

  const component = new CashflowGameComponent(
    router as any,
    appData as any,
    cashflowGameService as any,
    toastService as any,
    translate as any,
    {
      ensureLoaded: jest.fn(),
      textFor: jest.fn(() => ({})),
      sharedText: jest.fn(() => ''),
      symbolFor: jest.fn((symbol?: string) => symbol),
      familyName: jest.fn((family: string) => family),
      groupName: jest.fn((group: string) => group),
      version: 0,
    } as any,
    { current: 'en', use: jest.fn(async () => undefined) } as any,
    savedGames as any,
    confirm as any,
  );
  const language = (component as any).language;
  return {
    component,
    router,
    appData,
    cashflowGameService,
    toastService,
    language,
    savedGames,
    confirm,
  };
}

// Opening a dialog scrolls to the top once the app shell has loaded - a timing that varies with how much
// the test file imports; jsdom does not implement scrolling and reports it as an error.
window.scrollTo = jest.fn() as any;
window.scroll = jest.fn() as any;

registerLocaleData(localeDe); // the app registers it at startup (app.config.ts)

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

    it("professionTitle/expenseLineTitle/liabilityTag delegate to the service — live-translates the card's own static content (todo/cashflow-game.md decision 48)", () => {
      const { component, cashflowGameService } = makeComponent();
      const profession = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions[0];
      const line = profession.expenses[0];
      const liability = profession.starterKit.liabilities![0];

      component.professionTitle(profession);
      component.expenseLineTitle(profession, line);
      component.liabilityTag(profession, liability);

      expect(cashflowGameService.translateProfessionTitle).toHaveBeenCalledWith(profession);
      expect(cashflowGameService.translateExpenseLineTitle).toHaveBeenCalledWith(profession, line);
      expect(cashflowGameService.translateLiabilityTag).toHaveBeenCalledWith(profession, liability);
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

    it('liveSalary finds the Subscription by gameSubscriptionTitles[0], not by reconstructing "<profession.title> Salary" by hand — the reconstructed form breaks once the stored title is translated (JFK, 2026-09-30: "the Salary is not working its showing 0")', () => {
      const { component } = makeComponent();
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSetId: 'cashflow',
        professionId: 'hausmeister',
        // A German-translated title — nothing like "Hausmeister/in Salary" (decision 48's
        // salarySubscriptionTitle key is "{{profession}} Gehalt" in German, not "... Salary").
        gameSubscriptionTitles: ['Hausmeister/in Gehalt'],
      };
      AppStateService.instance.allSubscriptions = [
        { title: 'Hausmeister/in Gehalt', account: 'Income', amount: 1600 } as any,
      ];

      expect(component.liveSalary).toBe(1600);
    });

    it("livePassiveIncome sums the bought properties' Cashflow subscriptions - not planned deals, not shares", () => {
      const { component } = makeComponent();
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSubscriptionTitles: ['Villa Cashflow'],
      };
      AppStateService.instance.allSubscriptions = [
        { title: 'Villa Cashflow', account: 'Income', amount: 600 } as any,
        { title: 'Planned Cashflow', account: 'Income', amount: 999 } as any, // not a game subscription yet
      ];
      AppStateService.instance.allGrowProjects = [
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
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        gameSubscriptionTitles: [
          ...AppStateService.instance.cashflowGame.gameSubscriptionTitles,
          'Villa Cashflow',
        ],
      };
      AppStateService.instance.allSubscriptions = [
        { title: 'Hausmeister/in Salary', account: 'Income', amount: 1600 } as any,
        { title: 'Steuern', account: 'Daily', amount: -300 } as any,
        { title: 'Villa Cashflow', account: 'Income', amount: 600 } as any,
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

    it('the undo banner names what was undone, not just Payday', () => {
      const steps = [
        { id: 'c', number: 3, kind: 'diceWon', detail: 'MLM · 🎲 5', at: '', transactions: [] },
        { id: 'b', number: 2, kind: 'payday', detail: 'Round 2', at: '', transactions: [] },
        { id: 'a', number: 1, kind: 'start', detail: '', at: '', transactions: [] },
      ];
      const { component, cashflowGameService, toastService } = makeComponent({
        historySteps: jest.fn(() => steps),
      } as any);
      const translate = (component as any).translate;
      translate.instant = (key: string, params?: any) =>
        params ? `${key}:${JSON.stringify(params)}` : key;

      component.undoLastAction();
      cashflowGameService.undoLastAction.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith(
        'CashflowGame.undoneOne:{"what":"CashflowGame.step.diceWon · MLM · 🎲 5"}',
        'update',
      );

      component.undoThrough(1);
      cashflowGameService.undoSteps.mock.calls[0][1].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith(
        'CashflowGame.undoneMany:{"count":2,"what":"CashflowGame.step.diceWon · MLM · 🎲 5, CashflowGame.step.payday · Round 2"}',
        'update',
      );
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
      component.confirmSpace();
      cashflowGameService.resolveBaby.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.babyDone', 'success');

      component.landOnCharity();
      component.confirmSpace();
      cashflowGameService.resolveCharity.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.charityDone', 'success');

      component.landOnDownsized();
      component.confirmSpace();
      cashflowGameService.resolveDownsized.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.downsizedDone', 'success');
    });

    it('Baby / Charity / Downsized first ask: nothing happens until Play', () => {
      const { component, cashflowGameService } = makeComponent();

      component.landOnCharity();

      expect(component.dashboardView).toBe('confirmSpace');
      expect(component.pendingSpace).toBe('charity');
      expect(cashflowGameService.resolveCharity).not.toHaveBeenCalled();
    });

    it('Cancel goes back to the dashboard without playing anything', () => {
      const { component, cashflowGameService } = makeComponent();
      component.landOnBaby();

      component.cancelSpace();

      expect(component.dashboardView).toBe('main');
      expect(component.pendingSpace).toBeNull();
      expect(cashflowGameService.resolveBaby).not.toHaveBeenCalled();
    });

    it('shows the effect / cost as big figures, like the cards', () => {
      const { component, cashflowGameService } = makeComponent();
      (cashflowGameService as any).spacePreview = jest.fn((kind: string) =>
        kind === 'baby' ? { amountMinor: 50000, children: 2 } : { amountMinor: 120000 },
      );

      component.landOnBaby();
      expect(component.spaceFacts.map((fact) => fact.value)).toEqual(['2 / 3', '+500 €']);

      component.landOnCharity();
      expect(component.spaceFacts.map((fact) => fact.label)).toEqual([
        'CashflowGame.spaceFactPayNow',
        'CashflowGame.spaceFactDice',
      ]);

      component.landOnDownsized();
      expect(component.spaceFacts[1].value).toBe('CashflowGame.spaceValueSkip');
    });

    it('the explanation carries the numbers the service previews', () => {
      const { component, cashflowGameService } = makeComponent();
      (cashflowGameService as any).spacePreview = jest.fn(() => ({ amountMinor: 120000 }));
      component.landOnDownsized();

      expect(component.spaceExplanation).toBe('CashflowGame.space.downsized');
      expect((cashflowGameService as any).spacePreview).toHaveBeenCalledWith('downsized');
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
      component.confirmSpace();
      cashflowGameService.resolveBaby.mock.calls[0][0].onSuccess();
      expect(CashflowGameComponent.isOpen).toBe(false);

      CashflowGameComponent.isOpen = true;
      component.landOnCharity();
      component.confirmSpace();
      cashflowGameService.resolveCharity.mock.calls[0][0].onSuccess();
      expect(CashflowGameComponent.isOpen).toBe(false);

      CashflowGameComponent.isOpen = true;
      component.landOnDownsized();
      component.confirmSpace();
      cashflowGameService.resolveDownsized.mock.calls[0][0].onSuccess();
      expect(CashflowGameComponent.isOpen).toBe(false);
    });

    it('backToMain resets the dashboard view and clears transient card-selection state', () => {
      const { component } = makeComponent();
      component.dashboardView = 'cards';
      component.activeCard = { id: '1', title: 'Duplex' } as any;
      component.cardQuery = 'dup';

      component.backToMain();

      expect(component.dashboardView).toBe('main');
      expect(component.activeCard).toBeNull();
      expect(component.cardQuery).toBe('');
    });

    it('activeDeckLabel translates the currently active deck', () => {
      const { component } = makeComponent();

      component.activeDeckKind = 'dealSmall';
      expect(component.activeDeckLabel).toBe('CashflowGame.deckDealSmall');

      component.activeDeckKind = 'doodad';
      expect(component.activeDeckLabel).toBe('CashflowGame.deckDoodad');
    });
  });

  describe('the list of saved games (collapsed rows)', () => {
    const game = (id: string) => ({ id, name: id }) as any;

    it('shows every game as one line until it is tapped', () => {
      const { component } = makeComponent();
      expect(component.isGameOpen(game('a'))).toBe(false);

      component.toggleGame(game('a'));
      expect(component.isGameOpen(game('a'))).toBe(true);
    });

    it('keeps one game open at a time and closes it on a second tap', () => {
      const { component } = makeComponent();
      component.toggleGame(game('a'));
      component.toggleGame(game('b'));
      expect(component.isGameOpen(game('a'))).toBe(false);
      expect(component.isGameOpen(game('b'))).toBe(true);

      component.toggleGame(game('b'));
      expect(component.isGameOpen(game('b'))).toBe(false);
    });

    it('keeps a game open while it is being renamed', () => {
      const { component } = makeComponent();
      component.startRename(game('a'));
      expect(component.isGameOpen(game('a'))).toBe(true);
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

  describe('live scenario: where passive income and assets come from', () => {
    const subscription = (title: string, amount: number) => ({
      title,
      account: 'Income',
      amount,
      startDate: '2026-10-01',
      endDate: '',
      category: '',
      comment: '#cashflow',
      frequency: 'monthly',
    });

    it('lists each bought investment with what it pays, from its Cashflow subscription', () => {
      const { component } = makeComponent();
      component.appState.cashflowGame = {
        ...component.appState.cashflowGame,
        gameSubscriptionTitles: ['Pilot Salary', 'EFH Cashflow', 'PIZZA Cashflow'],
      };
      component.appState.allSubscriptions = [
        subscription('Pilot Salary', 9500),
        subscription('EFH Cashflow', 100),
        subscription('PIZZA Cashflow', 5000),
        subscription('EFH-II Cashflow', 100), // planned only: not a game subscription yet
      ] as any;

      expect(component.livePassiveIncomeLines).toEqual([
        { name: 'EFH', amount: 100 },
        { name: 'PIZZA', amount: 5000 },
      ]);
      expect(component.livePassiveIncome).toBe(5100);
    });

    it('totals assets (cash included) and liabilities', () => {
      const { component, cashflowGameService } = makeComponent();
      (cashflowGameService as any).cash = 1600;
      component.appState.allInvestments = [{ tag: 'EFH', deposit: 3000, amount: 47000 }];
      component.appState.allShares = [{ tag: 'OK4U', quantity: 100, price: 10 }];
      component.appState.allAssets = [];
      component.appState.liabilities = [
        { tag: 'M-EFH', amount: 47000, investment: true, credit: 0 },
        { tag: 'Bank loan', amount: 3000, investment: false, credit: 0 },
      ];

      expect(component.liveTotalAssets).toBe(1600 + 50000 + 1000);
      expect(component.liveTotalLiabilities).toBe(50000);
    });

    it('lists properties at full cost, shares at market value, and plain assets by name', () => {
      const { component } = makeComponent();
      component.appState.allInvestments = [{ tag: 'EFH', deposit: 3000, amount: 47000 }];
      component.appState.allShares = [{ tag: 'OK4U', quantity: 100, price: 10 }];
      component.appState.allAssets = [{ tag: 'Savings', amount: 600 }];

      expect(component.liveAssetLines).toEqual([
        { name: 'EFH', amount: 50000 },
        { name: 'OK4U · 100', amount: 1000 },
        { name: 'Savings', amount: 600 },
      ]);
    });
  });

  describe('profession card (Starting Scenario)', () => {
    it('totals the starting liabilities', () => {
      const { component } = makeComponent();
      const hausmeister = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions.find(
        (profession) => profession.id === 'hausmeister',
      )!;

      // Eigenheim-Hypothek 20.000 + Autokredit 4.000 + Kreditkartenschulden 3.000
      expect(component.professionTotalLiabilities(hausmeister)).toBe(27000);
    });

    it('shows only the persona while it is open: viewing hides the dashboard, Back returns', () => {
      const { component } = makeComponent();
      const hausmeister = CASHFLOW_GAME_SETS.find((set) => set.id === 'cashflow')!.professions[0];

      component.openProfessionCard(hausmeister);
      expect(component.viewedProfession).toBe(hausmeister);

      component.closeProfessionCard();
      expect(component.viewedProfession).toBeNull();
    });
  });

  describe('cardAmount', () => {
    it('prints whole amounts without ,00 or a sign, and only signs the cashflow', () => {
      const { component } = makeComponent();
      component.appState.isEuropeanFormat = true;
      component.appState.currency = '€';

      expect(component.cardAmount(5000000)).toBe('50.000 €');
      expect(component.cardAmount(10000)).toBe('100 €');
      expect(component.cardAmount(10000, true)).toBe('+100 €');
      expect(component.cardAmount(1250)).toBe('12,5 €');
    });
  });

  describe('settle all', () => {
    it('pre-fills the number of steps that clear the whole loan', () => {
      const { component } = makeComponent();
      component.appState.cashflowGame = {
        ...component.appState.cashflowGame,
        gameSetId: 'cashflow',
      };
      component.appState.liabilities = [
        { tag: 'Bank loan', amount: 4000, investment: false, credit: 0 },
      ];

      component.settleAllLoan();

      expect(component.loanIncrements).toBe(4); // 4,000 outstanding in 1,000 steps
    });

    it('rounds up when the loan is not a whole number of steps', () => {
      const { component } = makeComponent();
      component.appState.cashflowGame = {
        ...component.appState.cashflowGame,
        gameSetId: 'cashflow',
      };
      component.appState.liabilities = [
        { tag: 'Bank loan', amount: 2500, investment: false, credit: 0 },
      ];

      component.settleAllLoan();

      expect(component.loanIncrements).toBe(3);
    });
  });

  describe('History view', () => {
    const steps = [
      { id: 'a-1', kind: 'payday', detail: 'Round 1', at: '', transactions: [{ amount: 1 }] },
      { id: 'a-0', kind: 'start', detail: 'Pilot', at: '', transactions: [] },
    ];

    it('opening it loads the steps, and a step with transactions expands and collapses', () => {
      const { component } = makeComponent({ historySteps: jest.fn(() => steps) });

      component.openHistory();
      expect(component.dashboardView).toBe('history');
      expect(component.historySteps).toBe(steps as any);

      expect(component.isStepOpen('a-1')).toBe(false);
      component.toggleStep('a-1');
      expect(component.isStepOpen('a-1')).toBe(true);
      component.toggleStep('a-1');
      expect(component.isStepOpen('a-1')).toBe(false);
    });

    it('"undo back to here" undoes this step and everything newer, then refreshes the list', () => {
      const undoSteps = jest.fn((_count: number, callbacks: any) => callbacks.onSuccess());
      const historySteps = jest.fn(() => steps);
      const { component } = makeComponent({ undoSteps, historySteps });
      component.openHistory();

      component.undoThrough(1); // the second line from the top

      expect(undoSteps).toHaveBeenCalledWith(2, expect.anything());
      expect(historySteps).toHaveBeenCalledTimes(3); // opened + named for the banner + refreshed
    });
  });

  describe('saved games', () => {
    const game = (id: string, extra: object = {}) =>
      ({
        id,
        name: id,
        updatedAt: '2026-10-04T10:00:00Z',
        round: 2,
        cashMinor: 100000,
        passiveIncomeMinor: 0,
        expensesMinor: 100000,
        escapedRatRace: false,
        bankrupt: false,
        language: 'en',
        ...extra,
      }) as any;
    const playing = (made: ReturnType<typeof makeComponent>, id?: string) => {
      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        professionId: 'hausmeister',
        gameSetId: 'cashflow',
      };
      made.savedGames.currentGameId = id;
    };

    it('opens the games view and refreshes the list', () => {
      const { component, savedGames } = makeComponent();
      component.openGames();
      expect(component.dashboardView).toBe('games');
      expect(savedGames.refresh).toHaveBeenCalled();
    });

    it('Save game saves the running game and says so; a long list gets a warning', async () => {
      const made = makeComponent();
      made.savedGames.tooMany = true;
      made.savedGames.games = new Array(31).fill(game('x'));

      made.component.saveGameNow();
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.savedGames.saveCurrent).toHaveBeenCalled();
      expect(made.toastService.show).toHaveBeenCalledWith('CashflowGame.gameSaved', 'success');
      expect(made.toastService.show).toHaveBeenCalledWith('CashflowGame.tooManyGames', 'update');
    });

    it('New game asks first, then saves the game being played and clears the account', async () => {
      const made = makeComponent();

      made.component.newGame();
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.confirm.confirm).toHaveBeenCalled();
      expect(made.savedGames.startNewGame).toHaveBeenCalled();
      expect(made.component.dashboardView).toBe('main');
    });

    it('Continue loads another game at once - the game being played is saved by the service', async () => {
      const made = makeComponent();
      playing(made, 'current');

      made.component.continueGame(game('other'));
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.confirm.confirm).not.toHaveBeenCalled();
      expect(made.savedGames.loadGame).toHaveBeenCalledWith('other');
      expect(made.toastService.show).toHaveBeenCalledWith('CashflowGame.gameLoaded', 'success');
    });

    it('Continue on the game already being played asks first - it throws away unsaved changes', async () => {
      const made = makeComponent();
      playing(made, 'current');

      made.component.continueGame(game('current'));
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.confirm.confirm).toHaveBeenCalled();
      expect(made.savedGames.loadGame).toHaveBeenCalledWith('current');
    });

    it('switches to the language the game was played in', async () => {
      const made = makeComponent();

      made.component.continueGame(game('de-game', { language: 'de' }));
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.language.use).toHaveBeenCalledWith('de');
    });

    it('a game that fails to load shows why and stays where it was', async () => {
      const made = makeComponent();
      made.savedGames.loadGame.mockRejectedValueOnce(new Error('This saved game is damaged.'));

      made.component.continueGame(game('bad'));
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.toastService.show).toHaveBeenCalledWith('This saved game is damaged.', 'error');
      expect(made.component.isBusy).toBe(false);
    });

    it('renames in the list and deletes after asking', async () => {
      const made = makeComponent();
      made.component.startRename(game('a', { name: 'First' }));
      expect(made.component.renameText).toBe('First');
      made.component.renameText = 'Second';
      made.component.saveRename();
      await new Promise((resolve) => setTimeout(resolve));
      expect(made.savedGames.renameGame).toHaveBeenCalledWith('a', 'Second');
      expect(made.component.renamingId).toBeNull();

      made.component.deleteSavedGame(game('a', { name: 'First' }));
      await new Promise((resolve) => setTimeout(resolve));
      expect(made.confirm.confirm).toHaveBeenCalled();
      expect(made.savedGames.deleteGame).toHaveBeenCalledWith('a');
    });

    it('labels a game from its numbers, and knows which one is being played', () => {
      const made = makeComponent();
      playing(made, 'live');

      expect(made.component.gameStatus(game('x'))).toBe('playing');
      expect(made.component.gameStatus(game('x', { escapedRatRace: true }))).toBe('escaped');
      expect(made.component.gameStatus(game('x', { endedAt: '2026-10-04' }))).toBe('ended');
      expect(made.component.isLiveGame(game('live'))).toBe(true);
      expect(made.component.isLiveGame(game('other'))).toBe(false);
    });

    it('exports a game as a downloaded file', async () => {
      const made = makeComponent();
      const click = jest.fn();
      (URL as any).createObjectURL = jest.fn(() => 'blob:x');
      (URL as any).revokeObjectURL = jest.fn();
      jest.spyOn(document, 'createElement').mockReturnValueOnce({ click } as any);

      made.component.exportSavedGame(game('a'));
      await new Promise((resolve) => setTimeout(resolve));

      expect(made.savedGames.exportGame).toHaveBeenCalledWith('a');
      expect(click).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
  });

  describe('starting from the profession card', () => {
    it('shuffling opens the card, and Start there picks that profession and moves on to the language question', () => {
      const { component, cashflowGameService } = makeComponent();
      component.selectedProfessionId = '';
      const lehrer = component.selectedGameSet!.professions[1];

      component.openProfessionCard(lehrer); // what shuffle does after picking one
      component.startFromCard(lehrer);

      expect(component.selectedProfessionId).toBe(lehrer.id);
      expect(component.viewedProfession).toBeNull(); // the card closes
      expect(component.choosingLanguage).toBe(true); // next step
      expect(cashflowGameService.pickProfession).not.toHaveBeenCalled(); // not started yet
    });
  });

  describe('asking for the game language before a game starts', () => {
    it('Start opens the question first - it does not start the game yet', () => {
      const { component, cashflowGameService } = makeComponent();

      component.askLanguage();

      expect(component.choosingLanguage).toBe(true);
      expect(cashflowGameService.pickProfession).not.toHaveBeenCalled();
    });

    it('stays put when no profession is picked', () => {
      const { component } = makeComponent();
      component.selectedProfessionId = '';
      component.askLanguage();
      expect(component.choosingLanguage).toBe(false);
    });

    it('picking a language switches the app and waits for it', async () => {
      const { component, language } = makeComponent();

      await component.chooseLanguage('de');

      expect(language.use).toHaveBeenCalledWith('de');
      expect(component.isBusy).toBe(false);
    });

    it('Back closes the question, and Start then starts the game and closes it', () => {
      const { component, cashflowGameService } = makeComponent();
      component.askLanguage();
      component.cancelLanguage();
      expect(component.choosingLanguage).toBe(false);

      component.askLanguage();
      component.startGame();
      cashflowGameService.pickProfession.mock.calls[0][2].onSuccess();
      expect(component.choosingLanguage).toBe(false);
    });
  });

  describe('opening on the decision after a dice card is paid', () => {
    it('opens the game panel on its main view, whatever it was showing', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      const decisionNeeded$ = new Subject<void>();
      const { component } = makeComponent({ decisionNeeded$ } as any);
      CashflowGameComponent.isOpen = false;
      component.dashboardView = 'history';
      component.activeCard = { id: '1', title: 'x', assetKind: 'asset' } as any;

      decisionNeeded$.next();

      expect(CashflowGameComponent.isOpen).toBe(true);
      expect(component.dashboardView).toBe('main');
      expect(component.activeCard).toBeNull();
    });
  });

  describe('dice decision for a paid gold card', () => {
    const deal = {
      title: 'GOLD',
      coins: 10,
      costMinor: 50000,
      successOn: 6,
      stage: 'awaitingRoll',
    };

    it('the app rolls: a 6 wins, anything lower does not, and the roll is recorded', () => {
      const win = makeComponent({ rollDie: jest.fn(() => 6) });
      win.component.rollDice(deal as any);
      expect(win.cashflowGameService.resolveGamble).toHaveBeenCalledWith(
        'GOLD',
        { won: true, roll: 6 },
        expect.anything(),
      );

      const miss = makeComponent({ rollDie: jest.fn(() => 3) });
      miss.component.rollDice(deal as any);
      expect(miss.cashflowGameService.resolveGamble).toHaveBeenCalledWith(
        'GOLD',
        { won: false, roll: 3 },
        expect.anything(),
      );
    });

    it('an app roll keeps the die and its result on screen until Continue', () => {
      const resolveGamble = jest.fn((_t: string, _o: any, callbacks: any) => callbacks.onSuccess());
      const rich = { ...deal, successText: 'Ten gold coins!', failureText: 'Nothing.' };

      const win = makeComponent({ rollDie: jest.fn(() => 6), resolveGamble });
      win.component.rollDice(rich as any);
      expect(win.component.rollResult).toMatchObject({
        roll: 6,
        won: true,
        text: 'Ten gold coins!',
      });
      win.component.dismissRollResult();
      expect(win.component.rollResult).toBeNull();

      const miss = makeComponent({ rollDie: jest.fn(() => 3), resolveGamble });
      miss.component.rollDice(rich as any);
      expect(miss.component.rollResult).toMatchObject({ roll: 3, won: false, text: 'Nothing.' });
    });

    it('a roll reported from a real die shows no die (there is no number)', () => {
      const resolveGamble = jest.fn((_t: string, _o: any, callbacks: any) => callbacks.onSuccess());
      const { component } = makeComponent({ resolveGamble });
      component.reportRoll(deal as any, true);
      expect(component.rollResult).toBeNull();
    });

    it('closing the panel clears a result still on screen', () => {
      const { component } = makeComponent();
      component.rollResult = { roll: 2, won: false, headline: 'x', text: '' };
      component.closeWindow();
      expect(component.rollResult).toBeNull();
    });

    it('draws each face with the right number of pips', () => {
      const { component } = makeComponent();
      for (let face = 1; face <= 6; face++) {
        const cells = component.dieCells(face);
        expect(cells).toHaveLength(9);
        expect(cells.filter(Boolean)).toHaveLength(face);
      }
      expect(component.dieCells(1)[4]).toBe(true); // a single pip sits in the middle
      expect(component.dieCells(99).filter(Boolean)).toHaveLength(0);
    });

    it('a roll reported from a real die has no number', () => {
      const { component, cashflowGameService } = makeComponent();
      component.reportRoll(deal as any, true);
      expect(cashflowGameService.resolveGamble).toHaveBeenCalledWith(
        'GOLD',
        { won: true, roll: undefined },
        expect.anything(),
      );
    });

    it('shows the open decisions the service reports', () => {
      const { component } = makeComponent({ openDecisions: [deal] } as any);
      expect(component.openDecisions).toEqual([deal]);
    });
  });

  describe('card kind quick filter', () => {
    const share = { id: 's', title: 'OK4U Pharma AG', assetKind: 'share', symbol: 'OK4U' };
    const property = { id: 'p', title: 'Einfamilienhaus', assetKind: 'investment', symbol: 'EFH' };

    it('offers Share and Investment when the pile holds both, and filters the grid', () => {
      const { component } = makeComponent({ browseCards: jest.fn(() => [share, property]) });
      component.activeDeckKind = 'dealSmall';

      expect(component.cardKinds).toEqual(['share', 'investment']);
      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['OK4U', 'EFH']);

      component.toggleCardKind('investment');
      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['EFH']);

      component.toggleCardKind('investment'); // tapping it again clears the filter
      expect(component.cardTiles).toHaveLength(2);
    });

    it('shows the label of the picked language and finds a card by it or by the German one', () => {
      const { component, cashflowGameService } = makeComponent({
        browseCards: jest.fn(() => [share, property]),
      });
      const textService = (component as any).cardText;
      textService.symbolFor = jest.fn((symbol?: string) => (symbol === 'EFH' ? 'SFH' : symbol));
      textService.textFor = jest.fn((id: string) =>
        id === 'p' ? { title: 'Single-family home for sale' } : {},
      );
      component.activeDeckKind = 'dealSmall';
      expect(cashflowGameService).toBeDefined();

      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['OK4U', 'SFH']);
      expect(component.cardTiles[1].secondary).toBe('Single-family home for sale');

      component.cardQuery = 'sfh'; // the label in the picked language
      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['SFH']);
      component.cardQuery = 'efh'; // the deck's own label still finds it
      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['SFH']);
      component.cardQuery = 'single family'; // and so does the translated name, word by word
      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['SFH']);
    });

    it('rebuilds the tiles once the language file has loaded instead of keeping the German names', () => {
      const { component } = makeComponent({ browseCards: jest.fn(() => [property]) });
      const textService = (component as any).cardText;
      component.activeDeckKind = 'dealSmall';
      textService.textFor = jest.fn(() => ({}));
      textService.symbolFor = jest.fn((symbol?: string) => symbol);
      expect(component.cardTiles[0].primary).toBe('EFH');

      textService.version = 1; // the text arrived
      textService.symbolFor = jest.fn(() => 'SFH');
      expect(component.cardTiles[0].primary).toBe('SFH');
    });

    it('offers Asset next to Share and Investment when the pile holds gold coins', () => {
      const gold = {
        id: 'g',
        title: 'Freund braucht schnell Bargeld',
        assetKind: 'asset',
        symbol: 'GOLD',
      };
      const { component } = makeComponent({
        browseCards: jest.fn(() => [share, property, gold]),
      } as any);
      component.activeDeckKind = 'dealSmall';

      expect(component.cardKinds).toEqual(['share', 'investment', 'asset']);
      component.toggleCardKind('asset');
      expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['GOLD']);
    });

    describe('type filters (the second row)', () => {
      const card = (id: string, symbol: string) => ({
        id,
        title: symbol,
        assetKind: 'investment',
        symbol,
      });
      const pile = [
        card('a', 'MFH4'),
        card('b', 'MFH8'),
        card('c', 'EFH'),
        card('d', 'DH'),
        share,
        { id: 'g', title: 'Gold', assetKind: 'asset', symbol: 'GOLD' },
      ];

      it('lists the types present - the unit count does not split a type - and none for shares', () => {
        const { component } = makeComponent({ browseCards: jest.fn(() => pile) } as any);
        component.activeDeckKind = 'dealBig';

        expect(component.cardFamilies).toEqual(['MFH', 'EFH', 'DH', 'GOLD']);
      });

      it('narrows the grid to one type, and tapping it again clears it', () => {
        const { component } = makeComponent({ browseCards: jest.fn(() => pile) } as any);
        component.activeDeckKind = 'dealBig';

        component.toggleCardFamily('MFH');
        expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['MFH4', 'MFH8']);

        component.toggleCardFamily('MFH');
        expect(component.cardTiles).toHaveLength(pile.length);
      });

      it('follows the kind filter: only the types of that kind remain, and a stale type is dropped', () => {
        const { component } = makeComponent({ browseCards: jest.fn(() => pile) } as any);
        component.activeDeckKind = 'dealSmall';

        component.toggleCardFamily('GOLD');
        component.toggleCardKind('investment'); // gold is an asset: no longer offered
        expect(component.cardFamilies).toEqual(['MFH', 'EFH', 'DH']);
        expect(component.cardFamilyFilter).toBeNull();

        component.toggleCardKind('asset');
        expect(component.cardFamilies).toEqual(['GOLD']);
      });

      it('type filters combine with the text search', () => {
        const { component } = makeComponent({ browseCards: jest.fn(() => pile) } as any);
        component.activeDeckKind = 'dealBig';
        component.toggleCardFamily('MFH');
        component.cardQuery = 'mfh8';
        expect(component.cardTiles.map((tile) => tile.primary)).toEqual(['MFH8']);
      });

      it('changing pile clears both filters', () => {
        const { component } = makeComponent({ browseCards: jest.fn(() => pile) } as any);
        component.activeDeckKind = 'dealBig';
        component.toggleCardFamily('EFH');
        component.changeDeck();
        expect(component.cardFamilyFilter).toBeNull();
      });
    });

    it('shows no filter for a pile with a single kind (Big Deal)', () => {
      const { component } = makeComponent({ browseCards: jest.fn(() => [property]) });
      component.activeDeckKind = 'dealBig';

      expect(component.cardKinds).toEqual(['investment']);
      // the template hides the chips unless there are at least two kinds to choose from
      expect(component.cardKinds.length > 1).toBe(false);
    });
  });

  describe('declining a Deal card', () => {
    it('returns to the main dashboard without touching the game', () => {
      const { component, cashflowGameService } = makeComponent();
      component.dashboardView = 'cards';
      component.activeCard = { id: '1', title: 'Duplex', assetKind: 'investment' };

      component.declineActiveCard();

      expect(component.dashboardView).toBe('main');
      expect(component.activeCard).toBeNull();
      expect(cashflowGameService.applyDealCard).not.toHaveBeenCalled();
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

    it('a stock card for a share you still hold updates the price instead of planning', () => {
      const updateSharePrice = jest.fn((_c: any, _t: any, cb: any) => cb.onSuccess('OK4U'));
      const { component, cashflowGameService } = makeComponent({
        updateSharePrice,
        heldShareProjectFor: jest.fn(() => ({ title: 'OK4U', share: { tag: 'OK4U' } })),
      });
      component.activeDeckKind = 'dealSmall';
      component.activeCard = {
        id: 'c',
        title: 'OK4U',
        symbol: 'OK4U',
        assetKind: 'share',
        priceMinor: 500,
      } as any;

      component.applyActiveCard();

      expect(updateSharePrice).toHaveBeenCalled();
      expect(cashflowGameService.applyDealCard).not.toHaveBeenCalled();
    });

    it('a stock card for a new share is planned as before', () => {
      const { component, cashflowGameService } = makeComponent({
        heldShareProjectFor: jest.fn(() => undefined),
      });
      component.activeDeckKind = 'dealSmall';
      component.activeCard = {
        id: 'c',
        title: 'OK4U',
        symbol: 'OK4U',
        assetKind: 'share',
        priceMinor: 500,
      } as any;

      component.applyActiveCard();

      expect(cashflowGameService.applyDealCard).toHaveBeenCalled();
    });

    describe('rat race escape banner', () => {
      const withGame = (passive: number, expenses: number) => {
        const { component } = makeComponent();
        const state = AppStateService.instance;
        state.cashflowGame = {
          ...state.cashflowGame,
          professionId: 'placeholder-profession',
          gameSetId: 'placeholder',
          gameSubscriptionTitles: ['Salary', 'Rent', 'OK Cashflow'],
        };
        state.allSubscriptions = [
          { title: 'Salary', amount: 3000 },
          { title: 'Rent', amount: -expenses },
          { title: 'OK Cashflow', amount: passive },
        ] as any;
        return component;
      };

      it('shows once passive income covers every monthly expense', () => {
        expect(withGame(1500, 1500).escapedRatRace).toBe(true);
        expect(withGame(2000, 1500).escapedRatRace).toBe(true);
      });

      it('counts an exact tie as escaped even where decimal sums would drift (0.1 + 0.2 vs 0.3)', () => {
        // With plain decimals 0.1 + 0.2 is 0.30000000000000004, so 0.3 of passive income would
        // read as "not enough" against it. The domain summary works in whole minor units.
        const component = withGame(0.3, 0);
        const state = AppStateService.instance;
        state.cashflowGame = {
          ...state.cashflowGame,
          gameSubscriptionTitles: ['Salary', 'Rent A', 'Rent B', 'OK Cashflow'],
        };
        state.allSubscriptions = [
          { title: 'Salary', amount: 3000 },
          { title: 'Rent A', amount: -0.1 },
          { title: 'Rent B', amount: -0.2 },
          { title: 'OK Cashflow', amount: 0.3 },
        ] as any;

        expect(component.escapedRatRace).toBe(true);
      });

      it('stays hidden while the expenses are higher, and when there is nothing to cover', () => {
        expect(withGame(1000, 1500).escapedRatRace).toBe(false);
        expect(withGame(0, 0).escapedRatRace).toBe(false);
      });

      it('a salary alone never counts as passive income', () => {
        expect(withGame(0, 1000).escapedRatRace).toBe(false);
      });
    });

    it('applyActiveCard plans a Deal-deck card', () => {
      const { component, cashflowGameService } = makeComponent();
      component.activeDeckKind = 'dealSmall';
      const card = { id: '1', title: 'Duplex', assetKind: 'investment' };
      component.activeCard = card as any;

      component.applyActiveCard();

      expect(cashflowGameService.applyDealCard).toHaveBeenCalledWith(
        card,
        expect.anything(),
        expect.anything(),
      );
    });

    it('a Doodad card is paid through the Add dialog, pre-filled - never booked here', async () => {
      const { component, cashflowGameService } = makeComponent();
      component.activeDeckKind = 'doodad';
      component.activeCard = {
        id: 'classic-doodad-boat',
        title: 'Du kaufst ein Boot',
        costMinor: 500000,
        account: 'Smile',
        group: 'leisure',
      } as any;
      const { AddComponent } = await import('../../panels/add/add.component');

      await component.payActiveDoodad();

      expect(AddComponent.isAdd).toBe(true);
      expect(AddComponent.selectedOption).toBe('Smile');
      expect(AddComponent.amountTextField).toBe('-5000');
      expect(AddComponent.categoryTextField).toBe('@leisure');
      expect(AddComponent.commentTextField).toContain('🏦 note');
      expect(AddComponent.commentTextField).toBe('Du kaufst ein Boot\n\n🏦 note\n\n#doodad');
      expect(cashflowGameService.doodadLoanNote).toHaveBeenCalledWith(500000);
    });

    it('a Doodad without a suggested account falls back to Splurge', async () => {
      const { component, cashflowGameService } = makeComponent();
      cashflowGameService.doodadLoanNote.mockReturnValue('');
      component.activeDeckKind = 'doodad';
      component.activeCard = { id: 'x', title: 'Gadget', costMinor: 1000 } as any;
      const { AddComponent } = await import('../../panels/add/add.component');

      await component.payActiveDoodad();

      expect(AddComponent.selectedOption).toBe('Splurge');
      expect(AddComponent.categoryTextField).toBe('@Gadget');
    });

    describe('market buyer cards', () => {
      const buyer = {
        id: 'm1',
        title: 'Einfamilienhaus Käufer',
        description: 'x',
        sells: { family: 'EFH', plusPercent: 20 },
      };
      const open = (matched: string[]) => {
        const made = makeComponent({
          playMarketCard: jest.fn((_card: any, _opts: any, callbacks: any) =>
            callbacks.onSuccess(matched),
          ),
        });
        made.component.activeDeckKind = 'market';
        made.component.activeCard = buyer as any;
        made.component.dashboardView = 'cards';
        return made;
      };

      it('playing it with a fitting property lands on the Grow page', () => {
        const { component, router, cashflowGameService } = open(['EFH']);

        component.playActiveMarket();

        expect((cashflowGameService as any).playMarketCard).toHaveBeenCalledWith(
          buyer,
          expect.objectContaining({ types: [{ labels: ['EFH', 'EFH'] }] }),
          expect.anything(),
        );
        expect(router.navigate).toHaveBeenCalledWith(['/grow']);
        expect(component.marketNotice).toBeNull();
      });

      it('playing it without a fitting property only informs the player, on the dashboard', () => {
        const { component, router } = open([]);

        component.playActiveMarket();

        expect(router.navigate).not.toHaveBeenCalled();
        expect(component.marketNotice).toBe('CashflowGame.marketNoMatch');
        expect(component.dashboardView).toBe('main');
      });

      describe('quick filters', () => {
        const cards = [
          { id: 'a', title: 'B', description: '', sells: { family: 'EFH', plusPercent: 20 } },
          { id: 'b', title: 'B', description: '', sells: { family: 'EFH', plusMinor: 500000 } },
          { id: 'c', title: 'B', description: '', sells: { family: 'ETW', plusPercent: 10 } },
        ];
        const openMarket = () => {
          const made = makeComponent({ browseCards: jest.fn(() => cards) });
          made.component.activeDeckKind = 'market';
          return made.component;
        };

        it('offers the property types and the offer kinds the pile holds', () => {
          const component = openMarket();
          expect(component.marketFamilies).toEqual(['EFH', 'ETW']);
          expect(component.marketOfferKinds).toEqual(['percent', 'amount']);
        });

        it('narrows by type, and the offer chips follow the type', () => {
          const component = openMarket();
          component.toggleMarketFamily('ETW');
          expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['c']);
          expect(component.marketOfferKinds).toEqual([]);
        });

        it('narrows by offer kind and a second tap clears it', () => {
          const component = openMarket();
          component.toggleMarketOffer('percent');
          expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['a', 'c']);
          component.toggleMarketOffer('percent');
          expect(component.cardTiles).toHaveLength(3);
        });

        it('a fixed price is its own offer kind, shown as the price', () => {
          const { component } = makeComponent({
            browseCards: jest.fn(() => [
              {
                id: 'p',
                title: 'B',
                description: '',
                sells: { family: 'ETW', priceMinor: 6500000 },
              },
              { id: 'q', title: 'B', description: '', sells: { family: 'ETW', plusPercent: 10 } },
            ]),
          });
          component.activeDeckKind = 'market';

          expect(component.marketOfferKinds).toEqual(['price', 'percent']);
          component.toggleMarketOffer('price');
          expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['p']);
          expect(component.cardTiles[0].range).toBe('65.000 €');
        });

        it('changing the pile resets them', () => {
          const component = openMarket();
          component.toggleMarketFamily('EFH');
          component.changeDeck();
          expect(component.marketFamilyFilter).toBeNull();
        });
      });

      it("shows the type's label (SFH) as the tile heading, with the name under it", () => {
        const { component } = open([]);
        (component as any).cardText.symbolFor = (symbol: string) =>
          symbol === 'EFH' ? 'SFH' : symbol;
        (component as any).cardText.textFor = () => ({ title: 'Single-family home buyer' });
        const tile = (component as any).tileFor(buyer);
        expect(tile.primary).toBe('SFH');
        expect(tile.secondary).toBe('Single-family home buyer');
        expect(tile.search).toContain('sfh');
      });

      it('the "does not apply" message is gone when the panel is opened again', () => {
        const { component } = open([]);
        component.playActiveMarket();
        expect(component.marketNotice).not.toBeNull();

        component.closeWindow();

        expect(component.marketNotice).toBeNull();
      });

      describe('cost cards (pay it, or it does not apply)', () => {
        const cost = {
          id: 'c1',
          title: 'Abwasserrohr gebrochen',
          description: 'x',
          pays: { costMinor: 100000 },
        };
        const open = (property: string | null) => {
          const made = makeComponent({
            playMarketCostCard: jest.fn((_c: any, _o: any, callbacks: any) =>
              callbacks.onSuccess(property),
            ),
          });
          made.component.activeDeckKind = 'market';
          made.component.activeCard = cost as any;
          (made.component as any).cardText.textFor = () => ({
            comment: 'The pipe at {property} broke.',
          });
          return made;
        };

        it('without a property it only says so on the dashboard', () => {
          const { component } = open(null);
          component.playActiveMarketCost();
          expect(component.marketNotice).toBe('CashflowGame.marketNoProperty');
          expect(component.dashboardView).toBe('main');
        });

        it('with a property it opens the Add dialog on Fire, with the first property as category', async () => {
          const { component } = open('SFH-II');
          const { AddComponent } = await import('../../panels/add/add.component');

          component.playActiveMarketCost();
          await new Promise((resolve) => setTimeout(resolve));

          expect(AddComponent.isAdd).toBe(true);
          expect(AddComponent.selectedOption).toBe('Fire');
          expect(AddComponent.categoryTextField).toBe('@SFH-II');
          expect(AddComponent.amountTextField).toBe('-1000');
          expect(AddComponent.commentTextField).toBe(
            'Abwasserrohr gebrochen\n\nThe pipe at SFH-II broke.\n\n🏦 note\n\n#market',
          );
        });

        it('shows the cost on the tile and has its own "You pay" filter', () => {
          const made = makeComponent({ browseCards: jest.fn(() => [cost]) });
          made.component.activeDeckKind = 'market';
          expect(made.component.marketOfferKinds).toEqual([]); // only one kind: no choice
          const tile = (made.component as any).tileFor(cost);
          // The component formats with the runtime locale, so build the expectation the same way.
          expect(tile.value).toBe((1000).toLocaleString());
          expect(tile.priceText).toBe('1000');
        });
      });

      describe('stock splits and cashflow boosts', () => {
        const split = {
          id: 's1',
          title: 'Aktie - OK4U',
          description: 'x',
          splits: { symbol: 'OK4U' },
        };
        const boost = {
          id: 'b1',
          title: 'Kleiner Business Boom!',
          description: 'x',
          star: true,
          boost: { maxCashflowMinor: 100000, addMinor: 25000 },
        };

        it('a split card without the share only says so; with it, the dice decision takes over', () => {
          const none = makeComponent({
            playShareSplitCard: jest.fn((_c: any, _o: any, cb: any) => cb.onSuccess(null)),
          });
          none.component.activeDeckKind = 'market';
          none.component.activeCard = split as any;
          none.component.playActiveMarketSplit();
          expect(none.component.marketNotice).toBe('CashflowGame.marketNoShare');

          const owned = makeComponent({
            playShareSplitCard: jest.fn((_c: any, _o: any, cb: any) => cb.onSuccess('OK4U')),
          });
          owned.component.activeDeckKind = 'market';
          owned.component.activeCard = split as any;
          owned.component.playActiveMarketSplit();
          expect(owned.component.marketNotice).toBeNull();
          expect(owned.component.dashboardView).toBe('main');
        });

        it('the app die doubles a split on 1-3 and halves it on 4-6', () => {
          const deal = {
            title: 'SPLIT-OK4U',
            split: { shareTag: 'OK4U' },
            successText: 'x2',
            failureText: '/2',
          } as any;
          const resolveGamble = jest.fn((_t: string, _o: any, cb: any) => cb.onSuccess());

          const low = makeComponent({ rollDie: jest.fn(() => 3), resolveGamble });
          low.component.rollDice(deal);
          expect(resolveGamble).toHaveBeenLastCalledWith(
            'SPLIT-OK4U',
            { won: true, roll: 3 },
            expect.anything(),
          );
          expect(low.component.rollResult).toMatchObject({ won: true, headline: 'x2' });

          const high = makeComponent({ rollDie: jest.fn(() => 4), resolveGamble });
          high.component.rollDice(deal);
          expect(resolveGamble).toHaveBeenLastCalledWith(
            'SPLIT-OK4U',
            { won: false, roll: 4 },
            expect.anything(),
          );
          expect(high.component.rollResult).toMatchObject({ won: false, headline: '/2' });
        });

        it('a boost card reports what it raised - or that it does not apply', () => {
          const some = makeComponent({
            playBoostCard: jest.fn((_c: any, _o: any, cb: any) =>
              cb.onSuccess([{ title: 'SFH', from: 300, to: 550 }]),
            ),
          });
          some.component.activeDeckKind = 'market';
          some.component.activeCard = boost as any;
          some.component.playActiveMarketBoost();
          expect(some.component.marketNotice).toBe('CashflowGame.marketBoostDone');

          const none = makeComponent({
            playBoostCard: jest.fn((_c: any, _o: any, cb: any) => cb.onSuccess([])),
          });
          none.component.activeDeckKind = 'market';
          none.component.activeCard = boost as any;
          none.component.playActiveMarketBoost();
          expect(none.component.marketNotice).toBe('CashflowGame.marketBoostNone');
        });

        it('a split card is a dice card in the list: it shows the dice and what they do', () => {
          const { component } = makeComponent();
          component.activeDeckKind = 'market';
          expect((component as any).tileFor(split).range).toBe('🎲 ×2 / ÷2');
        });

        it('a star card carries a star in the list and on its heading', () => {
          const { component } = makeComponent();
          component.activeDeckKind = 'market';
          component.activeCard = boost as any;
          expect((component as any).tileFor(boost).primary).toContain('★');
          expect(component.activeCardTitle).toBe('Kleiner Business Boom! ★');
        });

        it('splits and boosts are their own quick-filter kinds', () => {
          const { component } = makeComponent({ browseCards: jest.fn(() => [split, boost]) });
          component.activeDeckKind = 'market';
          expect(component.marketOfferKinds).toEqual(['split', 'boost']);
          component.toggleMarketOffer('boost');
          expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['b1']);
        });
      });

      it('tells the nine buyers apart by their offer in the list', () => {
        const { component } = open([]);
        const tile = (component as any).tileFor(buyer);
        expect(tile.range).toBe('+20%');
        expect(tile.search).toContain('+20%');
        expect(tile.priceText).toBe('20');
      });
    });

    describe('Schnickschnack quick filters', () => {
      const cards = [
        { id: 'a', title: 'Boat', costMinor: 1, account: 'Smile', group: 'leisure' },
        { id: 'b', title: 'Jet ski', costMinor: 1, account: 'Smile', group: 'leisure' },
        { id: 'c', title: 'Kitchen', costMinor: 1, account: 'Smile', group: 'home' },
        { id: 'd', title: 'Chair', costMinor: 1, account: 'Splurge', group: 'home' },
        { id: 'e', title: 'Watch', costMinor: 1, account: 'Splurge', group: 'style' },
      ];
      const open = () => {
        const made = makeComponent({ browseCards: jest.fn(() => cards) });
        made.component.activeDeckKind = 'doodad';
        return made.component;
      };

      it('offers the accounts and groups the pile holds', () => {
        const component = open();
        expect(component.doodadAccounts).toEqual(['Smile', 'Splurge']);
        expect(component.doodadGroups).toEqual(['leisure', 'home', 'style']);
      });

      it('narrows the list by account, and the group chips follow the account', () => {
        const component = open();
        component.toggleDoodadAccount('Splurge');
        expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['d', 'e']);
        expect(component.doodadGroups).toEqual(['home', 'style']);
      });

      it('narrows by group, combines with the account, and a tap on the active chip clears it', () => {
        const component = open();
        component.toggleDoodadGroup('home');
        expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['c', 'd']);
        component.toggleDoodadAccount('Smile');
        expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['c']);
        component.toggleDoodadGroup('home');
        expect(component.cardTiles.map((tile) => tile.card.id)).toEqual(['a', 'b', 'c']);
      });

      it('drops a group that the newly chosen account does not have', () => {
        const component = open();
        component.toggleDoodadGroup('leisure');
        component.toggleDoodadAccount('Splurge');
        expect(component.doodadGroupFilter).toBeNull();
      });

      it('changing the pile resets the filters', () => {
        const component = open();
        component.toggleDoodadAccount('Smile');
        component.changeDeck();
        expect(component.doodadAccountFilter).toBeNull();
      });
    });

    it('a Doodad shows its own printed line when it has no loan hint', () => {
      const { component } = makeComponent();
      component.activeDeckKind = 'doodad';
      component.activeCard = { id: 'x', title: 'Zahnarzt', costMinor: 70000 } as any;
      (component as any).cardText.textFor = () => ({ description: 'Gold tooth!' });

      expect(component.doodadHint).toBe('Gold tooth!');
    });

    it('pick another one returns to the card list', () => {
      const { component } = makeComponent();
      component.activeDeckKind = 'doodad';
      component.activeCard = { id: 'x', title: 'Gadget', costMinor: 1000 } as any;

      component.clearActiveCard();

      expect(component.activeCard).toBeNull();
    });
  });
});

describe('CashflowGameComponent solo mode (JFK, 2026-10-05)', () => {
  function soloComponent(extra: Partial<Record<string, unknown>> = {}) {
    const rollTurn = jest.fn();
    const settleSoloDecision = jest.fn();
    const made = makeComponent({
      rollTurn,
      settleSoloDecision,
      board: CLASSIC_RAT_RACE_BOARD,
      soloTurn: { phase: 'roll', count: 0 },
      cannotRollBecause: null,
      soloSummary: jest.fn(() => ({ outcome: 'escaped' })),
      ...extra,
    } as any);
    return { ...made, rollTurn, settleSoloDecision };
  }

  const setSoloState = (extra: Record<string, unknown> = {}) => {
    const state = AppStateService.instance;
    state.cashflowGame = {
      ...state.cashflowGame,
      mode: 'solo',
      professionId: 'hausmeister',
      gameSetId: 'cashflow',
      boardPosition: null,
      turn: { phase: 'roll', count: 0 },
      ...extra,
    } as any;
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve, 15));

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    ProfileComponent.mail = '';
    // no waiting between steps in tests: the token jumps straight to the landing
    (window as any).matchMedia = jest.fn(() => ({ matches: true }));
  });

  it('starts a game in the mode chosen with the language', () => {
    const { component, cashflowGameService } = soloComponent();
    component.playMode = 'solo';
    component.startGame();
    expect(cashflowGameService.pickProfession).toHaveBeenCalledWith(
      component.selectedGameSetId,
      component.selectedProfessionId,
      expect.any(Object),
      'solo',
    );
    const companion = soloComponent();
    companion.component.startGame();
    expect(companion.cashflowGameService.pickProfession.mock.calls[0][3]).toBe('companion');
  });

  it('measures the way to the next Payday from the token, START included', () => {
    const { component } = soloComponent();
    setSoloState({ boardPosition: null });
    expect(component.spacesToPayday).toBe(6); // spaces 0..5
    setSoloState({ boardPosition: 4 });
    expect(component.spacesToPayday).toBe(1);
    setSoloState({ boardPosition: 5 });
    expect(component.spacesToPayday).toBe(8); // the next Payday is space 13
    setSoloState({ boardPosition: 22 });
    expect(component.spacesToPayday).toBe(7); // wraps to space 5
  });

  it('cannot roll while busy, or when the game says no', () => {
    const blocked = soloComponent({ cannotRollBecause: 'Deal with the card first.' });
    setSoloState();
    expect(blocked.component.canRoll).toBe(false);
    const free = soloComponent();
    expect(free.component.canRoll).toBe(true);
    free.component.isBusy = true;
    expect(free.component.canRoll).toBe(false);
  });

  it('a roll shows the dice and, landing on a Deals space, waits for the player: the card does not open by itself', async () => {
    const { component, rollTurn, cashflowGameService } = soloComponent();
    setSoloState();
    rollTurn.mockImplementation((_dice: number, callbacks: any) => {
      setSoloState({
        boardPosition: 2,
        turn: { phase: 'decide', count: 1, pending: { kind: 'deal', spaceIndex: 2 } },
      });
      (cashflowGameService as any).soloTurn = AppStateService.instance.cashflowGame.turn;
      callbacks.onSuccess();
      return {
        roll: { dice: [3], total: 3 },
        move: {
          entered: [{ index: 0 }, { index: 1 }, { index: 2, kind: 'deal' }],
          paydays: 0,
          landed: { kind: 'deal', index: 2 },
        },
      };
    });

    component.rollSolo();
    await settle();

    expect(rollTurn.mock.calls[0][0]).toBe(1);
    expect(component.lastDice).toEqual([3]);
    expect(component.walking).toBe(false);
    expect(component.tokenPosition).toBe(2);
    // the landing dialog is up (the turn is waiting on the card); nothing opened the card flow
    expect(component.soloTurn.pending).toEqual({ kind: 'deal', spaceIndex: 2 });
    expect(component.dashboardView).toBe('main');
    // and the player opens it on request
    const deals = jest.spyOn(component, 'landOnDeals').mockImplementation(() => undefined);
    component.openSoloDecision();
    expect(deals).toHaveBeenCalled();
  });

  it('the dice rest on the number rolled - still, also after a reload and when the dice come into view again', async () => {
    const { component, rollTurn } = soloComponent();
    setSoloState({ turn: { phase: 'roll', count: 1, lastRoll: [4, 2] } });
    // after a reload nothing was rolled in this session, yet the last roll is on show
    expect(component.diceTumbling).toBe(false);
    expect(component.shownDice).toEqual([4, 2]);

    setSoloState({ turn: { phase: 'roll', count: 1 } });
    rollTurn.mockImplementation((_d: number, callbacks: any) => {
      callbacks.onSuccess();
      return {
        roll: { dice: [5], total: 5 },
        move: { entered: [{ index: 4 }], paydays: 0, landed: { kind: 'deal', index: 4 } },
        effects: [],
        openingPayday: false,
      };
    });
    component.rollSolo();
    await settle();
    expect(component.diceTumbling).toBe(false);
    expect(component.shownDice).toEqual([5]);
    expect(component.trackByIndex(1)).toBe(1);
  });

  it('a Payday shows a big banner with what it paid, until the next roll or until it is closed', async () => {
    const { component, rollTurn } = soloComponent();
    setSoloState();
    const payday = {
      appendedTransactions: [
        { amountMinor: 300000 },
        { amountMinor: -120000 },
        { amountMinor: -30000 },
      ],
    };
    rollTurn.mockImplementation((_d: number, callbacks: any) => {
      callbacks.onSuccess();
      return {
        roll: { dice: [6], total: 6 },
        move: {
          entered: [{ index: 5, kind: 'payday' }],
          paydays: 1,
          landed: { kind: 'payday', index: 5 },
        },
        effects: [payday, payday, { appendedTransactions: [{ amountMinor: -9999 }] }],
        openingPayday: true,
      };
    });
    component.rollSolo();
    await settle();

    // the opening Payday and the one landed on: both are in the banner, the landing's own booking is not
    expect(component.paydayBanner).toEqual({
      count: 2,
      incomeMinor: 600000,
      expensesMinor: 300000,
      netMinor: 300000,
    });

    component.dismissPayday();
    expect(component.paydayBanner).toBeNull();

    // a roll that crosses no Payday leaves no banner, and the next roll clears the old one
    component.paydayBanner = { count: 1, incomeMinor: 1, expensesMinor: 0, netMinor: 1 };
    rollTurn.mockImplementation((_d: number, callbacks: any) => {
      callbacks.onSuccess();
      return {
        roll: { dice: [1], total: 1 },
        move: { entered: [{ index: 6 }], paydays: 0, landed: { kind: 'deal', index: 6 } },
        effects: [],
        openingPayday: false,
      };
    });
    component.rollSolo();
    await settle();
    expect(component.paydayBanner).toBeNull();
  });

  it('two dice are rolled only when Charity runs and they were chosen', () => {
    const first = soloComponent();
    setSoloState({ charityRoundsLeft: 3 });
    first.component.diceChoice = 2;
    first.rollTurn.mockReturnValue(null);
    first.component.rollSolo();
    expect(first.rollTurn.mock.calls[0][0]).toBe(2);

    const plain = soloComponent();
    setSoloState({ charityRoundsLeft: 0 });
    plain.component.diceChoice = 2; // a stale choice must not count without Charity
    plain.rollTurn.mockReturnValue(null);
    plain.component.rollSolo();
    expect(plain.rollTurn.mock.calls[0][0]).toBe(1);
  });

  it('a space resolved on the spot is told in a message; a finished game shows its end', async () => {
    const { component, rollTurn, toastService } = soloComponent();
    setSoloState();
    rollTurn.mockImplementation(() => {
      setSoloState({ boardPosition: 19, turn: { phase: 'roll', count: 1 } });
      return {
        roll: { dice: [4], total: 4 },
        move: { entered: [{ index: 19 }], paydays: 0, landed: { kind: 'baby', index: 19 } },
      };
    });
    component.rollSolo();
    await settle();
    expect(toastService.show).toHaveBeenCalledWith('CashflowGame.solo.landedBaby', 'update');

    setSoloState({ turn: { phase: 'over', count: 5, outcome: 'escaped' } });
    (component as any).cashflowGameService.soloTurn = AppStateService.instance.cashflowGame.turn;
    expect(component.gameOver).toBe(true);
  });

  it('settling the open card goes through the service and returns to the dashboard', () => {
    const { component, settleSoloDecision } = soloComponent();
    setSoloState({
      turn: { phase: 'decide', count: 1, pending: { kind: 'market', spaceIndex: 7 } },
    });
    component.dashboardView = 'cards';
    settleSoloDecision.mockImplementation((_how: string, callbacks: any) => callbacks.onSuccess());
    component.finishSoloDecision('passed');
    expect(settleSoloDecision.mock.calls[0][0]).toBe('passed');
    expect(component.dashboardView).toBe('main');
  });

  it('an open decision reopens the card flow for its space', () => {
    const { component, cashflowGameService } = soloComponent();
    const pending = (kind: string) => {
      (cashflowGameService as any).soloTurn = {
        phase: 'decide',
        count: 1,
        pending: { kind, spaceIndex: 0 },
      };
    };
    const doodad = jest.spyOn(component, 'landOnDoodad').mockImplementation(() => undefined);
    const market = jest.spyOn(component, 'landOnMarket').mockImplementation(() => undefined);
    const deals = jest.spyOn(component, 'landOnDeals').mockImplementation(() => undefined);
    pending('doodad');
    component.openSoloDecision();
    pending('market');
    component.openSoloDecision();
    pending('deal');
    component.openSoloDecision();
    expect([doodad, market, deals].map((spy) => spy.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
