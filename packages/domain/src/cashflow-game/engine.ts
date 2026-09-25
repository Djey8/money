/**
 * The Cashflow game MVP engine: pure functions over `CashflowGameState` plus
 * plain descriptions of the real entities to create/remove — this module
 * never touches Angular state itself, the frontend's `CashflowGameService`
 * applies its output to `AppStateService`. See todo/cashflow-game.md.
 */
import {
  CashflowGameSet,
  CashflowGameState,
  CashflowProfession,
  CashflowStarterKit,
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

export interface PickProfessionResult {
  state: CashflowGameState;
  profession: CashflowProfession;
  starterKit: CashflowStarterKit;
  /** One starting Transaction to materialize alongside the starter kit's entities. */
  startingCashTransaction: CashflowTransactionRecord;
}

/**
 * Starts a new game: resets any previous game state and returns the chosen
 * profession's starter kit for the caller to materialize as real
 * Subscription/Asset/Investment/Share/Liability entities, plus one starting
 * Transaction for the profession's starting cash. Never touches anything the
 * previous game may have created — Phase 1 decides whether picking a new
 * profession mid-game is even allowed; for the MVP this is only meant to run
 * once, from a fresh (or freshly reset) game.
 */
export function pickCashflowProfession(
  gameSets: CashflowGameSet[],
  gameSetId: string,
  professionId: string,
  today: string,
): PickProfessionResult {
  const gameSet = findCashflowGameSet(gameSets, gameSetId);
  const profession = findCashflowProfession(gameSet, professionId);
  const gameSubscriptionTitles = profession.starterKit.subscriptions.map((sub) => sub.title);

  return {
    state: {
      ...initialCashflowGameState(),
      gameSetId,
      professionId,
      virtualDate: today,
      gameSubscriptionTitles,
    },
    profession,
    starterKit: profession.starterKit,
    startingCashTransaction: {
      account: 'Income',
      amountMinor: profession.startingCashMinor,
      date: today,
      time: '',
      category: '',
      comment: `${profession.title} starting cash\n#cashflow`,
    },
  };
}

export interface CashflowGameSubscription {
  title: string;
  account: string;
  amountMinor: number;
  category?: string;
  comment?: string;
}

export interface PaydayResult {
  state: CashflowGameState;
  transactions: CashflowTransactionRecord[];
}

/**
 * Runs one payday: creates exactly one Transaction per real Subscription the
 * game owns (`state.gameSubscriptionTitles`), dated at the game's own
 * `virtualDate` — never at real "today", and never touching any other
 * transaction's date (the bug in the mechanism this replaces,
 * `GameModeService`). Advances `virtualDate` by one month and `round` by one.
 */
export function runCashflowPayday(
  state: CashflowGameState,
  subscriptions: CashflowGameSubscription[],
): PaydayResult {
  if (!state.virtualDate) {
    throw new Error('Pick a profession before running Payday.');
  }
  const date = state.virtualDate;
  const byTitle = new Map(subscriptions.map((sub) => [sub.title, sub]));
  const transactions: CashflowTransactionRecord[] = state.gameSubscriptionTitles
    .map((title) => byTitle.get(title))
    .filter((sub): sub is CashflowGameSubscription => sub !== undefined)
    .map((sub) => ({
      account: sub.account,
      amountMinor: sub.amountMinor,
      date,
      time: '',
      category: sub.category ?? '',
      comment: sub.comment ? `${sub.comment}\n#cashflow` : '#cashflow',
    }));

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

/** Reverses the most recent Payday: rewinds round/virtualDate and returns the exact transactions it created, for the caller to remove. */
export function undoLastCashflowPayday(state: CashflowGameState): UndoCashflowPaydayResult {
  const lastEntry = state.history[state.history.length - 1];
  if (!lastEntry) {
    throw new Error('Nothing to undo.');
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
