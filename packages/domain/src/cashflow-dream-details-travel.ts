import { dreamDetail, kitLink as k } from './cashflow-dream-kit';
import type { DreamDetails } from './cashflow-dream-details';

/** The detail of the wonders and the journeys (see `cashflow-dream-details.ts`). */
export const TRAVEL_DETAILS: Record<string, DreamDetails> = {
  D02: dreamDetail(
    [
      'Petra is a day and a night in the desert: the narrow Siq, the Treasury, the Monastery above 800 steps - and a night in the camps of Wadi Rum. The Jordan Pass bundles the visa fee and the entrance to Petra and dozens of sites, if you stay at least three nights. Go in spring or autumn: in summer the rock is too hot to walk.',
      'Petra ist ein Tag und eine Nacht in der Wüste: die enge Schlucht Siq, das Schatzhaus, das Kloster nach 800 Stufen - und eine Nacht in den Camps von Wadi Rum. Der Jordan Pass bündelt die Visagebühr und den Eintritt nach Petra und zu Dutzenden Stätten, wenn du mindestens drei Nächte bleibst. Reise im Frühjahr oder Herbst: im Sommer ist der Fels zu heiß zum Laufen.',
    ],
    [
      [
        'Amman is served by many airlines; a return from central Europe costs about 350-600. Spring and autumn are the dearest; Tuesday and Wednesday are cheaper to fly.',
        'Amman wird von vielen Airlines angeflogen; ein Hin- und Rückflug aus Mitteleuropa kostet etwa 350-600. Frühjahr und Herbst sind am teuersten; dienstags und mittwochs fliegt es sich günstiger.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'Six nights: two in Amman, two in Petra (Wadi Musa), one in Wadi Rum, one on the way. Mid-range hotels cost about 50-100 a night; breakfast is mostly included.',
        'Sechs Nächte: zwei in Amman, zwei in Petra (Wadi Musa), eine in Wadi Rum, eine unterwegs. Mittelklassehotels kosten etwa 50-100 pro Nacht; das Frühstück ist meist inklusive.',
      ],
      [
        'The Jordan Pass costs about 70-80 for one day in Petra (more for two or three days) and covers the visa fee if you stay three nights. Buy it online before you fly.',
        'Der Jordan Pass kostet etwa 70-80 für einen Tag in Petra (mehr für zwei oder drei Tage) und deckt die Visagebühr, wenn du drei Nächte bleibst. Kauf ihn vor dem Flug online.',
        [k('Jordan Pass', 'Jordan Pass', 'https://www.jordanpass.jo/')],
      ],
      [
        'A night in a Bedouin camp in Wadi Rum with dinner and a jeep tour costs about 60-120 per person. Book through a camp with good reviews and a named guide.',
        'Eine Nacht in einem Beduinencamp in Wadi Rum mit Abendessen und Jeeptour kostet etwa 60-120 pro Person. Buch über ein Camp mit guten Bewertungen und einem namentlich genannten Guide.',
      ],
      [
        'A car with a driver for the day or the bus between Amman, Petra and the desert, and meals at 8-15 each. Water is the most important cost in the heat.',
        'Ein Auto mit Fahrer für den Tag oder der Bus zwischen Amman, Petra und der Wüste, und Mahlzeiten zu je 8-15. Wasser ist bei Hitze der wichtigste Posten.',
      ],
    ],
    [
      k(
        'Visit Jordan – the official tourism site',
        'Visit Jordan – die offizielle Tourismusseite',
        'https://www.visitjordan.com/',
      ),
      k('Jordan Pass', 'Jordan Pass', 'https://www.jordanpass.jo/'),
    ],
    [
      [
        'Buy the Jordan Pass online before you travel',
        'Den Jordan Pass vor der Reise online kaufen',
        'high',
      ],
      [
        'Walk into Petra at opening time, before the heat and the crowds',
        'Zur Öffnung nach Petra gehen, vor Hitze und Gruppen',
      ],
      [
        'Book the Wadi Rum camp with a named guide',
        'Das Wadi-Rum-Camp mit einem namentlich genannten Guide buchen',
      ],
      [
        'Take comfortable shoes and a lot of water',
        'Bequeme Schuhe und viel Wasser mitnehmen',
        'low',
      ],
    ],
    [
      [
        'Petra is bigger than the picture: plan two days if you want to climb to the Monastery and the viewpoints.',
        'Petra ist größer als das Bild: plane zwei Tage ein, wenn du zum Kloster und zu den Aussichtspunkten steigen willst.',
      ],
      [
        'Dress modestly and ask before you photograph people.',
        'Kleide dich zurückhaltend und frag, bevor du Menschen fotografierst.',
      ],
    ],
  ),

  D03: dreamDetail(
    [
      'The Taj Mahal at sunrise is the best hour of the day: soft light, few visitors, white marble turning pink. The classic route is the Golden Triangle - Delhi, Agra, Jaipur - by train and car in about ten days. Most visitors need an e-visa, which is applied for online a few weeks ahead; go between October and March, when it is dry and not too hot.',
      'Das Taj Mahal bei Sonnenaufgang ist die beste Stunde des Tages: weiches Licht, wenige Besucher, weißer Marmor, der rosa wird. Die klassische Route ist das Goldene Dreieck - Delhi, Agra, Jaipur - mit Zug und Auto in etwa zehn Tagen. Die meisten Besucher brauchen ein E-Visum, das einige Wochen vorher online beantragt wird; reise zwischen Oktober und März, wenn es trocken und nicht zu heiß ist.',
    ],
    [
      [
        'Return flights from Europe to Delhi cost about 500-900, with one stop or direct from the big hubs. October to March is the high season: book two to three months ahead.',
        'Hin- und Rückflüge von Europa nach Delhi kosten etwa 500-900, mit einem Stopp oder direkt von den großen Drehkreuzen. Oktober bis März ist Hauptsaison: zwei bis drei Monate vorher buchen.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'Ten nights: Delhi, Agra, Jaipur and a rest stop. Good mid-range hotels cost about 50-90 a night; an old haveli in Jaipur is a nice treat at 80-150.',
        'Zehn Nächte: Delhi, Agra, Jaipur und ein Ruhestopp. Gute Mittelklassehotels kosten etwa 50-90 pro Nacht; ein altes Haveli in Jaipur ist mit 80-150 ein schöner Genuss.',
      ],
      [
        'The tourist e-visa costs about 25-80 depending on the season and the length; apply online four weeks before, with a photo and a passport scan. Travel insurance with health cover is a must.',
        'Das Touristen-E-Visum kostet etwa 25-80 je nach Saison und Dauer; beantrage es online vier Wochen vorher, mit Foto und Passscan. Eine Reiseversicherung mit Krankenschutz ist Pflicht.',
        [k('Indian e-visa portal', 'Indisches E-Visa-Portal', 'https://indianvisaonline.gov.in/')],
      ],
      [
        'Trains between the cities cost 10-40 in a good class; the Gatimaan Express from Delhi to Agra takes about 100 minutes. A driver for the trip is about 40-70 a day. The entrance to the Taj Mahal is about 15-20 for foreigners.',
        'Züge zwischen den Städten kosten 10-40 in einer guten Klasse; der Gatimaan Express von Delhi nach Agra braucht etwa 100 Minuten. Ein Fahrer für die Reise kostet etwa 40-70 am Tag. Der Eintritt zum Taj Mahal beträgt etwa 15-20 für Ausländer.',
      ],
      [
        'Food is cheap and good: 4-10 for a meal. Add tips, drinking water, a SIM card and a bit of shopping.',
        'Essen ist günstig und gut: 4-10 für eine Mahlzeit. Dazu Trinkgeld, Trinkwasser, eine SIM-Karte und ein bisschen Einkaufen.',
      ],
    ],
    [
      k(
        'Incredible India – the official tourism site',
        'Incredible India – die offizielle Tourismusseite',
        'https://www.incredibleindia.org/',
      ),
      k('Indian e-visa portal', 'Indisches E-Visa-Portal', 'https://indianvisaonline.gov.in/'),
    ],
    [
      [
        'Apply for the e-visa four weeks ahead',
        'Das E-Visum vier Wochen vorher beantragen',
        'high',
      ],
      [
        'Book the train tickets early; the good trains fill up',
        'Die Zugtickets früh buchen; die guten Züge sind schnell voll',
      ],
      ['Be at the Taj Mahal gate before sunrise', 'Vor Sonnenaufgang am Tor des Taj Mahal sein'],
      [
        'See a travel doctor about vaccinations',
        'Beim Tropenarzt zu Impfungen beraten lassen',
        'low',
      ],
    ],
    [
      [
        'Drink bottled water, eat where it is busy and avoid raw salads: the stomach is the common problem.',
        'Trink Wasser aus Flaschen, iss dort, wo viel los ist, und meide rohen Salat: der Magen ist das häufige Problem.',
      ],
      ['The Taj Mahal is closed on Fridays.', 'Das Taj Mahal ist freitags geschlossen.'],
    ],
  ),

  D04: dreamDetail(
    [
      "The Great Wall is not one place but thousands of kilometres: the restored section at Badaling is crowded, while Jinshanling, Mutianyu and Jiankou give long walks with few people. Two weeks let you add Beijing, Xi'an and a fast train in between. Check the current visa rules: many countries have had visa-free or short-stay arrangements that change often.",
      "Die Chinesische Mauer ist nicht ein Ort, sondern tausende Kilometer: der restaurierte Abschnitt bei Badaling ist überfüllt, während Jinshanling, Mutianyu und Jiankou lange Wanderungen mit wenigen Menschen bieten. Zwei Wochen lassen Platz für Peking, Xi'an und eine Fahrt mit dem Schnellzug. Prüfe die aktuellen Visaregeln: viele Länder hatten visafreie oder Kurzaufenthalts-Regelungen, die sich oft ändern.",
    ],
    [
      [
        'Return flights from Europe to Beijing cost about 600-1,100, direct or with one stop. Spring (April-May) and autumn (September-October) are the best months for the walk.',
        'Hin- und Rückflüge von Europa nach Peking kosten etwa 600-1.100, direkt oder mit einem Stopp. Frühjahr (April-Mai) und Herbst (September-Oktober) sind die besten Monate für die Wanderung.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        "Twelve nights: Beijing, a night near the wall, Xi'an and a rest stop. Good three- and four-star hotels cost about 50-100 a night; a guesthouse in a wall village 30-60.",
        "Zwölf Nächte: Peking, eine Nacht nahe der Mauer, Xi'an und ein Ruhestopp. Gute Drei- und Vier-Sterne-Hotels kosten etwa 50-100 pro Nacht; eine Pension in einem Mauerdorf 30-60.",
      ],
      [
        'If you need a visa it costs about 30-150 depending on the country; the application is at the Chinese visa centre. Travel insurance with a high health cover is a good idea.',
        'Wenn du ein Visum brauchst, kostet es etwa 30-150 je nach Land; der Antrag läuft über das chinesische Visazentrum. Eine Reiseversicherung mit hoher Krankendeckung ist sinnvoll.',
      ],
      [
        'High-speed trains cost about 20-70 for the main legs, and a driver or a guide for the wall about 60-120 a day. A wall section costs about 5-12 to enter, plus a cable car or a toboggan if you like.',
        'Schnellzüge kosten für die Hauptstrecken etwa 20-70, und ein Fahrer oder Guide für die Mauer etwa 60-120 am Tag. Ein Mauerabschnitt kostet etwa 5-12 Eintritt, dazu Seilbahn oder Rodelbahn, wenn du magst.',
      ],
      [
        'Food is cheap: 4-12 for a meal. Add a mobile data plan or an eSIM (a VPN may be needed for some apps) and cash or a mobile payment you can use.',
        'Essen ist günstig: 4-12 für eine Mahlzeit. Dazu ein mobiler Datentarif oder eine eSIM (für manche Apps wird ein VPN gebraucht) und Bargeld oder ein Handyzahlungsmittel, das du nutzen kannst.',
      ],
    ],
    [
      k(
        'Travel China Guide – the Great Wall',
        'Travel China Guide – die Große Mauer',
        'https://www.travelchinaguide.com/',
      ),
      k(
        'Rome2Rio – plan routes by train and bus',
        'Rome2Rio – Routen mit Zug und Bus planen',
        'https://www.rome2rio.com/',
      ),
    ],
    [
      [
        'Check the visa rules for your passport weeks before',
        'Die Visaregeln für deinen Pass Wochen vorher prüfen',
        'high',
      ],
      [
        'Pick a less-visited section: Jinshanling or Mutianyu',
        'Einen weniger besuchten Abschnitt wählen: Jinshanling oder Mutianyu',
      ],
      [
        'Set up a payment method and a data plan before you go',
        'Vor der Abreise ein Zahlungsmittel und einen Datentarif einrichten',
      ],
      [
        'Wear shoes with a good grip: the stones are steep and worn',
        'Schuhe mit gutem Halt tragen: die Steine sind steil und abgenutzt',
        'low',
      ],
    ],
    [
      [
        'Go on a weekday and early: the weekends and holidays are crowded.',
        'Geh an einem Werktag und früh: Wochenenden und Feiertage sind überfüllt.',
      ],
      [
        'Some sections are closed for safety; ask the guesthouse before you go.',
        'Manche Abschnitte sind aus Sicherheitsgründen gesperrt; frag vorher in der Pension.',
      ],
    ],
  ),

  D05: dreamDetail(
    [
      'Machu Picchu is the best-protected of the wonders: a daily quota of visitors, fixed time slots and a guide are required, and the Inca Trail is limited to a few hundred people a day with permits that sell out months ahead. You acclimatise two days in Cusco (3,400 m) before you walk four days to the Sun Gate. The dry season from May to September is the busiest and the most reliable.',
      'Machu Picchu ist das am besten geschützte der Weltwunder: eine tägliche Besucherquote, feste Zeitfenster und ein Guide sind Pflicht, und der Inka-Trail ist auf wenige hundert Menschen am Tag mit Genehmigungen begrenzt, die Monate vorher ausverkauft sind. Du gewöhnst dich zwei Tage in Cusco (3.400 m) an, bevor du vier Tage zum Sonnentor wanderst. Die Trockenzeit von Mai bis September ist am vollsten und am verlässlichsten.',
    ],
    [
      [
        'Return flights from Europe to Lima cost about 900-1,500, and a domestic flight to Cusco another 80-200. Arrive early and sleep in Cusco before the trek.',
        'Hin- und Rückflüge von Europa nach Lima kosten etwa 900-1.500, und ein Inlandsflug nach Cusco weitere 80-200. Komm früh an und schlaf vor dem Trek in Cusco.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'The four-day Inca Trail with a licensed operator - guides, porters, food, tents and the entrance to Machu Picchu - costs about 700-1,300. The permits are bought by the operator: book four to six months ahead.',
        'Der viertägige Inka-Trail mit einem lizenzierten Veranstalter - Guides, Träger, Verpflegung, Zelte und Eintritt nach Machu Picchu - kostet etwa 700-1.300. Die Genehmigungen kauft der Veranstalter: buch vier bis sechs Monate vorher.',
        [
          k(
            'Machu Picchu tickets – official Peruvian ministry',
            'Machu-Picchu-Tickets – offizielles Ministerium',
            'https://tuboleto.cultura.pe/',
          ),
        ],
      ],
      [
        'Hotels in Cusco and Lima: about 40-90 a night; a night in Aguas Calientes before the visit is useful if you do not take the trail.',
        'Hotels in Cusco und Lima: etwa 40-90 pro Nacht; eine Nacht in Aguas Calientes vor dem Besuch ist nützlich, wenn du den Trail nicht gehst.',
      ],
      [
        'Insurance with high-altitude cover and a gear list: a warm sleeping bag, boots that are worn in, rain gear and trekking poles. Many items can be rented in Cusco.',
        'Versicherung mit Höhenschutz und eine Ausrüstungsliste: ein warmer Schlafsack, eingelaufene Stiefel, Regenkleidung und Trekkingstöcke. Vieles kann in Cusco gemietet werden.',
      ],
      [
        'Meals at 6-15 and tips for the porters and the guide (about 40-60 per person for the crew). Coca tea helps with the altitude, but ask a doctor about medicines.',
        'Mahlzeiten zu 6-15 und Trinkgeld für Träger und Guide (etwa 40-60 pro Person für die Crew). Cocatee hilft gegen die Höhe, aber frag einen Arzt zu Medikamenten.',
      ],
    ],
    [
      k(
        'Visit Peru – the official tourism site',
        'Visit Peru – die offizielle Tourismusseite',
        'https://www.peru.travel/',
      ),
      k(
        'Machu Picchu tickets – official',
        'Machu-Picchu-Tickets – offiziell',
        'https://tuboleto.cultura.pe/',
      ),
    ],
    [
      [
        'Book the Inca Trail four to six months ahead',
        'Den Inka-Trail vier bis sechs Monate vorher buchen',
        'high',
      ],
      [
        'Plan two days in Cusco to get used to the altitude',
        'Zwei Tage in Cusco einplanen, um dich an die Höhe zu gewöhnen',
        'high',
      ],
      [
        'Choose a licensed operator that pays its porters fairly',
        'Einen lizenzierten Veranstalter wählen, der seine Träger fair bezahlt',
      ],
      ['Break in your boots for two months', 'Die Stiefel zwei Monate einlaufen', 'low'],
    ],
    [
      [
        'The Inca Trail is closed every February for maintenance.',
        'Der Inka-Trail ist jeden Februar zur Instandhaltung geschlossen.',
      ],
      [
        'Machu Picchu is entered at a fixed time slot; the ticket names the visitor.',
        'Machu Picchu wird in einem festen Zeitfenster betreten; das Ticket ist personalisiert.',
      ],
    ],
  ),

  D06: dreamDetail(
    [
      'Chichén Itzá is the best-known Maya city, and the best hour is the first one: the pyramid of Kukulcán in the morning light, before the tour buses. Add the cenotes (the natural swimming holes), the Maya city of Uxmal or the coast at Tulum, and ten days are easy. A rental car makes the trip free; the roads are good, the heat in summer is not.',
      'Chichén Itzá ist die bekannteste Maya-Stadt, und die beste Stunde ist die erste: die Pyramide des Kukulcán im Morgenlicht, vor den Reisebussen. Dazu kommen die Cenoten (die natürlichen Badelöcher), die Maya-Stadt Uxmal oder die Küste bei Tulum, und zehn Tage sind schnell gefüllt. Ein Mietwagen macht die Reise frei; die Straßen sind gut, die Hitze im Sommer nicht.',
    ],
    [
      [
        'Return flights from Europe to Cancún cost about 600-1,100. The dry season from December to April is the dearest; May and November are a good middle.',
        'Hin- und Rückflüge von Europa nach Cancún kosten etwa 600-1.100. Die Trockenzeit von Dezember bis April ist am teuersten; Mai und November sind eine gute Mitte.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'Ten nights at 60-110: Valladolid is a good base for Chichén Itzá and the cenotes; a few nights at the coast and in Mérida.',
        'Zehn Nächte zu 60-110: Valladolid ist eine gute Basis für Chichén Itzá und die Cenoten; ein paar Nächte an der Küste und in Mérida.',
      ],
      [
        'A small rental car for two weeks costs about 250-500 with full insurance; read the insurance terms carefully, the local liability cover is mandatory.',
        'Ein kleiner Mietwagen für zwei Wochen kostet etwa 250-500 mit Vollversicherung; lies die Versicherungsbedingungen genau, die lokale Haftpflicht ist Pflicht.',
      ],
      [
        'Entrance to Chichén Itzá is about 25-30 for foreigners, the cenotes 5-15 each, Uxmal about 25. Go to the site when it opens.',
        'Der Eintritt nach Chichén Itzá beträgt etwa 25-30 für Ausländer, die Cenoten je 5-15, Uxmal etwa 25. Geh zur Öffnung an die Stätte.',
        [
          k(
            'Visit Mexico – the official tourism site',
            'Visit Mexico – die offizielle Tourismusseite',
            'https://www.visitmexico.com/',
          ),
        ],
      ],
      [
        'Food is good and cheap at the street stalls (3-8 a meal) and dearer at the coast. Bring cash in pesos, and sunscreen that is safe for the cenotes.',
        'Das Essen ist an den Straßenständen gut und günstig (3-8 pro Mahlzeit) und an der Küste teurer. Nimm Bargeld in Pesos mit und Sonnencreme, die für die Cenoten unbedenklich ist.',
      ],
    ],
    [
      k(
        'Visit Mexico – the official tourism site',
        'Visit Mexico – die offizielle Tourismusseite',
        'https://www.visitmexico.com/',
      ),
      k(
        'INAH – the Mexican institute for the sites',
        'INAH – das mexikanische Institut für die Stätten',
        'https://www.inah.gob.mx/',
      ),
    ],
    [
      ['Be at Chichén Itzá when it opens', 'Zur Öffnung in Chichén Itzá sein', 'high'],
      [
        'Combine it with a cenote swim and Valladolid',
        'Es mit einem Cenoten-Bad und Valladolid verbinden',
      ],
      [
        'Read the rental car insurance terms before you pay',
        'Die Versicherungsbedingungen des Mietwagens lesen, bevor du zahlst',
      ],
      [
        'Take reef-safe sunscreen and a hat',
        'Verträgliche Sonnencreme und einen Hut mitnehmen',
        'low',
      ],
    ],
    [
      [
        'The pyramid can no longer be climbed: the Maya city is a place to look at and to listen to the guides.',
        'Die Pyramide darf nicht mehr bestiegen werden: die Maya-Stadt ist ein Ort zum Schauen und Zuhören bei den Guides.',
      ],
      [
        'Midday is hot and full: sleep in Valladolid and go early.',
        'Mittags ist es heiß und voll: schlaf in Valladolid und fahr früh los.',
      ],
    ],
  ),

  D07: dreamDetail(
    [
      'Christ the Redeemer opens his arms over Rio from the Corcovado, 700 metres above the bay. The best way up is the train through the forest, early on a clear morning. Add Sugarloaf Mountain, the beaches of Ipanema and a day in Paraty or Ilha Grande, and ten days are well spent. Rio is a big city: take the usual care, and use the tips of the locals.',
      'Christus der Erlöser breitet über Rio die Arme aus, auf dem Corcovado, 700 Meter über der Bucht. Der beste Weg hinauf ist die Zahnradbahn durch den Wald, früh an einem klaren Morgen. Dazu kommen der Zuckerhut, die Strände von Ipanema und ein Tag in Paraty oder auf der Ilha Grande, und zehn Tage sind gut verbracht. Rio ist eine große Stadt: sei so vorsichtig wie üblich und nutze die Tipps der Einheimischen.',
    ],
    [
      [
        'Return flights from Europe to Rio cost about 800-1,400. The southern summer (December-March) is hot and dear; April to June and September to October are the sweet spots.',
        'Hin- und Rückflüge von Europa nach Rio kosten etwa 800-1.400. Der Südsommer (Dezember-März) ist heiß und teuer; April bis Juni und September bis Oktober sind die Glücksmonate.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'Ten nights at 60-120 in Copacabana, Ipanema or Santa Teresa; a night or two in Paraty. A small hotel with a safe is better than a cheap hostel far from the sights.',
        'Zehn Nächte zu 60-120 in Copacabana, Ipanema oder Santa Teresa; eine oder zwei Nächte in Paraty. Ein kleines Hotel mit Safe ist besser als ein billiges Hostel weit von den Sehenswürdigkeiten.',
      ],
      [
        'The train to the Corcovado costs about 25-30 with the entrance, the cable car to Sugarloaf about 30. Buy the tickets online for a time slot. Taxis and rides by app are cheap.',
        'Die Zahnradbahn zum Corcovado kostet mit Eintritt etwa 25-30, die Seilbahn zum Zuckerhut etwa 30. Kauf die Tickets online für ein Zeitfenster. Taxis und Fahrten per App sind günstig.',
        [
          k(
            'Visit Rio – the official city guide',
            'Visit Rio – der offizielle Stadtführer',
            'https://www.visit.rio/',
          ),
        ],
      ],
      [
        'Meals at 8-20; a feijoada on Saturday is worth the money. Add a SIM card, tips and a day trip.',
        'Mahlzeiten zu 8-20; eine Feijoada am Samstag ist ihr Geld wert. Dazu eine SIM-Karte, Trinkgeld und ein Ausflug.',
      ],
    ],
    [
      k(
        'Visit Rio – the official city guide',
        'Visit Rio – der offizielle Stadtführer',
        'https://www.visit.rio/',
      ),
      k(
        'Rome2Rio – plan routes by bus and boat',
        'Rome2Rio – Routen mit Bus und Boot planen',
        'https://www.rome2rio.com/',
      ),
    ],
    [
      [
        'Go up the Corcovado on a clear morning, with the first train',
        'Auf den Corcovado an einem klaren Morgen steigen, mit dem ersten Zug',
        'high',
      ],
      [
        'Check the safety tips for the neighbourhoods and for the beach',
        'Die Sicherheitstipps für Stadtteile und Strand prüfen',
      ],
      ['Buy the tickets online for a time slot', 'Die Tickets online für ein Zeitfenster kaufen'],
      [
        'Leave valuables in the hotel safe, carry little cash',
        'Wertsachen im Hotelsafe lassen, wenig Bargeld mitnehmen',
        'low',
      ],
    ],
    [
      [
        'Clouds often cover the statue: check the webcam before you go up.',
        'Wolken verdecken die Statue oft: schau vor dem Aufstieg auf die Webcam.',
      ],
      [
        'Carnival is in February and doubles the prices.',
        'Der Karneval im Februar verdoppelt die Preise.',
      ],
    ],
  ),

  D08: dreamDetail(
    [
      'The northern lights are not a promise but a chance: the best months are December to March, on clear nights near the new moon, far from city light. Lapland in Finland gives you a glass igloo to watch from bed, a husky tour and silence. Plan three or four nights so that a cloudy night does not end the dream.',
      'Das Polarlicht ist kein Versprechen, sondern eine Chance: die besten Monate sind Dezember bis März, in klaren Nächten um Neumond, weit weg vom Stadtlicht. Lappland in Finnland bietet ein Glasiglu, aus dem du vom Bett aus schaust, eine Huskytour und Stille. Plane drei oder vier Nächte ein, damit eine bewölkte Nacht den Traum nicht beendet.',
    ],
    [
      [
        'Return flights from Europe to Rovaniemi or Kittilä cost about 250-600, with one stop or on a charter in the season. December is the dearest; book by autumn.',
        'Hin- und Rückflüge von Europa nach Rovaniemi oder Kittilä kosten etwa 250-600, mit einem Stopp oder in der Saison als Charter. Der Dezember ist am teuersten; buch bis zum Herbst.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'A glass igloo or a lodge with a view of the sky costs about 300-600 a night in the season. Three nights give you three chances; a hotel with an aurora alarm wakes you.',
        'Ein Glasiglu oder eine Lodge mit Blick auf den Himmel kostet in der Saison etwa 300-600 pro Nacht. Drei Nächte geben dir drei Chancen; ein Hotel mit Polarlicht-Alarm weckt dich.',
        [k('Visit Finland – Lapland', 'Visit Finland – Lappland', 'https://www.visitfinland.com/')],
      ],
      [
        'A husky safari of a few hours costs about 120-200, a snowmobile tour or a reindeer ride about 100-180. Book with an operator that treats the animals well.',
        'Eine Husky-Safari von einigen Stunden kostet etwa 120-200, eine Schneemobiltour oder Rentierfahrt etwa 100-180. Buch bei einem Veranstalter, der die Tiere gut behandelt.',
      ],
      [
        'Warm clothes can be rented at the hotels (overalls, boots, gloves), which saves a lot. Food is dear in Lapland: 15-35 for a meal.',
        'Warme Kleidung kann in den Hotels geliehen werden (Overall, Stiefel, Handschuhe), das spart viel. Essen ist in Lappland teuer: 15-35 für eine Mahlzeit.',
      ],
    ],
    [
      k('Visit Finland – Lapland', 'Visit Finland – Lappland', 'https://www.visitfinland.com/'),
      k(
        'Finnish Meteorological Institute – aurora forecast',
        'Finnisches Meteorologisches Institut – Polarlicht-Vorhersage',
        'https://en.ilmatieteenlaitos.fi/',
      ),
    ],
    [
      [
        'Travel between December and March, around the new moon',
        'Zwischen Dezember und März reisen, um Neumond',
        'high',
      ],
      [
        'Book three or four nights so one cloudy night does not end it',
        'Drei oder vier Nächte buchen, damit eine bewölkte Nacht nicht alles beendet',
      ],
      [
        'Follow the aurora alerts and keep the evenings free',
        'Den Polarlicht-Warnungen folgen und die Abende frei halten',
      ],
      ['Rent the winter clothes at the hotel', 'Die Winterkleidung im Hotel leihen', 'low'],
    ],
    [
      [
        'A tripod and a camera with manual settings catch what the eye sees only faintly.',
        'Ein Stativ und eine Kamera mit manuellen Einstellungen fangen, was das Auge nur schwach sieht.',
      ],
      [
        'At minus 25 degrees batteries die fast: keep spares warm in the inner pocket.',
        'Bei minus 25 Grad sind Akkus schnell leer: halte Reserve warm in der Innentasche.',
      ],
    ],
  ),

  D11: dreamDetail(
    [
      'Antarctica is the last place on Earth without a country: ice, penguins and whales from a ship that takes about two weeks. Most voyages sail from Ushuaia across the Drake Passage (two days each way); the season is November to March, with penguin chicks in January and whales in February. Choose by the size of the ship: small ships make more landings, big ships are cheaper.',
      'Die Antarktis ist der letzte Ort der Erde ohne Staat: Eis, Pinguine und Wale von einem Schiff, das etwa zwei Wochen unterwegs ist. Die meisten Fahrten starten in Ushuaia und queren die Drake-Passage (je zwei Tage); die Saison ist November bis März, mit Pinguinküken im Januar und Walen im Februar. Wähle nach der Schiffsgröße: kleine Schiffe machen mehr Landungen, große sind günstiger.',
    ],
    [
      [
        'An expedition cruise of 10-14 days costs about 9,900-22,000 per person on a big ship and up to 34,000 on a small one, with the cabin, meals, landings, the zodiacs and a parka. Last-minute offers in Ushuaia can be much cheaper, but are a gamble.',
        'Eine Expeditionskreuzfahrt von 10-14 Tagen kostet etwa 9.900-22.000 pro Person auf einem großen Schiff und bis zu 34.000 auf einem kleinen, mit Kabine, Mahlzeiten, Landungen, Zodiacs und einer Parka. Last-Minute-Angebote in Ushuaia können viel günstiger sein, sind aber ein Glücksspiel.',
        [
          k(
            'IAATO – the association of the polar operators',
            'IAATO – der Verband der Polar-Veranstalter',
            'https://iaato.org/',
          ),
        ],
      ],
      [
        'Return flights from Europe to Ushuaia, often via Buenos Aires, cost about 1,500-2,200; arrive two days before the departure, because a delayed flight must not mean a missed ship.',
        'Hin- und Rückflüge von Europa nach Ushuaia, oft über Buenos Aires, kosten etwa 1.500-2.200; komm zwei Tage vor der Abfahrt an, denn ein verspäteter Flug darf kein verpasstes Schiff bedeuten.',
      ],
      [
        'Warm layers, waterproof trousers, gloves and boots: the ship gives a parka and sometimes boots to borrow. Seasickness patches for the Drake Passage cost little.',
        'Warme Schichten, wasserdichte Hosen, Handschuhe und Stiefel: das Schiff gibt eine Parka und oft Stiefel zum Leihen. Pflaster gegen Seekrankheit für die Drake-Passage kosten wenig.',
      ],
      [
        'Insurance with evacuation cover is required by the operators (often 100,000 or more), a night before in Ushuaia, tips for the crew (about 10-15 a day) and a camera card or two.',
        'Eine Versicherung mit Evakuierungsschutz verlangen die Veranstalter (oft 100.000 oder mehr), eine Nacht vorher in Ushuaia, Trinkgeld für die Crew (etwa 10-15 pro Tag) und ein, zwei Speicherkarten.',
      ],
    ],
    [
      k(
        'IAATO – the association of the polar operators',
        'IAATO – der Verband der Polar-Veranstalter',
        'https://iaato.org/',
      ),
      k('Visit Argentina – Ushuaia', 'Visit Argentina – Ushuaia', 'https://www.argentina.travel/'),
    ],
    [
      [
        'Choose the ship size: more landings on small ships',
        'Die Schiffsgröße wählen: mehr Landungen auf kleinen Schiffen',
        'high',
      ],
      [
        'Compare the November season with January for the price',
        'Die Novembersaison mit dem Januar im Preis vergleichen',
      ],
      [
        'Check that the operator is a member of the polar association',
        'Prüfen, ob der Veranstalter Mitglied im Polarverband ist',
      ],
      [
        'Arrive in Ushuaia two days before the departure',
        'Zwei Tage vor der Abfahrt in Ushuaia ankommen',
        'low',
      ],
    ],
    [
      [
        'The ships stay out of the way of the animals: the rules keep a distance of five metres.',
        'Die Schiffe halten Abstand zu den Tieren: die Regeln verlangen fünf Meter.',
      ],
      [
        'The Drake Passage can be rough or calm - "Drake Lake" or "Drake Shake" - and nobody knows before.',
        'Die Drake-Passage kann rau oder ruhig sein - "Drake Lake" oder "Drake Shake" - und vorher weiß es keiner.',
      ],
    ],
  ),

  D12: dreamDetail(
    [
      'A year around the world: twelve months, a handful of continents and no salary. The costs in the game are the flights, the accommodation, the food and transport, insurance and visas, and the rent and fixed costs at home. A sabbatical can be agreed with the employer as unpaid leave; many people let the flat and cut their costs at home. Slow travel - weeks in one place - is cheaper and kinder than a new bed every night.',
      'Ein Jahr um die Welt: zwölf Monate, eine Handvoll Kontinente und kein Gehalt. Die Kosten im Spiel sind die Flüge, die Unterkunft, Essen und Verkehr, Versicherung und Visa und die Miete und Fixkosten zu Hause. Ein Sabbatical kann mit dem Arbeitgeber als unbezahlter Urlaub vereinbart werden; viele vermieten die Wohnung und senken die Kosten zu Hause. Langsames Reisen - Wochen an einem Ort - ist günstiger und freundlicher als jede Nacht ein neues Bett.',
    ],
    [
      [
        'A round-the-world ticket with five or six stops costs about 2,500-4,500; booking single legs often costs more, and the price depends on the order of the continents. Plan the route around the seasons so that you are not in the monsoon.',
        'Ein Weltreise-Ticket mit fünf oder sechs Stopps kostet etwa 2.500-4.500; einzelne Teilstrecken kosten oft mehr, und der Preis hängt von der Reihenfolge der Kontinente ab. Plane die Route nach den Jahreszeiten, damit du nicht im Monsun bist.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'Twelve months of rooms: in Southeast Asia and Latin America a good simple room costs 15-35 a night, in Europe, Australia and Japan 70-120. Weekly and monthly prices are far lower than nightly ones.',
        'Zwölf Monate Unterkunft: in Südostasien und Lateinamerika kostet ein gutes einfaches Zimmer 15-35 pro Nacht, in Europa, Australien und Japan 70-120. Wochen- und Monatspreise sind weit niedriger als Nachtpreise.',
        [k('Booking.com – stays', 'Booking.com – Unterkünfte', 'https://www.booking.com/')],
      ],
      [
        'Food and local transport: about 15-30 a day in cheap countries, 50-80 in dear ones. A budget per day and a log in a notes app keep the year under control.',
        'Essen und Nahverkehr: etwa 15-30 pro Tag in günstigen Ländern, 50-80 in teuren. Ein Budget pro Tag und ein Protokoll in einer Notiz-App halten das Jahr unter Kontrolle.',
      ],
      [
        'Long-term travel health insurance (about 400-900 for a year), visas (10-150 per country) and vaccinations. Check what your insurance covers abroad and for how long.',
        'Eine Langzeit-Reisekrankenversicherung (etwa 400-900 für ein Jahr), Visa (10-150 pro Land) und Impfungen. Prüfe, was deine Versicherung im Ausland abdeckt und wie lange.',
        [
          k(
            'Foreign Office – travel advice',
            'Auswärtiges Amt – Reisehinweise',
            'https://www.auswaertiges-amt.de/',
          ),
        ],
      ],
      [
        'The costs that go on at home: the rent (or a sublet that covers it), insurance, the phone and a storage unit. Cancel what you can and sublet the flat if the lease allows it.',
        'Die Kosten, die zu Hause weiterlaufen: Miete (oder eine Untermiete, die sie deckt), Versicherungen, das Handy und ein Lagerraum. Kündige, was du kannst, und vermiete die Wohnung unter, wenn der Mietvertrag es erlaubt.',
      ],
    ],
    [
      k(
        'Foreign Office – travel advice',
        'Auswärtiges Amt – Reisehinweise',
        'https://www.auswaertiges-amt.de/',
      ),
      k(
        'Rome2Rio – plan routes between the stops',
        'Rome2Rio – Routen zwischen den Stopps planen',
        'https://www.rome2rio.com/',
      ),
    ],
    [
      [
        'Ask the employer about a sabbatical or unpaid leave',
        'Den Arbeitgeber nach einem Sabbatical oder unbezahltem Urlaub fragen',
        'high',
      ],
      ['Sublet the flat while you are away', 'Die Wohnung für die Zeit untervermieten'],
      [
        'Plan the route by season: avoid the monsoon and the winter',
        'Die Route nach Jahreszeit planen: Monsun und Winter meiden',
      ],
      [
        'Choose a long-term travel health insurance',
        'Eine Langzeit-Reisekrankenversicherung wählen',
        'high',
      ],
      [
        'Test the way of living with a month first',
        'Die Lebensweise erst mit einem Monat testen',
        'low',
      ],
    ],
    [
      [
        'A sabbatical also means a year without salary in reality; the game models it as costs only.',
        'Ein Sabbatical bedeutet in Wirklichkeit auch ein Jahr ohne Gehalt; das Spiel rechnet nur die Kosten.',
      ],
      [
        'Slow travel is cheaper: a month in one place costs far less than a month on the move.',
        'Langsames Reisen ist günstiger: ein Monat an einem Ort kostet weit weniger als ein Monat unterwegs.',
      ],
    ],
  ),

  D13: dreamDetail(
    [
      'Three weeks, a car and the great national parks of the American West: Yellowstone, the Grand Canyon, Zion, Arches and Yosemite are all within a loop. The annual pass for all national parks costs about 80 and pays after four or five parks. Reserve the popular parks and campsites months ahead, and plan long days of driving with short walks.',
      'Drei Wochen, ein Auto und die großen Nationalparks des amerikanischen Westens: Yellowstone, Grand Canyon, Zion, Arches und Yosemite liegen alle auf einer Runde. Der Jahrespass für alle Nationalparks kostet etwa 80 und lohnt sich nach vier oder fünf Parks. Reserviere die beliebten Parks und Campingplätze Monate vorher und plane lange Fahrtage mit kurzen Wanderungen.',
    ],
    [
      [
        'Return flights from Europe to Las Vegas, Denver or San Francisco cost about 600-1,100; open-jaw tickets (in at one city, out at another) save the long drive back.',
        'Hin- und Rückflüge von Europa nach Las Vegas, Denver oder San Francisco kosten etwa 600-1.100; Open-Jaw-Tickets (an einer Stadt hinein, an einer anderen hinaus) sparen die lange Rückfahrt.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'A mid-size car for three weeks costs about 1,000-2,000 with full insurance in the season; book months ahead. Read what the one-way fee is for returning in another city.',
        'Ein Mittelklasseauto für drei Wochen kostet in der Saison etwa 1.000-2.000 mit Vollkasko; buch Monate vorher. Lies, wie hoch die Einwegmiete für die Rückgabe in einer anderen Stadt ist.',
      ],
      [
        'Motels cost about 90-170 a night, campgrounds in the parks 20-40. A mix of both keeps the cost down. Reserve park campgrounds as soon as the booking window opens.',
        'Motels kosten etwa 90-170 pro Nacht, Campingplätze in den Parks 20-40. Eine Mischung aus beidem hält die Kosten niedrig. Reserviere die Campingplätze der Parks, sobald das Buchungsfenster öffnet.',
        [
          k(
            'Recreation.gov – reserve campgrounds and permits',
            'Recreation.gov – Campingplätze und Genehmigungen reservieren',
            'https://www.recreation.gov/',
          ),
        ],
      ],
      [
        'The annual "America the Beautiful" pass costs about 80 for the car and all the parks; fuel for a loop of 4,500 km is about 400-600. Check whether the popular parks need a timed entry.',
        'Der Jahrespass "America the Beautiful" kostet etwa 80 für das Auto und alle Parks; Sprit für eine Runde von 4.500 km kostet etwa 400-600. Prüfe, ob die beliebten Parks ein Zeitfenster für die Einfahrt verlangen.',
        [k('National Park Service', 'National Park Service', 'https://www.nps.gov/')],
      ],
      [
        'Food at 12-25 a meal or a cooler with supplies from the supermarket. Add the ESTA travel authorisation (about 20) and a travel health insurance, which is important in the USA.',
        'Essen zu 12-25 pro Mahlzeit oder eine Kühlbox mit Vorräten aus dem Supermarkt. Dazu die ESTA-Reisegenehmigung (etwa 20) und eine Reisekrankenversicherung, die in den USA wichtig ist.',
        [k('ESTA – travel authorisation', 'ESTA – Reisegenehmigung', 'https://esta.cbp.dhs.gov/')],
      ],
    ],
    [
      k('National Park Service', 'National Park Service', 'https://www.nps.gov/'),
      k(
        'Recreation.gov – reserve campgrounds',
        'Recreation.gov – Campingplätze reservieren',
        'https://www.recreation.gov/',
      ),
      k('ESTA – travel authorisation', 'ESTA – Reisegenehmigung', 'https://esta.cbp.dhs.gov/'),
    ],
    [
      ['Buy the annual national parks pass', 'Den Jahrespass für die Nationalparks kaufen', 'high'],
      [
        'Reserve the popular parks and campsites months ahead',
        'Die beliebten Parks und Campingplätze Monate vorher reservieren',
        'high',
      ],
      [
        'Apply for the ESTA and get a travel health insurance',
        'Die ESTA beantragen und eine Reisekrankenversicherung abschließen',
      ],
      [
        'Plan one long drive and one short walk a day',
        'Pro Tag eine lange Fahrt und eine kurze Wanderung planen',
        'low',
      ],
    ],
    [
      [
        'Distances are huge: a day of driving of six hours is normal between parks.',
        'Die Entfernungen sind riesig: ein Fahrtag von sechs Stunden ist zwischen den Parks normal.',
      ],
      [
        'In summer the desert parks are over 40 degrees: walk at dawn and rest at noon.',
        'Im Sommer sind die Wüstenparks über 40 Grad heiß: wandere im Morgengrauen und ruh mittags.',
      ],
    ],
  ),

  D14: dreamDetail(
    [
      'Six weeks in a campervan through both islands of New Zealand: fjords, glaciers, volcanoes and a beach to yourself. The southern summer from December to March is the best time and the dearest; the roads are winding and slow, so plan fewer kilometres than you think. Freedom camping is limited to marked places; certified self-contained vans may stay in more of them.',
      'Sechs Wochen im Campervan durch beide Inseln Neuseelands: Fjorde, Gletscher, Vulkane und ein Strand für dich allein. Der Südsommer von Dezember bis März ist die beste und teuerste Zeit; die Straßen sind kurvig und langsam, plane also weniger Kilometer als du denkst. Freies Campen ist auf markierte Plätze begrenzt; zertifizierte autarke Fahrzeuge dürfen an mehr Orten stehen.',
    ],
    [
      [
        'Return flights from Europe to Auckland cost about 1,500-2,500 and take two days; booking in the shoulder season (March-April, October-November) saves a few hundred.',
        'Hin- und Rückflüge von Europa nach Auckland kosten etwa 1.500-2.500 und dauern zwei Tage; eine Buchung in der Zwischensaison (März-April, Oktober-November) spart einige hundert.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'A campervan for six weeks costs about 3,000-6,000 depending on the size and the season, with insurance and a one-way fee between the islands. Book six months ahead for the summer.',
        'Ein Campervan für sechs Wochen kostet je nach Größe und Saison etwa 3.000-6.000, mit Versicherung und einer Einweggebühr zwischen den Inseln. Buch für den Sommer sechs Monate vorher.',
      ],
      [
        'Campsites cost about 15-40 a night, and the ferry between the islands about 200-300 with a van. Self-contained certified vans may stay in more free places; read the local rules of each council.',
        'Campingplätze kosten etwa 15-40 pro Nacht, und die Fähre zwischen den Inseln mit einem Van etwa 200-300. Autarke zertifizierte Vans dürfen an mehr freien Plätzen stehen; lies die örtlichen Regeln jedes Councils.',
        [
          k(
            'New Zealand – the official tourism site',
            'Neuseeland – die offizielle Tourismusseite',
            'https://www.newzealand.com/',
          ),
        ],
      ],
      [
        'Activities: a glacier walk or heli-hike about 200-500, a fjord cruise 80-150, a Tongariro crossing shuttle 40-60. Pick three that you really want.',
        'Aktivitäten: eine Gletscherwanderung oder Heli-Hike etwa 200-500, eine Fjordfahrt 80-150, ein Shuttle für die Tongariro-Überquerung 40-60. Such dir drei aus, die du wirklich willst.',
      ],
      [
        'Food and fuel are dear: 15-30 a meal, and the supermarket helps. Add the NZeTA travel authority (about 20-30 plus a tourism levy) before you fly.',
        'Essen und Sprit sind teuer: 15-30 pro Mahlzeit, und der Supermarkt hilft. Dazu die NZeTA-Reisegenehmigung (etwa 20-30 plus Tourismusabgabe) vor dem Flug.',
        [
          k(
            'New Zealand Immigration – NZeTA',
            'Neuseeländische Einwanderungsbehörde – NZeTA',
            'https://www.immigration.govt.nz/',
          ),
        ],
      ],
    ],
    [
      k(
        'New Zealand – the official tourism site',
        'Neuseeland – die offizielle Tourismusseite',
        'https://www.newzealand.com/',
      ),
      k(
        'New Zealand Immigration – NZeTA',
        'Neuseeländische Einwanderungsbehörde – NZeTA',
        'https://www.immigration.govt.nz/',
      ),
    ],
    [
      [
        'Book the campervan early for the southern summer',
        'Den Campervan früh für den Südsommer buchen',
        'high',
      ],
      ['Get the NZeTA travel authority', 'Die NZeTA-Reisegenehmigung besorgen'],
      [
        'Plan fewer kilometres than you think: the roads are slow',
        'Weniger Kilometer planen als gedacht: die Straßen sind langsam',
      ],
      [
        'Learn the rules for camping where it is free',
        'Die Regeln für freies Campen lernen',
        'low',
      ],
    ],
    [
      [
        'Drive on the left: take the first hours slowly and leave the night driving.',
        'Es wird links gefahren: nimm die ersten Stunden langsam und lass das Nachtfahren.',
      ],
      [
        'Weather turns fast: pack layers and book flexible nights in the south.',
        'Das Wetter schlägt schnell um: pack Schichten und buch im Süden flexible Nächte.',
      ],
    ],
  ),

  D15: dreamDetail(
    [
      "An Olympic final live is a ticket you can only get by lottery: the organisers sell the tickets in rounds, in a draw, and the finals are the hardest. The country's official ticket agent is the safe way; other sellers are not. Plan the trip around the draw, and book refundable travel until the tickets are confirmed.",
      'Ein olympisches Finale live ist ein Ticket, das es nur per Los gibt: die Organisatoren verkaufen die Tickets in Runden, in einer Verlosung, und die Finals sind am schwersten zu bekommen. Der offizielle Ticketagent des Landes ist der sichere Weg; andere Verkäufer nicht. Plane die Reise um die Verlosung herum und buch erstattbare Reisen, bis die Tickets bestätigt sind.',
    ],
    [
      [
        'A ticket for a final costs about 300-1,500, the top finals and the opening ceremony more; a day session in a smaller sport costs 30-150. Register for the official draw and pick several sessions, not only the final.',
        'Ein Ticket für ein Finale kostet etwa 300-1.500, die Top-Finals und die Eröffnungsfeier mehr; eine Tagessession in einer kleineren Sportart kostet 30-150. Registriere dich für die offizielle Verlosung und wähle mehrere Sessions, nicht nur das Finale.',
        [
          k(
            'Olympics – the official site',
            'Olympia – die offizielle Seite',
            'https://olympics.com/',
          ),
        ],
      ],
      [
        'Flights to the host city cost about 400-1,200 depending on the host, and rise near the games. Book a flexible fare once the tickets are certain.',
        'Flüge in die Gastgeberstadt kosten etwa 400-1.200 je nach Gastgeber und steigen nahe den Spielen. Buch einen flexiblen Tarif, sobald die Tickets sicher sind.',
        [
          k(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
      [
        'A week in the host city: prices in the games are two to three times the usual. Book early, or stay outside the city and take the train in.',
        'Eine Woche in der Gastgeberstadt: die Preise sind während der Spiele zwei- bis dreimal so hoch. Buch früh oder wohne außerhalb der Stadt und fahr mit dem Zug hinein.',
        [k('Booking.com – stays', 'Booking.com – Unterkünfte', 'https://www.booking.com/')],
      ],
      [
        'Meals at the venue are dear and the security lines long: eat before, take little with you, and keep money for transport, a fan shirt and the odd souvenir.',
        'Essen im Stadion ist teuer und die Sicherheitsschlangen sind lang: iss vorher, nimm wenig mit und lass Geld für Verkehr, ein Fan-Shirt und das eine oder andere Souvenir.',
      ],
    ],
    [k('Olympics – the official site', 'Olympia – die offizielle Seite', 'https://olympics.com/')],
    [
      [
        'Register for the official ticket draw as soon as it opens',
        'Sich für die offizielle Ticketverlosung registrieren, sobald sie öffnet',
        'high',
      ],
      [
        'Pick several sessions and sports, not only one final',
        'Mehrere Sessions und Sportarten wählen, nicht nur ein Finale',
      ],
      [
        'Book refundable flights and hotels until the tickets are sure',
        'Erstattbare Flüge und Hotels buchen, bis die Tickets sicher sind',
        'high',
      ],
      [
        'Avoid resale sites: only the official agent is safe',
        'Wiederverkaufsseiten meiden: nur der offizielle Agent ist sicher',
        'low',
      ],
    ],
    [
      [
        'Tickets named for a person cannot be passed on: the name must match the ID.',
        'Auf eine Person lautende Tickets können nicht weitergegeben werden: der Name muss zum Ausweis passen.',
      ],
      [
        'The finals are decided in the evenings: plan the way back at night.',
        'Die Finals werden abends entschieden: plane die Rückfahrt in der Nacht.',
      ],
    ],
  ),
};
