/**
 * The Dreamfund Emergency stack (JFK, 2026-10-25, temp_cards/dreamfund-emergency-deck.md v0.2): 45 cards in English and German. Amounts are
 * in minor units of the game money (Dream Taler / Traumtaler, 1 DT = 1 EUR). Generated from the card notes; edit the cards here.
 * Kept out of the domain package's main entry like the other printed content (the Firebase edition ships none of it).
 */
import type { EmergencyCard } from './cashflow-game/emergency-deck';

export const EMERGENCY_CARDS: EmergencyCard[] = [
  {
    id: 'E01',
    tier: 'spark',
    category: 'liability',
    type: 'fixed',
    payment: 'pay_now',
    insurance: 'liability',
    title: {
      en: "Friend's Bike Grip",
      de: 'Lenkergriff vom Freund',
    },
    story: {
      en: "You knocked your friend's bike over while locking yours. The handlebar grip and bell are broken. Fair is fair.",
      de: 'Beim Abschließen hast du das Rad deines Freundes umgestoßen. Lenkergriff und Klingel sind hin. Ehrensache.',
    },
    stat: {
      en: 'Bicycle damage ~5.2% of private liability claims (2024).',
      de: 'Fahrradschäden machen ca. 5,2 % der Privathaftpflicht-Schäden aus (2024).',
    },
    insuranceNote: {
      en: 'Liability insurance covers damage to others; small amounts are usually paid yourself.',
      de: 'Die Haftpflicht deckt Schäden bei anderen; kleine Beträge zahlt man meist selbst.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Grip and bell',
          de: 'Griff und Klingel',
        },
        amountMinor: 5000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Apologise and offer to pay immediately',
          de: 'Entschuldige dich und biete sofort an zu zahlen',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Buy the replacement part together or transfer the money',
          de: 'Kauft das Ersatzteil gemeinsam oder überweise das Geld',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'CHECK24 – most common liability claims',
          de: 'CHECK24 – häufigste Haftpflichtschäden',
        },
        url: 'https://www.check24.de/privathaftpflicht/die-haeufigsten-privathaftpflichtschaeden/',
      },
    ],
  },
  {
    id: 'E02',
    tier: 'spark',
    category: 'mobility',
    type: 'fixed',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Flat Tyre',
      de: 'Platten',
    },
    story: {
      en: 'Glass shard, Monday morning, 8 km to work. New tube and a repair kit.',
      de: 'Glasscherbe, Montagmorgen, 8 km bis zur Arbeit. Neuer Schlauch und Reparaturset.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Tube and repair kit',
          de: 'Schlauch und Reparaturset',
        },
        amountMinor: 2500,
      },
    ],
    actions: [
      {
        text: {
          en: 'Learn to repair a flat yourself',
          de: 'Lerne, einen Platten selbst zu reparieren',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Consider puncture-resistant tyres',
          de: 'Pannensichere Reifen in Betracht ziehen',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E03',
    tier: 'spark',
    category: 'fees',
    type: 'dice',
    payment: 'pay_now',
    title: {
      en: 'Caught Without a Ticket',
      de: 'Ohne Ticket erwischt',
    },
    story: {
      en: "Your phone died, your digital ticket with it. The inspector doesn't care.",
      de: 'Handy-Akku leer, Deutschlandticket weg. Der Kontrolleur sieht das anders.',
    },
    stat: {
      en: 'MVV increased fare 60 €, reduced to 7 € with proof of a personal ticket within 14 days.',
      de: 'MVV: erhöhtes Beförderungsentgelt 60 €, mit Nachweis des persönlichen Tickets innerhalb von 14 Tagen nur 7 €.',
    },
    dice: [
      {
        from: 1,
        to: 3,
        amountMinor: 700,
      },
      {
        from: 4,
        to: 6,
        amountMinor: 6000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Increased fare',
          de: 'Erhöhtes Beförderungsentgelt',
        },
        amountMinor: 6000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Submit proof of your personal ticket within 14 days',
          de: 'Reiche den Nachweis deines persönlichen Tickets innerhalb von 14 Tagen ein',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Carry a power bank for digital tickets',
          de: 'Trage eine Powerbank für digitale Tickets bei dir',
        },
        priority: 'low',
      },
    ],
    links: [
      {
        label: {
          en: 'MVV – erhöhtes Beförderungsentgelt',
          de: 'MVV – erhöhtes Beförderungsentgelt',
        },
        url: 'https://www.mvv-muenchen.de/service-hilfe/erhoehtes-befoerderungsentgelt',
      },
    ],
  },
  {
    id: 'E04',
    tier: 'spark',
    category: 'admin',
    type: 'multi',
    payment: 'pay_now',
    title: {
      en: 'Lost ID Card',
      de: 'Ausweis verloren',
    },
    story: {
      en: 'Wallet gone after a night out. New ID card, new photos, a morning at the Bürgerbüro.',
      de: 'Geldbeutel nach dem Feiern weg. Neuer Ausweis, neue Fotos, ein Vormittag im Bürgerbüro.',
    },
    stat: {
      en: 'Personalausweis fee 46 € (age 24+) since February 2026, previously 37 €.',
      de: 'Personalausweis: 46 € (ab 24 Jahren) seit Februar 2026, vorher 37 €.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'ID card fee',
          de: 'Gebühr Personalausweis',
        },
        amountMinor: 4600,
      },
      {
        id: 'b2',
        title: {
          en: 'Biometric photos',
          de: 'Biometrische Fotos',
        },
        amountMinor: 1500,
      },
    ],
    actions: [
      {
        text: {
          en: 'Report the loss to the Bürgerbüro or police',
          de: 'Melde den Verlust im Bürgerbüro oder bei der Polizei',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Block bank cards via 116 116',
          de: 'Sperre Bankkarten über 116 116',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Book an appointment for a new ID',
          de: 'Buche einen Termin für den neuen Ausweis',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Nordkurier – 46 statt 37 Euro',
          de: 'Nordkurier – 46 statt 37 Euro',
        },
        url: 'https://www.nordkurier.de/regional/schwerin/46-statt-37-euro-gebuehren-fuer-neuen-ausweis-sorgen-fuer-frust-4459650',
      },
    ],
  },
  {
    id: 'E05',
    tier: 'spark',
    category: 'fees',
    type: 'fixed',
    payment: 'pay_now',
    requires: 'car',
    title: {
      en: 'Flashed!',
      de: 'Geblitzt!',
    },
    story: {
      en: '18 km/h too fast in a 30 zone. The photo is not your best side.',
      de: '18 km/h zu schnell in der 30er-Zone. Das Foto zeigt nicht deine beste Seite.',
    },
    stat: {
      en: 'Inside town: 16–20 km/h over = 15–35 €, 21–25 km/h = 80 € + 1 point.',
      de: 'Innerorts: 16–20 km/h zu schnell = 15–35 €, 21–25 km/h = 80 € + 1 Punkt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Speeding fine',
          de: 'Bußgeld wegen Geschwindigkeit',
        },
        amountMinor: 3500,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check the notice for errors',
          de: 'Prüfe den Bescheid auf Fehler',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Pay within the deadline',
          de: 'Zahle innerhalb der Frist',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'Bußgeldkatalog 2026',
          de: 'Bußgeldkatalog 2026',
        },
        url: 'https://www.bussgeldrechner.org/bussgeldkatalog.html',
      },
    ],
  },
  {
    id: 'E06',
    tier: 'spark',
    category: 'admin',
    type: 'fixed',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Dunning Letter',
      de: 'Mahnung',
    },
    story: {
      en: "You forgot an invoice from three months ago. Now there's a reminder fee on top.",
      de: 'Eine Rechnung von vor drei Monaten vergessen. Jetzt kommt die Mahngebühr obendrauf.',
    },
    modifier: {
      when: 'openEmergency',
      addMinor: 1000,
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Reminder fee and interest',
          de: 'Mahngebühr und Zinsen',
        },
        amountMinor: 3000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Pay the original amount immediately',
          de: 'Zahle den ursprünglichen Betrag sofort',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Use direct debit or reminders for recurring bills',
          de: 'Nutze Lastschrift oder Erinnerungen für wiederkehrende Rechnungen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'E07',
    tier: 'spark',
    category: 'tech',
    type: 'fixed',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Lost Earbud',
      de: 'Kopfhörer verloren',
    },
    story: {
      en: 'One earbud fell into the gap between U-Bahn and platform.',
      de: 'Ein Ohrhörer ist zwischen U-Bahn und Bahnsteig gefallen.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Replacement earbud',
          de: 'Ersatz-Ohrhörer',
        },
        amountMinor: 8000,
      },
    ],
    actions: [
      {
        text: {
          en: "Ask the operator's lost & found",
          de: 'Frage beim Fundbüro des Verkehrsbetriebs nach',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Compare single-earbud replacement vs. new set',
          de: 'Vergleiche einen einzelnen Ersatz-Ohrhörer mit einem neuen Set',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E39',
    tier: 'spark',
    category: 'health',
    type: 'multi',
    payment: 'pay_now',
    title: {
      en: 'Three Nights in Hospital',
      de: 'Drei Nächte im Krankenhaus',
    },
    story: {
      en: 'Appendix. Surgery went fine. Then the co-payment letter arrives.',
      de: 'Blinddarm. Die OP lief gut. Dann kommt der Brief mit der Zuzahlung.',
    },
    stat: {
      en: 'Statutory co-payment: 10 € per hospital day, max 28 days per year.',
      de: 'Gesetzliche Zuzahlung: 10 € pro Krankenhaustag, höchstens 28 Tage im Jahr.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Hospital co-payment (3 days)',
          de: 'Zuzahlung Krankenhaus (3 Tage)',
        },
        amountMinor: 3000,
      },
      {
        id: 'b2',
        title: {
          en: 'Phone and TV',
          de: 'Telefon und Fernseher',
        },
        amountMinor: 1500,
      },
    ],
    actions: [
      {
        text: {
          en: 'Keep co-payment receipts (annual cap)',
          de: 'Bewahre die Belege der Zuzahlungen auf (jährliche Obergrenze)',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Inform your employer and send the sick note',
          de: 'Informiere deinen Arbeitgeber und schicke die Krankmeldung',
        },
        priority: 'high',
      },
    ],
    links: [],
  },
  {
    id: 'E41',
    tier: 'spark',
    category: 'admin',
    type: 'fixed',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Forgotten Free Trial',
      de: 'Probeabo vergessen',
    },
    story: {
      en: '"Free for 30 days." That was 13 months ago. The annual renewal just went through.',
      de: '"30 Tage kostenlos." Das war vor 13 Monaten. Die Jahresverlängerung wurde gerade abgebucht.',
    },
    stat: {
      en: 'Online contracts must offer a cancellation button; since March 2022 auto-renewals can be cancelled monthly after the initial term.',
      de: 'Online-Verträge müssen einen Kündigungsbutton bieten; seit März 2022 sind stillschweigende Verlängerungen nach der Erstlaufzeit monatlich kündbar.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Annual renewal',
          de: 'Jahresverlängerung',
        },
        amountMinor: 9000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Cancel via the cancellation button',
          de: 'Kündige über den Kündigungsbutton',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Ask for a pro-rata refund',
          de: 'Bitte um anteilige Erstattung',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Set a calendar reminder for every free trial',
          de: 'Setze dir für jede Probezeit eine Kalender-Erinnerung',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E42',
    tier: 'spark',
    category: 'health',
    type: 'multi',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Sprained Ankle Bouldering',
      de: 'Knöchel umgeknickt',
    },
    story: {
      en: 'Bad landing from the top. Two weeks with a brace and six physio sessions.',
      de: 'Blöd gelandet. Zwei Wochen Schiene und sechs Physio-Termine.',
    },
    stat: {
      en: 'Physiotherapy co-payment: 10% of cost + 10 € per prescription.',
      de: 'Zuzahlung Physiotherapie: 10 % der Kosten + 10 € pro Verordnung.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Physio co-payment',
          de: 'Zuzahlung Physiotherapie',
        },
        amountMinor: 2500,
      },
      {
        id: 'b2',
        title: {
          en: 'Taxi',
          de: 'Taxi',
        },
        amountMinor: 2500,
      },
      {
        id: 'b3',
        title: {
          en: 'Brace',
          de: 'Bandage',
        },
        amountMinor: 2000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Have a doctor check for a fracture',
          de: 'Lass beim Arzt einen Bruch ausschließen',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Keep co-payment receipts',
          de: 'Bewahre die Belege der Zuzahlungen auf',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E08',
    tier: 'flame',
    category: 'home',
    type: 'dice',
    payment: 'pay_now',
    title: {
      en: 'Locked Out',
      de: 'Ausgesperrt',
    },
    story: {
      en: "The door clicks shut. Keys on the kitchen table. It's late.",
      de: 'Die Tür fällt ins Schloss. Schlüssel auf dem Küchentisch. Es ist spät.',
    },
    stat: {
      en: 'Fair price ~100 € by day, ~180 € at night/weekend; rip-offs up to 1,000 €.',
      de: 'Fairer Preis ca. 100 € tagsüber, ca. 180 € nachts/am Wochenende; Wucher bis zu 1.000 €.',
    },
    dice: [
      {
        from: 1,
        to: 3,
        amountMinor: 10000,
      },
      {
        from: 4,
        to: 5,
        amountMinor: 18000,
      },
      {
        from: 6,
        to: 6,
        amountMinor: 43000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Locksmith',
          de: 'Schlüsseldienst',
        },
        amountMinor: 10000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Leave a spare key with a trusted neighbour',
          de: 'Hinterlege einen Ersatzschlüssel bei einem vertrauenswürdigen Nachbarn',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Agree a fixed price by phone first',
          de: 'Vereinbare vorher telefonisch einen Festpreis',
        },
        priority: 'high',
      },
      {
        text: {
          en: "Don't pay inflated bills in cash on the spot",
          de: 'Bezahle überhöhte Rechnungen nicht sofort bar',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'Verbraucherzentrale Hamburg – Schlüsseldienst',
          de: 'Verbraucherzentrale Hamburg – Schlüsseldienst',
        },
        url: 'https://www.vzhh.de/themen/einkauf-reise-freizeit/schluesseldienst/ausgesperrt-abgezockt-vom-schluesseldienst',
      },
    ],
  },
  {
    id: 'E09',
    tier: 'flame',
    category: 'tech',
    type: 'choice',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Cracked Phone Screen',
      de: 'Display gesprungen',
    },
    story: {
      en: 'Face down on the pavement. The crack runs right through your lock screen.',
      de: 'Mit dem Display aufs Pflaster. Der Riss geht quer übers Bild.',
    },
    choices: [
      {
        id: 'A',
        label: {
          en: 'Independent repair shop',
          de: 'Freie Werkstatt',
        },
        amountMinor: 15000,
      },
      {
        id: 'B',
        label: {
          en: 'Manufacturer repair',
          de: 'Hersteller-Reparatur',
        },
        amountMinor: 30000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check device insurance or care plan',
          de: 'Prüfe Geräteversicherung oder Schutzbrief',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Back up the phone before repair',
          de: 'Sichere das Handy vor der Reparatur',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'monsterdealz – Apple repair costs 2026',
          de: 'monsterdealz – Apple-Reparaturkosten 2026',
        },
        url: 'https://www.monsterdealz.de/magazin/apple-reparatur-kosten',
      },
    ],
  },
  {
    id: 'E10',
    tier: 'flame',
    category: 'health',
    type: 'fixed',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Broken Glasses',
      de: 'Brille kaputt',
    },
    story: {
      en: 'You sat on them. Of course you did.',
      de: 'Du hast dich draufgesetzt. Natürlich.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'New glasses',
          de: 'Neue Brille',
        },
        amountMinor: 25000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Ask the optician whether a repair is possible',
          de: 'Frage den Optiker, ob eine Reparatur möglich ist',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Keep an old pair as backup',
          de: 'Behalte eine alte Brille als Ersatz',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E11',
    tier: 'flame',
    category: 'liability',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'liability',
    estimate: true,
    title: {
      en: "Drink on a Friend's Phone",
      de: 'Getränk aufs Handy',
    },
    story: {
      en: "You knocked over your Spezi. Straight onto your friend's phone.",
      de: 'Du hast dein Spezi umgestoßen. Direkt auf das Handy deines Kumpels.',
    },
    stat: {
      en: 'Phones are the #1 private liability claim (~14.9% of claims, 2024).',
      de: 'Handys sind der häufigste Haftpflichtschaden (ca. 14,9 % der Schäden, 2024).',
    },
    insuranceNote: {
      en: "Phones are the most common liability claim; liability insurance pays the phone's time value.",
      de: 'Handys sind der häufigste Haftpflichtschaden; die Haftpflicht zahlt den Zeitwert.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Phone repair or replacement',
          de: 'Handyreparatur oder Ersatz',
        },
        amountMinor: 30000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Report to your liability insurance',
          de: 'Melde es deiner Haftpflichtversicherung',
        },
        priority: 'high',
      },
      {
        text: {
          en: "Turn the phone off, don't charge it",
          de: 'Schalte das Handy aus und lade es nicht',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'CHECK24 – most common liability claims',
          de: 'CHECK24 – häufigste Haftpflichtschäden',
        },
        url: 'https://www.check24.de/privathaftpflicht/die-haeufigsten-privathaftpflichtschaeden/',
      },
    ],
  },
  {
    id: 'E12',
    tier: 'flame',
    category: 'mobility',
    type: 'fixed',
    payment: 'pay_now',
    requires: 'car',
    estimate: true,
    title: {
      en: 'Car Battery Dead',
      de: 'Autobatterie leer',
    },
    story: {
      en: 'First frosty morning. Click. Click. Nothing.',
      de: 'Erster Frostmorgen. Klick. Klick. Nichts.',
    },
    stat: {
      en: 'Starter battery = 44.9% of 3.6 million ADAC breakdown call-outs (2024).',
      de: 'Die Starterbatterie ist bei 44,9 % der 3,6 Millionen Pannenhilfe-Einsätze des ADAC (2024) schuld.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'New starter battery',
          de: 'Neue Starterbatterie',
        },
        amountMinor: 18000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Call breakdown assistance',
          de: 'Rufe die Pannenhilfe',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Test the battery before winter',
          de: 'Teste die Batterie vor dem Winter',
        },
        priority: 'low',
      },
    ],
    links: [
      {
        label: {
          en: 'autozeitung – ADAC Pannenstatistik',
          de: 'autozeitung – ADAC-Pannenstatistik',
        },
        url: 'https://www.autozeitung.de/adac-pannenstatistik-198310.html',
      },
    ],
  },
  {
    id: 'E13',
    tier: 'flame',
    category: 'health',
    type: 'choice',
    payment: 'plan_ok',
    title: {
      en: 'Dental Crown',
      de: 'Zahnkrone',
    },
    story: {
      en: "That ache in your molar wasn't nothing. You need a crown.",
      de: 'Der Schmerz im Backenzahn war doch was. Eine Krone muss her.',
    },
    stat: {
      en: 'Metal crown own share 2025: 152.84 € (no bonus), 114.63 € (5 years), 95.52 € (10 years).',
      de: 'Eigenanteil Metallkrone 2025: 152,84 € (ohne Bonus), 114,63 € (5 Jahre), 95,52 € (10 Jahre).',
    },
    choices: [
      {
        id: 'A',
        label: {
          en: 'Standard metal crown',
          de: 'Regelversorgung (Metall)',
        },
        amountMinor: 15000,
        traitAmount: {
          trait: 'bonusheft',
          amountMinor: 11500,
        },
      },
      {
        id: 'B',
        label: {
          en: 'Full ceramic crown',
          de: 'Vollkeramikkrone',
        },
        amountMinor: 60000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Ask for a Heil- und Kostenplan before treatment',
          de: 'Verlange vor der Behandlung einen Heil- und Kostenplan',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Keep the bonus booklet complete with yearly check-ups',
          de: 'Halte das Bonusheft mit den jährlichen Kontrollen vollständig',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Zahnkrone Kosten',
          de: 'Zahnkrone Kosten',
        },
        url: 'https://www.zahnzusatzversicherung-experten.de/zahnkrone-kosten-arten-vorteile-nachteile.html',
      },
    ],
  },
  {
    id: 'E14',
    tier: 'flame',
    category: 'home',
    type: 'choice',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Washing Machine Breaks',
      de: 'Waschmaschine kaputt',
    },
    story: {
      en: 'Error code E21, a puddle on the floor, and a drum full of wet laundry.',
      de: 'Fehlercode E21, eine Pfütze am Boden und eine Trommel voller nasser Wäsche.',
    },
    choices: [
      {
        id: 'A',
        label: {
          en: 'Repair',
          de: 'Reparieren',
        },
        amountMinor: 25000,
      },
      {
        id: 'B',
        label: {
          en: 'Replace',
          de: 'Neu kaufen',
        },
        amountMinor: 55000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Turn off the water tap',
          de: 'Drehe den Wasserhahn zu',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Check the 2-year statutory warranty',
          de: 'Prüfe die gesetzliche Gewährleistung von 2 Jahren',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'cash-online – >1 million water damages per year',
          de: 'cash-online – über 1 Million Wasserschäden pro Jahr',
        },
        url: 'https://www.cash-online.de/a/mehr-als-eine-million-leitungswasserschaeden-pro-jahr-warum-aeltere-gebaeude-das-groesste-risiko-tragen-723101/',
      },
    ],
  },
  {
    id: 'E15',
    tier: 'flame',
    category: 'liability',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'liability',
    estimate: true,
    title: {
      en: 'Knocked Off a Car Mirror',
      de: 'Spiegel abgefahren',
    },
    story: {
      en: 'Squeezing past a parked car on your bike. Crack. The mirror dangles.',
      de: 'Mit dem Rad am parkenden Auto vorbei. Knack. Der Spiegel baumelt.',
    },
    stat: {
      en: 'Cars are the #2 private liability claim (~11.6%, 2024).',
      de: 'Autos sind der zweithäufigste Haftpflichtschaden (ca. 11,6 %, 2024).',
    },
    insuranceNote: {
      en: 'Car damage quickly reaches four digits; liability insurance covers it.',
      de: 'Autoschäden erreichen schnell vierstellige Beträge; die Haftpflicht deckt sie.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Car mirror repair',
          de: 'Reparatur Außenspiegel',
        },
        amountMinor: 35000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Leave your details or call the police',
          de: 'Hinterlasse deine Daten oder rufe die Polizei',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to your liability insurance',
          de: 'Melde es deiner Haftpflichtversicherung',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'CHECK24 – most common liability claims',
          de: 'CHECK24 – häufigste Haftpflichtschäden',
        },
        url: 'https://www.check24.de/privathaftpflicht/die-haeufigsten-privathaftpflichtschaeden/',
      },
    ],
  },
  {
    id: 'E16',
    tier: 'flame',
    category: 'admin',
    type: 'dice',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Tax Back Payment',
      de: 'Steuernachzahlung',
    },
    story: {
      en: 'Your side gig income pushed you over. The tax office wants its share.',
      de: 'Dein Nebenjob hat dich drübergeschoben. Das Finanzamt will seinen Anteil.',
    },
    dice: [
      {
        from: 1,
        to: 2,
        amountMinor: 15000,
      },
      {
        from: 3,
        to: 4,
        amountMinor: 30000,
      },
      {
        from: 5,
        to: 6,
        amountMinor: 45000,
      },
    ],
    modifier: {
      when: 'sideGig',
      addMinor: 10000,
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Tax back payment',
          de: 'Steuernachzahlung',
        },
        amountMinor: 30000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check the Steuerbescheid within one month',
          de: 'Prüfe den Steuerbescheid innerhalb eines Monats',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Set aside part of side income for taxes',
          de: 'Lege einen Teil der Nebeneinkünfte für Steuern zurück',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'E32',
    tier: 'flame',
    category: 'travel',
    type: 'multi',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Flight Cancelled',
      de: 'Flug gestrichen',
    },
    story: {
      en: 'Your flight home is cancelled at midnight. Hotel, food, a new connection tomorrow — paid out of pocket for now.',
      de: 'Dein Rückflug wird um Mitternacht gestrichen. Hotel, Essen, neue Verbindung morgen — erst mal aus eigener Tasche.',
    },
    stat: {
      en: 'EU 261/2004: care duty plus 250–600 € compensation unless extraordinary circumstances.',
      de: 'EU 261/2004: Betreuungspflicht plus 250–600 € Entschädigung, außer bei außergewöhnlichen Umständen.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Hotel',
          de: 'Hotel',
        },
        amountMinor: 12000,
      },
      {
        id: 'b2',
        title: {
          en: 'Food and transport',
          de: 'Essen und Transport',
        },
        amountMinor: 6000,
      },
      {
        id: 'b3',
        title: {
          en: 'Rebooking difference',
          de: 'Umbuchungsdifferenz',
        },
        amountMinor: 7000,
      },
    ],
    upside: {
      amountMinor: 25000,
      condition: 'compensation',
    },
    actions: [
      {
        text: {
          en: 'Keep all receipts',
          de: 'Bewahre alle Belege auf',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Claim care costs and compensation from the airline',
          de: 'Fordere Betreuungskosten und Entschädigung von der Airline',
        },
        priority: 'high',
      },
    ],
    links: [],
  },
  {
    id: 'E33',
    tier: 'flame',
    category: 'home',
    type: 'multi',
    payment: 'pay_now',
    estimate: true,
    title: {
      en: 'Heating Fails in January',
      de: 'Heizung fällt im Januar aus',
    },
    story: {
      en: '14 °C in the living room. The landlord says the technician comes "next week".',
      de: '14 °C im Wohnzimmer. Der Vermieter sagt, der Techniker kommt "nächste Woche".',
    },
    stat: {
      en: 'Heating failure is a rental defect; rent reduction possible after reporting it.',
      de: 'Ein Heizungsausfall ist ein Mietmangel; nach Anzeige ist eine Mietminderung möglich.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Fan heater',
          de: 'Heizlüfter',
        },
        amountMinor: 4000,
      },
      {
        id: 'b2',
        title: {
          en: 'Extra electricity',
          de: 'Mehr Strom',
        },
        amountMinor: 8000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Report the defect in writing with a deadline',
          de: 'Zeige den Mangel schriftlich mit Fristsetzung an',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Document room temperatures',
          de: 'Dokumentiere die Raumtemperaturen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: "Ask a tenants' association before reducing rent",
          de: 'Frage einen Mieterverein, bevor du die Miete minderst',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'E36',
    tier: 'flame',
    category: 'liability',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'liability',
    estimate: true,
    title: {
      en: "A Colleague's Glasses",
      de: 'Die Brille vom Kollegen',
    },
    story: {
      en: "You swung your bag onto the desk. Your colleague's glasses were in the way.",
      de: 'Du hast deine Tasche auf den Tisch geschwungen. Die Brille vom Kollegen lag im Weg.',
    },
    stat: {
      en: 'Glasses ~4.8% of private liability claims (2024).',
      de: 'Brillen machen ca. 4,8 % der Privathaftpflicht-Schäden aus (2024).',
    },
    insuranceNote: {
      en: 'Glasses of others are a top-10 liability claim.',
      de: 'Brillen anderer gehören zu den Top 10 der Haftpflichtschäden.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: "Colleague's glasses",
          de: 'Brille der Kollegin',
        },
        amountMinor: 30000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Report to your liability insurance',
          de: 'Melde es deiner Haftpflichtversicherung',
        },
        priority: 'high',
      },
      {
        text: {
          en: "Ask for the optician's invoice",
          de: 'Verlange die Rechnung des Optikers',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'CHECK24 – most common liability claims',
          de: 'CHECK24 – häufigste Haftpflichtschäden',
        },
        url: 'https://www.check24.de/privathaftpflicht/die-haeufigsten-privathaftpflichtschaeden/',
      },
    ],
  },
  {
    id: 'E38',
    tier: 'flame',
    category: 'mobility',
    type: 'choice',
    payment: 'plan_ok',
    requires: 'car',
    estimate: true,
    title: {
      en: 'Parking Bump',
      de: 'Parkrempler',
    },
    story: {
      en: 'Reversing out of a tight spot. Scrape. Your bumper and the pillar both have a story now.',
      de: 'Rückwärts aus der engen Lücke. Kratz. Stoßstange und Säule haben jetzt eine Geschichte.',
    },
    stat: {
      en: 'Full cover deductibles of 300–500 € are common; paying small damage yourself avoids a downgrade.',
      de: 'Selbstbeteiligungen von 300–500 € in der Vollkasko sind üblich; kleine Schäden selbst zu zahlen vermeidet eine Hochstufung.',
    },
    choices: [
      {
        id: 'A',
        label: {
          en: 'Pay it yourself',
          de: 'Selbst zahlen',
        },
        amountMinor: 45000,
      },
      {
        id: 'B',
        label: {
          en: 'Claim full cover',
          de: 'Vollkasko melden',
        },
        amountMinor: 30000,
        afterEffect: {
          monthlyMinor: 1500,
          months: 12,
          line: {
            en: 'Car insurance premium',
            de: 'Beitrag Kfz-Versicherung',
          },
        },
      },
    ],
    actions: [
      {
        text: {
          en: 'Get a repair quote',
          de: 'Hole einen Kostenvoranschlag ein',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Compare quote vs. deductible + premium increase',
          de: 'Vergleiche den Kostenvoranschlag mit Selbstbeteiligung + höherer Prämie',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Allianz – Selbstbeteiligung',
          de: 'Allianz – Selbstbeteiligung',
        },
        url: 'https://www.allianz.de/auto/kfz-versicherung/selbstbeteiligung/',
      },
    ],
  },
  {
    id: 'E43',
    tier: 'flame',
    category: 'liability',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'liability',
    estimate: true,
    title: {
      en: 'Slammed Door, Broken Glass',
      de: 'Tür zugeknallt, Glas kaputt',
    },
    story: {
      en: "A gust of wind, a slam, and the glass insert of the rental flat's door lies on the floor.",
      de: 'Ein Windstoß, ein Knall, und der Glaseinsatz der Wohnungstür liegt am Boden.',
    },
    stat: {
      en: 'Doors ~11.2% of private liability claims (2024).',
      de: 'Türen machen ca. 11,2 % der Privathaftpflicht-Schäden aus (2024).',
    },
    insuranceNote: {
      en: 'Make sure liability insurance includes damage to rented property (Mietsachschäden).',
      de: 'Achte darauf, dass die Haftpflicht Mietsachschäden einschließt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Door glass',
          de: 'Türglas',
        },
        amountMinor: 40000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Tell the landlord',
          de: 'Sag es dem Vermieter',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to your liability insurance',
          de: 'Melde es deiner Haftpflichtversicherung',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'CHECK24 – most common liability claims',
          de: 'CHECK24 – häufigste Haftpflichtschäden',
        },
        url: 'https://www.check24.de/privathaftpflicht/die-haeufigsten-privathaftpflichtschaeden/',
      },
    ],
  },
  {
    id: 'E44',
    tier: 'flame',
    category: 'home',
    type: 'fixed',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Storm on the Balcony',
      de: 'Sturm auf dem Balkon',
    },
    story: {
      en: "The night's storm took your balcony chairs, the parasol and half the plants.",
      de: 'Der Sturm in der Nacht hat Balkonstühle, Sonnenschirm und die Hälfte der Pflanzen mitgenommen.',
    },
    stat: {
      en: 'Household insurance covers storm from wind force 8; loose balcony items often excluded.',
      de: 'Die Hausrat deckt Sturm ab Windstärke 8; lose Balkonsachen sind oft ausgeschlossen.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Balcony furniture and plants',
          de: 'Balkonmöbel und Pflanzen',
        },
        amountMinor: 30000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Secure balcony items before storms',
          de: 'Sichere Balkonsachen vor Stürmen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Check what your household policy covers outside',
          de: 'Prüfe, was deine Hausratversicherung draußen deckt',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E17',
    tier: 'blaze',
    category: 'tech',
    type: 'choice',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Laptop Dies Before Exams',
      de: 'Laptop stirbt vor der Prüfung',
    },
    story: {
      en: 'Two weeks before your exams, the screen goes black and stays black.',
      de: 'Zwei Wochen vor den Prüfungen wird der Bildschirm schwarz. Und bleibt es.',
    },
    stat: {
      en: '18% of US adults had a phone/computer surprise expense, typically $500–1,000.',
      de: '18 % der US-Erwachsenen hatten eine unerwartete Handy-/Computerausgabe, typischerweise 500–1.000 $.',
    },
    choices: [
      {
        id: 'A',
        label: {
          en: 'Repair (2 weeks without)',
          de: 'Reparieren (2 Wochen ohne)',
        },
        amountMinor: 35000,
        sideEffect: 'skipNextCareer',
      },
      {
        id: 'B',
        label: {
          en: 'Buy new now',
          de: 'Sofort neu kaufen',
        },
        amountMinor: 95000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Back up regularly',
          de: 'Sichere regelmäßig deine Daten',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Ask employer/university for a loan device',
          de: 'Frage Arbeitgeber/Uni nach einem Leihgerät',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'SoFi – most common surprise expenses',
          de: 'SoFi – häufigste unerwartete Ausgaben',
        },
        url: 'https://www.sofi.com/article/money-life/the-most-common-surprise-expenses-and-what-they-cost/',
      },
    ],
  },
  {
    id: 'E18',
    tier: 'blaze',
    category: 'mobility',
    type: 'dice',
    payment: 'plan_ok',
    insurance: 'household_bike',
    title: {
      en: 'Bike Stolen',
      de: 'Fahrrad geklaut',
    },
    story: {
      en: "The lock is still there. Cut clean through. The bike isn't.",
      de: 'Das Schloss liegt noch da. Glatt durchtrennt. Das Rad nicht.',
    },
    stat: {
      en: '2024: ~246,000 police-recorded bike thefts, <10% solved; ~135,000 insured thefts, avg 1,190 €.',
      de: '2024: ca. 246.000 polizeilich erfasste Fahrraddiebstähle, <10 % aufgeklärt; ca. 135.000 versicherte Diebstähle, im Schnitt 1.190 €.',
    },
    insuranceNote: {
      en: 'Bikes stolen outside the flat need a bike add-on to household insurance.',
      de: 'Außerhalb der Wohnung gestohlene Fahrräder brauchen eine Fahrradklausel in der Hausratversicherung.',
    },
    dice: [
      {
        from: 1,
        to: 3,
        amountMinor: 40000,
      },
      {
        from: 4,
        to: 5,
        amountMinor: 90000,
      },
      {
        from: 6,
        to: 6,
        amountMinor: 250000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Replacement bike',
          de: 'Ersatzfahrrad',
        },
        amountMinor: 90000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Report the theft to the police',
          de: 'Zeige den Diebstahl bei der Polizei an',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Write down your frame number',
          de: 'Notiere deine Rahmennummer',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'ZDFheute – Fahrraddiebstahl 2024',
          de: 'ZDFheute – Fahrraddiebstahl 2024',
        },
        url: 'https://www.zdfheute.de/panorama/kriminalitaet/fahrrad-diebstahl-zahlen-2024-100.html',
      },
      {
        label: {
          en: 'Verbraucherzentrale NRW – Fahrradversicherung',
          de: 'Verbraucherzentrale NRW – Fahrradversicherung',
        },
        url: 'https://www.verbraucherzentrale.nrw/wissen/geld-versicherungen/weitere-versicherungen/fahrradversicherung-welcher-versicherungsschutz-ist-notwendig-13647',
      },
    ],
  },
  {
    id: 'E19',
    tier: 'blaze',
    category: 'mobility',
    type: 'choice',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_partial',
    title: {
      en: 'Cracked Windscreen',
      de: 'Steinschlag',
    },
    story: {
      en: 'A tiny stone on the motorway. Two days later the chip is a crack.',
      de: 'Ein kleiner Stein auf der Autobahn. Zwei Tage später ist aus dem Steinschlag ein Riss geworden.',
    },
    stat: {
      en: '~2.2 million car glass claims per year, avg ~900 € (+7% in a year).',
      de: 'Ca. 2,2 Millionen Glasschäden am Auto pro Jahr, im Schnitt ca. 900 € (+7 % in einem Jahr).',
    },
    choices: [
      {
        id: 'A',
        label: {
          en: 'Repair the chip now',
          de: 'Steinschlag sofort reparieren',
        },
        amountMinor: 10000,
      },
      {
        id: 'B',
        label: {
          en: 'Wait and see',
          de: 'Abwarten',
        },
        amountMinor: 0,
        deferredDice: [
          {
            from: 1,
            to: 3,
            amountMinor: 90000,
          },
          {
            from: 4,
            to: 6,
            amountMinor: 0,
          },
        ],
      },
    ],
    actions: [
      {
        text: {
          en: 'Repair a chip immediately',
          de: 'Lass einen Steinschlag sofort reparieren',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'auto motor und sport – Glasbruch teuer wie nie',
          de: 'auto motor und sport – Glasbruch teuer wie nie',
        },
        url: 'https://www.auto-motor-und-sport.de/verkehr/glasbruch-an-autos-windschutzscheiben-und-bremsleuchten-teuer-wie-nie/',
      },
    ],
  },
  {
    id: 'E20',
    tier: 'blaze',
    category: 'home',
    type: 'dice',
    payment: 'plan_ok',
    title: {
      en: 'Utility Back Payment',
      de: 'Nebenkostennachzahlung',
    },
    story: {
      en: 'The annual utility bill arrives. Heating got expensive, and nobody told you.',
      de: "Die Nebenkostenabrechnung ist da. Heizen wurde teuer, und keiner hat's dir gesagt.",
    },
    stat: {
      en: '2025: ~1,700 € heating and hot water for 95 m² (gas/district heating).',
      de: '2025: ca. 1.700 € Heizung und Warmwasser für 95 m² (Gas/Fernwärme).',
    },
    dice: [
      {
        from: 1,
        to: 2,
        amountMinor: 30000,
      },
      {
        from: 3,
        to: 4,
        amountMinor: 60000,
      },
      {
        from: 5,
        to: 5,
        amountMinor: 100000,
      },
      {
        from: 6,
        to: 6,
        amountMinor: 180000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Back payment',
          de: 'Nachzahlung',
        },
        amountMinor: 60000,
      },
    ],
    afterEffect: {
      monthlyMinor: 2500,
      line: {
        en: 'rent advance',
        de: 'Abschlag erhöht',
      },
    },
    actions: [
      {
        text: {
          en: 'Check deadlines, meter readings and distribution key',
          de: 'Prüfe Fristen, Zählerstände und Verteilerschlüssel',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Raise your monthly advance payment',
          de: 'Erhöhe deinen monatlichen Abschlag',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Heating costs winter 2025/26',
          de: 'Heizkosten Winter 2025/26',
        },
        url: 'https://msingermany.com/blog/heating-costs-germany-winter-2025-26',
      },
    ],
  },
  {
    id: 'E21',
    tier: 'blaze',
    category: 'home',
    type: 'dice',
    payment: 'pay_now',
    title: {
      en: 'Deposit Deductions',
      de: 'Kaution einbehalten',
    },
    story: {
      en: 'You moved out. The landlord keeps part of your deposit for "repairs".',
      de: 'Du bist ausgezogen. Der Vermieter behält einen Teil der Kaution für "Reparaturen".',
    },
    dice: [
      {
        from: 1,
        to: 2,
        amountMinor: 20000,
      },
      {
        from: 3,
        to: 5,
        amountMinor: 50000,
      },
      {
        from: 6,
        to: 6,
        amountMinor: 90000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Deposit deduction',
          de: 'Kautionsabzug',
        },
        amountMinor: 50000,
      },
    ],
    reroll: {
      costMinor: 9000,
      label: {
        en: "Join a tenants' association",
        de: 'Mieterverein beitreten',
      },
    },
    actions: [
      {
        text: {
          en: 'Make a written handover protocol with photos',
          de: 'Erstelle ein schriftliches Übergabeprotokoll mit Fotos',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Contest unjustified deductions in writing',
          de: 'Widerspreche ungerechtfertigten Abzügen schriftlich',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'WG-Gesucht – Rückzahlung der Mietkaution',
          de: 'WG-Gesucht – Rückzahlung der Mietkaution',
        },
        url: 'https://www.wg-gesucht.de/service/umzug-and-wohnen/umzug-rueckzahlung-der-mietkaution-fristen-abzuege-and-rechte',
      },
    ],
  },
  {
    id: 'E22',
    tier: 'blaze',
    category: 'social',
    type: 'fixed',
    payment: 'pay_now',
    title: {
      en: 'The Loan That Never Came Back',
      de: 'Das Geld siehst du nie wieder',
    },
    story: {
      en: '"Just till next month," he said. That was a year ago. He stopped answering.',
      de: '"Nur bis nächsten Monat", hat er gesagt. Das ist ein Jahr her. Er antwortet nicht mehr.',
    },
    stat: {
      en: 'Up to 1,000 €, most people borrow from family and friends (YouGov/Barclays 2024).',
      de: 'Bis zu 1.000 € leihen sich die meisten bei Familie und Freunden (YouGov/Barclays 2024).',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Lost loan',
          de: 'Verlorenes Darlehen',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Only lend what you can afford to lose',
          de: 'Verleihe nur, was du verschmerzen kannst',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Write down amount and repayment date',
          de: 'Schreibe Betrag und Rückzahlungsdatum auf',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 't-online – Jeder Vierte pumpt sich Geld',
          de: 't-online – Jeder Vierte pumpt sich Geld',
        },
        url: 'https://www.t-online.de/finanzen/aktuelles/id_100423870/jeder-vierte-pumpt-sich-geld.html',
      },
    ],
  },
  {
    id: 'E23',
    tier: 'blaze',
    category: 'health_pet',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'pet',
    title: {
      en: 'Vet Emergency',
      de: 'Tierarzt-Notfall',
    },
    story: {
      en: "Saturday night, your cat ate a hair tie. The emergency vet is open. Of course it's expensive.",
      de: "Samstagnacht, die Katze hat ein Haargummi gefressen. Der Notdienst hat offen. Billig wird's nicht.",
    },
    stat: {
      en: 'Emergency fee up to 4× GOT rate, surcharge 59.50 €; dog cruciate ligament surgery ~2,000–3,000 €.',
      de: 'Notdienstgebühr bis zum 4-fachen GOT-Satz, Zuschlag 59,50 €; Kreuzband-OP beim Hund ca. 2.000–3.000 €.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Emergency surcharge',
          de: 'Notdienst-Zuschlag',
        },
        amountMinor: 6000,
      },
      {
        id: 'b2',
        title: {
          en: 'Treatment',
          de: 'Behandlung',
        },
        amountMinor: 90000,
        dice: [
          {
            from: 1,
            to: 3,
            amountMinor: 30000,
          },
          {
            from: 4,
            to: 5,
            amountMinor: 90000,
          },
          {
            from: 6,
            to: 6,
            amountMinor: 250000,
          },
        ],
      },
    ],
    actions: [
      {
        text: {
          en: "Save the nearest emergency vet's number",
          de: 'Speichere die Nummer des nächsten Tiernotdienstes',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Consider pet surgery insurance',
          de: 'Erwäge eine Tier-OP-Versicherung',
        },
        priority: 'low',
      },
    ],
    links: [
      {
        label: {
          en: 'Stuttgarter Zeitung – Tierarztkosten',
          de: 'Stuttgarter Zeitung – Tierarztkosten',
        },
        url: 'https://www.stuttgarter-zeitung.de/wissen/tierarztkosten-hund-tabelle-ueberblick-mhsd-78870854.html',
      },
    ],
  },
  {
    id: 'E24',
    tier: 'blaze',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Fridge Dies in Summer',
      de: 'Kühlschrank stirbt im Sommer',
    },
    story: {
      en: '32 °C outside. The fridge is silent.',
      de: '32 °C draußen. Der Kühlschrank schweigt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'New fridge',
          de: 'Neuer Kühlschrank',
        },
        amountMinor: 50000,
      },
      {
        id: 'b2',
        title: {
          en: 'Spoiled food',
          de: 'Verdorbene Lebensmittel',
        },
        amountMinor: 6000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check the warranty',
          de: 'Prüfe die Garantie',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Compare energy efficiency, not only price',
          de: 'Vergleiche die Energieeffizienz, nicht nur den Preis',
        },
        priority: 'low',
      },
    ],
    links: [],
  },
  {
    id: 'E31',
    tier: 'blaze',
    category: 'tech',
    type: 'multi',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Phone Stolen Abroad',
      de: 'Handy im Urlaub geklaut',
    },
    story: {
      en: 'A crowded metro in Barcelona. A bump, a smile, and your pocket is empty.',
      de: 'Volle Metro in Barcelona. Ein Rempler, ein Lächeln, und die Tasche ist leer.',
    },
    insuranceNote: {
      en: 'Simple pickpocketing outside the home is usually not covered by household insurance.',
      de: 'Einfacher Taschendiebstahl außerhalb der Wohnung ist von der Hausrat meist nicht gedeckt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'New phone',
          de: 'Neues Handy',
        },
        amountMinor: 60000,
      },
      {
        id: 'b2',
        title: {
          en: 'Replacement SIM',
          de: 'Ersatz-SIM',
        },
        amountMinor: 2500,
      },
    ],
    actions: [
      {
        text: {
          en: 'Block the SIM and lock/erase the phone remotely',
          de: 'Sperre die SIM und sperre/lösche das Handy aus der Ferne',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to the local police',
          de: 'Melde es der örtlichen Polizei',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Block cards via 116 116 if needed',
          de: 'Sperre bei Bedarf die Karten über 116 116',
        },
        priority: 'high',
      },
    ],
    links: [],
  },
  {
    id: 'E34',
    tier: 'blaze',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    title: {
      en: 'Bed Bugs From the Hostel',
      de: 'Bettwanzen aus dem Hostel',
    },
    story: {
      en: 'You came back from the trip with more than souvenirs. Itchy bites, little dots on the mattress.',
      de: 'Du bist mit mehr als Souvenirs zurückgekommen. Juckende Stiche, kleine Punkte auf der Matratze.',
    },
    stat: {
      en: 'Bed bug treatment ~400–700 € (3 chemical treatments), 700–1,000 € chemical-free; landlord pays unless the tenant caused it.',
      de: 'Bettwanzen-Behandlung ca. 400–700 € (3 chemische Behandlungen), 700–1.000 € ohne Chemie; der Vermieter zahlt, außer der Mieter hat es verursacht.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Pest control (3 treatments)',
          de: 'Schädlingsbekämpfung (3 Behandlungen)',
        },
        amountMinor: 60000,
      },
      {
        id: 'b2',
        title: {
          en: 'New mattress',
          de: 'Neue Matratze',
        },
        amountMinor: 35000,
      },
      {
        id: 'b3',
        title: {
          en: 'Laundry',
          de: 'Wäsche',
        },
        amountMinor: 10000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Tell the landlord immediately',
          de: 'Sag es dem Vermieter sofort',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Hire a professional pest controller',
          de: 'Beauftrage einen professionellen Kammerjäger',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Wash textiles at 60 °C and check luggage after trips',
          de: 'Wasche Textilien bei 60 °C und kontrolliere nach Reisen das Gepäck',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Küchenfibel – Kammerjäger gegen Bettwanzen',
          de: 'Küchenfibel – Kammerjäger gegen Bettwanzen',
        },
        url: 'https://www.kuechenfibel.de/faq/wie-viel-kostet-ein-kammerjager-gegen-bettwanzen',
      },
    ],
  },
  {
    id: 'E37',
    tier: 'blaze',
    category: 'admin',
    type: 'dice',
    payment: 'pay_now',
    title: {
      en: 'Phishing SMS',
      de: 'Phishing-Falle',
    },
    story: {
      en: '"Your parcel couldn\'t be delivered." You clicked. You entered your banking details. 800 DT are gone.',
      de: '"Ihr Paket konnte nicht zugestellt werden." Du hast geklickt. Bankdaten eingegeben. 800 TT sind weg.',
    },
    stat: {
      en: 'Unauthorised payments: customer liability up to 50 €, unless gross negligence.',
      de: 'Nicht autorisierte Zahlungen: Haftung des Kunden bis 50 €, außer bei grober Fahrlässigkeit.',
    },
    dice: [
      {
        from: 1,
        to: 3,
        amountMinor: 80000,
      },
      {
        from: 4,
        to: 6,
        amountMinor: 5000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Lost to fraud',
          de: 'Durch Betrug verloren',
        },
        amountMinor: 80000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Block account and cards via bank or 116 116',
          de: 'Sperre Konto und Karten über die Bank oder 116 116',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to the police',
          de: 'Erstatte Anzeige bei der Polizei',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Change passwords',
          de: 'Ändere deine Passwörter',
        },
        priority: 'high',
      },
    ],
    links: [],
  },
  {
    id: 'E45',
    tier: 'blaze',
    category: 'health',
    type: 'multi',
    payment: 'plan_ok',
    estimate: true,
    title: {
      en: 'Long Sick Leave',
      de: 'Lange krankgeschrieben',
    },
    story: {
      en: "Glandular fever. Ten weeks off. After six weeks your salary stops and sick pay from health insurance starts — and it's less.",
      de: 'Pfeiffersches Drüsenfieber. Zehn Wochen raus. Nach sechs Wochen endet das Gehalt, das Krankengeld beginnt — und es ist weniger.',
    },
    stat: {
      en: '6 weeks continued pay, then sick pay 70% of gross, max 90% of net.',
      de: '6 Wochen Lohnfortzahlung, danach Krankengeld 70 % vom Brutto, höchstens 90 % vom Netto.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Income gap (2 months)',
          de: 'Einkommenslücke (2 Monate)',
        },
        amountMinor: 50000,
        dueInMonths: 2,
      },
      {
        id: 'b2',
        title: {
          en: 'Co-payments and taxis',
          de: 'Zuzahlungen und Taxis',
        },
        amountMinor: 15000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Send sick notes on time',
          de: 'Schicke die Krankmeldungen rechtzeitig',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Apply for sick pay with your health insurer',
          de: 'Beantrage Krankengeld bei deiner Krankenkasse',
        },
        priority: 'high',
      },
    ],
    links: [],
  },
  {
    id: 'E25',
    tier: 'wildfire',
    category: 'mobility',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    estimate: true,
    title: {
      en: 'Clutch Gone',
      de: 'Kupplung hinüber',
    },
    story: {
      en: 'The pedal sinks to the floor. The garage quote has four digits.',
      de: 'Das Pedal fällt durch. Der Kostenvoranschlag hat vier Stellen.',
    },
    stat: {
      en: 'Vehicle trouble: 30% of US adults, median $1,000–2,000.',
      de: 'Fahrzeugprobleme: 30 % der US-Erwachsenen, im Median 1.000–2.000 $.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Towing',
          de: 'Abschleppen',
        },
        amountMinor: 15000,
      },
      {
        id: 'b2',
        title: {
          en: 'Clutch repair',
          de: 'Kupplungsreparatur',
        },
        amountMinor: 190000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Get a written quote and a second opinion',
          de: 'Hole einen schriftlichen Kostenvoranschlag und eine zweite Meinung ein',
        },
        priority: 'high',
      },
      {
        text: {
          en: "Compare repair cost with the car's value",
          de: 'Vergleiche die Reparaturkosten mit dem Wert des Autos',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'SoFi – most common surprise expenses',
          de: 'SoFi – häufigste unerwartete Ausgaben',
        },
        url: 'https://www.sofi.com/article/money-life/the-most-common-surprise-expenses-and-what-they-cost/',
      },
    ],
  },
  {
    id: 'E26',
    tier: 'wildfire',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'household',
    title: {
      en: 'Burglary',
      de: 'Einbruch',
    },
    story: {
      en: 'You come home from the weekend. The door is open. Laptop, camera, the cash in the drawer: gone.',
      de: 'Du kommst vom Wochenende heim. Die Tür steht offen. Laptop, Kamera, das Bargeld in der Schublade: weg.',
    },
    stat: {
      en: '2024: ~90,000 insured burglaries; average damage per flat burglary 3,800 €.',
      de: '2024: ca. 90.000 versicherte Einbrüche; durchschnittlicher Schaden pro Wohnungseinbruch 3.800 €.',
    },
    insuranceNote: {
      en: 'Household insurance turns 3,800 DT into the deductible; the card alone covers years of premiums.',
      de: 'Die Hausrat macht aus 3.800 TT die Selbstbeteiligung; die Karte allein deckt Jahre an Prämien.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Stolen items',
          de: 'Gestohlene Sachen',
        },
        amountMinor: 300000,
      },
      {
        id: 'b2',
        title: {
          en: 'New lock',
          de: 'Neues Schloss',
        },
        amountMinor: 25000,
      },
      {
        id: 'b3',
        title: {
          en: 'Door repair',
          de: 'Türreparatur',
        },
        amountMinor: 55000,
      },
    ],
    actions: [
      {
        text: {
          en: "Call the police (110), don't touch anything",
          de: 'Rufe die Polizei (110), fasse nichts an',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'List stolen items with receipts and photos',
          de: 'Liste gestohlene Sachen mit Belegen und Fotos auf',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to household insurance immediately',
          de: 'Melde es sofort der Hausratversicherung',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'cash-online – Einbrüche kosten 350 Mio. Euro',
          de: 'cash-online – Einbrüche kosten 350 Mio. Euro',
        },
        url: 'https://www.cash-online.de/a/gdv-einbruchserie-kostet-versicherer-350-millionen-euro-695409/',
      },
    ],
  },
  {
    id: 'E27',
    tier: 'wildfire',
    category: 'liability',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'liability',
    title: {
      en: 'Water Damage Downstairs',
      de: 'Wasserschaden beim Nachbarn',
    },
    story: {
      en: "The washing machine hose burst while you were at work. Your downstairs neighbour's ceiling is dripping.",
      de: 'Der Waschmaschinenschlauch ist geplatzt, während du in der Arbeit warst. Bei deinem Nachbarn tropft es von der Decke.',
    },
    stat: {
      en: '>1 million tap water damages per year in Germany; >5,000 € average per case (HDI 2025).',
      de: 'In Deutschland über 1 Million Leitungswasserschäden pro Jahr; im Schnitt über 5.000 € pro Fall (HDI 2025).',
    },
    insuranceNote: {
      en: "Neighbour's damage = liability, own things = household; uninsured this means months of debt.",
      de: 'Schaden beim Nachbarn = Haftpflicht, eigene Sachen = Hausrat; ohne Versicherung bedeutet das Monate voller Schulden.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Drying company',
          de: 'Trocknungsfirma',
        },
        amountMinor: 150000,
      },
      {
        id: 'b2',
        title: {
          en: "Neighbour's ceiling and furniture",
          de: 'Decke und Möbel der Nachbarn',
        },
        amountMinor: 350000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Turn off the water immediately',
          de: 'Drehe das Wasser sofort ab',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Inform landlord and neighbour',
          de: 'Informiere Vermieter und Nachbarn',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to liability and household insurance',
          de: 'Melde es der Haftpflicht- und der Hausratversicherung',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'cash-online – >1 million water damages per year',
          de: 'cash-online – über 1 Million Wasserschäden pro Jahr',
        },
        url: 'https://www.cash-online.de/a/mehr-als-eine-million-leitungswasserschaeden-pro-jahr-warum-aeltere-gebaeude-das-groesste-risiko-tragen-723101/',
      },
    ],
  },
  {
    id: 'E28',
    tier: 'wildfire',
    category: 'liability',
    type: 'dice',
    payment: 'plan_ok',
    insurance: 'liability',
    estimate: true,
    title: {
      en: 'Bike Accident: Pedestrian Hurt',
      de: 'Radunfall mit Fußgänger',
    },
    story: {
      en: 'You looked at your phone for one second. Now someone is sitting on the pavement holding their wrist.',
      de: 'Eine Sekunde aufs Handy geschaut. Jetzt sitzt jemand auf dem Gehweg und hält sich das Handgelenk.',
    },
    stat: {
      en: '~2.7% of liability claims exceed 5,000 € (2024).',
      de: 'Ca. 2,7 % der Haftpflichtschäden übersteigen 5.000 € (2024).',
    },
    insuranceNote: {
      en: 'Personal injury is why everyone should have private liability insurance.',
      de: 'Personenschäden sind der Grund, warum jeder eine Privathaftpflicht haben sollte.',
    },
    dice: [
      {
        from: 1,
        to: 3,
        amountMinor: 80000,
      },
      {
        from: 4,
        to: 5,
        amountMinor: 400000,
      },
      {
        from: 6,
        to: 6,
        amountMinor: 1200000,
      },
    ],
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Compensation and costs',
          de: 'Entschädigung und Kosten',
        },
        amountMinor: 400000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Help first; call 112 if needed',
          de: 'Hilf zuerst; rufe bei Bedarf die 112',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Exchange details and note witnesses',
          de: 'Tausche Daten aus und notiere Zeugen',
        },
        priority: 'high',
      },
      {
        text: {
          en: "Report to liability insurance; don't admit fault in writing",
          de: 'Melde es der Haftpflicht; gib schriftlich keine Schuld zu',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'CHECK24 – most common liability claims',
          de: 'CHECK24 – häufigste Haftpflichtschäden',
        },
        url: 'https://www.check24.de/privathaftpflicht/die-haeufigsten-privathaftpflichtschaeden/',
      },
    ],
  },
  {
    id: 'E29',
    tier: 'wildfire',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'household',
    title: {
      en: 'Kitchen Fire',
      de: 'Küchenbrand',
    },
    story: {
      en: 'The oil pan caught fire. You put it out, but the kitchen is black and everything smells of smoke.',
      de: 'Die Pfanne mit Öl hat Feuer gefangen. Du hast gelöscht, aber die Küche ist schwarz und alles riecht nach Rauch.',
    },
    stat: {
      en: '2024: ~320,000 fire damages, 2.2 billion €, average ~4,900 €.',
      de: '2024: ca. 320.000 Brandschäden, 2,2 Milliarden €, im Schnitt ca. 4.900 €.',
    },
    insuranceNote: {
      en: 'Household insurance pays cleaning, replacement value and limited hotel costs.',
      de: 'Die Hausrat zahlt Reinigung, Wiederbeschaffungswert und begrenzte Hotelkosten.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Specialist cleaning',
          de: 'Spezialreinigung',
        },
        amountMinor: 180000,
      },
      {
        id: 'b2',
        title: {
          en: 'Kitchen items and clothes',
          de: 'Küchensachen und Kleidung',
        },
        amountMinor: 250000,
      },
      {
        id: 'b3',
        title: {
          en: 'Nights elsewhere',
          de: 'Nächte woanders',
        },
        amountMinor: 60000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Smother oil fires with a lid — never water',
          de: 'Ersticke Fettbrände mit einem Deckel — niemals mit Wasser',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Get a fire blanket and smoke detectors',
          de: 'Besorge eine Löschdecke und Rauchmelder',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Document damage and report to insurer early',
          de: 'Dokumentiere den Schaden und melde ihn früh dem Versicherer',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'cash-online – steigende Brandschäden',
          de: 'cash-online – steigende Brandschäden',
        },
        url: 'https://www.cash-online.de/a/advent-advent-versicherer-warnen-vor-steigenden-brandschaeden-707284/',
      },
      {
        label: {
          en: 'ADAC – Hausratversicherung bei Brand',
          de: 'ADAC – Hausratversicherung bei Brand',
        },
        url: 'https://www.adac.de/produkte/versicherungen/ratgeber/hausratversicherung-bei-brand/',
      },
    ],
  },
  {
    id: 'E35',
    tier: 'wildfire',
    category: 'liability',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'liability_keyloss',
    title: {
      en: 'Lost Building Key',
      de: 'Generalschlüssel verloren',
    },
    story: {
      en: 'Your keys are gone — including the one that opens the main entrance. The landlord is replacing the locking system.',
      de: 'Dein Schlüsselbund ist weg — inklusive Haustürschlüssel der Schließanlage. Der Vermieter tauscht die Schließanlage.',
    },
    stat: {
      en: 'Locking system replacement can cost thousands; tenant pays only if replaced and misuse risk was real.',
      de: 'Der Austausch einer Schließanlage kann Tausende kosten; der Mieter zahlt nur, wenn getauscht wurde und die Missbrauchsgefahr real war.',
    },
    insuranceNote: {
      en: "Liability insurance covers others' keys only with a key-loss clause.",
      de: 'Die Haftpflicht deckt fremde Schlüssel nur mit einer Schlüsselverlust-Klausel.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'New locking system share',
          de: 'Anteil an der neuen Schließanlage',
        },
        amountMinor: 200000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Report the loss to the landlord immediately',
          de: 'Melde den Verlust sofort dem Vermieter',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Check your policy for a key-loss clause',
          de: 'Prüfe deine Police auf eine Schlüsselverlust-Klausel',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Wohnglück – Schlüssel der Schließanlage verloren',
          de: 'Wohnglück – Schlüssel der Schließanlage verloren',
        },
        url: 'https://wohnglueck.de/artikel/schliessanlage-schluessel-verlieren-43545',
      },
    ],
  },
  {
    id: 'E40',
    tier: 'wildfire',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    title: {
      en: "Eviction for Owner's Use",
      de: 'Eigenbedarfskündigung',
    },
    story: {
      en: "The landlord's daughter is moving to Munich. You have three months to find a new flat.",
      de: 'Die Tochter des Vermieters zieht nach München. Du hast drei Monate, um eine neue Wohnung zu finden.',
    },
    stat: {
      en: 'New-contract rents +46% vs existing +35% (2015–2024, 90 m²); Munich singles spend >41% of income after a move.',
      de: 'Neuvertragsmieten +46 % gegenüber Bestandsmieten +35 % (2015–2024, 90 m²); Münchner Singles geben nach einem Umzug über 41 % ihres Einkommens aus.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Moving van and helpers',
          de: 'Transporter und Helfer',
        },
        amountMinor: 90000,
        dueInMonths: 3,
      },
      {
        id: 'b2',
        title: {
          en: 'Overlap rent',
          de: 'Doppelte Miete',
        },
        amountMinor: 80000,
        dueInMonths: 3,
      },
      {
        id: 'b3',
        title: {
          en: 'New deposit',
          de: 'Neue Kaution',
        },
        amountMinor: 240000,
        dueInMonths: 3,
      },
    ],
    afterEffect: {
      monthlyMinor: 15000,
      line: {
        en: 'rent',
        de: 'Miete',
      },
    },
    refund: {
      amountMinor: 240000,
      inMonths: 6,
      note: {
        en: 'old deposit; may trigger E21 deductions',
        de: 'alte Kaution; kann Abzüge wie bei E21 auslösen',
      },
    },
    actions: [
      {
        text: {
          en: 'Check whether the notice is valid',
          de: 'Prüfe, ob die Kündigung wirksam ist',
        },
        priority: 'high',
      },
      {
        text: {
          en: "Get advice from a tenants' association",
          de: 'Lass dich von einem Mieterverein beraten',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Start the flat search and budget the deposit overlap',
          de: 'Starte die Wohnungssuche und plane Kaution und Überschneidung ein',
        },
        priority: 'high',
      },
    ],
    links: [
      {
        label: {
          en: 'Mietspiegeltabelle – Wohnkosten steigen nach Umzug',
          de: 'Mietspiegeltabelle – Wohnkosten steigen nach Umzug',
        },
        url: 'https://mietspiegeltabelle.de/wohnkosten-steigen-nach-umzug-deutlich/',
      },
    ],
  },
  {
    id: 'E30',
    tier: 'inferno',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'household',
    unique: true,
    estimate: true,
    title: {
      en: 'The Flat Burns Down',
      de: 'Die Wohnung brennt ab',
    },
    story: {
      en: "A fire in the flat below spreads. Everyone gets out safely. Your home and almost everything in it doesn't.",
      de: 'Ein Feuer in der Wohnung unter dir greift über. Alle kommen heil raus. Deine Wohnung und fast alles darin nicht.',
    },
    stat: {
      en: 'Household insurance: replacement value up to sum insured (guideline ~700 €/m²); hotel cover time-limited.',
      de: 'Hausrat: Wiederbeschaffungswert bis zur Versicherungssumme (Richtwert ca. 700 €/m²); Hotelkosten zeitlich begrenzt.',
    },
    insuranceNote: {
      en: 'The strongest argument for household insurance; uninsured this means years of repayment.',
      de: 'Das stärkste Argument für die Hausratversicherung; ohne sie bedeutet das Jahre der Rückzahlung.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Emergency clothes and essentials',
          de: 'Notkleidung und Notwendiges',
        },
        amountMinor: 80000,
        dueInMonths: 0,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotel / temporary flat (3 months)',
          de: 'Hotel / Übergangswohnung (3 Monate)',
        },
        amountMinor: 450000,
        dueInMonths: 3,
      },
      {
        id: 'b3',
        title: {
          en: 'New furniture and household items',
          de: 'Neue Möbel und Haushaltsgegenstände',
        },
        amountMinor: 1500000,
        dueInMonths: 3,
      },
      {
        id: 'b4',
        title: {
          en: 'Laptop, phone, documents',
          de: 'Laptop, Handy, Dokumente',
        },
        amountMinor: 220000,
        dueInMonths: 0,
      },
      {
        id: 'b5',
        title: {
          en: 'Deposit and move',
          de: 'Kaution und Umzug',
        },
        amountMinor: 300000,
        dueInMonths: 3,
      },
    ],
    insuredExtra: {
      dice: [
        {
          from: 1,
          to: 4,
          amountMinor: 0,
        },
        {
          from: 5,
          to: 6,
          amountMinor: 100000,
        },
      ],
      label: {
        en: 'Hotel overrun beyond policy limit',
        de: 'Hotel-Mehrkosten über das Limit der Police hinaus',
      },
    },
    actions: [
      {
        text: {
          en: 'Get out and call 112',
          de: 'Raus und die 112 rufen',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Report to household insurance; ask about hotel cover and advances',
          de: 'Melde es der Hausratversicherung; frage nach Hotelkosten und Vorschüssen',
        },
        priority: 'high',
      },
      {
        text: {
          en: 'Photograph your rooms today as an inventory',
          de: 'Fotografiere heute deine Räume als Inventar',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'ADAC – Hausratversicherung bei Brand',
          de: 'ADAC – Hausratversicherung bei Brand',
        },
        url: 'https://www.adac.de/produkte/versicherungen/ratgeber/hausratversicherung-bei-brand/',
      },
      {
        label: {
          en: 'Verivox – Hotelkosten in der Hausratversicherung',
          de: 'Verivox – Hotelkosten in der Hausratversicherung',
        },
        url: 'https://www.verivox.de/hausratversicherung/themen/hotelkosten/',
      },
    ],
  },
];
