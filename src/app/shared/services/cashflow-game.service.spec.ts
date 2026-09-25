import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

describe('CashflowGameService', () => {
  let service: CashflowGameService;
  let persistence: { batchWriteAndSync: jest.Mock };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    const state = AppStateService.instance;
    state.allRevenues = [];
    state.allIntrests = [];
    state.allProperties = [];
    state.dailyExpenses = [];
    state.splurgeExpenses = [];
    state.smileExpenses = [];
    state.fireExpenses = [];
    state.mojoExpenses = [];
    state.allSmileProjects = [];
    state.allFireEmergencies = [];
    state.allShares = [];
    state.allInvestments = [];
    state.allAssets = [];
    state.liabilities = [];
    state.allSubscriptions = [];
    state.allTransactions = [];
    state.mojo = { amount: 0, target: 0 };
    state.daily = 60;
    state.splurge = 10;
    state.smile = 10;
    state.fire = 20;

    persistence = { batchWriteAndSync: jest.fn((config) => config.onSuccess()) };
    const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
    service = new CashflowGameService(persistence as any, incomeStatement);
  });

  describe('isCashflowGame', () => {
    it('is true only when the account email contains "cashflow"', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      expect(CashflowGameService.isCashflowGame()).toBe(true);
      ProfileComponent.mail = 'jfk@example.com';
      expect(CashflowGameService.isCashflowGame()).toBe(false);
    });
  });

  describe('pickProfession', () => {
    it('materializes the starter kit as real entities and starting cash', () => {
      const onSuccess = jest.fn();
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess,
        onError: jest.fn(),
      });

      const state = AppStateService.instance;
      expect(state.cashflowGame.professionId).toBe('placeholder-profession');
      expect(state.cashflowGame.gameSetId).toBe('placeholder');
      expect(state.allSubscriptions).toHaveLength(2);
      expect(state.allSubscriptions[0]).toMatchObject({ account: 'Income', amount: 3000 });
      expect(state.allSubscriptions[1]).toMatchObject({ account: 'Daily', amount: -1800 });
      expect(state.allSubscriptions.every((s) => s.comment.includes('#cashflow'))).toBe(true);
      // Starting cash transaction
      expect(state.allTransactions).toHaveLength(1);
      expect(state.allTransactions[0]).toMatchObject({ account: 'Income', amount: 3000 });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('reports an error for an unknown profession rather than throwing', () => {
      const onError = jest.fn();
      service.pickProfession('placeholder', 'nope', { onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Unknown Cashflow profession'));
      expect(persistence.batchWriteAndSync).not.toHaveBeenCalled();
    });
  });

  describe('payday and undo', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('creates one transaction per game subscription, never touching an unrelated one', () => {
      started();
      AppStateService.instance.allSubscriptions.push({
        title: 'A personal subscription, not the game’s',
        account: 'Daily',
        amount: -9.99,
        startDate: '2026-01-01',
        endDate: '',
        category: '@Streaming',
        comment: '',
        frequency: 'monthly',
      });

      const onSuccess = jest.fn();
      service.payday({ onSuccess, onError: jest.fn() });

      const state = AppStateService.instance;
      // starting cash (1) + salary + expenses (2) = 3; the unrelated subscription created nothing
      expect(state.allTransactions).toHaveLength(3);
      expect(state.cashflowGame.round).toBe(1);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('undo removes exactly the payday transactions and rewinds the round', () => {
      started();
      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.allTransactions).toHaveLength(3);

      service.undoLastPayday({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allTransactions).toHaveLength(1); // only the starting-cash transaction remains
      expect(state.cashflowGame.round).toBe(0);
      expect(state.cashflowGame.history).toHaveLength(0);
    });

    it('reports an error rather than throwing when there is nothing to undo', () => {
      started();
      const onError = jest.fn();
      service.undoLastPayday({ onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Nothing to undo'));
    });
  });
});
