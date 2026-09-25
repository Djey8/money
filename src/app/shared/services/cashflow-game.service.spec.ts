import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

describe('CashflowGameService', () => {
  let service: CashflowGameService;
  let persistence: { batchWriteAndSync: jest.Mock; writeAndSync: jest.Mock };

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

    persistence = {
      batchWriteAndSync: jest.fn((config) => config.onSuccess()),
      writeAndSync: jest.fn((config) => config.onSuccess()),
    };
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
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Only the most recent Payday can be undone'),
      );
    });
  });

  describe('resolveBaby', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('adds a child and a scaled children-expense subscription, included from the next Payday', () => {
      started();
      service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.cashflowGame.children).toBe(1);
      expect(state.allSubscriptions).toHaveLength(3);
      const childExpense = state.allSubscriptions.find((s) =>
        s.title.includes('Children Expenses'),
      );
      expect(childExpense).toMatchObject({ account: 'Daily', amount: -60 });

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(state.allTransactions.some((t) => t.amount === -60)).toBe(true);
    });

    it('refuses a fourth child rather than throwing', () => {
      started();
      const onError = jest.fn();
      for (let i = 0; i < 3; i++) {
        service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });
      }
      service.resolveBaby({ onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('maximum of 3 children'));
    });
  });

  describe('resolveCharity and resolveDownsized', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('charity charges 10% of income and unlocks the dice choice for 3 rounds', () => {
      started();
      service.resolveCharity({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.cashflowGame.charityRoundsLeft).toBe(3);
      expect(state.allTransactions.some((t) => t.account === 'Daily' && t.amount === -300)).toBe(
        true,
      );
    });

    it('downsized charges total expenses once, and never blocks a later Payday', () => {
      // JFK, 2026-09-26: "it's not that you have to skip two salaries" — the
      // 2 rounds are the physical board's turn order, invisible to this tool.
      started();
      service.resolveDownsized({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.cashflowGame.unemployedRoundsLeft).toBe(2);
      const before = state.allTransactions.length;
      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(state.allTransactions.length).toBeGreaterThan(before);
      expect(state.cashflowGame.unemployedRoundsLeft).toBe(2); // untouched by Payday
    });
  });

  describe('clearStatus', () => {
    it('dismisses charity or unemployed independently, without touching finances', () => {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
      service.resolveCharity({ onSuccess: jest.fn(), onError: jest.fn() });
      service.resolveDownsized({ onSuccess: jest.fn(), onError: jest.fn() });
      const state = AppStateService.instance;
      const transactionsBefore = state.allTransactions.length;

      service.clearStatus('unemployed', { onSuccess: jest.fn(), onError: jest.fn() });

      expect(state.cashflowGame.unemployedRoundsLeft).toBe(0);
      expect(state.allTransactions).toHaveLength(transactionsBefore);
    });
  });

  describe('monthlyCashflow', () => {
    it('sums the game’s subscriptions — negative once expenses exceed income', () => {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
      expect(service.monthlyCashflow).toBe(1200); // salary 3000 - expenses 1800

      service.adjustBankLoan(15000, { onSuccess: jest.fn(), onError: jest.fn() });
      expect(service.monthlyCashflow).toBeLessThan(0);
    });
  });

  describe('adjustBankLoan', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('borrowing creates the liability and a 10% interest subscription', () => {
      started();
      service.adjustBankLoan(2000, { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.liabilities).toContainEqual(
        expect.objectContaining({ tag: 'Bank loan', amount: 2000 }),
      );
      const interest = state.allSubscriptions.find((s) => s.title === 'Bank loan interest');
      expect(interest).toMatchObject({ account: 'Daily', amount: -200 });
    });

    it('repaying in full removes the liability and the interest subscription', () => {
      started();
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      service.adjustBankLoan(-1000, { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
      expect(state.allSubscriptions.find((s) => s.title === 'Bank loan interest')).toBeUndefined();
    });

    it('reports an error rather than throwing for a non-increment amount', () => {
      started();
      const onError = jest.fn();
      service.adjustBankLoan(500, { onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('steps of'));
    });
  });
});
