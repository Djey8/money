import { BOARD_SHAPES, BOARD_SIZES, type BoardShape, type BoardSize } from '../dreamfund-board';
import { seededRng, type Rng } from '../rng';
import { dreamCharacterIds } from '../dreamfund/table/reducer';
import {
  KNOB_RANGES,
  baseById,
  type DreamKnobs,
  type DreamPolicy,
  type InsureMode,
} from './policies';
import { simulateDreamGame, type DreamGameRecord } from './world';

/**
 * The search for the best way to play each type of bot (JFK, 2026-11-06): every strategy is a base (what it takes, what it leaves) and a
 * set of knobs (how much it keeps, how fast it plans, when it sells, whether it steps up, which insurances it holds). The search moves a
 * few knobs at a time from where the last calibration left the champion, scores the result over a spread of random games - every
 * character, every difficulty, every map - and keeps a change only when it is better by more than chance. "Better" is the aim of the
 * game: to have lived the dream, repaid the debts, filled the reserve and reached the passive income before anybody else.
 * Pure and seeded; the evaluation is injected so that a script can spread it over all cores.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Scenario {
  seed: number;
  professionId: string;
  difficulty: Difficulty;
  shape: BoardShape;
  size: BoardSize;
}

export const SEARCH_MAX_TURNS = 250;

/** A spread of games over the whole matrix of characters, difficulties and maps: the same seed gives the same list. */
export function makeScenarios(
  count: number,
  seed: number,
  options: { difficulties?: Difficulty[]; characters?: string[] } = {},
): Scenario[] {
  const rng = seededRng(seed >>> 0 || 1);
  const characters = options.characters ?? dreamCharacterIds();
  const difficulties = options.difficulties ?? ['easy', 'medium', 'hard'];
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  return Array.from({ length: count }, () => ({
    seed: Math.floor(rng() * 2 ** 31),
    professionId: pick(characters),
    difficulty: pick(difficulties),
    shape: pick(BOARD_SHAPES),
    size: pick(BOARD_SIZES),
  }));
}

/**
 * What a finished game is worth to the search: a win counts one plus up to a half for how early it came (the first to finish wins the
 * table), a bankruptcy costs, and a game that ran out of turns is worth the goals it reached.
 */
export function scoreGame(record: DreamGameRecord, maxTurns = SEARCH_MAX_TURNS): number {
  if (record.outcome === 'won')
    return 1 + 0.5 * Math.max(0, 1 - (record.wonTurn ?? maxTurns) / maxTurns);
  if (record.outcome === 'bankrupt') return -0.3;
  if (record.outcome === 'error') return -1;
  const goals =
    (record.reserveFullTurn ? 1 : 0) +
    (record.debtsRepaidTurn ? 1 : 0) +
    (record.dreamLivedTurn ? 1 : 0) +
    (record.independentTurn ? 1 : 0);
  return 0.1 * goals;
}

export interface Evaluation {
  scores: number[];
  mean: number;
  winRate: number;
  bankruptRate: number;
  /** Median turn of the wins. */
  winTurn: number | null;
}

export function summarizeRecords(
  records: DreamGameRecord[],
  maxTurns = SEARCH_MAX_TURNS,
): Evaluation {
  const scores = records.map((record) => scoreGame(record, maxTurns));
  const wins = records.filter((record) => record.outcome === 'won');
  const turns = wins.map((record) => record.wonTurn ?? 0).sort((a, b) => a - b);
  const n = Math.max(1, records.length);
  return {
    scores,
    mean: scores.reduce((a, b) => a + b, 0) / n,
    winRate: wins.length / n,
    bankruptRate: records.filter((record) => record.outcome === 'bankrupt').length / n,
    winTurn: turns.length ? turns[Math.floor(turns.length / 2)] : null,
  };
}

/** One game of a policy in a scenario. */
export function playScenario(
  policy: DreamPolicy,
  scenario: Scenario,
  maxTurns = SEARCH_MAX_TURNS,
): DreamGameRecord {
  return simulateDreamGame({
    seed: scenario.seed,
    policy,
    professionId: scenario.professionId,
    shape: scenario.shape,
    size: scenario.size,
    rules: { difficulty: scenario.difficulty },
    maxTurns,
  });
}

export function evaluatePolicy(
  policy: DreamPolicy,
  scenarios: Scenario[],
  maxTurns = SEARCH_MAX_TURNS,
): Evaluation {
  return summarizeRecords(
    scenarios.map((scenario) => playScenario(policy, scenario, maxTurns)),
    maxTurns,
  );
}

/** Games of a knob set on a list of scenarios, scored: the injected evaluation of the search (a script spreads it over the cores). */
export type KnobEvaluator = (
  type: string,
  knobs: DreamKnobs[],
  scenarios: Scenario[],
) => Promise<Evaluation[]>;

export const evaluateInProcess: KnobEvaluator = async (type, knobs, scenarios) =>
  knobs.map((set) => evaluatePolicy(baseById(type).retune(set), scenarios));

// ── the moves of the search ──

const INSURE: InsureMode[] = ['keep', 'all', 'core', 'none'];

