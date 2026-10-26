import {
  DIFFICULTY_SETTINGS,
  difficultySettings,
  mortgageDeltaMinor,
  withLuck,
} from './difficulty';
import { rollsFor } from './opportunity';
import { OPPORTUNITY_CARDS } from '../cashflow-opportunity-cards';

describe('the difficulty of a game', () => {
  it('Medium is the baseline the cards were written for', () => {
    const medium = difficultySettings('medium');
    expect(medium).toMatchObject({
      luckModifier: 0,
      mortgageRatePercent: 4,
      emergencyCostMultiplier: 1,
      opportunityOffersPerLanding: 1,
      sellingMode: 'sell_window',
    });
    expect(difficultySettings(undefined)).toBe(DIFFICULTY_SETTINGS.medium);
    expect(mortgageDeltaMinor(2880000, 'medium')).toBe(0);
  });

  it('Easy forgives and Hard tests: luck, mortgage, emergencies, offers and selling', () => {
    expect(DIFFICULTY_SETTINGS.easy.luckModifier).toBe(1);
    expect(DIFFICULTY_SETTINGS.easy.mortgageRatePercent).toBeLessThan(4);
    expect(DIFFICULTY_SETTINGS.hard.mortgageRatePercent).toBeGreaterThan(4);
    expect(DIFFICULTY_SETTINGS.easy.emergencyCostMultiplier).toBeLessThan(1);
    expect(DIFFICULTY_SETTINGS.hard.emergencyCostMultiplier).toBeGreaterThan(1);
    expect(DIFFICULTY_SETTINGS.easy.dreamOffersPerLanding).toBeGreaterThan(
      DIFFICULTY_SETTINGS.hard.dreamOffersPerLanding,
    );
    expect(DIFFICULTY_SETTINGS.hard.sellingMode).toBe('strict');
    // 0.5 points of a 288,000 mortgage a month, more or less
    expect(mortgageDeltaMinor(28800000, 'hard')).toBe(12000);
    expect(mortgageDeltaMinor(28800000, 'easy')).toBe(-12000);
  });

  it('luck lifts a die but never above a six, and never the dice of a trap', () => {
    expect(withLuck(4, 'easy')).toBe(5);
    expect(withLuck(6, 'easy')).toBe(6);
    expect(withLuck(4, 'medium')).toBe(4);
    const business = OPPORTUNITY_CARDS.find((c) => c.id === 'S28')!;
    const trap = OPPORTUNITY_CARDS.find((c) => c.id === 'P32')!;
    const low = () => 0.5; // a 4
    expect(rollsFor(business, low, 'easy').outcome).toBe(5);
    expect(rollsFor(trap, low, 'easy').outcome).toBe(4);
  });
});
