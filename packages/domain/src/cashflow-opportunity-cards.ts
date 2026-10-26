import type { OpportunityCard } from './cashflow-game/opportunity-deck';

/**
 * The Opportunity stack of the Dreamfund game (JFK, 2026-10-26), generated from temp_cards/dreamfund-opportunity-deck.md v1.0: 98 cards,
 * Seed 36 / Sapling 32 / Tree 30. The traps carry an internal `trap` block that only the engine reads - it is never shown to a player.
 */
export const OPPORTUNITY_CARDS: OpportunityCard[] = [
  {
    id: 'S01',
    pile: 'seed',
    title: {
      en: 'AI Subscription Audit',
      de: 'KI-Abo-Check',
    },
    story: {
      en: 'You let an AI scan your bank statements. It finds three subscriptions you forgot you had.',
      de: 'Du lässt eine KI deine Kontoauszüge prüfen. Sie findet drei Abos, die du vergessen hattest.',
    },
    growType: 'subscription-action',
    category: 'Seed · savings',
    pattern: 'cancel or downgrade subscriptions',
    strategy:
      "List every recurring payment, cancel what you don't use, downgrade what you use rarely, rotate streaming services month by month.",
    reasoning: 'Small recurring costs are invisible but add up every single month.',
    risks: 'Almost none; you may re-subscribe out of habit.',
    riskScore: 0,
    insights:
      'Germans paying for streaming spent about €15.70/month on video and €11/month on audio (Bitkom survey).',
    alternative: 'Keep everything',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'mobiFlip – Bitkom Streaming-Ausgaben',
        url: 'https://www.mobiflip.de/shortnews/streaming-wende-deutsche-sagen-teuren-abos-den-kampf-an/amp/',
      },
    ],
    actions: [
      {
        text: 'Export 3 months of bank statements',
        priority: 'medium',
      },
      {
        text: 'Cancel unused subscriptions via the cancellation button',
        priority: 'medium',
      },
      {
        text: 'Set a yearly subscription review reminder',
        priority: 'medium',
      },
    ],
    costMinor: 0,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          monthlySavingsMinor: 1500,
        },
      },
      {
        from: 3,
        to: 4,
        value: {
          monthlySavingsMinor: 3000,
        },
      },
      {
        from: 5,
        to: 6,
        value: {
          monthlySavingsMinor: 5000,
        },
      },
    ],
  },
  {
    id: 'S02',
    pile: 'seed',
    title: {
      en: 'Switch Electricity Provider',
      de: 'Stromanbieter wechseln',
    },
    story: {
      en: "Ten minutes on a comparison site, one click, and next month's bill is lower.",
      de: 'Zehn Minuten auf einem Vergleichsportal, ein Klick, und die nächste Rechnung ist niedriger.',
    },
    growType: 'budget-optimization',
    category: 'Seed · savings',
    pattern: 'switch provider',
    strategy:
      'Compare new-customer tariffs every year; avoid long price guarantees with high base prices.',
    reasoning: 'Existing customers often pay more than new customers.',
    risks: 'Bonus traps (first-year bonus, expensive second year).',
    riskScore: 0,
    insights:
      'Stiftung Warentest: a 2 ct/kWh lower price saves a 4,000 kWh family about €80 a year; new-customer prices were ~31 ct/kWh vs ~33 ct average.',
    alternative: 'Stay in your current tariff',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'Stiftung Warentest – Stromanbieter wechseln',
        url: 'https://www.test.de/Strom-und-Gas-Anbieterwechsel-leicht-und-lohnend-4464395-0/',
      },
    ],
    actions: [
      {
        text: 'Check your annual consumption in kWh',
        priority: 'medium',
      },
      {
        text: 'Compare tariffs without first-year bonus',
        priority: 'medium',
      },
      {
        text: 'Set a reminder before the contract renews',
        priority: 'medium',
      },
    ],
    costMinor: 0,
    savings: {
      currentCostMinor: 6000,
      targetCostMinor: 5300,
      monthlySavingsMinor: 700,
    },
  },
  {
    id: 'S03',
    pile: 'seed',
    title: {
      en: 'Meal Prep Sundays',
      de: 'Meal Prep am Sonntag',
    },
    story: {
      en: 'Two hours of cooking on Sunday replaces five takeaway lunches a week.',
      de: 'Zwei Stunden Kochen am Sonntag ersetzen fünf Mittagessen zum Mitnehmen pro Woche.',
    },
    growType: 'expense-insight',
    category: 'Seed · savings',
    pattern: 'replace eating out',
    strategy:
      'Cook in batches, take lunch to work three days a week, keep one takeaway day as a treat.',
    reasoning: 'Takeaway lunches cost 10–15 TT; a home-cooked portion costs 3–4 TT.',
    risks: 'Motivation drops after a few weeks.',
    riskScore: 0,
    insights:
      "The Dual Student's real data: eating out costs 90–175 €/month with 8–14 lunches; groceries are already the biggest variable item.",
    alternative: 'Keep buying lunch',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Buy good lunch containers',
        priority: 'medium',
      },
      {
        text: 'Plan 3 meal-prep days per week',
        priority: 'medium',
      },
      {
        text: 'Track lunch spending for one month',
        priority: 'medium',
      },
    ],
    estimate: true,
    costMinor: 4000,
    savings: {
      currentCostMinor: 15000,
      targetCostMinor: 9000,
      monthlySavingsMinor: 6000,
    },
  },
  {
    id: 'S04',
    pile: 'seed',
    title: {
      en: 'Cheaper Mobile Plan',
      de: 'Günstigerer Handytarif',
    },
    story: {
      en: "You're paying for 50 GB and using 8. A smaller plan does the same job.",
      de: 'Du zahlst für 50 GB und nutzt 8. Ein kleinerer Tarif tut es genauso.',
    },
    growType: 'budget-optimization',
    category: 'Seed · savings',
    pattern: 'switch provider',
    strategy: 'Check your real data use, switch to a monthly-cancellable plan on the same network.',
    reasoning: 'Plans are sold by fear of running out, not by actual use.',
    risks: 'Minimum contract terms; number porting takes a few days.',
    riskScore: 0,
    insights:
      'The Dual Student pays ~20 €/month; comparable monthly-cancellable plans cost around 8–12 €.',
    alternative: 'Keep your plan',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Check data usage of the last 6 months',
        priority: 'medium',
      },
      {
        text: 'Compare monthly-cancellable plans',
        priority: 'medium',
      },
      {
        text: 'Port your number',
        priority: 'medium',
      },
    ],
    estimate: true,
    costMinor: 0,
    savings: {
      currentCostMinor: 2000,
      targetCostMinor: 1000,
      monthlySavingsMinor: 1000,
    },
  },
  {
    id: 'S05',
    pile: 'seed',
    title: {
      en: 'Free Bank Account',
      de: 'Kostenloses Girokonto',
    },
    story: {
      en: "Your bank raised the monthly fee again. Another bank doesn't charge one.",
      de: 'Deine Bank hat die Kontogebühr schon wieder erhöht. Eine andere Bank verlangt keine.',
    },
    growType: 'budget-optimization',
    category: 'Seed · savings',
    pattern: 'switch provider',
    strategy: "Use the bank's account-switching service; move direct debits in one go.",
    reasoning: 'Account fees are a pure cost with no benefit.',
    risks: "Some 'free' accounts require a minimum monthly income.",
    riskScore: 0,
    insights:
      'Account switching help is required by law in Germany; the new bank informs payers and payees.',
    alternative: 'Stay',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Compare free accounts and conditions',
        priority: 'medium',
      },
      {
        text: 'Use the switching service',
        priority: 'medium',
      },
      {
        text: 'Close the old account',
        priority: 'medium',
      },
    ],
    estimate: true,
    costMinor: 0,
    savings: {
      currentCostMinor: 600,
      targetCostMinor: 0,
      monthlySavingsMinor: 600,
    },
  },
  {
    id: 'S06',
    pile: 'seed',
    title: {
      en: 'Ask for a Job Ticket',
      de: 'Jobticket beantragen',
    },
    story: {
      en: 'HR has a form you never filled in: the company pays part of your Deutschlandticket.',
      de: 'Die Personalabteilung hat ein Formular, das du nie ausgefüllt hast: Die Firma zahlt einen Teil deines Deutschlandtickets.',
    },
    growType: 'budget-optimization',
    category: 'Seed · savings',
    pattern: 'employer benefits',
    strategy:
      'Check every employer benefit: job ticket, meal vouchers, bike leasing, company pension match.',
    reasoning: 'Employer benefits are often tax-free and simply unused.',
    risks: 'None.',
    riskScore: 0,
    insights:
      'Employer subsidies for the Deutschlandticket as job ticket are tax-free; many large employers offer them.',
    alternative: 'Pay the full ticket',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Ask HR for the list of benefits',
        priority: 'medium',
      },
      {
        text: 'Apply for the job ticket',
        priority: 'medium',
      },
      {
        text: 'Check company pension matching',
        priority: 'medium',
      },
    ],
    estimate: true,
    costMinor: 0,
    savings: {
      currentCostMinor: 4300,
      targetCostMinor: 2800,
      monthlySavingsMinor: 1500,
    },
  },
  {
    id: 'S07',
    pile: 'seed',
    title: {
      en: 'Declutter and Sell',
      de: 'Ausmisten und verkaufen',
    },
    story: {
      en: 'Old phone, a guitar you never play, ski boots two sizes too small. Someone wants them.',
      de: 'Altes Handy, eine Gitarre, die du nie spielst, Skischuhe zwei Nummern zu klein. Jemand will sie haben.',
    },
    growType: 'income-growth',
    category: 'Seed · side income',
    pattern: 'one-time sale',
    strategy: 'List items with good photos and fair prices; bundle small items.',
    reasoning: 'Unused things lose value every year they sit in a cupboard.',
    risks: 'Scam buyers on classified platforms (fake payment links).',
    riskScore: 1,
    insights:
      "Classic classifieds scam: 'buyer' sends a fake payment link asking for card data — only accept cash on pickup or the platform's protected payment.",
    alternative: 'Keep the clutter',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Photograph items in daylight',
        priority: 'medium',
      },
      {
        text: 'Accept cash on pickup or protected payment only',
        priority: 'medium',
      },
      {
        text: "Donate what doesn't sell in 4 weeks",
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 0,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          oneTimeMinor: 15000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          oneTimeMinor: 35000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          oneTimeMinor: 80000,
        },
      },
    ],
  },
  {
    id: 'S08',
    pile: 'seed',
    title: {
      en: 'Balcony Solar Panel',
      de: 'Balkonkraftwerk',
    },
    story: {
      en: 'Two panels on the balcony railing. Your meter now runs slower every sunny day.',
      de: 'Zwei Module am Balkongeländer. Dein Zähler läuft jetzt an jedem sonnigen Tag langsamer.',
    },
    growType: 'income-growth',
    category: 'Seed · energy',
    pattern: 'cost-saving asset',
    strategy:
      'Install south-facing, use big appliances at midday, register with the grid operator.',
    reasoning: 'Self-produced electricity replaces electricity you would buy at ~40 ct/kWh.',
    risks: "Landlord or owners' association approval; shading reduces output.",
    riskScore: 1,
    insights:
      'An 800 W system can produce about 800 kWh a year, worth about €320 at 40 ct/kWh if used at home; simple systems cost a few hundred euros.',
    alternative: 'Keep buying all electricity',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'balkonstrom – Balkonkraftwerk Ersparnis',
        url: 'https://www.balkonstrom.com/blogs/news/balkonkraftwerk-ersparnis-so-viel-sparst-du-wirklich',
      },
    ],
    actions: [
      {
        text: "Ask landlord/owners' association",
        priority: 'medium',
      },
      {
        text: 'Register in the Marktstammdatenregister',
        priority: 'medium',
      },
      {
        text: 'Run washing machine and dishwasher at midday',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 60000,
    savings: {
      currentCostMinor: 0,
      targetCostMinor: 0,
      monthlySavingsMinor: 2500,
    },
  },
  {
    id: 'S09',
    pile: 'seed',
    title: {
      en: 'High-Interest Savings Account',
      de: 'Tagesgeldkonto',
    },
    story: {
      en: 'Your Mojo sits on a 0% account. Another bank pays 2.5% — and you can still withdraw any day.',
      de: 'Dein Mojo liegt auf einem 0-%-Konto. Eine andere Bank zahlt 2,5 % — und du kommst trotzdem jeden Tag ran.',
    },
    growType: 'income-growth',
    category: 'Seed · savings',
    pattern: 'interest on cash',
    strategy: 'Keep your emergency reserve (Mojo) here; compare rates twice a year.',
    reasoning: 'Cash should work while it waits, without risk.',
    risks: 'Rates are variable and can fall; teaser rates expire.',
    riskScore: 0,
    insights:
      'October 2026: ECB deposit rate 2.50%; best overnight accounts about 2.5%, fixed deposits up to ~4.25% depending on term; deposits protected up to €100,000 per bank.',
    alternative: '0% current account',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'Raisin – Zinsradar 10/2026',
        url: 'https://www.raisin.com/de-de/geldanlage/zinsradar/',
      },
    ],
    actions: [
      {
        text: 'Compare rates excluding teaser offers',
        priority: 'medium',
      },
      {
        text: 'Move your Mojo reserve',
        priority: 'medium',
      },
      {
        text: 'Check the rate every 6 months',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 100000,
    stepMinor: 100000,
    cashflowMinor: 200,
    note: 'Per 1,000 TT moved: +2 TT/month (2.5% p.a.). Can be bought in several steps.',
  },
  {
    id: 'S10',
    pile: 'seed',
    title: {
      en: 'World ETF Savings Plan',
      de: 'ETF-Sparplan Welt',
    },
    story: {
      en: 'Fifty euros a month into the whole world economy. Boring. Exactly the point.',
      de: "Fünfzig Euro im Monat in die gesamte Weltwirtschaft. Langweilig. Genau darum geht's.",
    },
    growType: 'income-growth',
    category: 'Seed · conservative',
    pattern: 'index ETF, distributing',
    strategy: 'Buy regularly, never sell in a crash, reinvest or collect the small payouts.',
    reasoning: 'A global index holds about 1,500 companies; long-term growth with very low cost.',
    risks: 'Crashes of 30–50% happen; recovery can take years.',
    riskScore: 2,
    insights:
      'The MSCI World returned roughly 7–8% a year long-term with dividends reinvested; it fell about 50% in 2000–03 and 2008–09 and ~34% in 2020.',
    alternative: 'High-interest savings account',
    alternativeCostMinor: 100000,
    links: [
      {
        label: 'zendepot – MSCI World Rendite',
        url: 'https://zendepot.de/etf/msci-world-rendite',
      },
    ],
    actions: [
      {
        text: 'Open a broker account with free savings plans',
        priority: 'medium',
      },
      {
        text: 'Set up a monthly plan',
        priority: 'medium',
      },
      {
        text: "Don't check prices daily",
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'WORLD',
      unitPriceMinor: 10000,
      maxUnits: 20,
      dividendMonthPerUnitMinor: 15,
      yieldYearPercent: 1.8,
    },
    market: {
      tag: 'WORLD',
      lowMinor: 6000,
      highMinor: 14000,
      trend: 'slow up',
    },
  },
  {
    id: 'S11',
    pile: 'seed',
    title: {
      en: 'Government Bond ETF',
      de: 'Staatsanleihen-ETF',
    },
    story: {
      en: 'Lending money to European governments. Small, steady interest. Sleeps well.',
      de: 'Geld an europäische Staaten verleihen. Kleine, stetige Zinsen. Schläft sich gut.',
    },
    growType: 'income-growth',
    category: 'Seed · conservative',
    pattern: 'bond ETF',
    strategy: 'Use as the calm part of a portfolio; hold through the cycle.',
    reasoning: 'Bonds pay fixed interest and fall less than shares in crises.',
    risks: 'Prices fall when interest rates rise.',
    riskScore: 1,
    insights:
      'With the ECB deposit rate at 2.50% (Oct 2026), short and medium government bonds yield roughly in that range.',
    alternative: 'Fixed deposit',
    alternativeCostMinor: 100000,
    links: [
      {
        label: 'Raisin – Zinsradar 10/2026',
        url: 'https://www.raisin.com/de-de/geldanlage/zinsradar/',
      },
    ],
    actions: [
      {
        text: 'Pick a low-cost euro government bond ETF',
        priority: 'medium',
      },
      {
        text: 'Match the duration to your time horizon',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'BUND',
      unitPriceMinor: 5000,
      maxUnits: 40,
      dividendMonthPerUnitMinor: 11,
      yieldYearPercent: 2.64,
    },
    market: {
      tag: 'BUND',
      lowMinor: 4400,
      highMinor: 5600,
      trend: 'flat',
    },
  },
  {
    id: 'S12',
    pile: 'seed',
    title: {
      en: 'Dividend ETF',
      de: 'Dividenden-ETF',
    },
    story: {
      en: 'A basket of companies that have paid dividends for decades.',
      de: 'Ein Korb aus Firmen, die seit Jahrzehnten Dividenden zahlen.',
    },
    growType: 'income-growth',
    category: 'Seed · dividend',
    pattern: 'dividend ETF',
    strategy: 'Hold for income; reinvest payouts while still building up.',
    reasoning: 'Higher payouts give visible cash flow early.',
    risks: 'Less growth than a world ETF; concentrated in older industries.',
    riskScore: 2,
    insights: 'Almost half of DAX companies had a dividend yield of 3% or more in 2026.',
    alternative: 'World ETF',
    alternativeCostMinor: 10000,
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
    actions: [
      {
        text: 'Compare costs (TER) and number of holdings',
        priority: 'medium',
      },
      {
        text: 'Decide: reinvest or collect',
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'DIVI',
      unitPriceMinor: 3000,
      maxUnits: 50,
      dividendMonthPerUnitMinor: 9,
      yieldYearPercent: 3.6,
    },
    market: {
      tag: 'DIVI',
      lowMinor: 2200,
      highMinor: 3600,
      trend: 'slow up',
    },
  },
  {
    id: 'S13',
    pile: 'seed',
    title: {
      en: 'Autowerk AG (Car Maker)',
      de: 'Autowerk AG (Autobauer)',
    },
    story: {
      en: 'A Bavarian car maker pays a fat dividend — while the industry argues about electric cars.',
      de: 'Ein bayerischer Autobauer zahlt eine dicke Dividende — während die Branche über E-Autos streitet.',
    },
    growType: 'income-growth',
    category: 'Seed · dividend',
    pattern: 'single dividend stock (cyclical)',
    strategy: 'Buy when the sector is out of favour; collect dividends; sell into a Harvest boom.',
    reasoning: 'High dividend yield from a profitable, established company.',
    risks: 'Car makers are cyclical; dividends get cut in bad years; single-stock risk.',
    riskScore: 3,
    insights:
      'BMW paid €4.40 per share for 2026, a yield of about 5.3%; Mercedes-Benz yielded about 6.4%. German companies pay once a year after the AGM (the game spreads it monthly).',
    alternative: 'Dividend ETF',
    alternativeCostMinor: 3000,
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
    actions: [
      {
        text: 'Read the last annual report summary',
        priority: 'medium',
      },
      {
        text: 'Never put more than 5% in one stock',
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'AUTO',
      unitPriceMinor: 8200,
      maxUnits: 30,
      dividendMonthPerUnitMinor: 37,
      yieldYearPercent: 5.41,
    },
    market: {
      tag: 'AUTO',
      lowMinor: 5500,
      highMinor: 12000,
      trend: 'cyclical',
    },
  },
  {
    id: 'S14',
    pile: 'seed',
    title: {
      en: 'Insurance Giant AG',
      de: 'Versicherungsriese AG',
    },
    story: {
      en: 'Everyone needs insurance. This company has been paying shareholders for decades.',
      de: 'Jeder braucht Versicherungen. Diese Firma zahlt seit Jahrzehnten an ihre Aktionäre.',
    },
    growType: 'income-growth',
    category: 'Seed · dividend',
    pattern: 'single dividend stock (defensive)',
    strategy: 'Buy and hold; a defensive anchor in a portfolio.',
    reasoning: 'Stable earnings, rising dividends.',
    risks: 'Big catastrophes and financial crises hit insurers.',
    riskScore: 2,
    insights: 'Allianz paid €17.10 per share for 2026, a yield of about 4.5%.',
    alternative: 'Dividend ETF',
    alternativeCostMinor: 3000,
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
    actions: [
      {
        text: 'Compare with a dividend ETF',
        priority: 'medium',
      },
      {
        text: 'Check the dividend history',
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'INSU',
      unitPriceMinor: 37800,
      maxUnits: 6,
      dividendMonthPerUnitMinor: 143,
      yieldYearPercent: 4.54,
    },
    market: {
      tag: 'INSU',
      lowMinor: 30000,
      highMinor: 45000,
      trend: 'slow up',
    },
  },
  {
    id: 'S15',
    pile: 'seed',
    title: {
      en: 'Telecom AG',
      de: 'Telekom AG',
    },
    story: {
      en: 'The company behind your mobile network pays a small, reliable dividend.',
      de: 'Die Firma hinter deinem Handynetz zahlt eine kleine, verlässliche Dividende.',
    },
    growType: 'income-growth',
    category: 'Seed · dividend',
    pattern: 'single dividend stock (utility-like)',
    strategy: 'Hold for steady income.',
    reasoning: 'Infrastructure businesses have predictable cash flows.',
    risks: 'Slow growth, high debt, regulation.',
    riskScore: 2,
    insights: 'Telecoms typically yield around 3% with low volatility.',
    alternative: 'Dividend ETF',
    alternativeCostMinor: 3000,
    links: [],
    actions: [
      {
        text: 'Check the dividend history',
        priority: 'medium',
      },
      {
        text: 'Compare with a dividend ETF',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'TELE',
      unitPriceMinor: 3000,
      maxUnits: 50,
      dividendMonthPerUnitMinor: 8,
      yieldYearPercent: 3.0,
    },
    market: {
      tag: 'TELE',
      lowMinor: 2400,
      highMinor: 3600,
      trend: 'flat',
    },
  },
  {
    id: 'S16',
    pile: 'seed',
    title: {
      en: 'CloudCore (Tech Growth Stock)',
      de: 'CloudCore (Tech-Wachstumsaktie)',
    },
    story: {
      en: 'A fast-growing cloud company. No dividend, all growth — and a share price that swings like a pendulum.',
      de: 'Eine schnell wachsende Cloud-Firma. Keine Dividende, nur Wachstum — und ein Kurs, der pendelt.',
    },
    growType: 'income-growth',
    category: 'Seed · growth',
    pattern: 'growth stock, no dividend',
    strategy: 'Small position; sell part when a Harvest card doubles the price.',
    reasoning: 'If the company keeps growing, the share price follows.',
    risks: 'High valuation; a single bad quarter can cut the price by 30%.',
    riskScore: 4,
    insights: 'Growth stocks pay no dividend; returns come only from selling higher.',
    alternative: 'World ETF',
    alternativeCostMinor: 10000,
    links: [],
    actions: [
      {
        text: 'Limit to a small share of your portfolio',
        priority: 'medium',
      },
      {
        text: 'Decide your sell price in advance',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'CLOUD',
      unitPriceMinor: 15000,
      maxUnits: 10,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'CLOUD',
      lowMinor: 6000,
      highMinor: 40000,
      trend: 'volatile',
    },
  },
  {
    id: 'S17',
    pile: 'seed',
    title: {
      en: 'Lithium-X Hot Tip',
      de: 'Heißer Tipp: Lithium-X',
    },
    story: {
      en: "A forum post: 'Lithium-X will 10x by Christmas. Get in before the news breaks!'",
      de: "Ein Forumspost: 'Lithium-X verzehnfacht sich bis Weihnachten. Rein, bevor die News kommt!'",
    },
    growType: 'income-growth',
    category: 'Seed · speculative',
    pattern: 'small-cap mining stock',
    strategy: 'Get in early before the announcement; sell after the jump.',
    reasoning: 'The forum says a big lithium discovery will be announced soon.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 4,
    insights:
      'Small-cap stocks can move 10× — in both directions. Regulators advise checking whether a company has audited revenue and where its shares trade.',
    alternative: 'World ETF',
    alternativeCostMinor: 10000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [
      {
        text: 'Check if the company has real revenue',
        priority: 'medium',
      },
      {
        text: 'Never buy based on forum hype',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'LITHX',
      unitPriceMinor: 200,
      maxUnits: 500,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'LITHX',
      lowMinor: 0,
      highMinor: 600,
      trend: 'collapse likely',
    },
    trap: {
      trueCategory: 'speculative',
      collapseAfterPaydays: 6,
    },
  },
  {
    id: 'S18',
    pile: 'seed',
    title: {
      en: 'Bitcoin Slice',
      de: 'Ein Stück Bitcoin',
    },
    story: {
      en: "A friend says Bitcoin is 'digital gold'. Another says it's a bubble. Both have been right before.",
      de: "Ein Freund sagt, Bitcoin sei 'digitales Gold'. Ein anderer sagt, es sei eine Blase. Beide hatten schon mal recht.",
    },
    growType: 'income-growth',
    category: 'Seed · crypto',
    pattern: 'crypto, no yield',
    strategy: "Small fixed share of your portfolio; hold through drawdowns or don't buy at all.",
    reasoning: 'Limited supply, growing adoption.',
    risks: 'Drawdowns of 70%+ have happened; exchange hacks; no cash flow.',
    riskScore: 4,
    insights:
      "Bitcoin's annualised volatility was 181% in 2013 and fell to about 23% in 2025 (21Shares). Big long-term gains came with deep crashes.",
    alternative: 'World ETF',
    alternativeCostMinor: 10000,
    links: [
      {
        label: '21Shares – Wie volatil ist Bitcoin?',
        url: 'https://www.21shares.com/de/research/wie-volatil-ist-bitcoin',
      },
    ],
    actions: [
      {
        text: 'Use a regulated exchange',
        priority: 'medium',
      },
      {
        text: 'Turn on two-factor authentication',
        priority: 'medium',
      },
      {
        text: 'Decide your maximum share (e.g. 5%)',
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'BTC',
      unitPriceMinor: 50000,
      maxUnits: 4,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'BTC',
      lowMinor: 15000,
      highMinor: 500000,
      trend: 'volatile; x10 extremely rare',
    },
  },
  {
    id: 'S19',
    pile: 'seed',
    title: {
      en: 'Ether With Staking',
      de: 'Ether mit Staking',
    },
    story: {
      en: 'You stake your Ether to help secure the network. In return, it pays you a small yield.',
      de: 'Du stakest dein Ether, um das Netzwerk abzusichern. Dafür zahlt es dir eine kleine Rendite.',
    },
    growType: 'income-growth',
    category: 'Seed · crypto',
    pattern: 'crypto with staking yield',
    strategy:
      'Stake via a reputable provider; treat the yield as a bonus, the price as the real risk.',
    reasoning: 'Staking pays new coins for securing the network.',
    risks: 'Price can halve; slashing; platform risk; lock-up periods.',
    riskScore: 4,
    insights:
      '2026 staking yields: about 3.2–3.8% solo, 3.0–3.5% via liquid staking, 2.5–3.0% on exchanges after fees.',
    alternative: 'Bitcoin slice',
    alternativeCostMinor: 50000,
    links: [
      {
        label: 'Ryder – Ethereum staking yield 2026',
        url: 'https://ryder.id/blogs/post/ethereum-staking-yield-in-2026-after-pectra',
      },
    ],
    actions: [
      {
        text: 'Compare staking fees',
        priority: 'medium',
      },
      {
        text: 'Understand lock-up and exit times',
        priority: 'medium',
      },
      {
        text: 'Keep coins on a wallet you control',
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'ETH',
      unitPriceMinor: 30000,
      maxUnits: 6,
      dividendMonthPerUnitMinor: 75,
      yieldYearPercent: 3.0,
    },
    market: {
      tag: 'ETH',
      lowMinor: 10000,
      highMinor: 120000,
      trend: 'volatile',
    },
  },
  {
    id: 'S20',
    pile: 'seed',
    title: {
      en: 'MoonDoge Token',
      de: 'MoonDoge-Token',
    },
    story: {
      en: "An influencer you follow posts: 'MoonDoge to the moon 🚀 1000x guaranteed'. The chart only goes up.",
      de: "Ein Influencer, dem du folgst, postet: 'MoonDoge to the moon 🚀 1000x garantiert'. Der Chart geht nur nach oben.",
    },
    growType: 'income-growth',
    category: 'Seed · crypto',
    pattern: 'new community token',
    strategy: 'Buy early while the price is low; hold for the moonshot.',
    reasoning: 'A fast-growing online community and influencer backing.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 4,
    insights:
      'Thousands of new tokens launch every month. Before buying, people check whether the team is public and whether the liquidity is locked. Chainalysis counted at least $14 billion in crypto scams in 2025.',
    alternative: 'Keep your money',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [
      {
        text: 'Check whether the team is public',
        priority: 'medium',
      },
      {
        text: 'Check if liquidity is locked',
        priority: 'medium',
      },
      {
        text: "Ignore 'guaranteed' returns",
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'MOON',
      unitPriceMinor: 100,
      maxUnits: 1000,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'MOON',
      lowMinor: 0,
      highMinor: 2000,
      trend: 'rug pull: almost always 0',
    },
    trap: {
      trueCategory: 'scam',
      collapseAfterPaydays: 4,
    },
  },
  {
    id: 'S21',
    pile: 'seed',
    title: {
      en: '2% a Week Crypto Lending',
      de: '2 % pro Woche Krypto-Lending',
    },
    story: {
      en: 'A slick app promises 2% interest per week on your coins. Your colleague already got paid twice.',
      de: 'Eine schicke App verspricht 2 % Zinsen pro Woche auf deine Coins. Dein Kollege wurde schon zweimal ausbezahlt.',
    },
    growType: 'income-growth',
    category: 'Seed · crypto',
    pattern: 'crypto lending app',
    strategy: 'Deposit coins, collect weekly interest, invite friends for a referral bonus.',
    reasoning: 'The app says it lends your coins to traders who pay high interest.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 3,
    insights:
      "Licensed lenders in Germany are listed in BaFin's company database; returns far above the market are worth questioning.",
    alternative: 'High-interest savings account',
    alternativeCostMinor: 100000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [
      {
        text: 'Check the BaFin company database',
        priority: 'medium',
      },
      {
        text: 'Never chase fixed weekly returns',
        priority: 'medium',
      },
    ],
    kind: 'investment',
    costMinor: 100000,
    trap: {
      trueCategory: 'scam',
      ponzi: {
        paysMonthMinor: 8000,
        paysPaydays: 2,
        then: 'lost',
      },
    },
  },
  {
    id: 'S22',
    pile: 'seed',
    title: {
      en: 'Trading Card Booster Box',
      de: 'Sammelkarten-Display',
    },
    story: {
      en: 'A sealed booster box of the newest set. Somewhere in there could be the chase card.',
      de: 'Ein versiegeltes Display des neuesten Sets. Irgendwo darin könnte die begehrte Karte stecken.',
    },
    growType: 'income-growth',
    category: 'Seed · collectible',
    pattern: 'gamble on rarity',
    strategy: 'Open now and roll, or keep sealed and wait for a collector on a Harvest card.',
    reasoning: 'Rare cards from popular sets can be worth thousands.',
    risks: 'Reprints, fakes, tampered packs; most cards are worth little.',
    riskScore: 4,
    insights:
      "Stiftung Warentest doesn't recommend trading cards as an investment (purely speculative); value depends on age, condition, rarity; fakes and resealed packs exist.",
    alternative: 'Keep the money',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
    actions: [
      {
        text: 'Buy only sealed product from trusted sellers',
        priority: 'medium',
      },
      {
        text: 'Grade valuable cards',
        priority: 'medium',
      },
      {
        text: 'Store in sleeves and top loaders',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    market: {
      tag: 'CARDS',
      lowMinor: 50,
      highMinor: 200,
      trend: 'multiplier on asset value',
    },
    costMinor: 15000,
    dice: [
      {
        from: 1,
        to: 3,
        value: {
          assetValueMinor: 6000,
        },
      },
      {
        from: 4,
        to: 5,
        value: {
          assetValueMinor: 30000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          rollAgain: [
            {
              from: 1,
              to: 5,
              value: {
                assetValueMinor: 100000,
              },
            },
            {
              from: 6,
              to: 6,
              value: {
                assetValueMinor: 1000000,
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'S23',
    pile: 'seed',
    title: {
      en: 'Graded Vintage Card',
      de: 'Gradete Vintage-Karte',
    },
    story: {
      en: 'A 25-year-old card, professionally graded 9 out of 10, in a sealed slab.',
      de: 'Eine 25 Jahre alte Karte, professionell mit 9 von 10 bewertet, in einer versiegelten Hülle.',
    },
    growType: 'income-growth',
    category: 'Seed · collectible',
    pattern: 'collectible, dead asset',
    strategy: 'Hold until a collector Harvest card names cards.',
    reasoning: 'Nostalgia and scarcity drive vintage prices.',
    risks: 'Hype cycles; fake slabs; hard to sell quickly.',
    riskScore: 3,
    insights: 'Value drivers: age, condition, rarity; liquidity is low compared with shares.',
    alternative: 'World ETF',
    alternativeCostMinor: 10000,
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
    actions: [
      {
        text: 'Verify the grading certificate online',
        priority: 'medium',
      },
      {
        text: 'Buy from reputable dealers',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    market: {
      tag: 'CARDS',
      lowMinor: 60,
      highMinor: 300,
      trend: 'multiplier on asset value',
    },
    costMinor: 80000,
    assetValueMinor: 80000,
  },
  {
    id: 'S24',
    pile: 'seed',
    title: {
      en: 'Silver Coins',
      de: 'Silbermünzen',
    },
    story: {
      en: 'Ten one-ounce silver coins in a tube, hidden in your sock drawer.',
      de: 'Zehn Ein-Unzen-Silbermünzen in einer Tube, versteckt in der Sockenschublade.',
    },
    growType: 'income-growth',
    category: 'Seed · metal',
    pattern: 'precious metal, dead asset',
    strategy: 'Hold as a crisis hedge; sell when a Harvest card brings a buyer at a high price.',
    reasoning: "Physical metal can't go to zero.",
    risks: 'No income; big price swings; dealer spreads; theft (check household insurance limits).',
    riskScore: 3,
    insights:
      'Silver traded at about €48 per ounce in October 2026; coins cost a premium above the metal price.',
    alternative: 'World ETF',
    alternativeCostMinor: 10000,
    links: [
      {
        label: 'gold.de – Goldpreis aktuell',
        url: 'https://www.gold.de/kurse/goldpreis/',
      },
    ],
    actions: [
      {
        text: 'Buy from established dealers',
        priority: 'medium',
      },
      {
        text: 'Keep receipts',
        priority: 'medium',
      },
      {
        text: 'Check household insurance limits for valuables',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    share: {
      ticker: 'SILVER',
      unitPriceMinor: 5500,
      maxUnits: 10,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'SILVER',
      lowMinor: 3500,
      highMinor: 8000,
      trend: 'volatile',
    },
  },
  {
    id: 'S25',
    pile: 'seed',
    title: {
      en: 'Gold Coin',
      de: 'Goldmünze',
    },
    story: {
      en: 'A tenth of an ounce of gold. Small enough to hold, old enough to trust.',
      de: 'Eine Zehntelunze Gold. Klein genug zum Festhalten, alt genug zum Vertrauen.',
    },
    growType: 'income-growth',
    category: 'Seed · metal',
    pattern: 'precious metal, dead asset',
    strategy: 'Buy in quiet times, sell in panic times (via Harvest).',
    reasoning: 'Gold has kept value over centuries and rises in crises.',
    risks: 'No income; small coins carry high premiums.',
    riskScore: 2,
    insights:
      'Gold was about €3,567 per ounce in October 2026, after +47% in 2025 and +34% in 2024 (in EUR).',
    alternative: 'Silver coins',
    alternativeCostMinor: 55000,
    links: [
      {
        label: 'gold.de – Goldpreis aktuell',
        url: 'https://www.gold.de/kurse/goldpreis/',
      },
    ],
    actions: [
      {
        text: 'Compare premiums for small vs. large coins',
        priority: 'medium',
      },
      {
        text: 'Store safely',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    share: {
      ticker: 'GOLD',
      unitPriceMinor: 40000,
      maxUnits: 5,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'GOLD',
      lowMinor: 32000,
      highMinor: 48000,
      trend: 'slow up, crisis spikes',
    },
  },
  {
    id: 'S26',
    pile: 'seed',
    title: {
      en: 'Retired LEGO Set',
      de: 'Eingestelltes LEGO-Set',
    },
    story: {
      en: 'A big set just went out of production. Sealed boxes often get more valuable.',
      de: 'Ein großes Set wird gerade nicht mehr produziert. Versiegelte Kartons werden oft wertvoller.',
    },
    growType: 'income-growth',
    category: 'Seed · collectible',
    pattern: 'sealed collectible',
    strategy: 'Keep sealed and dry; sell to a collector via Harvest.',
    reasoning: 'Retired popular sets become scarce.',
    risks: 'Damaged boxes lose value; not all sets rise.',
    riskScore: 2,
    insights: 'Value depends on condition and demand; storage space and patience needed.',
    alternative: 'Keep the money',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Store sealed, dry and dark',
        priority: 'medium',
      },
      {
        text: 'Track prices on resale platforms',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    market: {
      tag: 'COLLECT',
      lowMinor: 80,
      highMinor: 250,
      trend: 'multiplier on asset value',
    },
    costMinor: 20000,
    assetValueMinor: 20000,
  },
  {
    id: 'S27',
    pile: 'seed',
    title: {
      en: 'Limited Sneaker Drop',
      de: 'Limitierter Sneaker-Drop',
    },
    story: {
      en: 'You won the online raffle for a limited sneaker. The resale price is already double.',
      de: 'Du hast die Online-Verlosung für einen limitierten Sneaker gewonnen. Der Wiederverkaufspreis ist schon doppelt so hoch.',
    },
    growType: 'income-growth',
    category: 'Seed · collectible',
    pattern: 'resale flip',
    strategy: 'Flip quickly while hype lasts.',
    reasoning: 'Limited supply, hyped demand.',
    risks: 'Hype fades fast; fakes; fees on resale platforms.',
    riskScore: 3,
    insights: 'Resale margins depend on timing; prices often fall after the drop.',
    alternative: 'Keep the money',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Sell within a few weeks',
        priority: 'medium',
      },
      {
        text: 'Use platforms with authentication',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 22000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          oneTimeMinor: 18000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          oneTimeMinor: 38000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          oneTimeMinor: 70000,
        },
      },
    ],
  },
  {
    id: 'S28',
    pile: 'seed',
    title: {
      en: 'Start a YouTube Channel',
      de: 'YouTube-Kanal starten',
    },
    story: {
      en: 'A microphone, a ring light and a topic you love. Will anyone watch?',
      de: 'Ein Mikrofon, ein Ringlicht und ein Thema, das du liebst. Schaut das jemand?',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'content creation',
    strategy: 'Publish weekly for a year; niche topics (finance, tech) pay more per view.',
    reasoning: 'Once videos exist, they can earn for years.',
    risks: 'Most channels never reach monetisation; takes many hours.',
    riskScore: 3,
    insights:
      'YouTube Partner Programme needs 1,000 subscribers and 4,000 watch hours in 12 months; most channels earn about $2–5 per 1,000 views, finance up to $15.',
    alternative: 'Freelance gigs',
    alternativeCostMinor: 30000,
    links: [
      {
        label: 'Bluehost – Was verdient ein YouTuber?',
        url: 'https://www.bluehost.com/de-de/blog/wie-viel-geld-verdient-ein-youtuber-einblicke-und-einnahmen-im-ueberblick/',
      },
    ],
    actions: [
      {
        text: 'Pick a niche',
        priority: 'medium',
      },
      {
        text: 'Publish weekly for 12 months',
        priority: 'medium',
      },
      {
        text: 'Add affiliate links and sponsorships',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 60000,
    dice: [
      {
        from: 1,
        to: 3,
        value: {
          cashflowMinor: 0,
        },
      },
      {
        from: 4,
        to: 5,
        value: {
          cashflowMinor: 6000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 35000,
        },
      },
    ],
    sideHustle: true,
    rampPaydays: 3,
  },
  {
    id: 'S29',
    pile: 'seed',
    title: {
      en: 'Weekend IT Freelancing',
      de: 'IT-Freelancing am Wochenende',
    },
    story: {
      en: "A local business needs a website and a data dashboard. They'll pay well for your weekends.",
      de: 'Ein lokales Unternehmen braucht eine Website und ein Daten-Dashboard. Für deine Wochenenden zahlen sie gut.',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'freelance services',
    strategy: '6–8 billable hours a month; raise rates with experience.',
    reasoning: 'Your skills are worth money outside your job too.',
    risks: 'Needs employer permission (Nebentätigkeit); taxes and social insurance; time.',
    riskScore: 1,
    insights:
      'Freelancer-Kompass 2026: median IT freelance rate about €90/h for development and €100/h for data & analytics; €80/h for ages 20–30.',
    alternative: 'Tutoring',
    alternativeCostMinor: 5000,
    links: [
      {
        label: 'freelancermap – IT-Freelancer Stundensatz 2026',
        url: 'https://www.freelancermap.de/blog/stundensatz-it-freelancer/',
      },
    ],
    actions: [
      {
        text: 'Ask your employer for side-job permission',
        priority: 'medium',
      },
      {
        text: 'Register a small business',
        priority: 'medium',
      },
      {
        text: 'Set a minimum hourly rate',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 30000,
    cashflowMinor: 30000,
    sideHustle: true,
    note: 'After tax; scales with career: +50% from career stage 3.',
  },
  {
    id: 'S30',
    pile: 'seed',
    title: {
      en: 'Phone Flipping',
      de: 'Handys aufbereiten und verkaufen',
    },
    story: {
      en: 'Buy used phones, fix screens and batteries, sell them with a case and a smile.',
      de: 'Gebrauchte Handys kaufen, Display und Akku tauschen, mit Hülle und Lächeln weiterverkaufen.',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'refurb and resell',
    strategy: 'One or two phones a month; buy only models you know.',
    reasoning: 'Repair skills turn cheap broken phones into value.',
    risks: 'Hidden defects, stolen devices, warranty claims.',
    riskScore: 2,
    insights: 'Check IMEI against blacklists; commercial resale needs a business registration.',
    alternative: 'Weekend freelancing',
    alternativeCostMinor: 30000,
    links: [],
    actions: [
      {
        text: 'Check IMEI before buying',
        priority: 'medium',
      },
      {
        text: 'Keep a repair log',
        priority: 'medium',
      },
      {
        text: 'Register a small business',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 30000,
    dice: [
      {
        from: 1,
        to: 1,
        value: {
          cashflowMinor: 0,
        },
      },
      {
        from: 2,
        to: 4,
        value: {
          cashflowMinor: 6000,
        },
      },
      {
        from: 5,
        to: 6,
        value: {
          cashflowMinor: 12000,
        },
      },
    ],
    sideHustle: true,
  },
  {
    id: 'S31',
    pile: 'seed',
    title: {
      en: 'Tutoring',
      de: 'Nachhilfe geben',
    },
    story: {
      en: 'Two pupils, maths and computer science, Tuesday and Thursday evenings.',
      de: 'Zwei Schüler, Mathe und Informatik, Dienstag- und Donnerstagabend.',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'time for money',
    strategy: 'Group lessons pay more per hour.',
    reasoning: 'Low start cost, steady demand.',
    risks: 'Income stops when you stop; exam seasons only.',
    riskScore: 1,
    insights: 'Private tutoring commonly pays €20–35 per hour depending on level and city.',
    alternative: 'Weekend freelancing',
    alternativeCostMinor: 30000,
    links: [],
    actions: [
      {
        text: 'Post an ad at schools and online',
        priority: 'medium',
      },
      {
        text: 'Offer a free trial lesson',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 5000,
    cashflowMinor: 15000,
    sideHustle: true,
  },
  {
    id: 'S32',
    pile: 'seed',
    title: {
      en: 'Print-on-Demand Shop',
      de: 'Print-on-Demand-Shop',
    },
    story: {
      en: 'You design T-shirts; a printer ships them when someone orders.',
      de: 'Du entwirfst T-Shirts; eine Druckerei verschickt sie, wenn jemand bestellt.',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'online shop, no stock',
    strategy: 'Find a niche, make 30 designs, test ads with a small budget.',
    reasoning: 'No inventory; designs sell repeatedly.',
    risks: 'Huge competition; most shops sell little.',
    riskScore: 3,
    insights:
      'Platform and printing fees take most of the price; success depends on a niche audience.',
    alternative: 'Sell an e-book',
    alternativeCostMinor: 15000,
    links: [],
    actions: [
      {
        text: 'Research a niche',
        priority: 'medium',
      },
      {
        text: 'Create 30 designs before judging results',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 20000,
    dice: [
      {
        from: 1,
        to: 4,
        value: {
          cashflowMinor: 0,
        },
      },
      {
        from: 5,
        to: 5,
        value: {
          cashflowMinor: 4000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 20000,
        },
      },
    ],
    sideHustle: true,
  },
  {
    id: 'S33',
    pile: 'seed',
    title: {
      en: 'Sell Digital Templates',
      de: 'Digitale Vorlagen verkaufen',
    },
    story: {
      en: 'Your budget spreadsheet is better than anything online. Others might pay for it.',
      de: 'Deine Budget-Tabelle ist besser als alles im Netz. Andere würden dafür zahlen.',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'digital product',
    strategy: 'Build once, sell many times; improve with buyer feedback.',
    reasoning: 'Zero cost per extra sale.',
    risks: 'Discoverability; copycats.',
    riskScore: 2,
    insights: 'Digital products scale without inventory; marketing is the bottleneck.',
    alternative: 'Print-on-demand',
    alternativeCostMinor: 20000,
    links: [],
    actions: [
      {
        text: 'Validate demand with a free version',
        priority: 'medium',
      },
      {
        text: 'Collect reviews',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 15000,
    dice: [
      {
        from: 1,
        to: 3,
        value: {
          cashflowMinor: 500,
        },
      },
      {
        from: 4,
        to: 5,
        value: {
          cashflowMinor: 4000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 25000,
        },
      },
    ],
    sideHustle: true,
  },
  {
    id: 'S34',
    pile: 'seed',
    title: {
      en: 'Bike Courier Weekends',
      de: 'Fahrradkurier am Wochenende',
    },
    story: {
      en: 'Saturdays on your bike, delivering food across Munich.',
      de: 'Samstags mit dem Rad Essen durch München ausliefern.',
    },
    growType: 'income-growth',
    category: 'Seed · side hustle',
    pattern: 'gig work',
    strategy: 'Ride peak hours only.',
    reasoning: 'Start immediately with what you have.',
    risks: 'Accidents (see Emergencies), weather, low pay per hour.',
    riskScore: 2,
    insights: 'Gig platforms pay per order; earnings vary strongly by hour and city.',
    alternative: 'Tutoring',
    alternativeCostMinor: 5000,
    links: [],
    actions: [
      {
        text: 'Check insurance coverage while riding',
        priority: 'medium',
      },
      {
        text: 'Ride only peak hours',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 10000,
    cashflowMinor: 12000,
    sideHustle: true,
  },
  {
    id: 'S35',
    pile: 'seed',
    title: {
      en: 'Fixed-Term Deposit',
      de: 'Festgeld',
    },
    story: {
      en: 'Lock away money for a year at a guaranteed rate.',
      de: 'Geld für ein Jahr zu einem garantierten Zins festlegen.',
    },
    growType: 'income-growth',
    category: 'Seed · conservative',
    pattern: 'fixed deposit',
    strategy: "Use for money you surely won't need for a year (not your Mojo).",
    reasoning: 'Guaranteed interest, deposit protection.',
    risks: 'Locked for the term; inflation can eat the return.',
    riskScore: 0,
    insights:
      'October 2026: fixed deposits up to about 4.25% at the best offers, depending on term; protected up to €100,000 per bank.',
    alternative: 'High-interest savings account',
    alternativeCostMinor: 100000,
    links: [
      {
        label: 'Raisin – Zinsradar 10/2026',
        url: 'https://www.raisin.com/de-de/geldanlage/zinsradar/',
      },
    ],
    actions: [
      {
        text: 'Compare terms and protection country',
        priority: 'medium',
      },
      {
        text: 'Ladder several deposits',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 200000,
    cashflowMinor: 600,
    lockedPaydays: 12,
    note: 'Money locked for 12 Paydays, then returned.',
  },
  {
    id: 'S36',
    pile: 'seed',
    title: {
      en: 'Annual Contract Check',
      de: 'Jährlicher Vertragscheck',
    },
    story: {
      en: 'Once a year you check every contract: insurance, internet, gym. Two are overpriced.',
      de: 'Einmal im Jahr prüfst du jeden Vertrag: Versicherung, Internet, Fitnessstudio. Zwei sind zu teuer.',
    },
    growType: 'expense-insight',
    category: 'Seed · savings',
    pattern: 'annual contract review',
    strategy: 'Make it a yearly ritual; keep coverage, cut overpricing.',
    reasoning: 'Prices creep up quietly with each renewal.',
    risks: "Don't drop important insurance to save a few euros.",
    riskScore: 0,
    insights:
      'Liability and household insurance are cheap and essential (see the Emergency deck); overpricing is more common in bundled or old contracts.',
    alternative: 'Never check',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'List all contracts with renewal dates',
        priority: 'medium',
      },
      {
        text: 'Compare prices, not coverage cuts',
        priority: 'medium',
      },
    ],
    estimate: true,
    costMinor: 0,
    dice: [
      {
        from: 1,
        to: 3,
        value: {
          monthlySavingsMinor: 800,
        },
      },
      {
        from: 4,
        to: 6,
        value: {
          monthlySavingsMinor: 2000,
        },
      },
    ],
  },
  {
    id: 'P01',
    pile: 'sapling',
    title: {
      en: 'Negotiate Your Salary',
      de: 'Gehalt verhandeln',
    },
    story: {
      en: 'You prepared market data, your achievements and a number. Time to ask.',
      de: 'Du hast Marktdaten, deine Erfolge und eine Zahl vorbereitet. Zeit zu fragen.',
    },
    growType: 'income-growth',
    category: 'Sapling · career',
    pattern: 'raise',
    strategy: 'Ask after a big success; anchor high with market data.',
    reasoning: 'The biggest lever on cash flow is income.',
    risks: "A 'no' — but rarely worse.",
    riskScore: 1,
    insights:
      'Salary data (see Career track) show wide ranges per level; negotiation moves you within the range.',
    alternative: 'Wait for the yearly review',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Collect salary data for your role and city',
        priority: 'medium',
      },
      {
        text: 'List your results with numbers',
        priority: 'medium',
      },
      {
        text: 'Practise the conversation',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 30000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 0,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 10000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 25000,
        },
      },
    ],
    note: 'Cost = negotiation course/coaching. Raise is net.',
  },
  {
    id: 'P02',
    pile: 'sapling',
    title: {
      en: 'World ETF Lump Sum',
      de: 'ETF-Einmalanlage Welt',
    },
    story: {
      en: 'Your bonus arrived. You put it all into the world economy and close the app.',
      de: 'Dein Bonus ist da. Du steckst alles in die Weltwirtschaft und schließt die App.',
    },
    growType: 'income-growth',
    category: 'Sapling · conservative',
    pattern: 'index ETF lump sum',
    strategy: 'Invest at once (statistically beats waiting), then hold.',
    reasoning: 'Time in the market beats timing the market.',
    risks: 'A crash right after buying hurts; must hold for years.',
    riskScore: 2,
    insights:
      'Long-term MSCI World return roughly 7–8% a year; interim losses of 30–50% should be expected.',
    alternative: 'High-interest savings',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'zendepot – MSCI World Rendite',
        url: 'https://zendepot.de/etf/msci-world-rendite',
      },
    ],
    actions: [
      {
        text: 'Check your Mojo is full first',
        priority: 'medium',
      },
      {
        text: "Buy, then don't touch for 10 years",
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'WORLD',
      unitPriceMinor: 10000,
      maxUnits: 150,
      dividendMonthPerUnitMinor: 15,
      yieldYearPercent: 1.8,
    },
    market: {
      tag: 'WORLD',
      lowMinor: 6000,
      highMinor: 14000,
      trend: 'slow up',
    },
  },
  {
    id: 'P03',
    pile: 'sapling',
    title: {
      en: 'Emerging Markets ETF',
      de: 'Schwellenländer-ETF',
    },
    story: {
      en: 'India, Brazil, Indonesia: faster growth, wilder rides.',
      de: 'Indien, Brasilien, Indonesien: schnelleres Wachstum, wildere Fahrten.',
    },
    growType: 'income-growth',
    category: 'Sapling · growth',
    pattern: 'regional ETF',
    strategy: 'Add 10–20% to a world ETF for more growth exposure.',
    reasoning: 'Younger populations and growing middle classes.',
    risks: 'Political risk, currency swings, long periods of underperformance.',
    riskScore: 3,
    insights: 'Emerging markets can lag developed markets for a decade.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Keep it a minority share',
        priority: 'medium',
      },
      {
        text: 'Rebalance yearly',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'EMERG',
      unitPriceMinor: 4000,
      maxUnits: 200,
      dividendMonthPerUnitMinor: 7,
      yieldYearPercent: 2.1,
    },
    market: {
      tag: 'EMERG',
      lowMinor: 2200,
      highMinor: 6500,
      trend: 'volatile',
    },
  },
  {
    id: 'P04',
    pile: 'sapling',
    title: {
      en: 'European REIT',
      de: 'Europäischer REIT',
    },
    story: {
      en: 'Own a sliver of shopping centres, warehouses and offices — and collect rent as dividends.',
      de: 'Besitze einen Hauch von Einkaufszentren, Lagerhallen und Büros — und kassiere Miete als Dividende.',
    },
    growType: 'income-growth',
    category: 'Sapling · dividend',
    pattern: 'listed real estate',
    strategy: 'Real estate exposure without a mortgage.',
    reasoning: 'REITs must pay out most of their income.',
    risks: 'Sensitive to interest rates; office vacancy.',
    riskScore: 3,
    insights: 'Listed real estate typically yields 4–6% but fell sharply when rates rose.',
    alternative: 'Rental flat (Tree)',
    alternativeCostMinor: 4000000,
    links: [],
    actions: [
      {
        text: 'Check what properties the REIT owns',
        priority: 'medium',
      },
      {
        text: 'Watch interest rate news',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'REIT',
      unitPriceMinor: 2500,
      maxUnits: 400,
      dividendMonthPerUnitMinor: 10,
      yieldYearPercent: 4.8,
    },
    market: {
      tag: 'REIT',
      lowMinor: 1500,
      highMinor: 3500,
      trend: 'rate-sensitive',
    },
  },
  {
    id: 'P05',
    pile: 'sapling',
    title: {
      en: 'High-Income Covered-Call ETF',
      de: 'Covered-Call-ETF mit hoher Ausschüttung',
    },
    story: {
      en: 'It promises 9% a year in payouts. The fine print explains where it comes from.',
      de: 'Er verspricht 9 % Ausschüttung pro Jahr. Das Kleingedruckte erklärt, woher das kommt.',
    },
    growType: 'income-growth',
    category: 'Sapling · dividend',
    pattern: 'option-income ETF',
    strategy: 'Only for income seekers who accept capped upside.',
    reasoning: 'Sells call options for premium income.',
    risks: 'Gives up most upside; unit price tends to erode over time.',
    riskScore: 3,
    insights: 'High payout is partly paid by capped gains; total return often lags a plain index.',
    alternative: 'Dividend ETF',
    alternativeCostMinor: 300000,
    links: [],
    actions: [
      {
        text: 'Compare total return, not payout',
        priority: 'medium',
      },
      {
        text: 'Read the strategy description',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'CCALL',
      unitPriceMinor: 2000,
      maxUnits: 500,
      dividendMonthPerUnitMinor: 15,
      yieldYearPercent: 9.0,
    },
    market: {
      tag: 'CCALL',
      lowMinor: 1400,
      highMinor: 2200,
      trend: 'slow erosion',
    },
  },
  {
    id: 'P06',
    pile: 'sapling',
    title: {
      en: 'SolarWind Energy',
      de: 'SolarWind Energie',
    },
    story: {
      en: 'A renewable energy company riding the energy transition. Politics can lift it or crush it.',
      de: 'Ein Erneuerbare-Energien-Unternehmen auf der Welle der Energiewende. Politik kann es heben oder zerdrücken.',
    },
    growType: 'income-growth',
    category: 'Sapling · growth',
    pattern: 'thematic stock',
    strategy: 'Small position; sell part into hype.',
    reasoning: 'Long-term demand for clean energy.',
    risks: 'Subsidy changes, interest rates, competition.',
    riskScore: 4,
    insights: 'Thematic stocks often boom and bust with policy news.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Limit position size',
        priority: 'medium',
      },
      {
        text: 'Follow policy news',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'SOLW',
      unitPriceMinor: 4000,
      maxUnits: 200,
      dividendMonthPerUnitMinor: 2,
      yieldYearPercent: 0.6,
    },
    market: {
      tag: 'SOLW',
      lowMinor: 1200,
      highMinor: 11000,
      trend: 'volatile',
    },
  },
  {
    id: 'P07',
    pile: 'sapling',
    title: {
      en: 'NeuroChip at All-Time High',
      de: 'NeuroChip auf Allzeithoch',
    },
    story: {
      en: 'Everyone talks about the AI chip maker. It already tripled this year.',
      de: 'Alle reden über den KI-Chiphersteller. Er hat sich dieses Jahr schon verdreifacht.',
    },
    growType: 'income-growth',
    category: 'Sapling · speculative',
    pattern: 'hype stock',
    strategy: 'If you buy, decide your exit before you enter.',
    reasoning: 'Real growth — but much is priced in.',
    risks: 'Buying at the top of a hype; 50% drops possible.',
    riskScore: 4,
    insights: 'Late buyers in hype cycles often carry the losses.',
    alternative: 'World ETF (already contains it)',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Set a stop or sell rule',
        priority: 'medium',
      },
      {
        text: 'Remember: the world ETF already holds it',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'NCHIP',
      unitPriceMinor: 50000,
      maxUnits: 20,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'NCHIP',
      lowMinor: 15000,
      highMinor: 120000,
      trend: 'volatile',
    },
  },
  {
    id: 'P08',
    pile: 'sapling',
    title: {
      en: 'Altcoin Basket',
      de: 'Altcoin-Korb',
    },
    story: {
      en: "Ten smaller cryptocurrencies at once. One might be the next big thing; most won't.",
      de: 'Zehn kleinere Kryptowährungen auf einmal. Eine könnte das nächste große Ding sein; die meisten nicht.',
    },
    growType: 'income-growth',
    category: 'Sapling · crypto',
    pattern: 'speculative crypto basket',
    strategy: 'Tiny share of portfolio; take profits in manias.',
    reasoning: 'Diversification inside a high-risk class.',
    risks: 'Most altcoins lose 90%+ over a cycle; scams among them.',
    riskScore: 5,
    insights: 'Crypto scams reached at least $14 billion in 2025 (Chainalysis).',
    alternative: 'Bitcoin slice',
    alternativeCostMinor: 50000,
    links: [
      {
        label: 'Chainalysis: crypto scams $14B in 2025',
        url: 'https://letsdatascience.com/news/chainalysis-reports-crypto-scams-reach-14b-ac5eeabb',
      },
    ],
    actions: [
      {
        text: 'Only money you can lose',
        priority: 'medium',
      },
      {
        text: 'Take profits when it doubles',
        priority: 'medium',
      },
    ],
    kind: 'share',
    share: {
      ticker: 'ALT10',
      unitPriceMinor: 10000,
      maxUnits: 30,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'ALT10',
      lowMinor: 1000,
      highMinor: 80000,
      trend: 'extreme',
    },
  },
  {
    id: 'P09',
    pile: 'sapling',
    title: {
      en: '40% APY Yield Farm',
      de: 'Yield Farm mit 40 % Rendite',
    },
    story: {
      en: "A new DeFi protocol pays 40% a year for providing liquidity. Audit 'coming soon'.",
      de: "Ein neues DeFi-Protokoll zahlt 40 % im Jahr für Liquidität. Audit 'kommt bald'.",
    },
    growType: 'income-growth',
    category: 'Sapling · crypto',
    pattern: 'DeFi liquidity pool',
    strategy: 'Provide liquidity, harvest rewards, compound weekly.',
    reasoning: 'Liquidity providers earn trading fees and reward tokens.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 4,
    insights:
      'DeFi yields come from fees and newly minted reward tokens; audits by independent firms are a common quality check.',
    alternative: 'Ether staking (~3%)',
    alternativeCostMinor: 30000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [
      {
        text: 'Check for independent audits',
        priority: 'medium',
      },
      {
        text: 'Ask where the yield comes from',
        priority: 'medium',
      },
    ],
    kind: 'investment',
    costMinor: 300000,
    trap: {
      trueCategory: 'scam',
      ponzi: {
        paysMonthMinor: 10000,
        paysPaydays: 3,
        then: 'exploitRoll',
      },
    },
  },
  {
    id: 'P10',
    pile: 'sapling',
    title: {
      en: 'Startup Crowdfunding Ticket',
      de: 'Startup-Crowdfunding',
    },
    story: {
      en: "A local startup sells small stakes online. Pitch deck: 'the Uber for dog walking'.",
      de: "Ein lokales Startup verkauft kleine Anteile online. Pitch: 'das Uber fürs Gassigehen'.",
    },
    growType: 'income-growth',
    category: 'Sapling · speculative',
    pattern: 'venture stake',
    strategy: 'Spread over many startups if at all.',
    reasoning: 'One big winner can pay for many failures.',
    risks: "Most startups fail; shares can't be sold for years.",
    riskScore: 5,
    insights: 'Venture returns are extremely skewed: most fail, a few return many times the money.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Read the risk disclosure',
        priority: 'medium',
      },
      {
        text: 'Never more than you can lose',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'STARTUP',
      unitPriceMinor: 50000,
      maxUnits: 10,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'STARTUP',
      lowMinor: 0,
      highMinor: 2500000,
      trend: 'most fail, rare exit',
    },
  },
  {
    id: 'P11',
    pile: 'sapling',
    title: {
      en: 'P2P Lending',
      de: 'P2P-Kredite',
    },
    story: {
      en: 'A platform shows 11% returns on consumer loans in Eastern Europe.',
      de: 'Eine Plattform zeigt 11 % Rendite auf Konsumkredite in Osteuropa.',
    },
    growType: 'income-growth',
    category: 'Sapling · lending',
    pattern: 'peer-to-peer loans',
    strategy: "Spread across many loans; treat 'buyback guarantees' as marketing.",
    reasoning: 'High interest from borrowers.',
    risks:
      'Defaults, platform or originator insolvency, fraud, illiquidity; no deposit protection.',
    riskScore: 4,
    insights:
      'Platforms advertise ~6–12%; Envestio and Kuetzal collapsed in 2020; Estateguru had about two-thirds of its portfolio in recovery in mid-2026.',
    alternative: 'Fixed deposit',
    alternativeCostMinor: 200000,
    links: [
      {
        label: 'etf.capital – P2P-Kredite 2026',
        url: 'https://etf.capital/p2p-kredite-geldanlage-2026/',
      },
    ],
    actions: [
      {
        text: 'Check licence and regulator',
        priority: 'medium',
      },
      {
        text: 'Spread over many loans',
        priority: 'medium',
      },
      {
        text: 'Keep it a small share',
        priority: 'medium',
      },
    ],
    kind: 'investment',
    costMinor: 500000,
    cashflowMinor: 3500,
    eachPayday: [
      {
        from: 1,
        to: 1,
        value: {
          capitalLossPercent: 10,
        },
      },
      {
        from: 2,
        to: 6,
        value: {},
      },
    ],
  },
  {
    id: 'P12',
    pile: 'sapling',
    title: {
      en: '100 g Gold Bar',
      de: '100-g-Goldbarren',
    },
    story: {
      en: 'A small, heavy bar in a safe deposit box.',
      de: 'Ein kleiner, schwerer Barren im Schließfach.',
    },
    growType: 'income-growth',
    category: 'Sapling · metal',
    pattern: 'precious metal, dead asset',
    strategy: 'Crisis insurance; sell into a gold rush Harvest card.',
    reasoning: 'Bars have lower premiums than small coins.',
    risks: 'No income; storage cost; price falls in calm times.',
    riskScore: 2,
    insights: 'At about €3,567/oz (Oct 2026), 100 g of gold is worth about €11,500.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'gold.de – Goldpreis aktuell',
        url: 'https://www.gold.de/kurse/goldpreis/',
      },
    ],
    actions: [
      {
        text: 'Buy LBMA-certified bars',
        priority: 'medium',
      },
      {
        text: 'Rent a safe deposit box',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    share: {
      ticker: 'GOLD100',
      unitPriceMinor: 1180000,
      maxUnits: 1,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'GOLD',
      lowMinor: 950000,
      highMinor: 1450000,
      trend: 'slow up, crisis spikes',
    },
    monthlyCostMinor: 800,
    note: 'Safe deposit box ~8 TT/month.',
  },
  {
    id: 'P13',
    pile: 'sapling',
    title: {
      en: 'Fine Wine Case',
      de: 'Kiste edler Wein',
    },
    story: {
      en: 'A case of a top Bordeaux vintage, stored in a bonded warehouse.',
      de: 'Eine Kiste eines Spitzen-Bordeaux-Jahrgangs, gelagert in einem Zolllager.',
    },
    growType: 'income-growth',
    category: 'Sapling · collectible',
    pattern: 'alternative asset',
    strategy: 'Hold 5–10 years; sell to a collector via Harvest.',
    reasoning: 'Great vintages get scarcer as people drink them.',
    risks: 'Storage fees, fakes, illiquid market, provenance.',
    riskScore: 3,
    insights: 'Investment-grade wine requires professional storage and documented provenance.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Buy with provenance documents',
        priority: 'medium',
      },
      {
        text: 'Use bonded storage',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    market: {
      tag: 'COLLECT',
      lowMinor: 70,
      highMinor: 220,
      trend: 'multiplier on asset value',
    },
    costMinor: 300000,
    assetValueMinor: 300000,
    monthlyCostMinor: 500,
  },
  {
    id: 'P14',
    pile: 'sapling',
    title: {
      en: 'Luxury Watch to Resell',
      de: 'Luxusuhr zum Wiederverkauf',
    },
    story: {
      en: 'A steel sports watch with a long waiting list. You got one at list price.',
      de: 'Eine Stahl-Sportuhr mit langer Warteliste. Du hast eine zum Listenpreis bekommen.',
    },
    growType: 'income-growth',
    category: 'Sapling · collectible',
    pattern: 'resale flip',
    strategy: 'Sell when grey-market prices peak.',
    reasoning: 'Demand above supply for some models.',
    risks: 'Grey-market prices fell after 2022; theft; fakes.',
    riskScore: 3,
    insights:
      'Waiting-list models traded above list price, but premiums shrank sharply after the 2022 peak.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Keep box and papers',
        priority: 'medium',
      },
      {
        text: 'Insure as valuables',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    market: {
      tag: 'COLLECT',
      lowMinor: 80,
      highMinor: 160,
      trend: 'multiplier on asset value',
    },
    costMinor: 900000,
    assetValueMinor: 900000,
  },
  {
    id: 'P15',
    pile: 'sapling',
    title: {
      en: 'Snack Vending Machine',
      de: 'Snackautomat',
    },
    story: {
      en: 'A modern vending machine with card payment, placed in a busy office building.',
      de: 'Ein moderner Automat mit Kartenzahlung, aufgestellt in einem belebten Bürogebäude.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'vending',
    strategy: 'Location is everything; restock with telemetry.',
    reasoning: 'Sells while you sleep once the location works.',
    risks: 'Bad location, vandalism, location rent, your time.',
    riskScore: 3,
    insights:
      'One operator reported €80–150 sales per day as normal, goods ~45% and running costs ~10% of revenue, about 15–30 minutes of restocking a day; suggested starting capital ~€20,000 (or ~€5,000 with financing).',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'getquin – Erfahrungsbericht Automaten-Business',
        url: 'https://app.getquin.com/de/post/kJiXqaBssQ/hier-mal-ein-kleines-update-zu-meinen-erfahrung-im-automaten-business',
      },
    ],
    actions: [
      {
        text: 'Secure a location contract first',
        priority: 'medium',
      },
      {
        text: 'Check telemetry and card payment',
        priority: 'medium',
      },
      {
        text: 'Plan restocking routes',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 500000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 10000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 45000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 90000,
        },
      },
    ],
    loan: {
      loanMinor: 800000,
      paymentMonthMinor: 25000,
    },
    sideHustle: true,
    note: 'Cash flow after loan payment, goods and location rent; before your time.',
  },
  {
    id: 'P16',
    pile: 'sapling',
    title: {
      en: 'Underground Parking Space',
      de: 'Tiefgaragenstellplatz',
    },
    story: {
      en: 'A parking space in a Munich building. Tenants queue for it.',
      de: 'Ein Tiefgaragenplatz in einem Münchner Haus. Mieter stehen Schlange.',
    },
    growType: 'income-growth',
    category: 'Sapling · property',
    pattern: 'parking space rental',
    strategy: 'Buy in dense areas with few spaces; rent all-inclusive.',
    reasoning: 'Low maintenance, simple tenants.',
    risks: "New car parks nearby; owners' association costs; illiquid.",
    riskScore: 2,
    insights:
      'Underground spaces in western Munich cost from under €10,000 to over €30,000 (ImmoScout24 via biallo); consumer advocates see garages as a niche add-on.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'biallo – Garagen als Geldanlage',
        url: 'https://www.biallo.de/bauen/news/garagen-als-geldanlage/',
      },
      {
        label: 'finanz.de – Grunderwerbsteuer Bayern',
        url: 'https://www.finanz.de/steuern/grunderwerbsteuer/bayern/',
      },
    ],
    actions: [
      {
        text: 'Check local parking demand',
        priority: 'medium',
      },
      {
        text: "Read the owners' association minutes",
        priority: 'medium',
      },
    ],
    kind: 'investment',
    costMinor: 2400000,
    cashflowMinor: 10500,
    note: 'Price 22,000 + ~8% side costs; rent 120/month minus ~15 costs.',
  },
  {
    id: 'P17',
    pile: 'sapling',
    title: {
      en: 'Rent Out a Room',
      de: 'Ein Zimmer untervermieten',
    },
    story: {
      en: 'Your second room becomes a furnished room for interns.',
      de: 'Dein zweites Zimmer wird ein möbliertes Zimmer für Praktikanten.',
    },
    growType: 'income-growth',
    category: 'Sapling · property',
    pattern: 'sublet',
    strategy:
      'Long-term furnished sublet with landlord permission (no short-term tourist rentals).',
    reasoning: 'Turns unused space into income.',
    risks:
      'Landlord permission required; short-term rentals restricted in Munich; flatmate trouble.',
    riskScore: 2,
    insights:
      "Subletting needs the landlord's permission; cities like Munich restrict short-term holiday rentals.",
    alternative: 'Keep the room',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'Ask the landlord in writing',
        priority: 'medium',
      },
      {
        text: 'Use a written sublet contract',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 150000,
    cashflowMinor: 35000,
    requires: {
      home: 'own_flat',
    },
  },
  {
    id: 'P18',
    pile: 'sapling',
    title: {
      en: 'Freelance Data Consulting',
      de: 'Freelance-Datenberatung',
    },
    story: {
      en: 'A mid-sized company wants you two days a month to build their reporting.',
      de: 'Ein Mittelständler will dich zwei Tage im Monat für sein Reporting.',
    },
    growType: 'income-growth',
    category: 'Sapling · side hustle',
    pattern: 'consulting',
    strategy: 'Two days a month at market rates; deliver, document, get referrals.',
    reasoning: 'Your career skills sold directly.',
    risks: 'Employer permission; taxes and health insurance; burnout.',
    riskScore: 2,
    insights: 'Freelancer-Kompass 2026: data & analytics median €100/h.',
    alternative: 'Negotiate salary',
    alternativeCostMinor: 30000,
    links: [
      {
        label: 'freelancermap – IT-Freelancer Stundensatz 2026',
        url: 'https://www.freelancermap.de/blog/stundensatz-it-freelancer/',
      },
    ],
    actions: [
      {
        text: 'Get written employer permission',
        priority: 'medium',
      },
      {
        text: 'Set up invoicing and tax',
        priority: 'medium',
      },
      {
        text: 'Ask for testimonials',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 300000,
    cashflowMinor: 90000,
    sideHustle: true,
    requires: {
      careerStage: 3,
    },
    note: '≈16 h × 100 €/h gross, after tax and costs.',
  },
  {
    id: 'P19',
    pile: 'sapling',
    title: {
      en: 'Create an Online Course',
      de: 'Online-Kurs erstellen',
    },
    story: {
      en: "'SQL for Marketing People' — 40 videos recorded over three months.",
      de: "'SQL für Marketing-Leute' — 40 Videos, aufgenommen in drei Monaten.",
    },
    growType: 'income-growth',
    category: 'Sapling · side hustle',
    pattern: 'digital product',
    strategy: 'Validate with a waitlist, record, sell on a platform and your own site.',
    reasoning: 'Teach once, sell for years.',
    risks: 'Platforms take big cuts; topic can date quickly.',
    riskScore: 3,
    insights: 'Beginner course sellers often earn a few hundred a month; a few earn much more.',
    alternative: 'YouTube channel',
    alternativeCostMinor: 60000,
    links: [
      {
        label: 'Bluehost – Was verdient ein YouTuber?',
        url: 'https://www.bluehost.com/de-de/blog/wie-viel-geld-verdient-ein-youtuber-einblicke-und-einnahmen-im-ueberblick/',
      },
    ],
    actions: [
      {
        text: 'Build a waitlist first',
        priority: 'medium',
      },
      {
        text: 'Record a free mini-course',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    costMinor: 300000,
    dice: [
      {
        from: 1,
        to: 3,
        value: {
          cashflowMinor: 3000,
        },
      },
      {
        from: 4,
        to: 5,
        value: {
          cashflowMinor: 20000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 80000,
        },
      },
    ],
    sideHustle: true,
    rampPaydays: 3,
  },
  {
    id: 'P20',
    pile: 'sapling',
    title: {
      en: 'Buy a Small Online Shop',
      de: 'Kleinen Onlineshop kaufen',
    },
    story: {
      en: 'An established shop for climbing chalk bags is for sale: profitable, but the owner is tired.',
      de: 'Ein etablierter Shop für Kletter-Chalkbags steht zum Verkauf: profitabel, aber der Besitzer ist müde.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'acquire a business',
    strategy: 'Pay 2–3× annual profit; check numbers; improve marketing.',
    reasoning: 'Buying an existing profit is less risky than starting from zero.',
    risks: 'Overstated numbers; dependence on one platform or supplier.',
    riskScore: 3,
    insights:
      'Small online businesses typically sell for a multiple of annual profit; due diligence is key.',
    alternative: 'Start your own shop',
    alternativeCostMinor: 20000,
    links: [],
    actions: [
      {
        text: 'Verify 24 months of sales data',
        priority: 'medium',
      },
      {
        text: 'Check supplier contracts',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 1500000,
    cashflowMinor: 45000,
    onBuy: [
      {
        from: 1,
        to: 1,
        value: {
          cashflowMinor: 15000,
        },
      },
      {
        from: 2,
        to: 6,
        value: {},
      },
    ],
    sideHustle: true,
  },
  {
    id: 'P21',
    pile: 'sapling',
    title: {
      en: 'SaaS Side Project',
      de: 'SaaS-Nebenprojekt',
    },
    story: {
      en: 'A small tool that turns bank CSVs into budget charts. Hosting is cheap; customers are not.',
      de: 'Ein kleines Tool, das Bank-CSVs in Budget-Diagramme verwandelt. Hosting ist billig; Kunden sind es nicht.',
    },
    growType: 'income-growth',
    category: 'Sapling · side hustle',
    pattern: 'software product',
    strategy: 'Solve one painful problem; charge from day one.',
    reasoning: 'Recurring revenue with near-zero marginal cost.',
    risks: 'Most side projects never find paying customers.',
    riskScore: 4,
    insights: 'Software has extreme outcomes: most earn nothing, a few become businesses.',
    alternative: 'Freelancing',
    alternativeCostMinor: 30000,
    links: [],
    actions: [
      {
        text: 'Talk to 20 potential users first',
        priority: 'medium',
      },
      {
        text: 'Charge from day one',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 400000,
    dice: [
      {
        from: 1,
        to: 3,
        value: {
          cashflowMinor: -2000,
        },
      },
      {
        from: 4,
        to: 5,
        value: {
          cashflowMinor: 15000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 150000,
        },
      },
    ],
    sideHustle: true,
    rampPaydays: 4,
  },
  {
    id: 'P22',
    pile: 'sapling',
    title: {
      en: 'Used Food Truck',
      de: 'Gebrauchter Foodtruck',
    },
    story: {
      en: 'A fully equipped truck, a burrito recipe and weekend markets.',
      de: 'Ein voll ausgestatteter Truck, ein Burrito-Rezept und Wochenendmärkte.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'mobile food business',
    strategy: 'Events and markets on weekends; build a following.',
    reasoning: 'Lower start cost than a restaurant.',
    risks: 'Permits, weather, long hours, breakdowns.',
    riskScore: 4,
    insights: 'Food businesses need hygiene certification and permits for each location.',
    alternative: 'Vending machine',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Get hygiene certificate',
        priority: 'medium',
      },
      {
        text: 'Apply for market permits',
        priority: 'medium',
      },
      {
        text: 'Test the recipe at events',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 800000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 10000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 70000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 150000,
        },
      },
    ],
    loan: {
      loanMinor: 2000000,
      paymentMonthMinor: 38000,
    },
    sideHustle: true,
  },
  {
    id: 'P23',
    pile: 'sapling',
    title: {
      en: 'Photo Booth Rental',
      de: 'Fotobox-Verleih',
    },
    story: {
      en: 'A photo booth you rent out for weddings and company parties.',
      de: 'Eine Fotobox, die du für Hochzeiten und Firmenfeiern vermietest.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'equipment rental',
    strategy: 'Wedding season bookings; partner with venues.',
    reasoning: 'Equipment earns on weekends.',
    risks: 'Seasonal; competition; transport.',
    riskScore: 2,
    insights: 'Event rentals depend on bookings in wedding season.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Partner with wedding venues',
        priority: 'medium',
      },
      {
        text: 'Collect reviews',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 600000,
    cashflowMinor: 22000,
    sideHustle: true,
  },
  {
    id: 'P24',
    pile: 'sapling',
    title: {
      en: 'E-Bike Rental Fleet',
      de: 'E-Bike-Verleih',
    },
    story: {
      en: 'Five e-bikes for tourists at the lake in summer.',
      de: 'Fünf E-Bikes für Touristen am See im Sommer.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'rental fleet',
    strategy: 'Partner with a hotel; maintain bikes well.',
    reasoning: 'Tourist demand in summer.',
    risks: 'Theft (see Emergencies), seasonality, insurance.',
    riskScore: 3,
    insights: 'Rental fleets need insurance and maintenance; income concentrates in summer.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Partner with a hotel',
        priority: 'medium',
      },
      {
        text: 'Insure the fleet',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 1200000,
    cashflowMinor: 33000,
    sideHustle: true,
  },
  {
    id: 'P25',
    pile: 'sapling',
    title: {
      en: 'Community Solar Share',
      de: 'Bürgersolar-Anteil',
    },
    story: {
      en: "Your town's energy cooperative builds a solar park. Members get a share of the income.",
      de: 'Die Energiegenossenschaft deiner Stadt baut einen Solarpark. Mitglieder bekommen einen Teil der Erträge.',
    },
    growType: 'income-growth',
    category: 'Sapling · energy',
    pattern: 'cooperative stake',
    strategy: 'Long-term hold for steady, modest income.',
    reasoning: 'Feed-in income from a real asset.',
    risks: 'Long lock-up; modest returns; project risk.',
    riskScore: 2,
    insights:
      'Energy cooperatives typically pay modest annual dividends; shares are hard to sell early.',
    alternative: 'Bond ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: "Read the cooperative's statutes",
        priority: 'medium',
      },
      {
        text: 'Check past dividends',
        priority: 'medium',
      },
    ],
    kind: 'investment',
    estimate: true,
    costMinor: 500000,
    cashflowMinor: 1500,
    lockedPaydays: 24,
  },
  {
    id: 'P26',
    pile: 'sapling',
    title: {
      en: 'Car for Car Sharing',
      de: 'Auto fürs Carsharing',
    },
    story: {
      en: 'A used compact car listed on a peer-to-peer car-sharing app.',
      de: 'Ein gebrauchter Kleinwagen in einer Privat-Carsharing-App.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'asset rental',
    strategy: 'Price competitively; keep it clean and serviced.',
    reasoning: 'A car earns instead of standing still.',
    risks: 'Damage, wear, insurance, depreciation. Sets car: true (car Emergencies).',
    riskScore: 3,
    insights:
      'Running costs of a small car are about €350–450/month all-in; rental income must beat that.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: "Check the platform's insurance",
        priority: 'medium',
      },
      {
        text: 'Calculate full running costs',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 800000,
    cashflowMinor: 12000,
    sideHustle: true,
    setsCar: true,
  },
  {
    id: 'P27',
    pile: 'sapling',
    title: {
      en: 'Self-Storage Container',
      de: 'Self-Storage-Container',
    },
    story: {
      en: 'A shipping container on a rented plot, sublet as storage space.',
      de: 'Ein Seecontainer auf einem gemieteten Grundstück, als Lagerraum vermietet.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'storage rental',
    strategy: 'Put containers where flats are small and storage is scarce.',
    reasoning: 'Cities are short on storage.',
    risks: 'Plot lease, permits, theft.',
    riskScore: 2,
    insights: 'Storage demand is high in dense cities with small flats.',
    alternative: 'Parking space',
    alternativeCostMinor: 2400000,
    links: [],
    actions: [
      {
        text: 'Check zoning',
        priority: 'medium',
      },
      {
        text: 'Secure the plot lease',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 700000,
    cashflowMinor: 11000,
  },
  {
    id: 'P28',
    pile: 'sapling',
    title: {
      en: 'Consolidate Your Debt',
      de: 'Schulden umschulden',
    },
    story: {
      en: 'Your overdraft charges 12%. A personal loan costs 6%.',
      de: 'Dein Dispo kostet 12 %. Ein Ratenkredit kostet 6 %.',
    },
    growType: 'budget-optimization',
    category: 'Sapling · savings',
    pattern: 'refinance',
    strategy: 'Replace expensive debt with cheaper debt, then pay it down fast.',
    reasoning: 'Interest is a guaranteed negative return.',
    risks: 'Running the overdraft up again.',
    riskScore: 1,
    insights: 'Overdraft rates are typically far above instalment loan rates.',
    alternative: 'Keep the overdraft',
    alternativeCostMinor: 0,
    links: [],
    actions: [
      {
        text: 'List all debts with interest rates',
        priority: 'medium',
      },
      {
        text: 'Pay the most expensive first',
        priority: 'medium',
      },
    ],
    estimate: true,
    costMinor: 0,
    savingsFormulaPercentOfDebt: 6,
    requires: {
      debtMinor: 100000,
    },
  },
  {
    id: 'P29',
    pile: 'sapling',
    title: {
      en: 'Laundry Pick-Up Service',
      de: 'Wäscheservice mit Abholung',
    },
    story: {
      en: 'Busy professionals pay you to pick up, wash and return their laundry.',
      de: 'Vielbeschäftigte zahlen dich dafür, ihre Wäsche abzuholen, zu waschen und zurückzubringen.',
    },
    growType: 'income-growth',
    category: 'Sapling · small business',
    pattern: 'service business',
    strategy: 'Start in one district with a partner laundry.',
    reasoning: 'Time-poor customers pay for convenience.',
    risks: 'Logistics, staff, low margins.',
    riskScore: 3,
    insights: 'Service businesses scale with customers but need reliable operations.',
    alternative: 'Vending machine',
    alternativeCostMinor: 500000,
    links: [],
    actions: [
      {
        text: 'Partner with a laundry',
        priority: 'medium',
      },
      {
        text: 'Start with 10 customers',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 400000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 5000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 30000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 70000,
        },
      },
    ],
    sideHustle: true,
  },
  {
    id: 'P30',
    pile: 'sapling',
    title: {
      en: 'Bond Ladder',
      de: 'Anleihen-Leiter',
    },
    story: {
      en: 'Five bonds maturing one after another, each paying fixed interest.',
      de: 'Fünf Anleihen, die nacheinander fällig werden, jede mit festem Zins.',
    },
    growType: 'income-growth',
    category: 'Sapling · conservative',
    pattern: 'bond ladder',
    strategy: 'Reinvest each maturing bond at the long end.',
    reasoning: 'Predictable income and known end values.',
    risks: 'Issuer risk for corporate bonds; inflation.',
    riskScore: 1,
    insights: 'With the ECB deposit rate at 2.50%, high-quality bonds yield roughly 2.5–3.5%.',
    alternative: 'Fixed deposit',
    alternativeCostMinor: 200000,
    links: [
      {
        label: 'Raisin – Zinsradar 10/2026',
        url: 'https://www.raisin.com/de-de/geldanlage/zinsradar/',
      },
    ],
    actions: [
      {
        text: 'Prefer investment-grade issuers',
        priority: 'medium',
      },
      {
        text: 'Spread maturities over 5 years',
        priority: 'medium',
      },
    ],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'BLADDER',
      unitPriceMinor: 100000,
      maxUnits: 10,
      dividendMonthPerUnitMinor: 250,
      yieldYearPercent: 3.0,
    },
    market: {
      tag: 'BUND',
      lowMinor: 95000,
      highMinor: 105000,
      trend: 'flat',
    },
  },
  {
    id: 'P31',
    pile: 'sapling',
    title: {
      en: 'Rare Card Collection',
      de: 'Seltene Kartensammlung',
    },
    story: {
      en: 'A collector sells his whole binder of early-edition cards — unchecked.',
      de: 'Ein Sammler verkauft seinen ganzen Ordner mit Erstausgaben — ungeprüft.',
    },
    growType: 'income-growth',
    category: 'Sapling · collectible',
    pattern: 'gamble on rarity',
    strategy: 'Roll on purchase; sell valuable pieces via Harvest.',
    reasoning: 'Bulk buys can hide treasures.',
    risks: 'Fakes, damaged cards, overpaying.',
    riskScore: 4,
    insights: 'Fakes are common and hard for laypeople to spot.',
    alternative: 'Keep the money',
    alternativeCostMinor: 0,
    links: [
      {
        label: 'Volksstimme – Sammelkarten als Investment',
        url: 'https://www.volksstimme.de/leben/finanzen/sammelkarten-als-investment-wert-und-risiken-kennen-4285546',
      },
    ],
    actions: [
      {
        text: 'Check authenticity',
        priority: 'medium',
      },
      {
        text: 'Grade the best pieces',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    market: {
      tag: 'CARDS',
      lowMinor: 60,
      highMinor: 200,
      trend: 'multiplier on asset value',
    },
    costMinor: 300000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          assetValueMinor: 80000,
        },
      },
      {
        from: 3,
        to: 4,
        value: {
          assetValueMinor: 250000,
        },
      },
      {
        from: 5,
        to: 5,
        value: {
          assetValueMinor: 600000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          rollAgain: [
            {
              from: 1,
              to: 5,
              value: {
                assetValueMinor: 900000,
              },
            },
            {
              from: 6,
              to: 6,
              value: {
                assetValueMinor: 4000000,
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'P32',
    pile: 'sapling',
    title: {
      en: 'Forex Trading Course',
      de: 'Forex-Trading-Kurs',
    },
    story: {
      en: "A 22-year-old in a rented Lamborghini sells a course: 'Quit your job in 90 days.'",
      de: "Ein 22-Jähriger im gemieteten Lamborghini verkauft einen Kurs: 'Kündige in 90 Tagen deinen Job.'",
    },
    growType: 'income-growth',
    category: 'Sapling · education',
    pattern: 'trading course',
    strategy: 'Learn the system, trade the signals, scale up.',
    reasoning: 'The course promises a proven strategy and live trading signals.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 3,
    insights:
      'Brokers of leveraged products must disclose the share of retail accounts that lose money.',
    alternative: 'World ETF',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [
      {
        text: "Check the broker's disclosed share of losing accounts",
        priority: 'medium',
      },
      {
        text: 'Ignore lifestyle marketing',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 300000,
    dice: [
      {
        from: 1,
        to: 5,
        value: {
          cashflowMinor: 0,
          oneTimeMinor: -50000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 0,
        },
      },
    ],
    note: 'On 1–5 you also lose 500 TT trading.',
    trap: {
      trueCategory: 'scam',
    },
  },
  {
    id: 'T01',
    pile: 'tree',
    title: {
      en: 'Studio Flat in Chemnitz',
      de: 'Einzimmerwohnung in Chemnitz',
    },
    story: {
      en: '25 m², renovated, near the university. Tenants: students who stay two to three years.',
      de: '25 m², renoviert, nahe der Uni. Mieter: Studierende, die zwei, drei Jahre bleiben.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'rental flat',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning:
      "Chemnitz had the highest gross rental yield of Germany's 52 largest cities (5.77%, H1 2026).",
    risks: "Vacancy in shrinking regions; turnover costs; owners' association decisions.",
    riskScore: 2,
    insights:
      'Gross yields 2026: national average 4.17%, Chemnitz 5.77%, Gelsenkirchen 5.16%, Hamburg 3.0%. Side costs include transfer tax (Saxony 5.5%), notary/registry ~1.5–2%, broker ~3.57%.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Baufi24 – Mietrenditeatlas H1 2026',
        url: 'https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/',
      },
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    costMinor: 1098000,
    cashflowMinor: -400,
    property: {
      priceMinor: 3600000,
      rentMonthMinor: 17500,
      runningCostShare: 0.2,
      cashNeededMinor: 1098000,
      depositMinor: 720000,
      sideCostsMinor: 378000,
      mortgageMinor: 2880000,
      mortgagePaymentMonthMinor: 14400,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T02',
    pile: 'tree',
    title: {
      en: 'Auction Flat in Gelsenkirchen',
      de: 'Zwangsversteigerung in Gelsenkirchen',
    },
    story: {
      en: 'A two-room flat at a foreclosure auction, 30% below market. You only saw it from outside.',
      de: 'Eine Zweizimmerwohnung bei der Zwangsversteigerung, 30 % unter Marktwert. Du hast sie nur von außen gesehen.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'below-market deal',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Buying 30% below market lifts the yield to about 7.5%.',
    risks: 'No inside viewing; hidden damage; previous occupants may still live there.',
    riskScore: 3,
    insights:
      "Foreclosure auctions can be cheap but carry inspection and eviction risks; Gelsenkirchen's gross yield was 5.16% at market prices.",
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Baufi24 – Mietrenditeatlas H1 2026',
        url: 'https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/',
      },
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    costMinor: 1624000,
    cashflowMinor: 5600,
    onBuy: [
      {
        from: 1,
        to: 1,
        value: {
          oneTimeMinor: -600000,
        },
      },
      {
        from: 2,
        to: 6,
        value: {},
      },
    ],
    property: {
      priceMinor: 5800000,
      rentMonthMinor: 36000,
      runningCostShare: 0.2,
      cashNeededMinor: 1624000,
      depositMinor: 1160000,
      sideCostsMinor: 464000,
      mortgageMinor: 4640000,
      mortgagePaymentMonthMinor: 23200,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T03',
    pile: 'tree',
    title: {
      en: 'One-Room Flat in Munich',
      de: 'Einzimmerwohnung in München',
    },
    story: {
      en: "30 m² in Giesing. Everyone wants to live in Munich — but the numbers don't add up.",
      de: '30 m² in Giesing. Alle wollen in München wohnen — aber die Zahlen gehen nicht auf.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'rental flat (low yield)',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Safe location and value stability, but low yield (~3.3%).',
    risks: 'Strongly negative cash flow at current rates; price corrections in top cities.',
    riskScore: 2,
    insights:
      'Top-7 cities all cost over €5,000/m²; yields in the top cities range from 3.0% (Hamburg) to 3.99% (Stuttgart). Bavaria: 3.5% transfer tax, total side costs 5.0–8.6%.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Baufi24 – Mietrenditeatlas H1 2026',
        url: 'https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/',
      },
      {
        label: 'finanz.de – Grunderwerbsteuer Bayern',
        url: 'https://www.finanz.de/steuern/grunderwerbsteuer/bayern/',
      },
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    costMinor: 7293000,
    cashflowMinor: -46000,
    property: {
      priceMinor: 25500000,
      rentMonthMinor: 70000,
      runningCostShare: 0.2,
      cashNeededMinor: 7293000,
      depositMinor: 5100000,
      sideCostsMinor: 2193000,
      mortgageMinor: 20400000,
      mortgagePaymentMonthMinor: 102000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T04',
    pile: 'tree',
    title: {
      en: 'Six-Unit House in the Ruhr Area',
      de: 'Sechsparteienhaus im Ruhrgebiet',
    },
    story: {
      en: 'A retiring owner sells his 1960s apartment house. Solid tenants, old heating.',
      de: 'Ein Eigentümer im Ruhestand verkauft sein Mehrfamilienhaus aus den 60ern. Solide Mieter, alte Heizung.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'multi-family house',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'A whole building at ~7.5% gross yield; you control all decisions.',
    risks: 'Heating replacement (energy law), big repairs, tenant management.',
    riskScore: 3,
    insights:
      'Twelve of the 20 highest-yield cities are in the Ruhr area or eastern Germany (Baufi24, H1 2026). NRW transfer tax is 6.5%.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Baufi24 – Mietrenditeatlas H1 2026',
        url: 'https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/',
      },
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    costMinor: 19840000,
    cashflowMinor: 64000,
    onBuy: [
      {
        from: 1,
        to: 2,
        value: {
          laterCost: {
            afterPaydays: 24,
            minor: 4000000,
          },
        },
      },
      {
        from: 3,
        to: 6,
        value: {},
      },
    ],
    property: {
      priceMinor: 62000000,
      rentMonthMinor: 390000,
      runningCostShare: 0.2,
      cashNeededMinor: 19840000,
      depositMinor: 12400000,
      sideCostsMinor: 7440000,
      mortgageMinor: 49600000,
      mortgagePaymentMonthMinor: 248000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T05',
    pile: 'tree',
    title: {
      en: 'Holiday Flat at the Baltic Sea',
      de: 'Ferienwohnung an der Ostsee',
    },
    story: {
      en: 'Two rooms, sea view, booked solid in summer and empty in February.',
      de: 'Zwei Zimmer, Meerblick, im Sommer ausgebucht, im Februar leer.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'holiday rental',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'High summer income, but costs for cleaning, platforms and empty months.',
    risks: 'Occupancy swings; local rules for holiday rentals; management costs.',
    riskScore: 3,
    insights:
      'Holiday rentals earn more per night but have higher running costs (cleaning, booking fees) and seasonal vacancy.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    estimate: true,
    costMinor: 7200000,
    cashflowMinor: 8000,
    eachPayday: [
      {
        from: 1,
        to: 2,
        value: {
          rentCutPercent: 50,
          paydays: 1,
        },
      },
      {
        from: 3,
        to: 6,
        value: {},
      },
    ],
    property: {
      priceMinor: 24000000,
      rentMonthMinor: 130000,
      runningCostShare: 0.2,
      cashNeededMinor: 7200000,
      depositMinor: 4800000,
      sideCostsMinor: 2400000,
      mortgageMinor: 19200000,
      mortgagePaymentMonthMinor: 96000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T06',
    pile: 'tree',
    title: {
      en: 'Small Shop Unit',
      de: 'Kleine Gewerbeeinheit',
    },
    story: {
      en: 'A ground-floor shop rented to a bakery chain on a 10-year lease.',
      de: 'Ein Ladenlokal im Erdgeschoss, für 10 Jahre an eine Bäckereikette vermietet.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'commercial property',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Commercial leases pay ~7–8% with tenants covering many costs.',
    risks: 'If the tenant leaves, finding a new one can take a year.',
    riskScore: 3,
    insights: 'Commercial units yield more than flats but carry longer vacancy risk.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    estimate: true,
    costMinor: 8700000,
    cashflowMinor: 32000,
    eachPayday: [
      {
        from: 1,
        to: 1,
        value: {
          rentCutPercent: 100,
          paydays: 3,
        },
      },
      {
        from: 2,
        to: 6,
        value: {},
      },
    ],
    property: {
      priceMinor: 30000000,
      rentMonthMinor: 190000,
      runningCostShare: 0.2,
      cashNeededMinor: 8700000,
      depositMinor: 6000000,
      sideCostsMinor: 2700000,
      mortgageMinor: 24000000,
      mortgagePaymentMonthMinor: 120000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T07',
    pile: 'tree',
    title: {
      en: 'Three Micro-Apartments',
      de: 'Drei Mikroapartments',
    },
    story: {
      en: 'Three furnished 20 m² apartments near a university, rented per room.',
      de: 'Drei möblierte 20-m²-Apartments nahe einer Uni, zimmerweise vermietet.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'micro-living',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Furnished micro-living earns more per m².',
    risks: 'Furniture wear, high turnover, regulation of furnished rentals.',
    riskScore: 3,
    insights:
      'Furnished small units achieve high rents per m² in university cities but need more management.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    estimate: true,
    costMinor: 9900000,
    cashflowMinor: 24000,
    property: {
      priceMinor: 33000000,
      rentMonthMinor: 195000,
      runningCostShare: 0.2,
      cashNeededMinor: 9900000,
      depositMinor: 6600000,
      sideCostsMinor: 3300000,
      mortgageMinor: 26400000,
      mortgagePaymentMonthMinor: 132000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T08',
    pile: 'tree',
    title: {
      en: 'Fixer-Upper to Renovate and Rent',
      de: 'Sanierungsobjekt zum Vermieten',
    },
    story: {
      en: 'An old house in a small town. Cheap, ugly, full of potential — and surprises.',
      de: 'Ein altes Haus in einer Kleinstadt. Billig, hässlich, voller Potenzial — und Überraschungen.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'renovate and rent',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Buy cheap, renovate, rent at market level (yield ~8% on purchase + renovation).',
    risks: 'Renovation overruns, craftsmen shortages, months without rent.',
    riskScore: 4,
    insights: 'Renovation budgets often overrun; the rent only starts after works are done.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    estimate: true,
    costMinor: 4640000,
    cashflowMinor: 28000,
    onBuy: [
      {
        from: 1,
        to: 2,
        value: {
          extraCostPercent: 40,
        },
      },
      {
        from: 3,
        to: 6,
        value: {},
      },
    ],
    property: {
      priceMinor: 16000000,
      rentMonthMinor: 115000,
      runningCostShare: 0.2,
      cashNeededMinor: 4640000,
      depositMinor: 3200000,
      sideCostsMinor: 1440000,
      mortgageMinor: 12800000,
      mortgagePaymentMonthMinor: 64000,
      extraCostMinor: 5000000,
    },
    rampPaydays: 4,
  },
  {
    id: 'T09',
    pile: 'tree',
    title: {
      en: 'Senior Care Apartment',
      de: 'Pflegeapartment',
    },
    story: {
      en: "A unit in a care home with a 20-year lease to the operator. 'Worry-free investment,' says the brochure.",
      de: "Ein Apartment in einem Pflegeheim mit 20-Jahre-Pachtvertrag. 'Sorgenfreie Kapitalanlage', sagt die Broschüre.",
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'care property',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Fixed lease income from the operator.',
    risks: 'Operator insolvency; overpriced sales; hard to resell.',
    riskScore: 3,
    insights:
      'Care property sellers advertise security, but operator insolvencies have hit owners; resale is difficult.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    estimate: true,
    costMinor: 5670000,
    cashflowMinor: -20000,
    eachPayday: [
      {
        from: 1,
        to: 1,
        value: {
          rentCutPercent: 30,
          paydays: 6,
        },
      },
      {
        from: 2,
        to: 6,
        value: {},
      },
    ],
    property: {
      priceMinor: 21000000,
      rentMonthMinor: 80000,
      runningCostShare: 0.2,
      cashNeededMinor: 5670000,
      depositMinor: 4200000,
      sideCostsMinor: 1470000,
      mortgageMinor: 16800000,
      mortgagePaymentMonthMinor: 84000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T10',
    pile: 'tree',
    title: {
      en: 'Parking Space Package',
      de: 'Stellplatzpaket',
    },
    story: {
      en: 'Five underground spaces in a new building, sold as an investment package.',
      de: 'Fünf Tiefgaragenplätze in einem Neubau, als Investmentpaket verkauft.',
    },
    growType: 'income-growth',
    category: 'Tree · property',
    pattern: 'parking',
    strategy:
      'Pay the deposit (20%) and side costs now; the bank provides the mortgage automatically (4.0% interest + 2.0% repayment). Cash flow = rent − running costs − mortgage payment.',
    reasoning: 'Simple, low-maintenance rental at about 6% gross.',
    risks: "Local demand; new car parks; owners' association.",
    riskScore: 2,
    insights: 'Garage spaces are a niche investment; micro-location decides demand.',
    alternative: 'REIT',
    alternativeCostMinor: 500000,
    links: [
      {
        label: 'biallo – Garagen als Geldanlage',
        url: 'https://www.biallo.de/bauen/news/garagen-als-geldanlage/',
      },
      {
        label: 'Dr. Klein – Bauzinsen aktuell',
        url: 'https://www.drklein.de/finanzlexikon/darlehenszinsen.html',
      },
    ],
    actions: [],
    kind: 'investment',
    costMinor: 3432000,
    cashflowMinor: 0,
    property: {
      priceMinor: 12000000,
      rentMonthMinor: 60000,
      runningCostShare: 0.2,
      cashNeededMinor: 3432000,
      depositMinor: 2400000,
      sideCostsMinor: 1032000,
      mortgageMinor: 9600000,
      mortgagePaymentMonthMinor: 48000,
      extraCostMinor: 0,
    },
  },
  {
    id: 'T11',
    pile: 'tree',
    title: {
      en: 'Open a Laundromat',
      de: 'Waschsalon eröffnen',
    },
    story: {
      en: 'Twelve washers, eight dryers, a card terminal and a bench by the window.',
      de: 'Zwölf Waschmaschinen, acht Trockner, ein Kartenterminal und eine Bank am Fenster.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'laundromat',
    strategy:
      'Finance with a business loan; equity is paid now; cash flow is after loan payment and costs, before your time.',
    reasoning:
      'An operating business can produce much higher cash flow than property — with more work and risk.',
    risks: 'Location, machine breakdowns, energy and water prices.',
    riskScore: 3,
    insights:
      'Laundromats need little staff once established; banks usually expect 15–20% equity for start-up loans; costs: rent, machines, payment system, energy, water.',
    alternative: 'World ETF',
    alternativeCostMinor: 3500000,
    links: [
      {
        label: 'Gründerplattform – Waschsalon eröffnen',
        url: 'https://gruenderplattform.de/geschaeftsideen/waschsalon-eroeffnen',
      },
    ],
    actions: [],
    kind: 'asset',
    costMinor: 3500000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 30000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 160000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 320000,
        },
      },
    ],
    loan: {
      loanMinor: 10500000,
      paymentMonthMinor: 87500,
    },
    totalInvestmentMinor: 14000000,
  },
  {
    id: 'T12',
    pile: 'tree',
    title: {
      en: 'Bakery Café Franchise',
      de: 'Bäckerei-Café-Franchise',
    },
    story: {
      en: 'A known brand, a proven concept, and a shop in a busy street.',
      de: 'Eine bekannte Marke, ein erprobtes Konzept und ein Laden in einer belebten Straße.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'franchise',
    strategy:
      'Finance with a business loan; equity is paid now; cash flow is after loan payment and costs, before your time.',
    reasoning:
      'An operating business can produce much higher cash flow than property — with more work and risk.',
    risks: 'Franchise fees, staff, long hours, tight margins.',
    riskScore: 4,
    insights: 'Franchises reduce concept risk but charge entry and ongoing fees.',
    alternative: 'World ETF',
    alternativeCostMinor: 7000000,
    links: [],
    actions: [],
    kind: 'asset',
    estimate: true,
    costMinor: 7000000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 0,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 250000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 500000,
        },
      },
    ],
    loan: {
      loanMinor: 21000000,
      paymentMonthMinor: 175000,
    },
    totalInvestmentMinor: 28000000,
  },
  {
    id: 'T13',
    pile: 'tree',
    title: {
      en: 'Take Over an IT Service Company',
      de: 'Ein IT-Dienstleister übernehmen',
    },
    story: {
      en: 'A 62-year-old owner looks for a successor for his 8-person IT company. Loyal customers, old website.',
      de: 'Ein 62-jähriger Inhaber sucht einen Nachfolger für seine IT-Firma mit 8 Leuten. Treue Kunden, alte Website.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'business succession',
    strategy:
      'Finance with a business loan; equity is paid now; cash flow is after loan payment and costs, before your time.',
    reasoning:
      'An operating business can produce much higher cash flow than property — with more work and risk.',
    risks: 'Customers leave with the old owner; key staff quit.',
    riskScore: 3,
    insights:
      'Many German small-business owners are near retirement and seek successors; prices are often a multiple of annual profit, with seller loans common.',
    alternative: 'World ETF',
    alternativeCostMinor: 6000000,
    links: [],
    actions: [],
    kind: 'asset',
    estimate: true,
    costMinor: 6000000,
    dice: [
      {
        from: 1,
        to: 1,
        value: {
          cashflowMinor: 80000,
        },
      },
      {
        from: 2,
        to: 5,
        value: {
          cashflowMinor: 380000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 650000,
        },
      },
    ],
    loan: {
      loanMinor: 30000000,
      paymentMonthMinor: 225000,
    },
    totalInvestmentMinor: 36000000,
    requires: {
      careerStage: 4,
    },
  },
  {
    id: 'T14',
    pile: 'tree',
    title: {
      en: 'Self-Service Car Wash',
      de: 'SB-Waschanlage',
    },
    story: {
      en: 'Six bays, open 24/7, card payment.',
      de: 'Sechs Waschboxen, rund um die Uhr geöffnet, Kartenzahlung.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'car wash',
    strategy:
      'Finance with a business loan; equity is paid now; cash flow is after loan payment and costs, before your time.',
    reasoning:
      'An operating business can produce much higher cash flow than property — with more work and risk.',
    risks: 'Weather, location, water regulations, maintenance.',
    riskScore: 3,
    insights:
      'Self-service car washes run with little staff; revenue depends on traffic and weather.',
    alternative: 'World ETF',
    alternativeCostMinor: 9000000,
    links: [],
    actions: [],
    kind: 'asset',
    estimate: true,
    costMinor: 9000000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 50000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 280000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 450000,
        },
      },
    ],
    loan: {
      loanMinor: 33000000,
      paymentMonthMinor: 247500,
    },
    totalInvestmentMinor: 42000000,
  },
  {
    id: 'T15',
    pile: 'tree',
    title: {
      en: 'Rooftop Solar on a Warehouse',
      de: 'Solaranlage auf einer Lagerhalle',
    },
    story: {
      en: 'You lease a warehouse roof for 20 years and install a 300 kWp solar system.',
      de: 'Du pachtest ein Hallendach für 20 Jahre und baust eine 300-kWp-Solaranlage.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'solar plant',
    strategy:
      'Finance with a business loan; equity is paid now; cash flow is after loan payment and costs, before your time.',
    reasoning:
      'An operating business can produce much higher cash flow than property — with more work and risk.',
    risks: 'Feed-in tariffs, inverter replacement, roof damage.',
    riskScore: 2,
    insights:
      'Commercial rooftop solar sells power to the grid or the building user; income is predictable but modest after financing.',
    alternative: 'World ETF',
    alternativeCostMinor: 5000000,
    links: [],
    actions: [],
    kind: 'asset',
    estimate: true,
    costMinor: 5000000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 40000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 90000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 130000,
        },
      },
    ],
    loan: {
      loanMinor: 19000000,
      paymentMonthMinor: 118800,
    },
    totalInvestmentMinor: 24000000,
  },
  {
    id: 'T16',
    pile: 'tree',
    title: {
      en: 'Glamping Tiny-House Park',
      de: 'Glamping-Park mit Tiny Houses',
    },
    story: {
      en: 'Eight tiny houses in a meadow near the Alps, booked through travel platforms.',
      de: 'Acht Tiny Houses auf einer Wiese nahe den Alpen, gebucht über Reiseportale.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'tourism business',
    strategy:
      'Finance with a business loan; equity is paid now; cash flow is after loan payment and costs, before your time.',
    reasoning:
      'An operating business can produce much higher cash flow than property — with more work and risk.',
    risks: 'Permits, seasonality, reviews, staff.',
    riskScore: 4,
    insights:
      'Tourism businesses depend on occupancy and reviews; permits for tiny houses vary by municipality.',
    alternative: 'World ETF',
    alternativeCostMinor: 8000000,
    links: [],
    actions: [],
    kind: 'asset',
    estimate: true,
    costMinor: 8000000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 0,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 240000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 480000,
        },
      },
    ],
    loan: {
      loanMinor: 30000000,
      paymentMonthMinor: 225000,
    },
    totalInvestmentMinor: 38000000,
  },
  {
    id: 'T17',
    pile: 'tree',
    title: {
      en: 'Dividend Portfolio of 20 Stocks',
      de: 'Dividendendepot mit 20 Aktien',
    },
    story: {
      en: 'Twenty blue chips that pay you four times a year — on paper, a pension.',
      de: 'Zwanzig Standardwerte, die dir viermal im Jahr zahlen — auf dem Papier eine Rente.',
    },
    growType: 'income-growth',
    category: 'Tree · dividend',
    pattern: 'dividend portfolio',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'Single-stock risk spread over 20; dividend cuts in crises.',
    riskScore: 2,
    insights:
      'Almost half of DAX companies yielded 3% or more in 2026; BMW ~5.3%, Allianz ~4.5%, Mercedes ~6.4%.',
    alternative: 'World ETF',
    alternativeCostMinor: 6000000,
    links: [
      {
        label: 'biallo – DAX-Dividenden 2026',
        url: 'https://www.biallo.de/fonds/news/dax-dividenden-2026/',
      },
    ],
    actions: [],
    kind: 'share',
    share: {
      ticker: 'DIVPF',
      unitPriceMinor: 100000,
      maxUnits: 60,
      dividendMonthPerUnitMinor: 330,
      yieldYearPercent: 3.96,
    },
    market: {
      tag: 'DIVPF',
      lowMinor: 70000,
      highMinor: 135000,
      trend: 'slow up',
    },
  },
  {
    id: 'T18',
    pile: 'tree',
    title: {
      en: 'Big ETF Lump Sum',
      de: 'Große ETF-Einmalanlage',
    },
    story: {
      en: 'An inheritance or years of bonuses, all into a global index fund.',
      de: 'Ein Erbe oder jahrelange Boni, alles in einen weltweiten Indexfonds.',
    },
    growType: 'income-growth',
    category: 'Tree · conservative',
    pattern: 'index ETF lump sum',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'Crashes of 30–50%; must hold.',
    riskScore: 2,
    insights: 'Long-term MSCI World return ~7–8% a year; drawdowns of ~50% in 2000–03 and 2008–09.',
    alternative: 'World ETF',
    alternativeCostMinor: 10000000,
    links: [
      {
        label: 'zendepot – MSCI World Rendite',
        url: 'https://zendepot.de/etf/msci-world-rendite',
      },
    ],
    actions: [],
    kind: 'share',
    share: {
      ticker: 'WORLD',
      unitPriceMinor: 10000,
      maxUnits: 1000,
      dividendMonthPerUnitMinor: 15,
      yieldYearPercent: 1.8,
    },
    market: {
      tag: 'WORLD',
      lowMinor: 6000,
      highMinor: 14000,
      trend: 'slow up',
    },
  },
  {
    id: 'T19',
    pile: 'tree',
    title: {
      en: 'Big Bitcoin Bet',
      de: 'Große Bitcoin-Wette',
    },
    story: {
      en: 'You put a serious amount into Bitcoin. Your parents are not amused.',
      de: 'Du steckst einen ernsthaften Betrag in Bitcoin. Deine Eltern sind nicht begeistert.',
    },
    growType: 'income-growth',
    category: 'Tree · crypto',
    pattern: 'crypto',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'Drawdowns over 70%; no cash flow; custody risk.',
    riskScore: 5,
    insights:
      'Bitcoin volatility fell from 181% (2013) to about 23% (2025), but deep crashes remain possible.',
    alternative: 'World ETF',
    alternativeCostMinor: 3000000,
    links: [
      {
        label: '21Shares – Wie volatil ist Bitcoin?',
        url: 'https://www.21shares.com/de/research/wie-volatil-ist-bitcoin',
      },
    ],
    actions: [],
    kind: 'share',
    share: {
      ticker: 'BTC',
      unitPriceMinor: 50000,
      maxUnits: 60,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'BTC',
      lowMinor: 15000,
      highMinor: 500000,
      trend: 'volatile; x10 extremely rare',
    },
  },
  {
    id: 'T20',
    pile: 'tree',
    title: {
      en: '1 kg Gold Bar',
      de: '1-kg-Goldbarren',
    },
    story: {
      en: 'A kilo of gold. Heavier than it looks. Worth more than a car.',
      de: 'Ein Kilo Gold. Schwerer als es aussieht. Mehr wert als ein Auto.',
    },
    growType: 'income-growth',
    category: 'Tree · metal',
    pattern: 'precious metal',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'No income; storage and insurance; price swings.',
    riskScore: 2,
    insights: 'Gold ≈ €3,567/oz in October 2026 ≈ €115,000 per kg; +47% in 2025 in EUR.',
    alternative: 'World ETF',
    alternativeCostMinor: 11700000,
    links: [
      {
        label: 'gold.de – Goldpreis aktuell',
        url: 'https://www.gold.de/kurse/goldpreis/',
      },
    ],
    actions: [],
    kind: 'share',
    share: {
      ticker: 'GOLDKG',
      unitPriceMinor: 11700000,
      maxUnits: 1,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'GOLDKG',
      lowMinor: 9500000,
      highMinor: 14500000,
      trend: 'slow up, crisis spikes',
    },
  },
  {
    id: 'T21',
    pile: 'tree',
    title: {
      en: 'Corporate Bond Ladder',
      de: 'Unternehmensanleihen-Leiter',
    },
    story: {
      en: 'Fifty thousand spread over ten investment-grade company bonds.',
      de: 'Fünfzigtausend verteilt auf zehn Unternehmensanleihen mit gutem Rating.',
    },
    growType: 'income-growth',
    category: 'Tree · conservative',
    pattern: 'bond ladder',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'Issuer default; inflation.',
    riskScore: 1,
    insights:
      'Investment-grade bonds yield somewhat above government bonds (ECB deposit rate 2.50%, Oct 2026).',
    alternative: 'World ETF',
    alternativeCostMinor: 5000000,
    links: [
      {
        label: 'Raisin – Zinsradar 10/2026',
        url: 'https://www.raisin.com/de-de/geldanlage/zinsradar/',
      },
    ],
    actions: [],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'CBOND',
      unitPriceMinor: 100000,
      maxUnits: 50,
      dividendMonthPerUnitMinor: 280,
      yieldYearPercent: 3.36,
    },
    market: {
      tag: 'CBOND',
      lowMinor: 94000,
      highMinor: 104000,
      trend: 'flat',
    },
  },
  {
    id: 'T22',
    pile: 'tree',
    title: {
      en: "Pre-IPO 'Exclusive' Shares",
      de: "'Exklusive' Pre-IPO-Aktien",
    },
    story: {
      en: "A friendly caller from Zurich offers shares before a famous tech IPO. 'Only today, only for you.'",
      de: "Ein freundlicher Anrufer aus Zürich bietet Aktien vor einem berühmten Tech-Börsengang an. 'Nur heute, nur für Sie.'",
    },
    growType: 'income-growth',
    category: 'Tree · speculative',
    pattern: 'pre-IPO shares',
    strategy: 'Buy before the listing; sell on the first trading day.',
    reasoning: 'The caller says pre-IPO prices are far below the expected listing price.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 4,
    insights:
      "Regulators publish warning lists of unauthorised firms; legitimate brokers are registered and don't cold-call.",
    alternative: 'World ETF',
    alternativeCostMinor: 3000000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [],
    kind: 'share',
    share: {
      ticker: 'PREIPO',
      unitPriceMinor: 500000,
      maxUnits: 6,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'PREIPO',
      lowMinor: 0,
      highMinor: 0,
      trend: 'boiler-room scam: always 0',
    },
    trap: {
      trueCategory: 'scam',
    },
  },
  {
    id: 'T23',
    pile: 'tree',
    title: {
      en: 'Timeshare Week in Spain',
      de: 'Timesharing-Woche in Spanien',
    },
    story: {
      en: 'A week a year in a resort apartment, forever. The presentation came with free cocktails.',
      de: 'Eine Woche pro Jahr in einer Ferienanlage, für immer. Die Präsentation gab es mit Gratis-Cocktails.',
    },
    growType: 'income-growth',
    category: 'Tree · travel property',
    pattern: 'timeshare',
    strategy: "Lock in your holiday week forever at today's price.",
    reasoning: 'A guaranteed holiday every year without hotel prices.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 2,
    insights:
      'Timeshares come with yearly maintenance fees; the resale market is worth checking before buying.',
    alternative: 'World ETF',
    alternativeCostMinor: 3000000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'TIMESH',
      unitPriceMinor: 3000000,
      maxUnits: 1,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'TIMESH',
      lowMinor: 0,
      highMinor: 300000,
      trend: 'nearly unsellable',
    },
    trap: {
      trueCategory: 'faulty',
    },
  },
  {
    id: 'T24',
    pile: 'tree',
    title: {
      en: 'Classic Porsche (1970s)',
      de: 'Klassischer Porsche (70er)',
    },
    story: {
      en: 'An air-cooled 911 from 1974, matching numbers, documented history.',
      de: 'Ein luftgekühlter 911 von 1974, matching numbers, dokumentierte Historie.',
    },
    growType: 'income-growth',
    category: 'Tree · collectible',
    pattern: 'classic car',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'Storage, insurance, maintenance; collector fashions change.',
    riskScore: 3,
    insights:
      'Classic cars can appreciate but cost money every month; liquidity depends on finding the right buyer.',
    alternative: 'World ETF',
    alternativeCostMinor: 12000000,
    links: [],
    actions: [],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'CLASSIC',
      unitPriceMinor: 12000000,
      maxUnits: 1,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'CLASSIC',
      lowMinor: 9000000,
      highMinor: 18000000,
      trend: 'slow up, collector cycles',
    },
    setsCar: true,
  },
  {
    id: 'T25',
    pile: 'tree',
    title: {
      en: 'Painting by an Emerging Artist',
      de: 'Gemälde eines aufstrebenden Künstlers',
    },
    story: {
      en: "A large canvas from a gallery show. The gallerist says the artist is 'about to break through'.",
      de: "Eine große Leinwand aus einer Galerieausstellung. Der Galerist sagt, der Künstler stehe 'kurz vor dem Durchbruch'.",
    },
    growType: 'income-growth',
    category: 'Tree · collectible',
    pattern: 'art',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'Most emerging artists never break through; illiquid.',
    riskScore: 4,
    insights:
      'Art returns are extremely uneven and resale goes through galleries or auctions with high fees.',
    alternative: 'World ETF',
    alternativeCostMinor: 4000000,
    links: [],
    actions: [],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'ART',
      unitPriceMinor: 4000000,
      maxUnits: 1,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'ART',
      lowMinor: 800000,
      highMinor: 40000000,
      trend: 'most stay flat, rare breakthrough',
    },
  },
  {
    id: 'T26',
    pile: 'tree',
    title: {
      en: 'Private Equity Fund (ELTIF)',
      de: 'Private-Equity-Fonds (ELTIF)',
    },
    story: {
      en: 'A bank offers a private equity fund for retail investors. Minimum 10,000, locked for 8 years.',
      de: 'Eine Bank bietet einen Private-Equity-Fonds für Privatanleger an. Mindestens 10.000, 8 Jahre gebunden.',
    },
    growType: 'income-growth',
    category: 'Tree · speculative',
    pattern: 'private markets',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Large amounts make small yields visible.',
    risks: 'High fees, long lock-up, opaque valuations.',
    riskScore: 3,
    insights:
      'European long-term investment funds (ELTIFs) open private markets to retail investors but lock money for years and charge high fees.',
    alternative: 'World ETF',
    alternativeCostMinor: 5000000,
    links: [],
    actions: [],
    kind: 'share',
    estimate: true,
    share: {
      ticker: 'PEFUND',
      unitPriceMinor: 1000000,
      maxUnits: 5,
      dividendMonthPerUnitMinor: 0,
      yieldYearPercent: 0.0,
    },
    market: {
      tag: 'PEFUND',
      lowMinor: 700000,
      highMinor: 2000000,
      trend: 'slow, locked',
    },
    lockedPaydays: 24,
  },
  {
    id: 'T27',
    pile: 'tree',
    title: {
      en: 'Farmland in Eastern Germany',
      de: 'Ackerland in Ostdeutschland',
    },
    story: {
      en: 'Ten hectares of farmland, leased to a local farmer.',
      de: 'Zehn Hektar Ackerland, an einen örtlichen Landwirt verpachtet.',
    },
    growType: 'income-growth',
    category: 'Tree · real asset',
    pattern: 'farmland',
    strategy: 'Big position: decide your sell price before you buy.',
    reasoning: 'Land is scarce and keeps value; the lease pays a small income.',
    risks: 'Low lease income; illiquid; buying rules for farmland.',
    riskScore: 2,
    insights:
      'Farmland averaged ~€17,500/ha in eastern and ~€51,800/ha in western German states in 2025; lease income is modest.',
    alternative: 'World ETF',
    alternativeCostMinor: 18000000,
    links: [],
    actions: [],
    kind: 'share',
    share: {
      ticker: 'FARMLAND',
      unitPriceMinor: 1800000,
      maxUnits: 10,
      dividendMonthPerUnitMinor: 1500,
      yieldYearPercent: 1.0,
    },
    market: {
      tag: 'FARMLAND',
      lowMinor: 1500000,
      highMinor: 2400000,
      trend: 'slow up',
    },
  },
  {
    id: 'T28',
    pile: 'tree',
    title: {
      en: 'Crypto Mining Farm Investment',
      de: 'Investment in eine Krypto-Mining-Farm',
    },
    story: {
      en: "A company sells 'mining contracts' with guaranteed daily payouts from its farm in Kazakhstan.",
      de: "Eine Firma verkauft 'Mining-Verträge' mit garantierten täglichen Auszahlungen aus ihrer Farm in Kasachstan.",
    },
    growType: 'income-growth',
    category: 'Tree · crypto',
    pattern: 'cloud-mining contract',
    strategy: 'Buy hash power, receive daily payouts.',
    reasoning: 'The company says its farm mines Bitcoin with cheap electricity.',
    risks: 'Prices can fall sharply; do your own research.',
    riskScore: 4,
    insights:
      'Mining income depends on the Bitcoin price, network difficulty and electricity cost; audited proof of facilities is a common check.',
    alternative: 'World ETF',
    alternativeCostMinor: 3000000,
    links: [
      {
        label: 'BaFin – Unternehmensdatenbank',
        url: 'https://portal.mvp.bafin.de/database/InstInfo/',
      },
    ],
    actions: [
      {
        text: 'Ask for audited proof of the facility',
        priority: 'medium',
      },
      {
        text: 'Check regulator warning lists',
        priority: 'medium',
      },
    ],
    kind: 'investment',
    costMinor: 3000000,
    trap: {
      trueCategory: 'scam',
      ponzi: {
        paysMonthMinor: 90000,
        paysPaydays: 3,
        then: 'lost',
      },
    },
  },
  {
    id: 'T29',
    pile: 'tree',
    title: {
      en: 'Vending Machine Network',
      de: 'Automaten-Netzwerk',
    },
    story: {
      en: 'Twelve machines across offices and gyms, with a part-time helper restocking them.',
      de: 'Zwölf Automaten in Büros und Fitnessstudios, ein Teilzeit-Helfer füllt nach.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'vending network',
    strategy: 'Scale what worked with one machine; hire for restocking.',
    reasoning: 'Operations scale; one route, many locations.',
    risks: 'Staff costs, location contracts, vandalism.',
    riskScore: 3,
    insights:
      'Single-machine operators report €80–150 daily sales at good locations with ~45% goods cost.',
    alternative: 'World ETF',
    alternativeCostMinor: 4000000,
    links: [
      {
        label: 'getquin – Erfahrungsbericht Automaten-Business',
        url: 'https://app.getquin.com/de/post/kJiXqaBssQ/hier-mal-ein-kleines-update-zu-meinen-erfahrung-im-automaten-business',
      },
    ],
    actions: [
      {
        text: 'Prove the model with one machine first',
        priority: 'medium',
      },
      {
        text: 'Hire a reliable helper',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 3000000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: 40000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 220000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 400000,
        },
      },
    ],
    loan: {
      loanMinor: 9000000,
      paymentMonthMinor: 90000,
    },
    totalInvestmentMinor: 12000000,
    requires: {
      owns: 'P15',
    },
  },
  {
    id: 'T30',
    pile: 'tree',
    title: {
      en: 'Buy Out Your Café Dream',
      de: 'Dein Traumcafé als Geschäft',
    },
    story: {
      en: 'Unlike the hobby café dream, this one has a business plan, staff and a second location planned.',
      de: 'Anders als der Hobby-Café-Traum hat dieses einen Businessplan, Personal und einen zweiten Standort in Planung.',
    },
    growType: 'income-growth',
    category: 'Tree · business',
    pattern: 'hospitality business',
    strategy: 'Run it as a business: staff, margins, second location.',
    reasoning: 'A well-run café with staff can produce owner income.',
    risks: 'Thin margins, staff shortages, rent.',
    riskScore: 4,
    insights:
      'Hospitality has high failure rates; profitability depends on location and cost control.',
    alternative: 'Laundromat',
    alternativeCostMinor: 3500000,
    links: [],
    actions: [
      {
        text: 'Write a business plan with conservative numbers',
        priority: 'medium',
      },
      {
        text: 'Work a month in a café first',
        priority: 'medium',
      },
    ],
    kind: 'asset',
    estimate: true,
    costMinor: 4500000,
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          cashflowMinor: -30000,
        },
      },
      {
        from: 3,
        to: 5,
        value: {
          cashflowMinor: 180000,
        },
      },
      {
        from: 6,
        to: 6,
        value: {
          cashflowMinor: 350000,
        },
      },
    ],
    loan: {
      loanMinor: 13500000,
      paymentMonthMinor: 110000,
    },
    totalInvestmentMinor: 18000000,
  },
];
