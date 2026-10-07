import { seededRng } from '@money/domain';
import { AppStateService } from './app-state.service';
import { CashflowGameService } from './cashflow-game.service';
import { IncomeStatementService } from './income-statement.service';
import { ProfileComponent } from '../../panels/profile/profile.component';

/**
 * Simulates the app's real en.json for the small set of generic (non-profession-specific) keys the
 * service resolves, so tests exercise the same interpolation production does; any other key (every
 * profession/expense/liability key, since no profession-specific translations are seeded here)
 * echoes back — same as ngx-translate's own `FallbackMissingTranslationHandler` — so that content
 * correctly falls back to game-sets.ts's own (German) strings, matching every existing test's
 * expectations (todo/cashflow-game.md decision 48).
 */
function noopTranslate(): { instant: jest.Mock } {
  const EN_DEFAULTS: Record<string, string> = {
    'CashflowGame.salary': 'Salary',
    'CashflowGame.savings': 'Savings',
    'CashflowGame.childrenExpenses': 'Children Expenses',
    'CashflowGame.salarySubscriptionTitle': '{{profession}} Salary',
    'CashflowGame.childrenExpensesSubscriptionTitle': '{{profession}} Children Expenses',
    'CashflowGame.savingsTransactionComment': '{{profession}} savings',
  };
  return {
    instant: jest.fn((key: string, params?: Record<string, string>) => {
      const template = EN_DEFAULTS[key];
      if (!template) return key;
      return params
        ? Object.entries(params).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), template)
        : template;
    }),
  };
}

