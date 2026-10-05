import {
  decodeUndoChain,
  encodeUndoChain,
  isEncodedUndoChain,
  type EncodedUndoChain,
} from '../undo-chain-codec';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
  CashflowAssetDeal,
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
  cashOnHandMinor,
  coinsOwnedOf,
  clearCashflowStatus,
  computeMonthlyCashflowMinor,
  drawRandomCard,
  findCards,
  fromMinorUnits,
  gameSubscriptionDays,
  gameTradeStep,
  initialCashflowGameState,
  loanForShortfallMinor,
  marketSaleFor,
  multiplyQuantityPrice,
  nextSmartDate,
  pickCashflowProfession,
  planAutoLoan,
  playBankLoan,
  playBaby,
  playBoostCard,
  playCharity,
  playDownsized,
  playMarketBuyerCard,
  playMarketCostCard,
  playPayday,
  playShareSplitCard,
  previewSpace,
  sellAssetProblem,
  summarizeGameFinances,
  systemClock,
  toMinorUnits,
  tradePurchase,
  updateSharePrice,
  usedDaysThisMonth,
  type BookSubscription,
  type CardBooks,
  type CardDeps,
  type Clock,
  type GameEffects,
  type GameStep,
  type LoanBooks,
  type GameStepKind,
  type RoundBooks,
  type RoundDeps,
  type SavedGameSummary,
} from '@money/domain';
import { CASHFLOW_GAME_SETS } from '../cashflow-content';
import { AppStateService } from './app-state.service';
import { CashflowCardText } from './cashflow-card-text.service';
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

/** What the component composes from a card for the Grow project: its text plus the trading-range strategy. */
export interface CashflowCardPlanText extends CashflowCardText {
  /** The label this language gives the card's property type (SFH, CONDO...) - becomes the project's title. */
  symbol?: string;
  strategy?: string;
}

export interface CashflowGameCallbacks {
  onSuccess: () => void;
  onError: (message: string) => void;
}

/** A Deal card resolved through the app's existing Grow feature (todo/cashflow-game.md decision 10) — not a new entity type, just the two shapes Grow's own buy actions need. */
export interface CashflowDealShareInput {
  kind: 'share';
  title: string;
  /** 0 when the card leaves the count to the player — set it in the planned-deal list before buying. */
  quantity: number;
  price: number;
  /** The company / property name shown as the Grow project's subtitle (the title itself must stay the ticker: Grow links a project to its position by exact title). */
  subtitle?: string;
  /** The card's flavor text and special note, carried into the Grow project so they're not lost (JFK, 2026-09-30). */
  description?: string;
  note?: string;
  /** The card's trading range etc., written into the project's Strategy field. */
  strategy?: string;
}
export interface CashflowDealInvestmentInput {
  kind: 'investment';
  title: string;
  deposit: number;
  mortgage: number;
  /** The property's periodic income — becomes the Grow project's planned `cashflow` and a real Subscription. */
  cashflow: number;
  /** The translated property name shown as the Grow project's subtitle. */
  subtitle?: string;
  /** The card's text and cost breakdown, written into the project's description. */
  description?: string;
  note?: string;
}
export interface CashflowDealAssetInput {
  kind: 'asset';
  title: string;
  /** What the card costs. */
  cost: number;
  /** How many coins it is about. */
  coins: number;
  /** A die roll of at least this wins the coins; absent for a plain purchase. */
  successOn?: number;
  /** A winning roll pays this much cash back instead of giving coins. */
  payout?: number;
  /** Rolled for at every Payday while owned. */
  recurring?: boolean;
  subtitle?: string;
  description?: string;
  note?: string;
  strategy?: string;
  successText?: string;
  failureText?: string;
}
export type CashflowDealInput =
  CashflowDealShareInput | CashflowDealInvestmentInput | CashflowDealAssetInput;

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

