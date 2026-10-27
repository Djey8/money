import { DREAMFUND_MAP, type DreamfundLevel } from '../../analysis/dreamfund-benchmarks';
import { DREAM_BOT_RATINGS } from './bot-ratings.generated';
import { DREAM_BOT_LEVELS, splitDreamBotId, type DreamBotLevel } from './bot-levels';

/**
 * The rating of the Dreamfund leaderboard (todo/dreamfund-multiplayer.md, slice 8; JFK, 2026-10-27): a world of its own - its players, its
 * results, its numbers - nothing shared with the classic board. Pairwise Elo as in the classic: a table of n players is n*(n-1)/2 duels,
 * decided by the ranking of the game (which counts the goals, the dream points and the win), and everybody's change is the surprise of
 * their duels. What is different:
 *  - **one rating per difficulty** (Easy, Normal, Hard): a person and a bot have each their own at each level of the game;
 *  - **the character is handicapped**: beating the table as Dr. Jan on Hard is worth more than as Peter on Easy, because what each
 *    player is expected to do comes from the simulation's map (the win rate of the best strategy on that character and level);
 *  - **a bot starts where the map says it is**, by its strategy and its skill level, and moves from there with its results.
 * Pure and versioned (`DREAM_RATING_VERSION`): the results are kept, so a better scoring can be run over them again.
 */

export const DREAM_RATING_VERSION = 1;
export const DREAM_START_RATING = 1500;
export const DREAM_RATING_FLOOR = 100;
/** Tables of fewer rounds than this do not count, unless somebody won. */
export const MIN_RATED_ROUNDS = 8;
export const PROVISIONAL_GAMES = 5;

const K_HUMAN_NEW = 40;
const K_HUMAN = 24;
const K_BOT = 8;
const NEW_PLAYER_GAMES = 20;

/** How far the skill levels of a bot sit below its master (Elo points; the fallback when no tournament has rated a bot: the tournaments found about 0, -10, -80, -230). */
export const LEVEL_OFFSET: Record<DreamBotLevel, number> = {
  master: 0,
  strong: -50,
  casual: -130,
  beginner: -260,
};

const clampRate = (rate: number) => Math.min(0.98, Math.max(0.01, rate));
const odds = (rate: number) => clampRate(rate) / (1 - clampRate(rate));
const elo = (ratio: number) => 400 * Math.log10(ratio);

const LEVELS: DreamfundLevel[] = ['easy', 'medium', 'hard'];

/** The best strategy's win rate on every character at a level (the map). */
function winRates(level: DreamfundLevel): number[] {
  return Object.values(DREAMFUND_MAP)
    .map((cell) => cell[level]?.winRate)
    .filter((rate): rate is number => rate !== undefined);
}

const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/**
 * How much easier or harder a character is than the average one at a level, in Elo points (positive: easier). A player of an easier
 * character is expected to place better, so the same placing earns less.
 */
export function characterStrength(character: string | null, level: DreamfundLevel): number {
  const rate = character ? DREAMFUND_MAP[character]?.[level]?.winRate : undefined;
  if (rate === undefined) return 0;
  return Math.round(elo(odds(rate) / odds(mean(winRates(level)) || rate)));
}

/**
 * Where a bot starts at a level (JFK: "the bots have their own starting Elo"): the master of the best strategy of the map is 1500; the
 * others are below it by what their win rate says (the average over the characters), and a lower skill level by its offset.
 */
export function botStartRating(botId: string, level: DreamfundLevel): number {
  const parts = splitDreamBotId(botId);
  if (!parts) return DREAM_START_RATING;
  // what the bot tournaments found, when they have been run (scripts/dreamfund-tournament.js)
  const played = DREAM_BOT_RATINGS[level]?.[botId];
  if (played !== undefined) return played;
  const rateOf = (id: string) =>
    mean(
      Object.values(DREAMFUND_MAP)
        .map((cell) => cell[level]?.strategies[id]?.[0])
        .filter((rate): rate is number => rate !== undefined),
    );
  const best = Math.max(
    ...Object.keys(Object.values(DREAMFUND_MAP)[0]?.[level]?.strategies ?? {}).map(rateOf),
    0.01,
  );
  const own = rateOf(parts.base);
  const strategy = own > 0 ? elo(odds(own) / odds(best)) : -400;
  return Math.max(
    DREAM_RATING_FLOOR,
    Math.round(DREAM_START_RATING + strategy + LEVEL_OFFSET[parts.level]),
  );
}

