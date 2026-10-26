/**
 * The Dreamfund Life stack (JFK, 2026-10-26, temp_cards/dreamfund-life-deck.md v0.3): 27 cards, 36 with the copies, in English and
 * German. Amounts are minor units of the game money. Kept out of the domain package's main entry like the other printed content.
 */
import type { LifeCard } from './cashflow-game/life-deck';

export const LIFE_CARDS: LifeCard[] = [
  {
    id: 'L01',
    copies: 2,
    type: 'fate',
    title: {
      en: 'Falling in Love',
      de: 'Verliebt',
    },
    story: {
      en: "A climbing partner, a coffee, then another. You're seeing someone.",
      de: 'Ein Kletterpartner, ein Kaffee, dann noch einer. Du bist verliebt.',
    },
    links: [],
    requires: {
      relationship: 'single',
    },
    effects: {
      monthlyMinor: 6000,
      setState: {
        relationship: 'partner',
      },
    },
  },
  {
    id: 'L02',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Moving In Together',
      de: 'Zusammenziehen',
    },
    story: {
      en: '"My lease ends next month. What if…?"',
      de: '"Mein Mietvertrag läuft nächsten Monat aus. Was wäre, wenn…?"',
    },
    links: [],
    requires: {
      relationship: 'partner',
    },
    accept: {
      oneTimeMinor: -50000,
      monthlyMinor: -25000,
      setState: {
        relationship: 'cohabiting',
        home: 'with_partner',
      },
    },
  },
  {
    id: 'L03',
    copies: 1,
    type: 'choice',
    title: {
      en: 'The Proposal',
      de: 'Der Antrag',
    },
    story: {
      en: 'On a summit at sunrise, your partner pulls out a ring.',
      de: 'Auf dem Gipfel bei Sonnenaufgang zieht dein Partner einen Ring heraus.',
    },
    links: [],
    requires: {
      relationship: ['partner', 'cohabiting'],
    },
    accept: {
      oneTimeMinor: -250000,
      monthlyMinor: -8000,
      setState: {
        relationship: 'married',
      },
      rewardTurns: 3,
    },
    declineRoll: {
      upTo: 2,
      triggers: 'L04',
    },
  },
  {
    id: 'L04',
    copies: 2,
    type: 'fate',
    title: {
      en: 'Break-Up',
      de: 'Trennung',
    },
    story: {
      en: "It's over. Half the books are yours, the sofa isn't.",
      de: 'Es ist vorbei. Die Hälfte der Bücher gehört dir, das Sofa nicht.',
    },
    links: [],
    requires: {
      relationship: ['partner', 'cohabiting', 'married'],
    },
    effectsByState: {
      partner: {
        monthlyMinor: -6000,
        setState: {
          relationship: 'single',
        },
      },
      cohabiting: {
        oneTimeMinor: -80000,
        monthlyMinor: 25000,
        setState: {
          relationship: 'single',
          home: 'own_flat',
        },
      },
      married: {
        oneTimeMinor: -230000,
        monthlyMinor: 33000,
        setState: {
          relationship: 'single',
          home: 'own_flat',
        },
      },
    },
  },
  {
    id: 'L05',
    copies: 2,
    type: 'dice',
    title: {
      en: 'Thinking About a Baby',
      de: 'Kinderwunsch',
    },
    story: {
      en: 'You and your partner talk about it for weeks. Then you decide to try.',
      de: 'Du und dein Partner redet wochenlang darüber. Dann wollt ihr es versuchen.',
    },
    links: [],
    requires: {
      relationship: ['partner', 'cohabiting', 'married'],
    },
    dice: [
      {
        from: 1,
        to: 2,
        value: {
          schedule: {
            cardId: 'L06',
            afterPaydays: 3,
          },
        },
      },
      {
        from: 3,
        to: 6,
        value: null,
      },
    ],
    optional: true,
  },
  {
    id: 'L06',
    copies: 1,
    type: 'fate',
    title: {
      en: "It's a Baby!",
      de: 'Es ist ein Baby!',
    },
    story: {
      en: '3,400 grams. Ten fingers, ten toes, and a monthly budget that just changed forever.',
      de: '3.400 Gramm. Zehn Finger, zehn Zehen, und ein Monatsbudget, das sich für immer verändert hat.',
    },
    links: [
      {
        label: {
          en: 'Destatis – 763 € im Monat für ein Kind',
          de: 'Destatis – 763 € im Monat für ein Kind',
        },
        url: 'https://www.destatis.de/DE/Presse/Pressemitteilungen/Zahl-der-Woche/2021/PD21_26_p002.html',
      },
      {
        label: {
          en: 'Raisin – Kindergeld 2026',
          de: 'Raisin – Kindergeld 2026',
        },
        url: 'https://www.raisin.com/de-de/steuer/kindergeld/',
      },
    ],
    requires: {
      relationship: ['partner', 'cohabiting', 'married'],
    },
    effects: {
      oneTimeMinor: -100000,
      child: true,
      incomeMonthlyMinor: 25900,
      temporary: {
        incomePercentOfNet: -35,
        durationPaydays: 2,
      },
      setState: {
        kidsDelta: 1,
      },
      rewardTurns: 3,
    },
  },
  {
    id: 'L07',
    copies: 1,
    type: 'fate',
    title: {
      en: 'A Parent Needs Help',
      de: 'Ein Elternteil braucht Hilfe',
    },
    story: {
      en: "Your father had a fall. He'll be fine, but for a while he needs help at home.",
      de: 'Dein Vater ist gestürzt. Er wird wieder, aber eine Zeit lang braucht er Hilfe zu Hause.',
    },
    links: [],
    effects: {
      monthlyMinor: 15000,
      durationPaydays: 6,
    },
  },
  {
    id: 'L08',
    copies: 2,
    type: 'fate',
    title: {
      en: 'Wedding in the Family',
      de: 'Hochzeit in der Familie',
    },
    story: {
      en: "Your sister is getting married. Gift, train tickets, a suit you'll wear once.",
      de: 'Deine Schwester heiratet. Geschenk, Zugtickets, ein Anzug, den du einmal trägst.',
    },
    links: [],
    effects: {
      oneTimeMinor: -40000,
    },
  },
  {
    id: 'L09',
    copies: 2,
    type: 'choice',
    title: {
      en: 'A Cat Moves In',
      de: 'Eine Katze zieht ein',
    },
    story: {
      en: 'The shelter has a one-eyed tomcat who chose you.',
      de: 'Im Tierheim hat dich ein einäugiger Kater ausgesucht.',
    },
    links: [
      {
        label: {
          en: 'Berliner Sparkasse – Was kostet ein Haustier?',
          de: 'Berliner Sparkasse – Was kostet ein Haustier?',
        },
        url: 'https://www.berliner-sparkasse.de/de/home/privatkunden/junge-kunden/we-are-family/KostenHaustier.html',
      },
    ],
    requires: {
      pet: 'none',
    },
    accept: {
      oneTimeMinor: -30000,
      monthlyMinor: 7000,
      setState: {
        pet: 'cat',
      },
    },
  },
  {
    id: 'L10',
    copies: 1,
    type: 'choice',
    title: {
      en: 'A Dog Moves In',
      de: 'Ein Hund zieht ein',
    },
    story: {
      en: "A friend's dog had puppies. One of them won't stop looking at you.",
      de: 'Die Hündin einer Freundin hat Welpen. Einer schaut dich die ganze Zeit an.',
    },
    links: [
      {
        label: {
          en: 'Berliner Sparkasse – Was kostet ein Haustier?',
          de: 'Berliner Sparkasse – Was kostet ein Haustier?',
        },
        url: 'https://www.berliner-sparkasse.de/de/home/privatkunden/junge-kunden/we-are-family/KostenHaustier.html',
      },
    ],
    requires: {
      pet: 'none',
    },
    accept: {
      oneTimeMinor: -45000,
      monthlyMinor: 12000,
      setState: {
        pet: 'dog',
      },
    },
  },
  {
    id: 'L11',
    copies: 1,
    type: 'choice',
    title: {
      en: "Grandpa's Old Car",
      de: 'Opas altes Auto',
    },
    story: {
      en: 'Grandpa stops driving and hands you the keys to his 12-year-old Golf.',
      de: 'Opa hört auf zu fahren und gibt dir die Schlüssel zu seinem 12 Jahre alten Golf.',
    },
    links: [
      {
        label: {
          en: 'fahrzeugschein.de – Was kostet ein Auto?',
          de: 'fahrzeugschein.de – Was kostet ein Auto?',
        },
        url: 'https://www.fahrzeugschein.de/blog/artikel/was-kostet-dein-auto-wirklich',
      },
    ],
    requires: {
      car: false,
    },
    options: [
      {
        id: 'A',
        label: {
          en: 'Keep it',
          de: 'Behalten',
        },
        effect: {
          monthlyMinor: 25000,
          setState: {
            car: true,
          },
        },
      },
      {
        id: 'B',
        label: {
          en: 'Sell it',
          de: 'Verkaufen',
        },
        effect: {
          oneTimeMinor: 200000,
        },
      },
    ],
  },
  {
    id: 'L12',
    copies: 2,
    type: 'fate',
    title: {
      en: 'Rent Increase',
      de: 'Mieterhöhung',
    },
    story: {
      en: 'The landlord adjusts your rent to the local rent index.',
      de: 'Der Vermieter passt die Miete an den Mietspiegel an.',
    },
    links: [],
    effects: {
      monthlyMinor: 6000,
      group: 'rent',
    },
  },
  {
    id: 'L13',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Move to the Suburbs',
      de: 'Raus aus der Stadt',
    },
    story: {
      en: 'A bigger flat for less money — 40 minutes out by S-Bahn.',
      de: 'Eine größere Wohnung für weniger Geld — 40 Minuten raus mit der S-Bahn.',
    },
    links: [],
    accept: {
      oneTimeMinor: -70000,
      monthlyMinor: -16000,
      group: 'move',
    },
  },
  {
    id: 'L14',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Back to Your Childhood Room',
      de: 'Zurück ins Kinderzimmer',
    },
    story: {
      en: "Your parents offer your old room back. Cheap, but you'll hear about the dishes again.",
      de: 'Deine Eltern bieten dir dein altes Zimmer an. Billig, aber die Spülmaschine wird wieder Thema.',
    },
    links: [],
    requires: {
      relationship: ['single', 'partner'],
    },
    accept: {
      oneTimeMinor: -30000,
      monthlyMinor: -60000,
      setState: {
        home: 'with_parents',
      },
      group: 'move',
    },
  },
  {
    id: 'L15',
    copies: 2,
    type: 'choice',
    title: {
      en: 'New Flatmate',
      de: 'Neuer Mitbewohner',
    },
    story: {
      en: 'A colleague needs a room for a year. Your second room is empty anyway.',
      de: 'Ein Kollege braucht für ein Jahr ein Zimmer. Dein zweites Zimmer steht sowieso leer.',
    },
    links: [],
    requires: {
      relationship: ['single', 'partner'],
      home: 'own_flat',
    },
    accept: {
      monthlyMinor: -30000,
      durationPaydays: 12,
      setState: {
        home: 'shared_flat',
      },
    },
  },
  {
    id: 'L16',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Job Offer in Another City',
      de: 'Jobangebot in einer anderen Stadt',
    },
    story: {
      en: 'A company in Berlin wants you. More pay, new city, start over.',
      de: 'Eine Firma in Berlin will dich. Mehr Gehalt, neue Stadt, Neuanfang.',
    },
    links: [],
    accept: {
      oneTimeMinor: -150000,
      incomePercentOfNet: 7,
      expensesPercent: -5,
      setState: {
        location: 'other_city',
      },
      partnerRisk: {
        upTo: 2,
      },
      group: 'move',
    },
  },
  {
    id: 'L17',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Moving Abroad: Zurich',
      de: 'Ab ins Ausland: Zürich',
    },
    story: {
      en: 'A Swiss offer: almost double the salary. Also almost double the rent.',
      de: 'Ein Angebot aus der Schweiz: fast das doppelte Gehalt. Und fast die doppelte Miete.',
    },
    links: [],
    accept: {
      oneTimeMinor: -300000,
      incomePercentOfNet: 60,
      expensesPercent: 55,
      setState: {
        location: 'abroad_europe',
      },
      partnerRisk: {
        upTo: 2,
      },
      group: 'move',
    },
  },
  {
    id: 'L18',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Another Continent',
      de: 'Ein anderer Kontinent',
    },
    story: {
      en: 'Singapore. Or Toronto. Or Sydney. A two-year contract and a one-way ticket.',
      de: 'Singapur. Oder Toronto. Oder Sydney. Ein Zweijahresvertrag und ein One-Way-Ticket.',
    },
    links: [],
    accept: {
      oneTimeMinor: -500000,
      incomePercentOfNet: 45,
      expensesPercent: 35,
      setState: {
        location: 'other_continent',
      },
      partnerRisk: {
        upTo: 3,
      },
      group: 'move',
    },
  },
  {
    id: 'L19',
    copies: 1,
    type: 'fate',
    title: {
      en: 'The Company Goes Under',
      de: 'Die Firma ist pleite — hard',
    },
    story: {
      en: 'Insolvency. No severance, no notice period worth mentioning. Everyone is job-hunting at once.',
      de: 'Insolvenz. Keine Abfindung, kaum Kündigungsfrist. Alle suchen gleichzeitig einen Job.',
    },
    links: [
      {
        label: {
          en: 'Arbeitslosengeld I – Höhe und Dauer',
          de: 'Arbeitslosengeld I – Höhe und Dauer',
        },
        url: 'https://nexvyra.de/fakten/arbeitslosengeld-1.html',
      },
    ],
    requires: {
      employment: 'employed',
    },
    effects: {
      incomePercentOfNet: -40,
      incomePercentWithKids: -33,
      setState: {
        employment: 'unemployed',
      },
      jobSearch: {
        rollFrom: 6,
        maxPaydays: 6,
        fallbackPercent: -15,
      },
      group: 'employment',
    },
  },
  {
    id: 'L27',
    copies: 1,
    type: 'fate',
    title: {
      en: 'Laid Off With Severance',
      de: 'Gekündigt mit Abfindung — soft',
    },
    story: {
      en: 'Restructuring. Your team is gone — but HR offers a severance package and a reference letter.',
      de: 'Umstrukturierung. Dein Team gibt es nicht mehr — aber die Personalabteilung bietet eine Abfindung und ein gutes Zeugnis.',
    },
    links: [],
    requires: {
      employment: 'employed',
    },
    effects: {
      oneTimeMinor: 100000,
      incomePercentOfNet: -40,
      incomePercentWithKids: -33,
      setState: {
        employment: 'unemployed',
      },
      jobSearch: {
        rollFrom: 4,
        maxPaydays: 6,
        fallbackPercent: -5,
      },
      group: 'employment',
    },
  },
  {
    id: 'L20',
    copies: 1,
    type: 'fate',
    title: {
      en: 'Short-Time Work',
      de: 'Kurzarbeit',
    },
    story: {
      en: 'Orders are down. Everyone works 50% for a while.',
      de: 'Die Aufträge brechen ein. Alle arbeiten eine Zeit lang 50 %.',
    },
    links: [],
    requires: {
      employment: 'employed',
    },
    effects: {
      incomePercentOfNet: -20,
      durationPaydays: 3,
      setState: {
        employment: 'short_time',
      },
      group: 'employment',
    },
  },
  {
    id: 'L21',
    copies: 2,
    type: 'fate',
    title: {
      en: 'Lifestyle Creep',
      de: 'Lebensstil-Inflation',
    },
    story: {
      en: 'A streaming service here, a delivery app there, nicer coffee. It adds up.',
      de: 'Hier ein Streamingdienst, da eine Liefer-App, besserer Kaffee. Das läppert sich.',
    },
    links: [],
    effects: {
      monthlyMinor: 8000,
      removeCostMinor: 2000,
    },
  },
  {
    id: 'L22',
    copies: 2,
    type: 'giving',
    title: {
      en: 'Give 10%',
      de: 'Gib 10 %',
    },
    story: {
      en: 'A cause you care about asks for support.',
      de: 'Ein Anliegen, das dir wichtig ist, bittet um Unterstützung.',
    },
    links: [],
    give: {
      oneTimePercentOfNet: -10,
      rewardTurns: 3,
    },
  },
  {
    id: 'L23',
    copies: 1,
    type: 'giving',
    title: {
      en: 'Help a Friend Move',
      de: 'Umzugshilfe',
    },
    story: {
      en: 'Saturday, fourth floor, no lift. You bring the pizza.',
      de: 'Samstag, vierter Stock, kein Aufzug. Du bringst die Pizza mit.',
    },
    links: [],
    give: {
      oneTimeMinor: -4000,
      rewardTurns: 2,
    },
  },
  {
    id: 'L24',
    copies: 1,
    type: 'giving',
    title: {
      en: 'Family in Need',
      de: 'Familie in Not',
    },
    story: {
      en: "Your cousin lost her job and can't make rent this month.",
      de: 'Deine Cousine hat ihren Job verloren und kann diesen Monat die Miete nicht zahlen.',
    },
    links: [],
    give: {
      oneTimeMinor: -50000,
      rewardTurns: 4,
    },
    lend: {
      oneTimeMinor: -50000,
      lendReturn: {
        from: 4,
        amountMinor: 50000,
      },
    },
  },
  {
    id: 'L25',
    copies: 1,
    type: 'giving',
    title: {
      en: 'Sponsorship',
      de: 'Patenschaft',
    },
    story: {
      en: "A monthly sponsorship for a child's schooling. Small for you, big for them.",
      de: 'Eine monatliche Patenschaft für die Schulbildung eines Kindes. Klein für dich, groß für sie.',
    },
    links: [],
    give: {
      monthlyMinor: 3000,
      ongoingReward: true,
      removeCostMinor: 0,
    },
  },
  {
    id: 'L26',
    copies: 1,
    type: 'choice',
    title: {
      en: 'Gym Membership',
      de: 'Fitnessstudio',
    },
    story: {
      en: 'New year, new you. The gym has a student offer.',
      de: 'Neues Jahr, neues Ich. Das Fitnessstudio hat ein Studi-Angebot.',
    },
    links: [],
    accept: {
      monthlyMinor: 3500,
      minPaydays: 12,
    },
  },
];
