import type { HarvestCard, HarvestOp } from './cashflow-game/harvest-deck';

/**
 * The second Harvest stack (JFK, 2026-11-05): who buys what the Opportunity cards made. The first stack had a buyer for a property or a
 * business on 3 % of its cards, none at all for most side hustles and loans, so a player could buy but never sell. These cards give
 * every kind of holding somebody to sell to - a buyer with a die for the price (a little profit, a lot of profit, sometimes a loss),
 * a block trade for the shares, a rally with a window - and the scams a last exit at a fraction before they are closed.
 */

const bands = (...rows: [number, number, number][]) =>
  rows.map(([from, to, value]) => ({ from, to, value }));

const property = (
  targets: string[],
  rows: [number, number, number][],
  saleCostsPercent: number,
): HarvestOp => ({
  op: 'buyer',
  buyer: { targets, basis: 'property', bands: bands(...rows), saleCostsPercent },
});

const business = (
  targets: string[],
  monthsOfCashflow: number,
  paidShare: number,
  rows: [number, number, number][],
): HarvestOp => ({
  op: 'buyer',
  buyer: { targets, basis: 'business', bands: bands(...rows), monthsOfCashflow, paidShare },
});

const SHARE_MARKETS = ['WORLD', 'EMERG', 'DIVID', 'AUTO', 'INSU', 'TECH', 'ENERGY', 'REIT', 'BOND'];

