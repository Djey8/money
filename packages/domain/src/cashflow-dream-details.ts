import type { DreamCard } from './cashflow-game/dream-deck';
import type { Localized } from './cashflow-game/emergency-deck';
import { TRAVEL_DETAILS } from './cashflow-dream-details-travel';
import { DOING_DETAILS } from './cashflow-dream-details-doing';
import { LIFE_DETAILS } from './cashflow-dream-details-life';
import { MORE_TRAVEL } from './cashflow-dreams-more-travel';
import { MORE_DOING } from './cashflow-dreams-more-doing';
import { MORE_LIFE } from './cashflow-dreams-more-life';

/**
 * What a dream tells once it is a project (JFK, 2026-11-04): a description of what you need, a note and links for every bucket, links to
 * relevant pages, a few short action items and at most three notes in all. The cards in `cashflow-dream-cards.ts` hold the name, the
 * story, the buckets and the price; this holds the detail, so a project that is created from a card has everything filled in. The
 * facts are realistic and hedged ("about") - prices change, the links lead to official or well-known pages, not to offers.
 */

interface Link {
  label: Localized;
  url: string;
}

export interface DreamDetails {
  /** What the dream is and what it takes, in a few sentences (more than the story). */
  description?: Localized;
  /** Per bucket: what it is, what is realistic, where to look. */
  buckets?: Record<string, { notes?: Localized; links?: Link[] }>;
  /** Pages that help with the whole dream; added to the card's own links. */
  links?: Link[];
  /** Replaces the card's action items: a few short steps. */
  actions?: DreamCard['actions'];
  /** Notes besides the card's own `stat`: two at most, so a project has three. */
  notes?: Localized[];
}

const l = (en: string, de: string): Localized => ({ en, de });
const link = (en: string, de: string, url: string): Link => ({ label: l(en, de), url });
const step = (
  en: string,
  de: string,
  priority: 'low' | 'medium' | 'high' = 'medium',
): DreamCard['actions'][number] => ({ text: l(en, de), priority });

