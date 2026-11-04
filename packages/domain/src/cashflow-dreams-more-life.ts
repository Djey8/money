import { dreamSet, link } from './cashflow-dream-builder';

const VZ = link('Consumer advice', 'Verbraucherzentrale', 'https://www.verbraucherzentrale.de/');
const TEST = link('Stiftung Warentest', 'Stiftung Warentest', 'https://www.test.de/');
const KFW = link('KfW – grants and loans', 'KfW – Förderung und Kredite', 'https://www.kfw.de/');
const BETTER = link(
  'betterplace.org – donation projects with reports',
  'betterplace.org – Spendenprojekte mit Berichten',
  'https://www.betterplace.org/',
);
const SKY = link(
  'Skyscanner – compare flights',
  'Skyscanner – Flüge vergleichen',
  'https://www.skyscanner.net/',
);

/** Dreams D75-D96: vehicles, home, people, creating and giving (JFK, 2026-11: the deck grows to about a hundred). */
export const MORE_LIFE = dreamSet([
  {
    id: 'D75',
    category: 'vehicles',
    tier: 'grand',
    carAfter: true,
    monthlyAfter: 150,
    title: ['An Electric Car', 'Ein Elektroauto'],
    story: [
      'Quiet, fast off the line and cheap to run: the car that charges at home while you sleep.',
      'Leise, spritzig und günstig im Betrieb: das Auto, das zu Hause lädt, während du schläfst.',
    ],
    description: [
      'A new electric car in the compact class costs about 30,000-45,000; used ones from three years old cost much less. Charging at home with a wall box is the biggest saving. Check the range in winter, the charging in your street and the insurance class before you buy.',
      'Ein neues Elektroauto der Kompaktklasse kostet etwa 30.000-45.000; gebrauchte ab drei Jahren viel weniger. Das Laden zu Hause mit einer Wallbox ist die größte Ersparnis. Prüfe die Reichweite im Winter, das Laden in deiner Straße und die Versicherungsklasse vor dem Kauf.',
    ],
    buckets: [
      [
        'The car',
        'Das Auto',
        34000,
        'A compact electric car costs about 30,000-40,000 new; a three-year-old one 18,000-26,000. Look at the battery guarantee (usually 8 years).',
        'Ein kompaktes Elektroauto kostet neu etwa 30.000-40.000; ein drei Jahre altes 18.000-26.000. Achte auf die Batteriegarantie (meist 8 Jahre).',
        [link('ADAC – electric car tests', 'ADAC – Elektroauto-Tests', 'https://www.adac.de/')],
      ],
      [
        'Wall box and installation',
        'Wallbox und Installation',
        1800,
        "A wall box with installation by an electrician costs about 1,200-2,200; ask the landlord or the owners' association first.",
        'Eine Wallbox mit Installation durch einen Elektriker kostet etwa 1.200-2.200; frag zuerst Vermieter oder Eigentümergemeinschaft.',
      ],
      [
        'Registration, insurance, tyres',
        'Zulassung, Versicherung, Reifen',
        2200,
        "Registration and plates about 150; the first year's insurance 600-1,200; a set of winter tyres 600-900.",
        'Zulassung und Kennzeichen etwa 150; die Versicherung für das erste Jahr 600-1.200; ein Satz Winterreifen 600-900.',
        [TEST],
      ],
    ],
    links: [link('ADAC – electric cars', 'ADAC – Elektroautos', 'https://www.adac.de/'), TEST],
    actions: [
      [
        'Test-drive at least three cars, in the rain and on the motorway',
        'Mindestens drei Autos probefahren, bei Regen und auf der Autobahn',
        'high',
      ],
      [
        'Check where you charge: home, work or a public station',
        'Prüfen, wo du lädst: zu Hause, bei der Arbeit oder öffentlich',
        'high',
      ],
      [
        'Compare the total cost over five years, not only the price',
        'Die Gesamtkosten über fünf Jahre vergleichen, nicht nur den Preis',
      ],
    ],
    notes: [
      [
        'The range falls by 20-30 % in cold winters: buy a car with some reserve.',
        'Die Reichweite sinkt in kalten Wintern um 20-30 %: kauf ein Auto mit Reserve.',
      ],
    ],
  },
  {
    id: 'D76',
    category: 'vehicles',
    tier: 'big',
    monthlyAfter: 40,
    title: ['A Classic Vespa', 'Eine klassische Vespa'],
    story: [
      'Cream paint, a two-stroke purr and a summer road that starts at your own door.',
      'Cremefarbener Lack, ein Zweitakt-Schnurren und eine Sommerstraße, die vor deiner eigenen Tür beginnt.',
    ],
    description: [
      'A restored Vespa from the 1960s-80s or a new retro model is a small bike full of character. Buy a well-restored one with papers: a cheap one with rust costs more in the end. A licence class A1 or AM is needed, depending on the engine size.',
      'Eine restaurierte Vespa aus den 1960er-80er Jahren oder ein neues Retro-Modell ist ein kleines Fahrzeug voller Charakter. Kauf eine gut restaurierte mit Papieren: eine billige mit Rost kostet am Ende mehr. Je nach Hubraum wird Führerscheinklasse A1 oder AM gebraucht.',
    ],
    buckets: [
      [
        'The Vespa',
        'Die Vespa',
        3200,
        'A restored classic costs about 2,500-5,000; a new Vespa Primavera 125 about 4,500. Ask for the papers and the history of the restoration.',
        'Eine restaurierte Klassikerin kostet etwa 2.500-5.000; eine neue Vespa Primavera 125 etwa 4.500. Frag nach Papieren und der Restaurierungsgeschichte.',
        [link('Vespa – the brand', 'Vespa – die Marke', 'https://www.vespa.com/')],
      ],
      [
        'Helmet, jacket, gloves',
        'Helm, Jacke, Handschuhe',
        500,
        'A good helmet 150-300, a jacket with protectors 150-300. Do not save on these.',
        'Ein guter Helm 150-300, eine Jacke mit Protektoren 150-300. Spar nicht daran.',
      ],
      [
        'Registration, insurance, check',
        'Zulassung, Versicherung, Check',
        500,
        'Registration about 100; insurance about 100-250 a year; a technical check by a mechanic 80-150.',
        'Zulassung etwa 100; Versicherung etwa 100-250 im Jahr; ein technischer Check beim Mechaniker 80-150.',
      ],
      [
        'Licence if needed',
        'Führerschein, falls nötig',
        300,
        'A class AM or A1 licence costs about 500-1,500; the car licence covers a 50 cc scooter in many countries.',
        'Ein Führerschein der Klasse AM oder A1 kostet etwa 500-1.500; der Autoführerschein deckt in vielen Ländern einen 50-ccm-Roller ab.',
      ],
    ],
    links: [link('Vespa', 'Vespa', 'https://www.vespa.com/'), VZ],
    actions: [
      [
        'Have a mechanic check any classic before you pay',
        'Jede Klassikerin vor dem Kauf von einem Mechaniker prüfen lassen',
        'high',
      ],
      ['Check the licence class you need', 'Die benötigte Führerscheinklasse prüfen'],
      ['Buy the helmet and the jacket first', 'Zuerst Helm und Jacke kaufen', 'low'],
    ],
    notes: [
      [
        'A classic needs love: a small workshop nearby is worth more than a low price.',
        'Eine Klassikerin braucht Liebe: eine kleine Werkstatt in der Nähe ist mehr wert als ein niedriger Preis.',
      ],
    ],
  },
  {
    id: 'D77',
    category: 'vehicles',
    tier: 'life',
    monthlyAfter: 600,
    title: ['A Houseboat on the Water', 'Ein Hausboot auf dem Wasser'],
    story: [
      'Wake up to the gentle rocking of the water, with coffee on the deck and the herons for neighbours.',
      'Wach auf im sanften Schaukeln des Wassers, mit Kaffee an Deck und den Reihern als Nachbarn.',
    ],
    description: [
      'A houseboat is a home and a boat in one. You need a berth in a harbour or a canal, a hull in good state and a plan for the winter. A used one of about 12 metres costs about 70,000-120,000; the berth fees, the insurance and the hull survey are on top.',
      'Ein Hausboot ist Zuhause und Boot in einem. Du brauchst einen Liegeplatz in einem Hafen oder an einem Kanal, einen Rumpf in gutem Zustand und einen Plan für den Winter. Ein gebrauchtes von etwa 12 Metern kostet etwa 70.000-120.000; Liegegebühren, Versicherung und das Rumpfgutachten kommen dazu.',
    ],
    buckets: [
      [
        'The houseboat',
        'Das Hausboot',
        78000,
        'A used houseboat in good state costs about 70,000-120,000; check the hull thickness and the engine. Ask for the history of the hull survey.',
        'Ein gebrauchtes Hausboot in gutem Zustand kostet etwa 70.000-120.000; prüfe die Rumpfdicke und den Motor. Frag nach der Geschichte der Rumpfprüfung.',
      ],
      [
        'Survey and hull check',
        'Gutachten und Rumpfprüfung',
        2500,
        'An independent surveyor costs about 800-1,500; a dry-dock check every few years about 1,500-3,000.',
        'Ein unabhängiger Gutachter kostet etwa 800-1.500; eine Trockendock-Prüfung alle paar Jahre etwa 1.500-3.000.',
      ],
      [
        'Berth, registration, insurance',
        'Liegeplatz, Registrierung, Versicherung',
        6500,
        'A permanent berth can cost 2,000-6,000 a year; ask early, waiting lists are long. Insurance about 500-1,000.',
        'Ein Dauerliegeplatz kann 2.000-6.000 im Jahr kosten; frag früh, die Wartelisten sind lang. Versicherung etwa 500-1.000.',
      ],
      [
        'Refit and equipment',
        'Umbau und Ausstattung',
        9000,
        'A boat usually needs a refit of heating, a kitchen, a compost toilet and solar panels.',
        'Ein Boot braucht meist einen Umbau von Heizung, Küche, Komposttoilette und Solaranlage.',
      ],
    ],
    links: [
      link(
        'DSV – German Sailing Association',
        'DSV – Deutscher Segler-Verband',
        'https://www.dsv.org/',
      ),
      VZ,
    ],
    actions: [
      [
        'Ask the local harbours about berths and the waiting lists',
        'Bei den örtlichen Häfen nach Liegeplätzen und Wartelisten fragen',
        'high',
      ],
      ['Rent a houseboat for a week first', 'Zuerst für eine Woche ein Hausboot mieten'],
      [
        'Check what you need to register a boat as a home',
        'Prüfen, was du brauchst, um ein Boot als Wohnsitz anzumelden',
        'high',
      ],
    ],
    notes: [
      [
        'Winter and the cold are the test of a boat as a home: plan the heating.',
        'Der Winter und die Kälte sind die Prüfung eines Bootes als Zuhause: plane die Heizung.',
      ],
    ],
  },
  {
    id: 'D78',
    category: 'vehicles',
    tier: 'life',
    carAfter: true,
    monthlyAfter: 350,
    title: ['A Classic Car from Your Youth', 'Ein Klassiker aus deiner Jugend'],
    story: [
      'The car on the poster on your wall - now in your garage, with a H on the plate.',
      'Das Auto vom Poster an deiner Wand - jetzt in deiner Garage, mit einem H auf dem Kennzeichen.',
    ],
    description: [
      'A car of 30 years or older can get a historic licence plate (H) and a low tax and insurance. Look for a well-documented one; a restoration costs more than the car is worth. A classic is a hobby with a workshop, a garage and a club.',
      'Ein Auto ab 30 Jahren kann ein historisches Kennzeichen (H) und niedrige Steuer und Versicherung bekommen. Such ein gut dokumentiertes; eine Restaurierung kostet mehr, als das Auto wert ist. Ein Klassiker ist ein Hobby mit Werkstatt, Garage und Club.',
    ],
    buckets: [
      [
        'The car',
        'Das Auto',
        52000,
        'A good Mercedes SL, Porsche 911 of the 1980s or a Mini Cooper costs about 25,000-80,000 depending on the state and the model.',
        'Ein guter Mercedes SL, Porsche 911 der 1980er oder Mini Cooper kostet je nach Zustand und Modell etwa 25.000-80.000.',
        [
          link(
            'Classic car valuation (Classic Data)',
            'Oldtimer-Bewertung (Classic Data)',
            'https://www.classic-data.de/',
          ),
        ],
      ],
      [
        'Valuation and inspection',
        'Wertgutachten und Prüfung',
        1500,
        'An expert valuation for the H plate and for the insurance, about 300-600; a technical check by a specialist 300-900.',
        'Ein Wertgutachten für das H-Kennzeichen und die Versicherung kostet etwa 300-600; ein technischer Check durch einen Spezialisten 300-900.',
      ],
      [
        'Garage and workshop reserve',
        'Garage und Werkstattreserve',
        5000,
        'A dry garage space costs about 100-200 a month; set aside 1,000-2,000 a year for repairs.',
        'Ein trockener Garagenplatz kostet etwa 100-200 im Monat; leg 1.000-2.000 im Jahr für Reparaturen zurück.',
      ],
      [
        'Classic insurance and registration',
        'Oldtimer-Versicherung und Zulassung',
        1500,
        'A classic insurance with a limited mileage costs about 150-400 a year.',
        'Eine Oldtimer-Versicherung mit begrenzter Fahrleistung kostet etwa 150-400 im Jahr.',
      ],
    ],
    links: [
      link('ADAC – classic cars', 'ADAC – Oldtimer', 'https://www.adac.de/'),
      link(
        'DEUVET – classic car association',
        'DEUVET – Oldtimer-Verband',
        'https://www.deuvet.de/',
      ),
    ],
    actions: [
      [
        'Join a club for the model: its experts know the weak points',
        'Einem Club für das Modell beitreten: die Experten kennen die Schwachstellen',
        'high',
      ],
      [
        'Get an expert check before the purchase',
        'Vor dem Kauf einen Experten-Check machen',
        'high',
      ],
      ['Find a dry garage before you buy', 'Einen trockenen Garagenplatz finden, bevor du kaufst'],
    ],
    notes: [
      [
        'Buy the best you can: restoring a bad one is much dearer than buying a good one.',
        'Kauf das Beste, was du kannst: eine schlechte zu restaurieren ist viel teurer, als eine gute zu kaufen.',
      ],
    ],
  },
  {
    id: 'D79',
    category: 'home',
    tier: 'grand',
    title: ['A Garden Studio for Work and Hobby', 'Ein Gartenstudio für Arbeit und Hobby'],
    story: [
      'A quiet cabin at the end of the garden with a desk, a window and a door that you can close.',
      'Eine ruhige Hütte am Ende des Gartens mit Schreibtisch, Fenster und einer Tür, die du schließen kannst.',
    ],
    description: [
      'A garden studio of 12-20 square metres gives a home office, a music room or a workshop. Check the building rules for outbuildings (many states allow small ones without a permit), the power and network and the insulation for winter.',
      'Ein Gartenstudio von 12-20 Quadratmetern gibt ein Arbeitszimmer, einen Musikraum oder eine Werkstatt. Prüfe die Bauregeln für Nebengebäude (viele Länder erlauben kleine ohne Genehmigung), Strom und Netz und die Dämmung für den Winter.',
    ],
    buckets: [
      [
        'The studio, insulated',
        'Das Studio, gedämmt',
        8500,
        'A ready cabin with insulation and windows costs about 6,000-12,000; a kit is cheaper.',
        'Eine fertige Hütte mit Dämmung und Fenstern kostet etwa 6.000-12.000; ein Bausatz ist günstiger.',
      ],
      [
        'Foundation and groundwork',
        'Fundament und Erdarbeiten',
        1500,
        'Point foundations or a slab cost about 1,000-2,500.',
        'Punktfundamente oder eine Platte kosten etwa 1.000-2.500.',
      ],
      [
        'Power, network and heating',
        'Strom, Netz und Heizung',
        1800,
        'A cable from the house, a fibre line and a small heater cost about 1,200-2,500; an electrician does the connection.',
        'Ein Kabel vom Haus, eine Glasfaserleitung und eine kleine Heizung kosten etwa 1.200-2.500; ein Elektriker macht den Anschluss.',
      ],
      [
        'Permit, furniture, light',
        'Genehmigung, Möbel, Licht',
        1200,
        'A permit where needed 300-800; a good desk, chair and light 500-900.',
        'Eine Genehmigung, wo nötig, 300-800; ein guter Schreibtisch, Stuhl und Licht 500-900.',
      ],
    ],
    links: [
      VZ,
      link('KfW – grants and loans', 'KfW – Förderung und Kredite', 'https://www.kfw.de/'),
    ],
    actions: [
      [
        'Ask the authority about the rules for outbuildings',
        'Bei der Behörde nach den Regeln für Nebengebäude fragen',
        'high',
      ],
      ['Ask the neighbours before you build', 'Vor dem Bau die Nachbarn fragen'],
      ['Plan the power and the network first', 'Zuerst Strom und Netz planen', 'low'],
    ],
    notes: [
      [
        'A studio apart from the house ends the day: when the door closes, work is done.',
        'Ein Studio abseits des Hauses beendet den Tag: wenn die Tür zugeht, ist die Arbeit getan.',
      ],
    ],
  },
  {
    id: 'D80',
    category: 'home',
    tier: 'grand',
    title: ['Solar Roof and Home Battery', 'Solardach und Heimspeicher'],
    story: [
      'The roof makes your electricity, the battery stores the afternoon for the night, and the bill falls.',
      'Das Dach macht deinen Strom, der Speicher bewahrt den Nachmittag für die Nacht auf, und die Rechnung sinkt.',
    ],
    description: [
      "A solar system of 8-10 kWp with a battery of 8-10 kWh covers a large part of a family's electricity. It pays back in 9-14 years depending on the electricity price and your use. Use several offers from local installers and ask about the feed-in rules.",
      'Eine Solaranlage von 8-10 kWp mit einem Speicher von 8-10 kWh deckt einen großen Teil des Stromverbrauchs einer Familie. Sie amortisiert sich je nach Strompreis und Verbrauch in 9-14 Jahren. Hol mehrere Angebote von Installateuren vor Ort ein und frag nach den Einspeiseregeln.',
    ],
    buckets: [
      [
        'Solar modules and inverter',
        'Solarmodule und Wechselrichter',
        11000,
        'About 1,100-1,500 per kWp installed, so 8-10 kWp is 9,000-14,000.',
        'Etwa 1.100-1.500 pro kWp installiert, also 8-10 kWp für 9.000-14.000.',
      ],
      [
        'Battery, 8-10 kWh',
        'Speicher, 8-10 kWh',
        5500,
        'A home battery costs about 5,000-8,000; do you need one? Compare with a larger system without a battery.',
        'Ein Heimspeicher kostet etwa 5.000-8.000; brauchst du einen? Vergleiche mit einer größeren Anlage ohne Speicher.',
      ],
      [
        'Scaffold, wiring, registration',
        'Gerüst, Verkabelung, Anmeldung',
        1500,
        'Scaffold, the electrician and the registration with the grid operator and the market register.',
        'Gerüst, Elektriker und die Anmeldung beim Netzbetreiber und im Marktstammdatenregister.',
      ],
    ],
    links: [
      link(
        'Consumer advice – solar',
        'Verbraucherzentrale – Photovoltaik',
        'https://www.verbraucherzentrale.de/',
      ),
      link('KfW – grants and loans', 'KfW – Förderung und Kredite', 'https://www.kfw.de/'),
      link(
        'BAFA – federal office for export control and economics',
        'BAFA – Bundesamt für Wirtschaft und Ausfuhrkontrolle',
        'https://www.bafa.de/',
      ),
    ],
    actions: [
      [
        'Collect three offers from local installers and compare per kWp',
        'Drei Angebote von Installateuren vor Ort einholen und pro kWp vergleichen',
        'high',
      ],
      [
        "Ask about the roof's age and the static",
        'Nach Alter und Statik des Daches fragen',
        'high',
      ],
      ['Check the grants and the cheap loans', 'Förderungen und günstige Kredite prüfen'],
    ],
    notes: [
      [
        'Size the system by your usage: an electric car and a heat pump increase it.',
        'Dimensioniere die Anlage nach deinem Verbrauch: ein Elektroauto und eine Wärmepumpe erhöhen ihn.',
      ],
    ],
  },
  {
    id: 'D81',
    category: 'home',
    tier: 'life',
    monthlyAfter: 250,
    title: ['A Mountain Cabin of Your Own', 'Eine eigene Berghütte'],
    story: [
      'Snow outside, a stove inside, and the whole winter valley to yourself.',
      'Draußen Schnee, drinnen ein Ofen, und das ganze Wintertal für dich allein.',
    ],
    description: [
      'A small chalet or a hut in the Alps or a low mountain range is a second home for holidays. Check the rules for second homes (many mountain regions limit them), the road in winter, the heating and the neighbours. Many owners rent it out in weeks they do not use.',
      'Ein kleines Chalet oder eine Hütte in den Alpen oder einem Mittelgebirge ist ein Zweitwohnsitz für den Urlaub. Prüfe die Regeln für Zweitwohnungen (viele Bergregionen beschränken sie), die Straße im Winter, die Heizung und die Nachbarn. Viele Eigentümer vermieten in Wochen, in denen sie nicht da sind.',
    ],
    buckets: [
      [
        'The cabin',
        'Die Hütte',
        118000,
        'A small chalet or cabin costs about 90,000-250,000 depending on the place; a hut in a less touristy region is cheaper.',
        'Ein kleines Chalet oder eine Hütte kostet je nach Ort etwa 90.000-250.000; eine Hütte in einer weniger touristischen Region ist günstiger.',
      ],
      [
        'Notary, tax, agent',
        'Notar, Steuer, Makler',
        9500,
        'Purchase costs are about 7-10 % in many countries: the notary, the transfer tax and an agent.',
        'Die Nebenkosten betragen in vielen Ländern etwa 7-10 %: Notar, Grunderwerbsteuer und Makler.',
      ],
      [
        'Renovation and furniture',
        'Renovierung und Möbel',
        18000,
        'A stove, an insulation of the roof, a bathroom and the furniture; a reserve for the unforeseen.',
        'Ein Ofen, die Dämmung des Daches, ein Bad und die Möbel; eine Reserve für Unvorhergesehenes.',
      ],
      [
        'Reserve for the first years',
        'Reserve für die ersten Jahre',
        4500,
        'Running costs of a second home: heating, taxes, insurance, a caretaker in winter.',
        'Laufende Kosten eines Zweitwohnsitzes: Heizung, Steuern, Versicherung, ein Hausmeister im Winter.',
      ],
    ],
    links: [VZ, link('Alpine Club', 'Alpenverein', 'https://www.alpenverein.de/')],
    actions: [
      [
        'Spend a winter week in the area before you decide',
        'Vor der Entscheidung eine Winterwoche in der Gegend verbringen',
        'high',
      ],
      [
        'Ask the municipality about the rules for second homes',
        'Die Gemeinde nach den Regeln für Zweitwohnungen fragen',
        'high',
      ],
      [
        'Check how you would use it and whether renting it out is allowed',
        'Prüfen, wie du es nutzen würdest und ob Vermieten erlaubt ist',
      ],
    ],
    notes: [
      [
        'A second home is used fewer weeks than people plan: be honest about how often.',
        'Ein Zweitwohnsitz wird in weniger Wochen genutzt, als man plant: sei ehrlich, wie oft.',
      ],
    ],
  },
  {
    id: 'D82',
    category: 'home',
    tier: 'legendary',
    monthlyAfter: 1800,
    title: ['A Villa by the Sea', 'Eine Villa am Meer'],
    story: [
      'A terrace above the water, a pool in the evening light, and a place for the whole family for generations.',
      'Eine Terrasse über dem Wasser, ein Pool im Abendlicht und ein Platz für die ganze Familie über Generationen.',
    ],
    description: [
      'A villa with a sea view in Spain, Portugal, Italy or Croatia is a dream and a business: a large property, a pool, a garden and staff cost a lot every year. A good local lawyer, an independent survey and a plan for renting when not used are a must. Ask for all the permits for the building and the land.',
      'Eine Villa mit Meerblick in Spanien, Portugal, Italien oder Kroatien ist Traum und Unternehmen: ein großes Anwesen, ein Pool, ein Garten und Personal kosten jedes Jahr viel. Ein guter lokaler Anwalt, ein unabhängiges Gutachten und ein Plan zum Vermieten bei Nichtnutzung sind ein Muss. Lass dir alle Genehmigungen für Gebäude und Grundstück zeigen.',
    ],
    buckets: [
      [
        'The villa',
        'Die Villa',
        405000,
        'A villa of 250 square metres with a pool and a sea view costs about 350,000-900,000 depending on the coast; check the plot and the permits.',
        'Eine Villa von 250 Quadratmetern mit Pool und Meerblick kostet je nach Küste etwa 350.000-900.000; prüfe Grundstück und Genehmigungen.',
      ],
      [
        'Taxes, notary, lawyer',
        'Steuern, Notar, Anwalt',
        40000,
        'Purchase costs are about 8-12 % in Spain, Portugal and Italy; do not buy without a lawyer.',
        'Die Nebenkosten betragen in Spanien, Portugal und Italien etwa 8-12 %; kauf nicht ohne Anwalt.',
        [
          link(
            'Foreign Office – country advice',
            'Auswärtiges Amt – Länderinformationen',
            'https://www.auswaertiges-amt.de/',
          ),
        ],
      ],
      [
        'Renovation and furniture',
        'Renovierung und Möbel',
        25000,
        'A refit of the kitchen, the bathrooms and the terrace, and a good furniture; a reserve for the unforeseen.',
        'Ein Umbau von Küche, Bädern und Terrasse und gute Möbel; eine Reserve für Unvorhergesehenes.',
      ],
      [
        'Reserve: pool, garden, upkeep',
        'Reserve: Pool, Garten, Unterhalt',
        10000,
        'A pool, a garden and a caretaker cost about 10,000-20,000 a year; storms and salt damage are common.',
        'Pool, Garten und Hausmeister kosten etwa 10.000-20.000 im Jahr; Sturm- und Salzschäden sind häufig.',
      ],
    ],
    links: [link('Foreign Office', 'Auswärtiges Amt', 'https://www.auswaertiges-amt.de/'), VZ],
    actions: [
      [
        'Rent in the region for a month, in summer and in winter',
        'In der Region einen Monat mieten, im Sommer und im Winter',
        'high',
      ],
      [
        'Hire an independent lawyer and a surveyor in the country',
        'Einen unabhängigen Anwalt und Gutachter im Land beauftragen',
        'high',
      ],
      [
        'Plan the upkeep and a rental for the weeks you are away',
        'Unterhalt und eine Vermietung für die Wochen deiner Abwesenheit planen',
      ],
    ],
    notes: [
      [
        'The costs of the upkeep are the part people forget: plan for 2-3 % of the price a year.',
        'Die Unterhaltskosten sind das, was man vergisst: plane 2-3 % des Preises pro Jahr ein.',
      ],
    ],
  },
  {
    id: 'D83',
    category: 'people',
    tier: 'big',
    title: ['A Birthday They Will Never Forget', 'Ein Geburtstag, den sie nie vergessen'],
    story: [
      'Everyone who matters in one room, a surprise that works, and a speech that makes the room cry and laugh.',
      'Alle, die zählen, in einem Raum, eine Überraschung, die gelingt, und eine Rede, bei der der Raum weint und lacht.',
    ],
    description: [
      'A big birthday for someone you love: a room or a restaurant, food, music, a slide show and the friends from far away. The work is the guest list and the secret; the price is mostly the room and the food. Ask the friends to help with a gift fund.',
      'Ein großer Geburtstag für jemanden, den du liebst: ein Raum oder ein Restaurant, Essen, Musik, eine Diashow und die Freunde von weit weg. Die Arbeit sind Gästeliste und Geheimnis; der Preis ist vor allem Raum und Essen. Bitte die Freunde, bei einem Geschenkfonds mitzumachen.',
    ],
    buckets: [
      [
        'Venue and food for 40',
        'Ort und Essen für 40',
        2400,
        'A restaurant room with a menu costs about 50-80 per guest, a buffet at home less.',
        'Ein Restaurantraum mit Menü kostet etwa 50-80 pro Gast, ein Buffet zu Hause weniger.',
      ],
      [
        'Music, photos, decoration',
        'Musik, Fotos, Dekoration',
        700,
        'A DJ or a live musician 300-600; a photo book from friends and the decoration 150-300.',
        'Ein DJ oder Livemusiker 300-600; ein Fotobuch von Freunden und Dekoration 150-300.',
      ],
      [
        'Travel for far friends',
        'Reisen für Freunde von weit weg',
        600,
        'Contribute to the train or a hotel for the ones who come from far; it counts more than you think.',
        'Beteilige dich an Zug oder Hotel für die, die von weit kommen; das zählt mehr, als du denkst.',
        [link('Deutsche Bahn', 'Deutsche Bahn', 'https://www.bahn.de/')],
      ],
      [
        'The gift and the cake',
        'Das Geschenk und die Torte',
        300,
        'A good cake from the bakery and a gift from you and the friends.',
        'Eine gute Torte vom Bäcker und ein Geschenk von dir und den Freunden.',
      ],
    ],
    links: [
      link(
        'betterplace – gift ideas',
        'betterplace – Geschenkideen',
        'https://www.betterplace.org/',
      ),
    ],
    actions: [
      [
        'Make the guest list with the family and one close friend',
        'Die Gästeliste mit der Familie und einem engen Freund machen',
        'high',
      ],
      [
        'Keep the date secret and tell the guests early',
        'Das Datum geheimhalten und die Gäste früh informieren',
        'high',
      ],
      [
        'Collect photos and short messages from the friends',
        'Fotos und kurze Nachrichten von den Freunden sammeln',
      ],
    ],
    notes: [
      [
        'The speech counts more than the money: write it by hand.',
        'Die Rede zählt mehr als das Geld: schreib sie von Hand.',
      ],
    ],
  },
  {
    id: 'D84',
    category: 'people',
    tier: 'grand',
    giving: true,
    title: ["Renovate Your Parents' Home", 'Das Haus deiner Eltern renovieren'],
    story: [
      'A new roof, a warm house and a safe bathroom: the gift that lets them stay at home.',
      'Ein neues Dach, ein warmes Haus und ein sicheres Bad: das Geschenk, das sie zu Hause bleiben lässt.',
    ],
    description: [
      'Many parents want to stay in their own home when they grow old. An age-friendly refit - a walk-in shower, a stairlift or a ramp, good lighting and an insulated roof - makes it possible and saves the heating bill. Talk to your parents and your siblings first: it is their home and the cost can be shared.',
      'Viele Eltern wollen im Alter in ihrem Haus bleiben. Ein altersgerechter Umbau - eine bodengleiche Dusche, ein Treppenlift oder eine Rampe, gutes Licht und ein gedämmtes Dach - macht es möglich und spart Heizkosten. Sprich zuerst mit deinen Eltern und Geschwistern: es ist ihr Zuhause, und die Kosten lassen sich teilen.',
    ],
    buckets: [
      [
        'Bathroom: walk-in shower',
        'Bad: bodengleiche Dusche',
        9000,
        'An age-friendly bathroom with a walk-in shower, grab rails and a raised toilet costs about 7,000-12,000.',
        'Ein altersgerechtes Bad mit bodengleicher Dusche, Haltegriffen und erhöhter Toilette kostet etwa 7.000-12.000.',
        [
          link(
            'Pflegekasse – grants for home changes',
            'Pflegekasse – Zuschüsse für Wohnumfeldverbesserung',
            'https://www.bundesgesundheitsministerium.de/',
          ),
        ],
      ],
      [
        'Roof and insulation',
        'Dach und Dämmung',
        9000,
        'Insulating the top floor ceiling or the roof costs about 6,000-14,000; grants of the KfW and BAFA reduce it.',
        'Die Dämmung der obersten Geschossdecke oder des Daches kostet etwa 6.000-14.000; Förderungen von KfW und BAFA senken sie.',
        [KFW],
      ],
      [
        'Stairlift or ramp, doors',
        'Treppenlift oder Rampe, Türen',
        4500,
        'A stairlift is about 3,500-7,000; wider doors and a ramp at the entrance about 1,500-4,000.',
        'Ein Treppenlift kostet etwa 3.500-7.000; breitere Türen und eine Rampe am Eingang etwa 1.500-4.000.',
      ],
      [
        'Lighting, alarms, smaller repairs',
        'Beleuchtung, Notruf, kleine Reparaturen',
        2500,
        'Motion lights, a home emergency call system and the repairs that were waiting.',
        'Bewegungslicht, ein Hausnotruf und die Reparaturen, die liegen geblieben waren.',
      ],
    ],
    links: [
      KFW,
      link(
        'Federal Ministry of Health – care',
        'Bundesgesundheitsministerium – Pflege',
        'https://www.bundesgesundheitsministerium.de/',
      ),
      VZ,
    ],
    actions: [
      [
        'Ask your parents what they want and what bothers them every day',
        'Deine Eltern fragen, was sie wollen und was sie täglich stört',
        'high',
      ],
      [
        'Ask the care insurance for a grant for the changes',
        'Bei der Pflegekasse einen Zuschuss für die Umbauten beantragen',
        'high',
      ],
      [
        'Collect three offers from local craftsmen',
        'Drei Angebote von Handwerkern vor Ort einholen',
      ],
    ],
    notes: [
      [
        'Do it with them, not for them: it is their home.',
        'Mach es mit ihnen, nicht für sie: es ist ihr Zuhause.',
      ],
    ],
  },
  {
    id: 'D85',
    category: 'people',
    tier: 'grand',
    requiresPartner: true,
    title: ['A Honeymoon of a Lifetime', 'Eine Hochzeitsreise fürs Leben'],
    story: [
      'Three weeks for two, with no schedule: a private island, a train, a city at night.',
      'Drei Wochen zu zweit ohne Zeitplan: eine Privatinsel, ein Zug, eine Stadt bei Nacht.',
    ],
    description: [
      'A honeymoon of two or three weeks, planned as a journey with stops: a beach, a city and one wild place. The price depends on the places; a good tour operator for the flights and the hotels saves time. Tell the hotels that it is a honeymoon: many give a free upgrade.',
      'Eine Hochzeitsreise von zwei oder drei Wochen, geplant als Reise mit Stationen: ein Strand, eine Stadt und ein wilder Ort. Der Preis hängt von den Orten ab; ein guter Reiseveranstalter für Flüge und Hotels spart Zeit. Sag den Hotels, dass es eine Hochzeitsreise ist: viele geben ein kostenloses Upgrade.',
    ],
    buckets: [
      [
        'Flights for two',
        'Flüge für zwei',
        4500,
        'Long-distance flights for two with several stages cost about 3,500-6,000; business class on one stage is a gift.',
        'Langstreckenflüge für zwei mit mehreren Etappen kosten etwa 3.500-6.000; Business Class auf einer Etappe ist ein Geschenk.',
        [SKY],
      ],
      [
        'Hotels, 18 nights',
        'Hotels, 18 Nächte',
        6500,
        'About 300-400 a night for a good hotel for two; a private villa on the beach part is dearer.',
        'Etwa 300-400 pro Nacht für ein gutes Hotel für zwei; eine private Villa im Strandteil ist teurer.',
      ],
      [
        'Experiences and transfers',
        'Erlebnisse und Transfers',
        2500,
        'A cooking class, a boat trip, a balloon; a private transfer and a guide here and there.',
        'Ein Kochkurs, eine Bootsfahrt, ein Ballon; ein privater Transfer und hier und da ein Führer.',
      ],
      [
        'Food, insurance, extras',
        'Essen, Versicherung, Extras',
        1500,
        'A good restaurant every other night; a travel insurance with a cancellation cover.',
        'Jeden zweiten Abend ein gutes Restaurant; eine Reiseversicherung mit Stornoschutz.',
        [VZ],
      ],
    ],
    links: [SKY, VZ],
    actions: [
      [
        'Choose three places together: a beach, a city, a wild place',
        'Gemeinsam drei Orte wählen: ein Strand, eine Stadt, ein wilder Ort',
        'high',
      ],
      ['Tell the hotels it is a honeymoon', 'Den Hotels sagen, dass es eine Hochzeitsreise ist'],
      [
        'Book a flexible ticket in case the wedding date moves',
        'Ein flexibles Ticket buchen, falls sich der Hochzeitstermin verschiebt',
        'low',
      ],
    ],
    notes: [
      [
        'Leave days empty on purpose: the best moments are not planned.',
        'Lass absichtlich Tage leer: die besten Momente sind nicht geplant.',
      ],
    ],
  },
  {
    id: 'D86',
    category: 'people',
    tier: 'big',
    requiresKids: true,
    title: ['A Family Trip to a Theme Park', 'Ein Familienausflug in den Freizeitpark'],
    story: [
      'Three days of rides, the faces of your children at the first castle and the fireworks at night.',
      'Drei Tage Fahrgeschäfte, die Gesichter deiner Kinder am ersten Schloss und das Feuerwerk am Abend.',
    ],
    description: [
      'A trip to a big theme park is a memory your children keep. Disneyland Paris, Europa-Park or Legoland are within reach by car or train. Go on weekdays outside the school holidays: the queues are shorter and the prices lower.',
      'Ein Ausflug in einen großen Freizeitpark ist eine Erinnerung, die deine Kinder behalten. Disneyland Paris, Europa-Park oder Legoland sind mit Auto oder Zug erreichbar. Fahr unter der Woche außerhalb der Schulferien: die Schlangen sind kürzer und die Preise niedriger.',
    ],
    buckets: [
      [
        'Park tickets, 3 days',
        'Parktickets, 3 Tage',
        1600,
        'A multi-day ticket for a family of four is about 1,200-2,000 in the season; children are cheaper.',
        'Ein Mehrtagesticket für eine Vierer-Familie kostet in der Saison etwa 1.200-2.000; Kinder sind günstiger.',
        [link('Europa-Park', 'Europa-Park', 'https://www.europapark.de/')],
      ],
      [
        'Hotel, 3 nights',
        'Hotel, 3 Nächte',
        1500,
        'A park hotel with a breakfast for a family room costs about 350-600 a night.',
        'Ein Parkhotel mit Frühstück für ein Familienzimmer kostet etwa 350-600 pro Nacht.',
      ],
      [
        'Travel and parking',
        'Anreise und Parken',
        400,
        'A train with a family ticket or a car with fuel and parking.',
        'Ein Zug mit Familienticket oder ein Auto mit Sprit und Parken.',
        [link('Deutsche Bahn', 'Deutsche Bahn', 'https://www.bahn.de/')],
      ],
      [
        'Food and souvenirs',
        'Essen und Souvenirs',
        1000,
        'Park food is dear: bring snacks and water, and set a small budget for souvenirs.',
        'Essen im Park ist teuer: bring Snacks und Wasser mit und leg ein kleines Budget für Souvenirs fest.',
      ],
    ],
    links: [
      link('Europa-Park', 'Europa-Park', 'https://www.europapark.de/'),
      link('Legoland Deutschland', 'Legoland Deutschland', 'https://www.legoland.de/'),
    ],
    actions: [
      [
        'Check the height limits of the rides for your children',
        'Die Größenbeschränkungen der Fahrgeschäfte für deine Kinder prüfen',
        'high',
      ],
      [
        'Buy tickets online ahead: they are cheaper',
        'Tickets vorher online kaufen: sie sind günstiger',
      ],
      ['Plan a break each afternoon', 'Jeden Nachmittag eine Pause planen', 'low'],
    ],
    notes: [
      [
        'Children tire early: be at the gate at opening time and leave before the crowd.',
        'Kinder ermüden früh: sei bei Öffnung am Tor und geh vor dem Andrang.',
      ],
    ],
  },
  {
    id: 'D87',
    category: 'create',
    tier: 'life',
    monthlyAfter: 400,
    title: ['Start Your Own Business', 'Das eigene Unternehmen gründen'],
    story: [
      'The idea in your notebook becomes a company with a name, a first customer and your own rules.',
      'Die Idee in deinem Notizbuch wird ein Unternehmen mit Namen, einem ersten Kunden und deinen eigenen Regeln.',
    ],
    description: [
      "Founding a small company needs money for the first year without a salary, the set-up and the first stock or tools. Test the idea with real customers before you spend: a small product, a service for a few clients. Free advice is offered by the chambers of commerce and the founders' platform of the state.",
      'Ein kleines Unternehmen zu gründen braucht Geld für das erste Jahr ohne Gehalt, die Einrichtung und den ersten Bestand oder Werkzeug. Teste die Idee mit echten Kunden, bevor du ausgibst: ein kleines Produkt, eine Dienstleistung für einige Kunden. Kostenlose Beratung bieten die Kammern und die Gründerplattform des Bundes.',
    ],
    buckets: [
      [
        'Living reserve, 12 months',
        'Lebensunterhalt, 12 Monate',
        36000,
        'Your rent, food and insurance for a year without a salary: about 2,500-3,500 a month for a single person.',
        'Deine Miete, Essen und Versicherungen für ein Jahr ohne Gehalt: etwa 2.500-3.500 im Monat für eine Einzelperson.',
      ],
      [
        'Set-up: legal, website, equipment',
        'Gründung: Recht, Website, Ausstattung',
        9000,
        'The registration, a lawyer for the contracts, a website and the first equipment.',
        'Die Anmeldung, ein Anwalt für die Verträge, eine Website und die erste Ausstattung.',
        [
          link(
            "Founders' platform of the state",
            'Gründerplattform des Bundes',
            'https://www.existenzgruender.de/',
          ),
        ],
      ],
      [
        'First stock or tools',
        'Erster Bestand oder Werkzeug',
        12000,
        'The first stock, machines or software; buy used where possible.',
        'Der erste Bestand, Maschinen oder Software; kauf gebraucht, wo möglich.',
      ],
      [
        'Marketing and the first customers',
        'Marketing und erste Kunden',
        6000,
        'A launch, small ads, a stand at a market and samples.',
        'Ein Start, kleine Anzeigen, ein Stand auf einem Markt und Muster.',
      ],
      [
        'Insurance and advice',
        'Versicherungen und Beratung',
        3000,
        'A business liability insurance, an accountant and a coach.',
        'Eine Betriebshaftpflicht, ein Steuerberater und ein Coach.',
        [
          link(
            'IHK – Chamber of Industry and Commerce',
            'IHK – Industrie- und Handelskammer',
            'https://www.ihk.de/',
          ),
        ],
      ],
    ],
    links: [
      link(
        "Founders' platform of the state",
        'Gründerplattform des Bundes',
        'https://www.existenzgruender.de/',
      ),
      link('IHK – chamber of commerce', 'IHK – Handelskammer', 'https://www.ihk.de/'),
      KFW,
    ],
    actions: [
      [
        'Test the idea with five real customers before you invest',
        'Die Idee mit fünf echten Kunden testen, bevor du investierst',
        'high',
      ],
      [
        "Write a plan with a founders' advisor and ask for grants",
        'Mit einer Gründungsberatung einen Plan schreiben und nach Förderung fragen',
        'high',
      ],
      [
        'Keep your job as long as you can and start on the side',
        'Deinen Job so lange wie möglich behalten und nebenbei starten',
      ],
    ],
    notes: [
      [
        'Most companies fail for lack of customers, not of money: sell first.',
        'Die meisten Unternehmen scheitern am Mangel an Kunden, nicht an Geld: verkauf zuerst.',
      ],
    ],
  },
  {
    id: 'D88',
    category: 'create',
    tier: 'big',
    title: ['A Home Photography Studio', 'Ein Foto-Studio zu Hause'],
    story: [
      'Light, a backdrop and a camera you know by heart: portraits that look the way you see people.',
      'Licht, ein Hintergrund und eine Kamera, die du auswendig kennst: Porträts, die so aussehen, wie du Menschen siehst.',
    ],
    description: [
      'A small studio in a room: a mirrorless camera with a good lens, two flashes or continuous lights, backdrops and a computer for editing. Learn light first: a course or a workshop teaches more than a new camera. Start by shooting friends and family.',
      'Ein kleines Studio in einem Raum: eine spiegellose Kamera mit gutem Objektiv, zwei Blitze oder Dauerlichter, Hintergründe und ein Computer zum Bearbeiten. Lerne zuerst das Licht: ein Kurs oder Workshop lehrt mehr als eine neue Kamera. Fang an, Freunde und Familie zu fotografieren.',
    ],
    buckets: [
      [
        'Camera and lens',
        'Kamera und Objektiv',
        2200,
        'A used mirrorless camera with a 50 mm or 85 mm lens costs about 1,500-2,800.',
        'Eine gebrauchte spiegellose Kamera mit einem 50-mm- oder 85-mm-Objektiv kostet etwa 1.500-2.800.',
        [
          link(
            'Digital Photography School',
            'Digital Photography School',
            'https://digital-photography-school.com/',
          ),
        ],
      ],
      [
        'Lights and stands',
        'Lichter und Stative',
        1200,
        'Two studio flashes with softboxes cost about 600-1,500; a continuous light is a cheaper start.',
        'Zwei Studioblitze mit Softboxen kosten etwa 600-1.500; ein Dauerlicht ist ein günstigerer Start.',
      ],
      [
        'Backdrops and props',
        'Hintergründe und Requisiten',
        500,
        'Paper rolls, cloth, a stool and a few props.',
        'Papierrollen, Stoff, ein Hocker und einige Requisiten.',
      ],
      [
        'Computer, software, course',
        'Computer, Software, Kurs',
        1100,
        'A photo editing subscription (about 12 a month), a calibrated screen and a light course.',
        'Ein Foto-Bearbeitungs-Abo (etwa 12 im Monat), ein kalibrierter Bildschirm und ein Lichtkurs.',
      ],
    ],
    links: [
      link(
        'Digital Photography School',
        'Digital Photography School',
        'https://digital-photography-school.com/',
      ),
      TEST,
    ],
    actions: [
      [
        'Take a course on light before you buy lights',
        'Einen Lichtkurs machen, bevor du Lichter kaufst',
        'high',
      ],
      ['Buy the lens before the body', 'Erst das Objektiv, dann das Gehäuse kaufen'],
      [
        'Shoot twenty portraits of friends and family',
        'Zwanzig Porträts von Freunden und Familie fotografieren',
        'low',
      ],
    ],
    notes: [
      [
        'Light is the skill: a window and a reflector make a studio.',
        'Licht ist das Können: ein Fenster und ein Reflektor machen ein Studio.',
      ],
    ],
  },
  {
    id: 'D89',
    category: 'create',
    tier: 'big',
    title: ['Direct a Short Film', 'Einen Kurzfilm drehen'],
    story: [
      'A story you carry, a small crew of friends and a night when the lights go down and your name appears.',
      'Eine Geschichte, die du trägst, eine kleine Crew aus Freunden und eine Nacht, in der das Licht ausgeht und dein Name erscheint.',
    ],
    description: [
      'A short film of 10-15 minutes is made by a small team on a few shooting days. The budget is for the camera and the lens, the sound, the locations and food for the team. Many festivals accept short films; a screening for friends and a festival submission give the finish.',
      'Ein Kurzfilm von 10-15 Minuten wird von einem kleinen Team an einigen Drehtagen gemacht. Das Budget geht für Kamera und Objektiv, Ton, Drehorte und Essen für das Team. Viele Festivals nehmen Kurzfilme an; eine Vorführung für Freunde und eine Festivaleinreichung geben den Abschluss.',
    ],
    buckets: [
      [
        'Camera, lenses, lights (rented)',
        'Kamera, Objektive, Licht (geliehen)',
        1800,
        'Rent a cinema-style camera and lenses for 4-5 days; ask the film school or the film club for loans.',
        'Leih eine Kamera im Kino-Stil und Objektive für 4-5 Tage; frag Filmschule oder Filmclub nach Leihgeräten.',
      ],
      [
        'Sound and editing',
        'Ton und Schnitt',
        1500,
        'Good sound makes a film; a sound person for two days and an editing licence.',
        'Guter Ton macht einen Film; ein Tonmann für zwei Tage und eine Schnitt-Lizenz.',
      ],
      [
        'Locations, props, food',
        'Drehorte, Requisiten, Essen',
        1700,
        'A free location is the best, otherwise 200-500 a day; feed the crew well.',
        'Ein kostenloser Drehort ist der beste, sonst 200-500 pro Tag; versorge die Crew gut.',
      ],
      [
        'Actors, insurance, festivals',
        'Darsteller, Versicherung, Festivals',
        1500,
        'A fee for the actors, a production insurance and fees for the festival submissions (20-60 each).',
        'Eine Gage für die Darsteller, eine Produktionsversicherung und Gebühren für die Festivaleinreichungen (20-60 je).',
        [link('Short Film Festivals', 'Kurzfilmfestivals', 'https://www.shortfilmdepot.com/')],
      ],
    ],
    links: [
      link('Short Film Depot', 'Short Film Depot', 'https://www.shortfilmdepot.com/'),
      link('German Film Academy', 'Deutsche Filmakademie', 'https://www.deutsche-filmakademie.de/'),
    ],
    actions: [
      [
        'Write the script and keep it to a few places and people',
        'Das Drehbuch schreiben und auf wenige Orte und Personen beschränken',
        'high',
      ],
      [
        'Ask a film student or a film club to join you',
        'Einen Filmstudenten oder einen Filmclub zum Mitmachen fragen',
      ],
      [
        'Plan the shoot in a few days and make a shot list',
        'Den Dreh auf wenige Tage planen und eine Einstellungsliste machen',
        'high',
      ],
    ],
    notes: [
      [
        'Sound is the thing amateur films lose: plan it from the start.',
        'Der Ton ist das, woran Amateurfilme scheitern: plane ihn von Anfang an.',
      ],
    ],
  },
  {
    id: 'D90',
    category: 'create',
    tier: 'big',
    title: ['A Pottery or Woodworking Workshop', 'Eine Töpfer- oder Holzwerkstatt'],
    story: [
      'Hands on clay or oak, a bench that smells of work, and a bowl or a table that you made.',
      'Hände an Ton oder Eiche, eine Werkbank, die nach Arbeit riecht, und eine Schale oder ein Tisch, den du gemacht hast.',
    ],
    description: [
      'A hobby workshop in a garage or a shed: for pottery a wheel and a kiln, for woodworking a workbench and the main machines. Learn in a course first, then buy tools one by one. A used kiln or a table saw from a local seller saves a lot; mind the safety rules for dust and fire.',
      'Eine Hobby-Werkstatt in einer Garage oder einem Schuppen: für Töpfern eine Scheibe und ein Ofen, für Holzarbeiten eine Werkbank und die wichtigsten Maschinen. Lerne zuerst in einem Kurs, dann kauf die Werkzeuge einzeln. Ein gebrauchter Ofen oder eine Tischkreissäge von einem lokalen Verkäufer spart viel; beachte die Sicherheitsregeln für Staub und Feuer.',
    ],
    buckets: [
      [
        'Courses to start',
        'Kurse zum Start',
        600,
        "A beginner's course of 6-10 evenings costs about 200-400; try both crafts before you buy.",
        'Ein Anfängerkurs von 6-10 Abenden kostet etwa 200-400; probiere beide Handwerke, bevor du kaufst.',
      ],
      [
        'Main equipment',
        'Hauptausstattung',
        3800,
        'A pottery wheel about 800-1,500, a small kiln 1,500-2,500; or a workbench, a table saw and a router for about 2,000-3,500.',
        'Eine Töpferscheibe etwa 800-1.500, ein kleiner Ofen 1.500-2.500; oder eine Werkbank, Tischkreissäge und Oberfräse für etwa 2.000-3.500.',
      ],
      [
        'Hand tools and materials',
        'Handwerkzeug und Material',
        1600,
        'Chisels, planes, clay, glazes or hardwood boards for the first projects.',
        'Stecheisen, Hobel, Ton, Glasuren oder Hartholzbretter für die ersten Projekte.',
      ],
      [
        'Safety and electrics',
        'Sicherheit und Elektrik',
        1000,
        'Dust extraction, a fire extinguisher, ventilation and a connection for the kiln by an electrician.',
        'Staubabsaugung, ein Feuerlöscher, Belüftung und ein Anschluss für den Ofen durch einen Elektriker.',
      ],
    ],
    links: [
      link(
        'Handwerk – craft guild',
        'Handwerk – Handwerkskammer',
        'https://www.handwerkskammer.de/',
      ),
      TEST,
    ],
    actions: [
      [
        'Take a course before you buy any machine',
        'Einen Kurs machen, bevor du eine Maschine kaufst',
        'high',
      ],
      [
        'Buy the tools one by one as the projects need them',
        'Die Werkzeuge einzeln kaufen, wie die Projekte sie brauchen',
      ],
      ['Plan dust, fire and electricity safely', 'Staub, Feuer und Strom sicher planen', 'high'],
    ],
    notes: [
      [
        'A good tool bought once beats three cheap ones.',
        'Ein gutes Werkzeug, einmal gekauft, schlägt drei billige.',
      ],
    ],
  },
  {
    id: 'D91',
    category: 'give',
    tier: 'grand',
    giving: true,
    title: ['Fund a Scholarship', 'Ein Stipendium stiften'],
    story: [
      'A student who could not pay for studies can, because of you - and you may meet them at graduation.',
      'Ein Student, der sein Studium nicht bezahlen konnte, kann es jetzt - wegen dir, und du triffst ihn vielleicht bei der Abschlussfeier.',
    ],
    description: [
      'A scholarship at a university or through a foundation pays the living costs of a talented student for several years. A fund held by a foundation can support students for decades. Ask a university, a community foundation or the Deutschlandstipendium about the form and a tax receipt.',
      'Ein Stipendium an einer Universität oder über eine Stiftung zahlt die Lebenshaltung eines talentierten Studierenden über mehrere Jahre. Ein Fonds bei einer Stiftung kann Studierende über Jahrzehnte fördern. Frag eine Universität, eine Bürgerstiftung oder das Deutschlandstipendium nach Form und Spendenbescheinigung.',
    ],
    buckets: [
      [
        'Scholarship for 4 years',
        'Stipendium für 4 Jahre',
        18000,
        'A scholarship of about 300-450 a month covers living costs for a student for 4 years.',
        'Ein Stipendium von etwa 300-450 im Monat deckt die Lebenshaltung eines Studierenden über 4 Jahre.',
        [
          link(
            'Deutschlandstipendium',
            'Deutschlandstipendium',
            'https://www.deutschlandstipendium.de/',
          ),
        ],
      ],
      [
        'Foundation fee and setup',
        'Stiftungsgebühr und Einrichtung',
        3000,
        'A trust fund under a community foundation costs a set-up fee and a small yearly fee.',
        'Ein Treuhandfonds bei einer Bürgerstiftung kostet eine Einrichtungsgebühr und eine kleine jährliche Gebühr.',
        [
          link(
            'Bundesverband Deutscher Stiftungen',
            'Bundesverband Deutscher Stiftungen',
            'https://www.stiftungen.org/',
          ),
        ],
      ],
      [
        'Mentoring and the graduation',
        'Begleitung und Abschlussfeier',
        1500,
        'A yearly meeting with the student, a mentor from your field and the graduation travel.',
        'Ein jährliches Treffen mit der Studentin oder dem Studenten, ein Mentor aus deinem Fach und die Reise zur Abschlussfeier.',
      ],
      [
        'Reserve for a second student',
        'Reserve für einen zweiten Studierenden',
        7500,
        'Part of the fund can carry on when the first scholar graduates.',
        'Ein Teil des Fonds kann weitergehen, wenn der erste Stipendiat abschließt.',
      ],
    ],
    links: [
      link(
        'Deutschlandstipendium',
        'Deutschlandstipendium',
        'https://www.deutschlandstipendium.de/',
      ),
      link(
        'Bundesverband Deutscher Stiftungen',
        'Bundesverband Deutscher Stiftungen',
        'https://www.stiftungen.org/',
      ),
    ],
    actions: [
      [
        'Ask a university or a community foundation how a scholarship works',
        'Eine Universität oder Bürgerstiftung fragen, wie ein Stipendium funktioniert',
        'high',
      ],
      [
        'Ask for a donation receipt and the tax effects',
        'Nach einer Spendenbescheinigung und den steuerlichen Wirkungen fragen',
        'high',
      ],
      [
        'Decide who may apply: field, region, background',
        'Entscheiden, wer sich bewerben darf: Fach, Region, Herkunft',
      ],
    ],
    notes: [
      [
        'A scholarship that also gives a mentor changes more than money.',
        'Ein Stipendium, das auch einen Mentor gibt, verändert mehr als Geld.',
      ],
    ],
  },
  {
    id: 'D92',
    category: 'give',
    tier: 'little',
    giving: true,
    title: ['Dig a Well for a Village', 'Einen Brunnen für ein Dorf graben'],
    story: [
      'A village that walked three hours for water now has it at the centre of the square.',
      'Ein Dorf, das drei Stunden nach Wasser gelaufen ist, hat es jetzt in der Mitte des Platzes.',
    ],
    description: [
      'A drilled well with a hand pump serves 250-500 people for decades, if the village keeps it up. Good projects train a local water committee and test the water. Choose a registered organisation with a named project, photos, GPS and a yearly report.',
      'Ein gebohrter Brunnen mit Handpumpe versorgt 250-500 Menschen über Jahrzehnte, wenn das Dorf ihn unterhält. Gute Projekte schulen ein lokales Wasserkomitee und testen das Wasser. Wähle eine eingetragene Organisation mit einem benannten Projekt, Fotos, GPS und einem Jahresbericht.',
    ],
    buckets: [
      [
        'The well and the pump',
        'Der Brunnen und die Pumpe',
        1200,
        'A drilled well costs about 1,000-2,500 depending on the depth and the country.',
        'Ein gebohrter Brunnen kostet je nach Tiefe und Land etwa 1.000-2.500.',
        [link('charity: water', 'charity: water', 'https://www.charitywater.org/')],
      ],
      [
        'Water committee and training',
        'Wasserkomitee und Schulung',
        150,
        'A village trained in repairs keeps the well alive; ask what is included.',
        'Ein Dorf mit Reparaturschulung hält den Brunnen am Leben; frag, was enthalten ist.',
      ],
      [
        'Water test and monitoring',
        'Wassertest und Kontrolle',
        100,
        'A test of the water before and after, and a yearly check of the pump.',
        'Ein Test des Wassers vorher und nachher und eine jährliche Prüfung der Pumpe.',
      ],
      [
        'Sanitation and hygiene',
        'Sanitäranlagen und Hygiene',
        50,
        'A hygiene lesson with the school and the families.',
        'Eine Hygiene-Einheit mit Schule und Familien.',
      ],
    ],
    links: [
      link('charity: water', 'charity: water', 'https://www.charitywater.org/'),
      link('WaterAid', 'WaterAid', 'https://www.wateraid.org/'),
      BETTER,
    ],
    actions: [
      [
        'Choose a registered organisation with reports and GPS data',
        'Eine eingetragene Organisation mit Berichten und GPS-Daten wählen',
        'high',
      ],
      [
        'Ask who repairs the pump and who pays',
        'Fragen, wer die Pumpe repariert und wer zahlt',
        'high',
      ],
      ['Ask for a donation receipt', 'Nach einer Spendenbescheinigung fragen', 'low'],
    ],
    notes: [
      [
        'A well that is not kept up dries out: the committee matters more than the drill.',
        'Ein Brunnen, der nicht unterhalten wird, versiegt: das Komitee ist wichtiger als die Bohrung.',
      ],
    ],
  },
  {
    id: 'D93',
    category: 'give',
    tier: 'big',
    giving: true,
    title: ['Support an Animal Shelter', 'Ein Tierheim unterstützen'],
    story: [
      'New kennels, vet bills paid for a year and a dog that finds a home because of you.',
      'Neue Zwinger, Tierarztkosten für ein Jahr bezahlt und ein Hund, der wegen dir ein Zuhause findet.',
    ],
    description: [
      'Animal shelters live on donations and volunteers. A larger gift can pay for new kennels, a quiet room for cats, a vet fund or a year of food. Visit the shelter, ask what it needs most and give a gift that lasts. Volunteer a few days: it is the best way to see where the money goes.',
      'Tierheime leben von Spenden und Ehrenamtlichen. Eine größere Spende kann neue Zwinger, einen ruhigen Raum für Katzen, einen Tierarztfonds oder ein Jahr Futter bezahlen. Besuche das Tierheim, frag, was am meisten gebraucht wird, und gib ein Geschenk, das bleibt. Hilf ein paar Tage ehrenamtlich: so siehst du am besten, wohin das Geld geht.',
    ],
    buckets: [
      [
        'New kennels or a cat room',
        'Neue Zwinger oder ein Katzenraum',
        2500,
        'A set of kennels or a cat room costs about 2,000-4,000 with materials and craftsmen.',
        'Ein Satz Zwinger oder ein Katzenraum kostet mit Material und Handwerkern etwa 2.000-4.000.',
      ],
      [
        'Vet fund for a year',
        'Tierarztfonds für ein Jahr',
        1500,
        'Vaccinations, neutering and treatment of the sick animals.',
        'Impfungen, Kastrationen und Behandlung der kranken Tiere.',
        [
          link(
            'Deutscher Tierschutzbund',
            'Deutscher Tierschutzbund',
            'https://www.tierschutzbund.de/',
          ),
        ],
      ],
      [
        'Food and care for a year',
        'Futter und Pflege für ein Jahr',
        800,
        'Food for a shelter with 40-60 animals costs about 5,000-12,000 a year; a part of it is your gift.',
        'Futter für ein Tierheim mit 40-60 Tieren kostet etwa 5.000-12.000 im Jahr; ein Teil davon ist dein Geschenk.',
      ],
      [
        'A volunteer day and an adoption day',
        'Ein Helfertag und ein Adoptionstag',
        200,
        'An event to find homes: leaflets, a stand and a small party.',
        'Ein Fest, um Zuhause zu finden: Flyer, ein Stand und eine kleine Feier.',
      ],
    ],
    links: [
      link(
        'Deutscher Tierschutzbund',
        'Deutscher Tierschutzbund',
        'https://www.tierschutzbund.de/',
      ),
      BETTER,
    ],
    actions: [
      [
        'Visit a shelter and ask what it needs most',
        'Ein Tierheim besuchen und fragen, was es am meisten braucht',
        'high',
      ],
      ['Ask for a donation receipt', 'Nach einer Spendenbescheinigung fragen'],
      ['Volunteer for a few days', 'Ein paar Tage ehrenamtlich helfen', 'low'],
    ],
    notes: [
      [
        'A shelter is happy about a gift of time as much as of money.',
        'Ein Tierheim freut sich über ein Geschenk der Zeit genauso wie über eines des Geldes.',
      ],
    ],
  },
  {
    id: 'D94',
    category: 'give',
    tier: 'big',
    giving: true,
    title: ['A Playground for Your Neighbourhood', 'Ein Spielplatz für dein Viertel'],
    story: [
      'A swing, a slide and a place where the children of the street meet every afternoon.',
      'Eine Schaukel, eine Rutsche und ein Ort, an dem sich die Kinder der Straße jeden Nachmittag treffen.',
    ],
    description: [
      'A community playground or a garden for a neighbourhood needs an owner (the municipality or an association), a plan with the neighbours and a safe build following the rules for play equipment. Many towns match a donation or help with the permit. A community garden next to it brings the adults.',
      'Ein Gemeinschaftsspielplatz oder ein Garten für ein Viertel braucht einen Träger (die Gemeinde oder einen Verein), einen Plan mit den Nachbarn und einen sicheren Bau nach den Regeln für Spielgeräte. Viele Städte verdoppeln eine Spende oder helfen bei der Genehmigung. Ein Gemeinschaftsgarten daneben bringt die Erwachsenen.',
    ],
    buckets: [
      [
        'Play equipment',
        'Spielgeräte',
        5500,
        'A swing, a slide and a climbing frame certified to the standard cost about 4,000-8,000.',
        'Eine Schaukel, eine Rutsche und ein Klettergerüst nach Norm kosten etwa 4.000-8.000.',
      ],
      [
        'Groundwork, fall protection',
        'Erdarbeiten, Fallschutz',
        2200,
        'Safe surfaces (rubber or bark) and the drainage about 1,500-3,000.',
        'Sichere Bodenbeläge (Gummi oder Rindenmulch) und die Entwässerung etwa 1.500-3.000.',
      ],
      [
        'Benches, planting and fence',
        'Bänke, Bepflanzung und Zaun',
        900,
        'A few benches, trees and a fence by the road.',
        'Einige Bänke, Bäume und ein Zaun zur Straße.',
      ],
      [
        'Permit, inspection, insurance',
        'Genehmigung, Abnahme, Versicherung',
        400,
        'An inspection by an expert and the liability insurance of the owner.',
        'Eine Abnahme durch einen Sachverständigen und die Haftpflicht des Trägers.',
      ],
    ],
    links: [
      link('Deutsches Kinderhilfswerk', 'Deutsches Kinderhilfswerk', 'https://www.dkhw.de/'),
      BETTER,
    ],
    actions: [
      [
        'Ask the municipality which land is free and who can run it',
        'Die Gemeinde fragen, welche Fläche frei ist und wer sie betreiben kann',
        'high',
      ],
      [
        'Ask the children and the neighbours what they want',
        'Die Kinder und Nachbarn fragen, was sie wollen',
        'high',
      ],
      [
        'Ask for a matching grant from the town or a foundation',
        'Bei der Stadt oder einer Stiftung nach einer Förderung fragen',
      ],
    ],
    notes: [
      [
        'A playground lives from the neighbours: plan who looks after it.',
        'Ein Spielplatz lebt von den Nachbarn: plane, wer sich um ihn kümmert.',
      ],
    ],
  },
  {
    id: 'D95',
    category: 'give',
    tier: 'grand',
    giving: true,
    title: [
      'Help a Family Build Their First Home',
      'Einer Familie beim Bau ihres ersten Zuhauses helfen',
    ],
    story: [
      'A family that rented all its life gets a key, and you were there with a hammer on the first day.',
      'Eine Familie, die ihr Leben lang gemietet hat, bekommt einen Schlüssel, und du warst am ersten Tag mit dem Hammer dabei.',
    ],
    description: [
      'Habitat for Humanity builds and renovates simple homes with the future owners and volunteers. Your gift pays the materials and the craftsmen; you can join a build week. The families pay a fair price over years and often put in their own hours of work.',
      'Habitat for Humanity baut und renoviert einfache Häuser mit den künftigen Eigentümern und Freiwilligen. Deine Spende bezahlt Material und Handwerker; du kannst an einer Bauwoche teilnehmen. Die Familien zahlen einen fairen Preis über Jahre und leisten oft eigene Arbeitsstunden.',
    ],
    buckets: [
      [
        'Materials and craftsmen',
        'Material und Handwerker',
        18000,
        'A simple home of 40-60 square metres costs about 15,000-40,000 in many countries; your gift pays a large share.',
        'Ein einfaches Haus von 40-60 Quadratmetern kostet in vielen Ländern etwa 15.000-40.000; deine Spende zahlt einen großen Teil.',
        [link('Habitat for Humanity', 'Habitat for Humanity', 'https://www.habitat.org/')],
      ],
      [
        'Land and connections',
        'Grundstück und Anschlüsse',
        4500,
        'Water, power and a plot title: the partner organisation helps with them.',
        'Wasser, Strom und ein Grundstückstitel: die Partnerorganisation hilft dabei.',
      ],
      [
        'A build week for you',
        'Eine Bauwoche für dich',
        2000,
        'Flights, a guesthouse and the food for a build week with the family.',
        'Flüge, eine Pension und Essen für eine Bauwoche mit der Familie.',
        [SKY],
      ],
      [
        'Furniture and the first year',
        'Möbel und das erste Jahr',
        500,
        'A bed, a table and the first costs of the home.',
        'Ein Bett, ein Tisch und die ersten Kosten des Zuhauses.',
      ],
    ],
    links: [
      link('Habitat for Humanity', 'Habitat for Humanity', 'https://www.habitat.org/'),
      BETTER,
    ],
    actions: [
      [
        'Choose the country and the partner with a clear report',
        'Das Land und den Partner mit klarem Bericht wählen',
        'high',
      ],
      [
        'Ask whether you can join a build week',
        'Fragen, ob du an einer Bauwoche teilnehmen kannst',
      ],
      ['Ask for a donation receipt', 'Nach einer Spendenbescheinigung fragen', 'low'],
    ],
    notes: [
      [
        'The best help is one the family has a part in: ask how they take part.',
        'Die beste Hilfe ist eine, an der die Familie Anteil hat: frag, wie sie mitwirkt.',
      ],
    ],
  },
  {
    id: 'D96',
    category: 'give',
    tier: 'legendary',
    giving: true,
    title: ['Found a Family Foundation', 'Eine Familienstiftung gründen'],
    story: [
      'A capital that gives every year, long after you: your name on a work that goes on.',
      'Ein Kapital, das jedes Jahr gibt, lange nach dir: dein Name auf einem Werk, das weitergeht.',
    ],
    description: [
      'A foundation holds a capital for ever and gives the income to a purpose: education, nature or children. A foundation under a trusteeship or a fund at a community foundation is the way for smaller amounts; an own foundation needs a larger capital (usually 100,000 and more), a board and a yearly report. A tax advisor and a lawyer for foundations are a must.',
      'Eine Stiftung hält ein Kapital für immer und gibt die Erträge für einen Zweck: Bildung, Natur oder Kinder. Eine Treuhandstiftung oder ein Fonds bei einer Bürgerstiftung ist der Weg für kleinere Beträge; eine eigene Stiftung braucht ein größeres Kapital (meist ab 100.000), einen Vorstand und einen Jahresbericht. Ein Steuerberater und ein Anwalt für Stiftungen sind ein Muss.',
    ],
    buckets: [
      [
        'The capital of the foundation',
        'Das Kapital der Stiftung',
        360000,
        'With a yearly return of 3-4 %, a capital of 360,000 gives about 11,000-14,000 a year for its purpose.',
        'Bei einer jährlichen Rendite von 3-4 % bringt ein Kapital von 360.000 etwa 11.000-14.000 im Jahr für den Zweck.',
        [
          link(
            'Bundesverband Deutscher Stiftungen',
            'Bundesverband Deutscher Stiftungen',
            'https://www.stiftungen.org/',
          ),
        ],
      ],
      [
        'Lawyer, statutes, recognition',
        'Anwalt, Satzung, Anerkennung',
        12000,
        'The statutes, the recognition by the authority and the tax exemption need a lawyer and a tax advisor.',
        'Satzung, Anerkennung durch die Behörde und Steuerbefreiung brauchen einen Anwalt und einen Steuerberater.',
      ],
      [
        'Board, accounts, first years',
        'Vorstand, Buchführung, erste Jahre',
        15000,
        'An accountant, the yearly report and a part-time manager for the first years.',
        'Ein Buchhalter, der Jahresbericht und ein Teilzeit-Geschäftsführer für die ersten Jahre.',
      ],
      [
        'The first projects',
        'Die ersten Projekte',
        13000,
        'The first grants and projects, and a launch event with the people who benefit.',
        'Die ersten Förderungen und Projekte und ein Start-Event mit den Menschen, die profitieren.',
        [BETTER],
      ],
    ],
    links: [
      link(
        'Bundesverband Deutscher Stiftungen',
        'Bundesverband Deutscher Stiftungen',
        'https://www.stiftungen.org/',
      ),
      BETTER,
    ],
    actions: [
      ['Decide on the purpose: one clear sentence', 'Den Zweck festlegen: ein klarer Satz', 'high'],
      [
        'Talk to a community foundation about a fund before you found your own',
        'Mit einer Bürgerstiftung über einen Fonds sprechen, bevor du eine eigene gründest',
        'high',
      ],
      [
        'Hire a lawyer and a tax advisor for foundations',
        'Einen Anwalt und einen Steuerberater für Stiftungen beauftragen',
      ],
    ],
    notes: [
      [
        'Start with a fund under a larger foundation: you can still found your own later.',
        'Fang mit einem Fonds unter einer größeren Stiftung an: eine eigene kannst du später noch gründen.',
      ],
    ],
  },
]);