export const HARVEST_CARDS_MORE: HarvestCard[] = [
  // ── properties ──
  {
    id: 'H90',
    group: 'property',
    copies: 2,
    title: { en: 'Young Family Wants Your Flat', de: 'Junge Familie will deine Wohnung' },
    story: {
      en: 'A couple with a baby on the way is looking for a home to move into. They like yours and offer a fair price.',
      de: 'Ein Paar mit Baby unterwegs sucht ein Zuhause zum Einziehen. Deine Wohnung gefällt ihnen, sie bieten einen fairen Preis.',
    },
    realWorld:
      'Owner-occupiers usually pay more than investors, because they value the home to live in, not only the rent it brings.',
    ops: [
      property(
        ['PROPERTY'],
        [
          [1, 2, 0.97],
          [3, 5, 1.05],
          [6, 6, 1.15],
        ],
        4,
      ),
    ],
    links: [
      {
        label: 'Destatis – Immobilienpreisindex',
        url: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Baupreisindex/_inhalt.html',
      },
    ],
  },
  {
    id: 'H91',
    group: 'property',
    copies: 2,
    title: { en: 'Landlord Looks to Expand', de: 'Vermieter will sein Portfolio erweitern' },
    story: {
      en: 'A small landlord from the next town wants one more property with tenants in it. He knows what rents are worth.',
      de: 'Ein kleiner Vermieter aus der Nachbarstadt will noch eine vermietete Immobilie. Er weiß, was Mieten wert sind.',
    },
    realWorld:
      'Private landlords own about two thirds of all rental flats in Germany; many buy from each other.',
    ops: [
      property(
        ['PROPERTY'],
        [
          [1, 3, 1.02],
          [4, 5, 1.1],
          [6, 6, 1.2],
        ],
        5,
      ),
    ],
    links: [
      {
        label: 'Wikipedia – Immobilienmarkt',
        url: 'https://de.wikipedia.org/wiki/Immobilienmarkt',
      },
    ],
  },
  {
    id: 'H92',
    group: 'property',
    copies: 1,
    title: { en: 'Auction Weekend', de: 'Auktionswochenende' },
    story: {
      en: 'An auction house runs a weekend sale. If two bidders want your property, the price can jump - if nobody does, it goes cheap.',
      de: 'Ein Auktionshaus veranstaltet ein Auktionswochenende. Wollen zwei Bieter deine Immobilie, springt der Preis - will sie keiner, geht sie billig weg.',
    },
    realWorld:
      'At a forced-sale auction in Germany the court can refuse a bid below half of the market value; many properties still sell for 70 to 90 % of it.',
    ops: [
      property(
        ['PROPERTY'],
        [
          [1, 2, 0.85],
          [3, 4, 1.0],
          [5, 5, 1.12],
          [6, 6, 1.3],
        ],
        8,
      ),
    ],
    links: [
      {
        label: 'Wikipedia – Zwangsversteigerung',
        url: 'https://de.wikipedia.org/wiki/Zwangsversteigerung',
      },
    ],
  },
  {
    id: 'H93',
    group: 'property',
    copies: 2,
    title: { en: 'Investor Buys Portfolios', de: 'Investor kauft Pakete' },
    story: {
      en: 'A fund collects flats and parking spaces for a package. One of yours fits.',
      de: 'Ein Fonds sammelt Wohnungen und Stellplätze für ein Paket. Eine von deinen passt.',
    },
    realWorld:
      'Funds pay for size and ease: one buyer, one deed, little work - usually at a small discount to single sales.',
    ops: [
      property(
        ['PROPERTY', 'PARKING'],
        [
          [1, 1, 0.95],
          [2, 4, 1.06],
          [5, 6, 1.12],
        ],
        3,
      ),
    ],
    links: [
      {
        label: 'Wikipedia – Offener Immobilienfonds',
        url: 'https://de.wikipedia.org/wiki/Offener_Immobilienfonds',
      },
    ],
  },
  {
    id: 'H94',
    group: 'property',
    copies: 1,
    title: { en: 'Neighbours Want Your Parking Space', de: 'Nachbarn wollen deinen Stellplatz' },
    story: {
      en: 'Parking is short in the street. A neighbour asks what you want for your space.',
      de: 'Parkplätze sind in der Straße knapp. Ein Nachbar fragt, was du für deinen Stellplatz willst.',
    },
    realWorld:
      'Where parking is short, a garage space can be worth thousands more to a neighbour than to a stranger.',
    ops: [
      business(['PARKING'], 40, 0.9, [
        [1, 2, 1.0],
        [3, 5, 1.1],
        [6, 6, 1.25],
      ]),
    ],
    links: [],
  },
  // ── businesses, side hustles, loans ──
  {
    id: 'H95',
    group: 'business',
    copies: 3,
    title: {
      en: 'Marketplace Buys Small Online Businesses',
      de: 'Marktplatz kauft kleine Online-Unternehmen',
    },
    story: {
      en: 'A marketplace for online businesses lists yours. Buyers pay a multiple of the monthly profit.',
      de: 'Ein Marktplatz für Online-Unternehmen listet deines. Käufer zahlen ein Vielfaches des Monatsgewinns.',
    },
    realWorld:
      'Small online businesses are sold on marketplaces for roughly 24 to 40 times the monthly profit, depending on how much work the owner does.',
    ops: [
      business(['ONLINE'], 30, 0.6, [
        [1, 2, 0.8],
        [3, 5, 1.0],
        [6, 6, 1.4],
      ]),
    ],
    links: [
      { label: 'Flippa – buy and sell online businesses', url: 'https://flippa.com/' },
      {
        label: 'Wikipedia – Unternehmensbewertung',
        url: 'https://de.wikipedia.org/wiki/Unternehmensbewertung',
      },
    ],
  },
  {
    id: 'H96',
    group: 'business',
    copies: 2,
    title: { en: 'Agency Takes Over Your Client List', de: 'Agentur übernimmt deinen Kundenstamm' },
    story: {
      en: 'A bigger agency wants your clients, and you with them for a handover month.',
      de: 'Eine größere Agentur will deine Kunden und dich für einen Übergabemonat dazu.',
    },
    realWorld:
      'A client list is worth what the clients stay for: agencies pay a fraction up front and the rest if they stay.',
    ops: [
      business(['CLIENTS'], 30, 0.8, [
        [1, 2, 0.85],
        [3, 5, 1.05],
        [6, 6, 1.3],
      ]),
    ],
    links: [],
  },
  {
    id: 'H97',
    group: 'business',
    copies: 2,
    title: {
      en: 'Franchise Group Wants Your Location',
      de: 'Franchise-Gruppe will deinen Standort',
    },
    story: {
      en: 'A franchise group is looking for running locations to take over - your business with its customers and its lease.',
      de: 'Eine Franchise-Gruppe sucht laufende Standorte zur Übernahme - dein Geschäft mit Kundschaft und Mietvertrag.',
    },
    realWorld:
      'Chains grow by buying running small businesses; they pay for the location and the customers, not for the owner.',
    ops: [
      business(['SMALLBIZ'], 36, 0.7, [
        [1, 2, 0.8],
        [3, 5, 1.0],
        [6, 6, 1.35],
      ]),
    ],
    links: [
      {
        label: 'nexxt-change – Unternehmensnachfolge',
        url: 'https://www.nexxt-change.org/',
      },
    ],
  },
  {
    id: 'H98',
    group: 'business',
    copies: 3,
    title: { en: 'Search Fund Hunts for Cash Flow', de: 'Search-Fund sucht Cashflow' },
    story: {
      en: 'A young manager with investors behind them wants to buy a small business that already pays - yours is on the list.',
      de: 'Eine junge Managerin mit Investoren im Rücken will ein kleines Unternehmen kaufen, das schon Geld verdient - deines steht auf der Liste.',
    },
    realWorld:
      'Hundreds of thousands of small German firms need a successor in the coming years; buyers look for stable cash flow.',
    ops: [
      business(['ALLBIZ'], 36, 0.6, [
        [1, 1, 0.7],
        [2, 4, 1.0],
        [5, 6, 1.25],
      ]),
    ],
    links: [
      {
        label: 'DIHK – Unternehmensnachfolge',
        url: 'https://www.dihk.de/de/themen-und-positionen/unternehmensnachfolge',
      },
      { label: 'nexxt-change – Börse', url: 'https://www.nexxt-change.org/' },
    ],
  },
  {
    id: 'H99',
    group: 'business',
    copies: 2,
    title: { en: 'Competitor Offers to Buy You Out', de: 'Wettbewerber bietet Übernahme an' },
    story: {
      en: 'A competitor would rather buy you than fight you. The offer comes with a deadline.',
      de: 'Ein Wettbewerber kauft dich lieber, als gegen dich zu kämpfen. Das Angebot hat eine Frist.',
    },
    realWorld:
      'A competitor may pay more than anybody else (it removes a rival) - or very little, if it knows you are tired.',
    ops: [
      business(['ALLBIZ'], 24, 0.5, [
        [1, 3, 0.9],
        [4, 5, 1.1],
        [6, 6, 1.5],
      ]),
    ],
    links: [],
  },
  {
    id: 'H100',
    group: 'business',
    copies: 1,
    title: { en: 'Utility Buys Solar Capacity', de: 'Versorger kauft Solarleistung' },
    story: {
      en: 'A utility is buying up solar installations with a fixed feed-in tariff.',
      de: 'Ein Versorger kauft Solaranlagen mit fester Einspeisevergütung auf.',
    },
    realWorld:
      'The feed-in tariff of the EEG is guaranteed for 20 years, which makes a running solar plant a bond-like asset.',
    ops: [
      business(['ENERGYBIZ'], 48, 0.85, [
        [1, 2, 0.9],
        [3, 5, 1.0],
        [6, 6, 1.2],
      ]),
    ],
    links: [
      {
        label: 'Wikipedia – Einspeisevergütung',
        url: 'https://de.wikipedia.org/wiki/Einspeiseverg%C3%BCtung',
      },
    ],
  },
  {
    id: 'H101',
    group: 'lending',
    copies: 3,
    title: { en: 'Loan Portfolio Buyer', de: 'Käufer für Kreditpakete' },
    story: {
      en: 'The lending platform runs a secondary market: other investors bid for your loans.',
      de: 'Die Kreditplattform betreibt einen Zweitmarkt: andere Anleger bieten auf deine Kredite.',
    },
    realWorld:
      'Peer-to-peer platforms with a secondary market let investors leave early - usually at a small discount to the loan.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['LENDING'],
          basis: 'paid',
          bands: bands([1, 1, 0.75], [2, 4, 0.95], [5, 6, 1.04]),
        },
      },
    ],
    links: [
      { label: 'Wikipedia – Crowdlending', url: 'https://de.wikipedia.org/wiki/Crowdlending' },
    ],
  },
  // ── collectibles ──
  {
    id: 'H102',
    group: 'collect',
    copies: 3,
    title: {
      en: 'Resale Boom for Cards and Sneakers',
      de: 'Wiederverkaufs-Boom bei Karten und Sneakern',
    },
    story: {
      en: 'A hype on the resale platforms: limited cards and sneaker drops sell fast, for more than last week.',
      de: 'Ein Hype auf den Wiederverkaufsplattformen: Limitierte Karten und Sneaker-Drops gehen schnell weg, für mehr als letzte Woche.',
    },
    realWorld:
      'Resale prices follow hype: a sneaker can sell for double on the day and for less than the shop price a year later.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['CARDS', 'S27'],
          basis: 'asset',
          bands: bands([1, 1, 0.8], [2, 4, 1.1], [5, 5, 1.4], [6, 6, 1.8]),
          feesPercent: 8,
        },
      },
    ],
    links: [],
  },
  {
    id: 'H103',
    group: 'collect',
    copies: 2,
    title: { en: 'Spring Auction', de: 'Frühjahrsauktion' },
    story: {
      en: 'Collectors gather at the spring auction: wine, watches, bricks and metal find a bidder - at a price the room decides.',
      de: 'Sammler treffen sich zur Frühjahrsauktion: Wein, Uhren, Steine und Metall finden einen Bieter - zu einem Preis, den der Saal bestimmt.',
    },
    realWorld:
      'Auction houses take a buyer’s and a seller’s fee of 10 to 25 %; what you get depends on who is in the room.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['COLLECT', 'CARDS', 'GOLD', 'SILVER', 'S27'],
          basis: 'asset',
          bands: bands([1, 1, 0.85], [2, 4, 1.05], [5, 5, 1.2], [6, 6, 1.5]),
          feesPercent: 10,
        },
      },
      {
        op: 'buyer',
        buyer: {
          targets: ['CLASSIC', 'ART', 'FARM', 'GOLD', 'PRIVATE'],
          basis: 'index',
          bands: bands([1, 1, 0.85], [2, 4, 1.05], [5, 5, 1.2], [6, 6, 1.5]),
        },
      },
    ],
    links: [],
  },
  // ── shares ──
  {
    id: 'H104',
    group: 'shares',
    copies: 2,
    title: { en: 'Institutional Block Trade', de: 'Blockhandel eines Instituts' },
    story: {
      en: 'An institution wants a big block of shares and pays a little above the screen price - how much a die decides.',
      de: 'Ein Institut will ein großes Aktienpaket und zahlt etwas über dem Kurs - wie viel, entscheidet ein Würfel.',
    },
    realWorld:
      'Block trades are priced off the market: a few percent above, or at a discount, depending on how badly the buyer wants it.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: SHARE_MARKETS,
          basis: 'index',
          bands: bands([1, 2, 1.01], [3, 4, 1.03], [5, 5, 1.08], [6, 6, 1.2]),
        },
      },
    ],
    links: [{ label: 'Wikipedia – Blockhandel', url: 'https://de.wikipedia.org/wiki/Blockhandel' }],
  },
  {
    id: 'H105',
    group: 'shares',
    copies: 1,
    title: { en: 'Takeover Bid', de: 'Übernahmeangebot' },
    story: {
      en: 'A bidder wants to take over a company you own shares in and offers a premium for them.',
      de: 'Ein Bieter will ein Unternehmen übernehmen, an dem du Anteile hältst, und bietet dafür einen Aufschlag.',
    },
    realWorld:
      'Takeover bids usually pay a premium of 20 to 40 % on the share price of the day before.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['AUTO', 'INSU', 'DIVID', 'TECH', 'ENERGY'],
          basis: 'index',
          bands: bands([1, 1, 1.1], [2, 3, 1.2], [4, 5, 1.3], [6, 6, 1.5]),
        },
      },
    ],
    links: [
      {
        label: 'Wikipedia – Übernahmeangebot',
        url: 'https://de.wikipedia.org/wiki/%C3%9Cbernahmeangebot',
      },
    ],
  },
  {
    id: 'H106',
    group: 'shares',
    copies: 1,
    title: { en: 'Fund Redemption Wave', de: 'Rücknahme-Welle bei Fonds' },
    story: {
      en: 'Investors pull money out of funds and the funds need cash fast. Shares sell - but at a discount.',
      de: 'Anleger ziehen Geld aus Fonds ab, die Fonds brauchen schnell Bargeld. Aktien lassen sich verkaufen - mit Abschlag.',
    },
    realWorld:
      'When everybody sells at once, buyers can name their price. Sellers who must sell lose a few percent.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: SHARE_MARKETS,
          basis: 'index',
          bands: bands([1, 3, 0.9], [4, 5, 0.95], [6, 6, 1.0]),
        },
      },
    ],
    links: [],
  },
  {
    id: 'H107',
    group: 'market',
    copies: 2,
    title: { en: 'Year-End Rally', de: 'Jahresendrally' },
    story: {
      en: 'Fund managers dress up their books, bonuses are paid, and the stock markets rise into the new year.',
      de: 'Fondsmanager polieren ihre Bilanzen, Boni werden ausgezahlt, und die Börsen steigen ins neue Jahr.',
    },
    realWorld:
      'The "Santa Claus rally": stocks have risen in the last days of December more often than not.',
    ops: [
      {
        op: 'indexDice',
        markets: SHARE_MARKETS,
        bands: [
          { from: 1, to: 2, value: 1.02 },
          { from: 3, to: 4, value: 1.04 },
          { from: 5, to: 5, value: 1.07 },
          { from: 6, to: 6, value: 1.1 },
        ],
      },
      { op: 'sellWindow', markets: 'ALL' },
    ],
    links: [
      {
        label: 'Wikipedia – Weihnachtsrally',
        url: 'https://de.wikipedia.org/wiki/Weihnachtsrally',
      },
    ],
  },
  {
    id: 'H108',
    group: 'market',
    copies: 1,
    title: { en: 'Margin Calls Everywhere', de: 'Nachschussforderungen überall' },
    story: {
      en: 'Leveraged traders are forced to sell, prices slide, and the market stays open: you can still get out - at a loss.',
      de: 'Gehebelte Händler müssen verkaufen, die Kurse rutschen, und der Markt bleibt offen: Du kannst noch aussteigen - mit Verlust.',
    },
    realWorld:
      'Forced selling feeds on itself; for a week or two even good assets trade at a discount.',
    ops: [
      { op: 'index', factors: Object.fromEntries(SHARE_MARKETS.map((tag) => [tag, 0.88])) },
      { op: 'sellWindow', markets: 'ALL' },
    ],
    links: [],
  },
  // ── crypto ──
  {
    id: 'H109',
    group: 'crypto',
    copies: 1,
    title: { en: 'Whale Buys the Dip', de: 'Wal kauft den Rücksetzer' },
    story: {
      en: 'A big buyer sweeps the order books and the coins jump. The exchange is wide open for selling.',
      de: 'Ein großer Käufer leert die Orderbücher und die Coins springen. Die Börse ist weit offen zum Verkaufen.',
    },
    realWorld: 'One large order can move a crypto price by ten percent within minutes.',
    ops: [
      { op: 'index', factors: { BTC: 1.1, ETH: 1.12, ALTS: 1.08 } },
      { op: 'sellWindow', markets: ['BTC', 'ETH', 'ALTS'] },
    ],
    links: [],
  },
  {
    id: 'H110',
    group: 'crypto',
    copies: 1,
    title: { en: 'Spot ETF Inflows', de: 'Zuflüsse in Spot-ETFs' },
    story: {
      en: 'Funds that hold the coin for savers receive record inflows, and the price follows.',
      de: 'Fonds, die den Coin für Sparer halten, erhalten Rekordzuflüsse, und der Kurs folgt.',
    },
    realWorld:
      'US spot Bitcoin ETFs launched in January 2024 and gathered tens of billions of dollars within a year.',
    ops: [
      { op: 'index', factors: { BTC: 1.15, ETH: 1.05 } },
      { op: 'sellWindow', markets: ['BTC', 'ETH'] },
    ],
    links: [
      {
        label: 'Wikipedia – Bitcoin',
        url: 'https://de.wikipedia.org/wiki/Bitcoin',
      },
    ],
  },
  // ── the scams: a last exit, then the end ──
  {
    id: 'H111',
    group: 'traps',
    copies: 1,
    title: { en: 'Whispers About Lithium-X', de: 'Gerüchte um Lithium-X' },
    story: {
      en: 'A short seller publishes a report: no mine, no licence, no revenue. The share price collapses - you can still sell.',
      de: 'Ein Leerverkäufer veröffentlicht einen Bericht: keine Mine, keine Lizenz, kein Umsatz. Der Kurs bricht ein - du kannst noch verkaufen.',
    },
    realWorld:
      'Penny-stock promotions end with the price falling by 80 % or more within days; the last sellers get cents.',
    ops: [
      { op: 'holdingValue', targets: ['LITHX'], factor: 0.2 },
      { op: 'sellWindow', markets: ['LITHX'] },
    ],
    links: [
      {
        label: 'SEC – Microcap fraud',
        url: 'https://www.sec.gov/resources-for-investors/investor-alerts-bulletins/ib_microcapfraud',
      },
    ],
  },
  {
    id: 'H112',
    group: 'traps',
    copies: 1,
    title: { en: 'The MoonDoge Dump', de: 'Der MoonDoge-Dump' },
    story: {
      en: 'The wallets of the founders start moving. The price falls off a cliff - for a moment there is still a buyer.',
      de: 'Die Wallets der Gründer kommen in Bewegung. Der Kurs stürzt ab - für einen Moment gibt es noch einen Käufer.',
    },
    realWorld:
      'In a rug pull the insiders sell first and the token loses almost all of its value within minutes.',
    ops: [
      { op: 'holdingValue', targets: ['MOON'], factor: 0.15 },
      { op: 'sellWindow', markets: ['MOON'] },
    ],
    links: [],
  },
  {
    id: 'H113',
    group: 'traps',
    copies: 1,
    title: { en: 'Listing Postponed', de: 'Börsengang verschoben' },
    story: {
      en: "The 'exclusive' listing is postponed again. A broker offers to take your shares back - at a fraction.",
      de: "Der 'exklusive' Börsengang wird wieder verschoben. Ein Makler bietet an, deine Anteile zurückzunehmen - zu einem Bruchteil.",
    },
    realWorld: 'Shares of a company that is not listed have no market: the broker names the price.',
    ops: [
      { op: 'holdingValue', targets: ['PREIPO'], factor: 0.3 },
      { op: 'sellWindow', markets: ['PREIPO'] },
    ],
    links: [],
  },
  {
    id: 'H114',
    group: 'traps',
    copies: 1,
    title: { en: 'A Claims Buyer Calls', de: 'Ein Forderungskäufer ruft an' },
    story: {
      en: 'Withdrawals are slow. A firm offers to buy your claim on the platform for cents on the euro.',
      de: 'Auszahlungen dauern. Eine Firma bietet an, deine Forderung an die Plattform für Cent pro Euro zu kaufen.',
    },
    realWorld:
      'Creditors of failed crypto lenders sold their claims for 10 to 40 cents on the dollar.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['CLAIMS'],
          basis: 'paid',
          bands: bands([1, 3, 0.15], [4, 5, 0.25], [6, 6, 0.4]),
        },
      },
    ],
    links: [],
  },
  {
    id: 'H115',
    group: 'traps',
    copies: 1,
    title: { en: 'Partial Refund Offer', de: 'Angebot einer Teilerstattung' },
    story: {
      en: 'The course seller offers a "goodwill refund" - if you sign that you ask for nothing more.',
      de: 'Der Kursverkäufer bietet eine "Kulanzerstattung" an - wenn du unterschreibst, dass du nichts weiter verlangst.',
    },
    realWorld:
      'A partial refund against a waiver is common in education and trading-course disputes.',
    ops: [
      {
        op: 'buyer',
        buyer: { targets: ['P32'], basis: 'paid', factor: 0.35 },
      },
    ],
    links: [],
  },
  {
    id: 'H116',
    group: 'traps',
    copies: 1,
    title: { en: 'The Course Seller Vanishes', de: 'Der Kursverkäufer verschwindet' },
    story: {
      en: 'The website is gone, the phone is dead, the company has been deleted from the register.',
      de: 'Die Website ist weg, das Telefon tot, die Firma aus dem Register gelöscht.',
    },
    realWorld: 'Many trading-course sellers disappear once the complaints arrive.',
    ops: [{ op: 'trapReveal', cardIds: ['P32'] }],
    links: [],
  },
  {
    id: 'H117',
    group: 'traps',
    copies: 1,
    title: { en: 'The Resale Agency Is Insolvent', de: 'Die Wiederverkaufsagentur ist insolvent' },
    story: {
      en: 'The agency that was to resell your timeshare files for insolvency. The fees you paid are gone, and so is the week.',
      de: 'Die Agentur, die dein Timesharing weiterverkaufen sollte, meldet Insolvenz an. Die Gebühren sind weg, die Woche auch.',
    },
    realWorld: 'Timeshare resale agencies often take fees up front and sell nothing.',
    ops: [{ op: 'trapReveal', cardIds: ['T23'] }],
    links: [],
  },
  {
    id: 'H118',
    group: 'business',
    copies: 2,
    title: { en: 'A Broker Brings a Buyer', de: 'Ein Makler bringt einen Käufer' },
    story: {
      en: 'A business broker has a client who wants a running business like yours. He asks for a price - and a commission.',
      de: 'Ein Unternehmensmakler hat einen Kunden, der ein laufendes Geschäft wie deines will. Er fragt nach einem Preis - und einer Provision.',
    },
    realWorld:
      'Business brokers take 5 to 10 % of the price; for a small firm the buyer is usually found within a few months.',
    ops: [
      business(['ALLBIZ'], 30, 0.65, [
        [1, 2, 0.85],
        [3, 5, 1.0],
        [6, 6, 1.3],
      ]),
    ],
    links: [{ label: 'nexxt-change – Börse', url: 'https://www.nexxt-change.org/' }],
  },
  {
    id: 'H119',
    group: 'business',
    copies: 1,
    title: { en: 'Business Auction Evening', de: 'Unternehmens-Auktionsabend' },
    story: {
      en: 'A platform auctions running small businesses for one evening. Two bidders can double the price; none leaves you with a bargain-hunter.',
      de: 'Eine Plattform versteigert an einem Abend laufende kleine Unternehmen. Zwei Bieter können den Preis verdoppeln, keiner lässt dich mit einem Schnäppchenjäger zurück.',
    },
    realWorld:
      'Online auctions of small businesses end between a fire-sale price and a record - the room decides.',
    ops: [
      business(['ALLBIZ'], 24, 0.5, [
        [1, 1, 0.6],
        [2, 3, 0.9],
        [4, 5, 1.2],
        [6, 6, 1.7],
      ]),
    ],
    links: [],
  },
  {
    id: 'H120',
    group: 'shares',
    copies: 1,
    title: { en: 'Secondary Market for Startup Shares', de: 'Zweitmarkt für Start-up-Anteile' },
    story: {
      en: 'A platform matches holders of startup and fund shares with buyers who want in. Prices depend on the last funding round.',
      de: 'Eine Plattform bringt Inhaber von Start-up- und Fondsanteilen mit Käufern zusammen, die einsteigen wollen. Die Preise hängen von der letzten Finanzierungsrunde ab.',
    },
    realWorld:
      'Secondary sales of private-company shares usually happen at a discount to the last round - or, in a hot sector, above it.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['PRIVATE'],
          basis: 'index',
          bands: bands([1, 1, 0.6], [2, 3, 0.9], [4, 5, 1.2], [6, 6, 2.0]),
        },
      },
    ],
    links: [],
  },
  {
    id: 'H121',
    group: 'shares',
    copies: 2,
    title: { en: 'Bond Funds See Inflows', de: 'Rentenfonds erhalten Zuflüsse' },
    story: {
      en: 'Savers move money into safe bonds. Fund managers buy bonds from holders - a fraction above the last price.',
      de: 'Sparer schichten Geld in sichere Anleihen um. Fondsmanager kaufen Anleihen von Haltern - einen Bruchteil über dem letzten Kurs.',
    },
    realWorld:
      'When savers want safety, bond funds grow and pay a small premium to get hold of bonds.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['BOND'],
          basis: 'index',
          bands: bands([1, 3, 1.0], [4, 5, 1.02], [6, 6, 1.05]),
        },
      },
    ],
    links: [],
  },
  {
    id: 'H122',
    group: 'lending',
    copies: 2,
    title: { en: 'An Investor Takes Over Your Loans', de: 'Ein Investor übernimmt deine Kredite' },
    story: {
      en: 'A bigger investor wants to take over a loan book that pays every month, and bids for yours.',
      de: 'Ein größerer Anleger will ein Kreditbuch übernehmen, das jeden Monat zahlt, und bietet auf deines.',
    },
    realWorld: 'Loan books that pay on time are sold between investors at around their face value.',
    ops: [
      {
        op: 'buyer',
        buyer: {
          targets: ['LENDING'],
          basis: 'paid',
          bands: bands([1, 2, 0.9], [3, 5, 1.0], [6, 6, 1.08]),
        },
      },
    ],
    links: [],
  },
];

