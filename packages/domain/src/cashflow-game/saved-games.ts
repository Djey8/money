import { droppedPremiumTitles } from './insurance';
import type { CashflowGameState } from './types';

/**
 * Saved Cashflow games (JFK, 2026-10-04): an account plays one live game, and can keep any number of
 * past ones. A saved game is a snapshot of everything the live game consists of plus this summary,
 * which is all the games list - and, later, statistics - needs without opening the snapshot.
 * Every amount here is in minor units, like the rest of the stored model (ADR-0002).
 */
export const SAVED_GAME_SCHEMA = 1;

/**
 * A gentle warning, not a hard cap: past this many the games list gets long. (Storage is no reason any more - every
 * saved game is a document of its own and the account's byte budget is a gibibyte; JFK, 2026-10-10: "hundreds of games".)
 */
export const SAVED_GAME_SOFT_LIMIT = 1000;

/**
 * What an agent leaves behind after a session of analysis (JFK, 2026-10-07): it may save as many games as the account's
 * storage budget allows while it works, but afterwards keeps at most this many - the important ones.
 */
export const SAVED_GAME_AGENT_KEEP = 500;

export type SavedGameStatus = 'playing' | 'escaped' | 'bankrupt' | 'ended';

export interface SavedGameSummary {
  id: string;
  name: string;
  createdAt: string;
  /** When it was last saved - the list is ordered by it. */
  updatedAt: string;
  /** Set when the game was ended on purpose ("End game"). */
  endedAt?: string;
  gameSetId: string | null;
  professionId: string | null;
  /** The language the game was played in (card texts and labels follow it). */
  language?: string;
  round: number;
  virtualDate: string | null;
  cashMinor: number;
  salaryMinor: number;
  /** What the bought properties and businesses pay every month. */
  passiveIncomeMinor: number;
  expensesMinor: number;
  monthlyCashflowMinor: number;
  bankLoanMinor: number;
  children: number;
  transactionCount: number;
  escapedRatRace: boolean;
  bankrupt: boolean;
  /** Set when the game was played at a table with others (filed from it at the end): which table, how many, and the place won. */
  multiplayer?: {
    table: string;
    players: number;
    rank: number | null;
    roomId?: string;
    /** How the player's game ended: escaped, bankrupt, left (gave up) or playing (nobody escaped). */
    outcome?: string;
  };
}

/** The small, always-loaded list of a user's saved games. */
export interface SavedGamesIndex {
  schema: number;
  games: SavedGameSummary[];
}

export interface CashflowFinanceSummary {
  salaryMinor: number;
  passiveIncomeMinor: number;
  expensesMinor: number;
  monthlyCashflowMinor: number;
  /** What the payment plans running at the next Payday pay every month (JFK, 2026-10-26): saving, but money that leaves the month. */
  fundingMinor: number;
  /** What is left of the month after the plans: the cashflow the player lives on. */
  cashflowAfterPlansMinor: number;
  /** Passive income covers every monthly expense - out of the rat race. */
  escapedRatRace: boolean;
  /** The monthly cashflow is negative: how you lose the game. */
  bankrupt: boolean;
}

/**
 * The monthly money picture of a running game, from its own subscriptions: the salary is the first
 * game subscription, passive income is what the `<name> Cashflow` subscriptions of bought
 * properties pay, expenses are every negative one. The same rule the game dashboard uses for its
 * rat-race banner, so a saved game and the live view always agree.
 */
