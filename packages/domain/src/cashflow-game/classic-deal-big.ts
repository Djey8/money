import type { CashflowDealCard } from './types';

/**
 * Classic Edition's Big Deal pile - the same investment shape as Small Deal, just a far larger
 * deposit and cashflow (todo/cashflow-game.md decision 54). Flavor text lives in
 * `assets/i18n/cashflow-cards/<lang>.json`, keyed by `id`.
 */
/**
 * Mehrfamilienhaus (MFH): an apartment building of 4 or 8 units (WE = Wohneinheiten). The printed
 * Hypothek is always Kosten minus Anzahlung, so only those two and the Cashflow are listed. The unit
 * count is part of the label (MFH4, MFH8) - a bought copy becomes MFH4, MFH4-II... in Grow.
 */
function multiFamilyHouse(
  units: 4 | 8,
  costEuro: number,
  depositEuro: number,
  cashflowEuro: number,
): CashflowDealCard {
  return {
    id: `classic-big-mfh${units}-${costEuro / 1000}k-${depositEuro / 1000}k`,
    title: `Mehrfamilienhaus ${units} WE`,
    assetKind: 'investment',
    symbol: `MFH${units}`,
    depositMinor: depositEuro * 100,
    mortgageMinor: (costEuro - depositEuro) * 100,
    cashflowMinor: cashflowEuro * 100,
  };
}

/**
 * The Big Deal pile's Einfamilienhaus (EFH): the same house as in Small Deal, just at a far larger
 * price. Same `EFH` label, so every house bought - small or big - is numbered together (EFH, EFH-II...).
 */
function bigSingleFamilyHouse(
  costEuro: number,
  depositEuro: number,
  cashflowEuro: number,
): CashflowDealCard {
  return {
    id: `classic-big-efh-${costEuro / 1000}k-${depositEuro / 1000}k`,
    title: 'Einfamilienhaus',
    assetKind: 'investment',
    symbol: 'EFH',
    depositMinor: depositEuro * 100,
    mortgageMinor: (costEuro - depositEuro) * 100,
    cashflowMinor: cashflowEuro * 100,
  };
}

/**
 * Doppelhaus (DH): a semi-detached house - one half owner-occupied or let, usually with a tenant in
 * the other. Bought copies read DH, DH-II... (SDH in English: see `symbols` in the card texts).
 */
function semiDetachedHouse(
  costEuro: number,
  depositEuro: number,
  cashflowEuro: number,
): CashflowDealCard {
  return {
    id: `classic-big-dh-${costEuro / 1000}k-${depositEuro / 1000}k`,
    title: 'Doppelhaus',
    assetKind: 'investment',
    symbol: 'DH',
    depositMinor: depositEuro * 100,
    mortgageMinor: (costEuro - depositEuro) * 100,
    cashflowMinor: cashflowEuro * 100,
  };
}

/**
 * Appartementhaus (APH): a larger apartment complex of 12, 24 or 60 units (WE). Like the smaller
 * Mehrfamilienhaus, the unit count is part of the label (APH12, APH24, APH60). Where a card is two
 * buildings (24 units in total) it is simply the APH24.
 */
function apartmentComplex(
  units: 12 | 24 | 60,
  costEuro: number,
  depositEuro: number,
  cashflowEuro: number,
): CashflowDealCard {
  return {
    id: `classic-big-aph${units}-${costEuro / 1000}k-${depositEuro / 1000}k`,
    title: `Appartementhaus ${units} WE`,
    assetKind: 'investment',
    symbol: `APH${units}`,
    depositMinor: depositEuro * 100,
    mortgageMinor: (costEuro - depositEuro) * 100,
    cashflowMinor: cashflowEuro * 100,
  };
}

/**
 * The Big Deal pile's businesses - not property: a business partner wanted (`GP`, always fully paid
 * in cash: Hypothek 0), an automated business (`AU`) and a car wash (`AWA`). Same investment shape,
 * so a bought one pays its Cashflow every Payday like a house. Two cards can share cost, deposit and
 * even the heading, so the cashflow is part of the id.
 */
