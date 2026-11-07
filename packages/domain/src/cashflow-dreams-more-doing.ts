import { dreamSet, link } from './cashflow-dream-builder';

const SKY = link(
  'Skyscanner – compare flights',
  'Skyscanner – Flüge vergleichen',
  'https://www.skyscanner.net/',
);
const VZ = link(
  'Consumer advice – insurance',
  'Verbraucherzentrale – Versicherungen',
  'https://www.verbraucherzentrale.de/',
);

/** Dreams D61-D74: adventures and learning (JFK, 2026-11: the deck grows to about a hundred). */
export const MORE_DOING = dreamSet([
  {
    id: 'D61',
    category: 'adventure',
    tier: 'little',
    title: ['Whales in the Azores', 'Wale auf den Azoren'],
    story: [
      'A rubber boat, a lookout on the hill and then a sperm whale rises ten metres from you.',
      'Ein Schlauchboot, ein Ausguck auf dem Hügel und dann taucht zehn Meter neben dir ein Pottwal auf.',
    ],
    description: [
      'The Azores are one of the few places where whales live all year; sperm whales and dolphins are seen on most trips, blue whales in spring. Operators are licensed and follow strict rules. A week on Pico or São Miguel adds hot springs, crater lakes and hiking.',
      'Die Azoren sind einer der wenigen Orte, an denen Wale das ganze Jahr leben; Pottwale und Delfine sieht man auf den meisten Fahrten, Blauwale im Frühling. Die Anbieter sind lizenziert und halten strenge Regeln ein. Eine Woche auf Pico oder São Miguel bringt heiße Quellen, Kraterseen und Wanderungen dazu.',
    ],
    buckets: [
      [
        'Flights',
        'Flüge',
        450,
        'Direct flights from several German airports in the season cost about 250-500 return.',
        'Direktflüge von mehreren deutschen Flughäfen in der Saison kosten hin und zurück etwa 250-500.',
        [SKY],
      ],
      [
        'Guesthouse, 6 nights',
        'Gästehaus, 6 Nächte',
        600,
        'A double room is about 70-120 a night on Pico or São Miguel.',
        'Ein Doppelzimmer kostet auf Pico oder São Miguel etwa 70-120 pro Nacht.',
      ],
      [
        'Whale-watching trips, 2',
        'Walbeobachtung, 2 Fahrten',
        200,
        'A trip of three hours costs about 60-100; book two so that bad weather does not cost you the dream.',
        'Eine Fahrt von drei Stunden kostet etwa 60-100; buch zwei, damit schlechtes Wetter dir den Traum nicht nimmt.',
        [link('Visit Azores', 'Visit Azores', 'https://www.visitazores.com/')],
      ],
      [
        'Rental car, food, hot springs',
        'Mietwagen, Essen, heiße Quellen',
        750,
        'A small car is about 40-60 a day; hot springs 10-15; a meal 15-25.',
        'Ein Kleinwagen kostet etwa 40-60 am Tag; heiße Quellen 10-15; ein Essen 15-25.',
      ],
    ],
    links: [
      link('Visit Azores', 'Visit Azores', 'https://www.visitazores.com/'),
      link('WWF – whales and dolphins', 'WWF – Wale und Delfine', 'https://www.wwf.de/'),
    ],
    actions: [
      [
        'Choose an operator with a licence and a marine biologist on board',
        'Einen Anbieter mit Lizenz und Meeresbiologen an Bord wählen',
        'high',
      ],
      [
        'Go between April and October for the best chance',
        'Zwischen April und Oktober fahren, das ist die beste Chance',
      ],
      [
        'Take travel pills if you tend to be seasick',
        'Reisetabletten mitnehmen, wenn du zur Seekrankheit neigst',
        'low',
      ],
    ],
    notes: [
      [
        'The best trips keep a respectful distance; you may see less but it is right for the whales.',
        'Die besten Fahrten halten respektvollen Abstand; du siehst vielleicht weniger, aber es ist richtig für die Wale.',
      ],
    ],
  },
  {
    id: 'D62',
    category: 'adventure',
    tier: 'grand',
    title: ['Heli-Skiing in the Canadian Rockies', 'Heli-Skiing in den kanadischen Rockies'],
    story: [
      'A helicopter drops you on a ridge above a thousand hectares of untouched powder.',
      'Ein Hubschrauber setzt dich auf einem Grat über tausend Hektar unberührtem Pulverschnee ab.',
    ],
    description: [
      'A week of heli-skiing in British Columbia: guides, avalanche gear and the helicopter are part of the price. You need to be a confident off-piste skier; the lodges ask for your level in advance. January to March has the most snow.',
      'Eine Woche Heli-Skiing in British Columbia: Führer, Lawinenausrüstung und Hubschrauber sind im Preis enthalten. Du musst ein sicherer Tiefschneefahrer sein; die Lodges fragen vorab nach deinem Niveau. Januar bis März hat den meisten Schnee.',
    ],
    buckets: [
      [
        'Flights to Calgary or Vancouver',
        'Flüge nach Calgary oder Vancouver',
        1200,
        'Return flights from Europe cost about 800-1,400 in the winter.',
        'Hin- und Rückflüge aus Europa kosten im Winter etwa 800-1.400.',
        [SKY],
      ],
      [
        'Heli-ski package, 7 nights',
        'Heli-Ski-Paket, 7 Nächte',
        8500,
        'A week with lodge, meals, guides and a guaranteed number of vertical metres costs about 7,000-11,000.',
        'Eine Woche mit Lodge, Verpflegung, Führern und einer garantierten Zahl an Höhenmetern kostet etwa 7.000-11.000.',
        [link('CMH Heli-Skiing', 'CMH Heli-Skiing', 'https://www.canadianmountainholidays.com/')],
      ],
      [
        'Gear, insurance, transfers',
        'Ausrüstung, Versicherung, Transfers',
        1300,
        'Fat skis and an avalanche kit are often rented on site. A rescue and evacuation insurance for the Canadian mountains is a must.',
        'Breite Ski und ein Lawinenset werden oft vor Ort geliehen. Eine Rettungs- und Evakuierungsversicherung für die kanadischen Berge ist ein Muss.',
        [VZ],
      ],
    ],
    links: [
      link('Destination Canada', 'Destination Canada', 'https://www.destinationcanada.com/'),
      VZ,
    ],
    actions: [
      [
        'Take an avalanche course (level 1) before you go',
        'Vorher einen Lawinenkurs (Level 1) besuchen',
        'high',
      ],
      [
        'Check your off-piste level with the lodge honestly',
        'Dein Tiefschnee-Niveau ehrlich mit der Lodge abklären',
        'high',
      ],
      ['Book a year ahead for the best weeks', 'Die besten Wochen ein Jahr vorher buchen'],
    ],
    notes: [
      [
        'Heli-skiing is a team sport: you ski with a guide and a group.',
        'Heli-Skiing ist ein Mannschaftssport: du fährst mit einem Führer und einer Gruppe.',
      ],
    ],
  },
  {
    id: 'D63',
    category: 'adventure',
    tier: 'little',
    title: ['Become an Open Water Diver', 'Taucher werden: Open Water Diver'],
    story: [
      'Learn to breathe under water, then swim with turtles and a wall of fish in the Red Sea.',
      'Lerne unter Wasser zu atmen, dann schwimm mit Schildkröten und einer Fischwand im Roten Meer.',
    ],
    description: [
      'The Open Water Diver is the first licence that lets you dive anywhere with a buddy to 18 metres. A good course has theory at home, pool training and four open-water dives; the Red Sea is warm, clear and cheap. Check that you are fit to dive with a doctor first.',
      'Der Open Water Diver ist der erste Schein, mit dem du überall mit einem Partner bis 18 Meter tauchen darfst. Ein guter Kurs hat Theorie zu Hause, Poolübungen und vier Freiwassertauchgänge; das Rote Meer ist warm, klar und günstig. Lass vorher beim Arzt prüfen, ob du tauchtauglich bist.',
    ],
    buckets: [
      [
        'Course with theory and 4 dives',
        'Kurs mit Theorie und 4 Tauchgängen',
        450,
        'A full course is about 350-550 with the material; e-learning at home saves time on the holiday.',
        'Ein voller Kurs kostet etwa 350-550 mit Material; E-Learning zu Hause spart Zeit im Urlaub.',
        [link('PADI – learn to dive', 'PADI – Tauchen lernen', 'https://www.padi.com/')],
      ],
      [
        'Flights to Egypt',
        'Flüge nach Ägypten',
        350,
        'Return flights to Hurghada or Marsa Alam cost about 250-450.',
        'Hin- und Rückflüge nach Hurghada oder Marsa Alam kosten etwa 250-450.',
        [SKY],
      ],
      [
        'Dive resort, 7 nights',
        'Tauchhotel, 7 Nächte',
        650,
        'A half-board room in a dive resort costs about 70-120 a night.',
        'Ein Zimmer mit Halbpension in einem Tauchhotel kostet etwa 70-120 pro Nacht.',
      ],
      [
        'Fun dives and gear',
        'Fun-Tauchgänge und Ausrüstung',
        350,
        'Extra dives are about 30-45 each; buy your own mask and snorkel, rent the rest.',
        'Zusätzliche Tauchgänge kosten etwa 30-45; kauf eine eigene Maske und einen Schnorchel, den Rest leih.',
      ],
    ],
    links: [
      link('PADI', 'PADI', 'https://www.padi.com/'),
      link('VDST – German divers', 'VDST – Verband Deutscher Sporttaucher', 'https://www.vdst.de/'),
    ],
    actions: [
      [
        'Get a diving medical check from a doctor',
        'Eine Tauchtauglichkeitsuntersuchung beim Arzt machen',
        'high',
      ],
      ['Do the theory by e-learning at home', 'Die Theorie per E-Learning zu Hause machen'],
      [
        'Choose a small dive school with good reviews',
        'Eine kleine Tauchschule mit guten Bewertungen wählen',
        'low',
      ],
    ],
    notes: [
      [
        'Do not fly for 18-24 hours after your last dive.',
        'Flieg nicht in den 18-24 Stunden nach deinem letzten Tauchgang.',
      ],
    ],
  },
  {
    id: 'D64',
    category: 'adventure',
    tier: 'little',
    title: ['Paraglide Over the Alps', 'Mit dem Gleitschirm über die Alpen'],
    story: [
      'Run off the mountain and the thermals lift you high above the valley, silent as a bird.',
      'Lauf vom Berg, und die Thermik trägt dich hoch über das Tal, lautlos wie ein Vogel.',
    ],
    description: [
      'A tandem flight with a licensed pilot is the safe start: ten to thirty minutes in the air with no experience needed. If it grabs you, a school course of a week leads to a licence. The best weather is on warm days with thermals, in spring to autumn.',
      'Ein Tandemflug mit lizenziertem Piloten ist der sichere Einstieg: zehn bis dreißig Minuten in der Luft ohne Vorkenntnisse. Wenn es dich packt, führt ein Schulkurs von einer Woche zur Lizenz. Das beste Wetter ist an warmen Tagen mit Thermik, vom Frühling bis zum Herbst.',
    ],
    buckets: [
      [
        'Journey to the Alps',
        'Anreise in die Alpen',
        150,
        'By train or car to Interlaken, Lenggries or the Dolomites.',
        'Mit Zug oder Auto nach Interlaken, Lenggries oder in die Dolomiten.',
      ],
      [
        'Tandem thermal flight',
        'Tandem-Thermikflug',
        200,
        'A tandem flight costs about 120-200; a thermal flight of 30 minutes or more is dearer than a short one. Look for DHV or SHV licensed pilots.',
        'Ein Tandemflug kostet etwa 120-200; ein Thermikflug von 30 Minuten oder mehr ist teurer als ein kurzer. Achte auf Piloten mit DHV- oder SHV-Lizenz.',
        [
          link(
            'DHV – German hang gliding association',
            'DHV – Deutscher Gleitschirm- und Drachenflugverband',
            'https://www.dhv.de/',
          ),
        ],
      ],
      [
        'Hotel and food, 3 nights',
        'Hotel und Essen, 3 Nächte',
        450,
        'A guesthouse is about 80-130 a night; keep a spare day for the weather.',
        'Eine Pension kostet etwa 80-130 pro Nacht; halte einen Reservetag für das Wetter frei.',
      ],
      [
        'Beginner course day',
        'Schnupper-Kurstag',
        400,
        'A beginner day at a school costs about 150-250 and shows you the ground handling before you decide on a course.',
        'Ein Schnuppertag an einer Schule kostet etwa 150-250 und zeigt dir das Bodenhandling, bevor du dich für einen Kurs entscheidest.',
      ],
    ],
    links: [
      link('DHV – paragliding association', 'DHV – Gleitschirmverband', 'https://www.dhv.de/'),
    ],
    actions: [
      [
        'Choose a licensed pilot and a certified school',
        'Einen lizenzierten Piloten und eine zertifizierte Schule wählen',
        'high',
      ],
      [
        'Plan two days in case the weather stops flying',
        'Zwei Tage einplanen, falls das Wetter das Fliegen verhindert',
      ],
      ['Wear sturdy boots and warm layers', 'Feste Stiefel und warme Schichten tragen', 'low'],
    ],
    notes: [
      [
        'Check that your accident insurance covers air sports.',
        'Prüfe, ob deine Unfallversicherung Flugsport abdeckt.',
      ],
    ],
  },
  {
    id: 'D65',
    category: 'adventure',
    tier: 'big',
    title: ['Finish an Ironman', 'Einen Ironman finishen'],
    story: [
      '3.8 km swimming, 180 km cycling and a marathon: the finish line is the proudest minute of the year.',
      '3,8 km Schwimmen, 180 km Radfahren und ein Marathon: die Ziellinie ist die stolzeste Minute des Jahres.',
    ],
    description: [
      'A full Ironman takes about a year of training and 8-12 hours on the day. Start with a sprint triathlon, then a half distance. The race fee, the bike and the travel are the costs; the real price is the time. Talk to a doctor and a coach before you start.',
      'Ein voller Ironman braucht etwa ein Jahr Training und am Renntag 8-12 Stunden. Fang mit einem Sprint-Triathlon an, dann der halben Distanz. Startgebühr, Rad und Reise sind die Kosten; der wahre Preis ist die Zeit. Sprich vor dem Start mit einem Arzt und einem Trainer.',
    ],
    buckets: [
      [
        'Race entry',
        'Startgebühr',
        700,
        'An Ironman entry is about 600-900; the races fill up in minutes, so know the date when registration opens.',
        'Ein Ironman-Start kostet etwa 600-900; die Rennen sind in Minuten voll, kenne also den Termin der Anmeldung.',
        [link('Ironman – races', 'Ironman – Rennen', 'https://www.ironman.com/')],
      ],
      [
        'Triathlon bike and gear',
        'Triathlon-Rad und Ausrüstung',
        2000,
        'A good used road or tri bike is about 1,000-2,000, wetsuit 200-400, shoes and helmet 300.',
        'Ein gutes gebrauchtes Renn- oder Triathlonrad kostet etwa 1.000-2.000, Neoprenanzug 200-400, Schuhe und Helm 300.',
      ],
      [
        'Coach, plan, tests',
        'Trainer, Plan, Tests',
        800,
        'A coach or a plan is about 50-150 a month; add a sports medical check and shoes.',
        'Ein Trainer oder ein Plan kostet etwa 50-150 im Monat; dazu ein sportmedizinischer Check und Schuhe.',
      ],
      [
        'Travel, hotel, race week',
        'Anreise, Hotel, Rennwoche',
        1000,
        'The race week abroad costs about 800-1,200 with bike transport, hotel and food.',
        'Die Rennwoche im Ausland kostet etwa 800-1.200 mit Radtransport, Hotel und Essen.',
      ],
    ],
    links: [
      link('Ironman', 'Ironman', 'https://www.ironman.com/'),
      link('World Triathlon', 'World Triathlon', 'https://triathlon.org/'),
    ],
    actions: [
      [
        'Get a sports medical check before you train',
        'Vor dem Training einen sportmedizinischen Check machen',
        'high',
      ],
      [
        'Start with a sprint, then an Olympic and a half distance',
        'Mit einem Sprint anfangen, dann olympische und halbe Distanz',
        'high',
      ],
      [
        'Join a club for the swim and group rides',
        'Einem Verein für Schwimmen und Gruppenausfahrten beitreten',
      ],
    ],
    notes: [
      [
        'Eat and sleep as part of the training: most injuries come from too much too fast.',
        'Essen und Schlafen gehören zum Training: die meisten Verletzungen kommen von zu viel zu schnell.',
      ],
    ],
  },
  {
    id: 'D66',
    category: 'adventure',
    tier: 'big',
    title: ['Into the Sahara by Jeep and Camel', 'In die Sahara mit Jeep und Kamel'],
    story: [
      'Dunes the colour of copper, a camp under more stars than you have ever seen, and tea at dawn.',
      'Dünen in der Farbe von Kupfer, ein Camp unter mehr Sternen, als du je gesehen hast, und Tee im Morgengrauen.',
    ],
    description: [
      'From Marrakech, a four-day trip over the Atlas to Merzouga leads to the dunes of Erg Chebbi; a camel trek takes you into a tent camp. Spring and autumn are comfortable; summer is too hot. A small local guide company is better than a large bus tour.',
      'Von Marrakesch führt eine viertägige Tour über den Atlas nach Merzouga zu den Dünen des Erg Chebbi; ein Kamelritt bringt dich in ein Zeltlager. Frühling und Herbst sind angenehm; der Sommer ist zu heiß. Eine kleine lokale Agentur ist besser als eine große Bustour.',
    ],
    buckets: [
      [
        'Flights to Marrakech',
        'Flüge nach Marrakesch',
        350,
        'Direct flights from Germany cost about 200-450 return, often cheap.',
        'Direktflüge von Deutschland kosten hin und zurück etwa 200-450, oft günstig.',
        [SKY],
      ],
      [
        '4-day desert tour',
        '4-Tage-Wüstentour',
        900,
        'A small-group tour with jeep, guide, camel and camp costs about 300-600 per person; a private tour more.',
        'Eine Kleingruppentour mit Jeep, Führer, Kamel und Camp kostet etwa 300-600 pro Person; eine private mehr.',
      ],
      [
        'Riad, Marrakech, 4 nights',
        'Riad in Marrakesch, 4 Nächte',
        600,
        'A riad with a courtyard and breakfast is about 60-150 a night.',
        'Ein Riad mit Innenhof und Frühstück kostet etwa 60-150 pro Nacht.',
      ],
      [
        'Food, souk, guide, extras',
        'Essen, Souk, Führer, Extras',
        450,
        'A tajine meal is 8-15; a hammam 20-40; bargaining is part of the souk.',
        'Ein Tajine-Essen kostet 8-15; ein Hammam 20-40; Feilschen gehört zum Souk.',
      ],
      [
        'Insurance and vaccinations',
        'Versicherung und Impfungen',
        150,
        'A travel health insurance and a check of the standard vaccinations.',
        'Eine Reisekrankenversicherung und ein Check der Standardimpfungen.',
        [VZ],
      ],
    ],
    links: [link('Visit Morocco', 'Visit Morocco', 'https://www.visitmorocco.com/'), VZ],
    actions: [
      [
        'Book a small local company with good recent reviews',
        'Eine kleine lokale Agentur mit guten aktuellen Bewertungen buchen',
        'high',
      ],
      ['Go in March-May or October-November', 'Im März-Mai oder Oktober-November reisen'],
      [
        'Bring a scarf for the sand and warm clothes for the night',
        'Ein Tuch für den Sand und warme Kleidung für die Nacht mitbringen',
        'low',
      ],
    ],
    notes: [
      [
        'The nights in the desert are cold even in summer.',
        'Die Nächte in der Wüste sind auch im Sommer kalt.',
      ],
    ],
  },
  {
    id: 'D67',
    category: 'adventure',
    tier: 'grand',
    title: ['Sail Across the Atlantic', 'Den Atlantik besegeln'],
    story: [
      'Three weeks out of sight of land, watches at night under the stars, and then the Caribbean on the horizon.',
      'Drei Wochen ohne Land in Sicht, Nachtwachen unter den Sternen, und dann die Karibik am Horizont.',
    ],
    description: [
      'The ARC rally leaves the Canary Islands in November for the Caribbean, with a large fleet and safety checks. As a crew member you pay your berth and food on a yacht; experience with a sailing licence and a safety course is expected. Many skippers look for crew from the autumn.',
      'Die ARC-Regatta startet im November von den Kanaren in die Karibik, mit großer Flotte und Sicherheitschecks. Als Crewmitglied zahlst du Koje und Verpflegung auf einer Yacht; Erfahrung mit einem Segelschein und ein Sicherheitskurs werden erwartet. Viele Skipper suchen ab dem Herbst Crew.',
    ],
    buckets: [
      [
        'Berth on a yacht, 3 weeks',
        'Koje auf einer Yacht, 3 Wochen',
        5500,
        'A crew place on a good yacht in the ARC costs about 4,500-7,000 including food.',
        'Ein Crewplatz auf einer guten Yacht in der ARC kostet etwa 4.500-7.000 einschließlich Verpflegung.',
        [
          link(
            'World Cruising Club – the ARC',
            'World Cruising Club – die ARC',
            'https://www.worldcruising.com/arc',
          ),
        ],
      ],
      [
        'Sailing licences and safety course',
        'Segelscheine und Sicherheitskurs',
        1800,
        'A coastal licence and an offshore safety and sea survival course cost about 1,500-2,500 together.',
        'Ein Küstenschein und ein Offshore-Sicherheits- und Überlebenskurs kosten zusammen etwa 1.500-2.500.',
        [
          link(
            'DSV – German Sailing Association',
            'DSV – Deutscher Segler-Verband',
            'https://www.dsv.org/',
          ),
        ],
      ],
      [
        'Flights and the stay at both ends',
        'Flüge und Aufenthalt an beiden Enden',
        2500,
        'Flights to the Canaries, the days before the start, flights home from the Caribbean.',
        'Flüge auf die Kanaren, die Tage vor dem Start, Flüge heim aus der Karibik.',
        [SKY],
      ],
      [
        'Gear, insurance, emergency kit',
        'Ausrüstung, Versicherung, Notfallset',
        1200,
        'Foul-weather gear, a lifejacket with harness, a personal locator beacon and an insurance for blue-water sailing.',
        'Ölzeug, eine Rettungsweste mit Gurt, ein persönlicher Notsender und eine Versicherung für Hochseesegeln.',
      ],
    ],
    links: [
      link('World Cruising Club', 'World Cruising Club', 'https://www.worldcruising.com/'),
      link('DSV – sailing association', 'DSV – Segler-Verband', 'https://www.dsv.org/'),
    ],
    actions: [
      [
        'Sail at least a few coastal weeks to see if you love it',
        'Zuerst einige Küstenwochen segeln, um zu sehen, ob du es liebst',
        'high',
      ],
      [
        'Take an offshore safety and sea survival course',
        'Einen Offshore-Sicherheits- und Überlebenskurs machen',
        'high',
      ],
      [
        'Meet the skipper and the boat before you pay',
        'Skipper und Boot kennenlernen, bevor du zahlst',
      ],
    ],
    notes: [
      [
        'Seasickness and the cramped boat are the tests: try a long weekend at sea first.',
        'Seekrankheit und die Enge an Bord sind die Prüfung: probiere zuerst ein langes Wochenende auf See.',
      ],
    ],
  },
  {
    id: 'D68',
    category: 'adventure',
    tier: 'little',
    title: ['Stand on the Summit of Mont Blanc', 'Auf dem Gipfel des Mont Blanc stehen'],
    story: [
      'A night start by headlamp, a snow ridge in the sunrise, and the highest point of the Alps under your boots.',
      'Ein Nachtstart mit Stirnlampe, ein Schneegrat im Sonnenaufgang und der höchste Punkt der Alpen unter deinen Stiefeln.',
    ],
    description: [
      'At 4,806 m Mont Blanc is a serious high-altitude climb: two to three days with a mountain guide, a hut night and an acclimatisation day. Good fitness and a training of crampon and rope technique come first; a course in spring makes the summer ascent safer.',
      'Mit 4.806 m ist der Mont Blanc eine ernste Hochtour: zwei bis drei Tage mit Bergführer, eine Hüttennacht und ein Akklimatisationstag. Gute Fitness und Training der Steigeisen- und Seiltechnik kommen zuerst; ein Kurs im Frühling macht die Besteigung im Sommer sicherer.',
    ],
    buckets: [
      [
        'Mountain guide, 3 days',
        'Bergführer, 3 Tage',
        1200,
        'A guided ascent costs about 900-1,500 per person in a small group.',
        'Eine geführte Besteigung kostet etwa 900-1.500 pro Person in einer kleinen Gruppe.',
        [
          link(
            'Chamonix – guides and information',
            'Chamonix – Führer und Informationen',
            'https://www.chamonix.com/',
          ),
        ],
      ],
      [
        'Huts, lift, food',
        'Hütten, Bahn, Verpflegung',
        500,
        'A hut night with half board is about 90-120; the Aiguille du Midi lift about 70.',
        'Eine Hüttennacht mit Halbpension kostet etwa 90-120; die Aiguille-du-Midi-Bahn etwa 70.',
      ],
      [
        'Gear: boots, crampons, harness',
        'Ausrüstung: Stiefel, Steigeisen, Gurt',
        700,
        'High-mountain boots and the rest can be rented in Chamonix for about 20-40 a day.',
        'Hochtourenstiefel und der Rest lassen sich in Chamonix für etwa 20-40 am Tag leihen.',
      ],
      [
        'Alpine course and training',
        'Alpinkurs und Training',
        600,
        'A weekend course of glacier travel costs about 300-500; train with long hikes and stairs.',
        'Ein Wochenendkurs Gletscherkunde kostet etwa 300-500; trainiere mit langen Wanderungen und Treppen.',
        [
          link(
            'DAV – German Alpine Club',
            'DAV – Deutscher Alpenverein',
            'https://www.alpenverein.de/',
          ),
        ],
      ],
    ],
    links: [
      link('DAV – Alpine Club', 'DAV – Alpenverein', 'https://www.alpenverein.de/'),
      link('Chamonix', 'Chamonix', 'https://www.chamonix.com/'),
    ],
    actions: [
      [
        'Join a club, train on hikes with 1,000 m of ascent and a pack',
        'In einen Verein eintreten, mit Wanderungen von 1.000 Höhenmetern und Rucksack trainieren',
        'high',
      ],
      [
        'Book a guide for July or August a half year ahead',
        'Einen Führer für Juli oder August ein halbes Jahr vorher buchen',
        'high',
      ],
      ['Check the rescue insurance of the club', 'Die Rettungsversicherung des Vereins prüfen'],
    ],
    notes: [
      [
        'The weather decides: a guide will turn round and that is the right decision.',
        'Das Wetter entscheidet: ein Führer dreht um, und das ist die richtige Entscheidung.',
      ],
    ],
  },
  {
    id: 'D69',
    category: 'learn',
    tier: 'little',
    title: ['Learn to Paint in Florence', 'Malen lernen in Florenz'],
    story: [
      'Two weeks of oil and watercolour in an old studio, with the Arno below the window.',
      'Zwei Wochen Öl und Aquarell in einem alten Atelier, mit dem Arno unter dem Fenster.',
    ],
    description: [
      'Art schools in Florence teach beginners and advanced painters in small groups, in the city of the Renaissance. A two-week course with five days a week and the museums on the afternoons is a perfect start. Spring and autumn are best.',
      'Kunstschulen in Florenz unterrichten Anfänger und Fortgeschrittene in kleinen Gruppen, in der Stadt der Renaissance. Ein zweiwöchiger Kurs mit fünf Tagen die Woche und den Museen an den Nachmittagen ist ein perfekter Start. Frühling und Herbst sind am besten.',
    ],
    buckets: [
      [
        'Course, 2 weeks',
        'Kurs, 2 Wochen',
        900,
        'A two-week course costs about 700-1,200 with the material.',
        'Ein zweiwöchiger Kurs kostet etwa 700-1.200 mit Material.',
      ],
      [
        'Flights or train',
        'Flug oder Zug',
        250,
        'Cheap flights or a train via the Brenner.',
        'Günstige Flüge oder ein Zug über den Brenner.',
        [SKY],
      ],
      [
        'Room, 14 nights',
        'Zimmer, 14 Nächte',
        1500,
        'A small apartment or a room costs about 80-130 a night.',
        'Eine kleine Wohnung oder ein Zimmer kostet etwa 80-130 pro Nacht.',
      ],
      [
        'Museums, food, materials',
        'Museen, Essen, Material',
        550,
        'The Uffizi is about 25 with a reservation; a Florence museum card is cheaper if you visit many.',
        'Die Uffizien kosten etwa 25 mit Reservierung; eine Florenz-Museumskarte ist günstiger, wenn du viele besuchst.',
        [link('Uffizi Galleries', 'Uffizien', 'https://www.uffizi.it/')],
      ],
    ],
    links: [
      link('Visit Florence', 'Besuch Florenz', 'https://www.visittuscany.com/'),
      link('Uffizi Galleries', 'Uffizien', 'https://www.uffizi.it/'),
    ],
    actions: [
      [
        'Pick a school with small groups and a teacher whose work you like',
        'Eine Schule mit kleinen Gruppen und einem Lehrer wählen, dessen Arbeit dir gefällt',
        'high',
      ],
      ['Reserve the Uffizi and the Accademia ahead', 'Uffizien und Accademia vorher reservieren'],
      [
        'Bring your own sketchbook and a few brushes',
        'Ein eigenes Skizzenbuch und einige Pinsel mitbringen',
        'low',
      ],
    ],
    notes: [
      [
        'Paint a little at home before you go; you will learn faster.',
        'Male vorher ein wenig zu Hause; du lernst schneller.',
      ],
    ],
  },
  {
    id: 'D70',
    category: 'learn',
    tier: 'big',
    title: ['Become a Certified Sommelier', 'Sommelier werden'],
    story: [
      'Taste a wine blind and say where and when it grew: a skill that makes every dinner better.',
      'Einen Wein blind verkosten und sagen, wo und wann er gewachsen ist: ein Können, das jedes Essen besser macht.',
    ],
    description: [
      'The first levels of the international sommelier courses teach grape varieties, regions, wine service and tasting. A level 1 and 2 course takes about half a year of evenings and weekends; the wine for tastings is a large part of the cost. A trip to a vineyard belongs to it.',
      'Die ersten Stufen der internationalen Sommelier-Kurse lehren Rebsorten, Regionen, Weinservice und Verkostung. Ein Kurs der Stufen 1 und 2 braucht etwa ein halbes Jahr Abende und Wochenenden; der Wein für die Verkostungen ist ein großer Teil der Kosten. Eine Reise zu einem Weingut gehört dazu.',
    ],
    buckets: [
      [
        'Courses, levels 1 and 2',
        'Kurse, Stufen 1 und 2',
        2200,
        'The courses and exam fees cost about 1,800-2,800 from the Wine & Spirit Education Trust or the court of master sommeliers.',
        'Die Kurse und Prüfungsgebühren kosten etwa 1.800-2.800 beim Wine & Spirit Education Trust oder dem Court of Master Sommeliers.',
        [link('WSET – wine education', 'WSET – Weinausbildung', 'https://www.wsetglobal.com/')],
      ],
      [
        'Wines for tasting',
        'Weine zum Verkosten',
        1200,
        'You taste hundreds of wines: join a tasting group to share the bottles.',
        'Du verkostest hunderte Weine: tritt einer Verkostungsgruppe bei, um Flaschen zu teilen.',
      ],
      [
        'Glasses, books, tools',
        'Gläser, Bücher, Werkzeug',
        400,
        'Good glasses (about 20 each), a corkscrew and the study books.',
        'Gute Gläser (etwa 20 je), ein Korkenzieher und die Lehrbücher.',
      ],
      [
        'A wine region trip',
        'Eine Weinreise',
        1000,
        'A week in the Mosel, Burgundy or Tuscany with visits of cellars.',
        'Eine Woche an der Mosel, im Burgund oder in der Toskana mit Kellerbesuchen.',
      ],
    ],
    links: [
      link('WSET', 'WSET', 'https://www.wsetglobal.com/'),
      link('Deutsches Weininstitut', 'Deutsches Weininstitut', 'https://www.deutscheweine.de/'),
    ],
    actions: [
      [
        'Start with a WSET level 1 or 2 course and see if it grips you',
        'Mit einem WSET-Kurs Stufe 1 oder 2 beginnen und sehen, ob es dich packt',
        'high',
      ],
      [
        'Find a tasting group to share the cost of bottles',
        'Eine Verkostungsgruppe finden, um die Flaschenkosten zu teilen',
      ],
      [
        'Spit the wine when you taste, so your palate stays sharp',
        'Den Wein beim Verkosten ausspucken, damit der Gaumen scharf bleibt',
        'low',
      ],
    ],
    notes: [
      [
        'A good palate is learned by a lot of tasting and by notes.',
        'Ein guter Gaumen wird durch viel Verkosten und durch Notizen gelernt.',
      ],
    ],
  },
  {
    id: 'D71',
    category: 'learn',
    tier: 'grand',
    title: ["A Master's Degree Abroad", 'Ein Masterstudium im Ausland'],
    story: [
      'Two years in a new country, a new language and a new field - and a degree that opens doors.',
      'Zwei Jahre in einem neuen Land, einer neuen Sprache und einem neuen Fach - und ein Abschluss, der Türen öffnet.',
    ],
    description: [
      "In many European countries a master's degree costs little or nothing in fees, and living costs are the main price. The DAAD gives scholarships to students from Germany and abroad. Plan the application a year ahead: language tests, letters and recognition of the first degree.",
      'In vielen europäischen Ländern kostet ein Masterstudium kaum oder keine Gebühren, und die Lebenshaltung ist der Hauptpreis. Der DAAD vergibt Stipendien an Studierende aus Deutschland und dem Ausland. Plane die Bewerbung ein Jahr vorher: Sprachtests, Anschreiben und Anerkennung des ersten Abschlusses.',
    ],
    buckets: [
      [
        'Fees and application, 2 years',
        'Gebühren und Bewerbung, 2 Jahre',
        4000,
        'A European public university costs 0-3,000 a year; the UK and the USA much more. Application fees about 50-150 each.',
        'Eine europäische öffentliche Universität kostet 0-3.000 im Jahr; Großbritannien und die USA viel mehr. Bewerbungsgebühren etwa 50-150 je.',
      ],
      [
        'Living costs, 24 months',
        'Lebenshaltung, 24 Monate',
        17000,
        'About 700-1,000 a month for a room, food and transport in many European student cities.',
        'Etwa 700-1.000 im Monat für Zimmer, Essen und Verkehr in vielen europäischen Studentenstädten.',
      ],
      [
        'Language test and move',
        'Sprachtest und Umzug',
        1500,
        'IELTS or TOEFL about 220-250; a flight and the first deposit for the room.',
        'IELTS oder TOEFL kosten etwa 220-250; ein Flug und die erste Kaution für das Zimmer.',
      ],
      [
        'Health insurance, books, travel',
        'Krankenversicherung, Bücher, Reisen',
        2500,
        'A student health insurance, the books and a few trips home.',
        'Eine Studentenkrankenversicherung, die Bücher und einige Heimreisen.',
      ],
    ],
    links: [
      link(
        'DAAD – scholarships and study abroad',
        'DAAD – Stipendien und Studium im Ausland',
        'https://www.daad.de/',
      ),
      link('Study in Europe', 'Study in Europe', 'https://www.studyineurope.eu/'),
    ],
    actions: [
      [
        'Search for scholarships and grants a year before the start',
        'Ein Jahr vor dem Start nach Stipendien und Förderungen suchen',
        'high',
      ],
      [
        'Check that your first degree is recognised',
        'Prüfen, ob dein erster Abschluss anerkannt wird',
        'high',
      ],
      ['Take the language test early', 'Den Sprachtest früh machen'],
    ],
    notes: [
      [
        'Part-time work is limited for foreign students: do not count on it for your living.',
        'Nebenjobs sind für ausländische Studierende begrenzt: zähle nicht darauf, deinen Lebensunterhalt damit zu bestreiten.',
      ],
    ],
  },
  {
    id: 'D72',
    category: 'learn',
    tier: 'little',
    title: [
      'Learn to Code and Build Your Own App',
      'Programmieren lernen und eine eigene App bauen',
    ],
    story: [
      'From the first line of code to an app on your own phone, in a year of evenings.',
      'Von der ersten Codezeile bis zu einer App auf dem eigenen Handy, in einem Jahr Abende.',
    ],
    description: [
      'Programming is learned by building: a good online course for the basics, a small idea and then the app itself. The cost is low, the time is the price - about 5-8 hours a week for a year. A mentor or a community saves months of guesswork.',
      'Programmieren lernt man durch Bauen: ein guter Online-Kurs für die Grundlagen, eine kleine Idee und dann die App selbst. Die Kosten sind gering, der Preis ist die Zeit - etwa 5-8 Stunden pro Woche über ein Jahr. Ein Mentor oder eine Community spart Monate des Herumprobierens.',
    ],
    buckets: [
      [
        'Online courses',
        'Online-Kurse',
        500,
        'Platforms like Coursera or Udemy cost about 20-50 a course or 40-60 a month for a subscription.',
        'Plattformen wie Coursera oder Udemy kosten etwa 20-50 pro Kurs oder 40-60 im Monat im Abo.',
        [link('Coursera', 'Coursera', 'https://www.coursera.org/')],
      ],
      [
        'A good laptop',
        'Ein guter Laptop',
        700,
        'A used laptop with 16 GB of memory is plenty to learn.',
        'Ein gebrauchter Laptop mit 16 GB Speicher reicht zum Lernen völlig.',
      ],
      [
        'Mentor or bootcamp weekend',
        'Mentor oder Bootcamp-Wochenende',
        200,
        'A few sessions with a mentor or a community meetup.',
        'Einige Sitzungen mit einem Mentor oder ein Community-Treffen.',
      ],
      [
        'App store and domain',
        'App-Store und Domain',
        100,
        'The Apple developer programme costs about 99 a year; Google Play 25 once; a domain 15.',
        'Das Apple-Entwicklerprogramm kostet etwa 99 im Jahr; Google Play 25 einmalig; eine Domain 15.',
      ],
    ],
    links: [
      link('freeCodeCamp', 'freeCodeCamp', 'https://www.freecodecamp.org/'),
      link('Coursera', 'Coursera', 'https://www.coursera.org/'),
    ],
    actions: [
      [
        'Choose one language and one course and finish it',
        'Eine Sprache und einen Kurs wählen und ihn abschließen',
        'high',
      ],
      ['Build a small project every month', 'Jeden Monat ein kleines Projekt bauen'],
      ['Share your code and ask for feedback', 'Deinen Code teilen und um Feedback bitten', 'low'],
    ],
    notes: [
      [
        'A finished small app teaches more than ten unfinished big ones.',
        'Eine fertige kleine App lehrt mehr als zehn unfertige große.',
      ],
    ],
  },
  {
    id: 'D73',
    category: 'learn',
    tier: 'little',
    title: ['A Cooking School in Tuscany', 'Eine Kochschule in der Toskana'],
    story: [
      'Make pasta by hand in a farmhouse kitchen and eat it at a long table under the olive trees.',
      'Pasta von Hand in einer Bauernhausküche machen und sie an einer langen Tafel unter Olivenbäumen essen.',
    ],
    description: [
      'A week at a farm cooking school teaches fresh pasta, the sauces, bread and desserts from local ingredients; you learn the market and the wines as well. The best seasons are spring and early autumn, with the olive harvest in October.',
      'Eine Woche an einer Kochschule auf einem Bauernhof lehrt frische Pasta, die Saucen, Brot und Desserts aus regionalen Zutaten; du lernst auch den Markt und die Weine kennen. Die besten Zeiten sind Frühling und früher Herbst, mit der Olivenernte im Oktober.',
    ],
    buckets: [
      [
        'Cooking course, 6 days',
        'Kochkurs, 6 Tage',
        1100,
        'A week with lodging, meals and lessons costs about 1,500-2,500 for the full package; courses alone about 80-120 a day.',
        'Eine Woche mit Unterkunft, Verpflegung und Unterricht kostet im Gesamtpaket etwa 1.500-2.500; Kurse allein etwa 80-120 am Tag.',
      ],
      [
        'Flights and rental car',
        'Flug und Mietwagen',
        500,
        'Flights to Pisa or Florence, and a small car for the hills.',
        'Flüge nach Pisa oder Florenz und ein Kleinwagen für die Hügel.',
        [SKY],
      ],
      [
        'Farm stay, 6 nights',
        'Agriturismo, 6 Nächte',
        600,
        'A farm stay is about 80-130 a night with a breakfast.',
        'Ein Agriturismo kostet etwa 80-130 pro Nacht mit Frühstück.',
      ],
      [
        'Wine, markets, knives',
        'Wein, Märkte, Messer',
        200,
        'A wine tasting at the farm 20-40; a good knife to take home 50-100.',
        'Eine Weinprobe auf dem Hof 20-40; ein gutes Messer zum Mitnehmen 50-100.',
      ],
    ],
    links: [
      link('Agriturismo Italia', 'Agriturismo Italia', 'https://www.agriturismo.it/'),
      link('Visit Tuscany', 'Visit Tuscany', 'https://www.visittuscany.com/'),
    ],
    actions: [
      [
        'Choose a school that teaches in small groups and in your language',
        'Eine Schule wählen, die in kleinen Gruppen und in deiner Sprache unterrichtet',
        'high',
      ],
      ['Ask for dietary needs ahead', 'Ernährungswünsche vorher mitteilen'],
      [
        'Book in spring or early autumn for the best weather',
        'Im Frühling oder frühen Herbst für das beste Wetter buchen',
        'low',
      ],
    ],
    notes: [
      [
        'Buy olive oil and pasta from the farm: the best souvenirs.',
        'Kauf Olivenöl und Pasta auf dem Hof: die besten Souvenirs.',
      ],
    ],
  },
  {
    id: 'D74',
    category: 'learn',
    tier: 'big',
    title: ['A Year of Japanese in Tokyo', 'Ein Jahr Japanisch in Tokio'],
    story: [
      'Learn to read the signs, order in a tiny bar and understand the jokes - in the city itself.',
      'Lerne, die Schilder zu lesen, in einer winzigen Bar zu bestellen und die Witze zu verstehen - in der Stadt selbst.',
    ],
    description: [
      'A language school in Tokyo offers a student visa for a long course, usually two terms of six months. Classes in the morning and the city afterwards give fast progress. Japan is cheaper than its reputation: a share house and a good cheap meal make it possible.',
      'Eine Sprachschule in Tokio bietet für einen langen Kurs ein Studentenvisum an, meist zwei Semester zu sechs Monaten. Unterricht am Vormittag und die Stadt danach bringen schnellen Fortschritt. Japan ist günstiger als sein Ruf: ein Sharehaus und ein gutes günstiges Essen machen es möglich.',
    ],
    buckets: [
      [
        'School fees, 12 months',
        'Schulgebühren, 12 Monate',
        7000,
        'A year at a language school costs about 6,000-8,000, including the visa support.',
        'Ein Jahr an einer Sprachschule kostet etwa 6.000-8.000, einschließlich Visa-Unterstützung.',
      ],
      [
        'Share house, 12 months',
        'Sharehaus, 12 Monate',
        8000,
        'A room in a share house in Tokyo is about 450-700 a month.',
        'Ein Zimmer in einem Sharehaus in Tokio kostet etwa 450-700 im Monat.',
      ],
      [
        'Flights, visa, insurance',
        'Flüge, Visum, Versicherung',
        1500,
        'A return flight, the visa fees and the national health insurance.',
        'Ein Hin- und Rückflug, die Visagebühren und die nationale Krankenversicherung.',
        [SKY],
      ],
      [
        'Food and transport, 12 months',
        'Essen und Verkehr, 12 Monate',
        4500,
        'A lunch is 6-10, a monthly train pass about 50-80.',
        'Ein Mittagessen kostet 6-10, eine Monatskarte für die Bahn etwa 50-80.',
      ],
    ],
    links: [
      link(
        'JNTO – Japan National Tourism Organization',
        'JNTO – Japanische Zentrale für Tourismus',
        'https://www.japan.travel/',
      ),
      link('Study in Japan', 'Study in Japan', 'https://www.studyinjapan.go.jp/'),
    ],
    actions: [
      [
        'Learn hiragana and katakana before you go',
        'Hiragana und Katakana vor der Abreise lernen',
        'high',
      ],
      [
        'Choose a school that is recognised for a student visa',
        'Eine Schule wählen, die für das Studentenvisum anerkannt ist',
        'high',
      ],
      ['Look at a share house with other learners', 'Ein Sharehaus mit anderen Lernenden ansehen'],
    ],
    notes: [
      [
        'Japanese needs daily practice: the school is only half of the learning.',
        'Japanisch braucht tägliche Übung: die Schule ist nur die Hälfte des Lernens.',
      ],
    ],
  },
]);