function toBookSubscription(sub: Subscription): BookSubscription {
  return {
    title: sub.title,
    account: sub.account,
    amountMinor: toMinorUnits(sub.amount),
    startDate: sub.startDate,
    endDate: sub.endDate,
    category: sub.category,
    comment: sub.comment,
    frequency: sub.frequency,
  };
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
/** Everything a player can do that is one step in the game - and one step to undo (JFK, 2026-10-03). Defined in the domain, shared with the Pro API. */
export type CashflowStepKind = GameStepKind;

type CashflowStepInfo = GameStep;

/** One line of the game's History, newest first - exactly one per undo step. */
export interface CashflowHistoryStep {
  id: string;
  /** 1 for the first thing that happened in this game, counting up - stays the same when newer steps are undone. */
  number: number;
  kind: CashflowStepKind;
  detail: string;
  /** ISO timestamp of when the step was taken (empty for steps saved before history tracking). */
  at: string;
  /** What the step added to the books - e.g. a Payday's income and expense lines for the month. */
  transactions: Transaction[];
}

export interface CashflowGameSnapshot {
  /** Which step this snapshot is the "before" of; absent on snapshots saved before history tracking. */
  step?: CashflowStepInfo & { at: string };
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
const UNDO_STACK_LIMIT = 200;

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

  /** "Now" for everything the game dates and stamps. A property (not a constructor argument) so a test can pin it. */
  clock: Clock = systemClock;

  /**
   * Not synced to the DB — see `UNDO_STACK_STORAGE_KEY`'s own comment. Starts from whatever's in
   * localStorage (a prior reload/restart's leftovers), so it survives across those; `logOut()`
   * (both editions) calls `clearPersistedUndoStack()` so a different login never inherits it.
   */
  private undoStack: CashflowGameSnapshot[] = this.loadPersistedUndoStack();

  constructor(
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService,
    private translate: TranslateService,
  ) {}

  static isCashflowGame(): boolean {
    // The Firebase builds carry no game content (cashflow-content.firebase.ts): no sets, no game.
    return (
      CASHFLOW_GAME_SETS.length > 0 &&
      Boolean(ProfileComponent.mail && ProfileComponent.mail.includes('cashflow'))
    );
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Guarded like `CrypticService.loadConfig()` — a corrupt or missing entry just starts empty rather than breaking the app. */
  private loadPersistedUndoStack(): CashflowGameSnapshot[] {
    try {
      const raw = localStorage.getItem(UNDO_STACK_STORAGE_KEY);
      return raw ? this.decodeStack(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  }

  /** Reads a stored history: the compact form, or the plain list older versions of the app wrote. */
  private decodeStack(stored: unknown): CashflowGameSnapshot[] {
    if (isEncodedUndoChain(stored)) return decodeUndoChain(stored) as CashflowGameSnapshot[];
    return Array.isArray(stored) ? (stored as CashflowGameSnapshot[]) : [];
  }

  /** The whole undo history in its compact form - what a saved game keeps so Undo still works after loading it. */
  exportUndoChain(): EncodedUndoChain {
    return encodeUndoChain(this.undoStack);
  }

  /** `localStorage.setItem` can throw (quota, private-browsing) — the in-memory stack still works for the rest of this session either way. */
  private persistUndoStack(): void {
    try {
      localStorage.setItem(UNDO_STACK_STORAGE_KEY, JSON.stringify(encodeUndoChain(this.undoStack)));
    } catch {
      // best-effort only
    }
  }

  /** Snapshots every real entity a game action can touch, right before that action mutates anything — one call per public mutating method, always before its first mutation. */
  private pushUndoSnapshot(step: CashflowStepInfo): void {
    this.undoStack.push({
      step: { ...step, at: this.clock.nowIso() },
      ...this.captureGameSnapshot(),
    });
    if (this.undoStack.length > UNDO_STACK_LIMIT) this.undoStack.shift();
    this.persistUndoStack();
  }

  /**
   * A deep copy of everything the live game consists of - the unit both Undo and a saved game use
   * (JFK, 2026-10-04: a saved game is exactly this plus a name and a summary).
   */
  captureGameSnapshot(): CashflowGameSnapshot {
    const state = AppStateService.instance;
    return deepClone({
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
    });
  }

  /** Whether a loaded snapshot has the shape of a game (a corrupt or foreign file must never replace a live game). */
  isGameSnapshot(value: unknown): value is CashflowGameSnapshot {
    const snapshot = value as Partial<CashflowGameSnapshot> | null;
    return Boolean(
      snapshot &&
      [
        snapshot.allTransactions,
        snapshot.allSubscriptions,
        snapshot.allGrowProjects,
        snapshot.allShares,
        snapshot.allInvestments,
        snapshot.allAssets,
        snapshot.liabilities,
        snapshot.allSmileProjects,
        snapshot.allFireEmergencies,
      ].every(Array.isArray) &&
      snapshot.mojo &&
      snapshot.cashflowGame &&
      Array.isArray(snapshot.cashflowGame.gameSubscriptionTitles),
    );
  }

  /**
   * Makes a saved game the live game: every piece is replaced and written to the account, the undo
   * history starts fresh (a loaded game does not carry the undo steps of whatever ran before).
   */
  restoreGameSnapshot(
    snapshot: CashflowGameSnapshot,
    callbacks: CashflowGameCallbacks,
    history?: unknown,
  ): void {
    if (!this.isGameSnapshot(snapshot)) {
      callbacks.onError('This is not a Cashflow game.');
      return;
    }
    this.clearPersistedUndoStack();
    // A game saved with its history gets it back, so every move can still be undone; one saved before
    // that (or with a damaged history) simply starts with a fresh one.
    if (history) {
      try {
        this.undoStack = this.decodeStack(history).slice(-UNDO_STACK_LIMIT);
        this.persistUndoStack();
      } catch {
        this.undoStack = [];
      }
    }
    this.applySnapshot(deepClone(snapshot));
    this.persistAll('cashflow_game_loaded', { gameId: snapshot.cashflowGame.gameId }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /**
   * Gives the live game its saved-game identity the first time it is saved (an already running game
   * simply gets one), and keeps it afterwards - a loaded game keeps its slot.
   */
  setGameIdentity(id: string, name: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    state.cashflowGame = { ...state.cashflowGame, gameId: id, gameName: name };
    this.persistAll('cashflow_game_identity', { gameId: id }, callbacks);
  }

  /** The live game forgets its saved slot (the saved copy was deleted): the next save makes a new one. */
  clearGameIdentity(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const { gameId: _id, gameName: _name, ...rest } = state.cashflowGame;
    state.cashflowGame = rest;
    this.persistAll('cashflow_game_identity', {}, callbacks);
  }

  /** The numbers of the live game a saved game's list entry shows - and statistics will read later. */
  liveGameSummary(): Pick<
    SavedGameSummary,
    | 'gameSetId'
    | 'professionId'
    | 'round'
    | 'virtualDate'
    | 'cashMinor'
    | 'salaryMinor'
    | 'passiveIncomeMinor'
    | 'expensesMinor'
    | 'monthlyCashflowMinor'
    | 'bankLoanMinor'
    | 'children'
    | 'transactionCount'
    | 'escapedRatRace'
    | 'bankrupt'
  > {
    const state = AppStateService.instance;
    const finances = summarizeGameFinances(state.cashflowGame, this.gameSubscriptions());
    const bankLoan = state.liabilities.find((liability) => liability.tag === 'Bank loan');
    return {
      gameSetId: state.cashflowGame.gameSetId,
      professionId: state.cashflowGame.professionId,
      round: state.cashflowGame.round,
      virtualDate: state.cashflowGame.virtualDate,
      cashMinor: toMinorUnits(this.cash),
      salaryMinor: finances.salaryMinor,
      passiveIncomeMinor: finances.passiveIncomeMinor,
      expensesMinor: finances.expensesMinor,
      monthlyCashflowMinor: finances.monthlyCashflowMinor,
      bankLoanMinor: toMinorUnits(Number(bankLoan?.amount) || 0),
      children: state.cashflowGame.children,
      transactionCount: state.allTransactions.length,
      escapedRatRace: finances.escapedRatRace,
      bankrupt: finances.bankrupt,
    };
  }

  private applySnapshot(snapshot: CashflowGameSnapshot): void {
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
  }

  /**
   * For trades made outside this service - the Add dialog's Grow buy/sell on a Cashflow-game account
   * (JFK, 2026-09-30: "if we go undo, also these moves need to be undone"). Call right before such a
   * change mutates anything. Skips when the balance sheet/Grow tiers aren't loaded yet: a snapshot of
   * still-empty arrays would wipe real data if it were ever restored.
   *
   * A buy is financed by the game's **Bank loan**, never by a separate per-project liability (JFK,
   * 2026-10-03): the loan the player entered in the Grow project's Loan field (`financedLoan`) -
   * or, failing that, whatever cash is short - is taken as a Bank loan first (rounded up to the
   * game set's loan step), as its **own** undo step, so one Undo takes back the purchase and the
   * next takes back the loan. The dialog's own Loan option is then switched off (`converted`), so
   * the purchase is paid in full from the loan proceeds and no liability named after the project is
   * created.
   */
  beforeGrowTrade(
    comment: string,
    financedLoan = 0,
    loanDate?: string,
    category = '',
    expenseAmount = 0,
  ): { borrowed: number; converted: boolean; nextDate: string } {
    const state = AppStateService.instance;
    if (!state.tier3BalanceLoaded || !state.tier3GrowLoaded) {
      return { borrowed: 0, converted: false, nextDate: this.nextGameTransactionDate() };
    }
    const purchase = tradePurchase(comment, toMinorUnits(expenseAmount));
    const gameSet = this.currentGameSet();
    let borrowedMinor = 0;
    let converted = false;
    if (purchase && gameSet) {
      const plan = planAutoLoan({
        costMinor: purchase.costMinor,
        cashMinor: toMinorUnits(this.cash),
        financedMinor: toMinorUnits(financedLoan),
        incrementMinor: gameSet.loanRule.incrementMinor,
      });
      if (plan.loanMinor > 0) {
        const plannedMinor = plan.loanMinor;
        this.pushUndoSnapshot({
          kind: 'loanAuto',
          detail: this.amountText(fromMinorUnits(plannedMinor)),
        }); // step 1: the loan
        try {
          borrowedMinor = plannedMinor;
          this.applyBankLoanAdjustment(fromMinorUnits(borrowedMinor), loanDate);
          converted = plan.converted;
        } catch {
          this.undoStack.pop();
          this.persistUndoStack();
          borrowedMinor = 0;
        }
      }
      if (converted) {
        // The loan now lives in the Bank loan; the project's planned Loan field has done its job.
        const project = state.allGrowProjects.find(
          (candidate) => candidate.title === purchase.title,
        );
        if (project) project.liabilitie = null as any;
      }
    }
    this.pushUndoSnapshot(gameTradeStep(comment, category)); // step 2 (or the only step): the trade itself
    // The loan comes first: it takes `loanDate` (the day the dialog was opened on), and the purchase
    // that follows gets the next free slot after it.
    return {
      borrowed: fromMinorUnits(borrowedMinor),
      converted,
      nextDate: this.nextGameTransactionDate(),
    };
  }

  /** The toast text for an automatic loan, in the current language. */
  autoLoanMessage(amount: number): string {
    return this.translate.instant('CashflowGame.loanAutoTaken', { amount });
  }

  /** "4.000" style text for a History line, in the app's number format. */
  private amountText(amount: number): string {
    const state = AppStateService.instance;
    return `${amount.toLocaleString(state.isEuropeanFormat ? 'de-DE' : 'en-US')} ${state.currency}`;
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
    this.undoSteps(1, callbacks);
  }

  /**
   * The game's History: one line per undo step, newest first (JFK, 2026-10-03: "each step to go
   * backwards (undo) should be on this list"). What each step added is whatever the books gained
   * between its snapshot and the next one's - so a Payday lists its whole month, and nothing has to
   * be recorded twice.
   */
  historySteps(): CashflowHistoryStep[] {
    const state = AppStateService.instance;
    const stack = this.undoStack;
    return stack
      .map((snapshot, index) => {
        const after = index + 1 < stack.length ? stack[index + 1] : state;
        // Steps saved before history tracking carry no name: work it out from what changed.
        const step = snapshot.step ?? this.inferStep(snapshot, after);
        return {
          id: `${snapshot.step?.at ?? 'saved'}-${index}`,
          number: index + 1,
          kind: step.kind,
          detail: step.detail ?? '',
          at: snapshot.step?.at ?? '',
          transactions: after.allTransactions.slice(snapshot.allTransactions.length),
        };
      })
      .reverse();
  }

  /** Names a step from what it changed in the game: the state before it against the state after. */
  private inferStep(
    before: CashflowGameSnapshot,
    after: Pick<
      CashflowGameSnapshot,
      'cashflowGame' | 'liabilities' | 'allGrowProjects' | 'allTransactions'
    >,
  ): CashflowStepInfo {
    const was = before.cashflowGame;
    const now = after.cashflowGame;
    if (!was.professionId && now.professionId) return { kind: 'start' };
    if (was.professionId && !now.professionId) return { kind: 'reset' };
    if (now.round > was.round) {
      return {
        kind: 'payday',
        detail: `${this.translate.instant('CashflowGame.Round')} ${now.round}`,
      };
    }
    if (now.children > was.children) return { kind: 'baby' };
    if (now.charityRoundsLeft > was.charityRoundsLeft) return { kind: 'charity' };
    if (now.unemployedRoundsLeft > was.unemployedRoundsLeft) return { kind: 'downsized' };
    const bankLoan = (snapshot: Pick<CashflowGameSnapshot, 'liabilities'>) =>
      snapshot.liabilities.find((liability) => liability.tag === 'Bank loan')?.amount ?? 0;
    const loanChange = bankLoan(after) - bankLoan(before);
    if (loanChange !== 0) {
      return {
        kind: loanChange > 0 ? 'loanTaken' : 'loanRepaid',
        detail: this.amountText(Math.abs(loanChange)),
      };
    }
    const added = after.allTransactions.slice(before.allTransactions.length);
    const last = added[added.length - 1];
    if (last?.category?.endsWith(' card sale')) {
      return { kind: 'cardSale', detail: last.category.replace(/^@| card sale$/g, '') };
    }
    if (last) return gameTradeStep(last.comment ?? '', last.category ?? '');
    if (after.allGrowProjects.length > before.allGrowProjects.length) return { kind: 'planDeal' };
    return { kind: 'transaction' };
  }

  /** Undoes the newest `count` steps in one go - back to exactly how the game stood before the oldest of them (the History's "undo back to here"). */
  undoSteps(count: number, callbacks: CashflowGameCallbacks): void {
    let snapshot: CashflowGameSnapshot | undefined;
    for (let undone = 0; undone < count && this.undoStack.length > 0; undone++) {
      snapshot = this.undoStack.pop();
    }
    if (!snapshot) {
      callbacks.onError('Nothing to undo.');
      return;
    }
    this.persistUndoStack();
    // A step from before the game was first saved knows nothing of its saved slot: keep the slot.
    const { gameId, gameName } = AppStateService.instance.cashflowGame;
    this.applySnapshot(
      gameId
        ? { ...snapshot, cashflowGame: { ...snapshot.cashflowGame, gameId, gameName } }
        : snapshot,
    );
    this.persistAll('cashflow_undo_action', {}, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /**
   * Starts a new game: materializes the profession's starter kit as real entities. Every piece of
   * profession content (title, expense names, liability tags, the Salary/Savings labels) resolves
   * through the currently-selected language instead of game-sets.ts's own (German) strings — new
   * records pick up whatever language is active right now (todo/cashflow-game.md decision 48, JFK
   * 2026-09-29+: "can we have this in all 6 languages and we translate all of these values").
   */
  pickProfession(gameSetId: string, professionId: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof pickCashflowProfession>;
    try {
      result = pickCashflowProfession(
        this.gameSets,
        gameSetId,
        professionId,
        this.clock.todayIso(),
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not start the game.'));
      return;
    }
    // A new game has a new history: whatever an earlier game left behind is dropped, so "Game started"
    // is always step 1 (JFK, 2026-10-03).
    this.clearPersistedUndoStack();
    this.pushUndoSnapshot({
      kind: 'start',
      detail: this.translateProfessionTitle(result.profession),
    });

    const professionTitle = this.translateProfessionTitle(result.profession);
    const salaryWord = this.translate.instant('CashflowGame.salary');
    const savingsWord = this.translate.instant('CashflowGame.savings');
    // result.subscriptions is always [salary, ...non-zero expense lines], in that order (see
    // pickCashflowProfession) — the same order this.currentProfession's own expenses filter to.
    const nonZeroExpenses = result.profession.expenses.filter((line) => line.amountMinor !== 0);
    const subscriptionTitles = result.subscriptions.map((_sub, index) =>
      index === 0
        ? this.translate.instant('CashflowGame.salarySubscriptionTitle', {
            profession: professionTitle,
          })
        : this.translateExpenseLineTitle(result.profession, nonZeroExpenses[index - 1]),
    );

    result.startingTransactions.forEach((record) =>
      state.allTransactions.push(
        toFloatTransaction({
          ...record,
          category: `@${savingsWord}`,
          comment: `${this.translate.instant('CashflowGame.savingsTransactionComment', {
            profession: professionTitle,
          })}\n#cashflow`,
        }),
      ),
    );

    const usedDays = this.currentMonthGameSubscriptionDays();
    result.subscriptions.forEach((sub, index) => {
      const translatedTitle = subscriptionTitles[index];
      const subscription: Subscription = {
        title: translatedTitle,
        account: sub.account,
        amount: fromMinorUnits(sub.amountMinor),
        startDate: this.nextSmartSubscriptionDate(usedDays),
        endDate: '',
        category: index === 0 ? `@${salaryWord}` : `@${translatedTitle}`,
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
        tag: this.translateLiabilityTag(result.profession, liability),
        amount: fromMinorUnits(liability.amountMinor),
        investment: false,
        credit: 0,
      }),
    );

    state.cashflowGame = { ...result.state, gameSubscriptionTitles: subscriptionTitles };
    this.persistAll('start_cashflow_game', { gameSetId, professionId }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
  }

  /** Resolves a translation key against the currently-selected language, falling back to `fallback` (game-sets.ts's own string) if no such key exists yet — the same behavior ngx-translate's own missing-key handler already gives every other key in the app. */
  private translateOrFallback(key: string, fallback: string): string {
    const translated = this.translate.instant(key);
    return translated === key ? fallback : translated;
  }

  /** Public: also used by the profession card's "Starting Scenario" view (`cashflow-game.component.ts`) to live-translate the card's own static, never-user-edited reference numbers (todo/cashflow-game.md decision 48). */
  translateProfessionTitle(profession: CashflowProfession): string {
    return this.translateOrFallback(
      `CashflowGame.profession.${profession.id}.title`,
      profession.title,
    );
  }

  /**
   * Shared across every profession, not namespaced per-profession like the title — "Steuern"
   * means the same thing on every card, so it only needs translating once (todo/cashflow-game.md
   * decision 49: went from `CashflowGame.profession.<id>.expense.<key>` to
   * `CashflowGame.expenseLine.<key>` once more professions made the duplication obvious).
   */
  translateExpenseLineTitle(
    _profession: CashflowProfession,
    line: { title: string; key?: string },
  ): string {
    if (!line.key) return line.title;
    return this.translateOrFallback(`CashflowGame.expenseLine.${line.key}`, line.title);
  }

  /** Shared across every profession too, same reasoning as `translateExpenseLineTitle`. */
  translateLiabilityTag(
    _profession: CashflowProfession,
    liability: { tag: string; key?: string },
  ): string {
    if (!liability.key) return liability.tag;
    return this.translateOrFallback(`CashflowGame.liabilityTag.${liability.key}`, liability.tag);
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
    let effects: GameEffects;
    try {
      effects = playPayday(this.roundBooks(), this.roundDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not run Payday.'));
      return;
    }
    this.pushUndoSnapshot(effects.step);
    this.applyGameEffects(effects);
    this.persistAll(
      'cashflow_payday',
      { round: effects.state.round },
      callbacks,
      effects.persist.grow ? { includeGrow: true } : {},
    );
    if (effects.decisionNeeded) this.decisionNeeded$.next();
  }

  /**
   * The slice of the account the round rules (`@money/domain` rounds.ts) read, in minor units. The rules are pure:
   * this service only builds their input, applies their effects and persists - the same decisions the Pro API makes.
   */
  private roundBooks(): RoundBooks {
    const state = AppStateService.instance;
    return {
      state: state.cashflowGame,
      subscriptions: state.allSubscriptions.map(toBookSubscription),
      transactions: state.allTransactions,
      growNotes: state.allGrowProjects.map((project) => ({
        title: project.title,
        notes: project.notes ?? [],
      })),
    };
  }

  /** Today's date and the game's text, for the round rules: the injectable clock and the selected language. */
  private get roundDeps(): RoundDeps {
    return { clock: this.clock, text: (key, params) => this.translate.instant(key, params) };
  }

  /** Creates or edits subscriptions to read as the rule says, keeping everything else on an existing one (its change history). */
  private applySubscriptionUpserts(upserts: BookSubscription[]): void {
    const subscriptions = AppStateService.instance.allSubscriptions;
    for (const upsert of upserts) {
      const existing = subscriptions.find((sub) => sub.title === upsert.title);
      if (existing) {
        existing.account = upsert.account;
        existing.amount = fromMinorUnits(upsert.amountMinor);
        existing.frequency = upsert.frequency;
        existing.category = upsert.category;
        existing.comment = upsert.comment;
      } else {
        subscriptions.push({
          title: upsert.title,
          account: upsert.account,
          amount: fromMinorUnits(upsert.amountMinor),
          startDate: upsert.startDate,
          endDate: upsert.endDate,
          category: upsert.category,
          comment: upsert.comment,
          frequency: upsert.frequency,
        });
      }
    }
  }

  /** The slice of the account the Market-card rules read, in minor units. */
  private cardBooks(): CardBooks {
    const state = AppStateService.instance;
    const minor = (amount: unknown) => toMinorUnits(Number(amount) || 0);
    return {
      state: state.cashflowGame,
      subscriptions: state.allSubscriptions.map(toBookSubscription),
      investments: state.allInvestments.map((investment) => ({
        tag: investment.tag,
        depositMinor: minor(investment.deposit),
        amountMinor: minor(investment.amount),
      })),
      shares: state.allShares.map((share) => ({
        tag: share.tag,
        quantity: Number(share.quantity) || 0,
        priceMinor: minor(share.price),
      })),
      assets: state.allAssets.map((asset) => ({
        tag: asset.tag,
        amountMinor: minor(asset.amount),
      })),
      growProjects: state.allGrowProjects.map((project) => ({
        title: project.title,
        notes: project.notes ?? [],
        cashflowMinor: minor(project.cashflow),
        share: project.share?.tag
          ? { tag: project.share.tag, priceMinor: minor(project.share.price) }
          : null,
      })),
    };
  }

  /** The round rules' dependencies plus the game's money format ("4.000 €"). */
  private get cardDeps(): CardDeps {
    return {
      ...this.roundDeps,
      money: (amountMinor) => this.amountText(fromMinorUnits(amountMinor)),
    };
  }

  /**
   * Writes any game rule's effects into the live entities (see `GameEffects` in @money/domain). Existing entries are
   * edited in place, so nothing else on them (ids, change history) is lost.
   */
  private applyGameEffects(effects: GameEffects): void {
    const state = AppStateService.instance;
    for (const { index, date } of effects.transactionDates) {
      state.allTransactions[index].date = date;
    }
    effects.appendedTransactions.forEach((record) =>
      state.allTransactions.push(toFloatTransaction(record)),
    );
    this.applySubscriptionUpserts(effects.subscriptionUpserts);
    for (const title of effects.subscriptionRemovals) this.removeSubscriptionByTitle(title);
    for (const liability of effects.liabilityUpserts) {
      this.upsertLiability(liability.tag, liability.amountMinor, liability.investment);
    }
    for (const tag of effects.liabilityRemovals) this.removeLiabilityByTag(tag);
    for (const update of effects.growUpdates) {
      const project = state.allGrowProjects.find((candidate) => candidate.title === update.title);
      if (!project) continue;
      if (update.notes) project.notes = update.notes;
      if (update.cashflowMinor !== undefined) {
        project.cashflow = fromMinorUnits(update.cashflowMinor);
      }
      if (update.sharePriceMinor !== undefined && project.share) {
        project.share.price = fromMinorUnits(update.sharePriceMinor);
      }
      if (update.updatedAt) project.updatedAt = update.updatedAt;
    }
    for (const { tag, priceMinor } of effects.sharePrices) {
      const held = state.allShares.find((share) => share.tag === tag);
      if (held) held.price = fromMinorUnits(priceMinor);
    }
    state.cashflowGame = effects.state;
  }
  /** Every day-of-month a `#cashflow` Subscription recurs on (see `gameSubscriptionDays`). */
  private currentMonthGameSubscriptionDays(): Set<number> {
    return gameSubscriptionDays(AppStateService.instance.allSubscriptions);
  }

  /** Days already taken in this real month: game Subscription days plus any Transaction dated this month. */
  private currentMonthUsedDays(): Set<number> {
    const state = AppStateService.instance;
    return usedDaysThisMonth(state.allSubscriptions, state.allTransactions, this.clock.todayIso());
  }

  /** The date the next one-off game transaction (loan move, Doodad, card sale, a Grow trade...) takes: the next free slot of this real month, never the game's own calendar. */
  nextGameTransactionDate(): string {
    return this.nextSmartSubscriptionDate(this.currentMonthUsedDays());
  }

  /** The next free day-of-month slot of this real month, dated (see `nextSmartDate`). */
  private nextSmartSubscriptionDate(usedDays: Set<number>): string {
    return nextSmartDate(usedDays, this.clock.todayIso());
  }

  /** Resolves a Baby space: +1 child (max 3), scales the children-expense Subscription. */
  resolveBaby(callbacks: CashflowGameCallbacks): void {
    const profession = this.currentProfession();
    if (!profession) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    let effects: GameEffects;
    try {
      effects = playBaby(this.roundBooks(), profession, this.roundDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Baby.'));
      return;
    }
    this.pushUndoSnapshot(effects.step);
    this.applyGameEffects(effects);
    this.persistAll('cashflow_baby', { children: effects.state.children }, callbacks, {
      includeSubscriptions: true,
    });
  }

  /**
   * What a Baby / Charity / Downsized space is about to do, for the confirmation shown before it is
   * played (JFK, 2026-10-03): the same rule the real resolve runs, nothing applied. `amountMinor`
   * is the money involved - the monthly expense a baby adds, the 10% charity pays, all expenses
   * Downsized pays - and `children` the child count after a baby. Null when it cannot be played.
   */
  spacePreview(
    kind: 'baby' | 'charity' | 'downsized',
  ): { amountMinor: number; children?: number } | null {
    return previewSpace(this.roundBooks(), kind, this.currentProfession(), this.roundDeps.text);
  }

  /** Resolves a Charity space: pays 10% of total income now, unlocks the dice choice for 3 turns. */
  resolveCharity(callbacks: CashflowGameCallbacks): void {
    let effects: GameEffects;
    try {
      effects = playCharity(this.roundBooks(), this.roundDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Charity.'));
      return;
    }
    this.pushUndoSnapshot(effects.step);
    this.applyGameEffects(effects);
    this.persistAll('cashflow_charity', {}, callbacks);
  }

  /** Resolves a Downsized space: pays total expenses once and shows the sitting-out reminder (ends an active charity bonus). */
  resolveDownsized(callbacks: CashflowGameCallbacks): void {
    let effects: GameEffects;
    try {
      effects = playDownsized(this.roundBooks(), this.roundDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not resolve Downsized.'));
      return;
    }
    this.pushUndoSnapshot(effects.step);
    this.applyGameEffects(effects);
    this.persistAll('cashflow_downsized', {}, callbacks);
  }

  /** Takes (`delta > 0`) or repays (`< 0`) a bank loan in the game set's increment (a decimal amount, like everywhere else in the app); upserts the Liability + interest Subscription, recomputed from the new principal every time. */
  adjustBankLoan(delta: number, callbacks: CashflowGameCallbacks): void {
    let effects: GameEffects;
    try {
      effects = playBankLoan(this.loanBooks(), toMinorUnits(delta), this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not adjust the bank loan.'));
      return;
    }
    this.pushUndoSnapshot(effects.step as CashflowStepInfo);
    this.applyGameEffects(effects);
    this.persistAll('cashflow_bank_loan', { delta }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
    });
  }

  /** The slice of the account the bank loan rule reads, in minor units. */
  private loanBooks(): LoanBooks {
    const state = AppStateService.instance;
    return {
      state: state.cashflowGame,
      subscriptions: state.allSubscriptions.map(toBookSubscription),
      transactions: state.allTransactions,
      liabilities: state.liabilities.map((liability) => ({
        tag: liability.tag,
        amountMinor: toMinorUnits(Number(liability.amount) || 0),
      })),
      gameSet: this.currentGameSet(),
    };
  }

  /** The mutation `adjustBankLoan`, the auto-borrow on a Grow buy and `executeDeal` all need - throws instead of using callbacks so a caller can chain it with other mutations (and its own undo steps) before persisting once. */
  private applyBankLoanAdjustment(delta: number, date?: string): void {
    this.applyGameEffects(
      playBankLoan(this.loanBooks(), toMinorUnits(delta), this.cardDeps, { date }),
    );
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
    return fromMinorUnits(
      cashOnHandMinor(
        state.allTransactions.map((t) => ({
          account: t.account,
          amountMinor: toMinorUnits(t.amount),
        })),
        { daily: state.daily, splurge: state.splurge, smile: state.smile, fire: state.fire },
      ),
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
    // The same card drawn again (better price, more cash): the project already exists and may already
    // hold shares — this plan only moves the price and resets the amount to buy, never the holding.
    const isReplan = Boolean(existingProject && input.kind === 'share');
    if (existingProject && this.conflictingGrowKind(existingProject, input.kind)) {
      callbacks.onError(`"${input.title}" already exists as a different kind of Grow project.`);
      return;
    }
    this.pushUndoSnapshot({ kind: 'planDeal', detail: input.title });
    // Card text and trading range are plain Grow fields; the cash / bank-loan line is a Grow *note*
    // (the app's existing feature for it), kept current by `syncPlanNote`.
    const newNotes = [
      ...(isReplan && input.kind === 'share'
        ? [this.translate.instant('CashflowGame.cardDrawnAgain', { price: input.price })]
        : []),
      ...(input.note ? [input.note] : []),
    ].map((text) => ({ text, createdAt: this.clock.nowIso() }));
    const notes = [...(existingProject?.notes ?? []), ...newNotes];
    const base = {
      status: 'planned',
      phase: 'plan' as const,
      ...(input.subtitle && !existingProject?.sub ? { sub: input.subtitle } : {}),
    };
    let patch: Partial<Grow>;
    if (input.kind === 'share') {
      patch = {
        ...base,
        share: { tag: input.title, quantity: input.quantity, price: input.price },
        ...(input.description && !existingProject?.description
          ? { description: input.description }
          : {}),
        ...(input.strategy ? { strategy: input.strategy } : {}),
        notes,
      };
    } else if (input.kind === 'investment') {
      patch = {
        ...base,
        cashflow: input.cashflow,
        // Grow's "Deposit" is the project's `amount`: the card's whole Anzahlung (JFK, 2026-10-03).
        amount: input.deposit,
        investment: { tag: input.title, deposit: input.deposit, amount: input.mortgage },
        ...(input.description ? { description: input.description } : {}),
        notes,
      };
    } else {
      // A special asset (gold coins): a Grow *asset* project, the price is its Deposit.
      patch = {
        ...base,
        isAsset: true,
        amount: input.cost,
        ...(input.description ? { description: input.description } : {}),
        ...(input.strategy ? { strategy: input.strategy } : {}),
        notes: [
          ...notes,
          ...(input.coins > 0
            ? [
                {
                  text: this.translate.instant('CashflowGame.assetCoinsNote', {
                    coins: input.coins,
                  }),
                  createdAt: this.clock.nowIso(),
                },
              ]
            : []),
        ],
      };
      this.registerAssetDeal(input);
    }
    this.upsertGrowProject(input.title, existingProject, patch);
    const planned = state.allGrowProjects.find((project) => project.title === input.title);
    if (planned) this.syncPlanNote(planned);
    this.persistAll('cashflow_deal_plan', { kind: input.kind, title: input.title }, callbacks, {
      includeGrow: true,
    });
  }

  /**
   * Paying a starting liability off (car loan, credit card, student loan, home mortgage...) also ends
   * the monthly expense that went with it (JFK, 2026-10-03). Call after the liability is gone; does
   * nothing while any of it is still owed. The Subscription is removed from the game too, so Payday
   * stops charging it - and because the Add dialog took an undo snapshot first, one Undo brings both
   * the debt and its expense back. Returns the removed expense's title (or null).
   */
  removeExpenseForPaidLiability(liabilityTag: string): string | null {
    const state = AppStateService.instance;
    if (state.liabilities.some((liability) => liability.tag === liabilityTag)) return null;
    const title = this.expenseTitleForLiability(liabilityTag);
    if (!title) return null;
    this.removeSubscriptionByTitle(title);
    state.cashflowGame = {
      ...state.cashflowGame,
      gameSubscriptionTitles: state.cashflowGame.gameSubscriptionTitles.filter(
        (gameTitle) => gameTitle !== title,
      ),
    };
    return title;
  }

  /** The toast text for a removed monthly expense, in the current language. */
  expenseRemovedMessage(title: string): string {
    return this.translate.instant('CashflowGame.expenseRemoved', { title });
  }

  /** The game Subscription that pays a liability off over time, or null when it has none (e.g. a liability the player added by hand). */
  private expenseTitleForLiability(liabilityTag: string): string | null {
    if (liabilityTag === 'Bank loan') return 'Bank loan interest';
    const profession = this.currentProfession();
    if (!profession) return null;
    const gameTitles = AppStateService.instance.cashflowGame.gameSubscriptionTitles;
    // The liability was named in whichever language was active at game start, so match it against
    // the current translation and the card's original text.
    const liability = (profession.starterKit.liabilities ?? []).find((candidate) =>
      [this.translateLiabilityTag(profession, candidate), candidate.tag].includes(liabilityTag),
    );
    const expenseKey = liability?.key ? LIABILITY_EXPENSE_KEYS[liability.key] : undefined;
    const line = expenseKey
      ? profession.expenses.find((expense) => expense.key === expenseKey)
      : undefined;
    if (!line) return null;
    return (
      [this.translateExpenseLineTitle(profession, line), line.title].find((title) =>
        gameTitles.includes(title),
      ) ?? null
    );
  }

  /** The special-asset deals in play (gold coins), oldest first. */
  private assetDeals(): CashflowAssetDeal[] {
    return AppStateService.instance.cashflowGame.assetDeals ?? [];
  }

  private registerAssetDeal(input: CashflowDealAssetInput): void {
    const state = AppStateService.instance;
    const deal: CashflowAssetDeal = {
      title: input.title,
      coins: input.coins,
      costMinor: toMinorUnits(input.cost),
      ...(input.successOn ? { successOn: input.successOn } : {}),
      ...(input.payout ? { payoutMinor: toMinorUnits(input.payout) } : {}),
      ...(input.recurring ? { recurring: true } : {}),
      stage: 'planned',
      ...(input.successText ? { successText: input.successText } : {}),
      ...(input.failureText ? { failureText: input.failureText } : {}),
    };
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: [...this.assetDeals().filter((d) => d.title !== input.title), deal],
    };
  }

  private setAssetDeal(title: string, patch: Partial<CashflowAssetDeal>): void {
    const state = AppStateService.instance;
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: this.assetDeals().map((deal) =>
        deal.title === title ? { ...deal, ...patch } : deal,
      ),
    };
  }

  /**
   * Called by the Add dialog's Buy Asset before it books the asset. A dice-gamble card is *paid* but
   * does not become an asset yet - it waits for the roll (`resolveGamble`) - so this returns true and
   * the dialog skips creating it. A plain offer returns false and is booked as usual.
   */
  beforeAssetBuy(title: string): boolean {
    // 'awaitingRoll' counts too: pressing Buy again on a card that is already paid and waiting must
    // not hand out the coins without the roll.
    const deal = this.assetDeals().find(
      (d) => d.title === title && (d.stage === 'planned' || d.stage === 'awaitingRoll'),
    );
    // A recurring card (Multi-Level-Marketing) is simply bought; its dice come at every Payday.
    if (!deal?.successOn || deal.recurring) return false;
    this.setAssetDeal(title, { stage: 'awaitingRoll' });
    return true;
  }

  /** After the dialog's Buy Asset: a plain offer is now owned; a gamble is paid and waits for its roll. */
  afterAssetBuy(title: string): void {
    const project = AppStateService.instance.allGrowProjects.find((p) => p.title === title);
    const deal = this.assetDeals().find((d) => d.title === title);
    if (deal?.stage === 'awaitingRoll') {
      if (project) {
        project.status = 'awaiting roll';
        project.phase = 'execute';
      }
      // Paid: bring the player straight to the game dashboard, where the roll is decided.
      this.decisionNeeded$.next();
      return;
    }
    if (deal?.stage === 'planned') this.setAssetDeal(title, { stage: 'owned' });
    this.setPhaseAfterTrade(title, 'buy');
  }

  /** After the dialog's Sell Asset: the project is sold only when the asset is gone; otherwise it still holds what is left. */
  afterAssetSell(title: string): void {
    const state = AppStateService.instance;
    const stillOwned = state.allAssets.some((asset) => asset.tag === title);
    if (!stillOwned) this.setAssetDeal(title, { stage: 'sold', rollDue: false });
    const project = state.allGrowProjects.find((candidate) => candidate.title === title);
    if (project) project.status = stillOwned ? 'bought' : 'sold';
    this.setPhaseAfterTrade(title, 'sell');
  }

  /** How many coins of a special asset (gold) are still owned - 0 for any other asset. */
  coinsOwned(title: string): number {
    return coinsOwnedOf(AppStateService.instance.cashflowGame, title);
  }

  /**
   * Checked before a Sell Asset goes through: a coin asset can only sell the coins it has (JFK,
   * 2026-10-03). Returns the message to show, or null when the sale is fine (or isn't a coin asset).
   */
  sellAssetProblem(comment: string): string | null {
    return sellAssetProblem(comment, (title) => this.coinsOwned(title), this.roundDeps.text);
  }

  /**
   * Sells `quantity` coins of a special asset at `price` each (JFK, 2026-10-03: "5 x 1000" sells five
   * coins for 1.000 apiece). The Asset keeps the cost of the coins that are left - proportional, so
   * selling half removes half of what it cost - and goes away entirely with the last coin; the Grow
   * project says how many coins remain. The money coming in is the dialog's income transaction.
   * Returns false for an ordinary asset, which keeps its usual sale.
   */
  sellCoins(title: string, quantity: number, price: number): boolean {
    const state = AppStateService.instance;
    const deal = this.assetDeals().find((d) => d.title === title && d.stage === 'owned');
    if (!deal || !(quantity > 0)) return false;
    const left = Math.max(0, Math.round((deal.coins - quantity) * 100) / 100);
    const asset = state.allAssets.find((candidate) => candidate.tag === title);
    const project = state.allGrowProjects.find((candidate) => candidate.title === title);
    const keep = deal.coins > 0 ? left / deal.coins : 0;
    if (asset) {
      if (left <= 0) state.allAssets.splice(state.allAssets.indexOf(asset), 1);
      else asset.amount = Math.round(Number(asset.amount) * keep * 100) / 100;
    }
    if (project) {
      if (left > 0) project.amount = Math.round(Number(project.amount) * keep * 100) / 100;
      project.notes = [
        ...(project.notes ?? []),
        {
          text: this.translate.instant('CashflowGame.coinsSoldNote', {
            sold: quantity,
            price: this.amountText(price),
            left,
          }),
          createdAt: this.clock.nowIso(),
        },
      ];
    }
    this.setAssetDeal(title, left <= 0 ? { coins: 0, stage: 'sold' } : { coins: left });
    return true;
  }

  /** Fires when a dice card has just been paid - the game panel listens and opens on the open decision (JFK, 2026-10-03). */
  readonly decisionNeeded$ = new Subject<void>();

  /** Paid dice cards still waiting for their roll - shown on the game dashboard as an open decision. */
  get openDecisions(): CashflowAssetDeal[] {
    const waiting = this.assetDeals().filter((deal) => deal.stage === 'awaitingRoll');
    // The Payday rolls of kept cards are one decision for the whole group, shown once.
    const due = this.recurringOwned().filter((deal) => deal.rollDue);
    return due.length ? [...waiting, due[0]] : waiting;
  }

  /** Kept cards that are rolled for at every Payday (Multi-Level-Marketing). */
  private recurringOwned(): CashflowAssetDeal[] {
    return this.assetDeals().filter((deal) => deal.recurring && deal.stage === 'owned');
  }

  /** How many cards the open Payday roll covers: a roll pays once per card, so two cards win (or miss) together. */
  paydayRollCount(deal: CashflowAssetDeal): number {
    if (!deal.recurring) return 1;
    return this.recurringOwned().filter(
      (other) =>
        other.rollDue &&
        other.costMinor === deal.costMinor &&
        other.payoutMinor === deal.payoutMinor,
    ).length;
  }

  /**
   * One Payday roll for every kept card of the same kind (JFK, 2026-10-03: "you just throw once and
   * either you get twice or nothing"): a win books one income per card, a miss books nothing - the
   * cards stay in execution either way. A separate History step from the Payday itself.
   */
  private resolvePaydayRoll(
    target: CashflowAssetDeal,
    outcome: { won: boolean; roll?: number },
    callbacks: CashflowGameCallbacks,
  ): void {
    const state = AppStateService.instance;
    const group = this.recurringOwned().filter(
      (other) =>
        other.rollDue &&
        other.costMinor === target.costMinor &&
        other.payoutMinor === target.payoutMinor,
    );
    const label = group.length > 1 ? `${target.title} ×${group.length}` : target.title;
    this.pushUndoSnapshot({
      kind: outcome.won ? 'diceWon' : 'diceLost',
      detail: outcome.roll ? `${label} · 🎲 ${outcome.roll}` : label,
    });
    const payout = fromMinorUnits(target.payoutMinor ?? 0);
    const resultText =
      (outcome.won ? target.successText : target.failureText) ??
      this.translate.instant(
        outcome.won ? 'CashflowGame.diceWonPayoutToast' : 'CashflowGame.diceLostToast',
        { amount: this.amountText(payout * group.length) },
      );
    for (const deal of group) {
      const project = state.allGrowProjects.find((p) => p.title === deal.title);
      if (project) {
        project.notes = [
          ...(project.notes ?? []),
          {
            text: `🎲 ${outcome.roll ? `${outcome.roll}: ` : ''}${resultText}`,
            createdAt: this.clock.nowIso(),
          },
        ];
      }
      if (outcome.won) {
        state.allTransactions.push({
          account: 'Daily',
          amount: payout,
          date: this.nextGameTransactionDate(),
          time: '',
          category: `@${deal.title}`,
          comment: `${deal.title} payout\n#cashflow`,
        });
      }
    }
    const done = new Set(group.map((deal) => deal.title));
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: this.assetDeals().map((deal) =>
        done.has(deal.title) ? { ...deal, rollDue: false } : deal,
      ),
    };
    this.persistAll('cashflow_dice', { title: target.title, won: outcome.won }, callbacks, {
      includeGrow: true,
    });
  }

  /** A die for the app to roll when the player has no real one at hand. */
  rollDie(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  /**
   * Settles a paid dice card (JFK, 2026-10-03): `won` (rolled in the app, or reported from a real
   * die) books the coins as an Asset at what was paid; otherwise the money is simply gone and the
   * card is completed. Either way what happened is kept as a note on the Grow project, and the whole
   * thing is one undoable step.
   */
  resolveGamble(
    title: string,
    outcome: { won: boolean; roll?: number },
    callbacks: CashflowGameCallbacks,
  ): void {
    const state = AppStateService.instance;
    const dueCard = this.recurringOwned().find((d) => d.title === title && d.rollDue);
    if (dueCard) {
      this.resolvePaydayRoll(dueCard, outcome, callbacks);
      return;
    }
    const deal = this.assetDeals().find((d) => d.title === title && d.stage === 'awaitingRoll');
    if (!deal) {
      callbacks.onError('There is no dice decision open for this card.');
      return;
    }
    if (deal.split) {
      this.resolveShareSplit(deal, outcome, callbacks);
      return;
    }
    this.pushUndoSnapshot({
      kind: outcome.won ? 'diceWon' : 'diceLost',
      detail: outcome.roll ? `${title} · 🎲 ${outcome.roll}` : title,
    });
    const project = state.allGrowProjects.find((p) => p.title === title);
    const payout = deal.payoutMinor ? fromMinorUnits(deal.payoutMinor) : 0;
    const resultText =
      (outcome.won ? deal.successText : deal.failureText) ??
      this.translate.instant(
        outcome.won
          ? payout
            ? 'CashflowGame.diceWonPayoutToast'
            : 'CashflowGame.diceWonToast'
          : 'CashflowGame.diceLostToast',
        { coins: deal.coins, amount: this.amountText(payout) },
      );
    if (project) {
      project.notes = [
        ...(project.notes ?? []),
        {
          text: `🎲 ${outcome.roll ? `${outcome.roll}: ` : ''}${resultText}`,
          createdAt: this.clock.nowIso(),
        },
      ];
      project.status = outcome.won ? (payout ? 'paid back' : 'bought') : 'lost';
      project.phase = outcome.won && !payout ? 'execute' : 'completed';
    }
    if (outcome.won && payout) {
      // A loan that came back: the cash is income, nothing is owned afterwards.
      state.allTransactions.push({
        account: 'Daily',
        amount: payout,
        date: this.nextGameTransactionDate(),
        time: '',
        category: `@${title}`,
        comment: `${title} paid back\n#cashflow`,
      });
    } else if (outcome.won) {
      const owned = state.allAssets.find((asset) => asset.tag === title);
      if (owned) owned.amount = Number(owned.amount) + fromMinorUnits(deal.costMinor);
      else state.allAssets.push({ tag: title, amount: fromMinorUnits(deal.costMinor) });
    }
    this.setAssetDeal(title, {
      stage: outcome.won ? (payout ? 'paidBack' : 'owned') : 'lost',
    });
    this.persistAll('cashflow_dice', { title, won: outcome.won }, callbacks, {
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /**
   * Moves a card-deal's Grow project through the phases as the player trades (JFK, 2026-10-03):
   * planned = **plan**, bought = **execute**, and once the last share/property is sold = **completed**.
   * Selling only part of a share position keeps it in execute. Called by the Add dialog after a Grow
   * buy/sell on a Cashflow account (the normal Grow never moves phases on its own).
   */
  setPhaseAfterTrade(title: string, trade: 'buy' | 'sell'): void {
    const state = AppStateService.instance;
    const project = state.allGrowProjects.find((candidate) => candidate.title === title);
    if (!project) return;
    const stillHeld =
      state.allShares.some((share) => share.tag === title) ||
      state.allInvestments.some((investment) => investment.tag === title) ||
      state.allAssets.some((asset) => asset.tag === title);
    project.phase = trade === 'sell' && !stillHeld ? 'completed' : 'execute';
    // A sold property takes any market offer for it along.
    if (trade === 'sell' && !stillHeld) this.clearMarketOffer(title);
  }

  private clearMarketOffer(title: string): void {
    const state = AppStateService.instance;
    if (!(state.cashflowGame.marketOffers ?? []).some((offer) => offer.title === title)) return;
    state.cashflowGame = {
      ...state.cashflowGame,
      marketOffers: (state.cashflowGame.marketOffers ?? []).filter(
        (offer) => offer.title !== title,
      ),
    };
  }

  /**
   * Plays a market buyer card (JFK, 2026-10-03). Every property the player owns of the card's types
   * (`options.types`: the labels each type goes by - EFH, and SFH in English; copies carry -II, -III... -
   * and its unit count, for a fixed amount paid per unit) gets the buyer's offer: remembered in the
   * game state until the next Payday, and written into the property's Grow project as a note saying
   * what the sale would bring. The sale itself is the normal Sell button in Grow, which pre-fills this
   * offer (`marketSaleFor`). One undo step either way; calls back with the labels of the properties
   * that got an offer (none = the card does not apply to this player). The rule is
   * `playMarketBuyerCard` in @money/domain.
   */
  playMarketCard(
    card: CashflowMarketCard,
    options: { title?: string; types: { labels: string[]; units?: number }[] },
    callbacks: { onSuccess: (matched: string[]) => void; onError: (message: string) => void },
  ): void {
    let result: ReturnType<typeof playMarketBuyerCard>;
    try {
      result = playMarketBuyerCard(this.cardBooks(), card, options, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not play this market card.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    this.persistAll(
      'cashflow_market_card',
      { card: card.id, matched: result.matched.length },
      { onSuccess: () => callbacks.onSuccess(result.matched), onError: callbacks.onError },
      { includeGrow: true },
    );
  }

  /** The Grow project that already tracks a share (planned, held or sold out), if there is one. */
  shareProjectFor(symbol: string): Grow | undefined {
    return AppStateService.instance.allGrowProjects.find(
      (project) => project.title === symbol && Boolean(project.share?.tag),
    );
  }

  /**
   * The Grow project of a share the player still holds. Only these are touched by a market price
   * card: a share that was sold (at whatever price) or never bought has nothing to revalue, and its
   * past transactions stay exactly as they were (JFK, 2026-10-03).
   */
  heldShareProjectFor(symbol: string): Grow | undefined {
    const held = AppStateService.instance.allShares.some(
      (share) => share.tag === symbol && Number(share.quantity) > 0,
    );
    return held ? this.shareProjectFor(symbol) : undefined;
  }

  /**
   * A drawn stock card moves the market price (JFK, 2026-10-03): only its drawer can buy at that price,
   * but everyone can sell at it. When the player still holds shares of it this card does not plan
   * anything - it sets the share's price, on the Grow project and on the share held in the balance
   * sheet (quantity, cash and phase stay), and writes what happened on the stock market into the
   * project's notes. Buying or selling at the new price is then up to the player, in Grow. One undo
   * step. The rule is `updateSharePrice` in @money/domain.
   */
  updateSharePrice(
    card: CashflowDealCard,
    text: { description?: string },
    callbacks: { onSuccess: (title: string) => void; onError: (message: string) => void },
  ): void {
    let result: ReturnType<typeof updateSharePrice>;
    try {
      result = updateSharePrice(this.cardBooks(), card, text, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not update the share price.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    this.persistAll(
      'cashflow_share_price',
      { symbol: result.title, price: fromMinorUnits(card.priceMinor ?? 0) },
      { onSuccess: () => callbacks.onSuccess(result.title), onError: callbacks.onError },
      { includeBalanceSheet: true, includeGrow: true },
    );
  }

  /**
   * A stock split card (JFK, 2026-10-03): only for a player who owns that share - otherwise it does
   * not apply (calls back with null; still a History step). With the share, a dice decision opens on
   * the dashboard like the others: `resolveShareSplit` applies it. `options.labels` are the ticker's
   * labels (it is the same in every language). The rule is `playShareSplitCard` in @money/domain.
   */
  playShareSplitCard(
    card: CashflowMarketCard,
    options: { title?: string; labels: string[] },
    callbacks: { onSuccess: (share: string | null) => void; onError: (message: string) => void },
  ): void {
    let result: ReturnType<typeof playShareSplitCard>;
    try {
      result = playShareSplitCard(this.cardBooks(), card, options, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not play this market card.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    if (!result.effects.write) {
      callbacks.onSuccess(null);
      return;
    }
    this.applyGameEffects(result.effects);
    this.persistAll(
      'cashflow_market_split',
      { share: result.share },
      {
        onSuccess: () => {
          callbacks.onSuccess(result.share);
          this.decisionNeeded$.next();
        },
        onError: callbacks.onError,
      },
    );
  }

  /**
   * The split roll (JFK, 2026-10-03): 1-3 (`won`) doubles the quantity of the share, 4-6 halves it
   * (the half you keep rounds up). Only the quantity changes - no price, no cash, no cost. One undo
   * step, and a note on the share's Grow project.
   */
  private resolveShareSplit(
    deal: CashflowAssetDeal,
    outcome: { won: boolean; roll?: number },
    callbacks: CashflowGameCallbacks,
  ): void {
    const state = AppStateService.instance;
    const tag = deal.split?.shareTag ?? '';
    const share = state.allShares.find((candidate) => candidate.tag === tag);
    const from = Number(share?.quantity) || 0;
    const to = outcome.won ? from * 2 : Math.ceil(from / 2);
    this.pushUndoSnapshot({
      kind: outcome.won ? 'shareSplit' : 'shareReverseSplit',
      detail: `${tag} · ${outcome.roll ? `🎲 ${outcome.roll} · ` : ''}${from} → ${to}`,
    });
    if (share) share.quantity = to;
    const project = state.allGrowProjects.find((candidate) => candidate.title === tag);
    if (project) {
      if (project.share && Number(project.share.quantity) === from) project.share.quantity = to;
      project.notes = [
        ...(project.notes ?? []),
        {
          text: `🎲 ${outcome.roll ? `${outcome.roll}: ` : ''}${this.translate.instant(
            outcome.won ? 'CashflowGame.splitDouble' : 'CashflowGame.splitHalve',
            { share: tag, from, to },
          )}`,
          createdAt: this.clock.nowIso(),
        },
      ];
    }
    state.cashflowGame = {
      ...state.cashflowGame,
      assetDeals: this.assetDeals().filter((candidate) => candidate.title !== deal.title),
    };
    this.persistAll('cashflow_share_split', { share: tag, won: outcome.won }, callbacks, {
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /**
   * A cashflow boost (JFK, 2026-10-03: "Kleiner Business Boom!", "Neues Managementsystem"): every
   * investment that pays a monthly cashflow of up to the card's limit gains the card's amount. The
   * Grow project's cashflow and its Payday subscription are both raised, and the project gets a note.
   * Calls back with what changed (empty = the card does not apply; still a History step).
   * `options.businessLabels`, when given, restricts the boost to those property labels. The rule is
   * `playBoostCard` in @money/domain.
   */
  playBoostCard(
    card: CashflowMarketCard,
    options: { title?: string; businessLabels?: string[] },
    callbacks: {
      onSuccess: (changed: { title: string; from: number; to: number }[]) => void;
      onError: (message: string) => void;
    },
  ): void {
    let result: ReturnType<typeof playBoostCard>;
    try {
      result = playBoostCard(this.cardBooks(), card, options, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not play this market card.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    const changed = result.changed.map((entry) => ({
      title: entry.title,
      from: fromMinorUnits(entry.fromMinor),
      to: fromMinorUnits(entry.toMinor),
    }));
    this.persistAll(
      'cashflow_market_boost',
      { card: card.id, changed: changed.length },
      { onSuccess: () => callbacks.onSuccess(changed), onError: callbacks.onError },
      { includeSubscriptions: true, includeGrow: true },
    );
  }

  /**
   * A Market card that costs money to a player who owns a property (JFK, 2026-10-03: tenant damage,
   * a broken sewer pipe). Calls back with the label of the first property the player owns - the
   * payment is then booked on it through the Add dialog, which the caller opens - or with null when
   * they own none and the card simply does not apply (that is still a History step: the card was
   * played). `options.types` lists the labels every kind of property goes by. The rule is
   * `playMarketCostCard` in @money/domain.
   */
  playMarketCostCard(
    card: CashflowMarketCard,
    options: { title?: string; types: { labels: string[] }[] },
    callbacks: { onSuccess: (property: string | null) => void; onError: (message: string) => void },
  ): void {
    let result: ReturnType<typeof playMarketCostCard>;
    try {
      result = playMarketCostCard(this.cardBooks(), card, options);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not play this market card.'));
      return;
    }
    if (result.effects.step) this.pushUndoSnapshot(result.effects.step);
    callbacks.onSuccess(result.property);
  }

  /**
   * The market offer waiting for a property, as the Sell button needs it (JFK, 2026-10-03): the
   * buyer's price and `netCash`, the income the sale books: the buyer pays the original price (deposit +
   * mortgage) plus the profit, the mortgage is paid back out of it, so what is left is the deposit
   * plus the profit (JFK, 2026-10-03). Null when no buyer is interested (or this is not a Cashflow
   * game). The rule is `marketSaleFor` in @money/domain.
   */
  marketSaleFor(title: string): {
    salePrice: number;
    netCash: number;
    label: string;
    /** Gold offers only: the price for every coin, and how many coins are owned now. */
    pricePerCoin?: number;
    coins?: number;
  } | null {
    if (!CashflowGameService.isCashflowGame()) return null;
    const books = this.cardBooks();
    const sale = marketSaleFor(books.state, books.investments, title);
    if (!sale) return null;
    return {
      salePrice: fromMinorUnits(sale.salePriceMinor),
      netCash: fromMinorUnits(sale.netCashMinor),
      label: sale.label,
      ...(sale.pricePerCoinMinor !== undefined
        ? { pricePerCoin: fromMinorUnits(sale.pricePerCoinMinor), coins: sale.coins }
        : {}),
    };
  }

  /**
   * Keeps the one "🏦" note of a planned card current: what the buy costs, the cash on hand and the
   * bank loan that would be taken for it (JFK, 2026-10-03: changing the quantity should *update* this
   * comment, never add a new one). Called when a card is planned and by the Grow edit form on save.
   * Only touches game-planned projects - once bought or sold the note stays as the last word.
   */
  syncPlanNote(project: Grow): void {
    if (project.status !== 'planned') return;
    const text = this.loanNoteText(project);
    if (!text) return;
    const notes = project.notes ?? (project.notes = []);
    const existing = notes.find((note) => note.text.startsWith(LOAN_NOTE_MARK));
    if (existing) existing.text = text;
    else notes.push({ text, createdAt: this.clock.nowIso() });
    // A share's loan needed goes into the project's own Loan field, so Buy carries it - and the buy
    // then takes it as a Bank loan (`beforeGrowTrade`) instead of creating a liability for the
    // project. Grow's own convention holds: Deposit (`amount`) = cost - Loan, and the Loan never
    // exceeds the cost even though the bank lends in whole steps. A property keeps its full
    // Anzahlung as Deposit and no Loan field (its loan is the note and the automatic Bank loan).
    if (project.share?.tag) {
      const cost = this.roundToCents(
        (Number(project.share.quantity) || 0) * (Number(project.share.price) || 0),
      );
      const loan = Math.min(this.loanNeeded(project), cost);
      project.liabilitie =
        loan > 0
          ? { tag: project.title, amount: loan, credit: 0, investment: true }
          : (null as any);
      project.amount = this.roundToCents(cost - loan);
    } else {
      project.liabilitie = null as any;
    }
  }

  private roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** The Bank loan a planned buy would need, rounded up to the loan step (0 when cash covers it or the quantity isn't set yet). */
  private loanNeeded(project: Grow): number {
    const costMinor = project.share?.tag
      ? Math.round(
          (Number(project.share.quantity) || 0) * toMinorUnits(Number(project.share.price) || 0),
        )
      : project.investment?.tag
        ? toMinorUnits(Number(project.investment.deposit) || 0)
        : project.isAsset
          ? toMinorUnits(Number(project.amount) || 0)
          : 0;
    return fromMinorUnits(this.loanForCostMinor(costMinor));
  }

  /** The Bank loan a purchase of `costMinor` would need at the current cash: the shortfall rounded up to the game set's loan step. */
  private loanForCostMinor(costMinor: number): number {
    return loanForShortfallMinor(
      costMinor,
      toMinorUnits(this.cash),
      this.currentGameSet()?.loanRule.incrementMinor ?? 0,
    );
  }

  /**
   * The "🏦" line pre-filled into a Doodad payment (JFK, 2026-10-03): the cash on hand, the cost and
   * the Bank loan the payment would need - the same facts the Grow note gives for a purchase.
   */
  doodadLoanNote(costMinor: number): string {
    const state = AppStateService.instance;
    const money = (amount: number) => `${amount.toLocaleString()} ${state.currency}`;
    const cash = this.cash;
    const loan = fromMinorUnits(this.loanForCostMinor(costMinor));
    return (
      LOAN_NOTE_MARK +
      this.translate.instant('CashflowGame.noteCashDoodad', {
        cash: money(cash),
        cost: money(fromMinorUnits(costMinor)),
        loan: money(loan),
      })
    );
  }

  private loanNoteText(project: Grow): string | null {
    const state = AppStateService.instance;
    const money = (amount: number) => `${amount.toLocaleString()} ${state.currency}`;
    const cash = this.cash;
    const loanFor = (costMinor: number) => fromMinorUnits(this.loanForCostMinor(costMinor));
    if (project.share?.tag) {
      const quantity = Number(project.share.quantity) || 0;
      const price = Number(project.share.price) || 0;
      if (quantity <= 0) {
        return (
          LOAN_NOTE_MARK +
          this.translate.instant('CashflowGame.noteCashShare', { cash: money(cash) })
        );
      }
      const costMinor = Math.round(quantity * toMinorUnits(price));
      return (
        LOAN_NOTE_MARK +
        this.translate.instant('CashflowGame.noteLoanShare', {
          quantity,
          price: money(price),
          cost: money(fromMinorUnits(costMinor)),
          cash: money(cash),
          loan: money(loanFor(costMinor)),
        })
      );
    }
    if (project.investment?.tag) {
      const deposit = Number(project.investment.deposit) || 0;
      return (
        LOAN_NOTE_MARK +
        this.translate.instant('CashflowGame.noteCashInvestment', {
          cash: money(cash),
          deposit: money(deposit),
          loan: money(loanFor(toMinorUnits(deposit))),
        })
      );
    }
    if (project.isAsset) {
      const cost = Number(project.amount) || 0;
      return (
        LOAN_NOTE_MARK +
        this.translate.instant('CashflowGame.noteCashInvestment', {
          cash: money(cash),
          deposit: money(cost),
          loan: money(loanFor(toMinorUnits(cost))),
        })
      );
    }
    return null;
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
  executeDeal(title: string, callbacks: CashflowGameCallbacks, quantity?: number): void {
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

    // A stock card leaves the count to the player (JFK, 2026-09-30), so the buy can carry it.
    const shareQuantity = kind === 'share' ? (quantity ?? project.share.quantity) : 0;
    if (kind === 'share' && !(Number.isInteger(shareQuantity) && shareQuantity > 0)) {
      callbacks.onError('Enter how many shares you want to buy.');
      return;
    }
    const costMinor =
      kind === 'share'
        ? multiplyQuantityPrice(shareQuantity, toMinorUnits(project.share.price))
        : toMinorUnits(project.investment.deposit);
    const cashMinor = toMinorUnits(this.cash);
    const shortfallMinor = costMinor - cashMinor;
    // Taking the loan and buying with it are two separate moves (JFK, 2026-09-30), so each gets its
    // own undo step: one Undo takes back the purchase, the next takes back the loan.
    const pushedSnapshots: CashflowGameSnapshot[] = [];
    const pushTracked = (step: CashflowStepInfo) => {
      this.pushUndoSnapshot(step);
      pushedSnapshots.push(this.undoStack[this.undoStack.length - 1]);
    };
    try {
      if (shortfallMinor > 0) {
        pushTracked({ kind: 'loanAuto' });
        const gameSet = this.currentGameSet();
        if (!gameSet) throw new Error('Pick a profession first.');
        const borrowMinor = loanForShortfallMinor(
          costMinor,
          cashMinor,
          gameSet.loanRule.incrementMinor,
        );
        this.applyBankLoanAdjustment(fromMinorUnits(borrowMinor));
      }
      pushTracked({ kind: 'buyDeal', detail: title });

      const buyResult =
        kind === 'share'
          ? calculateBuyShare({
              title,
              quantity: shareQuantity,
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
        date: this.nextGameTransactionDate(),
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
        this.registerInvestmentIncome(title);
      }
    } catch (err: unknown) {
      // Half a deal (loan taken, purchase failed) must not stay in memory — roll back to before it.
      if (pushedSnapshots.length) {
        this.applySnapshot(pushedSnapshots[0]);
        this.undoStack.splice(this.undoStack.length - pushedSnapshots.length);
        this.persistUndoStack();
      }
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
   * game-meta state itself, back to a blank slate - and the undo history with
   * it (JFK, 2026-10-03). JFK, 2026-09-26: a fast way to start over while
   * playtesting; history/status don't need to survive a reset. Double-gated (the whole page already is) since this is
   * the most destructive action here — never touches a non-cashflow
   * account even if somehow called on one.
   */
  resetGame(callbacks: CashflowGameCallbacks): void {
    if (!CashflowGameService.isCashflowGame()) {
      callbacks.onError('This is only available for a Cashflow game account.');
      return;
    }
    // A reset ends the game, history included - there is nothing to undo back into (JFK, 2026-10-03).
    this.clearPersistedUndoStack();
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
   * Every card of a deck, or only those matching `query`, ordered by symbol/name then price - what
   * the lookup grid shows. A big catalog stays scannable: type `ok4u` and the five OK4U prices are
   * right there, in ascending order.
   */
  browseCards<K extends CashflowDeckKind>(deckKind: K, query: string): CashflowDeckCardMap[K][] {
    const deck = (this.currentGameSet()?.decks?.[deckKind] ?? []) as CashflowDeckCardMap[K][];
    const cards = query.trim() ? findCards(deck, query) : [...deck];
    const key = (card: any) => String(card.symbol ?? card.title).toLocaleLowerCase();
    const price = (card: any) =>
      Number(card.priceMinor ?? card.costMinor ?? card.depositMinor ?? 0);
    return cards.sort((a, b) => key(a).localeCompare(key(b)) || price(a) - price(b));
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
  applyDealCard(
    card: CashflowDealCard,
    callbacks: { onSuccess: (plannedTitle: string) => void; onError: (message: string) => void },
    text: CashflowCardPlanText = {},
  ): void {
    let input: CashflowDealInput;
    if (card.assetKind === 'share') {
      input = {
        kind: 'share',
        // The ticker identifies the position; a card without one (placeholders) falls back to its name.
        title: card.symbol ?? card.title,
        subtitle: card.title,
        quantity: card.quantity ?? 0,
        price: fromMinorUnits(card.priceMinor ?? 0),
        description: text.description,
        note: text.note,
        strategy: text.strategy,
      };
    } else if (card.assetKind === 'asset') {
      input = {
        kind: 'asset',
        // Every special-asset card is its own deal: GOLD, then GOLD-II...
        title: this.nextInvestmentLabel(text.symbol ?? card.symbol ?? card.title),
        subtitle: text.title ?? card.title,
        cost: fromMinorUnits(card.costMinor ?? 0),
        coins: card.quantity ?? 0,
        successOn: card.successOn,
        payout: card.payoutMinor ? fromMinorUnits(card.payoutMinor) : undefined,
        recurring: card.recurring,
        description: text.description,
        note: text.note,
        strategy: text.strategy,
        successText: text.success,
        failureText: text.failure,
      };
    } else {
      input = {
        kind: 'investment',
        // Every investment card is its own deal: EFH, then EFH-II, EFH-III...
        title: this.nextInvestmentLabel(text.symbol ?? card.symbol ?? card.title),
        subtitle: text.title ?? card.title,
        deposit: fromMinorUnits(card.depositMinor ?? 0),
        mortgage: fromMinorUnits(card.mortgageMinor ?? 0),
        cashflow: fromMinorUnits(card.cashflowMinor ?? 0),
        description: text.description,
        note: text.note,
      };
    }
    this.planDeal(input, {
      onSuccess: () => callbacks.onSuccess(input.title),
      onError: callbacks.onError,
    });
  }

  /**
   * The first free label for another copy of an investment: the bare abbreviation, then `-II`,
   * `-III`... Hyphenated, never spaced - Grow's buy comment ("Buy Investment EFH 3000 47000;") is
   * split on spaces, so a space in the label would corrupt the purchase.
   */
  private nextInvestmentLabel(base: string): string {
    const state = AppStateService.instance;
    const taken = new Set([
      ...state.allGrowProjects.map((project) => project.title),
      ...state.allInvestments.map((investment) => investment.tag),
      ...state.allAssets.map((asset) => asset.tag),
    ]);
    if (!taken.has(base)) return base;
    for (let copy = 2; ; copy++) {
      const label = `${base}-${toRoman(copy)}`;
      if (!taken.has(label)) return label;
    }
  }

  /**
   * Called once an investment is bought (by `executeDeal`, and by the Add dialog's Buy Investment on
   * a Cashflow account): its monthly cashflow becomes a real Subscription AND is registered with
   * Payday - Payday only acts on `gameSubscriptionTitles`, so a Subscription that isn't listed
   * there would never pay out. Safe to call again; it just refreshes the amount.
   */
  registerInvestmentIncome(title: string): void {
    const state = AppStateService.instance;
    const project = state.allGrowProjects.find((candidate) => candidate.title === title);
    const cashflow = Number(project?.cashflow) || 0;
    if (cashflow <= 0) return;
    const subscriptionTitle = `${title} Cashflow`;
    this.upsertSubscription({
      title: subscriptionTitle,
      account: 'Income',
      amountMinor: toMinorUnits(cashflow),
      frequency: 'monthly',
      category: `@${title}`,
    });
    if (!state.cashflowGame.gameSubscriptionTitles.includes(subscriptionTitle)) {
      state.cashflowGame = {
        ...state.cashflowGame,
        gameSubscriptionTitles: [...state.cashflowGame.gameSubscriptionTitles, subscriptionTitle],
      };
    }
  }

  /**
   * Selling a drawn card to another player for a one-time price (JFK, 2026-09-30): plain income, not
   * a Grow sale — no position exists yet. The category names the card, so History and the
   * transaction list show which card was traded.
   */
  sellCardToFriend(
    card: CashflowDealCard,
    amount: number,
    callbacks: CashflowGameCallbacks,
    label?: string,
  ): void {
    const state = AppStateService.instance;
    if (!state.cashflowGame.virtualDate) {
      callbacks.onError('Pick a profession first.');
      return;
    }
    if (!(amount > 0)) {
      callbacks.onError('Enter the price your friend pays.');
      return;
    }
    const name = label ?? card.symbol ?? card.title;
    this.pushUndoSnapshot({ kind: 'cardSale', detail: name });
    state.allTransactions.push({
      account: 'Daily',
      amount,
      // The next free day of the real current month, spread like the Subscriptions (1st, 3rd, 5th… then 2nd, 4th…).
      date: this.nextGameTransactionDate(),
      time: '',
      category: `@${name} card sale`,
      comment: `Sold the ${name} card to a friend\n#cashflow`,
    });
    this.persistAll('cashflow_card_sale', { card: card.id, amount }, callbacks);
  }

  /** Returns the conflicting kind only when the existing project is clearly the other one — never blocks on missing/ambiguous legacy data. */
  private conflictingGrowKind(project: Grow, kind: 'share' | 'investment' | 'asset'): boolean {
    if (kind === 'asset') return Boolean(project.share?.tag || project.investment?.tag);
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
      Object.assign(existing, patch, { updatedAt: this.clock.nowIso() });
      return;
    }
    const now = this.clock.nowIso();
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

  /** The running game's profession, in the game's language - null before a game is started. */
  liveProfessionTitle(): string | null {
    const profession = this.currentProfession();
    return profession ? this.translateProfessionTitle(profession) : null;
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

/** Which monthly expense line a starting liability's payments are (profession card keys). */
const LIABILITY_EXPENSE_KEYS: Record<string, string> = {
  mortgage: 'mortgageRent',
  carLoan: 'carLoan',
  creditCardDebt: 'creditCard',
  studentLoanDebt: 'studentLoan',
  bankLoan: 'bankLoanPayment',
};

/** Marks the one Grow note a planned card keeps current (bank loan needed for the buy). */
const LOAN_NOTE_MARK = '🏦 ';

function toRoman(value: number): string {
  const numerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = value;
  let result = '';
  for (const [amount, numeral] of numerals) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }
  return result;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
