import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import {
  afterAssetBuy as afterAssetBuyRule,
  afterAssetSell as afterAssetSellRule,
  beforeAssetBuy as beforeAssetBuyRule,
  openDecisions as openDecisionsOf,
  paydayRollCount as paydayRollCountOf,
  resolveGamble as resolveGambleRule,
  sellCoins as sellCoinsRule,
  CashflowAssetDeal,
  CashflowDealCard,
  CashflowDeckKind,
  CashflowDoodadCard,
  CashflowGameSet,
  CashflowGameState,
  CashflowGameSubscription,
  CashflowMarketCard,
  CashflowProfession,
  CashflowTransactionRecord,
  cashOnHandMinor,
  coinsOwnedOf,
  decodeUndoChain,
  encodeUndoChain,
  isEncodedUndoChain,
  type EncodedUndoChain,
  dealInputFromCard,
  doodadLoanNote as doodadLoanNoteRule,
  executeDeal as executeDealRule,
  clearCashflowStatus,
  computeMonthlyCashflowMinor,
  drawRandomCard,
  findCards,
  fromMinorUnits,
  gameSubscriptionDays,
  gameTradeStep,
  initialCashflowGameState,
  marketSaleFor,
  nextSmartDate,
  pickCashflowProfession,
  planAutoLoan,
  planDeal as planDealRule,
  plannedDeals as plannedDealsRule,
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
  registerInvestmentIncome as registerInvestmentIncomeRule,
  removeExpenseForPaidLiability as removeExpenseForPaidLiabilityRule,
  sellCardToFriend as sellCardToFriendRule,
  setPhaseAfterTrade as setPhaseAfterTradeRule,
  syncPlanNote as syncPlanNoteRule,
  takenDealLabels,
  sellAssetProblem,
  summarizeGameFinances,
  systemClock,
  toMinorUnits,
  tradePurchase,
  updateSharePrice,
  usedDaysThisMonth,
  type BookGrowProject,
  type BookGrowUpdate,
  type BookSubscription,
  type CardBooks,
  type CardDeps,
  type DealDeps,
  type DealInput,
  type Clock,
  type GameBooks,
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

/** The service's decimal deal input in the domain's minor units. */
function toDealInput(input: CashflowDealInput): DealInput {
  if (input.kind === 'share') {
    return {
      kind: 'share',
      title: input.title,
      quantity: input.quantity,
      priceMinor: toMinorUnits(input.price),
      subtitle: input.subtitle,
      description: input.description,
      note: input.note,
      strategy: input.strategy,
    };
  }
  if (input.kind === 'investment') {
    return {
      kind: 'investment',
      title: input.title,
      depositMinor: toMinorUnits(input.deposit),
      mortgageMinor: toMinorUnits(input.mortgage),
      cashflowMinor: toMinorUnits(input.cashflow),
      subtitle: input.subtitle,
      description: input.description,
      note: input.note,
    };
  }
  return {
    kind: 'asset',
    title: input.title,
    costMinor: toMinorUnits(input.cost),
    coins: input.coins,
    successOn: input.successOn,
    payoutMinor: input.payout ? toMinorUnits(input.payout) : undefined,
    recurring: input.recurring,
    subtitle: input.subtitle,
    description: input.description,
    note: input.note,
    strategy: input.strategy,
    successText: input.successText,
    failureText: input.failureText,
  };
}

function toBookGrowProject(project: Grow): BookGrowProject {
  const minor = (amount: unknown) => toMinorUnits(Number(amount) || 0);
  return {
    title: project.title,
    sub: project.sub ?? '',
    phase: project.phase,
    status: project.status ?? '',
    description: project.description ?? '',
    strategy: project.strategy ?? '',
    notes: project.notes ?? [],
    cashflowMinor: minor(project.cashflow),
    amountMinor: minor(project.amount),
    isAsset: Boolean(project.isAsset),
    share: project.share?.tag
      ? {
          tag: project.share.tag,
          quantity: Number(project.share.quantity) || 0,
          priceMinor: minor(project.share.price),
        }
      : null,
    investment: project.investment?.tag
      ? {
          tag: project.investment.tag,
          depositMinor: minor(project.investment.deposit),
          amountMinor: minor(project.investment.amount),
        }
      : null,
    loan: project.liabilitie?.tag
      ? {
          tag: project.liabilitie.tag,
          amountMinor: minor(project.liabilitie.amount),
          creditMinor: minor(project.liabilitie.credit),
          investment: Boolean(project.liabilitie.investment),
        }
      : null,
    updatedAt: project.updatedAt ?? '',
  };
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
    if (isEncodedUndoChain(stored)) return decodeUndoChain<CashflowGameSnapshot>(stored);
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
      let project = state.allGrowProjects.find((candidate) => candidate.title === update.title);
      if (!project) {
        if (!update.create) continue;
        project = this.newGrowProject(update.title, update.createdAt ?? this.clock.nowIso());
        state.allGrowProjects.push(project);
      }
      this.applyGrowUpdate(project, update);
    }
    for (const { tag, priceMinor } of effects.sharePrices) {
      const held = state.allShares.find((share) => share.tag === tag);
      if (held) held.price = fromMinorUnits(priceMinor);
    }
    for (const upsert of effects.shareUpserts) {
      this.upsertEntity(state.allShares, upsert.tag, () => ({
        tag: upsert.tag,
        quantity: upsert.quantity,
        price: fromMinorUnits(upsert.priceMinor),
      }));
    }
    for (const upsert of effects.assetUpserts) {
      this.upsertEntity(state.allAssets, upsert.tag, () => ({
        tag: upsert.tag,
        amount: fromMinorUnits(upsert.amountMinor),
      }));
    }
    for (const tag of effects.assetRemovals) {
      const index = state.allAssets.findIndex((asset) => asset.tag === tag);
      if (index >= 0) state.allAssets.splice(index, 1);
    }
    for (const upsert of effects.investmentUpserts) {
      this.upsertEntity(state.allInvestments, upsert.tag, () => ({
        tag: upsert.tag,
        deposit: fromMinorUnits(upsert.depositMinor),
        amount: fromMinorUnits(upsert.amountMinor),
      }));
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
    this.runPlanDeal(toDealInput(input), callbacks);
  }

  /** `planDeal`'s work, on the domain's own input (also what a drawn card is turned into). */
  private runPlanDeal(input: DealInput, callbacks: CashflowGameCallbacks): void {
    let effects: GameEffects;
    try {
      effects = planDealRule(this.gameBooks(), input, this.dealDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not plan this deal.'));
      return;
    }
    this.pushUndoSnapshot(effects.step as CashflowStepInfo);
    this.applyGameEffects(effects);
    this.persistAll('cashflow_deal_plan', { kind: input.kind, title: input.title }, callbacks, {
      includeGrow: true,
    });
  }

  /** Everything the deal rules read of the account, in minor units. */
  private gameBooks(): GameBooks {
    const state = AppStateService.instance;
    const minor = (amount: unknown) => toMinorUnits(Number(amount) || 0);
    return {
      state: state.cashflowGame,
      allocation: {
        daily: state.daily,
        splurge: state.splurge,
        smile: state.smile,
        fire: state.fire,
      },
      gameSet: this.currentGameSet(),
      subscriptions: state.allSubscriptions.map(toBookSubscription),
      transactions: state.allTransactions.map((transaction) => ({
        account: transaction.account,
        amountMinor: toMinorUnits(transaction.amount),
        date: transaction.date,
        time: transaction.time,
        category: transaction.category,
        comment: transaction.comment,
      })),
      liabilities: state.liabilities.map((liability) => ({
        tag: liability.tag,
        amountMinor: minor(liability.amount),
        investment: Boolean(liability.investment),
      })),
      shares: state.allShares.map((share) => ({
        tag: share.tag,
        quantity: Number(share.quantity) || 0,
        priceMinor: minor(share.price),
      })),
      investments: state.allInvestments.map((investment) => ({
        tag: investment.tag,
        depositMinor: minor(investment.deposit),
        amountMinor: minor(investment.amount),
      })),
      assets: state.allAssets.map((asset) => ({
        tag: asset.tag,
        amountMinor: minor(asset.amount),
      })),
      growProjects: state.allGrowProjects.map(toBookGrowProject),
    };
  }

  /** The card rules' dependencies plus the plain money format the "🏦" notes use (the browser's own locale). */
  private get dealDeps(): DealDeps {
    const state = AppStateService.instance;
    return {
      ...this.cardDeps,
      plainMoney: (amountMinor) =>
        `${fromMinorUnits(amountMinor).toLocaleString()} ${state.currency}`,
    };
  }

  /**
   * Paying a starting liability off (car loan, credit card, student loan, home mortgage...) also ends
   * the monthly expense that went with it (JFK, 2026-10-03). Call after the liability is gone; does
   * nothing while any of it is still owed. The Subscription is removed from the game too, so Payday
   * stops charging it - and because the Add dialog took an undo snapshot first, one Undo brings both
   * the debt and its expense back. Returns the removed expense's title (or null).
   */
  removeExpenseForPaidLiability(liabilityTag: string): string | null {
    const { title, effects } = removeExpenseForPaidLiabilityRule(
      this.gameBooks(),
      this.currentProfession(),
      liabilityTag,
      this.dealDeps.text,
    );
    if (effects) this.applyGameEffects(effects);
    return title;
  }

  /** The toast text for a removed monthly expense, in the current language. */
  expenseRemovedMessage(title: string): string {
    return this.translate.instant('CashflowGame.expenseRemoved', { title });
  }

  /**
   * Called by the Add dialog's Buy Asset before it books the asset. A dice-gamble card is *paid* but
   * does not become an asset yet - it waits for the roll (`resolveGamble`) - so this returns true and
   * the dialog skips creating it. A plain offer returns false and is booked as usual.
   */
  beforeAssetBuy(title: string): boolean {
    const hook = beforeAssetBuyRule(AppStateService.instance.cashflowGame, title);
    if (hook.effects) this.applyGameEffects(hook.effects);
    return hook.gamble;
  }

  /** After the dialog's Buy Asset: a plain offer is now owned; a gamble is paid and waits for its roll. */
  afterAssetBuy(title: string): void {
    const effects = afterAssetBuyRule(this.gameBooks(), title);
    this.applyGameEffects(effects);
    // Paid: bring the player straight to the game dashboard, where the roll is decided.
    if (effects.decisionNeeded) this.decisionNeeded$.next();
  }

  /** After the dialog's Sell Asset: the project is sold only when the asset is gone; otherwise it still holds what is left. */
  afterAssetSell(title: string): void {
    this.applyGameEffects(afterAssetSellRule(this.gameBooks(), title));
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
    const { sold, effects } = sellCoinsRule(
      this.gameBooks(),
      title,
      quantity,
      toMinorUnits(price),
      this.cardDeps,
    );
    if (effects) this.applyGameEffects(effects);
    return sold;
  }

  /** Fires when a dice card has just been paid - the game panel listens and opens on the open decision (JFK, 2026-10-03). */
  readonly decisionNeeded$ = new Subject<void>();

  /** Paid dice cards still waiting for their roll - shown on the game dashboard as an open decision. */
  get openDecisions(): CashflowAssetDeal[] {
    return openDecisionsOf(AppStateService.instance.cashflowGame);
  }

  /** How many cards the open Payday roll covers: a roll pays once per card, so two cards win (or miss) together. */
  paydayRollCount(deal: CashflowAssetDeal): number {
    return paydayRollCountOf(AppStateService.instance.cashflowGame, deal);
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
    let result: ReturnType<typeof resolveGambleRule>;
    try {
      result = resolveGambleRule(this.gameBooks(), title, outcome, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not settle this card.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    const { persist } = result.effects;
    this.persistAll(
      result.kind === 'split' ? 'cashflow_share_split' : 'cashflow_dice',
      result.kind === 'split'
        ? { share: result.share, won: outcome.won }
        : { title, won: outcome.won },
      callbacks,
      {
        includeSubscriptions: persist.subscriptions,
        includeBalanceSheet: persist.balanceSheet,
        includeGrow: persist.grow,
      },
    );
  }

  /**
   * Moves a card-deal's Grow project through the phases as the player trades (JFK, 2026-10-03):
   * planned = **plan**, bought = **execute**, and once the last share/property is sold = **completed**.
   * Selling only part of a share position keeps it in execute. Called by the Add dialog after a Grow
   * buy/sell on a Cashflow account (the normal Grow never moves phases on its own).
   */
  setPhaseAfterTrade(title: string, trade: 'buy' | 'sell'): void {
    const effects = setPhaseAfterTradeRule(this.gameBooks(), title, trade);
    if (effects) this.applyGameEffects(effects);
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
    const update = syncPlanNoteRule(this.gameBooks(), toBookGrowProject(project), this.dealDeps);
    if (update) this.applyGrowUpdate(project, update);
  }

  /**
   * The "🏦" line pre-filled into a Doodad payment (JFK, 2026-10-03): the cash on hand, the cost and
   * the Bank loan the payment would need - the same facts the Grow note gives for a purchase.
   */
  doodadLoanNote(costMinor: number): string {
    return doodadLoanNoteRule(this.gameBooks(), costMinor, this.dealDeps);
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
    let result: ReturnType<typeof executeDealRule>;
    try {
      result = executeDealRule(this.gameBooks(), title, quantity, this.dealDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not complete this deal.'));
      return;
    }
    // Taking the loan and buying with it are two separate moves (JFK, 2026-09-30), so each gets its
    // own undo step: one Undo takes back the purchase, the next takes back the loan.
    for (const effects of result.steps) {
      this.pushUndoSnapshot(effects.step as CashflowStepInfo);
      this.applyGameEffects(effects);
    }
    this.persistAll('cashflow_deal_execute', { kind: result.kind, title }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** Grow projects not yet bought — planned only (todo/cashflow-game.md decision 12): the deal's plan exists, but no real Share/Investment position backs it yet. */
  get plannedDeals(): Grow[] {
    const state = AppStateService.instance;
    const titles = new Set(plannedDealsRule(this.gameBooks()).map((project) => project.title));
    return state.allGrowProjects.filter((project) => titles.has(project.title));
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
    const input = dealInputFromCard(card, text, takenDealLabels(this.gameBooks()));
    this.runPlanDeal(input, {
      onSuccess: () => callbacks.onSuccess(input.title),
      onError: callbacks.onError,
    });
  }

  /**
   * Called once an investment is bought (by `executeDeal`, and by the Add dialog's Buy Investment on
   * a Cashflow account): its monthly cashflow becomes a real Subscription AND is registered with
   * Payday - Payday only acts on `gameSubscriptionTitles`, so a Subscription that isn't listed
   * there would never pay out. Safe to call again; it just refreshes the amount.
   */
  registerInvestmentIncome(title: string): void {
    const effects = registerInvestmentIncomeRule(this.gameBooks(), title, this.dealDeps);
    if (effects) this.applyGameEffects(effects);
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
    let effects: GameEffects;
    try {
      effects = sellCardToFriendRule(
        this.gameBooks(),
        card,
        toMinorUnits(amount),
        label,
        this.dealDeps,
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not sell this card.'));
      return;
    }
    this.pushUndoSnapshot(effects.step as CashflowStepInfo);
    this.applyGameEffects(effects);
    this.persistAll('cashflow_card_sale', { card: card.id, amount }, callbacks);
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

  /** A fresh Grow project with the defaults the game has always created one with. */
  private newGrowProject(title: string, createdAt: string): Grow {
    return {
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
      createdAt,
      updatedAt: createdAt,
      type: 'income-growth',
    };
  }

  /** Writes the fields of a rule's project update onto the live project (decimal amounts, Grow's own field names). */
  private applyGrowUpdate(project: Grow, update: BookGrowUpdate): void {
    if (update.sub !== undefined) project.sub = update.sub;
    if (update.phase !== undefined) project.phase = update.phase as Grow['phase'];
    if (update.status !== undefined) project.status = update.status;
    if (update.description !== undefined) project.description = update.description;
    if (update.strategy !== undefined) project.strategy = update.strategy;
    if (update.isAsset !== undefined) project.isAsset = update.isAsset;
    if (update.amountMinor !== undefined) project.amount = fromMinorUnits(update.amountMinor);
    if (update.cashflowMinor !== undefined) project.cashflow = fromMinorUnits(update.cashflowMinor);
    if (update.share !== undefined) {
      project.share = update.share
        ? {
            tag: update.share.tag,
            quantity: update.share.quantity,
            price: fromMinorUnits(update.share.priceMinor),
          }
        : (null as any);
    }
    if (update.sharePriceMinor !== undefined && project.share) {
      project.share.price = fromMinorUnits(update.sharePriceMinor);
    }
    if (update.investment !== undefined) {
      project.investment = update.investment
        ? {
            tag: update.investment.tag,
            deposit: fromMinorUnits(update.investment.depositMinor),
            amount: fromMinorUnits(update.investment.amountMinor),
          }
        : (null as any);
    }
    if (update.loan !== undefined) {
      project.liabilitie = update.loan
        ? {
            tag: update.loan.tag,
            amount: fromMinorUnits(update.loan.amountMinor),
            credit: fromMinorUnits(update.loan.creditMinor),
            investment: update.loan.investment,
          }
        : (null as any);
    }
    if (update.notes !== undefined) project.notes = update.notes;
    if (update.updatedAt !== undefined) project.updatedAt = update.updatedAt;
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
