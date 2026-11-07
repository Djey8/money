import { dreamSet, link } from './cashflow-dream-builder';

const SKY = link(
  'Skyscanner – compare flights',
  'Skyscanner – Flüge vergleichen',
  'https://www.skyscanner.net/',
);
const LP = link(
  'Lonely Planet – destination guides',
  'Lonely Planet – Reiseführer',
  'https://www.lonelyplanet.com/',
);
const UNESCO = link('UNESCO World Heritage', 'UNESCO-Welterbe', 'https://whc.unesco.org/');
const VZ = link(
  'Consumer advice – travel insurance',
  'Verbraucherzentrale – Reiseversicherung',
  'https://www.verbraucherzentrale.de/',
);

/** Dreams D49-D60: wonders and journeys (JFK, 2026-11: the deck grows to about a hundred). */
export const MORE_TRAVEL = dreamSet([
  {
    id: 'D49',
    category: 'wonders',
    tier: 'little',
    title: ['Angkor Wat at Sunrise', 'Angkor Wat bei Sonnenaufgang'],
    story: [
      'Five towers rise out of the mist, the lake turns gold, and a thousand years of temples wait behind it.',
      'Fünf Türme steigen aus dem Nebel, der See wird golden, und dahinter warten tausend Jahre Tempel.',
    ],
    description: [
      'Angkor is the largest religious monument in the world: Angkor Wat for the sunrise, then the Bayon with its stone faces and Ta Prohm, held by tree roots. A three-day pass is enough for the main temples; the best months are November to February, before the heat and the rain.',
      'Angkor ist das größte religiöse Bauwerk der Welt: Angkor Wat zum Sonnenaufgang, danach der Bayon mit seinen steinernen Gesichtern und Ta Prohm, von Baumwurzeln gehalten. Ein Drei-Tage-Pass reicht für die Haupttempel; die beste Zeit ist November bis Februar, vor Hitze und Regen.',
    ],
    buckets: [
      [
        'Flights to Siem Reap',
        'Flüge nach Siem Reap',
        1000,
        'Return flights from Europe usually go via Bangkok, Singapore or Doha and cost about 800-1,200. Book 3-4 months ahead.',
        'Hin- und Rückflüge aus Europa gehen meist über Bangkok, Singapur oder Doha und kosten etwa 800-1.200. 3-4 Monate vorher buchen.',
        [SKY],
      ],
      [
        'Guesthouse, 5 nights',
        'Gästehaus, 5 Nächte',
        450,
        'A clean hotel with a pool is about 50-90 a night in Siem Reap; many include a tuk-tuk to the temples.',
        'Ein sauberes Hotel mit Pool kostet in Siem Reap etwa 50-90 pro Nacht; viele bieten ein Tuk-Tuk zu den Tempeln an.',
      ],
      [
        'Temple pass, guide, food',
        'Tempelpass, Führer, Essen',
        450,
        'The three-day pass is about 60; a licensed guide for a day about 40-60. Meals are cheap and good, 5-10 each.',
        'Der Drei-Tage-Pass kostet etwa 60; ein lizenzierter Führer für einen Tag etwa 40-60. Essen ist günstig und gut, 5-10 pro Mahlzeit.',
      ],
    ],
    links: [UNESCO, LP],
    actions: [
      [
        'Plan the sunrise visit: be at the lake before 5 a.m.',
        'Den Sonnenaufgang planen: vor 5 Uhr am See sein',
        'high',
      ],
      ['Check the visa (e-visa) before you fly', 'Das Visum (E-Visum) vor dem Flug prüfen'],
      [
        'Dress for temples: shoulders and knees covered',
        'Tempelgerechte Kleidung: Schultern und Knie bedeckt',
        'low',
      ],
    ],
    notes: [
      [
        'Go in the dry season, November to February; April is very hot.',
        'Fahr in der Trockenzeit, November bis Februar; im April ist es sehr heiß.',
      ],
      [
        'Travel insurance with health cover is worth it in Southeast Asia.',
        'Eine Reiseversicherung mit Gesundheitsschutz lohnt sich in Südostasien.',
      ],
    ],
  },
  {
    id: 'D50',
    category: 'wonders',
    tier: 'big',
    title: ['The Pyramids and a Nile Cruise', 'Die Pyramiden und eine Nilkreuzfahrt'],
    story: [
      'Stand before the last of the ancient wonders, then drift past Luxor and Aswan on the river of the pharaohs.',
      'Steh vor dem letzten der antiken Weltwunder und gleite dann auf dem Fluss der Pharaonen an Luxor und Assuan vorbei.',
    ],
    description: [
      'A week in Egypt: the pyramids of Giza and the new Grand Egyptian Museum in Cairo, then four nights on the Nile from Luxor to Aswan with the temples of Karnak, Edfu and Philae. Winter is the comfortable season; summer is extremely hot.',
      'Eine Woche in Ägypten: die Pyramiden von Gizeh und das neue Große Ägyptische Museum in Kairo, dann vier Nächte auf dem Nil von Luxor nach Assuan mit den Tempeln von Karnak, Edfu und Philae. Der Winter ist die angenehme Zeit; im Sommer ist es extrem heiß.',
    ],
    buckets: [
      [
        'Flights',
        'Flüge',
        650,
        'Direct flights from Germany to Cairo or Luxor cost about 400-700; charter flights in winter are often cheaper.',
        'Direktflüge von Deutschland nach Kairo oder Luxor kosten etwa 400-700; Charterflüge im Winter sind oft günstiger.',
        [SKY],
      ],
      [
        'Nile cruise, 4 nights',
        'Nilkreuzfahrt, 4 Nächte',
        1400,
        'A good five-star ship with full board costs about 300-450 a night for two; the price usually includes some excursions.',
        'Ein gutes Fünf-Sterne-Schiff mit Vollpension kostet etwa 300-450 pro Nacht für zwei; im Preis sind meist einige Ausflüge enthalten.',
      ],
      [
        'Cairo and Giza, 3 nights',
        'Kairo und Gizeh, 3 Nächte',
        700,
        'A hotel with a pyramid view is 100-200 a night; a private guide for a day costs about 60-100.',
        'Ein Hotel mit Pyramidenblick kostet 100-200 pro Nacht; ein privater Führer für einen Tag etwa 60-100.',
      ],
      [
        'Visa, tickets, tips, food',
        'Visum, Tickets, Trinkgelder, Essen',
        450,
        'The visa is about 25; the tickets for the sites add up to 100-150. Tips are expected at every step: keep small notes.',
        'Das Visum kostet etwa 25; die Eintritte der Stätten summieren sich auf 100-150. Trinkgeld wird überall erwartet: halte kleine Scheine bereit.',
      ],
    ],
    links: [
      link(
        'Egypt official tourism',
        'Ägypten – offizielle Tourismusseite',
        'https://egypt.travel/',
      ),
      LP,
      VZ,
    ],
    actions: [
      [
        'Choose a cruise operator with good recent reviews',
        'Einen Kreuzfahrtanbieter mit guten aktuellen Bewertungen wählen',
        'high',
      ],
      [
        'Check the travel advice of the foreign office before booking',
        'Vor der Buchung die Reisehinweise des Auswärtigen Amts prüfen',
        'high',
      ],
      ['Go between November and March', 'Zwischen November und März reisen'],
    ],
    notes: [
      [
        'The pyramids are best at opening time, before the heat and the crowds.',
        'Die Pyramiden sind am schönsten zur Öffnungszeit, vor Hitze und Andrang.',
      ],
    ],
  },
  {
    id: 'D51',
    category: 'wonders',
    tier: 'little',
    title: ['A Balloon over Cappadocia', 'Ein Ballon über Kappadokien'],
    story: [
      'At dawn a hundred balloons rise between fairy chimneys and cave houses, and the valleys glow in rose and gold.',
      'Im Morgengrauen steigen hundert Ballons zwischen Feenkaminen und Höhlenhäusern auf, und die Täler leuchten in Rosa und Gold.',
    ],
    description: [
      'Cappadocia in central Turkey is a landscape of soft volcanic rock carved into homes, churches and cities. The balloon flight at sunrise takes about an hour and costs less than most people expect; the weather decides, so plan three nights in case a flight is cancelled.',
      'Kappadokien in der Zentraltürkei ist eine Landschaft aus weichem Vulkangestein, in das Häuser, Kirchen und Städte gehauen sind. Die Ballonfahrt bei Sonnenaufgang dauert etwa eine Stunde und kostet weniger, als die meisten erwarten; das Wetter entscheidet, plane also drei Nächte ein, falls eine Fahrt ausfällt.',
    ],
    buckets: [
      [
        'Flights to Kayseri or Nevşehir',
        'Flüge nach Kayseri oder Nevşehir',
        650,
        'Return flights via Istanbul cost about 350-700, direct from some German airports in the season.',
        'Hin- und Rückflüge über Istanbul kosten etwa 350-700, in der Saison ab einigen deutschen Flughäfen direkt.',
        [SKY],
      ],
      [
        'Cave hotel, 3 nights',
        'Höhlenhotel, 3 Nächte',
        600,
        'A cave hotel in Göreme is about 100-250 a night; breakfast on the terrace with a balloon view is usually included.',
        'Ein Höhlenhotel in Göreme kostet etwa 100-250 pro Nacht; das Frühstück auf der Terrasse mit Ballonblick ist meist inbegriffen.',
      ],
      [
        'Balloon flight and tours',
        'Ballonfahrt und Touren',
        750,
        'A standard balloon flight is about 150-250 per person, a premium small basket 300-400. A day tour of the valleys costs 50-80.',
        'Eine Standard-Ballonfahrt kostet etwa 150-250 pro Person, ein kleiner Premium-Korb 300-400. Eine Tagestour durch die Täler kostet 50-80.',
      ],
    ],
    links: [
      link(
        'Go Türkiye – official tourism',
        'Go Türkiye – offizielle Tourismusseite',
        'https://goturkiye.com/',
      ),
      LP,
    ],
    actions: [
      [
        'Book the balloon through a company with a safety record',
        'Die Ballonfahrt bei einer Firma mit Sicherheitsbilanz buchen',
        'high',
      ],
      [
        'Plan one spare morning for bad weather',
        'Einen Reservemorgen für schlechtes Wetter einplanen',
      ],
      [
        'Dress in layers: dawn on the balloon is cold',
        'In Schichten kleiden: der Morgen im Ballon ist kalt',
        'low',
      ],
    ],
    notes: [
      [
        'The flight is at dawn and cold: dress in layers.',
        'Die Fahrt ist im Morgengrauen und kalt: zieh dich in Schichten an.',
      ],
    ],
  },
  {
    id: 'D52',
    category: 'wonders',
    tier: 'little',
    title: ['Victoria Falls, the Smoke that Thunders', 'Die Victoriafälle, der donnernde Rauch'],
    story: [
      'A mile of water falls into a gorge, the spray rises hundreds of metres, and you stand in the rainbow.',
      'Eine Meile Wasser stürzt in eine Schlucht, die Gischt steigt hunderte Meter hoch, und du stehst im Regenbogen.',
    ],
    description: [
      "Victoria Falls lie on the border of Zambia and Zimbabwe. The water is highest in March to May, when the spray hides the view; from June to October you see more of the falls. Add a sunset cruise on the Zambezi and, if you dare, the Devil's Pool.",
      "Die Victoriafälle liegen an der Grenze von Sambia und Simbabwe. Der Wasserstand ist von März bis Mai am höchsten, dann verdeckt die Gischt den Blick; von Juni bis Oktober sieht man mehr von den Fällen. Dazu eine Sonnenuntergangsfahrt auf dem Sambesi und, wenn du dich traust, der Devil's Pool.",
    ],
    buckets: [
      [
        'Flights',
        'Flüge',
        1300,
        'Return flights to Livingstone or Victoria Falls via Johannesburg, Nairobi or Addis cost about 900-1,400.',
        'Hin- und Rückflüge nach Livingstone oder Victoria Falls über Johannesburg, Nairobi oder Addis kosten etwa 900-1.400.',
        [SKY],
      ],
      [
        'Lodge, 4 nights',
        'Lodge, 4 Nächte',
        800,
        'A comfortable lodge is about 120-250 a night. The Zambian side is usually cheaper than Zimbabwe.',
        'Eine komfortable Lodge kostet etwa 120-250 pro Nacht. Die sambische Seite ist meist günstiger als Simbabwe.',
      ],
      [
        'Falls, cruise and activities',
        'Fälle, Bootsfahrt und Aktivitäten',
        600,
        'Entry to the falls about 50, a sunset cruise 60-90, the bridge and a helicopter flight more. Visas can be bought at the border.',
        'Eintritt zu den Fällen etwa 50, Sonnenuntergangsfahrt 60-90, Brücke und Hubschrauberflug mehr. Visa gibt es an der Grenze.',
      ],
    ],
    links: [LP, VZ],
    actions: [
      [
        'Choose the month by the water level and your wish for a view',
        'Den Monat nach Wasserstand und Wunsch nach Aussicht wählen',
        'high',
      ],
      ['Check the visa and vaccination advice', 'Visa und Impfempfehlungen prüfen'],
      [
        'Bring a rain jacket for the walk along the falls',
        'Eine Regenjacke für den Weg an den Fällen mitnehmen',
        'low',
      ],
    ],
    notes: [
      [
        "The Devil's Pool is only open when the water is low, from about September to December.",
        "Der Devil's Pool ist nur bei niedrigem Wasser offen, etwa von September bis Dezember.",
      ],
    ],
  },
  {
    id: 'D53',
    category: 'travel',
    tier: 'big',
    title: ['Iceland, All the Way Round', 'Island, einmal rundherum'],
    story: [
      'Waterfalls, black beaches, glaciers and hot springs on one road that circles the whole island.',
      'Wasserfälle, schwarze Strände, Gletscher und heiße Quellen an einer Straße, die einmal um die ganze Insel führt.',
    ],
    description: [
      'The Ring Road is about 1,330 km and takes 8-10 days with time for stops: Reykjavik, the Golden Circle, Vik, the glacier lagoon Jökulsárlón, the north with Mývatn and Akureyri. Iceland is expensive, so the booking order matters: car and rooms first, in summer months ahead.',
      'Die Ringstraße ist etwa 1.330 km lang und braucht mit Stopps 8-10 Tage: Reykjavik, der Goldene Kreis, Vik, die Gletscherlagune Jökulsárlón, der Norden mit Mývatn und Akureyri. Island ist teuer, also ist die Buchungsreihenfolge wichtig: zuerst Auto und Zimmer, im Sommer Monate vorher.',
    ],
    buckets: [
      [
        'Flights',
        'Flüge',
        450,
        'Direct flights from many German airports cost about 250-500 return; summer is dearest.',
        'Direktflüge von vielen deutschen Flughäfen kosten hin und zurück etwa 250-500; der Sommer ist am teuersten.',
        [SKY],
      ],
      [
        'Car, 9 days',
        'Mietwagen, 9 Tage',
        1500,
        'A small 4x4 for 9 days costs about 900-1,800 with full insurance (gravel and sand-storm cover are worth it). Fuel adds 300-400.',
        'Ein kleiner Allrad für 9 Tage kostet mit Vollkasko etwa 900-1.800 (Schotter- und Sandsturm-Schutz lohnen sich). Sprit kommt mit 300-400 dazu.',
      ],
      [
        'Guesthouses, 9 nights',
        'Gästehäuser, 9 Nächte',
        2000,
        'A double room is about 150-250 a night in summer. Book early; farm stays are cheaper.',
        'Ein Doppelzimmer kostet im Sommer etwa 150-250 pro Nacht. Früh buchen; Bauernhöfe sind günstiger.',
      ],
      [
        'Food, hot springs, tours',
        'Essen, heiße Quellen, Touren',
        1050,
        'A supermarket picnic saves a lot; a meal in a restaurant is about 30-45. A glacier walk or whale watching 80-130.',
        'Ein Picknick aus dem Supermarkt spart viel; ein Restaurantessen kostet etwa 30-45. Gletscherwanderung oder Walbeobachtung 80-130.',
        [link('Visit Iceland', 'Visit Iceland', 'https://www.visiticeland.com/')],
      ],
    ],
    links: [
      link('Visit Iceland', 'Visit Iceland', 'https://www.visiticeland.com/'),
      link('Road conditions', 'Straßenzustand', 'https://safetravel.is/'),
    ],
    actions: [
      [
        'Book car and guesthouses months ahead for the summer',
        'Auto und Gästehäuser im Sommer Monate vorher buchen',
        'high',
      ],
      [
        'Check road conditions and weather every morning',
        'Jeden Morgen Straßenzustand und Wetter prüfen',
        'high',
      ],
      [
        'Pack waterproof clothes, even in July',
        'Wasserdichte Kleidung einpacken, auch im Juli',
        'low',
      ],
    ],
    notes: [
      [
        'Fuel, food and rooms are expensive: a supermarket and a cooler bag are your friend.',
        'Sprit, Essen und Zimmer sind teuer: Supermarkt und Kühltasche sind deine Freunde.',
      ],
      [
        'The weather changes in minutes; plan a spare day.',
        'Das Wetter wechselt in Minuten; plane einen Reservetag ein.',
      ],
    ],
  },
  {
    id: 'D54',
    category: 'travel',
    tier: 'grand',
    title: ['The Trans-Siberian by Train', 'Mit der Transsibirischen Eisenbahn'],
    story: [
      'Seven time zones, endless birch forest, tea from the samovar and Lake Baikal in the window.',
      'Sieben Zeitzonen, endloser Birkenwald, Tee aus dem Samowar und der Baikalsee im Fenster.',
    ],
    description: [
      'The classic route runs from Moscow to Vladivostok, 9,289 km in about a week without stops. As entry to Russia is not advisable at the moment, the dream today is the Trans-Mongolian route from Beijing via Ulaanbaatar to Irkutsk, or the Kazakh and Mongolian branches: check the travel advice and stay flexible.',
      'Die klassische Strecke führt von Moskau nach Wladiwostok, 9.289 km in etwa einer Woche ohne Halt. Da eine Einreise nach Russland derzeit nicht ratsam ist, ist der Traum heute die Transmongolische Route von Peking über Ulan Bator nach Irkutsk oder die kasachischen und mongolischen Abschnitte: prüfe die Reisehinweise und bleib flexibel.',
    ],
    buckets: [
      [
        'Flights out and back',
        'Flüge hin und zurück',
        1500,
        'Open-jaw flights to Beijing and home from the end point cost about 1,100-1,800.',
        'Open-Jaw-Flüge nach Peking und vom Endpunkt zurück kosten etwa 1.100-1.800.',
        [SKY],
      ],
      [
        'Train tickets, 2nd class',
        'Zugtickets, 2. Klasse',
        2500,
        'A multi-stage journey with berths in a four-berth compartment costs about 2,000-3,500 in total; first class is double.',
        'Eine Reise in mehreren Etappen mit Schlafplätzen im Vierer-Abteil kostet insgesamt etwa 2.000-3.500; erste Klasse das Doppelte.',
        [
          link(
            'The Man in Seat 61 – train guide',
            'The Man in Seat 61 – Zugratgeber',
            'https://www.seat61.com/',
          ),
        ],
      ],
      [
        'Hotels on the stops, 12 nights',
        'Hotels an den Stopps, 12 Nächte',
        2500,
        'Stop in Ulaanbaatar, Irkutsk and at the lake for a few nights each: 60-150 a night.',
        'Halte in Ulan Bator, Irkutsk und am See für einige Nächte: 60-150 pro Nacht.',
      ],
      [
        'Visas, food, extras',
        'Visa, Essen, Extras',
        1000,
        'Visas for China, Mongolia and others cost 100-300 together; bring food for the train and buy fresh at the stations.',
        'Visa für China, Mongolei und andere kosten zusammen 100-300; bring Essen für den Zug mit und kauf frisch an den Bahnhöfen.',
      ],
    ],
    links: [link('The Man in Seat 61', 'The Man in Seat 61', 'https://www.seat61.com/'), LP],
    actions: [
      [
        'Check the travel advice of the foreign office for each country of the route',
        'Die Reisehinweise des Auswärtigen Amts für jedes Land der Route prüfen',
        'high',
      ],
      [
        'Plan the visas early, they take weeks',
        'Die Visa früh planen, sie brauchen Wochen',
        'high',
      ],
      [
        'Pick the stops: Lake Baikal is the one not to miss',
        'Die Stopps wählen: der Baikalsee ist der, den man nicht verpassen sollte',
      ],
    ],
    notes: [
      [
        'The train is a way of life for days: bring books, tea and patience.',
        'Der Zug ist tagelang eine Lebensform: bring Bücher, Tee und Geduld mit.',
      ],
    ],
  },
  {
    id: 'D55',
    category: 'travel',
    tier: 'big',
    title: ['An Overwater Week in the Maldives', 'Eine Woche im Wasserbungalow auf den Malediven'],
    story: [
      'Step from your terrace into water so clear you can count the fish below you.',
      'Tritt von deiner Terrasse in Wasser, so klar, dass du die Fische unter dir zählen kannst.',
    ],
    description: [
      'Each resort is its own island, so the board you choose decides the price: half board is the usual balance. Guesthouses on local islands are much cheaper and give a look into real island life. The best weather is from December to April.',
      'Jedes Resort ist eine eigene Insel, daher entscheidet die Verpflegung über den Preis: Halbpension ist der übliche Mittelweg. Gästehäuser auf lokalen Inseln sind viel günstiger und geben einen Einblick ins echte Inselleben. Das beste Wetter ist von Dezember bis April.',
    ],
    buckets: [
      [
        'Flights',
        'Flüge',
        900,
        'Return flights to Malé cost about 700-1,100 from Germany, via the Gulf or direct in winter.',
        'Hin- und Rückflüge nach Malé kosten ab Deutschland etwa 700-1.100, über die Golfstaaten oder im Winter direkt.',
        [SKY],
      ],
      [
        'Resort, 7 nights, half board',
        'Resort, 7 Nächte, Halbpension',
        5000,
        'A water villa with half board costs about 450-900 a night for two, a beach villa less.',
        'Eine Wasservilla mit Halbpension kostet etwa 450-900 pro Nacht für zwei, eine Strandvilla weniger.',
      ],
      [
        'Seaplane transfer',
        'Wasserflugzeug-Transfer',
        700,
        'The seaplane or speedboat transfer is about 250-450 per person return and is a highlight in itself.',
        'Der Transfer per Wasserflugzeug oder Schnellboot kostet etwa 250-450 pro Person hin und zurück und ist selbst ein Höhepunkt.',
      ],
      [
        'Snorkelling, spa, extras',
        'Schnorcheln, Spa, Extras',
        900,
        'Snorkelling is often free at the house reef; a dolphin trip is 60-100, a spa treatment 150.',
        'Schnorcheln ist am Hausriff oft gratis; eine Delfintour kostet 60-100, eine Spa-Behandlung 150.',
      ],
    ],
    links: [link('Visit Maldives', 'Visit Maldives', 'https://visitmaldives.com/'), LP],
    actions: [
      [
        'Compare half board and all inclusive: drinks are expensive',
        'Halbpension und All Inclusive vergleichen: Getränke sind teuer',
        'high',
      ],
      [
        'Choose a resort with a good house reef for snorkelling',
        'Ein Resort mit gutem Hausriff zum Schnorcheln wählen',
      ],
      [
        'Think about a guesthouse island to save a lot',
        'Eine Gästehaus-Insel erwägen, das spart viel',
        'low',
      ],
    ],
    notes: [
      [
        'Do not touch corals and use reef-safe sun cream.',
        'Berühre keine Korallen und nutze riffschonende Sonnencreme.',
      ],
    ],
  },
  {
    id: 'D56',
    category: 'travel',
    tier: 'big',
    title: ['Route 66 in a Mustang', 'Die Route 66 im Mustang'],
    story: [
      'Chicago to Santa Monica, 3,900 km of diners, neon signs and open desert with the roof down.',
      'Chicago bis Santa Monica, 3.900 km Diners, Neonschilder und offene Wüste mit offenem Dach.',
    ],
    description: [
      'The old Mother Road is no longer one road, but the stretches that remain are the best part: Missouri, Oklahoma, the Texas panhandle, New Mexico and Arizona. Two to three weeks give you time to stop at the museums and the diners. Spring and autumn are comfortable; summer in the desert is hot.',
      'Die alte Mother Road ist nicht mehr eine Straße, aber die Abschnitte, die bleiben, sind der beste Teil: Missouri, Oklahoma, der Texas-Panhandle, New Mexico und Arizona. Zwei bis drei Wochen geben Zeit für die Museen und die Diners. Frühjahr und Herbst sind angenehm; im Sommer ist es in der Wüste heiß.',
    ],
    buckets: [
      [
        'Flights, open jaw',
        'Flüge, Open Jaw',
        1300,
        'Into Chicago and home from Los Angeles about 900-1,400 return.',
        'Nach Chicago hin und von Los Angeles zurück etwa 900-1.400.',
        [SKY],
      ],
      [
        'Convertible, 16 days',
        'Cabrio, 16 Tage',
        2600,
        'A Mustang convertible from a one-way rental costs about 2,000-3,200 with insurance and the one-way fee.',
        'Ein Mustang-Cabrio im One-Way-Mietvertrag kostet mit Versicherung und Einwegegebühr etwa 2.000-3.200.',
      ],
      [
        'Motels, 15 nights',
        'Motels, 15 Nächte',
        1900,
        'A historic motel is about 90-140 a night; book the famous ones early.',
        'Ein historisches Motel kostet etwa 90-140 pro Nacht; die berühmten früh buchen.',
      ],
      [
        'Fuel, food and sights',
        'Sprit, Essen und Sehenswürdigkeiten',
        1200,
        'Fuel is about 500-700 for the route; a diner meal is 15-25; the Grand Canyon detour adds a park fee.',
        'Sprit kostet für die Strecke etwa 500-700; ein Diner-Essen 15-25; der Abstecher zum Grand Canyon bringt eine Parkgebühr.',
        [link('National Park Service', 'National Park Service', 'https://www.nps.gov/')],
      ],
    ],
    links: [
      link(
        'Route 66 information',
        'Route-66-Informationen',
        'https://www.nps.gov/subjects/travelroute66/index.htm',
      ),
      LP,
    ],
    actions: [
      [
        'Pick the stretches and the stops you do not want to miss',
        'Die Abschnitte und Stopps wählen, die du nicht verpassen willst',
        'high',
      ],
      ['Check the ESTA and the driving licence rules', 'ESTA und Führerscheinregeln prüfen'],
      [
        'Book the one-way rental early; it is dearer later',
        'Den One-Way-Mietwagen früh buchen; später ist er teurer',
        'low',
      ],
    ],
    notes: [
      [
        'Plan about 300 km a day; the detours are the point.',
        'Plane etwa 300 km am Tag; die Abstecher sind der Sinn.',
      ],
    ],
  },
  {
    id: 'D57',
    category: 'travel',
    tier: 'grand',
    title: ['The Galápagos Islands', 'Die Galápagos-Inseln'],
    story: [
      "Sea lions on the beach, giant tortoises in the highlands and fearless birds: Darwin's islands as they were.",
      'Seelöwen am Strand, Riesenschildkröten im Hochland und furchtlose Vögel: Darwins Inseln, wie sie waren.',
    ],
    description: [
      'A week-long small-ship cruise reaches the outer islands where the wildlife is thickest; a land-based stay on Santa Cruz and day trips is cheaper but sees less. All visitors pay a park fee and follow strict rules. The best months are June to November (cool, dry) or January to May (warm, calm sea).',
      'Eine einwöchige Kreuzfahrt auf einem kleinen Schiff erreicht die äußeren Inseln, wo die Tierwelt am dichtesten ist; ein Landaufenthalt auf Santa Cruz mit Tagesausflügen ist günstiger, sieht aber weniger. Alle Besucher zahlen eine Parkgebühr und halten sich an strenge Regeln. Die besten Monate sind Juni bis November (kühl, trocken) oder Januar bis Mai (warm, ruhige See).',
    ],
    buckets: [
      [
        'Flights to Quito or Guayaquil',
        'Flüge nach Quito oder Guayaquil',
        1300,
        'Return flights from Europe cost about 900-1,400.',
        'Hin- und Rückflüge aus Europa kosten etwa 900-1.400.',
        [SKY],
      ],
      [
        'Flights to the islands',
        'Flüge auf die Inseln',
        600,
        'The domestic flight from the mainland to Baltra or San Cristóbal costs about 350-500 return.',
        'Der Inlandsflug vom Festland nach Baltra oder San Cristóbal kostet hin und zurück etwa 350-500.',
      ],
      [
        'Small-ship cruise, 7 nights',
        'Kreuzfahrt auf kleinem Schiff, 7 Nächte',
        8500,
        'A tourist-class cruise on a ship for 16-20 guests costs about 6,500-11,000 per person with all meals and guides.',
        'Eine Kreuzfahrt der Touristenklasse auf einem Schiff für 16-20 Gäste kostet etwa 6.500-11.000 pro Person mit allen Mahlzeiten und Führern.',
      ],
      [
        'Park fee, Quito, extras',
        'Parkgebühr, Quito, Extras',
        600,
        'The park fee is 200 plus a transit card; add a night or two in Quito (colonial old town, 80-150 a night).',
        'Die Parkgebühr beträgt 200 plus eine Transitkarte; dazu ein bis zwei Nächte in Quito (Kolonial-Altstadt, 80-150 pro Nacht).',
      ],
    ],
    links: [
      link('Galápagos Conservancy', 'Galápagos Conservancy', 'https://www.galapagos.org/'),
      LP,
    ],
    actions: [
      [
        'Choose a cruise with a licensed naturalist guide',
        'Eine Kreuzfahrt mit lizenziertem Naturführer wählen',
        'high',
      ],
      ['Compare a cruise with a land-based stay', 'Kreuzfahrt und Landaufenthalt vergleichen'],
      [
        'Check the vaccination and insurance advice',
        'Impf- und Versicherungsempfehlungen prüfen',
        'low',
      ],
    ],
    notes: [
      [
        'Keep two metres from the animals; the rules are strict and fines high.',
        'Halte zwei Meter Abstand zu den Tieren; die Regeln sind streng und die Strafen hoch.',
      ],
      [
        'Book the high-season cruises (June-August, December) a year ahead.',
        'Die Hochsaison-Kreuzfahrten (Juni-August, Dezember) ein Jahr vorher buchen.',
      ],
    ],
  },
  {
    id: 'D58',
    category: 'travel',
    tier: 'little',
    title: ['A Month of Slow Life in Bali', 'Ein Monat Langsamkeit auf Bali'],
    story: [
      'Rice terraces in the morning, yoga at noon, a warung supper at night - and nobody is in a hurry.',
      'Reisterrassen am Morgen, Yoga zu Mittag, ein Warung-Abendessen am Abend - und niemand hat es eilig.',
    ],
    description: [
      'A month is long enough to settle in: a room or villa in Ubud or Canggu, a scooter, a gym or a yoga studio, and cheap good food. Many people work remotely from here, so the internet is reliable. Dry season is April to October.',
      'Ein Monat ist lang genug zum Ankommen: ein Zimmer oder eine Villa in Ubud oder Canggu, ein Roller, ein Fitnessstudio oder ein Yoga-Studio und günstiges gutes Essen. Viele arbeiten von hier aus remote, daher ist das Internet zuverlässig. Die Trockenzeit ist von April bis Oktober.',
    ],
    buckets: [
      [
        'Flights',
        'Flüge',
        900,
        'Return flights to Denpasar cost about 700-1,100 via Asia or the Gulf.',
        'Hin- und Rückflüge nach Denpasar kosten etwa 700-1.100 über Asien oder den Golf.',
        [SKY],
      ],
      [
        'Villa or room, 30 nights',
        'Villa oder Zimmer, 30 Nächte',
        1200,
        'A private room with a pool is about 600-1,000 a month, a villa 1,000-1,800 when you book for a month.',
        'Ein Privatzimmer mit Pool kostet etwa 600-1.000 im Monat, eine Villa 1.000-1.800 bei Monatsbuchung.',
      ],
      [
        'Scooter, food, activities',
        'Roller, Essen, Aktivitäten',
        1000,
        'A scooter is about 60-80 a month; a warung meal 3-6; a yoga class 10-15; a cooking class 30.',
        'Ein Roller kostet etwa 60-80 im Monat; ein Warung-Essen 3-6; eine Yogastunde 10-15; ein Kochkurs 30.',
      ],
      [
        'Visa and insurance',
        'Visum und Versicherung',
        400,
        'The visa on arrival is about 35 for 30 days (extendable). A travel health insurance with scooter cover is important.',
        'Das Visum bei Ankunft kostet etwa 35 für 30 Tage (verlängerbar). Eine Reisekrankenversicherung mit Rollerschutz ist wichtig.',
        [VZ],
      ],
    ],
    links: [LP, VZ],
    actions: [
      [
        'Check the visa and entry rules before you fly',
        'Visum und Einreiseregeln vor dem Flug prüfen',
        'high',
      ],
      [
        'Book the first week, then find a place on site',
        'Die erste Woche buchen, dann vor Ort einen Platz finden',
      ],
      [
        'Ask your insurer whether scooter riding is covered',
        'Den Versicherer fragen, ob Rollerfahren abgedeckt ist',
        'high',
      ],
    ],
    notes: [
      [
        'A local licence is needed for the scooter; many insurers do not cover accidents without it.',
        'Für den Roller wird ein lokaler Führerschein gebraucht; viele Versicherer decken Unfälle ohne ihn nicht.',
      ],
    ],
  },
  {
    id: 'D59',
    category: 'travel',
    tier: 'grand',
    title: ['The Orient Express to Venice', 'Mit dem Orient-Express nach Venedig'],
    story: [
      'Dinner in a dining car with white linen, the Alps passing in the window, and the lagoon at the end.',
      'Abendessen im Speisewagen mit weißem Leinen, die Alpen im Fenster und am Ende die Lagune.',
    ],
    description: [
      'A night train in the style of the 1920s: a cabin with a bed, a dinner of several courses and a breakfast at your door, then Venice by morning. The luxury train is a dream of its own; the Venice Simplon-Orient-Express runs between Paris, London and Venice on a few dates a year.',
      'Ein Nachtzug im Stil der 1920er: eine Kabine mit Bett, ein mehrgängiges Abendessen und ein Frühstück an der Tür, am Morgen dann Venedig. Der Luxuszug ist ein Traum für sich; der Venice Simplon-Orient-Express fährt an wenigen Terminen im Jahr zwischen Paris, London und Venedig.',
    ],
    buckets: [
      [
        'Train, one night in a cabin',
        'Zug, eine Nacht in der Kabine',
        5200,
        'A double cabin for the Paris-Venice or Venice-Paris night costs about 4,500-6,500 for two; a suite more.',
        'Eine Doppelkabine für die Nacht Paris-Venedig oder umgekehrt kostet etwa 4.500-6.500 für zwei; eine Suite mehr.',
        [
          link(
            'Belmond – Venice Simplon-Orient-Express',
            'Belmond – Venice Simplon-Orient-Express',
            'https://www.belmond.com/trains/europe/venice-simplon-orient-express/',
          ),
        ],
      ],
      [
        'Hotel in Paris, 2 nights',
        'Hotel in Paris, 2 Nächte',
        1000,
        'A comfortable hotel is about 300-600 a night in the centre.',
        'Ein komfortables Hotel kostet im Zentrum etwa 300-600 pro Nacht.',
      ],
      [
        'Hotel in Venice, 3 nights',
        'Hotel in Venedig, 3 Nächte',
        1500,
        'A hotel on a canal costs about 300-600 a night; the day-visitor tax is a few euros.',
        'Ein Hotel am Kanal kostet etwa 300-600 pro Nacht; die Tagesgast-Gebühr beträgt einige Euro.',
      ],
      [
        'Evening wear, dinners, gondola',
        'Abendgarderobe, Essen, Gondel',
        1300,
        'A dinner dress code (jacket, evening dress) is part of the experience. A gondola ride is about 90 for 30 minutes.',
        'Ein Dresscode zum Abendessen (Jackett, Abendkleid) gehört zum Erlebnis. Eine Gondelfahrt kostet etwa 90 für 30 Minuten.',
      ],
    ],
    links: [
      link(
        'Belmond – the train',
        'Belmond – der Zug',
        'https://www.belmond.com/trains/europe/venice-simplon-orient-express/',
      ),
      link('The Man in Seat 61', 'The Man in Seat 61', 'https://www.seat61.com/'),
    ],
    actions: [
      [
        'Check the dates of the train: it runs only a few times a year',
        'Die Termine des Zuges prüfen: er fährt nur wenige Male im Jahr',
        'high',
      ],
      ['Plan the evening wear and the luggage', 'Abendgarderobe und Gepäck planen'],
      ['Book the hotels around the train dates', 'Die Hotels um die Zugtermine buchen', 'low'],
    ],
    notes: [
      [
        'A cheaper way to the same feeling: a sleeper train to Venice and a dinner in a good restaurant.',
        'Ein günstigerer Weg zum gleichen Gefühl: ein Nachtzug nach Venedig und ein Essen in einem guten Restaurant.',
      ],
    ],
  },
  {
    id: 'D60',
    category: 'travel',
    tier: 'big',
    title: ['Torres del Paine in Patagonia', 'Torres del Paine in Patagonien'],
    story: [
      'Granite towers over turquoise lakes, guanacos on the steppe and wind that tells you where you are.',
      'Granittürme über türkisen Seen, Guanakos in der Steppe und ein Wind, der dir sagt, wo du bist.',
    ],
    description: [
      'The W trek takes four to five days between refuges and shows the Grey Glacier, the French Valley and the base of the towers. The season is October to April; the refuges and campsites have to be booked many months ahead. The weather changes quickly, so good clothes matter more than anything.',
      'Der W-Trek dauert vier bis fünf Tage zwischen Refugios und zeigt den Grey-Gletscher, das Französische Tal und die Basis der Türme. Die Saison ist von Oktober bis April; Refugios und Zeltplätze müssen viele Monate vorher gebucht werden. Das Wetter wechselt schnell, gute Kleidung ist also wichtiger als alles andere.',
    ],
    buckets: [
      [
        'Flights to Punta Arenas',
        'Flüge nach Punta Arenas',
        1500,
        'Return flights via Santiago cost about 1,100-1,800.',
        'Hin- und Rückflüge über Santiago kosten etwa 1.100-1.800.',
        [SKY],
      ],
      [
        'Refuges and camps, W trek',
        'Refugios und Zelte, W-Trek',
        2200,
        'Refuge beds with meals cost about 150-300 a night; a tent pitch less. The booking opens months before the season.',
        'Betten im Refugio mit Mahlzeiten kosten etwa 150-300 pro Nacht; ein Zeltplatz weniger. Die Buchung öffnet Monate vor der Saison.',
        [
          link(
            'Torres del Paine – official park information',
            'Torres del Paine – offizielle Parkinformationen',
            'https://www.conaf.cl/',
          ),
        ],
      ],
      [
        'Gear and boat transfers',
        'Ausrüstung und Boote',
        1200,
        'Waterproof jacket, boots, layers and poles can be rented in part; the park boat is about 30 each way.',
        'Wasserdichte Jacke, Stiefel, Schichten und Stöcke lassen sich teils leihen; das Parkboot kostet etwa 30 pro Fahrt.',
      ],
      [
        'Hotels and food, 5 extra nights',
        'Hotels und Essen, 5 zusätzliche Nächte',
        1600,
        'Punta Arenas and Puerto Natales are cheap bases; a meal is 15-25; the park fee about 40.',
        'Punta Arenas und Puerto Natales sind günstige Standorte; ein Essen kostet 15-25; die Parkgebühr etwa 40.',
      ],
    ],
    links: [LP, link('Chile Travel', 'Chile Travel', 'https://chile.travel/')],
    actions: [
      [
        'Book the refuges the moment the season opens',
        'Die Refugios buchen, sobald die Saison öffnet',
        'high',
      ],
      [
        'Train: hike with a pack of 8-10 kg for a few weekends',
        'Trainieren: ein paar Wochenenden mit 8-10 kg Gepäck wandern',
        'high',
      ],
      [
        'Pack waterproof layers and a good windproof jacket',
        'Wasserdichte Schichten und eine gute Windjacke einpacken',
      ],
    ],
    notes: [
      [
        'The wind can reach 100 km/h: keep a spare day for the towers.',
        'Der Wind kann 100 km/h erreichen: halte einen Reservetag für die Türme frei.',
      ],
    ],
  },
]);
