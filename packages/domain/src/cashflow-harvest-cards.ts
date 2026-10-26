import type { HarvestCard } from './cashflow-game/harvest-deck';

/**
 * The Harvest stack of the Dreamfund game (JFK, 2026-10-26), generated from temp_cards/dreamfund-harvest-deck.md v0.2: 87 cards, the
 * market. Copies are those of a Medium game. The cards that say what happens to a holder in words are written down as data here.
 */
export const HARVEST_CARDS: HarvestCard[] = [
  {
    id: 'H01',
    group: 'market',
    copies: 1,
    title: {
      en: 'Market Crash',
      de: 'Börsencrash',
    },
    story: {
      en: 'Panic on every screen. Indices fall for days in a row.',
      de: 'Panik auf allen Bildschirmen. Die Indizes fallen tagelang.',
    },
    realWorld:
      'The MSCI World lost about 34% within weeks in 2020 and about 50% in 2000–03 and 2008–09. Those who held recovered; those who sold locked in the loss.',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 0.75,
          EMERG: 0.7,
          DIVID: 0.82,
          AUTO: 0.72,
          INSU: 0.82,
          TECH: 0.62,
          ENERGY: 0.75,
          REIT: 0.8,
          BTC: 0.6,
          ETH: 0.55,
          ALTS: 0.45,
          GOLD: 1.06,
          SILVER: 0.9,
          BOND: 1.03,
          PRIVATE: 0.88,
          PROPERTY: 0.97,
          CARDS: 0.85,
          COLLECT: 0.88,
          CLASSIC: 0.9,
          ART: 0.88,
        },
      },
    ],
    links: [
      {
        label: 'zendepot – MSCI World Rendite und Crashs',
        url: 'https://zendepot.de/etf/msci-world-rendite',
      },
    ],
  },
  {
    id: 'H02',
    group: 'market',
    copies: 0,
    title: {
      en: 'Financial Crisis',
      de: 'Finanzkrise',
    },
    story: {
      en: 'A big bank wobbles. Credit dries up, and the bad news keeps coming for months.',
      de: 'Eine Großbank wankt. Kredite versiegen, und die schlechten Nachrichten reißen monatelang nicht ab.',
    },
    realWorld:
      'In 2008–09 the MSCI World fell by more than 50% and needed about six years to recover.',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 0.85,
          EMERG: 0.82,
          DIVID: 0.88,
          INSU: 0.85,
          REIT: 0.82,
          PROPERTY: 0.94,
          GOLD: 1.08,
          BOND: 1.04,
          TECH: 0.88,
          AUTO: 0.84,
        },
      },
      {
        op: 'nextPaydayIndex',
        factors: {
          WORLD: 0.92,
          EMERG: 0.92,
          DIVID: 0.94,
          REIT: 0.94,
          PROPERTY: 0.97,
        },
      },
      {
        op: 'holderDice',
        targets: ['LENDING'],
        bands: [
          {
            from: 1,
            to: 3,
            value: {
              pausePayoutsPaydays: 6,
            },
          },
          {
            from: 4,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'zendepot – MSCI World Rendite und Crashs',
        url: 'https://zendepot.de/etf/msci-world-rendite',
      },
    ],
  },
  {
    id: 'H03',
    group: 'market',
    copies: 1,
    title: {
      en: 'Recession',
      de: 'Rezession',
    },
    story: {
      en: 'Two quarters of shrinking economy. People spend less — your customers too.',
      de: 'Zwei Quartale schrumpfende Wirtschaft. Die Leute geben weniger aus — deine Kunden auch.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 0.9,
          EMERG: 0.87,
          AUTO: 0.82,
          DIVID: 0.92,
          TECH: 0.9,
          PROPERTY: 0.98,
        },
      },
      {
        op: 'cashflowFactor',
        groups: ['FOOD', 'RENTALBIZ', 'VENDING', 'BUSINESS'],
        factor: 0.8,
        paydays: 6,
      },
    ],
    links: [],
  },
  {
    id: 'H04',
    group: 'market',
    copies: 1,
    title: {
      en: 'Boom Year',
      de: 'Boomjahr',
    },
    story: {
      en: 'Record profits, full order books, everyone is hiring.',
      de: 'Rekordgewinne, volle Auftragsbücher, alle stellen ein.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 1.14,
          EMERG: 1.15,
          TECH: 1.22,
          AUTO: 1.15,
          DIVID: 1.08,
          INSU: 1.06,
          BTC: 1.2,
          ETH: 1.2,
          ALTS: 1.3,
          PROPERTY: 1.03,
        },
      },
      {
        op: 'sellWindow',
        markets: ['WORLD', 'EMERG', 'TECH', 'AUTO', 'DIVID'],
      },
      {
        op: 'cashflowFactor',
        groups: ['FOOD', 'RENTALBIZ', 'VENDING', 'BUSINESS'],
        factor: 1.15,
        paydays: 6,
      },
    ],
    links: [],
  },
  {
    id: 'H05',
    group: 'market',
    copies: 3,
    title: {
      en: 'Bull Market',
      de: 'Bullenmarkt',
    },
    story: {
      en: 'Quarter after quarter of slow, steady gains. Boring is beautiful.',
      de: 'Quartal für Quartal langsame, stetige Gewinne. Langweilig ist schön.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 1.07,
          EMERG: 1.06,
          TECH: 1.1,
          DIVID: 1.05,
          INSU: 1.04,
        },
      },
      {
        op: 'sellWindow',
        markets: ['WORLD', 'EMERG', 'TECH', 'DIVID', 'INSU'],
      },
    ],
    links: [],
  },
  {
    id: 'H06',
    group: 'market',
    copies: 1,
    title: {
      en: 'Central Bank Raises Rates',
      de: 'Leitzins steigt',
    },
    story: {
      en: 'The central bank fights inflation with another rate hike.',
      de: 'Die Notenbank bekämpft die Inflation mit einer weiteren Zinserhöhung.',
    },
    realWorld:
      'The ECB raised its deposit rate by 25 basis points to 2.50% in September 2026. In 2022, rising rates made German government bonds lose more than 22%.',
    ops: [
      {
        op: 'index',
        factors: {
          BOND: 0.96,
          REIT: 0.93,
          TECH: 0.94,
          PROPERTY: 0.97,
          WORLD: 0.98,
        },
      },
      {
        op: 'savingsRate',
        factor: 1.1,
      },
      {
        op: 'mortgageRate',
        pp: 0.5,
      },
    ],
    links: [
      {
        label: 'Raisin – Zinsradar 10/2026 (EZB-Einlagenzins)',
        url: 'https://www.raisin.com/de-de/geldanlage/zinsradar/',
      },
      {
        label: 'DWN – Staatsanleihen 2022 historischer Wertverlust',
        url: 'https://deutsche-wirtschafts-nachrichten.de/701645/deutsche-staatsanleihen-verzeichnen-historischen-wertverlust',
      },
    ],
  },
  {
    id: 'H07',
    group: 'market',
    copies: 1,
    title: {
      en: 'Central Bank Cuts Rates',
      de: 'Leitzins sinkt',
    },
    story: {
      en: 'Growth is weak; the central bank cuts rates to help.',
      de: 'Das Wachstum schwächelt; die Notenbank senkt den Zins, um zu helfen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          BOND: 1.05,
          REIT: 1.1,
          TECH: 1.07,
          PROPERTY: 1.03,
          WORLD: 1.03,
        },
      },
      {
        op: 'sellWindow',
        markets: ['BOND', 'REIT'],
      },
      {
        op: 'savingsRate',
        factor: 0.9,
      },
      {
        op: 'mortgageRate',
        pp: -0.5,
      },
    ],
    links: [],
  },
  {
    id: 'H08',
    group: 'market',
    copies: 1,
    title: {
      en: 'Inflation Spike',
      de: 'Inflationsschub',
    },
    story: {
      en: 'Prices at the supermarket jump. Your money buys less every month.',
      de: 'Die Preise im Supermarkt springen. Dein Geld kauft jeden Monat weniger.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          GOLD: 1.1,
          SILVER: 1.1,
          BOND: 0.95,
          DIVID: 0.96,
          FARM: 1.05,
        },
      },
      {
        op: 'expensesPercent',
        percent: 3,
      },
      {
        op: 'rentPercent',
        percent: 3,
      },
    ],
    links: [],
    note: "All players' monthly living expenses +3% permanently; property rents +3% (index-linked leases).",
  },
  {
    id: 'H09',
    group: 'market',
    copies: 1,
    title: {
      en: 'Energy Price Shock',
      de: 'Energiepreisschock',
    },
    story: {
      en: 'Gas and electricity prices explode. Solar and wind suddenly look brilliant.',
      de: 'Gas- und Strompreise explodieren. Solar und Wind sehen plötzlich brillant aus.',
    },
    realWorld:
      'In 2022 energy prices drove inflation in Europe; the ECB raised rates by 2.5 percentage points that year.',
    ops: [
      {
        op: 'index',
        factors: {
          ENERGY: 1.3,
          AUTO: 0.9,
          WORLD: 0.96,
        },
      },
      {
        op: 'sellWindow',
        markets: ['ENERGY'],
      },
      {
        op: 'cashflowFactor',
        groups: ['S08'],
        factor: 1.5,
        paydays: 6,
      },
      {
        op: 'expensesAdd',
        minor: 3000,
        paydays: 6,
      },
    ],
    links: [
      {
        label: 'DWN – Staatsanleihen 2022 historischer Wertverlust',
        url: 'https://deutsche-wirtschafts-nachrichten.de/701645/deutsche-staatsanleihen-verzeichnen-historischen-wertverlust',
      },
    ],
  },
  {
    id: 'H10',
    group: 'market',
    copies: 1,
    title: {
      en: 'Banking Scare',
      de: 'Bankenpanik',
    },
    story: {
      en: 'A mid-sized bank fails over a weekend. Everyone checks their deposit protection.',
      de: 'Eine mittelgroße Bank kippt über ein Wochenende. Alle prüfen ihre Einlagensicherung.',
    },
    realWorld:
      'P2P platforms Envestio and Kuetzal collapsed in 2020; P2P investments have no deposit protection. Bank deposits are protected up to €100,000 per bank.',
    ops: [
      {
        op: 'index',
        factors: {
          REIT: 0.9,
          DIVID: 0.93,
          INSU: 0.9,
          GOLD: 1.06,
          WORLD: 0.96,
        },
      },
      {
        op: 'indexDice',
        markets: ['BTC'],
        bands: [
          {
            from: 1,
            to: 3,
            value: 0.85,
          },
          {
            from: 4,
            to: 6,
            value: 1.25,
          },
        ],
      },
      {
        op: 'holderDice',
        targets: ['LENDING'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              loseCapitalPercent: 70,
              endsProject: true,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'etf.capital – P2P-Kredite 2026',
        url: 'https://etf.capital/p2p-kredite-geldanlage-2026/',
      },
    ],
  },
  {
    id: 'H11',
    group: 'market',
    copies: 2,
    title: {
      en: 'Markets Recover',
      de: 'Märkte erholen sich',
    },
    story: {
      en: 'Fear fades. Bargain hunters return.',
      de: 'Die Angst verfliegt. Schnäppchenjäger kehren zurück.',
    },
    realWorld:
      'After the 2020 crash, the MSCI World recovered within months; after 2008–09 it took about six years.',
    ops: [
      {
        op: 'recover',
        fraction: 0.5,
      },
      {
        op: 'sellWindow',
        markets: 'ALL',
      },
    ],
    links: [
      {
        label: 'zendepot – MSCI World Rendite und Crashs',
        url: 'https://zendepot.de/etf/msci-world-rendite',
      },
    ],
    note: 'Every market index below 1.00 recovers half of its gap to 1.00 (traps excluded).',
  },
  {
    id: 'H12',
    group: 'market',
    copies: 3,
    title: {
      en: 'Quiet Market',
      de: 'Ruhiger Markt',
    },
    story: {
      en: 'Nothing moves. No buyers, no news, no drama.',
      de: 'Nichts bewegt sich. Keine Käufer, keine Nachrichten, kein Drama.',
    },
    realWorld: '',
    ops: [],
    links: [],
  },
  {
    id: 'H81',
    group: 'market',
    copies: 1,
    title: {
      en: 'Strong Earnings Season',
      de: 'Starke Berichtssaison',
    },
    story: {
      en: 'Company after company beats expectations.',
      de: 'Ein Unternehmen nach dem anderen übertrifft die Erwartungen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 1.06,
          DIVID: 1.05,
          INSU: 1.04,
          AUTO: 1.06,
          EMERG: 1.04,
        },
      },
      {
        op: 'sellWindow',
        markets: ['WORLD', 'DIVID', 'INSU', 'AUTO', 'EMERG'],
      },
    ],
    links: [],
  },
  {
    id: 'H82',
    group: 'market',
    copies: 1,
    title: {
      en: 'Stimulus Package',
      de: 'Konjunkturpaket',
    },
    story: {
      en: 'The government announces a big investment programme for infrastructure and energy.',
      de: 'Die Regierung kündigt ein großes Investitionsprogramm für Infrastruktur und Energie an.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 1.06,
          EMERG: 1.05,
          AUTO: 1.08,
          ENERGY: 1.08,
          PROPERTY: 1.02,
        },
      },
      {
        op: 'sellWindow',
        markets: ['WORLD', 'EMERG', 'AUTO', 'ENERGY'],
      },
    ],
    links: [],
  },
  {
    id: 'H83',
    group: 'market',
    copies: 1,
    title: {
      en: 'Energy Prices Ease',
      de: 'Energiepreise sinken',
    },
    story: {
      en: 'Gas storage is full, prices fall. Industry breathes again.',
      de: 'Die Gasspeicher sind voll, die Preise fallen. Die Industrie atmet auf.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          WORLD: 1.04,
          AUTO: 1.06,
          ENERGY: 0.93,
          GOLD: 0.97,
        },
      },
      {
        op: 'expensesAdd',
        minor: -1500,
        paydays: 6,
      },
    ],
    links: [],
  },
  {
    id: 'H13',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Car Maker Misses Forecast',
      de: 'Autobauer verfehlt Prognose',
    },
    story: {
      en: 'Weak sales in China, expensive electric models. The dividend gets cut.',
      de: 'Schwache Verkäufe in China, teure E-Modelle. Die Dividende wird gekürzt.',
    },
    realWorld:
      'For 2026, most German car makers cut their dividends (BMW was an exception with a small raise).',
    ops: [
      {
        op: 'index',
        factors: {
          AUTO: 0.84,
        },
      },
      {
        op: 'payoutFactor',
        factors: {
          AUTO: 0.6,
        },
        paydays: 12,
      },
    ],
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
  },
  {
    id: 'H14',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Car Maker Record Year',
      de: 'Rekordjahr beim Autobauer',
    },
    story: {
      en: 'A hit model, record margins — and a special dividend.',
      de: 'Ein Erfolgsmodell, Rekordmargen — und eine Sonderdividende.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          AUTO: 1.2,
        },
      },
      {
        op: 'sellWindow',
        markets: ['AUTO'],
      },
      {
        op: 'specialPayout',
        perUnitMinor: {
          AUTO: 200,
        },
      },
    ],
    links: [],
    note: 'Special dividend: +2 TT per AUTO unit, once.',
  },
  {
    id: 'H15',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Year of Catastrophes',
      de: 'Katastrophenjahr',
    },
    story: {
      en: 'Floods, storms, hail. Insurers pay billions — but keep their dividend.',
      de: 'Fluten, Stürme, Hagel. Versicherer zahlen Milliarden — halten aber die Dividende.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          INSU: 0.85,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H16',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Insurer Raises Dividend',
      de: 'Versicherer erhöht Dividende',
    },
    story: {
      en: 'Strong results: the payout goes up again.',
      de: 'Starke Zahlen: Die Ausschüttung steigt erneut.',
    },
    realWorld: 'Allianz paid €17.10 per share for 2026 (yield ~4.5%).',
    ops: [
      {
        op: 'index',
        factors: {
          INSU: 1.06,
        },
      },
      {
        op: 'sellWindow',
        markets: ['INSU'],
      },
      {
        op: 'payoutFactor',
        factors: {
          INSU: 1.1,
        },
        paydays: null,
      },
    ],
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
  },
  {
    id: 'H17',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Dividend Payers Shine',
      de: 'Dividendenzahler glänzen',
    },
    story: {
      en: 'In uncertain times, investors pay up for reliable payouts.',
      de: 'In unsicheren Zeiten zahlen Anleger mehr für verlässliche Ausschüttungen.',
    },
    realWorld: 'Almost half of DAX companies had a dividend yield of 3% or more in 2026.',
    ops: [
      {
        op: 'index',
        factors: {
          DIVID: 1.07,
        },
      },
      {
        op: 'sellWindow',
        markets: ['DIVID'],
      },
      {
        op: 'payoutFactor',
        factors: {
          DIVID: 1.05,
        },
        paydays: null,
      },
    ],
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
  },
  {
    id: 'H18',
    group: 'shares',
    copies: 2,
    title: {
      en: 'Tech Earnings Season',
      de: 'Tech-Berichtssaison',
    },
    story: {
      en: "Quarterly numbers are out. The market's verdict is brutal either way.",
      de: 'Die Quartalszahlen sind da. Das Urteil des Marktes ist so oder so brutal.',
    },
    realWorld: '',
    ops: [
      {
        op: 'indexDice',
        markets: ['TECH'],
        bands: [
          {
            from: 1,
            to: 2,
            value: 0.75,
          },
          {
            from: 3,
            to: 4,
            value: 1.05,
          },
          {
            from: 5,
            to: 6,
            value: 1.35,
          },
        ],
      },
      {
        op: 'sellWindow',
        markets: ['TECH'],
      },
    ],
    links: [],
  },
  {
    id: 'H19',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Stock Split',
      de: 'Aktiensplit',
    },
    story: {
      en: 'After a big run, the tech company splits its shares 2-for-1.',
      de: 'Nach einem starken Lauf teilt die Tech-Firma ihre Aktien 2-zu-1.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          TECH: 1.04,
        },
      },
      {
        op: 'sellWindow',
        markets: ['TECH'],
      },
      {
        op: 'split',
        tag: 'TECH',
        factor: 2,
      },
    ],
    links: [],
    note: 'Units ×2, unit price ÷2 (value unchanged); the news adds +4%.',
  },
  {
    id: 'H20',
    group: 'shares',
    copies: 1,
    title: {
      en: 'AI Bubble Bursts',
      de: 'KI-Blase platzt',
    },
    story: {
      en: "The promised profits don't come. Tech valuations collapse.",
      de: 'Die versprochenen Gewinne bleiben aus. Die Tech-Bewertungen brechen ein.',
    },
    realWorld:
      'In the dot-com crash, the Nasdaq fell about 78% from March 2000 and needed about 15 years to regain its peak.',
    ops: [
      {
        op: 'index',
        factors: {
          TECH: 0.55,
          WORLD: 0.94,
          ENERGY: 0.95,
        },
      },
    ],
    links: [
      {
        label: 'aktienrenterechner – Dotcom-Blase (Nasdaq −78%)',
        url: 'https://aktienrenterechner.de/ratgeber/dotcom-blase-2000',
      },
    ],
  },
  {
    id: 'H21',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Green Subsidies Cut',
      de: 'Förderung gestrichen',
    },
    story: {
      en: 'The government cuts renewable energy subsidies overnight.',
      de: 'Die Regierung streicht über Nacht die Förderung für erneuerbare Energien.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          ENERGY: 0.7,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H22',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Energy Transition Boom',
      de: 'Energiewende-Boom',
    },
    story: {
      en: 'A huge government programme for wind and solar.',
      de: 'Ein riesiges staatliches Programm für Wind und Solar.',
    },
    realWorld: '',
    ops: [
      {
        op: 'indexDice',
        markets: ['ENERGY'],
        bands: [
          {
            from: 1,
            to: 2,
            value: 1.0,
          },
          {
            from: 3,
            to: 5,
            value: 1.3,
          },
          {
            from: 6,
            to: 6,
            value: 1.8,
          },
        ],
      },
      {
        op: 'sellWindow',
        markets: ['ENERGY'],
      },
    ],
    links: [],
  },
  {
    id: 'H23',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Currency Crisis',
      de: 'Währungskrise',
    },
    story: {
      en: "An emerging market's currency collapses; investors flee the whole region.",
      de: 'Die Währung eines Schwellenlands bricht ein; Anleger fliehen aus der ganzen Region.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          EMERG: 0.75,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H24',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Emerging Markets Rally',
      de: 'Schwellenländer-Rally',
    },
    story: {
      en: 'A weaker dollar, strong growth in Asia: emerging markets fly.',
      de: 'Ein schwächerer Dollar, starkes Wachstum in Asien: Schwellenländer heben ab.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          EMERG: 1.2,
        },
      },
      {
        op: 'sellWindow',
        markets: ['EMERG'],
      },
    ],
    links: [],
  },
  {
    id: 'H25',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Empty Offices',
      de: 'Leere Büros',
    },
    story: {
      en: 'Home office is here to stay. Office landlords cut their payouts.',
      de: 'Homeoffice bleibt. Büro-Vermieter kürzen ihre Ausschüttungen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          REIT: 0.87,
        },
      },
      {
        op: 'payoutFactor',
        factors: {
          REIT: 0.85,
        },
        paydays: 12,
      },
    ],
    links: [],
  },
  {
    id: 'H26',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Bond Rally',
      de: 'Anleihen-Rally',
    },
    story: {
      en: 'Investors flee to safety; bond prices rise.',
      de: 'Anleger flüchten in Sicherheit; Anleihekurse steigen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          BOND: 1.05,
        },
      },
      {
        op: 'sellWindow',
        markets: ['BOND'],
      },
    ],
    links: [],
  },
  {
    id: 'H27',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Bonds Tumble',
      de: 'Anleihen fallen',
    },
    story: {
      en: 'Interest rates jump; existing bonds lose value.',
      de: 'Die Zinsen springen; bestehende Anleihen verlieren an Wert.',
    },
    realWorld:
      '2022 was a historic bond year: German government bonds lost more than 22% as yields rose at a record pace.',
    ops: [
      {
        op: 'index',
        factors: {
          BOND: 0.9,
        },
      },
    ],
    links: [
      {
        label: 'DWN – Staatsanleihen 2022 historischer Wertverlust',
        url: 'https://deutsche-wirtschafts-nachrichten.de/701645/deutsche-staatsanleihen-verzeichnen-historischen-wertverlust',
      },
    ],
  },
  {
    id: 'H28',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Activist Investor',
      de: 'Aktivistischer Investor',
    },
    story: {
      en: 'A famous hedge fund buys in and demands higher payouts.',
      de: 'Ein bekannter Hedgefonds steigt ein und fordert höhere Ausschüttungen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'indexDice',
        markets: ['AUTO', 'INSU'],
        bands: [
          {
            from: 1,
            to: 3,
            value: 1.0,
          },
          {
            from: 4,
            to: 6,
            value: 1.15,
          },
        ],
      },
      {
        op: 'sellWindow',
        markets: ['AUTO', 'INSU'],
      },
    ],
    links: [],
  },
  {
    id: 'H29',
    group: 'shares',
    copies: 2,
    title: {
      en: 'Broker Sale Window',
      de: 'Verkaufsfenster beim Broker',
    },
    story: {
      en: 'Your broker runs a zero-fee week. A good moment to rebalance.',
      de: 'Dein Broker hat eine gebührenfreie Woche. Ein guter Moment zum Umschichten.',
    },
    realWorld: '',
    ops: [
      {
        op: 'sellWindow',
        markets: ['WORLD', 'EMERG', 'BOND', 'DIVID', 'AUTO', 'INSU', 'TECH', 'ENERGY', 'REIT'],
      },
    ],
    links: [],
    note: 'Any holder may sell any listed share or ETF at the current index.',
  },
  {
    id: 'H84',
    group: 'shares',
    copies: 1,
    title: {
      en: 'Tech Breakthrough',
      de: 'Technologischer Durchbruch',
    },
    story: {
      en: 'A product launch that changes an industry.',
      de: 'Ein Produktstart, der eine ganze Branche verändert.',
    },
    realWorld: '',
    ops: [
      {
        op: 'indexDice',
        markets: ['TECH'],
        bands: [
          {
            from: 1,
            to: 2,
            value: 1.05,
          },
          {
            from: 3,
            to: 5,
            value: 1.2,
          },
          {
            from: 6,
            to: 6,
            value: 1.5,
          },
        ],
      },
      {
        op: 'sellWindow',
        markets: ['TECH'],
      },
    ],
    links: [],
  },
  {
    id: 'H85',
    group: 'shares',
    copies: 2,
    title: {
      en: 'Share Buyback',
      de: 'Aktienrückkauf',
    },
    story: {
      en: 'The company buys back its own shares at a small premium.',
      de: 'Das Unternehmen kauft eigene Aktien mit einem kleinen Aufschlag zurück.',
    },
    realWorld: '',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['AUTO', 'INSU', 'DIVID'],
          basis: 'index',
          factor: 1.02,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H87',
    group: 'shares',
    copies: 2,
    title: {
      en: 'Fund Manager Rebalances',
      de: 'Fondsmanager schichten um',
    },
    story: {
      en: 'Big funds rebalance at quarter-end and buy what you hold.',
      de: 'Große Fonds schichten zum Quartalsende um und kaufen, was du hältst.',
    },
    realWorld: '',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['WORLD', 'EMERG', 'BOND', 'TECH', 'ENERGY', 'REIT'],
          basis: 'index',
          factor: 1.0,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H30',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Crypto Bull Run',
      de: 'Krypto-Bullenmarkt',
    },
    story: {
      en: 'New all-time highs. Your taxi driver talks about Bitcoin.',
      de: 'Neue Allzeithochs. Dein Taxifahrer redet über Bitcoin.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          BTC: 1.5,
          ETH: 1.6,
          ALTS: 1.9,
        },
      },
      {
        op: 'sellWindow',
        markets: ['BTC', 'ETH', 'ALTS'],
      },
    ],
    links: [],
  },
  {
    id: 'H31',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Crypto Winter',
      de: 'Krypto-Winter',
    },
    story: {
      en: 'Prices fall for months. Projects shut down; headlines declare crypto dead.',
      de: 'Die Kurse fallen monatelang. Projekte machen dicht; Schlagzeilen erklären Krypto für tot.',
    },
    realWorld:
      'Bitcoin fell about 75% from its November 2021 peak (above $68,000) to under $16,000 in November 2022.',
    ops: [
      {
        op: 'index',
        factors: {
          BTC: 0.5,
          ETH: 0.45,
          ALTS: 0.3,
        },
      },
    ],
    links: [
      {
        label: 'CoinMarketCap – Bitcoin in 2022: A Year to Forget',
        url: 'https://coinmarketcap.com/academy/de/article/bitcoin-in-2022-a-year-to-forget',
      },
    ],
  },
  {
    id: 'H32',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Exchange Collapse',
      de: 'Kryptobörse pleite',
    },
    story: {
      en: "A big exchange can't pay out. Customer funds are gone.",
      de: 'Eine große Kryptobörse kann nicht auszahlen. Die Kundengelder sind weg.',
    },
    realWorld:
      'FTX froze withdrawals and filed for bankruptcy in November 2022 with an estimated $8 billion hole in customer funds.',
    ops: [
      {
        op: 'index',
        factors: {
          BTC: 0.8,
          ETH: 0.75,
          ALTS: 0.65,
        },
      },
      {
        op: 'holderDice',
        targets: ['BTC', 'ETH', 'ALTS'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              loseUnitsPercent: 50,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'CoinMarketCap – Bitcoin in 2022: A Year to Forget',
        url: 'https://coinmarketcap.com/academy/de/article/bitcoin-in-2022-a-year-to-forget',
      },
    ],
  },
  {
    id: 'H33',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Halving Supercycle',
      de: 'Halving-Superzyklus',
    },
    story: {
      en: "Bitcoin's new supply is cut in half again. Believers say this time is different.",
      de: 'Das neue Bitcoin-Angebot halbiert sich erneut. Die Gläubigen sagen, diesmal sei alles anders.',
    },
    realWorld: '',
    ops: [
      {
        op: 'indexDice',
        markets: ['BTC'],
        bands: [
          {
            from: 1,
            to: 3,
            value: 1.1,
          },
          {
            from: 4,
            to: 5,
            value: 1.5,
          },
          {
            from: 6,
            to: 6,
            value: {
              rollAgain: [
                {
                  from: 1,
                  to: 5,
                  value: 2.5,
                },
                {
                  from: 6,
                  to: 6,
                  value: 10.0,
                },
              ],
            },
          },
        ],
      },
      {
        op: 'sellWindow',
        markets: ['BTC'],
      },
    ],
    links: [],
    note: 'The only way to a 10× Bitcoin: a 6 and then another 6 (1 in 36).',
  },
  {
    id: 'H34',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Ethereum Upgrade',
      de: 'Ethereum-Upgrade',
    },
    story: {
      en: 'A major network upgrade goes live without problems. More people start staking.',
      de: 'Ein großes Netzwerk-Upgrade geht problemlos live. Mehr Leute fangen an zu staken.',
    },
    realWorld: 'Staking yields in 2026 were about 2.5–3.8% depending on method.',
    ops: [
      {
        op: 'index',
        factors: {
          ETH: 1.15,
        },
      },
      {
        op: 'sellWindow',
        markets: ['ETH'],
      },
      {
        op: 'payoutFactor',
        factors: {
          ETH: 0.9,
        },
        paydays: null,
      },
    ],
    links: [
      {
        label: 'Ryder – Ethereum staking yield 2026',
        url: 'https://ryder.id/blogs/post/ethereum-staking-yield-in-2026-after-pectra',
      },
    ],
    note: 'Price +15%, but staking yield −10% (more stakers share the rewards).',
  },
  {
    id: 'H35',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Regulators Crack Down',
      de: 'Regulierung greift durch',
    },
    story: {
      en: 'New rules ban anonymous tokens on regulated exchanges.',
      de: 'Neue Regeln verbannen anonyme Tokens von regulierten Börsen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          ALTS: 0.6,
          BTC: 0.92,
          ETH: 0.88,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H36',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'Stablecoin Loses Its Peg',
      de: 'Stablecoin verliert Bindung',
    },
    story: {
      en: "A 'stable' coin worth one dollar suddenly trades at 30 cents. Panic spreads.",
      de: "Ein 'stabiler' Coin im Wert von einem Dollar notiert plötzlich bei 30 Cent. Panik breitet sich aus.",
    },
    realWorld:
      'In May 2022 the TerraUSD stablecoin lost its peg; LUNA fell from about $87 to under one cent and about $48 billion was wiped out. Its lending app had promised ~20% yield.',
    ops: [
      {
        op: 'index',
        factors: {
          ALTS: 0.35,
          ETH: 0.8,
          BTC: 0.85,
        },
      },
    ],
    links: [
      {
        label: 'CFI – What happened to Terra?',
        url: 'https://corporatefinanceinstitute.com/resources/cryptocurrency/what-happened-to-terra',
      },
      {
        label: 'CoinMarketCap – Bitcoin in 2022: A Year to Forget',
        url: 'https://coinmarketcap.com/academy/de/article/bitcoin-in-2022-a-year-to-forget',
      },
    ],
  },
  {
    id: 'H86',
    group: 'crypto',
    copies: 1,
    title: {
      en: 'OTC Desk',
      de: 'OTC-Handelsdesk',
    },
    story: {
      en: 'A professional trading desk buys larger crypto amounts directly.',
      de: 'Ein professioneller Handelsdesk kauft größere Krypto-Mengen direkt an.',
    },
    realWorld: '',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['BTC', 'ETH', 'ALTS'],
          basis: 'index',
          factor: 0.98,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H37',
    group: 'ladder',
    copies: 1,
    title: {
      en: 'Crypto Mania',
      de: 'Krypto-Fieber',
    },
    story: {
      en: 'Everyone is buying. Prices go vertical. How long can it last?',
      de: 'Alle kaufen. Die Kurse gehen senkrecht nach oben. Wie lange hält das?',
    },
    realWorld: 'Hype rallies end abruptly: Bitcoin fell ~75% after its 2021 peak.',
    ops: [
      {
        op: 'ladder',
        ladder: {
          targets: ['BTC', 'ETH', 'ALTS'],
          successFrom: 6,
          step: 3.2,
          maxSteps: 4,
          fail: 0.5,
          byDifficulty: {
            easy: {
              successFrom: 5,
              step: 2.15,
              fail: 0.5,
            },
            medium: {
              successFrom: 6,
              step: 3.2,
              fail: 0.5,
            },
            hard: {
              successFrom: 6,
              step: 2.6,
              fail: 0.5,
            },
          },
        },
      },
    ],
    links: [
      {
        label: 'CoinMarketCap – Bitcoin in 2022: A Year to Forget',
        url: 'https://coinmarketcap.com/academy/de/article/bitcoin-in-2022-a-year-to-forget',
      },
    ],
  },
  {
    id: 'H38',
    group: 'ladder',
    copies: 1,
    title: {
      en: 'Meme Frenzy',
      de: 'Meme-Rausch',
    },
    story: {
      en: 'A token goes viral on social media. Up 300% in an hour.',
      de: 'Ein Token geht in den sozialen Medien viral. Plus 300 % in einer Stunde.',
    },
    realWorld:
      "The Squid Game token rose about 75,000% in days, then fell from about $2,850 to almost zero within minutes; buyers couldn't sell.",
    ops: [
      {
        op: 'ladder',
        ladder: {
          targets: ['ALTS', 'MOON'],
          successFrom: 6,
          step: 5.5,
          maxSteps: 3,
          fail: 0.0,
          byDifficulty: {
            easy: {
              successFrom: 5,
              step: 3.15,
              fail: 0.0,
            },
            medium: {
              successFrom: 6,
              step: 5.5,
              fail: 0.0,
            },
            hard: {
              successFrom: 6,
              step: 5.0,
              fail: 0.0,
            },
          },
        },
      },
    ],
    links: [
      {
        label: 'Cointelegraph – Squid Game token collapses to zero',
        url: 'https://cointelegraph.com/markets/game-over-squid-game-inspired-crypto-scam-collapses-as-price-crashes-from-2-8k-to-zero',
      },
    ],
  },
  {
    id: 'H39',
    group: 'ladder',
    copies: 1,
    title: {
      en: 'AI Hype Wave',
      de: 'KI-Hype-Welle',
    },
    story: {
      en: "Every company now says 'AI' in its earnings call. Tech prices soar.",
      de: "Jede Firma sagt jetzt 'KI' in der Bilanzpressekonferenz. Tech-Kurse schießen hoch.",
    },
    realWorld: 'In the dot-com bubble, the Nasdaq rose for years — then fell 78%.',
    ops: [
      {
        op: 'ladder',
        ladder: {
          targets: ['TECH'],
          successFrom: 5,
          step: 1.65,
          maxSteps: 3,
          fail: 0.6,
          byDifficulty: {
            easy: {
              successFrom: 4,
              step: 1.5,
              fail: 0.6,
            },
            medium: {
              successFrom: 5,
              step: 1.65,
              fail: 0.6,
            },
            hard: {
              successFrom: 5,
              step: 1.35,
              fail: 0.6,
            },
          },
        },
      },
    ],
    links: [
      {
        label: 'aktienrenterechner – Dotcom-Blase (Nasdaq −78%)',
        url: 'https://aktienrenterechner.de/ratgeber/dotcom-blase-2000',
      },
    ],
  },
  {
    id: 'H40',
    group: 'ladder',
    copies: 1,
    title: {
      en: 'Collector Hype',
      de: 'Sammler-Hype',
    },
    story: {
      en: 'A celebrity opens packs on a livestream. Card prices go crazy.',
      de: 'Ein Promi öffnet Booster im Livestream. Kartenpreise drehen durch.',
    },
    realWorld:
      'Stiftung Warentest calls trading cards purely speculative; reprints can crash prices.',
    ops: [
      {
        op: 'ladder',
        ladder: {
          targets: ['CARDS'],
          successFrom: 6,
          step: 2.2,
          maxSteps: 3,
          fail: 0.7,
          byDifficulty: {
            easy: {
              successFrom: 5,
              step: 1.75,
              fail: 0.7,
            },
            medium: {
              successFrom: 6,
              step: 2.2,
              fail: 0.7,
            },
            hard: {
              successFrom: 6,
              step: 1.6,
              fail: 0.7,
            },
          },
          basis: 'asset',
        },
      },
    ],
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
  },
  {
    id: 'H41',
    group: 'ladder',
    copies: 1,
    title: {
      en: 'Penny Stock Rocket',
      de: 'Kursrakete beim Pennystock',
    },
    story: {
      en: "Lithium-X jumps 300% on 'news' nobody can find. Forums celebrate.",
      de: "Lithium-X springt um 300 % wegen 'News', die niemand findet. Foren feiern.",
    },
    realWorld:
      'Pump-and-dump schemes push small stocks with promotions, then the promoters sell — only those who sell into the spike get out.',
    ops: [
      {
        op: 'ladder',
        ladder: {
          targets: ['LITHX'],
          successFrom: 6,
          step: 5.5,
          maxSteps: 2,
          fail: 0.0,
          byDifficulty: {
            easy: {
              successFrom: 5,
              step: 3.15,
              fail: 0.0,
            },
            medium: {
              successFrom: 6,
              step: 5.5,
              fail: 0.0,
            },
            hard: {
              successFrom: 6,
              step: 5.0,
              fail: 0.0,
            },
          },
          start: 3.0,
        },
      },
      {
        op: 'penny',
        ticker: 'LITHX',
        factor: 3.0,
      },
    ],
    links: [],
    note: 'Holders may sell now at 3× the purchase price, or ride on from 3×. After this card, LITHX trading is halted for everyone who still holds (index → 0).',
  },
  {
    id: 'H42',
    group: 'metals',
    copies: 1,
    title: {
      en: 'Gold Rush',
      de: 'Goldrausch',
    },
    story: {
      en: 'Uncertainty everywhere. Gold breaks record after record.',
      de: 'Überall Unsicherheit. Gold bricht Rekord um Rekord.',
    },
    realWorld: 'Gold rose about 47% in euros in 2025 and 34% in 2024.',
    ops: [
      {
        op: 'index',
        factors: {
          GOLD: 1.15,
          SILVER: 1.12,
        },
      },
      {
        op: 'sellWindow',
        markets: ['GOLD', 'SILVER'],
      },
    ],
    links: [
      {
        label: 'gold.de – Goldpreis (2025: +47% in EUR)',
        url: 'https://www.gold.de/kurse/goldpreis/',
      },
    ],
  },
  {
    id: 'H43',
    group: 'metals',
    copies: 2,
    title: {
      en: 'Gold Slumps',
      de: 'Gold fällt',
    },
    story: {
      en: 'Calm markets, higher interest rates: nobody wants a yellow metal that pays nothing.',
      de: 'Ruhige Märkte, höhere Zinsen: Niemand will ein gelbes Metall, das nichts zahlt.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          GOLD: 0.88,
          SILVER: 0.86,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H44',
    group: 'metals',
    copies: 1,
    title: {
      en: 'Silver Squeeze',
      de: 'Silber-Squeeze',
    },
    story: {
      en: 'Online forums try to squeeze silver prices up.',
      de: 'Online-Foren versuchen, den Silberpreis nach oben zu drücken.',
    },
    realWorld: '',
    ops: [
      {
        op: 'indexDice',
        markets: ['SILVER'],
        bands: [
          {
            from: 1,
            to: 2,
            value: 0.9,
          },
          {
            from: 3,
            to: 5,
            value: 1.25,
          },
          {
            from: 6,
            to: 6,
            value: 1.7,
          },
        ],
      },
      {
        op: 'sellWindow',
        markets: ['SILVER'],
      },
    ],
    links: [],
  },
  {
    id: 'H45',
    group: 'metals',
    copies: 2,
    title: {
      en: 'Precious Metal Dealer Buys',
      de: 'Edelmetallhändler kauft an',
    },
    story: {
      en: 'A dealer in town buys coins and bars at fair prices.',
      de: 'Ein Händler in der Stadt kauft Münzen und Barren zu fairen Preisen an.',
    },
    realWorld: '',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['GOLD', 'SILVER'],
          basis: 'index',
          factor: 0.97,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H46',
    group: 'collect',
    copies: 2,
    title: {
      en: 'Collector Convention',
      de: 'Sammlerbörse',
    },
    story: {
      en: 'Hundreds of collectors, one big hall, and cash changing hands.',
      de: 'Hunderte Sammler, eine große Halle und Bargeld, das den Besitzer wechselt.',
    },
    realWorld:
      'Value depends on age, condition and rarity; most trading happens on platforms like Cardmarket.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['CARDS'],
          basis: 'asset',
          bands: [
            {
              from: 1,
              to: 2,
              value: 0.8,
            },
            {
              from: 3,
              to: 5,
              value: 1.3,
            },
            {
              from: 6,
              to: 6,
              value: 2.5,
            },
          ],
        },
      },
    ],
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
  },
  {
    id: 'H47',
    group: 'collect',
    copies: 2,
    title: {
      en: 'Auction House Evening',
      de: 'Auktionsabend',
    },
    story: {
      en: 'An auction house holds its autumn sale: watches, wine, cars and art.',
      de: 'Ein Auktionshaus hält seine Herbstauktion: Uhren, Wein, Autos und Kunst.',
    },
    realWorld: '',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['COLLECT', 'CLASSIC', 'ART'],
          basis: 'asset',
          bands: [
            {
              from: 1,
              to: 1,
              value: 0.6,
            },
            {
              from: 2,
              to: 4,
              value: 1.1,
            },
            {
              from: 5,
              to: 5,
              value: 1.6,
            },
            {
              from: 6,
              to: 6,
              value: 2.5,
            },
          ],
          artBands: [
            {
              from: 1,
              to: 3,
              value: 0.4,
            },
            {
              from: 4,
              to: 5,
              value: 1.2,
            },
            {
              from: 6,
              to: 6,
              value: {
                rollAgain: [
                  {
                    from: 1,
                    to: 5,
                    value: 3.0,
                  },
                  {
                    from: 6,
                    to: 6,
                    value: 10.0,
                  },
                ],
              },
            },
          ],
          feesPercent: 15,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H48',
    group: 'collect',
    copies: 1,
    title: {
      en: 'Fake Discovered',
      de: 'Fälschung entdeckt',
    },
    story: {
      en: 'An expert looks at your collection. One item is not what it seems.',
      de: 'Ein Experte sieht sich deine Sammlung an. Ein Stück ist nicht, was es scheint.',
    },
    realWorld:
      'Counterfeit cards and resealed booster packs are common and hard for laypeople to spot.',
    ops: [
      {
        op: 'holderDice',
        targets: ['CARDS', 'COLLECT', 'ART'],
        bands: [
          {
            from: 1,
            to: 1,
            value: {
              fakeItem: true,
            },
          },
          {
            from: 2,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
  },
  {
    id: 'H49',
    group: 'collect',
    copies: 1,
    title: {
      en: 'Reprint Announced',
      de: 'Neuauflage angekündigt',
    },
    story: {
      en: 'The publisher reprints the classic set. Old cards are suddenly less rare.',
      de: 'Der Verlag druckt das Klassiker-Set neu. Alte Karten sind plötzlich weniger selten.',
    },
    realWorld: 'Reprints and tournament bans can make card values fall sharply.',
    ops: [
      {
        op: 'index',
        factors: {
          CARDS: 0.65,
        },
      },
    ],
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
  },
  {
    id: 'H50',
    group: 'collect',
    copies: 1,
    title: {
      en: 'Hype Fades',
      de: 'Der Hype ist vorbei',
    },
    story: {
      en: "Last year's must-have sneakers and watches sit unsold on resale sites.",
      de: 'Die Must-haves vom letzten Jahr — Sneaker und Uhren — liegen unverkauft auf Wiederverkaufsseiten.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          COLLECT: 0.78,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H51',
    group: 'collect',
    copies: 1,
    title: {
      en: 'Classic Car Boom',
      de: 'Oldtimer-Boom',
    },
    story: {
      en: 'A classic car rally on TV, and suddenly everyone wants a 70s sports car.',
      de: 'Eine Oldtimer-Rallye im Fernsehen, und plötzlich will jeder einen Sportwagen aus den 70ern.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          CLASSIC: 1.15,
        },
      },
      {
        op: 'sellWindow',
        markets: ['CLASSIC'],
      },
    ],
    links: [],
  },
  {
    id: 'H52',
    group: 'collect',
    copies: 1,
    title: {
      en: 'Wine Critic Gives 100 Points',
      de: '100 Punkte vom Weinkritiker',
    },
    story: {
      en: 'A famous critic praises the vintage you hold.',
      de: 'Ein berühmter Kritiker lobt den Jahrgang, den du besitzt.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          COLLECT: 1.12,
        },
      },
      {
        op: 'sellWindow',
        markets: ['COLLECT'],
      },
    ],
    links: [],
  },
  {
    id: 'H53',
    group: 'property',
    copies: 2,
    title: {
      en: 'Buyer for Your Property',
      de: 'Käufer für deine Immobilie',
    },
    story: {
      en: 'An investor wants exactly what you own and makes an offer.',
      de: 'Ein Investor will genau das, was du besitzt, und macht ein Angebot.',
    },
    realWorld:
      "Gross rental yields averaged 4.17% in Germany's 52 largest cities in H1 2026; prices barely moved (+0.3%) while rents rose 2.1%.",
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['PROPERTY'],
          basis: 'property',
          bands: [
            {
              from: 1,
              to: 2,
              value: 0.95,
            },
            {
              from: 3,
              to: 5,
              value: 1.08,
            },
            {
              from: 6,
              to: 6,
              value: 1.25,
            },
          ],
          saleCostsPercent: 6,
        },
      },
    ],
    links: [
      {
        label: 'Baufi24 – Mietrenditeatlas H1 2026',
        url: 'https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/',
      },
    ],
  },
  {
    id: 'H54',
    group: 'property',
    copies: 2,
    title: {
      en: 'New Rent Index',
      de: 'Neuer Mietspiegel',
    },
    story: {
      en: 'The city publishes a new rent index. You may raise rents.',
      de: 'Die Stadt veröffentlicht einen neuen Mietspiegel. Du darfst die Mieten erhöhen.',
    },
    realWorld:
      "Rents rose about 2.1% in H1 2026 in Germany's largest cities; increases are capped by law (15% in 3 years in tight markets).",
    ops: [
      {
        op: 'rentPercent',
        percent: 4,
      },
    ],
    links: [
      {
        label: 'Baufi24 – Mietrenditeatlas H1 2026',
        url: 'https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/',
      },
    ],
    note: 'All property rents +4% permanently; cash flow rises by the same amount.',
  },
  {
    id: 'H55',
    group: 'property',
    copies: 1,
    title: {
      en: 'Vacancy',
      de: 'Leerstand',
    },
    story: {
      en: 'A tenant moves out, and the flat stays empty longer than planned.',
      de: 'Ein Mieter zieht aus, und die Wohnung steht länger leer als geplant.',
    },
    realWorld: '',
    ops: [
      {
        op: 'holderDice',
        targets: ['PROPERTY'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              noRentPaydays: 2,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H56',
    group: 'property',
    copies: 1,
    title: {
      en: 'Major Repair',
      de: 'Große Reparatur',
    },
    story: {
      en: "The owners' meeting votes for a new roof. Your share is due.",
      de: 'Die Eigentümerversammlung beschließt ein neues Dach. Dein Anteil ist fällig.',
    },
    realWorld: '',
    ops: [
      {
        op: 'holderDice',
        targets: ['PROPERTY'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              repairPercentOfPrice: 3,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H57',
    group: 'property',
    copies: 1,
    title: {
      en: 'Housing Boom',
      de: 'Immobilienboom',
    },
    story: {
      en: 'Low supply, strong demand: prices rise and buyers queue.',
      de: 'Wenig Angebot, starke Nachfrage: Die Preise steigen und Käufer stehen Schlange.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          PROPERTY: 1.08,
          REIT: 1.08,
        },
      },
      {
        op: 'buyer',
        buyer: {
          targets: ['PROPERTY'],
          basis: 'property',
          factor: 1.05,
          saleCostsPercent: 6,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H58',
    group: 'property',
    copies: 1,
    title: {
      en: 'Housing Slump',
      de: 'Immobilienflaute',
    },
    story: {
      en: 'Higher rates, fewer buyers. Prices slide.',
      de: 'Höhere Zinsen, weniger Käufer. Die Preise rutschen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          PROPERTY: 0.92,
          REIT: 0.94,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H59',
    group: 'property',
    copies: 1,
    title: {
      en: 'Tenant Stops Paying',
      de: 'Mietnomade',
    },
    story: {
      en: "Your tenant stops paying and won't leave. The eviction takes months.",
      de: 'Dein Mieter zahlt nicht mehr und zieht nicht aus. Die Räumung dauert Monate.',
    },
    realWorld: '',
    ops: [
      {
        op: 'holderDice',
        targets: ['PROPERTY'],
        bands: [
          {
            from: 1,
            to: 1,
            value: {
              noRentPaydays: 4,
              legalCostMinor: 150000,
            },
          },
          {
            from: 2,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H60',
    group: 'property',
    copies: 1,
    title: {
      en: 'Holiday Season',
      de: 'Feriensaison',
    },
    story: {
      en: 'The weather decides your season.',
      de: 'Das Wetter entscheidet über deine Saison.',
    },
    realWorld: '',
    ops: [
      {
        op: 'cashflowDice',
        groups: ['TOURISM'],
        bands: [
          {
            from: 1,
            to: 2,
            value: 0.6,
          },
          {
            from: 3,
            to: 5,
            value: 1.0,
          },
          {
            from: 6,
            to: 6,
            value: 1.5,
          },
        ],
        paydays: 3,
      },
    ],
    links: [],
    note: 'Holiday flat (T05) and glamping park (T16): cash flow × result for 3 Paydays.',
  },
  {
    id: 'H61',
    group: 'property',
    copies: 1,
    title: {
      en: 'Parking Shortage',
      de: 'Parkplatznot',
    },
    story: {
      en: 'The city removes street parking. Your spaces are in demand.',
      de: 'Die Stadt streicht Parkplätze an der Straße. Deine Stellplätze sind gefragt.',
    },
    realWorld: 'Micro-location decides garage demand; a new car park nearby can do the opposite.',
    ops: [
      {
        op: 'cashflowFactor',
        groups: ['PARKING'],
        factor: 1.15,
        paydays: null,
      },
    ],
    links: [
      {
        label: 'biallo – Garagen als Geldanlage',
        url: 'https://www.biallo.de/bauen/news/garagen-als-geldanlage/',
      },
    ],
  },
  {
    id: 'H62',
    group: 'property',
    copies: 1,
    title: {
      en: 'Farmland Lease Renewed',
      de: 'Pacht verlängert',
    },
    story: {
      en: 'The farmer renews the lease at a higher rate.',
      de: 'Der Landwirt verlängert die Pacht zu einem höheren Satz.',
    },
    realWorld: '',
    ops: [
      {
        op: 'index',
        factors: {
          FARM: 1.05,
        },
      },
      {
        op: 'sellWindow',
        markets: ['FARM'],
      },
      {
        op: 'payoutFactor',
        factors: {
          FARM: 1.1,
        },
        paydays: null,
      },
    ],
    links: [],
  },
  {
    id: 'H63',
    group: 'business',
    copies: 1,
    title: {
      en: 'Your Video Goes Viral',
      de: 'Dein Video geht viral',
    },
    story: {
      en: "One video explodes overnight. Your phone won't stop buzzing.",
      de: 'Ein Video explodiert über Nacht. Dein Handy hört nicht auf zu vibrieren.',
    },
    realWorld: 'Most YouTube channels earn about $2–5 per 1,000 views; finance channels up to $15.',
    ops: [
      {
        op: 'holderDice',
        targets: ['CONTENT'],
        bands: [
          {
            from: 1,
            to: 3,
            value: {
              oneTimeMinor: 20000,
            },
          },
          {
            from: 4,
            to: 5,
            value: {
              cashflowFactor: 1.5,
            },
          },
          {
            from: 6,
            to: 6,
            value: {
              cashflowFactor: 3,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'Bluehost – Was verdient ein YouTuber?',
        url: 'https://www.bluehost.com/de-de/blog/wie-viel-geld-verdient-ein-youtuber-einblicke-und-einnahmen-im-ueberblick/',
      },
    ],
  },
  {
    id: 'H64',
    group: 'business',
    copies: 1,
    title: {
      en: 'Algorithm Change',
      de: 'Algorithmus-Änderung',
    },
    story: {
      en: 'The platform changes its algorithm. Your reach drops overnight.',
      de: 'Die Plattform ändert ihren Algorithmus. Deine Reichweite bricht über Nacht ein.',
    },
    realWorld: '',
    ops: [
      {
        op: 'cashflowFactor',
        groups: ['CONTENT'],
        factor: 0.6,
        paydays: 6,
      },
    ],
    links: [],
  },
  {
    id: 'H65',
    group: 'business',
    copies: 1,
    title: {
      en: 'Big Client',
      de: 'Großkunde',
    },
    story: {
      en: 'A big company needs your skills for a three-month project.',
      de: 'Eine große Firma braucht deine Fähigkeiten für ein Dreimonatsprojekt.',
    },
    realWorld:
      'Freelancer-Kompass 2026: median €100/h for data & analytics, €90/h for development.',
    ops: [
      {
        op: 'cashflowFactor',
        groups: ['FREELANCE'],
        factor: 2.0,
        paydays: 3,
      },
    ],
    links: [
      {
        label: 'freelancermap – IT-Freelancer Stundensatz 2026',
        url: 'https://www.freelancermap.de/blog/stundensatz-it-freelancer/',
      },
    ],
  },
  {
    id: 'H66',
    group: 'business',
    copies: 1,
    title: {
      en: 'Client Lost',
      de: 'Kunde weg',
    },
    story: {
      en: 'Your best client switches to a cheaper offshore team.',
      de: 'Dein bester Kunde wechselt zu einem billigeren Team im Ausland.',
    },
    realWorld: '',
    ops: [
      {
        op: 'holderDice',
        targets: ['FREELANCE'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              noCashflowPaydays: 2,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H67',
    group: 'business',
    copies: 2,
    title: {
      en: 'Buyer for Your Business',
      de: 'Käufer für dein Unternehmen',
    },
    story: {
      en: 'A competitor wants to buy your business and makes an offer.',
      de: 'Ein Wettbewerber will dein Unternehmen kaufen und macht ein Angebot.',
    },
    realWorld:
      'Small businesses typically sell for a multiple of annual profit (here 2× annual cash flow on average).',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['BUSINESS', 'VENDING', 'FOOD', 'RENTALBIZ', 'CONTENT'],
          basis: 'business',
          bands: [
            {
              from: 1,
              to: 2,
              value: 0.7,
            },
            {
              from: 3,
              to: 5,
              value: 1.0,
            },
            {
              from: 6,
              to: 6,
              value: 1.5,
            },
          ],
          monthsOfCashflow: 24,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H68',
    group: 'business',
    copies: 1,
    title: {
      en: 'Location Lost',
      de: 'Standort verloren',
    },
    story: {
      en: 'The office building with your machine is being renovated.',
      de: 'Das Bürogebäude mit deinem Automaten wird saniert.',
    },
    realWorld: 'Location is the single biggest factor for vending revenue.',
    ops: [
      {
        op: 'holderDice',
        targets: ['VENDING'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              noCashflowPaydays: 3,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'getquin – Erfahrungsbericht Automaten-Business',
        url: 'https://app.getquin.com/de/post/kJiXqaBssQ/hier-mal-ein-kleines-update-zu-meinen-erfahrung-im-automaten-business',
      },
    ],
  },
  {
    id: 'H69',
    group: 'business',
    copies: 1,
    title: {
      en: 'Competitor Opens Nearby',
      de: 'Konkurrenz nebenan',
    },
    story: {
      en: 'A new competitor opens right next door with launch discounts.',
      de: 'Ein neuer Wettbewerber eröffnet direkt nebenan mit Eröffnungsrabatten.',
    },
    realWorld: '',
    ops: [
      {
        op: 'holderDice',
        targets: ['BUSINESS', 'FOOD', 'VENDING'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              cashflowFactor: 0.7,
            },
          },
          {
            from: 3,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H70',
    group: 'business',
    copies: 1,
    title: {
      en: 'Platform Fees Rise',
      de: 'Plattformgebühren steigen',
    },
    story: {
      en: 'The marketplace raises its fees from 10% to 15%.',
      de: 'Der Marktplatz erhöht seine Gebühren von 10 % auf 15 %.',
    },
    realWorld: '',
    ops: [
      {
        op: 'cashflowFactor',
        groups: ['CONTENT', 'RESELL'],
        factor: 0.85,
        paydays: null,
      },
    ],
    links: [],
  },
  {
    id: 'H71',
    group: 'business',
    copies: 1,
    title: {
      en: 'AI Tools Boost Productivity',
      de: 'KI-Tools steigern die Produktivität',
    },
    story: {
      en: 'New AI tools halve your routine work.',
      de: 'Neue KI-Tools halbieren deine Routinearbeit.',
    },
    realWorld: '',
    ops: [
      {
        op: 'cashflowFactor',
        groups: ['FREELANCE'],
        factor: 1.2,
        paydays: null,
      },
      {
        op: 'cashflowFactor',
        groups: ['CONTENT'],
        factor: 1.1,
        paydays: null,
      },
    ],
    links: [],
  },
  {
    id: 'H72',
    group: 'business',
    copies: 1,
    title: {
      en: 'Festival Summer',
      de: 'Festivalsommer',
    },
    story: {
      en: 'Sunny weekends, packed events, long queues.',
      de: 'Sonnige Wochenenden, volle Events, lange Schlangen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'cashflowFactor',
        groups: ['FOOD', 'RENTALBIZ', 'TOURISM'],
        factor: 1.5,
        paydays: 3,
      },
    ],
    links: [],
  },
  {
    id: 'H73',
    group: 'business',
    copies: 2,
    title: {
      en: 'Funding Round',
      de: 'Finanzierungsrunde',
    },
    story: {
      en: 'The startup you backed goes back to investors for money.',
      de: 'Das Startup, in das du investiert hast, sammelt wieder Geld bei Investoren.',
    },
    realWorld:
      'Venture outcomes are extremely skewed: most startups fail, a few return many times the money.',
    ops: [
      {
        op: 'holderDice',
        targets: ['SINGLE'],
        bands: [
          {
            from: 1,
            to: 3,
            value: {
              worthless: true,
              endsProject: true,
            },
          },
          {
            from: 4,
            to: 5,
            value: {
              none: true,
            },
          },
          {
            from: 6,
            to: 6,
            value: {
              valueFactor: 4,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H74',
    group: 'business',
    copies: 1,
    title: {
      en: 'Startup Exit',
      de: 'Startup-Exit',
    },
    story: {
      en: 'A big company wants to buy a startup — maybe yours.',
      de: 'Ein großer Konzern will ein Startup kaufen — vielleicht deins.',
    },
    realWorld: '',
    ops: [
      {
        op: 'holderDice',
        targets: ['SINGLE'],
        bands: [
          {
            from: 1,
            to: 4,
            value: {
              none: true,
            },
          },
          {
            from: 5,
            to: 5,
            value: {
              sellAtFactor: 2,
            },
          },
          {
            from: 6,
            to: 6,
            value: {
              sellAtFactor: 5,
            },
          },
        ],
      },
    ],
    links: [],
  },
  {
    id: 'H75',
    group: 'lending',
    copies: 1,
    title: {
      en: 'P2P Platform in Trouble',
      de: 'P2P-Plattform in Schieflage',
    },
    story: {
      en: "Your P2P platform reports rising defaults and 'temporary' delays.",
      de: "Deine P2P-Plattform meldet steigende Ausfälle und 'vorübergehende' Verzögerungen.",
    },
    realWorld:
      'Envestio and Kuetzal collapsed in 2020; Estateguru had about two-thirds of its portfolio in recovery in mid-2026.',
    ops: [
      {
        op: 'holderDice',
        targets: ['LENDING'],
        bands: [
          {
            from: 1,
            to: 2,
            value: {
              loseCapitalPercent: 70,
              endsProject: true,
            },
          },
          {
            from: 3,
            to: 4,
            value: {
              pausePayoutsPaydays: 6,
            },
          },
          {
            from: 5,
            to: 6,
            value: {
              none: true,
            },
          },
        ],
      },
    ],
    links: [
      {
        label: 'etf.capital – P2P-Kredite 2026',
        url: 'https://etf.capital/p2p-kredite-geldanlage-2026/',
      },
    ],
  },
  {
    id: 'H76',
    group: 'traps',
    copies: 1,
    title: {
      en: 'Withdrawals Frozen',
      de: 'Auszahlungen eingefroren',
    },
    story: {
      en: "The crypto lending app announces it is 'pausing withdrawals due to extreme market conditions'.",
      de: "Die Krypto-Lending-App 'pausiert Auszahlungen aufgrund extremer Marktbedingungen'.",
    },
    realWorld:
      'Celsius froze withdrawals in June 2022 and filed for bankruptcy in July with more than 100,000 creditors; crypto lenders had offered up to ~20% interest.',
    ops: [
      {
        op: 'holderDice',
        targets: ['P09'],
        bands: [
          {
            from: 1,
            to: 5,
            value: {
              depositLost: true,
            },
          },
          {
            from: 6,
            to: 6,
            value: {
              depositBack: true,
            },
          },
        ],
      },
      {
        op: 'trapReveal',
        cardIds: ['S21', 'T28'],
      },
    ],
    links: [
      {
        label: 'Euronews – Celsius files for bankruptcy (2022)',
        url: 'https://www.euronews.com/2022/07/14/cryptocurrency-lender-celsius-network-files-for-bankruptcy-as-crypto-winter-bites',
      },
      {
        label: 'CoinMarketCap – Bitcoin in 2022: A Year to Forget',
        url: 'https://coinmarketcap.com/academy/de/article/bitcoin-in-2022-a-year-to-forget',
      },
    ],
  },
  {
    id: 'H77',
    group: 'traps',
    copies: 1,
    title: {
      en: 'Liquidity Pulled',
      de: 'Liquidität abgezogen',
    },
    story: {
      en: "The token's developers withdraw all liquidity and delete their accounts.",
      de: 'Die Entwickler des Tokens ziehen die gesamte Liquidität ab und löschen ihre Accounts.',
    },
    realWorld:
      "The Squid Game token collapsed from ~$2,850 to almost zero in minutes in 2021 (~$3.4 million rug pull); holders couldn't sell. Chainalysis counted ≥ $14 billion in crypto scams in 2025.",
    ops: [
      {
        op: 'index',
        factors: {
          ALTS: 0.9,
        },
      },
      {
        op: 'trapReveal',
        tickers: ['MOON'],
      },
    ],
    links: [
      {
        label: 'Cointelegraph – Squid Game token collapses to zero',
        url: 'https://cointelegraph.com/markets/game-over-squid-game-inspired-crypto-scam-collapses-as-price-crashes-from-2-8k-to-zero',
      },
      {
        label: 'Chainalysis: crypto scams ≥ $14B in 2025',
        url: 'https://letsdatascience.com/news/chainalysis-reports-crypto-scams-reach-14b-ac5eeabb',
      },
    ],
  },
  {
    id: 'H78',
    group: 'traps',
    copies: 1,
    title: {
      en: 'Trading Halted',
      de: 'Handel ausgesetzt',
    },
    story: {
      en: 'The regulator suspends trading in Lithium-X and opens an investigation.',
      de: 'Die Aufsicht setzt den Handel mit Lithium-X aus und leitet Ermittlungen ein.',
    },
    realWorld: '',
    ops: [
      {
        op: 'trapReveal',
        tickers: ['LITHX'],
      },
    ],
    links: [],
  },
  {
    id: 'H79',
    group: 'traps',
    copies: 1,
    title: {
      en: 'Raid on a Call Centre',
      de: 'Razzia im Callcenter',
    },
    story: {
      en: "Police raid a call centre that sold 'pre-IPO shares' to thousands of people.",
      de: "Die Polizei durchsucht ein Callcenter, das 'Pre-IPO-Aktien' an Tausende verkauft hat.",
    },
    realWorld: '',
    ops: [
      {
        op: 'trapReveal',
        tickers: ['PREIPO'],
      },
    ],
    links: [],
  },
  {
    id: 'H80',
    group: 'traps',
    copies: 1,
    title: {
      en: 'Timeshare Exit Offer',
      de: 'Ausstiegsangebot für Timesharing',
    },
    story: {
      en: 'A company offers to take your timeshare off your hands.',
      de: 'Eine Firma bietet an, dir dein Timesharing abzunehmen.',
    },
    realWorld: '',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['TIMESH'],
          basis: 'fixed',
          fixedMinor: 150000,
        },
      },
    ],
    links: [],
  },
];
