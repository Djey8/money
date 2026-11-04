import { elink, emergencyDetail, type EmergencyDetails } from './cashflow-emergency-kit';

const VZ = elink(
  'Consumer advice centre',
  'Verbraucherzentrale',
  'https://www.verbraucherzentrale.de/',
);
const ADAC = elink('ADAC – advice', 'ADAC – Ratgeber', 'https://www.adac.de/');
const TEST = elink('Stiftung Warentest', 'Stiftung Warentest', 'https://www.test.de/');
const FINANZTIP = elink('Finanztip', 'Finanztip', 'https://www.finanztip.de/');
const GDV = elink(
  "GDV – insurers' association",
  'GDV – Versicherungsverband',
  'https://www.gdv.de/',
);
const MIETERBUND = elink(
  "German Tenants' Association",
  'Deutscher Mieterbund',
  'https://www.mieterbund.de/',
);
const POLICE = elink(
  'Police advice on crime prevention',
  'Polizeiliche Kriminalprävention',
  'https://www.polizei-beratung.de/',
);
const BSI = elink('BSI – safe on the internet', 'BSI – sicher im Netz', 'https://www.bsi.bund.de/');
const SPERR = elink('Sperr-Notruf 116 116', 'Sperr-Notruf 116 116', 'https://www.116116.de/');

