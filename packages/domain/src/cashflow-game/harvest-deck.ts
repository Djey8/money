import type { Localized } from './emergency-deck';
import type { DiceBand } from './life-deck';

/**
 * The Dreamfund Harvest stack (JFK, 2026-10-26, temp_cards/dreamfund-harvest-deck.md v0.2): the market. A card moves the indices of
 * the markets, opens a window to sell, brings a buyer, shakes up businesses, offers a gamble or reveals a trap. The cards are data made
 * of small operations; `harvest.ts` runs them. Amounts are minor units (1 Traumtaler = 100); an index of 1.00 is where a market begins.
 */

/** The markets of the game: what a share, a metal, a collectible or a property is priced by (value = card price x index). */
export type MarketTag = string;

export type HarvestGroup =
  | 'market'
  | 'shares'
  | 'crypto'
  | 'ladder'
  | 'metals'
  | 'collect'
  | 'property'
  | 'business'
  | 'lending'
  | 'traps';

/** A die that picks a multiplier; a six may roll again. */
export interface HarvestFactorBand {
  from: number;
  to: number;
  value: number | { rollAgain: DiceBand<number>[] };
}

/** What a die does to one holder of the target of a card (every holder rolls for themselves). */
export interface HarvestHolderEffect {
  /** Nothing happens. */
  none?: boolean;
  /** The payouts stop for this many Paydays. */
  pausePayoutsPaydays?: number;
  /** A share of the capital is lost; the project ends when it says so. */
  loseCapitalPercent?: number;
  endsProject?: boolean;
  /** A share of the crypto units is lost (unless the coins were kept in a wallet of one's own). */
  loseUnitsPercent?: number;
  /** One property or unit pays no rent for this many Paydays, and costs something. */
  noRentPaydays?: number;
  legalCostMinor?: number;
  /** A repair of this share of the purchase price. */
  repairPercentOfPrice?: number;
  /** A business loses its cash flow for this many Paydays. */
  noCashflowPaydays?: number;
  /** The cash flow of a business changes for good (a factor). */
  cashflowFactor?: number;
  /** A sum paid once (positive) or due (negative). */
  oneTimeMinor?: number;
  /** The value of the holding is multiplied (a startup round), or it is sold at this multiple of its value. */
  valueFactor?: number;
  sellAtFactor?: number;
  /** The holding is worth nothing and ends. */
  worthless?: boolean;
  /** The deposit is lost, or it comes back. */
  depositLost?: boolean;
  depositBack?: boolean;
  /** One item (the cheapest) is a fake. */
  fakeItem?: boolean;
}

export interface HarvestLadder {
  targets: string[];
  /** The die faces that win a step: this one and above. */
  successFrom: number;
  step: number;
  maxSteps: number;
  /** What is left of the stake when the hype collapses (0 = nothing). */
  fail: number;
  /** What the stake is worth before the first roll (a pump: three times). */
  start?: number;
  basis?: 'index' | 'asset';
  byDifficulty: Record<
    'easy' | 'medium' | 'hard',
    { successFrom: number; step: number; fail: number }
  >;
}

export interface HarvestBuyer {
  targets: string[];
  /** What it is bought at: the index of the market, the value of an asset, the price of a property, months of cash flow, a fixed sum. */
  basis: 'index' | 'asset' | 'property' | 'business' | 'fixed';
  factor?: number;
  bands?: DiceBand<number>[];
  /** Art has a die of its own, and a six may roll again. */
  artBands?: HarvestFactorBand[];
  feesPercent?: number;
  saleCostsPercent?: number;
  monthsOfCashflow?: number;
  fixedMinor?: number;
}

export type HarvestOp =
  | { op: 'index'; factors: Record<MarketTag, number> }
  | { op: 'indexDice'; markets: MarketTag[]; bands: HarvestFactorBand[] }
  | { op: 'nextPaydayIndex'; factors: Record<MarketTag, number> }
  | { op: 'recover'; fraction: number }
  | { op: 'sellWindow'; markets: MarketTag[] | 'ALL' }
  | { op: 'buyer'; buyer: HarvestBuyer }
  | { op: 'cashflowFactor'; groups: string[]; factor: number; paydays: number | null }
  | { op: 'cashflowDice'; groups: string[]; bands: HarvestFactorBand[]; paydays: number | null }
  | { op: 'payoutFactor'; factors: Record<MarketTag, number>; paydays: number | null }
  | { op: 'specialPayout'; perUnitMinor: Record<MarketTag, number> }
  | { op: 'split'; tag: MarketTag; factor: number }
  | { op: 'expensesPercent'; percent: number }
  | { op: 'rentPercent'; percent: number }
  | { op: 'expensesAdd'; minor: number; paydays: number }
  | { op: 'savingsRate'; factor: number }
  | { op: 'mortgageRate'; pp: number }
  | { op: 'holderDice'; targets: string[]; bands: DiceBand<HarvestHolderEffect>[] }
  | { op: 'ladder'; ladder: HarvestLadder }
  | { op: 'penny'; ticker: string; factor: number }
  | { op: 'trapReveal'; cardIds?: string[]; tickers?: string[] };

