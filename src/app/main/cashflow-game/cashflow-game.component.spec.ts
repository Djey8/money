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
    undoLastPayday: jest.fn(),
    resolveBaby: jest.fn(),
    resolveCharity: jest.fn(),
    resolveDownsized: jest.fn(),
    adjustBankLoan: jest.fn(),
    clearStatus: jest.fn(),
    monthlyCashflow: 0,
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
  });

  describe('ngOnInit', () => {
    it('redirects home for a non-cashflow account without loading anything', () => {
      ProfileComponent.mail = 'jfk@example.com';
      const { component, router, appData } = makeComponent();

      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
      expect(appData.loadCashflowGameData).not.toHaveBeenCalled();
    });

    it('loads the game state for a cashflow account and pre-selects the first profession', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      const { component, appData } = makeComponent();

      component.ngOnInit();

      expect(appData.loadCashflowGameData).toHaveBeenCalled();
      expect(component.selectedProfessionId).toBe(CASHFLOW_GAME_SETS[0].professions[0].id);
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
    it('sums Daily/Splurge/Smile/Fire the same way the Home dashboard does', () => {
      const { component } = makeComponent();
      const state = AppStateService.instance;
      state.daily = 60;
      state.splurge = 10;
      state.smile = 10;
      state.fire = 20;
      state.allTransactions = [
        { account: 'Income', amount: 1000, category: 'Salary', date: '2026-01-01', comment: '' },
        { account: 'Daily', amount: -50, category: '@Rent', date: '2026-01-02', comment: '' },
      ] as any;

      // Income splits fully across the four buckets regardless of ratio, so
      // the total is the income (1000) plus the direct Daily expense (-50).
      expect(component.cash).toBe(950);
    });
  });

  describe('startGame / payday / undoPayday', () => {
    it('delegates to the service and shows a toast on success', () => {
      const { component, cashflowGameService, toastService } = makeComponent();
      component.selectedGameSetId = 'placeholder';
      component.selectedProfessionId = 'placeholder-profession';

      component.startGame();
      const startCall = cashflowGameService.pickProfession.mock.calls[0];
      expect(startCall[0]).toBe('placeholder');
      expect(startCall[1]).toBe('placeholder-profession');
      startCall[2].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.started', 'success');

      component.payday();
      cashflowGameService.payday.mock.calls[0][0].onSuccess();
      expect(toastService.show).toHaveBeenCalledWith('CashflowGame.paydayDone', 'success');

      component.undoPayday();
      cashflowGameService.undoLastPayday.mock.calls[0][0].onSuccess();
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
  });
});
