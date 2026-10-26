import type { Localized } from './emergency-deck';
import type { DiceBand } from './life-deck';

/**
 * The Dreamfund Opportunity stack (JFK, 2026-10-26, temp_cards/dreamfund-opportunity-deck.md v1.0): the cards a player finds on an
 * Opportunity tile. Every card becomes a Grow project; what it does to the books follows from its numbers. The cards are data, the rules
 * are in `opportunity.ts`. Amounts are in minor units (1 Traumtaler = 100).
 */

export type OpportunityPile = 'seed' | 'sapling' | 'tree';
export const OPPORTUNITY_PILES: readonly OpportunityPile[] = ['seed', 'sapling', 'tree'];

export type OpportunityGrowType =
  'income-growth' | 'budget-optimization' | 'subscription-action' | 'expense-insight';

/** What a die decides on a card: a monthly cash flow, a monthly saving, a one-time payment, or the value of an asset. */
export interface OpportunityRoll {
  cashflowMinor?: number;
  monthlySavingsMinor?: number;
  oneTimeMinor?: number;
  assetValueMinor?: number;
  /** A six on a gamble card rolls once more, with these bands. */
  rollAgain?: DiceBand<OpportunityRoll>[];
}

/** What a die decides when the card is bought: a cost, or a different cash flow than the card says. */
export interface OpportunityBuyRoll {
  oneTimeMinor?: number;
  /** Replaces the card's cash flow (the numbers were inflated). */
  cashflowMinor?: number;
  /** Raises the extra cost of the card (renovation +40%). */
  extraCostPercent?: number;
  /** A cost that comes later, after this many Paydays (the heating must be replaced). */
  laterCost?: { afterPaydays: number; minor: number };
}

/** What a die decides at each Payday of a property or a lent sum. */
export interface OpportunityPaydayRoll {
  /** Less rent (in percent of the rent) for this many Paydays. */
  rentCutPercent?: number;
  paydays?: number;
  /** A loss of the capital (in percent of it). */
  capitalLossPercent?: number;
}

export interface OpportunityShare {
  ticker: string;
  unitPriceMinor: number;
  maxUnits: number;
  /** What a unit pays every Payday (the yearly yield spread over twelve months). */
  dividendMonthPerUnitMinor: number;
  yieldYearPercent: number;
}

export interface OpportunityProperty {
  priceMinor: number;
  rentMonthMinor: number;
  runningCostShare: number;
  cashNeededMinor: number;
  depositMinor: number;
  sideCostsMinor: number;
  mortgageMinor: number;
  mortgagePaymentMonthMinor: number;
  extraCostMinor: number;
}

/** What a card asks of the player's life or career before it is offered. */
export interface OpportunityRequirement {
  home?: string;
  careerStage?: number;
  /** The id of another opportunity card that has to be owned. */
  owns?: string;
  /** At least this much debt (minor units). */
  debtMinor?: number;
}

/** What only the engine may know about a trap (never shown to a player). */
export interface OpportunityTrap {
  trueCategory: string;
  /** Pays for a few Paydays, then stops: what a Ponzi scheme does. */
  ponzi?: { paysMonthMinor: number; paysPaydays: number; then: 'lost' | 'exploitRoll' };
  /** Collapses to nothing by itself this many Paydays after the purchase. */
  collapseAfterPaydays?: number;
}

export interface OpportunityCard {
  id: string;
  pile: OpportunityPile;
  title: Localized;
  story: Localized;
  growType: OpportunityGrowType;
  /** `share` units with a price, `investment` a property or a loan, `asset` everything else; absent for savings cards. */
  kind?: 'asset' | 'share' | 'investment';
  /** The small label of the Grow project: `Seed · dividend`. */
  category: string;
  pattern: string;
  strategy: string;
  reasoning: string;
  risks: string;
  riskScore: number;
  insights: string;
  alternative: string;
  alternativeCostMinor: number;
  links: { label: string; url: string }[];
  actions: { text: string; priority: 'low' | 'medium' | 'high' }[];
  /** The numbers on the card are estimates, not published prices. */
  estimate?: boolean;
  /** Paid now (a share lot, a deposit and side costs, equity). */
  costMinor?: number;
  /** A card that can be bought in steps (a savings account): the size of a step. */
  stepMinor?: number;
  savings?: { currentCostMinor: number; targetCostMinor: number; monthlySavingsMinor: number };
  /** A saving that follows the debt of the player (consolidating): in percent a year of the debt. */
  savingsFormulaPercentOfDebt?: number;
  cashflowMinor?: number;
  dice?: DiceBand<OpportunityRoll>[];
  onBuy?: DiceBand<OpportunityBuyRoll>[];
  eachPayday?: DiceBand<OpportunityPaydayRoll>[];
  share?: OpportunityShare;
  /** Where the share or asset is traded on the Harvest cards, and the price range it moves in (per unit). */
  market?: { tag: string; lowMinor: number; highMinor: number; trend: string };
  property?: OpportunityProperty;
  loan?: { loanMinor: number; paymentMonthMinor: number };
  /** Equity plus loan: what a business is worth. */
  totalInvestmentMinor?: number;
  /** An asset with a value of its own (a card collection). */
  assetValueMinor?: number;
  monthlyCostMinor?: number;
  sideHustle?: boolean;
  rampPaydays?: number;
  lockedPaydays?: number;
  requires?: OpportunityRequirement;
  setsCar?: boolean;
  note?: string;
  trap?: OpportunityTrap;
}

/** What the cards of a game set bring: the Opportunity stack. */
export type OpportunityDeck = OpportunityCard[];
