import type { CashflowDreamProject } from './cashflow-game/types';

/**
 * The detail of the life dreams (JFK, 2026-11-04): every character's dream is as rich as the mountain guide of the dual student -
 * what the way looks like, a note for every bucket, links to pages that help, a list of steps and what is good to know. The
 * characters in `cashflow-professions-dreamfund.ts` hold the name, the buckets and the price; this holds the rest. The facts are
 * realistic and hedged ("about"): the amounts of the game are estimates, the links lead to official or well-known pages.
 */

type Lang = 'en' | 'de';
type Pair = { en: string; de: string };
interface Link {
  label: Pair;
  url: string;
}
interface Details {
  description: Pair;
  /** Per bucket: the note (replaces the character's own) and the links. */
  buckets: Record<string, { notes: Pair; links?: Link[] }>;
  links: Link[];
  actions: { text: Pair; priority: 'low' | 'medium' | 'high' }[];
  notes: Pair[];
}

const p = (en: string, de: string): Pair => ({ en, de });
const link = (en: string, de: string, url: string): Link => ({ label: p(en, de), url });
const step = (
  en: string,
  de: string,
  priority: 'low' | 'medium' | 'high' = 'medium',
): Details['actions'][number] => ({ text: p(en, de), priority });

export const LIFE_DREAM_DETAILS: Record<string, Details> = {
  'mehmet-elektroniker': {
    description: p(
      "The way from journeyman to boss in the electrical trade: the master school in two parts - the craft first (the practical and the technical part), then business, law and the trainer licence - the exams of the chamber of crafts with the master project, and then the founding itself: registering the business, being entered in the grid operator's list of installers, insurance, the first measuring devices and a used van. The master certificate is what the law asks for to run an electrical business, and the state helps pay for the school. Every bucket is one step; the project is done when all of them are full.",
      'Der Weg vom Gesellen zum Chef im Elektrohandwerk: die Meisterschule in zwei Teilen - zuerst das Handwerk (der praktische und der fachtheoretische Teil), dann Betriebswirtschaft, Recht und Ausbildereignung - die Prüfungen der Handwerkskammer mit dem Meisterprojekt, und dann die Gründung selbst: Gewerbeanmeldung, Eintrag ins Installateurverzeichnis des Netzbetreibers, Versicherungen, die ersten Messgeräte und ein gebrauchter Transporter. Der Meisterbrief ist das, was das Gesetz für einen Elektrobetrieb verlangt, und der Staat hilft bei den Kosten der Schule. Jeder Topf ist ein Schritt; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      school12: {
        notes: p(
          'Parts I and II (the practical and the technical part) take about six months full-time or two years in the evenings and on Saturdays. Course fees of roughly 6,000-12,000 in real life; the state upgrading support (Aufstiegs-BAföG) pays about half of the fees as a grant and lends the rest on good terms. Ask three schools for a full price.',
          'Teil I und II (der praktische und der fachtheoretische Teil) dauern etwa sechs Monate in Vollzeit oder zwei Jahre abends und samstags. Kursgebühren von grob 6.000-12.000 im echten Leben; das Aufstiegs-BAföG zahlt etwa die Hälfte der Gebühren als Zuschuss und leiht den Rest zu guten Bedingungen. Frag drei Schulen nach dem Gesamtpreis.',
        ),
        links: [
          link(
            'Handwerk: the master school (ZDH)',
            'Handwerk: die Meisterschule (ZDH)',
            'https://www.zdh.de/',
          ),
        ],
      },
      school34: {
        notes: p(
          'Part III (business) and part IV (the trainer licence, AEVO) are the same for every craft, so they can be taken at any chamber and often online. About 1,000-2,500 in real life, and also supported by the upgrading grant.',
          'Teil III (Betriebswirtschaft) und Teil IV (die Ausbildereignung, AEVO) sind für jedes Handwerk gleich, deshalb geht das bei jeder Kammer und oft online. Etwa 1.000-2.500 im echten Leben, ebenfalls mit Aufstiegs-Zuschuss.',
        ),
      },
      exam: {
        notes: p(
          'The chamber of crafts sets the exam fees (about 600-1,500 for the parts I and II) and the master project - a real installation or a plan that you build or work out and defend before the board. The material can cost a few hundred to 2,000.',
          'Die Handwerkskammer legt die Prüfungsgebühren fest (etwa 600-1.500 für Teil I und II) und das Meisterprojekt - eine echte Anlage oder ein Plan, den du baust oder ausarbeitest und vor dem Ausschuss verteidigst. Das Material kann einige hundert bis 2.000 kosten.',
        ),
      },
      founding: {
        notes: p(
          'The trade registration costs about 20-60, the chamber entry follows, and a liability insurance for the business about 300-900 a year. An electrician must also be entered in the list of installers of the grid operator, which asks for the master certificate and proof of insurance.',
          'Die Gewerbeanmeldung kostet etwa 20-60, danach folgt der Kammereintrag, und eine Betriebshaftpflicht kostet etwa 300-900 im Jahr. Ein Elektriker muss außerdem ins Installateurverzeichnis des Netzbetreibers eingetragen sein, das den Meisterbrief und den Versicherungsnachweis verlangt.',
        ),
        links: [
          link(
            "Founders' platform of the state",
            'Gründerplattform des Bundes',
            'https://www.existenzgruender.de/',
          ),
        ],
      },
      tools: {
        notes: p(
          'The safety checks of installations need a tester that measures loop impedance, insulation and the residual-current switch: about 1,500-4,000 new, and it must be calibrated every year or two. Add installation tools, a cable finder and a voltage tester.',
          'Die Sicherheitsprüfungen von Anlagen brauchen ein Prüfgerät für Schleifenimpedanz, Isolation und Fehlerstromschutzschalter: etwa 1.500-4.000 neu, und es muss alle ein bis zwei Jahre kalibriert werden. Dazu Installationswerkzeug, ein Leitungssucher und ein Spannungsprüfer.',
        ),
      },
      van: {
        notes: p(
          'A used panel van of about three years with shelves and a roof rack costs about 12,000-22,000 in real life. Look at the load, the mileage and the service book; a lettered van is also an advertisement.',
          'Ein gebrauchter Kastenwagen von etwa drei Jahren mit Regalen und Dachträger kostet im echten Leben etwa 12.000-22.000. Achte auf Zuladung, Laufleistung und Scheckheft; ein beschrifteter Wagen ist auch Werbung.',
        ),
      },
    },
    links: [
      link(
        'Handwerk: the master and the master school (ZDH)',
        'Handwerk: Meister und Meisterschule (ZDH)',
        'https://www.zdh.de/',
      ),
      link(
        "Founders' platform of the state",
        'Gründerplattform des Bundes',
        'https://www.existenzgruender.de/',
      ),
      link(
        'Federal Employment Agency: education and support',
        'Bundesagentur für Arbeit: Weiterbildung und Förderung',
        'https://www.arbeitsagentur.de/',
      ),
      link(
        'Consumer advice: insurance for the self-employed',
        'Verbraucherzentrale: Versicherungen für Selbständige',
        'https://www.verbraucherzentrale.de/',
      ),
    ],
    actions: [
      step(
        'Ask three master schools for the full price and the dates',
        'Bei drei Meisterschulen nach Gesamtpreis und Terminen fragen',
        'high',
      ),
      step(
        'Apply for the upgrading support before the course starts',
        'Das Aufstiegs-BAföG beantragen, bevor der Kurs beginnt',
        'high',
      ),
      step(
        'Pick the master project early and talk to the chamber',
        'Das Meisterprojekt früh wählen und mit der Kammer sprechen',
      ),
      step(
        "Talk to a founders' advisor about the business plan",
        'Mit einer Gründungsberatung über den Businessplan sprechen',
      ),
      step(
        'Find the list of installers of your grid operator',
        'Das Installateurverzeichnis deines Netzbetreibers finden',
      ),
      step(
        'Get two quotes for the business liability insurance',
        'Zwei Angebote für die Betriebshaftpflicht einholen',
      ),
      step(
        'Look for a used van with a service book and check the load limit',
        'Einen gebrauchten Transporter mit Scheckheft suchen und die Zuladung prüfen',
        'low',
      ),
      step(
        'Tell your first customers: the neighbours, the family, the old firm',
        'Die ersten Kunden ansprechen: Nachbarn, Familie, der alte Betrieb',
        'low',
      ),
    ],
    notes: [
      p(
        'The costs are estimates in game money; the chamber of crafts and the upgrading support publish the real ones.',
        'Die Kosten sind Schätzungen in Spielgeld; die Handwerkskammer und das Aufstiegs-BAföG nennen die echten.',
      ),
      p(
        'The first year of a trade business is lean: plan a reserve for the months before the first bills are paid.',
        'Das erste Jahr eines Handwerksbetriebs ist mager: plane eine Reserve für die Monate, bis die ersten Rechnungen bezahlt sind.',
      ),
    ],
  },

  'lena-pflege': {
    description: p(
      "A year on the road with a small daughter: a used campervan, a fitting that is safe for a child, months of unpaid leave, the road itself and the insurances. The plan has three hard parts - the leave from the job (agree it early with the employer), the child's school or kindergarten (a school-age child needs an exemption or a distance-learning plan, a small child does not) and a route that is slow enough for a child. Every bucket is one part of the plan; the project is done when all of them are full.",
      'Ein Jahr unterwegs mit einer kleinen Tochter: ein gebrauchter Campingbus, ein Ausbau, der für ein Kind sicher ist, Monate unbezahlter Auszeit, die Reise selbst und die Versicherungen. Der Plan hat drei harte Teile - die Freistellung vom Job (früh mit dem Arbeitgeber klären), die Schule oder der Kindergarten des Kindes (ein Schulkind braucht eine Befreiung oder einen Fernunterricht, ein kleines Kind nicht) und eine Route, die für ein Kind langsam genug ist. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      van: {
        notes: p(
          'A used panel van or a small camper of five to seven years costs about 15,000-35,000 in real life, depending on the make and the mileage. Take it to a workshop before you pay: rust, the clutch and the cambelt are the usual bills. A weight under 3.5 tonnes keeps it a car licence.',
          'Ein gebrauchter Kastenwagen oder kleiner Camper von fünf bis sieben Jahren kostet im echten Leben etwa 15.000-35.000, je nach Marke und Laufleistung. Lass ihn vor dem Kauf in einer Werkstatt prüfen: Rost, Kupplung und Zahnriemen sind die üblichen Rechnungen. Unter 3,5 Tonnen bleibt es beim Pkw-Führerschein.',
        ),
        links: [
          link(
            'ADAC: travel and leisure',
            'ADAC: Reisen und Freizeit',
            'https://www.adac.de/reise-freizeit/',
          ),
        ],
      },
      fitting: {
        notes: p(
          'A bed, a kitchen block, insulation, a heater and a small solar panel can be built by yourself for about 3,000-8,000. The child seat must be fixed to an approved seat with a belt, and the bed needs a net or a bar so that she cannot fall out.',
          'Bett, Küchenblock, Dämmung, Heizung und ein kleines Solarpanel kannst du selbst für etwa 3.000-8.000 bauen. Der Kindersitz muss an einem zugelassenen Sitz mit Gurt befestigt werden, und das Bett braucht ein Netz oder eine Stange, damit sie nicht herausfallen kann.',
        ),
      },
      leave: {
        notes: p(
          'Unpaid leave of six months is agreed with the employer in writing; ask about the health insurance during it (it can stop after a month). The fixed costs at home - the rent, insurance, the phone - keep running, and the budget has to carry them.',
          'Sechs Monate unbezahlter Urlaub werden mit dem Arbeitgeber schriftlich vereinbart; frag nach der Krankenversicherung in dieser Zeit (sie kann nach einem Monat enden). Die Fixkosten zu Hause - Miete, Versicherungen, Handy - laufen weiter, und das Budget muss sie tragen.',
        ),
        links: [
          link(
            'Family portal of the state',
            'Familienportal des Bundes',
            'https://familienportal.de/',
          ),
        ],
      },
      road: {
        notes: p(
          'Fuel, campsites (about 15-35 a night in Europe, free spots in many countries), ferries and tolls. A slow route of 150 km a day is easier with a child than a fast one. Apps with the campsites and the places to sleep help.',
          'Sprit, Campingplätze (etwa 15-35 pro Nacht in Europa, in vielen Ländern gibt es freie Plätze), Fähren und Maut. Eine langsame Route von 150 km am Tag ist mit Kind leichter als eine schnelle. Apps mit Campingplätzen und Stellplätzen helfen.',
        ),
        links: [
          link(
            'Camping.info: campsites',
            'Camping.info: Campingplätze',
            'https://www.camping.info/',
          ),
          link(
            'park4night: places to sleep',
            'park4night: Übernachtungsplätze',
            'https://www.park4night.com/',
          ),
        ],
      },
      safety: {
        notes: p(
          'Travel health cover that covers a stay abroad of many months, breakdown cover that reaches all the countries of the route, and a child seat that is approved for the van. Take the vaccination card and the medicines for a child with you.',
          'Eine Reisekrankenversicherung, die einen Auslandsaufenthalt von vielen Monaten abdeckt, ein Schutzbrief, der alle Länder der Route erfasst, und ein Kindersitz, der für den Wagen zugelassen ist. Nimm den Impfpass und die Medikamente für ein Kind mit.',
        ),
        links: [
          link(
            'Foreign Office: travel advice',
            'Auswärtiges Amt: Reisehinweise',
            'https://www.auswaertiges-amt.de/',
          ),
        ],
      },
    },
    links: [
      link('Camping.info: campsites', 'Camping.info: Campingplätze', 'https://www.camping.info/'),
      link(
        'park4night: places to sleep',
        'park4night: Übernachtungsplätze',
        'https://www.park4night.com/',
      ),
      link(
        'Foreign Office: travel advice',
        'Auswärtiges Amt: Reisehinweise',
        'https://www.auswaertiges-amt.de/',
      ),
      link('Family portal of the state', 'Familienportal des Bundes', 'https://familienportal.de/'),
    ],
    actions: [
      step(
        'Talk to the employer about the leave and put it in writing',
        'Mit dem Arbeitgeber über die Auszeit sprechen und sie schriftlich festhalten',
        'high',
      ),
      step(
        'Ask the health insurance what covers you during the leave',
        'Die Krankenkasse fragen, was in der Auszeit abgedeckt ist',
        'high',
      ),
      step(
        'Look at five vans and take the best one to a workshop',
        'Fünf Busse ansehen und den besten in eine Werkstatt bringen',
      ),
      step(
        "Plan the fitting: bed, kitchen, heater - and the child's safety first",
        'Den Ausbau planen: Bett, Küche, Heizung - und zuerst die Sicherheit des Kindes',
      ),
      step(
        'Plan the route in stages of a few days and leave room',
        'Die Route in Etappen von wenigen Tagen planen und Luft lassen',
      ),
      step(
        'Choose the travel health cover and the breakdown cover',
        'Reisekranken- und Schutzbrief wählen',
      ),
      step(
        'Talk to the kindergarten or school about the year',
        'Mit Kindergarten oder Schule über das Jahr sprechen',
      ),
      step(
        'Test it first: a long weekend and then two weeks',
        'Erst testen: ein langes Wochenende und dann zwei Wochen',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'A van that is lived in for a year costs money every month: fuel, repairs and a cushion for the one big bill.',
        'Ein Bus, in dem man ein Jahr lebt, kostet jeden Monat Geld: Sprit, Reparaturen und ein Polster für die eine große Rechnung.',
      ),
    ],
  },

  'sophie-lehrerin': {
    description: p(
      'A year under sail: the licences that let her skipper a yacht, the gear, a sabbatical year in which a teacher is paid only a part of the salary, the charter itself and the insurances. In Germany a teacher can save up for a sabbatical (the "Sabbatjahr" model: several years at reduced pay, then a year off with the same pay); the rules differ by state. The sea part needs the skills of a skipper - the practical courses are the real work. Every bucket is one part of the plan; the project is done when all of them are full.',
      'Ein Jahr unter Segeln: die Scheine, mit denen sie eine Yacht führen darf, die Ausrüstung, ein Sabbatjahr, in dem eine Lehrerin nur einen Teil des Gehalts bekommt, der Törn selbst und die Versicherungen. In Deutschland kann eine Lehrerin auf ein Sabbatjahr ansparen (das Sabbatjahr-Modell: mehrere Jahre mit reduziertem Gehalt, dann ein Jahr frei mit demselben Gehalt); die Regeln sind je Bundesland verschieden. Der Seeteil braucht das Können einer Skipperin - die Praxiskurse sind die eigentliche Arbeit. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      licences: {
        notes: p(
          'In Germany the sports boat licences for the inland waters and the sea (SBF Binnen and See) are a base, and the sailing licence of the German Sailing Association or the DMYV and a coastal skipper licence (SKS) are what charter companies ask for. The theory and the practical exams together cost about 1,500-3,500 in real life.',
          'In Deutschland sind die Sportbootführerscheine Binnen und See die Grundlage, und der Segelschein des Deutschen Segler-Verbands oder des DMYV und ein Sportküstenschifferschein (SKS) werden von Charterfirmen verlangt. Theorie und Prüfungen zusammen kosten im echten Leben etwa 1.500-3.500.',
        ),
        links: [
          link('German Sailing Association', 'Deutscher Segler-Verband', 'https://www.dsv.org/'),
          link(
            'DMYV: sports boat licences',
            'DMYV: Sportbootführerscheine',
            'https://www.dmyv.de/',
          ),
        ],
      },
      gear: {
        notes: p(
          'Oilskins (jacket and trousers) 400-900, a lifejacket with a harness and a tether 150-300, a handheld VHF 150-250 and a headlamp with red light. Good gear is cheaper than a cold week; buy the lifejacket new and check its gas cylinder every year.',
          'Ölzeug (Jacke und Hose) 400-900, eine Rettungsweste mit Gurt und Lifeline 150-300, ein Handfunkgerät 150-250 und eine Stirnlampe mit Rotlicht. Gute Ausrüstung ist günstiger als eine kalte Woche; kauf die Rettungsweste neu und prüfe die Gaspatrone jedes Jahr.',
        ),
      },
      sabbatical: {
        notes: p(
          'In the sabbatical model a teacher works for several years at a reduced salary and then takes the year off with the same pay - the "cost" is the lost pay in the saving years. Ask the school authority of your state for the rules, and the health and pension insurance for the effect on them.',
          'Im Sabbatjahr-Modell arbeitet eine Lehrerin mehrere Jahre mit reduziertem Gehalt und nimmt dann das Jahr frei bei gleicher Bezahlung - die "Kosten" sind das fehlende Gehalt in den Ansparjahren. Frag die Schulbehörde deines Landes nach den Regeln, und Kranken- und Rentenversicherung nach den Folgen.',
        ),
        links: [
          link(
            'Education server of the states',
            'Deutscher Bildungsserver',
            'https://www.bildungsserver.de/',
          ),
        ],
      },
      charter: {
        notes: p(
          'A 38-foot yacht costs about 2,500-4,500 a week in the season in Croatia or Greece, with the deposit (often 1,500-3,000, returned) and the final cleaning. Eight weeks in the off-season are far cheaper than in August. Plan the route by the wind: the Adriatic has the "maestral" in the afternoon.',
          'Eine 38-Fuß-Yacht kostet in der Saison in Kroatien oder Griechenland etwa 2.500-4.500 pro Woche, mit Kaution (oft 1.500-3.000, wird zurückgezahlt) und Endreinigung. Acht Wochen in der Nebensaison sind weit günstiger als im August. Plane die Route nach dem Wind: die Adria hat nachmittags den "Maestral".',
        ),
        links: [
          link(
            "Croatia: the country's tourist board",
            'Kroatien: die Tourismuszentrale',
            'https://croatia.hr/en-GB',
          ),
        ],
      },
      insurance: {
        notes: p(
          'A skipper liability insurance for the charter, sea-travel health cover and a cancellation insurance. The charter company asks for the licences and the logbook; the deposit can be covered by an insurance against a lost deposit.',
          'Eine Skipper-Haftpflicht für den Törn, eine Auslandskrankenversicherung für die Seereise und eine Stornoversicherung. Die Charterfirma verlangt die Scheine und das Logbuch; die Kaution kann durch eine Kautionsversicherung abgesichert werden.',
        ),
      },
      return: {
        notes: p(
          "Flights home from the last port (book them flexible), storage of the flat's things or a sublet, and a cushion for the first month back: the salary starts again only when school does.",
          'Flüge nach Hause vom letzten Hafen (flexibel buchen), Einlagerung der Wohnungssachen oder eine Untervermietung und ein Polster für den ersten Monat zurück: das Gehalt beginnt erst wieder, wenn die Schule beginnt.',
        ),
      },
    },
    links: [
      link('German Sailing Association', 'Deutscher Segler-Verband', 'https://www.dsv.org/'),
      link('DMYV: sports boat licences', 'DMYV: Sportbootführerscheine', 'https://www.dmyv.de/'),
      link(
        "Croatia: the country's tourist board",
        'Kroatien: die Tourismuszentrale',
        'https://croatia.hr/en-GB',
      ),
      link(
        'Education server of the states',
        'Deutscher Bildungsserver',
        'https://www.bildungsserver.de/',
      ),
    ],
    actions: [
      step(
        'Ask the school authority about the sabbatical rules of your state',
        'Die Schulbehörde nach den Sabbatjahr-Regeln deines Landes fragen',
        'high',
      ),
      step(
        'Take the sports boat licences first, then the sailing licence',
        'Zuerst die Sportbootführerscheine machen, dann den Segelschein',
      ),
      step(
        'Sail a week as crew before you skipper alone',
        'Eine Woche als Crew mitsegeln, bevor du allein skipperst',
      ),
      step(
        'Buy a lifejacket with a harness and learn to use it',
        'Eine Rettungsweste mit Gurt kaufen und den Umgang lernen',
        'high',
      ),
      step(
        'Compare charter companies: boat age, deposit, insurance',
        'Charterfirmen vergleichen: Bootsalter, Kaution, Versicherung',
      ),
      step(
        'Plan the route by season and wind, with a day of reserve each week',
        'Die Route nach Saison und Wind planen, mit einem Reservetag pro Woche',
      ),
      step(
        'Choose the insurances and the deposit cover',
        'Die Versicherungen und die Kautionsabsicherung wählen',
      ),
      step(
        'Plan the way home and the first month after',
        'Den Rückweg und den ersten Monat danach planen',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'A year at sea is slow: the weather decides, and the plan must have room for days in port.',
        'Ein Jahr auf See ist langsam: das Wetter entscheidet, und der Plan braucht Platz für Hafentage.',
      ),
    ],
  },

  'tobias-designer': {
    description: p(
      "A loft with a studio behind and a gallery in front: Tobias is a small company with two rooms. The plan has the commercial lease (three months of deposit is usual), the conversion, the machines for the studio, the fittings of the gallery with its rails and light, the opening, the website with a shop and a cushion until the gallery carries itself. As a self-employed artist he can join the artists' social insurance, which pays half of the health and pension contributions. Every bucket is one part of the plan; the project is done when all of them are full.",
      'Ein Loft mit Atelier hinten und Galerie vorne: Tobias ist ein kleines Unternehmen mit zwei Räumen. Der Plan hat den Gewerbemietvertrag (drei Monatsmieten Kaution sind üblich), den Umbau, die Maschinen fürs Atelier, die Ausstattung der Galerie mit Schienen und Licht, die Eröffnung, die Website mit Shop und ein Polster, bis die Galerie sich trägt. Als selbständiger Künstler kann er in die Künstlersozialkasse, die die Hälfte der Kranken- und Rentenbeiträge zahlt. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      loft: {
        notes: p(
          "A commercial lease has a deposit of about three months' rent and usually a term of five years with an option; read the clauses about the use, the conversion and the way back. Ask the landlord in writing what you may change. A new floor and walls cost a few thousand euros.",
          'Ein Gewerbemietvertrag hat etwa drei Monatsmieten als Kaution und meist eine Laufzeit von fünf Jahren mit Option; lies die Klauseln zu Nutzung, Umbau und Rückbau. Frag den Vermieter schriftlich, was du verändern darfst. Ein neuer Boden und neue Wände kosten einige tausend Euro.',
        ),
        links: [
          link(
            "Founders' platform of the state",
            'Gründerplattform des Bundes',
            'https://www.existenzgruender.de/',
          ),
        ],
      },
      studio: {
        notes: p(
          'A large-format printer costs about 2,500-6,000 new, a cutter 500-2,500, worktables and a calibrated screen another 1,500-3,000. A used machine with a service contract is the cheaper start; ink and paper are the running costs.',
          'Ein Großformatdrucker kostet neu etwa 2.500-6.000, ein Schneideplotter 500-2.500, Arbeitstische und ein kalibrierter Bildschirm weitere 1.500-3.000. Eine gebrauchte Maschine mit Wartungsvertrag ist der günstigere Start; Tinte und Papier sind die laufenden Kosten.',
        ),
      },
      gallery: {
        notes: p(
          'Hanging rails with wires, spotlights with a high colour rendering and plinths for objects: about 2,000-5,000 for a room of 40-60 square metres. White walls and neutral light let the work speak.',
          'Hängeschienen mit Seilen, Strahler mit hoher Farbwiedergabe und Sockel für Objekte: etwa 2.000-5.000 für einen Raum von 40-60 Quadratmetern. Weiße Wände und neutrales Licht lassen die Arbeiten wirken.',
        ),
      },
      opening: {
        notes: p(
          'Invitations to the neighbours, the press and the collectors, drinks, a small band and a photographer: about 2,000-5,000. A good opening brings the first sales and the first reviews; send the press release three weeks ahead.',
          'Einladungen an Nachbarn, Presse und Sammler, Getränke, eine kleine Band und ein Fotograf: etwa 2.000-5.000. Eine gute Eröffnung bringt die ersten Verkäufe und die ersten Besprechungen; schick die Pressemitteilung drei Wochen vorher.',
        ),
      },
      buffer: {
        notes: p(
          "Six months of rent and fixed costs as a cushion: a gallery needs time, and the first year is rarely profitable. The artists' social insurance (KSK) pays half of the health and pension contributions of a self-employed artist or designer - apply before you start.",
          'Sechs Monate Miete und Fixkosten als Polster: eine Galerie braucht Zeit, und das erste Jahr ist selten profitabel. Die Künstlersozialkasse (KSK) zahlt die Hälfte der Kranken- und Rentenbeiträge einer selbständigen Künstlerin oder eines Designers - beantrage sie, bevor du anfängst.',
        ),
        links: [
          link(
            "Artists' social insurance (KSK)",
            'Künstlersozialkasse (KSK)',
            'https://www.kuenstlersozialkasse.de/',
          ),
        ],
      },
      web: {
        notes: p(
          'A site that shows the studio and sells the prints: about 1,000-3,000 for the design and the shop, and a few euros a month for the service. Good photographs of the work are the most important part.',
          'Eine Website, die das Atelier zeigt und die Drucke verkauft: etwa 1.000-3.000 für Gestaltung und Shop und einige Euro im Monat für den Dienst. Gute Fotos der Arbeiten sind das Wichtigste.',
        ),
      },
    },
    links: [
      link(
        "Artists' social insurance (KSK)",
        'Künstlersozialkasse (KSK)',
        'https://www.kuenstlersozialkasse.de/',
      ),
      link(
        "Founders' platform of the state",
        'Gründerplattform des Bundes',
        'https://www.existenzgruender.de/',
      ),
      link(
        'Federal Association of Visual Artists',
        'Bundesverband Bildender Künstlerinnen und Künstler',
        'https://www.bbk-bundesverband.de/',
      ),
      link(
        'Consumer advice: insurance',
        'Verbraucherzentrale: Versicherungen',
        'https://www.verbraucherzentrale.de/',
      ),
    ],
    actions: [
      step(
        'Read the lease with a lawyer: use, conversion, term, way back',
        'Den Mietvertrag mit einem Anwalt lesen: Nutzung, Umbau, Laufzeit, Rückbau',
        'high',
      ),
      step(
        "Apply to the artists' social insurance",
        'Die Aufnahme in die Künstlersozialkasse beantragen',
        'high',
      ),
      step(
        "Write a business plan with a founders' advisor",
        'Mit einer Gründungsberatung einen Businessplan schreiben',
      ),
      step(
        'Choose used machines with a service contract',
        'Gebrauchte Maschinen mit Wartungsvertrag wählen',
      ),
      step(
        'Plan three exhibitions for the first year',
        'Drei Ausstellungen für das erste Jahr planen',
      ),
      step(
        'Invite the press and the collectors three weeks ahead',
        'Presse und Sammler drei Wochen vorher einladen',
      ),
      step(
        'Photograph the work well and build the shop',
        'Die Arbeiten gut fotografieren und den Shop bauen',
      ),
      step(
        'Keep a cushion for six months and do not spend it',
        'Ein Polster für sechs Monate halten und es nicht ausgeben',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'A gallery lives on relations: the first collectors are friends of the studio.',
        'Eine Galerie lebt von Beziehungen: die ersten Sammler sind Freunde des Ateliers.',
      ),
    ],
  },

  'katrin-marketing': {
    description: p(
      "A small house by the Baltic Sea for the family's summers and, later, for the years after work. It is bought once and lived in for decades: the deposit the bank asks for (about 20 % of the price), the costs of buying (property transfer tax by state, notary, land registry and sometimes an agent - together about 8-12 %), the renovation that every old house needs and a reserve for what the sea air destroys. A holiday house is also a running cost: the property tax, the insurance, the heating in winter and the tax for the second home. Every bucket is one part of the plan; the project is done when all of them are full.",
      'Ein kleines Haus an der Ostsee für die Sommer der Familie und später für die Jahre nach der Arbeit. Es wird einmal gekauft und jahrzehntelang bewohnt: die Anzahlung, die die Bank verlangt (etwa 20 % des Preises), die Kaufnebenkosten (Grunderwerbsteuer je Land, Notar, Grundbuch und manchmal ein Makler - zusammen etwa 8-12 %), die Renovierung, die jedes alte Haus braucht, und eine Reserve für das, was die Seeluft zerstört. Ein Ferienhaus ist auch ein laufender Kostenpunkt: Grundsteuer, Versicherung, Heizung im Winter und die Zweitwohnungsteuer. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      deposit: {
        notes: p(
          'Banks ask for about 20 % of the price in own money for a holiday house - more than for a home to live in, because it is the second property. The less you bring, the dearer the loan; compare three banks and ask for the fixed interest period.',
          'Banken verlangen für ein Ferienhaus etwa 20 % des Preises als Eigenkapital - mehr als für ein Zuhause zum Wohnen, weil es die zweite Immobilie ist. Je weniger du mitbringst, desto teurer der Kredit; vergleiche drei Banken und frag nach der Zinsbindung.',
        ),
        links: [
          link(
            'Consumer advice: financing a home',
            'Verbraucherzentrale: Baufinanzierung',
            'https://www.verbraucherzentrale.de/',
          ),
        ],
      },
      costs: {
        notes: p(
          'The property transfer tax is 3.5-6.5 % by state (Schleswig-Holstein and Mecklenburg-Vorpommern are at the upper end), notary and land registry about 2 %, and an agent up to about 3.6 % for the buyer. Add them up before you look at houses.',
          'Die Grunderwerbsteuer beträgt je nach Land 3,5-6,5 % (Schleswig-Holstein und Mecklenburg-Vorpommern liegen am oberen Ende), Notar und Grundbuch etwa 2 %, ein Makler bis zu rund 3,6 % für den Käufer. Rechne sie zusammen, bevor du dir Häuser ansiehst.',
        ),
      },
      renovation: {
        notes: p(
          'Old houses by the sea need a new roof section, a bathroom and windows facing the wind sooner than inland. Ask for a survey by an expert before you buy (about 500-1,500); it names the bills of the next ten years and gives you a reason to bargain.',
          'Alte Häuser am Meer brauchen ein neues Dachstück, ein Bad und Fenster zur Windseite früher als im Binnenland. Lass vor dem Kauf ein Gutachten von einem Sachverständigen machen (etwa 500-1.500); es nennt die Rechnungen der nächsten zehn Jahre und gibt dir einen Grund zu verhandeln.',
        ),
        links: [link('Baltic Sea tourism', 'Ostsee-Tourismus', 'https://www.ostsee.de/')],
      },
      furniture: {
        notes: p(
          'Beds for six, a kitchen and a long table: second-hand and local craftsmen are cheaper than a showroom. Furnish for the damp: wood and washable fabrics last.',
          'Betten für sechs, eine Küche und ein langer Tisch: gebraucht und vom Tischler vor Ort ist es günstiger als im Möbelhaus. Möbliere für die Feuchtigkeit: Holz und waschbare Stoffe halten.',
        ),
      },
      upkeep: {
        notes: p(
          'The rule: one percent of the price a year for repairs. Salt air eats paint, gutters and metal. Add the running costs - the property tax, the building insurance, the heating in winter and in some places a tax for the second home.',
          'Die Regel: ein Prozent des Preises pro Jahr für Reparaturen. Salzluft frisst Farbe, Dachrinnen und Metall. Dazu kommen die laufenden Kosten - Grundsteuer, Gebäudeversicherung, Heizung im Winter und an manchen Orten eine Zweitwohnungsteuer.',
        ),
      },
    },
    links: [
      link(
        'Consumer advice: financing a home',
        'Verbraucherzentrale: Baufinanzierung',
        'https://www.verbraucherzentrale.de/',
      ),
      link('Baltic Sea tourism', 'Ostsee-Tourismus', 'https://www.ostsee.de/'),
      link(
        'Stiftung Warentest: money and finance',
        'Stiftung Warentest: Geld und Finanzen',
        'https://www.test.de/',
      ),
    ],
    actions: [
      step(
        'Fix the budget with the costs of buying and the running costs',
        'Das Budget mit Kaufnebenkosten und laufenden Kosten festlegen',
        'high',
      ),
      step(
        'Compare three banks for the loan and the fixed interest',
        'Drei Banken für Kredit und Zinsbindung vergleichen',
      ),
      step(
        'Visit the coast in winter, not only in summer',
        'Die Küste auch im Winter besuchen, nicht nur im Sommer',
      ),
      step(
        'Order a survey by an expert before you sign',
        'Vor der Unterschrift ein Gutachten eines Sachverständigen bestellen',
        'high',
      ),
      step(
        'Ask the municipality about the second-home tax and the building rules',
        'Die Gemeinde nach Zweitwohnungsteuer und Bauregeln fragen',
      ),
      step(
        'Plan the renovation by priority: roof, damp, windows',
        'Die Renovierung nach Priorität planen: Dach, Feuchte, Fenster',
      ),
      step(
        'Find a caretaker for the winter months',
        'Jemanden für die Wintermonate finden, der nach dem Haus sieht',
        'low',
      ),
      step(
        'Agree with the family who uses it when',
        'Mit der Familie absprechen, wer es wann nutzt',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'A holiday house costs a little every month, also in the months when nobody is there.',
        'Ein Ferienhaus kostet jeden Monat ein wenig, auch in den Monaten, in denen niemand dort ist.',
      ),
    ],
  },

  'frank-ingenieur': {
    description: p(
      'Independence from the grid has five parts: producing power, storing it, heating without gas, keeping the heat in and driving on it. Frank plans a house that makes most of its own energy: a solar roof of about 12 kWp, a battery for the evening and the night, an air-to-water heat pump, insulation and triple-glazed windows, and a wallbox for an electric car. A controller decides when to charge, heat and sell. The state pays grants for the heat pump and for the insulation (apply before you order). Every bucket is one of the parts; the project is done when all of them are full.',
      'Unabhängigkeit vom Netz hat fünf Teile: Strom erzeugen, speichern, ohne Gas heizen, die Wärme halten und damit fahren. Frank plant ein Haus, das den größten Teil seiner Energie selbst macht: ein Solardach von etwa 12 kWp, eine Batterie für Abend und Nacht, eine Luft-Wasser-Wärmepumpe, Dämmung und dreifach verglaste Fenster und eine Wallbox für ein E-Auto. Eine Steuerung entscheidet, wann geladen, geheizt und verkauft wird. Der Staat zahlt Zuschüsse für die Wärmepumpe und für die Dämmung (vor der Bestellung beantragen). Jeder Topf ist einer der Teile; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      solar: {
        notes: p(
          "A roof system of 10-12 kWp costs about 1,200-1,600 per kWp installed in Germany, with the inverter and the installation. A south roof gives about 950-1,050 kWh per kWp a year; the EU tool PVGIS estimates your roof. Get three offers and ask for the grid operator's registration.",
          'Eine Dachanlage von 10-12 kWp kostet in Deutschland etwa 1.200-1.600 pro kWp installiert, mit Wechselrichter und Montage. Ein Süddach bringt etwa 950-1.050 kWh pro kWp im Jahr; das EU-Werkzeug PVGIS schätzt dein Dach. Hol drei Angebote ein und frag nach der Anmeldung beim Netzbetreiber.',
        ),
        links: [
          link(
            'PVGIS: estimate your solar yield',
            'PVGIS: Solarertrag schätzen',
            'https://re.jrc.ec.europa.eu/pvg_tools/en/',
          ),
        ],
      },
      battery: {
        notes: p(
          'A home battery of 8-10 kWh costs about 5,000-9,000 with the installation. It lifts the share of the own power you use from about 30 % to 60-70 %, but it pays back slowly: size it for the evening and the night, not for the winter.',
          'Ein Heimspeicher von 8-10 kWh kostet etwa 5.000-9.000 mit Einbau. Er hebt den Eigenverbrauch von etwa 30 % auf 60-70 %, zahlt sich aber langsam zurück: dimensioniere ihn für Abend und Nacht, nicht für den Winter.',
        ),
      },
      heatpump: {
        notes: p(
          'An air-to-water heat pump with a storage tank and the pipework costs about 18,000-30,000 before the grant. The state pays a base grant and bonuses for a replaced gas or oil heating; the application comes before the order. A good insulation lets it run with a low flow temperature and saves a lot of power.',
          'Eine Luft-Wasser-Wärmepumpe mit Speicher und Rohrleitungen kostet etwa 18.000-30.000 vor dem Zuschuss. Der Staat zahlt eine Grundförderung und Boni für eine ersetzte Gas- oder Ölheizung; der Antrag kommt vor der Bestellung. Eine gute Dämmung lässt sie mit niedriger Vorlauftemperatur laufen und spart viel Strom.',
        ),
        links: [
          link(
            'Federal Office for Economic Affairs (BAFA): funding',
            'Bundesamt für Wirtschaft (BAFA): Förderung',
            'https://www.bafa.de/',
          ),
        ],
      },
      insulation: {
        notes: p(
          'Facade, top floor ceiling and triple-glazed windows are the big parts: about 25,000-45,000 for a house of 150 square metres. Let an energy advisor with a certificate plan the order - the roof and the ceiling first, they give the most for the money - and ask for the individual renovation roadmap, which raises the grant.',
          'Fassade, oberste Geschossdecke und dreifach verglaste Fenster sind die großen Posten: etwa 25.000-45.000 für ein Haus von 150 Quadratmetern. Lass eine zertifizierte Energieberatung die Reihenfolge planen - Dach und Decke zuerst, sie bringen am meisten fürs Geld - und frag nach dem individuellen Sanierungsfahrplan, der den Zuschuss erhöht.',
        ),
        links: [
          link(
            'Consumer advice: energy advice',
            'Verbraucherzentrale: Energieberatung',
            'https://www.verbraucherzentrale-energieberatung.de/',
          ),
        ],
      },
      wallbox: {
        notes: p(
          'A wallbox of 11 kW costs about 700-1,500 with the installation and a check by an electrician; the grid operator must be told. An electric car gives the roof a use: charge at noon on your own power. A second-hand electric car of three years is the sensible start.',
          'Eine Wallbox mit 11 kW kostet etwa 700-1.500 mit Einbau und Abnahme durch einen Elektriker; der Netzbetreiber muss informiert werden. Ein E-Auto gibt dem Dach eine Aufgabe: lade mittags mit eigenem Strom. Ein gebrauchtes E-Auto von drei Jahren ist der vernünftige Anfang.',
        ),
      },
      smart: {
        notes: p(
          'An energy manager decides when to charge the car and the battery, when to heat the tank and when to feed in. About 1,000-3,000 with the meter and the app; check that it works with the inverter, the heat pump and the wallbox of your choice.',
          'Ein Energiemanager entscheidet, wann Auto und Speicher laden, wann der Pufferspeicher heizt und wann eingespeist wird. Etwa 1.000-3.000 mit Zähler und App; prüfe, dass er mit Wechselrichter, Wärmepumpe und Wallbox deiner Wahl zusammenarbeitet.',
        ),
      },
    },
    links: [
      link(
        'Federal Office for Economic Affairs (BAFA): funding',
        'Bundesamt für Wirtschaft (BAFA): Förderung',
        'https://www.bafa.de/',
      ),
      link(
        'PVGIS: estimate your solar yield',
        'PVGIS: Solarertrag schätzen',
        'https://re.jrc.ec.europa.eu/pvg_tools/en/',
      ),
      link(
        'Consumer advice: energy advice',
        'Verbraucherzentrale: Energieberatung',
        'https://www.verbraucherzentrale-energieberatung.de/',
      ),
      link(
        'Experts for energy efficiency',
        'Energie-Effizienz-Experten',
        'https://www.energie-effizienz-experten.de/',
      ),
    ],
    actions: [
      step(
        'Order an energy advice and an individual renovation roadmap',
        'Eine Energieberatung und einen individuellen Sanierungsfahrplan beauftragen',
        'high',
      ),
      step(
        'Estimate the solar yield of your roof with PVGIS',
        'Den Solarertrag deines Dachs mit PVGIS schätzen',
      ),
      step(
        'Get three offers for the solar system and the battery',
        'Drei Angebote für Solaranlage und Speicher einholen',
      ),
      step(
        'Apply for the grants before you order anything',
        'Die Zuschüsse beantragen, bevor du etwas bestellst',
        'high',
      ),
      step(
        'Insulate first (roof, ceiling), then size the heat pump',
        'Zuerst dämmen (Dach, Decke), dann die Wärmepumpe dimensionieren',
      ),
      step(
        'Register the plant with the grid operator and the market register',
        'Die Anlage beim Netzbetreiber und im Marktstammdatenregister anmelden',
      ),
      step(
        'Plan the wallbox and the charging at noon',
        'Wallbox und das Laden am Mittag planen',
        'low',
      ),
      step(
        'Check the controller works with all the devices',
        'Prüfen, dass die Steuerung mit allen Geräten zusammenarbeitet',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'Grants and prices change often: ask for the current rules before you plan the sums.',
        'Zuschüsse und Preise ändern sich oft: frag nach den aktuellen Regeln, bevor du die Summen planst.',
      ),
    ],
  },

  'jan-oberarzt': {
    description: p(
      'A practice is bought, not started: Dr. Jan takes over a surgical practice in the Allgäu. In Germany a doctor who treats statutory patients needs a licence (a "Kassensitz"), which is awarded in a procedure of the regional association of statutory-insurance doctors; in a takeover the value of the practice - the patient base and the inventory - is valued by an expert, and the buyer pays the seller. The conversion, the diagnostics, the staff before the first quarterly bill is paid and a reserve for the lean months make up the rest. Every bucket is one part of the plan; the project is done when all of them are full.',
      'Eine Praxis wird gekauft, nicht gegründet: Dr. Jan übernimmt eine chirurgische Praxis im Allgäu. In Deutschland braucht ein Arzt, der gesetzlich Versicherte behandelt, eine Zulassung (einen Kassensitz), die in einem Verfahren der Kassenärztlichen Vereinigung vergeben wird; bei einer Übernahme wird der Wert der Praxis - der Patientenstamm und die Einrichtung - von einem Gutachter geschätzt, und der Käufer zahlt dem Verkäufer. Umbau, Diagnostik, das Personal bis zur ersten Quartalsabrechnung und eine Reserve für magere Monate machen den Rest aus. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      purchase: {
        notes: p(
          'The value of a practice is the "goodwill" of the patient base plus the inventory, set by an expert opinion; a surgical practice often sells for about a third to a half of a year\'s turnover plus the inventory. The seller and the buyer agree on a price; the licence is applied for at the same time.',
          'Der Wert einer Praxis ist der "Goodwill" des Patientenstamms plus die Einrichtung, festgelegt durch ein Wertgutachten; eine chirurgische Praxis wird oft für etwa ein Drittel bis die Hälfte eines Jahresumsatzes plus Inventar verkauft. Verkäufer und Käufer einigen sich auf einen Preis; die Zulassung wird gleichzeitig beantragt.',
        ),
        links: [
          link(
            'Federal Association of Statutory Insurance Doctors (KBV)',
            'Kassenärztliche Bundesvereinigung (KBV)',
            'https://www.kbv.de/',
          ),
        ],
      },
      equipment: {
        notes: p(
          'A small operating room with a table and lights, an ultrasound (about 15,000-40,000) and a digital X-ray (about 40,000-90,000) are the big items. Check what the practice has and what the hygiene rules ask for, and lease what you can.',
          'Ein kleiner OP mit Tisch und Leuchten, ein Ultraschallgerät (etwa 15.000-40.000) und ein digitales Röntgengerät (etwa 40.000-90.000) sind die großen Posten. Prüfe, was die Praxis hat und was die Hygieneregeln verlangen, und leas, was du kannst.',
        ),
      },
      licence: {
        notes: p(
          'The licence to treat statutory patients is awarded by the admission committee of the regional association of doctors; a lawyer and a tax adviser who know the practice trade are worth their fees. The application and the contract with the seller are examined together.',
          'Die Zulassung zur Behandlung gesetzlich Versicherter vergibt der Zulassungsausschuss der Kassenärztlichen Vereinigung; ein Anwalt und ein Steuerberater, die das Praxisgeschäft kennen, sind ihr Honorar wert. Antrag und Vertrag mit dem Verkäufer werden zusammen geprüft.',
        ),
        links: [
          link(
            'Regional association of doctors (Bavaria)',
            'Kassenärztliche Vereinigung Bayerns',
            'https://www.kvb.de/',
          ),
        ],
      },
      staff: {
        notes: p(
          'The statutory insurance pays a practice only at the end of the quarter, about three to four months after the first treatments. Three medical assistants for six months cost about 18,000-25,000; plan them before the first bill, and keep their salaries on the contract.',
          'Die gesetzliche Krankenversicherung zahlt einer Praxis erst am Quartalsende, etwa drei bis vier Monate nach den ersten Behandlungen. Drei medizinische Fachangestellte für sechs Monate kosten etwa 18.000-25.000; plane sie vor der ersten Rechnung und übernimm ihre Gehälter im Vertrag.',
        ),
      },
      buffer: {
        notes: p(
          'The first quarters never go as planned: patients stay with the old doctor, the billing has errors, a machine breaks. Keep a reserve of at least three months of the costs and talk to a bank that finances doctors early.',
          'Die ersten Quartale laufen nie wie geplant: Patienten bleiben beim alten Arzt, die Abrechnung hat Fehler, ein Gerät geht kaputt. Halte eine Reserve von mindestens drei Monatskosten und sprich früh mit einer Bank, die Ärzte finanziert.',
        ),
        links: [
          link(
            'apoBank: financing for doctors',
            'apoBank: Finanzierung für Ärzte',
            'https://www.apobank.de/',
          ),
        ],
      },
    },
    links: [
      link(
        'Federal Association of Statutory Insurance Doctors (KBV)',
        'Kassenärztliche Bundesvereinigung (KBV)',
        'https://www.kbv.de/',
      ),
      link(
        'Regional association of doctors (Bavaria)',
        'Kassenärztliche Vereinigung Bayerns',
        'https://www.kvb.de/',
      ),
      link(
        'apoBank: financing for doctors',
        'apoBank: Finanzierung für Ärzte',
        'https://www.apobank.de/',
      ),
      link('Deutsches Ärzteblatt', 'Deutsches Ärzteblatt', 'https://www.aerzteblatt.de/'),
    ],
    actions: [
      step(
        'Find the practice and ask the seller for the numbers of three years',
        'Die Praxis finden und vom Verkäufer die Zahlen von drei Jahren verlangen',
        'high',
      ),
      step(
        'Order a valuation by an expert',
        'Ein Wertgutachten bei einem Sachverständigen beauftragen',
        'high',
      ),
      step(
        'Talk to the regional association about the licence',
        'Mit der Kassenärztlichen Vereinigung über die Zulassung sprechen',
      ),
      step(
        'Hire a lawyer and a tax adviser who know practice takeovers',
        'Anwalt und Steuerberater mit Praxisübernahme-Erfahrung beauftragen',
      ),
      step(
        'Ask a bank for the financing and the credit line',
        'Eine Bank nach Finanzierung und Kreditlinie fragen',
      ),
      step(
        'Keep the staff: talk to the assistants before the takeover',
        'Das Personal halten: vor der Übernahme mit den Assistentinnen sprechen',
      ),
      step(
        'Plan the conversion and the hygiene rules with the authority',
        'Umbau und Hygieneregeln mit der Behörde planen',
      ),
      step(
        'Tell the patients: a letter from the old and the new doctor',
        'Die Patienten informieren: ein Brief vom alten und vom neuen Arzt',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'The statutory insurance pays late: plan the staff and the rent for the first quarter from your own money.',
        'Die gesetzliche Kasse zahlt spät: plane Personal und Miete des ersten Quartals aus eigenem Geld.',
      ),
    ],
  },

  'heike-werkstatt': {
    description: p(
      'A small vineyard in the Palatinate: two hectares of established vines on a good slope and a cellar of her own. A vineyard takes land, knowledge, a cellar and patience: the plot (the price per hectare differs a lot by site), courses in viticulture and cellar technique, a press, tanks and cooling, the first vintage in bottles and a place where guests can taste. Wine growing is a farm business: it is registered, it has its own rules for labels and taxes, and the first bottle is sold only after the harvest and the maturing. Every bucket is one part of the plan; the project is done when all of them are full.',
      'Ein kleines Weingut in der Pfalz: zwei Hektar eingewachsene Reben an einem guten Hang und ein eigener Keller. Ein Weingut braucht Land, Wissen, einen Keller und Geduld: die Fläche (der Preis je Hektar unterscheidet sich stark nach Lage), Kurse in Weinbau und Kellertechnik, eine Presse, Tanks und Kühlung, den ersten Jahrgang in Flaschen und einen Ort, an dem Gäste probieren können. Weinbau ist ein landwirtschaftlicher Betrieb: er wird angemeldet, hat eigene Regeln für Etiketten und Steuern, und die erste Flasche wird erst nach Ernte und Reife verkauft. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      land: {
        notes: p(
          'Vineyards in the Palatinate cost very different prices by site, from about 20,000 to over 100,000 per hectare for top slopes; a plot of established vines with a lease or a purchase contract is the realistic start. Look at the age of the vines, the grape and the slope, and ask a local winemaker or the chamber of agriculture.',
          'Weinberge in der Pfalz kosten je nach Lage sehr unterschiedlich, von etwa 20.000 bis über 100.000 je Hektar für Spitzenlagen; eine Fläche mit eingewachsenen Reben im Pacht- oder Kaufvertrag ist der realistische Start. Schau auf Alter der Reben, Rebsorte und Hang und frag einen Winzer vor Ort oder die Landwirtschaftskammer.',
        ),
        links: [
          link(
            'Deutsche Weine: the wine regions',
            'Deutsche Weine: die Anbaugebiete',
            'https://www.deutscheweine.de/',
          ),
        ],
      },
      courses: {
        notes: p(
          'Viticulture and cellar technique in weekend courses over a year cost about 2,000-5,000; a degree or a training as a winemaker is the long way. Learn also from a winery where you can help in the harvest.',
          'Weinbau und Kellertechnik in Wochenendkursen über ein Jahr kosten etwa 2.000-5.000; ein Studium oder eine Ausbildung zur Winzerin ist der lange Weg. Lerne auch bei einem Weingut, bei dem du in der Lese helfen kannst.',
        ),
        links: [
          link(
            'Geisenheim University: viticulture',
            'Hochschule Geisenheim: Weinbau',
            'https://www.hs-geisenheim.de/',
          ),
        ],
      },
      cellar: {
        notes: p(
          'A press, stainless steel tanks, a cooling system, pumps and hoses: about 10,000-30,000 for a small cellar. Buy used steel tanks and borrow the press at first; cleanliness is the whole art of the cellar.',
          'Eine Presse, Edelstahltanks, eine Kühlung, Pumpen und Schläuche: etwa 10.000-30.000 für einen kleinen Keller. Kauf Edelstahltanks gebraucht und leih dir die Presse am Anfang; Sauberkeit ist die ganze Kunst des Kellers.',
        ),
      },
      vintage: {
        notes: p(
          'Two hectares give about 12,000-16,000 bottles in a normal year; the budget here covers bottles, corks, labels and boxes for the first 8,000. The first wine is sold about 12-18 months after the harvest.',
          'Zwei Hektar geben in einem normalen Jahr etwa 12.000-16.000 Flaschen; das Budget hier deckt Flaschen, Korken, Etiketten und Kartons für die ersten 8.000. Der erste Wein wird etwa 12-18 Monate nach der Lese verkauft.',
        ),
      },
      vines: {
        notes: p(
          'Replanting a quarter of the plot with a resistant grape costs about 20,000-30,000 per hectare including the posts and wires, and it bears fruit after three years. Resistant varieties need fewer sprays and fit a changing climate.',
          'Ein Viertel der Fläche mit einer pilzwiderstandsfähigen Rebe neu zu bepflanzen kostet etwa 20.000-30.000 je Hektar mit Pfählen und Draht, und trägt nach drei Jahren. Pilzwiderstandsfähige Sorten brauchen weniger Spritzungen und passen zu einem sich ändernden Klima.',
        ),
      },
      tasting: {
        notes: p(
          'A shed turned into a room for twenty guests: a bar, tables, a few lights and a cooler. A direct sale to guests pays far more per bottle than the wholesale; check the rules for serving.',
          'Ein Schuppen, der zum Raum für zwanzig Gäste wird: eine Theke, Tische, ein paar Lampen und ein Kühler. Der Direktverkauf an Gäste bringt weit mehr je Flasche als der Großhandel; prüfe die Regeln für den Ausschank.',
        ),
      },
    },
    links: [
      link(
        'Deutsche Weine: the wine regions',
        'Deutsche Weine: die Anbaugebiete',
        'https://www.deutscheweine.de/',
      ),
      link(
        'Geisenheim University: viticulture',
        'Hochschule Geisenheim: Weinbau',
        'https://www.hs-geisenheim.de/',
      ),
      link('German Wine Association', 'Deutscher Weinbauverband', 'https://www.dwv-online.de/'),
      link(
        "Founders' platform of the state",
        'Gründerplattform des Bundes',
        'https://www.existenzgruender.de/',
      ),
    ],
    actions: [
      step(
        'Help a winery in the harvest and learn the year',
        'In der Lese bei einem Weingut helfen und das Jahr kennenlernen',
        'high',
      ),
      step(
        'Take the courses in viticulture and cellar technique',
        'Die Kurse in Weinbau und Kellertechnik machen',
      ),
      step(
        'Look at three plots and take a local winemaker with you',
        'Drei Flächen ansehen und einen Winzer aus der Gegend mitnehmen',
        'high',
      ),
      step(
        'Talk to the chamber of agriculture about the registration',
        'Mit der Landwirtschaftskammer über die Anmeldung sprechen',
      ),
      step(
        'Buy tanks and the press used, and borrow at first',
        'Tanks und Presse gebraucht kaufen und am Anfang leihen',
      ),
      step(
        'Plan the sales: direct, a cooperative, restaurants',
        'Den Verkauf planen: direkt, Genossenschaft, Gastronomie',
      ),
      step(
        'Learn the rules for labels, taxes and serving',
        'Die Regeln für Etiketten, Steuern und Ausschank lernen',
      ),
      step(
        'Plan the cash for the long wait before the first sale',
        'Das Geld für die lange Wartezeit bis zum ersten Verkauf planen',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'A bad year - frost, hail, mould - can take the whole harvest: a reserve is part of the plan.',
        'Ein schlechtes Jahr - Frost, Hagel, Pilz - kann die ganze Ernte nehmen: eine Reserve gehört zum Plan.',
      ),
    ],
  },

  'peter-busfahrer': {
    description: p(
      'A cabin by the lake: a leased plot of 600 square metres, a log cabin kit of 28 square metres, a simple foundation, water and power from the road, a stove, bunk beds and a jetty with a rowing boat. A lease keeps the price low, but the land is not yours: read what it says about the end, the building and the way back. In most places a cabin to sleep in needs a building permit and a rule on the use - ask the municipality before you buy a kit. Every bucket is one part of the plan; the project is done when all of them are full.',
      'Eine Hütte am See: ein gepachtetes Grundstück von 600 Quadratmetern, ein Blockhaus-Bausatz von 28 Quadratmetern, ein einfaches Fundament, Wasser und Strom von der Straße, ein Ofen, Etagenbetten und ein Steg mit einem Ruderboot. Eine Pacht hält den Preis niedrig, aber das Land gehört dir nicht: lies, was sie über das Ende, den Bau und den Rückbau sagt. In den meisten Orten braucht eine Hütte zum Schlafen eine Baugenehmigung und eine Regelung zur Nutzung - frag die Gemeinde, bevor du einen Bausatz kaufst. Jeder Topf ist ein Teil des Plans; das Projekt ist fertig, wenn alle voll sind.',
    ),
    buckets: {
      plot: {
        notes: p(
          'A lease of a plot at a lake costs a first payment and then a yearly rent; the term is often 20-30 years. Read what happens at the end (do you have to take the cabin away?), whether you may sell the lease, and whether the plot is in a zone where building is allowed at all.',
          'Die Pacht eines Grundstücks am See kostet eine erste Zahlung und dann jährlich Pacht; die Laufzeit liegt oft bei 20-30 Jahren. Lies, was am Ende passiert (musst du die Hütte abbauen?), ob du die Pacht verkaufen darfst und ob das Grundstück überhaupt in einem Gebiet liegt, in dem gebaut werden darf.',
        ),
        links: [
          link(
            'Consumer advice: leases and land',
            'Verbraucherzentrale: Pacht und Grundstück',
            'https://www.verbraucherzentrale.de/',
          ),
        ],
      },
      kit: {
        notes: p(
          'A log cabin kit of 28 square metres with a roof and windows costs about 8,000-18,000 delivered on a lorry; the thickness of the walls (44-70 mm) decides how warm it is. Ask what is in the kit: the floor, the roof covering and the doors are often extra.',
          'Ein Blockhaus-Bausatz von 28 Quadratmetern mit Dach und Fenstern kostet etwa 8.000-18.000 per Lkw geliefert; die Wandstärke (44-70 mm) entscheidet, wie warm es ist. Frag, was im Bausatz enthalten ist: Boden, Dachdeckung und Türen sind oft extra.',
        ),
        links: [
          link(
            'Baunetz Wissen: building knowledge',
            'Baunetz Wissen: Bauwissen',
            'https://www.baunetzwissen.de/',
          ),
        ],
      },
      foundation: {
        notes: p(
          'Point foundations of concrete, a septic tank or a cesspit with a permit, water from a well or a pipe and power from the road: about 3,000-10,000, more if the road is far. A drilled well and a chemical toilet are the cheap start.',
          'Punktfundamente aus Beton, eine Klärgrube oder Sickergrube mit Genehmigung, Wasser aus Brunnen oder Leitung und Strom von der Straße: etwa 3.000-10.000, mehr wenn die Straße weit ist. Ein gebohrter Brunnen und eine Trockentoilette sind der günstige Start.',
        ),
      },
      fitting: {
        notes: p(
          'A wood stove (a small one of 4-6 kW), two bunk beds and a table for eight: about 1,500-3,500. The stove needs a chimney that the chimney sweep approves; use dry wood, and keep a fire extinguisher by the door.',
          'Ein Holzofen (ein kleiner mit 4-6 kW), zwei Etagenbetten und ein Tisch für acht: etwa 1.500-3.500. Der Ofen braucht einen Schornstein, den der Schornsteinfeger abnimmt; nutze trockenes Holz und halte einen Feuerlöscher an der Tür bereit.',
        ),
      },
      jetty: {
        notes: p(
          'A wooden jetty and a small rowing boat: about 1,000-3,000. A jetty at a lake often needs a permit from the water authority; ask first. Life jackets for everybody belong to the boat.',
          'Ein Holzsteg und ein kleines Ruderboot: etwa 1.000-3.000. Ein Steg an einem See braucht oft eine Genehmigung der Wasserbehörde; frag zuerst. Schwimmwesten für alle gehören zum Boot.',
        ),
      },
    },
    links: [
      link(
        'Consumer advice: leases and land',
        'Verbraucherzentrale: Pacht und Grundstück',
        'https://www.verbraucherzentrale.de/',
      ),
      link(
        'Baunetz Wissen: building knowledge',
        'Baunetz Wissen: Bauwissen',
        'https://www.baunetzwissen.de/',
      ),
      link(
        'Federal Agency for Nature Conservation',
        'Bundesamt für Naturschutz',
        'https://www.bfn.de/',
      ),
    ],
    actions: [
      step(
        'Ask the municipality what may be built and used on the plot',
        'Die Gemeinde fragen, was auf dem Grundstück gebaut und genutzt werden darf',
        'high',
      ),
      step(
        'Read the lease with a lawyer: the end, the sale, the way back',
        'Den Pachtvertrag mit einem Anwalt lesen: Ende, Verkauf, Rückbau',
        'high',
      ),
      step(
        'Compare three kits: wall thickness, what is in the price',
        'Drei Bausätze vergleichen: Wandstärke, was im Preis enthalten ist',
      ),
      step(
        'Plan the foundation, the water and the toilet before the kit',
        'Fundament, Wasser und Toilette vor dem Bausatz planen',
      ),
      step('Ask the water authority about a jetty', 'Die Wasserbehörde nach einem Steg fragen'),
      step('Ask the chimney sweep about the stove', 'Den Schornsteinfeger zum Ofen fragen'),
      step(
        'Visit the lake in winter and in the rain',
        'Den See im Winter und im Regen besuchen',
        'low',
      ),
      step(
        'Build with friends: a weekend of work, a barbecue after',
        'Mit Freunden bauen: ein Wochenende Arbeit, danach Grillen',
        'low',
      ),
    ],
    notes: [
      p('The costs are estimates in game money.', 'Die Kosten sind Schätzungen in Spielgeld.'),
      p(
        'A cabin is simple: what is not there cannot break - but the permit and the lease are the real work.',
        'Eine Hütte ist einfach: was nicht da ist, kann nicht kaputtgehen - aber Genehmigung und Pacht sind die eigentliche Arbeit.',
      ),
    ],
  },
};

/** A character's dream project as its one language, with the detail of the life dream (the other characters are left as they are). */
export function withLifeDreamDetails(
  project: CashflowDreamProject,
  professionId: string,
  lang: Lang,
): CashflowDreamProject {
  const detail = LIFE_DREAM_DETAILS[professionId];
  if (!detail) return project;
  return {
    ...project,
    description: detail.description[lang],
    buckets: project.buckets.map((bucket) => {
      const extra = detail.buckets[bucket.id];
      return extra
        ? {
            ...bucket,
            notes: extra.notes[lang],
            ...(extra.links
              ? { links: extra.links.map((l) => ({ label: l.label[lang], url: l.url })) }
              : {}),
          }
        : bucket;
    }),
    links: detail.links.map((l) => ({ label: l.label[lang], url: l.url })),
    actionItems: detail.actions.map((a) => ({ text: a.text[lang], priority: a.priority })),
    notes: detail.notes.map((n) => n[lang]),
  };
}
