import type { CashflowMarketCard } from './types';

/**
 * The blue "Der Markt" pile (Market cards): an event for every player. The first kind is the buyer
 * who wants one type of property and offers the original price plus a percentage or a fixed amount;
 * anyone holding that type may sell as many as they like at that price (JFK, 2026-10-03). Playing
 * the card adds the offer to each fitting property of the player's - see `playMarketCard`.
 */
export const CLASSIC_MARKET: CashflowMarketCard[] = [
  {
    id: 'classic-market-efh-pct20-a',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 20%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusPercent: 20 },
  },
  {
    id: 'classic-market-efh-pct20-b',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 20%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusPercent: 20 },
  },
  {
    id: 'classic-market-efh-pct15',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 15%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusPercent: 15 },
  },
  {
    id: 'classic-market-efh-pct10-a',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 10%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusPercent: 10 },
  },
  {
    id: 'classic-market-efh-pct10-b',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 10%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusPercent: 10 },
  },
  {
    id: 'classic-market-efh-amt20k',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 20.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusMinor: 2000000 },
  },
  {
    id: 'classic-market-efh-amt15k',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 15.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusMinor: 1500000 },
  },
  {
    id: 'classic-market-efh-amt10k',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 10.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusMinor: 1000000 },
  },
  {
    id: 'classic-market-efh-amt5k',
    title: 'Einfamilienhaus Käufer',
    description:
      'Käufer sucht ein Einfamilienhaus. Er bietet den ursprünglichen Preis + 5.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'EFH', plusMinor: 500000 },
  },
  {
    id: 'classic-market-mfh-pct20',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 20%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'MFH', symbols: ['MFH4', 'MFH8'], plusPercent: 20 },
  },
  {
    id: 'classic-market-mfh-pct15',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 15%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'MFH', symbols: ['MFH4', 'MFH8'], plusPercent: 15 },
  },
  {
    id: 'classic-market-mfh-pct10',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 10%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'MFH', symbols: ['MFH4', 'MFH8'], plusPercent: 10 },
  },
  {
    id: 'classic-market-mfh-pct5',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 5%. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'MFH', symbols: ['MFH4', 'MFH8'], plusPercent: 5 },
  },
  {
    id: 'classic-market-mfh-amt30k',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 30.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: {
      family: 'MFH',
      symbols: ['MFH4', 'MFH8'],
      plusMinor: 3000000,
    },
  },
  {
    id: 'classic-market-mfh-amt20k',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 20.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: {
      family: 'MFH',
      symbols: ['MFH4', 'MFH8'],
      plusMinor: 2000000,
    },
  },
  {
    id: 'classic-market-mfh-amt15k',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 15.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: {
      family: 'MFH',
      symbols: ['MFH4', 'MFH8'],
      plusMinor: 1500000,
    },
  },
  {
    id: 'classic-market-mfh-amt10k',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 10.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: {
      family: 'MFH',
      symbols: ['MFH4', 'MFH8'],
      plusMinor: 1000000,
    },
  },
  {
    id: 'classic-market-mfh-amt5k',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 5.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: {
      family: 'MFH',
      symbols: ['MFH4', 'MFH8'],
      plusMinor: 500000,
    },
  },
  {
    id: 'classic-market-mfh-amt1k',
    title: 'Appartement- und Mehrfamilienhaus Käufer',
    description:
      'Käufer sucht Appartement- und Mehrfamilienhäuser mit jeder Anzahl von Wohneinheiten (WE). Er bietet den ursprünglichen Preis + 1.000 €. Jeder kann beliebig viele Immobilien zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: {
      family: 'MFH',
      symbols: ['MFH4', 'MFH8'],
      plusMinor: 100000,
    },
  },
  {
    id: 'classic-market-etw-65k',
    title: 'Eigentumswohnung Käufer',
    description:
      'Für deine Eigentumswohnung (ETW) werden 65.000 € angeboten. Der Käufer hat eine eigene Finanzierung. Jeder kann zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'ETW', symbols: ['ETW'], priceMinor: 6500000 },
  },
  {
    id: 'classic-market-etw-45k',
    title: 'Eigentumswohnung Käufer',
    description:
      'Für deine Eigentumswohnung (ETW) werden 45.000 € angeboten. Der Käufer hat eine eigene Finanzierung. Jeder kann zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'ETW', symbols: ['ETW'], priceMinor: 4500000 },
  },
  {
    id: 'classic-market-aph-45k',
    title: 'Appartementhaus Käufer',
    description:
      'Käufer bietet 45.000 € pro Wohneinheit (WE) in Appartementhäusern jeder Größe. Der Käufer hat eine eigene Finanzierung. Jeder kann zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'APH', symbols: ['APH12', 'APH24', 'APH60'], pricePerUnitMinor: 4500000 },
  },
  {
    id: 'classic-market-aph-25k',
    title: 'Appartementhaus Käufer',
    description:
      'Käufer bietet 25.000 € pro Wohneinheit (WE) in Appartementhäusern jeder Größe. Der Käufer hat eine eigene Finanzierung. Jeder kann zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'APH', symbols: ['APH12', 'APH24', 'APH60'], pricePerUnitMinor: 2500000 },
  },
  {
    id: 'classic-market-aph-ag40k',
    title: 'Appartementhaus Käufer',
    description:
      'Immobilien AG bietet 40.000 € pro Wohneinheit (WE) in Appartementhäusern jeder Größe. Der Käufer hat eine eigene Finanzierung. Jeder kann zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'APH', symbols: ['APH12', 'APH24', 'APH60'], pricePerUnitMinor: 4000000 },
  },
  {
    id: 'classic-market-aph-ag30k',
    title: 'Appartementhaus Käufer',
    description:
      'Immobilien AG bietet 30.000 € pro Wohneinheit (WE) in Appartementhäusern jeder Größe. Der Käufer hat Kapital aus dem Verkauf eines anderen Apartment Komplexes. Jeder kann zu diesem Preis verkaufen. Wenn du verkaufst, bezahle die dazugehörige Hypothek zurück und streiche den Cashflow dieser Immobilie.',
    sells: { family: 'APH', symbols: ['APH12', 'APH24', 'APH60'], pricePerUnitMinor: 3000000 },
  },
  {
    id: 'classic-market-gold-collector-1k',
    title: 'Sammler sucht Goldmünzen',
    description:
      'Wohlhabender Sammler sucht nach Goldmünzen. Er bietet 1.000 € in bar für jede Münze. Jeder kann beliebig viele Münzen zu diesem Preis verkaufen.',
    sells: { family: 'GOLD', symbols: ['GOLD'], pricePerCoinMinor: 100000 },
  },
  {
    id: 'classic-market-gold-unrest-1k',
    title: 'Der Goldpreis steigt',
    description:
      'Unruhen in Übersee. Die Ölpreise sind bedroht. Der Goldpreis schießt in die Höhe. Ein Käufer bietet 1.000 € in bar für jede Goldmünze. Jeder kann beliebig viele Münzen zu diesem Preis verkaufen.',
    sells: { family: 'GOLD', symbols: ['GOLD'], pricePerCoinMinor: 100000 },
  },
  {
    id: 'classic-market-gold-central-2k',
    title: 'Der Goldpreis steigt',
    description:
      'Die Zentralbank druckt Geld und verursacht, in dem Versuch, die Wirtschaft anzukurbeln, eine starke Inflation. Der Goldpreis schießt in die Höhe. Ein Käufer bietet 2.000 € in bar für jede Goldmünze. Jeder kann beliebig viele Münzen zu diesem Preis verkaufen.',
    sells: { family: 'GOLD', symbols: ['GOLD'], pricePerCoinMinor: 200000 },
  },
  {
    id: 'classic-market-cost-tenant-1k',
    title: 'Mieter beschädigt deine Immobilie',
    description:
      'Ein Mieter weigert sich die Miete zu zahlen. Nachdem die Wohnung zwangsgeräumt wurde, findest du einen beträchtlichen Schaden an deiner Immobilie vor. Die Versicherung deckt die meisten Reparaturen, aber du musst trotzdem noch 1.000 € (einmalig) zahlen. Nimm ein Darlehen bei der Bank auf, wenn nötig, um die Kosten zu decken. Die Karte gilt nur für die Person, die sie gezogen hat. Wenn du KEINE Immobilie besitzt, ignoriere diese Karte.',
    pays: { costMinor: 100000 },
  },
  {
    id: 'classic-market-cost-tenant-500-a',
    title: 'Mieter beschädigt deine Immobilie',
    description:
      'Ein Mieter weigert sich die Miete zu zahlen. Nachdem die Wohnung zwangsgeräumt wurde, findest du einen beträchtlichen Schaden an deiner Immobilie vor. Die Versicherung deckt die meisten Reparaturen, aber du musst trotzdem noch 500 € (einmalig) zahlen. Nimm ein Darlehen bei der Bank auf, wenn nötig, um die Kosten zu decken. Die Karte gilt nur für die Person, die sie gezogen hat. Wenn du KEINE Immobilie besitzt, ignoriere diese Karte.',
    pays: { costMinor: 50000 },
  },
  {
    id: 'classic-market-cost-tenant-500-b',
    title: 'Mieter beschädigt deine Immobilie',
    description:
      'Ein Mieter weigert sich die Miete zu zahlen. Nachdem die Wohnung zwangsgeräumt wurde, findest du einen beträchtlichen Schaden an deiner Immobilie vor. Die Versicherung deckt die meisten Reparaturen, aber du musst trotzdem noch 500 € (einmalig) zahlen. Nimm ein Darlehen bei der Bank auf, wenn nötig, um die Kosten zu decken. Die Karte gilt nur für die Person, die sie gezogen hat. Wenn du KEINE Immobilie besitzt, ignoriere diese Karte.',
    pays: { costMinor: 50000 },
  },
  {
    id: 'classic-market-cost-pipe-1k',
    title: 'Abwasserrohr gebrochen',
    description:
      'Deine Immobilie steht unter Wasser! Zahle 1.000 € für ein neues Abwasserrohr (einmalig). Nimm ein Darlehen bei der Bank auf, wenn nötig, um die Kosten zu decken. Die Karte gilt nur für die Person, die sie gezogen hat. Wenn du KEINE Immobilie besitzt, ignoriere diese Karte.',
    pays: { costMinor: 100000 },
  },
  {
    id: 'classic-market-cost-pipe-2k',
    title: 'Abwasserrohr gebrochen',
    description:
      'Deine Immobilie steht unter Wasser! Zahle 2.000 € für ein neues Abwasserrohr (einmalig). Nimm ein Darlehen bei der Bank auf, wenn nötig, um die Kosten zu decken. Die Karte gilt nur für die Person, die sie gezogen hat. Wenn du KEINE Immobilie besitzt, ignoriere diese Karte.',
    pays: { costMinor: 200000 },
  },
  {
    id: 'classic-market-split-ok4u',
    title: 'Aktie - OK4U Pharma AG',
    description:
      'OK4U beginnt Versuche mit eventuell lebensrettendem Medikament. Nebenwirkungen sind noch nicht getestet. Es könnte die Welt verändern... wenn es wirkt. Der Karteninhaber würfelt mit einem Würfel. Du hast 1-3 gewürfelt: AKTIENSPLIT! Jeder, der OK4U-Aktien besitzt, VERDOPPELT seine Anteile. Du hast 4-6 gewürfelt: RÜCKWÄRTSSPLIT! Jeder, der OK4U-Aktien besitzt, verliert die Hälfte seiner Anteile. (Du zahlst kein Geld. Deine Gesamtkosten ändern sich nicht.) Symbol: OK4U SPLIT oder RÜCKWÄRTSSPLIT?',
    splits: { symbol: 'OK4U' },
  },
  {
    id: 'classic-market-split-myt4u',
    title: 'Aktie - MYT4U Electronics Co.',
    description:
      'MYT4U geht mit neuer Heimunterhaltungstechnik ein Risiko ein. Wird es ein großer Erfolg oder eine Bruchlandung? Der Karteninhaber würfelt mit einem Würfel. Du hast 1-3 gewürfelt: AKTIENSPLIT! Jeder, der MYT4U-Aktien besitzt, VERDOPPELT seine Anteile. Du hast 4-6 gewürfelt: RÜCKWÄRTSSPLIT! Jeder, der MYT4U-Aktien besitzt, verliert die Hälfte seiner Anteile. (Du zahlst kein Geld. Deine Gesamtkosten ändern sich nicht.) Symbol: MYT4U SPLIT oder RÜCKWÄRTSSPLIT?',
    splits: { symbol: 'MYT4U' },
  },
  {
    id: 'classic-market-split-gro4us',
    title: 'Investmentfonds – GRO4US',
    description:
      'Der Markt ist im Wandel und es wird in den nächsten Monaten starke Marktumschwünge geben. Wie werden sich Fonds in dieser Zeit der Veränderung verhalten? Der Karteninhaber würfelt mit einem Würfel. Du hast 1-3 gewürfelt: AKTIENSPLIT! Jeder, der GRO4US-Aktien besitzt, VERDOPPELT seine Anteile. Du hast 4-6 gewürfelt: RÜCKWÄRTSSPLIT! Jeder, der GRO4US-Aktien besitzt, verliert die Hälfte seiner Anteile. (Du zahlst kein Geld. Deine Gesamtkosten ändern sich nicht.) Symbol: GRO4US SPLIT oder RÜCKWÄRTSSPLIT?',
    splits: { symbol: 'GRO4US' },
  },
  {
    id: 'classic-market-split-on2u',
    title: 'Aktie - ON2U Entertainment AG',
    description:
      'Studio unterstützt neuen Direktor bei seinem Sommer-Blockbuster. Die bahnbrechende Produktion könnte zu ambitioniert sein. Der Karteninhaber würfelt mit einem Würfel. Du hast 1-3 gewürfelt: AKTIENSPLIT! Jeder, der ON2U-Aktien besitzt, VERDOPPELT seine Anteile. Du hast 4-6 gewürfelt: RÜCKWÄRTSSPLIT! Jeder, der ON2U-Aktien besitzt, verliert die Hälfte seiner Anteile. (Du zahlst kein Geld. Deine Gesamtkosten ändern sich nicht.) Symbol: ON2U SPLIT oder RÜCKWÄRTSSPLIT?',
    splits: { symbol: 'ON2U' },
  },
  {
    id: 'classic-market-boost-small-250',
    title: 'Kleiner Business Boom!',
    description:
      'Die Wirtschaft im Stadtzentrum explodiert! JEDER ist betroffen. ALLE Geschäfte mit einem Cashflow von 1.000 € oder geringer, erhöhen ihren Cashflow um 250 €.',
    star: true,
    boost: { maxCashflowMinor: 100000, addMinor: 25000 },
  },
  {
    id: 'classic-market-boost-mgmt-400',
    title: 'Neues Managementsystem',
    description:
      'Ein neues Managementsystem schafft neue Produktivität und geringere Kosten. Nur die Person, die diese Karte gezogen hat, ist davon betroffen. ALLE Geschäfte mit einem Cashflow von 2.000 € oder geringer, erhöhen ihren Cashflow um 400 €.',
    star: true,
    boost: { maxCashflowMinor: 200000, addMinor: 40000 },
  },
];
