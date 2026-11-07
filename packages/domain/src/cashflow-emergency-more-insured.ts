import { elink, emergencyCard } from './cashflow-emergency-kit';

const VZ = elink(
  'Consumer advice centre',
  'Verbraucherzentrale',
  'https://www.verbraucherzentrale.de/',
);
const TEST = elink('Stiftung Warentest', 'Stiftung Warentest', 'https://www.test.de/');
const FINANZTIP = elink('Finanztip', 'Finanztip', 'https://www.finanztip.de/');
const BMG = elink(
  'Federal Ministry of Health',
  'Bundesgesundheitsministerium',
  'https://www.bundesgesundheitsministerium.de/',
);
const BA = elink(
  'Federal Employment Agency',
  'Bundesagentur für Arbeit',
  'https://www.arbeitsagentur.de/',
);
const AA = elink(
  'Foreign Office – travel advice',
  'Auswärtiges Amt – Reisehinweise',
  'https://www.auswaertiges-amt.de/',
);
const DAV = elink('German Alpine Club', 'Deutscher Alpenverein', 'https://www.alpenverein.de/');
const EU = elink(
  'Your Europe – air passenger rights',
  'Your Europe – Fluggastrechte',
  'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm',
);

/**
 * The cards of the two new insurances - travel and disability - and more for the legal protection and the dental top-up, so that
 * the premium of each is worth paying (JFK, 2026-11; `insurance-value.spec.ts` counts what each saves against what it costs).
 */
