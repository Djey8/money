/**
 * The Dreamfund Dream stack (JFK, 2026-10-26, temp_cards/dreamfund-dream-deck.md v0.2): 48 dreams in English and German. A dream is
 * generic - it belongs to no character - and becomes a Smile project when it is taken. Amounts are minor units of the game money.
 */
import type { DreamCard } from './cashflow-game/dream-deck';

export const DREAM_CARDS: DreamCard[] = [
  {
    id: 'D01',
    category: 'wonders',
    tier: 'little',
    totalMinor: 150000,
    points: 2,
    title: {
      en: 'See the Colosseum',
      de: 'Das Kolosseum sehen',
    },
    story: {
      en: 'Stand where gladiators stood, then eat the best carbonara of your life.',
      de: 'Steh dort, wo Gladiatoren standen, und iss danach die beste Carbonara deines Lebens.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 25000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotel, 4 nights',
          de: 'Hotel, 4 Nächte',
        },
        amountMinor: 70000,
      },
      {
        id: 'b3',
        title: {
          en: 'Tickets, tours, food',
          de: 'Tickets, Touren, Essen',
        },
        amountMinor: 55000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Book Colosseum tickets online weeks ahead (time slots sell out)',
          de: 'Kolosseum-Tickets Wochen vorher online buchen (Zeitfenster sind schnell weg)',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Travel off-season for lower prices',
          de: 'In der Nebensaison reisen, das ist günstiger',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D02',
    category: 'wonders',
    tier: 'little',
    totalMinor: 250000,
    points: 3,
    title: {
      en: 'Walk into Petra',
      de: 'Nach Petra hineingehen',
    },
    story: {
      en: 'Through the narrow Siq, and suddenly the Treasury glows pink in front of you.',
      de: 'Durch die enge Schlucht, und plötzlich leuchtet das Schatzhaus rosa vor dir.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 45000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotel, 6 nights',
          de: 'Hotel, 6 Nächte',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Jordan Pass and tours',
          de: 'Jordan Pass und Touren',
        },
        amountMinor: 40000,
      },
      {
        id: 'b4',
        title: {
          en: 'Wadi Rum desert night',
          de: 'Nacht in der Wüste Wadi Rum',
        },
        amountMinor: 35000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and transport',
          de: 'Essen und Transport',
        },
        amountMinor: 40000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check the Jordan Pass (visa and entry combined)',
          de: 'Den Jordan Pass prüfen (Visum und Eintritt in einem)',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Go early morning to beat heat and crowds',
          de: 'Früh am Morgen gehen: weniger Hitze, weniger Menschen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D03',
    category: 'wonders',
    tier: 'little',
    totalMinor: 275000,
    points: 3,
    title: {
      en: 'See the Taj Mahal at Sunrise',
      de: 'Das Taj Mahal bei Sonnenaufgang',
    },
    story: {
      en: 'White marble turning gold as the sun comes up over the Yamuna.',
      de: 'Weißer Marmor, der golden wird, wenn die Sonne über der Yamuna aufgeht.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 80000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotels, 10 nights',
          de: 'Hotels, 10 Nächte',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Visa and insurance',
          de: 'Visum und Versicherung',
        },
        amountMinor: 15000,
      },
      {
        id: 'b4',
        title: {
          en: 'Train, guides, entries',
          de: 'Zug, Guides, Eintritte',
        },
        amountMinor: 50000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 40000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Apply for the e-visa in time',
          de: 'Das E-Visum rechtzeitig beantragen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Combine with Delhi and Jaipur (Golden Triangle)',
          de: 'Mit Delhi und Jaipur verbinden (Goldenes Dreieck)',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D04',
    category: 'wonders',
    tier: 'little',
    totalMinor: 350000,
    points: 4,
    title: {
      en: 'Hike the Great Wall',
      de: 'Auf der Chinesischen Mauer wandern',
    },
    story: {
      en: 'An unrestored section, no crowds, the Wall winding over the hills to the horizon.',
      de: 'Ein unrestaurierter Abschnitt, keine Massen, die Mauer windet sich bis zum Horizont.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 90000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotels, 12 nights',
          de: 'Hotels, 12 Nächte',
        },
        amountMinor: 120000,
      },
      {
        id: 'b3',
        title: {
          en: 'Visa and insurance',
          de: 'Visum und Versicherung',
        },
        amountMinor: 20000,
      },
      {
        id: 'b4',
        title: {
          en: 'Trains and guides',
          de: 'Züge und Guides',
        },
        amountMinor: 70000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check current visa rules for China',
          de: 'Die aktuellen Visaregeln für China prüfen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Pick a less-visited section for the hike',
          de: 'Einen weniger besuchten Abschnitt für die Wanderung wählen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D05',
    category: 'wonders',
    tier: 'big',
    totalMinor: 400000,
    points: 4,
    title: {
      en: 'Reach Machu Picchu',
      de: 'Machu Picchu erreichen',
    },
    story: {
      en: 'Four days on the Inca Trail, then the Sun Gate opens onto the lost city.',
      de: 'Vier Tage auf dem Inka-Pfad, dann öffnet sich am Sonnentor die verlorene Stadt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 140000,
      },
      {
        id: 'b2',
        title: {
          en: 'Inca Trail permit and trek',
          de: 'Inka-Trail-Genehmigung und Trek',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Hotels Cusco and Lima',
          de: 'Hotels in Cusco und Lima',
        },
        amountMinor: 80000,
      },
      {
        id: 'b4',
        title: {
          en: 'Insurance and gear',
          de: 'Versicherung und Ausrüstung',
        },
        amountMinor: 40000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Book Inca Trail permits months ahead (limited daily quota)',
          de: 'Inka-Trail-Genehmigungen Monate vorher buchen (begrenztes Tageskontingent)',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Plan two days in Cusco to acclimatise',
          de: 'Zwei Tage in Cusco zur Akklimatisierung einplanen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D06',
    category: 'wonders',
    tier: 'little',
    totalMinor: 300000,
    points: 3,
    title: {
      en: 'Climb Down to Chichén Itzá',
      de: 'Chichén Itzá erleben',
    },
    story: {
      en: 'The pyramid of Kukulcán, then cenotes to swim in and tacos on the Yucatán coast.',
      de: 'Die Pyramide des Kukulcán, danach Cenoten zum Schwimmen und Tacos an der Küste Yucatáns.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 90000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotels, 10 nights',
          de: 'Hotels, 10 Nächte',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Car rental',
          de: 'Mietwagen',
        },
        amountMinor: 40000,
      },
      {
        id: 'b4',
        title: {
          en: 'Entries and cenotes',
          de: 'Eintritte und Cenotes',
        },
        amountMinor: 25000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 55000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Arrive at opening time',
          de: 'Zur Öffnungszeit ankommen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Combine with Tulum and the cenotes',
          de: 'Mit Tulum und den Cenotes verbinden',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D07',
    category: 'wonders',
    tier: 'little',
    totalMinor: 330000,
    points: 4,
    title: {
      en: 'Stand Before Christ the Redeemer',
      de: 'Vor Cristo Redentor stehen',
    },
    story: {
      en: "Rio below you, Sugarloaf in the bay, the statue's arms wide open above.",
      de: 'Rio unter dir, der Zuckerhut in der Bucht, die ausgebreiteten Arme der Statue über dir.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 110000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotels, 10 nights',
          de: 'Hotels, 10 Nächte',
        },
        amountMinor: 110000,
      },
      {
        id: 'b3',
        title: {
          en: 'Tours and transport',
          de: 'Touren und Transport',
        },
        amountMinor: 50000,
      },
      {
        id: 'b4',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 60000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Go up Corcovado on a clear morning',
          de: 'An einem klaren Morgen auf den Corcovado fahren',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Check safety tips for Rio neighbourhoods',
          de: 'Sicherheitstipps für die Viertel von Rio prüfen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    set: 'wonders',
  },
  {
    id: 'D08',
    category: 'travel',
    tier: 'little',
    totalMinor: 300000,
    points: 3,
    title: {
      en: 'Northern Lights in Lapland',
      de: 'Polarlichter in Lappland',
    },
    story: {
      en: 'Minus 25 degrees, a glass igloo, and the sky dancing green above you.',
      de: 'Minus 25 Grad, ein Glasiglu, und über dir tanzt der Himmel grün.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 50000,
      },
      {
        id: 'b2',
        title: {
          en: 'Glass igloo, 3 nights',
          de: 'Glasiglu, 3 Nächte',
        },
        amountMinor: 150000,
      },
      {
        id: 'b3',
        title: {
          en: 'Husky tour',
          de: 'Husky-Tour',
        },
        amountMinor: 35000,
      },
      {
        id: 'b4',
        title: {
          en: 'Winter gear and food',
          de: 'Winterausrüstung und Essen',
        },
        amountMinor: 65000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Travel between December and March, around new moon',
          de: 'Zwischen Dezember und März reisen, möglichst um Neumond',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Book aurora alerts and keep nights flexible',
          de: 'Polarlicht-Alarme einrichten und die Nächte flexibel halten',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D09',
    category: 'travel',
    tier: 'big',
    totalMinor: 600000,
    points: 5,
    title: {
      en: 'Safari in the Serengeti',
      de: 'Safari in der Serengeti',
    },
    story: {
      en: 'The Big Five, a lodge at the crater rim and the Great Migration on the horizon.',
      de: 'Die Big Five, eine Lodge am Kraterrand und die große Tierwanderung am Horizont.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 100000,
      },
      {
        id: 'b2',
        title: {
          en: 'Safari, 6 days, lodges',
          de: 'Safari, 6 Tage, Lodges',
        },
        amountMinor: 380000,
      },
      {
        id: 'b3',
        title: {
          en: 'Park fees and visa',
          de: 'Parkgebühren und Visum',
        },
        amountMinor: 50000,
      },
      {
        id: 'b4',
        title: {
          en: 'Vaccinations and insurance',
          de: 'Impfungen und Versicherung',
        },
        amountMinor: 30000,
      },
      {
        id: 'b5',
        title: {
          en: 'Tips and extras',
          de: 'Trinkgelder und Extras',
        },
        amountMinor: 40000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check vaccinations with a travel doctor',
          de: 'Impfungen bei einem Tropenarzt klären',
        },
        priority: 'medium',
      },
      {
        text: {
          en: "Pick the season by the migration's location",
          de: 'Die Reisezeit nach dem Standort der Migration wählen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D10',
    category: 'travel',
    tier: 'big',
    totalMinor: 500000,
    points: 4,
    title: {
      en: 'Japan in Cherry Blossom Season',
      de: 'Japan zur Kirschblüte',
    },
    story: {
      en: 'Kyoto temples under pink trees, ramen at midnight, the bullet train past Mount Fuji.',
      de: 'Kyotos Tempel unter rosa Bäumen, Ramen um Mitternacht, mit dem Shinkansen am Fuji vorbei.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 110000,
      },
      {
        id: 'b2',
        title: {
          en: 'Hotels and ryokan, 14 nights',
          de: 'Hotels und Ryokan, 14 Nächte',
        },
        amountMinor: 200000,
      },
      {
        id: 'b3',
        title: {
          en: 'Rail pass and transport',
          de: 'Bahnpass und Transport',
        },
        amountMinor: 70000,
      },
      {
        id: 'b4',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 120000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Book early; spring is peak season',
          de: 'Früh buchen; der Frühling ist Hochsaison',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Compare a rail pass with single tickets',
          de: 'Bahnpass mit Einzeltickets vergleichen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D11',
    category: 'travel',
    tier: 'grand',
    totalMinor: 1650000,
    points: 8,
    title: {
      en: 'Antarctica Expedition',
      de: 'Antarktis-Expedition',
    },
    story: {
      en: 'Penguins on the shore, icebergs the size of buildings, the quietest place on Earth.',
      de: 'Pinguine am Ufer, Eisberge so groß wie Häuser, der stillste Ort der Welt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Expedition cruise',
          de: 'Expeditionskreuzfahrt',
        },
        amountMinor: 1370000,
      },
      {
        id: 'b2',
        title: {
          en: 'Flights to Ushuaia',
          de: 'Flüge nach Ushuaia',
        },
        amountMinor: 180000,
      },
      {
        id: 'b3',
        title: {
          en: 'Polar gear',
          de: 'Polarausrüstung',
        },
        amountMinor: 50000,
      },
      {
        id: 'b4',
        title: {
          en: 'Insurance and extras',
          de: 'Versicherung und Extras',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Choose ship size: more landings on small ships',
          de: 'Die Schiffsgröße wählen: kleine Schiffe bieten mehr Landgänge',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Book the November season for the lowest prices',
          de: 'Die Saison im November buchen, das ist am günstigsten',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Filovent – Antarktis-Kreuzfahrt Preise',
          de: 'Filovent – Antarktis-Kreuzfahrt Preise',
        },
        url: 'https://www.filovent.com/de/magazine/antarktis-kreuzfahrt-preis',
      },
    ],
    stat: {
      en: 'Expedition cruises cost about €9,900–22,000 on large ships (average ~€13,700) and up to €34,000 on small ships; flights to the port are often extra.',
      de: 'Expeditionskreuzfahrten kosten auf großen Schiffen etwa 9.900–22.000 € (Durchschnitt ca. 13.700 €), auf kleinen bis zu 34.000 €; die Flüge zum Hafen kommen oft dazu.',
    },
  },
  {
    id: 'D12',
    category: 'travel',
    tier: 'grand',
    totalMinor: 3000000,
    points: 11,
    title: {
      en: 'Around the World in a Year',
      de: 'Ein Jahr um die Welt',
    },
    story: {
      en: 'A one-way ticket, a backpack and twelve months with no plan but the next horizon.',
      de: 'Ein One-Way-Ticket, ein Rucksack und zwölf Monate ohne Plan außer dem nächsten Horizont.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Round-the-world flights',
          de: 'Weltreise-Flüge',
        },
        amountMinor: 400000,
      },
      {
        id: 'b2',
        title: {
          en: 'Accommodation, 12 months',
          de: 'Unterkunft, 12 Monate',
        },
        amountMinor: 1000000,
      },
      {
        id: 'b3',
        title: {
          en: 'Food and transport',
          de: 'Essen und Transport',
        },
        amountMinor: 800000,
      },
      {
        id: 'b4',
        title: {
          en: 'Insurance and visas',
          de: 'Versicherung und Visa',
        },
        amountMinor: 150000,
      },
      {
        id: 'b5',
        title: {
          en: 'Rent and fixed costs at home',
          de: 'Miete und Fixkosten zu Hause',
        },
        amountMinor: 650000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Ask your employer about a sabbatical or unpaid leave',
          de: 'Frage deinen Arbeitgeber nach einem Sabbatical oder unbezahltem Urlaub',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Sublet your flat while away',
          de: 'Vermiete deine Wohnung für die Zeit unter',
        },
        priority: 'medium',
      },
    ],
    links: [],
    stat: {
      en: 'A sabbatical also means a year without salary in reality; the game models it as cost only.',
      de: 'Ein Sabbatical bedeutet in Wirklichkeit auch ein Jahr ohne Gehalt; das Spiel rechnet nur die Kosten.',
    },
  },
  {
    id: 'D13',
    category: 'travel',
    tier: 'big',
    totalMinor: 650000,
    points: 5,
    title: {
      en: 'US National Parks Road Trip',
      de: 'Roadtrip durch die US-Nationalparks',
    },
    story: {
      en: 'Grand Canyon, Zion, Yosemite — a convertible, a playlist and Route 66.',
      de: 'Grand Canyon, Zion, Yosemite — ein Cabrio, eine Playlist und die Route 66.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 90000,
      },
      {
        id: 'b2',
        title: {
          en: 'Car rental, 3 weeks',
          de: 'Mietwagen, 3 Wochen',
        },
        amountMinor: 160000,
      },
      {
        id: 'b3',
        title: {
          en: 'Motels and campgrounds',
          de: 'Motels und Campingplätze',
        },
        amountMinor: 220000,
      },
      {
        id: 'b4',
        title: {
          en: 'Park pass and fuel',
          de: 'Parkpass und Sprit',
        },
        amountMinor: 70000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 110000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Buy the annual national parks pass',
          de: 'Den Jahrespass für die Nationalparks kaufen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Reserve popular parks months ahead',
          de: 'Beliebte Parks Monate vorher reservieren',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D14',
    category: 'travel',
    tier: 'big',
    totalMinor: 1000000,
    points: 6,
    title: {
      en: 'New Zealand by Campervan',
      de: 'Neuseeland im Campervan',
    },
    story: {
      en: 'Six weeks, two islands, fjords, glaciers and Middle-earth around every bend.',
      de: 'Sechs Wochen, zwei Inseln, Fjorde, Gletscher und Mittelerde hinter jeder Kurve.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 200000,
      },
      {
        id: 'b2',
        title: {
          en: 'Campervan, 6 weeks',
          de: 'Campervan, 6 Wochen',
        },
        amountMinor: 400000,
      },
      {
        id: 'b3',
        title: {
          en: 'Campsites and ferries',
          de: 'Campingplätze und Fähren',
        },
        amountMinor: 150000,
      },
      {
        id: 'b4',
        title: {
          en: 'Activities',
          de: 'Aktivitäten',
        },
        amountMinor: 130000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 120000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Book the campervan early for the southern summer',
          de: 'Den Campervan früh für den südlichen Sommer buchen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Get the NZeTA travel authority',
          de: 'Die Einreisegenehmigung NZeTA beantragen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D15',
    category: 'travel',
    tier: 'big',
    totalMinor: 550000,
    points: 5,
    title: {
      en: 'Watch an Olympic Final Live',
      de: 'Ein olympisches Finale live sehen',
    },
    story: {
      en: 'The stadium goes silent before the start — then the roar when the record falls.',
      de: 'Das Stadion wird still vor dem Start — dann der Jubel, als der Rekord fällt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Event tickets',
          de: 'Eintrittskarten',
        },
        amountMinor: 150000,
      },
      {
        id: 'b2',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Hotel, 7 nights',
          de: 'Hotel, 7 Nächte',
        },
        amountMinor: 220000,
      },
      {
        id: 'b4',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 90000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Register for the official ticket lottery',
          de: 'Für die offizielle Ticketverlosung registrieren',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Book accommodation the moment tickets are confirmed',
          de: 'Die Unterkunft buchen, sobald die Tickets bestätigt sind',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D16',
    category: 'adventure',
    tier: 'big',
    totalMinor: 400000,
    points: 4,
    title: {
      en: 'Climb Kilimanjaro',
      de: 'Den Kilimandscharo besteigen',
    },
    story: {
      en: 'Uhuru Peak at sunrise, 5,895 metres, the roof of Africa beneath your boots.',
      de: 'Uhuru Peak bei Sonnenaufgang, 5.895 Meter, das Dach Afrikas unter deinen Schuhen.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Trek package, 7 days',
          de: 'Trekking-Paket, 7 Tage',
        },
        amountMinor: 160000,
      },
      {
        id: 'b2',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Gear',
          de: 'Ausrüstung',
        },
        amountMinor: 60000,
      },
      {
        id: 'b4',
        title: {
          en: 'Tips for the crew',
          de: 'Trinkgelder für die Crew',
        },
        amountMinor: 45000,
      },
      {
        id: 'b5',
        title: {
          en: 'Visa, insurance, hotel',
          de: 'Visum, Versicherung, Hotel',
        },
        amountMinor: 45000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Choose a 7-day route for better acclimatisation',
          de: 'Eine 7-Tage-Route wählen: bessere Akklimatisierung',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Get insurance that covers high altitude',
          de: 'Eine Versicherung wählen, die große Höhe abdeckt',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'bookatrekking – Kosten Kilimandscharo',
          de: 'bookatrekking – Kosten Kilimandscharo',
        },
        url: 'https://bookatrekking.com/de/blog/kosten-besteigung-des-kilimandscharo/',
      },
    ],
    stat: {
      en: 'A 6–7-day trek package costs about €1,425–1,845 incl. park fees; crew tips run about $500 per person, flights and gear are extra.',
      de: 'Ein 6–7-Tage-Trekkingpaket kostet etwa 1.425–1.845 € inkl. Parkgebühren; Trinkgelder für die Crew rund 500 $ pro Person, Flüge und Ausrüstung kommen dazu.',
    },
  },
  {
    id: 'D17',
    category: 'adventure',
    tier: 'big',
    totalMinor: 400000,
    points: 4,
    title: {
      en: 'Everest Base Camp Trek',
      de: 'Zum Everest Base Camp',
    },
    story: {
      en: 'Prayer flags, yak bells and the highest mountain on Earth right in front of you.',
      de: 'Gebetsfahnen, Yakglocken und der höchste Berg der Welt direkt vor dir.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 100000,
      },
      {
        id: 'b2',
        title: {
          en: 'Trek, 14 days',
          de: 'Trek, 14 Tage',
        },
        amountMinor: 150000,
      },
      {
        id: 'b3',
        title: {
          en: 'Permits and Lukla flight',
          de: 'Genehmigungen und Flug nach Lukla',
        },
        amountMinor: 50000,
      },
      {
        id: 'b4',
        title: {
          en: 'Gear',
          de: 'Ausrüstung',
        },
        amountMinor: 60000,
      },
      {
        id: 'b5',
        title: {
          en: 'Insurance and extras',
          de: 'Versicherung und Extras',
        },
        amountMinor: 40000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Train for long multi-day hikes',
          de: 'Für lange Mehrtageswanderungen trainieren',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Insurance must cover helicopter rescue',
          de: 'Die Versicherung muss Helikopter-Rettung abdecken',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D18',
    category: 'adventure',
    tier: 'little',
    totalMinor: 150000,
    points: 2,
    title: {
      en: 'Hike Across the Alps',
      de: 'Zu Fuß über die Alpen',
    },
    story: {
      en: 'Six days on the E5 from Oberstdorf to Meran, hut to hut, ending with an espresso in Italy.',
      de: 'Sechs Tage auf dem E5 von Oberstdorf nach Meran, von Hütte zu Hütte, am Ende ein Espresso in Italien.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Huts and half board',
          de: 'Hütten und Halbpension',
        },
        amountMinor: 70000,
      },
      {
        id: 'b2',
        title: {
          en: 'Gear',
          de: 'Ausrüstung',
        },
        amountMinor: 45000,
      },
      {
        id: 'b3',
        title: {
          en: 'Train and luggage transfer',
          de: 'Zug und Gepäcktransfer',
        },
        amountMinor: 25000,
      },
      {
        id: 'b4',
        title: {
          en: 'Extras',
          de: 'Extras',
        },
        amountMinor: 10000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Book huts early for summer weekends',
          de: 'Hütten für Sommerwochenenden früh buchen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Break in your boots before the trip',
          de: 'Die Wanderschuhe vor der Reise einlaufen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D19',
    category: 'adventure',
    tier: 'little',
    totalMinor: 320000,
    points: 4,
    title: {
      en: 'Learn to Skydive',
      de: 'Fallschirmspringen lernen',
    },
    story: {
      en: 'Your first solo jump — the door opens, and there is only sky.',
      de: 'Dein erster Solosprung — die Tür geht auf, und da ist nur noch Himmel.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'AFF course',
          de: 'AFF-Kurs',
        },
        amountMinor: 240000,
      },
      {
        id: 'b2',
        title: {
          en: 'Extra jumps',
          de: 'Zusätzliche Sprünge',
        },
        amountMinor: 50000,
      },
      {
        id: 'b3',
        title: {
          en: 'Gear rental and medical',
          de: 'Ausrüstungsmiete und Untersuchung',
        },
        amountMinor: 30000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Start with a tandem jump to see if you love it',
          de: 'Mit einem Tandemsprung anfangen, um zu sehen, ob du es liebst',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Choose a certified drop zone',
          de: 'Eine zertifizierte Absprungzone wählen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D20',
    category: 'adventure',
    tier: 'big',
    totalMinor: 580000,
    points: 5,
    title: {
      en: 'Dive the Great Barrier Reef',
      de: 'Am Great Barrier Reef tauchen',
    },
    story: {
      en: "Turtles, manta rays and coral in colours you didn't know existed.",
      de: 'Schildkröten, Mantas und Korallen in Farben, von denen du nicht wusstest, dass es sie gibt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 170000,
      },
      {
        id: 'b2',
        title: {
          en: 'Dive licence course',
          de: 'Tauchschein-Kurs',
        },
        amountMinor: 50000,
      },
      {
        id: 'b3',
        title: {
          en: 'Liveaboard, 3 days',
          de: 'Tauchsafari, 3 Tage',
        },
        amountMinor: 130000,
      },
      {
        id: 'b4',
        title: {
          en: 'Hotels, 10 nights',
          de: 'Hotels, 10 Nächte',
        },
        amountMinor: 130000,
      },
      {
        id: 'b5',
        title: {
          en: 'Food and extras',
          de: 'Essen und Extras',
        },
        amountMinor: 100000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Get the open water licence at home first',
          de: 'Den Open-Water-Schein zuerst zu Hause machen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Choose an eco-certified operator',
          de: 'Einen umweltzertifizierten Anbieter wählen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D21',
    category: 'adventure',
    tier: 'big',
    totalMinor: 800000,
    points: 6,
    title: {
      en: 'Feel Zero Gravity',
      de: 'Schwerelosigkeit erleben',
    },
    story: {
      en: 'Fifteen parabolas, twenty-two seconds each. You float. You laugh. You float again.',
      de: 'Fünfzehn Parabeln, jeweils zweiundzwanzig Sekunden. Du schwebst. Du lachst. Du schwebst wieder.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Parabolic flight ticket',
          de: 'Ticket für den Parabelflug',
        },
        amountMinor: 700000,
      },
      {
        id: 'b2',
        title: {
          en: 'Travel and hotel',
          de: 'Anreise und Hotel',
        },
        amountMinor: 80000,
      },
      {
        id: 'b3',
        title: {
          en: 'Extras',
          de: 'Extras',
        },
        amountMinor: 20000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check available commercial parabolic flight dates',
          de: 'Die verfügbaren Termine für kommerzielle Parabelflüge prüfen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Expect a medical questionnaire',
          de: 'Mit einem medizinischen Fragebogen rechnen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D22',
    category: 'adventure',
    tier: 'big',
    totalMinor: 400000,
    points: 4,
    title: {
      en: 'Run a World Marathon Major',
      de: 'Einen der großen Marathons laufen',
    },
    story: {
      en: 'Mile 26 in New York, the crowd screaming your name off your bib.',
      de: 'Kilometer 42 in New York, die Menge schreit den Namen von deiner Startnummer.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Start place (charity or tour)',
          de: 'Startplatz (Charity oder Reise)',
        },
        amountMinor: 150000,
      },
      {
        id: 'b2',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 80000,
      },
      {
        id: 'b3',
        title: {
          en: 'Hotel',
          de: 'Hotel',
        },
        amountMinor: 120000,
      },
      {
        id: 'b4',
        title: {
          en: 'Training and gear',
          de: 'Training und Ausrüstung',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Enter the lottery or secure a charity place',
          de: 'An der Verlosung teilnehmen oder einen Charity-Platz sichern',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Follow a 16-week training plan',
          de: 'Einem 16-Wochen-Trainingsplan folgen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D23',
    category: 'adventure',
    tier: 'life',
    totalMinor: 12000000,
    points: 22,
    title: {
      en: 'Edge of Space',
      de: 'Am Rand des Weltalls',
    },
    story: {
      en: 'A balloon capsule at 30 km. The curve of the Earth, the black of space, a glass in your hand.',
      de: 'Eine Ballonkapsel in 30 km Höhe. Die Erdkrümmung, das Schwarz des Alls, ein Glas in der Hand.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Flight seat',
          de: 'Platz im Flug',
        },
        amountMinor: 11500000,
      },
      {
        id: 'b2',
        title: {
          en: 'Travel and training',
          de: 'Reise und Training',
        },
        amountMinor: 300000,
      },
      {
        id: 'b3',
        title: {
          en: 'Insurance',
          de: 'Versicherung',
        },
        amountMinor: 200000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check which providers are actually flying',
          de: 'Prüfen, welche Anbieter tatsächlich fliegen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Put down a refundable deposit only',
          de: 'Nur eine erstattbare Anzahlung leisten',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Space.com – stratospheric balloon seats',
          de: 'Space.com – Plätze im Stratosphärenballon',
        },
        url: 'https://www.space.com/space-perspective-selling-seats-stratosphere-balloon',
      },
    ],
    stat: {
      en: 'Stratospheric balloon flights were sold at $125,000 per seat (~€115,000); the commercial status of these offers changes, check before relying on it.',
      de: 'Flüge mit Stratosphärenballons wurden für 125.000 $ pro Platz (~115.000 €) verkauft; der kommerzielle Status dieser Angebote ändert sich, prüfe ihn vorher.',
    },
  },
  {
    id: 'D24',
    category: 'learn',
    tier: 'big',
    totalMinor: 1400000,
    points: 7,
    title: {
      en: 'Become a Pilot',
      de: 'Pilot werden',
    },
    story: {
      en: 'Your first solo flight. The instructor stays on the ground. The runway is all yours.',
      de: 'Dein erster Alleinflug. Der Fluglehrer bleibt am Boden. Die Startbahn gehört dir.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: '45 flight hours',
          de: '45 Flugstunden',
        },
        amountMinor: 1000000,
      },
      {
        id: 'b2',
        title: {
          en: 'Theory and radio licence',
          de: 'Theorie und Sprechfunkzeugnis',
        },
        amountMinor: 90000,
      },
      {
        id: 'b3',
        title: {
          en: 'Landing fees and ATC',
          de: 'Landegebühren und Flugsicherung',
        },
        amountMinor: 170000,
      },
      {
        id: 'b4',
        title: {
          en: 'Medical, exams, fees',
          de: 'Untersuchung, Prüfungen, Gebühren',
        },
        amountMinor: 90000,
      },
      {
        id: 'b5',
        title: {
          en: 'Headset and materials',
          de: 'Headset und Unterlagen',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Do a trial lesson first',
          de: 'Zuerst eine Probestunde nehmen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Get the class 2 medical before you pay for the course',
          de: 'Das Tauglichkeitszeugnis Klasse 2 holen, bevor du den Kurs bezahlst',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 't-online – Kosten für den Pilotenschein',
          de: 't-online – Kosten für den Pilotenschein',
        },
        url: 'https://www.t-online.de/mobilitaet/id_51288566/kosten-fuer-pilotenschein-so-teuer-kann-es-werden.html',
      },
    ],
    stat: {
      en: 'A PPL(A) needs at least 45 flight hours; one Berlin school listed about €12,900, plus external fees and the medical.',
      de: 'Für den PPL(A) braucht man mindestens 45 Flugstunden; eine Berliner Schule nannte etwa 12.900 €, dazu externe Gebühren und die Untersuchung.',
    },
  },
  {
    id: 'D25',
    category: 'learn',
    tier: 'little',
    totalMinor: 330000,
    points: 4,
    title: {
      en: 'Sail the Croatian Islands',
      de: 'Mit dem Segelboot durch Kroatien',
    },
    story: {
      en: 'Your own licence, a chartered yacht and a different island bay every night.',
      de: 'Dein eigener Schein, eine gecharterte Yacht und jeden Abend eine andere Inselbucht.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Sailing licence',
          de: 'Segelschein',
        },
        amountMinor: 120000,
      },
      {
        id: 'b2',
        title: {
          en: 'Charter week (share)',
          de: 'Charterwoche (dein Anteil)',
        },
        amountMinor: 120000,
      },
      {
        id: 'b3',
        title: {
          en: 'Travel',
          de: 'Anreise',
        },
        amountMinor: 40000,
      },
      {
        id: 'b4',
        title: {
          en: 'Marina fees and food',
          de: 'Hafengebühren und Essen',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Take the licence course in spring',
          de: 'Den Schein im Frühling machen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Charter with friends to share costs',
          de: 'Mit Freunden chartern und die Kosten teilen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D26',
    category: 'learn',
    tier: 'big',
    totalMinor: 800000,
    points: 6,
    title: {
      en: 'Play the Piano',
      de: 'Klavier spielen lernen',
    },
    story: {
      en: 'Two years of lessons. Then you play your favourite song for the people you love.',
      de: 'Zwei Jahre Unterricht. Dann spielst du dein Lieblingslied für die Menschen, die du liebst.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Upright piano',
          de: 'Klavier (aufrecht)',
        },
        amountMinor: 450000,
      },
      {
        id: 'b2',
        title: {
          en: 'Lessons, 2 years',
          de: 'Unterricht, 2 Jahre',
        },
        amountMinor: 300000,
      },
      {
        id: 'b3',
        title: {
          en: 'Tuning and sheet music',
          de: 'Stimmen und Noten',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Rent before you buy',
          de: 'Erst mieten, dann kaufen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Schedule a fixed weekly lesson',
          de: 'Eine feste Unterrichtsstunde pro Woche einplanen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D27',
    category: 'learn',
    tier: 'big',
    totalMinor: 650000,
    points: 5,
    title: {
      en: 'A Semester of Spanish in Seville',
      de: 'Ein Sprachsemester in Sevilla',
    },
    story: {
      en: 'Three months of classes, tapas, flamenco — and dreaming in Spanish by week ten.',
      de: 'Drei Monate Unterricht, Tapas, Flamenco — und ab Woche zehn träumst du auf Spanisch.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Language school, 12 weeks',
          de: 'Sprachschule, 12 Wochen',
        },
        amountMinor: 280000,
      },
      {
        id: 'b2',
        title: {
          en: 'Room, 3 months',
          de: 'Zimmer, 3 Monate',
        },
        amountMinor: 180000,
      },
      {
        id: 'b3',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 30000,
      },
      {
        id: 'b4',
        title: {
          en: 'Living costs',
          de: 'Lebenshaltung',
        },
        amountMinor: 160000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Ask about unpaid leave or remote work',
          de: 'Nach unbezahltem Urlaub oder Remote-Arbeit fragen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Book a homestay for faster progress',
          de: 'Eine Gastfamilie bringt schnelleren Fortschritt',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D28',
    category: 'vehicles',
    tier: 'big',
    totalMinor: 400000,
    points: 4,
    title: {
      en: 'The Dream Bike',
      de: 'Das Traumfahrrad',
    },
    story: {
      en: 'A hand-built gravel bike that makes every Sunday an adventure.',
      de: 'Ein handgebautes Gravelbike, das jeden Sonntag zum Abenteuer macht.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Bike',
          de: 'Fahrrad',
        },
        amountMinor: 350000,
      },
      {
        id: 'b2',
        title: {
          en: 'Bike fit and gear',
          de: 'Sitzanpassung und Ausrüstung',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Get a professional bike fit',
          de: 'Eine professionelle Rad-Anpassung machen lassen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Insure it against theft (see Emergency E18)',
          de: 'Gegen Diebstahl versichern (siehe Notfall E18)',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D29',
    category: 'vehicles',
    tier: 'big',
    totalMinor: 1150000,
    points: 7,
    title: {
      en: 'Motorbike and Licence',
      de: 'Motorradführerschein und Bike',
    },
    story: {
      en: 'Alpine passes, curves and the smell of summer rain on hot asphalt.',
      de: 'Alpenpässe, Kurven und der Geruch von Sommerregen auf heißem Asphalt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Licence (class A)',
          de: 'Führerschein (Klasse A)',
        },
        amountMinor: 250000,
      },
      {
        id: 'b2',
        title: {
          en: 'Used motorbike',
          de: 'Gebrauchtes Motorrad',
        },
        amountMinor: 750000,
      },
      {
        id: 'b3',
        title: {
          en: 'Helmet and gear',
          de: 'Helm und Schutzkleidung',
        },
        amountMinor: 150000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Start with a used bike',
          de: 'Mit einem gebrauchten Motorrad anfangen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Budget insurance and maintenance',
          de: 'Versicherung und Wartung einplanen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    monthlyAfterMinor: 6000,
    carAfter: true,
  },
  {
    id: 'D30',
    category: 'vehicles',
    tier: 'life',
    totalMinor: 6000000,
    points: 15,
    title: {
      en: 'Your Own Campervan',
      de: 'Dein eigener Camper',
    },
    story: {
      en: 'Wake up by a lake, coffee on the stove, no plan for today.',
      de: 'Am See aufwachen, Kaffee auf dem Kocher, kein Plan für heute.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Campervan (new, compact)',
          de: 'Campervan (neu, kompakt)',
        },
        amountMinor: 5500000,
      },
      {
        id: 'b2',
        title: {
          en: 'Equipment',
          de: 'Ausstattung',
        },
        amountMinor: 300000,
      },
      {
        id: 'b3',
        title: {
          en: 'Registration and first insurance',
          de: 'Zulassung und erste Versicherung',
        },
        amountMinor: 200000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Rent one for a holiday first',
          de: 'Erst für einen Urlaub einen mieten',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Compare new vs. used (from ~€16,500)',
          de: 'Neu und gebraucht vergleichen (ab ca. 16.500 €)',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'camperstyle – Wohnmobil kaufen 2026',
          de: 'camperstyle – Wohnmobil kaufen 2026',
        },
        url: 'https://camperstyle.de/wohnmobil-kaufen-2026-was-es-wirklich-kostet-und-worauf-du-beim-preisvergleich-achten-musst-423939/',
      },
    ],
    stat: {
      en: 'New camper vans mostly cost €50,000–75,000; running costs without parking are roughly €840–1,940 a year, plus depreciation.',
      de: 'Neue Campingbusse kosten meist 50.000–75.000 €; die laufenden Kosten ohne Stellplatz liegen bei etwa 840–1.940 € im Jahr, dazu kommt der Wertverlust.',
    },
    monthlyAfterMinor: 15000,
    carAfter: true,
  },
  {
    id: 'D31',
    category: 'vehicles',
    tier: 'grand',
    totalMinor: 4500000,
    points: 13,
    title: {
      en: 'A Restored VW Bus',
      de: 'Ein restaurierter VW-Bus',
    },
    story: {
      en: 'A 1970s T2 in two-tone paint, the most smiles per kilometre on the road.',
      de: 'Ein T2 aus den 70ern in Zweifarblackierung, die meisten Lächeln pro Kilometer.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Restored T2',
          de: 'Restaurierter T2',
        },
        amountMinor: 4200000,
      },
      {
        id: 'b2',
        title: {
          en: 'Inspection and fixes',
          de: 'Inspektion und Reparaturen',
        },
        amountMinor: 200000,
      },
      {
        id: 'b3',
        title: {
          en: 'Garage spot, first year',
          de: 'Garagenplatz, erstes Jahr',
        },
        amountMinor: 100000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Get an independent classic car appraisal',
          de: 'Ein unabhängiges Oldtimer-Gutachten einholen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Check for rust before anything else',
          de: 'Zuerst auf Rost prüfen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    monthlyAfterMinor: 12000,
    carAfter: true,
  },
  {
    id: 'D32',
    category: 'vehicles',
    tier: 'life',
    totalMinor: 14300000,
    points: 24,
    title: {
      en: 'Porsche 911',
      de: 'Porsche 911',
    },
    story: {
      en: 'The flat-six behind you, a mountain road in front of you. Since 1963.',
      de: 'Der Sechszylinder hinter dir, eine Bergstraße vor dir. Seit 1963.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Porsche 911 Carrera',
          de: 'Porsche 911 Carrera',
        },
        amountMinor: 13630000,
      },
      {
        id: 'b2',
        title: {
          en: 'Insurance and registration',
          de: 'Versicherung und Zulassung',
        },
        amountMinor: 300000,
      },
      {
        id: 'b3',
        title: {
          en: 'Winter tyres and extras',
          de: 'Winterreifen und Extras',
        },
        amountMinor: 370000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Consider a used 911 (much cheaper)',
          de: 'Einen gebrauchten 911 in Betracht ziehen (viel günstiger)',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Budget running costs before buying',
          de: 'Die laufenden Kosten vor dem Kauf einplanen',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Porsche 911 Carrera price 2026',
          de: 'Porsche 911 Carrera Preis 2026',
        },
        url: 'https://www.electricbike.it.com/porsche-911-carrera-price/',
      },
    ],
    stat: {
      en: 'The 2026 911 Carrera starts at about €136,300 in Germany.',
      de: 'Der 911 Carrera 2026 beginnt in Deutschland bei etwa 136.300 €.',
    },
    monthlyAfterMinor: 50000,
    carAfter: true,
  },
  {
    id: 'D33',
    category: 'home',
    tier: 'grand',
    totalMinor: 1500000,
    points: 8,
    title: {
      en: 'Dream Kitchen',
      de: 'Die Traumküche',
    },
    story: {
      en: 'A kitchen island, a proper range and friends around the table every weekend.',
      de: 'Eine Kücheninsel, ein richtiger Herd und jedes Wochenende Freunde am Tisch.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Kitchen units',
          de: 'Küchenschränke',
        },
        amountMinor: 900000,
      },
      {
        id: 'b2',
        title: {
          en: 'Appliances',
          de: 'Elektrogeräte',
        },
        amountMinor: 450000,
      },
      {
        id: 'b3',
        title: {
          en: 'Installation',
          de: 'Einbau',
        },
        amountMinor: 150000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Get three quotes',
          de: 'Drei Angebote einholen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Plan with your landlord if you rent',
          de: 'Als Mieter mit dem Vermieter planen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D34',
    category: 'home',
    tier: 'life',
    totalMinor: 12000000,
    points: 22,
    title: {
      en: 'Your Own Flat',
      de: 'Die eigenen vier Wände',
    },
    story: {
      en: "Keys to a place that's yours. Paint the walls any colour you want.",
      de: 'Schlüssel für einen Ort, der dir gehört. Streich die Wände in jeder Farbe, die du willst.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Down payment (20%)',
          de: 'Anzahlung (20 %)',
        },
        amountMinor: 8000000,
      },
      {
        id: 'b2',
        title: {
          en: 'Purchase tax and notary',
          de: 'Grunderwerbsteuer und Notar',
        },
        amountMinor: 2800000,
      },
      {
        id: 'b3',
        title: {
          en: 'Move and furniture',
          de: 'Umzug und Möbel',
        },
        amountMinor: 1200000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Get a mortgage pre-approval',
          de: 'Eine Finanzierungszusage einholen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Compare buying vs. renting for your city',
          de: 'Kaufen und Mieten in deiner Stadt vergleichen',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'Bausparkassen – Sparmotive Sommer 2025',
          de: 'Bausparkassen – Sparmotive Sommer 2025',
        },
        url: 'https://www.bausparkassen.de/wp-content/uploads/2025/08/PM-8_2025_Sommerumfrage_Sparmotive.pdf',
      },
      {
        label: {
          en: 'evangelisch.de – Ipsos Life Aspirations 2026',
          de: 'evangelisch.de – Ipsos Life Aspirations 2026',
        },
        url: 'https://www.evangelisch.de/inhalte/258493/26-08-2026/umfrage-viele-deutsche-halten-lebensziele-fuer-schwer-erreichbar',
      },
    ],
    stat: {
      en: 'A third of Germans save for home ownership (2025), but in an Ipsos 2026 study only 22% were confident they would buy. In the game this is a home to live in (a lifestyle dream), not a rental investment; investments with income belong to Grow.',
      de: 'Ein Drittel der Deutschen spart für Wohneigentum (2025), doch in einer Ipsos-Studie 2026 waren nur 22 % zuversichtlich, wirklich zu kaufen. Im Spiel ist das ein Zuhause zum Wohnen (ein Lebensstil-Traum), keine Mietinvestition; Investitionen mit Einkommen gehören in Grow.',
    },
  },
  {
    id: 'D35',
    category: 'home',
    tier: 'life',
    totalMinor: 9500000,
    points: 19,
    title: {
      en: 'A Tiny House on Your Own Plot',
      de: 'Ein Tiny House auf eigenem Grund',
    },
    story: {
      en: "Thirty square metres, a big window, a small garden and nothing you don't need.",
      de: 'Dreißig Quadratmeter, ein großes Fenster, ein kleiner Garten und nichts, was du nicht brauchst.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Plot (rural)',
          de: 'Grundstück (ländlich)',
        },
        amountMinor: 3000000,
      },
      {
        id: 'b2',
        title: {
          en: 'Tiny house',
          de: 'Tiny House',
        },
        amountMinor: 5500000,
      },
      {
        id: 'b3',
        title: {
          en: 'Connections and permits',
          de: 'Anschlüsse und Genehmigungen',
        },
        amountMinor: 1000000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Check building law for the plot first',
          de: 'Zuerst das Baurecht für das Grundstück prüfen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Visit tiny house villages',
          de: 'Tiny-House-Dörfer besuchen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    monthlyAfterMinor: 15000,
  },
  {
    id: 'D36',
    category: 'home',
    tier: 'legendary',
    totalMinor: 26000000,
    points: 32,
    title: {
      en: 'Own a Small Farm',
      de: 'Ein eigener kleiner Hof',
    },
    story: {
      en: 'Five hectares, an old farmhouse, chickens in the yard and your own apples in autumn.',
      de: 'Fünf Hektar, ein alter Bauernhof, Hühner im Hof und im Herbst eigene Äpfel.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Land, 5 ha (rural east)',
          de: 'Land, 5 ha (ländlicher Osten)',
        },
        amountMinor: 9000000,
      },
      {
        id: 'b2',
        title: {
          en: 'Farmhouse',
          de: 'Bauernhaus',
        },
        amountMinor: 14000000,
      },
      {
        id: 'b3',
        title: {
          en: 'Tractor and equipment',
          de: 'Traktor und Geräte',
        },
        amountMinor: 2000000,
      },
      {
        id: 'b4',
        title: {
          en: 'Animals, fences, seeds',
          de: 'Tiere, Zäune, Saatgut',
        },
        amountMinor: 1000000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Learn farming basics with a volunteer stay first',
          de: 'Zuerst bei einem Aufenthalt als Helfer die Landwirtschaft kennenlernen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Check eastern regions for affordable land',
          de: 'Die östlichen Regionen für günstiges Land prüfen',
        },
        priority: 'medium',
      },
    ],
    links: [
      {
        label: {
          en: 'top agrar – Bodenpreise 2025',
          de: 'top agrar – Bodenpreise 2025',
        },
        url: 'https://www.topagrar.com/betriebsleitung/news/bodenpreise-sinken-weiter-20029540.html',
      },
    ],
    stat: {
      en: 'Farmland averaged ~€17,500/ha in eastern and ~€51,800/ha in western German states in 2025; Bavaria ~€78,200/ha.',
      de: 'Ackerland kostete 2025 im Schnitt etwa 17.500 €/ha im Osten und 51.800 €/ha in den westlichen Bundesländern; Bayern etwa 78.200 €/ha.',
    },
    monthlyAfterMinor: 30000,
  },
  {
    id: 'D37',
    category: 'people',
    tier: 'big',
    totalMinor: 600000,
    points: 6,
    title: {
      en: 'Take Your Parents on Their Dream Trip',
      de: 'Deine Eltern auf ihre Traumreise einladen',
    },
    story: {
      en: "They always wanted to see Norway's fjords. This time, you're taking them.",
      de: 'Sie wollten immer die Fjorde Norwegens sehen. Diesmal nimmst du sie mit.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Cruise or tour for three',
          de: 'Kreuzfahrt oder Reise für drei',
        },
        amountMinor: 500000,
      },
      {
        id: 'b2',
        title: {
          en: 'Travel and extras',
          de: 'Reise und Extras',
        },
        amountMinor: 100000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Plan it as a surprise for a birthday',
          de: 'Als Überraschung zum Geburtstag planen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Check mobility needs and insurance',
          de: 'Mobilitätsbedürfnisse und Versicherung prüfen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    giving: true,
  },
  {
    id: 'D38',
    category: 'people',
    tier: 'grand',
    totalMinor: 2500000,
    points: 10,
    title: {
      en: 'The Big Wedding Party',
      de: 'Die große Hochzeitsfeier',
    },
    story: {
      en: 'Everyone you love in one barn, a band, and dancing until sunrise.',
      de: 'Alle, die du liebst, in einer Scheune, eine Band und Tanzen bis zum Sonnenaufgang.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Venue and catering',
          de: 'Location und Catering',
        },
        amountMinor: 1400000,
      },
      {
        id: 'b2',
        title: {
          en: 'Band and photographer',
          de: 'Band und Fotograf',
        },
        amountMinor: 450000,
      },
      {
        id: 'b3',
        title: {
          en: 'Dress, suit, rings',
          de: 'Kleid, Anzug, Ringe',
        },
        amountMinor: 400000,
      },
      {
        id: 'b4',
        title: {
          en: 'Decoration and extras',
          de: 'Dekoration und Extras',
        },
        amountMinor: 250000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Set the guest list before the budget',
          de: 'Die Gästeliste vor dem Budget festlegen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Book venue and photographer a year ahead',
          de: 'Location und Fotograf ein Jahr vorher buchen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    requiresPartner: true,
  },
  {
    id: 'D39',
    category: 'people',
    tier: 'grand',
    totalMinor: 2000000,
    points: 9,
    title: {
      en: 'An Education Fund for Your Child',
      de: 'Ein Bildungsfonds für dein Kind',
    },
    story: {
      en: 'Whatever they want to learn one day, the money will be there.',
      de: 'Was auch immer dein Kind eines Tages lernen will, das Geld wird da sein.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Education fund',
          de: 'Ausbildungsfonds',
        },
        amountMinor: 2000000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Open a separate savings or ETF account in your name',
          de: 'Ein eigenes Spar- oder ETF-Konto auf deinen Namen eröffnen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Start small and automate it',
          de: 'Klein anfangen und es automatisieren',
        },
        priority: 'medium',
      },
    ],
    links: [],
    requiresKids: true,
  },
  {
    id: 'D40',
    category: 'people',
    tier: 'big',
    totalMinor: 450000,
    points: 4,
    title: {
      en: 'Family Reunion Abroad',
      de: 'Familientreffen im Ausland',
    },
    story: {
      en: 'Three generations, one rented villa, a week of long dinners.',
      de: 'Drei Generationen, eine gemietete Villa, eine Woche lange Abendessen.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Villa, 1 week (your share)',
          de: 'Villa, 1 Woche (dein Anteil)',
        },
        amountMinor: 250000,
      },
      {
        id: 'b2',
        title: {
          en: 'Flights',
          de: 'Flüge',
        },
        amountMinor: 100000,
      },
      {
        id: 'b3',
        title: {
          en: 'Food and activities',
          de: 'Essen und Aktivitäten',
        },
        amountMinor: 100000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Pick dates a year ahead',
          de: 'Die Termine ein Jahr vorher festlegen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Split costs fairly by household',
          de: 'Die Kosten fair nach Haushalten teilen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D41',
    category: 'create',
    tier: 'big',
    totalMinor: 400000,
    points: 4,
    title: {
      en: 'Write and Publish Your Book',
      de: 'Dein eigenes Buch schreiben und veröffentlichen',
    },
    story: {
      en: 'The story in your head for years, finally on paper — with your name on the cover.',
      de: 'Die Geschichte, die seit Jahren in deinem Kopf ist, endlich auf Papier — mit deinem Namen auf dem Cover.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Editing',
          de: 'Lektorat',
        },
        amountMinor: 180000,
      },
      {
        id: 'b2',
        title: {
          en: 'Cover design',
          de: 'Cover-Gestaltung',
        },
        amountMinor: 60000,
      },
      {
        id: 'b3',
        title: {
          en: 'Print run and ISBN',
          de: 'Auflage und ISBN',
        },
        amountMinor: 120000,
      },
      {
        id: 'b4',
        title: {
          en: 'Launch event',
          de: 'Buchpremiere',
        },
        amountMinor: 40000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Write every day, even 300 words',
          de: 'Jeden Tag schreiben, auch nur 300 Wörter',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Get a professional editor before publishing',
          de: 'Vor der Veröffentlichung ein professionelles Lektorat beauftragen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D42',
    category: 'create',
    tier: 'big',
    totalMinor: 650000,
    points: 5,
    title: {
      en: 'Record Your Own Album',
      de: 'Dein eigenes Album aufnehmen',
    },
    story: {
      en: 'Ten songs, a real studio, and your music on every streaming platform.',
      de: 'Zehn Songs, ein echtes Studio, und deine Musik auf jeder Streaming-Plattform.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Studio days',
          de: 'Studiotage',
        },
        amountMinor: 350000,
      },
      {
        id: 'b2',
        title: {
          en: 'Mixing and mastering',
          de: 'Mischung und Mastering',
        },
        amountMinor: 200000,
      },
      {
        id: 'b3',
        title: {
          en: 'Artwork and distribution',
          de: 'Artwork und Vertrieb',
        },
        amountMinor: 50000,
      },
      {
        id: 'b4',
        title: {
          en: 'Release party',
          de: 'Release-Party',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Rehearse until the songs are ready',
          de: 'Proben, bis die Songs sitzen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Record a demo first',
          de: 'Zuerst ein Demo aufnehmen',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D43',
    category: 'create',
    tier: 'life',
    totalMinor: 7500000,
    points: 17,
    title: {
      en: 'Open a Small Café',
      de: 'Ein kleines Café eröffnen',
    },
    story: {
      en: 'Your own espresso machine, regulars who know your name, cake on Sundays.',
      de: 'Deine eigene Espressomaschine, Stammgäste, die deinen Namen kennen, Kuchen am Sonntag.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Equipment and espresso machine',
          de: 'Ausstattung und Espressomaschine',
        },
        amountMinor: 2500000,
      },
      {
        id: 'b2',
        title: {
          en: 'Renovation',
          de: 'Umbau',
        },
        amountMinor: 3000000,
      },
      {
        id: 'b3',
        title: {
          en: 'Deposit and permits',
          de: 'Kaution und Genehmigungen',
        },
        amountMinor: 1200000,
      },
      {
        id: 'b4',
        title: {
          en: 'Starting stock and marketing',
          de: 'Startsortiment und Marketing',
        },
        amountMinor: 800000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Write a business plan',
          de: 'Einen Businessplan schreiben',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Work in a café first for a few months',
          de: 'Zuerst ein paar Monate in einem Café arbeiten',
        },
        priority: 'medium',
      },
    ],
    links: [],
    monthlyAfterMinor: 20000,
  },
  {
    id: 'D44',
    category: 'give',
    tier: 'big',
    totalMinor: 1100000,
    points: 9,
    title: {
      en: 'Build a School Classroom',
      de: 'Ein Klassenzimmer bauen',
    },
    story: {
      en: 'With a local partner, you fund a classroom where thirty children learn every day.',
      de: 'Mit einem lokalen Partner finanzierst du ein Klassenzimmer, in dem jeden Tag dreißig Kinder lernen.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Construction',
          de: 'Bau',
        },
        amountMinor: 800000,
      },
      {
        id: 'b2',
        title: {
          en: 'Furniture and books',
          de: 'Möbel und Bücher',
        },
        amountMinor: 150000,
      },
      {
        id: 'b3',
        title: {
          en: 'Visit the project',
          de: 'Das Projekt besuchen',
        },
        amountMinor: 150000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Choose a transparent, audited charity',
          de: 'Eine transparente, geprüfte Hilfsorganisation wählen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Ask for regular project updates',
          de: 'Um regelmäßige Projektberichte bitten',
        },
        priority: 'medium',
      },
    ],
    links: [],
    giving: true,
  },
  {
    id: 'D45',
    category: 'create',
    tier: 'big',
    totalMinor: 850000,
    points: 6,
    title: {
      en: 'A Horse of Your Own',
      de: 'Ein eigenes Pferd',
    },
    story: {
      en: 'Early mornings in the stable, rides through the fields, a friend for twenty years.',
      de: 'Frühe Morgen im Stall, Ausritte über die Felder, ein Freund für zwanzig Jahre.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Horse',
          de: 'Pferd',
        },
        amountMinor: 600000,
      },
      {
        id: 'b2',
        title: {
          en: 'Saddle and tack',
          de: 'Sattel und Zaumzeug',
        },
        amountMinor: 200000,
      },
      {
        id: 'b3',
        title: {
          en: 'Vet check',
          de: 'Tierarzt-Untersuchung',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Share a horse (Reitbeteiligung) first',
          de: 'Zuerst eine Reitbeteiligung nehmen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Budget livery, farrier and vet',
          de: 'Einstellplatz, Hufschmied und Tierarzt einplanen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    monthlyAfterMinor: 45000,
  },
  {
    id: 'D46',
    category: 'vehicles',
    tier: 'grand',
    totalMinor: 4600000,
    points: 14,
    title: {
      en: 'Your Own Sailboat',
      de: 'Dein eigenes Segelboot',
    },
    story: {
      en: 'A 30-foot yacht on the Baltic, your name on the stern.',
      de: 'Eine 30-Fuß-Yacht an der Ostsee, dein Name am Heck.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Used 30 ft yacht',
          de: 'Gebrauchte 30-Fuß-Yacht',
        },
        amountMinor: 4000000,
      },
      {
        id: 'b2',
        title: {
          en: 'Survey and refit',
          de: 'Gutachten und Überholung',
        },
        amountMinor: 400000,
      },
      {
        id: 'b3',
        title: {
          en: 'Safety gear',
          de: 'Sicherheitsausrüstung',
        },
        amountMinor: 200000,
      },
    ],
    actions: [
      {
        text: {
          en: "Sail on others' boats first",
          de: 'Zuerst auf fremden Booten segeln',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Budget berth, winter storage and maintenance',
          de: 'Liegeplatz, Winterlager und Wartung einplanen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    monthlyAfterMinor: 25000,
  },
  {
    id: 'D47',
    category: 'vehicles',
    tier: 'big',
    totalMinor: 1050000,
    points: 6,
    title: {
      en: 'A Watch for Life',
      de: 'Eine Uhr fürs Leben',
    },
    story: {
      en: "A classic dive watch you'll wear every day and one day pass on.",
      de: 'Eine klassische Taucheruhr, die du jeden Tag trägst und eines Tages weitergibst.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Watch',
          de: 'Uhr',
        },
        amountMinor: 1000000,
      },
      {
        id: 'b2',
        title: {
          en: 'Insurance and service',
          de: 'Versicherung und Service',
        },
        amountMinor: 50000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Buy from an authorised dealer',
          de: 'Beim autorisierten Händler kaufen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Insure it via household insurance',
          de: 'Über die Hausratversicherung mitversichern',
        },
        priority: 'medium',
      },
    ],
    links: [],
  },
  {
    id: 'D48',
    category: 'give',
    tier: 'big',
    totalMinor: 1100000,
    points: 9,
    title: {
      en: 'Plant a Forest',
      de: 'Einen Wald pflanzen',
    },
    story: {
      en: 'One hectare, three thousand saplings, and a forest that outlives you.',
      de: 'Ein Hektar, dreitausend Setzlinge, und ein Wald, der dich überlebt.',
    },
    buckets: [
      {
        id: 'b1',
        title: {
          en: 'Reforestation partner, 1 ha',
          de: 'Aufforstungs-Partner, 1 ha',
        },
        amountMinor: 900000,
      },
      {
        id: 'b2',
        title: {
          en: 'Planting day trip',
          de: 'Pflanztag mit Anreise',
        },
        amountMinor: 50000,
      },
      {
        id: 'b3',
        title: {
          en: 'Care, first 3 years',
          de: 'Pflege, die ersten 3 Jahre',
        },
        amountMinor: 150000,
      },
    ],
    actions: [
      {
        text: {
          en: 'Choose a certified reforestation project',
          de: 'Ein zertifiziertes Aufforstungsprojekt wählen',
        },
        priority: 'medium',
      },
      {
        text: {
          en: 'Plant with friends on a planting day',
          de: 'Mit Freunden an einem Pflanztag pflanzen',
        },
        priority: 'medium',
      },
    ],
    links: [],
    giving: true,
  },
];
