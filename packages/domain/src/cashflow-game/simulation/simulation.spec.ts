import { CASHFLOW_GAME_SETS } from '../../cashflow-content';
import { PRESET_POLICIES, paramPolicy } from './strategies';
import { simulateGame, type SimConfig } from './session';
import { summarizeGames, spreadOf, wilsonInterval, percentile } from './stats';

const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'cashflow')!;
const professionId = set.professions[0].id;
const play = (policyId: string, seed: number, extra: Partial<SimConfig> = {}) =>
  simulateGame({
    gameSets: CASHFLOW_GAME_SETS,
    gameSetId: 'cashflow',
    professionId,
    policy: PRESET_POLICIES.find((policy) => policy.id === policyId)!,
    seed,
    ...extra,
  });

describe('simulateGame', () => {
  it('plays the same game for the same seed and policy', () => {
    const a = play('all-rounder', 11, { keepDecisions: true });
    const b = play('all-rounder', 11, { keepDecisions: true });
    expect(b).toEqual(a);
    expect(a.decisions!.length).toBeGreaterThan(5);
  });

  it('plays different games for different seeds', () => {
    expect(play('cash-properties', 1).turns).not.toBe(play('cash-properties', 2).turns);
  });

  it('a strategy that never buys never escapes', () => {
    for (const seed of [1, 2, 3, 4]) {
      const record = play('never-buy', seed, { maxTurns: 150 });
      expect(record.purchases).toEqual([]);
      expect(record.outcome).not.toBe('escaped');
    }
  });

  it.each(PRESET_POLICIES.map((policy) => policy.id))(
    '%s: plays out without a rule error and keeps the books sane',
    (policyId) => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const record = play(policyId, seed, { maxTurns: 250 });
        expect(['escaped', 'bankrupt', 'timeout']).toContain(record.outcome);
        expect(record.children).toBeLessThanOrEqual(3);
        expect(record.rounds).toBeGreaterThan(0);
        expect(record.peakPassiveIncomeMinor).toBeGreaterThanOrEqual(record.passiveIncomeMinor);
        if (record.outcome === 'escaped') {
          expect(record.passiveIncomeMinor).toBeGreaterThanOrEqual(record.expensesMinor);
        }
      }
    },
  );

  it('buying properties does escape the rat race, within a few dozen rolls to a couple of hundred', () => {
    const records = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => play('cash-properties', seed));
    const stats = summarizeGames(records);
    expect(stats.escaped).toBeGreaterThan(4);
    expect(stats.turnsToEscape!.median).toBeLessThan(250);
  });

  it('a custom strategy from the knobs plays too', () => {
    const policy = paramPolicy('mine', 'Mine', 'x', {
      minMonthlyReturn: 0.05,
      reserveMinor: 500000,
    });
    const record = simulateGame({
      gameSets: CASHFLOW_GAME_SETS,
      gameSetId: 'cashflow',
      professionId,
      policy,
      seed: 3,
    });
    expect(record.policyId).toBe('mine');
  });
});

describe('statistics', () => {
  it('percentiles are numbers that occurred (nearest rank)', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 0.5)).toBe(5);
    expect(percentile(sorted, 0.9)).toBe(9);
    expect(spreadOf([])).toBeNull();
    expect(spreadOf([3, 1, 2])).toMatchObject({ min: 1, median: 2, max: 3, mean: 2 });
  });

  it('a rate carries the uncertainty of how many games it rests on', () => {
    const few = wilsonInterval(5, 10);
    const many = wilsonInterval(500, 1000);
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
    expect(many.low).toBeLessThan(0.5);
    expect(many.high).toBeGreaterThan(0.5);
  });
});