export const MORE_INSURED_CARDS = [
  emergencyCard({
    id: 'E101',
    tier: 'blaze',
    category: 'travel',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'travel',
    deductible: 150,
    title: ['Sick the Night Before the Flight', 'Krank am Abend vor dem Flug'],
    story: [
      'A fever at midnight, a doctor in the morning, and a holiday that you paid in full three months ago. The flight leaves without you.',
      'Fieber um Mitternacht, am Morgen der Arzt, und ein Urlaub, den du vor drei Monaten voll bezahlt hast. Der Flug geht ohne dich.',
    ],
    description: [
      "A trip that you cannot take is lost money: flights and hotels are mostly non-refundable. Travel cancellation insurance pays the costs if you or a close relative falls ill before the start, with a doctor's note. It has to be taken out when the trip is booked, not afterwards.",
      'Eine Reise, die du nicht antreten kannst, ist verlorenes Geld: Flüge und Hotels sind meist nicht erstattbar. Die Reiserücktrittsversicherung zahlt die Kosten, wenn du oder ein naher Angehöriger vor dem Start erkrankt, mit ärztlichem Attest. Sie muss beim Buchen der Reise abgeschlossen werden, nicht danach.',
    ],
    insuranceNote: [
      'Travel insurance pays the non-refundable costs of a trip you could not take; you pay a share of about 150. It must be in place from the day you book.',
      'Die Reiseversicherung zahlt die nicht erstattbaren Kosten einer Reise, die du nicht antreten konntest; du zahlst einen Anteil von etwa 150. Sie muss ab dem Tag der Buchung bestehen.',
    ],
    buckets: [
      [
        'The trip you cannot take',
        'Die Reise, die du nicht antreten kannst',
        1400,
        'Flights and a hotel for a week cost about 800-2,500; the airline and the hotel refund little or nothing, and a late cancellation costs up to the whole sum.',
        'Flüge und ein Hotel für eine Woche kosten etwa 800-2.500; Fluggesellschaft und Hotel erstatten wenig oder nichts, und eine späte Absage kostet bis zur ganzen Summe.',
        [VZ],
      ],
    ],
    links: [VZ, TEST],
    actions: [
      [
        'See a doctor at once and keep the certificate with the date',
        'Geh sofort zum Arzt und bewahre das Attest mit dem Datum auf',
        'high',
      ],
      [
        'Cancel the trip at once with the airline, the hotel and your insurer',
        'Storniere die Reise sofort bei Fluggesellschaft, Hotel und Versicherer',
        'high',
      ],
      [
        'Next time take out the cancellation cover on the day you book',
        'Schließ den Rücktrittsschutz das nächste Mal am Tag der Buchung ab',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Cancel as soon as you know: most policies pay only the costs that were due at that moment, so every day of waiting can add the next cancellation fee.',
      'Storniere, sobald du es weißt: die meisten Policen zahlen nur die Kosten, die in diesem Moment fällig waren, und jeder Tag des Wartens kann die nächste Stornogebühr bringen.',
    ],
  }),
  emergencyCard({
    id: 'E102',
    tier: 'flame',
    category: 'travel',
    type: 'dice',
    payment: 'plan_ok',
    insurance: 'travel',
    deductible: 50,
    title: ['The Suitcase Does Not Arrive', 'Der Koffer kommt nicht an'],
    story: [
      'The belt stops, the last bag goes round, and yours is not on it. The counter hands you a form and a small toiletry bag.',
      'Das Band hält an, die letzte Tasche fährt vorbei, und deine ist nicht dabei. Am Schalter bekommst du ein Formular und ein kleines Kulturbeutelchen.',
    ],
    description: [
      'Delayed or lost luggage costs you the things you buy in the first days and, if the bag is gone, everything in it. The airline pays only up to a limit and wants proof; travel insurance pays the rest. Report it at the airport before you leave.',
      'Verspätetes oder verlorenes Gepäck kostet dich, was du in den ersten Tagen kaufst, und, wenn die Tasche weg ist, alles darin. Die Fluggesellschaft zahlt nur bis zu einer Grenze und will Belege; die Reiseversicherung zahlt den Rest. Melde es am Flughafen, bevor du gehst.',
    ],
    insuranceNote: [
      'Travel insurance with a luggage cover pays the replacement of what you had to buy or lost, up to its limit, minus about 50.',
      'Eine Reiseversicherung mit Gepäckschutz zahlt den Ersatz dessen, was du kaufen musstest oder verloren hast, bis zu ihrem Limit, abzüglich etwa 50.',
    ],
    dice: [
      [1, 3, 150],
      [4, 5, 450],
      [6, 6, 900],
    ],
    buckets: [
      [
        'Things you have to buy',
        'Dinge, die du kaufen musst',
        150,
        'The die: 1-3 the bag comes after two days (150 for the first things), 4-5 it comes after a week and you buy clothes (450), 6 it is lost for good (900).',
        'Der Würfel: 1-3 die Tasche kommt nach zwei Tagen (150 für das Nötigste), 4-5 sie kommt nach einer Woche und du kaufst Kleidung (450), 6 sie ist für immer weg (900).',
        [EU],
      ],
    ],
    links: [EU, VZ],
    actions: [
      [
        'Report it at the airline counter before you leave the hall, and keep the form',
        'Melde es am Schalter der Fluggesellschaft, bevor du die Halle verlässt, und bewahre das Formular auf',
        'high',
      ],
      [
        'Keep the receipts of everything you have to buy',
        'Bewahre die Belege von allem auf, was du kaufen musst',
        'high',
      ],
      [
        'Put the essentials - medicine, a charger, a change of clothes - in your hand luggage',
        'Pack das Nötigste - Medikamente, ein Ladegerät, Wechselkleidung - ins Handgepäck',
        'low',
      ],
    ],
    tip: [
      'fact',
      'You have to report damaged luggage within seven days and delayed luggage within 21 days of getting it, in writing to the airline: after that the claim is gone.',
      'Beschädigtes Gepäck musst du innerhalb von sieben Tagen und verspätetes innerhalb von 21 Tagen nach Erhalt schriftlich bei der Fluggesellschaft melden: danach ist der Anspruch weg.',
    ],
  }),
  emergencyCard({
    id: 'E103',
    tier: 'flame',
    category: 'travel',
    type: 'multi',
    payment: 'pay_now',
    insurance: 'travel',
    deductible: 100,
    title: ['Stranded by a Strike', 'Gestrandet wegen eines Streiks'],
    story: [
      'The announcement says "cancelled", the queue at the desk is two hundred people long, and the next free seat is in four days.',
      'Die Durchsage sagt "gestrichen", die Schlange am Schalter ist zweihundert Leute lang, und der nächste freie Platz ist in vier Tagen.',
    ],
    description: [
      'A strike strands you with hotel, meals and a new ticket to pay at once. The airline has to look after you, but in a rush of passengers it is slow; many people buy their own and claim it back. Travel insurance covers the extra costs of a delay or an interruption.',
      'Ein Streik lässt dich mit Hotel, Essen und einem neuen Ticket stranden, die du sofort zahlst. Die Fluggesellschaft muss dich betreuen, ist aber im Ansturm langsam; viele kaufen selbst und fordern es zurück. Die Reiseversicherung deckt die Mehrkosten einer Verspätung oder eines Abbruchs.',
    ],
    insuranceNote: [
      'Travel insurance pays the extra costs of a delay or an interrupted trip up to its limit; you pay about 100.',
      'Die Reiseversicherung zahlt die Mehrkosten einer Verspätung oder eines Reiseabbruchs bis zu ihrem Limit; du zahlst etwa 100.',
    ],
    buckets: [
      [
        'Hotel and meals while you wait',
        'Hotel und Essen beim Warten',
        380,
        'Two or three nights and meals cost about 250-500 in a city at holiday time.',
        'Zwei oder drei Nächte und Essen kosten in einer Stadt zur Ferienzeit etwa 250-500.',
        [EU],
      ],
      [
        'A new ticket home',
        'Ein neues Ticket nach Hause',
        320,
        'A seat on another airline or a train at short notice: about 200-500. Ask the airline for a rebooking first.',
        'Ein Platz bei einer anderen Fluggesellschaft oder ein Zug auf die Schnelle: etwa 200-500. Bitte die Fluggesellschaft zuerst um eine Umbuchung.',
      ],
    ],
    links: [EU, VZ],
    actions: [
      [
        'Ask the airline for care and rebooking in writing before you buy your own',
        'Frag die Fluggesellschaft schriftlich nach Betreuung und Umbuchung, bevor du selbst kaufst',
        'high',
      ],
      [
        'Keep every receipt and the boarding pass for the claim',
        'Bewahre jeden Beleg und die Bordkarte für die Forderung auf',
        'high',
      ],
      [
        'Check with your insurer which costs of a delay are covered',
        'Prüf bei deinem Versicherer, welche Kosten einer Verspätung gedeckt sind',
        'medium',
      ],
    ],
    tip: [
      'fact',
      'In the EU the airline owes you meals, a hotel and calls even when a strike is the reason - only the compensation of 250-600 euros is lost in such a case.',
      'In der EU schuldet dir die Fluggesellschaft Mahlzeiten, Hotel und Telefonate auch dann, wenn ein Streik der Grund ist - nur die Entschädigung von 250-600 Euro entfällt in einem solchen Fall.',
    ],
  }),
  emergencyCard({
    id: 'E104',
    tier: 'wildfire',
    category: 'travel',
    type: 'dice',
    payment: 'plan_ok',
    insurance: 'travel',
    deductible: 50,
    estimate: true,
    title: [
      'A Fall on the Slopes: Rescue by Helicopter',
      'Sturz auf der Piste: Rettung per Hubschrauber',
    ],
    story: [
      'A ski, an icy patch, a cry. The patrol comes with a sled, and the doctor on the radio says: the helicopter.',
      'Ein Ski, eine vereiste Stelle, ein Schrei. Die Pistenrettung kommt mit dem Schlitten, und der Arzt am Funk sagt: der Hubschrauber.',
    ],
    description: [
      'A rescue in the mountains is not part of the health insurance abroad: a helicopter in Switzerland or Austria can cost several thousand, and it is billed to you. Travel insurance or a membership of an alpine club pays the rescue and often the flight home.',
      'Eine Bergung im Gebirge gehört im Ausland nicht zur Krankenversicherung: ein Hubschrauber in der Schweiz oder in Österreich kann mehrere Tausend kosten und wird dir in Rechnung gestellt. Eine Reiseversicherung oder die Mitgliedschaft in einem Alpenverein zahlt die Bergung und oft den Rückflug.',
    ],
    insuranceNote: [
      'Travel insurance pays search and rescue and the transport to a hospital; you pay about 50. Without it the helicopter is billed to you.',
      'Die Reiseversicherung zahlt Such- und Rettungskosten und den Transport ins Krankenhaus; du zahlst etwa 50. Ohne sie wird dir der Hubschrauber in Rechnung gestellt.',
    ],
    dice: [
      [1, 3, 800],
      [4, 5, 3500],
      [6, 6, 7500],
    ],
    buckets: [
      [
        'Rescue and transport',
        'Bergung und Transport',
        800,
        'The die: 1-3 a sled and an ambulance (800), 4-5 a helicopter to the hospital (3,500), 6 a helicopter, an operation and the flight home with a doctor (7,500).',
        'Der Würfel: 1-3 ein Schlitten und ein Krankenwagen (800), 4-5 ein Hubschrauber ins Krankenhaus (3.500), 6 ein Hubschrauber, eine Operation und der Rückflug mit Arzt (7.500).',
        [DAV],
      ],
    ],
    links: [DAV, AA, VZ],
    actions: [
      [
        "Call the emergency number and your insurer's assistance line from the slope",
        'Ruf die Notrufnummer und die Hilfs-Hotline deines Versicherers von der Piste aus an',
        'high',
      ],
      [
        'Keep all bills, the rescue report and the medical report',
        'Bewahre alle Rechnungen, den Rettungsbericht und den Arztbericht auf',
        'high',
      ],
      [
        'Before the next trip: check your travel cover or join an alpine club',
        'Prüf vor der nächsten Reise deinen Reiseschutz oder tritt einem Alpenverein bei',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A membership of the German Alpine Club costs about 60 euros a year and includes mountain rescue cover worldwide for members: for people who ski and hike, it is the cheapest cover there is.',
      'Die Mitgliedschaft im Deutschen Alpenverein kostet etwa 60 Euro im Jahr und schließt für Mitglieder den Bergungsschutz weltweit ein: für Menschen, die Ski fahren und wandern, ist es die günstigste Absicherung, die es gibt.',
    ],
  }),
  emergencyCard({
    id: 'E105',
    tier: 'wildfire',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'employed' },
    insurance: 'disability',
    title: ['The Back Gives Out', 'Der Rücken macht nicht mehr mit'],
    story: [
      'A herniated disc, a doctor who says "no lifting", and a job that is lifting. Six months of therapy and nobody knows after that.',
      'Ein Bandscheibenvorfall, ein Arzt, der sagt "nicht heben", und ein Job, der aus Heben besteht. Sechs Monate Therapie, und danach weiß niemand etwas.',
    ],
    description: [
      'Many people lose their job for health reasons before the pension: the back and the psyche are the most common causes. The state pays sick pay for a time and a small pension after, but not what your life costs. Disability insurance pays a monthly sum when you cannot do your job.',
      'Viele Menschen verlieren vor der Rente aus gesundheitlichen Gründen ihren Beruf: Rücken und Psyche sind die häufigsten Ursachen. Der Staat zahlt eine Zeit lang Krankengeld und danach eine kleine Rente, aber nicht, was dein Leben kostet. Die Berufsunfähigkeitsversicherung zahlt eine monatliche Summe, wenn du deinen Beruf nicht ausüben kannst.',
    ],
    insuranceNote: [
      'Disability insurance pays a monthly sum when you can no longer do your job for health reasons; here you pay only the deductible. Taken out young and healthy it is cheap; later it is dear or refused.',
      'Die Berufsunfähigkeitsversicherung zahlt eine monatliche Summe, wenn du deinen Beruf aus gesundheitlichen Gründen nicht mehr ausüben kannst; hier zahlst du nur die Selbstbeteiligung. Jung und gesund abgeschlossen ist sie günstig; später teuer oder abgelehnt.',
    ],
    buckets: [
      [
        'The income gap for six months',
        'Die Einkommenslücke über sechs Monate',
        3200,
        'Sick pay is at most 90 percent of the net pay, and often less; with rent, car and contracts running on, the gap of six months is felt.',
        'Das Krankengeld beträgt höchstens 90 Prozent des Nettos, oft weniger; da Miete, Auto und Verträge weiterlaufen, spürt man die Lücke von sechs Monaten.',
        [BMG],
      ],
      [
        'Therapy and a course for a new field',
        'Therapie und ein Kurs für ein neues Feld',
        1800,
        'Co-payments for physio and aids, and a retraining course if the old job is out: about 1,000-3,000.',
        'Zuzahlungen für Physio und Hilfsmittel und ein Umschulungskurs, wenn der alte Beruf ausfällt: etwa 1.000-3.000.',
        [BA],
      ],
    ],
    links: [FINANZTIP, BMG],
    actions: [
      [
        'Get the medical certificates in time and ask the health insurer about sick pay',
        'Besorge die ärztlichen Bescheinigungen rechtzeitig und frag die Krankenkasse nach dem Krankengeld',
        'high',
      ],
      [
        'Ask the pension insurer about rehabilitation: it comes before a pension',
        'Frag die Rentenversicherung nach einer Rehabilitation: sie kommt vor einer Rente',
        'medium',
      ],
      [
        'If you have a disability insurance, report the case at once and keep every paper',
        'Wenn du eine Berufsunfähigkeitsversicherung hast, melde den Fall sofort und bewahre jedes Papier auf',
        'high',
      ],
    ],
    tip: [
      'tip',
      'A disability insurance is best taken out in the first years of work, when you are young and healthy: the same cover costs twice as much ten years later, and an illness in between can close the door for good.',
      'Eine Berufsunfähigkeitsversicherung schließt man am besten in den ersten Berufsjahren ab, wenn man jung und gesund ist: derselbe Schutz kostet zehn Jahre später das Doppelte, und eine Krankheit dazwischen kann die Tür für immer schließen.',
    ],
  }),
  emergencyCard({
    id: 'E106',
    tier: 'wildfire',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'employed' },
    insurance: 'disability',
    title: ['Burnout: Four Months Off', 'Burnout: Vier Monate Auszeit'],
    story: [
      'You did not notice it coming. One morning you stand in front of the office door and cannot go in. The doctor writes you off for months.',
      'Du hast es nicht kommen sehen. Eines Morgens stehst du vor der Bürotür und kannst nicht hineingehen. Der Arzt schreibt dich für Monate krank.',
    ],
    description: [
      'Mental illness is one of the most common reasons for a long absence and for disability. The waiting time for a therapist is often months, and the income falls to sick pay. Disability insurance pays when the illness lasts and keeps you from your job; tell the truth in the health questions when you apply.',
      'Psychische Erkrankungen gehören zu den häufigsten Gründen für lange Ausfälle und für Berufsunfähigkeit. Die Wartezeit auf einen Therapeuten beträgt oft Monate, und das Einkommen fällt auf Krankengeld. Die Berufsunfähigkeitsversicherung zahlt, wenn die Krankheit anhält und dich an deinem Beruf hindert; sag bei den Gesundheitsfragen die Wahrheit.',
    ],
    insuranceNote: [
      'Disability insurance pays when the illness keeps you from your job for a long time, mental illness included; you pay the deductible. A wrong answer in the health questions can void the cover.',
      'Die Berufsunfähigkeitsversicherung zahlt, wenn die Krankheit dich lange an deinem Beruf hindert, psychische eingeschlossen; du zahlst die Selbstbeteiligung. Eine falsche Antwort bei den Gesundheitsfragen kann den Schutz kosten.',
    ],
    buckets: [
      [
        'The income gap for four months',
        'Die Einkommenslücke über vier Monate',
        2800,
        'Sick pay does not reach the full net pay: about a quarter of your income is missing for four months.',
        'Das Krankengeld erreicht nicht das volle Netto: etwa ein Viertel deines Einkommens fehlt vier Monate lang.',
        [BMG],
      ],
      [
        'Therapy the insurer does not pay',
        'Therapie, die die Kasse nicht zahlt',
        1100,
        'A private session costs about 90-130; while you wait for a place paid by the insurer, a few of them help.',
        'Eine private Sitzung kostet etwa 90-130; während du auf einen Kassenplatz wartest, helfen einige davon.',
      ],
      [
        'Reduced hours afterwards',
        'Reduzierte Stunden danach',
        900,
        'A gradual return at 50 percent for two months: a part of the pay is missing.',
        'Eine stufenweise Wiedereingliederung mit 50 Prozent über zwei Monate: ein Teil des Gehalts fehlt.',
      ],
    ],
    links: [BMG, FINANZTIP],
    actions: [
      [
        'Talk to the doctor early: early help shortens the time off',
        'Sprich früh mit dem Arzt: frühe Hilfe verkürzt die Auszeit',
        'high',
      ],
      [
        'Ask about a gradual return to work: the pension insurer and the employer can help',
        'Frag nach einer stufenweisen Wiedereingliederung: Rentenversicherung und Arbeitgeber können helfen',
        'medium',
      ],
      [
        'If you have a disability insurance, report the case and keep the medical papers',
        'Wenn du eine Berufsunfähigkeitsversicherung hast, melde den Fall und bewahre die ärztlichen Unterlagen auf',
        'high',
      ],
    ],
    tip: [
      'tip',
      'Answer every health question truthfully when you apply for a disability insurance: a hidden illness is the most common reason an insurer refuses to pay when it matters.',
      'Beantworte bei einer Berufsunfähigkeitsversicherung jede Gesundheitsfrage wahrheitsgemäß: eine verschwiegene Krankheit ist der häufigste Grund, warum ein Versicherer im Ernstfall nicht zahlt.',
    ],
  }),
  emergencyCard({
    id: 'E107',
    tier: 'inferno',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'employed' },
    insurance: 'disability',
    unique: true,
    estimate: true,
    afterEffect: {
      monthly: 150,
      months: 24,
      line: ['Lower pay after the retraining', 'Geringeres Gehalt nach der Umschulung'],
    },
    title: ['Your Trade Is Over', 'Dein Beruf ist zu Ende'],
    story: [
      "A hand that does not close any more, a surgeon's verdict, and a trade of twelve years that you cannot do at forty. A new start from zero.",
      'Eine Hand, die sich nicht mehr schließt, ein ärztliches Urteil und ein Beruf von zwölf Jahren, den du mit vierzig nicht mehr ausüben kannst. Ein Neuanfang bei null.',
    ],
    description: [
      'When a lasting injury ends your trade, you need a new one and a long time to learn it. The state pays a small pension for reduced ability to earn and retraining in some cases, but your standard of living drops. Disability insurance pays a monthly pension for years: this is the case it exists for.',
      'Wenn eine dauerhafte Verletzung deinen Beruf beendet, brauchst du einen neuen und lange Zeit, ihn zu lernen. Der Staat zahlt eine kleine Erwerbsminderungsrente und in manchen Fällen die Umschulung, aber dein Lebensstandard sinkt. Die Berufsunfähigkeitsversicherung zahlt über Jahre eine monatliche Rente: für diesen Fall gibt es sie.',
    ],
    insuranceNote: [
      'Disability insurance pays a monthly pension as long as you cannot do the old job; here you pay only the deductible. Without it you carry the retraining and the lost years of your income alone.',
      'Die Berufsunfähigkeitsversicherung zahlt eine monatliche Rente, solange du den alten Beruf nicht ausüben kannst; hier zahlst du nur die Selbstbeteiligung. Ohne sie trägst du Umschulung und verlorene Einkommensjahre allein.',
    ],
    buckets: [
      [
        'Income gap during the retraining',
        'Einkommenslücke während der Umschulung',
        9000,
        'A retraining of 18 months at a reduced income: the pension insurer or the employment agency pays courses and a part of the living costs, but not what you earned.',
        'Eine Umschulung von 18 Monaten bei reduziertem Einkommen: Rentenversicherung oder Arbeitsagentur zahlen Kurse und einen Teil der Lebenshaltung, aber nicht, was du verdient hast.',
        [BA],
      ],
      [
        'Courses, exams and tools',
        'Kurse, Prüfungen und Werkzeug',
        3000,
        'Fees and materials for a new trade: about 2,000-5,000, partly paid by the agency when it grants the retraining.',
        'Gebühren und Material für einen neuen Beruf: etwa 2.000-5.000, teils von der Agentur gezahlt, wenn sie die Umschulung bewilligt.',
      ],
      [
        'Lower pay in the first year',
        'Geringeres Gehalt im ersten Jahr',
        2400,
        'A beginner earns less than an expert of twelve years: the first year is the hardest.',
        'Ein Anfänger verdient weniger als ein Experte nach zwölf Jahren: das erste Jahr ist das härteste.',
      ],
    ],
    links: [FINANZTIP, BA],
    actions: [
      [
        'Ask the pension insurer about rehabilitation and retraining before you give up your job',
        'Frag die Rentenversicherung nach Rehabilitation und Umschulung, bevor du deinen Beruf aufgibst',
        'high',
      ],
      [
        'Report to your disability insurer at once and let a specialist lawyer or an adviser check the claim',
        'Melde es sofort deiner Berufsunfähigkeitsversicherung und lass die Forderung von einem Fachanwalt oder Berater prüfen',
        'high',
      ],
      [
        'Look for a new field that uses what you know: your experience still counts',
        'Such ein neues Feld, das nutzt, was du weißt: deine Erfahrung zählt noch',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Look at the clause "abstract reference" in a disability insurance: a good one does not send you to a different job you could do. Read it before you sign, not when you claim.',
      'Achte bei einer Berufsunfähigkeitsversicherung auf die Klausel "abstrakte Verweisung": eine gute verweist dich nicht auf einen anderen Beruf, den du ausüben könntest. Lies sie vor der Unterschrift, nicht erst im Leistungsfall.',
    ],
  }),
  emergencyCard({
    id: 'E108',
    tier: 'blaze',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'employed' },
    insurance: 'disability',
    title: ['A Chronic Illness: Part Time Only', 'Eine chronische Krankheit: nur noch Teilzeit'],
    story: [
      'The diagnosis has a long name. The treatment works, but it costs strength: you can work only 60 percent now, for the next year at least.',
      'Die Diagnose hat einen langen Namen. Die Behandlung wirkt, kostet aber Kraft: du kannst jetzt nur noch 60 Prozent arbeiten, mindestens für das nächste Jahr.',
    ],
    description: [
      'A chronic illness often means fewer hours for a long time. The pay falls with them, and the treatment costs money. A partial disability pension pays a part if you can still work a part of your job.',
      'Eine chronische Krankheit bedeutet oft lange weniger Stunden. Das Gehalt sinkt mit ihnen, und die Behandlung kostet Geld. Eine teilweise Berufsunfähigkeitsrente zahlt einen Teil, wenn du noch einen Teil deines Berufs ausüben kannst.',
    ],
    insuranceNote: [
      'Disability insurance pays a share of the pension when you can work only part of your job; here you pay the deductible.',
      'Die Berufsunfähigkeitsversicherung zahlt einen Anteil der Rente, wenn du nur einen Teil deines Berufs ausüben kannst; hier zahlst du die Selbstbeteiligung.',
    ],
    buckets: [
      [
        'The income gap in the first year',
        'Die Einkommenslücke im ersten Jahr',
        1300,
        'Working 60 percent of your hours means a loss of about 40 percent of the pay; a part is made up by the state only in special cases.',
        'Wer 60 Prozent der Stunden arbeitet, verliert etwa 40 Prozent des Gehalts; der Staat gleicht einen Teil nur in besonderen Fällen aus.',
        [BMG],
      ],
      [
        'Treatment and aids',
        'Behandlung und Hilfsmittel',
        500,
        'Co-payments, medicines and aids add up over a year: about 300-800.',
        'Zuzahlungen, Medikamente und Hilfsmittel summieren sich über ein Jahr: etwa 300-800.',
      ],
    ],
    links: [BMG, FINANZTIP],
    actions: [
      [
        'Ask your employer about part-time work and your rights as a person with a chronic illness',
        'Frag deinen Arbeitgeber nach Teilzeit und deinen Rechten als Mensch mit chronischer Krankheit',
        'high',
      ],
      [
        'Apply for the degree of disability: it brings tax and leave benefits',
        'Beantrage den Grad der Behinderung: er bringt Steuer- und Urlaubsvorteile',
        'medium',
      ],
      [
        'Report to your disability insurer if you have one and keep all medical papers',
        'Melde es deiner Berufsunfähigkeitsversicherung, wenn du eine hast, und bewahre alle ärztlichen Unterlagen auf',
        'high',
      ],
    ],
    tip: [
      'tip',
      'A recognised degree of disability of 50 or more gives you five extra days of leave a year, protection against dismissal and a tax allowance: ask the pension office for the form.',
      'Ein anerkannter Grad der Behinderung von 50 oder mehr bringt dir fünf Tage Zusatzurlaub im Jahr, Kündigungsschutz und einen Steuerfreibetrag: frag das Versorgungsamt nach dem Antrag.',
    ],
  }),
  emergencyCard({
    id: 'E109',
    tier: 'flame',
    category: 'health',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'dental',
    deductible: 100,
    title: ['Three Cavities at Once', 'Drei Löcher auf einmal'],
    story: [
      'You skipped the check-up for two years. The dentist is calm and says: three, and one of them is deep.',
      'Du hast zwei Jahre die Kontrolle ausgelassen. Der Zahnarzt bleibt ruhig und sagt: drei, und eins davon ist tief.',
    ],
    description: [
      'The health insurance pays plain fillings. Better ones - ceramic inlays, a gentle method, an extra cleaning - are your own cost, and a dental top-up pays most of it. The cheapest tooth is the one that never gets a hole: the yearly check keeps it small.',
      'Die Krankenkasse zahlt einfache Füllungen. Bessere - Keramik-Inlays, eine schonende Methode, eine zusätzliche Reinigung - sind dein eigener Posten, und eine Zahnzusatzversicherung zahlt das meiste davon. Der günstigste Zahn ist der, der nie ein Loch bekommt: die jährliche Kontrolle hält es klein.',
    ],
    insuranceNote: [
      'A dental top-up pays most of the better fillings and the cleaning; you pay about 100. Without it all of it is yours.',
      'Eine Zahnzusatzversicherung zahlt das meiste der besseren Füllungen und der Reinigung; du zahlst etwa 100. Ohne sie ist alles deins.',
    ],
    buckets: [
      [
        'Better fillings and inlays',
        'Bessere Füllungen und Inlays',
        240,
        'A ceramic filling costs about 100-300 over the standard one; a plastic one is paid by the insurer.',
        'Eine Keramikfüllung kostet etwa 100-300 über der Regelversorgung; eine Kunststofffüllung zahlt die Kasse.',
        [TEST],
      ],
      [
        'Professional cleaning and check',
        'Professionelle Reinigung und Kontrolle',
        140,
        'A cleaning costs about 60-120 and is rarely paid by the insurer; it is the best prevention.',
        'Eine Reinigung kostet etwa 60-120 und wird selten von der Kasse gezahlt; sie ist die beste Vorsorge.',
      ],
    ],
    links: [TEST, BMG],
    actions: [
      [
        'Book the yearly check-up and keep the bonus booklet complete',
        'Buch die jährliche Kontrolle und halte das Bonusheft lückenlos',
        'high',
      ],
      [
        'Ask the dentist for a cost plan before the better fillings',
        'Lass dir vom Zahnarzt vor den besseren Füllungen einen Kostenplan geben',
        'medium',
      ],
      [
        'Send the plan to your top-up insurer before the treatment starts',
        'Schick den Plan an deine Zusatzversicherung, bevor die Behandlung beginnt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Flossing and a check every six months cost almost nothing, and they decide whether the next bill has two digits or four.',
      'Zahnseide und eine Kontrolle alle sechs Monate kosten fast nichts, und sie entscheiden, ob die nächste Rechnung zwei oder vier Stellen hat.',
    ],
  }),
  emergencyCard({
    id: 'E110',
    tier: 'blaze',
    category: 'health',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'dental',
    deductible: 500,
    title: ['Clear Aligners at Thirty', 'Unsichtbare Zahnspange mit Dreißig'],
    story: [
      'The photo from the wedding said it: the teeth that were once almost straight have moved. A friend swears by the clear aligners.',
      'Das Foto von der Hochzeit hat es gezeigt: die Zähne, die einmal fast gerade waren, haben sich verschoben. Ein Freund schwört auf die unsichtbare Zahnspange.',
    ],
    description: [
      'Braces for adults are not paid by the statutory insurance except in severe cases. Clear aligners cost much and take a year or more. A dental top-up with an orthodontic cover pays a share; check the waiting time and the limit.',
      'Eine Zahnspange für Erwachsene zahlt die gesetzliche Kasse nur in schweren Fällen. Unsichtbare Aligner kosten viel und dauern ein Jahr oder länger. Eine Zahnzusatzversicherung mit Kieferorthopädie-Baustein zahlt einen Anteil; prüf Wartezeit und Limit.',
    ],
    insuranceNote: [
      'A dental top-up with an orthodontic cover pays a large share of adult braces; you pay about 500. Many policies have a waiting time and a yearly limit.',
      'Eine Zahnzusatzversicherung mit Kieferorthopädie-Baustein zahlt einen großen Anteil der Zahnspange für Erwachsene; du zahlst etwa 500. Viele Policen haben Wartezeit und Jahreslimit.',
    ],
    buckets: [
      [
        'Aligners for a year',
        'Aligner für ein Jahr',
        1900,
        'A treatment with clear aligners costs about 1,500-4,500; ask for two quotes from orthodontists, not only from online providers.',
        'Eine Behandlung mit unsichtbaren Alignern kostet etwa 1.500-4.500; hol zwei Angebote von Kieferorthopäden ein, nicht nur von Online-Anbietern.',
        [TEST],
      ],
    ],
    links: [TEST, VZ],
    actions: [
      [
        'Ask an orthodontist for an examination and a written plan before you sign anything',
        'Lass dich von einem Kieferorthopäden untersuchen und einen schriftlichen Plan geben, bevor du etwas unterschreibst',
        'high',
      ],
      [
        'Check your top-up policy for an orthodontic cover and its waiting time',
        'Prüf deine Zusatzversicherung auf einen Kieferorthopädie-Baustein und seine Wartezeit',
        'medium',
      ],
      [
        'Compare a clinic with an online provider: the checks along the way matter',
        'Vergleiche eine Praxis mit einem Online-Anbieter: die Kontrollen unterwegs zählen',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A retainer after the treatment is not optional: without it teeth drift back, and a good one costs 80-200 once, much less than the treatment again.',
      'Ein Retainer nach der Behandlung ist nicht optional: ohne ihn wandern die Zähne zurück, und ein guter kostet einmalig 80-200, viel weniger als die Behandlung noch einmal.',
    ],
  }),
  emergencyCard({
    id: 'E111',
    tier: 'flame',
    category: 'legal',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'legal',
    deductible: 100,
    title: ['A Contract You Cannot Cancel', 'Ein Vertrag, aus dem du nicht herauskommst'],
    story: [
      'The gym says the contract runs another year. The notice you sent "never arrived". Now a letter with a collection agency\'s logo.',
      'Das Fitnessstudio sagt, der Vertrag laufe noch ein Jahr. Die Kündigung, die du geschickt hast, sei "nie angekommen". Jetzt ein Brief mit dem Logo eines Inkassobüros.',
    ],
    description: [
      "Contract disputes - a gym, a phone provider, a subscription - are small in amount but long in letters. A lawyer's letter often ends them at once; without legal protection the lawyer costs more than the sum in dispute, so many people pay and give up.",
      'Vertragsstreitigkeiten - ein Fitnessstudio, ein Handyanbieter, ein Abo - sind klein in der Summe, aber lang in Briefen. Ein Anwaltsschreiben beendet sie oft sofort; ohne Rechtsschutz kostet der Anwalt mehr als der Streitwert, und so zahlen viele und geben auf.',
    ],
    insuranceNote: [
      'Legal protection pays the lawyer in a contract dispute; you pay about 100. Without it a lawyer often costs more than the sum in dispute.',
      'Die Rechtsschutz zahlt den Anwalt im Vertragsstreit; du zahlst etwa 100. Ohne sie kostet ein Anwalt oft mehr als der Streitwert.',
    ],
    buckets: [
      [
        'Lawyer for the dispute',
        'Anwalt für den Streit',
        350,
        'A first letter from a lawyer costs about 150-350; a consumer advice centre often does the first letter for a small fee.',
        'Ein erster Anwaltsbrief kostet etwa 150-350; eine Verbraucherzentrale schreibt den ersten Brief oft gegen kleine Gebühr.',
        [VZ],
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Send the notice by registered mail or e-mail with a read receipt, and keep the proof',
        'Schick die Kündigung per Einschreiben oder E-Mail mit Lesebestätigung und bewahre den Nachweis auf',
        'high',
      ],
      [
        'Answer a collection letter in writing and deny the claim, with your reasons',
        'Antworte auf ein Inkassoschreiben schriftlich und bestreite die Forderung mit deinen Gründen',
        'high',
      ],
      [
        'Ask a consumer advice centre before you hire a lawyer',
        'Frag eine Verbraucherzentrale, bevor du einen Anwalt beauftragst',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Since 2022 online shops and providers must offer a cancel button on their website: if it is missing, a contract can often be cancelled at any time. Take a screenshot of the page.',
      'Seit 2022 müssen Online-Shops und Anbieter einen Kündigungsbutton auf ihrer Webseite anbieten: fehlt er, lässt sich ein Vertrag oft jederzeit kündigen. Mach einen Screenshot der Seite.',
    ],
  }),
  emergencyCard({
    id: 'E112',
    tier: 'blaze',
    category: 'legal',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'employed' },
    insurance: 'legal',
    deductible: 150,
    title: ['The Employer Withholds Your Pay', 'Der Arbeitgeber zahlt dein Gehalt nicht'],
    story: [
      'The salary is late. Then it is late again. The boss says next week, three weeks in a row, and the rent is due on the first.',
      'Das Gehalt kommt zu spät. Dann wieder. Der Chef sagt nächste Woche, drei Wochen hintereinander, und die Miete ist am Ersten fällig.',
    ],
    description: [
      'An employer who does not pay is in breach of the contract, and you can claim the pay at the labour court. In the meantime you have to live: ask for a payment plan from the landlord and the bank. Legal protection pays the lawyer, and the court costs are small.',
      'Ein Arbeitgeber, der nicht zahlt, bricht den Vertrag, und du kannst das Gehalt beim Arbeitsgericht einklagen. In der Zwischenzeit musst du leben: bitte Vermieter und Bank um einen Zahlungsplan. Die Rechtsschutz zahlt den Anwalt, und die Gerichtskosten sind klein.',
    ],
    insuranceNote: [
      'Legal protection with the employment module pays the lawyer and the court costs; you pay about 150. The unpaid wages you still have to claim.',
      'Die Rechtsschutz mit dem Arbeitsrechtsbaustein zahlt Anwalt und Gerichtskosten; du zahlst etwa 150. Das unbezahlte Gehalt musst du weiterhin einfordern.',
    ],
    buckets: [
      [
        'Lawyer for the unpaid wages',
        'Anwalt für das ausstehende Gehalt',
        700,
        'A lawyer for a wage claim costs about 400-1,000; in the first instance each side pays its own lawyer.',
        'Ein Anwalt für eine Lohnklage kostet etwa 400-1.000; in der ersten Instanz zahlt jede Seite ihren Anwalt selbst.',
        [BA],
      ],
      [
        'Court costs and a bailiff',
        'Gerichtskosten und Gerichtsvollzieher',
        300,
        'The labour court costs are small; a bailiff costs about 100-300 if the employer does not pay after the verdict.',
        'Die Kosten des Arbeitsgerichts sind klein; ein Gerichtsvollzieher kostet etwa 100-300, wenn der Arbeitgeber nach dem Urteil nicht zahlt.',
      ],
    ],
    links: [BA, VZ],
    actions: [
      [
        'Write to your employer in writing with a deadline for the unpaid pay',
        'Schreib deinem Arbeitgeber schriftlich mit einer Frist für das ausstehende Gehalt',
        'high',
      ],
      [
        'Ask the employment agency about insolvency pay if the company is in trouble',
        'Frag die Arbeitsagentur nach Insolvenzgeld, wenn die Firma in Schwierigkeiten ist',
        'medium',
      ],
      [
        'Mind the deadlines in your contract: wage claims can lapse after a few months',
        'Beachte die Fristen in deinem Vertrag: Lohnansprüche können nach einigen Monaten verfallen',
        'high',
      ],
    ],
    tip: [
      'tip',
      'Many work contracts have a deadline of three months to claim pay in writing: after that the claim can be gone. Write to your employer at once, even if you hope it will be paid.',
      'Viele Arbeitsverträge haben eine Ausschlussfrist von drei Monaten, um Lohn schriftlich einzufordern: danach kann der Anspruch weg sein. Schreib deinem Arbeitgeber sofort, auch wenn du hoffst, dass gezahlt wird.',
    ],
  }),
  emergencyCard({
    id: 'E113',
    tier: 'flame',
    category: 'health',
    type: 'multi',
    payment: 'pay_now',
    insurance: 'dental',
    deductible: 100,
    title: ['A Cracked Tooth on Sunday', 'Ein abgebrochener Zahn am Sonntag'],
    story: [
      'A hard bread crust, a crack, and a sharp edge that cuts your tongue. Of course it is Sunday.',
      'Eine harte Brotkruste, ein Knacken und eine scharfe Kante, die die Zunge schneidet. Natürlich ist Sonntag.',
    ],
    description: [
      'A cracked tooth needs a dentist at once, and on a weekend the emergency service costs extra. The first care is paid by the health insurance; the better crown that lasts is largely your own cost, and a dental top-up pays most of it.',
      'Ein abgebrochener Zahn braucht sofort einen Zahnarzt, und am Wochenende kostet der Notdienst extra. Die erste Versorgung zahlt die Krankenkasse; die bessere, dauerhafte Krone ist großteils dein eigener Posten, und eine Zahnzusatzversicherung zahlt das meiste davon.',
    ],
    insuranceNote: [
      'A dental top-up pays most of the better crown and the emergency fee; you pay about 100.',
      'Eine Zahnzusatzversicherung zahlt das meiste der besseren Krone und der Notdienstgebühr; du zahlst etwa 100.',
    ],
    buckets: [
      [
        'The emergency dentist',
        'Der zahnärztliche Notdienst',
        90,
        'An emergency service on a weekend charges a fee of about 30-60 on top of the treatment; the first care is paid by the insurer.',
        'Ein Notdienst am Wochenende verlangt eine Gebühr von etwa 30-60 zusätzlich zur Behandlung; die erste Versorgung zahlt die Kasse.',
        [BMG],
      ],
      [
        'The temporary and the final crown',
        'Die provisorische und die endgültige Krone',
        520,
        'A ceramic crown costs about 500-900 in all; the insurer pays only the fixed share of the standard type.',
        'Eine Keramikkrone kostet insgesamt etwa 500-900; die Kasse zahlt nur den Festzuschuss der Regelversorgung.',
        [TEST],
      ],
    ],
    links: [TEST, BMG],
    actions: [
      [
        'Find the emergency dentist of your area through the on-call number 116 117',
        'Finde den zahnärztlichen Notdienst deiner Gegend über die Bereitschaftsnummer 116 117',
        'high',
      ],
      [
        'Keep the broken piece in milk or a tooth box and bring it along',
        'Bewahre das abgebrochene Stück in Milch oder einer Zahnrettungsbox auf und bring es mit',
        'medium',
      ],
      [
        'Ask for a cost plan before the final crown and send it to your top-up insurer',
        'Lass dir vor der endgültigen Krone einen Kostenplan geben und schick ihn an deine Zusatzversicherung',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'The number 116 117 of the medical on-call service tells you the open emergency dentist of your area at any hour: save it in your phone before you need it.',
      'Die Nummer 116 117 des ärztlichen Bereitschaftsdienstes nennt dir zu jeder Stunde den offenen Notdienst-Zahnarzt deiner Gegend: speichere sie in deinem Handy, bevor du sie brauchst.',
    ],
  }),
  emergencyCard({
    id: 'E114',
    tier: 'blaze',
    category: 'family',
    type: 'multi',
    payment: 'plan_ok',
    needs: { kidsAtLeast: 1 },
    insurance: 'dental',
    deductible: 200,
    title: ['A Child Knocks Out a Tooth', 'Ein Kind schlägt sich einen Zahn aus'],
    story: [
      'A swing, a jump, a scream and a front tooth on the grass. The child is brave; you are not.',
      'Eine Schaukel, ein Sprung, ein Schrei und ein Schneidezahn im Gras. Das Kind ist tapfer; du nicht.',
    ],
    description: [
      'After a tooth accident the first care is paid by the health insurance, but the follow-up often is not: a splint, a gap keeper, later a bridge or an implant when the child has grown. A dental top-up for the child pays much of it. Go to the dentist within the hour.',
      'Nach einem Zahnunfall zahlt die Krankenkasse die erste Versorgung, die Folgen oft aber nicht: eine Schiene, ein Lückenhalter, später eine Brücke oder ein Implantat, wenn das Kind ausgewachsen ist. Eine Zahnzusatzversicherung für das Kind zahlt davon viel. Geh innerhalb der ersten Stunde zum Zahnarzt.',
    ],
    insuranceNote: [
      'A dental top-up for the child pays most of the follow-up care; you pay about 200. Without it the splints and the later replacement are yours.',
      'Eine Zahnzusatzversicherung für das Kind zahlt das meiste der Nachsorge; du zahlst etwa 200. Ohne sie sind Schienen und der spätere Ersatz deine.',
    ],
    buckets: [
      [
        'Splint, check-ups and a gap keeper',
        'Schiene, Kontrollen und ein Lückenhalter',
        500,
        'The first splint is paid by the insurer; the check-ups over a year and a gap keeper are often your own cost: about 300-700.',
        'Die erste Schiene zahlt die Kasse; die Kontrollen über ein Jahr und ein Lückenhalter sind oft dein eigener Posten: etwa 300-700.',
        [TEST],
      ],
      [
        'A later replacement of the tooth',
        'Ein späterer Ersatz des Zahns',
        800,
        'When the jaw has grown, a bridge or an implant replaces the tooth: about 1,500-3,000 in all, planned for years ahead.',
        'Wenn der Kiefer ausgewachsen ist, ersetzt eine Brücke oder ein Implantat den Zahn: insgesamt etwa 1.500-3.000, für Jahre im Voraus geplant.',
      ],
    ],
    links: [TEST, BMG],
    actions: [
      [
        'Put the tooth in milk and go to a dentist within the hour: a knocked-out tooth can often be put back',
        'Leg den Zahn in Milch und geh innerhalb einer Stunde zum Zahnarzt: ein ausgeschlagener Zahn lässt sich oft wieder einsetzen',
        'high',
      ],
      [
        'Tell your top-up insurer of the accident and keep all bills',
        'Melde den Unfall deiner Zusatzversicherung und bewahre alle Rechnungen auf',
        'medium',
      ],
      [
        'Plan the later replacement: ask the dentist at what age it can be done',
        'Plane den späteren Ersatz: frag den Zahnarzt, in welchem Alter er möglich ist',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Never touch the root of a knocked-out tooth: hold it by the crown, rinse it briefly with milk, and put it back in the socket or in cold milk. In the first 30 minutes the chance to save it is highest.',
      'Fass die Wurzel eines ausgeschlagenen Zahns nie an: halte ihn an der Krone, spül ihn kurz mit Milch ab und setz ihn zurück in die Zahnlücke oder in kalte Milch. In den ersten 30 Minuten ist die Chance, ihn zu retten, am höchsten.',
    ],
  }),
];