const FIRST_DETAILS: Record<string, DreamDetails> = {
  D01: {
    description: l(
      'Rome in four nights: the Colosseum, the Forum and the Palatine Hill share one ticket that is valid for a day. Book a timed slot online, add the Vatican and a few trattorias, and four nights are plenty. It is the cheapest "wonder of the world" for most Europeans.',
      'Rom in vier Nächten: Kolosseum, Forum Romanum und Palatin teilen sich ein Ticket, das einen Tag gilt. Buch ein Zeitfenster online, nimm den Vatikan und ein paar Trattorien dazu, dann reichen vier Nächte. Für die meisten Europäer ist es das günstigste "Weltwunder".',
    ),
    buckets: {
      b1: {
        notes: l(
          'Rome is a low-cost hub: from central Europe a return flight often costs 80–200 €. Spring and autumn are cheapest; book six to ten weeks ahead.',
          'Rom ist ein Billigflug-Ziel: aus Mitteleuropa kostet der Hin- und Rückflug oft 80–200 €. Frühjahr und Herbst sind am günstigsten; sechs bis zehn Wochen vorher buchen.',
        ),
        links: [
          link(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      },
      b2: {
        notes: l(
          'A simple three-star near Termini or Monti costs about 90–150 € a night in spring or autumn. The city tax (a few euros per person and night) is paid at the hotel.',
          'Ein einfaches Dreisternehotel nahe Termini oder Monti kostet im Frühjahr oder Herbst etwa 90–150 € pro Nacht. Die Citytax (ein paar Euro pro Person und Nacht) zahlst du im Hotel.',
        ),
        links: [
          link(
            'Rome tourism – where to stay',
            'Rom Tourismus – wo übernachten',
            'https://www.turismoroma.it/en',
          ),
        ],
      },
      b3: {
        notes: l(
          'The Colosseum, Forum and Palatine ticket is about 18–24 € and names the visitor. A guided underground tour costs 50–80 €; a carbonara 12–16 €.',
          'Das Ticket für Kolosseum, Forum und Palatin kostet etwa 18–24 € und ist personalisiert. Eine Führung durch die Katakomben kostet 50–80 €; eine Carbonara 12–16 €.',
        ),
        links: [
          link(
            'Colosseum – official tickets',
            'Kolosseum – offizielle Tickets',
            'https://parcocolosseo.it/en/',
          ),
        ],
      },
    },
    links: [link('Rome tourism', 'Rom Tourismus', 'https://www.turismoroma.it/en')],
    actions: [
      step(
        'Book a timed Colosseum slot online weeks ahead',
        'Kolosseum-Zeitfenster Wochen vorher online buchen',
        'high',
      ),
      step(
        'Check that your passport or ID is valid',
        'Prüfen, ob Reisepass oder Ausweis gültig ist',
      ),
      step(
        'Travel in spring or autumn: cheaper and not so hot',
        'Im Frühjahr oder Herbst reisen: günstiger und nicht so heiß',
        'low',
      ),
    ],
    notes: [
      l(
        'The ticket carries a name: take your ID to the entrance.',
        'Das Ticket ist personalisiert: nimm deinen Ausweis zum Eingang mit.',
      ),
      l('Closed on 25 December and 1 January.', 'Am 25. Dezember und am 1. Januar geschlossen.'),
    ],
  },

  D10: {
    description: l(
      'Two weeks in Japan when the cherry trees bloom - Tokyo, Kyoto, Osaka and a quieter stop such as Kanazawa or Hiroshima. The blossom is at its best for about a week, in late March to early April around Tokyo and Kyoto, so flights and hotels are booked months ahead. Most visitors from Europe need no visa for a stay of up to 90 days.',
      'Zwei Wochen in Japan zur Kirschblüte - Tokio, Kyoto, Osaka und ein ruhigerer Halt wie Kanazawa oder Hiroshima. Die Blüte ist nur etwa eine Woche auf ihrem Höhepunkt, Ende März bis Anfang April um Tokio und Kyoto; Flüge und Hotels werden deshalb Monate vorher gebucht. Die meisten Besucher aus Europa brauchen für bis zu 90 Tage kein Visum.',
    ),
    buckets: {
      b1: {
        notes: l(
          'Return flights from Europe cost about 750–1,300 €, direct or with one stop; the cherry blossom weeks are the dearest. Avoid Golden Week (end of April).',
          'Hin- und Rückflüge ab Europa kosten etwa 750–1.300 €, direkt oder mit einem Stopp; die Kirschblütenwochen sind am teuersten. Die Golden Week (Ende April) meiden.',
        ),
        links: [
          link(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      },
      b2: {
        notes: l(
          'Business hotels cost about 70–120 € a night; a ryokan with dinner and breakfast 150–400 € per person - plan one or two as a treat. In blossom season book four to six months ahead.',
          'Businesshotels kosten etwa 70–120 € pro Nacht; ein Ryokan mit Abendessen und Frühstück 150–400 € pro Person - plane ein oder zwei als Genuss ein. Zur Blütezeit vier bis sechs Monate vorher buchen.',
        ),
      },
      b3: {
        notes: l(
          'Tokyo to Kyoto by Shinkansen is about 14,000 yen one way. The 7-day rail pass costs about 50,000 yen: it only pays if you ride several long legs. A Suica or ICOCA card pays city trains and buses.',
          'Tokio-Kyoto im Shinkansen kostet etwa 14.000 Yen pro Strecke. Der 7-Tage-Railpass kostet rund 50.000 Yen: er lohnt sich nur bei mehreren langen Strecken. Mit einer Suica- oder ICOCA-Karte bezahlst du Stadtbahnen und Busse.',
        ),
        links: [
          link(
            'Japan Rail Pass – prices',
            'Japan Rail Pass – Preise',
            'https://japanrailpass.net/en/',
          ),
        ],
      },
      b4: {
        notes: l(
          'Convenience-store breakfast 3–5 €, a bowl of ramen 8–12 €, a sushi dinner 40–80 €. Food is good at every price; plan about 60–80 € a day for food and sights.',
          'Frühstück im Konbini 3–5 €, eine Schüssel Ramen 8–12 €, ein Sushi-Abendessen 40–80 €. Essen ist auf jeder Preisstufe gut; plane etwa 60–80 € pro Tag für Essen und Eintritte.',
        ),
      },
    },
    links: [
      link(
        'Japan Guide – cherry blossom forecast',
        'Japan Guide – Kirschblüten-Prognose',
        'https://www.japan-guide.com/e/e2011.html',
      ),
      link(
        'Japan National Tourism Organization',
        'Japanische Zentrale für Tourismus',
        'https://www.japan.travel/en/',
      ),
    ],
    actions: [
      step(
        'Check the blossom forecast and fix the dates',
        'Blütenprognose prüfen und die Reisedaten festlegen',
        'high',
      ),
      step(
        'Book the first and last hotels four to six months ahead',
        'Erstes und letztes Hotel vier bis sechs Monate vorher buchen',
      ),
      step(
        'Compare a rail pass with single Shinkansen tickets',
        'Railpass mit einzelnen Shinkansen-Tickets vergleichen',
      ),
      step('Get a mobile data plan or an eSIM', 'Mobilfunk-Datentarif oder eSIM besorgen', 'low'),
    ],
    notes: [
      l(
        'Take cash: many small places in Japan do not take foreign cards.',
        'Nimm Bargeld mit: viele kleine Läden in Japan nehmen keine ausländischen Karten.',
      ),
      l(
        'Pack light: trains have little luggage space, and hotels forward luggage cheaply.',
        'Pack leicht: in den Zügen ist wenig Platz für Gepäck, und Hotels schicken es günstig weiter.',
      ),
    ],
  },

  D09: {
    description: l(
      'Six days across the Serengeti by jeep, sleeping in lodges or tented camps: lions, elephants, giraffes and, depending on the month, the great wildebeest migration. The best time is June to October for the river crossings in the north and January to March for the calving in the south. Go with an operator that has its own permits and pays its guides fairly.',
      'Sechs Tage im Geländewagen durch die Serengeti, geschlafen wird in Lodges oder Zeltcamps: Löwen, Elefanten, Giraffen und je nach Monat die große Gnu-Wanderung. Die beste Zeit ist Juni bis Oktober für die Flussüberquerungen im Norden und Januar bis März für die Geburten im Süden. Reise mit einem Veranstalter, der eigene Genehmigungen hat und seine Guides fair bezahlt.',
    ),
    buckets: {
      b1: {
        notes: l(
          'Fly to Kilimanjaro (JRO) or Arusha; return flights from Europe cost about 700–1,200 €. The safari usually starts from Arusha.',
          'Flieg nach Kilimandscharo (JRO) oder Arusha; Hin- und Rückflüge ab Europa kosten etwa 700–1.200 €. Die Safari startet meist in Arusha.',
        ),
      },
      b2: {
        notes: l(
          'Mid-range lodges and tented camps with all meals and a jeep with a driver-guide cost about 500–700 € per person and day; the sum here is for six days. A small group shares the jeep.',
          'Lodges und Zeltcamps der Mittelklasse mit Vollpension und Geländewagen mit Fahrer-Guide kosten etwa 500–700 € pro Person und Tag; die Summe hier gilt für sechs Tage. In einer kleinen Gruppe teilt man sich den Wagen.',
        ),
        links: [
          link(
            'Tanzania National Parks',
            'Tansanias Nationalparks',
            'https://www.tanzaniaparks.go.tz/',
          ),
        ],
      },
      b3: {
        notes: l(
          'The park fees are about 70–80 US$ per adult and day in the Serengeti, and a tourist visa about 50 US$. Many operators include the park fees: ask what is in the price.',
          'Die Parkgebühren in der Serengeti liegen bei etwa 70–80 US$ pro Erwachsenem und Tag, ein Touristenvisum kostet rund 50 US$. Viele Veranstalter schließen die Parkgebühren ein: frag, was im Preis steckt.',
        ),
      },
      b4: {
        notes: l(
          'Yellow fever proof is needed when you arrive from an endemic country. Malaria is present: see a travel doctor six to eight weeks ahead about prophylaxis.',
          'Ein Gelbfieber-Nachweis ist nötig, wenn du aus einem Endemiegebiet einreist. Malaria kommt vor: lass dich sechs bis acht Wochen vorher beim Tropenarzt zur Prophylaxe beraten.',
        ),
        links: [
          link(
            'CDC – health advice for Tanzania',
            'CDC – Gesundheitshinweise Tansania',
            'https://wwwnc.cdc.gov/travel/destinations/traveler/none/tanzania',
          ),
        ],
      },
      b5: {
        notes: l(
          'Tips are expected: about 15–25 US$ a day for the driver-guide and 5–10 US$ for camp staff, per group. Bring cash in small bills.',
          'Trinkgeld wird erwartet: etwa 15–25 US$ pro Tag für den Fahrer-Guide und 5–10 US$ für das Camp-Personal, pro Gruppe. Nimm Bargeld in kleinen Scheinen mit.',
        ),
      },
    },
    links: [
      link(
        'Tanzania Tourism Board',
        'Tansanische Tourismusbehörde',
        'https://www.tanzaniatourism.go.tz/',
      ),
    ],
    actions: [
      step(
        'Pick the season by where the migration is',
        'Die Jahreszeit nach dem Ort der Gnu-Wanderung wählen',
        'high',
      ),
      step(
        'Ask two or three operators what is in the price',
        'Bei zwei, drei Veranstaltern nachfragen, was im Preis steckt',
      ),
      step(
        'See a travel doctor about vaccinations and malaria',
        'Beim Tropenarzt Impfungen und Malaria-Prophylaxe besprechen',
        'high',
      ),
      step(
        'Check that your passport is valid for six months',
        'Prüfen, ob der Reisepass noch sechs Monate gültig ist',
      ),
    ],
    notes: [
      l(
        'Book the jeep with a pop-up roof: you stand to photograph.',
        'Buch einen Wagen mit Aufstelldach: so kannst du im Stehen fotografieren.',
      ),
      l(
        'Dawn and dusk are the best hours for animals - sleep inside the park, not outside it.',
        'Morgen- und Abenddämmerung sind die besten Stunden für Tiere - schlaf im Park, nicht außerhalb.',
      ),
    ],
  },

  D16: {
    description: l(
      'Kilimanjaro is the highest mountain of Africa, 5,895 metres, and can be climbed without ropes - but the altitude is hard. A route of seven or eight days gives the body time to adapt and brings far more people to the top than a short one. You need a licensed operator (the guides and porters are required), good boots and layers, and three months of regular hill walking.',
      'Der Kilimandscharo ist mit 5.895 Metern der höchste Berg Afrikas und ohne Seil zu besteigen - doch die Höhe ist hart. Eine Route von sieben oder acht Tagen gibt dem Körper Zeit zur Anpassung und bringt viel mehr Menschen zum Gipfel als eine kurze. Du brauchst einen lizenzierten Veranstalter (Guides und Träger sind Pflicht), gute Stiefel, Schichten und drei Monate regelmäßiges Bergwandern.',
    ),
    buckets: {
      b1: {
        notes: l(
          'A seven-day route (Lemosho or Machame) with guides, porters, food, tents and park fees costs about 1,600–2,200 € at fair operators. Very cheap offers often underpay the crew.',
          'Eine Sieben-Tage-Route (Lemosho oder Machame) mit Guides, Trägern, Verpflegung, Zelten und Parkgebühren kostet bei fairen Veranstaltern etwa 1.600–2.200 €. Sehr billige Angebote bezahlen die Crew oft schlecht.',
        ),
        links: [
          link(
            'Kilimanjaro Porters Assistance Project – fair operators',
            'Kilimanjaro Porters Assistance Project – faire Veranstalter',
            'https://kiliporters.org/',
          ),
        ],
      },
      b2: {
        notes: l(
          'Fly to Kilimanjaro airport (JRO); a return flight from Europe costs about 700–1,200 €.',
          'Flieg zum Kilimandscharo-Flughafen (JRO); der Hin- und Rückflug ab Europa kostet etwa 700–1.200 €.',
        ),
      },
      b3: {
        notes: l(
          'Boots that are worn in, a down jacket, waterproof layers, gloves and a good sleeping bag are the core. Much can be rented in Moshi for little. Do not buy boots just before the trip.',
          'Eingelaufene Stiefel, eine Daunenjacke, wasserdichte Schichten, Handschuhe und ein guter Schlafsack sind das Wichtigste. Vieles kann in Moshi günstig gemietet werden. Kauf Stiefel nicht kurz vor der Reise.',
        ),
      },
      b4: {
        notes: l(
          'The crew lives from tips: guidelines are about 20–25 US$ a day for the lead guide and about 10 US$ a day for each porter, shared out by the group. Plan about 300–500 € per person.',
          'Die Crew lebt vom Trinkgeld: Richtwerte sind etwa 20–25 US$ pro Tag für den Hauptguide und rund 10 US$ pro Tag für jeden Träger, vom Team aufgeteilt. Plane etwa 300–500 € pro Person.',
        ),
      },
      b5: {
        notes: l(
          'Insurance must cover trekking up to 6,000 metres and a helicopter rescue. A night before and after the climb in Moshi is included here.',
          'Die Versicherung muss Trekking bis 6.000 Meter und eine Hubschrauberbergung abdecken. Eine Nacht vor und nach der Besteigung in Moshi ist hier eingerechnet.',
        ),
        links: [
          link(
            'CDC – health advice for Tanzania',
            'CDC – Gesundheitshinweise Tansania',
            'https://wwwnc.cdc.gov/travel/destinations/traveler/none/tanzania',
          ),
        ],
      },
    },
    links: [
      link(
        'Tanzania National Parks – Kilimanjaro',
        'Tansanias Nationalparks – Kilimandscharo',
        'https://www.tanzaniaparks.go.tz/',
      ),
    ],
    actions: [
      step(
        'Choose a route of seven days or more',
        'Eine Route von sieben Tagen oder mehr wählen',
        'high',
      ),
      step(
        'Walk hills for three months, with a loaded pack',
        'Drei Monate Berge wandern, mit gefülltem Rucksack',
      ),
      step('Ask your doctor about altitude sickness', 'Den Arzt zur Höhenkrankheit fragen', 'high'),
      step(
        'Check that the operator pays its crew fairly',
        'Prüfen, ob der Veranstalter seine Crew fair bezahlt',
      ),
    ],
    notes: [
      l(
        '"Pole pole" - slowly, slowly: the guides set the pace, and that is why you arrive.',
        '"Pole pole" - langsam, langsam: die Guides bestimmen das Tempo, und deshalb kommst du an.',
      ),
    ],
  },

  D24: {
    description: l(
      'The private pilot licence (PPL) lets you fly a small aircraft with passengers in daylight. In Europe it takes at least 45 hours of flying (including solo flights and a cross-country), a theory course with an exam, a radio licence and a class 2 medical. Most students need 55 to 70 hours. Start with a trial lesson, and get the medical before you pay for the course.',
      'Der Privatpilotenschein (PPL) erlaubt dir, ein kleines Flugzeug bei Tag mit Passagieren zu fliegen. In Europa braucht er mindestens 45 Flugstunden (mit Alleinflügen und einem Überlandflug), einen Theoriekurs mit Prüfung, ein Funkzeugnis und ein Tauglichkeitszeugnis Klasse 2. Die meisten brauchen 55 bis 70 Stunden. Fang mit einem Schnupperflug an und mach die Untersuchung, bevor du den Kurs bezahlst.',
    ),
    buckets: {
      b1: {
        notes: l(
          'A single-engine trainer with an instructor costs about 220–300 € per flight hour, with the landing and the use of the plane. Fly often: gaps cost extra hours.',
          'Ein einmotoriges Schulflugzeug mit Fluglehrer kostet etwa 220–300 € pro Flugstunde, mit Landung und Flugzeugnutzung. Flieg oft: Pausen kosten zusätzliche Stunden.',
        ),
      },
      b2: {
        notes: l(
          'Nine theory subjects with an exam at the authority, about 600–1,000 € for a course; the radio licence (restricted) takes a few days.',
          'Neun Theoriefächer mit Prüfung bei der Behörde, etwa 600–1.000 € für einen Kurs; das beschränkte Funkzeugnis dauert wenige Tage.',
        ),
        links: [
          link(
            'EASA – general aviation',
            'EASA – Allgemeine Luftfahrt',
            'https://www.easa.europa.eu/en/domains/general-aviation',
          ),
        ],
      },
      b3: {
        notes: l(
          'Landing fees and air traffic control charges add up on every flight, more at big airports. A small airfield saves money.',
          'Landegebühren und Flugsicherungsentgelte kommen bei jedem Flug dazu, an großen Flughäfen mehr. Ein kleiner Flugplatz spart Geld.',
        ),
      },
      b4: {
        notes: l(
          'The class 2 medical by an aeromedical examiner costs about 150–250 €; exam and authority fees add a few hundred.',
          'Das Tauglichkeitszeugnis Klasse 2 beim Fliegerarzt kostet etwa 150–250 €; Prüfungs- und Behördengebühren kommen mit einigen hundert Euro dazu.',
        ),
      },
      b5: {
        notes: l(
          'A headset (200–1,000 €), charts, a kneeboard and a logbook. A good headset is worth it: you wear it for hours.',
          'Ein Headset (200–1.000 €), Karten, ein Kniebrett und ein Logbuch. Ein gutes Headset lohnt sich: du trägst es stundenlang.',
        ),
        links: [
          link(
            'AOPA – become a pilot',
            'AOPA – Pilot werden',
            'https://www.aopa.org/become-a-pilot',
          ),
        ],
      },
    },
    actions: [
      step('Do a trial lesson first', 'Zuerst einen Schnupperflug machen', 'high'),
      step(
        'Get the class 2 medical before you pay for the course',
        'Das Tauglichkeitszeugnis Klasse 2 holen, bevor du den Kurs bezahlst',
        'high',
      ),
      step(
        'Compare two or three flight schools: price per hour, fleet, location',
        'Zwei, drei Flugschulen vergleichen: Preis je Stunde, Flotte, Standort',
      ),
      step(
        'Plan to fly once or twice a week',
        'Plane ein- bis zweimal pro Woche zu fliegen',
        'low',
      ),
    ],
    notes: [
      l(
        'Ask the school for the total price for 45, 55 and 70 hours, not only the hourly rate.',
        'Frag die Schule nach dem Gesamtpreis für 45, 55 und 70 Stunden, nicht nur nach dem Stundensatz.',
      ),
    ],
  },

  D29: {
    description: l(
      'A motorbike licence and your first bike. In Germany the unrestricted class A is open from 24 years, or from 20 after two years on class A2; the driving school asks for theory, practical lessons and special trips. A used bike of two or three years is the sensible start, and good gear is not an extra - it is the first thing you buy.',
      'Ein Motorradführerschein und dein erstes Motorrad. In Deutschland ist die unbeschränkte Klasse A ab 24 Jahren offen, oder ab 20 nach zwei Jahren Klasse A2; die Fahrschule verlangt Theorie, Übungsstunden und Sonderfahrten. Ein gebrauchtes Motorrad von zwei, drei Jahren ist der vernünftige Anfang, und gute Kleidung ist kein Extra - sie ist das Erste, was du kaufst.',
    ),
    buckets: {
      b1: {
        notes: l(
          'A class A licence costs about 2,000–3,500 € at a driving school, with the theory fee, the special trips and the exams. Prices differ a lot: ask for a full price in writing.',
          'Der Führerschein Klasse A kostet in der Fahrschule etwa 2.000–3.500 € mit Theoriegebühr, Sonderfahrten und Prüfungen. Die Preise unterscheiden sich stark: lass dir einen Gesamtpreis schriftlich geben.',
        ),
      },
      b2: {
        notes: l(
          'A used mid-range bike (600–900 cc) from a dealer costs about 4,500–9,000 €. Have a mechanic check it, and look at the tyres, the chain and the service book.',
          'Ein gebrauchtes Motorrad der Mittelklasse (600–900 ccm) vom Händler kostet etwa 4.500–9.000 €. Lass es von einem Mechaniker prüfen und schau auf Reifen, Kette und Scheckheft.',
        ),
      },
      b3: {
        notes: l(
          'Helmet 250–600 €, jacket and trousers with armour 400–900 €, gloves and boots 200–400 €. Do not save on helmet and boots.',
          'Helm 250–600 €, Jacke und Hose mit Protektoren 400–900 €, Handschuhe und Stiefel 200–400 €. Spar nicht an Helm und Stiefeln.',
        ),
      },
    },
    actions: [
      step(
        'Ask three driving schools for a full price',
        'Bei drei Fahrschulen nach dem Gesamtpreis fragen',
        'high',
      ),
      step(
        'Start with a used bike, not a new one',
        'Mit einem gebrauchten Motorrad anfangen, nicht mit einem neuen',
      ),
      step(
        'Budget insurance, tax and the yearly service',
        'Versicherung, Steuer und die jährliche Inspektion einplanen',
      ),
      step('Buy gear before the bike', 'Die Kleidung vor dem Motorrad kaufen', 'low'),
    ],
    notes: [
      l(
        'Insurance for a seasonal plate (March to October) costs less than a full year.',
        'Die Versicherung mit Saisonkennzeichen (März bis Oktober) kostet weniger als ein ganzes Jahr.',
      ),
      l(
        'A bike costs money every month after you have it: the game adds the running costs.',
        'Ein Motorrad kostet nach dem Kauf jeden Monat Geld: das Spiel rechnet die laufenden Kosten dazu.',
      ),
    ],
  },

  D34: {
    description: l(
      'A flat of your own to live in. The rule of thumb: 20 % of the price as your own money, and about 8–12 % on top for the purchase tax, the notary, the land registry and sometimes an agent. The bank lends the rest on a long loan, and the monthly payment (interest and repayment) has to fit into your budget with room for repairs. Compare it with renting before you sign.',
      'Eine eigene Wohnung zum Wohnen. Die Faustregel: 20 % des Preises als Eigenkapital und etwa 8–12 % obendrauf für Grunderwerbsteuer, Notar, Grundbuch und manchmal den Makler. Die Bank leiht den Rest auf einem langen Kredit, und die monatliche Rate (Zins und Tilgung) muss mit Platz für Reparaturen in dein Budget passen. Vergleiche mit dem Mieten, bevor du unterschreibst.',
    ),
    buckets: {
      b1: {
        notes: l(
          'The down payment is your own money: banks want about 20 % of the price, and the less you bring the dearer the loan. This is the long part of the dream.',
          'Die Anzahlung ist dein eigenes Geld: Banken wollen etwa 20 % des Preises, und je weniger du mitbringst, desto teurer wird der Kredit. Das ist der lange Teil des Traums.',
        ),
      },
      b2: {
        notes: l(
          'Purchase tax is 3.5–6.5 % by state, notary and land registry about 2 %, and an agent up to about 3.6 % for the buyer. Add them up before you look at flats.',
          'Die Grunderwerbsteuer beträgt je nach Land 3,5–6,5 %, Notar und Grundbuch etwa 2 %, ein Makler bis zu rund 3,6 % für den Käufer. Rechne sie zusammen, bevor du dir Wohnungen ansiehst.',
        ),
        links: [
          link(
            'Verbraucherzentrale – consumer advice',
            'Verbraucherzentrale – Verbraucherberatung',
            'https://www.verbraucherzentrale.de/',
          ),
        ],
      },
      b3: {
        notes: l(
          'Move, a kitchen, floors, lamps and furniture: a few thousand euros. Look at the building association account too: the monthly house fee is a running cost.',
          'Umzug, Küche, Böden, Lampen und Möbel: einige tausend Euro. Schau auch auf die Rücklage der Eigentümergemeinschaft: das monatliche Hausgeld ist eine laufende Ausgabe.',
        ),
      },
    },
    actions: [
      step('Get a mortgage pre-approval', 'Eine Finanzierungszusage vorab einholen', 'high'),
      step(
        'Compare buying and renting for your city',
        'Kaufen und Mieten für deine Stadt vergleichen',
      ),
      step(
        'Ask for the building association minutes of the last three years',
        'Die Protokolle der Eigentümerversammlungen der letzten drei Jahre ansehen',
      ),
      step(
        'Plan a reserve for repairs: about 1 % of the price a year',
        'Eine Reserve für Reparaturen einplanen: etwa 1 % des Preises pro Jahr',
        'low',
      ),
    ],
    notes: [
      l(
        'The monthly payment should stay below about a third of your net income.',
        'Die monatliche Rate sollte unter etwa einem Drittel deines Nettoeinkommens bleiben.',
      ),
    ],
  },

  D41: {
    description: l(
      'A book that is written, edited and in your hands. Writing it is the dream; the rest is craft you can buy: an editor who tightens it, a cover that sells it and a way to print it. With print on demand you need no stock, and an ISBN makes it a real book that shops can order. Plan the launch like a small project.',
      'Ein Buch, das geschrieben, lektoriert und in deinen Händen ist. Das Schreiben ist der Traum; der Rest ist Handwerk, das du kaufen kannst: ein Lektorat, das es strafft, ein Cover, das es verkauft, und ein Weg zum Drucken. Mit Print on Demand brauchst du kein Lager, und eine ISBN macht es zum echten Buch, das Buchhandlungen bestellen können. Plane den Start wie ein kleines Projekt.',
    ),
    buckets: {
      b1: {
        notes: l(
          'A copy edit of a 70,000-word novel costs about 1,000–2,500 €, a developmental edit more. Ask for a sample edit of a few pages first.',
          'Ein Lektorat für einen Roman mit 70.000 Wörtern kostet etwa 1.000–2.500 €, ein inhaltliches Lektorat mehr. Lass dir vorab ein paar Seiten Probelektorat geben.',
        ),
        links: [
          link(
            'Reedsy – self-publishing guide',
            'Reedsy – Leitfaden zum Selbstverlag',
            'https://reedsy.com/blog/guide/self-publishing/',
          ),
        ],
      },
      b2: {
        notes: l(
          'A cover by a professional designer costs about 300–900 €. It is the first thing a reader sees: look at the covers in your genre.',
          'Ein Cover von einer Designerin oder einem Designer kostet etwa 300–900 €. Es ist das Erste, was Leser sehen: sieh dir die Cover in deinem Genre an.',
        ),
      },
      b3: {
        notes: l(
          'Print on demand through Kindle Direct Publishing needs no print run. An offset run of 500 copies costs about 1–3 € a copy. An ISBN pack is cheaper than a single one.',
          'Print on Demand über Kindle Direct Publishing braucht keine Auflage. Eine Offset-Auflage von 500 Exemplaren kostet etwa 1–3 € pro Exemplar. Ein ISBN-Paket ist günstiger als eine einzelne.',
        ),
        links: [
          link('Kindle Direct Publishing', 'Kindle Direct Publishing', 'https://kdp.amazon.com/'),
          link(
            'International ISBN Agency',
            'Internationale ISBN-Agentur',
            'https://www.isbn-international.org/',
          ),
        ],
      },
      b4: {
        notes: l(
          'A reading in a bookshop or a café: a room, a few posters and friends. It costs little and the book needs the first readers.',
          'Eine Lesung in einer Buchhandlung oder einem Café: ein Raum, ein paar Plakate und Freunde. Sie kostet wenig, und das Buch braucht die ersten Leser.',
        ),
      },
    },
    actions: [
      step('Write every day, even 300 words', 'Jeden Tag schreiben, auch nur 300 Wörter', 'high'),
      step('Get a sample edit from two editors', 'Von zwei Lektoren ein Probelektorat einholen'),
      step('Decide: print on demand or a print run', 'Entscheiden: Print on Demand oder Auflage'),
      step(
        'Ask ten readers for honest feedback before the edit',
        'Zehn Leser vor dem Lektorat um ehrliches Feedback bitten',
        'low',
      ),
    ],
    notes: [
      l(
        'Most books sell a few dozen copies: the dream is the book, not the income.',
        'Die meisten Bücher verkaufen sich einige Dutzend Mal: der Traum ist das Buch, nicht das Einkommen.',
      ),
    ],
  },
};

/** Every dream's detail: the first eight written one by one, the rest by theme. */
export const DREAM_DETAILS: Record<string, DreamDetails> = {
  ...FIRST_DETAILS,
  ...TRAVEL_DETAILS,
  ...DOING_DETAILS,
  ...LIFE_DETAILS,
  ...MORE_TRAVEL.details,
  ...MORE_DOING.details,
  ...MORE_LIFE.details,
};

/** The cards with their detail: links are added, action items and the notes are those of the detail where it has them. */
export function withDreamDetails(cards: DreamCard[]): DreamCard[] {
  return cards.map((card) => {
    const detail = DREAM_DETAILS[card.id];
    if (!detail) return card;
    return {
      ...card,
      ...(detail.description ? { description: detail.description } : {}),
      buckets: card.buckets.map((bucket) => ({
        ...bucket,
        ...(detail.buckets?.[bucket.id] ?? {}),
      })),
      links: [...card.links, ...(detail.links ?? [])],
      actions: detail.actions ?? card.actions,
      ...(detail.notes ? { notes: detail.notes.slice(0, 2) } : {}),
    };
  });
}
