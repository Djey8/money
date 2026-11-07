import { gameSetFor, niceMinor, scaleMoney } from './card-scale';
import type { CashflowGameSet } from './types';

describe('scaleMoney', () => {
  it('scales amounts, nested ones included, and leaves counts and percentages alone', () => {
    const card = {
      costMinor: 100000,
      maxUnits: 5,
      yieldYearPercent: 4,
      property: { priceMinor: 20000000, mortgageMinor: 15000000 },
      later: { afterPaydays: 6, minor: 5000 },
      perUnitMinor: { gold: 100, tech: 250 },
      title: { en: 'x' },
    };
    expect(scaleMoney(card, 2.5)).toEqual({
      costMinor: 250000,
      maxUnits: 5,
      yieldYearPercent: 4,
      property: { priceMinor: 50000000, mortgageMinor: 37500000 },
      later: { afterPaydays: 6, minor: 12500 },
      perUnitMinor: { gold: 250, tech: 625 },
      title: { en: 'x' },
    });
  });

  it('rounds to nice numbers on request', () => {
    expect(niceMinor(123400)).toBe(120000);
    expect(niceMinor(1234000)).toBe(1200000);
    expect(niceMinor(38)).toBe(38);
    expect(scaleMoney({ costMinor: 100000 }, 1.234, { round: true })).toEqual({
      costMinor: 120000,
    });
  });
});

describe('gameSetFor', () => {
  const set = {
    id: 's',
    title: 's',
    loanRule: { incrementMinor: 100000, monthlyInterestPercent: 10 },
    professions: [],
    decks: {
      opportunity: [{ id: 'a', costMinor: 1000 }],
      harvest: [],
      dream: [{ id: 'd', totalMinor: 500000 }],
      emergency: [{ id: 'e', costMinor: 70000 }],
    },
  } as unknown as CashflowGameSet;

  it('is the set itself at price level 1', () => {
    expect(gameSetFor(set, 1)).toBe(set);
    expect(gameSetFor(set, undefined)).toBe(set);
  });

  it('scales the piles of Opportunity, Harvest and Dream and the loan step, not the Emergency pile', () => {
    const scaled = gameSetFor(set, 3);
    expect((scaled.decks as any).opportunity[0].costMinor).toBe(3000);
    expect((scaled.decks as any).dream[0].totalMinor).toBe(1500000);
    expect((scaled.decks as any).emergency[0].costMinor).toBe(70000);
    expect(scaled.loanRule.incrementMinor).toBe(300000);
    expect(scaled.loanRule.monthlyInterestPercent).toBe(10);
    expect(gameSetFor(set, 3)).toBe(scaled); // kept
    expect((set.decks as any).opportunity[0].costMinor).toBe(1000); // the original is untouched
  });
});
