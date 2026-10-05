import type { CashflowDealCard } from './types';

/**
 * Classic Edition's Small Deal pile - JFK's real physical cards, added one card type at a time
 * (todo/cashflow-game.md decisions 52/53). Four securities, five cards each: the same stock printed
 * at five different "today" prices. Only language-neutral facts live here; the flavor text each card
 * prints is in `assets/i18n/cashflow-cards/<lang>.json`, keyed by the card `id`.
 *
 * `symbol` is what identifies the position in Grow/the balance sheet, so every price of one stock
 * lands on the same holding.
 */
interface ClassicSecurity {
  symbol: string;
  title: string;
  securityKind: 'stock' | 'fund';
  rangeMin: number;
  rangeMax: number;
}

const SECURITIES: ClassicSecurity[] = [
  { symbol: 'OK4U', title: 'OK4U Pharma AG', securityKind: 'stock', rangeMin: 5, rangeMax: 30 },
  {
    symbol: 'ON2U',
    title: 'ON2U Entertainment AG',
    securityKind: 'stock',
    rangeMin: 10,
    rangeMax: 30,
  },
  {
    symbol: 'MYT4U',
    title: 'MYT4U Electronics Co.',
    securityKind: 'stock',
    rangeMin: 10,
    rangeMax: 30,
  },
  { symbol: 'GRO4US', title: 'GRO4US', securityKind: 'fund', rangeMin: 20, rangeMax: 30 },
];

/** The five "Heutiger Preis" values each security is printed at. */
const PRICES = [5, 10, 20, 30, 40];

const SECURITY_CARDS: CashflowDealCard[] = SECURITIES.flatMap((security) =>
  PRICES.map((price) => ({
    id: `classic-small-${security.symbol.toLowerCase()}-${price}`,
    title: security.title,
    assetKind: 'share' as const,
    securityKind: security.securityKind,
    symbol: security.symbol,
    priceMinor: price * 100,
    rangeMinMinor: security.rangeMin * 100,
    rangeMaxMinor: security.rangeMax * 100,
  })),
);

/**
 * Investment cards (properties, franchises...): every card is its own deal - drawing another
 * Einfamilienhaus is a second house, not more of the first. `symbol` is the short label the Grow
 * project, the `M-` mortgage liability and the `<label> Cashflow` subscription are named after;
 * further copies get `-II`, `-III`... (no spaces: Grow's buy comment is split on spaces).
 */
const INVESTMENT_CARDS: CashflowDealCard[] = [
  {
    id: 'classic-small-efh',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    depositMinor: 300000, // Anzahlung: 3.000 EUR
    mortgageMinor: 4700000, // Hypothek: 47.000 EUR (Kosten: 50.000 EUR)
    cashflowMinor: 10000, // Cashflow: +100 EUR
  },
  {
    id: 'classic-small-efh-65k-5k',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    depositMinor: 500000, // Anzahlung: 5.000 EUR
    mortgageMinor: 6000000, // Hypothek: 60.000 EUR (Kosten: 65.000 EUR)
    cashflowMinor: 16000, // Cashflow: +160 EUR
  },
  {
    id: 'classic-small-efh-45k-2k',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    superDeal: true, // "Du findest einen Super Deal!"
    depositMinor: 200000, // Anzahlung: 2.000 EUR
    mortgageMinor: 4300000, // Hypothek: 43.000 EUR (Kosten: 45.000 EUR)
    cashflowMinor: 25000, // Cashflow: +250 EUR
  },
  {
    id: 'classic-small-efh-30k-1k',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    depositMinor: 100000, // Anzahlung: 1.000 EUR
    mortgageMinor: 2900000, // Hypothek: 29.000 EUR (Kosten: 30.000 EUR)
    cashflowMinor: 0, // Cashflow: +0 EUR - a capital-gain play
  },
  {
    id: 'classic-small-efh-35k-2k',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    superDeal: true, // "Du findest einen Super Deal!"
    depositMinor: 200000, // Anzahlung: 2.000 EUR
    mortgageMinor: 3300000, // Hypothek: 33.000 EUR (Kosten: 35.000 EUR)
    cashflowMinor: 22000, // Cashflow: +220 EUR
  },
  {
    id: 'classic-small-efh-50k-2k',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    depositMinor: 200000, // Anzahlung: 2.000 EUR
    mortgageMinor: 4800000, // Hypothek: 48.000 EUR (Kosten: 50.000 EUR)
    cashflowMinor: 20000, // Cashflow: +200 EUR
  },
  {
    id: 'classic-small-efh-50k-4k',
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    depositMinor: 400000, // Anzahlung: 4.000 EUR
    mortgageMinor: 4600000, // Hypothek: 46.000 EUR (Kosten: 50.000 EUR)
    cashflowMinor: 20000, // Cashflow: +200 EUR
  },
  // Eigentumswohnung (ETW) - condominiums
  {
    id: 'classic-small-etw-40k-5k',
    title: 'Eigentumswohnung',
    assetKind: 'investment',
    symbol: 'ETW',
    depositMinor: 500000, // Anzahlung: 5.000 EUR
    mortgageMinor: 3500000, // Hypothek: 35.000 EUR (Kosten: 40.000 EUR)
    cashflowMinor: 22000, // Cashflow: +220 EUR
  },
  {
    id: 'classic-small-etw-40k-1k',
    title: 'Eigentumswohnung',
    assetKind: 'investment',
    symbol: 'ETW',
    depositMinor: 100000, // Anzahlung: 1.000 EUR
    mortgageMinor: 3900000, // Hypothek: 39.000 EUR (Kosten: 40.000 EUR)
    cashflowMinor: 0, // Cashflow: 0 EUR - a capital-gain play
  },
  {
    id: 'classic-small-etw-40k-4k',
    title: 'Eigentumswohnung',
    assetKind: 'investment',
    symbol: 'ETW',
    depositMinor: 400000, // Anzahlung: 4.000 EUR
    mortgageMinor: 3600000, // Hypothek: 36.000 EUR (Kosten: 40.000 EUR)
    cashflowMinor: 14000, // Cashflow: +140 EUR
  },
  {
    id: 'classic-small-etw-55k-5k',
    title: 'Eigentumswohnung',
    assetKind: 'investment',
    symbol: 'ETW',
    depositMinor: 500000, // Anzahlung: 5.000 EUR
    mortgageMinor: 5000000, // Hypothek: 50.000 EUR (Kosten: 55.000 EUR)
    cashflowMinor: 16000, // Cashflow: +160 EUR
  },
];

