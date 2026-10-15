import { PRESET_POLICIES } from '../simulation/strategies';
import {
  buildLineups,
  headToHead,
  playMatch,
  scoreMatches,
  winsBySeat,
  type MatchResult,
} from './tournament';

jest.setTimeout(120_000);

const byId = (id: string) => PRESET_POLICIES.find((p) => p.id === id)!;

describe('playMatch', () => {
  it('plays a whole table with a fixed profession per seat and says who won', () => {
    const match = playMatch({
      seed: 7,
      policies: [byId('all-rounder'), byId('mlm-then-properties'), byId('never-buy')],
      professionIds: ['lehrer', 'lehrer', 'pilot'],
    });
    expect(match.problems).toEqual([]);
    expect(match.cutOff).toBe(false);
    expect(match.seats.map((s) => s.professionId)).toEqual(['lehrer', 'lehrer', 'pilot']);
    expect(match.seats.map((s) => s.policyId)).toEqual([
      'all-rounder',
      'mlm-then-properties',
      'never-buy',
    ]);
    expect([...match.seats.map((s) => s.rank)].sort()).toEqual([1, 2, 3]);
    if (match.winnerSeat !== null) {
      expect(match.seats[match.winnerSeat].outcome).toBe('escaped');
      expect(match.seats[match.winnerSeat].rank).toBe(1);
    }
  });

  it('is reproducible: the same seed and lineup play the same table', () => {
    const config = {
      seed: 11,
      policies: [byId('all-rounder'), byId('cash-properties')],
      professionIds: ['manager', 'manager'],
    };
    expect(playMatch(config)).toEqual(playMatch(config));
  });

  it('a different seed plays a different table', () => {
    const base = {
      policies: [byId('all-rounder'), byId('cash-properties')],
      professionIds: ['manager', 'manager'],
    };
    const a = playMatch({ ...base, seed: 1 });
    const b = playMatch({ ...base, seed: 2 });
    expect([a.commands, a.tableRound]).not.toEqual([b.commands, b.tableRound]);
  });

  it('plays under the strict rules too', () => {
    const match = playMatch({
      seed: 3,
      rulesBase: 'strict',
      policies: [byId('all-rounder'), byId('picky-properties')],
      professionIds: ['arzt', 'arzt'],
    });
    expect(match.problems).toEqual([]);
    expect(match.cutOff).toBe(false);
  });
});

describe('scoreMatches', () => {
  const match = (
    seed: number,
    outcomes: [string, string, number, 'escaped' | 'bankrupt' | 'playing'][],
  ): MatchResult => ({
    seed,
    seats: outcomes.map(([policyId, , rank, outcome], seat) => ({
      seat,
      policyId,
      professionId: 'x',
      rank,
      outcome,
      rolls: 50 + seat,
      passiveIncomeMinor: 0,
      monthlyCashflowMinor: 0,
    })),
    winnerSeat: outcomes.findIndex(([, , rank, outcome]) => rank === 1 && outcome === 'escaped'),
    reason: 'escaped',
    tableRound: 1,
    commands: 1,
    problems: [],
    cutOff: false,
  });

  const results = [
    match(1, [
      ['a', '', 1, 'escaped'],
      ['b', '', 2, 'playing'],
    ]),
    match(2, [
      ['b', '', 1, 'escaped'],
      ['a', '', 2, 'bankrupt'],
    ]),
    match(3, [
      ['a', '', 1, 'escaped'],
      ['b', '', 2, 'bankrupt'],
    ]),
  ];

  it('counts wins, ranks, escapes and bankruptcies per policy, best first', () => {
    const scores = scoreMatches(results);
    expect(scores.map((s) => s.policyId)).toEqual(['a', 'b']);
    const a = scores[0];
    expect(a).toMatchObject({ appearances: 3, wins: 2, escapes: 2, bankrupt: 1 });
    expect(a.winRate).toBeCloseTo(2 / 3);
    expect(a.meanRank).toBeCloseTo((1 + 2 + 1) / 3);
    expect(a.expectedWinRate).toBeCloseTo(0.5);
    expect(a.winInterval.low).toBeLessThan(a.winRate);
    expect(a.winInterval.high).toBeGreaterThan(a.winRate);
  });

  it('counts head to head and wins by seat', () => {
    expect(headToHead(results)).toEqual([{ a: 'a', b: 'b', tables: 3, aWins: 2, bWins: 1 }]);
    expect(winsBySeat(results)).toEqual([
      { seat: 0, tables: 3, wins: 3 }, // in this fixture the winner always sits first
      { seat: 1, tables: 3, wins: 0 },
    ]);
  });
});

describe('buildLineups', () => {
  it('gives every policy every seat equally often', () => {
    const lineups = buildLineups(['a', 'b', 'c', 'd'], 3, 6, 5);
    expect(lineups).toHaveLength(18);
    for (let seat = 0; seat < 3; seat += 1) {
      const seen = lineups.map((l) => l[seat]);
      // each round's group rotates through the seat, so within a round every member sits there once
      expect(seen.length).toBe(18);
    }
    for (let round = 0; round < 6; round += 1) {
      const group = lineups.slice(round * 3, round * 3 + 3);
      for (let seat = 0; seat < 3; seat += 1) {
        expect(new Set(group.map((l) => l[seat])).size).toBe(3);
      }
    }
  });

  it('is seeded, and pads when there are fewer policies than seats', () => {
    expect(buildLineups(['a', 'b', 'c'], 2, 4, 9)).toEqual(buildLineups(['a', 'b', 'c'], 2, 4, 9));
    const padded = buildLineups(['a', 'b'], 4, 1, 1);
    expect(padded.every((l) => l.length === 4)).toBe(true);
  });
});
