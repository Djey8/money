/**
 * The Cashflow game engine: pure functions over `CashflowGameState` plus
 * plain descriptions of the real entities to create/update/remove — this
 * module never touches Angular state itself, the frontend's
 * `CashflowGameService` applies its output to `AppStateService`. See
 * todo/cashflow-game.md.
 */
import {
  CashflowGameSet,
  CashflowGameState,
  CashflowProfession,
  CashflowStarterKit,
  CashflowStarterKitSubscription,
  CashflowTransactionRecord,
  initialCashflowGameState,
} from './types';
import { findCashflowGameSet, findCashflowProfession } from './game-sets';

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Adds whole months to an ISO date, clamping the day to the target month's length (matches the app's existing month-shift behavior). */
export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const zeroBasedMonth = month - 1 + months;
  const targetYear = year + Math.floor(zeroBasedMonth / 12);
  const targetMonth = ((zeroBasedMonth % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatIsoDate(new Date(targetYear, targetMonth, clampedDay));
}

function requireStarted(state: CashflowGameState, action: string): string {
  if (!state.virtualDate) {
    throw new Error(`Pick a profession before ${action}.`);
  }
  return state.virtualDate;
}

export interface PickProfessionResult {
  state: CashflowGameState;
  profession: CashflowProfession;
  /** One Subscription per `expenses` line (categorized by its own name) plus one for the salary — JFK, 2026-09-26. */
  subscriptions: CashflowStarterKitSubscription[];
  /** Whatever the card's "Verbindlichkeiten"/starting positions add beyond what `subscriptions` covers. */
  starterKit: CashflowStarterKit;
  /**
   * The game's opening transaction(s) — just Savings, posted to `Income` (JFK, 2026-09-29: "when we start the
   * game we only add the transaction for the Savings... then I have time as a user to modify the
   * subscriptions... then I have a button start (current Payday) and that is adding for the first time the
   * transactions"). Salary/Expenses were itemized transactions here too (decision 23), but that's now the first
   * Payday's job, not `pickCashflowProfession`'s — giving the player a window to edit Subscriptions first.
   */
  startingTransactions: CashflowTransactionRecord[];
}

/** Salary minus every `expenses` line — "the current cashflow" the starting-cash rule adds once. */
export function computeCashflowProfessionMonthlyCashflowMinor(
  profession: CashflowProfession,
): number {
  const totalExpensesMinor = profession.expenses.reduce((sum, line) => sum + line.amountMinor, 0);
  return profession.salaryMinor - totalExpensesMinor;
}

/**
 * Starts a new game: resets any previous game state and returns the chosen
 * profession's starter kit for the caller to materialize as real
 * Subscription/Asset/Investment/Share/Liability entities, plus one starting
 * Transaction for the profession's starting cash. Never touches anything the
 * previous game may have created — Phase 1 decides whether picking a new
 * profession mid-game is even allowed; for now this is only meant to run
 * once, from a fresh (or freshly reset) game.
 */
export function pickCashflowProfession(
  gameSets: CashflowGameSet[],
  gameSetId: string,
  professionId: string,
  today: string,
  mode: 'companion' | 'solo' = 'companion',
): PickProfessionResult {
  const gameSet = findCashflowGameSet(gameSets, gameSetId);
  const profession = findCashflowProfession(gameSet, professionId);

  const salarySubscription: CashflowStarterKitSubscription = {
    title: `${profession.title} Salary`,
    account: 'Income',
    amountMinor: profession.salaryMinor,
    frequency: 'monthly',
    category: '@Salary',
  };
  const expenseSubscriptions: CashflowStarterKitSubscription[] = profession.expenses
    .filter((line) => line.amountMinor !== 0)
    .map((line) => ({
      title: line.title,
      account: 'Daily',
      amountMinor: -line.amountMinor,
      frequency: 'monthly',
      category: `@${line.title}`,
    }));
  const subscriptions = [salarySubscription, ...expenseSubscriptions];
  const gameSubscriptionTitles = subscriptions.map((sub) => sub.title);

  // Only Savings posts immediately — Salary/Expenses don't, so the player has a window to edit
  // their Subscriptions (category, account, dates) before anything is charged. The first Payday
  // then posts them for real, from whatever the Subscriptions look like by then (JFK, 2026-09-29:
  // "Then I have time as a user to modify the subscriptions... then I have a button start
  // (current Payday) and that is adding for the first time the transactions").
  const startingTransactions: CashflowTransactionRecord[] = [
    {
      account: 'Income',
      amountMinor: profession.savingsMinor,
      date: today,
      time: '',
      category: '@Savings',
      comment: `${profession.title} savings\n#cashflow`,
    },
  ];

  return {
    state: {
      ...initialCashflowGameState(),
      gameSetId,
      professionId,
      mode,
      boardPosition: mode === 'solo' ? 0 : null,
      virtualDate: today,
      gameSubscriptionTitles,
    },
    profession,
    subscriptions,
    starterKit: profession.starterKit,
    startingTransactions,
  };
}

export interface CashflowGameSubscription {
  title: string;
  account: string;
  amountMinor: number;
  category?: string;
  comment?: string;
}

/** The real Subscriptions matching `state.gameSubscriptionTitles`, in that order — what Payday/Charity/Downsized act on. */
function ownedSubscriptions(
  state: CashflowGameState,
  subscriptions: CashflowGameSubscription[],
): CashflowGameSubscription[] {
  const byTitle = new Map(subscriptions.map((sub) => [sub.title, sub]));
  return state.gameSubscriptionTitles
    .map((title) => byTitle.get(title))
    .filter((sub): sub is CashflowGameSubscription => sub !== undefined);
}

function cashflowTransaction(
  account: string,
  amountMinor: number,
  date: string,
  comment: string,
  category = '',
): CashflowTransactionRecord {
  return {
    account,
    amountMinor,
    date,
    time: '',
    category,
    comment: comment ? `${comment}\n#cashflow` : '#cashflow',
  };
}

export interface PaydayResult {
  state: CashflowGameState;
  transactions: CashflowTransactionRecord[];
}

/**
 * Runs one Payday: creates exactly one Transaction per real Subscription the
 * game owns (`state.gameSubscriptionTitles`), dated at the game's own
 * `virtualDate` — never at real "today", and never touching any other
 * transaction's date (the bug in the mechanism this replaces,
 * `GameModeService`). Advances `virtualDate` by one month and `round` by
 * one.
 *
 * Payday always runs, unconditionally — `charityRoundsLeft`/
 * `unemployedRoundsLeft` (Baby/Charity/Downsized) are about the physical
 * board's **turn order** ("your next 3 turns" / "sit out while opponents
 * play 2 rounds"), which this single-player companion tool has no
 * visibility into and must not guess at. It does not skip or gate Payday —
 * see `clearCashflowStatus`.
 */
export function runCashflowPayday(
  state: CashflowGameState,
  subscriptions: CashflowGameSubscription[],
): PaydayResult {
  const date = requireStarted(state, 'running Payday');
  const transactions: CashflowTransactionRecord[] = ownedSubscriptions(state, subscriptions).map(
    (sub) =>
      cashflowTransaction(
        sub.account,
        sub.amountMinor,
        date,
        sub.comment ? sub.comment : '',
        sub.category ?? '',
      ),
  );

  const nextRound = state.round + 1;
  const nextVirtualDate = addMonthsToIsoDate(date, 1);
  return {
    state: {
      ...state,
      round: nextRound,
      virtualDate: nextVirtualDate,
      history: [
        ...state.history,
        {
          round: nextRound,
          virtualDateBefore: date,
          virtualDateAfter: nextVirtualDate,
          kind: 'payday',
          createdTransactions: transactions,
        },
      ],
    },
    transactions,
  };
}

export interface UndoCashflowPaydayResult {
  state: CashflowGameState;
  removedTransactions: CashflowTransactionRecord[];
}

/** Reverses the most recent Payday: rewinds round/virtualDate and returns the exact transactions it created, for the caller to remove. Refuses if the most recent action wasn't a Payday. */
export function undoLastCashflowPayday(state: CashflowGameState): UndoCashflowPaydayResult {
  const lastEntry = state.history[state.history.length - 1];
  if (!lastEntry || lastEntry.kind !== 'payday') {
    throw new Error('Only the most recent Payday can be undone.');
  }
  return {
    state: {
      ...state,
      round: state.round - 1,
      virtualDate: lastEntry.virtualDateBefore,
      history: state.history.slice(0, -1),
    },
    removedTransactions: lastEntry.createdTransactions,
  };
}

/**
 * Clears an active Charity (dice-choice) or Downsized (sitting out) status
 * once the player's own physical turns have played out — the player is the
 * only one who knows when that is (todo/cashflow-game.md §4), so this is a
 * plain reminder dismissal, not a financial action: no history entry, not
 * undoable, same as ticking a checkbox.
 */
export function clearCashflowStatus(
  state: CashflowGameState,
  status: 'charity' | 'unemployed',
): CashflowGameState {
  return status === 'charity'
    ? { ...state, charityRoundsLeft: 0 }
    : { ...state, unemployedRoundsLeft: 0 };
}

export interface BabyResult {
  state: CashflowGameState;
  /** Create-or-update this Subscription so the child-expense total is included from the next Payday on. */
  subscriptionUpsert: CashflowStarterKitSubscription;
}

/** Resolves a Baby space: +1 child (max 3), the profession's per-child expense scales a dedicated Subscription. */
export function resolveCashflowBaby(
  state: CashflowGameState,
  profession: CashflowProfession,
): BabyResult {
  const date = requireStarted(state, 'landing on Baby');
  if (state.children >= 3) {
    throw new Error('Already at the maximum of 3 children.');
  }
  const children = state.children + 1;
  const title = `${profession.title} Children Expenses`;
  const gameSubscriptionTitles = state.gameSubscriptionTitles.includes(title)
    ? state.gameSubscriptionTitles
    : [...state.gameSubscriptionTitles, title];

  return {
    state: {
      ...state,
      children,
      gameSubscriptionTitles,
      history: [
        ...state.history,
        {
          round: state.round,
          virtualDateBefore: date,
          virtualDateAfter: date,
          kind: 'baby',
          createdTransactions: [],
        },
      ],
    },
    subscriptionUpsert: {
      title,
      account: 'Daily',
      amountMinor: -(children * profession.perChildExpenseMinor),
      frequency: 'monthly',
      category: '@Children Expenses',
    },
  };
}

export interface CharityResult {
  state: CashflowGameState;
  transaction: CashflowTransactionRecord;
}

/** Resolves a Charity space: pay 10% of total income now, may choose 1 or 2 dice for the next 3 Paydays. */
export function resolveCashflowCharity(
  state: CashflowGameState,
  subscriptions: CashflowGameSubscription[],
): CharityResult {
  const date = requireStarted(state, 'landing on Charity');
  const totalIncomeMinor = ownedSubscriptions(state, subscriptions)
    .filter((sub) => sub.amountMinor > 0)
    .reduce((sum, sub) => sum + sub.amountMinor, 0);
  const transaction = cashflowTransaction(
    'Daily',
    -Math.round(totalIncomeMinor * 0.1),
    date,
    'Charity',
    '@Charity',
  );

  return {
    state: {
      ...state,
      charityRoundsLeft: 3,
      history: [
        ...state.history,
        {
          round: state.round,
          virtualDateBefore: date,
          virtualDateAfter: date,
          kind: 'charity',
          createdTransactions: [transaction],
        },
      ],
    },
    transaction,
  };
}

export interface DownsizedResult {
  state: CashflowGameState;
  transactions: CashflowTransactionRecord[];
}

/**
 * Resolves a Downsized space: pay every current expense once, skipping any income — the same expense lines a
 * Payday would pay, each keeping its own account/category, just without the salary (JFK, 2026-09-26: "Downsized
 * should just trigger the current Expenses for the current month, so skipping any income. not its own category").
 * Sits out 2 Paydays (which also ends an active charity bonus).
 */
export function resolveCashflowDownsized(
  state: CashflowGameState,
  subscriptions: CashflowGameSubscription[],
): DownsizedResult {
  const date = requireStarted(state, 'landing on Downsized');
  const transactions = ownedSubscriptions(state, subscriptions)
    .filter((sub) => sub.amountMinor < 0)
    .map((sub) =>
      cashflowTransaction(
        sub.account,
        sub.amountMinor,
        date,
        sub.comment ? sub.comment : '',
        sub.category ?? '',
      ),
    );

  return {
    state: {
      ...state,
      unemployedRoundsLeft: 2,
      charityRoundsLeft: 0,
      history: [
        ...state.history,
        {
          round: state.round,
          virtualDateBefore: date,
          virtualDateAfter: date,
          kind: 'downsized',
          createdTransactions: transactions,
        },
      ],
    },
    transactions,
  };
}

/**
 * The recurring "Gesamteinkommen − Gesamtausgaben" the original rules use as
 * the loss condition: once this goes negative, every future Payday drains
 * cash — JFK's rule (2026-09-26): "the moment we go on a negative cashflow
 * for the next months, game is over." The caller decides how to surface
 * that (a warning badge today; nothing here enforces it).
 */
export function computeMonthlyCashflowMinor(
  state: CashflowGameState,
  subscriptions: CashflowGameSubscription[],
): number {
  return ownedSubscriptions(state, subscriptions).reduce((sum, sub) => sum + sub.amountMinor, 0);
}

export interface BankLoanResult {
  state: CashflowGameState;
  /** `null` once the loan is fully repaid — the caller should remove the Liability/Subscription instead of upserting. */
  liabilityUpsert: { tag: string; amountMinor: number } | null;
  subscriptionUpsert: CashflowStarterKitSubscription | null;
}

const BANK_LOAN_TAG = 'Bank loan';
const BANK_LOAN_SUBSCRIPTION_TITLE = 'Bank loan interest';

/**
 * Takes or repays a bank loan in the game set's `loanRule.incrementMinor`
 * steps: `deltaMinor` is positive to borrow, negative to repay. The interest
 * Subscription is fully recomputed from the new principal every time, never
 * hand-edited — the one fully automated financial mechanic
 * (todo/cashflow-game.md §4). `currentPrincipalMinor` is read by the caller
 * from the real "Bank loan" Liability (0 if none exists yet).
 */
export function adjustCashflowBankLoan(
  state: CashflowGameState,
  gameSet: CashflowGameSet,
  currentPrincipalMinor: number,
  deltaMinor: number,
): BankLoanResult {
  requireStarted(state, 'taking a bank loan');
  if (deltaMinor === 0) {
    throw new Error('Enter a non-zero amount to borrow or repay.');
  }
  if (Math.abs(deltaMinor) % gameSet.loanRule.incrementMinor !== 0) {
    throw new Error(
      `Bank loans only move in steps of ${gameSet.loanRule.incrementMinor} minor units.`,
    );
  }
  const nextPrincipalMinor = currentPrincipalMinor + deltaMinor;
  if (nextPrincipalMinor < 0) {
    throw new Error('Cannot repay more than the outstanding loan.');
  }

  const paidOff = nextPrincipalMinor === 0;
  const gameSubscriptionTitles = paidOff
    ? state.gameSubscriptionTitles.filter((title) => title !== BANK_LOAN_SUBSCRIPTION_TITLE)
    : state.gameSubscriptionTitles.includes(BANK_LOAN_SUBSCRIPTION_TITLE)
      ? state.gameSubscriptionTitles
      : [...state.gameSubscriptionTitles, BANK_LOAN_SUBSCRIPTION_TITLE];

  return {
    state: { ...state, gameSubscriptionTitles },
    liabilityUpsert: paidOff ? null : { tag: BANK_LOAN_TAG, amountMinor: nextPrincipalMinor },
    subscriptionUpsert: paidOff
      ? null
      : {
          title: BANK_LOAN_SUBSCRIPTION_TITLE,
          account: 'Daily',
          amountMinor: -Math.round(
            (nextPrincipalMinor * gameSet.loanRule.monthlyInterestPercent) / 100,
          ),
          frequency: 'monthly',
          category: `@${BANK_LOAN_TAG}`,
        },
  };
}
