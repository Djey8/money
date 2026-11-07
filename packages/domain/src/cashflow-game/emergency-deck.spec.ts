import { EMERGENCY_CARDS } from '../cashflow-emergency-cards';
import {
  drawEmergencyCard,
  emptyEmergencyDeck,
  EMERGENCY_PLANS,
  INSURANCE_DEDUCTIBLE_CAP_MINOR,
  planQuote,
  quoteEmergency,
  type EmergencyCard,
  type EmergencyContext,
} from './emergency-deck';
import {
  applyInsuranceChanges,
  droppedPremiumTitles,
  initialInsurance,
  insuranceOffers,
  queueInsuranceChange,
} from './insurance';
import { INITIAL_LIFE_STATE, type LifeState } from './life-deck';
import { seededRng } from './rng';
import { initialCashflowGameState } from './types';

const card = (id: string): EmergencyCard => EMERGENCY_CARDS.find((c) => c.id === id)!;
const insured: EmergencyContext = {
  insurances: ['liability', 'household'],
  traits: [],
  openEmergencies: 0,
};
const bare: EmergencyContext = { insurances: [], traits: [], openEmergencies: 0 };

describe('the Emergency stack (temp_cards v0.2)', () => {
  it('has the 114 cards, each once, in English and German', () => {
    expect(EMERGENCY_CARDS).toHaveLength(114);
    expect(new Set(EMERGENCY_CARDS.map((c) => c.id)).size).toBe(114);
    for (const c of EMERGENCY_CARDS) {
      expect(c.title.en && c.title.de && c.story.en && c.story.de).toBeTruthy();
      expect(c.actions.length).toBeGreaterThan(0);
      for (const a of c.actions) expect(a.text.en && a.text.de).toBeTruthy();
      for (const b of c.buckets ?? []) expect(b.title.en && b.title.de).toBeTruthy();
      for (const ch of c.choices ?? []) expect(ch.label.en && ch.label.de).toBeTruthy();
    }
    // the game money is Dream Taler in English and Traumtaler in German, never the other way round
    for (const c of EMERGENCY_CARDS) expect(c.story.en).not.toMatch(/\bTT\b/);
  });

  it('every card can be paid: its cost is known once what it asks for is picked and rolled', () => {
    for (const c of EMERGENCY_CARDS) {
      let selection: Parameters<typeof quoteEmergency>[1] = {};
      if (c.type === 'choice') selection = { choiceId: c.choices![0].id };
      let quote = quoteEmergency(c, selection, bare);
      const rolls: Record<string, number> = {};
      for (const key of quote.needsRolls) rolls[key] = 6;
      selection = { ...selection, rolls };
      quote = quoteEmergency(c, selection, bare);
      expect(quote.ready).toBe(true);
      expect(quote.payMinor).toBeGreaterThanOrEqual(0);
    }
  });

  it('a fixed card costs what it says; insurance below the cap changes nothing', () => {
    expect(quoteEmergency(card('E02'), {}, bare).payMinor).toBe(2500);
    expect(quoteEmergency(card('E01'), {}, insured).payMinor).toBe(5000);
  });

  it('a dice card waits for its roll, then costs the band the roll falls in', () => {
    const waiting = quoteEmergency(card('E03'), {}, bare);
    expect(waiting.ready).toBe(false);
    expect(waiting.needsRolls).toEqual(['main']);
    expect(quoteEmergency(card('E03'), { rolls: { main: 2 } }, bare).payMinor).toBe(700);
    expect(quoteEmergency(card('E03'), { rolls: { main: 5 } }, bare).payMinor).toBe(6000);
  });

  it('a choice card waits for the choice', () => {
    expect(quoteEmergency(card('E09'), {}, bare).needsChoice).toBe(true);
    expect(quoteEmergency(card('E09'), { choiceId: 'B' }, bare).payMinor).toBe(30000);
    // a complete bonus booklet makes the standard crown cheaper
    expect(quoteEmergency(card('E13'), { choiceId: 'A' }, bare).payMinor).toBe(15000);
    expect(
      quoteEmergency(card('E13'), { choiceId: 'A' }, { ...bare, traits: ['bonusheft'] }).payMinor,
    ).toBe(11500);
  });

  it('insurance limits an insured card to the deductible, uninsured pays it all', () => {
    const burglary = card('E26');
    const without = quoteEmergency(burglary, {}, bare);
    expect(without.payMinor).toBe(without.fullMinor);
    expect(without.fullMinor).toBeGreaterThan(INSURANCE_DEDUCTIBLE_CAP_MINOR);
    const withCover = quoteEmergency(burglary, {}, insured);
    expect(withCover.insured).toBe(true);
    expect(withCover.payMinor).toBe(INSURANCE_DEDUCTIBLE_CAP_MINOR);
    expect(withCover.savedMinor).toBe(without.fullMinor - INSURANCE_DEDUCTIBLE_CAP_MINOR);
    expect(withCover.buckets).toHaveLength(1);
    // the liability covers the key-loss clause of the stack; a stolen bike is the household insurance's, with its own deductible
    expect(quoteEmergency(card('E35'), {}, insured).payMinor).toBe(INSURANCE_DEDUCTIBLE_CAP_MINOR);
    const bike = quoteEmergency(card('E18'), { rolls: { main: 6 } }, insured);
    expect(bike.insured).toBe(true);
    expect(bike.payMinor).toBe(20000);
  });

  it('the flat that burns down: the insured player rolls the hotel overrun on top of the deductible', () => {
    const fire = card('E30');
    const waiting = quoteEmergency(fire, {}, insured);
    expect(waiting.needsRolls).toEqual(['extra']);
    expect(quoteEmergency(fire, { rolls: { extra: 2 } }, insured).payMinor).toBe(50000);
    expect(quoteEmergency(fire, { rolls: { extra: 6 } }, insured).payMinor).toBe(150000);
    // without a household insurance it is all of it, no roll
    expect(quoteEmergency(fire, {}, bare).payMinor).toBe(2550000);
  });

  it('the modifiers: a dunning letter costs more with another emergency open', () => {
    expect(quoteEmergency(card('E06'), {}, bare).payMinor).toBe(3000);
    expect(quoteEmergency(card('E06'), {}, { ...bare, openEmergencies: 1 }).payMinor).toBe(4000);
  });

  it('the tenants association: pay a little, roll again and keep the lower', () => {
    const base = quoteEmergency(card('E21'), { rolls: { main: 6 } }, bare);
    expect(base.canReroll).toBe(true);
    const again = quoteEmergency(card('E21'), { rolls: { main: 6 }, rerolled: true }, bare);
    expect(again.needsRolls).toEqual(['reroll']);
    const done = quoteEmergency(
      card('E21'),
      { rolls: { main: 6, reroll: 1 }, rerolled: true },
      bare,
    );
    expect(done.payMinor).toBe(20000 + 9000);
  });

  it('a payment plan: a flat surcharge, equal parts, never paying less than owed', () => {
    expect(EMERGENCY_PLANS.map((p) => [p.months, p.percent])).toEqual([
      [3, 10],
      [6, 20],
      [12, 35],
    ]);
    const plan = planQuote(60000, 6);
    expect(plan.totalMinor).toBe(72000);
    expect(plan.perMonthMinor).toBe(12000);
    expect(plan.surchargeMinor).toBe(12000);
    const odd = planQuote(10001, 3);
    expect(odd.totalMinor).toBeGreaterThanOrEqual(10001 + 1000);
    expect(odd.perMonthMinor * 3).toBe(odd.totalMinor);
    expect(() => planQuote(100, 5)).toThrow();
  });
});

