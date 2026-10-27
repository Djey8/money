import { salaryLinkedMinor } from '../../saved-games';
import type { DreamPlayer } from '../player';
import type { DreamSeat, DreamStanding } from './types';

/**
 * How a Dreamfund player stands (JFK, 2026-10-27: "the dream points, the debt-free and the Mojo savings and the other missions count
 * for the ranking and the leaderboard"). Four goals, each a share from 0 to 1 - the reserve of three months, the debts repaid, the
 * dream lived, the passive income against the cost of living - the dream points of every dream lived, and a win (all goals met).
 * Pure: the same life gives the same standing.
 */

/** What a full goal is worth, the points of a dream and a win in the score. */
export const SCORE_PER_GOAL = 250;
export const SCORE_PER_DREAM_POINT = 25;
export const SCORE_FOR_A_WIN = 1000;

export interface Goals {
  reserve: number;
  debts: number;
  dream: number;
  independence: number;
}

const share = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** The four goals of a life. */
export function goalsOf(player: DreamPlayer): Goals {
  const expenses = player.monthlyExpenses();
  const finances = player.finances();
  const living =
    finances.expensesMinor - salaryLinkedMinor(player.state, player.books.subscriptions);
  const initialDebts = (player.profession.starterKit.liabilities ?? []).reduce(
    (sum, liability) => sum + liability.amountMinor,
    0,
  );
  return {
    reserve: expenses > 0 ? share(player.reserveMinor / (expenses * 3)) : 0,
    debts: initialDebts > 0 ? share(1 - player.debtsMinor() / initialDebts) : 1,
    dream: player.dreamLived
      ? 1
      : player.dreamTargetMinor > 0
        ? share(player.dreamSavedMinor / player.dreamTargetMinor)
        : 0,
    independence: finances.escapedRatRace
      ? 1
      : living > 0
        ? share(finances.passiveIncomeMinor / living)
        : 1,
  };
}

export const isWon = (goals: Goals): boolean =>
  goals.reserve >= 1 && goals.debts >= 1 && goals.dream >= 1 && goals.independence >= 1;

/** The number a player is ranked by: the goals reached (partly counts), the dream points, and a win. */
export function scoreOf(goals: Goals, dreamPoints: number, won: boolean): number {
  const progress = goals.reserve + goals.debts + goals.dream + goals.independence;
  return Math.round(
    progress * SCORE_PER_GOAL + dreamPoints * SCORE_PER_DREAM_POINT + (won ? SCORE_FOR_A_WIN : 0),
  );
}

export function standingOf(
  seat: DreamSeat,
  player: DreamPlayer,
  outcome: DreamStanding['outcome'],
): Omit<DreamStanding, 'rank'> {
  const goals = goalsOf(player);
  const won = outcome === 'won';
  const dreamPoints = player.dreamPoints + player.bonusPoints;
  const finances = player.finances();
  return {
    playerId: seat.id,
    outcome,
    goals,
    goalsMet: Object.values(goals).filter((value) => value >= 1).length,
    dreamPoints,
    reserveMinor: player.reserveMinor,
    passiveMinor: finances.passiveIncomeMinor,
    expensesMinor: finances.expensesMinor,
    netWorthMinor: player.netWorth(),
    ...(seat.reached.won !== undefined ? { wonRound: seat.reached.won } : {}),
    score: scoreOf(goals, dreamPoints, won),
  };
}

const OUTCOME_ORDER: Record<DreamStanding['outcome'], number> = {
  won: 0,
  playing: 1,
  bankrupt: 2,
  left: 3,
};

/** Winners first (the earliest first), then the others by score, those who went bankrupt and those who left last. */
export function rankStandings(standings: Omit<DreamStanding, 'rank'>[]): DreamStanding[] {
  const sorted = [...standings].sort(
    (a, b) =>
      OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome] ||
      (a.outcome === 'won' ? (a.wonRound ?? 0) - (b.wonRound ?? 0) : 0) ||
      b.score - a.score ||
      b.netWorthMinor - a.netWorthMinor,
  );
  return sorted.map((standing, index) => ({ ...standing, rank: index + 1 }));
}
