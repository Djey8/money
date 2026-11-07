import { dreamDetail, kitLink as k } from './cashflow-dream-kit';
import type { DreamDetails } from './cashflow-dream-details';

/** The detail of the dreams of home, of people, of making things and of giving (see `cashflow-dream-details.ts`). */
export const LIFE_DETAILS: Record<string, DreamDetails> = {
  D33: dreamDetail(
    [
      'A dream kitchen is the room you use every day: units that fit the room, appliances that last and an installation that is clean. A good kitchen takes four to six months from the planning to the day it is ready; the costs depend on the size, the material of the fronts and the worktop. Plan it with a kitchen studio and compare at least three offers on the same plan.',
      'Eine Traumküche ist der Raum, den du jeden Tag nutzt: Schränke, die in den Raum passen, Geräte, die halten, und ein sauberer Einbau. Eine gute Küche braucht vier bis sechs Monate von der Planung bis zum fertigen Tag; die Kosten hängen von Größe, Material der Fronten und Arbeitsplatte ab. Plane sie mit einem Küchenstudio und vergleiche mindestens drei Angebote auf demselben Plan.',
    ],
    [
      [
        'A kitchen with good units of about ten running metres costs about 7,000-15,000, with the worktop. A solid worktop (laminate, quartz or wood) and the hinges and drawers matter more than the fronts: ask for the brand of the fittings.',
        'Eine Küche mit guten Schränken von etwa zehn laufenden Metern kostet etwa 7.000-15.000, mit der Arbeitsplatte. Eine solide Arbeitsplatte (Schichtstoff, Quarz oder Holz) und die Beschläge und Auszüge sind wichtiger als die Fronten: frag nach der Marke der Beschläge.',
        [
          k(
            'Consumer advice – buying a kitchen',
            'Verbraucherzentrale – Küchenkauf',
            'https://www.verbraucherzentrale.de/',
          ),
        ],
      ],
      [
        "Appliances: an induction hob, an oven, a dishwasher, a fridge-freezer and a hood cost about 3,000-6,000 in a good quality. Look at the energy label and the warranty; an extended warranty of the maker is often better than the dealer's.",
        'Geräte: ein Induktionsfeld, ein Backofen, eine Spülmaschine, ein Kühl-Gefrierschrank und eine Haube kosten in guter Qualität etwa 3.000-6.000. Achte auf das Energielabel und die Garantie; eine verlängerte Garantie des Herstellers ist oft besser als die des Händlers.',
        [
          k(
            'Stiftung Warentest – tests of appliances',
            'Stiftung Warentest – Tests von Geräten',
            'https://www.test.de/',
          ),
        ],
      ],
      [
        "The installation with the water, the electricity and the gas can cost about 1,000-2,500; ask for a fixed price for the whole installation and the old kitchen's removal. A professional measures the room before the order.",
        'Der Einbau mit Wasser, Strom und Gas kann etwa 1.000-2.500 kosten; frag nach einem Festpreis für die gesamte Montage und den Abbau der alten Küche. Ein Profi vermisst den Raum vor der Bestellung.',
      ],
    ],
    [
      k(
        'Consumer advice – buying a kitchen',
        'Verbraucherzentrale – Küchenkauf',
        'https://www.verbraucherzentrale.de/',
      ),
      k('Stiftung Warentest – appliances', 'Stiftung Warentest – Geräte', 'https://www.test.de/'),
    ],
    [
      [
        'Measure the room and list what you cook, bake and store',
        'Den Raum vermessen und aufschreiben, was du kochst, backst und lagerst',
        'high',
      ],
      ['Get three offers on the same plan', 'Drei Angebote auf demselben Plan einholen', 'high'],
      [
        'Ask for the brand of the fittings and the drawers',
        'Nach der Marke von Beschlägen und Auszügen fragen',
      ],
      [
        'Plan the time: the lead time is two to four months',
        'Die Zeit planen: die Lieferzeit beträgt zwei bis vier Monate',
        'low',
      ],
    ],
    [
      [
        'A kitchen is bought once in fifteen years: the workflow between the sink, the hob and the fridge matters more than the colour.',
        'Eine Küche kauft man einmal in fünfzehn Jahren: der Arbeitsablauf zwischen Spüle, Herd und Kühlschrank ist wichtiger als die Farbe.',
      ],
      [
        'A fixed price in writing protects you from extras.',
        'Ein schriftlicher Festpreis schützt dich vor Zusatzkosten.',
      ],
    ],
  ),

  D35: dreamDetail(
    [
      'A tiny house on your own plot: a house of 25-40 square metres on a plot you own, in the country or on the edge of a village. The plot is the hard part: building land is scarce, and a tiny house on wheels is not always allowed to stay. Check the local plan and the permit before you buy; connections for water, power and waste water make up a large part of the budget.',
      'Ein Tiny House auf eigenem Grundstück: ein Haus von 25-40 Quadratmetern auf einem Grundstück, das dir gehört, auf dem Land oder am Dorfrand. Das Grundstück ist der schwierige Teil: Bauland ist knapp, und ein Tiny House auf Rädern darf nicht überall dauerhaft stehen. Prüfe den Bebauungsplan und die Genehmigung vor dem Kauf; Anschlüsse für Wasser, Strom und Abwasser machen einen großen Teil des Budgets aus.',
    ],
    [
      [
        'A plot in the country costs about 20,000-80,000 depending on the region; a plot that is building land is dearer than farm land. Ask the municipality for the local plan, the access and the connections before you pay a deposit.',
        'Ein Grundstück auf dem Land kostet je nach Region etwa 20.000-80.000; Bauland ist teurer als Ackerland. Frag die Gemeinde vor einer Anzahlung nach Bebauungsplan, Zufahrt und Anschlüssen.',
        [k('Tiny House Association', 'Tiny-House-Verband', 'https://www.tiny-house-verband.de/')],
      ],
      [
        'A finished tiny house of 25-40 square metres costs about 50,000-120,000; a kit or a self-build is cheaper. Check insulation, the heating and the weight if it is on wheels, and ask for references from owners.',
        'Ein fertiges Tiny House von 25-40 Quadratmetern kostet etwa 50.000-120.000; ein Bausatz oder Selbstbau ist günstiger. Prüfe Dämmung, Heizung und das Gewicht, wenn es auf Rädern steht, und frag nach Referenzen von Besitzern.',
      ],
      [
        'Permit and connections: the building permit (about 500-2,000), a well or a connection to the water main, a sewage solution, power and a foundation. Together about 8,000-20,000.',
        'Genehmigung und Anschlüsse: die Baugenehmigung (etwa 500-2.000), ein Brunnen oder ein Anschluss an die Wasserleitung, eine Abwasserlösung, Strom und ein Fundament. Zusammen etwa 8.000-20.000.',
        [
          k(
            'Consumer advice – building and land',
            'Verbraucherzentrale – Bauen und Grundstück',
            'https://www.verbraucherzentrale.de/',
          ),
        ],
      ],
    ],
    [
      k('Tiny House Association', 'Tiny-House-Verband', 'https://www.tiny-house-verband.de/'),
      k(
        'Consumer advice – building and land',
        'Verbraucherzentrale – Bauen und Grundstück',
        'https://www.verbraucherzentrale.de/',
      ),
    ],
    [
      [
        'Ask the municipality what may be built on the plot',
        'Die Gemeinde fragen, was auf dem Grundstück gebaut werden darf',
        'high',
      ],
      [
        'Visit two tiny houses and talk to the owners',
        'Zwei Tiny Houses besichtigen und mit den Besitzern sprechen',
      ],
      [
        'Plan water, power and waste water before the house',
        'Wasser, Strom und Abwasser vor dem Haus planen',
        'high',
      ],
      [
        'Decide: on wheels or on a foundation',
        'Entscheiden: auf Rädern oder auf einem Fundament',
        'low',
      ],
    ],
    [
      [
        'A tiny house is small in every cost except the plot and the connections.',
        'Ein Tiny House ist in jedem Kostenpunkt klein außer bei Grundstück und Anschlüssen.',
      ],
      [
        'Living small means less storage: sort what you keep before the move.',
        'Klein zu wohnen heißt weniger Stauraum: sortiere vor dem Umzug, was du behältst.',
      ],
    ],
  ),

  D36: dreamDetail(
    [
      'A small farm is land, a house, machines and animals: five hectares in a rural region, a farmhouse that needs work, a used tractor and a few animals. It is a business, not a holiday: it is registered, it has working days from dawn, and the soil and the weather decide. In Germany a start in farming is supported by loans and grants; ask the chamber of agriculture before you buy.',
      'Ein kleiner Hof ist Land, ein Haus, Maschinen und Tiere: fünf Hektar in einer ländlichen Region, ein Bauernhaus, das Arbeit braucht, ein gebrauchter Traktor und einige Tiere. Es ist ein Betrieb, kein Urlaub: er wird angemeldet, hat Arbeitstage ab der Morgendämmerung, und Boden und Wetter entscheiden. In Deutschland wird ein Einstieg in die Landwirtschaft durch Darlehen und Zuschüsse unterstützt; frag die Landwirtschaftskammer, bevor du kaufst.',
    ],
    [
      [
        'Farm land costs about 10,000-35,000 per hectare in the east and more in the west; five hectares of arable or grass land in a rural region about 50,000-175,000. Land is sold by the land agencies and by private people: ask the local farmers.',
        'Ackerland kostet im Osten etwa 10.000-35.000 je Hektar und im Westen mehr; fünf Hektar Acker oder Grünland in einer ländlichen Region etwa 50.000-175.000. Land verkaufen die Landgesellschaften und Privatleute: frag die Landwirte vor Ort.',
        [
          k(
            'Federal Ministry of Food and Agriculture',
            'Bundesministerium für Ernährung und Landwirtschaft',
            'https://www.bmel.de/',
          ),
        ],
      ],
      [
        'A farmhouse in need of work costs about 100,000-250,000 in rural regions; the roof, the windows, the heating and the electrics are the usual big costs. A survey before the purchase (about 800-1,500) is cheap against them.',
        'Ein sanierungsbedürftiges Bauernhaus kostet in ländlichen Regionen etwa 100.000-250.000; Dach, Fenster, Heizung und Elektrik sind die üblichen großen Posten. Ein Gutachten vor dem Kauf (etwa 800-1.500) ist günstig dagegen.',
      ],
      [
        'A used tractor of 60-100 hp costs about 15,000-35,000, and the implements (a mower, a plough, a trailer) another 5,000-15,000. Borrow or share machines with a neighbour first.',
        'Ein gebrauchter Traktor mit 60-100 PS kostet etwa 15.000-35.000, und die Geräte (Mähwerk, Pflug, Anhänger) weitere 5.000-15.000. Leih oder teil dir Maschinen zuerst mit einem Nachbarn.',
        [
          k(
            'DLG – the agricultural society',
            'DLG – die Landwirtschaftsgesellschaft',
            'https://www.dlg.org/',
          ),
        ],
      ],
      [
        'Animals, fences, seeds and feed for the first year: about 5,000-15,000 for a few sheep, hens or goats. Check the rules for keeping animals and the registrations with the veterinary office.',
        'Tiere, Zäune, Saatgut und Futter für das erste Jahr: etwa 5.000-15.000 für einige Schafe, Hühner oder Ziegen. Prüfe die Regeln zur Tierhaltung und die Anmeldungen beim Veterinäramt.',
      ],
    ],
    [
      k(
        'Federal Ministry of Food and Agriculture',
        'Bundesministerium für Ernährung und Landwirtschaft',
        'https://www.bmel.de/',
      ),
      k(
        'DLG – the agricultural society',
        'DLG – die Landwirtschaftsgesellschaft',
        'https://www.dlg.org/',
      ),
      k(
        "Founders' platform of the state",
        'Gründerplattform des Bundes',
        'https://www.existenzgruender.de/',
      ),
    ],
    [
      [
        'Work for a season on a farm before you buy',
        'Eine Saison auf einem Hof arbeiten, bevor du kaufst',
        'high',
      ],
      [
        'Talk to the chamber of agriculture about grants and registration',
        'Mit der Landwirtschaftskammer über Förderung und Anmeldung sprechen',
        'high',
      ],
      [
        'Have the farmhouse inspected by an expert',
        'Das Bauernhaus von einem Sachverständigen prüfen lassen',
      ],
      [
        'Start small: few animals and one crop, then grow',
        'Klein anfangen: wenige Tiere und eine Kultur, dann wachsen',
        'low',
      ],
    ],
    [
      [
        'A farm is a way of living more than an income: plan the household budget apart from it.',
        'Ein Hof ist mehr eine Lebensweise als ein Einkommen: plane das Haushaltsbudget getrennt davon.',
      ],
      [
        'Land is bought once and is hard to sell fast: be sure of the place.',
        'Land kauft man einmal, und es ist schwer schnell zu verkaufen: sei dir des Ortes sicher.',
      ],
    ],
  ),

  D37: dreamDetail(
    [
      'Taking your parents on a trip they have wished for all their lives: a river cruise, a train journey through the Alps, a week in the country of their youth. The gift is as much the planning as the price: choose a trip that is easy on the knees, with few changes and good medical cover. Ask them where they always wanted to go and keep it a surprise only if you are sure.',
      'Deine Eltern auf eine Reise mitnehmen, die sie sich ein Leben lang gewünscht haben: eine Flusskreuzfahrt, eine Zugreise durch die Alpen, eine Woche im Land ihrer Jugend. Das Geschenk ist ebenso die Planung wie der Preis: wähle eine Reise, die schonend für die Knie ist, mit wenigen Umstiegen und guter medizinischer Absicherung. Frag sie, wohin sie immer wollten, und halte es nur dann geheim, wenn du dir sicher bist.',
    ],
    [
      [
        'A river cruise of seven or eight days for three people costs about 3,500-6,500 in a mid cabin with all meals; the Danube, the Rhine and the Douro are classic. A train journey or a group tour with a guide is cheaper and just as slow.',
        'Eine Flusskreuzfahrt von sieben oder acht Tagen für drei Personen kostet etwa 3.500-6.500 in einer mittleren Kabine mit Vollpension; Donau, Rhein und Douro sind Klassiker. Eine Zugreise oder eine Gruppenreise mit Reiseleitung ist günstiger und genauso gemächlich.',
        [
          k(
            'Rome2Rio – plan routes by train and boat',
            'Rome2Rio – Routen mit Zug und Boot planen',
            'https://www.rome2rio.com/',
          ),
        ],
      ],
      [
        'Travel to the port, extra excursions and a trip insurance with a good health cover for the age of your parents: about 800-1,500. Add a cancellation cover; the trip is planned months ahead.',
        'Anreise zum Hafen, Zusatzausflüge und eine Reiseversicherung mit guter Gesundheitsdeckung für das Alter deiner Eltern: etwa 800-1.500. Dazu eine Stornoversicherung; die Reise wird Monate vorher geplant.',
        [
          k(
            'Consumer advice – travel insurance',
            'Verbraucherzentrale – Reiseversicherung',
            'https://www.verbraucherzentrale.de/',
          ),
        ],
      ],
    ],
    [
      k(
        'Consumer advice – travel insurance',
        'Verbraucherzentrale – Reiseversicherung',
        'https://www.verbraucherzentrale.de/',
      ),
      k('Rome2Rio – plan routes', 'Rome2Rio – Routen planen', 'https://www.rome2rio.com/'),
    ],
    [
      [
        'Ask your parents where they always wanted to go',
        'Deine Eltern fragen, wohin sie immer wollten',
        'high',
      ],
      [
        'Choose a trip with few changes and short walks',
        'Eine Reise mit wenigen Umstiegen und kurzen Wegen wählen',
      ],
      [
        'Check the health cover and the cancellation cover',
        'Gesundheits- und Stornoschutz prüfen',
        'high',
      ],
      [
        'Book early: the cabins and the trains fill up',
        'Früh buchen: Kabinen und Züge sind schnell voll',
        'low',
      ],
    ],
    [
      [
        'A slow trip with time to rest is a better gift than a packed one.',
        'Eine langsame Reise mit Zeit zum Ausruhen ist ein besseres Geschenk als eine vollgepackte.',
      ],
    ],
  ),

  D38: dreamDetail(
    [
      'The big wedding party is a day for the people you love: a venue, a meal for the guests, music, a photographer and a dress and suit that fit. The average wedding with about 80 guests costs more than most couples think, and the biggest levers are the number of guests, the season and the day of the week. Set a budget first, then see what it buys.',
      'Die große Hochzeitsfeier ist ein Tag für die Menschen, die du liebst: ein Ort, ein Essen für die Gäste, Musik, ein Fotograf und ein Kleid und ein Anzug, die passen. Eine durchschnittliche Hochzeit mit etwa 80 Gästen kostet mehr, als die meisten Paare denken, und die größten Hebel sind die Zahl der Gäste, die Jahreszeit und der Wochentag. Leg zuerst ein Budget fest und schau dann, was es kauft.',
    ],
    [
      [
        'A venue with catering costs about 100-200 per guest in many regions; for 80 guests that is 8,000-16,000. A Friday or a Sunday, or the off-season, is often 20-30 % cheaper than a Saturday in summer.',
        'Ein Veranstaltungsort mit Catering kostet in vielen Regionen etwa 100-200 pro Gast; für 80 Gäste sind das 8.000-16.000. Ein Freitag oder Sonntag oder die Nebensaison ist oft 20-30 % günstiger als ein Samstag im Sommer.',
      ],
      [
        'A DJ or a band costs about 800-2,500, a photographer about 1,200-3,000 for the day; ask for a sample album and a contract with the hours. A good photographer is booked a year ahead.',
        'Ein DJ oder eine Band kostet etwa 800-2.500, ein Fotograf etwa 1.200-3.000 für den Tag; frag nach einem Muster-Album und einem Vertrag mit den Stunden. Ein guter Fotograf ist ein Jahr vorher ausgebucht.',
      ],
      [
        'A dress, a suit, the rings, the shoes and the hair and make-up: about 2,000-5,000 together. The rings are a lifetime decision: allow time and look at more than one jeweller.',
        'Kleid, Anzug, Ringe, Schuhe und Frisur und Make-up: zusammen etwa 2,000-5,000. Die Ringe sind eine Entscheidung fürs Leben: nimm dir Zeit und schau dir mehrere Juweliere an.',
      ],
      [
        'Flowers, decoration, the invitations and the cake: about 1,500-3,500. A friend with a good hand for flowers or a baker saves a lot.',
        'Blumen, Dekoration, Einladungen und die Torte: etwa 1.500-3.500. Eine Freundin mit gutem Händchen für Blumen oder ein Bäcker spart viel.',
      ],
    ],
    [
      k(
        'Stiftung Warentest – money and weddings',
        'Stiftung Warentest – Geld und Hochzeit',
        'https://www.test.de/',
      ),
      k(
        'Consumer advice – contracts',
        'Verbraucherzentrale – Verträge',
        'https://www.verbraucherzentrale.de/',
      ),
    ],
    [
      [
        'Set a total budget and the number of guests first',
        'Zuerst ein Gesamtbudget und die Zahl der Gäste festlegen',
        'high',
      ],
      [
        'Fix the date and the venue a year ahead',
        'Termin und Ort ein Jahr vorher festlegen',
        'high',
      ],
      [
        'Read the contracts of venue, photographer and band',
        'Die Verträge von Ort, Fotograf und Band lesen',
      ],
      [
        'Keep a reserve of ten percent for what you forgot',
        'Eine Reserve von zehn Prozent für das Vergessene halten',
        'low',
      ],
    ],
    [
      [
        'Each guest costs the price of the meal and the drinks: the guest list is the biggest lever of the budget.',
        'Jeder Gast kostet den Preis von Essen und Getränken: die Gästeliste ist der größte Hebel des Budgets.',
      ],
      [
        'A cancellation insurance for the wedding exists: ask what it covers.',
        'Eine Hochzeitsversicherung gegen Absage gibt es: frag, was sie abdeckt.',
      ],
    ],
  ),

  D39: dreamDetail(
    [
      'An education fund for your child is money put aside for the years after school: a degree, a training, a year abroad. It is a long dream: the earlier you start, the more time the money has to grow, and a small amount each month beats a big one at the end. Ask what the child will need - a flat in the university town and books cost as much as the fees.',
      'Ein Bildungsfonds für dein Kind ist Geld, das für die Jahre nach der Schule zurückgelegt wird: ein Studium, eine Ausbildung, ein Jahr im Ausland. Es ist ein langer Traum: je früher du beginnst, desto mehr Zeit hat das Geld zum Wachsen, und ein kleiner Betrag jeden Monat schlägt einen großen am Ende. Frag, was das Kind brauchen wird - eine Wohnung in der Universitätsstadt und Bücher kosten so viel wie die Gebühren.',
    ],
    [
      [
        'A saving of 100 a month for eighteen years is about 21,600 before returns; in a broad index fund of shares (not in a single stock) it can be 30,000 or more, with the risk that it is less in a crisis. Move the money to safer investments when the child is 15.',
        'Ein Sparbetrag von 100 im Monat über achtzehn Jahre sind etwa 21.600 vor Erträgen; in einem breiten Aktien-Indexfonds (nicht in einer Einzelaktie) können es 30.000 oder mehr sein, mit dem Risiko, dass es in einer Krise weniger ist. Schichte das Geld um, wenn das Kind 15 ist, in sicherere Anlagen.',
        [
          k(
            'Stiftung Warentest – saving for children',
            'Stiftung Warentest – Sparen für Kinder',
            'https://www.test.de/',
          ),
          k(
            'Finanztip – children and money',
            'Finanztip – Kinder und Geld',
            'https://www.finanztip.de/',
          ),
        ],
      ],
    ],
    [
      k(
        'Stiftung Warentest – saving for children',
        'Stiftung Warentest – Sparen für Kinder',
        'https://www.test.de/',
      ),
      k(
        'Finanztip – children and money',
        'Finanztip – Kinder und Geld',
        'https://www.finanztip.de/',
      ),
      k(
        'Federal Employment Agency – study and training',
        'Bundesagentur für Arbeit – Studium und Ausbildung',
        'https://www.arbeitsagentur.de/',
      ),
    ],
    [
      [
        'Open a custody account or a savings plan in the name of the child',
        'Ein Kinderdepot oder einen Sparplan auf den Namen des Kindes eröffnen',
        'high',
      ],
      [
        'Set a monthly amount and automate it',
        'Einen Monatsbetrag festlegen und automatisieren',
        'high',
      ],
      [
        'Ask family if they give to the fund instead of presents',
        'Die Familie fragen, ob sie statt Geschenken in den Fonds einzahlt',
      ],
      [
        'Move to safer investments about three years before the money is needed',
        'Etwa drei Jahre vor dem Bedarf in sicherere Anlagen umschichten',
        'low',
      ],
    ],
    [
      [
        "Money in a child's name belongs to the child: it cannot be taken back.",
        'Geld auf den Namen eines Kindes gehört dem Kind: es kann nicht zurückgenommen werden.',
      ],
      [
        'The fund is a gift of time: start now, with whatever you can.',
        'Der Fonds ist ein Geschenk der Zeit: fang jetzt an, mit dem, was du kannst.',
      ],
    ],
  ),

  D40: dreamDetail(
    [
      'A family reunion abroad: a villa for a week where three generations can meet, cook and sit at one table. The share you pay depends on how many people come; a large house in a warm place is cheaper per head than hotels for everybody. Pick a place that is easy to reach for the oldest and the youngest, and agree on the costs before you book.',
      'Ein Familientreffen im Ausland: eine Villa für eine Woche, in der sich drei Generationen treffen, kochen und an einem Tisch sitzen können. Dein Anteil hängt davon ab, wie viele Personen kommen; ein großes Haus an einem warmen Ort ist pro Kopf günstiger als Hotels für alle. Wähle einen Ort, der für die Ältesten und die Jüngsten gut erreichbar ist, und einigt euch über die Kosten, bevor ihr bucht.',
    ],
    [
      [
        'A villa for 12-16 people costs about 3,000-6,000 a week in the season in Italy, Spain or Portugal; your share depends on the group. Ask for the final price with the cleaning, the deposit and the tax, and a clear cancellation rule.',
        'Eine Villa für 12-16 Personen kostet in der Saison in Italien, Spanien oder Portugal etwa 3.000-6.000 pro Woche; dein Anteil hängt von der Gruppe ab. Frag nach dem Endpreis mit Reinigung, Kaution und Steuer und nach einer klaren Stornoregel.',
        [k('Vrbo – holiday homes', 'Vrbo – Ferienhäuser', 'https://www.vrbo.com/')],
      ],
      [
        'Flights for your family: about 100-400 per person, more in school holidays. A common airport or a train journey makes arrival easier for the elderly.',
        'Flüge für deine Familie: etwa 100-400 pro Person, in den Schulferien mehr. Ein gemeinsamer Flughafen oder eine Zugreise erleichtert die Anreise für die Älteren.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'Food and activities: shop together and cook in turns; a boat day or a tour for everyone costs about 30-60 per person. Keep one day free for rest.',
        'Essen und Aktivitäten: kauft zusammen ein und kocht abwechselnd; ein Bootstag oder eine Tour für alle kostet etwa 30-60 pro Person. Halte einen Tag zum Ausruhen frei.',
      ],
    ],
    [
      k('Vrbo – holiday homes', 'Vrbo – Ferienhäuser', 'https://www.vrbo.com/'),
      k('Skyscanner – flights', 'Skyscanner – Flüge', 'https://www.skyscanner.net/'),
    ],
    [
      [
        'Ask who comes and fix the dates with the family',
        'Fragen, wer kommt, und die Termine mit der Familie festlegen',
        'high',
      ],
      [
        'Agree the costs and how they are shared before you book',
        'Die Kosten und ihre Aufteilung vereinbaren, bevor du buchst',
        'high',
      ],
      [
        'Choose a place that is easy to reach for the oldest and the youngest',
        'Einen Ort wählen, der für die Ältesten und die Jüngsten gut erreichbar ist',
      ],
      [
        'Plan a shared dinner on the first and the last evening',
        'Ein gemeinsames Essen am ersten und letzten Abend planen',
        'low',
      ],
    ],
    [
      [
        'A deposit and a clear cancellation rule protect you if somebody drops out.',
        'Eine Kaution und eine klare Stornoregel schützen dich, wenn jemand abspringt.',
      ],
    ],
  ),

  D42: dreamDetail(
    [
      'Recording your own album is a project with a producer, a studio and a few days of playing: the songs are written, the studio days are recorded, a mixing and mastering engineer makes them sound the way they should, and the artwork and the distribution bring it into the world. A small album of eight to ten songs is made in four to eight studio days; plan the rehearsals before, because studio time is paid by the hour.',
      'Ein eigenes Album aufzunehmen ist ein Projekt mit einem Produzenten, einem Studio und wenigen Tagen Spielen: die Songs sind geschrieben, die Studiotage werden aufgenommen, ein Mixing- und Mastering-Ingenieur lässt sie so klingen, wie sie sollen, und Artwork und Vertrieb bringen es in die Welt. Ein kleines Album mit acht bis zehn Songs entsteht in vier bis acht Studiotagen; plane die Proben vorher, denn Studiozeit wird nach Stunden bezahlt.',
    ],
    [
      [
        'A studio day with an engineer costs about 350-800; four to eight days are 1,500-5,500. Rehearse the songs until they are tight, and book a studio where you have heard other records.',
        'Ein Studiotag mit Toningenieur kostet etwa 350-800; vier bis acht Tage sind 1.500-5.500. Probe die Songs, bis sie sitzen, und buch ein Studio, dessen andere Aufnahmen du gehört hast.',
      ],
      [
        'Mixing costs about 150-400 a song, mastering 40-100 a song; a good mix and a master make the difference between a demo and a record. Ask for references.',
        'Mixing kostet etwa 150-400 pro Song, Mastering 40-100 pro Song; ein guter Mix und ein Master machen den Unterschied zwischen Demo und Platte. Frag nach Referenzen.',
      ],
      [
        'Artwork, a photo and the distribution through an aggregator (about 20-50 a year) to the streaming services. The registration with the collecting society for the rights of the songs is free or cheap.',
        'Artwork, ein Foto und der Vertrieb über einen Aggregator (etwa 20-50 im Jahr) zu den Streamingdiensten. Die Anmeldung bei der Verwertungsgesellschaft für die Rechte an den Songs ist kostenlos oder günstig.',
        [
          k(
            'GEMA – the collecting society',
            'GEMA – die Verwertungsgesellschaft',
            'https://www.gema.de/',
          ),
          k(
            'DistroKid – music distribution',
            'DistroKid – Musikvertrieb',
            'https://distrokid.com/',
          ),
        ],
      ],
      [
        'A small release party in a club or a café with friends and the first listeners: about 300-1,000. A release has more chance when you play live around it.',
        'Eine kleine Release-Party in einem Club oder Café mit Freunden und ersten Hörern: etwa 300-1.000. Eine Veröffentlichung hat mehr Chancen, wenn du rundherum live spielst.',
      ],
    ],
    [
      k(
        'GEMA – the collecting society',
        'GEMA – die Verwertungsgesellschaft',
        'https://www.gema.de/',
      ),
      k('DistroKid – music distribution', 'DistroKid – Musikvertrieb', 'https://distrokid.com/'),
    ],
    [
      [
        'Rehearse until the songs are tight before the studio',
        'Proben, bis die Songs sitzen, bevor du ins Studio gehst',
        'high',
      ],
      [
        'Choose a studio and an engineer by the records they made',
        'Studio und Toningenieur nach den Platten wählen, die sie gemacht haben',
      ],
      [
        'Register the songs with the collecting society',
        'Die Songs bei der Verwertungsgesellschaft anmelden',
      ],
      [
        'Plan the release with a few live shows around it',
        'Die Veröffentlichung mit einigen Live-Auftritten drumherum planen',
        'low',
      ],
    ],
    [
      [
        'Studio time is paid by the hour: the rehearsal at home is the cheapest part.',
        'Studiozeit wird nach Stunden bezahlt: die Probe zu Hause ist der günstigste Teil.',
      ],
      [
        'The album is finished when it is released: set a date.',
        'Das Album ist fertig, wenn es veröffentlicht ist: setz ein Datum.',
      ],
    ],
  ),

  D43: dreamDetail(
    [
      'A small café is a company: a lease, a renovation that meets the food rules, an espresso machine, staff and a first stock. In Germany a café needs a trade registration, a hygiene certificate and, if it serves alcohol, a permit. The first year is the hardest: opening hours are long and the money comes slowly. Test your idea at a market stall or a pop-up first.',
      'Ein kleines Café ist ein Unternehmen: ein Mietvertrag, ein Umbau, der den Lebensmittelregeln entspricht, eine Espressomaschine, Personal und ein erster Warenbestand. In Deutschland braucht ein Café eine Gewerbeanmeldung, ein Hygienezeugnis und, wenn es Alkohol ausschenkt, eine Erlaubnis. Das erste Jahr ist das härteste: die Öffnungszeiten sind lang und das Geld kommt langsam. Teste deine Idee zuerst an einem Marktstand oder einem Pop-up.',
    ],
    [
      [
        'A good espresso machine costs about 4,000-12,000, a grinder 800-2,000, a fridge, a dishwasher and the furniture another 8,000-15,000. Buy used where the quality does not show, and lease the machine.',
        'Eine gute Espressomaschine kostet etwa 4.000-12.000, eine Mühle 800-2.000, ein Kühlschrank, eine Spülmaschine und die Möbel weitere 8.000-15.000. Kauf gebraucht, wo man die Qualität nicht sieht, und leas die Maschine.',
      ],
      [
        'Renovation of a shop for a café with a kitchen nook, a toilet, ventilation and a floor that meets the hygiene rules: about 15,000-40,000. Ask the authority for the rules before you plan, and the landlord what you may change.',
        'Der Umbau eines Ladens zum Café mit Küchenecke, Toilette, Lüftung und einem Boden, der den Hygieneregeln entspricht: etwa 15.000-40.000. Frag die Behörde nach den Regeln, bevor du planst, und den Vermieter, was du verändern darfst.',
        [
          k(
            'DEHOGA – the hotel and restaurant association',
            'DEHOGA – der Hotel- und Gaststättenverband',
            'https://www.dehoga.de/',
          ),
        ],
      ],
      [
        "The deposit of three months' rent, the trade registration, the hygiene certificate, the insurances and the permits: about 6,000-15,000 together. A founders' advisor helps with the business plan and the loans.",
        'Die Kaution von drei Monatsmieten, die Gewerbeanmeldung, das Hygienezeugnis, die Versicherungen und die Genehmigungen: zusammen etwa 6.000-15.000. Eine Gründungsberatung hilft bei Businessplan und Krediten.',
        [
          k(
            "Founders' platform of the state",
            'Gründerplattform des Bundes',
            'https://www.existenzgruender.de/',
          ),
        ],
      ],
      [
        'The first stock of coffee, milk, cake and cups, the sign and the opening marketing: about 3,000-8,000. A good coffee supplier gives a machine on loan and training for the staff.',
        'Der erste Bestand an Kaffee, Milch, Kuchen und Bechern, das Schild und das Eröffnungsmarketing: etwa 3.000-8.000. Ein guter Kaffeelieferant gibt eine Maschine leihweise und schult das Personal.',
      ],
    ],
    [
      k(
        "Founders' platform of the state",
        'Gründerplattform des Bundes',
        'https://www.existenzgruender.de/',
      ),
      k(
        'DEHOGA – the hotel and restaurant association',
        'DEHOGA – der Hotel- und Gaststättenverband',
        'https://www.dehoga.de/',
      ),
    ],
    [
      [
        'Work in a café for a few months before you open your own',
        'Ein paar Monate in einem Café arbeiten, bevor du ein eigenes eröffnest',
        'high',
      ],
      [
        'Test the idea at a market stall or a pop-up',
        'Die Idee an einem Marktstand oder in einem Pop-up testen',
      ],
      [
        "Write a business plan with a founders' advisor",
        'Mit einer Gründungsberatung einen Businessplan schreiben',
        'high',
      ],
      [
        'Ask the authority for the hygiene and the food rules',
        'Die Behörde nach den Hygiene- und Lebensmittelregeln fragen',
      ],
      [
        'Keep a reserve of six months of rent and wages',
        'Eine Reserve für sechs Monate Miete und Löhne halten',
        'low',
      ],
    ],
    [
      [
        'The location decides: look at the foot traffic at different times before you sign.',
        'Der Standort entscheidet: schau dir die Laufkundschaft zu verschiedenen Zeiten an, bevor du unterschreibst.',
      ],
      [
        'A café is a long day: the work begins before the first guest and ends after the last.',
        'Ein Café ist ein langer Tag: die Arbeit beginnt vor dem ersten Gast und endet nach dem letzten.',
      ],
    ],
  ),

  D44: dreamDetail(
    [
      'Building a school classroom is a gift that lasts: a classroom with furniture and books in a village that has none, built together with a local partner organisation. The cost of one classroom is far below what a European school pays, and a trustworthy partner builds it with local workers and teachers. Choose a registered organisation with reports, a named project and a visit if you can.',
      'Ein Klassenzimmer zu bauen ist ein Geschenk, das bleibt: ein Klassenzimmer mit Möbeln und Büchern in einem Dorf, das keines hat, gebaut zusammen mit einer lokalen Partnerorganisation. Die Kosten eines Klassenzimmers liegen weit unter dem, was eine europäische Schule zahlt, und ein vertrauenswürdiger Partner baut es mit örtlichen Arbeitern und Lehrern. Wähle eine eingetragene Organisation mit Berichten, einem benannten Projekt und, wenn möglich, einem Besuch.',
    ],
    [
      [
        'A simple classroom of 50-60 square metres costs about 8,000-20,000 with the roof, the floor and the walls, depending on the country. Ask the organisation for the budget of the project and for how the school will be kept after the opening.',
        'Ein einfaches Klassenzimmer von 50-60 Quadratmetern kostet je nach Land etwa 8.000-20.000 mit Dach, Boden und Wänden. Frag die Organisation nach dem Budget des Projekts und danach, wie die Schule nach der Eröffnung unterhalten wird.',
        [
          k(
            'betterplace.org – donation projects with reports',
            'betterplace.org – Spendenprojekte mit Berichten',
            'https://www.betterplace.org/',
          ),
        ],
      ],
      [
        'Desks, benches, a blackboard and books for 40 children: about 1,000-2,500. Local carpenters make the furniture, which supports the village.',
        'Tische, Bänke, eine Tafel und Bücher für 40 Kinder: etwa 1.000-2.500. Örtliche Tischler bauen die Möbel, was das Dorf unterstützt.',
      ],
      [
        'A visit to the project: flights, a guesthouse and a few days with the people and the teachers. It is worth the cost if the organisation invites you, and is a joy to see.',
        'Ein Besuch des Projekts: Flüge, eine Pension und einige Tage mit den Menschen und den Lehrern. Er ist die Kosten wert, wenn die Organisation dich einlädt, und eine Freude zu sehen.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
    ],
    [
      k(
        'betterplace.org – donation projects',
        'betterplace.org – Spendenprojekte',
        'https://www.betterplace.org/',
      ),
      k(
        'Global Partnership for Education',
        'Globale Partnerschaft für Bildung',
        'https://www.globalpartnership.org/',
      ),
    ],
    [
      [
        'Choose a registered organisation with reports and a named project',
        'Eine eingetragene Organisation mit Berichten und einem benannten Projekt wählen',
        'high',
      ],
      [
        'Ask who runs and pays for the school after the opening',
        'Fragen, wer die Schule nach der Eröffnung betreibt und bezahlt',
        'high',
      ],
      [
        'Ask for photos and a report of the building',
        'Nach Fotos und einem Bericht vom Bau fragen',
      ],
      [
        'Plan a visit if the organisation invites you',
        'Einen Besuch planen, wenn die Organisation dich einlädt',
        'low',
      ],
    ],
    [
      [
        'A donation receipt is possible for registered organisations: ask for it for the tax.',
        'Eine Spendenbescheinigung ist bei eingetragenen Organisationen möglich: frag danach für die Steuer.',
      ],
      [
        'A school needs teachers and upkeep: the best projects plan for them.',
        'Eine Schule braucht Lehrkräfte und Unterhalt: die besten Projekte planen sie ein.',
      ],
    ],
  ),

  D45: dreamDetail(
    [
      'A horse of your own is a promise for many years: the horse itself, the saddle and the tack, and then every month a stable, feed, the farrier, the vet and the insurance. The purchase is only a part: the running costs of a horse are about 300-700 a month for a livery stable. Try riding, ask the instructor of your stable, and consider a share of a horse first.',
      'Ein eigenes Pferd ist ein Versprechen für viele Jahre: das Pferd selbst, Sattel und Zaumzeug, und dann jeden Monat ein Stall, Futter, der Hufschmied, der Tierarzt und die Versicherung. Der Kauf ist nur ein Teil: die laufenden Kosten eines Pferdes liegen bei etwa 300-700 im Monat für einen Pensionsstall. Probiere das Reiten, frag die Reitlehrerin deines Stalls und überleg erst eine Reitbeteiligung.',
    ],
    [
      [
        'A healthy leisure horse costs about 3,000-10,000, a young or a trained one more. Take your instructor to the trial, ask for the papers and the history of the horse, and try it in different situations.',
        'Ein gesundes Freizeitpferd kostet etwa 3.000-10.000, ein junges oder gut ausgebildetes mehr. Nimm deine Reitlehrerin mit zur Probe, frag nach Papieren und Geschichte des Pferdes und teste es in verschiedenen Situationen.',
        [
          k(
            'German Equestrian Federation (FN)',
            'Deutsche Reiterliche Vereinigung (FN)',
            'https://www.pferd-aktuell.de/',
          ),
        ],
      ],
      [
        'A saddle that fits the horse and the rider costs about 1,000-3,000 new; a saddle fitter adjusts it. Add a bridle, blankets, a helmet and boots.',
        'Ein Sattel, der zu Pferd und Reiter passt, kostet neu etwa 1.000-3.000; ein Sattler passt ihn an. Dazu Trense, Decken, Helm und Stiefel.',
      ],
      [
        'A veterinary examination before the purchase (about 200-500, the larger check with X-rays more) is the most useful money of the whole purchase. It names the risks.',
        'Eine Ankaufsuntersuchung beim Tierarzt (etwa 200-500, die große mit Röntgen mehr) ist das nützlichste Geld des ganzen Kaufs. Sie nennt die Risiken.',
      ],
    ],
    [
      k(
        'German Equestrian Federation (FN)',
        'Deutsche Reiterliche Vereinigung (FN)',
        'https://www.pferd-aktuell.de/',
      ),
    ],
    [
      [
        'Try a riding share for a year before you buy',
        'Vor dem Kauf ein Jahr lang eine Reitbeteiligung probieren',
        'high',
      ],
      [
        'Take your instructor to the trial and book a vet check',
        'Deine Reitlehrerin zur Probe mitnehmen und eine Ankaufsuntersuchung buchen',
        'high',
      ],
      [
        'Find a stable and ask the full monthly price',
        'Einen Stall finden und nach dem vollen Monatspreis fragen',
      ],
      [
        'Take out a liability and a surgery insurance for the horse',
        'Eine Haftpflicht- und eine OP-Versicherung für das Pferd abschließen',
        'low',
      ],
    ],
    [
      [
        'A horse lives twenty to thirty years: it is a promise, not a purchase.',
        'Ein Pferd lebt zwanzig bis dreißig Jahre: es ist ein Versprechen, kein Kauf.',
      ],
      [
        'The game counts the purchase; the monthly costs are the real price.',
        'Das Spiel rechnet den Kauf; die monatlichen Kosten sind der wahre Preis.',
      ],
    ],
  ),

  D46: dreamDetail(
    [
      'Your own sailboat is a used yacht of about 30 feet that you can sail with a small crew: a family cruiser or a weekend boat. Buy with a survey by an expert, and expect the first year to bring a refit: sails, rigging, an engine service. Running costs of a berth, insurance and winter storage are about 10 % of the price a year.',
      'Dein eigenes Segelboot ist eine gebrauchte Yacht von etwa 30 Fuß, die du mit einer kleinen Crew segeln kannst: ein Familienkreuzer oder ein Wochenendboot. Kauf mit einem Gutachten eines Sachverständigen und rechne damit, dass das erste Jahr eine Überholung bringt: Segel, Rigg, eine Motorwartung. Laufende Kosten für Liegeplatz, Versicherung und Winterlager liegen bei etwa 10 % des Preises pro Jahr.',
    ],
    [
      [
        'A used 30-foot yacht of 15-25 years costs about 25,000-55,000 depending on the make and the state. Look at the hull, the keel bolts, the engine hours and the rigging; ask for the papers and the history.',
        'Eine gebrauchte 30-Fuß-Yacht von 15-25 Jahren kostet je nach Marke und Zustand etwa 25.000-55.000. Schau auf Rumpf, Kielbolzen, Motorstunden und Rigg; frag nach Papieren und Geschichte.',
        [k('German Sailing Association', 'Deutscher Segler-Verband', 'https://www.dsv.org/')],
      ],
      [
        'A survey by an independent expert costs about 800-1,500 and names what must be done; use it to bargain. The refit of sails, ropes and an engine service can cost 2,000-6,000 in the first year.',
        'Ein Gutachten eines unabhängigen Sachverständigen kostet etwa 800-1.500 und nennt, was gemacht werden muss; nutze es zum Verhandeln. Die Überholung von Segeln, Tauwerk und eine Motorwartung kann im ersten Jahr 2.000-6.000 kosten.',
      ],
      [
        'Life jackets, a liferaft or a dinghy, flares, a VHF radio and a first-aid kit: about 1,500-3,500. The safety gear is checked every year.',
        'Rettungswesten, eine Rettungsinsel oder ein Dinghi, Signalmittel, ein UKW-Funkgerät und ein Erste-Hilfe-Set: etwa 1.500-3.500. Die Sicherheitsausrüstung wird jedes Jahr geprüft.',
      ],
    ],
    [
      k('German Sailing Association', 'Deutscher Segler-Verband', 'https://www.dsv.org/'),
      k('DMYV – sports boat licences', 'DMYV – Sportbootführerscheine', 'https://www.dmyv.de/'),
    ],
    [
      [
        'Sail on a charter boat of the same size first',
        'Zuerst auf einem Charterboot derselben Größe segeln',
        'high',
      ],
      [
        'Order a survey by an independent expert before you pay',
        'Vor der Zahlung ein Gutachten eines unabhängigen Sachverständigen bestellen',
        'high',
      ],
      [
        'Ask for the price of a berth, insurance and winter storage',
        'Nach dem Preis für Liegeplatz, Versicherung und Winterlager fragen',
      ],
      [
        'Take the licences you need for the waters you sail',
        'Die Scheine machen, die du für die Gewässer brauchst, die du segelst',
        'low',
      ],
    ],
    [
      [
        'A boat costs money at its berth: plan ten percent of its price a year.',
        'Ein Boot kostet Geld an seinem Liegeplatz: plane zehn Prozent seines Preises pro Jahr ein.',
      ],
      [
        'A berth is hard to find in good harbours: ask the clubs early.',
        'Ein Liegeplatz ist in guten Häfen schwer zu finden: frag die Vereine früh.',
      ],
    ],
  ),

  D47: dreamDetail(
    [
      'A watch for life is a mechanical watch you can wear for decades and hand on: a good brand with a service network, a movement that can be repaired and a case that ages well. It is a dream that holds its value better than most things: some models keep or gain in value, but most lose a part in the first years. Buy what you love and wear it.',
      'Eine Uhr fürs Leben ist eine mechanische Uhr, die du jahrzehntelang tragen und weitergeben kannst: eine gute Marke mit Servicenetz, ein Uhrwerk, das repariert werden kann, und ein Gehäuse, das gut altert. Es ist ein Traum, der seinen Wert besser hält als das meiste: manche Modelle behalten oder gewinnen an Wert, die meisten verlieren in den ersten Jahren einen Teil. Kauf, was du liebst, und trag sie.',
    ],
    [
      [
        'A good mechanical watch of a known brand costs about 3,000-12,000 new; used from a dealer with a guarantee it is often 20-40 % less. Buy at an official dealer or a trusted shop, and keep the box, the papers and the receipt.',
        'Eine gute mechanische Uhr einer bekannten Marke kostet neu etwa 3.000-12.000; gebraucht bei einem Händler mit Garantie oft 20-40 % weniger. Kauf bei einem offiziellen Händler oder einem vertrauenswürdigen Geschäft und behalte Box, Papiere und Beleg.',
        [
          k(
            'Chrono24 – the watch marketplace',
            'Chrono24 – der Uhrenmarkt',
            'https://www.chrono24.com/',
          ),
        ],
      ],
      [
        'A service every five to ten years costs about 300-800 and keeps the watch running; an insurance for loss and theft costs about 1-2 % of the value a year. Ask your home insurance first.',
        'Eine Revision alle fünf bis zehn Jahre kostet etwa 300-800 und hält die Uhr am Laufen; eine Versicherung gegen Verlust und Diebstahl kostet etwa 1-2 % des Wertes pro Jahr. Frag zuerst deine Hausratversicherung.',
      ],
    ],
    [
      k(
        'Chrono24 – the watch marketplace',
        'Chrono24 – der Uhrenmarkt',
        'https://www.chrono24.com/',
      ),
    ],
    [
      [
        'Try on watches in a shop before you decide',
        'Uhren in einem Geschäft anprobieren, bevor du dich entscheidest',
        'high',
      ],
      [
        'Buy from an official dealer or a trusted shop',
        'Bei einem offiziellen Händler oder einem vertrauenswürdigen Geschäft kaufen',
      ],
      [
        'Keep the papers and the box; plan a service every five to ten years',
        'Papiere und Box behalten; alle fünf bis zehn Jahre eine Revision einplanen',
        'low',
      ],
    ],
    [
      [
        'A watch is jewellery you use: it is worth what it gives you each day, not what it may sell for.',
        'Eine Uhr ist Schmuck, den du benutzt: sie ist das wert, was sie dir jeden Tag gibt, nicht das, wofür sie sich verkaufen lässt.',
      ],
    ],
  ),

  D48: dreamDetail(
    [
      'Planting a forest is a gift to the future: a hectare of trees with a trustworthy partner, a day of planting with your own hands and the care of the young trees for three years. A hectare takes about 2,000-3,000 trees; the survival of the young trees decides whether a forest grows, so ask how the partner cares for them. Choose native species in a mixed forest, planted where trees belong.',
      'Einen Wald zu pflanzen ist ein Geschenk an die Zukunft: ein Hektar Bäume mit einem vertrauenswürdigen Partner, ein Pflanztag mit eigenen Händen und die Pflege der jungen Bäume über drei Jahre. Ein Hektar braucht etwa 2.000-3.000 Bäume; das Überleben der jungen Bäume entscheidet, ob ein Wald wächst, also frag, wie der Partner sie pflegt. Wähle heimische Arten in einem Mischwald, gepflanzt dort, wo Bäume hingehören.',
    ],
    [
      [
        'A hectare of reforestation with a registered partner costs about 5,000-12,000 in Germany, less in some countries, with the plants, the planting and the first fence. Ask for the plan of the species, the place and the monitoring.',
        'Ein Hektar Aufforstung mit einem eingetragenen Partner kostet in Deutschland etwa 5.000-12.000, in einigen Ländern weniger, mit Pflanzen, Pflanzung und erstem Zaun. Frag nach Plan für Arten, Ort und Kontrolle.',
        [
          k(
            'Plant-for-the-Planet – tree planting',
            'Plant-for-the-Planet – Baumpflanzung',
            'https://www.plant-for-the-planet.org/',
          ),
        ],
      ],
      [
        'A day trip to plant with your own hands: the partner organises it. Take sturdy shoes and gloves, and bring friends or the family.',
        'Ein Ausflug zum Pflanzen mit eigenen Händen: der Partner organisiert ihn. Nimm feste Schuhe und Handschuhe mit und bring Freunde oder die Familie mit.',
      ],
      [
        'The care of the young trees for three years - cutting back the grass, replacing dead plants, protecting from game - is what makes the forest. Ask for a report each year.',
        'Die Pflege der jungen Bäume über drei Jahre - das Gras zurückschneiden, tote Pflanzen ersetzen, Wildschutz - macht den Wald. Frag jedes Jahr nach einem Bericht.',
        [k('WWF – forests', 'WWF – Wälder', 'https://www.wwf.de/')],
      ],
    ],
    [
      k('Plant-for-the-Planet', 'Plant-for-the-Planet', 'https://www.plant-for-the-planet.org/'),
      k('WWF – forests', 'WWF – Wälder', 'https://www.wwf.de/'),
    ],
    [
      [
        'Choose a registered partner that reports on the survival of the trees',
        'Einen eingetragenen Partner wählen, der über das Überleben der Bäume berichtet',
        'high',
      ],
      [
        'Ask which species are planted and where',
        'Fragen, welche Arten gepflanzt werden und wo',
        'high',
      ],
      [
        'Plan a planting day with friends or family',
        'Einen Pflanztag mit Freunden oder Familie planen',
      ],
      [
        'Ask for a yearly report and a photo of the plot',
        'Jährlich um einen Bericht und ein Foto der Fläche bitten',
        'low',
      ],
    ],
    [
      [
        'A tree planted is not a tree grown: the first three years decide.',
        'Ein gepflanzter Baum ist kein gewachsener Baum: die ersten drei Jahre entscheiden.',
      ],
      [
        'Mixed forests of native trees take storms and drought better than one species.',
        'Mischwälder aus heimischen Bäumen halten Stürme und Trockenheit besser aus als eine Art.',
      ],
    ],
  ),
};