describe('drawing an emergency', () => {
  it('draws every card once before the pile is shuffled again', () => {
    const rng = seededRng(7);
    let deck = emptyEmergencyDeck();
    const drawn: string[] = [];
    const playable = EMERGENCY_CARDS.filter((c) => !c.requires).length;
    // no car, no pet: the cards that need one are lucky and never played
    for (let i = 0; i < playable; i += 1) {
      const draw = drawEmergencyCard(EMERGENCY_CARDS, deck, [], rng);
      expect(draw.card.requires).toBeUndefined();
      drawn.push(draw.card.id);
      deck = draw.deck;
    }
    expect(new Set(drawn).size).toBe(playable);
    // the pile is used up: the next draw reshuffles the discards (the unique card never comes back)
    const next = drawEmergencyCard(EMERGENCY_CARDS, deck, [], rng);
    expect(next.deck.seen).toEqual([next.card.id]);
    // the unique cards that were played (those that need no car or pet) never come back
    const unique = EMERGENCY_CARDS.filter((c) => c.unique && !c.requires).map((c) => c.id);
    expect([...deck.gone].sort()).toEqual([...unique].sort());
    expect(unique).toContain('E30');
    expect(deck.gone).not.toContain(next.card.id);
  });

  it('a card that needs a car applies to a player with one', () => {
    const rng = seededRng(3);
    let deck = emptyEmergencyDeck();
    const kinds = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const draw = drawEmergencyCard(EMERGENCY_CARDS, deck, ['car', 'pet'], rng);
      kinds.add(draw.card.requires ?? 'none');
      deck = draw.deck;
    }
    expect(kinds).toEqual(new Set(['none', 'car', 'pet']));
  });

  it('a card bound to the life only comes to a life it fits: children, a partner, a study, a flat', () => {
    const single: LifeState = { ...INITIAL_LIFE_STATE, education: true };
    const family: LifeState = {
      ...INITIAL_LIFE_STATE,
      relationship: 'married',
      kids: 2,
      home: 'own_flat',
    };
    const drawn = (life: LifeState, seed: number) => {
      let deck = emptyEmergencyDeck();
      const ids = new Set<string>();
      const rng = seededRng(seed);
      // more draws than the stack has cards: every card that fits the life has come up once
      for (let i = 0; i < 130; i += 1) {
        const draw = drawEmergencyCard(EMERGENCY_CARDS, deck, ['car', 'pet'], rng, life);
        ids.add(draw.card.id);
        deck = draw.deck;
      }
      return ids;
    };
    const alone = drawn(single, 7);
    for (const id of ['E46', 'E47', 'E48', 'E50']) expect(alone.has(id)).toBe(false);
    expect(alone.has('E49') && alone.has('E17')).toBe(true);
    const parents = drawn(family, 7);
    expect(parents.has('E46') || parents.has('E47') || parents.has('E48')).toBe(true);
    expect(parents.has('E50')).toBe(true);
    // a study is over: no semester fee, no laptop before the exams
    expect(parents.has('E49') || parents.has('E17')).toBe(false);
    // living with the parents there is no flat to burn down
    const home = drawn({ ...single, education: false, home: 'with_parents' }, 7);
    expect(['E26', 'E27', 'E29', 'E30'].some((id) => home.has(id))).toBe(false);
  });

  it('tells which cards were lucky on the way', () => {
    const only: EmergencyCard[] = [card('E05'), card('E02')];
    const draw = drawEmergencyCard(only, emptyEmergencyDeck(), [], seededRng(1));
    expect(draw.card.id).toBe('E02');
    expect(draw.skipped.length === 0 || draw.skipped[0] === 'E05').toBe(true);
  });
});

