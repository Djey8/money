import { LIFE_CARDS } from '../cashflow-life-cards';
import {
  resolveLifeCard,
  INITIAL_LIFE_STATE,
  type LifeCard,
  type LifeContext,
  type LifeDecision,
  type LifeOutcome,
} from './life-deck';

const HORIZON = 12; // Paydays a monthly line is counted for when it never ends

function context(livingStandard: number, life = INITIAL_LIFE_STATE): LifeContext {
  return {
    life,
    netMonthlyMinor: Math.round(195000 * livingStandard),
    expensesMonthlyMinor: Math.round(230000 * livingStandard),
    livingStandard,
    lang: 'en',
    rng: () => 0.5,
  };
}

/** What an outcome is worth in money over a year (a one-time sum, the lines for as long as they last, at most a year). */
export function worth(outcome: LifeOutcome): number {
  // a job loss lasts until a roll finds a job: on average 1/p Paydays, at most the search's length
  const search = outcome.jobSearch;
  const p = search ? (7 - search.rollFrom) / 6 : 1;
  const searchPaydays = search ? (1 - Math.pow(1 - p, search.paydaysLeft)) / p : HORIZON;
  const lines = outcome.lines.reduce(
    (sum, line) =>
      sum +
      line.amountMinor *
        Math.min(
          HORIZON,
          line.paydaysLeft ?? (search && line.group === 'employment' ? searchPaydays : HORIZON),
        ),
    0,
  );
  return outcome.oneTimeMinor + lines;
}

const byId = (id: string) => LIFE_CARDS.find((card) => card.id === id);

/** The decisions that play a card as the rules want it (a fate happens; a dice card is rolled; others are accepted). */
function decisionOf(card: LifeCard): LifeDecision {
  if (card.type === 'fate') return { kind: 'fate' };
  if (card.type === 'dice') return { kind: 'roll' };
  if (card.type === 'giving') return { kind: 'give' };
  return { kind: 'accept' };
}

/** The expected worth of a card over its dice, for a life it can happen to (or the first life state it fits). */
export function expectedWorth(card: LifeCard, livingStandard = 1): number {
  const life = { ...INITIAL_LIFE_STATE, ...stateFor(card) };
  if (card.type === 'dice') {
    let sum = 0;
    for (let face = 1; face <= 6; face += 1) {
      const rng = () => (face - 0.5) / 6;
      sum += worth(
        resolveLifeCard(card, { kind: 'roll' }, { ...context(livingStandard, life), rng }, byId),
      );
    }
    return sum / 6;
  }
  return worth(resolveLifeCard(card, decisionOf(card), context(livingStandard, life), byId));
}

function stateFor(card: LifeCard): Partial<typeof INITIAL_LIFE_STATE> {
  const wanted = card.requires ?? {};
  const state: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(wanted)) {
    if (key === 'kidsAtLeast') state['kids'] = value;
    else if (key === 'partner') continue;
    else state[key] = Array.isArray(value) ? value[value.length - 1] : value;
  }
  return state;
}

const luck = LIFE_CARDS.filter((card) => card.type === 'fate' || card.type === 'dice');
/** The cards that end a relationship or add a child are the heavy ones of a life: they are a story, not luck. */
const LIFE_STORY = new Set(['L04', 'L06', 'L28', 'L29']);

describe('the Life stack is balanced', () => {
  it('has as many lifts as blows, and the luck that has no story of its own is not a loss', () => {
    const copies = luck.reduce((sum, card) => sum + card.copies, 0);
    const good = luck
      .filter((card) => expectedWorth(card) > 0)
      .reduce((sum, c) => sum + c.copies, 0);
    const bad = luck
      .filter((card) => expectedWorth(card) < 0)
      .reduce((sum, c) => sum + c.copies, 0);
    expect(good / copies).toBeGreaterThanOrEqual(0.4);
    expect(bad / copies).toBeLessThanOrEqual(0.5);
    const plain = luck.filter((card) => !LIFE_STORY.has(card.id));
    const total = plain.reduce((sum, card) => sum + card.copies * expectedWorth(card), 0);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('has no card that ruins a year, and no heavy cost that lasts for ever without a way out', () => {
    for (const card of LIFE_CARDS) {
      expect(expectedWorth(card)).toBeGreaterThan(-800000);
    }
    const net = 195000;
    for (const card of luck) {
      if (card.id === 'L04') continue; // the monthly cost of a flat of one's own after a break-up: it replaces the saved share
      const effects = [card.effects, ...(card.dice ?? []).map((b) => b.value)];
      for (const effect of effects) {
        if (!effect || effect.durationPaydays || effect.jobSearch || effect.group === 'rent') {
          continue;
        }
        expect((effect.monthlyMinor ?? 0) / net).toBeLessThanOrEqual(0.15);
        expect(Math.max(0, -(effect.incomePercentOfNet ?? 0))).toBeLessThanOrEqual(0);
      }
    }
  });

  it('has an answer for the player without a job: lifts that only an unemployed life can draw', () => {
    const lifts = LIFE_CARDS.filter(
      (card) =>
        card.requires?.employment !== undefined &&
        card.requires.employment !== 'employed' &&
        expectedWorth(card) > 0,
    );
    expect(lifts.reduce((sum, card) => sum + card.copies, 0)).toBeGreaterThanOrEqual(4);
  });

  it('tells a story and says it in both languages, on every card', () => {
    const ids = new Set<string>();
    for (const card of LIFE_CARDS) {
      expect(ids.has(card.id)).toBe(false);
      ids.add(card.id);
      for (const t of [card.title, card.story]) {
        expect(t.en.length).toBeGreaterThan(3);
        expect(t.de.length).toBeGreaterThan(3);
      }
      expect(card.story.en.length).toBeGreaterThan(30);
    }
  });

  it('is felt in proportion to the character: a bigger life gets bigger windfalls and bigger bills', () => {
    for (const id of ['L47', 'L62', 'L54', 'L31']) {
      const c = byId(id)!;
      const small = Math.abs(expectedWorth(c, 1));
      const big = Math.abs(expectedWorth(c, 3));
      // shares of the income follow the net, amounts follow the price level: both are about three times as much
      expect(big / small).toBeGreaterThan(2.5);
      expect(big / small).toBeLessThan(3.5);
    }
  });

  it('keeps a child benefit the same for every character', () => {
    const c = byId('L37')!;
    expect(expectedWorth(c, 3)).toBe(expectedWorth(c, 1));
  });
});
