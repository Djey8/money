/**
 * The nine characters of the Dreamfund edition next to the Dual Student (JFK, 2026-10-27): ten lives from 23 to 57, from an apprentice's
 * pay to a surgeon's, each with a story, a dream that costs what it really costs, a career with its own ladder - and numbers that make
 * them comparable. A high salary comes with high expenses, bigger debts and a bigger dream (and bigger cards: the price level), so
 * every character plays like the Dual Student at another scale; what makes one harder than another is how much is left of a month,
 * and that is a number in the description (`ease`), not an accident. The numbers are in euros of the Medium level.
 * Kept out of the domain package's main entry; `cashflow-professions-builder.ts` builds the three difficulties of each.
 */
import type { ProfessionSpec } from './cashflow-professions-builder';

export const DREAMFUND_SPECS: ProfessionSpec[] = [
  // ───────────────────────────────────────── 26: the journeyman electrician
  {
    id: 'mehmet-elektroniker',
    title: 'Elektroniker für Energie- und Gebäudetechnik',
    name: { en: 'Mehmet', de: 'Mehmet' },
    tagline: {
      en: 'Journeyman electrician with a plan: master craftsman and his own workshop',
      de: 'Elektroniker-Geselle mit einem Plan: Meisterbrief und eigene Werkstatt',
    },
    background: {
      en: 'Mehmet finished his apprenticeship at a medium-sized electrical firm in Augsburg three years ago and has not stopped working since. He is good with his hands, quick with a fault, and the customers ask for him by name. He lives in a small flat, drives an old van-like estate he is still paying off and owes his parents for the tools he needed in the first year.',
      de: 'Mehmet hat vor drei Jahren seine Ausbildung in einem mittelständischen Elektrobetrieb in Augsburg beendet und seitdem nicht aufgehört zu arbeiten. Er ist handwerklich geschickt, findet jeden Fehler schnell, und die Kunden fragen nach ihm. Er wohnt in einer kleinen Wohnung, fährt einen alten Kombi, den er noch abbezahlt, und schuldet seinen Eltern Geld für das Werkzeug des ersten Jahres.',
    },
    values: [
      {
        en: 'His own name on the van: he wants to be his own boss',
        de: 'Sein Name auf dem Transporter: er will sein eigener Chef sein',
      },
      {
        en: 'Craft first: a job done right is a job that is recommended',
        de: 'Handwerk zuerst: eine gut gemachte Arbeit wird weiterempfohlen',
      },
      {
        en: 'Family: he sends money home and wants to be someone who can help',
        de: 'Familie: er schickt Geld nach Hause und will jemand sein, der helfen kann',
      },
    ],
    gross: 3150,
    scale: 1.1,
    ease: 1.3,
    savings: 900,
    debts: [
      {
        key: 'parentsLoan',
        tag: 'Eltern-Darlehen',
        label: { en: 'loan from your parents', de: 'das Darlehen deiner Eltern' },
        amount: 1500,
      },
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 2500,
      },
    ],
    homeAmount: 650,
    extras: [{ key: 'car', title: 'Auto & Mobilität', amount: 280 }],
    dream: {
      title: {
        en: 'Master electrician with his own workshop',
        de: 'Elektromeister mit eigener Werkstatt',
      },
      sub: {
        en: 'The master certificate, a van, the tools - and a name on the door',
        de: 'Der Meisterbrief, ein Transporter, das Werkzeug - und ein Name an der Tür',
      },
      summary: {
        en: 'Pass the master school part-time, found his own electrical business and equip a first van. In this game it is his first Smile project.',
        de: 'Die Meisterschule in Teilzeit bestehen, einen eigenen Elektrobetrieb gründen und einen ersten Transporter ausrüsten. Im Spiel ist es sein erstes Smile-Projekt.',
      },
      description: {
        en: 'The way from journeyman to boss: the master school in two parts (the craft, then business and teaching), the exam fees and the master piece, then the founding itself - registering, insurance, the first tools and a used van. Every bucket is one step; the project is done when all of them are full.',
        de: 'Der Weg vom Gesellen zum Chef: die Meisterschule in zwei Teilen (das Handwerk, dann Betriebswirtschaft und Ausbildung), die Prüfungsgebühren und das Meisterstück, dann die Gründung selbst - Anmeldung, Versicherungen, das erste Werkzeug und ein gebrauchter Transporter. Jeder Topf ist ein Schritt; das Projekt ist fertig, wenn alle voll sind.',
      },
      buckets: [
        {
          id: 'school12',
          title: { en: 'Master school, parts I and II', de: 'Meisterschule, Teil I und II' },
          amount: 9000,
          note: {
            en: 'The practical and the technical part, part-time in the evenings and on Saturdays; the fees are an estimate (the state pays a part back as upgrading support).',
            de: 'Der praktische und der fachtheoretische Teil, in Teilzeit abends und samstags; die Gebühren sind eine Schätzung (ein Teil kommt als Aufstiegs-BAföG zurück).',
          },
        },
        {
          id: 'school34',
          title: { en: 'Master school, parts III and IV', de: 'Meisterschule, Teil III und IV' },
          amount: 2500,
          note: {
            en: 'Business, law and the trainer licence - what you need to run a firm and to train apprentices.',
            de: 'Betriebswirtschaft, Recht und die Ausbildereignung - was man braucht, um einen Betrieb zu führen und Lehrlinge auszubilden.',
          },
        },
        {
          id: 'exam',
          title: { en: 'Exams and master piece', de: 'Prüfungen und Meisterstück' },
          amount: 2000,
          note: {
            en: 'The exam fees of the chamber of crafts and the material for the master piece.',
            de: 'Die Prüfungsgebühren der Handwerkskammer und das Material für das Meisterstück.',
          },
        },
        {
          id: 'founding',
          title: { en: 'Founding the business', de: 'Gründung des Betriebs' },
          amount: 1500,
          note: {
            en: 'Trade registration, the chamber, the liability and tool insurance and a bit of advertising.',
            de: 'Gewerbeanmeldung, Kammer, Betriebshaftpflicht und Werkzeugversicherung und ein bisschen Werbung.',
          },
        },
        {
          id: 'tools',
          title: { en: 'Tools and measuring devices', de: 'Werkzeug und Messgeräte' },
          amount: 5500,
          note: {
            en: 'A tester for the safety checks, installation tools and a cable finder - what the customers expect.',
            de: 'Ein Prüfgerät für die Sicherheitsprüfungen, Installationswerkzeug und ein Leitungssucher - was die Kunden erwarten.',
          },
        },
        {
          id: 'van',
          title: { en: 'A used van', de: 'Ein gebrauchter Transporter' },
          amount: 6500,
          note: {
            en: 'A three-year-old panel van with shelves: the workshop on four wheels.',
            de: 'Ein drei Jahre alter Kastenwagen mit Regalen: die Werkstatt auf vier Rädern.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money; the chamber of crafts and the state upgrading support (Aufstiegs-BAföG) publish the real ones.',
          de: 'Die Kosten sind Schätzungen in Spielgeld; die Handwerkskammer und das Aufstiegs-BAföG nennen die echten.',
        },
      ],
    },
    ladder: [
      {
        id: 'E1',
        title: { en: 'Journeyman electrician', de: 'Elektroniker-Geselle' },
        story: {
          en: 'You know every fuse box in the district. The boss trusts you with the small jobs alone.',
          de: 'Du kennst jeden Sicherungskasten im Viertel. Der Chef lässt dich die kleinen Aufträge allein machen.',
        },
        grossYear: 37800,
        minPaydays: 3,
        rollFrom: 4,
      },
      {
        id: 'E2',
        title: { en: 'Service technician', de: 'Servicetechniker' },
        story: {
          en: 'You run the repairs and fault calls of the firm, with a company phone and a van of your own.',
          de: 'Du fährst die Reparaturen und Störungsdienste der Firma, mit Diensthandy und eigenem Transporter.',
        },
        grossYear: 44400,
        minPaydays: 4,
        rollFrom: 4,
      },
      {
        id: 'E3',
        title: { en: 'Lead fitter', de: 'Obermonteur' },
        story: {
          en: 'You lead a team of three on the bigger building sites and plan the material.',
          de: 'Du führst ein Team von drei auf den größeren Baustellen und planst das Material.',
        },
        grossYear: 51600,
        minPaydays: 4,
        rollFrom: 5,
      },
      {
        id: 'E4',
        title: { en: 'Master electrician', de: 'Elektromeister' },
        story: {
          en: 'The master certificate hangs on the wall. You train the apprentices and calculate the offers.',
          de: 'Der Meisterbrief hängt an der Wand. Du bildest die Lehrlinge aus und kalkulierst die Angebote.',
        },
        grossYear: 60000,
        minPaydays: 5,
        rollFrom: 5,
        bonusPercent: 4,
      },
      {
        id: 'E5',
        title: { en: 'Technical manager', de: 'Technischer Betriebsleiter' },
        story: {
          en: 'Twelve people, a fleet of vans and an order book that is full until spring.',
          de: 'Zwölf Leute, ein Fuhrpark und ein Auftragsbuch, das bis zum Frühjahr voll ist.',
        },
        grossYear: 70800,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 6,
      },
    ],
  },
  // ───────────────────────────────────────── 29: the nurse and single mother
  {
    id: 'lena-pflege',
    title: 'Pflegefachfrau',
    name: { en: 'Lena', de: 'Lena' },
    tagline: {
      en: 'Nurse and single mum, dreaming of a year on the road with her daughter',
      de: 'Pflegefachfrau und alleinerziehend, mit dem Traum von einem Jahr auf Achse mit ihrer Tochter',
    },
    background: {
      en: 'Lena works shifts on a surgical ward in Hannover and is raising Emma, who is three, on her own. Early shifts mean the daycare opens too late, late shifts mean a neighbour, weekends mean her mother. Every euro is planned. She has a small second-hand car, a credit card she does not like to look at and a folder of pictures of campervans.',
      de: 'Lena arbeitet im Schichtdienst auf einer chirurgischen Station in Hannover und zieht Emma, die drei ist, allein groß. Frühdienst heißt: die Kita öffnet zu spät, Spätdienst heißt: die Nachbarin, Wochenenden heißen: ihre Mutter. Jeder Euro ist verplant. Sie hat ein kleines gebrauchtes Auto, eine Kreditkarte, die sie ungern ansieht, und einen Ordner mit Bildern von Campingbussen.',
    },
    values: [
      {
        en: 'Emma first: time with her daughter is worth more than things',
        de: 'Emma zuerst: Zeit mit ihrer Tochter ist mehr wert als Dinge',
      },
      {
        en: 'Care for others is her job - she wants one day to care for herself',
        de: 'Sich um andere zu kümmern ist ihr Beruf - eines Tages will sie sich um sich selbst kümmern',
      },
      {
        en: 'Security: no more nights of worrying about the next bill',
        de: 'Sicherheit: keine Nächte mehr mit Sorgen um die nächste Rechnung',
      },
    ],
    gross: 3450,
    pay: { children: true },
    scale: 1.2,
    ease: 1.0,
    savings: 600,
    debts: [
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 2500,
      },
      {
        key: 'creditCardDebt',
        tag: 'Kreditkartenschulden',
        label: { en: 'credit-card debt', de: 'die Kreditkartenschulden' },
        amount: 1500,
      },
    ],
    homeAmount: 820,
    extras: [
      { key: 'childcare', title: 'Kita & Kind', amount: 360 },
      { key: 'car', title: 'Auto & Mobilität', amount: 190 },
    ],
    dream: {
      title: { en: 'A year on the road with Emma', de: 'Ein Jahr mit Emma auf Achse' },
      sub: {
        en: 'A campervan, six months off and the coast of Europe',
        de: 'Ein Campingbus, ein halbes Jahr Auszeit und die Küsten Europas',
      },
      summary: {
        en: 'Buy and fit out a campervan, save for six months without pay and travel Europe with her daughter. In this game it is her first Smile project.',
        de: 'Einen Campingbus kaufen und ausbauen, für sechs Monate ohne Gehalt sparen und mit ihrer Tochter Europa bereisen. Im Spiel ist es ihr erstes Smile-Projekt.',
      },
      description: {
        en: 'A big trip needs a vehicle, a place to sleep and a cushion for the months without a salary. The buckets are the van, its fitting-out, the months off, the road costs and the insurances that make it safe for a child.',
        de: 'Eine große Reise braucht ein Fahrzeug, einen Schlafplatz und ein Polster für die Monate ohne Gehalt. Die Töpfe sind der Bus, sein Ausbau, die Monate frei, die Kosten unterwegs und die Versicherungen, die es für ein Kind sicher machen.',
      },
      buckets: [
        {
          id: 'van',
          title: { en: 'The van', de: 'Der Bus' },
          amount: 15000,
          note: {
            en: 'A used panel van of five to seven years, with a service history.',
            de: 'Ein gebrauchter Kastenwagen von fünf bis sieben Jahren, mit Scheckheft.',
          },
        },
        {
          id: 'fitting',
          title: { en: 'Fitting out', de: 'Ausbau' },
          amount: 5500,
          note: {
            en: 'Bed, kitchen block, insulation, a small solar panel and a heater - a safe seat for Emma.',
            de: 'Bett, Küchenblock, Dämmung, ein kleines Solarmodul und eine Heizung - ein sicherer Sitz für Emma.',
          },
        },
        {
          id: 'leave',
          title: { en: 'Six months without pay', de: 'Sechs Monate ohne Gehalt' },
          amount: 6000,
          note: {
            en: 'Unpaid leave: the part of the rent and the fixed costs that keeps running at home.',
            de: 'Unbezahlte Freistellung: der Teil der Miete und der Fixkosten, der zu Hause weiterläuft.',
          },
        },
        {
          id: 'road',
          title: { en: 'On the road', de: 'Unterwegs' },
          amount: 2500,
          note: {
            en: 'Fuel, campsites, ferries and the odd restaurant in the evening.',
            de: 'Sprit, Stellplätze, Fähren und ab und zu ein Restaurant am Abend.',
          },
        },
        {
          id: 'safety',
          title: { en: 'Insurances and safety', de: 'Versicherungen und Sicherheit' },
          amount: 1500,
          note: {
            en: 'Travel health cover, breakdown cover and a child seat that is approved for the van.',
            de: 'Auslandskrankenversicherung, Schutzbrief und ein Kindersitz, der für den Bus zugelassen ist.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'L1',
        title: { en: 'Registered nurse', de: 'Pflegefachfrau' },
        story: {
          en: 'Three years in, you run your own patient group on the ward - and the night shifts are yours too.',
          de: 'Nach drei Jahren führst du deine eigene Patientengruppe auf Station - und die Nachtdienste gehören dir auch.',
        },
        grossYear: 41400,
        minPaydays: 3,
        rollFrom: 4,
      },
      {
        id: 'L2',
        title: { en: 'Practice instructor', de: 'Praxisanleiterin' },
        story: {
          en: 'You train the apprentices on the ward. A course after work, and a bit more pay.',
          de: 'Du leitest die Auszubildenden auf Station an. Ein Kurs nach der Arbeit, und etwas mehr Gehalt.',
        },
        grossYear: 46800,
        minPaydays: 4,
        rollFrom: 4,
      },
      {
        id: 'L3',
        title: { en: 'Ward manager', de: 'Stationsleitung' },
        story: {
          en: 'The ward is yours: the roster, the budget and twenty people who look to you.',
          de: 'Die Station gehört dir: der Dienstplan, das Budget und zwanzig Leute, die auf dich schauen.',
        },
        grossYear: 54000,
        minPaydays: 5,
        rollFrom: 5,
      },
      {
        id: 'L4',
        title: { en: 'Director of nursing', de: 'Pflegedienstleitung' },
        story: {
          en: 'Four wards, a seat at the table of the hospital and a salary that finally leaves some air.',
          de: 'Vier Stationen, ein Platz am Tisch der Klinikleitung und ein Gehalt, das endlich etwas Luft lässt.',
        },
        grossYear: 65000,
        minPaydays: 6,
        rollFrom: 5,
        bonusPercent: 3,
      },
      {
        id: 'L5',
        title: { en: 'Chief nursing officer', de: 'Pflegedirektorin' },
        story: {
          en: 'Responsible for all nursing of a hospital group - the job you once thought was for others.',
          de: 'Verantwortlich für die gesamte Pflege eines Klinikverbunds - der Job, den du einst für andere hieltest.',
        },
        grossYear: 82000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 6,
      },
    ],
  },
  // ───────────────────────────────────────── 33: the primary school teacher
  {
    id: 'sophie-lehrerin',
    title: 'Grundschullehrerin (Beamtin)',
    name: { en: 'Sophie', de: 'Sophie' },
    tagline: {
      en: 'Primary school teacher, dreaming of a year at sea',
      de: 'Grundschullehrerin, mit dem Traum von einem Jahr auf See',
    },
    background: {
      en: 'Sophie teaches a class of 24 seven-year-olds in Freiburg and has been a civil servant for a year. The job is secure, the holidays are long and the evenings are full of marking. She sails whenever she can, mostly on borrowed boats, and she has always wanted to sail for a whole year. A student loan from her teaching degree and a car for the commute are all she owes.',
      de: 'Sophie unterrichtet in Freiburg eine Klasse mit 24 Siebenjährigen und ist seit einem Jahr Beamtin. Der Job ist sicher, die Ferien sind lang, und die Abende gehören den Korrekturen. Sie segelt, wann immer sie kann, meist auf geliehenen Booten, und wollte schon immer ein ganzes Jahr segeln. Ein BAföG-Darlehen aus dem Lehramtsstudium und ein Auto für den Schulweg sind alles, was sie schuldet.',
    },
    values: [
      {
        en: 'Children: she wants every child in her class to leave stronger',
        de: 'Kinder: jedes Kind ihrer Klasse soll gestärkt gehen',
      },
      {
        en: 'Freedom: the sea is the place where she can think',
        de: 'Freiheit: auf dem Meer kann sie denken',
      },
      {
        en: 'Order: a secure job, a plan for everything - and one big exception',
        de: 'Ordnung: ein sicherer Job, für alles ein Plan - und eine große Ausnahme',
      },
    ],
    gross: 4350,
    pay: { civilServant: true },
    scale: 1.5,
    ease: 1.15,
    savings: 2500,
    debts: [
      {
        key: 'studentLoanDebt',
        tag: 'BAföG-Darlehen',
        label: { en: 'student loan', de: 'das BAföG-Darlehen' },
        amount: 5000,
      },
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 1500,
      },
    ],
    homeAmount: 1050,
    extras: [{ key: 'car', title: 'Auto & Mobilität', amount: 230 }],
    dream: {
      title: { en: 'A year under sail', de: 'Ein Jahr unter Segeln' },
      sub: {
        en: 'The licences, the gear, a sabbatical year and a boat in the Mediterranean',
        de: 'Die Scheine, die Ausrüstung, ein Sabbatjahr und ein Boot im Mittelmeer',
      },
      summary: {
        en: 'Get the sailing licences, take a sabbatical and charter a boat for a long voyage in the Mediterranean. In this game it is her first Smile project.',
        de: 'Die Segelscheine machen, ein Sabbatjahr nehmen und ein Boot für eine lange Reise im Mittelmeer chartern. Im Spiel ist es ihr erstes Smile-Projekt.',
      },
      description: {
        en: 'A year at sea is a plan with parts: the licences that let her skipper, the gear, the pay she does not get in her sabbatical year, the charter itself and the insurances.',
        de: 'Ein Jahr auf See ist ein Plan mit Teilen: die Scheine, die sie zum Skipper machen, die Ausrüstung, das Gehalt, das sie im Sabbatjahr nicht bekommt, der Charter selbst und die Versicherungen.',
      },
      buckets: [
        {
          id: 'licences',
          title: { en: 'Sailing licences', de: 'Segelscheine' },
          amount: 3200,
          note: {
            en: 'The inland and the sea licence and the coastal skipper licence, with the practical courses.',
            de: 'Der Binnen- und der Seeschein und der Küstenschifferschein, mit den Praxiskursen.',
          },
        },
        {
          id: 'gear',
          title: { en: 'Gear and clothing', de: 'Ausrüstung und Kleidung' },
          amount: 2400,
          note: {
            en: 'Oilskins, a lifejacket with a harness, a handheld VHF and a good headlamp.',
            de: 'Ölzeug, eine Rettungsweste mit Gurt, ein Handfunkgerät und eine gute Stirnlampe.',
          },
        },
        {
          id: 'sabbatical',
          title: { en: 'The sabbatical year', de: 'Das Sabbatjahr' },
          amount: 18000,
          note: {
            en: 'A year of reduced pay: the months at the end of the saving period that are paid at a part of the salary.',
            de: 'Ein Jahr mit gekürztem Gehalt: die Monate am Ende der Ansparphase, die nur zu einem Teil des Gehalts bezahlt werden.',
          },
        },
        {
          id: 'charter',
          title: { en: 'The charter', de: 'Der Charter' },
          amount: 9500,
          note: {
            en: 'A 38-foot yacht for eight weeks in Croatia and Greece, with the deposit and the final cleaning.',
            de: 'Eine 38-Fuß-Yacht für acht Wochen in Kroatien und Griechenland, mit Kaution und Endreinigung.',
          },
        },
        {
          id: 'insurance',
          title: { en: 'Insurances', de: 'Versicherungen' },
          amount: 1800,
          note: {
            en: 'Skipper liability, sea-travel health cover and a cancellation insurance.',
            de: 'Skipper-Haftpflicht, Auslandskrankenversicherung und eine Reiserücktrittsversicherung.',
          },
        },
        {
          id: 'return',
          title: { en: 'The way home', de: 'Der Weg zurück' },
          amount: 1500,
          note: {
            en: 'Flights home, storage of the flat and a cushion for the first month back.',
            de: 'Flüge nach Hause, Einlagerung der Wohnung und ein Polster für den ersten Monat zurück.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'S1',
        title: { en: 'Primary school teacher', de: 'Grundschullehrerin' },
        story: {
          en: 'Your class knows how to line up at last - and you know all 24 names and all 24 stories.',
          de: 'Deine Klasse kann sich endlich anstellen - und du kennst alle 24 Namen und alle 24 Geschichten.',
        },
        grossYear: 52200,
        minPaydays: 3,
        rollFrom: 4,
      },
      {
        id: 'S2',
        title: { en: 'Subject coordinator', de: 'Fachleiterin' },
        story: {
          en: 'You lead the maths of the whole school and train the new colleagues.',
          de: 'Du leitest die Mathematik der ganzen Schule und führst die neuen Kolleginnen ein.',
        },
        grossYear: 58800,
        minPaydays: 4,
        rollFrom: 4,
      },
      {
        id: 'S3',
        title: { en: 'Deputy head', de: 'Konrektorin' },
        story: {
          en: 'Timetables, parents evenings and the odd fire alarm: the deputy head keeps the school running.',
          de: 'Stundenpläne, Elternabende und der ein oder andere Feueralarm: die Konrektorin hält die Schule am Laufen.',
        },
        grossYear: 66000,
        minPaydays: 5,
        rollFrom: 5,
      },
      {
        id: 'S4',
        title: { en: 'Head teacher', de: 'Rektorin' },
        story: {
          en: 'Your name is on the door of a school of 300 children and 25 teachers.',
          de: 'Dein Name steht an der Tür einer Schule mit 300 Kindern und 25 Lehrkräften.',
        },
        grossYear: 75600,
        minPaydays: 6,
        rollFrom: 5,
      },
      {
        id: 'S5',
        title: { en: 'School superintendent', de: 'Schulamtsdirektorin' },
        story: {
          en: 'You advise forty schools of the district. Less chalk, more policy.',
          de: 'Du berätst vierzig Schulen des Bezirks. Weniger Kreide, mehr Politik.',
        },
        grossYear: 86400,
        minPaydays: 6,
        rollFrom: 6,
      },
    ],
  },
  // ───────────────────────────────────────── 36: the freelance designer
  {
    id: 'tobias-designer',
    title: 'Freiberuflicher Grafikdesigner',
    name: { en: 'Tobias', de: 'Tobias' },
    tagline: {
      en: 'Freelance graphic designer, dreaming of his own studio and gallery',
      de: 'Freiberuflicher Grafikdesigner, mit dem Traum vom eigenen Atelier mit Galerie',
    },
    background: {
      en: 'Tobias designs logos, posters and books for a handful of regular customers in Cologne. Some months are great, some are quiet, and he pays for his own health insurance and his own pension plans. He studied on a student loan and bought his equipment with a credit line. What he wants is a loft with big windows - a studio in the back, a gallery in the front.',
      de: 'Tobias gestaltet Logos, Plakate und Bücher für eine Handvoll Stammkunden in Köln. Manche Monate sind großartig, manche still, und er zahlt seine Krankenversicherung und seine Altersvorsorge selbst. Er hat mit einem Studienkredit studiert und seine Ausstattung über einen Kreditrahmen gekauft. Was er will, ist ein Loft mit großen Fenstern - hinten das Atelier, vorne die Galerie.',
    },
    values: [
      {
        en: 'Independence: he answers to his customers, not to a boss',
        de: 'Unabhängigkeit: er antwortet seinen Kunden, nicht einem Chef',
      },
      {
        en: 'Craft and beauty: a good poster can change a street',
        de: 'Handwerk und Schönheit: ein gutes Plakat kann eine Straße verändern',
      },
      {
        en: 'A place for art: other artists should have a wall too',
        de: 'Ein Ort für Kunst: auch andere Künstler sollen eine Wand haben',
      },
    ],
    gross: 3900,
    pay: { selfEmployed: true },
    scale: 1.4,
    ease: 1.0,
    savings: 1200,
    debts: [
      {
        key: 'studentLoanDebt',
        tag: 'Studienkredit',
        label: { en: 'student loan', de: 'den Studienkredit' },
        amount: 5000,
      },
      {
        key: 'creditCardDebt',
        tag: 'Kreditrahmen',
        label: { en: 'credit line', de: 'den Kreditrahmen' },
        amount: 2000,
      },
    ],
    homeAmount: 1050,
    extras: [{ key: 'workTools', title: 'Arbeitsmittel & Software', amount: 220 }],
    dream: {
      title: { en: 'Studio and gallery in a loft', de: 'Atelier und Galerie im Loft' },
      sub: {
        en: 'A bright loft: the studio behind, the gallery in front',
        de: 'Ein helles Loft: hinten das Atelier, vorne die Galerie',
      },
      summary: {
        en: 'Rent and convert a loft, equip the studio, open a gallery with an opening night and keep it running for half a year. In this game it is his first Smile project.',
        de: 'Ein Loft mieten und umbauen, das Atelier ausstatten, eine Galerie mit einer Vernissage eröffnen und sie ein halbes Jahr tragen. Im Spiel ist es sein erstes Smile-Projekt.',
      },
      description: {
        en: 'A studio with a gallery is a small company: the deposit and the conversion, the machines, the room for the exhibitions, the opening and the months until it carries itself.',
        de: 'Ein Atelier mit Galerie ist ein kleines Unternehmen: die Kaution und der Umbau, die Maschinen, der Raum für die Ausstellungen, die Eröffnung und die Monate, bis es sich trägt.',
      },
      buckets: [
        {
          id: 'loft',
          title: { en: 'Deposit and conversion', de: 'Kaution und Umbau' },
          amount: 12500,
          note: {
            en: 'Three months of deposit for the commercial lease, a new floor, walls and a few doors.',
            de: 'Drei Monate Kaution für den Gewerbemietvertrag, ein neuer Boden, Wände und ein paar Türen.',
          },
        },
        {
          id: 'studio',
          title: { en: 'Studio equipment', de: 'Atelierausstattung' },
          amount: 8500,
          note: {
            en: 'A large-format printer, a cutter, worktables and a good screen.',
            de: 'Ein Großformatdrucker, ein Schneidegerät, Arbeitstische und ein guter Bildschirm.',
          },
        },
        {
          id: 'gallery',
          title: { en: 'Gallery fittings', de: 'Galerie-Einrichtung' },
          amount: 5000,
          note: {
            en: 'Hanging rails, spotlights and plinths for the exhibitions.',
            de: 'Hängeschienen, Strahler und Sockel für die Ausstellungen.',
          },
        },
        {
          id: 'opening',
          title: { en: 'The opening night', de: 'Die Vernissage' },
          amount: 4000,
          note: {
            en: 'Invitations, drinks, a small band and the first press.',
            de: 'Einladungen, Getränke, eine kleine Band und die erste Presse.',
          },
        },
        {
          id: 'buffer',
          title: { en: 'Six months of rent', de: 'Sechs Monate Miete' },
          amount: 8000,
          note: {
            en: 'The cushion until the gallery brings in enough.',
            de: 'Das Polster, bis die Galerie genug einbringt.',
          },
        },
        {
          id: 'web',
          title: { en: 'Website and shop', de: 'Website und Shop' },
          amount: 2000,
          note: {
            en: 'A site that shows the studio and sells the prints.',
            de: 'Eine Seite, die das Atelier zeigt und die Drucke verkauft.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'T1',
        title: { en: 'Freelance designer', de: 'Freiberuflicher Designer' },
        story: {
          en: 'Five regular customers and one big one you try not to lose.',
          de: 'Fünf Stammkunden und ein großer, den du nicht verlieren willst.',
        },
        grossYear: 46800,
        minPaydays: 4,
        rollFrom: 5,
      },
      {
        id: 'T2',
        title: { en: 'Designer with a name', de: 'Designer mit Namen' },
        story: {
          en: 'A poster of yours won a prize. Now the customers come to you.',
          de: 'Ein Plakat von dir hat einen Preis gewonnen. Jetzt kommen die Kunden zu dir.',
        },
        grossYear: 55200,
        minPaydays: 5,
        rollFrom: 5,
      },
      {
        id: 'T3',
        title: { en: 'Studio with two employees', de: 'Studio mit zwei Angestellten' },
        story: {
          en: 'Two colleagues, a lease and the first month in which you are not sure you can pay everyone.',
          de: 'Zwei Kollegen, ein Mietvertrag und der erste Monat, in dem du nicht sicher bist, alle bezahlen zu können.',
        },
        grossYear: 67200,
        minPaydays: 6,
        rollFrom: 5,
      },
      {
        id: 'T4',
        title: { en: 'Creative director', de: 'Creative Director' },
        story: {
          en: 'Your studio has a name that opens doors - and a waiting list.',
          de: 'Dein Studio hat einen Namen, der Türen öffnet - und eine Warteliste.',
        },
        grossYear: 84000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 8,
      },
    ],
  },
  // ───────────────────────────────────────── 40: the marketing director with a family
  {
    id: 'katrin-marketing',
    title: 'Marketingleiterin',
    name: { en: 'Katrin', de: 'Katrin' },
    tagline: {
      en: 'Head of marketing and mother of two, dreaming of a house by the Baltic Sea',
      de: 'Marketingleiterin und Mutter von zwei Kindern, mit dem Traum vom Haus an der Ostsee',
    },
    background: {
      en: 'Katrin runs the marketing of a consumer-goods firm near Düsseldorf. Her husband works part-time and does the school runs; the two children, seven and ten, fill every weekend. The row house is nearly right, the mortgage is long and the calendar is full. What she really wants is a house on the Baltic coast where the whole family can spend the summers.',
      de: 'Katrin leitet das Marketing eines Konsumgüterunternehmens bei Düsseldorf. Ihr Mann arbeitet in Teilzeit und macht die Schulwege; die beiden Kinder, sieben und zehn, füllen jedes Wochenende. Das Reihenhaus ist fast richtig, die Hypothek lang und der Kalender voll. Was sie wirklich will, ist ein Haus an der Ostseeküste, in dem die ganze Familie die Sommer verbringen kann.',
    },
    values: [
      {
        en: 'Family: summers together, without a phone in hand',
        de: 'Familie: Sommer zusammen, ohne Handy in der Hand',
      },
      {
        en: 'Achievement: she is proud of what she built and wants more of it',
        de: 'Leistung: sie ist stolz auf das, was sie aufgebaut hat, und will mehr davon',
      },
      {
        en: 'A place that stays: something the children will inherit',
        de: 'Ein Ort, der bleibt: etwas, das die Kinder erben',
      },
    ],
    gross: 6300,
    pay: { splitting: true, children: true },
    creep: 0.35,
    scale: 2.2,
    ease: 0.9,
    savings: 3500,
    debts: [
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 5000,
      },
      {
        key: 'renovationLoan',
        tag: 'Modernisierungskredit',
        label: { en: 'home-improvement loan', de: 'den Modernisierungskredit' },
        amount: 3000,
      },
    ],
    homeKey: 'mortgageRent',
    homeTitle: 'Eigenheim-Hypothek',
    homeAmount: 1650,
    extras: [
      { key: 'childcare', title: 'Kinder & Betreuung', amount: 600 },
      { key: 'car', title: 'Auto & Mobilität', amount: 480 },
    ],
    dream: {
      title: { en: 'A house by the Baltic Sea', de: 'Ein Haus an der Ostsee' },
      sub: {
        en: 'A small house on the coast for the family summers',
        de: 'Ein kleines Haus an der Küste für die Sommer der Familie',
      },
      summary: {
        en: 'Buy a small house on the Baltic coast: the deposit, the costs of buying, a renovation and the furniture. In this game it is her first Smile project.',
        de: 'Ein kleines Haus an der Ostseeküste kaufen: die Anzahlung, die Kaufnebenkosten, eine Sanierung und die Einrichtung. Im Spiel ist es ihr erstes Smile-Projekt.',
      },
      description: {
        en: 'A holiday house is bought once and lived in for decades: the deposit that the bank asks for, the costs that come with every purchase, the renovation that every old house needs and the reserve for what breaks.',
        de: 'Ein Ferienhaus wird einmal gekauft und jahrzehntelang bewohnt: die Anzahlung, die die Bank verlangt, die Kosten, die jeder Kauf mit sich bringt, die Sanierung, die jedes alte Haus braucht, und die Rücklage für das, was kaputtgeht.',
      },
      buckets: [
        {
          id: 'deposit',
          title: { en: 'The deposit', de: 'Die Anzahlung' },
          amount: 36000,
          note: {
            en: 'Twenty per cent of a small house of 180,000 - the bank finances the rest.',
            de: 'Zwanzig Prozent eines kleinen Hauses für 180.000 - den Rest finanziert die Bank.',
          },
        },
        {
          id: 'costs',
          title: { en: 'Costs of buying', de: 'Kaufnebenkosten' },
          amount: 10500,
          note: {
            en: 'Notary, land registry, property transfer tax and the agent.',
            de: 'Notar, Grundbuch, Grunderwerbsteuer und Makler.',
          },
        },
        {
          id: 'renovation',
          title: { en: 'Renovation', de: 'Sanierung' },
          amount: 14000,
          note: {
            en: 'A new roof section, a bathroom and the windows facing the wind.',
            de: 'Ein neuer Dachabschnitt, ein Bad und die Fenster zur Windseite.',
          },
        },
        {
          id: 'furniture',
          title: { en: 'Furnishing', de: 'Einrichtung' },
          amount: 6000,
          note: {
            en: 'Beds for six, a kitchen and a long table.',
            de: 'Betten für sechs, eine Küche und ein langer Tisch.',
          },
        },
        {
          id: 'upkeep',
          title: { en: 'Reserve for repairs', de: 'Rücklage für Reparaturen' },
          amount: 5500,
          note: {
            en: 'Salt air eats paint and gutters; one percent a year is the rule.',
            de: 'Die Salzluft frisst Farbe und Regenrinnen; ein Prozent im Jahr ist die Regel.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'K1',
        title: { en: 'Marketing manager', de: 'Marketingmanagerin' },
        story: {
          en: 'The campaigns run, the budget holds and the team of five trusts your plans.',
          de: 'Die Kampagnen laufen, das Budget hält und das Team von fünf vertraut deinen Plänen.',
        },
        grossYear: 75600,
        minPaydays: 3,
        rollFrom: 4,
      },
      {
        id: 'K2',
        title: { en: 'Head of marketing', de: 'Marketingleiterin' },
        story: {
          en: 'Three brands, twelve people and your first seat in the management round.',
          de: 'Drei Marken, zwölf Leute und dein erster Platz in der Geschäftsleitungsrunde.',
        },
        grossYear: 91200,
        minPaydays: 5,
        rollFrom: 5,
        bonusPercent: 6,
      },
      {
        id: 'K3',
        title: { en: 'Director of marketing', de: 'Direktorin Marketing' },
        story: {
          en: 'The whole group, three countries, and a flight every second week.',
          de: 'Der ganze Konzern, drei Länder und alle zwei Wochen ein Flug.',
        },
        grossYear: 111600,
        minPaydays: 6,
        rollFrom: 5,
        bonusPercent: 10,
      },
      {
        id: 'K4',
        title: { en: 'Chief marketing officer', de: 'Chief Marketing Officer' },
        story: {
          en: 'A place on the board - and the long evenings that come with it.',
          de: 'Ein Platz im Vorstand - und die langen Abende, die dazugehören.',
        },
        grossYear: 144000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 20,
        companyCar: true,
      },
    ],
  },
  // ───────────────────────────────────────── 44: the engineer
  {
    id: 'frank-ingenieur',
    title: 'Maschinenbauingenieur',
    name: { en: 'Frank', de: 'Frank' },
    tagline: {
      en: 'Mechanical engineer and team leader, dreaming of a house that makes its own energy',
      de: 'Maschinenbauingenieur und Teamleiter, mit dem Traum von einem Haus, das seine Energie selbst macht',
    },
    background: {
      en: 'Frank leads a development team of eight at an automotive supplier near Stuttgart. He spends his days with tolerances and test benches and his evenings with the numbers of his own house: what it costs to heat, what the roof could produce, how long a battery takes to pay off. His son is fourteen and eats like three people.',
      de: 'Frank leitet ein Entwicklungsteam von acht Leuten bei einem Automobilzulieferer bei Stuttgart. Seine Tage gehören Toleranzen und Prüfständen, seine Abende den Zahlen seines eigenen Hauses: was die Heizung kostet, was das Dach erzeugen könnte, wie lange ein Speicher braucht, um sich zu rechnen. Sein Sohn ist vierzehn und isst für drei.',
    },
    values: [
      {
        en: 'Independence: no bill from the energy company any more',
        de: 'Unabhängigkeit: keine Rechnung vom Energieversorger mehr',
      },
      {
        en: 'Engineering: if it can be measured, it can be improved',
        de: 'Technik: was sich messen lässt, lässt sich verbessern',
      },
      {
        en: 'Responsibility: a house his son can take over without debts',
        de: 'Verantwortung: ein Haus, das sein Sohn ohne Schulden übernehmen kann',
      },
    ],
    gross: 7600,
    pay: { splitting: true, children: true },
    creep: 0.4,
    scale: 2.7,
    ease: 0.8,
    savings: 6000,
    debts: [
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 6000,
      },
      {
        key: 'renovationLoan',
        tag: 'Dachkredit',
        label: { en: 'roof loan', de: 'den Dachkredit' },
        amount: 4000,
      },
    ],
    homeKey: 'mortgageRent',
    homeTitle: 'Eigenheim-Hypothek',
    homeAmount: 1900,
    extras: [
      { key: 'childcare', title: 'Kind', amount: 380 },
      { key: 'car', title: 'Auto & Mobilität', amount: 520 },
    ],
    dream: {
      title: { en: 'The energy-independent house', de: 'Das energieautarke Haus' },
      sub: {
        en: 'Solar roof, battery, heat pump and a well-insulated shell',
        de: 'Solardach, Speicher, Wärmepumpe und eine gut gedämmte Hülle',
      },
      summary: {
        en: 'Turn his house into one that makes, stores and saves its own energy. In this game it is his first Smile project.',
        de: 'Sein Haus zu einem machen, das seine Energie selbst erzeugt, speichert und spart. Im Spiel ist es sein erstes Smile-Projekt.',
      },
      description: {
        en: 'Independence from the grid has five parts: producing power, storing it, heating without gas, keeping the heat in and driving on it. Each bucket is one of them.',
        de: 'Unabhängigkeit vom Netz hat fünf Teile: Strom erzeugen, speichern, ohne Gas heizen, die Wärme halten und damit fahren. Jeder Topf ist einer davon.',
      },
      buckets: [
        {
          id: 'solar',
          title: { en: 'Solar roof', de: 'Solardach' },
          amount: 17000,
          note: {
            en: 'About 12 kWp on the south roof, with the inverter and the installation.',
            de: 'Etwa 12 kWp auf dem Süddach, mit Wechselrichter und Montage.',
          },
        },
        {
          id: 'battery',
          title: { en: 'Battery storage', de: 'Batteriespeicher' },
          amount: 12000,
          note: {
            en: 'Ten kilowatt hours to carry the evening and the night.',
            de: 'Zehn Kilowattstunden für den Abend und die Nacht.',
          },
        },
        {
          id: 'heatpump',
          title: { en: 'Heat pump', de: 'Wärmepumpe' },
          amount: 22000,
          note: {
            en: 'An air-to-water heat pump with a new storage tank and the pipework.',
            de: 'Eine Luft-Wasser-Wärmepumpe mit neuem Speicher und den Leitungen.',
          },
        },
        {
          id: 'insulation',
          title: { en: 'Insulation and windows', de: 'Dämmung und Fenster' },
          amount: 24500,
          note: {
            en: 'The facade, the top floor ceiling and triple-glazed windows.',
            de: 'Die Fassade, die Obergeschossdecke und dreifach verglaste Fenster.',
          },
        },
        {
          id: 'wallbox',
          title: { en: 'Wallbox and electric car', de: 'Wallbox und E-Auto' },
          amount: 6000,
          note: {
            en: 'The charging point and the deposit for an electric car.',
            de: 'Die Ladestation und die Anzahlung für ein Elektroauto.',
          },
        },
        {
          id: 'smart',
          title: { en: 'Energy management', de: 'Energiemanagement' },
          amount: 3000,
          note: {
            en: 'The controller that decides when to charge, heat and sell.',
            de: 'Die Steuerung, die entscheidet, wann geladen, geheizt und verkauft wird.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'F1',
        title: { en: 'Development engineer', de: 'Entwicklungsingenieur' },
        story: {
          en: 'Your design is in a million cars. The next one is on the test bench.',
          de: 'Dein Entwurf steckt in einer Million Autos. Der nächste steht auf dem Prüfstand.',
        },
        grossYear: 91200,
        minPaydays: 3,
        rollFrom: 4,
        bonusPercent: 6,
      },
      {
        id: 'F2',
        title: { en: 'Team leader, development', de: 'Teamleiter Entwicklung' },
        story: {
          en: 'Eight engineers, one deadline and the first budget with your name on it.',
          de: 'Acht Ingenieure, eine Deadline und das erste Budget mit deinem Namen.',
        },
        grossYear: 105600,
        minPaydays: 5,
        rollFrom: 5,
        bonusPercent: 8,
      },
      {
        id: 'F3',
        title: { en: 'Head of department', de: 'Abteilungsleiter' },
        story: {
          en: 'Forty people and a plant visit every month. The test bench is a memory.',
          de: 'Vierzig Leute und jeden Monat ein Werksbesuch. Der Prüfstand ist eine Erinnerung.',
        },
        grossYear: 126000,
        minPaydays: 6,
        rollFrom: 5,
        bonusPercent: 12,
        companyCar: true,
      },
      {
        id: 'F4',
        title: { en: 'Head of division', de: 'Bereichsleiter' },
        story: {
          en: 'A whole division, a seat in the management meeting and a company car that is bigger than your garage.',
          de: 'Ein ganzer Bereich, ein Platz in der Geschäftsführungsrunde und ein Dienstwagen, der größer ist als deine Garage.',
        },
        grossYear: 156000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 18,
        companyCar: true,
      },
    ],
  },
  // ───────────────────────────────────────── 48: the surgeon
  {
    id: 'jan-oberarzt',
    title: 'Oberarzt Chirurgie',
    name: { en: 'Dr. Jan', de: 'Dr. Jan' },
    tagline: {
      en: 'Senior surgeon, dreaming of a practice of his own',
      de: 'Oberarzt der Chirurgie, mit dem Traum von einer eigenen Praxis',
    },
    background: {
      en: 'Dr. Jan Berger is senior physician in the surgery department of a hospital in Munich. He earns more than almost anyone he knows and spends it: a villa on a long mortgage, two teenagers, a leased car and the life that goes with the job. The nights on call have taught him that he wants to decide his own working hours - in a practice that is his.',
      de: 'Dr. Jan Berger ist Oberarzt in der Chirurgie einer Münchner Klinik. Er verdient mehr als fast jeder, den er kennt, und gibt es aus: eine Villa auf einer langen Hypothek, zwei Teenager, ein Leasingauto und das Leben, das zum Beruf gehört. Die Nachtdienste haben ihn gelehrt, dass er seine Arbeitszeiten selbst bestimmen will - in einer Praxis, die ihm gehört.',
    },
    values: [
      {
        en: 'Autonomy: his own hours, his own team, his own standards',
        de: 'Selbstbestimmung: seine Arbeitszeiten, sein Team, seine Maßstäbe',
      },
      {
        en: 'Quality: nothing leaves his hands that he would not do again',
        de: 'Qualität: nichts verlässt seine Hände, das er nicht noch einmal so machen würde',
      },
      {
        en: 'His children: they should have the choices he had to earn',
        de: 'Seine Kinder: sie sollen die Wahl haben, die er sich verdienen musste',
      },
    ],
    gross: 11200,
    pay: { children: true },
    creep: 0.6,
    scale: 3.9,
    ease: 0.35,
    savings: 5000,
    debts: [
      {
        key: 'mortgage',
        tag: 'Zweithypothek',
        label: { en: 'second mortgage', de: 'die Zweithypothek' },
        amount: 16000,
      },
      {
        key: 'leasing',
        tag: 'Leasing-Restwert',
        label: { en: 'leasing balance', de: 'den Leasing-Restwert' },
        amount: 8000,
      },
    ],
    homeKey: 'mortgageRent',
    homeTitle: 'Eigenheim-Hypothek',
    homeAmount: 2400,
    extras: [
      { key: 'childcare', title: 'Kinder', amount: 520 },
      { key: 'car', title: 'Auto & Mobilität', amount: 650 },
    ],
    dream: {
      title: { en: 'His own practice', de: 'Die eigene Praxis' },
      sub: {
        en: 'Taking over a surgical practice in the Allgäu',
        de: 'Die Übernahme einer chirurgischen Praxis im Allgäu',
      },
      summary: {
        en: 'Take over a practice, modernise it, get the licence and carry the first six months. In this game it is his first Smile project.',
        de: 'Eine Praxis übernehmen, modernisieren, die Zulassung bekommen und die ersten sechs Monate tragen. Im Spiel ist es sein erstes Smile-Projekt.',
      },
      description: {
        en: 'A practice is bought, not started: the price of the patients and the inventory, the conversion, the licence, the staff before the first bill is paid, and a reserve for the lean months.',
        de: 'Eine Praxis wird gekauft, nicht gegründet: der Preis für Patienten und Inventar, der Umbau, die Zulassung, das Personal, bevor die erste Rechnung bezahlt ist, und eine Rücklage für die mageren Monate.',
      },
      buckets: [
        {
          id: 'purchase',
          title: { en: 'Purchase of the practice', de: 'Kauf der Praxis' },
          amount: 62000,
          note: {
            en: 'The value of the patient base and the inventory, as the valuation sets it.',
            de: 'Der Wert des Patientenstamms und des Inventars, wie ihn die Bewertung festsetzt.',
          },
        },
        {
          id: 'equipment',
          title: { en: 'Conversion and diagnostics', de: 'Umbau und Diagnostik' },
          amount: 38000,
          note: {
            en: 'A small operating room, an ultrasound and a digital X-ray.',
            de: 'Ein kleiner OP-Raum, ein Ultraschall und ein digitales Röntgengerät.',
          },
        },
        {
          id: 'licence',
          title: { en: 'Licence and advice', de: 'Zulassung und Beratung' },
          amount: 8500,
          note: {
            en: 'The licence to treat statutory patients, a lawyer and a tax adviser.',
            de: 'Die Kassenzulassung, ein Anwalt und ein Steuerberater.',
          },
        },
        {
          id: 'staff',
          title: { en: 'Staff before the first bill', de: 'Personal vor der ersten Abrechnung' },
          amount: 18000,
          note: {
            en: 'Three medical assistants for six months until the quarterly billing arrives.',
            de: 'Drei medizinische Fachangestellte für sechs Monate, bis die Quartalsabrechnung kommt.',
          },
        },
        {
          id: 'buffer',
          title: { en: 'Reserve for the lean months', de: 'Rücklage für magere Monate' },
          amount: 9500,
          note: {
            en: 'Because the first quarters never go as planned.',
            de: 'Weil die ersten Quartale nie wie geplant laufen.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'J1',
        title: { en: 'Senior physician', de: 'Oberarzt' },
        story: {
          en: 'You run the operating list and the junior doctors - and you are on call every fourth weekend.',
          de: 'Du leitest den OP-Plan und die Assistenzärzte - und hast jedes vierte Wochenende Dienst.',
        },
        grossYear: 134400,
        minPaydays: 4,
        rollFrom: 5,
        bonusPercent: 5,
      },
      {
        id: 'J2',
        title: { en: 'Leading senior physician', de: 'Leitender Oberarzt' },
        story: {
          en: 'The chief trusts you with the department when he is away - and the private patients ask for you.',
          de: 'Der Chef überlässt dir die Abteilung, wenn er weg ist - und die Privatpatienten fragen nach dir.',
        },
        grossYear: 156000,
        minPaydays: 6,
        rollFrom: 5,
        bonusPercent: 8,
      },
      {
        id: 'J3',
        title: { en: 'Chief physician', de: 'Chefarzt' },
        story: {
          en: 'Your name is on the board at the entrance. So is the responsibility for sixty beds.',
          de: 'Dein Name steht auf der Tafel am Eingang. Die Verantwortung für sechzig Betten auch.',
        },
        grossYear: 204000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 15,
      },
      {
        id: 'J4',
        title: { en: 'Medical director', de: 'Ärztlicher Direktor' },
        story: {
          en: 'The whole hospital, its budget and its worst nights are yours.',
          de: 'Das ganze Krankenhaus, sein Budget und seine schlimmsten Nächte gehören dir.',
        },
        grossYear: 264000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 18,
        companyCar: true,
      },
    ],
  },
  // ───────────────────────────────────────── 52: the garage owner
  {
    id: 'heike-werkstatt',
    title: 'Kfz-Meisterin und Werkstattinhaberin',
    name: { en: 'Heike', de: 'Heike' },
    tagline: {
      en: 'Master mechanic with her own garage, dreaming of a vineyard',
      de: 'Kfz-Meisterin mit eigener Werkstatt, mit dem Traum von einem Weinberg',
    },
    background: {
      en: "Heike has run her garage in a small town in the Palatinate for twenty years: four employees, a regular crowd and a workshop she knows by heart. The profit is good in a good year and thin in a bad one, and the business loan for the new lift is still running. On weekends she helps at a friend's vineyard - and on Sundays she looks at vineyards for sale.",
      de: 'Heike führt seit zwanzig Jahren ihre Werkstatt in einer Kleinstadt in der Pfalz: vier Angestellte, Stammkundschaft und eine Werkstatt, die sie auswendig kennt. Der Gewinn ist in einem guten Jahr gut und in einem schlechten dünn, und der Betriebskredit für die neue Hebebühne läuft noch. An den Wochenenden hilft sie im Weinberg einer Freundin - und sonntags sieht sie sich Weinberge zum Verkauf an.',
    },
    values: [
      {
        en: 'Her people: the four employees are family',
        de: 'Ihre Leute: die vier Angestellten sind Familie',
      },
      {
        en: 'Craft: a car that leaves her garage is a promise',
        de: 'Handwerk: ein Auto, das ihre Werkstatt verlässt, ist ein Versprechen',
      },
      {
        en: 'The second act: a life that smells of grapes and not of oil',
        de: 'Der zweite Akt: ein Leben, das nach Trauben riecht und nicht nach Öl',
      },
    ],
    gross: 5200,
    pay: { selfEmployed: true },
    creep: 0.4,
    scale: 1.8,
    ease: 0.9,
    savings: 5000,
    debts: [
      {
        key: 'bankLoan',
        tag: 'Betriebskredit',
        label: { en: 'business loan', de: 'den Betriebskredit' },
        amount: 10000,
      },
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 4000,
      },
    ],
    homeKey: 'mortgageRent',
    homeTitle: 'Eigenheim-Hypothek',
    homeAmount: 1050,
    extras: [{ key: 'car', title: 'Auto & Mobilität', amount: 400 }],
    dream: {
      title: { en: 'A small vineyard', de: 'Ein kleines Weingut' },
      sub: {
        en: 'Two hectares of vines in the Palatinate and a cellar of her own',
        de: 'Zwei Hektar Reben in der Pfalz und ein eigener Keller',
      },
      summary: {
        en: 'Buy two hectares of vineyard, learn the craft of the winemaker, equip a cellar and sell the first vintage. In this game it is her first Smile project.',
        de: 'Zwei Hektar Weinberg kaufen, das Winzerhandwerk lernen, einen Keller ausstatten und den ersten Jahrgang verkaufen. Im Spiel ist es ihr erstes Smile-Projekt.',
      },
      description: {
        en: 'A vineyard takes land, knowledge, a cellar and patience. The buckets are the plot itself, the courses, the cellar technology, the first vintage, the new vines and a place where guests can taste.',
        de: 'Ein Weingut braucht Land, Wissen, einen Keller und Geduld. Die Töpfe sind die Parzelle selbst, die Kurse, die Kellertechnik, der erste Jahrgang, die neuen Reben und ein Ort, an dem Gäste probieren können.',
      },
      buckets: [
        {
          id: 'land',
          title: { en: 'Two hectares of vines', de: 'Zwei Hektar Reben' },
          amount: 22000,
          note: {
            en: 'A plot of established vines on a good slope - the price per hectare varies by site.',
            de: 'Eine Parzelle mit eingewachsenen Reben an einem guten Hang - der Preis pro Hektar hängt von der Lage ab.',
          },
        },
        {
          id: 'courses',
          title: { en: 'Winemaking courses', de: 'Winzerkurse' },
          amount: 3500,
          note: {
            en: 'Viticulture and cellar technique, on weekends over a year.',
            de: 'Weinbau und Kellertechnik, an Wochenenden über ein Jahr.',
          },
        },
        {
          id: 'cellar',
          title: { en: 'Cellar technology', de: 'Kellertechnik' },
          amount: 14000,
          note: {
            en: 'Press, stainless steel tanks and a cooling system.',
            de: 'Presse, Edelstahltanks und eine Kühlanlage.',
          },
        },
        {
          id: 'vintage',
          title: { en: 'The first vintage', de: 'Der erste Jahrgang' },
          amount: 6500,
          note: {
            en: 'Barrels, bottles, corks and labels for the first 8,000 bottles.',
            de: 'Fässer, Flaschen, Korken und Etiketten für die ersten 8.000 Flaschen.',
          },
        },
        {
          id: 'vines',
          title: { en: 'New vines', de: 'Neue Reben' },
          amount: 5500,
          note: {
            en: 'Replanting a quarter of the plot with a resistant grape.',
            de: 'Ein Viertel der Parzelle mit einer robusten Rebsorte neu bepflanzen.',
          },
        },
        {
          id: 'tasting',
          title: { en: 'A tasting room', de: 'Eine Probierstube' },
          amount: 4500,
          note: {
            en: 'A shed turned into a room for twenty guests.',
            de: 'Ein Schuppen, der zu einem Raum für zwanzig Gäste wird.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'H1',
        title: { en: 'Master mechanic, garage owner', de: 'Kfz-Meisterin, Werkstattinhaberin' },
        story: {
          en: 'Four employees, a full order book and a good name in the whole valley.',
          de: 'Vier Angestellte, ein volles Auftragsbuch und ein guter Name im ganzen Tal.',
        },
        grossYear: 62400,
        minPaydays: 4,
        rollFrom: 5,
      },
      {
        id: 'H2',
        title: { en: 'Garage with six employees', de: 'Werkstatt mit sechs Angestellten' },
        story: {
          en: 'A second bay, two more people and the first month with a real profit.',
          de: 'Eine zweite Halle, zwei Leute mehr und der erste Monat mit einem echten Gewinn.',
        },
        grossYear: 74400,
        minPaydays: 5,
        rollFrom: 5,
      },
      {
        id: 'H3',
        title: { en: 'Brand dealership', de: 'Markenvertretung' },
        story: {
          en: 'A car maker offers you its brand for the region: showroom, new cars, a big loan.',
          de: 'Ein Autohersteller bietet dir seine Marke für die Region an: Showroom, Neuwagen, ein großer Kredit.',
        },
        grossYear: 91200,
        minPaydays: 6,
        rollFrom: 5,
        bonusPercent: 6,
      },
      {
        id: 'H4',
        title: { en: 'Dealership group', de: 'Autohausgruppe' },
        story: {
          en: 'Three sites, forty people and a managing director who does the books.',
          de: 'Drei Standorte, vierzig Leute und ein Geschäftsführer, der die Bücher macht.',
        },
        grossYear: 114000,
        minPaydays: 6,
        rollFrom: 6,
        bonusPercent: 10,
      },
    ],
  },
  // ───────────────────────────────────────── 57: the bus driver
  {
    id: 'peter-busfahrer',
    title: 'Busfahrer im Linienverkehr',
    name: { en: 'Peter', de: 'Peter' },
    tagline: {
      en: 'City bus driver, eight years from retirement, dreaming of a cabin by a lake',
      de: 'Linienbusfahrer, acht Jahre vor der Rente, mit dem Traum von einer Hütte am See',
    },
    background: {
      en: 'Peter has driven line 7 through the same town for thirty-one years. He knows the regulars by name and the timetable by heart. His children are grown, the flat is rented, the pension will be modest. What he wants is a small plot at a lake with a log cabin and a jetty, a place for his wife and the grandchildren, before his knees say no.',
      de: 'Peter fährt seit einunddreißig Jahren die Linie 7 durch dieselbe Stadt. Er kennt die Stammgäste beim Namen und den Fahrplan auswendig. Die Kinder sind groß, die Wohnung gemietet, die Rente wird bescheiden sein. Was er will, ist ein kleines Grundstück an einem See mit einer Blockhütte und einem Steg, ein Ort für seine Frau und die Enkel, bevor seine Knie Nein sagen.',
    },
    values: [
      {
        en: 'Reliability: he has been on time for thirty-one years',
        de: 'Zuverlässigkeit: er ist seit einunddreißig Jahren pünktlich',
      },
      {
        en: 'His wife and the grandchildren: the cabin is for them',
        de: 'Seine Frau und die Enkel: die Hütte ist für sie',
      },
      {
        en: 'Peace: a morning with a rod and a coffee, not a timetable',
        de: 'Ruhe: ein Morgen mit Angel und Kaffee, nicht mit einem Fahrplan',
      },
    ],
    gross: 2700,
    scale: 0.95,
    ease: 1.4,
    savings: 4500,
    debts: [
      {
        key: 'carLoan',
        tag: 'Autokredit',
        label: { en: 'car loan', de: 'den Autokredit' },
        amount: 3000,
      },
    ],
    homeAmount: 640,
    extras: [{ key: 'car', title: 'Auto & Mobilität', amount: 220 }],
    dream: {
      title: { en: 'A cabin by the lake', de: 'Eine Hütte am See' },
      sub: {
        en: 'A leased plot, a log cabin and a jetty',
        de: 'Ein Pachtgrundstück, eine Blockhütte und ein Steg',
      },
      summary: {
        en: 'Lease a plot at a lake, build a log cabin from a kit, fit it out and build a jetty. In this game it is his first Smile project.',
        de: 'Ein Grundstück an einem See pachten, eine Blockhütte aus dem Bausatz bauen, sie einrichten und einen Steg bauen. Im Spiel ist es sein erstes Smile-Projekt.',
      },
      description: {
        en: 'A cabin is simple and takes a few things: the plot with its first payment, the kit, the foundation and the connections, the stove and the furniture, and a little boat.',
        de: 'Eine Hütte ist einfach und braucht ein paar Dinge: das Grundstück mit der ersten Zahlung, den Bausatz, das Fundament und die Anschlüsse, den Ofen und die Möbel und ein kleines Boot.',
      },
      buckets: [
        {
          id: 'plot',
          title: { en: 'The plot', de: 'Das Grundstück' },
          amount: 8500,
          note: {
            en: 'The first payment on a leased plot of 600 square metres at the lake.',
            de: 'Die erste Zahlung für ein gepachtetes Grundstück von 600 Quadratmetern am See.',
          },
        },
        {
          id: 'kit',
          title: { en: 'The log cabin kit', de: 'Der Blockhaus-Bausatz' },
          amount: 9500,
          note: {
            en: 'A cabin of 28 square metres with a roof and windows, delivered on a lorry.',
            de: 'Eine Hütte von 28 Quadratmetern mit Dach und Fenstern, auf dem Lkw geliefert.',
          },
        },
        {
          id: 'foundation',
          title: { en: 'Foundation and connections', de: 'Fundament und Anschlüsse' },
          amount: 5000,
          note: {
            en: 'Point foundations, a septic tank, water and power from the road.',
            de: 'Punktfundamente, eine Klärgrube, Wasser und Strom von der Straße.',
          },
        },
        {
          id: 'fitting',
          title: { en: 'Stove and furniture', de: 'Ofen und Möbel' },
          amount: 2500,
          note: {
            en: 'A wood stove, two bunk beds and a table for eight.',
            de: 'Ein Holzofen, zwei Etagenbetten und ein Tisch für acht.',
          },
        },
        {
          id: 'jetty',
          title: { en: 'Jetty and boat', de: 'Steg und Boot' },
          amount: 1500,
          note: {
            en: 'A wooden jetty and a small rowing boat.',
            de: 'Ein Holzsteg und ein kleines Ruderboot.',
          },
        },
      ],
      notes: [
        {
          en: 'The costs are estimates in game money.',
          de: 'Die Kosten sind Schätzungen in Spielgeld.',
        },
      ],
    },
    ladder: [
      {
        id: 'P1',
        title: { en: 'Bus driver', de: 'Busfahrer' },
        story: {
          en: 'Line 7, early shift, the same stops and the same hello at each of them.',
          de: 'Linie 7, Frühdienst, dieselben Haltestellen und an jeder dasselbe Hallo.',
        },
        grossYear: 32400,
        minPaydays: 4,
        rollFrom: 5,
      },
      {
        id: 'P2',
        title: { en: 'Driving instructor', de: 'Fahrausbilder' },
        story: {
          en: 'You teach the new drivers the routes - and how to stay calm when the bus is full.',
          de: 'Du bringst den neuen Fahrern die Strecken bei - und wie man ruhig bleibt, wenn der Bus voll ist.',
        },
        grossYear: 37200,
        minPaydays: 5,
        rollFrom: 5,
      },
      {
        id: 'P3',
        title: { en: 'Depot foreman', de: 'Betriebsmeister' },
        story: {
          en: 'The roster, the breakdowns and sixty drivers: you keep the depot moving.',
          de: 'Der Dienstplan, die Pannen und sechzig Fahrer: du hältst den Betriebshof am Laufen.',
        },
        grossYear: 43200,
        minPaydays: 6,
        rollFrom: 6,
      },
      {
        id: 'P4',
        title: { en: 'Head of driving service', de: 'Leiter Fahrdienst' },
        story: {
          en: 'The whole network of the town. A desk, a view of the depot and a pension that has grown.',
          de: 'Das ganze Netz der Stadt. Ein Schreibtisch, ein Blick auf den Betriebshof und eine Rente, die gewachsen ist.',
        },
        grossYear: 50400,
        minPaydays: 6,
        rollFrom: 6,
      },
    ],
  },
];
