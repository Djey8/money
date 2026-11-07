import { EMERGENCY_CARDS } from './cashflow-emergency-cards';
import { DREAMFUND_SPECS } from './cashflow-professions-dreamfund';
import {
  quoteEmergency,
  type EmergencyCard,
  type EmergencySelection,
} from './cashflow-game/emergency-deck';

/**
 * The portfolio of the Emergency stack (JFK, 2026-11): 100 cards from small to huge, every kind of cost, every insurance at work, and a
 * price that is fair - a small card hits everybody small, a big one everybody in proportion.
 */
const NONE = { insurances: [], traits: [], openEmergencies: 0 };

/** What a card costs on average (base level, nobody insured): the faces of the die are averaged, of the choices the dearest counts. */
function expectedMinor(card: EmergencyCard): number {
  const variants: EmergencySelection[] =
    card.type === 'choice' ? (card.choices ?? []).map((choice) => ({ choiceId: choice.id })) : [{}];
  const costs = variants.map((variant) => {
    let total = 0;
    for (let face = 1; face <= 6; face += 1) {
      const rolls = { main: face, extra: face, reroll: face } as Record<string, number>;
      for (const bucket of card.buckets ?? []) rolls[`bucket:${bucket.id}`] = face;
      total += quoteEmergency(card, { ...variant, rolls }, NONE).fullMinor;
    }
    // a choice that waits for the next Payday rolls its cost then (wait and see): its average counts
    const waiting =
      card.choices?.find((choice) => choice.id === variant.choiceId)?.deferredDice ?? [];
    const deferred =
      waiting.reduce((sum, band) => sum + band.amountMinor * (band.to - band.from + 1), 0) / 6;
    return total / 6 + deferred;
  });
  return Math.max(...costs);
}

const BANDS: Record<string, [number, number]> = {
  spark: [0, 160],
  flame: [100, 800],
  blaze: [400, 2600],
  wildfire: [1500, 10000],
  inferno: [8000, Infinity],
};

describe('the portfolio of the Emergency stack', () => {
  it('has 114 cards from small to huge', () => {
    expect(EMERGENCY_CARDS).toHaveLength(114);
    const count = (tier: string) => EMERGENCY_CARDS.filter((card) => card.tier === tier).length;
    expect(count('spark')).toBeGreaterThanOrEqual(18);
    expect(count('flame')).toBeGreaterThanOrEqual(26);
    expect(count('blaze')).toBeGreaterThanOrEqual(25);
    expect(count('wildfire')).toBeGreaterThanOrEqual(16);
    expect(count('inferno')).toBeGreaterThanOrEqual(7);
  });

  it('a card costs what its tier says: spark under 160, flame to 800, blaze to 2,600, wildfire to 10,000, inferno more', () => {
    for (const card of EMERGENCY_CARDS) {
      const cost = expectedMinor(card) / 100;
      const [low, high] = BANDS[card.tier];
      expect({ id: card.id, tier: card.tier, ok: cost >= low && cost <= high, cost }).toEqual({
        id: card.id,
        tier: card.tier,
        ok: true,
        cost,
      });
    }
  });

  it("is fair: what a character's life costs follows the salary, so a card takes everyone the same share", () => {
    const ratios = DREAMFUND_SPECS.map((spec) => spec.gross / spec.scale);
    const mid = [...ratios].sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
    for (const ratio of ratios) {
      expect(ratio / mid).toBeGreaterThan(0.92);
      expect(ratio / mid).toBeLessThan(1.08);
    }
  });

  it('what is set by law or a fee does not scale, and is small', () => {
    for (const card of EMERGENCY_CARDS.filter((candidate) => candidate.fixedPrice)) {
      expect(expectedMinor(card)).toBeLessThanOrEqual(10000);
      expect(card.tier).toBe('spark');
    }
  });

  it('has every kind: fixed, dice, choice, several costs - to pay at once or on a plan', () => {
    const has = (type: string, payment: string) =>
      EMERGENCY_CARDS.some((card) => card.type === type && card.payment === payment);
    for (const type of ['fixed', 'dice']) {
      for (const payment of ['pay_now', 'plan_ok']) expect(has(type, payment)).toBe(true);
    }
    expect(EMERGENCY_CARDS.some((card) => card.type === 'choice')).toBe(true);
    expect(EMERGENCY_CARDS.some((card) => card.type === 'multi')).toBe(true);
  });

  it('every insurance works on several cards, the car ones on many', () => {
    const on = (kind: string) => EMERGENCY_CARDS.filter((card) => card.insurance === kind).length;
    expect(on('liability')).toBeGreaterThanOrEqual(6);
    expect(on('household')).toBeGreaterThanOrEqual(5);
    expect(on('legal')).toBeGreaterThanOrEqual(9);
    expect(on('dental')).toBeGreaterThanOrEqual(9);
    expect(on('travel')).toBeGreaterThanOrEqual(8);
    expect(on('disability')).toBeGreaterThanOrEqual(4);
    expect(on('car_partial')).toBeGreaterThanOrEqual(4);
    expect(on('car_full')).toBeGreaterThanOrEqual(3);
    expect(EMERGENCY_CARDS.filter((card) => card.requires === 'car').length).toBeGreaterThanOrEqual(
      14,
    );
  });

  it('an insured card costs the player less than an uninsured one', () => {
    for (const card of EMERGENCY_CARDS.filter((candidate) => candidate.insurance)) {
      const rolls = { main: 6, extra: 1, reroll: 6 } as Record<string, number>;
      for (const bucket of card.buckets ?? []) rolls[`bucket:${bucket.id}`] = 6;
      const selection: EmergencySelection = {
        rolls,
        ...(card.choices ? { choiceId: card.choices[card.choices.length - 1].id } : {}),
      };
      const without = quoteEmergency(card, selection, NONE);
      const kind = card.insurance === 'liability_keyloss' ? 'liability' : card.insurance!;
      const insured = quoteEmergency(card, selection, { ...NONE, insurances: [kind] });
      expect(insured.insured).toBe(true);
      expect(insured.payMinor).toBeLessThanOrEqual(without.payMinor);
    }
  });

  it('there is a card for every part of a life: car, pet, kids, partner, abroad, no job, short time, study, a flat share', () => {
    const needsOf = (card: EmergencyCard) => JSON.stringify(card.needs ?? {});
    const any = (test: (card: EmergencyCard) => boolean) => EMERGENCY_CARDS.some(test);
    expect(any((card) => card.requires === 'pet')).toBe(true);
    expect(any((card) => needsOf(card).includes('kidsAtLeast'))).toBe(true);
    expect(any((card) => needsOf(card).includes('cohabiting'))).toBe(true);
    expect(any((card) => needsOf(card).includes('married'))).toBe(true);
    expect(any((card) => needsOf(card).includes('abroad_europe'))).toBe(true);
    expect(any((card) => needsOf(card).includes('unemployed'))).toBe(true);
    expect(any((card) => needsOf(card).includes('short_time'))).toBe(true);
    expect(any((card) => needsOf(card).includes('education'))).toBe(true);
    expect(any((card) => needsOf(card).includes('shared_flat'))).toBe(true);
    expect(any((card) => needsOf(card).includes('with_parents'))).toBe(true);
    expect(any((card) => needsOf(card).includes('"pet":"dog"'))).toBe(true);
  });
});
