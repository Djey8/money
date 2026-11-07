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

/** The detail of the Spark and Flame cards of the first stack (E01-E16, E32-E33, E36, E38-E39, E41-E44, E46-E50). */
export const SMALL_DETAILS: Record<string, EmergencyDetails> = {
  E01: emergencyDetail({
    description: [
      "A small damage to a friend's thing: you pay it at once and keep the friendship. Private liability insurance exists for the big damages; for a grip and a bell the usual deductible is more than the bill, so it is yours.",
      'Ein kleiner Schaden an der Sache eines Freundes: du zahlst sofort und behältst die Freundschaft. Die Privathaftpflicht ist für die großen Schäden da; bei Griff und Klingel ist die übliche Selbstbeteiligung höher als die Rechnung, also zahlst du selbst.',
    ],
    buckets: [
      [
        'A grip and a bell cost about 20-50 in a bike shop; a better set from a shop that fits the model about 50-70.',
        'Griff und Klingel kosten im Fahrradladen etwa 20-50; ein besseres Set, das zum Modell passt, etwa 50-70.',
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Say sorry first and offer to pay on the spot',
        'Entschuldige dich zuerst und biete an, sofort zu zahlen',
        'high',
      ],
      [
        'Buy the part together, or transfer the money the same day',
        'Kauft das Teil gemeinsam oder überweise das Geld noch am selben Tag',
      ],
      [
        'Check whether your liability policy has a deductible: small damages stay with you',
        'Prüfe, ob deine Haftpflicht eine Selbstbeteiligung hat: kleine Schäden bleiben bei dir',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Pay small damages yourself and do not report them: a claim can raise your premium, and it is a good habit to keep the small ones between friends.',
      'Zahl kleine Schäden selbst und melde sie nicht: ein Schaden kann die Prämie erhöhen, und die kleinen Dinge unter Freunden zu regeln ist eine gute Gewohnheit.',
    ],
  }),
  E02: emergencyDetail({
    description: [
      'A flat tyre costs little money, but it costs the morning. A new tube and a repair kit are cheap; the real price is arriving late. Riders who carry the kit and know the handgrips fix it in ten minutes.',
      'Ein Platten kostet wenig Geld, aber den Morgen. Neuer Schlauch und Reparaturset sind billig; der wahre Preis ist das Zuspätkommen. Wer das Set dabeihat und die Handgriffe kennt, braucht zehn Minuten.',
    ],
    buckets: [
      [
        'A tube costs about 5-10, a repair kit 5-8, tyre levers 4. A shop repair costs about 15-25 with the work.',
        'Ein Schlauch kostet etwa 5-10, ein Flickzeug 5-8, Reifenheber 4. Eine Reparatur im Laden kostet mit Arbeit etwa 15-25.',
      ],
    ],
    actions: [
      [
        'Learn the repair once from a video; it takes ten minutes',
        'Lerne die Reparatur einmal aus einem Video; sie dauert zehn Minuten',
        'medium',
      ],
      [
        'Carry a tube, levers and a small pump',
        'Trag einen Schlauch, Reifenheber und eine kleine Pumpe bei dir',
        'medium',
      ],
      [
        'Consider puncture-resistant tyres if you ride every day',
        'Erwäge pannensichere Reifen, wenn du jeden Tag fährst',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Run the tyres at the pressure printed on the sidewall: too soft is the most common reason for a flat.',
      'Fahr die Reifen mit dem Druck, der auf der Reifenflanke steht: zu weich ist der häufigste Grund für einen Platten.',
    ],
  }),
  E03: emergencyDetail({
    description: [
      'Riding without a valid ticket costs an increased fare of about 60 euros in most German cities, whatever the reason. A dead phone does not count as a ticket. The fare is fixed by the transport companies, so it does not grow with your income.',
      'Fahren ohne gültiges Ticket kostet in den meisten deutschen Städten ein erhöhtes Beförderungsentgelt von etwa 60 Euro, egal aus welchem Grund. Ein leeres Handy ist kein Ticket. Das Entgelt legen die Verkehrsunternehmen fest, es wächst also nicht mit deinem Einkommen.',
    ],
    buckets: [
      [
        'The increased fare is about 60; if you can show a valid season ticket afterwards, many companies reduce it to a small fee. Pay within the period to avoid more.',
        'Das erhöhte Beförderungsentgelt beträgt etwa 60; wenn du nachträglich eine gültige Zeitkarte zeigst, senken es viele Unternehmen auf eine kleine Gebühr. Zahl innerhalb der Frist, um weitere Kosten zu vermeiden.',
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Pay the fare within the deadline on the letter',
        'Zahle das Entgelt innerhalb der Frist auf dem Schreiben',
        'high',
      ],
      [
        'If you own a season ticket, show it afterwards: the fee is often reduced',
        'Wenn du eine Zeitkarte besitzt, zeig sie nachträglich: das Entgelt wird oft gesenkt',
      ],
      [
        'Keep a ticket as a screenshot or on paper in case the phone dies',
        'Halte ein Ticket als Screenshot oder auf Papier bereit, falls das Handy ausgeht',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Take a screenshot of every digital ticket when you buy it: it also works without a mobile network.',
      'Mach von jedem digitalen Ticket beim Kauf einen Screenshot: er funktioniert auch ohne Mobilfunknetz.',
    ],
  }),
  E04: emergencyDetail({
    description: [
      "A lost ID card has to be reported and replaced: the fee is set by law, and you need new biometric photos and a morning at the citizens' office. Until the new card arrives you have a temporary ID.",
      'Ein verlorener Personalausweis muss gemeldet und ersetzt werden: die Gebühr ist gesetzlich festgelegt, du brauchst neue biometrische Fotos und einen Vormittag im Bürgerbüro. Bis der neue kommt, hast du einen vorläufigen Ausweis.',
    ],
    buckets: [
      [
        'The fee for a new ID card is about 37 for people over 24 and 22.80 for younger ones, more for an urgent one. Fixed by law.',
        'Die Gebühr für einen neuen Personalausweis beträgt etwa 37 ab 24 Jahren und 22,80 für Jüngere, mehr bei einem dringenden. Gesetzlich festgelegt.',
      ],
      [
        "Biometric photos cost about 6-15 in a photo shop or at the office's machine; do not use ordinary photos.",
        'Biometrische Fotos kosten im Fotogeschäft oder am Automaten im Amt etwa 6-15; normale Fotos gelten nicht.',
      ],
    ],
    actions: [
      [
        'Block your bank cards if they were in the wallet',
        'Sperre deine Bankkarten, wenn sie in der Geldbörse waren',
        'high',
      ],
      [
        "Report the loss to the citizens' office and ask for a temporary ID",
        'Melde den Verlust im Bürgerbüro und frag nach einem vorläufigen Ausweis',
        'high',
      ],
      [
        'Book an appointment online; many offices have long waits',
        'Buch einen Termin online; viele Ämter haben lange Wartezeiten',
      ],
    ],
    tip: [
      'tip',
      'Keep a photo of both sides of your ID and your card numbers in a safe place: the replacement of everything else goes much faster.',
      'Bewahre ein Foto beider Seiten deines Ausweises und deine Kartennummern sicher auf: der Ersatz von allem anderen geht viel schneller.',
    ],
  }),
  E05: emergencyDetail({
    description: [
      '18 km/h too fast in a 30 zone is a small fine, but it is a fine for life in the record of the traffic office. The amount is set by the catalogue of fines, the same for everyone.',
      '18 km/h zu schnell in einer 30er-Zone ist ein kleines Bußgeld, aber eines, das in der Akte des Verkehrsamts bleibt. Die Höhe legt der Bußgeldkatalog fest, für alle gleich.',
    ],
    buckets: [
      [
        'In real life 16-20 km/h too fast costs about 70 in town (60 outside), without a point; the game uses a small fixed fine. Check a letter for the real amount and the deadline.',
        'Im echten Leben kosten 16-20 km/h zu viel innerorts etwa 70 (außerorts 60), ohne Punkt; das Spiel nutzt ein kleines festes Bußgeld. Prüf auf einem Schreiben den echten Betrag und die Frist.',
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Pay the fine in time; objections are rarely worth the cost',
        'Zahle das Bußgeld fristgerecht; Einsprüche lohnen selten den Aufwand',
        'high',
      ],
      [
        'Check the photo and the date for mistakes before you pay',
        'Prüfe Foto und Datum auf Fehler, bevor du zahlst',
      ],
      [
        'Use a speed warning in your navigation app',
        'Nutze eine Tempowarnung in deiner Navigations-App',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Look at the speed limit sign after every junction: in 30 zones the limit often starts quietly after a turn.',
      'Schau nach jeder Kreuzung auf das Tempolimit-Schild: in 30er-Zonen beginnt die Begrenzung oft unauffällig nach einer Abbiegung.',
    ],
  }),
  E06: emergencyDetail({
    description: [
      'A forgotten invoice becomes a reminder with a fee, and with interest if you wait. The sum is small, but it grows with every letter. Pay it at once and set up a standing order, so it does not happen again.',
      'Eine vergessene Rechnung wird zur Mahnung mit Gebühr, und mit Zinsen, wenn du wartest. Der Betrag ist klein, wächst aber mit jedem Brief. Zahl sofort und richte einen Dauerauftrag ein, damit es nicht wieder passiert.',
    ],
    buckets: [
      [
        'A reminder fee is usually 3-10; default interest runs at about 5 points above the base rate. Check that the fees are fair: an extra of 30 for a first reminder is too much.',
        'Eine Mahngebühr beträgt meist 3-10; Verzugszinsen liegen bei etwa 5 Prozentpunkten über dem Basiszins. Prüf, ob die Gebühren fair sind: 30 für die erste Mahnung sind zu viel.',
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Pay the original invoice at once, before the next reminder',
        'Zahle die ursprüngliche Rechnung sofort, vor der nächsten Mahnung',
        'high',
      ],
      [
        'Check whether the fee is allowed: only real costs may be charged',
        'Prüfe, ob die Gebühr erlaubt ist: nur echte Kosten dürfen verlangt werden',
      ],
      [
        'Set a calendar reminder or a standing order for recurring bills',
        'Setz eine Kalendererinnerung oder einen Dauerauftrag für wiederkehrende Rechnungen',
        'low',
      ],
    ],
    tip: [
      'tip',
      'An invoice you do not know is not to be paid blindly: ask for the contract. But an invoice you know and forgot is cheapest paid today.',
      'Eine Rechnung, die du nicht kennst, zahlst du nicht blind: frag nach dem Vertrag. Eine, die du kennst und vergessen hast, ist heute am günstigsten bezahlt.',
    ],
  }),
  E07: emergencyDetail({
    description: [
      'One earbud lost: replacing a single one is often possible from the maker, but it costs more than you expect. A small thing, a small sum - and a reminder to look after the things you carry every day.',
      'Ein Ohrhörer verloren: ein einzelner Ersatz ist oft beim Hersteller möglich, kostet aber mehr, als man denkt. Eine kleine Sache, eine kleine Summe - und die Erinnerung, auf die Dinge zu achten, die man täglich dabeihat.',
    ],
    buckets: [
      [
        'A single replacement earbud costs about 50-90 from the maker; a whole new pair of the same model about 130-180. Third-party buds are cheaper.',
        'Ein einzelner Ersatz-Ohrhörer kostet beim Hersteller etwa 50-90; ein ganzes neues Paar desselben Modells etwa 130-180. Fremdhersteller sind günstiger.',
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Ask the maker for a single replacement before you buy a new pair',
        'Frag den Hersteller nach einem Einzelersatz, bevor du ein neues Paar kaufst',
        'medium',
      ],
      [
        'Use the find-my feature of your phone to look for it',
        'Nutze die Suchfunktion deines Handys, um ihn zu finden',
        'low',
      ],
      [
        'Consider a cheaper pair if you lose small things often',
        'Erwäge ein günstigeres Paar, wenn du Kleinigkeiten oft verlierst',
        'low',
      ],
    ],
    tip: [
      'fact',
      'Many true wireless earbuds have a battery that lasts only about two to three years, so the whole pair is at the end of its life anyway: a cheap replacement is often the smart choice.',
      'Bei vielen Kabellos-Ohrhörern hält der Akku nur etwa zwei bis drei Jahre, das ganze Paar ist also ohnehin am Ende seines Lebens: ein günstiger Ersatz ist oft die kluge Wahl.',
    ],
  }),
  E39: emergencyDetail({
    description: [
      'After a short stay in a hospital the statutory health insurance asks for a daily co-payment, and things like the phone and the television come on top. The medical care itself is paid by the insurance; the co-payment is capped for each year.',
      'Nach einem kurzen Krankenhausaufenthalt verlangt die gesetzliche Krankenkasse eine tägliche Zuzahlung, und Dinge wie Telefon und Fernseher kommen dazu. Die Behandlung selbst zahlt die Kasse; die Zuzahlung ist pro Jahr gedeckelt.',
    ],
    buckets: [
      [
        'The co-payment is 10 a day for up to 28 days a year, so three days cost 30. Children and young people up to 18 do not pay.',
        'Die Zuzahlung beträgt 10 pro Tag für bis zu 28 Tage im Jahr, drei Tage also 30. Kinder und Jugendliche bis 18 zahlen nicht.',
        [
          elink(
            'Federal Ministry of Health – co-payments',
            'Bundesgesundheitsministerium – Zuzahlungen',
            'https://www.bundesgesundheitsministerium.de/',
          ),
        ],
      ],
      [
        'A phone and TV package costs about 3-6 a day in many hospitals. Ask whether you really need it.',
        'Ein Telefon- und Fernsehpaket kostet in vielen Kliniken etwa 3-6 am Tag. Frag, ob du es wirklich brauchst.',
      ],
    ],
    actions: [
      [
        'Keep all receipts of co-payments: the yearly cap is 2 percent of your income',
        'Bewahre alle Zuzahlungsbelege auf: die Jahresgrenze liegt bei 2 Prozent deines Einkommens',
        'high',
      ],
      [
        'Apply for the exemption once you reach the cap',
        'Beantrage die Befreiung, sobald du die Grenze erreichst',
      ],
      [
        'Ask the ward which extras are really needed',
        'Frag die Station, welche Extras wirklich nötig sind',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Collect the receipts of all co-payments in one place: once you reach 2 percent of your gross income in a year (1 percent if chronically ill), your health insurer exempts you for the rest of the year.',
      'Sammle die Belege aller Zuzahlungen an einem Ort: sobald du in einem Jahr 2 Prozent deines Bruttoeinkommens erreichst (1 Prozent bei chronischer Krankheit), befreit dich die Kasse für den Rest des Jahres.',
    ],
  }),
  E41: emergencyDetail({
    description: [
      'A free trial that renews itself into an annual plan is one of the most common small money traps. The sum is not large, but it is money for nothing - and it is often possible to get it back in the first days.',
      'Ein kostenloser Test, der sich in ein Jahresabo verlängert, ist eine der häufigsten kleinen Geldfallen. Die Summe ist nicht groß, aber Geld für nichts - und in den ersten Tagen lässt es sich oft zurückholen.',
    ],
    buckets: [
      [
        'Annual plans of apps and streaming run from about 40 to 120. Ask for a refund at once: some stores and many sellers refund the first days.',
        'Jahresabos von Apps und Streaming liegen bei etwa 40 bis 120. Frag sofort nach einer Erstattung: manche Stores und viele Anbieter erstatten die ersten Tage.',
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Cancel the plan today so it does not renew again',
        'Kündige das Abo heute, damit es sich nicht noch einmal verlängert',
        'high',
      ],
      [
        'Ask the seller or the app store for a refund',
        'Frag den Anbieter oder den App-Store nach einer Erstattung',
      ],
      [
        'Put a reminder in your calendar the day you start a free trial',
        'Setz dir am Tag des Teststarts eine Erinnerung in den Kalender',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'In Germany a button "cancel contracts here" must be offered on websites that sell contracts: use it, and keep the confirmation.',
      'In Deutschland müssen Webseiten, die Verträge verkaufen, einen Button "Verträge hier kündigen" anbieten: nutze ihn und bewahre die Bestätigung auf.',
    ],
  }),
  E42: emergencyDetail({
    description: [
      'A sprained ankle from a bad landing: two weeks with a brace, physiotherapy, and a few taxis because walking hurts. The doctor and the treatment are paid by the health insurance; the co-payments, the brace and the way home are yours.',
      'Ein verstauchter Knöchel nach einer schlechten Landung: zwei Wochen Schiene, Physiotherapie und einige Taxifahrten, weil Gehen wehtut. Arzt und Behandlung zahlt die Krankenkasse; Zuzahlungen, Schiene und der Heimweg sind deine.',
    ],
    buckets: [
      [
        'Physio is 10 percent of the cost plus 10 per prescription; six sessions come to about 25. Ask the doctor for a prescription.',
        'Physiotherapie kostet 10 Prozent der Kosten plus 10 je Verordnung; sechs Termine kommen auf etwa 25. Lass dir vom Arzt ein Rezept ausstellen.',
      ],
      [
        'Short taxi rides home and to the doctor for two weeks; a ride with a ride-hailing app is often cheaper.',
        'Kurze Taxifahrten nach Hause und zum Arzt über zwei Wochen; eine Fahrt über eine Fahrdienst-App ist oft günstiger.',
      ],
      [
        'A good ankle brace costs about 20-40 in a pharmacy; the doctor can prescribe one with a co-payment of 5-10.',
        'Eine gute Knöchelorthese kostet in der Apotheke etwa 20-40; der Arzt kann eine verordnen, mit 5-10 Zuzahlung.',
      ],
    ],
    actions: [
      [
        'Follow the PECH rule at once: pause, ice, compression, raise',
        'Befolge sofort die PECH-Regel: Pause, Eis, Kompression, Hochlagern',
        'high',
      ],
      [
        'See a doctor if you cannot put weight on the foot',
        'Geh zum Arzt, wenn du den Fuß nicht belasten kannst',
        'high',
      ],
      [
        'Ask for a prescription for physio and a brace',
        'Lass dir Physiotherapie und eine Orthese verschreiben',
      ],
    ],
    tip: [
      'tip',
      'Learn to land and to fall in climbing: a bouldering hall will teach you for free how to roll out of a fall, and it is the best injury prevention.',
      'Lerne beim Klettern das Landen und Fallen: eine Boulderhalle bringt dir kostenlos bei, wie man aus einem Sturz abrollt, und das ist die beste Verletzungsvorbeugung.',
    ],
  }),
  E08: emergencyDetail({
    description: [
      'Locked out at night: the locksmith has you in his hands, and the price depends on the choice you make in the first minute. A fair call-out is about 100 by day, 180 at night; the cases of 400 and more are rip-offs.',
      'Nachts ausgesperrt: der Schlüsseldienst hat dich in der Hand, und der Preis hängt von der Entscheidung in der ersten Minute ab. Ein fairer Einsatz kostet etwa 100 am Tag, 180 nachts; die Fälle von 400 und mehr sind Wucher.',
    ],
    buckets: [
      [
        'The die decides which locksmith you picked: 1-3 a fair price, 4-5 night or weekend, 6 a rip-off. In real life you can influence it: ask for a fixed price first.',
        'Der Würfel entscheidet, welchen Schlüsseldienst du erwischt hast: 1-3 ein fairer Preis, 4-5 Nacht oder Wochenende, 6 Wucher. Im echten Leben kannst du es beeinflussen: frag zuerst nach einem Festpreis.',
        [
          elink(
            'Consumer advice – locksmiths',
            'Verbraucherzentrale – Schlüsseldienst',
            'https://www.vzhh.de/themen/einkauf-reise-freizeit/schluesseldienst/ausgesperrt-abgezockt-vom-schluesseldienst',
          ),
        ],
      ],
    ],
    actions: [
      [
        'Ask a neighbour or the landlord: some keep a spare key',
        'Frag einen Nachbarn oder den Vermieter: manche haben einen Ersatzschlüssel',
        'medium',
      ],
      [
        'Call at least two locksmiths from your area and ask for a fixed price',
        'Ruf mindestens zwei Schlüsseldienste aus deiner Gegend an und frag nach einem Festpreis',
        'high',
      ],
      [
        'Do not pay an inflated bill in cash on the spot; transfer it and dispute it',
        'Zahl eine überhöhte Rechnung nicht bar vor Ort; überweise und widersprich',
        'high',
      ],
    ],
    tip: [
      'tip',
      'If the door is only pulled shut and not locked, the fair locksmith opens it in minutes without damage. If someone says he must drill the lock at once, call another one.',
      'Wenn die Tür nur zugezogen und nicht abgeschlossen ist, öffnet der faire Schlüsseldienst sie in Minuten ohne Schaden. Wenn jemand sagt, er müsse das Schloss sofort aufbohren, ruf einen anderen.',
    ],
  }),
  E09: emergencyDetail({
    description: [
      'A cracked screen: you can repair it at a good independent shop or at the maker. The difference is price against the original parts. If you leave it, the crack grows and the glass can cut your fingers.',
      'Ein gesprungenes Display: du kannst es in einer guten freien Werkstatt oder beim Hersteller reparieren lassen. Der Unterschied ist der Preis gegenüber den Originalteilen. Wenn du es lässt, wächst der Sprung, und das Glas kann die Finger schneiden.',
    ],
    buckets: [
      [
        'An independent shop charges about 80-180 for most phones, in an hour or two, with parts that are not always original.',
        'Eine freie Werkstatt verlangt für die meisten Handys etwa 80-180, in ein bis zwei Stunden, mit Teilen, die nicht immer original sind.',
      ],
      [
        "The maker's repair is about 200-350 with original parts and a warranty on the repair; it often takes days.",
        'Die Herstellerreparatur kostet etwa 200-350 mit Originalteilen und Garantie auf die Reparatur; sie dauert oft Tage.',
        [TEST],
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Back up your data before you hand the phone over',
        'Sichere deine Daten, bevor du das Handy abgibst',
        'high',
      ],
      [
        'Compare a quote from the maker and from an independent shop',
        'Vergleiche ein Angebot vom Hersteller und von einer freien Werkstatt',
      ],
      [
        'Check whether your household or phone policy covers it',
        'Prüfe, ob deine Hausrat- oder Handyversicherung es abdeckt',
        'low',
      ],
    ],
    tip: [
      'tip',
      'A tempered-glass screen protector costs 10 and takes the crack instead of the screen. It is the cheapest insurance a phone has.',
      'Eine Panzerglasfolie kostet 10 und nimmt den Sprung statt des Displays auf. Sie ist die günstigste Versicherung, die ein Handy hat.',
    ],
  }),
  E10: emergencyDetail({
    description: [
      'Broken glasses: the statutory health insurance pays nothing for most adults (only for a severe visual impairment), so the frame and the lenses are your own cost. A good pair costs more than a phone repair, so check your options before you buy.',
      'Eine kaputte Brille: die gesetzliche Krankenkasse zahlt für die meisten Erwachsenen nichts (nur bei starker Sehbehinderung), Fassung und Gläser sind also dein eigener Posten. Eine gute Brille kostet mehr als eine Handyreparatur, vergleich also vor dem Kauf.',
    ],
    buckets: [
      [
        'A pair with single-vision lenses costs about 150-300 at an optician, online often less. Ask for the lens quality: thin and coated lenses cost more.',
        'Eine Brille mit Einstärkengläsern kostet beim Optiker etwa 150-300, online oft weniger. Frag nach der Glasqualität: dünne und entspiegelte Gläser kosten mehr.',
        [TEST],
      ],
    ],
    actions: [
      [
        'Ask the optician whether the old lenses can be reused in a new frame',
        'Frag den Optiker, ob die alten Gläser in einer neuen Fassung weiterverwendet werden können',
        'high',
      ],
      [
        'Compare an optician and an online shop with your prescription',
        'Vergleiche einen Optiker und einen Online-Shop mit deinem Rezept',
      ],
      [
        'Keep a spare pair, or a case you really use',
        'Halte eine Ersatzbrille bereit, oder ein Etui, das du wirklich benutzt',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Many opticians repair a bent or broken frame for a small fee or for free: ask before you throw the pair away.',
      'Viele Optiker richten eine verbogene oder gebrochene Fassung gegen kleine Gebühr oder kostenlos: frag, bevor du die Brille wegwirfst.',
    ],
  }),
  E11: emergencyDetail({
    description: [
      "A drink over a friend's phone: the phone is wet and the repair costs more than a coffee. Your liability insurance pays for damage you cause to others, but many policies have a deductible and some exclude borrowed things - read the terms.",
      'Ein Getränk über das Handy eines Freundes: das Handy ist nass, und die Reparatur kostet mehr als ein Kaffee. Deine Haftpflicht zahlt Schäden, die du anderen zufügst, aber viele Policen haben eine Selbstbeteiligung und manche schließen geliehene Sachen aus - lies die Bedingungen.',
    ],
    buckets: [
      [
        'A water-damaged phone is repaired for about 100-300 if it can still be saved; if not, the friend needs a new one, at the time value, not at the new price.',
        'Ein Handy mit Wasserschaden wird für etwa 100-300 repariert, wenn es noch zu retten ist; wenn nicht, braucht der Freund ein neues, zum Zeitwert, nicht zum Neupreis.',
      ],
    ],
    links: [GDV],
    insuranceNote: [
      'Liability insurance pays the time value of the phone; a deductible of 150 or more would eat most of a small claim.',
      'Die Haftpflicht zahlt den Zeitwert des Handys; eine Selbstbeteiligung von 150 oder mehr würde einen kleinen Schaden fast ganz auffressen.',
    ],
    actions: [
      [
        'Switch the phone off at once, do not charge it, and dry it',
        'Schalte das Handy sofort aus, lade es nicht und trockne es',
        'high',
      ],
      [
        'Offer to pay the repair or the time value',
        'Biete an, die Reparatur oder den Zeitwert zu zahlen',
      ],
      [
        'Report to the liability insurer only if the damage is bigger than the deductible',
        'Melde dem Haftpflichtversicherer nur, wenn der Schaden größer ist als die Selbstbeteiligung',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Rice does not dry a phone. Switch it off, remove the case and the card, and let it stand in a dry place for at least a day, or bring it to a shop that can open it.',
      'Reis trocknet kein Handy. Schalte es aus, entferne Hülle und Karte und lass es mindestens einen Tag an einem trockenen Ort stehen, oder bring es zu einem Laden, der es öffnen kann.',
    ],
  }),
  E12: emergencyDetail({
    description: [
      'A dead starter battery is the classic cold-morning problem. Batteries last four to six years; the first frost shows which one is at the end. It is a wear part, so no insurance pays it - but a roadside service can start you.',
      'Eine leere Starterbatterie ist das klassische Problem eines kalten Morgens. Batterien halten vier bis sechs Jahre; der erste Frost zeigt, welche am Ende ist. Sie ist ein Verschleißteil, keine Versicherung zahlt sie - aber ein Pannendienst kann dich starten.',
    ],
    buckets: [
      [
        'A starter battery costs about 80-180 for most small and middle cars; fitting at a workshop adds 20-50, in many cars you can change it yourself.',
        'Eine Starterbatterie kostet für die meisten Klein- und Mittelklassewagen etwa 80-180; der Einbau in der Werkstatt kommt mit 20-50 dazu, bei vielen Autos kannst du sie selbst wechseln.',
        [ADAC],
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Call a roadside service if you are a member (ADAC): jump-starting is included',
        'Ruf den Pannendienst, wenn du Mitglied bist (ADAC): das Starthelfen ist inklusive',
        'high',
      ],
      [
        'Have the battery tested before winter, a test is often free',
        'Lass die Batterie vor dem Winter testen, ein Test ist oft kostenlos',
      ],
      [
        'Drive at least 20 minutes after the start so the battery charges again',
        'Fahr nach dem Start mindestens 20 Minuten, damit die Batterie wieder lädt',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Short trips in winter slowly drain a battery: a drive of 30 minutes every week, or a trickle charger, can add years to it.',
      'Kurze Fahrten im Winter laugen eine Batterie langsam aus: eine Fahrt von 30 Minuten pro Woche oder ein Erhaltungslader kann ihr Jahre geben.',
    ],
  }),
  E13: emergencyDetail({
    description: [
      'A crown after a toothache: the dentist offers the standard version the health insurance mostly pays for, and a better one that costs much more. A dental top-up insurance pays most of the better one; a complete bonus booklet lowers the standard share.',
      'Eine Krone nach Zahnschmerzen: der Zahnarzt bietet die Regelversorgung an, die die Kasse größtenteils zahlt, und eine bessere, die viel mehr kostet. Eine Zahnzusatzversicherung zahlt das meiste der besseren; ein lückenloses Bonusheft senkt den Anteil bei der Regelversorgung.',
    ],
    buckets: [
      [
        'The standard metal crown: your share is about 150, or 115 with a bonus booklet of five years, 95 with ten.',
        'Die Regelversorgung (Metall): dein Anteil beträgt etwa 150, mit fünf Jahren Bonusheft 115, mit zehn 95.',
        [
          elink(
            'Statutory health insurance – dental care',
            'Gesetzliche Krankenkassen – Zahnersatz',
            'https://www.gkv-spitzenverband.de/',
          ),
        ],
      ],
      [
        'A full ceramic crown costs about 500-900 in all; the insurer pays only the fixed amount of the standard one. Ask for a Heil- und Kostenplan.',
        'Eine Vollkeramikkrone kostet insgesamt etwa 500-900; die Kasse zahlt nur den Festzuschuss der Regelversorgung. Lass dir einen Heil- und Kostenplan geben.',
      ],
    ],
    links: [TEST, FINANZTIP],
    insuranceNote: [
      'A dental top-up insurance pays most of what the health insurance leaves; you pay a share. Without it, the better crown is all yours.',
      'Eine Zahnzusatzversicherung zahlt das meiste von dem, was die Kasse übrig lässt; du zahlst einen Anteil. Ohne sie zahlst du die bessere Krone ganz selbst.',
    ],
    patch: { insurance: 'dental', deductibleMinor: 15000 },
    actions: [
      [
        'Ask for a Heil- und Kostenplan before the treatment and compare',
        'Verlang vor der Behandlung einen Heil- und Kostenplan und vergleiche',
        'high',
      ],
      [
        'Keep the bonus booklet complete with a yearly check-up',
        'Halte das Bonusheft mit der jährlichen Kontrolle lückenlos',
        'medium',
      ],
      [
        'Send the plan to your top-up insurer before treatment, not after',
        'Schick den Plan vor der Behandlung an deine Zusatzversicherung, nicht danach',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A dental top-up policy usually has a waiting period and a yearly limit in the first years: take it out when your teeth are healthy, not when the pain starts.',
      'Eine Zahnzusatzversicherung hat meist eine Wartezeit und in den ersten Jahren ein Jahreslimit: schließ sie ab, solange die Zähne gesund sind, nicht wenn der Schmerz beginnt.',
    ],
  }),
  E14: emergencyDetail({
    description: [
      'A washing machine that breaks down: repair or replace? Under about ten years and with a small defect the repair is worth it; for an old machine with a big defect, a new energy-saving one pays back over the years.',
      'Eine Waschmaschine, die kaputtgeht: reparieren oder ersetzen? Unter etwa zehn Jahren und bei einem kleinen Defekt lohnt die Reparatur; bei einem alten Gerät mit großem Defekt zahlt sich ein neues, sparsames über die Jahre aus.',
    ],
    buckets: [
      [
        'A repair costs about 120-300 with the call-out; a pump or a bearing can be dearer. Ask for the quote in writing before the work.',
        'Eine Reparatur kostet mit Anfahrt etwa 120-300; eine Pumpe oder ein Lager kann teurer sein. Lass dir den Kostenvoranschlag schriftlich geben, bevor gearbeitet wird.',
      ],
      [
        'A new washing machine costs about 400-700 for a good one of class A or B; compare the yearly consumption in the Stiftung Warentest tests.',
        'Eine neue Waschmaschine kostet für eine gute der Klasse A oder B etwa 400-700; vergleiche den Jahresverbrauch in den Tests der Stiftung Warentest.',
        [TEST],
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Check whether the machine is still under warranty (two years, sometimes more)',
        'Prüf, ob das Gerät noch Garantie hat (zwei Jahre, manchmal mehr)',
        'high',
      ],
      [
        'Ask a landlord whether the machine belongs to the flat: then it is his',
        'Frag den Vermieter, ob die Maschine zur Wohnung gehört: dann ist sie seine',
        'high',
      ],
      [
        'Compare repair and replacement by the age and the defect',
        'Vergleiche Reparatur und Ersatz nach Alter und Defekt',
      ],
    ],
    tip: [
      'tip',
      'For the first twelve months of a new appliance in Germany, the seller has to prove that a defect was not there from the start: ask the shop before you pay a repairman.',
      'In den ersten zwölf Monaten eines neuen Geräts muss in Deutschland der Verkäufer beweisen, dass ein Mangel nicht von Anfang an da war: frag im Laden nach, bevor du einen Handwerker bezahlst.',
    ],
  }),
  E15: emergencyDetail({
    description: [
      "A knocked-off car mirror is a classic liability damage: you caused it, so you pay - but your liability insurance covers damage you cause to others' cars. The deductible decides whether the claim is worth it.",
      'Ein abgefahrener Autospiegel ist ein klassischer Haftpflichtschaden: du hast ihn verursacht, also zahlst du - aber deine Haftpflicht deckt Schäden an fremden Autos. Die Selbstbeteiligung entscheidet, ob sich die Meldung lohnt.',
    ],
    buckets: [
      [
        'A modern car mirror with a heater, sensor and indicator costs about 250-500 to replace; the work adds 50-100.',
        'Ein moderner Autospiegel mit Heizung, Sensor und Blinker kostet im Ersatz etwa 250-500; die Arbeit kommt mit 50-100 dazu.',
        [ADAC],
      ],
    ],
    links: [ADAC, GDV],
    actions: [
      [
        'Leave a note with your name and number if the owner is not there',
        'Hinterlass einen Zettel mit Namen und Nummer, wenn der Besitzer nicht da ist',
        'high',
      ],
      [
        'Do not leave: that is a hit-and-run, even for a mirror',
        'Fahr nicht weg: das ist Unfallflucht, auch bei einem Spiegel',
        'high',
      ],
      [
        'Report to your liability insurer if the damage exceeds the deductible',
        'Melde es deinem Haftpflichtversicherer, wenn der Schaden die Selbstbeteiligung übersteigt',
      ],
    ],
    tip: [
      'tip',
      'Never drive off after hitting a parked car, even for a small scratch: leaving the scene is a crime in Germany and costs points and your insurance cover.',
      'Fahr nach dem Anstoß eines geparkten Autos nie weg, auch nicht bei einem kleinen Kratzer: Unfallflucht ist in Deutschland eine Straftat und kostet Punkte und den Versicherungsschutz.',
    ],
  }),
  E16: emergencyDetail({
    description: [
      'Side income is taxable, and many people notice only at the tax return. The back payment depends on your tax rate and the year. If you have a side gig, setting money aside from every payment avoids the shock.',
      'Nebeneinkünfte sind steuerpflichtig, und viele merken es erst bei der Steuererklärung. Die Nachzahlung hängt von deinem Steuersatz und dem Jahr ab. Wer einen Nebenjob hat, vermeidet den Schreck, indem er von jeder Zahlung etwas zurücklegt.',
    ],
    buckets: [
      [
        'The back payment is rolled: it depends on how much the side gig brought and your tax rate. A tax advisor or a tax programme tells you the real figure.',
        'Die Nachzahlung wird gewürfelt: sie hängt davon ab, wie viel der Nebenjob brachte und von deinem Steuersatz. Ein Steuerberater oder ein Steuerprogramm nennt dir die echte Zahl.',
        [
          elink(
            'Federal Ministry of Finance – taxes',
            'Bundesfinanzministerium – Steuern',
            'https://www.bundesfinanzministerium.de/',
          ),
        ],
      ],
    ],
    links: [FINANZTIP],
    actions: [
      [
        'Check the notice for mistakes and ask for a payment plan at the tax office',
        'Prüfe den Bescheid auf Fehler und frag das Finanzamt nach Ratenzahlung',
        'high',
      ],
      [
        'Set aside 20-30 percent of every side income in a separate account',
        'Leg 20-30 Prozent jeder Nebeneinnahme auf ein separates Konto',
        'high',
      ],
      [
        'Register the side business and keep your receipts',
        'Melde das Nebengewerbe an und bewahre deine Belege auf',
      ],
    ],
    tip: [
      'tip',
      'The tax office accepts a payment plan and reduces the interest if you ask early. Never ignore the letter: the late fees grow every month.',
      'Das Finanzamt akzeptiert eine Ratenzahlung und senkt Zinsen, wenn du früh fragst. Ignoriere den Brief nie: die Säumniszuschläge wachsen jeden Monat.',
    ],
  }),
  E32: emergencyDetail({
    description: [
      'A cancelled flight at midnight: the airline has to look after you and, in many cases, pay a compensation. In the first hours you pay the hotel and the food yourself and claim it back - so keep all the receipts.',
      'Ein gestrichener Flug um Mitternacht: die Fluggesellschaft muss dich betreuen und in vielen Fällen eine Entschädigung zahlen. In den ersten Stunden zahlst du Hotel und Essen selbst und forderst sie zurück - bewahre also alle Belege auf.',
    ],
    buckets: [
      [
        'A hotel for one night costs about 80-150; the airline has to pay a reasonable one. Ask at the counter for a voucher before you book your own.',
        'Ein Hotel für eine Nacht kostet etwa 80-150; die Fluggesellschaft muss ein angemessenes zahlen. Frag am Schalter nach einem Gutschein, bevor du selbst buchst.',
        [
          elink(
            'Your Europe – air passenger rights',
            'Your Europe – Fluggastrechte',
            'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm',
          ),
        ],
      ],
      [
        'Food and transport for the night, about 40-70; keep every receipt. The airline owes meals in proportion to the wait.',
        'Essen und Transport für die Nacht, etwa 40-70; bewahre jeden Beleg auf. Die Fluggesellschaft schuldet Mahlzeiten im Verhältnis zur Wartezeit.',
      ],
      [
        'The difference for a new ticket if you buy a replacement yourself: only reasonable costs are refunded. Ask the airline to rebook you first.',
        'Der Unterschied für ein neues Ticket, wenn du selbst Ersatz kaufst: nur angemessene Kosten werden erstattet. Bitte die Fluggesellschaft zuerst, dich umzubuchen.',
      ],
    ],
    links: [
      elink(
        'Your Europe – air passenger rights',
        'Your Europe – Fluggastrechte',
        'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm',
      ),
      VZ,
    ],
    actions: [
      [
        'Ask the airline for care and rebooking at the counter before you pay anything',
        'Frag die Fluggesellschaft am Schalter nach Betreuung und Umbuchung, bevor du etwas zahlst',
        'high',
      ],
      [
        'Keep all receipts and the boarding pass; claim the costs back in writing',
        'Bewahre alle Belege und die Bordkarte auf; fordere die Kosten schriftlich zurück',
        'high',
      ],
      [
        'Check your claim for compensation of 250-600 for flights within the EU',
        'Prüfe deinen Anspruch auf eine Entschädigung von 250-600 bei Flügen in der EU',
      ],
    ],
    insuranceNote: [
      'Travel insurance pays hotel, meals and a new ticket after a cancelled or delayed trip, up to its limit; you pay about 50.',
      'Die Reiseversicherung zahlt Hotel, Essen und ein neues Ticket nach einer ausgefallenen oder verspäteten Reise, bis zu ihrem Limit; du zahlst etwa 50.',
    ],
    patch: { insurance: 'travel', deductibleMinor: 5000 },
    tip: [
      'tip',
      'For a cancelled flight in the EU you can claim between 250 and 600 euros on top of the care, unless the airline told you at least two weeks ahead or there were extraordinary causes.',
      'Bei einem gestrichenen Flug in der EU kannst du zusätzlich zur Betreuung zwischen 250 und 600 Euro verlangen, außer die Fluggesellschaft hat dich mindestens zwei Wochen vorher informiert oder es gab außergewöhnliche Umstände.',
    ],
  }),
  E33: emergencyDetail({
    description: [
      'A heating that fails in winter is a defect for the landlord to repair. In the meantime you may have extra costs, and you may reduce the rent for the time without heating. Document the temperatures and report in writing.',
      'Eine Heizung, die im Winter ausfällt, ist ein Mangel, den der Vermieter beheben muss. Inzwischen entstehen dir vielleicht Mehrkosten, und du darfst die Miete für die Zeit ohne Heizung mindern. Dokumentiere die Temperaturen und melde schriftlich.',
    ],
    buckets: [
      [
        'A fan heater costs 30-50 and keeps one room bearable. Check the label: a heater of 2000 watts needs a socket of its own.',
        'Ein Heizlüfter kostet 30-50 und hält einen Raum erträglich. Prüf das Etikett: ein Gerät mit 2000 Watt braucht eine eigene Steckdose.',
      ],
      [
        'The extra electricity of a heater: about 3-4 a day when it runs ten hours. Keep the bill; you may ask the landlord to pay it.',
        'Der Mehrstrom eines Heizlüfters: etwa 3-4 am Tag bei zehn Stunden Betrieb. Bewahre die Rechnung auf; du kannst den Vermieter bitten, sie zu zahlen.',
      ],
    ],
    links: [MIETERBUND],
    actions: [
      [
        'Report the defect in writing and set a short deadline',
        'Melde den Mangel schriftlich und setz eine kurze Frist',
        'high',
      ],
      [
        'Write down the room temperatures every day and take photos',
        'Schreib jeden Tag die Raumtemperaturen auf und mach Fotos',
        'high',
      ],
      [
        "Ask your tenants' association how much rent you may reduce",
        'Frag deinen Mieterverein, wie viel Miete du mindern darfst',
      ],
    ],
    tip: [
      'tip',
      "Cut the rent only after you wrote to the landlord and set a deadline; and cut by the part the court allows for such cases, not by a figure you guess. Ask the tenants' association first.",
      'Mindere die Miete erst, nachdem du dem Vermieter geschrieben und eine Frist gesetzt hast; und um den Teil, den Gerichte in solchen Fällen zulassen, nicht um eine geschätzte Zahl. Frag zuerst den Mieterverein.',
    ],
  }),
  E36: emergencyDetail({
    description: [
      "You broke a colleague's glasses with your bag: a clear case for the liability insurance, but not worth a claim if the deductible is high. Offer to pay the time value at once and clear it in the open.",
      'Du hast mit deiner Tasche die Brille einer Kollegin kaputt gemacht: ein klarer Fall für die Haftpflicht, aber keine Meldung wert, wenn die Selbstbeteiligung hoch ist. Biete an, den Zeitwert sofort zu zahlen, und kläre es offen.',
    ],
    buckets: [
      [
        'Glasses are replaced at the time value: for a pair of two years about 60-80 percent of the new price, so 150-300. Ask for the receipt.',
        'Brillen werden zum Zeitwert ersetzt: bei einem Paar von zwei Jahren etwa 60-80 Prozent des Neupreises, also 150-300. Lass dir den Beleg zeigen.',
      ],
    ],
    links: [GDV],
    actions: [
      [
        'Say sorry and offer to pay the repair or the time value',
        'Entschuldige dich und biete an, die Reparatur oder den Zeitwert zu zahlen',
        'high',
      ],
      [
        'Ask for the receipt and the lens prescription',
        'Lass dir den Beleg und das Brillenrezept zeigen',
      ],
      [
        'Report to the liability insurance only if the sum is above your deductible',
        'Melde der Haftpflicht nur, wenn die Summe über deiner Selbstbeteiligung liegt',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Liability insurance pays the time value, not the new price: a pair of glasses of two years is not worth the full new one.',
      'Die Haftpflicht zahlt den Zeitwert, nicht den Neupreis: eine zwei Jahre alte Brille ist nicht den vollen Neupreis wert.',
    ],
  }),
  E38: emergencyDetail({
    description: [
      'A scrape at a pillar: pay it yourself or report it to the full cover. Reporting costs a deductible and may raise your premium for years; paying yourself often costs less if the damage is small. Get a quote first, then decide.',
      'Ein Kratzer an einer Säule: selbst zahlen oder der Vollkasko melden. Die Meldung kostet eine Selbstbeteiligung und kann die Prämie über Jahre erhöhen; selbst zu zahlen kostet bei kleinem Schaden oft weniger. Hol zuerst einen Kostenvoranschlag ein, dann entscheide.',
    ],
    buckets: [
      [
        'Paying yourself: a bumper repair with paint costs about 300-700. Ask a workshop for a quote and a second one from a paint specialist.',
        'Selbst zahlen: eine Stoßfängerreparatur mit Lack kostet etwa 300-700. Frag eine Werkstatt nach einem Angebot und eine Lackiererei nach einem zweiten.',
      ],
      [
        'Claiming the full cover: you pay a deductible (300-500) and the premium rises by a class, in the game by 15 a month for a year.',
        'Die Vollkasko melden: du zahlst eine Selbstbeteiligung (300-500), und die Prämie steigt um eine Klasse, im Spiel um 15 im Monat für ein Jahr.',
        [
          elink(
            'Allianz – deductible in car insurance',
            'Allianz – Selbstbeteiligung in der Kfz-Versicherung',
            'https://www.allianz.de/auto/kfz-versicherung/selbstbeteiligung/',
          ),
        ],
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Take photos of the damage and the place before you drive',
        'Mach Fotos vom Schaden und vom Ort, bevor du wegfährst',
        'high',
      ],
      [
        'Get a quote and compare it with the deductible plus the higher premium',
        'Hol ein Angebot ein und vergleiche es mit Selbstbeteiligung plus höherer Prämie',
        'high',
      ],
      [
        'If another car was hit, leave a note: leaving the scene is a crime',
        'Wenn ein anderes Auto getroffen wurde, hinterlass einen Zettel: Unfallflucht ist eine Straftat',
      ],
    ],
    tip: [
      'tip',
      'Ask your insurer what the claim does to your no-claims class before you report: for small damages, paying yourself is often cheaper in the long run.',
      'Frag deinen Versicherer, was die Meldung mit deiner Schadenfreiheitsklasse macht, bevor du meldest: bei kleinen Schäden ist Selbstzahlen auf Dauer oft günstiger.',
    ],
  }),
  E43: emergencyDetail({
    description: [
      'A door slammed by the wind breaks the glass insert of a rental flat. Damage to a rented flat is covered by your liability insurance if the policy includes rental damage; check the terms, not every policy does.',
      'Eine vom Wind zugeschlagene Tür zerstört den Glaseinsatz einer Mietwohnung. Schäden an einer gemieteten Wohnung deckt deine Haftpflicht, wenn die Police Mietsachschäden einschließt; prüf die Bedingungen, nicht jede tut es.',
    ],
    buckets: [
      [
        'A glazier replaces a door glass for about 200-500 depending on the size and the type of glass; safety glass costs more.',
        'Ein Glaser ersetzt ein Türglas für etwa 200-500 je nach Größe und Glasart; Sicherheitsglas kostet mehr.',
      ],
    ],
    links: [GDV, MIETERBUND],
    insuranceNote: [
      'Rental damage is only covered if your liability policy includes it; many do, with a deductible.',
      'Mietsachschäden sind nur gedeckt, wenn deine Haftpflicht sie einschließt; viele tun es, mit einer Selbstbeteiligung.',
    ],
    actions: [
      [
        'Tell the landlord at once and take photos',
        'Sag es dem Vermieter sofort und mach Fotos',
        'high',
      ],
      [
        'Check whether your liability policy covers rental damage',
        'Prüf, ob deine Haftpflicht Mietsachschäden deckt',
        'high',
      ],
      ['Get a quote from a local glazier', 'Hol ein Angebot bei einem Glaser vor Ort ein'],
    ],
    tip: [
      'tip',
      'A door stopper costs two euros and a draught from an open window is the usual cause: the cheapest repair is a rubber wedge.',
      'Ein Türstopper kostet zwei Euro, und der Durchzug eines offenen Fensters ist die übliche Ursache: die günstigste Reparatur ist ein Gummikeil.',
    ],
  }),
  E44: emergencyDetail({
    description: [
      'A storm took the balcony furniture and the plants. Things on a balcony are often covered by the household insurance only with an extra clause, and only for a storm of a certain strength (wind force 8). Often it is simply your loss.',
      'Ein Sturm hat die Balkonmöbel und die Pflanzen mitgenommen. Sachen auf dem Balkon sind in der Hausrat oft nur mit einer Zusatzklausel gedeckt, und nur bei einem Sturm von bestimmter Stärke (Windstärke 8). Oft ist es einfach dein Verlust.',
    ],
    buckets: [
      [
        'A set of chairs and a table costs about 100-250, a parasol 40-90, plants and pots 50-100. Second-hand shops sell balcony sets for half.',
        'Ein Set aus Stühlen und Tisch kostet etwa 100-250, ein Sonnenschirm 40-90, Pflanzen und Töpfe 50-100. Gebrauchtmärkte verkaufen Balkonsets zum halben Preis.',
      ],
    ],
    links: [GDV],
    actions: [
      [
        'Check your household policy for storm damage on the balcony',
        'Prüfe deine Hausrat auf Sturmschäden auf dem Balkon',
        'medium',
      ],
      [
        'Buy second-hand and fix things down in the wind',
        'Kauf gebraucht und sichere die Dinge gegen Wind',
        'low',
      ],
      [
        'Bring light things inside before a storm warning',
        'Bring leichte Dinge vor einer Sturmwarnung herein',
        'low',
      ],
    ],
    insuranceNote: [
      'Household insurance pays storm damage to the things on your balcony from wind force 8; you pay about 100.',
      'Die Hausrat zahlt Sturmschäden an den Sachen auf deinem Balkon ab Windstärke 8; du zahlst etwa 100.',
    ],
    patch: { insurance: 'household', deductibleMinor: 10000 },
    tip: [
      'tip',
      'The German weather service issues warnings by region and by level: set up the app and bring the parasol in when it shows orange.',
      'Der Deutsche Wetterdienst gibt Warnungen nach Region und Stufe aus: richte die App ein und hol den Sonnenschirm herein, wenn sie orange zeigt.',
    ],
  }),
  E46: emergencyDetail({
    description: [
      'The class trip, a new backpack and a list of school supplies arrive in one letter. School costs are small each, but they come in bunches, and families with a tight budget often feel them. Ask the school about grants.',
      'Klassenfahrt, ein neuer Rucksack und eine Liste mit Schulmaterial kommen in einem Brief. Schulkosten sind einzeln klein, kommen aber gebündelt, und Familien mit knappem Budget spüren sie oft. Frag die Schule nach Zuschüssen.',
    ],
    buckets: [
      [
        'A class trip costs about 80-300 depending on the days and the place; a backpack 40-100; supplies about 30-60 a year.',
        'Eine Klassenfahrt kostet je nach Dauer und Ort etwa 80-300; ein Rucksack 40-100; Material etwa 30-60 im Jahr.',
        [
          elink(
            'Education and participation package',
            'Bildungs- und Teilhabepaket',
            'https://www.bmas.de/',
          ),
        ],
      ],
    ],
    actions: [
      [
        'Ask the school about a payment in parts or a grant',
        'Frag die Schule nach Ratenzahlung oder einem Zuschuss',
        'high',
      ],
      [
        'Check whether you qualify for the education and participation package',
        'Prüf, ob du Anspruch auf das Bildungs- und Teilhabepaket hast',
      ],
      [
        'Buy supplies in bulk or second-hand and reuse the backpack',
        'Kauf Material im Großpack oder gebraucht und nutz den Rucksack weiter',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Families with low income can get school trips and supplies paid through the education and participation package: ask the school office for the form.',
      'Familien mit geringem Einkommen können Klassenfahrten und Schulbedarf über das Bildungs- und Teilhabepaket bezahlt bekommen: frag im Schulbüro nach dem Antrag.',
    ],
  }),
  E47: emergencyDetail({
    description: [
      'A sick child cannot go to daycare, and someone has to stay home. Parents with statutory insurance can get child sick days, paid by the health insurer for part of the pay. For the rest there are the pharmacy and the doctor.',
      'Ein krankes Kind darf nicht in die Kita, und jemand muss zu Hause bleiben. Eltern mit gesetzlicher Versicherung können Kinderkrankentage nehmen, die die Kasse zum Teil bezahlt. Dazu kommen Apotheke und Arzt.',
    ],
    buckets: [
      [
        'Medicine and the co-payment cost about 10-25; a child up to 12 gets child sick days: the insurer pays 90 percent of the net pay.',
        'Medizin und Zuzahlung kosten etwa 10-25; ein Kind bis 12 bekommt Kinderkrankentage: die Kasse zahlt 90 Prozent des Nettoentgelts.',
        [
          elink(
            'Federal Ministry of Health – child sick days',
            'Bundesgesundheitsministerium – Kinderkrankentage',
            'https://www.bundesgesundheitsministerium.de/',
          ),
        ],
      ],
    ],
    actions: [
      [
        'Ask the doctor for the certificate for child sick days',
        'Lass dir vom Arzt die Bescheinigung für Kinderkrankentage ausstellen',
        'high',
      ],
      [
        'Tell your employer at once and agree who stays home',
        'Sag es dem Arbeitgeber sofort und klärt, wer zu Hause bleibt',
        'high',
      ],
      [
        'Keep a small stock of fever medicine for children at home',
        'Halte eine kleine Menge Fiebermittel für Kinder zu Hause',
        'low',
      ],
    ],
    tip: [
      'fact',
      'In Germany each parent can take 15 child sick days per child and year (single parents 30), paid by the health insurance at 90 percent of the net pay, for a child up to 12 years.',
      'In Deutschland kann jeder Elternteil 15 Kinderkrankentage pro Kind und Jahr nehmen (Alleinerziehende 30), von der Kasse mit 90 Prozent des Nettoentgelts bezahlt, für ein Kind bis 12 Jahre.',
    ],
  }),
  E48: emergencyDetail({
    description: [
      'Braces for a child cost much, and the health insurer pays most only for the basic treatment in a clear medical case. The part that is left is yours, and it comes over three years. Ask for a treatment plan and compare the offers.',
      'Eine Zahnspange kostet viel, und die Kasse zahlt das Meiste nur für die Grundbehandlung in einem klaren medizinischen Fall. Der Rest ist deiner und kommt über drei Jahre. Lass dir einen Behandlungsplan geben und vergleiche die Angebote.',
    ],
    buckets: [
      [
        'The own share for extras (better brackets, a retainer, cleaning) is about 800-2,000 over the treatment. The basic treatment is paid by the insurer, and 20 percent first, refunded after success.',
        'Der Eigenanteil für Zusatzleistungen (bessere Brackets, Retainer, Reinigung) liegt bei etwa 800-2.000 über die Behandlung. Die Grundbehandlung zahlt die Kasse, 20 Prozent zunächst, nach Erfolg erstattet.',
        [
          elink(
            'Statutory health insurance – braces',
            'Gesetzliche Krankenkassen – Kieferorthopädie',
            'https://www.gkv-spitzenverband.de/',
          ),
        ],
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Ask for a treatment and cost plan in writing before you start',
        'Lass dir vor dem Start einen Behandlungs- und Kostenplan schriftlich geben',
        'high',
      ],
      [
        'Ask which extras are really needed and which are a choice',
        'Frag, welche Zusatzleistungen wirklich nötig sind und welche eine Wahl',
        'high',
      ],
      [
        'Check a second opinion from another orthodontist',
        'Hol eine zweite Meinung bei einem anderen Kieferorthopäden ein',
      ],
    ],
    patch: { tier: 'blaze', insurance: 'dental', deductibleMinor: 30000 },
    insuranceNote: [
      'A dental top-up with an orthodontic cover pays much of the braces of a child; you pay about 300.',
      'Eine Zahnzusatzversicherung mit Kieferorthopädie-Baustein zahlt viel der Zahnspange eines Kindes; du zahlst etwa 300.',
    ],
    tip: [
      'tip',
      'Take out a dental top-up policy for children early: for braces most policies need to be in place before the treatment is planned, and the waiting time is a year.',
      'Schließ eine Zahnzusatzversicherung für Kinder früh ab: für Zahnspangen muss sie bei den meisten Policen vor der Planung der Behandlung bestehen, und die Wartezeit beträgt ein Jahr.',
    ],
  }),
  E49: emergencyDetail({
    description: [
      'A new semester brings the fee for the student services, the transport pass and some books. The sums are small, but they come all at once; a student who plans them like a rent has no surprise.',
      'Ein neues Semester bringt den Beitrag für das Studierendenwerk, das Nahverkehrsticket und einige Bücher. Die Summen sind klein, kommen aber auf einmal; wer sie wie eine Miete einplant, erlebt keine Überraschung.',
    ],
    buckets: [
      [
        'The semester fee is about 150-350 and often includes the transport pass; textbooks cost 30-80 each, the library lends many for free.',
        'Der Semesterbeitrag beträgt etwa 150-350 und enthält oft das Nahverkehrsticket; Fachbücher kosten 30-80 je, die Bibliothek verleiht viele kostenlos.',
      ],
    ],
    links: [
      elink(
        'Studierendenwerke – student services',
        'Deutsches Studierendenwerk',
        'https://www.studierendenwerke.de/',
      ),
    ],
    actions: [
      [
        'Check the library first before you buy a textbook',
        'Prüf zuerst die Bibliothek, bevor du ein Lehrbuch kaufst',
        'high',
      ],
      [
        'Buy used books from older students or the notice board',
        'Kauf gebrauchte Bücher bei älteren Studierenden oder am schwarzen Brett',
      ],
      [
        'Set aside a fixed part of each month for the fees of the next semester',
        'Leg jeden Monat einen festen Teil für die Beiträge des nächsten Semesters zurück',
        'low',
      ],
    ],
    patch: { tier: 'flame' },
    tip: [
      'tip',
      'Many universities have a hardship fund or an emergency loan for students: ask the student services before you take a consumer loan.',
      'Viele Hochschulen haben einen Härtefonds oder ein Notdarlehen für Studierende: frag das Studierendenwerk, bevor du einen Konsumkredit aufnimmst.',
    ],
  }),
  E50: emergencyDetail({
    description: [
      'Your partner needs a root canal and a crown and asks you to help with the part the insurance does not pay. Helping each other is a part of living together; talking about the money early keeps it from becoming a quarrel.',
      'Dein Partner braucht eine Wurzelbehandlung und eine Krone und bittet dich, bei dem Teil zu helfen, den die Kasse nicht zahlt. Sich gegenseitig zu helfen gehört zum Zusammenleben; früh über das Geld zu reden verhindert Streit.',
    ],
    buckets: [
      [
        'A root canal is mostly paid by the insurer; a crown costs the share of 150-500 depending on the choice. A part of the cost can be claimed as tax relief for extraordinary costs.',
        'Eine Wurzelbehandlung zahlt die Kasse großteils; eine Krone kostet je nach Wahl einen Anteil von 150-500. Ein Teil der Kosten lässt sich als außergewöhnliche Belastung steuerlich geltend machen.',
        [FINANZTIP],
      ],
    ],
    links: [TEST],
    actions: [
      [
        'Talk about how you share the cost before the treatment starts',
        'Sprecht vor Beginn der Behandlung darüber, wie ihr die Kosten teilt',
        'high',
      ],
      [
        'Ask for a treatment and cost plan, and compare the options',
        'Lass dir einen Behandlungs- und Kostenplan geben und vergleicht die Möglichkeiten',
      ],
      [
        'Keep the bills for the tax return',
        'Bewahrt die Rechnungen für die Steuererklärung auf',
        'low',
      ],
    ],
    insuranceNote: [
      'A dental top-up pays most of the crown and the treatment; you pay about 150.',
      'Eine Zahnzusatzversicherung zahlt das meiste der Krone und der Behandlung; du zahlst etwa 150.',
    ],
    patch: { insurance: 'dental', deductibleMinor: 15000 },
    tip: [
      'tip',
      'Pay the dentist from a shared account if you have one and agree early: couples who talk about money before it is needed argue less about it afterwards.',
      'Zahlt den Zahnarzt von einem gemeinsamen Konto, wenn ihr eines habt, und einigt euch früh: Paare, die über Geld reden, bevor es nötig ist, streiten danach weniger darüber.',
    ],
  }),
};