/** The German of the facts on the cards above (the other texts of a card are written in both languages on the card). */
export const HARVEST_MORE_DE: Record<string, string> = {
  'Loan books that pay on time are sold between investors at around their face value.':
    'Kreditbücher, die pünktlich zahlen, werden zwischen Anlegern etwa zum Nennwert verkauft.',
  'When savers want safety, bond funds grow and pay a small premium to get hold of bonds.':
    'Wollen Sparer Sicherheit, wachsen Rentenfonds und zahlen einen kleinen Aufschlag, um an Anleihen zu kommen.',
  'Business brokers take 5 to 10 % of the price; for a small firm the buyer is usually found within a few months.':
    'Unternehmensmakler nehmen 5 bis 10 % des Preises; bei einer kleinen Firma ist der Käufer meist in wenigen Monaten gefunden.',
  'Online auctions of small businesses end between a fire-sale price and a record - the room decides.':
    'Online-Auktionen kleiner Unternehmen enden zwischen Schleuderpreis und Rekord - der Saal entscheidet.',
  'Secondary sales of private-company shares usually happen at a discount to the last round - or, in a hot sector, above it.':
    'Zweitverkäufe von Anteilen nicht börsennotierter Firmen gehen meist mit Abschlag auf die letzte Runde über die Bühne - oder in einem heißen Sektor darüber.',
  'Owner-occupiers usually pay more than investors, because they value the home to live in, not only the rent it brings.':
    'Selbstnutzer zahlen meist mehr als Kapitalanleger, weil sie das Zuhause schätzen und nicht nur die Miete.',
  'Private landlords own about two thirds of all rental flats in Germany; many buy from each other.':
    'Private Vermieter besitzen rund zwei Drittel aller Mietwohnungen in Deutschland; viele kaufen voneinander.',
  'At a forced-sale auction in Germany the court can refuse a bid below half of the market value; many properties still sell for 70 to 90 % of it.':
    'Bei einer Zwangsversteigerung kann das Gericht ein Gebot unter der Hälfte des Verkehrswerts ablehnen; viele Objekte gehen trotzdem für 70 bis 90 % davon weg.',
  'Funds pay for size and ease: one buyer, one deed, little work - usually at a small discount to single sales.':
    'Fonds zahlen für Größe und Bequemlichkeit: ein Käufer, eine Urkunde, wenig Arbeit - meist mit kleinem Abschlag gegenüber Einzelverkäufen.',
  'Where parking is short, a garage space can be worth thousands more to a neighbour than to a stranger.':
    'Wo Parkplätze knapp sind, kann ein Stellplatz für einen Nachbarn Tausende mehr wert sein als für Fremde.',
  'Small online businesses are sold on marketplaces for roughly 24 to 40 times the monthly profit, depending on how much work the owner does.':
    'Kleine Online-Unternehmen werden auf Marktplätzen für etwa das 24- bis 40-Fache des Monatsgewinns verkauft, je nachdem, wie viel Arbeit der Inhaber hat.',
  'A client list is worth what the clients stay for: agencies pay a fraction up front and the rest if they stay.':
    'Ein Kundenstamm ist so viel wert, wie die Kunden bleiben: Agenturen zahlen einen Teil sofort und den Rest, wenn sie bleiben.',
  'Chains grow by buying running small businesses; they pay for the location and the customers, not for the owner.':
    'Ketten wachsen, indem sie laufende kleine Betriebe kaufen; sie zahlen für Standort und Kundschaft, nicht für den Inhaber.',
  'Hundreds of thousands of small German firms need a successor in the coming years; buyers look for stable cash flow.':
    'Hunderttausende kleine deutsche Firmen brauchen in den kommenden Jahren einen Nachfolger; Käufer suchen stabilen Cashflow.',
  'A competitor may pay more than anybody else (it removes a rival) - or very little, if it knows you are tired.':
    'Ein Wettbewerber zahlt vielleicht mehr als jeder andere (er schaltet einen Rivalen aus) - oder sehr wenig, wenn er weiß, dass du müde bist.',
  'The feed-in tariff of the EEG is guaranteed for 20 years, which makes a running solar plant a bond-like asset.':
    'Die Einspeisevergütung nach EEG ist 20 Jahre garantiert, das macht eine laufende Solaranlage zu einem anleiheähnlichen Wert.',
  'Peer-to-peer platforms with a secondary market let investors leave early - usually at a small discount to the loan.':
    'Peer-to-Peer-Plattformen mit Zweitmarkt lassen Anleger früher aussteigen - meist mit kleinem Abschlag auf den Kredit.',
  'Resale prices follow hype: a sneaker can sell for double on the day and for less than the shop price a year later.':
    'Wiederverkaufspreise folgen dem Hype: Ein Sneaker kann am Tag das Doppelte bringen und ein Jahr später weniger als im Laden.',
  'Auction houses take a buyer’s and a seller’s fee of 10 to 25 %; what you get depends on who is in the room.':
    'Auktionshäuser nehmen Käufer- und Verkäuferprovision von 10 bis 25 %; was du bekommst, hängt davon ab, wer im Saal sitzt.',
  'Block trades are priced off the market: a few percent above, or at a discount, depending on how badly the buyer wants it.':
    'Blockhandel wird am Markt gemessen: einige Prozent darüber oder mit Abschlag, je nachdem, wie dringend der Käufer will.',
  'Takeover bids usually pay a premium of 20 to 40 % on the share price of the day before.':
    'Übernahmeangebote zahlen meist einen Aufschlag von 20 bis 40 % auf den Kurs des Vortags.',
  'When everybody sells at once, buyers can name their price. Sellers who must sell lose a few percent.':
    'Wenn alle gleichzeitig verkaufen, bestimmen die Käufer den Preis. Wer verkaufen muss, verliert einige Prozent.',
  'The "Santa Claus rally": stocks have risen in the last days of December more often than not.':
    'Die "Weihnachtsrally": Aktien sind in den letzten Dezembertagen öfter gestiegen als gefallen.',
  'Forced selling feeds on itself; for a week or two even good assets trade at a discount.':
    'Zwangsverkäufe schaukeln sich auf; für ein, zwei Wochen werden selbst gute Werte mit Abschlag gehandelt.',
  'One large order can move a crypto price by ten percent within minutes.':
    'Ein großer Auftrag kann einen Kryptokurs binnen Minuten um zehn Prozent bewegen.',
  'US spot Bitcoin ETFs launched in January 2024 and gathered tens of billions of dollars within a year.':
    'US-Spot-Bitcoin-ETFs starteten im Januar 2024 und sammelten binnen eines Jahres Dutzende Milliarden Dollar ein.',
  'Penny-stock promotions end with the price falling by 80 % or more within days; the last sellers get cents.':
    'Penny-Stock-Werbung endet mit einem Kursverfall von 80 % oder mehr binnen Tagen; die letzten Verkäufer bekommen Cents.',
  'In a rug pull the insiders sell first and the token loses almost all of its value within minutes.':
    'Beim Rug Pull verkaufen die Insider zuerst, und der Token verliert binnen Minuten fast seinen ganzen Wert.',
  'Shares of a company that is not listed have no market: the broker names the price.':
    'Anteile einer nicht börsennotierten Firma haben keinen Markt: Der Makler nennt den Preis.',
  'Creditors of failed crypto lenders sold their claims for 10 to 40 cents on the dollar.':
    'Gläubiger gescheiterter Krypto-Kreditgeber verkauften ihre Forderungen für 10 bis 40 Cent pro Dollar.',
  'A partial refund against a waiver is common in education and trading-course disputes.':
    'Eine Teilerstattung gegen Verzicht ist bei Streit um Bildungs- und Handelskurse üblich.',
  'Many trading-course sellers disappear once the complaints arrive.':
    'Viele Anbieter von Handelskursen verschwinden, sobald die Beschwerden kommen.',
  'Timeshare resale agencies often take fees up front and sell nothing.':
    'Wiederverkaufsagenturen für Timesharing nehmen oft Gebühren im Voraus und verkaufen nichts.',
};
