import {
  MIN_RATED_ROUNDS,
  RATING_FLOOR,
  expectedScore,
  rankedEligibility,
  ratingFromWinShare,
  scoreTable,
  type RatingParticipant,
} from './rating';

const human = (id: string, rank: number, rating = 1500, ratedGames = 30): RatingParticipant => ({
  playerId: id,
  rating,
  ratedGames,
  bot: false,
  rank,
  outcome: rank === 1 ? 'escaped' : 'playing',
});
const bot = (
  id: string,
  rank: number,
  rating: number,
  botId = 'champion-v2',
): RatingParticipant => ({
  playerId: id,
  rating,
  ratedGames: 500,
  bot: true,
  botId,
  rank,
  outcome: rank === 1 ? 'escaped' : 'playing',
});
const delta = (changes: ReturnType<typeof scoreTable>, id: string) =>
  changes.find((c) => c.playerId === id)!.delta;

describe('which tables count', () => {
  const facts = {
    ranked: true,
    phase: 'finished',
    seats: 4,
    humans: 2,
    tableRound: 12,
    escaped: true,
  };
  it('counts a finished ranked table with a human and enough rounds', () => {
    expect(rankedEligibility(facts)).toEqual({ counts: true, why: null });
    expect(rankedEligibility({ ...facts, escaped: false })).toEqual({ counts: true, why: null });
  });
  it('says why one does not, first reason first', () => {
    expect(rankedEligibility({ ...facts, ranked: false }).why).toBe('not-ranked');
    expect(rankedEligibility({ ...facts, phase: 'abandoned' }).why).toBe('not-finished');
    expect(rankedEligibility({ ...facts, seats: 1 }).why).toBe('too-few-seats');
    expect(rankedEligibility({ ...facts, humans: 0 }).why).toBe('no-human');
    expect(
      rankedEligibility({ ...facts, escaped: false, tableRound: MIN_RATED_ROUNDS - 1 }).why,
    ).toBe('too-short');
    // a short game with an escape counts
    expect(rankedEligibility({ ...facts, tableRound: 3 }).counts).toBe(true);
  });
});