describe('insurance (hop in, hop out)', () => {
  const lines = [
    { title: 'Haftpflicht', amountMinor: 839, key: 'a', insurance: 'liability' as const },
    { title: 'Hausrat', amountMinor: 1561, key: 'b', insurance: 'household' as const },
    { title: 'Miete', amountMinor: 80000, key: 'c' },
  ];

  it('starts with every insurance of the profession held', () => {
    const insurance = initialInsurance(lines)!;
    expect(insurance.active).toEqual(['liability', 'household']);
    expect(insurance.premiums).toEqual({ liability: 'Haftpflicht', household: 'Hausrat' });
    expect(initialInsurance([lines[2]])).toBeUndefined();
  });

  it('a change waits for the next Payday: cover and premium go together', () => {
    const start = { ...initialCashflowGameState(), insurance: initialInsurance(lines) };
    const out = queueInsuranceChange(start, 'household', false);
    expect(out.insurance!.active).toContain('household');
    expect(droppedPremiumTitles(out).size).toBe(0);
    expect(insuranceOffers(out).find((o) => o.kind === 'household')).toMatchObject({
      held: true,
      heldNext: false,
    });
    const payday = applyInsuranceChanges(out);
    expect(payday.insurance!.active).toEqual(['liability']);
    expect(droppedPremiumTitles(payday)).toEqual(new Set(['Hausrat']));
    // hop back in, then think better of it before the Payday: nothing changes
    const back = queueInsuranceChange(payday, 'household', true);
    expect(back.insurance!.pending).toHaveLength(1);
    expect(queueInsuranceChange(back, 'household', false).insurance!.pending).toHaveLength(0);
    expect(applyInsuranceChanges(back).insurance!.active).toEqual(['liability', 'household']);
  });
});
