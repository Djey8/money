import { Injectable } from '@angular/core';
import {
  addMonthsToIsoDate,
  adjustCashflowBankLoan,
  CASHFLOW_GAME_SETS,
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowGameSet,
  CashflowGameState,
  CashflowGameSubscription,
  CashflowMarketCard,
  CashflowProfession,
  CashflowStarterKitSubscription,
  CashflowTransactionRecord,
  calculateBuyInvestment,
  calculateBuyShare,
  clearCashflowStatus,
  computeMonthlyCashflowMinor,
  drawRandomCard,
  findCards,
  fromMinorUnits,
  initialCashflowGameState,
  multiplyQuantityPrice,
  pickCashflowProfession,
  resolveCashflowBaby,
  resolveCashflowCharity,
  resolveCashflowDownsized,
  runCashflowPayday,
  toMinorUnits,
} from '@money/domain';
import { AppStateService } from './app-state.service';
import { IncomeStatementService } from './income-statement.service';
import { PersistenceService } from './persistence.service';
import { ProfileComponent } from '../../panels/profile/profile.component';
import { Transaction } from '../../interfaces/transaction';
import { Subscription } from '../../interfaces/subscription';
import { Grow } from '../../interfaces/grow';
import { Asset } from '../../interfaces/asset';
import { Share } from '../../interfaces/share';
import { Investment } from '../../interfaces/investment';
import { Liability } from '../../interfaces/liability';
import { Smile } from '../../interfaces/smile';
import { Fire } from '../../interfaces/fire';
import { Mojo } from '../../interfaces/mojo';

export interface CashflowGameCallbacks {
  onSuccess: () => void;
  onError: (message: string) => void;
}

/** A Deal card resolved through the app's existing Grow feature (todo/cashflow-game.md decision 10) — not a new entity type, just the two shapes Grow's own buy actions need. */
export interface CashflowDealShareInput {
  kind: 'share';
  title: string;
  quantity: number;
  price: number;
}
export interface CashflowDealInvestmentInput {
  kind: 'investment';
  title: string;
  deposit: number;
  mortgage: number;
  /** The property's periodic income — becomes the Grow project's planned `cashflow` and a real Subscription. */
  cashflow: number;
}
export type CashflowDealInput = CashflowDealShareInput | CashflowDealInvestmentInput;

/** Which card shape each deck holds — gives `drawCard`/`findCardsInDeck` a properly narrowed return per deck (todo/cashflow-game.md decision 16). */
interface CashflowDeckCardMap {
  dealSmall: CashflowDealCard;
  dealBig: CashflowDealCard;
  market: CashflowMarketCard;
  doodad: CashflowDoodadCard;
}

export interface CashflowCardCallbacks<T> {
  onSuccess: (card: T) => void;
  onError: (message: string) => void;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toFloatTransaction(record: CashflowTransactionRecord): Transaction {
  return {
    account: record.account,
    amount: fromMinorUnits(record.amountMinor),
    date: record.date,
    time: record.time,
    category: record.category,
    comment: record.comment,
  };
}

/** Every real entity a cashflow-game action can touch — a full copy of this is one undo step (JFK, 2026-09-29+: "we need to keep track of the history of inputs... we need to make sure we can revert each move"). Includes Smile/Fire/Mojo even though only `resetGame` ever touches them, so undoing a reset restores those too, not just the game's own bookkeeping. Plain JSON data throughout, so a deep clone is just a stringify/parse round-trip. */
interface CashflowGameSnapshot {
  allTransactions: Transaction[];
  allSubscriptions: Subscription[];
  allGrowProjects: Grow[];
  allShares: Share[];
  allInvestments: Investment[];
  allAssets: Asset[];
  liabilities: Liability[];
  allSmileProjects: Smile[];
  allFireEmergencies: Fire[];
  mojo: Mojo;
  cashflowGame: CashflowGameState;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** How many past actions can be undone in a row — comfortably more than one play session needs, cheap to keep since a snapshot is just this small game's own data. */
const UNDO_STACK_LIMIT = 50;

/**
 * Raw `localStorage`, deliberately not `LocalService`/`PersistenceService` — those encrypt and sync
 * to the DB, which the undo stack must never do (JFK, 2026-09-29+: "can we at least persist the
 * history in the local storage of the browser? so it survives a reload, refresh, npm start... but
 * not a clear browser cache"). A page reload/dev-server restart reads it straight back; clearing
 * the browser's site data removes it same as everything else — no extra code needed for that part.
 */
const UNDO_STACK_STORAGE_KEY = 'cashflowUndoStack';

/**
 * Replaces `GameModeService`'s two date-shifting methods with automation
 * scoped to only what the game itself creates — see todo/cashflow-game.md.
 * Everything financial (Subscription/Transaction/Asset/Investment/Share/
 * Liability) is a real entity; this service only owns
 * `AppStateService.cashflowGame`, the small game-meta state.
 */
@Injectable({ providedIn: 'root' })
export class CashflowGameService {
  readonly gameSets = CASHFLOW_GAME_SETS;

