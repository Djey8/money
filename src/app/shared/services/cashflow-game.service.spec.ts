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
    state.allGrowProjects = [];
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
      // Itemized starting transactions: Savings (0) + Salary (3000) to Income, Expense (-1800) from Daily —
      // net effect is the same savings + one month's cashflow as before (JFK, 2026-09-26).
      expect(state.allTransactions).toHaveLength(3);
      expect(state.allTransactions[0]).toMatchObject({
        account: 'Income',
        amount: 0,
        category: '@Savings',
      });
      expect(state.allTransactions[1]).toMatchObject({
        account: 'Income',
        amount: 3000,
        category: '@Salary',
      });
      expect(state.allTransactions[2]).toMatchObject({
        account: 'Daily',
        amount: -1800,
        category: '@Placeholder Expenses',
      });
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
      // starting transactions (3: Savings/Salary/Expense) + payday (2: salary + expenses) = 5;
      // the unrelated subscription created nothing
      expect(state.allTransactions).toHaveLength(5);
      expect(state.cashflowGame.round).toBe(1);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('undo removes exactly the payday transactions and rewinds the round', () => {
      started();
      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.allTransactions).toHaveLength(5);

      service.undoLastPayday({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allTransactions).toHaveLength(3); // only the starting transactions remain
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

  describe('planDeal / executeDeal / plannedDeals', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('planDeal only saves the Grow project — no money moves, and it shows up as a planned deal', () => {
      started();
      const onSuccess = jest.fn();
      service.planDeal(
        { kind: 'share', title: 'TestCo', quantity: 10, price: 100 },
        { onSuccess, onError: jest.fn() },
      );

      const state = AppStateService.instance;
      expect(onSuccess).toHaveBeenCalled();
      expect(state.allShares).toHaveLength(0);
      expect(state.allTransactions).toHaveLength(3); // only the starting transactions
      expect(state.allGrowProjects[0]).toMatchObject({
        title: 'TestCo',
        share: { tag: 'TestCo', quantity: 10, price: 100 },
      });
      expect(service.plannedDeals.map((p) => p.title)).toEqual(['TestCo']);
    });

    it('executeDeal buys the plan — real Grow project, Share, and Fire transaction, no longer "planned"', () => {
      started();
      service.planDeal(
        { kind: 'share', title: 'TestCo', quantity: 10, price: 100 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      const onSuccess = jest.fn();

      service.executeDeal('TestCo', { onSuccess, onError: jest.fn() });

      const state = AppStateService.instance;
      expect(onSuccess).toHaveBeenCalled();
      expect(state.allShares).toContainEqual({ tag: 'TestCo', quantity: 10, price: 100 });
      expect(state.allGrowProjects[0]).toMatchObject({ title: 'TestCo', amount: 1000 });
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({
          account: 'Fire',
          amount: -1000,
          category: '@TestCo',
          comment: 'Buy Share TestCo 10 x 100;',
        }),
      );
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
      expect(service.plannedDeals).toHaveLength(0); // bought — no longer just a plan
    });

    it('refuses to execute a title that was never planned', () => {
      started();
      const onError = jest.fn();
      service.executeDeal('Nope', { onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('plan it first'));
    });

    it('auto-borrows the rounded-up shortfall before completing a purchase it can’t otherwise afford', () => {
      started();
      // Cash is 1200 (starting cash); this share purchase costs 5000 — a 3800 shortfall, rounded up to a 4000 increment.
      service.planDeal(
        { kind: 'share', title: 'Expensive', quantity: 1, price: 5000 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.executeDeal('Expensive', { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.liabilities).toContainEqual(
        expect.objectContaining({ tag: 'Bank loan', amount: 4000 }),
      );
      expect(state.allSubscriptions).toContainEqual(
        expect.objectContaining({ title: 'Bank loan interest', amount: -400 }),
      );
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Fire', amount: -5000, category: '@Expensive' }),
      );
    });

    it('buys a property: deposit paid now, mortgage as a real Liability, cashflow as a real Subscription', () => {
      started();
      service.planDeal(
        { kind: 'investment', title: 'Villa', deposit: 1000, mortgage: 5000, cashflow: 600 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.executeDeal('Villa', { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allInvestments).toContainEqual({ tag: 'Villa', deposit: 1000, amount: 5000 });
      expect(state.liabilities).toContainEqual(
        expect.objectContaining({ tag: 'M-Villa', amount: 5000, investment: true }),
      );
      expect(state.allGrowProjects[0]).toMatchObject({ title: 'Villa', cashflow: 600 });
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Fire', amount: -1000, category: '@Villa' }),
      );
      // JFK, 2026-09-26: the cashflow must show up as a real Subscription, feeding every future Payday.
      expect(state.allSubscriptions).toContainEqual(
        expect.objectContaining({ title: 'Villa Cashflow', account: 'Income', amount: 600 }),
      );
    });

    it('buying more later just plans the extra amount and executes again, adding to the existing position', () => {
      started();
      service.planDeal(
        { kind: 'share', title: 'TestCo', quantity: 10, price: 100 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.executeDeal('TestCo', { onSuccess: jest.fn(), onError: jest.fn() });

      service.planDeal(
        { kind: 'share', title: 'TestCo', quantity: 5, price: 120 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.executeDeal('TestCo', { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allShares).toContainEqual({ tag: 'TestCo', quantity: 15, price: 120 });
    });

    it('refuses a deal whose title already exists as the other kind of Grow project', () => {
      started();
      service.planDeal(
        { kind: 'share', title: 'Ambiguous', quantity: 1, price: 10 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      const onError = jest.fn();
      service.planDeal(
        { kind: 'investment', title: 'Ambiguous', deposit: 100, mortgage: 0, cashflow: 0 },
        { onSuccess: jest.fn(), onError },
      );
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('different kind'));
    });
  });

  describe('cards: find, draw, apply', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('findCardsInDeck matches by title within the chosen deck only', () => {
      started();
      expect(service.findCardsInDeck('dealSmall', 'duplex')).toHaveLength(1);
      expect(service.findCardsInDeck('dealBig', 'duplex')).toHaveLength(0);
    });

    it('drawCard hands back a real card from that deck and persists the draw', () => {
      started();
      const onSuccess = jest.fn();
      service.drawCard('dealSmall', { onSuccess, onError: jest.fn() });

      expect(onSuccess).toHaveBeenCalled();
      const card = onSuccess.mock.calls[0][0];
      expect(['Placeholder Co. shares', 'Placeholder Duplex']).toContain(card.title);
      expect(AppStateService.instance.cashflowGame.drawnCardIds.dealSmall).toEqual([card.id]);
      expect(persistence.writeAndSync).toHaveBeenCalled();
    });

    it('drawCard reshuffles a single-card deck rather than erroring on the second draw', () => {
      started();
      const first = jest.fn();
      service.drawCard('dealBig', { onSuccess: first, onError: jest.fn() });
      const second = jest.fn();
      service.drawCard('dealBig', { onSuccess: second, onError: jest.fn() });

      expect(first.mock.calls[0][0].id).toBe(second.mock.calls[0][0].id);
    });

    it('applyDealCard plans a share card exactly as the manual form would', () => {
      started();
      const [shareCard] = service.findCardsInDeck('dealSmall', 'Placeholder Co.');

      service.applyDealCard(shareCard, { onSuccess: jest.fn(), onError: jest.fn() });

      const planned = service.plannedDeals.find((p) => p.title === 'Placeholder Co. shares');
      expect(planned?.share).toMatchObject({ quantity: 10, price: 100 });
    });

    it('applyDealCard plans an investment card with deposit/mortgage/cashflow', () => {
      started();
      const [investmentCard] = service.findCardsInDeck('dealSmall', 'Duplex');

      service.applyDealCard(investmentCard, { onSuccess: jest.fn(), onError: jest.fn() });

      const planned = service.plannedDeals.find((p) => p.title === 'Placeholder Duplex');
      expect(planned).toMatchObject({
        cashflow: 200,
        investment: { deposit: 1000, amount: 4000 },
      });
    });

    it('applyDoodadCard charges its cost once, from Daily, dated at the game’s virtual date', () => {
      started();
      const [doodad] = service.findCardsInDeck('doodad', 'gadget');
      const virtualDate = AppStateService.instance.cashflowGame.virtualDate;

      service.applyDoodadCard(doodad, { onSuccess: jest.fn(), onError: jest.fn() });

      expect(AppStateService.instance.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Daily', amount: -150, date: virtualDate }),
      );
    });
  });

  describe('resetGame', () => {
    it('wipes every real entity the game touched, and the game-meta state itself', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      service.planDeal(
        { kind: 'share', title: 'TestCo', quantity: 10, price: 100 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      const state = AppStateService.instance;
      expect(state.allTransactions.length).toBeGreaterThan(0);
      expect(state.allSubscriptions.length).toBeGreaterThan(0);
      expect(state.allGrowProjects.length).toBeGreaterThan(0);
      expect(state.liabilities.length).toBeGreaterThan(0);

      const onSuccess = jest.fn();
      service.resetGame({ onSuccess, onError: jest.fn() });

      expect(onSuccess).toHaveBeenCalled();
      expect(state.allTransactions).toEqual([]);
      expect(state.allSubscriptions).toEqual([]);
      expect(state.allGrowProjects).toEqual([]);
      expect(state.allShares).toEqual([]);
      expect(state.allInvestments).toEqual([]);
      expect(state.liabilities).toEqual([]);
      expect(state.cashflowGame.professionId).toBeNull();
      expect(state.cashflowGame.round).toBe(0);
      expect(state.cashflowGame.history).toEqual([]);
    });

    it('refuses on a non-cashflow account rather than wiping their real data', () => {
      ProfileComponent.mail = 'jfk@example.com';
      const onError = jest.fn();

      service.resetGame({ onSuccess: jest.fn(), onError });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Cashflow game account'));
      expect(persistence.batchWriteAndSync).not.toHaveBeenCalled();
    });
  });
});