describe('the rating of a table', () => {
  it('between equals the winner gains what the loser loses', () => {
    const changes = scoreTable([human('a', 1), human('b', 2)]);
    expect(delta(changes, 'a')).toBeGreaterThan(0);
    expect(delta(changes, 'a')).toBeCloseTo(-delta(changes, 'b'), 1);
    expect(delta(changes, 'a')).toBeCloseTo(12, 0); // K 24 * 0.5
  });

  it('a win never lowers the rating, a loss never raises it, a tie of equals changes nothing', () => {
    for (const ratings of [
      [1200, 1800],
      [1800, 1200],
      [1500, 1500],
    ]) {
      const changes = scoreTable([human('a', 1, ratings[0]), human('b', 2, ratings[1])]);
      expect(delta(changes, 'a')).toBeGreaterThanOrEqual(0);
      expect(delta(changes, 'b')).toBeLessThanOrEqual(0);
    }
    const tie = scoreTable([human('a', 1), human('b', 1)]);
    expect(tie.map((c) => c.delta)).toEqual([0, 0]);
  });

  it('beating a strong player is worth more than beating a weak one', () => {
    const strong = scoreTable([human('me', 1), human('x', 2, 1900)]);
    const weak = scoreTable([human('me', 1), human('x', 2, 1100)]);
    expect(delta(strong, 'me')).toBeGreaterThan(delta(weak, 'me') * 3);
  });

  it('a table of humans is worth more than one human among bots', () => {
    const humans = scoreTable([human('a', 1), human('b', 2), human('c', 3), human('d', 4)]);
    const withBots = scoreTable([
      human('a', 1),
      bot('b', 2, 1500),
      bot('c', 3, 1500, 'champion-v2--strong'),
      bot('d', 4, 1500, 'champion-v1'),
    ]);
    expect(delta(humans, 'a')).toBeGreaterThan(delta(withBots, 'a') * 2);
  });

  it('winning against beginner bots earns very little, losing to them costs in full', () => {
    const farm = scoreTable([
      human('me', 1),
      bot('b1', 2, 1500, 'champion-v2--beginner'),
      bot('b2', 3, 1500, 'all-rounder--beginner'),
    ]);
    const real = scoreTable([
      human('me', 1),
      bot('b1', 2, 1500),
      bot('b2', 3, 1500, 'all-rounder'),
    ]);
    expect(delta(farm, 'me')).toBeLessThan(delta(real, 'me') / 3);
    const lost = scoreTable([
      human('me', 3),
      bot('b1', 1, 1500, 'champion-v2--beginner'),
      bot('b2', 2, 1500, 'all-rounder--beginner'),
    ]);
    const lostReal = scoreTable([
      human('me', 3),
      bot('b1', 1, 1500),
      bot('b2', 2, 1500, 'all-rounder'),
    ]);
    expect(delta(lost, 'me')).toBeCloseTo(delta(lostReal, 'me'), 5);
  });

  it('a strong bot gains less than a weak bot for winning the same table', () => {
    const lineup = (winner: number) => [
      bot('w', 1, winner),
      human('h', 2),
      bot('o', 3, 1500, 'all-rounder'),
    ];
    expect(delta(scoreTable(lineup(1900)), 'w')).toBeLessThan(delta(scoreTable(lineup(1300)), 'w'));
  });

  it('new humans move faster than settled ones, bots slowest', () => {
    const fresh = scoreTable([human('a', 1, 1500, 0), human('b', 2, 1500, 0)]);
    const settled = scoreTable([human('a', 1), human('b', 2)]);
    expect(delta(fresh, 'a')).toBeGreaterThan(delta(settled, 'a'));
    const bots = scoreTable([bot('a', 1, 1500), human('b', 2)]);
    expect(Math.abs(delta(bots, 'a'))).toBeLessThan(delta(settled, 'a'));
  });

  it('beating somebody who left is worth half; the same pair again and again is worth less', () => {
    const leaver = { ...human('l', 2), outcome: 'left' as const };
    const normal = scoreTable([human('a', 1), human('b', 2)]);
    const left = scoreTable([human('a', 1), leaver]);
    expect(delta(left, 'a')).toBeCloseTo(delta(normal, 'a') / 2, 1);
    const again = scoreTable([human('a', 1), human('b', 2)], { repeats: 3 });
    expect(delta(again, 'a')).toBeCloseTo(delta(normal, 'a') / 4, 1);
  });

  it('never moves a table without a human, and never below the floor', () => {
    const bots = scoreTable([bot('a', 1, 1500), bot('b', 2, 1400)]);
    expect(bots.map((c) => c.delta)).toEqual([0, 0]);
    const low = scoreTable([human('a', 1, 3000), human('b', 2, RATING_FLOOR + 1, 0)]);
    expect(low.find((c) => c.playerId === 'b')!.after).toBeGreaterThanOrEqual(RATING_FLOOR);
  });

  it('the changes of a table add up to little (bounded drift)', () => {
    const changes = scoreTable([
      human('a', 1, 1700),
      human('b', 2, 1500),
      bot('c', 3, 1500, 'all-rounder'),
      bot('d', 4, 1300, 'sleepy-sam'),
    ]);
    const total = changes.reduce((sum, c) => sum + c.delta, 0);
    expect(Math.abs(total)).toBeLessThan(10);
  });
});

describe('expected score and calibration', () => {
  it('is symmetric and 0.5 for equals', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1700, 1500) + expectedScore(1500, 1700)).toBeCloseTo(1, 10);
  });
  it('turns a win share into a rating: par at four seats is 1500', () => {
    expect(ratingFromWinShare(0.25)).toBe(1500);
    expect(ratingFromWinShare(0.46)).toBeGreaterThan(1600);
    expect(ratingFromWinShare(0.1)).toBeLessThan(1400);
    expect(ratingFromWinShare(0)).toBe(1000);
    expect(ratingFromWinShare(0.95)).toBeLessThanOrEqual(2200);
  });
});