/**
 * Special assets: gold coins. Two plain offers ("Freund braucht schnell Bargeld", "Muenzsammler braucht
 * Bargeld": buy 10 / 5 coins well under the normal price) and two dice gambles ("Was ist in der Box?!",
 * "Wo ein Wille ist...": pay first, then a 6 wins ten coins, anything else wins nothing / an old cat).
 * They are an Asset in Grow, not a share or a property: bought for a price, kept as coins.
 */
const ASSET_CARDS: CashflowDealCard[] = [
  {
    id: 'classic-small-gold-friend-3000',
    title: 'Freund braucht schnell Bargeld',
    assetKind: 'asset',
    symbol: 'GOLD',
    costMinor: 300000, // Kosten: 3.000 EUR
    quantity: 10, // 10 Goldmuenzen
  },
  {
    id: 'classic-small-gold-collector-1000',
    title: 'Münzsammler braucht Bargeld',
    assetKind: 'asset',
    symbol: 'GOLD',
    costMinor: 100000, // Kosten: 1.000 EUR
    quantity: 5, // 5 Goldmuenzen
  },
  {
    id: 'classic-small-gold-box-500',
    title: 'Was ist in der Box?!',
    assetKind: 'asset',
    symbol: 'GOLD',
    costMinor: 50000, // Kosten: 500 EUR
    quantity: 10, // on a 6: zehn Goldmuenzen; 1-5: ueberhaupt nichts
    successOn: 6,
  },
  {
    id: 'classic-small-gold-will-750',
    title: 'Wo ein Wille ist...',
    assetKind: 'asset',
    symbol: 'GOLD',
    costMinor: 75000, // Kosten: 750 EUR (die Reise)
    quantity: 10, // on a 6: zehn Goldmuenzen; 1-5: eine aeltere Katze
    successOn: 6,
  },
  {
    // "Schwaegerin leiht sich Geld": pay 5.000 EUR, roll one die - 1-3 she never pays it back,
    // 4-6 she pays back 10.000 EUR. A cash gamble: no coins, no asset.
    id: 'classic-small-sister-5000',
    title: 'Schwägerin leiht sich Geld',
    assetKind: 'asset',
    symbol: 'LOAN',
    costMinor: 500000,
    payoutMinor: 1000000,
    successOn: 4,
  },
  // "Multi-Level-Marketing Einstieg" (two identical cards): pay 500 EUR and KEEP the card. At every
  // Payday roll one die - 1-3 nothing this month, 4-6 collect 500 EUR. Bought like a plain asset.
  ...['classic-small-mlm-1', 'classic-small-mlm-2'].map((id): CashflowDealCard => ({
    id,
    title: 'Multi-Level-Marketing Einstieg',
    assetKind: 'asset',
    symbol: 'MLM',
    costMinor: 50000,
    payoutMinor: 50000,
    successOn: 4,
    recurring: true,
  })),
];

export const CLASSIC_DEAL_SMALL: CashflowDealCard[] = [
  ...SECURITY_CARDS,
  ...INVESTMENT_CARDS,
  ...ASSET_CARDS,
];
