import type { GameRecord } from './session';

/**
 * What a pile of simulated games says (todo/cashflow-game-analysis.md, E2): how often a strategy escapes the rat race or
 * goes bankrupt, and - among the games that escape - how fast (rolls and months) and how rich (passive income and monthly
 * cashflow at the finish, and the most passive income held at any moment). Percentiles use the nearest-rank method, so
 * every figure is a number a real game produced.
 */

export interface Spread {
  min: number;
  p10: number;
  p25: number;
  median: number;
  mean: number;
  p75: number;
  p90: number;
  max: number;
}

export interface GroupStats {
  games: number;
  escaped: number;
  bankrupt: number;
  timeout: number;
  escapeRate: number;
  bankruptRate: number;
  timeoutRate: number;
  /** Rolls and months (Paydays) to escape, among the escaped games. */
  turnsToEscape: Spread | null;
  monthsToEscape: Spread | null;
  /** Among the escaped games: what the finish looked like. */
  passiveIncomeAtEscapeMinor: Spread | null;
  monthlyCashflowAtEscapeMinor: Spread | null;
  /** Among all games: the most passive income held at any moment. */
  peakPassiveIncomeMinor: Spread | null;
  /** Among all games: properties bought, and the lowest cash and the largest bank loan reached. */
  purchases: Spread | null;
  lowestCashMinor: Spread | null;
  peakBankLoanMinor: Spread | null;
}

export function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return NaN;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[rank];
}

export function spreadOf(values: number[]): Spread | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    min: sorted[0],
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    mean: sum / sorted.length,
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    max: sorted[sorted.length - 1],
  };
}

export function summarizeGames(records: GameRecord[]): GroupStats {
  const escaped = records.filter((record) => record.outcome === 'escaped');
  const bankrupt = records.filter((record) => record.outcome === 'bankrupt').length;
  const timeout = records.filter((record) => record.outcome === 'timeout').length;
  const games = records.length;
  return {
    games,
    escaped: escaped.length,
    bankrupt,
    timeout,
    escapeRate: games ? escaped.length / games : 0,
    bankruptRate: games ? bankrupt / games : 0,
    timeoutRate: games ? timeout / games : 0,
    turnsToEscape: spreadOf(escaped.map((record) => record.turns)),
    monthsToEscape: spreadOf(escaped.map((record) => record.rounds)),
    passiveIncomeAtEscapeMinor: spreadOf(escaped.map((record) => record.passiveIncomeMinor)),
    monthlyCashflowAtEscapeMinor: spreadOf(escaped.map((record) => record.monthlyCashflowMinor)),
    peakPassiveIncomeMinor: spreadOf(records.map((record) => record.peakPassiveIncomeMinor)),
    purchases: spreadOf(records.map((record) => record.purchases.length)),
    lowestCashMinor: spreadOf(records.map((record) => record.lowestCashMinor)),
    peakBankLoanMinor: spreadOf(records.map((record) => record.peakBankLoanMinor)),
  };
}

/** The wilson score interval of a rate (95%): how far a measured share can be trusted with this many games. */
export function wilsonInterval(successes: number, games: number): { low: number; high: number } {
  if (games === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = successes / games;
  const denominator = 1 + (z * z) / games;
  const centre = p + (z * z) / (2 * games);
  const margin = z * Math.sqrt((p * (1 - p)) / games + (z * z) / (4 * games * games));
  return { low: (centre - margin) / denominator, high: (centre + margin) / denominator };
}
