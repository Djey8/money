import { EMERGENCY_CARDS } from '../cashflow-emergency-cards';
import { INSURANCE_CATALOG } from './insurance';
import { insuranceValue } from './insurance-value';
import { INITIAL_LIFE_STATE, type LifeState } from './life-deck';

/**
 * A premium that is paid every month has to be worth it (JFK, 2026-11): for every life the stack can hit, an insurance saves more
 * on average than it costs. The cards each insurance works on are the whole point of it.
 */
const life = (change: Partial<LifeState>): LifeState => ({ ...INITIAL_LIFE_STATE, ...change });
const LIVES: Record<string, LifeState> = {
  'single, a flat': life({}),
  'single with a car': life({ car: true }),
  'a couple with a car': life({ relationship: 'married', car: true, home: 'with_partner' }),
  'a family with a car and a dog': life({
    relationship: 'married',
    kids: 2,
    pet: 'dog',
    car: true,
    home: 'with_partner',
  }),
  'single, abroad': life({ location: 'abroad_europe', home: 'shared_flat' }),
};

const PAID = INSURANCE_CATALOG.filter((info) => info.baseMinor !== undefined);

describe('what an insurance is worth', () => {
  it('has the travel and the disability insurance in the catalogue, the disability one right after the household insurance', () => {
    const kinds = INSURANCE_CATALOG.map((info) => info.kind);
    expect(kinds).toEqual(expect.arrayContaining(['travel', 'disability']));
    const byPriority = [...INSURANCE_CATALOG]
      .sort((a, b) => a.priority - b.priority)
      .map((i) => i.kind);
    expect(byPriority.indexOf('disability')).toBe(byPriority.indexOf('household') + 1);
  });

  it.each(PAID.map((info) => info.kind))(
    '%s saves more than it costs, for every life it applies to',
    (kind) => {
      const needsCar = kind === 'car_partial' || kind === 'car_full';
      for (const [name, state] of Object.entries(LIVES)) {
        if (needsCar && !state.car) continue;
        const value = insuranceValue(kind, EMERGENCY_CARDS, state);
        expect({ kind, life: name, worth: value.ratio > 1 }).toEqual({
          kind,
          life: name,
          worth: true,
        });
      }
    },
  );

  it('the bigger the life, the more an insurance saves: the cards grow with the price level, the premium with its root', () => {
    const small = insuranceValue('legal', EMERGENCY_CARDS, LIVES['single, a flat'], 1);
    const big = insuranceValue('legal', EMERGENCY_CARDS, LIVES['single, a flat'], 3.9);
    expect(big.ratio).toBeGreaterThan(small.ratio);
  });

  it('works out the parts: a share of the cards, a sum a month, the premium', () => {
    const value = insuranceValue('disability', EMERGENCY_CARDS, LIVES['single, a flat']);
    expect(value.coveredShare).toBeGreaterThan(0.04);
    expect(value.savedPerMonthMinor).toBeGreaterThan(value.premiumMinor);
    expect(value.premiumMinor).toBe(4000);
  });
});
