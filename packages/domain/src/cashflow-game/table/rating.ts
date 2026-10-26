/**
 * The leaderboard's scoring (todo/cashflow-leaderboard.md §5-§6): which finished tables count, and what a table that counts does to
 * everybody's rating. Pure - the same table gives the same changes - and versioned (`RATING_VERSION`), because the result records
 * are kept and a better scoring can be run over them again.
 *
 * A table is n·(n-1)/2 duels between the players who stayed. Each player's change is the sum of their duels' surprise - what
 * happened minus what the two ratings expected - so beating a weak opponent earns almost nothing and beating a strong one a lot,
 * which is how "a strong bot gives less than a weak one on winning" and "farming easy bots earns nothing" fall out of the maths.
 */

/** 2: those still playing at the end are placed by how close they are to escaping (passive income over all expenses). */
export const RATING_VERSION = 2;

export const START_RATING = 1500;
export const RATING_FLOOR = 100;
/** Tables of fewer rounds than this do not count, unless somebody escaped. */
export const MIN_RATED_ROUNDS = 8;
/** The default of a table's `leaveFreeRounds`: leaving a game that has started is a loss from its first moment. */
export const LEAVE_LOSS_AFTER_ROUND = 0;
/** The number of rated games a player is "provisional" for in the listing. */
export const PROVISIONAL_GAMES = 5;

const K_HUMAN_NEW = 40;
const K_HUMAN = 24;
const K_BOT = 8;
/** A human's first rated games move the rating faster. */
const NEW_PLAYER_GAMES = 20;
/** The weight of a win over a bot at the lowest level - the explicit cap on farming. */
const BEGINNER_WIN_WEIGHT = 0.25;
/** The weight of beating somebody who left: no contest happened. */
const LEFT_WIN_WEIGHT = 0.5;
/** What a table with one human among bots is worth, against 1 for a table of humans only. */
const FIELD_FLOOR = 0.4;

export type RatedOutcome = 'escaped' | 'playing' | 'bankrupt' | 'left';

export interface RatingParticipant {
  playerId: string;
  /** Humans start at 1500; bots at their calibrated rating (the caller passes whatever is current). */
  rating: number;
  /** Rated games so far (decides the human's K). */
  ratedGames: number;
  bot: boolean;
  /** For a bot: its strategy at its level (`champion-v2--casual`); a plain id is a master. */
  botId?: string;
  rank: number;
  outcome: RatedOutcome;
  /** Left after the game was past round 3: it counts as a loss. A player who left earlier is not given to this function at all. */
  leftLate?: boolean;
}

export interface RatingChange {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

export interface RankedFacts {
  /** The host's ranked setting. */
  ranked: boolean;
  phase: string;
  seats: number;
  humans: number;
  tableRound: number;
  /** Somebody escaped the rat race. */
  escaped: boolean;
  /** A person left the game after its free rounds: the game counts however short it was (leaving is a loss, not an escape from one). */
  abandoned?: boolean;
}

/** Whether a finished table counts for the rating, and the first reason it does not (for the player to read). */
export function rankedEligibility(facts: RankedFacts): { counts: boolean; why: string | null } {
  if (!facts.ranked) return { counts: false, why: 'not-ranked' };
  if (facts.phase !== 'finished') return { counts: false, why: 'not-finished' };
  if (facts.seats < 2) return { counts: false, why: 'too-few-seats' };
  if (facts.humans < 1) return { counts: false, why: 'no-human' };
  if (!facts.escaped && !facts.abandoned && facts.tableRound < MIN_RATED_ROUNDS)
    return { counts: false, why: 'too-short' };
  return { counts: true, why: null };
}

/** The expected score of a player rated `a` against one rated `b` (0..1). */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

function kOf(player: RatingParticipant): number {
  if (player.bot) return K_BOT;
  return player.ratedGames < NEW_PLAYER_GAMES ? K_HUMAN_NEW : K_HUMAN;
}

/** The level a bot id carries (`champion-v2--casual`); a plain id is a master. (The catalog itself stays out of the browser bundle.) */
function botLevelOf(player: RatingParticipant): string | null {
  if (!player.bot || !player.botId) return null;
  const at = player.botId.lastIndexOf('--');
  return at < 0 ? 'master' : player.botId.slice(at + 2);
}

/**
 * The rating changes of one table that counts. `repeats` is how many earlier rated games the same set of humans played together in
 * the last 24 hours (the anti-collusion rule: the k-th repeat is worth 1/(1+k)).
 */
export function scoreTable(
  participants: RatingParticipant[],
  options: { repeats?: number } = {},
): RatingChange[] {
  const n = participants.length;
  const humans = participants.filter((p) => !p.bot).length;
  if (n < 2 || humans < 1) {
    return participants.map((p) => ({
      playerId: p.playerId,
      before: p.rating,
      after: p.rating,
      delta: 0,
    }));
  }
  const field = Math.min(1, FIELD_FLOOR + ((1 - FIELD_FLOOR) * (humans - 1)) / (n - 1));
  const repeatFactor = humans > 1 ? 1 / (1 + Math.max(0, options.repeats ?? 0)) : 1;

  return participants.map((me) => {
    let surprise = 0;
    for (const other of participants) {
      if (other === me) continue;
      const score = me.rank < other.rank ? 1 : me.rank > other.rank ? 0 : 0.5;
      let gap = score - expectedScore(me.rating, other.rating);
      if (gap > 0) {
        // a win is worth less when nothing was contested or the opponent is a beginner bot; a loss always counts in full
        if (other.outcome === 'left' && !other.leftLate) gap *= LEFT_WIN_WEIGHT;
        if (botLevelOf(other) === 'beginner') gap *= BEGINNER_WIN_WEIGHT;
      }
      surprise += gap;
    }
    const factor = me.bot ? 1 : repeatFactor;
    const delta = round2((kOf(me) * field * factor * surprise) / (n - 1));
    const after = Math.max(RATING_FLOOR, round2(me.rating + delta));
    return { playerId: me.playerId, before: me.rating, after, delta: round2(after - me.rating) };
  });
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * A bot's starting rating from how often it won tables in a calibration run: 25% at four seats is par (1500), and every
 * doubling of the odds against par is worth about 120 points. Floored at 1000 and capped at 2200.
 */
export function ratingFromWinShare(share: number, seats = 4): number {
  const par = 1 / seats;
  const clamped = Math.min(0.99, Math.max(0.005, share));
  const odds = clamped / (1 - clamped);
  const parOdds = par / (1 - par);
  const rating = START_RATING + 400 * Math.log10(odds / parOdds);
  return Math.round(Math.min(2200, Math.max(1000, rating)));
}
