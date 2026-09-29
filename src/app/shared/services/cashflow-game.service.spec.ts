import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

describe('CashflowGameService', () => {
  let service: CashflowGameService;
  let persistence: { batchWriteAndSync: jest.Mock; writeAndSync: jest.Mock };

  beforeEach(() => {
    (AppStateService as any)._instance = undefined;
    localStorage.clear(); // the undo stack now persists there — isolate each test from the last
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
      // Categorized (JFK, 2026-09-29+: "please fill in the correct Categories, currently Salary is
      // missing") and spread across the month rather than both dated today (decision 41).
      expect(state.allSubscriptions[0]).toMatchObject({
        account: 'Income',
        amount: 3000,
        category: '@Salary',
      });
      expect(state.allSubscriptions[1]).toMatchObject({
        account: 'Daily',
        amount: -1800,
        category: '@Placeholder Expenses',
      });
      expect(state.allSubscriptions.every((s) => s.comment.includes('#cashflow'))).toBe(true);
      // Only Savings posts immediately — Salary/Expenses become real transactions on the first
      // Payday instead, once the player has had a chance to edit their Subscriptions (JFK, 2026-09-29).
      expect(state.allTransactions).toHaveLength(1);
      expect(state.allTransactions[0]).toMatchObject({
        account: 'Income',
        amount: 0,
        category: '@Savings',
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('reports an error for an unknown profession rather than throwing', () => {
      const onError = jest.fn();
      service.pickProfession('placeholder', 'nope', { onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Unknown Cashflow profession'));
      expect(persistence.batchWriteAndSync).not.toHaveBeenCalled();
    });

    it('notifies pages holding their own snapshot instead of a live binding, without a page reload', () => {
      // JFK, 2026-09-26: "can we refresh just the tables, variables, values on the page" — Home and the
      // Subscriptions page (unlike Grow/Balance, which read AppStateService live) need an explicit nudge.
      const state = AppStateService.instance;
      const transactionsSpy = jest.fn();
      const subscriptionsSpy = jest.fn();
      state.transactionsUpdated$.subscribe(transactionsSpy);
      state.subscriptionsUpdated$.subscribe(subscriptionsSpy);

      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });

      expect(transactionsSpy).toHaveBeenCalledTimes(1);
      expect(subscriptionsSpy).toHaveBeenCalledTimes(1);
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
      // starting transaction (1: Savings) + payday (2: salary + expenses, for the first time —
      // decision 31) = 3; the unrelated subscription created nothing
      expect(state.allTransactions).toHaveLength(3);
      expect(state.cashflowGame.round).toBe(1);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('undo removes exactly the payday transactions and rewinds the round', () => {
      started();
      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.allTransactions).toHaveLength(3);

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allTransactions).toHaveLength(1); // only the starting transaction remains
      expect(state.cashflowGame.round).toBe(0);
      expect(state.cashflowGame.history).toHaveLength(0);
    });

    it('payday notifies transactionsUpdated$ but not subscriptionsUpdated$ — it never touches subscriptions', () => {
      started();
      const transactionsSpy = jest.fn();
      const subscriptionsSpy = jest.fn();
      AppStateService.instance.transactionsUpdated$.subscribe(transactionsSpy);
      AppStateService.instance.subscriptionsUpdated$.subscribe(subscriptionsSpy);

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(transactionsSpy).toHaveBeenCalledTimes(1);
      expect(subscriptionsSpy).not.toHaveBeenCalled();
    });

    it('reports an error rather than throwing when there is nothing to undo', () => {
      started();
      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() }); // undoes Start Game itself
      const onError = jest.fn();

      service.undoLastAction({ onSuccess: jest.fn(), onError });

      expect(onError).toHaveBeenCalledWith('Nothing to undo.');
    });
  });

  describe('payday date handling (todo/cashflow-game.md decisions 33/39/41)', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('a new profession’s Salary/Expense Subscriptions default to spread-out dates in the current month, not all dated today — JFK, 2026-09-29+: "spread out as before these transactions (salary on the first, tax on third ...)"', () => {
      started();

      const [salarySub, expenseSub] = AppStateService.instance.allSubscriptions;
      expect(salarySub.startDate).toBe('2026-09-01');
      expect(expenseSub.startDate).toBe('2026-09-03');
    });

    it("each transaction is dated from its own Subscription's startDate day, in the current real month", () => {
      started();

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      const [salaryTx, expenseTx] = state.allTransactions.slice(1);
      expect(salaryTx.date).toBe('2026-09-01');
      expect(expenseTx.date).toBe('2026-09-03');
    });

    it('the player controls the spread by editing a Subscription date — JFK, 2026-09-29: "the date we have there is what will be used, so the user can modify it"', () => {
      started();
      // The player moves the Salary subscription to the 20th before running the first real Payday.
      AppStateService.instance.allSubscriptions[0].startDate = '2026-01-20';

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      const [salaryTx, expenseTx] = state.allTransactions.slice(1);
      expect(salaryTx.date).toBe('2026-09-20');
      expect(expenseTx.date).toBe('2026-09-03'); // untouched — still its own startDate's day
    });

    it("clamps a Subscription day that doesn't exist in the current month to that month's actual last day", () => {
      started();
      // The player sets Salary to the 31st; Payday itself runs in a 30-day month.
      AppStateService.instance.allSubscriptions[0].startDate = '2026-01-31';
      jest.setSystemTime(new Date('2026-09-15T12:00:00Z')); // September has 30 days

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      const [salaryTx] = AppStateService.instance.allTransactions.slice(1);
      expect(salaryTx.date).toBe('2026-09-30');
    });

    it('shifts every existing #cashflow transaction back a month before posting the new round', () => {
      started();
      expect(AppStateService.instance.allTransactions[0].date).toBe('2026-09-15');

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      // The Savings transaction (already #cashflow-tagged) ages back a month.
      expect(AppStateService.instance.allTransactions[0].date).toBe('2026-08-15');
    });

    it('never shifts a transaction that isn’t part of the game', () => {
      started();
      AppStateService.instance.allTransactions.push({
        account: 'Daily',
        amount: -20,
        date: '2026-09-10',
        time: '',
        category: '@Coffee',
        comment: '',
      } as any);

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      const unrelated = AppStateService.instance.allTransactions.find(
        (t) => t.category === '@Coffee',
      );
      expect(unrelated?.date).toBe('2026-09-10');
    });

    it('undoing a Payday shifts everything else forward a month again', () => {
      started();
      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.allTransactions[0].date).toBe('2026-08-15');

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allTransactions).toHaveLength(1); // only Savings remains
      expect(state.allTransactions[0].date).toBe('2026-09-15'); // shifted back to where it started
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
      expect(childExpense).toMatchObject({
        account: 'Daily',
        amount: -60,
        category: '@Children Expenses',
      });

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(state.allTransactions.some((t) => t.amount === -60)).toBe(true);
    });

    it('gives a newly auto-created Subscription its own date, not overlapping the ones Payday already has — JFK, 2026-09-29+: "each transaction should have its own date in the month, if possible not overlapping"', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
      try {
        started(); // Salary → the 1st, Expenses → the 3rd (decision 41)
        service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });

        const childExpense = AppStateService.instance.allSubscriptions.find((s) =>
          s.title.includes('Children Expenses'),
        );
        expect(childExpense?.startDate).toBe('2026-09-05');
      } finally {
        jest.useRealTimers();
      }
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
      expect(interest).toMatchObject({ account: 'Daily', amount: -200, category: '@Bank loan' });
    });

    it('borrowing actually pays out — an income transaction credits the borrowed amount — JFK, 2026-09-29+: "when I take a loan with the loan button can you add an income transaction adding this amount to my balance"', () => {
      started();
      const before = AppStateService.instance.allTransactions.length;

      service.adjustBankLoan(2000, { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allTransactions).toHaveLength(before + 1);
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Daily', amount: 2000, category: '@Bank loan' }),
      );
    });

    it('repaying in full removes the liability and the interest subscription, and costs real cash', () => {
      started();
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      const before = AppStateService.instance.allTransactions.length;

      service.adjustBankLoan(-1000, { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
      expect(state.allSubscriptions.find((s) => s.title === 'Bank loan interest')).toBeUndefined();
      expect(state.allTransactions).toHaveLength(before + 1);
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Daily', amount: -1000, category: '@Bank loan' }),
      );
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
      expect(state.allTransactions).toHaveLength(1); // only the starting transaction (Savings)
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
      // Cash is 0 before the first Payday (decision 31) — the full 1000 cost is borrowed.
      expect(state.liabilities).toContainEqual(
        expect.objectContaining({ tag: 'Bank loan', amount: 1000 }),
      );
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
      // Cash is 0 before the first Payday (decision 31); this share purchase costs 5000 — a 5000
      // shortfall, already an exact multiple of the 1000 increment.
      service.planDeal(
        { kind: 'share', title: 'Expensive', quantity: 1, price: 5000 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.executeDeal('Expensive', { onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.liabilities).toContainEqual(
        expect.objectContaining({ tag: 'Bank loan', amount: 5000 }),
      );
      expect(state.allSubscriptions).toContainEqual(
        expect.objectContaining({ title: 'Bank loan interest', amount: -500 }),
      );
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Fire', amount: -5000, category: '@Expensive' }),
      );
      // The auto-borrow must actually pay out too — otherwise the purchase transaction alone would
      // have driven cash negative by the shortfall, an invisible version of the same bug the
      // standalone Borrow button had.
      expect(state.allTransactions).toContainEqual(
        expect.objectContaining({ account: 'Daily', amount: 5000, category: '@Bank loan' }),
      );
      expect(service.cash).toBe(0); // borrowed exactly the shortfall, spent exactly the shortfall
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
        expect.objectContaining({
          title: 'Villa Cashflow',
          account: 'Income',
          amount: 600,
          category: '@Villa',
        }),
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
        expect.objectContaining({
          account: 'Daily',
          amount: -150,
          date: virtualDate,
          category: '@Placeholder gadget',
        }),
      );
    });
  });

  describe('undoLastAction — reverts any action, not only Payday (todo/cashflow-game.md decision 40)', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('undoes a Baby exactly, restoring the pre-Baby Subscriptions and child count — JFK, 2026-09-29+: "I accidentally pressed the wrong button... we need to make sure we can revert each move"', () => {
      started();
      const before = JSON.stringify(AppStateService.instance.allSubscriptions);
      service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.cashflowGame.children).toBe(1);

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(AppStateService.instance.cashflowGame.children).toBe(0);
      expect(JSON.stringify(AppStateService.instance.allSubscriptions)).toBe(before);
    });

    it('undoes a bank loan borrow, removing the liability and interest subscription it added', () => {
      started();
      service.adjustBankLoan(2000, { onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.liabilities).toHaveLength(1);

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(AppStateService.instance.liabilities).toHaveLength(0);
      expect(
        AppStateService.instance.allSubscriptions.find((s) => s.title === 'Bank loan interest'),
      ).toBeUndefined();
    });

    it('does not leave a no-op entry behind when a bank loan action fails validation', () => {
      started();
      service.adjustBankLoan(500, { onSuccess: jest.fn(), onError: jest.fn() }); // not a valid increment, throws
      expect(service.canUndo).toBe(true); // only Start Game itself is on the stack

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() }); // undoes Start Game
      expect(service.canUndo).toBe(false);
    });

    it('undoes an executed Deal — the Share, Grow project, and Fire transaction all disappear', () => {
      started();
      service.planDeal(
        { kind: 'share', title: 'TestCo', quantity: 10, price: 100 },
        { onSuccess: jest.fn(), onError: jest.fn() },
      );
      service.executeDeal('TestCo', { onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.allShares).toHaveLength(1);

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(AppStateService.instance.allShares).toHaveLength(0);
      // The plan itself survives — undo only reverts executeDeal, the separate action that ran after it.
      expect(service.plannedDeals.map((p) => p.title)).toEqual(['TestCo']);
    });

    it('undoes a Reset, bringing every wiped entity back exactly as it was', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      started();
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      const beforeReset = JSON.stringify(AppStateService.instance.allSubscriptions);

      service.resetGame({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.cashflowGame.professionId).toBeNull();

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(AppStateService.instance.cashflowGame.professionId).toBe('placeholder-profession');
      expect(JSON.stringify(AppStateService.instance.allSubscriptions)).toBe(beforeReset);
    });

    it('walks back multiple actions in a row, one at a time, in reverse order', () => {
      started();
      service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() }); // 1 child
      service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() }); // 2 children

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.cashflowGame.children).toBe(1);

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.cashflowGame.children).toBe(0);
    });

    it('canUndo reflects whether anything is left to undo', () => {
      expect(service.canUndo).toBe(false);
      started();
      expect(service.canUndo).toBe(true);

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(service.canUndo).toBe(false);
    });
  });

  describe('undo stack persistence in localStorage (todo/cashflow-game.md decision 43)', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('a fresh service instance picks the stack back up from localStorage — survives a reload/npm start restart', () => {
      started();
      service.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(service.canUndo).toBe(true);

      // A page reload/dev-server restart creates a brand-new service instance from scratch.
      const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
      const reloaded = new CashflowGameService(persistence as any, incomeStatement);

      expect(reloaded.canUndo).toBe(true);
      reloaded.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });
      expect(AppStateService.instance.cashflowGame.children).toBe(0); // Baby really did get undone
    });

    it('clearPersistedUndoStack empties the in-memory stack and localStorage — JFK, 2026-09-29+: "when we logout we remove also this part for the localStorage. So logout login we dont have a history"', () => {
      started();
      expect(service.canUndo).toBe(true);
      expect(localStorage.getItem('cashflowUndoStack')).not.toBeNull();

      service.clearPersistedUndoStack();

      expect(service.canUndo).toBe(false);
      expect(localStorage.getItem('cashflowUndoStack')).toBeNull();
      // A fresh instance after "logout, login" must not pick anything back up either.
      const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
      const afterLogin = new CashflowGameService(persistence as any, incomeStatement);
      expect(afterLogin.canUndo).toBe(false);
    });

    it('starts empty rather than throwing when localStorage holds corrupt JSON', () => {
      localStorage.setItem('cashflowUndoStack', '{not valid json');

      const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
      const corrupted = new CashflowGameService(persistence as any, incomeStatement);

      expect(corrupted.canUndo).toBe(false);
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