export function summarizeGameFinances(
  state: Pick<CashflowGameState, 'gameSubscriptionTitles' | 'insurance'> &
    Partial<Pick<CashflowGameState, 'fundingSubscriptionTitles' | 'virtualDate'>>,
  subscriptions: { title: string; amountMinor: number; startDate?: string; endDate?: string }[],
): CashflowFinanceSummary {
  // an insurance that is dropped costs nothing: its premium is not part of the month
  const dropped = droppedPremiumTitles(state);
  const titles = state.gameSubscriptionTitles.filter((title) => !dropped.has(title));
  const owned = subscriptions.filter((sub) => titles.includes(sub.title));
  const salary = owned.find((sub) => sub.title === titles[0]);
  const salaryMinor = salary && salary.amountMinor > 0 ? salary.amountMinor : 0;
  const passiveIncomeMinor = owned
    .filter((sub) => sub.title.endsWith(' Cashflow') && sub.amountMinor > 0)
    .reduce((sum, sub) => sum + sub.amountMinor, 0);
  const expensesMinor = owned
    .filter((sub) => sub.amountMinor < 0)
    .reduce((sum, sub) => sum + Math.abs(sub.amountMinor), 0);
  const monthlyCashflowMinor = owned.reduce((sum, sub) => sum + sub.amountMinor, 0);
  const fundingMinor = runningFundingMinor(state, subscriptions);
  return {
    fundingMinor,
    cashflowAfterPlansMinor: monthlyCashflowMinor - fundingMinor,
    salaryMinor,
    passiveIncomeMinor,
    expensesMinor,
    monthlyCashflowMinor,
    escapedRatRace: expensesMinor > 0 && passiveIncomeMinor >= expensesMinor,
    bankrupt: monthlyCashflowMinor < 0,
  };
}

/** How the list labels a game: ended on purpose, out of the rat race, in trouble, or simply still going. */
export function savedGameStatus(
  summary: Pick<SavedGameSummary, 'endedAt' | 'escapedRatRace' | 'bankrupt'>,
): SavedGameStatus {
  if (summary.endedAt) return 'ended';
  if (summary.escapedRatRace) return 'escaped';
  if (summary.bankrupt) return 'bankrupt';
  return 'playing';
}

/** What the funding plans that pay on the next Payday (their dates cover it) take every month, as a positive number. */
export function runningFundingMinor(
  state: Pick<CashflowGameState, 'gameSubscriptionTitles'> &
    Partial<Pick<CashflowGameState, 'fundingSubscriptionTitles' | 'virtualDate'>>,
  subscriptions: { title: string; amountMinor: number; startDate?: string; endDate?: string }[],
): number {
  const date = state.virtualDate ?? '';
  return (state.fundingSubscriptionTitles ?? [])
    .filter((title) => !state.gameSubscriptionTitles.includes(title))
    .map((title) => subscriptions.find((sub) => sub.title === title))
    .filter(
      (sub) =>
        sub !== undefined &&
        (!sub.startDate || sub.startDate <= date) &&
        (!sub.endDate || date <= sub.endDate),
    )
    .reduce((sum, sub) => sum + Math.abs(sub!.amountMinor), 0);
}

/** Most recently saved first. */
export function sortSavedGames(games: SavedGameSummary[]): SavedGameSummary[] {
  return [...games].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * How much of the month is still free for funding plans (JFK, 2026-10-25): the monthly cashflow of the game minus what the running
 * plans already pay every Payday. A plan may never take more than this - paying for a dream must not push the month into the red.
 * `except` leaves one plan out (the one being changed).
 */
export function fundingRoomMinor(
  state: Pick<
    CashflowGameState,
    'gameSubscriptionTitles' | 'fundingSubscriptionTitles' | 'virtualDate'
  >,
  subscriptions: { title: string; amountMinor: number; endDate?: string }[],
  except?: string,
): number {
  const date = state.virtualDate ?? '';
  const committed = (state.fundingSubscriptionTitles ?? [])
    .filter((title) => title !== except && !state.gameSubscriptionTitles.includes(title))
    .map((title) => subscriptions.find((sub) => sub.title === title))
    .filter((sub) => sub !== undefined && (!sub.endDate || date <= sub.endDate))
    .reduce((sum, sub) => sum + Math.abs(sub!.amountMinor), 0);
  const month = summarizeGameFinances(state, subscriptions).monthlyCashflowMinor;
  return Math.max(0, month - committed);
}
