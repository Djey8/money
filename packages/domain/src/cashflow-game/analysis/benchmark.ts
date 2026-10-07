import { placeInSpread, type ReviewBenchmark } from './render';

/**
 * What the strategy lab measured, as far as the analyst needs it (the shape of docs/domain/strategy/data/results.json):
 * for a profession, how the strategies fared.
 */
export interface LabResultsForBenchmark {
  meta: { gamesPerGroup: number };
  policies: { id: string; label: string }[];
  professions: { id: string; title: string }[];
  results: Record<
    string,
    Record<
      string,
      {
        escapeRate: number;
        turnsToEscape: { p10: number; median: number; p90: number } | null;
      }
    >
  >;
}

/**
 * How a game compares with the lab's best strategy for its profession: that strategy's escape rate and its typical, fast
 * and slow escape in rolls, and - when the game escaped - where its own number of rolls falls among them. Null when the
 * lab has nothing on the profession.
 */
export function benchmarkFor(
  lab: LabResultsForBenchmark | null | undefined,
  professionId: string | null | undefined,
  escapedAfterRolls: number | null,
): ReviewBenchmark | null {
  if (!lab || !professionId) return null;
  const group = lab.results[professionId];
  const profession = lab.professions.find((candidate) => candidate.id === professionId);
  if (!group || !profession) return null;
  const ranked = lab.policies
    .map((policy) => ({ policy, stats: group[policy.id] }))
    .filter((entry) => entry.stats)
    .sort(
      (a, b) =>
        b.stats.escapeRate - a.stats.escapeRate ||
        (a.stats.turnsToEscape?.median ?? Infinity) - (b.stats.turnsToEscape?.median ?? Infinity),
    );
  const best = ranked[0];
  if (!best) return null;
  const rolls = best.stats.turnsToEscape;
  return {
    professionTitle: profession.title,
    strategyLabel: best.policy.label,
    escapeRate: best.stats.escapeRate,
    rolls: rolls ? { p10: rolls.p10, median: rolls.median, p90: rolls.p90 } : null,
    games: lab.meta.gamesPerGroup,
    placement: rolls && escapedAfterRolls !== null ? placeInSpread(escapedAfterRolls, rolls) : null,
  };
}