describe('CashflowGameService', () => {
  let service: CashflowGameService;
  let persistence: { batchWriteAndSync: jest.Mock; writeAndSync: jest.Mock };
  let translate: { instant: jest.Mock };

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
    translate = noopTranslate();
    service = new CashflowGameService(persistence as any, incomeStatement, translate as any);
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

  describe('History: one line per undo step (todo/cashflow-game.md decision 59)', () => {
    const cb = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
    const started = () => {
      service.pickProfession('cashflow', 'hausmeister', cb());
      const state = AppStateService.instance;
      state.tier3BalanceLoaded = true;
      state.tier3GrowLoaded = true;
      return state;
    };

    it('lists every step newest first, each with what it did', () => {
      started();
      service.payday(cb());
      service.adjustBankLoan(1000, cb());

      expect(service.historySteps().map((step) => step.kind)).toEqual([
        'loanTaken',
        'payday',
        'start',
      ]);
    });

    it('numbers the steps 1, 2, 3... from the first thing that happened, newest on top', () => {
      started();
      service.payday(cb());
      service.adjustBankLoan(1000, cb());

      expect(service.historySteps().map((step) => step.number)).toEqual([3, 2, 1]);
    });

    it('names steps saved before tracking from what they changed - never "earlier"', () => {
      const state = started();
      service.payday(cb());
      service.adjustBankLoan(1000, cb());
      service.beforeGrowTrade('Buy Share OK4U 100 x 10;', 0, undefined, '@OK4U');
      state.allTransactions.push({
        account: 'Fire',
        amount: -1000,
        date: '2026-10-05',
        time: '',
        category: '@OK4U',
        comment: 'Buy Share OK4U 10 x 10;',
      });
      (service as any).undoStack.forEach((snapshot: any) => delete snapshot.step); // like an old save

      expect(service.historySteps().map((step) => step.kind)).toEqual([
        'buyShare',
        'loanTaken',
        'payday',
        'start',
      ]);
    });

    it('a Payday carries its whole month of income and expense lines', () => {
      const state = started();
      const before = state.allTransactions.length;
      service.payday(cb());

      const payday = service.historySteps().find((step) => step.kind === 'payday')!;
      expect(payday.transactions.length).toBeGreaterThan(5); // salary + every expense line
      expect(payday.transactions).toEqual(state.allTransactions.slice(before));
      expect(payday.detail).toContain('1'); // round 1
    });

    it("each line holds only its own step's transactions", () => {
      started();
      service.payday(cb());
      service.adjustBankLoan(1000, cb());

      const [loan, payday] = service.historySteps();
      expect(loan.transactions).toHaveLength(1);
      expect(loan.transactions[0].category).toBe('@Bank loan');
      expect(payday.transactions.some((t) => t.category === '@Bank loan')).toBe(false);
    });

    it('a Grow trade through the dialog is two steps when it needs a loan: the loan, then the trade', () => {
      started();
      service.beforeGrowTrade('Buy Share OK4U 250 x 10;', 0, undefined, '@OK4U');

      expect(service.historySteps().map((s) => [s.kind, s.detail.length > 0])).toEqual([
        ['buyShare', true],
        ['loanAuto', true],
        ['start', true],
      ]);
      expect(service.historySteps()[0].detail).toBe('OK4U');
    });

    it('names a payback and a plain dialog transaction', () => {
      started();
      service.beforeGrowTrade('Payback Liabilitie 4000 0;', 0, undefined, '@Autokredit');
      service.beforeGrowTrade('', 0, undefined, '@Food');

      const [plain, payback] = service.historySteps();
      expect(plain).toMatchObject({ kind: 'transaction', detail: 'Food' });
      expect(payback).toMatchObject({ kind: 'payoff', detail: 'Autokredit' });
    });

    it('undoSteps(n) goes back n steps at once, and the list shrinks with it', () => {
      const state = started();
      service.payday(cb());
      service.adjustBankLoan(1000, cb());
      const afterStart = service.historySteps().find((step) => step.kind === 'start')!;
      expect(afterStart).toBeDefined();

      service.undoSteps(2, cb()); // the loan and the Payday

      expect(service.historySteps().map((step) => step.kind)).toEqual(['start']);
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
      expect(state.cashflowGame.round).toBe(0);
    });

    describe('a saved game keeps its whole history (JFK, 2026-10-04)', () => {
      /** Plays a game, saves it the way the Save button does, then plays on and loads the saved copy. */
      function playSaveAndLoad() {
        const state = started();
        service.payday(cb());
        service.adjustBankLoan(2000, cb());
        service.payday(cb());
        const saved = {
          snapshot: service.captureGameSnapshot(),
          undo: JSON.parse(JSON.stringify(service.exportUndoChain())),
        };
        const stepsWhenSaved = service.historySteps().map((step) => step.kind);

        service.payday(cb()); // play on, so loading really brings the other game back
        service.restoreGameSnapshot(saved.snapshot, cb(), saved.undo);
        return { state, stepsWhenSaved };
      }

      it('brings the history back, so the list shows every move and not just the last', () => {
        const { stepsWhenSaved } = playSaveAndLoad();

        expect(stepsWhenSaved).toEqual(['payday', 'loanTaken', 'payday', 'start']);
        expect(service.historySteps().map((step) => step.kind)).toEqual(stepsWhenSaved);
        expect(service.canUndo).toBe(true);
      });

      it('lets every move be undone, back to before the game started', () => {
        const { state } = playSaveAndLoad();

        service.undoSteps(1, cb());
        expect(state.cashflowGame.round).toBe(1);
        service.undoSteps(1, cb()); // the loan
        expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
        service.undoSteps(2, cb()); // the first Payday and the start
        expect(state.cashflowGame.professionId).toBeNull();
        expect(service.canUndo).toBe(false);
      });

      it('keeps the saved slot of the game while stepping back past the first save', () => {
        const { state } = playSaveAndLoad();
        state.cashflowGame = { ...state.cashflowGame, gameId: 'g1', gameName: 'My game' };

        service.undoSteps(4, cb());

        expect(state.cashflowGame).toMatchObject({ gameId: 'g1', gameName: 'My game' });
      });

      it('survives a page reload: the stored history is read back', () => {
        started();
        service.payday(cb());
        const reloaded = new CashflowGameService(
          persistence as any,
          new IncomeStatementService({ saveData: jest.fn() } as any),
          translate as any,
        );
        expect(reloaded.historySteps().map((step) => step.kind)).toEqual(['payday', 'start']);
      });

      it('still reads a history stored in the older plain format', () => {
        started();
        service.payday(cb());
        const plain = (service as any).undoStack;
        localStorage.setItem('cashflowUndoStack', JSON.stringify(plain));
        const reloaded = new CashflowGameService(
          persistence as any,
          new IncomeStatementService({ saveData: jest.fn() } as any),
          translate as any,
        );
        expect(reloaded.historySteps()).toHaveLength(2);
      });

      it('loads a game saved without a history, starting with an empty one', () => {
        const state = started();
        service.payday(cb());
        const snapshot = service.captureGameSnapshot();

        service.restoreGameSnapshot(snapshot, cb());

        expect(service.canUndo).toBe(false);
        expect(state.cashflowGame.round).toBe(1);
      });
    });

    it('refuses when there is nothing left to undo', () => {
      const onError = jest.fn();
      service.undoSteps(1, { onSuccess: jest.fn(), onError });
      expect(onError).toHaveBeenCalledWith('Nothing to undo.');
    });
  });

  describe('paying a starting liability off ends its monthly expense (todo/cashflow-game.md decision 58)', () => {
    const started = () => {
      service.pickProfession('cashflow', 'hausmeister', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
      const state = AppStateService.instance;
      state.tier3BalanceLoaded = true;
      state.tier3GrowLoaded = true;
      return state;
    };
    const titles = () => AppStateService.instance.allSubscriptions.map((s) => s.title);

    it('removes the car-loan payment (Autokreditzahlung) once the Autokredit is gone', () => {
      const state = started();
      expect(titles()).toContain('Autokreditzahlung');
      state.liabilities = state.liabilities.filter((l) => l.tag !== 'Autokredit'); // what the Payback does

      const removed = service.removeExpenseForPaidLiability('Autokredit');

      expect(removed).toBe('Autokreditzahlung');
      expect(titles()).not.toContain('Autokreditzahlung');
      expect(state.cashflowGame.gameSubscriptionTitles).not.toContain('Autokreditzahlung');
      expect(titles()).toContain('Kreditkartenzahlung'); // the other debts' payments stay
    });

    it('does nothing while any of the liability is still owed, or when it has no expense', () => {
      const state = started();
      expect(service.removeExpenseForPaidLiability('Autokredit')).toBeNull(); // still in liabilities
      expect(titles()).toContain('Autokreditzahlung');

      state.liabilities.push({ tag: 'My own debt', amount: 5, investment: false, credit: 0 });
      state.liabilities = state.liabilities.filter((l) => l.tag !== 'My own debt');
      expect(service.removeExpenseForPaidLiability('My own debt')).toBeNull();
    });

    it('is one undoable move: Undo brings the debt and its expense back', () => {
      const state = started();
      const debtBefore = state.liabilities.find((l) => l.tag === 'Autokredit')!.amount;

      service.beforeGrowTrade('Payback Liabilitie 4000 0;'); // the Add dialog's undo snapshot
      state.liabilities = state.liabilities.filter((l) => l.tag !== 'Autokredit');
      service.removeExpenseForPaidLiability('Autokredit');
      expect(titles()).not.toContain('Autokreditzahlung');

      service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(titles()).toContain('Autokreditzahlung');
      expect(state.cashflowGame.gameSubscriptionTitles).toContain('Autokreditzahlung');
      expect(state.liabilities.find((l) => l.tag === 'Autokredit')!.amount).toBe(debtBefore);
    });

    it('paying the Bank loan off through the balance sheet ends its interest payment too', () => {
      const state = started();
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      expect(titles()).toContain('Bank loan interest');
      state.liabilities = state.liabilities.filter((l) => l.tag !== 'Bank loan');

      expect(service.removeExpenseForPaidLiability('Bank loan')).toBe('Bank loan interest');
      expect(titles()).not.toContain('Bank loan interest');
    });
  });

  describe('Payday ages every game transaction back, including Grow trades', () => {
    it('moves a tagged Add-dialog trade and an older untagged Grow trade back a month; leaves a plain entry alone', () => {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
      const state = AppStateService.instance;
      const base = { account: 'Fire', amount: -5000, time: '', category: '@GRO4US' };
      state.allTransactions.push(
        { ...base, date: '2026-10-15', comment: 'Buy Share GRO4US 100 x 50;\n#cashflow' },
        { ...base, date: '2026-10-15', comment: 'Buy Share GRO4US 100 x 50;' }, // before the tag existed
        { ...base, date: '2026-10-15', comment: 'my own note' },
      );

      service.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      const byComment = (c: string) => state.allTransactions.find((t) => t.comment === c)!;
      expect(byComment('Buy Share GRO4US 100 x 50;\n#cashflow').date).toBe('2026-09-15');
      expect(byComment('Buy Share GRO4US 100 x 50;').date).toBe('2026-09-15');
      expect(byComment('my own note').date).toBe('2026-10-15');
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

  describe('spacePreview (what Baby / Charity / Downsized are about to do)', () => {
    const started = () =>
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });

    it('Charity is 10% of the monthly income, Downsized all monthly expenses, and nothing is applied', () => {
      started();
      const before = JSON.stringify(AppStateService.instance.allTransactions);
      const subs = AppStateService.instance.allSubscriptions;
      const income = subs.filter((s) => s.amount > 0).reduce((sum, s) => sum + s.amount, 0);
      const expenses = subs.filter((s) => s.amount < 0).reduce((sum, s) => sum - s.amount, 0);

      expect(service.spacePreview('charity')!.amountMinor).toBe(Math.round(income * 100 * 0.1));
      expect(service.spacePreview('downsized')!.amountMinor).toBe(Math.round(expenses * 100));
      expect(JSON.stringify(AppStateService.instance.allTransactions)).toBe(before);
      expect(AppStateService.instance.cashflowGame.children).toBe(0);
    });

    it('Baby previews the child count and the monthly expense it adds, and is null at 3 children', () => {
      started();
      expect(service.spacePreview('baby')).toMatchObject({ children: 1 });
      expect(service.spacePreview('baby')!.amountMinor).toBeGreaterThan(0);

      AppStateService.instance.cashflowGame = {
        ...AppStateService.instance.cashflowGame,
        children: 3,
      };
      expect(service.spacePreview('baby')).toBeNull();
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

  describe('stock cards (todo/cashflow-game.md decision 52)', () => {
    const ok4u = {
      id: 'classic-small-ok4u-10',
      title: 'OK4U Pharma AG',
      assetKind: 'share' as const,
      symbol: 'OK4U',
      priceMinor: 1000,
      rangeMinMinor: 500,
      rangeMaxMinor: 3000,
    };
    const callbacks = () => ({ onSuccess: jest.fn(), onError: jest.fn() });

    beforeEach(() => {
      service.pickProfession('placeholder', 'placeholder-profession', callbacks());
    });

    it('plans a stock card under its ticker, carrying text, note and trading range into the Grow project', () => {
      service.applyDealCard(ok4u, callbacks(), {
        description: 'Delays.',
        note: 'Super deal',
        strategy: 'Range 5 - 30',
      });

      const project = AppStateService.instance.allGrowProjects[0];
      expect(project).toMatchObject({
        title: 'OK4U',
        description: 'Delays.',
        strategy: 'Range 5 - 30',
        share: { tag: 'OK4U', quantity: 0, price: 10 },
      });
      expect(project.notes.map((n) => n.text)).toEqual([
        'Super deal',
        '🏦 CashflowGame.noteCashShare',
      ]);
    });

    it('Classic ships 20 Small Deal stock cards (four securities at five prices) plus the EFH', () => {
      const classic = service.gameSets.find((set) => set.id === 'cashflow')!.decks!.dealSmall!;
      const stocks = classic.filter((card) => card.assetKind === 'share');
      expect(stocks).toHaveLength(20);
      expect(new Set(stocks.map((card) => card.symbol))).toEqual(
        new Set(['OK4U', 'ON2U', 'MYT4U', 'GRO4US']),
      );
      expect(new Set(classic.map((card) => card.id)).size).toBe(classic.length);
      expect(
        stocks.filter((card) => card.symbol === 'OK4U').map((card) => card.priceMinor),
      ).toEqual([500, 1000, 2000, 3000, 4000]);
      expect(classic.find((card) => card.symbol === 'EFH')).toMatchObject({
        assetKind: 'investment',
        depositMinor: 300000,
        mortgageMinor: 4700000,
        cashflowMinor: 10000,
      });
      const big = service.gameSets.find((set) => set.id === 'cashflow')!.decks!.dealBig!;
      expect(big).toHaveLength(36); // pizza + 10 MFH + 8 EFH + 5 DH + 4 APH + 8 businesses
      expect(big[0]).toMatchObject({
        symbol: 'PIZZA',
        depositMinor: 10000000,
        cashflowMinor: 500000,
      });
    });

    describe('date slots for one-off game transactions (todo/cashflow-game.md decision 56)', () => {
      const monthPrefix = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
      };
      const dayOf = (date: string) => Number(date.slice(-2));

      beforeEach(() => {
        // Start from a clean month: nothing dated, no game Subscriptions.
        const state = AppStateService.instance;
        state.allTransactions = [];
        state.allSubscriptions = [];
      });

      const addTransactionOn = (day: number) =>
        AppStateService.instance.allTransactions.push({
          account: 'Daily',
          amount: -1,
          date: `${monthPrefix()}${String(day).padStart(2, '0')}`,
          time: '',
          category: '',
          comment: '',
        });

      it('walks 1, 3, 5 ... 27, then 2, 4, 6 ... 28', () => {
        const days: number[] = [];
        for (let i = 0; i < 16; i++) {
          days.push(dayOf(service.nextGameTransactionDate()));
          addTransactionOn(days[i]);
        }
        expect(days).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 2, 4]);
      });

      it('after transactions on 1..13 the next one is the 15th', () => {
        [1, 3, 5, 7, 9, 11, 13].forEach(addTransactionOn);
        expect(dayOf(service.nextGameTransactionDate())).toBe(15);
      });

      it('counts a game Subscription by its day of the month even when it started in an earlier month', () => {
        AppStateService.instance.allSubscriptions.push({
          title: 'Taxes',
          account: 'Daily',
          amount: -1,
          startDate: '2025-01-01',
          endDate: '',
          category: '',
          comment: '#cashflow',
          frequency: 'monthly',
        });
        expect(dayOf(service.nextGameTransactionDate())).toBe(3);
      });

      it('a loan repayment is dated this real month, not the game calendar months ahead', () => {
        service.pickProfession('placeholder', 'placeholder-profession', callbacks());
        service.adjustBankLoan(1000, callbacks());
        service.adjustBankLoan(-1000, callbacks());

        const loanMoves = AppStateService.instance.allTransactions.filter((t) =>
          t.comment.toLowerCase().includes('loan'),
        );
        expect(loanMoves.length).toBeGreaterThanOrEqual(2);
        loanMoves.forEach((t) => expect(t.date.startsWith(monthPrefix())).toBe(true));
        expect(new Set(loanMoves.map((t) => t.date)).size).toBe(loanMoves.length); // own day each
      });
    });

    it('planning an investment leaves a note with cash on hand, the deposit and the bank loan needed', () => {
      service.applyDealCard(
        {
          id: 'x',
          title: 'Einfamilienhaus',
          assetKind: 'investment',
          symbol: 'EFH',
          depositMinor: 300000,
          mortgageMinor: 4700000,
          cashflowMinor: 10000,
        },
        callbacks(),
        {},
      );
      const notes = AppStateService.instance.allGrowProjects[0].notes.map((n) => n.text);
      expect(notes).toEqual(['🏦 CashflowGame.noteCashInvestment']);
      expect(translate.instant).toHaveBeenCalledWith(
        'CashflowGame.noteCashInvestment',
        expect.objectContaining({ loan: expect.stringContaining('3') }),
      );
    });

    describe('Bank loan on a Grow buy (todo/cashflow-game.md decisions 55/57)', () => {
      beforeEach(() => {
        // Balance sheet and Grow are loaded, as they are once the Grow page has been opened.
        const state = AppStateService.instance;
        state.tier3BalanceLoaded = true;
        state.tier3GrowLoaded = true;
      });
      const bankLoan = () =>
        AppStateService.instance.liabilities.find((l) => l.tag === 'Bank loan')?.amount;

      it('borrows the shortfall in loan steps as its own undo step, then the trade is a second one', () => {
        // The placeholder profession starts with no cash: a 2,500 buy needs a 3,000 loan.
        const trade = service.beforeGrowTrade('Buy Share OK4U 250 x 10;');

        expect(trade).toMatchObject({ borrowed: 3000, converted: false });
        expect(bankLoan()).toBe(3000);

        service.undoLastAction(callbacks()); // the (empty) trade step
        expect(bankLoan()).toBe(3000);
        service.undoLastAction(callbacks()); // the loan
        expect(bankLoan()).toBeUndefined();
      });

      it("takes the loan typed into the project's Loan field as a Bank loan and switches the dialog loan off", () => {
        service.applyDealCard(ok4u, callbacks(), {});
        const project = AppStateService.instance.allGrowProjects[0];
        project.liabilitie = { tag: 'OK4U', amount: 3000, credit: 0, investment: true } as any;

        const trade = service.beforeGrowTrade('Buy Share OK4U 250 x 10;', 3000);

        expect(trade).toMatchObject({ borrowed: 3000, converted: true });
        expect(bankLoan()).toBe(3000);
        expect(project.liabilitie).toBeNull(); // no per-project liability
      });

      it("books the loan first, on the dialog's date, and hands back the next free slot for the purchase", () => {
        const now = new Date();
        const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
        const state = AppStateService.instance;
        state.allTransactions = [];
        state.allSubscriptions = [];

        const trade = service.beforeGrowTrade('Buy Share GRO4US 100 x 50;', 0, `${prefix}13`);

        const loan = state.allTransactions.find((t) => t.comment.toLowerCase().includes('loan'));
        expect(loan!.date).toBe(`${prefix}13`);
        expect(trade.borrowed).toBeGreaterThan(0);
        // the loan's day is taken now, so the purchase lands after it
        expect(Number(trade.nextDate.slice(-2))).not.toBe(13);
        expect(trade.nextDate.startsWith(prefix)).toBe(true);
      });

      it('rounds a typed loan up to the loan step', () => {
        expect(service.beforeGrowTrade('Buy Share OK4U 10 x 10;', 1500).borrowed).toBe(2000);
      });

      it('takes no loan for a sell, or when there is nothing to buy', () => {
        expect(service.beforeGrowTrade('Sell Share OK4U 250 x 10;')).toMatchObject({
          borrowed: 0,
          converted: false,
        });
        expect(bankLoan()).toBeUndefined();
      });

      it('a Doodad payment (#doodad) borrows what cash is short, as its own step before the payment', () => {
        // No cash on the placeholder profession: a 7.500 kitchen needs a 8.000 loan in 1.000 steps.
        const trade = service.beforeGrowTrade(
          'Pay the kitchen\n#doodad',
          0,
          undefined,
          '@Home and household',
          7500,
        );

        expect(trade).toMatchObject({ borrowed: 8000, converted: false });
        expect(bankLoan()).toBe(8000);
        expect(service.historySteps()[0]).toMatchObject({
          kind: 'doodad',
          detail: 'Home and household',
        });
        expect(service.historySteps()[1]).toMatchObject({ kind: 'loanAuto' });
      });

      it('a Doodad payment the cash covers takes no loan', () => {
        AppStateService.instance.allTransactions.push({
          account: 'Daily',
          amount: 5000,
          date: '2026-01-01',
          time: '',
          category: '@Test',
          comment: '',
        });
        const trade = service.beforeGrowTrade('Coffee\n#doodad', 0, undefined, '@Home', 300);
        expect(trade.borrowed).toBe(0);
        expect(bankLoan()).toBeUndefined();
      });

      it('a plain comment without #doodad is never treated as a purchase, whatever the amount', () => {
        expect(service.beforeGrowTrade('Lunch', 0, undefined, '@Food', 9000).borrowed).toBe(0);
      });

      it('doodadLoanNote lists cash, cost and the loan the payment needs', () => {
        const note = service.doodadLoanNote(750000);
        expect(note.startsWith('🏦')).toBe(true);
        expect(note).toContain('noteCashDoodad');
      });

      it('borrows against the deposit of a Buy Investment, not its mortgage', () => {
        // EFH: 3,000 deposit -> one 3,000 step; the 47,000 mortgage is not borrowed from the bank.
        expect(service.beforeGrowTrade('Buy Investment EFH 3000 47000;').borrowed).toBe(3000);
      });

      it('does nothing while the balance sheet has not loaded (a snapshot of empty data could wipe it)', () => {
        AppStateService.instance.tier3BalanceLoaded = false;
        expect(service.beforeGrowTrade('Buy Share OK4U 250 x 10;').borrowed).toBe(0);
      });

      it('syncPlanNote fills the Loan field with the loan needed, and clears it when cash covers the buy', () => {
        service.applyDealCard(ok4u, callbacks(), {});
        const project = AppStateService.instance.allGrowProjects[0];
        expect(project.liabilitie).toBeNull(); // quantity not chosen yet

        project.share.quantity = 250; // 2,500 with no cash: the bank lends 3,000, the Loan field 2,500
        service.syncPlanNote(project);
        expect(project.liabilitie).toMatchObject({ tag: 'OK4U', amount: 2500 });
        expect(project.amount).toBe(0); // Grow's convention: Deposit = cost - Loan

        project.share.quantity = 0;
        service.syncPlanNote(project);
        expect(project.liabilitie).toBeNull();
      });
    });

    describe('market buyer cards (todo/cashflow-game.md decision 77)', () => {
      const previousMail = ProfileComponent.mail;
      beforeEach(() => (ProfileComponent.mail = 'player@cashflow.example'));
      afterEach(() => (ProfileComponent.mail = previousMail));
      const market = (id: string) =>
        service.gameSets
          .find((set) => set.id === 'cashflow')!
          .decks!.market!.find((card) => card.id === id)!;
      const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
      const efh = (tag: string, deposit: number, mortgage: number) => {
        const state = AppStateService.instance;
        state.allInvestments.push({ tag, deposit, amount: mortgage } as any);
        state.allGrowProjects.push({
          title: tag,
          sub: '',
          phase: 'execute',
          notes: [],
          investment: { tag, deposit, amount: mortgage },
        } as any);
      };
      const play = (id: string, labels = ['EFH', 'SFH']) => {
        const done = ok();
        service.playMarketCard(market(id), { title: 'Buyer', types: [{ labels }] }, done);
        return done;
      };

      it('ships the nine single-family buyers: five percentages and four fixed amounts', () => {
        const cards = service.gameSets
          .find((set) => set.id === 'cashflow')!
          .decks!.market!.filter((card) => card.sells?.family === 'EFH');
        expect(cards).toHaveLength(9);
        expect(
          cards.filter((card) => card.sells?.plusPercent).map((c) => c.sells!.plusPercent),
        ).toEqual([20, 20, 15, 10, 10]);
        expect(
          cards.filter((card) => card.sells?.plusMinor).map((c) => c.sells!.plusMinor! / 100),
        ).toEqual([20000, 15000, 10000, 5000]);
      });

      it('a percentage offer is on the original price: deposit + mortgage', () => {
        efh('EFH', 3000, 47000); // 50.000 in all
        const done = play('classic-market-efh-pct20-a');

        expect(done.onSuccess).toHaveBeenCalledWith(['EFH']);
        expect(service.marketSaleFor('EFH')).toMatchObject({
          salePrice: 60000,
          netCash: 13000, // sale 60.000 - mortgage 47.000: the 3.000 deposit back + the 10.000 profit
          label: '+20%',
        });
      });

      it('a fixed offer is the profit: the income is the deposit back plus that amount', () => {
        efh('EFH', 3000, 47000);
        play('classic-market-efh-amt20k');
        expect(service.marketSaleFor('EFH')).toMatchObject({ salePrice: 70000, netCash: 23000 });
      });

      it('every copy of the type gets its own offer (EFH, EFH-II), other types and gold none', () => {
        efh('EFH', 3000, 47000);
        efh('EFH-II', 5000, 60000);
        efh('ETW', 4000, 36000);
        AppStateService.instance.allAssets.push({ tag: 'GOLD', amount: 3000 } as any);

        const done = play('classic-market-efh-amt10k');

        expect(done.onSuccess).toHaveBeenCalledWith(['EFH', 'EFH-II']);
        expect(service.marketSaleFor('EFH-II')).toMatchObject({ salePrice: 75000, netCash: 15000 });
        expect(service.marketSaleFor('ETW')).toBeNull();
      });

      it('finds the type under the language label too (SFH in English, copies SFH-II)', () => {
        efh('SFH', 3000, 47000);
        efh('SFH-II', 3000, 47000);
        expect(play('classic-market-efh-pct10-a', ['EFH', 'SFH']).onSuccess).toHaveBeenCalledWith([
          'SFH',
          'SFH-II',
        ]);
      });

      it("writes the offer into the property's Grow project as one note, replaced by the next offer", () => {
        efh('EFH', 3000, 47000);
        play('classic-market-efh-pct10-a');
        play('classic-market-efh-pct20-a');

        const notes = AppStateService.instance.allGrowProjects[0].notes.filter((n) =>
          n.text.startsWith('💰'),
        );
        expect(notes).toHaveLength(1);
        expect(notes[0].text).toContain('noteMarketOffer');
        expect(service.marketSaleFor('EFH')!.salePrice).toBe(60000);
      });

      it('a card that does not apply says so by calling back with nobody - and is still a History step', () => {
        const done = play('classic-market-efh-pct20-a');

        expect(done.onSuccess).toHaveBeenCalledWith([]);
        expect(service.historySteps()[0]).toMatchObject({ kind: 'marketCard', detail: 'Buyer' });
        expect(AppStateService.instance.cashflowGame.marketOffers).toEqual([]);
      });

      it('playing the card is one undo step that takes the offers and notes away again', () => {
        efh('EFH', 3000, 47000);
        play('classic-market-efh-pct20-a');

        service.undoLastAction(ok());

        expect(service.marketSaleFor('EFH')).toBeNull();
        expect(AppStateService.instance.allGrowProjects[0].notes).toEqual([]);
      });

      it('the offer ends at the next Payday, with its note', () => {
        efh('EFH', 3000, 47000);
        play('classic-market-efh-pct20-a');

        service.payday(ok());

        expect(service.marketSaleFor('EFH')).toBeNull();
        expect(AppStateService.instance.allGrowProjects[0].notes).toEqual([]);
      });

      it('selling the property takes its offer with it', () => {
        efh('EFH', 3000, 47000);
        play('classic-market-efh-pct20-a');
        AppStateService.instance.allInvestments = []; // what the Add dialog's Sell Investment does

        service.setPhaseAfterTrade('EFH', 'sell');

        expect(AppStateService.instance.cashflowGame.marketOffers).toEqual([]);
      });

      describe('apartment and multi-family buyers (same profit rule as the single-family ones)', () => {
        const types = [{ labels: ['MFH4', 'APT4'] }, { labels: ['MFH8', 'APT8'] }];
        const playApt = (id: string) => {
          const done = ok();
          service.playMarketCard(market(id), { title: 'Buyer', types }, done);
          return done;
        };

        it('ships ten buyers: four percentages and six fixed amounts, for apartment buildings only', () => {
          const cards = service.gameSets
            .find((set) => set.id === 'cashflow')!
            .decks!.market!.filter((card) => card.sells?.family === 'MFH');
          expect(cards).toHaveLength(10);
          expect(
            cards.filter((c) => c.sells!.plusMinor).map((c) => c.sells!.plusMinor! / 100),
          ).toEqual([30000, 20000, 15000, 10000, 5000, 1000]);
          expect(cards[0].sells!.symbols).toEqual(['MFH4', 'MFH8']);
        });

        it('a fixed amount is the profit once per building, however many units it has', () => {
          efh('APT8', 40000, 240000);
          efh('APT4', 15000, 225000);
          playApt('classic-market-mfh-amt5k');

          // sale = original price + 5.000; the mortgage is paid back: deposit + 5.000 is left
          expect(service.marketSaleFor('APT8')).toMatchObject({
            salePrice: 285000,
            netCash: 45000,
            label: '+5.000 €',
          });
          expect(service.marketSaleFor('APT4')!.netCash).toBe(20000);
        });

        it('a percentage is on the full cost (deposit + mortgage)', () => {
          efh('APT8', 40000, 240000); // 280.000 in all
          playApt('classic-market-mfh-pct10');
          expect(service.marketSaleFor('APT8')).toMatchObject({
            salePrice: 308000,
            netCash: 68000,
          });
        });

        it('does not touch single-family homes, semi-detached houses, condos or apartment complexes', () => {
          efh('SFH', 3000, 47000);
          efh('SDH', 12000, 260000);
          efh('CPX24', 75000, 575000);
          expect(playApt('classic-market-mfh-amt5k').onSuccess).toHaveBeenCalledWith([]);
        });
      });

      describe('condo and apartment-complex buyers (a price, not a profit)', () => {
        const ok2 = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
        const playWith = (id: string, types: { labels: string[]; units?: number }[]) => {
          const done = ok2();
          service.playMarketCard(market(id), { title: 'Buyer', types }, done);
          return done;
        };
        const condo = [{ labels: ['ETW', 'CONDO'] }];
        const complex = [
          { labels: ['APH24', 'CPX24'], units: 24 },
          { labels: ['APH12', 'CPX12'], units: 12 },
        ];

        it('ships two condo buyers and four complex buyers', () => {
          const cards = service.gameSets.find((set) => set.id === 'cashflow')!.decks!.market!;
          expect(cards.filter((card) => card.sells?.family === 'ETW')).toHaveLength(2);
          expect(
            cards
              .filter((card) => card.sells?.family === 'APH')
              .map((c) => c.sells!.pricePerUnitMinor! / 100),
          ).toEqual([45000, 25000, 40000, 30000]);
        });

        it('a condo sells for the fixed price: the income is that price less the mortgage', () => {
          efh('ETW', 5000, 50000);
          playWith('classic-market-etw-65k', condo);
          expect(service.marketSaleFor('ETW')).toMatchObject({
            salePrice: 65000,
            netCash: 15000,
            label: '65.000 €',
          });
        });

        it('a price below the mortgage is a loss you pay out of your own pocket', () => {
          efh('ETW', 5000, 50000);
          playWith('classic-market-etw-45k', condo);
          expect(service.marketSaleFor('ETW')!.netCash).toBe(-5000);
          expect(AppStateService.instance.allGrowProjects[0].notes[0].text).toContain(
            'noteMarketOfferLoss',
          );
        });

        it('a complex sells for the price per unit times its units, less the mortgage', () => {
          efh('CPX24', 75000, 575000);
          efh('CPX12', 50000, 300000);
          playWith('classic-market-aph-45k', complex);

          expect(service.marketSaleFor('CPX24')).toMatchObject({
            salePrice: 1080000, // 24 x 45.000
            netCash: 505000, // less the 575.000 mortgage
            label: '45.000 € × 24',
          });
          expect(service.marketSaleFor('CPX12')!.netCash).toBe(240000); // 540.000 - 300.000
        });

        it('leaves apartment buildings, single-family homes and condos out of a complex buyer', () => {
          efh('APT8', 40000, 240000);
          efh('SFH', 3000, 47000);
          efh('ETW', 5000, 50000);
          expect(playWith('classic-market-aph-25k', complex).onSuccess).toHaveBeenCalledWith([]);
        });

        it('a sale at a loss takes a Bank loan first when cash is short, as its own step', () => {
          // Balance sheet and Grow are loaded, as they are once the Grow page has been opened.
          AppStateService.instance.tier3BalanceLoaded = true;
          AppStateService.instance.tier3GrowLoaded = true;
          const trade = service.beforeGrowTrade(
            'Sell Investment ETW 5000 50000;',
            0,
            undefined,
            '@ETW',
            5000,
          );

          expect(trade.borrowed).toBe(5000);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'sellInvestment' });
          expect(service.historySteps()[1]).toMatchObject({ kind: 'loanAuto' });
        });

        it('a normal sale (money coming in) takes no loan', () => {
          AppStateService.instance.tier3BalanceLoaded = true;
          AppStateService.instance.tier3GrowLoaded = true;
          expect(
            service.beforeGrowTrade('Sell Investment ETW 5000 50000;', 0, undefined, '@ETW', 0)
              .borrowed,
          ).toBe(0);
        });
      });

      describe('gold buyers (cash for every coin)', () => {
        const goldTypes = [{ labels: ['GOLD'] }];
        const ok3 = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
        const ownGold = (title: string, coins: number, costMinor: number) => {
          const state = AppStateService.instance;
          state.allAssets.push({ tag: title, amount: costMinor / 100 } as any);
          state.allGrowProjects.push({
            title,
            sub: '',
            phase: 'execute',
            notes: [],
            isAsset: true,
          } as any);
          state.cashflowGame = {
            ...state.cashflowGame,
            assetDeals: [
              ...(state.cashflowGame.assetDeals ?? []),
              { title, coins, costMinor, stage: 'owned' },
            ],
          };
        };
        const playGold = (id: string) => {
          const done = ok3();
          service.playMarketCard(market(id), { title: 'Buyer', types: goldTypes }, done);
          return done;
        };

        it('ships three gold buyers: 1.000, 1.000 and 2.000 for every coin', () => {
          const cards = service.gameSets
            .find((set) => set.id === 'cashflow')!
            .decks!.market!.filter((card) => card.sells?.family === 'GOLD');
          expect(cards.map((card) => card.sells!.pricePerCoinMinor! / 100)).toEqual([
            1000, 1000, 2000,
          ]);
        });

        it('offers the price for every coin owned and writes it into the gold project', () => {
          ownGold('GOLD', 10, 300000);
          const done = playGold('classic-market-gold-central-2k');

          expect(done.onSuccess).toHaveBeenCalledWith(['GOLD']);
          expect(service.marketSaleFor('GOLD')).toMatchObject({
            salePrice: 20000,
            netCash: 20000,
            pricePerCoin: 2000,
            coins: 10,
          });
          expect(AppStateService.instance.allGrowProjects[0].notes[0].text).toContain(
            'noteMarketOfferCoins',
          );
        });

        it('every gold project gets its own total (GOLD, GOLD-II)', () => {
          ownGold('GOLD', 10, 300000);
          ownGold('GOLD-II', 5, 100000);
          playGold('classic-market-gold-collector-1k');

          expect(service.marketSaleFor('GOLD')!.netCash).toBe(10000);
          expect(service.marketSaleFor('GOLD-II')!.netCash).toBe(5000);
        });

        it('the total follows the coins still owned after a partial sale', () => {
          ownGold('GOLD', 10, 300000);
          playGold('classic-market-gold-collector-1k');
          service.sellCoins('GOLD', 4, 1000);

          expect(service.marketSaleFor('GOLD')).toMatchObject({ coins: 6, netCash: 6000 });
        });

        it('selling the last coin takes the offer away', () => {
          ownGold('GOLD', 2, 60000);
          playGold('classic-market-gold-collector-1k');
          service.sellCoins('GOLD', 2, 1000);
          service.afterAssetSell('GOLD');
          AppStateService.instance.allAssets = [];
          service.setPhaseAfterTrade('GOLD', 'sell');

          expect(service.marketSaleFor('GOLD')).toBeNull();
        });

        it('does not apply without gold, and ignores properties', () => {
          efh('SFH', 3000, 47000);
          expect(playGold('classic-market-gold-collector-1k').onSuccess).toHaveBeenCalledWith([]);
        });
      });

      describe('cost cards (tenant damage, broken pipe) for property owners', () => {
        const propertyTypes = ['EFH', 'SFH', 'ETW', 'CONDO', 'APT4', 'APT8', 'SDH', 'CPX24'].map(
          (label) => ({ labels: [label] }),
        );
        const payCard = (id: string) => {
          const calls: (string | null)[] = [];
          service.playMarketCostCard(
            market(id),
            { title: 'Tenant', types: propertyTypes },
            { onSuccess: (property) => calls.push(property), onError: jest.fn() },
          );
          return calls;
        };

        it('ships five cost cards: tenant 1.000 / 500 / 500 and pipe 1.000 / 2.000', () => {
          const cards = service.gameSets
            .find((set) => set.id === 'cashflow')!
            .decks!.market!.filter((card) => card.pays);
          expect(cards.map((card) => card.pays!.costMinor / 100)).toEqual([
            1000, 500, 500, 1000, 2000,
          ]);
        });

        it('without a property the card does not apply (and the play is still a History step)', () => {
          expect(payCard('classic-market-cost-pipe-1k')).toEqual([null]);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'marketCard', detail: 'Tenant' });
        });

        it('a business is not a property', () => {
          const state = AppStateService.instance;
          state.allInvestments.push({ tag: 'PIZZA', deposit: 1000, amount: 9000 } as any);
          expect(payCard('classic-market-cost-pipe-1k')).toEqual([null]);
        });

        it('with properties it hands back the first one you own and books nothing yet', () => {
          efh('SFH', 3000, 47000);
          efh('APT8', 40000, 240000);
          const transactions = AppStateService.instance.allTransactions.length;

          expect(payCard('classic-market-cost-tenant-500-a')).toEqual(['SFH']);

          expect(AppStateService.instance.allTransactions).toHaveLength(transactions);
          expect(service.historySteps()[0]?.kind).not.toBe('marketCard');
        });

        it('the payment (#market) takes a Bank loan when cash is short and is one "Market card paid" step', () => {
          AppStateService.instance.tier3BalanceLoaded = true;
          AppStateService.instance.tier3GrowLoaded = true;

          const trade = service.beforeGrowTrade(
            'Pipe broke\n\n#market',
            0,
            undefined,
            '@SFH',
            2000,
          );

          expect(trade.borrowed).toBe(2000);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'marketCost', detail: 'SFH' });
          expect(service.historySteps()[1]).toMatchObject({ kind: 'loanAuto' });
        });

        it('a card without a cost is refused', () => {
          const onError = jest.fn();
          service.playMarketCostCard(
            { id: 'x', title: 'Text only', description: '' },
            { types: [] },
            { onSuccess: jest.fn(), onError },
          );
          expect(onError).toHaveBeenCalled();
        });
      });

      describe('stock split cards (dice: 1-3 doubles, 4-6 halves)', () => {
        const ownShare = (tag: string, quantity: number) => {
          const state = AppStateService.instance;
          state.allShares.push({ tag, quantity, price: 12 } as any);
          state.allGrowProjects.push({
            title: tag,
            sub: '',
            phase: 'execute',
            notes: [],
            share: { tag, quantity, price: 12 },
          } as any);
        };
        const playSplit = (id: string, labels: string[]) => {
          const calls: (string | null)[] = [];
          service.playShareSplitCard(
            market(id),
            { title: 'Split', labels },
            { onSuccess: (share) => calls.push(share), onError: jest.fn() },
          );
          return calls;
        };

        it('ships one split card per ticker', () => {
          const cards = service.gameSets
            .find((set) => set.id === 'cashflow')!
            .decks!.market!.filter((card) => card.splits);
          expect(cards.map((card) => card.splits!.symbol)).toEqual([
            'OK4U',
            'MYT4U',
            'GRO4US',
            'ON2U',
          ]);
        });

        it('without the share it does not apply (and the play is a History step)', () => {
          ownShare('MYT4U', 10);
          expect(playSplit('classic-market-split-ok4u', ['OK4U'])).toEqual([null]);
          expect(service.openDecisions).toHaveLength(0);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'marketCard' });
        });

        it('with the share a dice decision opens - and nothing changes yet', () => {
          ownShare('OK4U', 50);
          const opened = jest.fn();
          service.decisionNeeded$.subscribe(opened);

          expect(playSplit('classic-market-split-ok4u', ['OK4U'])).toEqual(['OK4U']);

          expect(service.openDecisions.map((d) => d.split?.shareTag)).toEqual(['OK4U']);
          expect(opened).toHaveBeenCalled();
          expect(AppStateService.instance.allShares[0].quantity).toBe(50);
        });

        it('1-3 doubles the quantity: 50 shares become 100, at the same price', () => {
          ownShare('OK4U', 50);
          playSplit('classic-market-split-ok4u', ['OK4U']);

          service.resolveGamble(
            'SPLIT-OK4U',
            { won: true, roll: 2 },
            { onSuccess: jest.fn(), onError: jest.fn() },
          );

          const share = AppStateService.instance.allShares[0];
          expect(share).toMatchObject({ quantity: 100, price: 12 });
          expect(AppStateService.instance.allGrowProjects[0].share!.quantity).toBe(100);
          expect(AppStateService.instance.allGrowProjects[0].notes.at(-1)!.text).toContain(
            'splitDouble',
          );
          expect(service.openDecisions).toHaveLength(0);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'shareSplit' });
        });

        it('4-6 halves it: 50 shares become 25 (an odd count keeps the larger half)', () => {
          ownShare('OK4U', 50);
          ownShare('GRO4US', 7);
          playSplit('classic-market-split-ok4u', ['OK4U']);
          service.resolveGamble(
            'SPLIT-OK4U',
            { won: false, roll: 5 },
            { onSuccess: jest.fn(), onError: jest.fn() },
          );
          playSplit('classic-market-split-gro4us', ['GRO4US']);
          service.resolveGamble(
            'SPLIT-GRO4US',
            { won: false, roll: 4 },
            { onSuccess: jest.fn(), onError: jest.fn() },
          );

          expect(AppStateService.instance.allShares.map((s) => s.quantity)).toEqual([25, 4]);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'shareReverseSplit' });
        });

        it('the roll is one undo step that gives the old quantity back', () => {
          ownShare('OK4U', 50);
          playSplit('classic-market-split-ok4u', ['OK4U']);
          service.resolveGamble(
            'SPLIT-OK4U',
            { won: true, roll: 1 },
            { onSuccess: jest.fn(), onError: jest.fn() },
          );

          service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

          expect(AppStateService.instance.allShares[0].quantity).toBe(50);
          expect(service.openDecisions).toHaveLength(1);
        });
      });

      describe('cashflow boost cards (small business boom, new management system)', () => {
        const ownInvestment = (tag: string, cashflow: number) => {
          const state = AppStateService.instance;
          state.allInvestments.push({ tag, deposit: 3000, amount: 47000 } as any);
          state.allGrowProjects.push({
            title: tag,
            sub: '',
            phase: 'execute',
            notes: [],
            cashflow,
            investment: { tag, deposit: 3000, amount: 47000 },
          } as any);
        };
        const playBoost = (id: string, businessLabels?: string[]) => {
          const calls: { title: string; from: number; to: number }[][] = [];
          service.playBoostCard(
            market(id),
            { title: 'Boom', businessLabels },
            { onSuccess: (changed) => calls.push(changed), onError: jest.fn() },
          );
          return calls[0];
        };

        it('ships the two star cards: up to 1.000 gains 250, up to 2.000 gains 400', () => {
          const cards = service.gameSets
            .find((set) => set.id === 'cashflow')!
            .decks!.market!.filter((card) => card.boost);
          expect(
            cards.map((card) => [card.boost!.maxCashflowMinor / 100, card.boost!.addMinor / 100]),
          ).toEqual([
            [1000, 250],
            [2000, 400],
          ]);
          expect(cards.every((card) => card.star)).toBe(true);
        });

        it('raises the cashflow of every investment at or under the limit - project, subscription and a note', () => {
          ownInvestment('SFH', 300);
          ownInvestment('APT4', 1000); // exactly the limit counts
          ownInvestment('CPX24', 3600); // over the limit
          ownInvestment('SDH', 0); // pays nothing: nothing to boost

          const changed = playBoost('classic-market-boost-small-250');

          expect(changed).toEqual([
            { title: 'SFH', from: 300, to: 550 },
            { title: 'APT4', from: 1000, to: 1250 },
          ]);
          const projects = AppStateService.instance.allGrowProjects;
          expect(projects.map((p) => p.cashflow)).toEqual([550, 1250, 3600, 0]);
          expect(projects[0].notes[0].text).toContain('noteMarketBoost');
          const subscription = AppStateService.instance.allSubscriptions.find(
            (sub) => sub.title === 'SFH Cashflow',
          );
          expect(subscription!.amount).toBe(550);
        });

        it('the 400 card reaches up to 2.000', () => {
          ownInvestment('AU', 1600);
          ownInvestment('AWA', 2500);
          expect(playBoost('classic-market-boost-mgmt-400')!.map((c) => c.title)).toEqual(['AU']);
        });

        it('with no investment that qualifies it does not apply, and is still a History step', () => {
          expect(playBoost('classic-market-boost-small-250')).toEqual([]);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'marketCard', detail: 'Boom' });
        });

        it('can be limited to businesses by their labels', () => {
          ownInvestment('SFH', 300);
          ownInvestment('GP', 800);
          expect(playBoost('classic-market-boost-small-250', ['GP'])!.map((c) => c.title)).toEqual([
            'GP',
          ]);
        });

        it('undo takes the boost, its note and the subscription change away', () => {
          ownInvestment('SFH', 300);
          playBoost('classic-market-boost-small-250');

          service.undoLastAction({ onSuccess: jest.fn(), onError: jest.fn() });

          expect(AppStateService.instance.allGrowProjects[0].cashflow).toBe(300);
          expect(AppStateService.instance.allGrowProjects[0].notes).toEqual([]);
        });
      });

      it('a market card without an offer to play is refused', () => {
        const onError = jest.fn();
        service.playMarketCard(
          { id: 'x', title: 'Text only', description: '' },
          { types: [] },
          { onSuccess: jest.fn(), onError },
        );
        expect(onError).toHaveBeenCalled();
      });
    });

    describe('a drawn stock card sets the market price (todo/cashflow-game.md decision 79)', () => {
      const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
      const cardAt = (priceMinor: number) =>
        ({ ...ok4u, id: `ok4u-${priceMinor}`, priceMinor }) as typeof ok4u;

      it('only a share you still hold counts - planned or sold-out ones are not touched', () => {
        const state = AppStateService.instance;
        expect(service.heldShareProjectFor('OK4U')).toBeUndefined();
        service.applyDealCard(ok4u, ok(), {});
        expect(service.shareProjectFor('OK4U')?.title).toBe('OK4U');
        expect(service.heldShareProjectFor('OK4U')).toBeUndefined(); // planned only

        state.allShares.push({ tag: 'OK4U', quantity: 50, price: 10 } as any);
        expect(service.heldShareProjectFor('OK4U')?.title).toBe('OK4U');

        state.allShares[0].quantity = 0; // everything sold, at whatever price
        expect(service.heldShareProjectFor('OK4U')).toBeUndefined();
      });

      it('sets the price on the project and the held share, keeps quantity and phase, and notes it', () => {
        const state = AppStateService.instance;
        service.applyDealCard(ok4u, ok(), {});
        const project = state.allGrowProjects[0];
        project.status = 'bought';
        project.phase = 'execute';
        state.allShares.push({ tag: 'OK4U', quantity: 50, price: 10 } as any);
        const done = ok();

        service.updateSharePrice(cardAt(500), { description: 'Trials begin.' }, done);

        expect(done.onSuccess).toHaveBeenCalledWith('OK4U');
        expect(state.allShares[0]).toMatchObject({ quantity: 50, price: 5 });
        expect(project.share).toMatchObject({ price: 5 });
        expect(project).toMatchObject({ phase: 'execute', status: 'bought' });
        const note = project.notes.at(-1)!.text;
        expect(note).toContain('notePriceDown');
        expect(note).toContain('Trials begin.');
        expect(service.historySteps()[0]).toMatchObject({ kind: 'priceUpdate' });
      });

      it('a higher price is a rise', () => {
        service.applyDealCard(cardAt(500), ok(), {});
        AppStateService.instance.allShares.push({ tag: 'OK4U', quantity: 5, price: 5 } as any);
        service.updateSharePrice(cardAt(2500), {}, ok());
        expect(AppStateService.instance.allGrowProjects[0].notes.at(-1)!.text).toContain(
          'notePriceUp',
        );
      });

      it('a share sold out (or never bought) is left alone: the card is planned instead', () => {
        const state = AppStateService.instance;
        service.applyDealCard(cardAt(1000), ok(), {});
        const transactions = state.allTransactions.length;
        const onError = jest.fn();

        service.updateSharePrice(cardAt(800), {}, { onSuccess: jest.fn(), onError });

        expect(onError).toHaveBeenCalled();
        expect(state.allGrowProjects[0].share!.price).toBe(10);
        expect(state.allTransactions).toHaveLength(transactions);
      });

      it('is one undo step that gives the old price back', () => {
        const state = AppStateService.instance;
        service.applyDealCard(ok4u, ok(), {});
        state.allShares.push({ tag: 'OK4U', quantity: 50, price: 10 } as any);

        service.updateSharePrice(cardAt(500), {}, ok());
        service.undoLastAction(ok());

        expect(state.allShares[0].price).toBe(10);
        expect(state.allGrowProjects[0].share!.price).toBe(10);
      });

      it('refuses when there is no project yet - that card is planned instead', () => {
        const onError = jest.fn();
        service.updateSharePrice(cardAt(500), {}, { onSuccess: jest.fn(), onError });
        expect(onError).toHaveBeenCalled();
      });
    });

    describe('investment cards (todo/cashflow-game.md decision 54)', () => {
      const efh = {
        id: 'classic-small-efh',
        title: 'Einfamilienhaus',
        assetKind: 'investment' as const,
        symbol: 'EFH',
        depositMinor: 300000,
        mortgageMinor: 4700000,
        cashflowMinor: 10000,
      };

      it('every copy of a card is its own Grow deal: EFH, EFH-II, EFH-III (no spaces in the label)', () => {
        const titles: string[] = [];
        for (let i = 0; i < 3; i++) {
          service.applyDealCard(efh, { onSuccess: (t) => titles.push(t), onError: jest.fn() }, {});
        }
        expect(titles).toEqual(['EFH', 'EFH-II', 'EFH-III']);
        const projects = AppStateService.instance.allGrowProjects;
        expect(projects.map((p) => p.title)).toEqual(titles);
        expect(projects[1]).toMatchObject({
          cashflow: 100,
          investment: { tag: 'EFH-II', deposit: 3000, amount: 47000 },
        });
      });

      it('names the project with the label of the language picked for the game: SFH, SFH-II', () => {
        const titles: string[] = [];
        for (let i = 0; i < 2; i++) {
          service.applyDealCard(
            efh,
            { onSuccess: (t) => titles.push(t), onError: jest.fn() },
            { symbol: 'SFH' },
          );
        }
        expect(titles).toEqual(['SFH', 'SFH-II']);
        expect(AppStateService.instance.allGrowProjects.map((p) => p.title)).toEqual(titles);
      });

      it('a card sale is named with that label too', () => {
        service.pickProfession('placeholder', 'placeholder-profession', callbacks());
        service.sellCardToFriend(efh, 500, callbacks(), 'SFH');
        expect(
          AppStateService.instance.allTransactions.some((t) => t.category === '@SFH card sale'),
        ).toBe(true);
      });

      it('carries the card text and cost breakdown into the project description', () => {
        service.applyDealCard(efh, callbacks(), { description: 'Card text\n\nKosten: 50.000' });
        expect(AppStateService.instance.allGrowProjects[0].description).toContain('Kosten');
      });

      it('registerInvestmentIncome creates the monthly Subscription AND lists it for Payday', () => {
        service.applyDealCard(efh, callbacks(), {});
        const state = AppStateService.instance;

        service.registerInvestmentIncome('EFH');

        expect(state.allSubscriptions).toContainEqual(
          expect.objectContaining({
            title: 'EFH Cashflow',
            account: 'Income',
            amount: 100,
            frequency: 'monthly',
            category: '@EFH',
          }),
        );
        expect(state.cashflowGame.gameSubscriptionTitles).toContain('EFH Cashflow');
        service.registerInvestmentIncome('EFH'); // idempotent
        expect(state.allSubscriptions.filter((s) => s.title === 'EFH Cashflow')).toHaveLength(1);
        expect(
          state.cashflowGame.gameSubscriptionTitles.filter((t) => t === 'EFH Cashflow'),
        ).toHaveLength(1);
      });

      it('Payday pays the bought property out', () => {
        service.applyDealCard(efh, callbacks(), {});
        service.registerInvestmentIncome('EFH');
        const before = AppStateService.instance.allTransactions.length;

        service.payday(callbacks());

        const payout = AppStateService.instance.allTransactions
          .slice(before)
          .find((t) => t.category === '@EFH');
        expect(payout).toMatchObject({ account: 'Income', amount: 100 });
      });
    });

    it('ships all seven Einfamilienhaus cards with their printed numbers; two are Super Deals', () => {
      const efh = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealSmall!.filter((card) => card.symbol === 'EFH');

      // [Anzahlung, Hypothek, Cashflow] in EUR, as printed
      expect(
        efh
          .map((card) => [
            card.depositMinor! / 100,
            card.mortgageMinor! / 100,
            card.cashflowMinor! / 100,
          ])
          .sort((a, b) => a[0] - b[0] || a[2] - b[2]),
      ).toEqual([
        [1000, 29000, 0],
        [2000, 48000, 200],
        [2000, 33000, 220],
        [2000, 43000, 250],
        [3000, 47000, 100],
        [4000, 46000, 200],
        [5000, 60000, 160],
      ]);
      expect(
        efh
          .filter((card) => card.superDeal)
          .map((card) => card.id)
          .sort(),
      ).toEqual(['classic-small-efh-35k-2k', 'classic-small-efh-45k-2k']);
      expect(new Set(efh.map((card) => card.id)).size).toBe(7);
    });

    it('ships the four Eigentumswohnung cards with their printed numbers', () => {
      const etw = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealSmall!.filter((card) => card.symbol === 'ETW');

      // [Anzahlung, Hypothek, Cashflow] in EUR, as printed; each costs 40.000 except the older 55.000 one
      expect(
        etw
          .map((card) => [
            card.depositMinor! / 100,
            card.mortgageMinor! / 100,
            card.cashflowMinor! / 100,
          ])
          .sort((a, b) => a[0] - b[0]),
      ).toEqual([
        [1000, 39000, 0],
        [4000, 36000, 140],
        [5000, 35000, 220],
        [5000, 50000, 160],
      ]);
      expect(new Set(etw.map((card) => card.id)).size).toBe(4);
    });

    it('ships the ten Mehrfamilienhaus cards of the Big Deal pile with their printed numbers', () => {
      const mfh = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealBig!.filter((card) => card.symbol?.startsWith('MFH'));

      // [units, Kosten, Anzahlung, Hypothek, Cashflow] in EUR exactly as printed on the cards
      const printed = mfh
        .map((card) => [
          Number(card.symbol!.slice(3)),
          (card.depositMinor! + card.mortgageMinor!) / 100,
          card.depositMinor! / 100,
          card.mortgageMinor! / 100,
          card.cashflowMinor! / 100,
        ])
        .sort((a, b) => a[1] - b[1] || a[2] - b[2]);
      expect(printed).toEqual([
        [4, 225000, 15000, 210000, 700],
        [8, 240000, 40000, 200000, 1800],
        [8, 250000, 40000, 210000, 2000],
        [4, 280000, 16000, 264000, 1000],
        [4, 290000, 15000, 275000, 800],
        [4, 300000, 20000, 280000, 1100],
        [8, 320000, 40000, 280000, 1700],
        [4, 340000, 32000, 308000, 1400],
        [8, 360000, 32000, 328000, 1800],
        [4, 370000, 10000, 360000, 900],
      ]);
      expect(new Set(mfh.map((card) => card.id)).size).toBe(10);
    });

    it('ships the eight Big Deal Einfamilienhaus cards with their printed numbers', () => {
      const efh = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealBig!.filter((card) => card.symbol === 'EFH');

      // [Kosten, Anzahlung, Hypothek, Cashflow] in EUR exactly as printed
      expect(
        efh
          .map((card) => [
            (card.depositMinor! + card.mortgageMinor!) / 100,
            card.depositMinor! / 100,
            card.mortgageMinor! / 100,
            card.cashflowMinor! / 100,
          ])
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      ).toEqual([
        [225000, 14000, 211000, 750],
        [270000, 15000, 255000, 800],
        [275000, 15000, 260000, 800],
        [275000, 16000, 259000, 750],
        [300000, 12000, 288000, 800],
        [300000, 20000, 280000, 1000],
        [325000, 18000, 307000, 900],
        [350000, 20000, 330000, 1000],
      ]);
      expect(new Set(efh.map((card) => card.id)).size).toBe(8);
    });

    it('ships the five Big Deal Doppelhaus cards with their printed numbers', () => {
      const dh = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealBig!.filter((card) => card.symbol === 'DH');

      // [Kosten, Anzahlung, Hypothek, Cashflow] in EUR exactly as printed
      expect(
        dh
          .map((card) => [
            (card.depositMinor! + card.mortgageMinor!) / 100,
            card.depositMinor! / 100,
            card.mortgageMinor! / 100,
            card.cashflowMinor! / 100,
          ])
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      ).toEqual([
        [170000, 18000, 152000, 900],
        [245000, 12000, 233000, 800],
        [250000, 16000, 234000, 900],
        [260000, 10000, 250000, 1100],
        [260000, 12000, 248000, 600],
      ]);
      expect(new Set(dh.map((card) => card.id)).size).toBe(5);
    });

    it('ships the four Big Deal Appartementhaus cards with their printed numbers', () => {
      const aph = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealBig!.filter((card) => card.symbol?.startsWith('APH'));

      // [units, Kosten, Anzahlung, Hypothek, Cashflow] in EUR exactly as printed
      expect(
        aph
          .map((card) => [
            Number(card.symbol!.slice(3)),
            (card.depositMinor! + card.mortgageMinor!) / 100,
            card.depositMinor! / 100,
            card.mortgageMinor! / 100,
            card.cashflowMinor! / 100,
          ])
          .sort((a, b) => a[1] - b[1]),
      ).toEqual([
        [12, 350000, 50000, 300000, 3000],
        [24, 550000, 50000, 500000, 2400],
        [24, 575000, 75000, 500000, 3600],
        [60, 1200000, 200000, 1000000, 11000],
      ]);
      expect(new Set(aph.map((card) => card.id)).size).toBe(4);
    });

    it('ships the eight Big Deal business cards with their printed numbers; business partners have no mortgage', () => {
      const biz = service.gameSets
        .find((set) => set.id === 'cashflow')!
        .decks!.dealBig!.filter((card) => ['GP', 'AU', 'AWA'].includes(card.symbol!));

      // [key, Kosten, Anzahlung, Hypothek, Cashflow] in EUR exactly as printed
      expect(
        biz
          .map((card) => [
            card.symbol,
            (card.depositMinor! + card.mortgageMinor!) / 100,
            card.depositMinor! / 100,
            card.mortgageMinor! / 100,
            card.cashflowMinor! / 100,
          ])
          .sort(
            (a, b) =>
              String(a[0]).localeCompare(String(b[0])) ||
              Number(a[1]) - Number(b[1]) ||
              Number(a[4]) - Number(b[4]),
          ),
      ).toEqual([
        ['AU', 125000, 25000, 100000, 1800],
        ['AU', 150000, 30000, 120000, 2500],
        ['AU', 180000, 20000, 160000, 1600],
        ['AWA', 350000, 50000, 300000, 2500],
        ['GP', 20000, 20000, 0, 1200],
        ['GP', 25000, 25000, 0, 1300],
        ['GP', 30000, 30000, 0, 1500],
        ['GP', 30000, 30000, 0, 1700],
      ]);
      expect(new Set(biz.map((card) => card.id)).size).toBe(8); // the two 30k partners differ by cashflow
    });

    describe('special assets: gold coins (todo/cashflow-game.md decision 68)', () => {
      const gold = (id: string) =>
        service.gameSets
          .find((set) => set.id === 'cashflow')!
          .decks!.dealSmall!.find((c) => c.id === id)!;
      const plain = () => gold('classic-small-gold-friend-3000');
      const gamble = () => gold('classic-small-gold-box-500');
      const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
      const texts = { success: 'Ten gold coins!', failure: 'Absolutely nothing.' };

      it('ships the four gold cards with their printed numbers', () => {
        const cards = service.gameSets
          .find((set) => set.id === 'cashflow')!
          .decks!.dealSmall!.filter((card) => card.symbol === 'GOLD');
        expect(
          cards
            .map((c) => [c.costMinor! / 100, c.quantity, c.successOn ?? null])
            .sort((a, b) => Number(a[0]) - Number(b[0])),
        ).toEqual([
          [500, 10, 6],
          [750, 10, 6],
          [1000, 5, null],
          [3000, 10, null],
        ]);
      });

      it('planning a card makes a Grow asset project with the price as its deposit and the coins in a note', () => {
        service.applyDealCard(plain(), ok(), { symbol: 'GOLD' });

        const project = AppStateService.instance.allGrowProjects[0];
        expect(project).toMatchObject({
          title: 'GOLD',
          isAsset: true,
          amount: 3000,
          phase: 'plan',
        });
        expect(project.notes.some((n) => n.text.includes('assetCoinsNote'))).toBe(true);
        expect(AppStateService.instance.cashflowGame.assetDeals).toEqual([
          expect.objectContaining({ title: 'GOLD', coins: 10, stage: 'planned' }),
        ]);
        expect(AppStateService.instance.allAssets).toHaveLength(0); // nothing owned until it is bought
      });

      it('every card is its own project: GOLD, GOLD-II', () => {
        const titles: string[] = [];
        for (let i = 0; i < 2; i++) {
          service.applyDealCard(
            plain(),
            { onSuccess: (t) => titles.push(t), onError: jest.fn() },
            { symbol: 'GOLD' },
          );
        }
        expect(titles).toEqual(['GOLD', 'GOLD-II']);
      });

      it('a plain offer is bought like any asset: no open decision, owned straight away', () => {
        service.applyDealCard(plain(), ok(), { symbol: 'GOLD' });

        expect(service.beforeAssetBuy('GOLD')).toBe(false);
        AppStateService.instance.allAssets.push({ tag: 'GOLD', amount: 3000 }); // what the dialog books
        service.afterAssetBuy('GOLD');

        expect(service.openDecisions).toHaveLength(0);
        expect(AppStateService.instance.cashflowGame.assetDeals![0].stage).toBe('owned');
        expect(AppStateService.instance.allGrowProjects[0].phase).toBe('execute');
      });

      it('a gamble card is paid, then waits for the roll as an open decision - no asset yet', () => {
        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });

        expect(service.beforeAssetBuy('GOLD')).toBe(true); // the dialog must NOT book the asset
        service.afterAssetBuy('GOLD');

        expect(service.openDecisions.map((d) => [d.title, d.successOn, d.coins])).toEqual([
          ['GOLD', 6, 10],
        ]);
        expect(AppStateService.instance.allGrowProjects[0]).toMatchObject({
          status: 'awaiting roll',
          phase: 'execute',
        });
        expect(AppStateService.instance.allAssets).toHaveLength(0);
      });

      it('pressing Buy again on a card already waiting for its roll still hands out nothing', () => {
        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });
        service.beforeAssetBuy('GOLD');
        service.afterAssetBuy('GOLD');

        expect(service.beforeAssetBuy('GOLD')).toBe(true);
        expect(service.openDecisions).toHaveLength(1);
        expect(AppStateService.instance.allAssets).toHaveLength(0);
      });

      it('paying a gamble card tells the game panel to open on the decision - a plain offer does not', () => {
        const opened = jest.fn();
        service.decisionNeeded$.subscribe(opened);

        service.applyDealCard(plain(), ok(), { symbol: 'GOLD' });
        service.beforeAssetBuy('GOLD');
        service.afterAssetBuy('GOLD');
        expect(opened).not.toHaveBeenCalled();

        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });
        service.beforeAssetBuy('GOLD-II');
        service.afterAssetBuy('GOLD-II');
        expect(opened).toHaveBeenCalledTimes(1);
      });

      it('winning the roll books the coins as an asset at what was paid, and notes the result', () => {
        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });
        service.beforeAssetBuy('GOLD');
        service.afterAssetBuy('GOLD');
        const done = ok();

        service.resolveGamble('GOLD', { won: true, roll: 6 }, done);

        const state = AppStateService.instance;
        expect(done.onSuccess).toHaveBeenCalled();
        expect(state.allAssets).toEqual([{ tag: 'GOLD', amount: 500 }]);
        expect(state.cashflowGame.assetDeals![0].stage).toBe('owned');
        expect(state.allGrowProjects[0]).toMatchObject({ status: 'bought', phase: 'execute' });
        expect(state.allGrowProjects[0].notes.at(-1)!.text).toContain('Ten gold coins!');
        expect(state.allGrowProjects[0].notes.at(-1)!.text).toContain('6');
        expect(service.openDecisions).toHaveLength(0);
        expect(service.historySteps()[0]).toMatchObject({ kind: 'diceWon' });
        expect(service.historySteps()[0].detail).toContain('6');
      });

      it('missing the roll keeps the money gone, no asset, the card completed - and says what happened', () => {
        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });
        service.beforeAssetBuy('GOLD');
        service.afterAssetBuy('GOLD');

        service.resolveGamble('GOLD', { won: false, roll: 3 }, ok());

        const state = AppStateService.instance;
        expect(state.allAssets).toHaveLength(0);
        expect(state.cashflowGame.assetDeals![0].stage).toBe('lost');
        expect(state.allGrowProjects[0]).toMatchObject({ status: 'lost', phase: 'completed' });
        expect(state.allGrowProjects[0].notes.at(-1)!.text).toContain('Absolutely nothing.');
        expect(service.historySteps()[0]).toMatchObject({ kind: 'diceLost' });
      });

      describe('the sister-in-law loan: pay 5.000, 1-3 lose it, 4-6 get 10.000 back', () => {
        const loan = () => gold('classic-small-sister-5000');
        const paid = () => {
          service.applyDealCard(loan(), ok(), { symbol: 'LOAN', ...texts });
          service.beforeAssetBuy('LOAN');
          service.afterAssetBuy('LOAN');
        };

        it('ships the printed numbers: cost 5.000, payout 10.000, wins on 4', () => {
          expect(loan()).toMatchObject({ costMinor: 500000, payoutMinor: 1000000, successOn: 4 });
        });

        it('is planned as a Grow asset project without a coins note', () => {
          service.applyDealCard(loan(), ok(), { symbol: 'LOAN' });
          const project = AppStateService.instance.allGrowProjects[0];
          expect(project).toMatchObject({ title: 'LOAN', isAsset: true, amount: 5000 });
          expect(project.notes.some((n) => n.text.includes('assetCoinsNote'))).toBe(false);
          expect(AppStateService.instance.cashflowGame.assetDeals![0]).toMatchObject({
            payoutMinor: 1000000,
            successOn: 4,
          });
        });

        it('once paid it waits for the roll, owning nothing', () => {
          paid();
          expect(service.openDecisions.map((d) => d.title)).toEqual(['LOAN']);
          expect(AppStateService.instance.allAssets).toHaveLength(0);
        });

        it('a winning roll pays 10.000 as Income - no asset, project completed', () => {
          paid();
          const before = AppStateService.instance.allTransactions.length;

          service.resolveGamble('LOAN', { won: true, roll: 4 }, ok());

          const state = AppStateService.instance;
          const income = state.allTransactions.slice(before);
          expect(income).toHaveLength(1);
          expect(income[0]).toMatchObject({ account: 'Income', amount: 10000, category: '@LOAN' });
          expect(income[0].comment).toContain('#cashflow');
          expect(state.allAssets).toHaveLength(0);
          expect(state.cashflowGame.assetDeals![0].stage).toBe('paidBack');
          expect(state.allGrowProjects[0]).toMatchObject({ phase: 'completed' });
          expect(service.historySteps()[0]).toMatchObject({ kind: 'diceWon' });
        });

        it('undoing the win takes the 10.000 back out', () => {
          paid();
          const before = AppStateService.instance.allTransactions.length;
          service.resolveGamble('LOAN', { won: true, roll: 5 }, ok());

          service.undoSteps(1, ok());

          expect(AppStateService.instance.allTransactions).toHaveLength(before);
          expect(service.openDecisions).toHaveLength(1);
        });

        it('a losing roll books nothing and completes the card', () => {
          paid();
          const before = AppStateService.instance.allTransactions.length;

          service.resolveGamble('LOAN', { won: false, roll: 2 }, ok());

          const state = AppStateService.instance;
          expect(state.allTransactions).toHaveLength(before);
          expect(state.cashflowGame.assetDeals![0].stage).toBe('lost');
          expect(state.allGrowProjects[0]).toMatchObject({ status: 'lost', phase: 'completed' });
        });
      });

      describe('Multi-Level-Marketing: kept cards rolled for at every Payday', () => {
        const mlm = (n: 1 | 2) => gold(`classic-small-mlm-${n}`);
        const own = (n: 1 | 2, title: string) => {
          service.applyDealCard(mlm(n), ok(), { symbol: 'MLM', ...texts });
          expect(service.beforeAssetBuy(title)).toBe(false); // bought like a plain asset
          AppStateService.instance.allAssets.push({ tag: title, amount: 500 }); // what the dialog books
          service.afterAssetBuy(title);
        };
        const payday = () => {
          const done = ok();
          service.payday(done);
          return done;
        };

        beforeEach(() => service.pickProfession('cashflow', 'hausmeister', ok()));

        it('ships two identical cards: cost 500, payout 500 on 4-6, kept', () => {
          expect(mlm(1)).toMatchObject({
            costMinor: 50000,
            payoutMinor: 50000,
            successOn: 4,
            recurring: true,
          });
          expect(mlm(2).title).toBe(mlm(1).title);
        });

        it('buying keeps it owned and in execution - no decision yet', () => {
          own(1, 'MLM');
          expect(service.openDecisions).toHaveLength(0);
          expect(AppStateService.instance.cashflowGame.assetDeals![0].stage).toBe('owned');
          expect(AppStateService.instance.allGrowProjects[0].phase).toBe('execute');
        });

        it('a Payday opens the roll; without a kept card it does not', () => {
          const opened = jest.fn();
          service.decisionNeeded$.subscribe(opened);
          payday();
          expect(service.openDecisions).toHaveLength(0);
          expect(opened).not.toHaveBeenCalled();

          own(1, 'MLM');
          payday();
          expect(service.openDecisions.map((d) => d.title)).toEqual(['MLM']);
          expect(opened).toHaveBeenCalledTimes(1);
        });

        it('a win books 500 income for the card as its own History step after the Payday', () => {
          own(1, 'MLM');
          payday();
          const before = AppStateService.instance.allTransactions.length;

          service.resolveGamble('MLM', { won: true, roll: 5 }, ok());

          const added = AppStateService.instance.allTransactions.slice(before);
          expect(added).toHaveLength(1);
          // the bonus is income, like the salary - not a Daily booking (JFK, 2026-10-06)
          expect(added[0]).toMatchObject({ account: 'Income', amount: 500, category: '@MLM' });
          expect(service.openDecisions).toHaveLength(0);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'diceWon' });
          expect(service.historySteps()[1]).toMatchObject({ kind: 'payday' });
          expect(AppStateService.instance.allGrowProjects[0].phase).toBe('execute'); // never completes
        });

        it('one roll covers both cards: twice the money, or nothing', () => {
          own(1, 'MLM');
          own(2, 'MLM-II');
          payday();
          expect(service.openDecisions).toHaveLength(1);
          expect(service.paydayRollCount(service.openDecisions[0])).toBe(2);
          const before = AppStateService.instance.allTransactions.length;

          service.resolveGamble('MLM', { won: true, roll: 6 }, ok());

          const added = AppStateService.instance.allTransactions.slice(before);
          expect(added.map((t) => [t.category, t.amount])).toEqual([
            ['@MLM', 500],
            ['@MLM-II', 500],
          ]);
          expect(service.openDecisions).toHaveLength(0);

          payday();
          const mid = AppStateService.instance.allTransactions.length;
          service.resolveGamble('MLM', { won: false, roll: 2 }, ok());
          expect(AppStateService.instance.allTransactions).toHaveLength(mid);
          expect(service.openDecisions).toHaveLength(0);
          expect(service.historySteps()[0]).toMatchObject({ kind: 'diceLost' });
        });

        it('the card keeps rolling every Payday', () => {
          own(1, 'MLM');
          payday();
          service.resolveGamble('MLM', { won: false, roll: 1 }, ok());
          payday();
          expect(service.openDecisions).toHaveLength(1);
        });

        it('undoing the roll brings the decision back; undoing the Payday removes it', () => {
          own(1, 'MLM');
          payday();
          service.resolveGamble('MLM', { won: true, roll: 4 }, ok());

          service.undoSteps(1, ok());
          expect(service.openDecisions).toHaveLength(1);
          service.undoSteps(1, ok());
          expect(service.openDecisions).toHaveLength(0);
        });
      });

      it('a roll reported from a real die works the same, without a number', () => {
        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });
        service.beforeAssetBuy('GOLD');
        service.afterAssetBuy('GOLD');

        service.resolveGamble('GOLD', { won: true }, ok());

        expect(AppStateService.instance.allAssets).toHaveLength(1);
        expect(service.historySteps()[0].detail).toBe('GOLD');
      });

      it('Undo takes a roll back: the decision is open again and the coins are gone', () => {
        service.applyDealCard(gamble(), ok(), { symbol: 'GOLD', ...texts });
        service.beforeAssetBuy('GOLD');
        service.afterAssetBuy('GOLD');
        service.resolveGamble('GOLD', { won: true, roll: 6 }, ok());

        service.undoLastAction(ok());

        expect(AppStateService.instance.allAssets).toHaveLength(0);
        expect(service.openDecisions).toHaveLength(1);
      });

      it('refuses a roll when no decision is open, and rolls only 1 to 6', () => {
        const onError = jest.fn();
        service.resolveGamble('GOLD', { won: true }, { onSuccess: jest.fn(), onError });
        expect(onError).toHaveBeenCalled();

        for (let i = 0; i < 200; i++) {
          const roll = service.rollDie();
          expect(roll).toBeGreaterThanOrEqual(1);
          expect(roll).toBeLessThanOrEqual(6);
          expect(Number.isInteger(roll)).toBe(true);
        }
      });

      it('selling the asset later completes the deal and ends the coin count', () => {
        service.applyDealCard(plain(), ok(), { symbol: 'GOLD' });
        service.beforeAssetBuy('GOLD');
        AppStateService.instance.allAssets.push({ tag: 'GOLD', amount: 3000 });
        service.afterAssetBuy('GOLD');

        AppStateService.instance.allAssets = []; // what the dialog's Sell Asset leaves
        service.afterAssetSell('GOLD');

        expect(AppStateService.instance.cashflowGame.assetDeals![0].stage).toBe('sold');
        expect(AppStateService.instance.allGrowProjects[0].phase).toBe('completed');
      });

      describe('selling coins', () => {
        const owned = (coins = 10, amount = 3000) => {
          service.applyDealCard(plain(), ok(), { symbol: 'GOLD' });
          service.beforeAssetBuy('GOLD');
          AppStateService.instance.allAssets.push({ tag: 'GOLD', amount });
          service.afterAssetBuy('GOLD');
          expect(service.coinsOwned('GOLD')).toBe(coins);
        };

        it('selling some leaves the other coins and their share of the cost on the asset', () => {
          owned();

          expect(service.sellCoins('GOLD', 5, 1000)).toBe(true);
          service.afterAssetSell('GOLD');

          const state = AppStateService.instance;
          expect(service.coinsOwned('GOLD')).toBe(5);
          expect(state.allAssets).toEqual([{ tag: 'GOLD', amount: 1500 }]); // half the cost stays
          expect(state.cashflowGame.assetDeals![0]).toMatchObject({ coins: 5, stage: 'owned' });
          expect(state.allGrowProjects[0]).toMatchObject({
            status: 'bought',
            phase: 'execute',
            amount: 1500,
          });
          expect(state.allGrowProjects[0].notes.at(-1)!.text).toContain('coinsSoldNote');
        });

        it('selling the last coins removes the asset and completes the Grow project', () => {
          owned();
          service.sellCoins('GOLD', 5, 1000);
          service.afterAssetSell('GOLD');

          expect(service.sellCoins('GOLD', 5, 800)).toBe(true);
          service.afterAssetSell('GOLD');

          const state = AppStateService.instance;
          expect(state.allAssets).toHaveLength(0);
          expect(service.coinsOwned('GOLD')).toBe(0);
          expect(state.cashflowGame.assetDeals![0]).toMatchObject({ coins: 0, stage: 'sold' });
          expect(state.allGrowProjects[0]).toMatchObject({ status: 'sold', phase: 'completed' });
        });

        it('selling all ten in one go completes it at once', () => {
          owned();
          service.sellCoins('GOLD', 10, 400);
          service.afterAssetSell('GOLD');
          expect(AppStateService.instance.allAssets).toHaveLength(0);
          expect(AppStateService.instance.allGrowProjects[0].phase).toBe('completed');
        });

        it('refuses more coins than you have, or none at all', () => {
          owned();
          expect(service.sellAssetProblem('Sell Asset GOLD 11 x 1000;')).toContain(
            'sellTooManyCoins',
          );
          expect(service.sellAssetProblem('Sell Asset GOLD 0 x 1000;')).toContain('sellNeedCoins');
          expect(service.sellAssetProblem('Sell Asset GOLD 10 x 1000;')).toBeNull();
          expect(service.sellAssetProblem('Sell Asset GOLD 5 x 1000;')).toBeNull();
        });

        it('leaves ordinary assets alone: no coins, no check, the usual sale', () => {
          expect(service.sellAssetProblem('Sell Asset Car 3 x 100;')).toBeNull();
          expect(service.sellCoins('Car', 1, 100)).toBe(false);
        });

        it('Undo brings the coins back', () => {
          service.pickProfession('placeholder', 'placeholder-profession', ok());
          AppStateService.instance.tier3BalanceLoaded = true;
          AppStateService.instance.tier3GrowLoaded = true;
          owned();
          service.beforeGrowTrade('Sell Asset GOLD 5 x 1000;', 0, undefined, '@GOLD');
          service.sellCoins('GOLD', 5, 1000);
          service.afterAssetSell('GOLD');
          expect(service.coinsOwned('GOLD')).toBe(5);

          service.undoLastAction(ok());

          expect(service.coinsOwned('GOLD')).toBe(10);
          expect(AppStateService.instance.allAssets).toEqual([{ tag: 'GOLD', amount: 3000 }]);
        });
      });

      it('names the purchase "Asset bought" in the History', () => {
        service.pickProfession('placeholder', 'placeholder-profession', ok());
        AppStateService.instance.tier3BalanceLoaded = true;
        AppStateService.instance.tier3GrowLoaded = true;
        service.beforeGrowTrade('Buy Asset GOLD 1 x 3000;', 0, undefined, '@GOLD');
        expect(service.historySteps()[0]).toMatchObject({ kind: 'buyAsset', detail: 'GOLD' });
      });
    });

    it('browseCards lists the whole deck by symbol then price, and narrows as you type', () => {
      service.pickProfession('cashflow', 'hausmeister', callbacks());
      const all = service.browseCards('dealSmall', '');
      expect(all).toHaveLength(38); // 20 stock cards + 7 EFH + 4 ETW + 4 gold + the sister-in-law loan + 2 MLM
      expect(all[0].symbol).toBe('EFH'); // alphabetical
      expect(service.browseCards('dealSmall', 'ok4u')).toHaveLength(5);
      const one = service.browseCards('dealSmall', 'ok4u 20');
      expect(one.map((card) => card.id)).toEqual(['classic-small-ok4u-20']);
    });

    it('drawing the same card again keeps the holding, moves the price, and notes it', () => {
      service.applyDealCard(ok4u, callbacks(), { description: 'Card text' });
      service.executeDeal('OK4U', callbacks(), 100);
      const state = AppStateService.instance;
      expect(state.allShares).toContainEqual({ tag: 'OK4U', quantity: 100, price: 10 });

      service.applyDealCard(
        { ...ok4u, id: 'classic-small-ok4u-12', priceMinor: 1200 },
        callbacks(),
        { description: 'Other text' },
      );

      const project = state.allGrowProjects.filter((p) => p.title === 'OK4U');
      expect(project).toHaveLength(1);
      expect(project[0].description).toBe('Card text'); // first plan's description is kept
      expect(project[0].share).toMatchObject({ quantity: 0, price: 12 }); // amount to buy reset
      expect(state.allShares).toContainEqual({ tag: 'OK4U', quantity: 100, price: 10 }); // holding untouched
      expect(project[0].notes.some((n) => n.text.includes('cardDrawnAgain'))).toBe(true);
    });

    it("a planned property shows the card's full Anzahlung as its Deposit, with no project Loan", () => {
      service.applyDealCard(
        {
          id: 'efh',
          title: 'Einfamilienhaus',
          assetKind: 'investment',
          symbol: 'EFH',
          depositMinor: 300000,
          mortgageMinor: 4700000,
          cashflowMinor: 10000,
        },
        callbacks(),
        {},
      );
      const project = AppStateService.instance.allGrowProjects[0];
      expect(project.amount).toBe(3000);
      expect(project.investment).toMatchObject({ deposit: 3000, amount: 47000 });
      expect(project.liabilitie).toBeNull();
    });

    it('names the project by the ticker and puts the company name in the subtitle', () => {
      service.applyDealCard(ok4u, callbacks(), {});
      expect(AppStateService.instance.allGrowProjects[0]).toMatchObject({
        title: 'OK4U',
        sub: 'OK4U Pharma AG',
        status: 'planned',
      });
    });

    it('changing the quantity UPDATES the bank-loan note instead of adding another', () => {
      service.applyDealCard(ok4u, callbacks(), {});
      const project = AppStateService.instance.allGrowProjects[0];
      const loanNotes = () => project.notes.filter((n) => n.text.startsWith('🏦'));
      expect(loanNotes()).toHaveLength(1);

      project.share.quantity = 250;
      service.syncPlanNote(project);
      project.share.quantity = 400;
      service.syncPlanNote(project);

      expect(loanNotes()).toHaveLength(1);
      expect(translate.instant).toHaveBeenLastCalledWith(
        'CashflowGame.noteLoanShare',
        expect.objectContaining({ quantity: 400, loan: expect.stringContaining('4') }),
      );
    });

    it('leaves the note alone once the card is bought', () => {
      service.applyDealCard(ok4u, callbacks(), {});
      const project = AppStateService.instance.allGrowProjects[0];
      const before = project.notes.map((n) => n.text);
      project.status = 'bought';
      project.share.quantity = 999;

      service.syncPlanNote(project);

      expect(project.notes.map((n) => n.text)).toEqual(before);
    });

    it('phases: plan when planned, execute when bought, completed once everything is sold', () => {
      const state = AppStateService.instance;
      service.applyDealCard(ok4u, callbacks(), {});
      const project = state.allGrowProjects[0];
      expect(project.phase).toBe('plan');

      state.allShares.push({ tag: 'OK4U', quantity: 100, price: 10 }); // what the Add dialog's buy does
      service.setPhaseAfterTrade('OK4U', 'buy');
      expect(project.phase).toBe('execute');

      state.allShares[0].quantity = 40; // sold some
      service.setPhaseAfterTrade('OK4U', 'sell');
      expect(project.phase).toBe('execute');

      state.allShares.splice(0, 1); // sold the rest
      service.setPhaseAfterTrade('OK4U', 'sell');
      expect(project.phase).toBe('completed');

      service.applyDealCard(ok4u, callbacks(), {}); // the card comes again: back to planning
      expect(project.phase).toBe('plan');
    });

    it('refuses to buy without a share count', () => {
      service.applyDealCard(ok4u, callbacks(), {});
      const cb = callbacks();
      service.executeDeal('OK4U', cb);
      expect(cb.onError).toHaveBeenCalledWith(expect.stringContaining('how many shares'));
      expect(AppStateService.instance.allShares).toHaveLength(0);
    });

    it('buys the chosen quantity, taking a separate bank loan first when cash is short — two undo steps', () => {
      service.applyDealCard(ok4u, callbacks(), {});

      service.executeDeal('OK4U', callbacks(), 250); // 250 × 10 = 2,500; no cash → 3,000 loan
      const state = AppStateService.instance;
      expect(state.allShares).toContainEqual({ tag: 'OK4U', quantity: 250, price: 10 });
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')?.amount).toBe(3000);

      service.undoLastAction(callbacks()); // takes back the purchase only
      expect(state.allShares).toHaveLength(0);
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')?.amount).toBe(3000);

      service.undoLastAction(callbacks()); // then the loan
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
    });

    // only property and asset cards can be sold to a friend; a share card belongs to whoever drew it (JFK, 2026-10-06)
    const house = {
      id: 'classic-small-efh',
      title: 'Einfamilienhaus',
      assetKind: 'investment' as const,
      symbol: 'EFH',
      depositMinor: 300000,
      mortgageMinor: 4700000,
      cashflowMinor: 10000,
    };

    it('a share card cannot be sold to a friend: nothing is booked and the player is told why', () => {
      const before = AppStateService.instance.allTransactions.length;
      const cb = callbacks();
      service.sellCardToFriend(ok4u, 500, cb);
      expect(cb.onError).toHaveBeenCalledWith(expect.stringMatching(/belongs to whoever drew it/));
      expect(cb.onSuccess).not.toHaveBeenCalled();
      expect(AppStateService.instance.allTransactions).toHaveLength(before);
    });

    it('selling a card to a friend books one-time Income named after the card, and undoes', () => {
      const before = AppStateService.instance.allTransactions.length;
      const cb = callbacks();
      service.sellCardToFriend(house, 500, cb);

      const state = AppStateService.instance;
      expect(cb.onSuccess).toHaveBeenCalled();
      expect(state.allTransactions[before]).toMatchObject({
        account: 'Income',
        amount: 500,
        category: '@EFH card sale',
      });
      expect(state.allGrowProjects).toHaveLength(0);

      service.undoLastAction(callbacks());
      expect(state.allTransactions).toHaveLength(before);
    });

    it('writes the card sale’s comment in the language the game is played in, keeping the #cashflow tag', () => {
      const english = translate.instant.getMockImplementation()!;
      translate.instant.mockImplementation((key: string, params?: Record<string, string>) =>
        key === 'CashflowGame.cardSaleComment'
          ? `Karte ${params?.['name']} an einen Freund verkauft`
          : english(key, params),
      );
      const before = AppStateService.instance.allTransactions.length;

      service.sellCardToFriend(house, 500, callbacks());

      expect(AppStateService.instance.allTransactions[before].comment).toBe(
        'Karte EFH an einen Freund verkauft\n#cashflow',
      );
      // The category stays a literal key: History and old games recognise a card sale by it.
      expect(AppStateService.instance.allTransactions[before].category).toBe('@EFH card sale');
    });

    it('dates a card sale on the next free day of the real current month, filling odd days first then even', () => {
      const state = AppStateService.instance;
      const prefix = new Date().toISOString().slice(0, 7); // same month prefix todayIso() uses
      const monthPrefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      expect(monthPrefix.length).toBe(prefix.length);
      const day = (n: number) => `${monthPrefix}-${String(n).padStart(2, '0')}`;
      const taken = new Set(
        [
          ...state.allSubscriptions
            .filter((s) => s.comment?.includes('#cashflow'))
            .map((s) => s.startDate),
        ].filter((d) => d?.startsWith(monthPrefix)),
      );

      service.sellCardToFriend(house, 100, callbacks());
      service.sellCardToFriend(house, 100, callbacks());
      const sales = state.allTransactions.filter((t) => t.category === '@EFH card sale');

      expect(sales[0].date.startsWith(monthPrefix)).toBe(true);
      expect(taken.has(sales[0].date)).toBe(false);
      expect(sales[1].date).not.toBe(sales[0].date);
      expect(Number(sales[0].date.slice(-2)) % 2).toBe(1); // odd slots come first
      expect(day(1)).toBeTruthy();
    });

    it('rejects a sale with no price', () => {
      const cb = callbacks();
      service.sellCardToFriend(house, 0, cb);
      expect(cb.onError).toHaveBeenCalled();
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

    it('a Reset clears the history with it - there is nothing left to undo', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      started();
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      expect(service.historySteps().length).toBeGreaterThan(1);

      service.resetGame({ onSuccess: jest.fn(), onError: jest.fn() });

      expect(AppStateService.instance.cashflowGame.professionId).toBeNull();
      expect(service.historySteps()).toEqual([]);
      expect(service.canUndo).toBe(false);
    });

    it('starting a game begins a fresh history at step 1, whatever an earlier game left', () => {
      ProfileComponent.mail = 'player@cashflow.example';
      started();
      service.adjustBankLoan(1000, { onSuccess: jest.fn(), onError: jest.fn() });
      // the second game's steps replace the first's, they do not pile on top
      started();

      const steps = service.historySteps();
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ kind: 'start' });
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
      const reloaded = new CashflowGameService(
        persistence as any,
        incomeStatement,
        noopTranslate() as any,
      );

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
      const afterLogin = new CashflowGameService(
        persistence as any,
        incomeStatement,
        noopTranslate() as any,
      );
      expect(afterLogin.canUndo).toBe(false);
    });

    it('starts empty rather than throwing when localStorage holds corrupt JSON', () => {
      localStorage.setItem('cashflowUndoStack', '{not valid json');

      const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
      const corrupted = new CashflowGameService(
        persistence as any,
        incomeStatement,
        noopTranslate() as any,
      );

      expect(corrupted.canUndo).toBe(false);
    });
  });

  describe('spaces that pay cash never take the balance negative (JFK, 2026-10-06)', () => {
    const callbacks = () => ({ onSuccess: jest.fn(), onError: jest.fn(), onLoan: jest.fn() });
    const start = () =>
      service.pickProfession('placeholder', 'placeholder-profession', callbacks());

    it('Downsized with an empty account takes the bank loan first, as its own undo step, then pays', () => {
      start();
      const state = AppStateService.instance;
      expect(service.cash).toBe(0);
      const cb = callbacks();

      service.resolveDownsized(cb);

      expect(cb.onSuccess).toHaveBeenCalled();
      expect(cb.onLoan).toHaveBeenCalledWith(expect.any(Number));
      expect(service.cash).toBeGreaterThanOrEqual(0);
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')?.amount).toBeGreaterThan(0);
      expect(state.cashflowGame.unemployedRoundsLeft).toBe(2);
      expect(service.historySteps().map((step) => step.kind)).toEqual([
        'downsized',
        'loanAuto',
        'start',
      ]);

      service.undoLastAction(callbacks()); // takes back the payment only
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeDefined();
      service.undoLastAction(callbacks()); // then the loan
      expect(state.liabilities.find((l) => l.tag === 'Bank loan')).toBeUndefined();
      expect(service.cash).toBe(0);
    });

    it('persists the Bank loan with the payment', () => {
      start();
      persistence.batchWriteAndSync.mockClear();
      service.resolveDownsized(callbacks());
      const writes = persistence.batchWriteAndSync.mock.calls[0][0].writes.map((w: any) => w.tag);
      expect(writes).toEqual(expect.arrayContaining(['balance/liabilities', 'subscriptions']));
    });

    it('Charity with an empty account borrows the donation first too', () => {
      start();
      const cb = callbacks();
      service.resolveCharity(cb);
      expect(cb.onLoan).toHaveBeenCalled();
      expect(service.cash).toBeGreaterThanOrEqual(0);
      expect(AppStateService.instance.cashflowGame.charityRoundsLeft).toBe(3);
    });

    it('with enough cash no loan is taken and no loan is announced', () => {
      start();
      AppStateService.instance.allTransactions.push({
        account: 'Income',
        amount: 100000,
        date: '2026-10-01',
        time: '',
        category: '@Savings',
        comment: '',
      } as any);
      const cb = callbacks();
      service.resolveDownsized(cb);
      expect(cb.onLoan).not.toHaveBeenCalled();
      expect(
        AppStateService.instance.liabilities.find((l) => l.tag === 'Bank loan'),
      ).toBeUndefined();
      expect(service.historySteps().map((step) => step.kind)).toEqual(['downsized', 'start']);
    });

    it('a solo roll that lands on Downsized borrows inside the same step and persists the loan', () => {
      service.pickProfession('placeholder', 'placeholder-profession', callbacks(), 'solo');
      const state = AppStateService.instance;
      state.cashflowGame = {
        ...state.cashflowGame,
        boardPosition: 10,
        turn: { phase: 'roll', count: 3 },
      };
      service.rng = () => 0.01; // a 1: space 11, Downsized
      persistence.batchWriteAndSync.mockClear();

      const result = service.rollTurn(1, callbacks())!;

      expect(result.autoLoansMinor).toHaveLength(1);
      expect(service.cash).toBeGreaterThanOrEqual(0);
      expect(service.historySteps().map((step) => step.kind)).toEqual(['roll', 'start']);
      const writes = persistence.batchWriteAndSync.mock.calls[0][0].writes.map((w: any) => w.tag);
      expect(writes).toContain('balance/liabilities');
    });
  });

  describe('solo mode: the token walks the ring (JFK, 2026-10-05)', () => {
    const callbacks = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
    const startSolo = () =>
      service.pickProfession('placeholder', 'placeholder-profession', callbacks(), 'solo');
    /** A die that always shows `face`. */
    const die = (face: number) => () => (face - 1) / 6 + 0.01;

    it('starts at START with the first roll open; a companion game has no turn', () => {
      startSolo();
      expect(service.isSolo).toBe(true);
      expect(AppStateService.instance.cashflowGame.boardPosition).toBeNull();
      expect(service.soloTurn).toEqual({ phase: 'roll', count: 0 });
      expect(service.cannotRollBecause).toBeNull();
      (AppStateService as any)._instance = undefined;
      service.pickProfession('placeholder', 'placeholder-profession', callbacks());
      expect(service.isSolo).toBe(false);
      expect(service.cannotRollBecause).toMatch(/solo/);
    });

    it('a roll moves the token, books what the landing does, and is one undo step', () => {
      startSolo();
      service.rng = die(6); // 6 from START lands on the Payday at 5
      const result = service.rollTurn(1, callbacks())!;
      const state = AppStateService.instance;
      expect(result.move.to).toBe(5);
      expect(state.cashflowGame.boardPosition).toBe(5);
      expect(state.cashflowGame.round).toBe(2); // the opening Payday of the first roll, and the Payday it landed on
      expect(state.allTransactions.length).toBeGreaterThan(1); // Savings + the Paydays' lines
      expect(service.historySteps().map((step) => step.kind)).toEqual(['roll', 'start']);

      service.undoLastAction(callbacks());
      expect(state.cashflowGame.boardPosition).toBeNull();
      expect(state.cashflowGame.round).toBe(0);
      expect(state.allTransactions).toHaveLength(1);
      expect(service.soloTurn).toEqual({ phase: 'roll', count: 0 });
    });

    it('planning a turn changes nothing; committing applies it once, as one undo step', () => {
      startSolo();
      const state = AppStateService.instance;
      const before = JSON.stringify({
        game: state.cashflowGame,
        transactions: state.allTransactions,
        subscriptions: state.allSubscriptions,
        liabilities: state.liabilities,
      });
      persistence.batchWriteAndSync.mockClear();
      service.rng = die(6); // 6 from START: the opening Payday, then the Payday space

      const planned = service.planTurn(1, callbacks())!;

      expect(planned.move.to).toBe(5);
      expect(
        JSON.stringify({
          game: state.cashflowGame,
          transactions: state.allTransactions,
          subscriptions: state.allSubscriptions,
          liabilities: state.liabilities,
        }),
      ).toBe(before); // nothing has happened yet
      expect(persistence.batchWriteAndSync).not.toHaveBeenCalled();
      expect(service.historySteps().map((step) => step.kind)).toEqual(['start']);
      expect(service.canUndo).toBe(true);

      service.commitTurn(planned, callbacks());

      expect(state.cashflowGame.boardPosition).toBe(5);
      expect(state.cashflowGame.round).toBe(2);
      expect(service.historySteps().map((step) => step.kind)).toEqual(['roll', 'start']);
      expect(persistence.batchWriteAndSync).toHaveBeenCalledTimes(1);
    });

    it('a planned turn can be thrown away: the game is as it was', () => {
      startSolo();
      service.rng = die(2);
      service.planTurn(1, callbacks());
      expect(AppStateService.instance.cashflowGame.boardPosition).toBeNull();
      expect(service.soloTurn).toEqual({ phase: 'roll', count: 0 });
    });

    // The game ends the moment the books say so (JFK, 2026-10-06), whichever action changed them.
    const addGameSubscription = (title: string, amount: number) => {
      const state = AppStateService.instance;
      state.allSubscriptions.push({
        title,
        account: 'Daily',
        amount,
        startDate: '2026-10-05',
        endDate: '',
        category: '',
        comment: '#cashflow',
        frequency: 'monthly',
      } as any);
      state.cashflowGame = {
        ...state.cashflowGame,
        gameSubscriptionTitles: [...state.cashflowGame.gameSubscriptionTitles, title],
      };
    };

    it('escaping the rat race ends the game at once - not at the next roll', () => {
      startSolo();
      expect(service.endSoloGameIfOver()).toBe(false); // nothing changed yet
      addGameSubscription('Haus Cashflow', 99999); // passive income far above the expenses

      expect(service.endSoloGameIfOver()).toBe(true);

      expect(service.soloTurn).toMatchObject({ phase: 'over', outcome: 'escaped' });
      expect(service.cannotRollBecause).toMatch(/over/);
      expect(service.endSoloGameIfOver()).toBe(false); // once is enough
    });

    it('a negative monthly cashflow ends it as bankrupt, and drops the card that was open', () => {
      startSolo();
      service.rng = die(1); // a Deals space: a decision is open
      service.rollTurn(1, callbacks());
      expect(service.soloTurn.phase).toBe('decide');

      addGameSubscription('Yacht', -999999);
      service.endSoloGameIfOver();

      expect(service.soloTurn).toEqual({
        phase: 'over',
        count: 1,
        outcome: 'bankrupt',
        lastRoll: [1],
      });
    });

    it('is noticed when the transactions or subscriptions change: no roll needed', async () => {
      startSolo();
      addGameSubscription('Haus Cashflow', 99999);

      AppStateService.instance.subscriptionsUpdated$.next(); // what a purchase made in the Add dialog sends
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(service.soloTurn.phase).toBe('over');
    });

    it('persists the ending, and never touches a companion game', () => {
      startSolo();
      addGameSubscription('Haus Cashflow', 99999);
      persistence.batchWriteAndSync.mockClear();
      service.endSoloGameIfOver();
      const writes = persistence.batchWriteAndSync.mock.calls[0][0].writes;
      expect(writes.find((w: any) => w.tag === 'cashflowGame').data.turn.phase).toBe('over');

      (AppStateService as any)._instance = undefined;
      service.pickProfession('placeholder', 'placeholder-profession', callbacks()); // companion
      addGameSubscription('Haus Cashflow', 99999);
      expect(service.endSoloGameIfOver()).toBe(false);
      expect(AppStateService.instance.cashflowGame.turn).toBeUndefined();
    });

    it('Undo of the move that caused the ending brings the game back, still being played', () => {
      startSolo();
      service.rng = die(2);
      service.rollTurn(1, callbacks()); // the move
      addGameSubscription('Haus Cashflow', 99999); // what the move bought
      service.endSoloGameIfOver();
      expect(service.soloTurn.phase).toBe('over');

      service.undoLastAction(callbacks());

      expect(service.soloTurn).toEqual({ phase: 'roll', count: 0 });
      expect(service.cannotRollBecause).toBeNull();
    });

    it('a card space leaves the turn open until the card is settled; passing is an undoable step', () => {
      startSolo();
      service.rng = die(1); // space 0: a Deals space
      service.rollTurn(1, callbacks());
      expect(service.soloTurn.phase).toBe('decide');
      expect(service.soloTurn.pending).toEqual({ kind: 'deal', spaceIndex: 0 });
      const blocked = callbacks();
      expect(service.rollTurn(1, blocked)).toBeNull();
      expect(blocked.onError).toHaveBeenCalledWith(expect.stringMatching(/card/));

      service.settleSoloDecision('passed', callbacks());
      expect(service.soloTurn.phase).toBe('roll');
      expect(service.historySteps()[0].kind).toBe('skipCard');
      service.undoLastAction(callbacks());
      expect(service.soloTurn.phase).toBe('decide');

      service.settleSoloDecision('done', callbacks());
      expect(service.soloTurn.phase).toBe('roll');
      expect(service.historySteps()[0].kind).toBe('roll'); // 'done' adds no step of its own
    });

    it('persists the new token and turn with the game', () => {
      startSolo();
      persistence.batchWriteAndSync.mockClear();
      service.rng = die(1);
      service.rollTurn(1, callbacks());
      const writes = persistence.batchWriteAndSync.mock.calls[0][0].writes;
      const game = writes.find((write: any) => write.tag === 'cashflowGame').data;
      expect(game.boardPosition).toBe(0);
      expect(game.turn.phase).toBe('decide');
    });

    it('a finished game cannot be rolled, and reports its summary', () => {
      startSolo();
      const state = AppStateService.instance;
      state.cashflowGame = {
        ...state.cashflowGame,
        turn: { phase: 'over', count: 9, outcome: 'escaped' },
      };
      const refused = callbacks();
      expect(service.rollTurn(1, refused)).toBeNull();
      expect(refused.onError).toHaveBeenCalledWith(expect.stringMatching(/over/));
      expect(service.soloSummary().outcome).toBe('escaped');
    });
  });

  describe('the live history in the account (JFK, 2026-10-05)', () => {
    const callbacks = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
    const started = () =>
      service.pickProfession('placeholder', 'placeholder-profession', callbacks());

    it('announces every change of the history, and stamps it', () => {
      const changed = jest.fn();
      service.historyChanged$.subscribe(changed);
      service.clock = { ...service.clock, nowIso: () => '2026-10-05T10:00:00.000Z' };

      started();
      expect(changed).toHaveBeenCalled();
      expect(service.historyUpdatedAt).toBe('2026-10-05T10:00:00.000Z');

      changed.mockClear();
      service.resolveBaby(callbacks());
      expect(changed).toHaveBeenCalled();
      service.undoLastAction(callbacks());
      expect(changed).toHaveBeenCalledTimes(2);
    });

    it('the stored history lists every step and carries the stamp', () => {
      started();
      service.resolveBaby(callbacks());
      const history = service.liveHistory();
      expect(history.steps.map((s) => s.kind)).toEqual(['start', 'baby']);
      expect(history.updatedAt).toBe(service.historyUpdatedAt);
    });

    it('a reset announces an empty history; logout announces nothing and keeps the account untouched', () => {
      started();
      const changed = jest.fn();
      service.historyChanged$.subscribe(changed);

      service.clearPersistedUndoStack();
      expect(changed).not.toHaveBeenCalled();
      expect(service.historyUpdatedAt).toBeNull();
      expect(localStorage.getItem('cashflowUndoStackAt')).toBeNull();

      started();
      changed.mockClear();
      const gameAccount = jest.spyOn(CashflowGameService, 'isCashflowGame').mockReturnValue(true);
      service.resetGame(callbacks());
      gameAccount.mockRestore();
      expect(changed).toHaveBeenCalled();
      expect(service.liveHistory().steps).toEqual([]);
    });

    it('adopts the account’s history only when it is newer, without writing it back', () => {
      started();
      service.resolveBaby(callbacks());
      const mine = service.liveHistory();
      const changed = jest.fn();
      service.historyChanged$.subscribe(changed);

      // an older or equal copy changes nothing
      expect(service.adoptAccountHistory({ ...mine, updatedAt: '2000-01-01T00:00:00.000Z' })).toBe(
        false,
      );
      expect(service.adoptAccountHistory(mine)).toBe(false);

      // a newer one replaces the history (here: the one from before the baby)
      service.undoLastAction(callbacks());
      const shorter = service.liveHistory();
      changed.mockClear();
      const newer = { ...mine, updatedAt: '2999-01-01T00:00:00.000Z' };
      expect(service.adoptAccountHistory(newer)).toBe(true);
      expect(service.historyUpdatedAt).toBe('2999-01-01T00:00:00.000Z');
      expect(service.liveHistory().steps.length).toBeGreaterThan(shorter.steps.length);
      expect(changed).not.toHaveBeenCalled();
      expect(localStorage.getItem('cashflowUndoStackAt')).toBe('2999-01-01T00:00:00.000Z');
    });

    it('refuses a damaged account history', () => {
      started();
      expect(service.adoptAccountHistory({ schema: 1, updatedAt: '2999', undo: 'x' })).toBe(false);
      expect(service.adoptAccountHistory(null)).toBe(false);
      expect(service.canUndo).toBe(true);
    });
  });

  describe('profession content translation (todo/cashflow-game.md decision 48)', () => {
    /** A stand-in for a non-German active language, translating exactly the real "hausmeister" profession's content — proves actual translation happens, not just that the fallback-to-German path (already covered elsewhere) still works. */
    function fakeTranslate(): { instant: jest.Mock } {
      const TRANSLATIONS: Record<string, string> = {
        'CashflowGame.salary': 'Salary',
        'CashflowGame.savings': 'Savings',
        'CashflowGame.childrenExpenses': 'Children Expenses',
        'CashflowGame.salarySubscriptionTitle': '{{profession}} Salary',
        'CashflowGame.childrenExpensesSubscriptionTitle': '{{profession}} Children Expenses',
        'CashflowGame.savingsTransactionComment': '{{profession}} savings',
        'CashflowGame.profession.hausmeister.title': 'Caretaker',
        'CashflowGame.expenseLine.taxes': 'Taxes',
        'CashflowGame.expenseLine.mortgageRent': 'Home Mortgage / Rent',
        'CashflowGame.expenseLine.studentLoan': 'Student Loan Payment',
        'CashflowGame.expenseLine.carLoan': 'Car Loan Payment',
        'CashflowGame.expenseLine.creditCard': 'Credit Card Payment',
        'CashflowGame.expenseLine.miscExpenses': 'Miscellaneous Expenses',
        'CashflowGame.expenseLine.bankLoanPayment': 'Bank Loan Payments',
        'CashflowGame.liabilityTag.mortgage': 'Home Mortgage',
        'CashflowGame.liabilityTag.carLoan': 'Car Loan',
        'CashflowGame.liabilityTag.creditCardDebt': 'Credit Card Debt',
      };
      return {
        instant: jest.fn((key: string, params?: Record<string, string>) => {
          const template = TRANSLATIONS[key] ?? key;
          return params
            ? Object.entries(params).reduce((s, [k, v]) => s.replace(`{{${k}}}`, v), template)
            : template;
        }),
      };
    }

    function startHausmeister(): CashflowGameService {
      const incomeStatement = new IncomeStatementService({ saveData: jest.fn() } as any);
      const translatedService = new CashflowGameService(
        persistence as any,
        incomeStatement,
        fakeTranslate() as any,
      );
      translatedService.pickProfession('cashflow', 'hausmeister', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
      return translatedService;
    }

    it('new records use the currently-selected language instead of game-sets.ts’s own German — JFK, 2026-09-29+: "can we have this in all 6 languages and we translate all of these values"', () => {
      startHausmeister();

      const state = AppStateService.instance;
      expect(state.allSubscriptions[0]).toMatchObject({
        title: 'Caretaker Salary',
        category: '@Salary',
      });
      const taxes = state.allSubscriptions.find((s) => s.category === '@Taxes');
      expect(taxes).toMatchObject({ title: 'Taxes', amount: -300 });
      expect(state.allTransactions[0]).toMatchObject({
        category: '@Savings',
        comment: expect.stringContaining('Caretaker savings'),
      });
      expect(state.liabilities).toContainEqual(expect.objectContaining({ tag: 'Home Mortgage' }));
    });

    it('gameSubscriptionTitles matches the translated titles, so Payday can still find them', () => {
      const translatedService = startHausmeister();

      translatedService.payday({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      expect(state.allTransactions.some((t) => t.category === '@Salary')).toBe(true);
      expect(state.allTransactions.some((t) => t.category === '@Taxes')).toBe(true);
    });

    it('a second Baby scales the same translated Subscription instead of creating a duplicate', () => {
      const translatedService = startHausmeister();

      translatedService.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });
      translatedService.resolveBaby({ onSuccess: jest.fn(), onError: jest.fn() });

      const state = AppStateService.instance;
      const childExpenses = state.allSubscriptions.filter((s) =>
        s.title.includes('Children Expenses'),
      );
      expect(childExpenses).toHaveLength(1);
      expect(childExpenses[0]).toMatchObject({
        title: 'Caretaker Children Expenses',
        amount: -200,
      });
      expect(
        state.cashflowGame.gameSubscriptionTitles.filter(
          (t) => t === 'Caretaker Children Expenses',
        ),
      ).toHaveLength(1);
    });

    it('falls back to game-sets.ts’s own string when a profession has no translation authored yet', () => {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });

      expect(AppStateService.instance.allSubscriptions[0].title).toBe(
        'Placeholder profession Salary',
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

  // ── Characterization tests for the rules todo/cashflow-game-pro.md slice A0 inventories ─────────
  // These pin today's behaviour of the helpers the shared domain engine will take over (A1/A2), so a
  // move cannot change what they do unnoticed. "Pinned" means pinned, not endorsed.

  describe('A0 characterization: cash on hand', () => {
    const income = (amount: number) => ({
      account: 'Income',
      amount,
      date: '2026-01-01',
      time: '',
      category: '@Test',
      comment: '',
    });

    it('is the Daily + Splurge + Smile + Fire total: each account’s own entries plus its share of Income', () => {
      const state = AppStateService.instance;
      state.allTransactions = [
        income(1000),
        { ...income(-200), account: 'Daily' },
        { ...income(-50), account: 'Fire' },
      ];
      expect(service.cash).toBe(750);
    });

    it('does not depend on the allocation ratios when the shares add back up cleanly', () => {
      const state = AppStateService.instance;
      state.allTransactions = [income(1000)];
      state.daily = 25;
      state.splurge = 25;
      state.smile = 25;
      state.fire = 25;
      expect(service.cash).toBe(1000);
    });

    it('PINNED QUIRK: each account’s share of an Income entry is rounded to the cent on its own, so a tiny amount can drift by a cent', () => {
      // 0.05 split 60/10/10/20 is 0.03 + 0.005 + 0.005 + 0.01; the two 0.005 shares each round up to
      // 0.01, so "cash" reads 0.06. The API must reproduce this to the cent to match the UI - or fix it
      // deliberately, in its own commit, in both places.
      AppStateService.instance.allTransactions = [income(0.05)];
      expect(service.cash).toBe(0.06);
    });
  });

  describe('A0 characterization: rollDie', () => {
    afterEach(() => jest.restoreAllMocks());

    it('maps the random source onto 1..6 inclusive', () => {
      const random = jest.spyOn(Math, 'random');
      random.mockReturnValue(0);
      expect(service.rollDie()).toBe(1);
      random.mockReturnValue(0.5);
      expect(service.rollDie()).toBe(4);
      random.mockReturnValue(0.999999);
      expect(service.rollDie()).toBe(6);
    });

    it('rolls from the injected source when one is set - the same seed rolls the same game', () => {
      const play = (seed: number) => {
        service.rng = seededRng(seed);
        return Array.from({ length: 8 }, () => service.rollDie());
      };
      expect(play(5)).toEqual(play(5));
      service.rng = () => 0.5;
      expect(service.rollDie()).toBe(4);
    });
  });

  describe('A0 characterization: the running game’s identity and summary', () => {
    function started() {
      service.pickProfession('placeholder', 'placeholder-profession', {
        onSuccess: jest.fn(),
        onError: jest.fn(),
      });
    }

    it('liveProfessionTitle is null before a game starts and the card’s title afterwards', () => {
      expect(service.liveProfessionTitle()).toBeNull();
      started();
      expect(service.liveProfessionTitle()).toBe('Placeholder profession');
    });

    it('liveGameSummary reports round, children, loan, cash and cashflow straight from the live game', () => {
      started();
      const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
      service.payday(ok());
      service.resolveBaby(ok());
      service.adjustBankLoan(2000, ok());

      const summary = service.liveGameSummary();

      expect(summary).toMatchObject({
        gameSetId: 'placeholder',
        professionId: 'placeholder-profession',
        round: 1,
        children: 1,
        bankLoanMinor: 200000,
        escapedRatRace: false,
      });
      expect(summary.cashMinor).toBe(Math.round(service.cash * 100));
      expect(summary.monthlyCashflowMinor).toBe(Math.round(service.monthlyCashflow * 100));
      expect(summary.bankrupt).toBe(service.monthlyCashflow < 0);
      expect(summary.transactionCount).toBe(AppStateService.instance.allTransactions.length);
      expect(summary.salaryMinor).toBeGreaterThan(0);
      expect(summary.expensesMinor).toBeGreaterThan(0);
    });

    it('setGameIdentity gives the game its saved slot and persists it; clearGameIdentity drops it again', () => {
      started();
      const ok = { onSuccess: jest.fn(), onError: jest.fn() };

      service.setGameIdentity('game_1', 'My game', ok);
      expect(AppStateService.instance.cashflowGame).toMatchObject({
        gameId: 'game_1',
        gameName: 'My game',
      });
      expect(persistence.batchWriteAndSync).toHaveBeenLastCalledWith(
        expect.objectContaining({ logEvent: 'cashflow_game_identity' }),
      );

      service.clearGameIdentity(ok);
      expect('gameId' in AppStateService.instance.cashflowGame).toBe(false);
      expect('gameName' in AppStateService.instance.cashflowGame).toBe(false);
    });

    it('Undo keeps the saved slot even when it goes back to a step from before the game was first saved', () => {
      started();
      const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });
      service.payday(ok());
      service.setGameIdentity('game_1', 'My game', ok());

      service.undoLastAction(ok()); // takes back the Payday, which was taken before the game had an identity

      expect(AppStateService.instance.cashflowGame.round).toBe(0);
      expect(AppStateService.instance.cashflowGame).toMatchObject({
        gameId: 'game_1',
        gameName: 'My game',
      });
    });

    it('isGameSnapshot accepts a captured snapshot and rejects anything shaped differently', () => {
      started();
      expect(service.isGameSnapshot(service.captureGameSnapshot())).toBe(true);

      const good = service.captureGameSnapshot() as any;
      for (const broken of [
        null,
        undefined,
        {},
        'not a snapshot',
        { ...good, allTransactions: undefined },
        { ...good, mojo: undefined },
        { ...good, cashflowGame: undefined },
        { ...good, cashflowGame: { ...good.cashflowGame, gameSubscriptionTitles: 'x' } },
      ]) {
        expect(service.isGameSnapshot(broken)).toBe(false);
      }
    });

    it('restoreGameSnapshot refuses a foreign file and leaves the live game alone', () => {
      started();
      const onError = jest.fn();
      const before = AppStateService.instance.cashflowGame;

      service.restoreGameSnapshot({} as any, { onSuccess: jest.fn(), onError });

      expect(onError).toHaveBeenCalledWith('This is not a Cashflow game.');
      expect(AppStateService.instance.cashflowGame).toBe(before);
    });
  });

  describe('A1(b): round rules applied through the shared domain functions', () => {
    const ok = () => ({ onSuccess: jest.fn(), onError: jest.fn() });

    it('a second Baby edits the same subscription in place, keeping what else is on it', () => {
      service.pickProfession('placeholder', 'placeholder-profession', ok());
      service.resolveBaby(ok());
      const state = AppStateService.instance;
      const children = state.allSubscriptions.find((s) => s.title.includes('Children Expenses'))!;
      const history = [
        {
          effectiveDate: '2026-01-01',
          field: 'amount' as const,
          oldValue: 1,
          newValue: 2,
        },
      ];
      children.changeHistory = history;
      const startDate = children.startDate;

      service.resolveBaby(ok());

      const after = state.allSubscriptions.filter((s) => s.title.includes('Children Expenses'));
      expect(after).toHaveLength(1);
      expect(after[0]).toBe(children); // edited in place, not replaced
      expect(after[0].changeHistory).toBe(history);
      expect(after[0].startDate).toBe(startDate);
      expect(after[0].amount).toBeCloseTo(children.amount, 5);
    });

    it('Payday uses the injected clock for the month it posts into', () => {
      service.clock = { todayIso: () => '2030-03-10', nowIso: () => '2030-03-10T08:00:00.000Z' };
      service.pickProfession('placeholder', 'placeholder-profession', ok());

      service.payday(ok());

      const posted = AppStateService.instance.allTransactions.filter((t) =>
        t.comment.includes('#cashflow'),
      );
      expect(posted.length).toBeGreaterThan(1);
      expect(
        AppStateService.instance.allTransactions
          .slice(1) // the first is the starting Savings transaction
          .every((t) => t.date.startsWith('2030-03-')),
      ).toBe(true);
    });
  });

  describe('A0 characterization: removeSubscriptionByTitle', () => {
    it('removes exactly the subscription with that title and ignores a missing one', () => {
      const state = AppStateService.instance;
      const sub = (title: string) =>
        ({
          title,
          account: 'Daily',
          amount: -1,
          startDate: '2026-01-01',
          endDate: '',
          category: '',
          comment: '',
          frequency: 'monthly',
        }) as any;
      state.allSubscriptions = [sub('A'), sub('B'), sub('C')];

      service.removeSubscriptionByTitle('B');
      expect(state.allSubscriptions.map((s) => s.title)).toEqual(['A', 'C']);

      service.removeSubscriptionByTitle('nope');
      expect(state.allSubscriptions.map((s) => s.title)).toEqual(['A', 'C']);
    });
  });
});
