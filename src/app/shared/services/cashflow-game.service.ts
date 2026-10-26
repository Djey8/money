import { dreamToSmile, reserveToFire } from 'src/app/main/cashflow-game/dream-project';
import { RemoteGameHook } from './remote-game';
import { MoneyLocation } from '../../interfaces/location';
import { reconcileLocationBooking } from '../location-balance';
import {
  applyPlanChange,
  fillMissing,
  dropStaleRows,
  healLegacyRows,
  planFromPaydays,
  sameRows,
  shiftMonth,
  withPayday,
  type PlanMonth,
  type PlanRow,
} from '../game-budget';
import { translateRuleRefusal } from '../rule-refusal';
import { Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { Subject, auditTime, merge } from 'rxjs';
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
  activeInsurances,
  applyCareerMoment,
  applyCareerStage,
  applyLifeOutcome,
  canTakeDream,
  normalizeCustomRules,
  paymentsDueOf,
  paymentDueIdOf,
  withPaymentDue,
  withPaymentSettled,
  DEFAULT_OPPORTUNITY_SETTINGS,
  difficultySettings,
  type DifficultySettings,
  activeEffects,
  registerCardTextDe,
  drawHarvestCard,
  harvestTopics,
  involvedHoldings,
  keywordsOfCard,
  indexOf,
  ladderPayout,
  playHarvestCard,
  rideLadder,
  sellHolding,
  unitPriceNow,
  valueOf,
  type ActiveEffect,
  type AssetKind,
  type HarvestTopics,
  type HarvestCard,
  type HarvestLadderOffer,
  type HarvestPending,
  type HarvestSale,
  buyOpportunity,
  drawOpportunityOffers,
  planOpportunity,
  projectTitleOf,
  closeOpportunityPlans,
  settleHoldingSale,
  isOpportunityPile,
  quoteOpportunity,
  rollsFor,
  type OpportunityCard,
  type OpportunityChoice,
  type OpportunityContext,
  type OpportunityPile,
  type OpportunityRolls,
  type OpportunityQuote,
  type OpportunitySettings,
  type CustomRules,
  type PaymentDue,
  careerSnapshot,
  DEFAULT_DREAM_SETTINGS,
  discountRemaining,
  discountTotal,
  DREAM_MOMENTS,
  dreamReady,
  dreamsForMoment,
  drawDreamLanding,
  drawLifeCard,
  EMPTY_DREAM_LOG,
  endLifeLine,
  findStage,
  lifeContext,
  monthlyExpensesMinor,
  livedPoints,
  netMonthlyMinor,
  resolveLifeCard,
  rollCareer,
  totalDreamPoints,
  type CareerResult,
  type CareerSnapshot,
  type DreamCard,
  type DreamLog,
  type DreamMoment,
  type DreamSettings,
  type LifeBooks,
  type LifeCard,
  type LifeDecision,
  type LifeOutcome,
  addMonthsToIsoDate,
  drawEmergencyCard,
  emptyEmergencyDeck,
  insuranceOffers,
  planQuote,
  queueInsuranceChange,
  quoteEmergency,
  type EmergencyCard,
  type EmergencyContext,
  type EmergencyQuote,
  type EmergencySelection,
  type InsuranceOffer,
  blankGameData,
  captureGameSnapshot as captureSnapshot,
  GAME_BANK_LOCATION_ID,
  plannedBudgetFromPayday,
  coinsOwnedOf,
  accountHistoryIsNewer,
  buildLiveHistory,
  decodeUndoChain,
  encodeUndoChain,
  isEncodedUndoChain,
  readLiveHistory,
  type LiveHistory,
  type EncodedUndoChain,
  dealInputFromCard,
  doodadLoanNote as doodadLoanNoteRule,
  normalizeRules,
  rulesOf,
  whyCannotAddFreeAmount,
  whyCannotBuy,
  whyCannotDraw,
  whyCannotReportRoll,
  whyDiceFirst,
  whyCardAlreadyBought,
  whyCardAlreadyPlayed,
  propertyCardTypes,
  costCardProperty,
  whyPaymentPending,
  whyCannotSkipCard,
  whyCannotSell,
  whyCannotUseCard,
  type GameRules,
  executeDeal as executeDealRule,
  clearCashflowStatus,
  computeMonthlyCashflowMinor,
  drawRandomCard,
  findCards,
  fromMinorUnits,
  gameSubscriptionDays,
  gameTradeStep,
  parseGrowComment,
  historySteps as historyStepsOf,
  isGameSnapshot as isGameSnapshotRule,
  keepSavedSlot,
  marketSaleFor,
  openOfferFor,
  standingSale,
  nextSmartDate,
  pickCashflowProfession,
  planAutoLoan,
  popUndoSteps,
  planDeal as planDealRule,
  plannedDeals as plannedDealsRule,
  playBankLoan,
  playBaby,
  playBoostCard,
  playMarketBuyerCard,
  playMarketCostCard,
  playPayday,
  playShareSplitCard,
  previewSpace,
  pushUndoSnapshot as pushSnapshotOnto,
  registerInvestmentIncome as registerInvestmentIncomeRule,
  removeExpenseForPaidLiability as removeExpenseForPaidLiabilityRule,
  payOffLiability as payOffLiabilityRule,
  planLiabilityPayoff as planLiabilityPayoffRule,
  type PayoffPlan,
  sellCardToFriend as sellCardToFriendRule,
  closePlanOfSettledCard as closePlanOfSettledCardRule,
  setPhaseAfterTrade as setPhaseAfterTradeRule,
  syncPlanNote as syncPlanNoteRule,
  takenDealLabels,
  sellAssetProblem,
  summarizeGameFinances,
  UNDO_STACK_LIMIT,
  systemClock,
  systemRng,
  endIfOver,
  playCharityPaying,
  playDownsizedPaying,
  type PaidWithLoan,
  CLASSIC_RAT_RACE_BOARD,
  fundingRoomMinor,
  buildDreamfundBoard,
  type BoardSetup,
  type DreamfundBoard,
  playTurn,
  settleDecision as settleDecisionRule,
  whyCannotRoll,
  finalSummary,
  currentTurn,
  type DiceCount,
  type FinalSummary,
  type RatRaceBoard,
  type TurnResult,
  rollDie as rollDieRule,
  type Rng,
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
  cardPickedStep,
  type LoanBooks,
  type GameStepKind,
  type HistoryStep,
  type RoundBooks,
  type RoundDeps,
  type SavedGameSummary,
} from '@money/domain';
import { CASHFLOW_GAME_SETS, loadCardTextDe } from '../cashflow-content';
import { syncPaymentPlans } from '../payment-plan-sync';
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
import { settleBucketTransactions } from '../bucket.utils';
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
  /** Called before `onSuccess` when the action had to take an automatic bank loan first (the amount, in minor units). */
  onLoan?: (loanMinor: number) => void;
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

/** A holding in a market that is open for selling now: what a unit brings, and how many there are. */
export interface HarvestWindowSale {
  holding: string;
  label: string;
  units: number;
  unitMinor: number;
  isShare: boolean;
}

type CashflowStepInfo = GameStep;