export interface HarvestCard {
  id: string;
  group: HarvestGroup;
  /** Copies in the pile on a Medium game. */
  copies: number;
  title: Localized;
  story: Localized;
  realWorld: string;
  ops: HarvestOp[];
  note?: string;
  links: { label: string; url: string }[];
}

/** How a market drifts at every Payday, in percent, by difficulty (the Medium values are the ones played first). */
export const MARKET_DRIFT_PERCENT: Record<
  MarketTag,
  { easy: number; medium: number; hard: number }
> = {
  WORLD: { easy: -0.39, medium: 0.51, hard: 1.08 },
  EMERG: { easy: -0.18, medium: 0.7, hard: 1.35 },
  BOND: { easy: 0.12, medium: 0.07, hard: 0.01 },
  DIVID: { easy: -0.36, medium: 0.25, hard: 0.67 },
  AUTO: { easy: -0.42, medium: 0.29, hard: 0.77 },
  INSU: { easy: -0.24, medium: 0.38, hard: 0.55 },
  TECH: { easy: -0.82, medium: 1.23, hard: 1.7 },
  ENERGY: { easy: 0.39, medium: 0.61, hard: 0.47 },
  REIT: { easy: 0.23, medium: 0.58, hard: 0.85 },
  BTC: { easy: 0.17, medium: 1.52, hard: 1.4 },
  ETH: { easy: 0.33, medium: 2.0, hard: 1.87 },
  ALTS: { easy: -2.71, medium: 1.11, hard: 1.98 },
  GOLD: { easy: 0.48, medium: 0.29, hard: 0.16 },
  SILVER: { easy: 0.25, medium: 0.39, hard: 0.39 },
  PRIVATE: { easy: 0.49, medium: 0.49, hard: 0.49 },
  FARM: { easy: 0.04, medium: 0.04, hard: 0.04 },
  PROPERTY: { easy: 0.14, medium: 0.17, hard: 0.17 },
  CARDS: { easy: -0.25, medium: 0.42, hard: 0.42 },
  COLLECT: { easy: 0.08, medium: 0.49, hard: 0.62 },
  CLASSIC: { easy: 0.25, medium: 0.25, hard: 0.25 },
  ART: { easy: 0, medium: 0, hard: 0 },
};

/**
 * The index market an Opportunity card's own tag is priced by (a corporate bond ladder follows the bond market, a cloud stock the tech
 * market): the cards keep their own tags, the Harvest cards speak of the markets (JFK, 2026-10-26).
 */
export const MARKET_ALIAS: Record<string, string> = {
  BUND: 'BOND',
  CBOND: 'BOND',
  DIVI: 'DIVID',
  TELE: 'DIVID',
  CCALL: 'DIVID',
  DIVPF: 'DIVID',
  CLOUD: 'TECH',
  NCHIP: 'TECH',
  SOLW: 'ENERGY',
  ALT10: 'ALTS',
  STARTUP: 'PRIVATE',
  PEFUND: 'PRIVATE',
  GOLDKG: 'GOLD',
  FARMLAND: 'FARM',
};

export const marketOfTag = (tag: string | undefined): string | undefined =>
  tag ? (MARKET_ALIAS[tag] ?? tag) : tag;

/** The groups of Opportunity cards that business and side-hustle events speak of (section 1.4 of the Harvest deck). */
export const HARVEST_GROUPS: Record<string, string[]> = {
  CONTENT: ['S28', 'S32', 'S33', 'P19'],
  FREELANCE: ['S29', 'S31', 'S34', 'P18'],
  RESELL: ['S30'],
  VENDING: ['P15', 'T29'],
  FOOD: ['P22', 'T12', 'T30'],
  RENTALBIZ: ['P23', 'P24', 'P26', 'P27', 'P29'],
  BUSINESS: ['P20', 'P21', 'T11', 'T13', 'T14', 'T15', 'T16'],
  TOURISM: ['T05', 'T16'],
  PARKING: ['P16', 'T10'],
  LENDING: ['P11'],
  SAVINGS: ['S09', 'S35'],
  SINGLE: ['P10'],
};

export type HarvestDeck = HarvestCard[];