  /**
   * Not synced to the DB — see `UNDO_STACK_STORAGE_KEY`'s own comment. Starts from whatever's in
   * localStorage (a prior reload/restart's leftovers), so it survives across those; `logOut()`
   * (both editions) calls `clearPersistedUndoStack()` so a different login never inherits it.
   */
  private undoStack: CashflowGameSnapshot[] = this.loadPersistedUndoStack();

  constructor(
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService,
  ) {}

  static isCashflowGame(): boolean {
    return Boolean(ProfileComponent.mail && ProfileComponent.mail.includes('cashflow'));
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Guarded like `CrypticService.loadConfig()` — a corrupt or missing entry just starts empty rather than breaking the app. */
  private loadPersistedUndoStack(): CashflowGameSnapshot[] {
    try {
      const raw = localStorage.getItem(UNDO_STACK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /** `localStorage.setItem` can throw (quota, private-browsing) — the in-memory stack still works for the rest of this session either way. */
  private persistUndoStack(): void {
    try {
      localStorage.setItem(UNDO_STACK_STORAGE_KEY, JSON.stringify(this.undoStack));
    } catch {
      // best-effort only
    }
  }

  /** Snapshots every real entity a game action can touch, right before that action mutates anything — one call per public mutating method, always before its first mutation. */
  private pushUndoSnapshot(): void {
    const state = AppStateService.instance;
    this.undoStack.push(
      deepClone({
        allTransactions: state.allTransactions,
        allSubscriptions: state.allSubscriptions,
        allGrowProjects: state.allGrowProjects,
        allShares: state.allShares,
        allInvestments: state.allInvestments,
        allAssets: state.allAssets,
        liabilities: state.liabilities,
        allSmileProjects: state.allSmileProjects,
        allFireEmergencies: state.allFireEmergencies,
        mojo: state.mojo,
        cashflowGame: state.cashflowGame,
      }),
    );
    if (this.undoStack.length > UNDO_STACK_LIMIT) this.undoStack.shift();
    this.persistUndoStack();
  }

  /**
   * Called from both editions' logout flows — a different login must never see the previous
   * session's undo history, neither in memory on this running singleton nor in localStorage (JFK,
   * 2026-09-29+: "when we logout we remove also this part for the localStorage. So logout login we
   * dont have a history, just refresh we still have the current game history").
   */
  clearPersistedUndoStack(): void {
    this.undoStack = [];
    try {
      localStorage.removeItem(UNDO_STACK_STORAGE_KEY);
    } catch {
      // best-effort only
    }
  }

  /**
   * Reverts the single most recent cashflow-game action — Start Game, Payday, Baby, Charity,
   * Downsized, a bank loan borrow/repay, planning/executing a Deal, a Doodad, or a Reset — back to
   * exactly the state before it ran, whichever one it was (JFK, 2026-09-29+: "I accidentally
   * pressed the wrong button... we need to make sure we can revert each move, so after a revert
   * the game is in a state before he did the action"). Calling it repeatedly walks back further,
   * one action at a time. Replaces the old Payday-only undo, which refused to undo anything else.
   */
  undoLastAction(callbacks: CashflowGameCallbacks): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      callbacks.onError('Nothing to undo.');
      return;
    }
    this.persistUndoStack();
    const state = AppStateService.instance;
    state.allTransactions = snapshot.allTransactions;
    state.allSubscriptions = snapshot.allSubscriptions;
    state.allGrowProjects = snapshot.allGrowProjects;
    state.allShares = snapshot.allShares;
    state.allInvestments = snapshot.allInvestments;
    state.allAssets = snapshot.allAssets;
    state.liabilities = snapshot.liabilities;
    state.allSmileProjects = snapshot.allSmileProjects;
    state.allFireEmergencies = snapshot.allFireEmergencies;
    state.mojo = snapshot.mojo;
    state.cashflowGame = snapshot.cashflowGame;
    this.persistAll('cashflow_undo_action', {}, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** Starts a new game: materializes the profession's starter kit as real entities. */
  pickProfession(gameSetId: string, professionId: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof pickCashflowProfession>;
    try {
      result = pickCashflowProfession(this.gameSets, gameSetId, professionId, todayIso());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not start the game.'));
      return;
    }
    this.pushUndoSnapshot();

    result.startingTransactions.forEach((record) =>
      state.allTransactions.push(toFloatTransaction(record)),
    );

    const usedDays = this.currentMonthGameSubscriptionDays();
    result.subscriptions.forEach((sub) => {
      const subscription: Subscription = {
        title: sub.title,
        account: sub.account,
        amount: fromMinorUnits(sub.amountMinor),
        startDate: this.nextSmartSubscriptionDate(usedDays),
        endDate: '',
        category: sub.category ?? '',
        comment: sub.comment ? `${sub.comment}\n#cashflow` : '#cashflow',
        frequency: sub.frequency,
      };
      state.allSubscriptions.push(subscription);
    });
    (result.starterKit.assets ?? []).forEach((asset) =>
      state.allAssets.push({ tag: asset.tag, amount: fromMinorUnits(asset.amountMinor) }),
    );
    (result.starterKit.investments ?? []).forEach((investment) =>
      state.allInvestments.push({
        tag: investment.tag,
        amount: fromMinorUnits(investment.amountMinor),
        deposit: fromMinorUnits(investment.depositMinor),
      }),
    );
    (result.starterKit.shares ?? []).forEach((share) =>
      state.allShares.push({
        tag: share.tag,
        quantity: share.quantity,
        price: fromMinorUnits(share.priceMinor),
      }),
    );
    (result.starterKit.liabilities ?? []).forEach((liability) =>
      state.liabilities.push({
        tag: liability.tag,
        amount: fromMinorUnits(liability.amountMinor),
        investment: false,
        credit: 0,
      }),
    );

    state.cashflowGame = result.state;
    this.persistAll('start_cashflow_game', { gameSetId, professionId }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
  }

  /**
   * Runs Payday: every prior game transaction ages back a month first, then this round's
   * transactions each land on their own Subscription's own `startDate` day-of-month, within the
   * current real month — so the player controls the spread by editing Subscription dates, same as
   * they'd edit the account/category/amount (JFK, 2026-09-29: "this should be handled with the
   * Date in the Subscription, the date we have there is what will be used, so the user can modify
   * it... if the user wants to change them he can by modifying the subscription date"). A day that
   * doesn't exist in the current month (e.g. a Subscription dated the 31st, posted in a 30-day
   * month) clamps to that month's actual last day — the same clamp `shiftGameTransactionDates`
   * already applies every round after, so once a transaction has been clamped once it just keeps
   * that shorter day going forward (JFK: "its ok that from that onwards we will move it back on 28
   * february"). The engine's own `virtualDate` still advances forward as before — it's only ever
   * used for round-tracking/loan math, not for what date actually gets persisted.
   */
  payday(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const ownedSubscriptions = this.ownedGameSubscriptions();
    let result: ReturnType<typeof runCashflowPayday>;
    try {
      result = runCashflowPayday(state.cashflowGame, this.gameSubscriptions());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not run Payday.'));
      return;
    }
    this.pushUndoSnapshot();

    this.shiftGameTransactionDates(-1);

    const [year, month] = todayIso().split('-').map(Number);
    const datedTransactions = result.transactions.map((record, index) => ({
      ...record,
      date: this.dateFromSubscriptionDay(ownedSubscriptions[index], year, month),
    }));
    datedTransactions.forEach((record) => state.allTransactions.push(toFloatTransaction(record)));

    // Keep history's own copy in sync with the dates actually persisted, so the History list shows
    // the dates that actually got saved.
    const history = [...result.state.history];
    history[history.length - 1] = {
      ...history[history.length - 1],
      createdTransactions: datedTransactions,
    };

    state.cashflowGame = { ...result.state, history };
    this.persistAll('cashflow_payday', { round: result.state.round }, callbacks);
  }

  /** Every `#cashflow`-tagged transaction — never anything from the player's own (non-game) bookkeeping. */
  private shiftGameTransactionDates(months: number): void {
    for (const transaction of AppStateService.instance.allTransactions) {
      if (transaction.comment?.includes('#cashflow')) {
        transaction.date = addMonthsToIsoDate(transaction.date, months);
      }
    }
  }

  /** The real Subscriptions Payday owns, in the exact order the engine paired them with `result.transactions` (`ownedSubscriptions` in engine.ts — same titles, same filter, same order) — lets each transaction pick up its own Subscription's `startDate`. */
  private ownedGameSubscriptions(): Subscription[] {
    const state = AppStateService.instance;
    const byTitle = new Map(state.allSubscriptions.map((sub) => [sub.title, sub]));
    return state.cashflowGame.gameSubscriptionTitles
      .map((title) => byTitle.get(title))
      .filter((sub): sub is Subscription => sub !== undefined);
  }

  /** One Subscription's own `startDate` day-of-month, placed in the given real year/month — clamped to that month's actual length (JFK, 2026-09-29: "we just need to make sure the highest day used is the 28th, because of February", "same for 31 to 30 month"). */
  private dateFromSubscriptionDay(
    subscription: Subscription | undefined,
    year: number,
    month: number,
  ): string {
    const day = subscription ? Number(subscription.startDate.split('-')[2]) || 1 : 1;
    const clampedDay = Math.min(day, new Date(year, month, 0).getDate());
    return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }

  /**
   * Every day-of-month already used by another `#cashflow` Subscription this real month — what a
   * newly auto-created Subscription's date needs to avoid (JFK, 2026-09-29+: "each transaction
   * should have its own date in the month, if possible not overlapping").
   */
  private currentMonthGameSubscriptionDays(): Set<number> {
    const prefix = `${todayIso().slice(0, 7)}-`;
    const days = new Set<number>();
    for (const sub of AppStateService.instance.allSubscriptions) {
      if (sub.comment?.includes('#cashflow') && sub.startDate?.startsWith(prefix)) {
        days.add(Number(sub.startDate.split('-')[2]));
      }
    }
    return days;
  }

  /** A day-of-month for a newly auto-created Subscription: every other day (1st, 3rd, 5th, ...) before any day already taken, so a profession's Salary/expenses land spread out by default — JFK, 2026-09-29+: "spread out as before these transactions (salary on the first, tax on third ...)". Falls back to any free day, then to reusing whichever day is least crowded, rather than ever refusing to create the Subscription. */
  private nextSmartSubscriptionDate(usedDays: Set<number>): string {
    const [year, month] = todayIso().split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    let day: number | undefined;
    for (let candidate = 1; candidate <= daysInMonth; candidate += 2) {
      if (!usedDays.has(candidate)) {
        day = candidate;
        break;
      }
    }
    if (day === undefined) {
      for (let candidate = 1; candidate <= daysInMonth; candidate++) {
        if (!usedDays.has(candidate)) {
          day = candidate;
          break;
        }
      }
    }
    if (day === undefined) {
      day = Math.min(daysInMonth, usedDays.size + 1);
    }
    usedDays.add(day);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** Resolves a Baby space: +1 child (max 3), scales the children-expense Subscription. */
  resolveBaby(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const profession = this.currentProfession();
    if (!profession) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    let result: ReturnType<typeof resolveCashflowBaby>;
    try {
      result = resolveCashflowBaby(state.cashflowGame, profession);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Baby.'));
      return;
    }
    this.pushUndoSnapshot();
    this.upsertSubscription(result.subscriptionUpsert);
    state.cashflowGame = result.state;
    this.persistAll('cashflow_baby', { children: result.state.children }, callbacks, {
      includeSubscriptions: true,
    });
  }

  /** Resolves a Charity space: pays 10% of total income now, unlocks the dice choice for 3 Paydays. */
  resolveCharity(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof resolveCashflowCharity>;
    try {
      result = resolveCashflowCharity(state.cashflowGame, this.gameSubscriptions());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Charity.'));
      return;
    }
    this.pushUndoSnapshot();
    state.allTransactions.push(toFloatTransaction(result.transaction));
    state.cashflowGame = result.state;
    this.persistAll('cashflow_charity', {}, callbacks);
  }

  /** Resolves a Downsized space: pays total expenses once, sits out 2 Paydays (ends an active charity bonus). */
  resolveDownsized(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof resolveCashflowDownsized>;
    try {
      result = resolveCashflowDownsized(state.cashflowGame, this.gameSubscriptions());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Downsized.'));
      return;
    }
    this.pushUndoSnapshot();
    result.transactions.forEach((record) => state.allTransactions.push(toFloatTransaction(record)));
    state.cashflowGame = result.state;
    this.persistAll('cashflow_downsized', {}, callbacks);
  }

  /** Takes (`delta > 0`) or repays (`< 0`) a bank loan in the game set's increment (a decimal amount, like everywhere else in the app); upserts the Liability + interest Subscription, recomputed from the new principal every time. */
  adjustBankLoan(delta: number, callbacks: CashflowGameCallbacks): void {
    this.pushUndoSnapshot();
    try {
      this.applyBankLoanAdjustment(delta);
    } catch (err: unknown) {
      this.undoStack.pop(); // nothing actually changed — don't leave a no-op entry behind
      this.persistUndoStack();
      callbacks.onError(errorMessage(err, 'Could not adjust the bank loan.'));
      return;
    }
    this.persistAll('cashflow_bank_loan', { delta }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
  }

  /** The mutation `adjustBankLoan` and `dealBuy`'s auto-borrow both need — throws instead of using callbacks so a caller can chain it with other mutations before persisting once. */
  private applyBankLoanAdjustment(delta: number): void {
    const state = AppStateService.instance;
    const gameSet = this.currentGameSet();
    if (!gameSet) throw new Error('Pick a profession first.');
    const currentPrincipalMinor = toMinorUnits(
      state.liabilities.find((liability) => liability.tag === 'Bank loan')?.amount ?? 0,
    );
    const result = adjustCashflowBankLoan(
      state.cashflowGame,
      gameSet,
      currentPrincipalMinor,
      toMinorUnits(delta),
    );
    if (result.liabilityUpsert) {
      this.upsertLiability(result.liabilityUpsert.tag, result.liabilityUpsert.amountMinor);
    } else {
      this.removeLiabilityByTag('Bank loan');
    }
    if (result.subscriptionUpsert) {
      this.upsertSubscription(result.subscriptionUpsert);
    } else {
      this.removeSubscriptionByTitle('Bank loan interest');
    }
    state.cashflowGame = result.state;
  }

  /**
   * Dismisses an active Charity/Downsized reminder once the player's own
   * physical turns have played out — the app can't know when that is
   * (JFK, 2026-09-26: the "N rounds" are the board's turn order, other
   * players' turns for Downsized), so this is a plain acknowledgement, not
   * a financial action: no recalculation, just the one field.
   */
  clearStatus(status: 'charity' | 'unemployed', callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    state.cashflowGame = clearCashflowStatus(state.cashflowGame, status);
    this.persistence.writeAndSync({
      tag: 'cashflowGame',
      data: state.cashflowGame,
      localStorageKey: 'cashflowGame',
      logEvent: `cashflow_clear_${status}`,
      logMetadata: {},
      onSuccess: callbacks.onSuccess,
      onError: (error: any) => callbacks.onError(error?.message || 'Database write failed'),
    });
  }

  /**
   * The recurring "Gesamteinkommen − Gesamtausgaben" — the loss condition:
   * once negative, every future Payday drains cash (JFK, 2026-09-26).
   */
  get monthlyCashflow(): number {
    const state = AppStateService.instance;
    return fromMinorUnits(
      computeMonthlyCashflowMinor(state.cashflowGame, this.gameSubscriptions()),
    );
  }

  /**
   * Total cash on hand: the same Daily+Splurge+Smile+Fire total the Home
   * dashboard shows (each account's own transactions plus its ratio-share
   * of Income) — ratio-independent since the four shares of an Income
   * transaction always sum back to its full amount, so this is accurate
   * whatever the account's allocation setting is. The single source of
   * truth `dealBuy`'s auto-borrow decision and the dashboard both use —
   * JFK, 2026-09-26: reuse the app's own views, don't duplicate them.
   */
  get cash(): number {
    const state = AppStateService.instance;
    return (
      Math.round(
        (state.getAmount('Daily', state.daily / 100) +
          state.getAmount('Splurge', state.splurge / 100) +
          state.getAmount('Smile', state.smile / 100) +
          state.getAmount('Fire', state.fire / 100)) *
          100,
      ) / 100
    );
  }

  /**
   * Saves a Deal's numbers as a Grow project's **plan** — no money moves
   * yet, exactly Grow's own "plan" step (`docs/domain/GROW_GUIDE.md` §3).
   * JFK, 2026-09-26: "first plan (you have the option), then you make it
   * reality" — call `executeDeal` once you've decided to actually buy it.
   * Every card becomes a real Grow project this way, planned or not.
   */
  planDeal(input: CashflowDealInput, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.professionId) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    const existingProject = state.allGrowProjects.find((project) => project.title === input.title);
    if (existingProject && this.conflictingGrowKind(existingProject, input.kind)) {
      callbacks.onError(`"${input.title}" already exists as a different kind of Grow project.`);
      return;
    }
    this.pushUndoSnapshot();
    this.upsertGrowProject(
      input.title,
      existingProject,
      input.kind === 'share'
        ? { share: { tag: input.title, quantity: input.quantity, price: input.price } }
        : {
            cashflow: input.cashflow,
            investment: { tag: input.title, deposit: input.deposit, amount: input.mortgage },
          },
    );
    this.persistAll('cashflow_deal_plan', { kind: input.kind, title: input.title }, callbacks, {
      includeGrow: true,
    });
  }

  /**
   * Buys a **planned** Deal, using exactly the app's existing Grow buy
   * mechanics (`calculateBuyShare`/`calculateBuyInvestment`), the same
   * account (`Fire`, matching `grow.component.ts`'s own `buyProject`) and
   * the same DSL comment format, not a parallel purchase system (decision
   * 10). If cash on hand doesn't cover the plan's cost, it auto-borrows the
   * shortfall (rounded up to the game set's increment) via the Bank loan
   * mechanic first — never Grow's own generic financing attachment, which
   * has no fixed interest rate to automate correctly.
   *
   * A property (`kind: investment`) additionally gets a real Subscription
   * for its cashflow, so it feeds every future Payday automatically — the
   * one thing this game adds on top of "just use Grow": JFK, 2026-09-26,
   * "the cashflow should be automatically added to your income statement
   * and a subscription." Buying more of an already-owned title later is
   * just planning the extra amount and executing again — the calculators
   * already add to whatever position exists.
   */
  executeDeal(title: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.professionId) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    const project = state.allGrowProjects.find((candidate) => candidate.title === title);
    if (!project) {
      callbacks.onError(`No planned deal called "${title}" — plan it first.`);
      return;
    }
    const virtualDate = state.cashflowGame.virtualDate as string;
    const kind: 'share' | 'investment' = project.investment?.tag ? 'investment' : 'share';

    const costMinor =
      kind === 'share'
        ? multiplyQuantityPrice(project.share.quantity, toMinorUnits(project.share.price))
        : toMinorUnits(project.investment.deposit);
    const shortfallMinor = costMinor - toMinorUnits(this.cash);
    this.pushUndoSnapshot();
    try {
      if (shortfallMinor > 0) {
        const gameSet = this.currentGameSet();
        if (!gameSet) throw new Error('Pick a profession first.');
        const incrementMinor = gameSet.loanRule.incrementMinor;
        const borrowMinor = Math.ceil(shortfallMinor / incrementMinor) * incrementMinor;
        this.applyBankLoanAdjustment(fromMinorUnits(borrowMinor));
      }

      const buyResult =
        kind === 'share'
          ? calculateBuyShare({
              title,
              quantity: project.share.quantity,
              priceMinor: toMinorUnits(project.share.price),
              existingShareQuantity:
                state.allShares.find((share) => share.tag === title)?.quantity ?? null,
              existingGrowAmountMinor: toMinorUnits(project.amount ?? 0),
            })
          : calculateBuyInvestment({
              title,
              depositMinor: toMinorUnits(project.investment.deposit),
              mortgageMinor: toMinorUnits(project.investment.amount),
              existingInvestmentDepositMinor: this.existingMinor(
                state.allInvestments.find((investment) => investment.tag === title)?.deposit,
              ),
              existingInvestmentAmountMinor: this.existingMinor(
                state.allInvestments.find((investment) => investment.tag === title)?.amount,
              ),
              existingMortgageLiabilityAmountMinor: this.existingMinor(
                state.liabilities.find((liability) => liability.tag === `M-${title}`)?.amount,
              ),
              existingGrowAmountMinor: toMinorUnits(project.amount ?? 0),
            });

      state.allTransactions.push({
        account: 'Fire',
        amount: fromMinorUnits(buyResult.transactionAmountMinor),
        date: virtualDate,
        time: '',
        category: `@${title}`,
        comment: buyResult.comment,
      });

      if (kind === 'share') {
        const share = buyResult as ReturnType<typeof calculateBuyShare>;
        const patch = {
          tag: title,
          quantity: share.newShareQuantity,
          price: fromMinorUnits(share.newSharePriceMinor),
        };
        this.upsertEntity(state.allShares, title, () => patch);
        this.upsertGrowProject(title, project, {
          amount: fromMinorUnits(buyResult.newGrowAmountMinor),
          share: patch,
        });
      } else {
        const investment = buyResult as ReturnType<typeof calculateBuyInvestment>;
        const patch = {
          tag: title,
          deposit: fromMinorUnits(investment.newInvestmentDepositMinor),
          amount: fromMinorUnits(investment.newInvestmentAmountMinor),
        };
        this.upsertEntity(state.allInvestments, title, () => patch);
        this.upsertLiability(
          investment.mortgageLiabilityPatch.tag,
          investment.mortgageLiabilityPatch.amountMinor,
          true,
        );
        this.upsertGrowProject(title, project, {
          amount: fromMinorUnits(buyResult.newGrowAmountMinor),
          investment: patch,
        });
        this.upsertSubscription({
          title: `${title} Cashflow`,
          account: 'Income',
          amountMinor: toMinorUnits(project.cashflow),
          frequency: 'monthly',
          category: `@${title}`,
        });
      }
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not complete this deal.'));
      return;
    }

    this.persistAll('cashflow_deal_execute', { kind, title }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** Grow projects not yet bought — planned only (todo/cashflow-game.md decision 12): the deal's plan exists, but no real Share/Investment position backs it yet. */
  get plannedDeals(): Grow[] {
    const state = AppStateService.instance;
    return state.allGrowProjects.filter((project) => {
      if (project.investment?.tag) {
        return !state.allInvestments.some((investment) => investment.tag === project.title);
      }
      if (project.share?.tag) {
        return !state.allShares.some((share) => share.tag === project.title);
      }
      return false;
    });
  }

  /**
   * Wipes every real entity the game touches — Transactions, Subscriptions,
   * Grow/Share/Investment/Asset/Liability, Smile/Fire/Mojo — and the
   * game-meta state itself, back to a blank slate. JFK, 2026-09-26: a fast
   * way to start over while playtesting; history/status don't need to
   * survive a reset. Double-gated (the whole page already is) since this is
   * the most destructive action here — never touches a non-cashflow
   * account even if somehow called on one.
   */
  resetGame(callbacks: CashflowGameCallbacks): void {
    if (!CashflowGameService.isCashflowGame()) {
      callbacks.onError('This is only available for a Cashflow game account.');
      return;
    }
    this.pushUndoSnapshot();
    const state = AppStateService.instance;
    state.allTransactions = [];
    state.allSubscriptions = [];
    state.allGrowProjects = [];
    state.allShares = [];
    state.allInvestments = [];
    state.allAssets = [];
    state.liabilities = [];
    state.allSmileProjects = [];
    state.allFireEmergencies = [];
    state.mojo = { amount: 0, target: 0 };
    state.cashflowGame = initialCashflowGameState();

    this.persistAll('cashflow_reset', {}, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /**
   * "Find this card" (todo/cashflow-game.md decision 16): the player drew a
   * real card from their physical deck and searches the digitized deck by
   * title to load its numbers. A pure, synchronous read — nothing to
   * persist, unlike drawing.
   */
  findCardsInDeck<K extends CashflowDeckKind>(
    deckKind: K,
    query: string,
  ): CashflowDeckCardMap[K][] {
    const deck = this.currentGameSet()?.decks?.[deckKind] ?? [];
    return findCards(deck as CashflowDeckCardMap[K][], query);
  }

  /**
   * "Draw a card" (todo/cashflow-game.md decision 16): no physical deck in
   * hand — the app picks at random from whatever this deck hasn't already
   * given out since its last reshuffle, and remembers the pick so the same
   * card doesn't come up twice in a row.
   */
  drawCard<K extends CashflowDeckKind>(
    deckKind: K,
    callbacks: CashflowCardCallbacks<CashflowDeckCardMap[K]>,
  ): void {
    const state = AppStateService.instance;
    const deck = this.currentGameSet()?.decks?.[deckKind];
    if (!deck) {
      callbacks.onError(`This game set has no ${deckKind} cards yet.`);
      return;
    }
    let result: ReturnType<typeof drawRandomCard<CashflowDeckCardMap[K]>>;
    try {
      result = drawRandomCard(
        deck as CashflowDeckCardMap[K][],
        state.cashflowGame.drawnCardIds[deckKind],
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not draw a card.'));
      return;
    }
    state.cashflowGame = {
      ...state.cashflowGame,
      drawnCardIds: { ...state.cashflowGame.drawnCardIds, [deckKind]: result.drawnIds },
    };
    this.persistence.writeAndSync({
      tag: 'cashflowGame',
      data: state.cashflowGame,
      localStorageKey: 'cashflowGame',
      logEvent: 'cashflow_draw_card',
      logMetadata: { deckKind, cardId: result.card.id },
      onSuccess: () => callbacks.onSuccess(result.card),
      onError: (error: any) => callbacks.onError(error?.message || 'Database write failed'),
    });
  }

  /** Plans a drawn/found Deal card exactly as `planDeal` would from the manual form — its numbers, not re-typed. */
  applyDealCard(card: CashflowDealCard, callbacks: CashflowGameCallbacks): void {
    const input: CashflowDealInput =
      card.assetKind === 'share'
        ? {
            kind: 'share',
            title: card.title,
            quantity: card.quantity ?? 0,
            price: fromMinorUnits(card.priceMinor ?? 0),
          }
        : {
            kind: 'investment',
            title: card.title,
            deposit: fromMinorUnits(card.depositMinor ?? 0),
            mortgage: fromMinorUnits(card.mortgageMinor ?? 0),
            cashflow: fromMinorUnits(card.cashflowMinor ?? 0),
          };
    this.planDeal(input, callbacks);
  }

  /** A Doodad's mandatory one-off cost — a single Transaction, nothing else (todo/cashflow-game.md §4). */
  applyDoodadCard(card: CashflowDoodadCard, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.virtualDate) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    this.pushUndoSnapshot();
    state.allTransactions.push({
      account: 'Daily',
      amount: -fromMinorUnits(card.costMinor),
      date: state.cashflowGame.virtualDate,
      time: '',
      category: `@${card.title}`,
      comment: `${card.title}\n#cashflow`,
    });
    this.persistAll('cashflow_doodad', { title: card.title }, callbacks);
  }

  /** Returns the conflicting kind only when the existing project is clearly the other one — never blocks on missing/ambiguous legacy data. */
  private conflictingGrowKind(project: Grow, kind: 'share' | 'investment'): boolean {
    if (kind === 'share') return Boolean(project.investment?.tag) && !project.share?.tag;
    return Boolean(project.share?.tag) && !project.investment?.tag;
  }

  private existingMinor(amount: number | undefined): number | null {
    return amount === undefined ? null : toMinorUnits(amount);
  }

  private upsertEntity<T extends { tag: string }>(
    list: T[],
    tag: string,
    build: (existing: T | undefined) => T,
  ): void {
    const index = list.findIndex((item) => item.tag === tag);
    const next = build(index >= 0 ? list[index] : undefined);
    if (index >= 0) list.splice(index, 1, next);
    else list.push(next);
  }

  private upsertGrowProject(title: string, existing: Grow | undefined, patch: Partial<Grow>): void {
    const state = AppStateService.instance;
    if (existing) {
      Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
      return;
    }
    const now = new Date().toISOString();
    const project: Grow = {
      title,
      sub: '',
      phase: 'execute',
      description: '',
      strategy: '',
      riskScore: 0,
      risks: '',
      links: [],
      actionItems: [],
      notes: [],
      cashflow: 0,
      amount: 0,
      isAsset: false,
      share: null as any,
      investment: null as any,
      liabilitie: null as any,
      createdAt: now,
      updatedAt: now,
      type: 'income-growth',
      ...patch,
    };
    state.allGrowProjects.push(project);
  }

  private currentGameSet(): CashflowGameSet | undefined {
    const { gameSetId } = AppStateService.instance.cashflowGame;
    return gameSetId ? this.gameSets.find((set) => set.id === gameSetId) : undefined;
  }

  private currentProfession(): CashflowProfession | undefined {
    const { professionId } = AppStateService.instance.cashflowGame;
    if (!professionId) return undefined;
    return this.currentGameSet()?.professions.find((profession) => profession.id === professionId);
  }

  /** Creates or updates a Subscription by title — the "recomputed every time, never hand-edited" pattern Baby/Bank loan both use. */
  private upsertSubscription(upsert: CashflowStarterKitSubscription): void {
    const subscriptions = AppStateService.instance.allSubscriptions;
    const existing = subscriptions.find((sub) => sub.title === upsert.title);
    const amount = fromMinorUnits(upsert.amountMinor);
    if (existing) {
      existing.account = upsert.account;
      existing.amount = amount;
      existing.frequency = upsert.frequency;
      existing.category = upsert.category ?? existing.category;
      if (!existing.comment.includes('#cashflow')) {
        existing.comment = existing.comment ? `${existing.comment}\n#cashflow` : '#cashflow';
      }
    } else {
      subscriptions.push({
        title: upsert.title,
        account: upsert.account,
        amount,
        startDate: this.nextSmartSubscriptionDate(this.currentMonthGameSubscriptionDays()),
        endDate: '',
        category: upsert.category ?? '',
        comment: upsert.comment ? `${upsert.comment}\n#cashflow` : '#cashflow',
        frequency: upsert.frequency,
      });
    }
  }

  /** Public: also used by `add.component.ts`'s Sell Investment handling to drop a closed position's cashflow Subscription (`grow_guide`'s sell action has no way to know it exists). */
  removeSubscriptionByTitle(title: string): void {
    const subscriptions = AppStateService.instance.allSubscriptions;
    const index = subscriptions.findIndex((sub) => sub.title === title);
    if (index >= 0) subscriptions.splice(index, 1);
  }

  private upsertLiability(tag: string, amountMinor: number, isInvestment = false): void {
    const liabilities = AppStateService.instance.liabilities;
    const existing = liabilities.find((liability) => liability.tag === tag);
    const amount = fromMinorUnits(amountMinor);
    if (existing) {
      existing.amount = amount;
    } else {
      liabilities.push({ tag, amount, investment: isInvestment, credit: 0 });
    }
  }

  private removeLiabilityByTag(tag: string): void {
    const liabilities = AppStateService.instance.liabilities;
    const index = liabilities.findIndex((liability) => liability.tag === tag);
    if (index >= 0) liabilities.splice(index, 1);
  }

  private gameSubscriptions(): CashflowGameSubscription[] {
    return AppStateService.instance.allSubscriptions.map((sub) => ({
      title: sub.title,
      account: sub.account,
      amountMinor: toMinorUnits(sub.amount),
      category: sub.category,
      comment: sub.comment,
    }));
  }

  /** Removes exactly the transactions a Payday created, one match per record — never a blanket filter. */
  private removeCreatedTransactions(records: CashflowTransactionRecord[]): void {
    const transactions = AppStateService.instance.allTransactions;
    for (const record of records) {
      const amount = fromMinorUnits(record.amountMinor);
      const index = transactions.findIndex(
        (t) =>
          t.account === record.account &&
          t.amount === amount &&
          t.date === record.date &&
          t.time === record.time &&
          t.category === record.category &&
          t.comment === record.comment,
      );
      if (index >= 0) transactions.splice(index, 1);
    }
  }

  private persistAll(
    logEvent: string,
    logMetadata: Record<string, unknown>,
    callbacks: CashflowGameCallbacks,
    options: {
      includeSubscriptions?: boolean;
      includeBalanceSheet?: boolean;
      includeGrow?: boolean;
    } = {},
  ): void {
    const state = AppStateService.instance;
    this.incomeStatement.recalculate();
    state.isSaving = true;

    const writes: { tag: string; data: unknown }[] = [
      { tag: 'transactions', data: state.allTransactions },
      { tag: 'cashflowGame', data: state.cashflowGame },
      ...this.incomeStatement.getWrites(),
      ...(options.includeSubscriptions
        ? [{ tag: 'subscriptions', data: state.allSubscriptions }]
        : []),
      ...(options.includeBalanceSheet
        ? [
            { tag: 'balance/asset/assets', data: state.allAssets },
            { tag: 'balance/asset/shares', data: state.allShares },
            { tag: 'balance/asset/investments', data: state.allInvestments },
            { tag: 'balance/liabilities', data: state.liabilities },
          ]
        : []),
      ...(options.includeGrow ? [{ tag: 'grow', data: state.allGrowProjects }] : []),
    ];
    const localStorageSaves: { key: string; data: unknown }[] = [
      { key: 'transactions', data: state.allTransactions },
      { key: 'cashflowGame', data: state.cashflowGame },
      ...(options.includeSubscriptions
        ? [{ key: 'subscriptions', data: state.allSubscriptions }]
        : []),
      ...(options.includeBalanceSheet
        ? [
            { key: 'assets', data: state.allAssets },
            { key: 'shares', data: state.allShares },
            { key: 'investments', data: state.allInvestments },
            { key: 'liabilities', data: state.liabilities },
          ]
        : []),
      ...(options.includeGrow ? [{ key: 'grow', data: state.allGrowProjects }] : []),
    ];

    this.persistence.batchWriteAndSync({
      writes,
      localStorageSaves,
      logEvent,
      logMetadata,
      onSuccess: () => {
        state.isSaving = false;
        this.incomeStatement.saveToLocalStorage();
        // Every cashflow-game action touches transactions; notify pages that hold their own
        // snapshot (Home, the Daily/Splurge/Smile/Fire/Mojo account lists) instead of a live
        // binding, so they refresh without a page reload (JFK, 2026-09-26: "can we refresh just
        // the tables, variables, values on the page"). Grow/Balance/Smile/Fire-project pages
        // already read AppStateService live and don't need a signal.
        state.transactionsUpdated$.next();
        if (options.includeSubscriptions) {
          state.subscriptionsUpdated$.next();
        }
        callbacks.onSuccess();
      },
      onError: (error: any) => {
        state.isSaving = false;
        callbacks.onError(error?.message || 'Database write failed');
      },
    });
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