function business(
  key: 'GP' | 'AU' | 'AWA',
  title: string,
  costEuro: number,
  depositEuro: number,
  cashflowEuro: number,
): CashflowDealCard {
  return {
    id: `classic-big-${key.toLowerCase()}-${costEuro / 1000}k-${depositEuro / 1000}k-${cashflowEuro}`,
    title,
    assetKind: 'investment',
    symbol: key,
    depositMinor: depositEuro * 100,
    mortgageMinor: (costEuro - depositEuro) * 100,
    cashflowMinor: cashflowEuro * 100,
  };
}

export const CLASSIC_DEAL_BIG: CashflowDealCard[] = [
  {
    id: 'classic-big-pizza',
    title: 'Pizzafranchise',
    assetKind: 'investment',
    symbol: 'PIZZA',
    depositMinor: 10000000, // Anzahlung: 100.000 EUR
    mortgageMinor: 40000000, // Hypothek: 400.000 EUR (Kosten: 500.000 EUR)
    cashflowMinor: 500000, // Cashflow: +5.000 EUR
  },
  //                 WE  Kosten   Anzahlung  Cashflow
  multiFamilyHouse(8, 240000, 40000, 1800),
  multiFamilyHouse(8, 320000, 40000, 1700),
  multiFamilyHouse(4, 340000, 32000, 1400),
  multiFamilyHouse(8, 250000, 40000, 2000),
  multiFamilyHouse(8, 360000, 32000, 1800),
  multiFamilyHouse(4, 280000, 16000, 1000),
  multiFamilyHouse(4, 370000, 10000, 900),
  multiFamilyHouse(4, 290000, 15000, 800),
  multiFamilyHouse(4, 300000, 20000, 1100),
  multiFamilyHouse(4, 225000, 15000, 700),
  //                      Kosten   Anzahlung  Cashflow
  bigSingleFamilyHouse(270000, 15000, 800),
  bigSingleFamilyHouse(225000, 14000, 750),
  bigSingleFamilyHouse(300000, 20000, 1000),
  bigSingleFamilyHouse(300000, 12000, 800),
  bigSingleFamilyHouse(325000, 18000, 900),
  bigSingleFamilyHouse(350000, 20000, 1000),
  bigSingleFamilyHouse(275000, 16000, 750),
  bigSingleFamilyHouse(275000, 15000, 800),
  //                  Kosten   Anzahlung  Cashflow
  semiDetachedHouse(260000, 12000, 600),
  semiDetachedHouse(250000, 16000, 900),
  semiDetachedHouse(170000, 18000, 900),
  semiDetachedHouse(245000, 12000, 800),
  semiDetachedHouse(260000, 10000, 1100),
  //                WE  Kosten     Anzahlung  Cashflow
  apartmentComplex(12, 350000, 50000, 3000),
  apartmentComplex(24, 575000, 75000, 3600),
  apartmentComplex(60, 1200000, 200000, 11000),
  apartmentComplex(24, 550000, 50000, 2400),
  // Geschäftspartner gesucht - the whole cost is the Anzahlung, no Hypothek
  //        key   title                         Kosten  Anzahlung  Cashflow
  business('GP', 'Geschäftspartner gesucht', 25000, 25000, 1300),
  business('GP', 'Geschäftspartner gesucht', 20000, 20000, 1200),
  business('GP', 'Geschäftspartner gesucht', 30000, 30000, 1500),
  business('GP', 'Geschäftspartner gesucht', 30000, 30000, 1700),
  // Automatisiertes Unternehmen zu verkaufen
  business('AU', 'Automatisiertes Unternehmen', 180000, 20000, 1600),
  business('AU', 'Automatisiertes Unternehmen', 125000, 25000, 1800),
  business('AU', 'Automatisiertes Unternehmen', 150000, 30000, 2500),
  // Autowaschanlage zu verkaufen
  business('AWA', 'Autowaschanlage', 350000, 50000, 2500),
];
