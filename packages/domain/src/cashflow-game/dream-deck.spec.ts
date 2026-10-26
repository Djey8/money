import { DREAM_CARDS } from '../cashflow-dream-cards';
import {
  canTakeDream,
  DEFAULT_DREAM_SETTINGS,
  discountRemaining,
  discountTotal,
  DREAM_MOMENTS,
  dreamAllowed,
  dreamPoints,
  dreamReady,
  dreamsForMoment,
  drawDreamLanding,
  halfFunded,
  livedPoints,
  totalDreamPoints,
  WONDER_IDS,
  type DreamLog,
} from './dream-deck';
import { emptyEmergencyDeck } from './emergency-deck';
import { INITIAL_LIFE_STATE } from './life-deck';
import { seededRng } from './rng';

const log = (open: string[] = [], lived: string[] = []): DreamLog => ({
  open: open.map((cardId) => ({ cardId, projectTitle: cardId, round: 1 })),
  lived: lived.map((cardId) => ({
    cardId,
    points: DREAM_CARDS.find((c) => c.id === cardId)!.points,
    round: 2,
  })),
  bonusPoints: 0,
});

describe('the Dream stack (temp_cards v0.2)', () => {
  it('has the 48 dreams and 8 moments in English and German, every price adding up', () => {
    expect(DREAM_CARDS).toHaveLength(48);
    expect(DREAM_MOMENTS).toHaveLength(8);
    for (const card of DREAM_CARDS) {
      expect(card.title.en && card.title.de && card.story.en && card.story.de).toBeTruthy();
      expect(card.buckets.reduce((sum, bucket) => sum + bucket.amountMinor, 0)).toBe(
        card.totalMinor,
      );
      for (const bucket of card.buckets) expect(bucket.title.en && bucket.title.de).toBeTruthy();
      for (const action of card.actions) expect(action.text.en && action.text.de).toBeTruthy();
    }
    for (const moment of DREAM_MOMENTS) expect(moment.title.de && moment.story.de).toBeTruthy();
  });

  it('every dream is worth the points of its cost: twice the square root of the thousands', () => {
    for (const card of DREAM_CARDS) {
      const base = dreamPoints(card.totalMinor);
      expect(card.points).toBe(card.giving ? Math.round(base * 1.25) : base);
    }
    expect(dreamPoints(250000_00)).toBe(32);
    expect(dreamPoints(2000_00)).toBe(3);
  });

  it('a giving dream counts a quarter more points', () => {
    const giving = DREAM_CARDS.find((c) => c.id === 'D37')!;
    expect(giving.giving).toBe(true);
    expect(livedPoints(giving)).toBe(Math.round(dreamPoints(giving.totalMinor) * 1.25));
  });

  it('the vehicle dreams give a car and a monthly cost; the café and the farm only a cost', () => {
    for (const id of ['D29', 'D30', 'D31', 'D32']) {
      const card = DREAM_CARDS.find((c) => c.id === id)!;
      expect(card.carAfter).toBe(true);
      expect(card.monthlyAfterMinor).toBeGreaterThan(0);
    }
    expect(DREAM_CARDS.find((c) => c.id === 'D36')!.carAfter).toBeUndefined();
    expect(DREAM_CARDS.find((c) => c.id === 'D36')!.monthlyAfterMinor).toBe(30000);
  });

  it('some dreams need a partner or children', () => {
    const wedding = DREAM_CARDS.find((c) => c.requiresPartner)!;
    expect(dreamAllowed(wedding, INITIAL_LIFE_STATE)).toBe(false);
    expect(dreamAllowed(wedding, { ...INITIAL_LIFE_STATE, relationship: 'partner' })).toBe(true);
    const kids = DREAM_CARDS.find((c) => c.requiresKids)!;
    expect(dreamAllowed(kids, { ...INITIAL_LIFE_STATE, kids: 1 })).toBe(true);
  });

  it('a landing offers as many dreams as the setting says - or a moment', () => {
    const rng = seededRng(4);
    let deck = emptyEmergencyDeck();
    let offers = 0;
    let moments = 0;
    for (let i = 0; i < 20; i += 1) {
      const landing = drawDreamLanding(
        DREAM_CARDS,
        DREAM_MOMENTS,
        deck,
        {
          log: log(),
          life: INITIAL_LIFE_STATE,
          settings: DEFAULT_DREAM_SETTINGS,
        },
        rng,
      );
      deck = landing.deck;
      if (landing.kind === 'offers') {
        offers += 1;
        expect(landing.offers.length).toBeGreaterThanOrEqual(1);
        expect(landing.offers.length).toBeLessThanOrEqual(2);
        for (const offer of landing.offers)
          expect(dreamAllowed(offer, INITIAL_LIFE_STATE)).toBe(true);
      } else moments += 1;
    }
    expect(offers).toBeGreaterThan(0);
    expect(moments).toBeGreaterThanOrEqual(0);
  });

  it('a dream that is open or lived is not offered again', () => {
    const rng = seededRng(8);
    for (let i = 0; i < 30; i += 1) {
      const landing = drawDreamLanding(
        DREAM_CARDS,
        [],
        emptyEmergencyDeck(),
        {
          log: log(['D01', 'D02'], ['D03']),
          life: INITIAL_LIFE_STATE,
          settings: { offersPerLanding: 3, maxOpenDreams: 3 },
        },
        rng,
      );
      if (landing.kind === 'offers') {
        expect(landing.offers).toHaveLength(3);
        expect(landing.offers.map((o) => o.id)).not.toEqual(expect.arrayContaining(['D01']));
        for (const offer of landing.offers) expect(['D01', 'D02', 'D03']).not.toContain(offer.id);
      }
    }
  });

  it('at most as many dreams can be open as the setting allows', () => {
    expect(canTakeDream(log(['D01', 'D02']), DEFAULT_DREAM_SETTINGS)).toBe(true);
    expect(canTakeDream(log(['D01', 'D02', 'D04']), DEFAULT_DREAM_SETTINGS)).toBe(false);
  });

  it('points: lived dreams, the set of the seven wonders, patience - and half for fully funded buckets of the rest', () => {
    const wonders = log([], WONDER_IDS);
    const total = totalDreamPoints(wonders, DREAM_CARDS, () => ({ fundedBucketsMinor: 0 }));
    const sum = WONDER_IDS.reduce((s, id) => s + DREAM_CARDS.find((c) => c.id === id)!.points, 0);
    expect(total.lived).toBe(sum + 15);
    // Kilimanjaro: 4 points, half of the buckets funded fully: 4 x 0.5 x 2,500 / 4,000 = 1.25 -> 1
    const kili = DREAM_CARDS.find((c) => c.id === 'D16')!;
    const partial = totalDreamPoints(log(['D16']), DREAM_CARDS, () => ({
      fundedBucketsMinor: 250000,
    }));
    expect(kili.totalMinor).toBe(400000);
    expect(partial.partial).toBe(1);
    expect(
      totalDreamPoints({ ...log(), bonusPoints: 2 }, DREAM_CARDS, () => ({ fundedBucketsMinor: 0 }))
        .total,
    ).toBe(2);
  });

  it('the moments: a discount on what is missing, a discount on the price, who it can happen to', () => {
    const buckets = [
      { target: 1000, amount: 1000 },
      { target: 1000, amount: 0 },
    ];
    expect(halfFunded(buckets)).toBe(true);
    expect(discountRemaining(buckets, 15).map((b) => b.target)).toEqual([1000, 850]);
    expect(discountTotal(buckets, 20).map((b) => b.target)).toEqual([1000, 800]);
    expect(dreamReady(buckets)).toBe(false);
    expect(dreamReady([{ target: 5, amount: 5 }])).toBe(true);
    const open = [
      { card: DREAM_CARDS.find((c) => c.id === 'D01')!, buckets },
      { card: DREAM_CARDS.find((c) => c.id === 'D26')!, buckets: [{ target: 10, amount: 0 }] },
    ];
    expect(dreamsForMoment('M01', open)).toEqual([0]);
    expect(dreamsForMoment('M03', open)).toEqual([0]);
    expect(dreamsForMoment('M02', open)).toEqual([0, 1]);
  });
});