export const isLevel = (value: string): value is DreamfundLevel =>
  (LEVELS as string[]).includes(value);

export interface RatedSeat {
  /** The player of the board (a human's public id, a bot's id). */
  playerId: string;
  type: 'human' | 'bot';
  rating: number;
  /** Rated games at this level so far. */
  ratedGames: number;
  character: string | null;
  rank: number;
  /** A player who left a game that had started is out of the duels: they lose to everyone who stayed. */
  outcome: 'won' | 'playing' | 'bankrupt' | 'left';
}

export interface RatingChange {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

const kOf = (seat: RatedSeat) =>
  seat.type === 'bot' ? K_BOT : seat.ratedGames < NEW_PLAYER_GAMES ? K_HUMAN_NEW : K_HUMAN;

/** The expected score of `a` against `b` from their ratings and how hard their characters are. */
export function expected(
  a: { rating: number; strength: number },
  b: { rating: number; strength: number },
): number {
  return 1 / (1 + Math.pow(10, (b.rating + b.strength - (a.rating + a.strength)) / 400));
}

/** What a finished table does to everybody's rating at the table's difficulty. */
export function rateTable(seats: RatedSeat[], level: DreamfundLevel): RatingChange[] {
  const strength = (seat: RatedSeat) => characterStrength(seat.character, level);
  const deltas = new Map<string, number>(seats.map((s) => [s.playerId, 0]));
  for (let i = 0; i < seats.length; i += 1) {
    for (let j = i + 1; j < seats.length; j += 1) {
      const a = seats[i];
      const b = seats[j];
      // the one who left is not in the contest: nobody gains or loses against them except the leaver, who loses
      let scoreA = a.rank < b.rank ? 1 : a.rank > b.rank ? 0 : 0.5;
      if (a.outcome === 'left' && b.outcome !== 'left') scoreA = 0;
      if (b.outcome === 'left' && a.outcome !== 'left') scoreA = 1;
      const e = expected(
        { rating: a.rating, strength: strength(a) },
        { rating: b.rating, strength: strength(b) },
      );
      // every duel counts for 1/(n-1): a bigger table does not move ratings more
      const weight = 1 / Math.max(1, seats.length - 1);
      deltas.set(a.playerId, (deltas.get(a.playerId) ?? 0) + kOf(a) * weight * (scoreA - e));
      deltas.set(
        b.playerId,
        (deltas.get(b.playerId) ?? 0) + kOf(b) * weight * (1 - scoreA - (1 - e)),
      );
    }
  }
  return seats.map((seat) => {
    const after = Math.max(DREAM_RATING_FLOOR, seat.rating + (deltas.get(seat.playerId) ?? 0));
    return {
      playerId: seat.playerId,
      before: seat.rating,
      after,
      delta: Math.round((after - seat.rating) * 10) / 10,
    };
  });
}

/** Whether a finished table counts for the rating, and why not. */
export function countsForRating(input: {
  ranked: boolean;
  phase: string;
  players: number;
  humans: number;
  tableRound: number;
  someoneWon: boolean;
  tournament?: boolean;
}): { counted: boolean; why?: string } {
  if (!input.ranked && !input.tournament) return { counted: false, why: 'not-ranked' };
  if (input.phase !== 'finished') return { counted: false, why: 'not-finished' };
  if (input.players < 2) return { counted: false, why: 'one-player' };
  if (input.humans === 0 && !input.tournament) return { counted: false, why: 'no-human' };
  if (input.tableRound < MIN_RATED_ROUNDS && !input.someoneWon) {
    return { counted: false, why: 'too-short' };
  }
  return { counted: true };
}

export { DREAM_BOT_LEVELS };
