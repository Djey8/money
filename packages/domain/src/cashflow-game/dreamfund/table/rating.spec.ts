import {
  botStartRating,
  characterStrength,
  countsForRating,
  expected,
  rateTable,
  type RatedSeat,
} from './rating';

const seat = (over: Partial<RatedSeat> & { playerId: string }): RatedSeat => ({
  type: 'human',
  rating: 1500,
  ratedGames: 30,
  character: null,
  rank: 1,
  outcome: 'playing',
  ...over,
});

describe('the rating of the Dreamfund board', () => {
  it('makes a hard character stronger-valued than an easy one, from the map', () => {
    const jan = characterStrength('jan-oberarzt', 'hard');
    const peter = characterStrength('peter-busfahrer', 'hard');
    expect(jan).toBeLessThan(0);
    expect(peter).toBeGreaterThan(jan);
    expect(characterStrength(null, 'medium')).toBe(0);
    expect(characterStrength('nobody', 'medium')).toBe(0);
  });

  it('starts a bot where the map says: the best master at 1500, a lower strategy or level below', () => {
    const best = botStartRating('sapling', 'medium');
    const expert = botStartRating('expert', 'medium');
    expect(Math.max(best, expert)).toBeLessThanOrEqual(1500);
    expect(Math.max(best, expert)).toBeGreaterThan(1400);
    expect(botStartRating('saver', 'medium')).toBeLessThan(best - 100);
    expect(botStartRating('expert--beginner', 'medium')).toBeLessThan(expert - 200);
    expect(botStartRating('expert--casual', 'medium')).toBeLessThan(expert);
    expect(botStartRating('nobody', 'medium')).toBe(1500);
  });

  it('moves the winner up and the loser down by the same, and nothing for equal duels', () => {
    const changes = rateTable(
      [seat({ playerId: 'a', rank: 1 }), seat({ playerId: 'b', rank: 2 })],
      'medium',
    );
    const a = changes.find((c) => c.playerId === 'a')!;
    const b = changes.find((c) => c.playerId === 'b')!;
    expect(a.delta).toBeGreaterThan(0);
    expect(a.delta + b.delta).toBeCloseTo(0, 5);
    expect(a.delta).toBeCloseTo(12, 0);
  });

  it('pays more for beating a strong player than a weak one, and for a win with a harder character', () => {
    const strong = rateTable(
      [seat({ playerId: 'a', rank: 1 }), seat({ playerId: 'b', rank: 2, rating: 1800 })],
      'medium',
    );
    const weak = rateTable(
      [seat({ playerId: 'a', rank: 1 }), seat({ playerId: 'b', rank: 2, rating: 1200 })],
      'medium',
    );
    expect(strong[0].delta).toBeGreaterThan(weak[0].delta);
    const hard = rateTable(
      [
        seat({ playerId: 'a', rank: 1, character: 'jan-oberarzt' }),
        seat({ playerId: 'b', rank: 2, character: 'peter-busfahrer' }),
      ],
      'hard',
    );
    const easy = rateTable(
      [
        seat({ playerId: 'a', rank: 1, character: 'peter-busfahrer' }),
        seat({ playerId: 'b', rank: 2, character: 'jan-oberarzt' }),
      ],
      'hard',
    );
    expect(hard[0].delta).toBeGreaterThan(easy[0].delta);
  });

  it('moves a bot less than a new person, and never below the floor', () => {
    const changes = rateTable(
      [
        seat({ playerId: 'person', rank: 1, ratedGames: 2 }),
        seat({ playerId: 'bot', type: 'bot', rank: 2 }),
      ],
      'medium',
    );
    expect(changes[0].delta).toBeGreaterThan(Math.abs(changes[1].delta));
    const low = rateTable(
      [
        seat({ playerId: 'a', rank: 2, rating: 100 }),
        seat({ playerId: 'b', rank: 1, rating: 100 }),
      ],
      'medium',
    );
    expect(low[0].after).toBe(100);
  });

  it('lets a leaver lose to everybody who stayed', () => {
    const changes = rateTable(
      [
        seat({ playerId: 'a', rank: 1 }),
        seat({ playerId: 'b', rank: 2, outcome: 'left' }),
        seat({ playerId: 'c', rank: 3 }),
      ],
      'medium',
    );
    expect(changes.find((c) => c.playerId === 'b')!.delta).toBeLessThan(0);
    expect(changes.find((c) => c.playerId === 'c')!.delta).toBeGreaterThan(
      changes.find((c) => c.playerId === 'b')!.delta,
    );
  });

  it('expects half of equals', () => {
    expect(expected({ rating: 1500, strength: 0 }, { rating: 1500, strength: 0 })).toBeCloseTo(
      0.5,
      5,
    );
  });

  it('counts a finished ranked table with a person, long enough or won - nothing else', () => {
    const base = {
      ranked: true,
      phase: 'finished',
      players: 3,
      humans: 1,
      tableRound: 20,
      someoneWon: false,
    };
    expect(countsForRating(base).counted).toBe(true);
    expect(countsForRating({ ...base, ranked: false }).why).toBe('not-ranked');
    expect(countsForRating({ ...base, phase: 'abandoned' }).why).toBe('not-finished');
    expect(countsForRating({ ...base, humans: 0 }).why).toBe('no-human');
    expect(countsForRating({ ...base, tableRound: 3 }).why).toBe('too-short');
    expect(countsForRating({ ...base, tableRound: 3, someoneWon: true }).counted).toBe(true);
    expect(countsForRating({ ...base, ranked: false, humans: 0, tournament: true }).counted).toBe(
      true,
    );
  });
});