/** One line of the game's History, newest first - exactly one per undo step. Defined in the domain, shared with the Pro API. */
export type CashflowHistoryStep = HistoryStep<Transaction>;

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
  /** The locations (their balances move with the game's bookings); absent on a snapshot from before the game had a location. */
  allLocations?: MoneyLocation[];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Raw `localStorage`, deliberately not `LocalService`/`PersistenceService` — those encrypt and sync
 * to the DB, which the undo stack must never do (JFK, 2026-09-29+: "can we at least persist the
 * history in the local storage of the browser? so it survives a reload, refresh, npm start... but
 * not a clear browser cache"). A page reload/dev-server restart reads it straight back; clearing
 * the browser's site data removes it same as everything else — no extra code needed for that part.
 */
const UNDO_STACK_STORAGE_KEY = 'cashflowUndoStack';

/** The most characters the browser's copy of the undo history may take (localStorage holds about 5 million in all). */
const LOCAL_UNDO_BUDGET = 1_500_000;
/** When the browser's copy of the history last changed - compared with the account's copy (see `CashflowHistorySyncService`). */
const UNDO_STACK_AT_KEY = 'cashflowUndoStackAt';

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

  /** Where chance comes from (the dice, the card draws, a shuffled profession). A property so a test - or the solo engine - can pin it. */
  rng: Rng = systemRng;

  /**
   * Not synced to the DB — see `UNDO_STACK_STORAGE_KEY`'s own comment. Starts from whatever's in
   * localStorage (a prior reload/restart's leftovers), so it survives across those; `logOut()`
   * (both editions) calls `clearPersistedUndoStack()` so a different login never inherits it.
   */
  private undoStack: CashflowGameSnapshot[] = this.loadPersistedUndoStack();

  /** When the history last changed (ISO), so the browser's and the account's copy can tell which is newer. */
  private undoStackAt: string | null = this.loadPersistedUndoStackAt();

  /** Fires whenever the history changed and the account's copy should follow. */
  readonly historyChanged$ = new Subject<void>();

  constructor(
    private persistence: PersistenceService,
    private incomeStatement: IncomeStatementService,
    private translate: TranslateService,
  ) {
    CashflowGameService.translator = translate;
    CashflowGameService.current = this;
    void loadCardTextDe().then(registerCardTextDe);
    // The game ends when the books say so, whichever action changed them.
    const state = AppStateService.instance;
    merge(state.transactionsUpdated$, state.subscriptionsUpdated$)
      .pipe(auditTime(60))
      .subscribe(() => this.endSoloGameIfOver());
  }

  /** Set when the service is created: the game rules' English refusals are shown in the player's language. */
  private static translator?: TranslateService;
  /** Shows what a die decided when the purchase was booked in Grow (the roll is made there, so it is told there). */
  private readonly toast: ToastService | null = (() => {
    try {
      return inject(ToastService);
    } catch {
      return null;
    }
  })();

  /** The running service, for the rules the Grow pages ask by a static call. */
  private static current?: CashflowGameService;

  /** A game-rules refusal in the player's language (the sentence itself when it is not one or there is no translator). */
  static ruleText(message: string): string {
    const translator = CashflowGameService.translator;
    return translateRuleRefusal(
      message,
      translator ? (key, params) => translator.instant(key, params) : undefined,
    );
  }

  private static ruleTextOrNull(message: string | null): string | null {
    return message === null ? null : CashflowGameService.ruleText(message);
  }

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

  private loadPersistedUndoStackAt(): string | null {
    try {
      return localStorage.getItem(UNDO_STACK_AT_KEY);
    } catch {
      return null;
    }
  }

  /** When the browser's copy of the history last changed; null when it never has. */
  get historyUpdatedAt(): string | null {
    return this.undoStackAt;
  }

  /** The history as it is stored in the account: the compact chain and a plain log, stamped with its last change. */
  liveHistory(): LiveHistory {
    return buildLiveHistory(
      this.undoStack,
      AppStateService.instance,
      {
        text: this.roundDeps.text,
        money: (amountMinor) => this.amountText(fromMinorUnits(amountMinor)),
      },
      this.undoStackAt ?? this.clock.nowIso(),
    );
  }

  /**
   * Takes over the account's history when it is newer than the browser's (another device played, or the Pro API did).
   * Changes the history only - the books were already loaded from the account - and does not write it back.
   */
  adoptAccountHistory(stored: unknown): boolean {
    const read = readLiveHistory<CashflowGameSnapshot>(stored);
    if (!read || !accountHistoryIsNewer(read.updatedAt, this.undoStackAt)) return false;
    this.undoStack = read.stack.slice(-UNDO_STACK_LIMIT);
    this.undoStackAt = read.updatedAt;
    this.storeUndoStackLocally();
    return true;
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
    this.undoStackAt = this.clock.nowIso();
    this.storeUndoStackLocally();
    this.historyChanged$.next();
  }

  private storeUndoStackLocally(): void {
    try {
      // The browser's copy is a convenience with a budget of its own (the books must always fit beside it): when a very long
      // game outgrows it, the oldest steps stay out of it - the account and saved games keep the whole chain.
      let kept = this.undoStack;
      let json = JSON.stringify(encodeUndoChain(kept));
      while (json.length > LOCAL_UNDO_BUDGET && kept.length > 1) {
        kept = kept.slice(Math.ceil(kept.length / 4));
        json = JSON.stringify(encodeUndoChain(kept));
      }
      localStorage.setItem(UNDO_STACK_STORAGE_KEY, json);
      if (this.undoStackAt) localStorage.setItem(UNDO_STACK_AT_KEY, this.undoStackAt);
    } catch {
      // best-effort only
    }
  }

  /** Snapshots every real entity a game action can touch, right before that action mutates anything — one call per public mutating method, always before its first mutation. */
  private pushUndoSnapshot(step: CashflowStepInfo): void {
    // undoing at a table is the table's vote: nothing is kept on this device
    if (RemoteGameHook.current) return;
    this.undoStack = pushSnapshotOnto(this.undoStack, {
      step: { ...step, at: this.clock.nowIso() },
      ...this.captureGameSnapshot(),
    });
    this.persistUndoStack();
  }

  /**
   * A deep copy of everything the live game consists of - the unit both Undo and a saved game use
   * (JFK, 2026-10-04: a saved game is exactly this plus a name and a summary).
   */
  captureGameSnapshot(): CashflowGameSnapshot {
    const state = AppStateService.instance;
    return {
      ...captureSnapshot({
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
      allLocations: deepClone(state.allLocations ?? []),
    };
  }

  /** Whether a loaded snapshot has the shape of a game (a corrupt or foreign file must never replace a live game). */
  isGameSnapshot(value: unknown): value is CashflowGameSnapshot {
    return isGameSnapshotRule(value);
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
      callbacks.onError(this.translate.instant('CashflowGame.errorNotAGame'));
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
    // Without a history the account's old one must still be replaced by this game's (empty) one.
    this.persistUndoStack();
    this.applySnapshot(deepClone(snapshot));
    this.persistAll('cashflow_game_loaded', { gameId: snapshot.cashflowGame.gameId }, callbacks, {
      includeBudget: AppStateService.instance.tier2Loaded,
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
    const planBefore = state.cashflowGame.budgetPlan ?? [];
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
    if (snapshot.allLocations) state.allLocations = snapshot.allLocations;
    // the budget follows the game's own plan (what Undo or a loaded game had planned), never what the player planned by hand
    if (state.tier2Loaded) {
      state.allBudgets = applyPlanChange(
        state.allBudgets ?? [],
        planBefore,
        snapshot.cashflowGame.budgetPlan ?? [],
      );
    }
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
    // anything the player pays in a game is covered by a Bank loan first when the account is short: the balance never goes negative
    // (JFK, 2026-10-26)
    const expenseMinor = toMinorUnits(this.paidIntoProject(category, comment, expenseAmount));
    const purchase =
      tradePurchase(comment, expenseMinor) ??
      (this.customRules &&
      expenseMinor > 0 &&
      gameTradeStep(comment, category).kind === 'transaction'
        ? { title: '', costMinor: expenseMinor }
        : null);
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
          this.undoStack = popUndoSteps(this.undoStack, 1).stack;
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
    const tradeStep = gameTradeStep(comment, category);
    this.pushUndoSnapshot(tradeStep); // step 2 (or the only step): the trade itself
    if (tradeStep.kind === 'buyInvestment' || tradeStep.kind === 'buyAsset') this.markPurchased();
    if (tradeStep.kind === 'doodad' || tradeStep.kind === 'marketCost') this.markCardPlayed();
    // what the Opportunity cards made: bought in Grow it becomes a holding with its monthly line, sold in Grow it follows
    if (['buyShare', 'buyInvestment', 'buyAsset'].includes(tradeStep.kind)) {
      this.finishOpportunityBuy(tradeStep.detail ?? '', comment);
    } else if (['sellShare', 'sellInvestment', 'sellAsset'].includes(tradeStep.kind)) {
      this.settleOpportunitySale(tradeStep.detail ?? '', comment);
    }
    if (tradeStep.kind === 'cardPayment') {
      // the payment a card asked for is made: it comes off the list (the undo step above brings it back)
      const paid = paymentsDueOf(state.cashflowGame).find(
        (due) => due.id === paymentDueIdOf(comment),
      );
      state.cashflowGame = withPaymentSettled(state.cashflowGame, comment, category);
      // an Opportunity card that was paid becomes its project
      const bought = paid?.opportunity;
      const card = bought ? this.opportunityCards.find((c) => c.id === bought.cardId) : undefined;
      if (bought && card) {
        this.completeOrAwaitRoll(card, {
          units: bought.units,
          steps: bought.steps,
          swapOut: bought.swapOut,
        });
      }
    }
    // the facts of the payment, in the project it is for: what it cost, what there was in cash, what had to be borrowed
    if (purchase && purchase.costMinor > 0) {
      const target = purchase.title || category;
      const cashBefore = toMinorUnits(this.cash) - borrowedMinor;
      const after = cashBefore + borrowedMinor - purchase.costMinor;
      this.noteProject(
        target,
        `Paid ${this.noteMoney(purchase.costMinor)}. Cash before: ${this.noteMoney(Math.max(0, cashBefore))}${borrowedMinor > 0 ? `, so ${this.noteMoney(borrowedMinor)} was borrowed from the Bank` : ', no loan needed'}; cash after: ${this.noteMoney(Math.max(0, after))}.`,
        `${this.noteMoney(purchase.costMinor)} bezahlt. Bargeld vorher: ${this.noteMoney(Math.max(0, cashBefore))}${borrowedMinor > 0 ? `, deshalb wurden ${this.noteMoney(borrowedMinor)} bei der Bank geliehen` : ', kein Kredit nötig'}; Bargeld danach: ${this.noteMoney(Math.max(0, after))}.`,
      );
    }
    this.settleDoodadByPayment(tradeStep.kind);
    // The loan comes first: it takes `loanDate` (the day the dialog was opened on), and the purchase
    // that follows gets the next free slot after it.
    return {
      borrowed: fromMinorUnits(borrowedMinor),
      converted,
      nextDate: this.nextGameTransactionDate(),
    };
  }

  /**
   * Under `passDoodads: 'forbidden'` the game waits for the Doodad: paying it - the Add dialog's #doodad transaction - is
   * what settles the space, so the next roll opens only then. (The Add dialog stores the game state with the trade.)
   */
  private settleDoodadByPayment(stepKind: string): void {
    const game = AppStateService.instance.cashflowGame;
    const pending = game.turn?.pending;
    const paysDoodad = stepKind === 'doodad' && pending?.kind === 'doodad';
    const paysCost = stepKind === 'marketCost' && !!pending?.paymentDue;
    if (!paysDoodad && !paysCost) return;
    if (rulesOf(game).passDoodads !== 'forbidden') return;
    try {
      const settled = settleDecisionRule(game, 'done', this.gameBooks().subscriptions);
      AppStateService.instance.cashflowGame = settled.state;
    } catch {
      // nothing open to settle
    }
  }

  /**
   * A note in a project of the game - a Grow, Fire or Smile project, found by its title - with what happened and the numbers of it
   * (JFK, 2026-10-26: "when something happens or was diced or decided I want to have a note in that project").
   */
  private noteProject(title: string, en: string, de: string): void {
    const state = AppStateService.instance;
    const wanted = title.replace(/^@/, '').trim().toLowerCase();
    if (!wanted) return;
    const project = [
      ...state.allGrowProjects,
      ...state.allFireEmergencies,
      ...state.allSmileProjects,
    ].find((candidate) => candidate.title.toLowerCase() === wanted);
    if (!project) return;
    const note = {
      text: this.emergencyLang === 'de' ? de : en,
      createdAt: new Date().toISOString(),
    };
    project.notes = [...(project.notes ?? []), note] as typeof project.notes;
  }

  /** A sum in the game's money for a note, in the player's number format. */
  private noteMoney(minor: number): string {
    return this.amountText(fromMinorUnits(minor));
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
    this.undoStackAt = null;
    try {
      localStorage.removeItem(UNDO_STACK_STORAGE_KEY);
      localStorage.removeItem(UNDO_STACK_AT_KEY);
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
    return historyStepsOf(this.undoStack, AppStateService.instance, {
      text: this.roundDeps.text,
      money: (amountMinor) => this.amountText(fromMinorUnits(amountMinor)),
    });
  }

  /** Undoes the newest `count` steps in one go - back to exactly how the game stood before the oldest of them (the History's "undo back to here"). */
  undoSteps(count: number, callbacks: CashflowGameCallbacks): void {
    const { snapshot, stack } = popUndoSteps(this.undoStack, count);
    if (!snapshot) {
      callbacks.onError(this.translate.instant('CashflowGame.errorNothingToUndo'));
      return;
    }
    this.undoStack = stack;
    this.persistUndoStack();
    // A step from before the game was first saved knows nothing of its saved slot: keep the slot.
    this.applySnapshot(keepSavedSlot(snapshot, AppStateService.instance.cashflowGame));
    this.persistAll('cashflow_undo_action', {}, callbacks, {
      includeBudget: AppStateService.instance.tier2Loaded,
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
  pickProfession(
    gameSetId: string,
    professionId: string,
    callbacks: CashflowGameCallbacks,
    mode: 'companion' | 'solo' = 'companion',
    rules?: Partial<GameRules>,
    boardSetup?: BoardSetup,
    customRules?: CustomRules,
    startInsurances?: string[],
  ): void {
    const state = AppStateService.instance;
    let result: ReturnType<typeof pickCashflowProfession>;
    try {
      result = pickCashflowProfession(
        this.gameSets,
        gameSetId,
        professionId,
        this.clock.todayIso(),
        mode,
        rules ? normalizeRules(rules) : undefined,
        boardSetup,
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

    this.ensureGameLocation();
    result.startingTransactions.forEach((record) => {
      const transaction = toFloatTransaction({
        ...record,
        category: `@${savingsWord}`,
        comment: `${this.translate.instant('CashflowGame.savingsTransactionComment', {
          profession: professionTitle,
        })}\n#dreamfund`,
      });
      this.bookOnGameLocation(transaction);
      state.allTransactions.push(transaction);
    });

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
        comment: sub.comment ? `${sub.comment}\n#dreamfund` : '#dreamfund',
        frequency: sub.frequency,
        locationId: GAME_BANK_LOCATION_ID,
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

    // the character's dream is a Smile project from the first day (JFK, 2026-10-25), in the language of the game
    const story = result.profession.profile?.texts;
    const dream = (story?.[this.translate.currentLang] ?? story?.['en'])?.dream.project;
    if (dream) {
      const project = dreamToSmile(dream, new Date().toISOString());
      state.allSmileProjects = [
        ...state.allSmileProjects.filter((existing) => existing.title !== project.title),
        project,
      ];
    }

    // and so is the emergency reserve of three monthly expenses, a Fire project
    const reserve = (story?.[this.translate.currentLang] ?? story?.['en'])?.reserve?.project;
    if (reserve) {
      const project = reserveToFire(reserve, new Date().toISOString());
      state.allFireEmergencies = [
        ...state.allFireEmergencies.filter((existing) => existing.title !== project.title),
        project,
      ];
    }

    const planOfLastGame = state.cashflowGame.budgetPlan ?? [];
    // a new game starts with a clean plan: rows of its own categories left in the last months (by an earlier game or version) go
    const gameTags = new Set(
      state.allSubscriptions
        .filter(
          (sub) =>
            subscriptionTitles.includes(sub.title) && sub.account !== 'Income' && sub.category,
        )
        .map((sub) => sub.category),
    );
    const since = shiftMonth(this.clock.todayIso().slice(0, 7), -2);
    // an insurance's premium line has the title it was given in this language
    const insurance = result.state.insurance;
    const translatedPremiums: Record<string, string> = {};
    if (insurance) {
      for (const [kind, title] of Object.entries(insurance.premiums)) {
        const at = nonZeroExpenses.findIndex((line) => line.title === title);
        translatedPremiums[kind] = at >= 0 ? subscriptionTitles[at + 1] : title;
      }
    }
    // the expense lines are found by their key (the career changes the tax lines): their titles are the translated ones
    const lineTitles: Record<string, string> = {};
    nonZeroExpenses.forEach((line, at) => {
      if (line.key) lineTitles[line.key] = subscriptionTitles[at + 1];
    });
    state.cashflowGame = {
      ...result.state,
      ...(result.state.life
        ? {
            lineTitles,
            dreams: EMPTY_DREAM_LOG,
            customRules: normalizeCustomRules(customRules),
          }
        : {}),
      gameSubscriptionTitles: subscriptionTitles,
      // the insurances the player chose to start with (all of them when nothing was chosen)
      ...(insurance
        ? {
            insurance: {
              ...insurance,
              premiums: translatedPremiums,
              active: startInsurances
                ? insurance.active.filter((kind) => startInsurances.includes(kind))
                : insurance.active,
            },
          }
        : {}),
      budgetPlan: [],
    };
    // a new game starts without the plan of the last one
    if (state.tier2Loaded) {
      state.allBudgets = applyPlanChange(
        (state.allBudgets ?? []).filter(
          (b) => !b.game && !(gameTags.has(b.tag) && b.date >= since),
        ),
        planOfLastGame,
        [],
      );
    }
    this.persistAll('start_cashflow_game', { gameSetId, professionId }, callbacks, {
      includeBudget: state.tier2Loaded,
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
    const planBefore = AppStateService.instance.cashflowGame.budgetPlan;
    this.applyGameEffects(effects);
    const budgetPlanned = this.planPaydays(planBefore, [effects]);
    this.persistAll('cashflow_payday', { round: effects.state.round }, callbacks, {
      includeBudget: budgetPlanned,
      ...(effects.persist.grow ? { includeGrow: true } : {}),
    });
    if (effects.decisionNeeded) this.decisionNeeded$.next();
  }

  /**
   * The game plans the budget (JFK, 2026-10-19): each Payday plans the subscription expenses it paid, in the month they are booked,
   * and moves everything planned before back a month, exactly like the transactions. The plan is the game's own record
   * (`budgetPlan` in its state), so the budget cells it made are always known. A Doodad or a Market cost is not planned - it shows
   * as over budget. A game from before has its plan made from what its Paydays posted. Returns whether the budget changed.
   */
  private planPaydays(before: PlanMonth[] | undefined, paydays: GameEffects[]): boolean {
    if (paydays.length === 0) return false;
    const state = AppStateService.instance;
    const monthOf = (effects: GameEffects) =>
      (effects.appendedTransactions[0]?.date ?? this.clock.todayIso()).slice(0, 7);
    // payment plans for a dream are saving, not an expense of the month: they are not planned
    const funding = this.fundingCategories();
    const rowsOf = (
      transactions: { account: string; amountMinor: number; date: string; category?: string }[],
    ) =>
      plannedBudgetFromPayday(
        transactions.filter((transaction) => !funding.has(transaction.category ?? '')),
      ).map((row) => ({
        tag: row.tag,
        amountMinor: row.amountMinor,
      }));
    if (before === undefined) return this.planFromHistory(monthOf(paydays[paydays.length - 1]));
    let after = before;
    for (const effects of paydays) {
      after = withPayday(after, monthOf(effects), rowsOf(effects.appendedTransactions));
    }
    return this.setBudgetPlan(before, after);
  }

  /** The categories of the payment plans of the game (their projects): money saved, not planned as a cost. */
  private fundingCategories(): Set<string> {
    const state = AppStateService.instance;
    return new Set(
      (state.cashflowGame.fundingSubscriptionTitles ?? [])
        .map((title) => state.allSubscriptions.find((sub) => sub.title === title)?.category)
        .filter((category): category is string => !!category),
    );
  }

  /** The plan of a game that never recorded one: from the Paydays in its history, the latest in `current`. */
  private planFromHistory(current: string, heal = true): boolean {
    const state = AppStateService.instance;
    const paydays = (state.cashflowGame.history ?? [])
      .filter((entry) => entry.kind === 'payday')
      .map((entry) =>
        plannedBudgetFromPayday(
          entry.createdTransactions.filter(
            (transaction) => !this.fundingCategories().has(transaction.category ?? ''),
          ),
        ).map((row) => ({
          tag: row.tag,
          amountMinor: row.amountMinor,
        })),
      );
    return this.setBudgetPlan([], planFromPaydays(paydays, current), heal);
  }

  /** Records the plan on the live game and moves the budget with it (when the budget has been read). */
  private setBudgetPlan(before: PlanMonth[], after: PlanMonth[], heal = false): boolean {
    const state = AppStateService.instance;
    state.cashflowGame = { ...state.cashflowGame, budgetPlan: after };
    // the budget is a tier-2 path: writing it before it has been read would replace the stored one with a fragment
    if (!state.tier2Loaded) return false;
    state.allBudgets = heal
      ? healLegacyRows(state.allBudgets ?? [], after)
      : applyPlanChange(state.allBudgets ?? [], before, after);
    // the Budget page (and anything else drawn from it) follows at once, not only when the save is done
    state.transactionsUpdated$.next();
    return true;
  }

  /** What the subscriptions of the game cost per month, per category: what the next Payday would post. */
  private standingRows(): PlanRow[] {
    const state = AppStateService.instance;
    const owned = new Set(state.cashflowGame.gameSubscriptionTitles);
    const totals = new Map<string, number>();
    for (const sub of state.allSubscriptions) {
      if (!owned.has(sub.title) || sub.account === 'Income' || !(Number(sub.amount) < 0)) continue;
      const tag = sub.category || '@others';
      totals.set(tag, (totals.get(tag) ?? 0) - toMinorUnits(sub.amount));
    }
    return [...totals.entries()].map(([tag, amountMinor]) => ({ tag, amountMinor }));
  }

  /**
   * The current month follows the game (JFK, 2026-10-19: a property bought, a baby): whenever the subscriptions change, what is
   * planned for the month changes with them - until the next Payday closes it and moves it back. Returns whether the budget changed.
   */
  private refreshCurrentMonthPlan(): boolean {
    const plan = AppStateService.instance.cashflowGame.budgetPlan;
    if (!plan || plan.length === 0) return false;
    const last = plan[plan.length - 1];
    const rows = this.standingRows();
    if (sameRows(last.rows, rows)) return false;
    return this.setBudgetPlan(plan, [...plan.slice(0, -1), { month: last.month, rows }]);
  }

  /**
   * A running game that has no plan yet (it was played before the budget was planned) gets all its months planned from what its
   * Paydays posted, without waiting for the next one; a plan whose cells the budget lacks (it was not loaded then) is put in. Does
   * nothing for a game that is not running or while the budget is not loaded. Returns whether the budget changed.
   */
  backfillBudget(): boolean {
    const state = AppStateService.instance;
    if (!CashflowGameService.isCashflowGame() || !state.tier2Loaded) return false;
    const game = state.cashflowGame;
    if (!game || !game.professionId || !(game.round >= 1)) return false;
    let changed: boolean;
    if (game.budgetPlan === undefined) {
      const latest = [...(game.history ?? [])].reverse().find((entry) => entry.kind === 'payday')
        ?.createdTransactions[0]?.date;
      changed = this.planFromHistory((latest ?? this.clock.todayIso()).slice(0, 7));
    } else {
      const before = state.allBudgets ?? [];
      // what earlier games left behind goes, the plan of this one is filled in
      const tags = new Set<string>([
        ...state.allSubscriptions
          .filter((sub) => sub.account !== 'Income' && sub.category)
          .map((sub) => sub.category),
        ...game.budgetPlan.flatMap((month) => month.rows.map((row) => row.tag)),
      ]);
      const cleaned = dropStaleRows(before, game.budgetPlan, tags);
      const filled = fillMissing(cleaned, game.budgetPlan);
      changed = JSON.stringify(filled) !== JSON.stringify(before);
      if (changed) state.allBudgets = filled;
    }
    if (changed) {
      this.persistAll(
        'cashflow_budget_backfill',
        {},
        { onSuccess: () => undefined, onError: () => undefined },
        {
          includeBudget: true,
          quiet: true,
        },
      );
    }
    return changed;
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
    return {
      clock: this.clock,
      text: (key, params) => this.translate.instant(key, params),
      lang: this.emergencyLang,
      rng: this.rng,
      opportunityCards: this.opportunityCards,
      difficulty: this.customRules?.difficulty,
    };
  }

  /**
   * The game's default location (Bank - Main, JFK 2026-10-19): created in the language of the game when it is not there yet; a
   * rename by the player is kept. Returns whether it had to be created.
   */
  private ensureGameLocation(): boolean {
    const state = AppStateService.instance;
    if (!Array.isArray(state.allLocations)) state.allLocations = [];
    if (state.allLocations.some((location) => location.id === GAME_BANK_LOCATION_ID)) return false;
    state.allLocations.push({
      id: GAME_BANK_LOCATION_ID,
      name: this.translate.instant('CashflowGame.bankLocationName'),
      subName: this.translate.instant('CashflowGame.bankLocationSub'),
      amount: 0,
      kind: 'bank',
    });
    return true;
  }

  /** A booking of the game lands on the default location, whose balance moves with it. */
  private bookOnGameLocation(transaction: Transaction): void {
    const state = AppStateService.instance;
    if (!transaction.locationId) transaction.locationId = GAME_BANK_LOCATION_ID;
    reconcileLocationBooking(state.allLocations, null, {
      locationId: transaction.locationId,
      amount: transaction.amount,
      locationSplits: transaction.locationSplits,
    });
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
          locationId: GAME_BANK_LOCATION_ID,
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
    this.ensureGameLocation();
    effects.appendedTransactions.forEach((record) => {
      const transaction = toFloatTransaction(record);
      this.bookOnGameLocation(transaction);
      state.allTransactions.push(transaction);
    });
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
    for (const tag of effects.shareRemovals) {
      const index = state.allShares.findIndex((share) => share.tag === tag);
      if (index >= 0) state.allShares.splice(index, 1);
    }
    for (const tag of effects.investmentRemovals) {
      const index = state.allInvestments.findIndex((investment) => investment.tag === tag);
      if (index >= 0) state.allInvestments.splice(index, 1);
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
  /** Every day-of-month a `#dreamfund` Subscription recurs on (see `gameSubscriptionDays`). */
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

  // ── The emergency reserve, kept up to date (JFK, 2026-10-26) ──

  /**
   * A game saved before the marks of its projects were kept (the dream, the reserve) has them again: the two projects of the character
   * are found by their titles, in the language they were made in.
   */
  repairGameProjects(): void {
    const state = AppStateService.instance;
    const profession = this.currentProfession();
    if (!profession?.profile || !state.cashflowGame.professionId) return;
    const texts = Object.values(profession.profile.texts);
    const dreamTitles = texts.map((text) => text.dream.project?.title);
    const reserveTitles = texts.map((text) => text.reserve?.project.title);
    for (const project of state.allSmileProjects) {
      if (!project.dream && dreamTitles.includes(project.title)) project.dream = true;
    }
    for (const project of state.allFireEmergencies) {
      if (!project.reserve && reserveTitles.includes(project.title)) project.reserve = true;
      // a reserve saved under its old name is called Mojo now, like the account it follows
      if (project.reserve) {
        const current = reserveTitles.find((title) => !!title);
        if (current && project.title !== current) {
          const old = project.title;
          project.title = current;
          for (const plan of project.plannedSubscriptions ?? []) {
            if (plan.projectTitle === old) plan.projectTitle = current;
          }
        }
      }
    }
  }

  /** The Fire project of the character's emergency reserve (a win condition), if the game has one. */
  private get reserveProject(): Fire | undefined {
    return AppStateService.instance.allFireEmergencies.find((fire) => fire.reserve);
  }

  /**
   * The reserve is three months of the expenses the character has NOW: when the expenses grow (a child, a promotion, a flat) the target
   * grows with them, and the Mojo's own target follows. Returns whether anything changed.
   */
  private refreshReserveTarget(): boolean {
    const state = AppStateService.instance;
    const project = this.reserveProject;
    if (!project || !state.cashflowGame.professionId) return false;
    const monthly = fromMinorUnits(
      monthlyExpensesMinor(
        state.cashflowGame,
        this.gameSubscriptions().map((sub) => ({ title: sub.title, amountMinor: sub.amountMinor })),
      ),
    );
    if (monthly <= 0) return false;
    const each = Math.round((monthly * 100) / 1) / 100;
    let changed = false;
    for (const bucket of project.buckets) {
      if (Math.abs(Number(bucket.target) - each) > 0.004) {
        bucket.target = each;
        changed = true;
      }
    }
    const target = Math.round(monthly * 3 * 100) / 100;
    if (Math.abs(Number(state.mojo.target) - target) > 0.004) {
      state.mojo.target = target;
      changed = true;
    }
    if (changed) project.updatedAt = new Date().toISOString();
    return changed;
  }

  /**
   * How much of the reserve the character holds against what three months of expenses are now: what was put into the reserve project
   * and what the Mojo account holds. Paying something from the Mojo takes the character away from the goal again.
   */
  get reserveStatus(): { held: number; target: number; ok: boolean } | null {
    const state = AppStateService.instance;
    const project = this.reserveProject;
    if (!project || !state.cashflowGame.professionId) return null;
    const monthly = fromMinorUnits(
      monthlyExpensesMinor(
        state.cashflowGame,
        this.gameSubscriptions().map((sub) => ({ title: sub.title, amountMinor: sub.amountMinor })),
      ),
    );
    const target = Math.round(monthly * 3 * 100) / 100;
    // the reserve is the Mojo: what it holds is what the character has set aside
    const held = Math.round(Math.max(0, Number(state.mojo.amount) || 0) * 100) / 100;
    return { held, target, ok: target > 0 && held + 0.005 >= target };
  }

  // ── The Emergency stack (JFK, 2026-10-25): the Fire tile draws a card that has to be paid, now or on a plan ──────────

  /** The Emergency cards of the running game's set (none: the tile only shows its filler). */
  get emergencyCards(): EmergencyCard[] {
    return this.currentGameSet()?.decks?.emergency ?? [];
  }

  private get emergencyLang(): 'en' | 'de' {
    return this.translate.currentLang === 'de' ? 'de' : 'en';
  }

  /** Emergencies that are still being paid off: they make a dunning letter dearer. */
  private get openEmergencyCount(): number {
    return AppStateService.instance.allFireEmergencies.filter(
      (fire) =>
        fire.emergencyCardId &&
        !fire.buckets.every((bucket) => Number(bucket.amount) + 0.005 >= Number(bucket.target)),
    ).length;
  }

  private get emergencyContext(): EmergencyContext {
    const game = AppStateService.instance.cashflowGame;
    return {
      insurances: activeInsurances(game),
      traits: game.traits ?? [],
      openEmergencies: this.openEmergencyCount,
      // the level of the game makes emergencies cheaper or dearer, and the deductible of an insurance smaller or bigger
      priceFactor:
        (this.currentProfession()?.priceFactor ?? 1) * this.levelSettings.emergencyCostMultiplier,
      deductibleCapMinor: this.levelSettings.insuranceDeductibleCapMinor,
    };
  }

  /** The level of the game (Medium until the others are offered) and what it sets. */
  get levelSettings(): DifficultySettings {
    return difficultySettings(this.customRules?.difficulty);
  }

  /** The card of the Emergency tile the token stands on, with what is picked and rolled and what it costs this player. */
  get emergencyView(): {
    card: EmergencyCard;
    selection: EmergencySelection;
    quote: EmergencyQuote;
    projectTitle?: string;
    skipped: string[];
  } | null {
    const game = AppStateService.instance.cashflowGame;
    const emergency = game.turn?.pending?.emergency;
    const card =
      emergency && this.emergencyCards.find((candidate) => candidate.id === emergency.cardId);
    if (!emergency || !card) return null;
    const selection: EmergencySelection = {
      choiceId: emergency.choiceId,
      rolls: emergency.rolls,
      rerolled: emergency.rerolled,
    };
    const quote = quoteEmergency(card, selection, this.emergencyContext);
    return {
      card,
      selection,
      quote,
      projectTitle: emergency.projectTitle,
      skipped: emergency.skipped ?? [],
    };
  }

  /**
   * The token is on an Emergency tile: the card is drawn from the stack (at random, or the one named - to look at a card) and kept with
   * the turn, so it stays as it is when the game is closed.
   */
  drawEmergency(callbacks: CashflowGameCallbacks, cardId?: string): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    const cards = this.emergencyCards;
    if (!pending || pending.kind !== 'story' || pending.tile !== 'emergency' || pending.emergency) {
      callbacks.onError('There is no emergency to draw.');
      return;
    }
    if (cards.length === 0) {
      callbacks.onError('This game has no emergency cards.');
      return;
    }
    const deck = game.emergencyDeck ?? emptyEmergencyDeck();
    const named = cardId ? cards.find((candidate) => candidate.id === cardId) : undefined;
    const draw = named
      ? {
          card: named,
          skipped: [] as string[],
          deck: { ...deck, seen: [...deck.seen.filter((id) => id !== named.id), named.id] },
        }
      : drawEmergencyCard(cards, deck, game.possessions ?? [], this.rng);
    this.recordTileCard('emergency', draw.card);
    state.cashflowGame = {
      ...game,
      emergencyDeck: draw.deck,
      turn: {
        ...game.turn!,
        pending: { ...pending, emergency: { cardId: draw.card.id, skipped: draw.skipped } },
      },
    };
    this.persistAll('cashflow_emergency_draw', { card: draw.card.id }, callbacks, { quiet: true });
  }

  /**
   * A card of a tile is drawn: one step of the History, with the id of the card so it can be read again (JFK, 2026-10-26). The snapshot
   * is taken before the card is dealt, so undoing it puts the card back and leaves the tile open.
   */
  private recordTileCard(
    deck: 'emergency' | 'life' | 'dream',
    card: { id: string; title: { en: string; de: string } },
  ): void {
    this.pushUndoSnapshot({
      kind: 'tileCard',
      detail: card.title[this.emergencyLang],
      cardId: card.id,
      deck,
    });
  }

  /** Records what was picked or rolled on the open card. */
  private updateEmergency(
    change: (
      current: NonNullable<NonNullable<CashflowGameState['turn']>['pending']>['emergency'],
    ) => NonNullable<NonNullable<CashflowGameState['turn']>['pending']>['emergency'],
    callbacks: CashflowGameCallbacks,
    logEvent: string,
  ): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    if (!pending?.emergency || pending.emergency.projectTitle) {
      callbacks.onError('There is no open emergency.');
      return;
    }
    state.cashflowGame = {
      ...game,
      turn: { ...game.turn!, pending: { ...pending, emergency: change(pending.emergency) } },
    };
    this.persistAll(logEvent, {}, callbacks, { quiet: true });
  }

  chooseEmergencyOption(choiceId: string, callbacks: CashflowGameCallbacks): void {
    this.updateEmergency(
      (current) => ({ ...current!, choiceId }),
      callbacks,
      'cashflow_emergency_choice',
    );
  }

  /** Rolls one of the card's dice (`main`, `bucket:<id>`, `extra`, `reroll`): a die once rolled stays rolled. */
  rollEmergencyDie(key: string, callbacks: CashflowGameCallbacks): number | null {
    const emergency = AppStateService.instance.cashflowGame.turn?.pending?.emergency;
    if (!emergency || emergency.rolls?.[key] !== undefined) return null;
    const roll = rollDieRule(this.rng);
    this.updateEmergency(
      (current) => ({ ...current!, rolls: { ...(current!.rolls ?? {}), [key]: roll } }),
      callbacks,
      'cashflow_emergency_roll',
    );
    return roll;
  }

  /** The offer to roll again (the tenants' association): it is taken, the second die is rolled next. */
  rerollEmergency(callbacks: CashflowGameCallbacks): void {
    this.updateEmergency(
      (current) => ({ ...current!, rerolled: true }),
      callbacks,
      'cashflow_emergency_reroll',
    );
  }

  /** Hop in or hop out of an insurance: it takes effect with the next Payday. */
  setInsurance(kind: string, on: boolean, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const next = queueInsuranceChange(state.cashflowGame, kind, on);
    if (next === state.cashflowGame) {
      callbacks.onSuccess();
      return;
    }
    this.pushUndoSnapshot({ kind: 'insurance', detail: `${kind} ${on ? '+' : '-'}` });
    state.cashflowGame = next;
    this.persistAll('cashflow_insurance', { kind, on }, callbacks, { quiet: true });
  }

  get insurances(): InsuranceOffer[] {
    return insuranceOffers(AppStateService.instance.cashflowGame);
  }

  /** What the premium of an insurance costs a month (the amount of its premium line), in the game's money. */
  insurancePremium(offer: InsuranceOffer): number {
    const line = AppStateService.instance.allSubscriptions.find(
      (sub) => sub.title === offer.premiumTitle,
    );
    return line ? Math.abs(Number(line.amount)) : 0;
  }

  /**
   * The card is settled into a Fire project (JFK, 2026-10-26): the picked option and the rolled dice become the project's buckets,
   * with the story, links, tasks and notes of the card - and nothing is paid yet. Paying is the Fire page's own work: add money to
   * a bucket from any account (the Mojo too), settle it, or set up a payment plan (3, 6 or 12 Paydays, each with its surcharge).
   */
  createEmergencyProject(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const view = this.emergencyView;
    const pending = game.turn?.pending;
    if (!view || !pending?.emergency || view.projectTitle || !view.quote.ready) {
      callbacks.onError('This emergency cannot be settled now.');
      return;
    }
    const { card, quote } = view;
    const lang = this.emergencyLang;
    const now = new Date().toISOString();
    const gameDate = game.virtualDate ?? this.clock.todayIso();
    const title = `${card.title[lang]} · M${String(game.round).padStart(2, '0')}`;

    const buckets = quote.buckets.map((bucket) => ({
      id: `${title}-${bucket.id}`,
      title: bucket.title[lang],
      target: fromMinorUnits(bucket.amountMinor),
      amount: 0,
      notes: '',
      ...(bucket.dueInMonths > 0
        ? { targetDate: addMonthsToIsoDate(gameDate, bucket.dueInMonths) }
        : {}),
    }));
    const insuranceNote = quote.insured
      ? this.translate.instant('CashflowGame.emergency.insuredNote', {
          saved: fromMinorUnits(quote.savedMinor),
          currency: state.currency,
        })
      : card.insurance
        ? this.translate.instant('CashflowGame.emergency.uninsuredNote')
        : '';
    const notes = [
      ...(card.stat ? [card.stat[lang]] : []),
      ...(card.insuranceNote ? [card.insuranceNote[lang]] : []),
      ...(insuranceNote ? [insuranceNote] : []),
      ...(card.refund ? [card.refund.note[lang]] : []),
    ].map((text) => ({ text, createdAt: now }));
    const project: Fire = {
      title,
      sub: `${this.translate.instant(`CashflowGame.emergency.tier.${card.tier}`)} · ${card.category}`,
      phase: 'saving',
      description: card.story[lang],
      buckets,
      links: card.links.map((link) => ({ label: link.label[lang], url: link.url })),
      actionItems: card.actions.map((action) => ({
        text: action.text[lang],
        done: false,
        priority: action.priority,
      })),
      notes,
      emergencyCardId: card.id,
      ...(card.payment === 'pay_now' ? { emergencyPayNow: true } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.pushUndoSnapshot({ kind: 'emergencyProject', detail: title });
    state.allFireEmergencies = [...state.allFireEmergencies, project];

    // what the card leaves behind: a monthly cost for good or for a while
    const subscriptionTitles = [...game.gameSubscriptionTitles];
    this.ensureGameLocation();
    if (quote.afterEffect) {
      const line = quote.afterEffect.line[lang];
      const lineTitle = `${line} (${card.id})`;
      state.allSubscriptions.push({
        title: lineTitle,
        account: 'Daily',
        amount: -fromMinorUnits(quote.afterEffect.monthlyMinor),
        startDate: gameDate,
        endDate: quote.afterEffect.months
          ? addMonthsToIsoDate(gameDate, quote.afterEffect.months - 1)
          : '',
        category: `@${lineTitle}`,
        comment: '#dreamfund',
        frequency: 'monthly',
        locationId: GAME_BANK_LOCATION_ID,
      });
      subscriptionTitles.push(lineTitle);
    }

    state.cashflowGame = {
      ...game,
      gameSubscriptionTitles: subscriptionTitles,
      flags: quote.sideEffect ? [...(game.flags ?? []), quote.sideEffect] : game.flags,
      turn: {
        ...game.turn!,
        pending: {
          ...pending,
          played: true,
          emergency: { ...pending.emergency, projectTitle: title },
        },
      },
    };
    this.persistAll('cashflow_emergency_project', { card: card.id }, callbacks, {
      includeSubscriptions: true,
      quiet: true,
    });
  }

  // ── The life, the career and the dreams of a character (JFK, 2026-10-26) ──────────────────────────────────────────

  private lifeBooks(): LifeBooks {
    const state = AppStateService.instance;
    return {
      state: state.cashflowGame,
      subscriptions: state.allSubscriptions.map(toBookSubscription),
    };
  }

  private get gameDay(): string {
    return this.clock.todayIso();
  }

  /** Puts the pending decision's detail into the game state, after the rule's own effects were applied. */
  private updatePending(
    change: (
      pending: NonNullable<NonNullable<CashflowGameState['turn']>['pending']>,
    ) => NonNullable<NonNullable<CashflowGameState['turn']>['pending']>,
  ): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    if (!pending) return;
    state.cashflowGame = { ...game, turn: { ...game.turn!, pending: change(pending) } };
  }

  // · Life

  get lifeCards(): LifeCard[] {
    return this.currentGameSet()?.decks?.life ?? [];
  }

  /** The card of the Life tile the token stands on: what was drawn, and what it came to once the player decided. */
  get lifeView(): {
    card: LifeCard;
    skipped: string[];
    outcome?: LifeOutcome;
    decision?: string;
  } | null {
    const pending = AppStateService.instance.cashflowGame.turn?.pending;
    const life = pending?.life;
    const card = life && this.lifeCards.find((candidate) => candidate.id === life.cardId);
    if (!life || !card) return null;
    return { card, skipped: life.skipped ?? [], outcome: life.outcome, decision: life.decision };
  }

  /** The Life tile draws a card that can happen to this player; a card that cannot is put back and the next one drawn. */
  drawLife(callbacks: CashflowGameCallbacks, cardId?: string): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    if (!pending || pending.kind !== 'story' || pending.tile !== 'life' || pending.life) {
      callbacks.onError('There is no life card to draw.');
      return;
    }
    if (!game.life || this.lifeCards.length === 0) {
      callbacks.onError('This game has no life cards.');
      return;
    }
    const deck = game.lifeDeck ?? emptyEmergencyDeck();
    const named = cardId ? this.lifeCards.find((candidate) => candidate.id === cardId) : undefined;
    const draw = named
      ? {
          card: named,
          skipped: [] as string[],
          deck: { ...deck, seen: [...deck.seen, `${named.id}#0`] },
        }
      : drawLifeCard(this.lifeCards, deck, game.life, this.rng);
    this.recordTileCard('life', draw.card);
    state.cashflowGame = {
      ...game,
      lifeDeck: draw.deck,
      turn: {
        ...game.turn!,
        pending: { ...pending, life: { cardId: draw.card.id, skipped: draw.skipped } },
      },
    };
    this.persistAll('cashflow_life_draw', { card: draw.card.id }, callbacks, { quiet: true });
  }

  /** The rules of this Custom JFK game (null in a classic game): what the player may decide and what the cards decide. */
  get customRules(): CustomRules | null {
    const game = AppStateService.instance.cashflowGame;
    return game.life || game.customRules ? normalizeCustomRules(game.customRules) : null;
  }

  /** Whether the game lets the player decline what life offers (a game setting). */
  get lifeCanDecline(): boolean {
    return this.customRules?.lifeMayDecline ?? true;
  }

  get dreamMayDecline(): boolean {
    return this.customRules?.dreamMayDecline ?? true;
  }

  get careerMustRoll(): boolean {
    return this.customRules?.careerMustRoll ?? false;
  }

  /** Whether Smile and Fire projects of the player's own may be added (outside the game's own cards). */
  static ownProjectsAllowed(): boolean {
    const game = AppStateService.instance.cashflowGame;
    if (!CashflowGameService.isCashflowGame() || !game.professionId || !game.life) return true;
    return normalizeCustomRules(game.customRules).ownProjects;
  }

  /**
   * The emergencies that have to be dealt with before the turn goes on (the rule `emergencySettle`): not paid in full and, where a plan
   * is allowed, without a plan running. Empty when the game is free.
   */
  get unsettledEmergencies(): { title: string; payNow: boolean }[] {
    const rules = this.customRules;
    if (!rules || rules.emergencySettle === 'never') return [];
    return AppStateService.instance.allFireEmergencies
      .filter((fire) => fire.emergencyCardId)
      .filter((fire) => rules.emergencySettle === 'all' || fire.emergencyPayNow)
      .filter((fire) => {
        const paid = fire.buckets.every(
          (bucket) => Number(bucket.amount) + 0.005 >= Number(bucket.target),
        );
        if (paid) return false;
        const planned = (fire.plannedSubscriptions ?? []).some((plan) => plan.status === 'active');
        return fire.emergencyPayNow || !planned;
      })
      .map((fire) => ({ title: fire.title, payNow: !!fire.emergencyPayNow }));
  }

  /** The player's answer to the card: it happens, is accepted, declined, rolled for, given, lent or passed. */
  decideLife(decision: LifeDecision, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const view = this.lifeView;
    if (!view || view.outcome) {
      callbacks.onError('This card has been dealt with.');
      return;
    }
    const declining =
      decision.kind === 'decline' || (decision.kind === 'pass' && view.card.type !== 'giving');
    if (declining && !this.lifeCanDecline) {
      callbacks.onError(this.translate.instant('CashflowGame.life.cannotDecline'));
      return;
    }
    const lang = this.emergencyLang;
    const books = this.lifeBooks();
    let outcome = resolveLifeCard(view.card, decision, lifeContext(books, lang, this.rng), (id) =>
      this.lifeCards.find((candidate) => candidate.id === id),
    );
    const effects = applyLifeOutcome(books, outcome, { date: this.gameDay, lang });
    // a blow is softened so that it cannot end the game on the spot: the card then shows what was really taken
    const placed = effects.state.lifeLines ?? [];
    const softLines = outcome.lines.map(
      (original) => placed.find((line) => line.id.split('~')[0] === original.id) ?? original,
    );
    if (softLines.some((line, index) => line.amountMinor !== outcome.lines[index].amountMinor)) {
      outcome = { ...outcome, lines: softLines, softened: true };
    }
    this.pushUndoSnapshot({
      kind: 'lifeDecision',
      detail: decision.kind,
      cardId: view.card.id,
      deck: 'life',
    });
    this.applyGameEffects(effects);
    this.updatePending((pending) => ({
      ...pending,
      played: true,
      life: { ...pending.life!, outcome, decision: decision.kind },
    }));
    state.transactionsUpdated$.next();
    this.persistAll(
      'cashflow_life_decide',
      { card: view.card.id, decision: decision.kind },
      callbacks,
      {
        includeSubscriptions: true,
        quiet: true,
      },
    );
  }

  /** The monthly lines of life the player can end (lifestyle creep for a small fee), with what they cost. */
  get lifeLines() {
    const lang = this.emergencyLang;
    return (AppStateService.instance.cashflowGame.lifeLines ?? []).map((line) => ({
      id: line.id,
      title: line.title[lang],
      amount: fromMinorUnits(line.amountMinor),
      paydaysLeft: line.paydaysLeft,
      endable:
        line.removeCostMinor !== undefined &&
        (line.minPaydays === undefined || (line.age ?? 0) >= line.minPaydays),
      endCost: fromMinorUnits(line.removeCostMinor ?? 0),
    }));
  }

  endLifeLine(id: string, callbacks: CashflowGameCallbacks): void {
    const effects = endLifeLine(this.lifeBooks(), id, {
      date: this.gameDay,
      lang: this.emergencyLang,
    });
    if (!effects) {
      callbacks.onError('This cannot be ended now.');
      return;
    }
    this.pushUndoSnapshot({
      kind: 'lifeLineEnded',
      detail: this.lifeLines.find((line) => line.id === id)?.title ?? id,
    });
    this.applyGameEffects(effects);
    this.persistAll('cashflow_life_end_line', { id }, callbacks, {
      includeSubscriptions: true,
      quiet: true,
    });
  }

  /** What the last Payday brought to the life of the character (a baby, a new job): told once. */
  consumeLifeNews(): { kind: string; title: string }[] {
    const state = AppStateService.instance;
    const news = state.cashflowGame.lifeNews ?? [];
    if (news.length > 0) state.cashflowGame = { ...state.cashflowGame, lifeNews: [] };
    return news;
  }

  // · Career

  get careerTrack() {
    return this.currentProfession()?.career ?? null;
  }

  /** Where the character stands on the ladder: the stage, the Paydays in it, what comes next. */
  get careerStatus() {
    const game = AppStateService.instance.cashflowGame;
    const track = this.careerTrack;
    const career = game.career;
    const stage = track && career ? findStage(track, career.stage) : undefined;
    if (!track || !career || !stage) return null;
    const lang = this.emergencyLang;
    const total = Math.max(...track.stages.map((candidate) => candidate.stage));
    return {
      stage,
      title: stage.title[lang],
      stageNumber: stage.stage,
      pips:
        stage.branch === 'management' || stage.stage >= 5
          ? stage.branch === 'management'
            ? 7
            : 6
          : 4,
      total,
      paydaysInStage: career.paydaysInStage,
      eligibleIn: stage.next ? Math.max(0, stage.next.minPaydays - career.paydaysInStage) : 0,
      top: !stage.next,
      branch: stage.branch,
      boost: !!career.boost,
    };
  }

  /** The player may search any card of a stack (the free rules); otherwise the card is drawn at random, as at the table. */
  get cardChoiceFree(): boolean {
    const custom = this.customRules;
    if (custom) return custom.cardChoice === 'free';
    return (AppStateService.instance.cashflowGame.rules?.cardChoice ?? 'free') === 'free';
  }

  /** What the next stage asks and offers: the stages it can lead to, the Paydays it needs and the roll. */
  get careerNext() {
    const track = this.careerTrack;
    const career = AppStateService.instance.cashflowGame.career;
    const stage = track && career ? findStage(track, career.stage) : undefined;
    if (!track || !career || !stage?.next) return null;
    const lang = this.emergencyLang;
    return {
      stages: stage.next.stages.map((id) => {
        const next = findStage(track, id)!;
        return {
          id,
          title: next.title[lang],
          branch: next.branch,
          grossYear: fromMinorUnits(next.grossYearMinor),
        };
      }),
      minPaydays: stage.next.minPaydays,
      paydaysIn: career.paydaysInStage,
      rollFrom: career.boost ? Math.min(stage.next.rollFrom, 5) : stage.next.rollFrom,
      eligible: career.paydaysInStage >= stage.next.minPaydays,
    };
  }

  get careerView() {
    const pending = AppStateService.instance.cashflowGame.turn?.pending;
    const career = pending?.career;
    const track = this.careerTrack;
    if (!career || !track) return null;
    const lang = this.emergencyLang;
    return {
      result: career.result,
      done: !!career.done,
      before: career.before,
      after: career.after,
      reached: career.reached ? findStage(track, career.reached) : undefined,
      options:
        career.result.kind === 'branch'
          ? career.result.options.map((id) => findStage(track, id)!)
          : [],
      lang,
    };
  }

  /** The token is on a Career tile: a die decides, nothing is applied until it is a promotion. */
  rollCareerTile(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    const track = this.careerTrack;
    if (
      !pending ||
      pending.kind !== 'story' ||
      pending.tile !== 'career' ||
      pending.career ||
      !track ||
      !game.career
    ) {
      callbacks.onError('There is no career to roll for.');
      return;
    }
    const result: CareerResult = rollCareer(game.career, track, this.rng);
    this.pushUndoSnapshot({ kind: 'careerRoll', detail: result.kind });
    state.cashflowGame = {
      ...game,
      turn: { ...game.turn!, pending: { ...pending, career: { result, done: false } } },
    };
    // what needs no choice is done at once
    if (result.kind === 'promoted') {
      this.reachStage(result.to, callbacks, false);
      return;
    }
    if (result.kind === 'moment') {
      const effects = applyCareerMoment(this.lifeBooks(), result.moment, {
        date: this.gameDay,
        lang: this.emergencyLang,
      });
      this.applyGameEffects(effects);
      this.updatePending((current) => ({ ...current, career: { result, done: true } }));
      this.persistAll('cashflow_career_moment', { moment: result.moment }, callbacks, {
        includeSubscriptions: true,
        quiet: true,
      });
      return;
    }
    if (result.kind === 'failed' && result.retakeMinor) {
      const effects = {
        ...applyLifeOutcome(
          this.lifeBooks(),
          {
            cardId: 'career',
            title: result.retakeLabel ?? { en: 'Exam retake', de: 'Prüfung wiederholen' },
            oneTimeMinor: result.retakeMinor,
            lines: [],
            removeGroups: [],
            life: game.life!,
            scheduled: [],
            rolls: [],
          },
          { date: this.gameDay, lang: this.emergencyLang },
        ),
      };
      this.applyGameEffects(effects);
      this.updatePending((current) => ({ ...current, career: { result, done: true } }));
      this.persistAll('cashflow_career_retake', {}, callbacks, { quiet: true });
      return;
    }
    this.updatePending((current) => ({
      ...current,
      career: { result, done: result.kind !== 'branch' },
    }));
    this.persistAll('cashflow_career_roll', { result: result.kind }, callbacks, { quiet: true });
  }

  /** The promotion: the books take the stage; the old and the new numbers are kept for the comparison shown. */
  reachStage(stageId: string, callbacks: CashflowGameCallbacks, record = true): void {
    const track = this.careerTrack;
    const game = AppStateService.instance.cashflowGame;
    const stage = track && findStage(track, stageId);
    if (!stage || !game.turn?.pending?.career) {
      callbacks.onError('There is no stage to reach.');
      return;
    }
    const books = this.lifeBooks();
    // a promotion after a roll is part of that roll's step; a stage chosen at a branch is a step of its own
    if (record)
      this.pushUndoSnapshot({ kind: 'careerStage', detail: stage.title[this.emergencyLang] });
    const before: CareerSnapshot = careerSnapshot(books);
    const effects = applyCareerStage(books, stage, {
      date: this.gameDay,
      lang: this.emergencyLang,
    });
    this.applyGameEffects(effects);
    const after = careerSnapshot(this.lifeBooks());
    const result = game.turn.pending.career.result;
    this.updatePending((current) => ({
      ...current,
      played: true,
      career: { result, done: true, before, after, reached: stageId },
    }));
    AppStateService.instance.transactionsUpdated$.next();
    this.persistAll('cashflow_career_stage', { stage: stageId }, callbacks, {
      includeSubscriptions: true,
      quiet: true,
    });
  }

  // · Harvest (JFK, 2026-10-26)

  get harvestCards(): HarvestCard[] {
    return this.currentGameSet()?.decks?.harvest ?? [];
  }

  get harvestReady(): boolean {
    return (
      !this.remote_() &&
      this.harvestCards.length > 0 &&
      !!AppStateService.instance.cashflowGame.life
    );
  }

  private harvestContext() {
    return {
      cards: this.opportunityCards,
      lang: this.emergencyLang,
      date: this.gameDay,
      rng: this.rng,
      difficulty: this.customRules?.difficulty,
    };
  }

  /** The Harvest tile the token stands on: the card that was drawn, what it did, and what the player may sell or ride now. */
  get harvestView(): {
    card?: HarvestCard;
    told: string[];
    /** What can be sold now: shares and assets in a market that is open, with what a unit brings. */
    window: HarvestWindowSale[];
    sales: HarvestSale[];
    ladders: HarvestLadderOffer[];
    /** What the card is about (its markets and groups, what it does to everyone) and what of that the player owns. */
    topics?: HarvestTopics;
    involved: { title: string; label: string; kind: AssetKind }[];
  } | null {
    const game = AppStateService.instance.cashflowGame;
    const pending = game.turn?.pending;
    if (pending?.kind !== 'story' || pending.tile !== 'harvest') return null;
    const entry = pending.harvest;
    if (!entry) return { told: [], window: [], sales: [], ladders: [], involved: [] };
    const drawn = this.harvestCards.find((card) => card.id === entry.cardId);
    const topics = drawn ? harvestTopics(drawn) : undefined;
    const lang = this.emergencyLang;
    return {
      card: drawn,
      topics,
      involved: topics
        ? involvedHoldings(topics, game.holdings ?? [], this.opportunityCards).map((entryOf) => ({
            title: entryOf.holding.title,
            label: entryOf.card.title[lang],
            kind: entryOf.kind,
          }))
        : [],
      told: entry.told,
      window: this.windowSales(entry.window),
      sales: entry.sales,
      ladders: entry.ladders,
    };
  }

  /** What is working on the account now: costs and gains that run for some Paydays, pauses, what is on its way. */
  get activeEffects(): ActiveEffect[] {
    return activeEffects(AppStateService.instance.cashflowGame, this.emergencyLang);
  }

  /** What a saving card has saved so far (JFK, 2026-10-26: to tell later what the savings bought): null for anything else. */
  static savedSoFarFor(title: string): { minor: number; paydays: number } | null {
    const holding = (AppStateService.instance.cashflowGame.holdings ?? []).find(
      (entry) => entry.title === title && !!entry.monthlySavingsMinor,
    );
    return holding ? { minor: holding.savedMinor ?? 0, paydays: holding.paydays } : null;
  }

  /** The words of everything the player owns of the Opportunity cards: markets, groups and kinds. */
  heldKeywords(): Set<string> {
    const game = AppStateService.instance.cashflowGame;
    const words = new Set<string>();
    for (const holding of game.holdings ?? []) {
      if (holding.ended) continue;
      const card = this.opportunityCards.find((candidate) => candidate.id === holding.cardId);
      if (!card) continue;
      keywordsOfCard(card).forEach((word) => words.add(word));
      words.add(card.id);
      if (card.share) words.add(card.share.ticker);
    }
    return words;
  }

  /** The holdings in a market that is open for selling now. */
  private windowSales(window: string[] | 'ALL'): HarvestWindowSale[] {
    const game = AppStateService.instance.cashflowGame;
    const cards = this.opportunityCards;
    const lang = this.emergencyLang;
    const out: HarvestWindowSale[] = [];
    for (const holding of game.holdings ?? []) {
      if (holding.ended) continue;
      const card = cards.find((candidate) => candidate.id === holding.cardId);
      if (!card || (!card.share && holding.assetBaseMinor === undefined)) continue;
      const open =
        window === 'ALL'
          ? !!holding.marketTag
          : !!holding.marketTag && window.includes(holding.marketTag);
      if (!open) continue;
      const unitMinor = card.share
        ? unitPriceNow(card, holding, game)
        : valueOf(card, holding, game);
      out.push({
        holding: holding.title,
        label: card.title[lang],
        units: card.share ? (holding.units ?? 0) : 1,
        unitMinor,
        isShare: !!card.share,
      });
    }
    return out;
  }

  /** The player turns the card of the Harvest tile: the pile is drawn, the card is played, and what it did is told. */
  drawHarvest(callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    if (pending?.kind !== 'story' || pending.tile !== 'harvest' || pending.harvest) {
      callbacks.onError('There is no market card to draw.');
      return;
    }
    const cards = this.harvestCards;
    if (cards.length === 0) {
      callbacks.onError('This game has no market cards.');
      return;
    }
    const draw = drawHarvestCard(cards, game.harvestDeck, this.rng);
    this.pushUndoSnapshot({
      kind: 'tileCard',
      detail: draw.card.title[this.emergencyLang],
      cardId: draw.card.id,
      deck: 'harvest',
    });
    const played = playHarvestCard(this.gameBooks(), draw.card, this.harvestContext());
    this.applyGameEffects(played.effects);
    state.cashflowGame = {
      ...state.cashflowGame,
      harvestDeck: draw.deck,
      turn: {
        ...state.cashflowGame.turn!,
        pending: { ...state.cashflowGame.turn!.pending!, played: true, harvest: played.pending },
        // the projects the card touched are marked in Grow (like the Market cards of the classic game)
        affected: [
          ...new Set([
            ...(state.cashflowGame.turn!.affected ?? []),
            ...(played.pending.affected ?? []),
          ]),
        ],
      },
    };
    state.transactionsUpdated$.next();
    this.persistAll('cashflow_harvest_draw', { card: draw.card.id }, callbacks, {
      quiet: true,
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** Sells units of a holding in an open market (all of them when `units` is left out). */
  sellInWindow(
    holdingTitle: string,
    units: number | undefined,
    callbacks: CashflowGameCallbacks,
  ): void {
    const entry = this.harvestView?.window.find((candidate) => candidate.holding === holdingTitle);
    if (!entry) {
      callbacks.onError('This market is not open for selling now.');
      return;
    }
    const sold = Math.max(1, Math.min(units ?? entry.units, entry.units));
    this.sellNow(
      holdingTitle,
      {
        grossMinor: entry.unitMinor * (entry.isShare ? sold : 1),
        costsMinor: 0,
        owedMinor: 0,
        units: entry.isShare ? sold : undefined,
      },
      callbacks,
    );
  }

  /**
   * Selling from Grow what the Opportunity cards made (JFK, 2026-10-26): it is sold at the open offer of a Harvest card - a window of
   * its market, a buyer - and the game books it itself, at the offer's price. Returns null when the project is not one of those,
   * else how it went: `sold`, or the sentence that says why not.
   */
  sellHeldFromOffer(
    title: string,
  ): { sold: true; notice?: string } | { sold: false; message: string } | null {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    if (!this.customRules) return null;
    const holding = (game.holdings ?? []).find((entry) => !entry.ended && entry.title === title);
    if (!holding) return null;
    const offer = openOfferFor(game, title);
    const card = this.opportunityCards.find((candidate) => candidate.id === holding.cardId);
    if (!offer) {
      // no card offers a price: the market takes it at its price less a discount, so there is always a way out
      const standing = card ? standingSale(card, holding, game) : null;
      if (!standing) {
        return { sold: false, message: this.translate.instant('CashflowGame.harvest.noBuyer') };
      }
      let problem = '';
      this.sellNow(
        title,
        {
          grossMinor: standing.grossMinor,
          costsMinor: 0,
          owedMinor: standing.owedMinor,
          units: standing.units,
        },
        { onSuccess: () => undefined, onError: (message) => (problem = message) },
      );
      return problem
        ? { sold: false, message: problem }
        : {
            sold: true,
            notice: this.translate.instant('CashflowGame.harvest.soldAtMarket', {
              percent: standing.discountPercent,
            }),
          };
    }
    const units = card?.share ? holding.units : undefined;
    const perUnit = offer.pricePerShareMinor;
    const grossMinor = perUnit !== undefined && units ? perUnit * units : offer.salePriceMinor;
    // a buyer's offer is net of the costs of the sale; what is still owed on a property or a business comes off the proceeds
    const owedMinor =
      perUnit === undefined ? (card?.property?.mortgageMinor ?? card?.loan?.loanMinor ?? 0) : 0;
    let failure = '';
    this.sellNow(
      title,
      { grossMinor, costsMinor: 0, owedMinor, units },
      {
        onSuccess: () => undefined,
        onError: (message) => (failure = message),
      },
    );
    if (failure) return { sold: false, message: failure };
    state.cashflowGame = {
      ...state.cashflowGame,
      marketOffers: (state.cashflowGame.marketOffers ?? []).filter(
        (entry) => entry.title !== title,
      ),
    };
    this.persistAll(
      'cashflow_offer_taken',
      { title },
      { onSuccess: () => undefined, onError: () => undefined },
      { quiet: true },
    );
    return { sold: true };
  }

  /** Takes the offer of a buyer on the card. */
  acceptHarvestSale(holdingTitle: string, callbacks: CashflowGameCallbacks): void {
    const entry = AppStateService.instance.cashflowGame.turn?.pending?.harvest;
    const sale = entry?.sales.find((candidate) => candidate.holding === holdingTitle);
    if (!entry || !sale) {
      callbacks.onError('There is no buyer for this.');
      return;
    }
    this.sellNow(holdingTitle, sale, callbacks, (pending) => ({
      ...pending,
      sales: pending.sales.filter((candidate) => candidate.holding !== holdingTitle),
    }));
  }

  private sellNow(
    holdingTitle: string,
    sale: { grossMinor: number; costsMinor: number; owedMinor: number; units?: number },
    callbacks: CashflowGameCallbacks,
    after?: (pending: HarvestPending) => HarvestPending,
  ): void {
    const state = AppStateService.instance;
    this.pushUndoSnapshot({ kind: 'cardSale', detail: holdingTitle });
    let effects;
    try {
      effects = sellHolding(this.gameBooks(), holdingTitle, sale, this.harvestContext());
    } catch (err: unknown) {
      this.undoStack = popUndoSteps(this.undoStack, 1).stack;
      callbacks.onError(errorMessage(err, 'Could not sell this.'));
      return;
    }
    this.applyGameEffects(effects);
    this.noteProject(
      holdingTitle,
      `Cash after the sale: ${this.noteMoney(toMinorUnits(this.cash))}.`,
      `Bargeld nach dem Verkauf: ${this.noteMoney(toMinorUnits(this.cash))}.`,
    );
    if (after) {
      this.updatePending((pending) => ({
        ...pending,
        harvest: pending.harvest ? after(pending.harvest) : pending.harvest,
      }));
    }
    state.transactionsUpdated$.next();
    this.persistAll('cashflow_harvest_sale', { holding: holdingTitle }, callbacks, {
      quiet: true,
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** The player rides a step of a hype: a die decides. */
  rideHarvestLadder(holdingTitle: string, callbacks: CashflowGameCallbacks): number | null {
    const entry = AppStateService.instance.cashflowGame.turn?.pending?.harvest;
    const offer = entry?.ladders.find((candidate) => candidate.holding === holdingTitle);
    if (!entry || !offer || offer.state === 'done') {
      callbacks.onError('There is no hype to ride.');
      return null;
    }
    this.pushUndoSnapshot({ kind: 'diceWon', detail: holdingTitle });
    const step = rideLadder(offer, this.rng);
    const won = step.roll >= offer.successFrom;
    this.noteProject(
      holdingTitle,
      `Hype: rolled ${step.roll} (${offer.successFrom} or more wins a step) - ${won ? `a step won, the stake is now ${this.noteMoney(Math.round(step.offer.stakeMinor * step.offer.multiplier))} (x${step.offer.multiplier})` : `the hype collapsed, ${step.offer.multiplier > 0 ? `${this.noteMoney(Math.round(step.offer.stakeMinor * step.offer.multiplier))} is left of the stake of ${this.noteMoney(step.offer.stakeMinor)}` : `nothing is left of the stake of ${this.noteMoney(step.offer.stakeMinor)}`}`}.`,
      `Hype: gewürfelt ${step.roll} (ab ${offer.successFrom} gewinnt eine Stufe) - ${won ? `eine Stufe gewonnen, der Einsatz ist jetzt ${this.noteMoney(Math.round(step.offer.stakeMinor * step.offer.multiplier))} wert (x${step.offer.multiplier})` : `der Hype ist zusammengebrochen, ${step.offer.multiplier > 0 ? `von ${this.noteMoney(step.offer.stakeMinor)} Einsatz bleiben ${this.noteMoney(Math.round(step.offer.stakeMinor * step.offer.multiplier))}` : `von ${this.noteMoney(step.offer.stakeMinor)} Einsatz bleibt nichts`}`}.`,
    );
    this.updatePending((pending) => ({
      ...pending,
      harvest: {
        ...pending.harvest!,
        ladders: pending.harvest!.ladders.map((candidate) =>
          candidate.holding === holdingTitle ? step.offer : candidate,
        ),
      },
    }));
    if (step.offer.state === 'done') {
      // the hype is over (collapsed, or the last step won): what is left is paid out
      this.settleLadder(holdingTitle, step.offer, callbacks);
    } else {
      this.persistAll('cashflow_harvest_ladder', { holding: holdingTitle }, callbacks, {
        quiet: true,
      });
    }
    return step.roll;
  }

  /** The player cashes out a hype where it stands. */
  cashOutHarvestLadder(holdingTitle: string, callbacks: CashflowGameCallbacks): void {
    const offer = AppStateService.instance.cashflowGame.turn?.pending?.harvest?.ladders.find(
      (candidate) => candidate.holding === holdingTitle,
    );
    if (!offer || offer.state === 'done') {
      callbacks.onError('There is no hype to cash out.');
      return;
    }
    this.pushUndoSnapshot({ kind: 'cardSale', detail: holdingTitle });
    const done = { ...offer, state: 'done' as const };
    this.updatePending((pending) => ({
      ...pending,
      harvest: {
        ...pending.harvest!,
        ladders: pending.harvest!.ladders.map((candidate) =>
          candidate.holding === holdingTitle ? done : candidate,
        ),
      },
    }));
    this.settleLadder(holdingTitle, done, callbacks, false);
  }

  private settleLadder(
    holdingTitle: string,
    offer: HarvestLadderOffer,
    callbacks: CashflowGameCallbacks,
    undoable = true,
  ): void {
    void undoable;
    const state = AppStateService.instance;
    const payout = ladderPayout(offer);
    try {
      const effects = sellHolding(
        this.gameBooks(),
        holdingTitle,
        { grossMinor: payout, costsMinor: 0, owedMinor: 0 },
        this.harvestContext(),
      );
      this.applyGameEffects(effects);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not settle the hype.'));
      return;
    }
    state.transactionsUpdated$.next();
    this.persistAll('cashflow_harvest_ladder_done', { holding: holdingTitle }, callbacks, {
      quiet: true,
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  // · Opportunities (JFK, 2026-10-26)

  get opportunityCards(): OpportunityCard[] {
    return this.currentGameSet()?.decks?.opportunity ?? [];
  }

  /** The rules of the Opportunity tile in this game: cards per landing, side hustles, copies of the savings cards. */
  get opportunitySettings(): OpportunitySettings {
    const rules = this.customRules;
    return rules
      ? {
          offersPerLanding: rules.opportunityOffers,
          maxSideHustles: rules.maxSideHustles,
          savingsCardCopies: rules.savingsCardCopies,
          validTurns: rules.opportunityValidTurns,
        }
      : DEFAULT_OPPORTUNITY_SETTINGS;
  }

  get opportunityReady(): boolean {
    return (
      !this.remote_() &&
      this.opportunityCards.length > 0 &&
      !!AppStateService.instance.cashflowGame.life
    );
  }

  private remote_(): boolean {
    return !!RemoteGameHook.current;
  }

  /** What a card asks of the player: their life, the stage of their career, what they owe, what they already own. */
  private opportunityContext(): OpportunityContext {
    const state = AppStateService.instance;
    const debt = state.liabilities
      .filter((liability) => liability.tag !== 'Bank loan')
      .reduce(
        (sum, liability) => sum + Math.max(0, toMinorUnits(Number(liability.amount) || 0)),
        0,
      );
    return {
      life: state.cashflowGame.life,
      careerStage: this.careerStatus?.stageNumber ?? 1,
      holdings: state.cashflowGame.holdings ?? [],
      debtMinor: debt,
    };
  }

  /** The Opportunity tile the token stands on: the piles to choose from, or the cards offered from the pile chosen. */
  get opportunityView(): {
    pile?: OpportunityPile;
    offers: {
      card: OpportunityCard;
      quote: OpportunityQuote;
      /** Units already held of a share card. */
      held: number;
    }[];
    taken?: OpportunityCard;
    passed: boolean;
    told: string[];
    projectTitle?: string;
    planned: boolean;
    paymentOpen: boolean;
    /** The card whose die has not been thrown yet. */
    rollFor?: OpportunityCard;
  } | null {
    const game = AppStateService.instance.cashflowGame;
    const pending = game.turn?.pending;
    if (pending?.kind !== 'story' || pending.tile !== 'opportunity') return null;
    const entry = pending.opportunity;
    const cards = this.opportunityCards;
    const context = this.opportunityContext();
    const settings = this.opportunitySettings;
    const offers = (entry?.offers ?? [])
      .map((id) => cards.find((card) => card.id === id))
      .filter((card): card is OpportunityCard => !!card)
      .map((card) => ({
        card,
        quote: quoteOpportunity(card, {}, context, settings, cards),
        held: (game.holdings ?? []).find((h) => h.cardId === card.id && !h.ended)?.units ?? 0,
      }));
    return {
      pile: isOpportunityPile(entry?.pile) ? entry?.pile : undefined,
      offers,
      taken: cards.find((card) => card.id === entry?.taken),
      passed: !!entry?.passed,
      told: entry?.told ?? [],
      projectTitle: entry?.projectTitle,
      planned: !!entry?.planned,
      paymentOpen: (game.paymentsDue ?? []).some((due) => !!due.opportunity),
      rollFor: cards.find((card) => card.id === entry?.rollFor?.cardId),
    };
  }

  /** The quote for a card with the choices made so far (units of a share, steps, the hustle to give up). */
  quoteOpportunityChoice(card: OpportunityCard, choice: OpportunityChoice): OpportunityQuote {
    return quoteOpportunity(
      card,
      choice,
      this.opportunityContext(),
      this.opportunitySettings,
      this.opportunityCards,
    );
  }

  /** The player chose a pile: its cards are drawn (up to the cards per landing), and those not taken go to the bottom. */
  drawOpportunity(pile: OpportunityPile, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    if (pending?.kind !== 'story' || pending.tile !== 'opportunity' || pending.opportunity?.pile) {
      callbacks.onError('There is no pile to choose now.');
      return;
    }
    const draw = drawOpportunityOffers(
      this.opportunityCards,
      game.opportunityDeck,
      pile,
      this.opportunitySettings,
      this.opportunityContext(),
      this.rng,
    );
    if (draw.offers.length === 0) {
      callbacks.onError('This pile has no card for you now.');
      return;
    }
    this.pushUndoSnapshot({
      kind: 'tileCard',
      detail: draw.offers.map((card) => card.title[this.emergencyLang]).join(', '),
      cardId: draw.offers[0].id,
      deck: 'opportunity',
    });
    state.cashflowGame = {
      ...game,
      opportunityDeck: draw.deck,
      turn: {
        ...game.turn!,
        pending: { ...pending, opportunity: { pile, offers: draw.offers.map((card) => card.id) } },
      },
    };
    this.persistAll('cashflow_opportunity_draw', { pile }, callbacks, { quiet: true });
  }

  /** The player takes one of the offered cards: it is paid in the Add dialog, or applied at once when it costs nothing. */
  takeOpportunity(
    cardId: string,
    choice: OpportunityChoice,
    callbacks: CashflowGameCallbacks,
  ): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    const card = this.opportunityCards.find((candidate) => candidate.id === cardId);
    if (
      !card ||
      pending?.kind !== 'story' ||
      pending.opportunity?.taken ||
      pending.opportunity?.passed
    ) {
      callbacks.onError('This card cannot be taken now.');
      return;
    }
    const quote = this.quoteOpportunityChoice(card, choice);
    if (!quote.ok) {
      callbacks.onError(this.translate.instant(`CashflowGame.opportunity.cannot.${quote.reason}`));
      return;
    }
    const lang = this.emergencyLang;
    this.pushUndoSnapshot({
      kind: 'buyDeal',
      detail: card.title[lang],
      cardId: card.id,
      deck: 'opportunity',
    });
    const taken = {
      ...pending.opportunity!,
      taken: card.id,
      units: choice.units,
      steps: choice.steps,
      swapOut: choice.swapOut,
    };
    state.cashflowGame = {
      ...game,
      turn: { ...game.turn!, pending: { ...pending, played: true, opportunity: taken } },
    };
    // an investment is planned in Grow: a project with its numbers and a note of what the player has and would have to borrow; how
    // many units to buy is decided there (JFK, 2026-10-26). A saving applies at once (what it costs is a payment due).
    if (card.growType === 'income-growth') {
      try {
        this.applyGameEffects(
          planOpportunity(this.gameBooks(), card, this.dealDeps, {
            lang,
            swapOut: choice.swapOut,
            validTurns: this.opportunitySettings.validTurns,
            indexPercent: Math.round(indexOf(state.cashflowGame, card.market?.tag) * 100),
          }),
        );
      } catch (err: unknown) {
        this.undoStack = popUndoSteps(this.undoStack, 1).stack;
        callbacks.onError(errorMessage(err, 'This card could not be planned.'));
        return;
      }
      this.updatePending((current) => ({
        ...current,
        opportunity: {
          ...current.opportunity!,
          planned: true,
          projectTitle: projectTitleOf(card, lang),
        },
      }));
      const planned = state.allGrowProjects.find(
        (project) => project.title === projectTitleOf(card, lang),
      );
      if (planned) this.syncPlanNote(planned);
      state.transactionsUpdated$.next();
      this.persistAll('cashflow_opportunity_plan', { card: card.id }, callbacks, {
        quiet: true,
        includeGrow: true,
      });
      return;
    }
    if (quote.costMinor > 0) {
      // a saving that costs something: the player pays it in the Add dialog, then it applies
      const title = card.share ? card.share.ticker : card.title[lang];
      state.cashflowGame = withPaymentDue(state.cashflowGame, {
        title: card.title[lang],
        costMinor: quote.costMinor,
        account: 'Fire',
        category: title,
        opportunity: {
          cardId: card.id,
          units: choice.units,
          steps: choice.steps,
          swapOut: choice.swapOut,
        },
      });
      this.persistAll('cashflow_opportunity_take', { card: card.id }, callbacks, { quiet: true });
      return;
    }
    this.completeOrAwaitRoll(card, choice);
    this.persistAll('cashflow_opportunity_take', { card: card.id }, callbacks, {
      quiet: true,
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
  }

  /** The payment of a taken card was booked (or the card was free): the project, the position and the monthly lines are made. */
  /**
   * A card with a die waits for the player to throw it (the golden dice of the tile): the purchase is made, what the die decides is
   * not. A card without a die is done at once.
   */
  private completeOrAwaitRoll(
    card: OpportunityCard,
    choice: OpportunityChoice,
    light = false,
  ): void {
    const pending = AppStateService.instance.cashflowGame.turn?.pending;
    if ((card.dice || card.onBuy) && pending?.opportunity) {
      this.updatePending((current) => ({
        ...current,
        opportunity: {
          ...current.opportunity!,
          rollFor: {
            cardId: card.id,
            ...(choice.units !== undefined ? { units: choice.units } : {}),
            ...(choice.steps !== undefined ? { steps: choice.steps } : {}),
            ...(choice.swapOut ? { swapOut: choice.swapOut } : {}),
            ...(choice.indexPercent !== undefined ? { indexPercent: choice.indexPercent } : {}),
            ...(light ? { light: true } : {}),
          },
        },
      }));
      AppStateService.instance.transactionsUpdated$.next();
      return;
    }
    this.completeOpportunity(card, choice, light);
  }

  /** The player throws the die of the card they bought: what it decides is booked now. Returns the faces for the dice on the tile. */
  rollOpportunityPurchase(callbacks: CashflowGameCallbacks): number[] {
    const state = AppStateService.instance;
    const wait = state.cashflowGame.turn?.pending?.opportunity?.rollFor;
    const card = wait
      ? this.opportunityCards.find((candidate) => candidate.id === wait.cardId)
      : undefined;
    if (!wait || !card) {
      callbacks.onError('There is no die to throw.');
      return [];
    }
    this.pushUndoSnapshot({
      kind: 'buyDeal',
      detail: card.title[this.emergencyLang],
      cardId: card.id,
      deck: 'opportunity',
    });
    this.updatePending((current) => {
      const { rollFor: _gone, ...rest } = current.opportunity!;
      void _gone;
      return { ...current, opportunity: rest };
    });
    const rolls = this.completeOpportunity(
      card,
      {
        units: wait.units,
        steps: wait.steps,
        swapOut: wait.swapOut,
        indexPercent: wait.indexPercent,
      },
      !!wait.light,
    );
    this.persistAll('cashflow_opportunity_roll', { card: card.id }, callbacks, {
      quiet: true,
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
    });
    return [rolls.outcome, rolls.outcomeAgain, rolls.onBuy].filter(
      (face): face is number => face !== undefined,
    );
  }

  private completeOpportunity(
    card: OpportunityCard,
    choice: OpportunityChoice,
    light = false,
  ): OpportunityRolls {
    const lang = this.emergencyLang;
    const books = this.gameBooks();
    const rolls = rollsFor(card, this.rng, this.customRules?.difficulty);
    const purchase = buyOpportunity(books, card, choice, rolls, {
      difficulty: this.customRules?.difficulty,
      date: this.gameDay,
      lang,
      context: this.opportunityContext(),
      cards: this.opportunityCards,
      light,
    });
    this.applyGameEffects(purchase.effects);
    if (AppStateService.instance.cashflowGame.turn?.pending?.opportunity) {
      this.updatePending((pending) => ({
        ...pending,
        opportunity: {
          ...pending.opportunity!,
          told: [...(pending.opportunity?.told ?? []), ...purchase.told],
          projectTitle: purchase.holding.title,
        },
      }));
    }
    AppStateService.instance.transactionsUpdated$.next();
    return rolls;
  }

  /** A purchase booked in Grow for a project that was planned from a card: the card's own work (rolls, monthly line, holding). */
  private finishOpportunityBuy(title: string, comment: string): void {
    const state = AppStateService.instance;
    const plan = (state.cashflowGame.opportunityPlans ?? []).find((entry) => entry.title === title);
    const card = plan
      ? this.opportunityCards.find((candidate) => candidate.id === plan.cardId)
      : undefined;
    if (!plan || !card) return;
    const bought = parseGrowComment(comment).find((statement) => statement.kind === 'buyShare');
    this.completeOrAwaitRoll(
      card,
      {
        units: bought && 'quantity' in bought ? bought.quantity : undefined,
        swapOut: plan.swapOut,
        indexPercent: Math.round(indexOf(state.cashflowGame, card.market?.tag) * 100),
      },
      true,
    );
  }

  /** A sale booked in Grow for something the cards made: the holding has fewer units, or is gone with its monthly line. */
  private settleOpportunitySale(title: string, comment: string): void {
    const sold = parseGrowComment(comment).find((statement) => statement.kind === 'sellShare');
    const effects = settleHoldingSale(
      this.gameBooks(),
      title,
      sold && 'quantity' in sold ? sold.quantity : undefined,
      this.opportunityCards,
      this.gameDay,
    );
    if (effects) this.applyGameEffects(effects);
  }

  /** None of the offered cards is taken: they go to the bottom of their pile. */
  passOpportunity(callbacks: CashflowGameCallbacks): void {
    const pending = AppStateService.instance.cashflowGame.turn?.pending;
    if (pending?.kind !== 'story' || pending.tile !== 'opportunity') {
      callbacks.onError('There is no opportunity to pass.');
      return;
    }
    this.pushUndoSnapshot({ kind: 'skipCard', detail: pending.opportunity?.pile });
    this.updatePending((current) => ({
      ...current,
      opportunity: { ...current.opportunity, passed: true },
    }));
    this.persistAll('cashflow_opportunity_pass', {}, callbacks, { quiet: true });
  }

  /** What the player owns of the cards, for the profile: the titles with what they bring each month. */
  get opportunityHoldings() {
    return (AppStateService.instance.cashflowGame.holdings ?? []).filter(
      (holding) => !holding.ended,
    );
  }

  // · Dreams

  get dreamCards(): DreamCard[] {
    return this.currentGameSet()?.decks?.dream ?? [];
  }

  get dreamLog(): DreamLog {
    return AppStateService.instance.cashflowGame.dreams ?? EMPTY_DREAM_LOG;
  }

  get dreamSettings(): DreamSettings {
    const custom = this.customRules;
    if (custom) {
      return {
        offersPerLanding: custom.dreamOffers,
        maxOpenDreams: custom.maxOpenDreams,
        lifeCanDecline: custom.lifeMayDecline,
      };
    }
    return AppStateService.instance.cashflowGame.dreamSettings ?? DEFAULT_DREAM_SETTINGS;
  }

  /** The Smile projects of the dreams the character has taken, with the card each came from. */
  get openDreams() {
    const state = AppStateService.instance;
    return this.dreamLog.open
      .map((open) => {
        const card = this.dreamCards.find((candidate) => candidate.id === open.cardId);
        const project = state.allSmileProjects.find(
          (candidate) => candidate.title === open.projectTitle,
        );
        return card && project ? { open, card, project } : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  }

  /** The points of the dreams, so far: lived, partly funded, and for patience. */
  get dreamPoints() {
    const state = AppStateService.instance;
    return totalDreamPoints(this.dreamLog, this.dreamCards, (title) => {
      const project = state.allSmileProjects.find((candidate) => candidate.title === title);
      const funded = (project?.buckets ?? [])
        .filter((bucket) => Number(bucket.amount) + 0.005 >= Number(bucket.target))
        .reduce((sum, bucket) => sum + Number(bucket.target), 0);
      return { fundedBucketsMinor: toMinorUnits(funded) };
    });
  }

  /** What the Dream tile shows: the offers, or a moment, and what has been done with them. */
  get dreamView(): {
    offers: DreamCard[];
    moment?: DreamMoment;
    taken?: string;
    declined: boolean;
    applied?: { en: string; de: string };
    swapping?: string;
    canTake: boolean;
  } | null {
    const dream = AppStateService.instance.cashflowGame.turn?.pending?.dream;
    if (!dream) return null;
    return {
      offers: (dream.offers ?? [])
        .map((id) => this.dreamCards.find((candidate) => candidate.id === id))
        .filter((card): card is DreamCard => !!card),
      moment: dream.moment
        ? DREAM_MOMENTS.find((candidate) => candidate.id === dream.moment)
        : undefined,
      taken: dream.taken,
      declined: !!dream.declined,
      applied: dream.applied,
      swapping: dream.swapping,
      canTake: canTakeDream(this.dreamLog, this.dreamSettings) || !!dream.swapping,
    };
  }

  drawDream(
    callbacks: CashflowGameCallbacks,
    options: { forceOffers?: number; cardId?: string } = {},
  ): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const pending = game.turn?.pending;
    if (
      !pending ||
      pending.kind !== 'story' ||
      pending.tile !== 'dream' ||
      (pending.dream && !options.forceOffers)
    ) {
      callbacks.onError('There is no dream to draw.');
      return;
    }
    if (this.dreamCards.length === 0) {
      callbacks.onError('This game has no dreams.');
      return;
    }
    const deck = game.dreamDeck ?? emptyEmergencyDeck();
    let offers: string[] | undefined;
    let moment: string | undefined;
    let nextDeck: typeof deck;
    if (options.cardId && this.dreamCards.some((card) => card.id === options.cardId)) {
      offers = [options.cardId];
      nextDeck = { ...deck, seen: [...deck.seen, options.cardId] };
    } else {
      const landing = drawDreamLanding(
        this.dreamCards,
        DREAM_MOMENTS,
        deck,
        {
          log: this.dreamLog,
          life: game.life,
          settings: this.dreamSettings,
          forceOffers: options.forceOffers,
        },
        this.rng,
      );
      nextDeck = landing.deck;
      if (landing.kind === 'offers') offers = landing.offers.map((offer) => offer.id);
      else moment = landing.moment.id;
    }
    const firstOffer = this.dreamCards.find((card) => card.id === offers?.[0]);
    if (firstOffer) this.recordTileCard('dream', firstOffer);
    else this.pushUndoSnapshot({ kind: 'tileCard', detail: moment });
    state.cashflowGame = {
      ...game,
      dreamDeck: nextDeck,
      turn: {
        ...game.turn!,
        pending: {
          ...pending,
          dream: { ...(offers ? { offers } : {}), ...(moment ? { moment } : {}) },
        },
      },
    };
    this.persistAll('cashflow_dream_draw', { offers, moment }, callbacks, { quiet: true });
  }

  /** A dream is taken: it becomes a Smile project (buckets, links, tasks, notes), to be funded there. */
  takeDream(cardId: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const view = this.dreamView;
    const card = this.dreamCards.find((candidate) => candidate.id === cardId);
    if (!view || !card || view.taken) {
      callbacks.onError('This dream cannot be taken now.');
      return;
    }
    if (!view.canTake) {
      callbacks.onError(
        this.translate.instant('CashflowGame.dream.tooMany', {
          max: this.dreamSettings.maxOpenDreams,
        }),
      );
      return;
    }
    const lang = this.emergencyLang;
    this.pushUndoSnapshot({
      kind: 'dreamTaken',
      detail: card.title[lang],
      cardId: card.id,
      deck: 'dream',
    });
    const now = new Date().toISOString();
    const project: Smile = {
      title: card.title[lang],
      sub: `${this.translate.instant(`CashflowGame.dream.tier.${card.tier}`)} · ${this.translate.instant(`CashflowGame.dream.category.${card.category}`)} · ${livedPoints(card)} ${this.translate.instant('CashflowGame.dream.points')}`,
      dreamCardId: card.id,
      phase: 'planning',
      description: card.story[lang],
      buckets: card.buckets.map((bucket) => ({
        id: `${card.title[lang]}-${bucket.id}`,
        title: bucket.title[lang],
        target: fromMinorUnits(bucket.amountMinor),
        amount: 0,
        notes: '',
      })),
      links: card.links.map((link) => ({ label: link.label[lang], url: link.url })),
      actionItems: card.actions.map((action) => ({
        text: action.text[lang],
        done: false,
        priority: action.priority,
      })),
      notes: [
        ...(card.stat ? [{ text: card.stat[lang], createdAt: now }] : []),
        ...(card.monthlyAfterMinor
          ? [
              {
                text: this.translate.instant('CashflowGame.dream.runningCosts', {
                  amount: fromMinorUnits(card.monthlyAfterMinor),
                  currency: state.currency,
                }),
                createdAt: now,
              },
            ]
          : []),
      ],
      createdAt: now,
      updatedAt: now,
    };
    let carried = 0;
    // a swap: the dream that goes gives back its saved money and the new one starts with it
    if (view.swapping) {
      carried = this.releaseDream(view.swapping);
    }
    state.allSmileProjects = [
      ...state.allSmileProjects.filter((existing) => existing.title !== project.title),
      project,
    ];
    if (carried > 0) {
      const day = this.gameDay;
      const tx: Transaction = {
        account: 'Smile',
        amount: -Math.min(
          carried,
          project.buckets.reduce((sum, bucket) => sum + bucket.target, 0),
        ),
        date: day,
        time: '',
        category: `@${project.title}`,
        comment: `${project.title}\n#dreamfund`,
      };
      this.bookOnGameLocation(tx);
      state.allTransactions.push(tx);
    }
    const log = this.dreamLog;
    state.cashflowGame = {
      ...game,
      dreams: {
        ...log,
        open: [
          ...log.open.filter((open) => open.projectTitle !== view.swapping),
          { cardId: card.id, projectTitle: project.title, round: game.round },
        ],
      },
      turn: {
        ...game.turn!,
        pending: {
          ...game.turn!.pending!,
          played: true,
          dream: { ...game.turn!.pending!.dream, taken: project.title, swapping: undefined },
        },
      },
    };
    this.persistAll('cashflow_dream_take', { card: card.id }, callbacks, { quiet: true });
  }

  /** None of the offered dreams is taken: nothing happens, the cards go to the discard pile. */
  declineDreams(callbacks: CashflowGameCallbacks): void {
    const offered = (AppStateService.instance.cashflowGame.turn?.pending?.dream?.offers ?? [])
      .map((id) => this.dreamCards.find((card) => card.id === id))
      .filter((card): card is DreamCard => !!card);
    this.pushUndoSnapshot({
      kind: 'dreamDeclined',
      ...(offered.length
        ? {
            detail: offered.map((card) => card.title[this.emergencyLang]).join(', '),
            cardId: offered[0].id,
            deck: 'dream' as const,
          }
        : {}),
    });
    this.updatePending((pending) => ({ ...pending, dream: { ...pending.dream, declined: true } }));
    this.persistAll('cashflow_dream_decline', {}, callbacks, { quiet: true });
  }

  /** The money saved for a dream is given back and the project ends (a swap). Returns what was saved. */
  private releaseDream(projectTitle: string): number {
    const state = AppStateService.instance;
    const project = state.allSmileProjects.find((candidate) => candidate.title === projectTitle);
    if (!project) return 0;
    const saved = project.buckets.reduce((sum, bucket) => sum + Number(bucket.amount), 0);
    for (const bucket of project.buckets) {
      if (Number(bucket.amount) <= 0) continue;
      settleBucketTransactions(state.allTransactions, {
        projectTitle,
        bucket: { title: bucket.title, amount: Number(bucket.amount) },
        actual: 0,
        account: 'Smile',
        date: this.gameDay,
        time: '',
      });
    }
    state.allSmileProjects = state.allSmileProjects.filter(
      (candidate) => candidate.title !== projectTitle,
    );
    return saved;
  }

  /**
   * A dream moment that needs a dream picked (and a bucket): applies it. `projectTitle` is the dream it is about; `bucketIndex` the bucket
   * a gift goes to.
   */
  applyDreamMoment(
    moment: string,
    target: { projectTitle?: string; bucketIndex?: number },
    callbacks: CashflowGameCallbacks,
  ): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const lang = this.emergencyLang;
    this.pushUndoSnapshot({ kind: 'dreamMoment', detail: moment });
    const project = state.allSmileProjects.find(
      (candidate) => candidate.title === target.projectTitle,
    );
    const day = this.gameDay;
    const targetOf = () =>
      (project?.buckets ?? []).reduce((sum, bucket) => sum + Number(bucket.target), 0);
    const savedOf = () =>
      (project?.buckets ?? []).reduce((sum, bucket) => sum + Number(bucket.amount), 0);
    const targetBefore = targetOf();
    const say = (en: string, de: string) => ({ en, de });
    let applied: { en: string; de: string } | undefined;
    const money = (amount: number) => `${amount.toFixed(2)} ${state.currency}`;
    const addGift = (amount: number) => {
      const gift: Transaction = {
        account: 'Smile',
        amount,
        date: day,
        time: '',
        category: `@${lang === 'de' ? 'Geschenk' : 'Gift'}`,
        comment: `${moment}\n#dreamfund`,
      };
      this.bookOnGameLocation(gift);
      state.allTransactions.push(gift);
      if (project) {
        const bucket = project.buckets[target.bucketIndex ?? 0] ?? project.buckets[0];
        const put: Transaction = {
          account: 'Smile',
          amount: -amount,
          date: day,
          time: '',
          category: `@${project.title}`,
          comment: `${moment}\n#bucket:${bucket.title}:${amount.toFixed(2)}\n#dreamfund`,
        };
        this.bookOnGameLocation(put);
        state.allTransactions.push(put);
      }
    };
    switch (moment) {
      case 'M01':
        if (!project) break;
        project.buckets = discountRemaining(project.buckets, 15);
        applied = say(
          `What is missing of ${project.title} costs 15% less.`,
          `Was bei ${project.title} noch fehlt, kostet 15 % weniger.`,
        );
        break;
      case 'M03':
        if (!project) break;
        project.buckets = discountTotal(project.buckets, 20);
        applied = say(`${project.title} costs 20% less.`, `${project.title} kostet 20 % weniger.`);
        break;
      case 'M04':
        if (!project) break;
        project.buckets = discountTotal(project.buckets, 25);
        applied = say(`${project.title} costs 25% less.`, `${project.title} kostet 25 % weniger.`);
        break;
      case 'M02':
        addGift(300);
        applied = project
          ? say(`300 went into ${project.title}.`, `300 gingen in ${project.title}.`)
          : say('300 went to your Smile account.', '300 gingen auf dein Smile-Konto.');
        break;
      case 'M06': {
        const net = fromMinorUnits(
          netMonthlyMinor(
            game,
            this.gameSubscriptions().map((sub) => ({
              title: sub.title,
              amountMinor: sub.amountMinor,
            })),
          ),
        );
        const amount = Math.round(net * 5) / 100;
        addGift(amount);
        applied = project
          ? say(
              `${money(amount)} went into ${project.title}.`,
              `${money(amount)} gingen in ${project.title}.`,
            )
          : say(
              `${money(amount)} went to your Smile account.`,
              `${money(amount)} gingen auf dein Smile-Konto.`,
            );
        break;
      }
      case 'M07': {
        const waiting = this.dreamLog.open.filter(
          (open) =>
            game.round - open.round >= 6 &&
            (state.allSmileProjects.find((p) => p.title === open.projectTitle)?.buckets ?? []).some(
              (bucket) => Number(bucket.amount) > 0,
            ),
        ).length;
        state.cashflowGame = {
          ...game,
          dreams: { ...this.dreamLog, bonusPoints: this.dreamLog.bonusPoints + waiting },
        };
        applied = say(`${waiting} point(s) for patience.`, `${waiting} Punkt(e) für deine Geduld.`);
        break;
      }
      case 'M08':
        if (project) {
          this.updatePending((pending) => ({
            ...pending,
            dream: { ...pending.dream, swapping: project.title },
          }));
          this.drawSwapOffers(project, callbacks);
          return;
        }
        break;
      default:
        break;
    }
    if (!applied) {
      callbacks.onError('This moment cannot be applied now.');
      return;
    }
    if (project) {
      project.updatedAt = new Date().toISOString();
      const titleOfMoment = DREAM_MOMENTS.find((entry) => entry.id === moment)?.title;
      const name = titleOfMoment ? titleOfMoment[lang] : moment;
      const money2 = (value: number) => this.amountText(value);
      this.noteProject(
        project.title,
        `${name}: ${applied.en} Total cost ${money2(targetBefore)} before, ${money2(targetOf())} now; saved so far ${money2(savedOf())}.`,
        `${name}: ${applied.de} Gesamtkosten vorher ${money2(targetBefore)}, jetzt ${money2(targetOf())}; bisher gespart ${money2(savedOf())}.`,
      );
    }
    this.updatePending((pending) => ({
      ...pending,
      played: true,
      dream: { ...pending.dream, applied },
    }));
    state.transactionsUpdated$.next();
    this.persistAll('cashflow_dream_moment', { moment }, callbacks, { quiet: true });
  }

  /** The swap offers dreams of the same tier as the one that goes. */
  private drawSwapOffers(project: Smile, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const old = this.dreamCards.find((card) => card.id === project.dreamCardId);
    const taken = new Set([
      ...this.dreamLog.open.map((d) => d.cardId),
      ...this.dreamLog.lived.map((d) => d.cardId),
    ]);
    const pool = this.dreamCards.filter((card) => card.tier === old?.tier && !taken.has(card.id));
    const offers = pool
      .sort(() => this.rng() - 0.5)
      .slice(0, 2)
      .map((card) => card.id);
    this.updatePending((pending) => ({
      ...pending,
      dream: { ...pending.dream, offers, moment: undefined, swapping: project.title },
    }));
    this.persistAll('cashflow_dream_swap', { offers }, callbacks, { quiet: true });
    void game;
  }

  /** A dream whose buckets are all full is lived: it is settled, earns its points and leaves its running costs and car. */
  liveDream(projectTitle: string, callbacks: CashflowGameCallbacks): void {
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    const entry = this.openDreams.find((candidate) => candidate.project.title === projectTitle);
    if (!entry || !dreamReady(entry.project.buckets)) {
      callbacks.onError(this.translate.instant('CashflowGame.dream.notReady'));
      return;
    }
    const { card, project } = entry;
    const lang = this.emergencyLang;
    this.pushUndoSnapshot({
      kind: 'dreamLived',
      detail: card.title[lang],
      cardId: card.id,
      deck: 'dream',
    });
    for (const bucket of project.buckets) {
      settleBucketTransactions(state.allTransactions, {
        projectTitle,
        bucket: { title: bucket.title, amount: Number(bucket.amount) },
        actual: Number(bucket.target),
        account: 'Smile',
        date: this.gameDay,
        time: '',
      });
    }
    project.phase = 'completed';
    project.completionDate = this.gameDay;
    project.updatedAt = new Date().toISOString();
    const points = livedPoints(card);
    const titles = [...game.gameSubscriptionTitles];
    if (card.monthlyAfterMinor) {
      const title = `${card.title[lang]} · ${lang === 'de' ? 'laufende Kosten' : 'running costs'}`;
      state.allSubscriptions.push({
        title,
        account: 'Daily',
        amount: -fromMinorUnits(card.monthlyAfterMinor),
        startDate: game.virtualDate ?? this.gameDay,
        endDate: '',
        category: `@${title}`,
        comment: '#dreamfund',
        frequency: 'monthly',
        locationId: GAME_BANK_LOCATION_ID,
      });
      titles.push(title);
    }
    const log = this.dreamLog;
    state.cashflowGame = {
      ...game,
      gameSubscriptionTitles: titles,
      dreams: {
        ...log,
        open: log.open.filter((open) => open.projectTitle !== projectTitle),
        lived: [...log.lived, { cardId: card.id, points, round: game.round }],
      },
      ...(card.carAfter && game.life
        ? {
            life: { ...game.life, car: true },
            possessions: [...(game.possessions ?? []).filter((item) => item !== 'car'), 'car'],
          }
        : {}),
    };
    state.transactionsUpdated$.next();
    this.persistAll('cashflow_dream_live', { card: card.id, points }, callbacks, {
      includeSubscriptions: true,
      quiet: true,
    });
  }

  // ── Solo mode: the token walks the rat-race ring (todo/cashflow-game-pro.md, Phase C) ──────────────

  /** The track the token walks: the map of a Dreamfund game (shape, size, seed), or the classic ring. */
  get board(): RatRaceBoard {
    const setup = AppStateService.instance.cashflowGame.boardSetup;
    return setup ? buildDreamfundBoard(setup).board : CLASSIC_RAT_RACE_BOARD;
  }

  /** Where the tiles of a Dreamfund map stand, for the picture; null on the classic ring. */
  get boardMap(): DreamfundBoard | null {
    const setup = AppStateService.instance.cashflowGame.boardSetup;
    return setup ? buildDreamfundBoard(setup) : null;
  }

  /** Whether the running game is a solo game. */
  get isSolo(): boolean {
    return AppStateService.instance.cashflowGame.mode === 'solo';
  }

  /** Where the solo turn stands: waiting for a roll, a card to deal with, or over. */
  get soloTurn() {
    return currentTurn(AppStateService.instance.cashflowGame);
  }

  /** Why no roll can be made right now (null when one can). */
  get cannotRollBecause(): string | null {
    const reason = whyCannotRoll(AppStateService.instance.cashflowGame);
    if (reason) return reason;
    // an emergency has to be paid (or planned) before the game goes on, where the rules say so
    if (this.unsettledEmergencies.length > 0) return 'EMERGENCY_UNSETTLED';
    // a payment a card asked for is made before the game goes on (not in the free game, which is for trying things)
    if (this.paymentsDue.length > 0 && this.customRules && this.customRules.mode !== 'free') {
      return 'PAYMENT_DUE';
    }
    return null;
  }

  /** The payments cards asked for that have not been made yet (they are paid in the Add dialog). */
  get paymentsDue(): PaymentDue[] {
    return paymentsDueOf(AppStateService.instance.cashflowGame);
  }

  /** How a finished solo game ended, with the closing numbers. */
  soloSummary(): FinalSummary {
    return finalSummary(this.gameBooks());
  }

  /**
   * Works out one solo turn - the dice, the move, everything the landing does - **without changing anything**: the screen
   * plays its animation first and applies the turn once the totem has settled (JFK, 2026-10-06: nothing may show before
   * the totem is on its tile). The dice are the engine's (this service's `rng`).
   */
  planTurn(dice: DiceCount, callbacks: CashflowGameCallbacks): TurnResult | null {
    const profession = this.currentProfession();
    if (!profession) {
      callbacks.onError(this.translate.instant('CashflowGame.errorPickProfession'));
      return null;
    }
    try {
      return playTurn(
        this.gameBooks(),
        { ...this.cardDeps, board: this.board, profession, rng: this.rng },
        { dice },
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not roll.'));
      return null;
    }
  }

  /**
   * Applies a planned turn: **one** undo step, the effects in order, persisted. Call it once the animation has settled,
   * and only with a turn planned against the books as they still are.
   */
  commitTurn(result: TurnResult, callbacks: CashflowGameCallbacks): void {
    this.pushUndoSnapshot(result.step);
    // a roll that passes a Payday space runs the Payday: it plans the budget like the Payday button does
    const planBefore = AppStateService.instance.cashflowGame.budgetPlan;
    const paydays: GameEffects[] = [];
    let round = AppStateService.instance.cashflowGame.round;
    for (const effects of result.effects) {
      this.applyGameEffects(effects);
      // only a Payday advances the round (the turn's effects carry no step of their own)
      if (effects.state.round > round) {
        round = effects.state.round;
        paydays.push(effects);
      }
    }
    const budgetPlanned = this.planPaydays(planBefore, paydays);
    // an automatic bank loan (Charity or Downsized with too little cash) writes the Bank loan liability too
    this.persistAll('cashflow_roll', { total: result.roll.total, to: result.move.to }, callbacks, {
      includeBudget: budgetPlanned,
      includeSubscriptions: true,
      includeBalanceSheet: true,
      includeGrow: true,
      // the screen does not grey out when the totem lands: the game blocks its own buttons while it saves (JFK, 2026-10-07)
      quiet: true,
    });
    if (result.effects.some((effects) => effects.decisionNeeded)) this.decisionNeeded$.next();
  }

  /** One solo turn at once: plan it and apply it (no animation in between). */
  rollTurn(dice: DiceCount, callbacks: CashflowGameCallbacks): TurnResult | null {
    const result = this.planTurn(dice, callbacks);
    if (result) this.commitTurn(result, callbacks);
    return result;
  }

  /**
   * Closes the open card decision of a solo turn: `done` once the card was dealt with, `passed` to leave it (a step of
   * its own, so Undo brings the card back). Dealing with the card may have won the game, so the books are checked.
   */
  /**
   * The solo game ends the moment the books say so (JFK, 2026-10-06: "I escaped the rat race and then I needed to dice one
   * more time to finish the game") - not only at the next roll or when a card is settled, but whenever the transactions
   * or subscriptions change: a purchase made in the Add dialog, a sale, a loan, a payoff. Returns whether it ended now.
   * No undo step of its own: Undo of the move that caused it restores the game as it was, still being played.
   */
  endSoloGameIfOver(): boolean {
    // at a table the server ends the game; these are the table's books, never to be saved to the account
    if (RemoteGameHook.current) return false;
    const state = AppStateService.instance;
    const game = state.cashflowGame;
    if (game.mode !== 'solo' || !game.professionId || game.turn?.phase === 'over') return false;
    const next = endIfOver(game, this.gameBooks().subscriptions);
    if (next === game) return false;
    state.cashflowGame = next;
    this.gameEnded$.next();
    this.persistAll(
      'cashflow_game_end',
      { outcome: next.turn?.outcome },
      { onSuccess: () => undefined, onError: () => undefined },
    );
    return true;
  }

  settleSoloDecision(
    how: 'done' | 'passed',
    callbacks: CashflowGameCallbacks,
    options: { paid?: boolean } = {},
  ): void {
    let settled: ReturnType<typeof settleDecisionRule>;
    // the die of a bought card is the player's to throw before the turn goes on
    if (AppStateService.instance.cashflowGame.turn?.pending?.opportunity?.rollFor) {
      callbacks.onError('Throw the die of your purchase first.');
      return;
    }
    const refusal = options.paid
      ? null
      : whyCannotSkipCard(
          CashflowGameService.effectiveGame(AppStateService.instance.cashflowGame),
          how,
        );
    if (refusal) {
      callbacks.onError(CashflowGameService.ruleText(refusal));
      return;
    }
    try {
      settled = settleDecisionRule(
        AppStateService.instance.cashflowGame,
        how,
        this.gameBooks().subscriptions,
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Nothing to settle.'));
      return;
    }
    if (settled.step) this.pushUndoSnapshot(settled.step);
    // the card's chance to be bought is over: an unbought plan leaves the plan phase (JFK, 2026-10-18)
    const closing = closePlanOfSettledCardRule(this.gameBooks());
    if (closing) this.applyGameEffects(closing);
    // a planned Opportunity card has one turn less to be bought; one whose time is up is a chance missed (JFK, 2026-10-26)
    const missed = AppStateService.instance.cashflowGame.opportunityPlans?.length
      ? closeOpportunityPlans(this.gameBooks(), this.emergencyLang, this.gameDay)
      : null;
    if (missed) {
      this.applyGameEffects(missed);
      settled = {
        ...settled,
        state: { ...settled.state, opportunityPlans: missed.state.opportunityPlans },
      };
    }
    AppStateService.instance.cashflowGame = settled.state;
    this.persistAll(
      'cashflow_decision',
      { how },
      callbacks,
      closing || missed ? { quiet: true, includeGrow: true } : { quiet: true },
    );
  }

  /** Resolves a Baby space: +1 child (max 3), scales the children-expense Subscription. */
  resolveBaby(callbacks: CashflowGameCallbacks): void {
    const profession = this.currentProfession();
    if (!profession) {
      callbacks.onError(this.translate.instant('CashflowGame.errorPickProfession'));
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

  /**
   * A space that pays cash. The balance never goes negative (JFK, 2026-10-06): when cash is short the Bank loan is taken
   * first - its own undo step, like a deal's - and then the payment is made.
   */
  private resolvePayingSpace(
    pay: (books: GameBooks) => PaidWithLoan,
    logEvent: string,
    failure: string,
    callbacks: CashflowGameCallbacks,
  ): void {
    let paid: PaidWithLoan;
    try {
      paid = pay(this.gameBooks());
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, failure));
      return;
    }
    for (const effects of paid.effects) {
      this.pushUndoSnapshot(effects.step as CashflowStepInfo);
      this.applyGameEffects(effects);
    }
    const borrowedMinor = paid.loansMinor.reduce((sum, loan) => sum + loan, 0);
    if (borrowedMinor > 0) callbacks.onLoan?.(borrowedMinor);
    this.persistAll(
      logEvent,
      {},
      callbacks,
      borrowedMinor > 0 ? { includeSubscriptions: true, includeBalanceSheet: true } : {},
    );
  }

  /** Resolves a Charity space: pays 10% of total income now (borrowing first when cash is short), unlocks the dice choice for 3 turns. */
  resolveCharity(callbacks: CashflowGameCallbacks): void {
    this.resolvePayingSpace(
      (books) => playCharityPaying(books, this.cardDeps),
      'cashflow_charity',
      'Could not resolve Charity.',
      callbacks,
    );
  }

  /** Resolves a Downsized space: pays total expenses once (borrowing first when cash is short) and shows the sitting-out reminder (ends an active charity bonus). */
  resolveDownsized(callbacks: CashflowGameCallbacks): void {
    this.resolvePayingSpace(
      (books) => playDownsizedPaying(books, this.cardDeps),
      'cashflow_downsized',
      'Could not resolve Downsized.',
      callbacks,
    );
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
      allocation: {
        daily: state.daily,
        splurge: state.splurge,
        smile: state.smile,
        fire: state.fire,
      },
      subscriptions: state.allSubscriptions.map(toBookSubscription),
      transactions: state.allTransactions.map((transaction) => ({
        account: transaction.account,
        amountMinor: toMinorUnits(transaction.amount),
        date: transaction.date,
        comment: transaction.comment,
      })),
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
    // what the payment plans of the next Payday take leaves the month too (JFK, 2026-10-26)
    return fromMinorUnits(
      summarizeGameFinances(state.cashflowGame, this.gameSubscriptions()).cashflowAfterPlansMinor,
    );
  }

  /** The cashflow without the payment plans: the one that decides bankruptcy. */
  get baseCashflow(): number {
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
  private runPlanDeal(
    input: DealInput,
    callbacks: CashflowGameCallbacks,
    options: { fromCard?: boolean } = {},
  ): void {
    let effects: GameEffects;
    try {
      effects = planDealRule(this.gameBooks(), input, this.dealDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not plan this deal.'));
      return;
    }
    this.pushUndoSnapshot(effects.step as CashflowStepInfo);
    this.applyGameEffects(effects);
    if (options.fromCard) {
      this.markCardPlayed();
      // the card in hand is now the project it became (EFH-II when EFH was taken): that is what Buy is matched on
      this.holdProject(input.title);
    }
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

  /** What paying `tag` off in one payment would do (the Bank loan it needs, the cashflow after it) and whether it is allowed. */
  payoffPlan(tag: string): PayoffPlan {
    return planLiabilityPayoffRule(this.gameBooks(), this.currentProfession(), tag, this.dealDeps);
  }

  /**
   * Pays a liability off in ONE payment of the full amount (JFK, 2026-10-19): the debt and its monthly expense end, one Undo step.
   * Short of cash the Bank loan is taken first; refused when that would leave the monthly cashflow negative (`payoffPlan` says why).
   * Solo games only - at a table the move goes to the server.
   */
  payOffLiability(tag: string, callbacks: CashflowGameCallbacks): void {
    let steps: GameEffects[];
    try {
      steps = payOffLiabilityRule(this.gameBooks(), this.currentProfession(), tag, this.dealDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not pay this off.'));
      return;
    }
    this.pushUndoSnapshot({ kind: 'payoff', detail: tag });
    for (const effects of steps) this.applyGameEffects(effects);
    this.persistAll('cashflow_liability_payoff', { tag }, callbacks, {
      includeSubscriptions: true,
      includeBalanceSheet: true,
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
    this.markPurchased();
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

  /** Fires when the game has just ended (escaped or bankrupt) by a move: the game panel opens on the result (JFK, 2026-10-18). */
  readonly gameEnded$ = new Subject<void>();

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
    return rollDieRule(this.rng);
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
    if (outcome.roll === undefined) {
      const reported = whyCannotReportRoll(AppStateService.instance.cashflowGame);
      if (reported) {
        callbacks.onError(CashflowGameService.ruleText(reported));
        return;
      }
    }
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
    const refusedCard = this.cardRefusal(card.id);
    if (refusedCard) {
      callbacks.onError(refusedCard);
      return;
    }
    let result: ReturnType<typeof playMarketBuyerCard>;
    try {
      result = playMarketBuyerCard(this.cardBooks(), card, options, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not play this market card.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    this.markCardPlayed();
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
    const refusedCard = this.cardRefusal(card.id);
    if (refusedCard) {
      callbacks.onError(refusedCard);
      return;
    }
    let result: ReturnType<typeof updateSharePrice>;
    try {
      result = updateSharePrice(this.cardBooks(), card, text, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not update the share price.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    this.markCardPlayed();
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
    const refusedCard = this.cardRefusal(card.id);
    if (refusedCard) {
      callbacks.onError(refusedCard);
      return;
    }
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
    this.markCardPlayed();
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
    const refusedCard = this.cardRefusal(card.id);
    if (refusedCard) {
      callbacks.onError(refusedCard);
      return;
    }
    let result: ReturnType<typeof playBoostCard>;
    try {
      result = playBoostCard(this.cardBooks(), card, options, this.cardDeps);
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not play this market card.'));
      return;
    }
    this.pushUndoSnapshot(result.effects.step as CashflowStepInfo);
    this.applyGameEffects(result.effects);
    this.markCardPlayed();
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
  /** The property a Market cost card is booked on (the first one the player owns that the card names), or null: nothing is changed. */
  marketCostProperty(card: CashflowMarketCard, types: { labels: string[] }[]): string | null {
    try {
      return playMarketCostCard(this.cardBooks(), card, { types }).property;
    } catch {
      return null;
    }
  }

  playMarketCostCard(
    card: CashflowMarketCard,
    options: { title?: string; types: { labels: string[] }[] },
    callbacks: { onSuccess: (property: string | null) => void; onError: (message: string) => void },
  ): void {
    const refusedCard = this.cardRefusal(card.id);
    if (refusedCard) {
      callbacks.onError(refusedCard);
      return;
    }
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
    const sale = marketSaleFor(
      CashflowGameService.askingState(books.state),
      books.investments,
      title,
    );
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
      callbacks.onError(this.translate.instant('CashflowGame.errorNotGameAccount'));
      return;
    }
    // A reset ends the game, history included - there is nothing to undo back into (JFK, 2026-10-03).
    this.clearPersistedUndoStack();
    this.persistUndoStack(); // the account's history is emptied too
    const state = AppStateService.instance;
    const blank = blankGameData();
    state.allTransactions = blank.allTransactions as Transaction[];
    state.allSubscriptions = blank.allSubscriptions as Subscription[];
    state.allGrowProjects = blank.allGrowProjects as Grow[];
    state.allShares = blank.allShares as Share[];
    state.allInvestments = blank.allInvestments as Investment[];
    state.allAssets = blank.allAssets as Asset[];
    state.liabilities = blank.liabilities as unknown as Liability[];
    state.allSmileProjects = blank.allSmileProjects as Smile[];
    state.allFireEmergencies = blank.allFireEmergencies as Fire[];
    state.mojo = blank.mojo as Mojo;
    const planOfThisGame = state.cashflowGame.budgetPlan ?? [];
    state.cashflowGame = blank.cashflowGame;
    // the game's money is gone with its bookings; the location stays (the player's own ones are untouched)
    const bank = state.allLocations?.find((location) => location.id === GAME_BANK_LOCATION_ID);
    if (bank) bank.amount = 0;
    // and so is its plan: the rows the game made go, what the player planned stays
    if (state.tier2Loaded) {
      state.allBudgets = applyPlanChange(
        (state.allBudgets ?? []).filter((b) => !b.game),
        planOfThisGame,
        [],
      );
    }

    this.persistAll('cashflow_reset', {}, callbacks, {
      includeBudget: state.tier2Loaded,
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

  /** The game rules (free for a game without any). */
  get rules(): GameRules {
    return rulesOf(AppStateService.instance.cashflowGame);
  }

  /** Why the rules forbid playing this card now (an open dice decision comes first; under offered-once only the offered card), or null. */
  cardRefusal(cardId: string): string | null {
    const game = AppStateService.instance.cashflowGame;
    return CashflowGameService.ruleTextOrNull(
      whyDiceFirst(game) ??
        whyCardAlreadyPlayed(CashflowGameService.effectiveGame(game), cardId) ??
        whyCannotUseCard(game, cardId),
    );
  }

  /** Why the open dice decision must be rolled before a card is picked (rules: dice first), or null. */
  get diceFirstRefusal(): string | null {
    return CashflowGameService.ruleTextOrNull(whyDiceFirst(AppStateService.instance.cashflowGame));
  }

  /** Marks the card of the open space as played: it can be looked at and ticked off, not passed any more. */
  private markCardPlayed(): void {
    const game = AppStateService.instance.cashflowGame;
    const pending = game.turn?.pending;
    if (!game.turn || !pending || pending.played) return;
    AppStateService.instance.cashflowGame = {
      ...game,
      turn: { ...game.turn, pending: { ...pending, played: true } },
    };
  }

  /**
   * The card in hand was dealt with without becoming a project - sold to a friend or declined: it counts as played, so it can be
   * read again but not used or passed (JFK, 2026-10-10).
   */
  private markCardClosed(): void {
    this.markCardPlayed();
    const game = AppStateService.instance.cashflowGame;
    const pending = game.turn?.pending;
    if (!game.turn || !pending || pending.closed) return;
    AppStateService.instance.cashflowGame = {
      ...game,
      turn: { ...game.turn, pending: { ...pending, closed: true } },
    };
  }

  /** Declining the card in hand uses it up: afterwards it is only read. */
  declineCard(callbacks: CashflowGameCallbacks): void {
    this.markCardClosed();
    this.persistAll('cashflow_card_declined', {}, callbacks, { quiet: true });
  }

  /** The card of this space has bought its property or asset: it buys once, the Buy button is gone. */
  private markPurchased(): void {
    const game = AppStateService.instance.cashflowGame;
    const pending = game.turn?.pending;
    if (!game.turn || !pending || pending.purchased) return;
    AppStateService.instance.cashflowGame = {
      ...game,
      turn: { ...game.turn, pending: { ...pending, purchased: true } },
    };
  }

  /**
   * The Grow project the card in hand became on the open space, or null when it was not planned - or when the project has
   * been deleted since, which gives the card its buttons back. Its title is the key the plan took (EFH-II, APT-IV ...),
   * remembered when the card was planned.
   */
  /**
   * Whether the card open on screen has been played on this space - and so is only to be read now, every action button gone
   * (JFK, 2026-10-10). A Deal card counts as played only while its project exists.
   */
  static isPlayedCard(cardId: string): boolean {
    const pending = AppStateService.instance.cashflowGame.turn?.pending;
    if (!pending?.played || pending.offered?.cardId !== cardId) return false;
    // A payment that has to be made is never only read: under the pay rule it settles the space when it is booked, so a
    // payment still open here is not one that was made (a game stored with a wrong 'played' mark must not get stuck).
    if (
      rulesOf(AppStateService.instance.cashflowGame).passDoodads === 'forbidden' &&
      (pending.kind === 'doodad' || pending.paymentDue)
    ) {
      return false;
    }
    return (
      pending.kind !== 'deal' ||
      !!pending.closed ||
      CashflowGameService.heldProjectFor(cardId) !== null
    );
  }

  static heldProjectFor(cardId: string): Grow | null {
    const pending = AppStateService.instance.cashflowGame.turn?.pending;
    const title = pending?.offered?.title;
    if (!pending?.played || pending.offered?.cardId !== cardId || !title) return null;
    return (
      AppStateService.instance.allGrowProjects.find((project) => project.title === title) ?? null
    );
  }

  /**
   * The game as the rules should read it: a Deal card counts as played only while the project it became exists - delete the
   * project and the card can be planned, sold or declined again (JFK, 2026-10-10).
   */
  static effectiveGame(game: CashflowGameState): CashflowGameState {
    const pending = game.turn?.pending;
    if (
      !game.turn ||
      !pending?.played ||
      pending.closed ||
      pending.kind !== 'deal' ||
      !pending.offered?.title
    ) {
      return game;
    }
    const exists = AppStateService.instance.allGrowProjects.some(
      (project) => project.title === pending.offered?.title,
    );
    return exists
      ? game
      : { ...game, turn: { ...game.turn, pending: { ...pending, played: false } } };
  }

  /** Names the project the card in hand became: the Buy button and the buy rule look for that title. */
  private holdProject(title: string): void {
    const game = AppStateService.instance.cashflowGame;
    const offered = game.turn?.pending?.offered;
    if (!game.turn?.pending || !offered) return;
    AppStateService.instance.cashflowGame = {
      ...game,
      turn: { ...game.turn, pending: { ...game.turn.pending, offered: { ...offered, title } } },
    };
  }

  /** The card picked on the open space, whatever the rules - opening the space again goes straight to it. */
  get pickedCard(): { deck: CashflowDeckKind; cardId: string } | undefined {
    return AppStateService.instance.cashflowGame.turn?.pending?.offered;
  }

  /** Why the rules forbid selling `title` now (a game without rules never does), or null. */
  sellRefusal(title: string): string | null {
    return CashflowGameService.sellRefusalFor(title);
  }

  /** The same without an instance, for the templates that decide whether to show a Sell button. */
  /**
   * At a table a buyer's offer stays open until the player's next roll, also off their own turn: a question about selling is asked as
   * if they were still deciding (as the table itself does), or the Sell button would be missing exactly when somebody else drew the
   * card that makes selling possible.
   */
  static askingState<T extends { turn?: { phase: string } | undefined }>(state: T): T {
    return RemoteGameHook.current && state.turn?.phase === 'roll'
      ? { ...state, turn: { ...state.turn, phase: 'decide' } }
      : state;
  }

  static sellRefusalFor(title: string): string | null {
    const game = CashflowGameService.askingState(AppStateService.instance.cashflowGame);
    return CashflowGameService.isCashflowGame() && game.professionId
      ? CashflowGameService.ruleTextOrNull(whyCannotSell(game, title))
      : null;
  }

  /** Why the rules forbid adding a free-form transaction of this size (minor units), or null. */
  freeAmountRefusal(amountMinor: number): string | null {
    const game = AppStateService.instance.cashflowGame;
    return game.professionId
      ? CashflowGameService.ruleTextOrNull(whyCannotAddFreeAmount(game, amountMinor))
      : null;
  }

  /**
   * What the game rules say about a transaction made in the Add dialog, or null when it is fine: a trade the game knows
   * (Buy / Sell Share, Property, Asset, a Doodad, a Market cost, a payback) is judged as that trade - a sale needs an
   * offer where the rules ask for one - and a plain transaction is a free amount (forbidden, or capped).
   */
  addDialogRefusal(
    comment: string,
    category: string,
    amountMinor: number,
    signedAmount = 0,
  ): string | null {
    const game = AppStateService.instance.cashflowGame;
    if (!CashflowGameService.isCashflowGame() || !game.professionId) return null;
    const step = gameTradeStep(comment, category);
    // While a Doodad has to be paid, only its payment is booked (a Bank loan is not an Add-dialog trade)
    const waiting = whyPaymentPending(game);
    if (
      waiting &&
      step.kind !== 'doodad' &&
      step.kind !== 'marketCost' &&
      step.kind !== 'cardPayment'
    )
      return CashflowGameService.ruleText(waiting);
    if (step.kind === 'transaction') {
      // paying into a project of the game (a Fire emergency, a dream) or into the reserve is not a free amount: it is how the card is
      // paid (JFK, 2026-10-26)
      if (this.paysGameProject(category) || /#bucket:|#settle:/.test(comment)) {
        // under strict rules money goes into a project or the Mojo, never out of it by hand (JFK, 2026-10-26: +9999 left the Mojo at -101 %)
        if (signedAmount > 0 && this.customRules?.mode === 'strict') {
          return this.translate.instant('CashflowGame.pay.onlyPay');
        }
        return null;
      }
      return this.freeAmountRefusal(amountMinor);
    }
    if (['sellShare', 'sellInvestment', 'sellAsset'].includes(step.kind) && step.detail) {
      // what the Opportunity cards made is sold on the Harvest cards: in a window, to a buyer, or on a hype
      const owned = (game.holdings ?? []).some(
        (holding) => !holding.ended && holding.title === step.detail,
      );
      if (owned && this.customRules)
        return this.translate.instant('CashflowGame.harvest.sellOnCard');
      return this.sellRefusal(step.detail);
    }
    if (['buyShare', 'buyInvestment', 'buyAsset'].includes(step.kind) && step.detail) {
      return CashflowGameService.buyRefusalFor(
        step.detail,
        step.kind === 'buyInvestment' ? 'property' : step.kind === 'buyAsset' ? 'asset' : 'share',
      );
    }
    return null;
  }

  /**
   * What a payment into the Mojo or a project really takes: no more than is missing there (the rest is never booked, so the Bank loan is
   * not worked out from what was typed - JFK, 2026-10-26: a loan of 44,000 for a payment of 10,209).
   */
  paidIntoProject(category: string, comment: string, amount: number): number {
    if (!(amount > 0) || /#bucket:|#settle:/.test(comment)) return amount;
    const wanted = category.replace(/^@/, '').trim().toLowerCase();
    const state = AppStateService.instance;
    if (wanted === 'mojo') {
      const room = Math.max(0, Number(state.mojo.target) - Number(state.mojo.amount));
      return Math.min(amount, Math.round(room * 100) / 100);
    }
    const project = [...state.allFireEmergencies, ...state.allSmileProjects].find(
      (candidate) => candidate.title.toLowerCase() === wanted,
    );
    if (!project) return amount;
    const room = project.buckets.reduce(
      (sum, bucket) => sum + Math.max(0, Number(bucket.target) - Number(bucket.amount)),
      0,
    );
    return Math.min(amount, Math.round(room * 100) / 100);
  }

  /** Whether a category is a Smile or Fire project of the game, or the Mojo (the reserve). */
  private paysGameProject(category: string): boolean {
    const wanted = category.replace(/^@/, '').trim().toLowerCase();
    if (!wanted) return false;
    if (wanted === 'mojo') return true;
    const state = AppStateService.instance;
    return [...state.allFireEmergencies, ...state.allSmileProjects].some(
      (project) => project.title.toLowerCase() === wanted,
    );
  }

  /** Whether the app may report a roll made with a real die (`reportRolls`). */
  get reportRollsForbidden(): boolean {
    return whyCannotReportRoll(AppStateService.instance.cashflowGame) !== null;
  }

  /**
   * Why `title` cannot be bought now, or null: a property that is owned is not bought a second time, and where the rules say
   * so a purchase needs the card in hand (or a price card of the share).
   */
  static buyRefusalFor(
    title: string,
    kind: 'property' | 'asset' | 'share' = 'share',
  ): string | null {
    // what was planned from an Opportunity card is bought in Grow whatever the classic rules say of cards in hand - for as many
    // turns as the setting says (1: only in the turn the card is in hand); after that the chance is gone (JFK, 2026-10-26)
    const planned = AppStateService.instance.cashflowGame.opportunityPlans ?? [];
    if (planned.some((plan) => plan.title === title)) return null;
    const instance = CashflowGameService.current;
    if (
      instance?.opportunityCards.some(
        (card) => projectTitleOf(card, instance.emergencyLang) === title,
      )
    ) {
      return instance.translate.instant('CashflowGame.opportunity.chanceGone');
    }
    const isProperty = kind === 'property';
    // At a table only the card in hand can be bought: a stock price card somebody else drew lets the holder SELL at that price, never
    // buy (JFK, 2026-10-19) - so its offer is not looked at for a purchase (the Buy button is hidden, the table refuses it anyway).
    // The card I drew myself is the exception (JFK, 2026-10-25): its price is mine to buy at as well as to sell at.
    const state = AppStateService.instance.cashflowGame;
    const drawn = state.turn?.pending?.offered?.cardId;
    const game = RemoteGameHook.current
      ? {
          ...state,
          marketOffers: (state.marketOffers ?? []).filter(
            (offer) => !!drawn && offer.cardId === drawn,
          ),
        }
      : state;
    if (!CashflowGameService.isCashflowGame() || !game.professionId) return null;
    // Owned: in the balance sheet - which is only there once the balance data has been loaded - or, as it is always loaded
    // with the Grow projects, a project that has been bought (phase execute / monitor) and not sold since.
    const project = AppStateService.instance.allGrowProjects.find(
      (candidate) => candidate.title === title,
    );
    const owned =
      AppStateService.instance.allInvestments.some((position) => position.tag === title) ||
      (!!project && ['execute', 'monitor'].includes(project.phase));
    if (kind !== 'share') {
      const bought = whyCardAlreadyBought(game);
      if (bought) return CashflowGameService.ruleText(bought);
    }
    if (isProperty && owned) {
      return CashflowGameService.ruleText(
        'You already own this property: a property is bought once.',
      );
    }
    return CashflowGameService.ruleTextOrNull(
      whyCannotBuy(game, title, game.turn?.pending?.offered?.title),
    );
  }

  /** Why the rules forbid a Bank loan, or null. */
  get loanRefusal(): string | null {
    const game = AppStateService.instance.cashflowGame;
    return game.professionId && this.rules.bankLoan === 'forbidden'
      ? CashflowGameService.ruleText('These game rules do not allow a Bank loan.')
      : null;
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
    options: { labelFor?: (symbol: string) => string | undefined } = {},
  ): void {
    const state = AppStateService.instance;
    const refusedDraw = whyDiceFirst(state.cashflowGame) ?? whyCannotDraw(state.cashflowGame);
    if (refusedDraw) {
      callbacks.onError(CashflowGameService.ruleText(refusedDraw));
      return;
    }
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
        this.rng,
      );
    } catch (err: unknown) {
      callbacks.onError(errorMessage(err, 'Could not draw a card.'));
      return;
    }
    // the pick is a step of its own - the exact card is in the History, so a game can be analysed card by card
    if (state.cashflowGame.professionId) {
      this.pushUndoSnapshot(cardPickedStep(deckKind, result.card));
    }
    const turn = state.cashflowGame.turn;
    // Under 'offered-once' this card is the one offered on the space: nothing else can be played here.
    // A Market cost card for a player who owns a property is a payment that has to be made (the Doodad rule applies).
    const dueCard = result.card as unknown as CashflowMarketCard;
    const paymentDue =
      deckKind === 'market' &&
      !!dueCard.pays &&
      costCardProperty(
        this.cardBooks(),
        propertyCardTypes((symbol) => options.labelFor?.(symbol)),
      ) !== null;
    const offered = turn?.pending
      ? {
          turn: {
            ...turn,
            pending: {
              ...turn.pending,
              ...(paymentDue ? { paymentDue: true } : {}),
              offered: {
                deck: deckKind,
                cardId: result.card.id,
                title: (result.card as { symbol?: string }).symbol ?? result.card.title,
              },
            },
          },
        }
      : {};
    state.cashflowGame = {
      ...state.cashflowGame,
      ...offered,
      drawnCardIds: { ...state.cashflowGame.drawnCardIds, [deckKind]: result.drawnIds },
    };
    // the card shows at once: the draw is already in the game's state, and saving it is not something the player waits for
    callbacks.onSuccess(result.card);
    this.persistence.writeAndSync({
      tag: 'cashflowGame',
      data: state.cashflowGame,
      localStorageKey: 'cashflowGame',
      logEvent: 'cashflow_draw_card',
      logMetadata: { deckKind, cardId: result.card.id },
      onSuccess: () => undefined,
      onError: (error: any) => callbacks.onError(error?.message || 'Database write failed'),
    });
  }

  /**
   * A card found among the physical cards is picked too (the same step as a random draw), so the History knows exactly
   * which card was on the table when it is passed or played. Picking the card that was picked last again adds nothing.
   */
  recordCardPicked(deckKind: CashflowDeckKind, card: { id: string; title: string }): void {
    // in a game played with others the card in hand is the table's (its server names the project the card became)
    if (RemoteGameHook.current) return;
    if (!AppStateService.instance.cashflowGame.professionId) return;
    // The same card is recorded once per turn: the dialog closing after the card was planned or played would otherwise
    // log it a second time, after the step it led to.
    for (let back = this.undoStack.length - 1; back >= 0; back -= 1) {
      const earlier = this.undoStack[back].step;
      if (earlier?.kind === 'roll') break;
      if (earlier?.kind === 'cardPicked' && earlier.cardId === card.id) return;
    }
    this.pushUndoSnapshot(cardPickedStep(deckKind, card));
    // the card in hand on this space: opening the space again goes straight to it
    const game = AppStateService.instance.cashflowGame;
    if (game.turn?.pending) {
      AppStateService.instance.cashflowGame = {
        ...game,
        turn: {
          ...game.turn,
          pending: {
            ...game.turn.pending,
            offered: {
              deck: deckKind,
              cardId: card.id,
              title: (card as { symbol?: string }).symbol ?? card.title,
            },
          },
        },
      };
    }
  }

  /** Plans a drawn/found Deal card exactly as `planDeal` would from the manual form — its numbers, not re-typed. */
  applyDealCard(
    card: CashflowDealCard,
    callbacks: { onSuccess: (plannedTitle: string) => void; onError: (message: string) => void },
    text: CashflowCardPlanText = {},
  ): void {
    const refusedCard = this.cardRefusal(card.id);
    if (refusedCard) {
      callbacks.onError(refusedCard);
      return;
    }
    const input = dealInputFromCard(card, text, takenDealLabels(this.gameBooks()));
    this.runPlanDeal(
      input,
      {
        onSuccess: () => callbacks.onSuccess(input.title),
        onError: callbacks.onError,
      },
      { fromCard: true },
    );
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
    this.markCardClosed();
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
    const details = update.details;
    if (details) {
      if (details.type) project.type = details.type as Grow['type'];
      if (details.category !== undefined) project.category = details.category;
      if (details.pattern !== undefined) project.pattern = details.pattern;
      if (details.reasoning !== undefined) project.reasoning = details.reasoning;
      if (details.risks !== undefined) project.risks = details.risks;
      if (details.riskScore !== undefined) project.riskScore = details.riskScore;
      if (details.insights !== undefined) project.insights = details.insights;
      if (details.alternative !== undefined) project.alternative = details.alternative;
      if (details.alternativeCostMinor !== undefined) {
        project.alternativeCost = fromMinorUnits(details.alternativeCostMinor);
      }
      if (details.links) project.links = details.links.map((link) => ({ ...link }));
      if (details.actionItems) {
        project.actionItems = details.actionItems.map((item) => ({ ...item, done: false }));
      }
      if (details.currentCostMinor !== undefined) {
        project.currentCost = fromMinorUnits(details.currentCostMinor);
      }
      if (details.targetCostMinor !== undefined) {
        project.targetCost = fromMinorUnits(details.targetCostMinor);
      }
      if (details.monthlySavingsMinor !== undefined) {
        project.monthlySavings = fromMinorUnits(details.monthlySavingsMinor);
      }
      if (details.annualSavingsMinor !== undefined) {
        project.annualSavings = fromMinorUnits(details.annualSavingsMinor);
      }
    }
  }

  private currentGameSet(): CashflowGameSet | undefined {
    const { gameSetId } = AppStateService.instance.cashflowGame;
    const set = gameSetId
      ? this.gameSets.find((candidate) => candidate.id === gameSetId)
      : undefined;
    const custom = set ? this.customRules : null;
    if (!set || !custom || set.loanRule.monthlyInterestPercent === custom.bankInterestPercent) {
      return set;
    }
    // the Bank loan of a custom game costs what its setting says
    return {
      ...set,
      loanRule: { ...set.loanRule, monthlyInterestPercent: custom.bankInterestPercent },
    };
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

  /**
   * What the funding plans may still take of the month, in the game's money (null outside a game): the monthly cashflow minus what
   * the running plans pay. `except` is the plan being changed.
   */
  static fundingRoom(except?: string): number | null {
    const state = AppStateService.instance;
    if (!CashflowGameService.isCashflowGame() || !state.cashflowGame.professionId) return null;
    return fromMinorUnits(
      fundingRoomMinor(
        state.cashflowGame,
        state.allSubscriptions.map((sub) => ({
          title: sub.title,
          amountMinor: toMinorUnits(sub.amount),
          endDate: sub.endDate,
        })),
        except,
      ),
    );
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
      includeBudget?: boolean;
      /** Save without the page-wide saving overlay (the caller already blocks its own buttons). */
      quiet?: boolean;
    } = {},
  ): void {
    const state = AppStateService.instance;
    this.repairGameProjects();
    this.refreshReserveTarget();
    this.incomeStatement.recalculate();
    // a payment plan whose buckets are full (or that has run out) is finished: its subscription ends
    const day = state.cashflowGame.virtualDate;
    if (
      day &&
      state.cashflowGame.professionId &&
      syncPaymentPlans(
        [...state.allSmileProjects, ...state.allFireEmergencies],
        state.allSubscriptions,
        day,
      )
    ) {
      options = { ...options, includeSubscriptions: true };
    }
    if (!options.quiet) state.isSaving = true;
    if (this.refreshCurrentMonthPlan()) options = { ...options, includeBudget: true };

    const writes: { tag: string; data: unknown }[] = [
      { tag: 'transactions', data: state.allTransactions },
      { tag: 'cashflowGame', data: state.cashflowGame },
      { tag: 'locations', data: state.allLocations },
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
      ...(options.includeBudget ? [{ tag: 'budget', data: state.allBudgets }] : []),
    ];
    const localStorageSaves: { key: string; data: unknown }[] = [
      { key: 'transactions', data: state.allTransactions },
      { key: 'cashflowGame', data: state.cashflowGame },
      { key: 'locations', data: state.allLocations },
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
      ...(options.includeBudget ? [{ key: 'budget', data: state.allBudgets }] : []),
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
  return err instanceof Error ? CashflowGameService.ruleText(err.message) : fallback;
}
