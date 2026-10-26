/**
 * The difficulty of a Dreamfund game (JFK, 2026-10-26, temp_cards/dreamfund-difficulty.md): one setting that sets the defaults of
 * everything below - the same cards, with different odds and amounts. Medium is the baseline that is played and tuned first; Easy and
 * Hard are kept here with the values of the sketch and are not offered to players until the simulation has set their numbers.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** When shares, ETFs, crypto and metals can be sold. */
export type SellingMode = 'payday' | 'sell_window' | 'strict';

export interface DifficultySettings {
  /** Added to the dice where high is good (side hustles, businesses, promotions); never on emergencies or traps. */
  luckModifier: number;
  startCashBonusMinor: number;
  startParentsSupport: boolean;
  rankingMultiplier: number;
  /** Interest of a new mortgage, in percent (the repayment of 2 % comes on top on every level). */
  mortgageRatePercent: number;
  emergencyCostMultiplier: number;
  insuranceDeductibleCapMinor: number;
  /** The surcharge of a payment plan of 3, 6 and 12 Paydays, in percent. */
  planSurchargePercents: [number, number, number];
  dreamOffersPerLanding: number;
  maxOpenDreams: number;
  opportunityOffersPerLanding: number;
  maxSideHustles: number;
  savingsCardCopies: number;
  /** The traps of the Opportunity stack: only four of them, each once; all eight once; all eight twice. */
  trapCopies: 'reduced' | 'all' | 'double';
  sellingMode: SellingMode;
  /** What a hype ladder is worth in expectation per step. */
  ladderExpectedValue: number;
  /** How far the growth markets drift from the calibrated values, in percentage points a year. */
  marketDriftOffsetPp: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    luckModifier: 1,
    startCashBonusMinor: 100000,
    startParentsSupport: true,
    rankingMultiplier: 0.8,
    mortgageRatePercent: 3.5,
    emergencyCostMultiplier: 0.75,
    insuranceDeductibleCapMinor: 30000,
    planSurchargePercents: [5, 10, 20],
    dreamOffersPerLanding: 3,
    maxOpenDreams: 3,
    opportunityOffersPerLanding: 2,
    maxSideHustles: 3,
    savingsCardCopies: 3,
    trapCopies: 'reduced',
    sellingMode: 'payday',
    ladderExpectedValue: 1.05,
    marketDriftOffsetPp: 1,
  },
  medium: {
    luckModifier: 0,
    startCashBonusMinor: 0,
    startParentsSupport: true,
    rankingMultiplier: 1,
    mortgageRatePercent: 4,
    emergencyCostMultiplier: 1,
    insuranceDeductibleCapMinor: 50000,
    planSurchargePercents: [10, 20, 35],
    dreamOffersPerLanding: 2,
    maxOpenDreams: 3,
    opportunityOffersPerLanding: 1,
    maxSideHustles: 2,
    savingsCardCopies: 2,
    trapCopies: 'all',
    sellingMode: 'sell_window',
    ladderExpectedValue: 0.95,
    marketDriftOffsetPp: 0,
  },
  hard: {
    luckModifier: 0,
    startCashBonusMinor: 0,
    startParentsSupport: false,
    rankingMultiplier: 1.3,
    mortgageRatePercent: 4.5,
    emergencyCostMultiplier: 1.25,
    insuranceDeductibleCapMinor: 75000,
    planSurchargePercents: [15, 30, 50],
    dreamOffersPerLanding: 1,
    maxOpenDreams: 3,
    opportunityOffersPerLanding: 1,
    maxSideHustles: 2,
    savingsCardCopies: 1,
    trapCopies: 'double',
    sellingMode: 'strict',
    ladderExpectedValue: 0.85,
    marketDriftOffsetPp: -2,
  },
};

export const difficultySettings = (difficulty: Difficulty | undefined): DifficultySettings =>
  DIFFICULTY_SETTINGS[difficulty ?? 'medium'] ?? DIFFICULTY_SETTINGS.medium;

/** A die result with the luck of the level added (never above a six), for the dice where high is good. */
export const withLuck = (roll: number, difficulty: Difficulty | undefined): number =>
  Math.min(6, roll + difficultySettings(difficulty).luckModifier);

/** What a mortgage costs a month more (or less) than the 4.0 % + 2.0 % the cards are written with. */
export function mortgageDeltaMinor(
  mortgageMinor: number,
  difficulty: Difficulty | undefined,
  extraPoints = 0,
): number {
  const points = difficultySettings(difficulty).mortgageRatePercent - 4 + extraPoints;
  return Math.round((mortgageMinor * points) / 100 / 12);
}
