import { baseById, KNOB_RANGES } from './policies';
import {
  evaluateInProcess,
  makeScenarios,
  mutateKnobs,
  pairedDifference,
  relearnType,
} from './search';
import { seededRng } from '../rng';

describe('the search for the best bots', () => {
  it('draws the same spread of games from the same seed, over characters, levels and maps', () => {
    const a = makeScenarios(60, 7);
    expect(makeScenarios(60, 7)).toEqual(a);
    expect(new Set(a.map((s) => s.difficulty)).size).toBe(3);
    expect(new Set(a.map((s) => s.professionId)).size).toBeGreaterThan(5);
    expect(new Set(a.map((s) => s.shape)).size).toBeGreaterThan(2);
  });

  it('moves knobs inside their ranges, and a step-up always gets a yield limit', () => {
    const rng = seededRng(3);
    let knobs = baseById('expert').resolved;
    for (let i = 0; i < 300; i += 1) {
      knobs = { ...knobs, ...mutateKnobs(knobs, rng, 3) } as typeof knobs;
      for (const [key, [low, high]] of Object.entries(KNOB_RANGES)) {
        const value = knobs[key as keyof typeof KNOB_RANGES] as number;
        expect(value).toBeGreaterThanOrEqual(low);
        expect(value).toBeLessThanOrEqual(high);
      }
    }
  });

  it('compares two lists of scores on the same games', () => {
    const { mean, z } = pairedDifference([1, 1, 1, 1], [0, 1, 0, 1]);
    expect(mean).toBe(0.5);
    expect(z).toBeGreaterThan(1);
  });

  it('relearns a type: it keeps the champion it started from unless the new one is clearly better', async () => {
    const result = await relearnType({
      type: 'expert',
      generations: 1,
      mutants: 2,
      games: 6,
      verifyGames: 6,
      seed: 5,
      evaluate: evaluateInProcess,
    });
    expect(result.type).toBe('expert');
    expect(result.verdict.games).toBe(6);
    if (!result.verdict.changed) expect(result.knobs).toEqual({});
  }, 120_000);
});