/** The detail of the Blaze, Wildfire and Inferno cards of the first stack (E17-E31, E34-E35, E37, E40, E45). */
export const BIG_DETAILS: Record<string, EmergencyDetails> = {
  E17: emergencyDetail({
    description: [
      'A laptop that dies two weeks before the exams: repair it and live without it for a while, or buy a new one now. For a student the laptop is the tool of the whole study, so the days without it cost too.',
      'Ein Laptop, der zwei Wochen vor den Prüfungen ausfällt: reparieren und eine Weile ohne leben oder jetzt ein neues kaufen. Für Studierende ist der Laptop das Werkzeug des ganzen Studiums, die Tage ohne ihn kosten also auch.',
    ],
    buckets: [
      [
        'A repair of a screen or a board costs about 150-400 and takes one to two weeks. Ask for a fixed quote first; for an old model the repair may cost more than it is worth.',
        'Eine Reparatur von Display oder Mainboard kostet etwa 150-400 und dauert ein bis zwei Wochen. Frag zuerst nach einem Festpreis; bei einem alten Modell kann die Reparatur mehr kosten, als es wert ist.',
      ],
      [
        'A new laptop that is good enough for study costs about 600-1,100; refurbished business laptops with a warranty cost 300-600. Use the student discount.',
        'Ein neuer Laptop, der fürs Studium reicht, kostet etwa 600-1.100; generalüberholte Business-Laptops mit Garantie kosten 300-600. Nutze den Studentenrabatt.',
        [TEST],
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Ask the university library or the IT service for a loan laptop for the exams',
        'Frag Bibliothek oder IT-Service der Hochschule nach einem Leih-Laptop für die Prüfungen',
        'high',
      ],
      [
        'Copy your files to a cloud or a stick today, before anything else breaks',
        'Kopiere deine Dateien heute in eine Cloud oder auf einen Stick, bevor etwas anderes kaputtgeht',
        'high',
      ],
      [
        'Compare a refurbished model with a warranty with a new one',
        'Vergleiche ein generalüberholtes Modell mit Garantie mit einem neuen',
      ],
    ],
    tip: [
      'tip',
      'Many universities lend laptops for a few days and some pay a grant for a hardship: ask the student services before you spend a month of budget.',
      'Viele Hochschulen verleihen Laptops für einige Tage, und manche zahlen in Härtefällen einen Zuschuss: frag das Studierendenwerk, bevor du ein Monatsbudget ausgibst.',
    ],
  }),
  E18: emergencyDetail({
    description: [
      'A stolen bike is one of the most common thefts in Germany, and the cut lock is the usual sign. Household insurance pays for the bike only if it includes a bike clause and the bike was locked; the new price is replaced, minus the deductible.',
      'Ein gestohlenes Fahrrad gehört zu den häufigsten Diebstählen in Deutschland, und das aufgeschnittene Schloss ist das übliche Zeichen. Die Hausrat zahlt das Rad nur, wenn sie eine Fahrradklausel hat und das Rad abgeschlossen war; ersetzt wird der Neuwert, minus Selbstbeteiligung.',
    ],
    buckets: [
      [
        'The die is the kind of bike: 1-3 an old city bike (400), 4-5 a good trekking bike (900), 6 an e-bike or a racing bike (2,500).',
        'Der Würfel ist die Art des Rades: 1-3 ein altes Stadtrad (400), 4-5 ein gutes Trekkingrad (900), 6 ein E-Bike oder Rennrad (2.500).',
        [POLICE],
      ],
    ],
    links: [POLICE, VZ],
    insuranceNote: [
      'The household insurance with a bike clause pays the new price minus a deductible of about 200; without the clause the bike is yours to replace.',
      'Die Hausrat mit Fahrradklausel zahlt den Neupreis minus eine Selbstbeteiligung von etwa 200; ohne die Klausel musst du das Rad selbst ersetzen.',
    ],
    patch: { insurance: 'household', deductibleMinor: 20000 },
    actions: [
      [
        'Report the theft to the police and write down the frame number',
        'Zeig den Diebstahl bei der Polizei an und notiere die Rahmennummer',
        'high',
      ],
      [
        'Report to the household insurer with the receipt and a photo of the bike and the lock',
        'Melde es der Hausratversicherung mit Beleg und einem Foto von Rad und Schloss',
        'high',
      ],
      [
        'Buy a better lock and lock to a fixed object, not only the wheel',
        'Kauf ein besseres Schloss und schließ an einem festen Gegenstand an, nicht nur das Rad',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Have the frame engraved or coded (many bike clubs do it for a few euros): a coded bike is much easier for the police to give back, and many policies want the number.',
      'Lass den Rahmen codieren oder gravieren (viele Fahrradclubs machen das für wenige Euro): ein codiertes Rad kann die Polizei viel leichter zurückgeben, und viele Policen wollen die Nummer.',
    ],
  }),
  E19: emergencyDetail({
    description: [
      'A tiny stone, a chip, and a crack two days later. A chip repaired early costs little and is often free with a partial cover; a crack means a new windscreen with a deductible. Waiting is a gamble with the dice.',
      'Ein winziger Stein, ein Einschlag und zwei Tage später ein Riss. Ein früh reparierter Einschlag kostet wenig und ist mit Teilkasko oft gratis; ein Riss heißt neue Scheibe mit Selbstbeteiligung. Warten ist ein Würfelspiel.',
    ],
    buckets: [
      [
        'A chip repair takes 30 minutes and costs about 60-120; with a partial cover it is often free (no deductible). Do it at once.',
        'Eine Einschlagreparatur dauert 30 Minuten und kostet etwa 60-120; mit Teilkasko ist sie oft gratis (ohne Selbstbeteiligung). Mach sie sofort.',
        [ADAC],
      ],
      [
        'If you wait, the chip may crack: a new windscreen costs 400-1,200 (more with sensors and a camera), minus your deductible with a partial cover.',
        'Wenn du wartest, kann der Einschlag reißen: eine neue Scheibe kostet 400-1.200 (mehr mit Sensoren und Kamera), mit Teilkasko abzüglich deiner Selbstbeteiligung.',
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Cover the chip with a clear tape and drive carefully until it is repaired',
        'Klebe den Einschlag mit durchsichtigem Klebeband ab und fahr vorsichtig, bis er repariert ist',
        'high',
      ],
      [
        'Call a glass service or your workshop: a chip repair is quick',
        'Ruf einen Glasservice oder deine Werkstatt an: eine Einschlagreparatur geht schnell',
        'high',
      ],
      [
        'Check whether your partial cover includes the glass repair without a deductible',
        'Prüf, ob deine Teilkasko die Glasreparatur ohne Selbstbeteiligung einschließt',
      ],
    ],
    tip: [
      'tip',
      "A chip smaller than a two-euro coin and outside the driver's view can usually be repaired: a repair is cheaper than a new screen and it keeps your insurance class.",
      'Ein Einschlag kleiner als eine Zwei-Euro-Münze und außerhalb des Sichtfelds des Fahrers lässt sich meist reparieren: eine Reparatur ist günstiger als eine neue Scheibe und schont deine Schadenfreiheitsklasse.',
    ],
  }),
  E20: emergencyDetail({
    description: [
      'The annual utility bill brings a back payment for the heating, and the monthly advance goes up. How much depends on the year and the weather. A tenant has the right to see the bill and to check it within a year.',
      'Die jährliche Nebenkostenabrechnung bringt eine Nachzahlung für die Heizung, und die monatliche Vorauszahlung steigt. Wie viel, hängt vom Jahr und vom Wetter ab. Mieter dürfen die Abrechnung einsehen und binnen eines Jahres prüfen.',
    ],
    buckets: [
      [
        'The die is the size of the bill: 1-2 a small one (300), 3-4 normal (600), 5 a big one (1,000), 6 a very big one after a cold winter (1,800). The monthly prepayment goes up after it.',
        'Der Würfel ist die Höhe der Rechnung: 1-2 eine kleine (300), 3-4 normal (600), 5 eine große (1.000), 6 eine sehr große nach einem kalten Winter (1.800). Danach steigt die monatliche Vorauszahlung.',
        [MIETERBUND],
      ],
    ],
    links: [MIETERBUND, VZ],
    actions: [
      [
        'Check the bill for mistakes: the area, the number of people, the heating costs',
        'Prüf die Abrechnung auf Fehler: Fläche, Personenzahl, Heizkosten',
        'high',
      ],
      [
        'Ask the landlord to show the bills and the meter readings',
        'Bitte den Vermieter, die Belege und Zählerstände zu zeigen',
      ],
      [
        'Ask for a payment in parts if the sum is too big for one month',
        'Bitte um Ratenzahlung, wenn die Summe für einen Monat zu groß ist',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A landlord has twelve months after the billing year to send the bill: a bill that arrives later cannot demand a back payment (a refund still has to be paid).',
      'Ein Vermieter hat zwölf Monate nach dem Abrechnungsjahr Zeit, die Abrechnung zu schicken: eine spätere kann keine Nachzahlung mehr verlangen (ein Guthaben muss er trotzdem auszahlen).',
    ],
  }),
  E21: emergencyDetail({
    description: [
      'You moved out and the landlord keeps part of the deposit "for repairs". Normal wear is the landlord\'s cost; only damage beyond it can be charged. The photos of the handover are your best evidence. You may join a tenants\' association for help.',
      'Du bist ausgezogen, und der Vermieter behält einen Teil der Kaution "für Reparaturen". Normale Abnutzung ist Sache des Vermieters; nur darüber hinausgehende Schäden dürfen berechnet werden. Die Fotos der Übergabe sind dein bester Beweis. Du kannst für Hilfe einem Mieterverein beitreten.',
    ],
    buckets: [
      [
        "The die is the size of the deduction: 1-2 small (200), 3-5 normal (500), 6 very high (900). You can roll again for a fee if you join a tenants' association.",
        'Der Würfel ist die Höhe des Abzugs: 1-2 klein (200), 3-5 normal (500), 6 sehr hoch (900). Du kannst gegen eine Gebühr neu würfeln, wenn du einem Mieterverein beitrittst.',
        [MIETERBUND],
      ],
    ],
    links: [MIETERBUND, VZ],
    actions: [
      [
        'Ask for an itemised list of the deductions with the receipts',
        'Verlang eine Aufstellung der Abzüge mit Belegen',
        'high',
      ],
      [
        'Show your photos and the handover protocol',
        'Leg deine Fotos und das Übergabeprotokoll vor',
        'high',
      ],
      [
        "Join a tenants' association for advice on the deductions",
        'Tritt einem Mieterverein bei, um dich zu den Abzügen beraten zu lassen',
      ],
    ],
    tip: [
      'tip',
      'A landlord has to settle the deposit within a reasonable time, usually three to six months. Photograph every room at move-in and at move-out, with the date: it is the best protection you can have.',
      'Ein Vermieter muss die Kaution in angemessener Zeit abrechnen, meist drei bis sechs Monate. Fotografiere jeden Raum beim Einzug und beim Auszug mit Datum: es ist der beste Schutz, den du haben kannst.',
    ],
  }),
  E22: emergencyDetail({
    description: [
      'A loan to a friend that never came back: the money is gone, and sometimes the friendship with it. It happens to most people once. Putting a loan in writing and lending only what you can lose protects both sides.',
      'Ein Darlehen an einen Freund, das nie zurückkam: das Geld ist weg, manchmal auch die Freundschaft. Den meisten passiert das einmal. Ein Darlehen schriftlich festzuhalten und nur zu verleihen, was man verlieren kann, schützt beide Seiten.',
    ],
    buckets: [
      [
        'The sum is lost: you can try a reminder letter and a payment plan; a court order costs a fee, and is only worth it if the friend has money or a job.',
        'Die Summe ist verloren: du kannst es mit Mahnschreiben und Ratenplan versuchen; ein Mahnbescheid kostet eine Gebühr und lohnt nur, wenn der Freund Geld oder Arbeit hat.',
        [VZ],
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Write a clear message with the sum and a date, and offer a payment plan',
        'Schreib eine klare Nachricht mit Summe und Datum und biete einen Ratenplan an',
        'high',
      ],
      [
        'Decide whether the friendship or the money matters more, and say so',
        'Entscheide, was wichtiger ist, die Freundschaft oder das Geld, und sag es',
        'medium',
      ],
      [
        'Next time write a short loan note with the date and the amount',
        'Schreib das nächste Mal einen kurzen Schuldschein mit Datum und Betrag',
        'low',
      ],
    ],
    tip: [
      'tip',
      'The rule of the old hands: lend only what you could give away. If it comes back, it is a bonus; if not, it hurts less and the friendship can survive.',
      'Die Regel der Alten: verleih nur, was du auch verschenken könntest. Kommt es zurück, ist es ein Bonus; wenn nicht, tut es weniger weh, und die Freundschaft kann überleben.',
    ],
  }),
  E23: emergencyDetail({
    description: [
      'An emergency at night at the vet: the emergency service charges a fixed surcharge, and the treatment depends on what the animal swallowed. A pet health insurance or a small reserve for the pet makes it easier to say yes to the treatment.',
      'Ein nächtlicher Notfall beim Tierarzt: der Notdienst verlangt eine feste Gebühr, und die Behandlung hängt davon ab, was das Tier verschluckt hat. Eine Tierkrankenversicherung oder eine kleine Rücklage fürs Tier macht es leichter, zur Behandlung Ja zu sagen.',
    ],
    buckets: [
      [
        "The emergency fee is set by the vets' fee schedule: at least 50 for each emergency service, at night and on weekends.",
        'Die Notdienstgebühr legt die Gebührenordnung der Tierärzte fest: mindestens 50 für jeden Notdienst, nachts und am Wochenende.',
        [
          elink(
            'Federal Chamber of Veterinarians',
            'Bundestierärztekammer',
            'https://www.bundestieraerztekammer.de/',
          ),
        ],
      ],
      [
        'The die is the treatment: 1-3 observation or an injection (300), 4-5 an X-ray and a stay (900), 6 an operation (2,500).',
        'Der Würfel ist die Behandlung: 1-3 Beobachtung oder eine Spritze (300), 4-5 Röntgen und ein Aufenthalt (900), 6 eine Operation (2.500).',
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Call the vet first and ask for the approximate cost before you drive',
        'Ruf zuerst den Tierarzt an und frag nach den ungefähren Kosten, bevor du fährst',
        'high',
      ],
      [
        'Ask for a written estimate and a payment plan if the sum is big',
        'Bitte um einen schriftlichen Kostenvoranschlag und eine Ratenzahlung, wenn die Summe groß ist',
      ],
      [
        'Keep a small pet reserve or look at a pet health insurance',
        'Halte eine kleine Rücklage fürs Tier oder prüf eine Tierkrankenversicherung',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Cats and dogs swallow hair ties, strings and socks more often than anything: keep them out of reach, and never make the animal vomit before you have asked the vet.',
      'Katzen und Hunde verschlucken Haargummis, Fäden und Socken häufiger als alles andere: halte sie außer Reichweite und bring das Tier nie zum Erbrechen, bevor du den Tierarzt gefragt hast.',
    ],
  }),
  E24: emergencyDetail({
    description: [
      'A fridge that dies in summer costs a new fridge and the food inside. If the fridge belongs to the flat, the landlord has to replace it. For your own, a good A- or B-class model saves money in the years to come.',
      'Ein Kühlschrank, der im Sommer ausfällt, kostet einen neuen Kühlschrank und die Lebensmittel darin. Wenn er zur Wohnung gehört, muss ihn der Vermieter ersetzen. Bei einem eigenen spart ein gutes Modell der Klasse A oder B in den Folgejahren Geld.',
    ],
    buckets: [
      [
        'A good fridge-freezer costs about 350-700; check the energy label and the yearly use: a cheap, thirsty model costs more over ten years.',
        'Ein guter Kühl-Gefrierschrank kostet etwa 350-700; prüf das Energielabel und den Jahresverbrauch: ein billiges, durstiges Modell kostet über zehn Jahre mehr.',
        [TEST],
      ],
      [
        'Spoiled food about 40-100; a closed fridge keeps food cold for about four hours, a closed freezer for a day or two.',
        'Verdorbene Lebensmittel etwa 40-100; ein geschlossener Kühlschrank hält Lebensmittel etwa vier Stunden kalt, ein geschlossener Gefrierschrank ein bis zwei Tage.',
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Ask the landlord first: a built-in fridge is often part of the flat',
        'Frag zuerst den Vermieter: ein Einbaukühlschrank gehört oft zur Wohnung',
        'high',
      ],
      [
        'Keep the door closed and move frozen food into a cooler with ice',
        'Lass die Tür geschlossen und bring Tiefkühlware in eine Kühlbox mit Eis',
        'high',
      ],
      [
        'Compare the yearly energy cost, not only the price',
        'Vergleiche den jährlichen Stromverbrauch, nicht nur den Preis',
      ],
    ],
    tip: [
      'tip',
      'Throw away anything that stayed warmer than 7 degrees for more than four hours, especially meat, fish and milk: food poisoning costs more than the fridge.',
      'Wirf alles weg, was länger als vier Stunden wärmer als 7 Grad war, besonders Fleisch, Fisch und Milch: eine Lebensmittelvergiftung kostet mehr als der Kühlschrank.',
    ],
  }),
  E31: emergencyDetail({
    description: [
      'A pickpocket in a crowded metro: the phone is gone and with it your tickets, photos and banking apps. The first minutes decide the damage: block the SIM and the cards at once, and report the theft for the insurance.',
      'Ein Taschendieb in der vollen U-Bahn: das Handy ist weg, und mit ihm Tickets, Fotos und Banking-Apps. Die ersten Minuten entscheiden über den Schaden: sperre sofort SIM und Karten und zeig den Diebstahl für die Versicherung an.',
    ],
    buckets: [
      [
        'A new phone of the middle class costs about 350-800; a used one 150-300. A phone stolen from your pocket abroad is usually not covered by household insurance.',
        'Ein neues Handy der Mittelklasse kostet etwa 350-800; ein gebrauchtes 150-300. Ein im Ausland aus der Tasche gestohlenes Handy deckt die Hausrat meist nicht.',
        [TEST],
      ],
      [
        'A new SIM costs 10-25; your number can be transferred by the provider with your ID.',
        'Eine neue SIM kostet 10-25; deine Nummer kann der Anbieter mit deinem Ausweis übertragen.',
      ],
    ],
    links: [SPERR, POLICE],
    actions: [
      [
        'Call the block hotline 116 116 for cards and ask your provider to block the SIM',
        'Ruf den Sperr-Notruf 116 116 für Karten an und lass den Anbieter die SIM sperren',
        'high',
      ],
      [
        'Report the theft to the local police and keep the report',
        'Zeig den Diebstahl bei der örtlichen Polizei an und bewahre die Anzeige auf',
        'high',
      ],
      [
        'Lock the phone remotely with the find-my service and change your passwords',
        'Sperre das Handy aus der Ferne mit dem Ortungsdienst und ändere deine Passwörter',
      ],
    ],
    tip: [
      'tip',
      'From abroad the number +49 116 116 blocks your bank cards and your online accounts: save it in your notes or on paper before you travel.',
      'Aus dem Ausland sperrt die Nummer +49 116 116 deine Bankkarten und Online-Konten: speichere sie vor der Reise in deinen Notizen oder auf Papier.',
    ],
  }),
  E34: emergencyDetail({
    description: [
      'Bed bugs from a hostel are small, itchy and hard to get rid of. Heat is the best weapon: washing and drying at 60 degrees kills them. Do not throw things away without advice, and tell the landlord if the bugs are in the building.',
      'Bettwanzen aus dem Hostel sind klein, jucken und sind schwer loszuwerden. Hitze ist die beste Waffe: Waschen und Trocknen bei 60 Grad tötet sie. Wirf nichts ohne Rat weg und sag es dem Vermieter, wenn die Wanzen im Haus sind.',
    ],
    buckets: [
      [
        'A pest-control company needs about three visits; a flat of 40 square metres costs about 400-900 in total. Ask for a fixed price and a guarantee.',
        'Eine Schädlingsbekämpfung braucht etwa drei Besuche; eine Wohnung von 40 Quadratmetern kostet insgesamt etwa 400-900. Frag nach Festpreis und Garantie.',
        [
          elink(
            'German Environment Agency – bed bugs',
            'Umweltbundesamt – Bettwanzen',
            'https://www.umweltbundesamt.de/',
          ),
        ],
      ],
      [
        'A new mattress costs about 200-500; first ask the pest controller whether the mattress can be treated and covered.',
        'Eine neue Matratze kostet etwa 200-500; frag zuerst den Kammerjäger, ob sich die Matratze behandeln und einhüllen lässt.',
      ],
      [
        'Washing and drying of all textiles at 60 degrees: about 60-120 in a laundromat, less at home.',
        'Waschen und Trocknen aller Textilien bei 60 Grad: etwa 60-120 im Waschsalon, zu Hause weniger.',
      ],
    ],
    links: [
      elink(
        'German Environment Agency – bed bugs',
        'Umweltbundesamt – Bettwanzen',
        'https://www.umweltbundesamt.de/',
      ),
    ],
    actions: [
      [
        'Wash and dry clothes and bedding at 60 degrees, and bag them until then',
        'Wasch und trockne Kleidung und Bettwäsche bei 60 Grad und pack sie bis dahin in Tüten',
        'high',
      ],
      [
        'Call a certified pest controller, and tell the landlord in writing',
        'Ruf einen zertifizierten Kammerjäger und informiere den Vermieter schriftlich',
        'high',
      ],
      [
        'Check your luggage and the hostel bed next time before you unpack',
        'Prüf beim nächsten Mal Gepäck und Hostelbett, bevor du auspackst',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Bed bugs do not spread dirt but they travel: after a trip put your luggage in the bathroom, wash everything at 60 degrees and check the seams of the suitcase.',
      'Bettwanzen verbreiten keinen Schmutz, aber sie reisen mit: stell nach einer Reise das Gepäck ins Bad, wasch alles bei 60 Grad und prüf die Nähte des Koffers.',
    ],
  }),
  E37: emergencyDetail({
    description: [
      'A fake parcel message, a click and your banking details are gone. The bank may refund an unauthorised payment, but not always if you gave away your codes yourself. Speed decides: call the bank at once.',
      'Eine falsche Paketnachricht, ein Klick, und deine Bankdaten sind weg. Die Bank erstattet eine nicht autorisierte Zahlung eventuell, aber nicht immer, wenn du die Codes selbst herausgegeben hast. Tempo entscheidet: ruf sofort die Bank an.',
    ],
    buckets: [
      [
        'The die: 1-3 you lose the whole sum (800), 4-6 the bank stops the payment in time and you lose only a little (50). Fast action is what makes the difference.',
        'Der Würfel: 1-3 du verlierst die ganze Summe (800), 4-6 die Bank stoppt die Zahlung rechtzeitig und du verlierst nur wenig (50). Schnelles Handeln macht den Unterschied.',
        [BSI],
      ],
    ],
    links: [BSI, SPERR, VZ],
    actions: [
      [
        'Call the block hotline 116 116 and your bank, and ask for a recall of the payment',
        'Ruf den Sperr-Notruf 116 116 und deine Bank an und bitte um Rückruf der Zahlung',
        'high',
      ],
      [
        'File a report with the police and keep the message as proof',
        'Erstatte Anzeige bei der Polizei und behalte die Nachricht als Beweis',
        'high',
      ],
      [
        'Change the passwords and switch on two-factor login for your accounts',
        'Ändere die Passwörter und aktiviere die Zwei-Faktor-Anmeldung für deine Konten',
      ],
    ],
    tip: [
      'tip',
      'A parcel service never asks for banking details in a message: open the real app or website yourself, never the link in the message.',
      'Ein Paketdienst fragt nie per Nachricht nach Bankdaten: öffne selbst die echte App oder Webseite, nie den Link in der Nachricht.',
    ],
  }),
  E45: emergencyDetail({
    description: [
      'A long illness: for six weeks the employer pays the full salary; then the health insurance pays sick pay, which is lower. The gap is what you have to bridge, and a reserve and a side income make it easier.',
      'Eine lange Krankheit: sechs Wochen zahlt der Arbeitgeber das volle Gehalt; danach zahlt die Krankenkasse Krankengeld, das niedriger ist. Die Lücke musst du überbrücken, und eine Rücklage und ein Nebeneinkommen machen es leichter.',
    ],
    buckets: [
      [
        'Sick pay is about 70 percent of the gross pay and at most 90 percent of the net, from the seventh week for up to 78 weeks; the gap against your normal net pay is about 500 for two months here.',
        'Krankengeld beträgt etwa 70 Prozent des Bruttolohns und höchstens 90 Prozent des Nettos, ab der siebten Woche für bis zu 78 Wochen; die Lücke zum normalen Netto beträgt hier etwa 500 für zwei Monate.',
        [
          elink(
            'Federal Ministry of Health – sick pay',
            'Bundesgesundheitsministerium – Krankengeld',
            'https://www.bundesgesundheitsministerium.de/',
          ),
        ],
      ],
      [
        'Co-payments for medicine, physio and the taxi to the doctor add up to about 100-200 over the weeks.',
        'Zuzahlungen für Medizin, Physio und das Taxi zum Arzt summieren sich über die Wochen auf etwa 100-200.',
      ],
    ],
    links: [FINANZTIP],
    actions: [
      [
        'Tell the health insurer and get the sick note for sick pay in time',
        'Informiere die Kasse und besorge die Krankschreibung für das Krankengeld rechtzeitig',
        'high',
      ],
      [
        'Look at your reserve and cut the fixed costs you can for a while',
        'Schau auf deine Rücklage und kürze für eine Weile die Fixkosten, die du kannst',
        'high',
      ],
      [
        'Think about an income insurance when you are well again',
        'Denk über eine Einkommensabsicherung nach, wenn du wieder gesund bist',
        'low',
      ],
    ],
    tip: [
      'fact',
      'In Germany the employer pays the full salary for six weeks of one illness; then the health insurance pays sick pay for up to 78 weeks in three years for the same illness.',
      'In Deutschland zahlt der Arbeitgeber bei einer Krankheit sechs Wochen das volle Gehalt; danach zahlt die Krankenkasse für dieselbe Krankheit bis zu 78 Wochen in drei Jahren Krankengeld.',
    ],
  }),
  E25: emergencyDetail({
    description: [
      'A clutch that gives up is a wear part and not an insured damage. The workshop quote often has four digits, and the price varies a lot between workshops. Get two quotes before you agree to anything.',
      'Eine Kupplung, die aufgibt, ist ein Verschleißteil und kein versicherter Schaden. Das Angebot der Werkstatt hat oft vier Stellen, und der Preis schwankt zwischen Werkstätten stark. Hol zwei Angebote ein, bevor du zustimmst.',
    ],
    buckets: [
      [
        'Towing to a workshop costs about 100-200; a roadside service of a club or a protection letter may include it.',
        'Das Abschleppen in eine Werkstatt kostet etwa 100-200; ein Pannendienst eines Clubs oder ein Schutzbrief kann es einschließen.',
        [ADAC],
      ],
      [
        'A clutch change costs about 800-2,200 with the parts and the work, depending on the car; independent workshops are often cheaper than the dealer.',
        'Ein Kupplungswechsel kostet mit Teilen und Arbeit etwa 800-2.200 je nach Auto; freie Werkstätten sind oft günstiger als der Händler.',
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Ask two workshops for a written quote with parts and work',
        'Frag zwei Werkstätten nach einem schriftlichen Angebot mit Teilen und Arbeit',
        'high',
      ],
      [
        'Ask whether the dual-mass flywheel has to be changed, it is the big cost',
        'Frag, ob das Zweimassenschwungrad getauscht werden muss, es ist der große Posten',
        'high',
      ],
      [
        'Ask to see the old parts after the repair',
        'Lass dir nach der Reparatur die alten Teile zeigen',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Clutch wear is a matter of driving: do not rest the foot on the pedal and do not hold the car on a hill with the clutch. A clutch can last 150,000 km or only 60,000.',
      'Kupplungsverschleiß hängt vom Fahren ab: ruh den Fuß nicht auf dem Pedal und halte das Auto am Berg nicht mit der Kupplung. Eine Kupplung kann 150.000 km halten oder nur 60.000.',
    ],
  }),
  E26: emergencyDetail({
    description: [
      'A burglary takes more than things: the sense of safety goes with them. Household insurance pays the replacement of stolen things, but needs a report to the police and a list. The cash and valuables are covered only up to a limit.',
      'Ein Einbruch nimmt mehr als Sachen: das Sicherheitsgefühl geht mit. Die Hausratversicherung zahlt den Ersatz gestohlener Sachen, braucht aber eine Anzeige bei der Polizei und eine Liste. Bargeld und Wertsachen sind nur bis zu einer Grenze gedeckt.',
    ],
    buckets: [
      [
        'The stolen items, replaced at the new price by the household insurance; cash is covered only up to a limit of about 1,000, more in a safe. Keep receipts and photos of your things.',
        'Die gestohlenen Sachen, von der Hausrat zum Neuwert ersetzt; Bargeld ist nur bis etwa 1.000 gedeckt, im Safe mehr. Bewahre Belege und Fotos deiner Sachen auf.',
        [GDV],
      ],
      [
        'A new lock cylinder costs about 100-250 with the work; after a break-in ask the landlord, in a rental flat it is usually his task.',
        'Ein neuer Schließzylinder kostet mit Arbeit etwa 100-250; frag nach einem Einbruch den Vermieter, in einer Mietwohnung ist es meist seine Aufgabe.',
      ],
      [
        "The door or the frame repair costs about 300-800; the household insurance pays damage from a break-in, if the door belongs to you; in a rented flat the landlord's building insurance.",
        'Die Reparatur von Tür oder Rahmen kostet etwa 300-800; die Hausrat zahlt den Schaden durch den Einbruch, wenn die Tür dir gehört; in einer Mietwohnung die Gebäudeversicherung des Vermieters.',
        [POLICE],
      ],
    ],
    links: [POLICE, GDV],
    actions: [
      [
        'Call the police (110) and do not touch anything',
        'Ruf die Polizei (110) und fass nichts an',
        'high',
      ],
      [
        'List the stolen things with price and date; add photos and receipts',
        'Liste die gestohlenen Sachen mit Preis und Datum auf; füge Fotos und Belege hinzu',
        'high',
      ],
      [
        'Report to the household insurance at once and ask about an advance',
        'Melde es sofort der Hausratversicherung und frag nach einem Vorschuss',
      ],
    ],
    tip: [
      'tip',
      'Tilted windows are an invitation: most break-ins use the window or the balcony door, and a tilted window counts as open for the insurance. Close and lock them when you leave.',
      'Gekippte Fenster sind eine Einladung: die meisten Einbrüche nutzen Fenster oder Balkontür, und ein gekipptes Fenster gilt für die Versicherung als offen. Schließ und verriegle sie, wenn du gehst.',
    ],
  }),
  E27: emergencyDetail({
    description: [
      'A burst hose in a flat while you are at work: water runs for hours, and the neighbour below has a wet ceiling. The damage to others is a case for your liability insurance; the damage to your own things for the household insurance.',
      'Ein geplatzter Schlauch in einer Wohnung, während du arbeitest: das Wasser läuft stundenlang, und der Nachbar unter dir hat eine nasse Decke. Der Schaden bei anderen ist ein Fall für deine Haftpflicht; der an deinen Sachen für die Hausrat.',
    ],
    buckets: [
      [
        'A drying company charges by the day and the machine: a flat of 60 square metres costs about 1,000-2,500 for two weeks. Call it at once: wet walls grow mould in days.',
        'Eine Trocknungsfirma rechnet nach Tag und Gerät ab: eine Wohnung von 60 Quadratmetern kostet für zwei Wochen etwa 1.000-2.500. Ruf sie sofort: nasse Wände schimmeln binnen Tagen.',
        [GDV],
      ],
      [
        "The neighbour's ceiling, paint and furniture: about 2,000-5,000. This is the main case for the liability insurance. The neighbour's insurer often pays and then asks yours.",
        'Decke, Farbe und Möbel des Nachbarn: etwa 2.000-5.000. Das ist der Hauptfall der Haftpflicht. Die Versicherung des Nachbarn zahlt oft und fragt dann deine.',
      ],
    ],
    links: [GDV, VZ],
    actions: [
      [
        'Turn off the water at the main valve at once',
        'Dreh das Wasser sofort am Hauptventil ab',
        'high',
      ],
      [
        'Tell the landlord, the neighbour and your liability and household insurer',
        'Informiere Vermieter, Nachbarn und deine Haftpflicht- und Hausratversicherung',
        'high',
      ],
      [
        'Take photos of everything before drying starts',
        'Mach Fotos von allem, bevor die Trocknung beginnt',
      ],
    ],
    tip: [
      'tip',
      'Rubber hoses of a washing machine age after about five to ten years: change them for hoses with a water stop, and know where your main water valve is before you need it.',
      'Gummischläuche einer Waschmaschine altern nach etwa fünf bis zehn Jahren: tausch sie gegen Schläuche mit Wasserstopp, und wisse, wo dein Hauptventil ist, bevor du es brauchst.',
    ],
  }),
  E28: emergencyDetail({
    description: [
      'A moment of attention lost on the bike, and somebody is hurt. The costs depend on the injury: from a sprained wrist to a long treatment and lost income. Private liability insurance exists for exactly this, and with a high sum insured it is cheap.',
      'Ein Moment Unaufmerksamkeit auf dem Rad, und jemand ist verletzt. Die Kosten hängen von der Verletzung ab: vom verstauchten Handgelenk bis zu langer Behandlung und Verdienstausfall. Dafür gibt es die Privathaftpflicht, und mit hoher Deckungssumme ist sie günstig.',
    ],
    buckets: [
      [
        'The die: 1-3 a minor injury (800), 4-5 a broken wrist or a long treatment (4,000), 6 a serious injury with lasting damage (12,000). Without insurance you pay it yourself, and a judge may order a lifelong pension.',
        'Der Würfel: 1-3 leichte Verletzung (800), 4-5 gebrochenes Handgelenk oder lange Behandlung (4.000), 6 schwere Verletzung mit Dauerschaden (12.000). Ohne Versicherung zahlst du selbst, und ein Gericht kann eine lebenslange Rente anordnen.',
        [GDV],
      ],
    ],
    links: [GDV, FINANZTIP],
    insuranceNote: [
      'Liability insurance pays the claim up to the sum insured; make sure the sum is at least 10 million, because a serious injury can cost much more.',
      'Die Haftpflicht zahlt die Forderung bis zur Deckungssumme; achte darauf, dass sie mindestens 10 Millionen beträgt, denn eine schwere Verletzung kann viel mehr kosten.',
    ],
    patch: {
      uninsuredExtra: {
        label: {
          en: 'Lawyer, court and follow-up claims',
          de: 'Anwalt, Gericht und Folgeforderungen',
        },
        amountMinor: 150000,
        notes: {
          en: 'Without insurance you also pay your own lawyer and the claims that follow years later.',
          de: 'Ohne Versicherung zahlst du auch den eigenen Anwalt und die Forderungen, die Jahre später folgen.',
        },
      },
    },
    actions: [
      [
        'Help first: call the emergency number 112 and stay with the person',
        'Hilf zuerst: ruf die 112 und bleib bei der Person',
        'high',
      ],
      [
        'Exchange names and addresses and tell your liability insurer at once',
        'Tausche Namen und Adressen aus und informiere sofort deine Haftpflichtversicherung',
        'high',
      ],
      [
        'Do not admit guilt in writing: let the insurer handle the claim',
        'Erkenne keine Schuld schriftlich an: lass den Versicherer die Forderung klären',
      ],
    ],
    tip: [
      'tip',
      'A private liability policy costs about 50-80 a year for a single person and covers up to 10 million or more: it is the one insurance nearly every adult is told to have.',
      'Eine Privathaftpflicht kostet für eine Einzelperson etwa 50-80 im Jahr und deckt bis 10 Millionen oder mehr: sie ist die eine Versicherung, die fast jedem Erwachsenen empfohlen wird.',
    ],
  }),
  E29: emergencyDetail({
    description: [
      'An oil fire in the pan: you put it out, but the kitchen is black and smells of smoke for weeks. The household insurance pays the cleaning, the burnt things and the nights elsewhere; the building belongs to the landlord.',
      'Ein Fettbrand in der Pfanne: du löschst ihn, aber die Küche ist schwarz und riecht wochenlang nach Rauch. Die Hausrat zahlt die Reinigung, die verbrannten Sachen und die Nächte woanders; das Gebäude gehört dem Vermieter.',
    ],
    buckets: [
      [
        'Specialist cleaning of walls, ceiling and textiles after smoke costs about 1,200-2,500; ordinary cleaning does not remove the smell.',
        'Die Spezialreinigung von Wänden, Decke und Textilien nach Rauch kostet etwa 1.200-2.500; normale Reinigung nimmt den Geruch nicht weg.',
        [GDV],
      ],
      [
        'Kitchen items, appliances and clothes that cannot be saved: about 1,500-3,000 at the time value or the new price with the household insurance.',
        'Küchengeräte, Geräte und Kleidung, die nicht zu retten sind: etwa 1.500-3.000 zum Zeitwert oder Neuwert mit der Hausrat.',
      ],
      [
        'A few nights in a hotel or with friends while the flat is cleaned: about 400-800.',
        'Einige Nächte im Hotel oder bei Freunden, während die Wohnung gereinigt wird: etwa 400-800.',
      ],
    ],
    links: [GDV, VZ],
    actions: [
      [
        'Call the fire brigade (112) for any fire you cannot put out at once',
        'Ruf die Feuerwehr (112) bei jedem Brand, den du nicht sofort löschen kannst',
        'high',
      ],
      [
        'Photograph the damage before anything is cleaned, and tell the insurer',
        'Fotografiere den Schaden, bevor etwas gereinigt wird, und informiere die Versicherung',
        'high',
      ],
      [
        'Buy a fire blanket and a smoke detector for the kitchen and the corridor',
        'Kauf eine Löschdecke und einen Rauchmelder für Küche und Flur',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Never pour water on burning oil: it explodes into a fireball. Put a lid or a fire blanket on the pan and turn the heat off. A fire blanket costs about 15.',
      'Gieß nie Wasser auf brennendes Öl: es verpufft zu einem Feuerball. Leg einen Deckel oder eine Löschdecke auf die Pfanne und schalt die Hitze aus. Eine Löschdecke kostet etwa 15.',
    ],
  }),
  E35: emergencyDetail({
    description: [
      'Losing the key to a main entrance can mean that a whole locking system has to be replaced, and the landlord may pass the cost on. A liability insurance with a key-loss clause pays for the loss of keys that belong to others - up to a limit.',
      'Ein verlorener Schlüssel zur Haustür kann bedeuten, dass eine ganze Schließanlage ersetzt werden muss, und der Vermieter gibt die Kosten vielleicht weiter. Eine Haftpflicht mit Schlüsselklausel zahlt den Verlust fremder Schlüssel - bis zu einer Grenze.',
    ],
    buckets: [
      [
        "Replacing a locking system of a house can cost 1,000-5,000 or more; the tenant's share depends on the case. The insurance with a key clause pays most of it.",
        'Der Ersatz einer Schließanlage eines Hauses kann 1.000-5.000 oder mehr kosten; der Anteil des Mieters hängt vom Fall ab. Die Versicherung mit Schlüsselklausel zahlt das meiste.',
        [GDV],
      ],
    ],
    links: [GDV, MIETERBUND],
    insuranceNote: [
      'The key-loss clause of the liability insurance pays for keys of others up to a limit; check it: some policies pay only 1,000, good ones 20,000 or more.',
      'Die Schlüsselklausel der Haftpflicht zahlt fremde Schlüssel bis zu einer Grenze; prüf sie: manche Policen zahlen nur 1.000, gute 20.000 oder mehr.',
    ],
    actions: [
      [
        'Tell the landlord at once and ask whether the key is registered',
        'Sag es dem Vermieter sofort und frag, ob der Schlüssel registriert ist',
        'high',
      ],
      [
        'Report to the liability insurer before you agree to pay anything',
        'Melde es dem Haftpflichtversicherer, bevor du einer Zahlung zustimmst',
        'high',
      ],
      [
        'Ask the landlord for a quote and what exactly has to be replaced',
        'Bitte den Vermieter um ein Angebot und was genau ersetzt werden muss',
      ],
    ],
    tip: [
      'tip',
      'Look at your liability policy for the key clause: many only cover keys of the private area, not general keys of a company or a house. A good clause costs only a few euros a year more.',
      'Schau in deiner Haftpflicht nach der Schlüsselklausel: viele decken nur Schlüssel des privaten Bereichs, nicht Generalschlüssel einer Firma oder eines Hauses. Eine gute Klausel kostet nur wenige Euro im Jahr mehr.',
    ],
  }),
  E40: emergencyDetail({
    description: [
      "A notice for the landlord's own use is often legal, but it has rules: the reason must be real, the notice period is at least three months, and a hardship can be objected to. A tenants' association or a lawyer can check the notice.",
      'Eine Eigenbedarfskündigung ist oft rechtens, hat aber Regeln: der Grund muss echt sein, die Kündigungsfrist beträgt mindestens drei Monate, und ein Härtefall kann widersprochen werden. Ein Mieterverein oder ein Anwalt kann die Kündigung prüfen.',
    ],
    buckets: [
      [
        'A moving van with helpers for a day costs about 300-700; friends with a van are cheaper. Book early: the end of the month is busy.',
        'Ein Transporter mit Helfern für einen Tag kostet etwa 300-700; Freunde mit einem Wagen sind günstiger. Buch früh: das Monatsende ist ausgebucht.',
        [VZ],
      ],
      [
        'You may pay two rents for a month or two while you move; ask the landlord to let you out earlier.',
        'Du zahlst vielleicht ein bis zwei Monate doppelte Miete, während du umziehst; bitte den Vermieter, dich früher gehen zu lassen.',
      ],
      [
        "A new deposit of up to three months' rent (cold); the old deposit comes back after the handover, in a few months.",
        'Eine neue Kaution von bis zu drei Monatskaltmieten; die alte kommt nach der Übergabe nach einigen Monaten zurück.',
        [MIETERBUND],
      ],
    ],
    links: [MIETERBUND, VZ],
    actions: [
      [
        "Check with a tenants' association whether the notice is valid",
        'Lass beim Mieterverein prüfen, ob die Kündigung wirksam ist',
        'high',
      ],
      [
        'Start the flat search at once and tell your employer if you move far',
        'Starte sofort die Wohnungssuche und sag es dem Arbeitgeber, wenn du weit wegziehst',
        'high',
      ],
      [
        'Check whether a hardship objection is possible, for age, illness or children',
        'Prüf, ob ein Härtefallwiderspruch möglich ist, wegen Alter, Krankheit oder Kindern',
      ],
    ],
    tip: [
      'tip',
      'The notice period grows with the years in the flat: three months, six after five years and nine after eight years of tenancy. And a landlord who bought the flat must wait a blocking period before a notice for own use.',
      'Die Kündigungsfrist wächst mit den Jahren in der Wohnung: drei Monate, sechs nach fünf und neun nach acht Jahren Mietzeit. Und ein Vermieter, der die Wohnung gekauft hat, muss eine Sperrfrist abwarten, bevor er wegen Eigenbedarfs kündigt.',
    ],
  }),
  E30: emergencyDetail({
    description: [
      'A fire in a flat below: everyone is safe, but a home and almost everything in it are gone. This is the case for which household insurance exists. It pays the replacement, the hotel for a time and the move; the sum insured and the hotel limit decide how much.',
      'Ein Feuer in der Wohnung darunter: alle sind sicher, aber ein Zuhause und fast alles darin sind weg. Dafür gibt es die Hausratversicherung. Sie zahlt den Ersatz, das Hotel für eine Zeit und den Umzug; Versicherungssumme und Hotelgrenze entscheiden, wie viel.',
    ],
    buckets: [
      [
        'The first things you need at once: clothes, toiletries, a charger. The household insurance often pays an advance; keep every receipt.',
        'Die ersten Dinge, die du sofort brauchst: Kleidung, Hygieneartikel, ein Ladegerät. Die Hausrat zahlt oft einen Vorschuss; bewahre jeden Beleg auf.',
      ],
      [
        'A hotel or a short-term flat for three months costs about 3,000-6,000; most policies cover the hotel only for a limited time (often 60-100 days).',
        'Ein Hotel oder eine möblierte Wohnung für drei Monate kostet etwa 3.000-6.000; die meisten Policen decken das Hotel nur zeitlich begrenzt (oft 60-100 Tage).',
        [
          elink(
            'Verivox – hotel costs of household insurance',
            'Verivox – Hotelkosten in der Hausratversicherung',
            'https://www.verivox.de/hausratversicherung/themen/hotelkosten/',
          ),
        ],
      ],
      [
        'New furniture and household items for a whole flat: about 10,000-20,000; the insurance pays the new price up to the sum insured.',
        'Neue Möbel und Haushaltsgegenstände für eine ganze Wohnung: etwa 10.000-20.000; die Versicherung zahlt den Neuwert bis zur Versicherungssumme.',
      ],
      [
        'A laptop, a phone and the documents: about 1,500-3,000; getting new papers (ID, certificates) takes weeks.',
        'Ein Laptop, ein Handy und die Dokumente: etwa 1.500-3.000; neue Papiere (Ausweis, Zeugnisse) brauchen Wochen.',
      ],
      [
        'A new deposit and the move: about 2,000-4,000.',
        'Eine neue Kaution und der Umzug: etwa 2.000-4.000.',
      ],
    ],
    links: [
      elink(
        'ADAC – household insurance after a fire',
        'ADAC – Hausratversicherung bei Brand',
        'https://www.adac.de/produkte/versicherungen/ratgeber/hausratversicherung-bei-brand/',
      ),
      GDV,
    ],
    actions: [
      [
        'Get out first and call 112, and let nobody go back in',
        'Geh zuerst raus und ruf die 112, und lass niemanden zurück hinein',
        'high',
      ],
      [
        'Report to the household insurer at once, ask about an advance and the hotel cover',
        'Melde es sofort der Hausrat, frag nach Vorschuss und Hotelkosten',
        'high',
      ],
      [
        'Make a list of what was in each room, with the help of photos from your phone or the cloud',
        'Mach eine Liste, was in jedem Raum war, mithilfe von Fotos aus Handy oder Cloud',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Check the sum insured: a common guide is 650 to 700 euros per square metre. A policy with a waiver of under-insurance pays in full; one without may pay only the share you insured.',
      'Prüf die Versicherungssumme: ein üblicher Richtwert sind 650 bis 700 Euro pro Quadratmeter. Eine Police mit Unterversicherungsverzicht zahlt voll; eine ohne zahlt vielleicht nur den Anteil, den du versichert hast.',
    ],
  }),
};