/** The knob set with `count` knobs moved: a number by one to three steps of its range, a switch flipped, an insurance mode drawn. */
export function mutateKnobs(current: Required<DreamKnobs>, rng: Rng, count = 2): DreamKnobs {
  const next: Required<DreamKnobs> = { ...current };
  const numeric = Object.keys(KNOB_RANGES) as (keyof typeof KNOB_RANGES)[];
  const switches = ['ride', 'takeDreams', 'clearLoanBySale', 'insure'] as const;
  const all = [...numeric, ...switches];
  for (let i = 0; i < count; i += 1) {
    const knob = all[Math.floor(rng() * all.length)];
    if (knob === 'insure') {
      next.insure = INSURE[Math.floor(rng() * INSURE.length)];
    } else if (knob === 'ride' || knob === 'takeDreams' || knob === 'clearLoanBySale') {
      next[knob] = !next[knob];
    } else {
      const [low, high, step] = KNOB_RANGES[knob];
      const moves = (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3));
      const value = Math.min(high, Math.max(low, (next[knob] as number) + moves * step));
      next[knob] = Math.round(value * 1000) / 1000;
      // a step-up with no yield limit is off: turning it on needs a limit
      if (knob === 'stepUpGain' && next.stepUpYield === 0) next.stepUpYield = 0.15;
    }
  }
  return next;
}

/** The difference of two sets of scores on the same scenarios: its mean, its standard error and the ratio (a paired comparison). */
export function pairedDifference(better: number[], worse: number[]) {
  const n = Math.min(better.length, worse.length);
  const diffs = Array.from({ length: n }, (_, i) => better[i] - worse[i]);
  const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const variance = diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const se = Math.sqrt(variance / Math.max(1, n));
  return { mean, se, z: se > 0 ? mean / se : 0, n };
}

export interface RelearnOptions {
  type: string;
  /** Where the search starts: the last champion's knobs (nothing: the strategy as written). */
  start?: DreamKnobs;
  generations: number;
  /** Mutants per generation, and games each is played on. */
  mutants: number;
  games: number;
  /** Games of the final test of the new champion against the old one (fresh scenarios). */
  verifyGames: number;
  seed: number;
  evaluate: KnobEvaluator;
  /** The z a mutant needs over the incumbent in a generation, and the z the final verdict needs. */
  stepZ?: number;
  verdictZ?: number;
  difficulties?: Difficulty[];
  onProgress?: (line: string) => void;
}

export interface RelearnResult {
  type: string;
  knobs: DreamKnobs;
  /** The old champion, and what the new one scored against it on fresh games. */
  verdict: {
    changed: boolean;
    newMean: number;
    oldMean: number;
    z: number;
    newWinRate: number;
    oldWinRate: number;
    newBankrupt: number;
    oldBankrupt: number;
    games: number;
  };
  steps: { generation: number; knobs: DreamKnobs; z: number; mean: number }[];
}

/**
 * Relearns one type: from the last champion, generation by generation, mutants against the incumbent on a shared list of fresh games
 * (a paired comparison, so luck of the draw cancels). A mutant that beats the incumbent by `stepZ` standard errors replaces it. At
 * the end the result meets the champion it started from on games neither has seen: it is kept only when it is better by `verdictZ`.
 */
export async function relearnType(options: RelearnOptions): Promise<RelearnResult> {
  const rng = seededRng((options.seed ^ 0x9e3779b9) >>> 0 || 1);
  const stepZ = options.stepZ ?? 1.5;
  const verdictZ = options.verdictZ ?? 2;
  const say = options.onProgress ?? (() => undefined);
  const base = baseById(options.type);
  const startKnobs = options.start ?? {};
  let incumbent: DreamKnobs = startKnobs;
  const steps: RelearnResult['steps'] = [];
  for (let generation = 1; generation <= options.generations; generation += 1) {
    const scenarios = makeScenarios(options.games, options.seed + generation * 7919, {
      difficulties: options.difficulties,
    });
    const current = base.retune(incumbent).resolved;
    const mutants = Array.from({ length: options.mutants }, () =>
      mutateKnobs(current, rng, 1 + Math.floor(rng() * 3)),
    );
    const [home, ...scored] = await options.evaluate(
      options.type,
      [incumbent, ...mutants],
      scenarios,
    );
    let best = -1;
    let bestZ = stepZ;
    scored.forEach((candidate, index) => {
      const { z } = pairedDifference(candidate.scores, home.scores);
      if (z > bestZ) {
        bestZ = z;
        best = index;
      }
    });
    if (best >= 0) {
      incumbent = mutants[best];
      steps.push({ generation, knobs: incumbent, z: bestZ, mean: scored[best].mean });
      say(
        `${options.type} gen ${generation}: +${(scored[best].mean - home.mean).toFixed(3)} (z ${bestZ.toFixed(1)}), win ${(scored[best].winRate * 100).toFixed(0)}%`,
      );
    } else {
      say(
        `${options.type} gen ${generation}: nothing better (win ${(home.winRate * 100).toFixed(0)}%)`,
      );
    }
  }
  // the verdict: the candidate against the champion it started from, on games neither has seen
  const fresh = makeScenarios(options.verifyGames, options.seed ^ 0x51ed270b, {
    difficulties: options.difficulties,
  });
  const [oldRun, newRun] = await options.evaluate(options.type, [startKnobs, incumbent], fresh);
  const { z } = pairedDifference(newRun.scores, oldRun.scores);
  const changed = steps.length > 0 && z >= verdictZ;
  return {
    type: options.type,
    knobs: changed ? incumbent : startKnobs,
    verdict: {
      changed,
      newMean: newRun.mean,
      oldMean: oldRun.mean,
      z,
      newWinRate: newRun.winRate,
      oldWinRate: oldRun.winRate,
      newBankrupt: newRun.bankruptRate,
      oldBankrupt: oldRun.bankruptRate,
      games: fresh.length,
    },
    steps,
  };
}
