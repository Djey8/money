import { elink, emergencyCard } from './cashflow-emergency-kit';

const ADAC = elink('ADAC – advice', 'ADAC – Ratgeber', 'https://www.adac.de/');
const GDV = elink(
  "GDV – insurers' association",
  'GDV – Versicherungsverband',
  'https://www.gdv.de/',
);
const VZ = elink(
  'Consumer advice centre',
  'Verbraucherzentrale',
  'https://www.verbraucherzentrale.de/',
);
const TEST = elink('Stiftung Warentest', 'Stiftung Warentest', 'https://www.test.de/');
const POLICE = elink('Police advice', 'Polizeiliche Beratung', 'https://www.polizei-beratung.de/');

/**
 * New Emergency cards around the car (JFK, 2026-11: the stack doubles, a lot of it about the car): fixed, dice, choice and several
 * costs; some fall on anybody with a car, some only on a player with the partial cover, the full cover or the legal protection. Amounts
 * are whole game money at the level of the Dual Student; the price level of the character scales them.
 */
export const MORE_CAR_CARDS = [
  emergencyCard({
    id: 'E51',
    tier: 'spark',
    category: 'fees',
    type: 'fixed',
    payment: 'pay_now',
    requires: 'car',
    fixedPrice: true,
    title: ['Parking Ticket', 'Strafzettel fürs Parken'],
    story: [
      'Five minutes over the ticket in a short-stay zone. The small paper under the wiper is already there.',
      'Fünf Minuten über der Parkzeit in einer Kurzparkzone. Der kleine Zettel unter dem Scheibenwischer klemmt schon.',
    ],
    description: [
      'A parking warning is small money for a small mistake. It is a fixed fee that does not depend on your income, and it is cheapest if paid within the deadline on the slip.',
      'Ein Verwarnungsgeld ist wenig Geld für einen kleinen Fehler. Es ist ein fester Betrag, der nicht von deinem Einkommen abhängt, und am günstigsten, wenn du innerhalb der Frist auf dem Zettel zahlst.',
    ],
    buckets: [
      [
        'Parking fee',
        'Verwarnungsgeld',
        30,
        'A short overstay costs about 10-30; parking on a pavement or in a disabled bay costs 55 and more. Pay by the deadline, or the fee grows.',
        'Kurzes Überziehen kostet etwa 10-30; Parken auf dem Gehweg oder auf einem Behindertenparkplatz kostet 55 und mehr. Zahl bis zur Frist, sonst wird es teurer.',
        [ADAC],
      ],
    ],
    links: [ADAC],
    actions: [
      ['Pay within the deadline on the slip', 'Zahle innerhalb der Frist auf dem Zettel', 'high'],
      [
        'Photograph the sign and the ticket when you park; check the slip for mistakes',
        'Fotografiere Schild und Parkschein beim Parken; prüf den Zettel auf Fehler',
        'medium',
      ],
      [
        'Set a timer on your phone when you park in a short-stay zone',
        'Stell beim Parken in der Kurzparkzone einen Timer auf dem Handy',
        'low',
      ],
    ],
    tip: [
      'tip',
      'A photo of the parking sign and your valid ticket on the dashboard is the proof that wins the objection if the slip is wrong.',
      'Ein Foto des Parkschilds und deines gültigen Tickets hinter der Scheibe ist der Beweis, der den Einspruch gewinnt, wenn der Zettel falsch ist.',
    ],
  }),
  emergencyCard({
    id: 'E58',
    tier: 'flame',
    category: 'mobility',
    type: 'choice',
    payment: 'plan_ok',
    requires: 'car',
    title: ['Tyre Blowout: Two New Tyres', 'Reifenplatzer: Zwei neue Reifen'],
    story: [
      'A pothole at 80 and a bang. The tyre is done, and the other one on the axle is just as old.',
      'Ein Schlagloch bei 80 und ein Knall. Der Reifen ist hin, und der andere auf der Achse ist genauso alt.',
    ],
    description: [
      'Tyres are changed in pairs on one axle. A cheap pair gets you home; a good pair gives shorter braking distances in the rain, which is what tyres are for. Check the age code on the tyre: after eight years a tyre is old, whatever the tread.',
      'Reifen werden achsweise paarweise gewechselt. Ein günstiges Paar bringt dich nach Hause; ein gutes Paar bremst im Regen kürzer, und dafür sind Reifen da. Prüf den Alterscode am Reifen: nach acht Jahren ist ein Reifen alt, egal wie das Profil aussieht.',
    ],
    choices: [
      {
        id: 'A',
        label: ['Two budget tyres', 'Zwei Budget-Reifen'],
        amount: 180,
        notes: [
          'A pair of budget tyres costs about 120-220 with fitting and balancing; fine for city driving.',
          'Ein Paar Budget-Reifen kostet mit Montage und Wuchten etwa 120-220; für die Stadt in Ordnung.',
        ],
        links: [TEST],
      },
      {
        id: 'B',
        label: ['Two quality tyres', 'Zwei Qualitätsreifen'],
        amount: 340,
        notes: [
          'A pair of well-tested tyres costs about 260-420 fitted; they brake clearly shorter on wet roads and last longer.',
          'Ein Paar gut getestete Reifen kostet montiert etwa 260-420; sie bremsen auf nasser Straße deutlich kürzer und halten länger.',
        ],
      },
    ],
    links: [ADAC, TEST],
    actions: [
      [
        'Put the spare wheel on and drive slowly to a tyre shop',
        'Montiere das Reserverad und fahr langsam zu einem Reifenhändler',
        'high',
      ],
      [
        'Check the DOT code: the last four digits are the week and year of making',
        'Prüf den DOT-Code: die letzten vier Ziffern sind Woche und Jahr der Herstellung',
        'medium',
      ],
      [
        'Compare the tyre tests of the season before you buy',
        'Vergleiche die Reifentests der Saison, bevor du kaufst',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Put the new tyres on the rear axle, even for a front-wheel-drive car: it keeps the car stable in a wet curve.',
      'Montiere die neuen Reifen auf die Hinterachse, auch bei Frontantrieb: das hält das Auto in einer nassen Kurve stabil.',
    ],
  }),
  emergencyCard({
    id: 'E59',
    tier: 'flame',
    category: 'mobility',
    type: 'fixed',
    payment: 'pay_now',
    requires: 'car',
    title: ['Wrong Fuel', 'Falsch getankt'],
    story: [
      'Diesel in a petrol car. You notice after three kilometres, when the engine starts to cough.',
      'Diesel im Benziner. Du merkst es nach drei Kilometern, als der Motor zu husten beginnt.',
    ],
    description: [
      'Filling the wrong fuel is one of the most common mistakes at the pump, and it is only cheap if you do not start the engine. A tow and a pump-out costs a few hundred; a damaged engine costs thousands. No insurance pays for your own mistake at the pump.',
      'Falsch tanken ist einer der häufigsten Fehler an der Zapfsäule, und es bleibt nur dann billig, wenn du den Motor nicht startest. Abschleppen und Abpumpen kosten einige Hundert; ein beschädigter Motor kostet Tausende. Keine Versicherung zahlt für deinen eigenen Fehler an der Zapfsäule.',
    ],
    buckets: [
      [
        'Towing and draining the tank',
        'Abschleppen und Tank leeren',
        350,
        'Towing, draining the tank and flushing the lines cost about 200-450 at a workshop; do not start the engine before.',
        'Abschleppen, Tank leeren und Leitungen spülen kosten in einer Werkstatt etwa 200-450; starte den Motor vorher nicht.',
        [ADAC],
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Switch the engine off at once and do not start it again',
        'Schalte den Motor sofort aus und starte ihn nicht wieder',
        'high',
      ],
      [
        'Call a roadside service or a workshop to drain the tank',
        'Ruf einen Pannendienst oder eine Werkstatt zum Leeren des Tanks',
        'high',
      ],
      [
        'Check the label on the fuel flap before you fill up',
        'Prüf die Klappe am Tankdeckel, bevor du tankst',
        'low',
      ],
    ],
    tip: [
      'tip',
      'If you notice at the pump, before you started the engine, you only need to have the tank pumped out: the cost is a fraction. Nothing is lost if the key was never turned.',
      'Wenn du es an der Zapfsäule bemerkst, bevor du den Motor gestartet hast, muss nur der Tank abgepumpt werden: die Kosten sind ein Bruchteil. Es ist nichts verloren, wenn der Schlüssel nie gedreht wurde.',
    ],
  }),
  emergencyCard({
    id: 'E61',
    tier: 'flame',
    category: 'legal',
    type: 'fixed',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'legal',
    deductible: 150,
    title: ['A Fine That Is Wrong', 'Ein Bußgeld, das nicht stimmt'],
    story: [
      'The photo shows another car. The letter says it is yours, with points. You decide to fight it, and you need a lawyer.',
      'Auf dem Foto ist ein anderes Auto. Im Brief steht, es sei deins, mit Punkten. Du willst dich wehren und brauchst einen Anwalt.',
    ],
    description: [
      'An objection to a fine with points is worth a lawyer when the evidence is weak. Legal protection insurance pays the lawyer and the court fees; without it you pay the lawyer from your own pocket, and a lawyer for a traffic case costs a few hundred.',
      'Ein Einspruch gegen ein Bußgeld mit Punkten lohnt einen Anwalt, wenn die Beweise schwach sind. Die Rechtsschutzversicherung zahlt Anwalt und Gerichtskosten; ohne sie zahlst du den Anwalt aus eigener Tasche, und ein Verkehrsanwalt kostet einige Hundert.',
    ],
    insuranceNote: [
      'Legal protection insurance pays the lawyer in a traffic case; you pay a deductible of about 150. It starts after a waiting period, so it must exist before the fine.',
      'Die Rechtsschutzversicherung zahlt den Anwalt im Verkehrsfall; du zahlst eine Selbstbeteiligung von etwa 150. Sie beginnt nach einer Wartezeit und muss daher vor dem Bußgeld bestehen.',
    ],
    buckets: [
      [
        'Lawyer and costs of the case',
        'Anwalt und Kosten des Verfahrens',
        420,
        'A traffic lawyer charges about 250-500 for an objection; if you win, the state pays your costs. Ask for the file first: many fines fail on a technical point.',
        'Ein Verkehrsanwalt verlangt für einen Einspruch etwa 250-500; wenn du gewinnst, zahlt der Staat deine Kosten. Lass dir zuerst die Akte schicken: viele Bußgelder scheitern an einem formalen Punkt.',
        [ADAC],
      ],
    ],
    links: [ADAC, VZ],
    actions: [
      [
        'Object in writing within two weeks of the notice',
        'Lege innerhalb von zwei Wochen nach dem Bescheid schriftlich Einspruch ein',
        'high',
      ],
      [
        'Ask a lawyer to see the file and the photo before you decide',
        'Lass einen Anwalt die Akte und das Foto einsehen, bevor du entscheidest',
        'high',
      ],
      [
        'Check whether your legal protection insurance covers traffic cases',
        'Prüf, ob deine Rechtsschutzversicherung Verkehrsfälle abdeckt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'The two weeks for an objection start with the delivery of the notice, not with the date on it. Do not miss the deadline: after it the fine is final.',
      'Die zwei Wochen für den Einspruch beginnen mit der Zustellung des Bescheids, nicht mit dem Datum darauf. Verpass die Frist nicht: danach ist das Bußgeld rechtskräftig.',
    ],
  }),
  emergencyCard({
    id: 'E69',
    tier: 'blaze',
    category: 'mobility',
    type: 'fixed',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_partial',
    deductible: 300,
    title: ['Hail Storm: A Dented Roof', 'Hagelschlag: Das Dach voller Dellen'],
    story: [
      'Ten minutes of hail the size of walnuts. The car stood outside. The roof, the bonnet and the boot look like a golf ball.',
      'Zehn Minuten Hagel in Walnussgröße. Das Auto stand draußen. Dach, Motorhaube und Kofferraum sehen aus wie ein Golfball.',
    ],
    description: [
      'Hail is a natural hazard that the partial cover pays: the repair of the dents, paint and parts, minus your deductible. Without it, you pay the body shop yourself. A dent repair without paint is cheaper, but only works for small dents.',
      'Hagel ist ein Elementarschaden, den die Teilkasko zahlt: die Reparatur der Dellen, Lack und Teile, abzüglich deiner Selbstbeteiligung. Ohne sie zahlst du die Karosseriewerkstatt selbst. Eine Dellenreparatur ohne Lack ist günstiger, geht aber nur bei kleinen Dellen.',
    ],
    insuranceNote: [
      'The partial cover pays hail, storm, fire and theft; the deductible is usually 150-300. The full cover pays the same, plus your own fault.',
      'Die Teilkasko zahlt Hagel, Sturm, Brand und Diebstahl; die Selbstbeteiligung liegt meist bei 150-300. Die Vollkasko zahlt dasselbe, dazu den eigenen Fehler.',
    ],
    buckets: [
      [
        'Body repair after hail',
        'Karosserie nach Hagelschaden',
        1800,
        'A hail repair without paint costs about 800-2,500 depending on the number of dents; with painting more. A total loss is possible for an older car.',
        'Eine Hagelreparatur ohne Lack kostet je nach Zahl der Dellen etwa 800-2.500; mit Lackieren mehr. Bei einem älteren Auto ist ein Totalschaden möglich.',
        [GDV],
      ],
    ],
    links: [ADAC, GDV],
    actions: [
      [
        'Photograph all the damage before you drive; call your insurer',
        'Fotografiere alle Schäden, bevor du fährst; ruf deinen Versicherer an',
        'high',
      ],
      [
        'Ask the insurer which workshops they work with, and get a quote',
        'Frag den Versicherer, mit welchen Werkstätten er arbeitet, und hol ein Angebot ein',
        'medium',
      ],
      [
        'Park in a garage or under a roof when a hail warning is out',
        'Park in einer Garage oder unter einem Dach, wenn eine Hagelwarnung gilt',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Check the weather warnings on your phone: a hail warning gives you one or two hours to move the car to a garage or an underground park.',
      'Schau auf die Wetterwarnungen im Handy: eine Hagelwarnung gibt dir ein bis zwei Stunden, das Auto in eine Garage oder ein Parkhaus zu bringen.',
    ],
  }),
  emergencyCard({
    id: 'E70',
    tier: 'blaze',
    category: 'mobility',
    type: 'choice',
    payment: 'plan_ok',
    requires: 'car',
    title: ['Brakes Worn Down', 'Bremsen runtergefahren'],
    story: [
      'A grinding sound when you brake. The workshop shows you the pads: nothing left. And the discs look like a record.',
      'Ein Schleifgeräusch beim Bremsen. Die Werkstatt zeigt dir die Beläge: nichts mehr da. Und die Scheiben sehen aus wie eine Schallplatte.',
    ],
    description: [
      'Brakes are the one repair you must not postpone. Pads wear out first, and if they are ignored the discs go too, which doubles the price. Ask what is really needed and what can wait: front pads often wear faster than the rear.',
      'Bremsen sind die eine Reparatur, die du nicht aufschieben darfst. Zuerst verschleißen die Beläge, und wenn man sie ignoriert, gehen auch die Scheiben kaputt, was den Preis verdoppelt. Frag, was wirklich nötig ist und was warten kann: die vorderen Beläge verschleißen oft schneller als die hinteren.',
    ],
    choices: [
      {
        id: 'A',
        label: ['Front pads and a check', 'Vordere Beläge und ein Check'],
        amount: 320,
        notes: [
          'Front pads fitted cost about 180-350; discs that are still above the limit can stay, a check shows it.',
          'Vordere Beläge montiert kosten etwa 180-350; Scheiben über der Verschleißgrenze können bleiben, ein Check zeigt es.',
        ],
      },
      {
        id: 'B',
        label: ['Pads and discs on all four wheels', 'Beläge und Scheiben an allen vier Rädern'],
        amount: 780,
        notes: [
          'Pads and discs on both axles cost about 600-1,100 at an independent workshop, more at a dealer.',
          'Beläge und Scheiben an beiden Achsen kosten bei einer freien Werkstatt etwa 600-1.100, beim Händler mehr.',
        ],
        links: [ADAC],
      },
    ],
    links: [ADAC],
    actions: [
      [
        'Do not drive further than needed with grinding brakes; book the repair now',
        'Fahr mit schleifenden Bremsen nicht weiter als nötig; buch die Reparatur jetzt',
        'high',
      ],
      [
        'Ask for the measured thickness of pads and discs in writing',
        'Lass dir die gemessene Dicke von Belägen und Scheiben schriftlich geben',
        'medium',
      ],
      [
        'Get a second quote if the workshop wants to change everything',
        'Hol ein zweites Angebot ein, wenn die Werkstatt alles wechseln will',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Brake fluid ages too: it should be changed every two years. Ask for it at the same visit, it costs about 60 and protects the whole system.',
      'Auch Bremsflüssigkeit altert: sie sollte alle zwei Jahre gewechselt werden. Frag beim selben Termin danach, sie kostet etwa 60 und schützt das ganze System.',
    ],
  }),
  emergencyCard({
    id: 'E71',
    tier: 'blaze',
    category: 'mobility',
    type: 'dice',
    payment: 'plan_ok',
    requires: 'car',
    estimate: true,
    title: ['The Engine Light Comes On', 'Die Motorkontrollleuchte geht an'],
    story: [
      'The orange engine symbol and a car that loses power on the hill. The workshop reads the error memory and says: it depends.',
      'Das orange Motorsymbol und ein Auto, das am Berg Leistung verliert. Die Werkstatt liest den Fehlerspeicher aus und sagt: kommt drauf an.',
    ],
    description: [
      'An engine light can mean a loose fuel cap or an expensive part like a catalytic converter or a turbo. The diagnosis costs a little; the repair is a lottery, and no insurance pays for wear. Get the error code read and a second opinion before you agree.',
      'Eine Motorleuchte kann einen lockeren Tankdeckel heißen oder ein teures Teil wie Katalysator oder Turbolader. Die Diagnose kostet wenig; die Reparatur ist eine Lotterie, und keine Versicherung zahlt Verschleiß. Lass den Fehlercode auslesen und hol eine zweite Meinung ein, bevor du zustimmst.',
    ],
    dice: [
      [1, 2, 500],
      [3, 5, 1300],
      [6, 6, 2600],
    ],
    buckets: [
      [
        'Diagnosis and repair',
        'Diagnose und Reparatur',
        500,
        'The die: 1-2 a sensor or a cable (500), 3-5 a bigger part such as an injector or a valve (1,300), 6 the catalytic converter or the turbo (2,600). The diagnosis alone costs about 30-80.',
        'Der Würfel: 1-2 ein Sensor oder ein Kabel (500), 3-5 ein größeres Teil wie eine Einspritzdüse oder ein Ventil (1.300), 6 Katalysator oder Turbolader (2.600). Die Diagnose allein kostet etwa 30-80.',
        [ADAC],
      ],
    ],
    links: [ADAC, VZ],
    actions: [
      [
        'Check the fuel cap and the oil level first, then have the error memory read',
        'Prüf zuerst Tankdeckel und Ölstand, dann lass den Fehlerspeicher auslesen',
        'high',
      ],
      [
        'Ask for a written quote and a second opinion for a repair over 500',
        'Lass dir bei einer Reparatur über 500 ein schriftliches Angebot geben und hol eine zweite Meinung ein',
        'high',
      ],
      [
        'Check whether a goodwill repair by the maker or a warranty applies',
        'Prüf, ob Kulanz des Herstellers oder eine Garantie gilt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A flashing engine light means stop soon: the engine can be damaged. A steady one means: have it checked in the next days. Do not ignore either.',
      'Eine blinkende Motorleuchte heißt: bald anhalten, der Motor kann Schaden nehmen. Eine stetige heißt: lass es in den nächsten Tagen prüfen. Ignoriere keine von beiden.',
    ],
  }),
  emergencyCard({
    id: 'E83',
    tier: 'wildfire',
    category: 'mobility',
    type: 'dice',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_partial',
    deductible: 300,
    title: ['A Deer on the Road', 'Ein Reh auf der Straße'],
    story: [
      'Dusk on a country road. A shadow jumps out, a bang, and then silence. The front of the car is a different shape.',
      'Dämmerung auf einer Landstraße. Ein Schatten springt heraus, ein Knall, dann Stille. Die Front des Autos hat eine andere Form.',
    ],
    description: [
      "A collision with game is the classic case for the partial cover: it pays the repair, minus the deductible. Without it you pay all of it yourself. The rules are the same everywhere: call the police, get the hunter's certificate for the insurer, and do not touch the animal.",
      'Ein Wildunfall ist der klassische Fall für die Teilkasko: sie zahlt die Reparatur, abzüglich der Selbstbeteiligung. Ohne sie zahlst du alles selbst. Die Regeln sind überall gleich: ruf die Polizei, hol die Wildunfallbescheinigung für den Versicherer, und fass das Tier nicht an.',
    ],
    insuranceNote: [
      'The partial cover pays collisions with hair game (deer, boar, hare); the deductible is usually 150-300. A swerve that ends in a tree is a case for the full cover only.',
      'Die Teilkasko zahlt Zusammenstöße mit Haarwild (Reh, Wildschwein, Hase); die Selbstbeteiligung liegt meist bei 150-300. Ein Ausweichmanöver, das am Baum endet, ist nur ein Fall für die Vollkasko.',
    ],
    dice: [
      [1, 3, 1500],
      [4, 5, 3200],
      [6, 6, 5800],
    ],
    buckets: [
      [
        'Repair of the car',
        'Reparatur des Autos',
        1500,
        'The die: 1-3 a bumper and a headlight (1,500), 4-5 the front with the radiator and the bonnet (3,200), 6 a total loss for an older car (5,800).',
        'Der Würfel: 1-3 Stoßfänger und Scheinwerfer (1.500), 4-5 die Front mit Kühler und Haube (3.200), 6 Totalschaden bei einem älteren Auto (5.800).',
        [ADAC],
      ],
    ],
    links: [ADAC, GDV],
    actions: [
      [
        'Switch on the hazard lights, put on a vest, set the warning triangle',
        'Schalte die Warnblinkanlage ein, zieh die Weste an und stell das Warndreieck auf',
        'high',
      ],
      [
        'Call the police (110) and ask for a game accident certificate',
        'Ruf die Polizei (110) und lass dir eine Wildunfallbescheinigung geben',
        'high',
      ],
      [
        'Photograph the damage and the place, and report to your insurer at once',
        'Fotografiere Schaden und Ort und melde es sofort deinem Versicherer',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'When an animal jumps out, brake hard and hold the wheel straight: do not swerve. A swerve into a tree or an oncoming car is far worse than the collision with the animal, and the insurance often pays less.',
      'Wenn ein Tier herausspringt, bremse hart und halte das Lenkrad gerade: weich nicht aus. Ein Ausweichen in einen Baum oder in den Gegenverkehr ist viel schlimmer als der Zusammenstoß mit dem Tier, und die Versicherung zahlt oft weniger.',
    ],
  }),
  emergencyCard({
    id: 'E84',
    tier: 'wildfire',
    category: 'mobility',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_full',
    title: ['You Rear-End a Car', 'Du fährst auf'],
    story: [
      'A look at the phone, a red light that came too fast. The bang is not loud, but the car in front of you has a very sad bumper.',
      'Ein Blick aufs Handy, eine rote Ampel, die zu schnell kam. Der Knall ist nicht laut, aber das Auto vor dir hat eine sehr traurige Stoßstange.',
    ],
    description: [
      'You caused an accident. The compulsory liability insurance of your car pays the damage of the other car and person. Your own car is repaired only by a full cover; the partial cover does not help. After a claim your premium goes up for years.',
      'Du hast einen Unfall verursacht. Die Pflichthaftpflicht deines Autos zahlt den Schaden des anderen Autos und der Person. Dein eigenes Auto repariert nur eine Vollkasko; die Teilkasko hilft nicht. Nach einem Schaden steigt deine Prämie über Jahre.',
    ],
    insuranceNote: [
      'Only the full cover pays your own car after a crash you caused; the partial cover pays nothing here. The compulsory liability pays the other side in both cases.',
      'Nur die Vollkasko zahlt dein eigenes Auto nach einem selbst verschuldeten Unfall; die Teilkasko zahlt hier nichts. Die Pflichthaftpflicht zahlt in beiden Fällen die Gegenseite.',
    ],
    buckets: [
      [
        'Repair of your own car',
        'Reparatur deines eigenen Autos',
        3400,
        'A front repair after a rear-end crash costs about 2,000-5,000. The full cover pays it minus the deductible of about 300-1,000.',
        'Eine Frontreparatur nach einem Auffahrunfall kostet etwa 2.000-5.000. Die Vollkasko zahlt sie abzüglich der Selbstbeteiligung von etwa 300-1.000.',
        [ADAC],
      ],
      [
        'Rental car for 10 days',
        'Mietwagen für 10 Tage',
        450,
        'A small rental car costs about 35-60 a day; a loss-of-use allowance is an alternative.',
        'Ein kleiner Mietwagen kostet etwa 35-60 am Tag; eine Nutzungsausfallentschädigung ist eine Alternative.',
      ],
      [
        'Assessor and costs',
        'Gutachter und Nebenkosten',
        300,
        "An assessor's report costs about 250-500 and is needed for larger damages.",
        'Ein Gutachten kostet etwa 250-500 und wird bei größeren Schäden gebraucht.',
      ],
    ],
    afterEffect: {
      monthly: 35,
      months: 36,
      line: ['Higher premium after a claim', 'Höhere Prämie nach einem Schaden'],
    },
    links: [ADAC, GDV],
    actions: [
      [
        'Secure the scene, exchange details, call the police if anyone is hurt',
        'Sichere die Unfallstelle, tausche Daten aus, ruf die Polizei, wenn jemand verletzt ist',
        'high',
      ],
      [
        'Photograph the cars and the place; fill in the accident report together',
        'Fotografiere Autos und Ort; füllt den Unfallbericht gemeinsam aus',
        'high',
      ],
      [
        'Report to your insurer within a week and ask what it does to your class',
        'Melde es deinem Versicherer binnen einer Woche und frag, was es mit deiner Klasse macht',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Keep a safe distance: the two-second rule saves more money than any insurance. And never write a statement of guilt at the scene: tell the insurer what happened.',
      'Halte Abstand: die Zwei-Sekunden-Regel spart mehr Geld als jede Versicherung. Und schreib am Unfallort nie ein Schuldanerkenntnis: erzähl dem Versicherer, was geschehen ist.',
    ],
  }),
  emergencyCard({
    id: 'E85',
    tier: 'wildfire',
    category: 'mobility',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_full',
    title: ['Hit and Run on Your Parked Car', 'Unfallflucht an deinem geparkten Auto'],
    story: [
      'You come back to your car and the whole side is scratched in. Nobody left a note. Nobody saw anything.',
      'Du kommst zu deinem Auto zurück, und die ganze Seite ist zerkratzt. Niemand hat einen Zettel hinterlassen. Niemand hat etwas gesehen.',
    ],
    description: [
      'When the other driver is not found, nobody pays - except your own full cover. The partial cover does not cover a crash by an unknown driver. Report to the police at once and ask neighbours and shops for cameras.',
      'Wenn der andere Fahrer nicht gefunden wird, zahlt niemand - außer deiner eigenen Vollkasko. Die Teilkasko deckt keinen Schaden durch einen unbekannten Fahrer. Zeig es sofort bei der Polizei an und frag Nachbarn und Läden nach Kameras.',
    ],
    insuranceNote: [
      'Only the full cover pays damage by an unknown driver, minus your deductible. The partial cover does not.',
      'Nur die Vollkasko zahlt Schäden durch einen unbekannten Fahrer, abzüglich deiner Selbstbeteiligung. Die Teilkasko nicht.',
    ],
    buckets: [
      [
        'Repair of the damage',
        'Reparatur des Schadens',
        2800,
        'A side repair with painting costs about 1,500-4,000 depending on the car; a paint specialist is often cheaper than the dealer.',
        'Eine Seitenreparatur mit Lackieren kostet je nach Auto etwa 1.500-4.000; eine Lackiererei ist oft günstiger als der Händler.',
        [ADAC],
      ],
      [
        'Rental car or taxis',
        'Mietwagen oder Taxis',
        300,
        'Three to five days without the car: a rental or a loss-of-use allowance.',
        'Drei bis fünf Tage ohne das Auto: ein Mietwagen oder eine Nutzungsausfallentschädigung.',
      ],
    ],
    links: [ADAC, POLICE],
    actions: [
      [
        'Call the police to the scene and file a report',
        'Ruf die Polizei zum Ort und erstatte Anzeige',
        'high',
      ],
      [
        'Ask people nearby and shops with cameras, leave a note on the windscreens',
        'Frag Leute in der Nähe und Läden mit Kameras, hinterlass Zettel an den Scheiben',
        'medium',
      ],
      [
        'Report to your full cover with the police report',
        'Melde es deiner Vollkasko mit der Anzeige',
        'high',
      ],
    ],
    tip: [
      'tip',
      'Leave a clear photo of the damage and of the paint marks: a repair shop often can tell from the paint transfer which colour of car did it, and the police may find the other driver.',
      'Mach klare Fotos vom Schaden und von den Lackspuren: eine Werkstatt kann oft am Lackabrieb erkennen, welche Farbe das andere Auto hatte, und die Polizei findet vielleicht den anderen Fahrer.',
    ],
  }),
  emergencyCard({
    id: 'E86',
    tier: 'wildfire',
    category: 'legal',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'legal',
    deductible: 150,
    title: ['Somebody Crashes Into You', 'Jemand fährt dir rein'],
    story: [
      'You stood at the red light. The car behind did not. The other driver says he did not hit you hard, and his insurer is slow.',
      'Du standest an der roten Ampel. Das Auto hinter dir nicht. Der andere Fahrer sagt, er habe dich nicht stark getroffen, und seine Versicherung ist langsam.',
    ],
    description: [
      'When the other driver is at fault, his liability insurance pays your damage. But you have the work and the advance: an assessor, a lawyer and a rental car. Legal protection insurance pays the lawyer, and the other insurer pays back the rest in time.',
      'Wenn der andere Fahrer schuld ist, zahlt seine Haftpflicht deinen Schaden. Du hast aber Arbeit und Vorschuss: Gutachter, Anwalt und Mietwagen. Die Rechtsschutzversicherung zahlt den Anwalt, und die gegnerische Versicherung erstattet den Rest mit der Zeit.',
    ],
    insuranceNote: [
      "Legal protection pays your lawyer; you pay a deductible of about 150. The other party's insurer later pays back the damage, but only after weeks or months.",
      'Die Rechtsschutz zahlt deinen Anwalt; du zahlst eine Selbstbeteiligung von etwa 150. Die Versicherung der Gegenseite erstattet den Schaden später, aber erst nach Wochen oder Monaten.',
    ],
    buckets: [
      [
        'Assessor',
        'Gutachter',
        600,
        "An assessor's report costs about 400-800 for a damage like this. The other insurer pays it if you are not at fault.",
        'Ein Gutachten kostet für einen solchen Schaden etwa 400-800. Die Versicherung der Gegenseite zahlt es, wenn du nicht schuld bist.',
      ],
      [
        'Lawyer',
        'Anwalt',
        900,
        'A lawyer for the claim costs about 500-1,200; legal protection insurance pays it, and the other side pays your lawyer if you win.',
        'Ein Anwalt für die Forderung kostet etwa 500-1.200; die Rechtsschutz zahlt ihn, und die Gegenseite zahlt deinen Anwalt, wenn du gewinnst.',
        [VZ],
      ],
      [
        'Rental car for three weeks',
        'Mietwagen für drei Wochen',
        650,
        'About 35-60 a day, or a loss-of-use allowance of 30-60 a day.',
        'Etwa 35-60 am Tag, oder eine Nutzungsausfallentschädigung von 30-60 am Tag.',
      ],
    ],
    refund: {
      amount: 1800,
      inMonths: 3,
      note: [
        "The other party's insurer pays these costs back if you are not at fault - after weeks or months.",
        'Die Versicherung der Gegenseite erstattet diese Kosten, wenn du nicht schuld bist - nach Wochen oder Monaten.',
      ],
    },
    links: [ADAC, VZ],
    actions: [
      [
        'Call the police and take photos; get the details and the insurer of the other driver',
        'Ruf die Polizei und mach Fotos; hol Daten und Versicherung des anderen Fahrers',
        'high',
      ],
      [
        'See a doctor even if you feel fine: a whiplash may show a day later',
        'Geh zum Arzt, auch wenn du dich gut fühlst: ein Schleudertrauma zeigt sich manchmal erst am nächsten Tag',
        'high',
      ],
      [
        'Tell your legal protection insurer and choose a lawyer for traffic law',
        'Informiere deine Rechtsschutz und wähle einen Verkehrsanwalt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      "You can choose your own assessor and lawyer when you are not at fault: the other insurer has to pay them. Do not sign the other insurer's settlement before a lawyer has seen it.",
      'Wenn du nicht schuld bist, kannst du Gutachter und Anwalt selbst wählen: die gegnerische Versicherung muss sie zahlen. Unterschreib keinen Vergleich der gegnerischen Versicherung, bevor ihn ein Anwalt gesehen hat.',
    ],
  }),
  emergencyCard({
    id: 'E92',
    tier: 'wildfire',
    category: 'travel',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    needs: { location: 'abroad_europe' },
    estimate: true,
    title: ['Car Trouble Abroad', 'Autopanne im Ausland'],
    story: [
      'A noise from the gearbox, 600 km from home, in a country where you know three words. The local workshop speaks no English.',
      'Ein Geräusch aus dem Getriebe, 600 km von zu Hause, in einem Land, in dem du drei Wörter kennst. Die Werkstatt vor Ort spricht kein Englisch.',
    ],
    description: [
      'A breakdown abroad costs the towing, the repair and the way home. A roadside cover with a protection letter often pays the towing and a part of the return; without it you pay the costs of a foreign workshop in cash. Keep the green card and the numbers of your club.',
      'Eine Panne im Ausland kostet Abschleppen, Reparatur und den Heimweg. Ein Pannendienst mit Schutzbrief zahlt oft das Abschleppen und einen Teil der Rückreise; ohne ihn bezahlst du die Kosten einer fremden Werkstatt bar. Halte die Grüne Karte und die Nummern deines Clubs bereit.',
    ],
    buckets: [
      [
        'Towing to a workshop',
        'Abschleppen in eine Werkstatt',
        600,
        'Towing abroad costs about 300-900 depending on the distance; a protection letter of a club often covers it.',
        'Abschleppen im Ausland kostet je nach Entfernung etwa 300-900; ein Schutzbrief eines Clubs deckt es oft.',
        [ADAC],
      ],
      [
        'Hotel and rental car for a week',
        'Hotel und Mietwagen für eine Woche',
        500,
        'A week in a hotel while the car is repaired, plus a rental to go on. About 400-700.',
        'Eine Woche im Hotel, während das Auto repariert wird, plus ein Mietwagen zum Weiterfahren. Etwa 400-700.',
      ],
      [
        'Repair or the trip home',
        'Reparatur oder die Rückreise',
        1800,
        'A gearbox repair abroad costs about 1,500-3,500; alternatively the car is brought home by transporter for about 1,000-2,000.',
        'Eine Getriebereparatur im Ausland kostet etwa 1.500-3.500; alternativ wird das Auto per Transporter heimgebracht für etwa 1.000-2.000.',
      ],
    ],
    links: [ADAC],
    actions: [
      [
        'Call your roadside club first: they organise towing and a rental',
        'Ruf zuerst deinen Pannenclub an: er organisiert Abschleppen und Mietwagen',
        'high',
      ],
      [
        'Get a written quote in the workshop and ask for a translation if you need it',
        'Lass dir in der Werkstatt ein schriftliches Angebot geben und frag nach einer Übersetzung, wenn du sie brauchst',
        'medium',
      ],
      [
        'Before you travel: buy a protection letter, it costs about 30-60 a year',
        'Kauf vor der Reise einen Schutzbrief, er kostet etwa 30-60 im Jahr',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A protection letter of a motoring club is the cheapest insurance for a trip abroad: it often pays towing, a hotel, a rental car and sometimes the transport of the car home.',
      'Ein Schutzbrief eines Automobilclubs ist die günstigste Versicherung für eine Auslandsreise: er zahlt oft Abschleppen, Hotel, Mietwagen und manchmal den Transport des Autos nach Hause.',
    ],
  }),
  emergencyCard({
    id: 'E94',
    tier: 'inferno',
    category: 'mobility',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_full',
    deductible: 800,
    unique: true,
    estimate: true,
    title: ['A Total Loss After a Crash', 'Totalschaden nach einem Unfall'],
    story: [
      'Wet road, a bend, and a tree. You step out unhurt. The car does not roll away again: the assessor says what is left is scrap.',
      'Nasse Straße, eine Kurve, ein Baum. Du steigst unverletzt aus. Das Auto rollt nie wieder weg: der Gutachter sagt, was übrig ist, ist Schrott.',
    ],
    description: [
      'A crash you caused with your own car is the case for the full cover: it pays the value of the car, minus your deductible. Without it you lose the car and need a new one, with nothing to pay for it. The partial cover does not help for a crash that was your fault.',
      'Ein selbst verschuldeter Unfall mit dem eigenen Auto ist der Fall für die Vollkasko: sie zahlt den Wert des Autos, abzüglich deiner Selbstbeteiligung. Ohne sie verlierst du das Auto und brauchst ein neues, ohne Geld dafür. Die Teilkasko hilft bei einem selbst verschuldeten Unfall nicht.',
    ],
    insuranceNote: [
      'Only the full cover pays a total loss after your own crash: the time value of the car minus the deductible. The partial cover pays nothing here.',
      'Nur die Vollkasko zahlt einen Totalschaden nach dem eigenen Unfall: den Zeitwert des Autos abzüglich der Selbstbeteiligung. Die Teilkasko zahlt hier nichts.',
    ],
    buckets: [
      [
        'A replacement car',
        'Ein Ersatzauto',
        11000,
        'A used car in the same class costs about 8,000-15,000. The full cover pays the time value of the old car, not the new price.',
        'Ein Gebrauchtwagen derselben Klasse kostet etwa 8.000-15.000. Die Vollkasko zahlt den Zeitwert des alten Autos, nicht den Neupreis.',
        [ADAC],
      ],
      [
        'Registration, plates, insurance start',
        'Zulassung, Kennzeichen, Versicherungsstart',
        400,
        'Registration and plates cost about 100-150; the first insurance premium and a new roadside cover add to it.',
        'Zulassung und Kennzeichen kosten etwa 100-150; die erste Versicherungsprämie und ein neuer Schutzbrief kommen dazu.',
      ],
      [
        'Taxis, rental car and towing',
        'Taxis, Mietwagen und Abschleppen',
        900,
        'Two weeks without a car and the towing of the wreck.',
        'Zwei Wochen ohne Auto und das Abschleppen des Wracks.',
      ],
    ],
    afterEffect: {
      monthly: 40,
      months: 36,
      line: ['Higher premium after a total loss', 'Höhere Prämie nach einem Totalschaden'],
    },
    links: [ADAC, GDV],
    actions: [
      [
        'Make sure everyone is safe, call 112 and the police',
        'Sorg dafür, dass alle in Sicherheit sind, ruf 112 und die Polizei',
        'high',
      ],
      [
        'Report to the full cover at once and ask for the assessor',
        'Melde es sofort der Vollkasko und frag nach dem Gutachter',
        'high',
      ],
      [
        'Ask whether the time value or the replacement value is paid, and check the offer',
        'Frag, ob der Zeitwert oder der Wiederbeschaffungswert gezahlt wird, und prüf das Angebot',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'In a total loss the insurer pays the replacement value minus the value of the wreck: do not accept the first offer. A second assessment by an independent expert can add hundreds.',
      'Bei einem Totalschaden zahlt der Versicherer den Wiederbeschaffungswert abzüglich des Restwerts: nimm das erste Angebot nicht an. Ein zweites Gutachten eines unabhängigen Sachverständigen kann Hunderte mehr bringen.',
    ],
  }),
  emergencyCard({
    id: 'E95',
    tier: 'inferno',
    category: 'mobility',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'car',
    insurance: 'car_partial',
    deductible: 300,
    unique: true,
    estimate: true,
    title: ['A Tree Falls on Your Car', 'Ein Baum fällt auf dein Auto'],
    story: [
      'The night storm took an old tree. In the morning your car is under it, and the roof is where the seats should be.',
      'Der nächtliche Sturm hat einen alten Baum mitgenommen. Am Morgen liegt dein Auto darunter, und das Dach ist dort, wo die Sitze sein sollten.',
    ],
    description: [
      'A tree that falls in a storm of wind force 8 or more is a natural hazard: the partial cover pays the loss, minus the deductible. Here a partial cover is enough, in contrast to a crash you cause. Without it you lose the car.',
      'Ein Baum, der bei einem Sturm ab Windstärke 8 fällt, ist ein Elementarschaden: die Teilkasko zahlt den Schaden, abzüglich der Selbstbeteiligung. Hier genügt eine Teilkasko, anders als bei einem selbst verschuldeten Unfall. Ohne sie verlierst du das Auto.',
    ],
    insuranceNote: [
      'The partial cover pays storm damage from wind force 8; the full cover pays it too. Without either, a total loss is all yours.',
      'Die Teilkasko zahlt Sturmschäden ab Windstärke 8; die Vollkasko zahlt sie auch. Ohne beide ist ein Totalschaden ganz deiner.',
    ],
    buckets: [
      [
        'A replacement car',
        'Ein Ersatzauto',
        11500,
        'A used car of the same class costs about 8,000-15,000; the cover pays the time value.',
        'Ein Gebrauchtwagen derselben Klasse kostet etwa 8.000-15.000; die Versicherung zahlt den Zeitwert.',
        [ADAC],
      ],
      [
        'Towing and clearing',
        'Abschleppen und Bergen',
        500,
        'Cutting the tree and towing the wreck cost about 300-800.',
        'Das Zersägen des Baums und das Abschleppen des Wracks kosten etwa 300-800.',
      ],
      [
        'Registration and rental car',
        'Zulassung und Mietwagen',
        700,
        'Plates, registration and two weeks of a rental car.',
        'Kennzeichen, Zulassung und zwei Wochen Mietwagen.',
      ],
    ],
    links: [ADAC, GDV],
    actions: [
      [
        'Stay away from the car if power lines are down; call the fire brigade (112)',
        'Bleib vom Auto weg, wenn Stromleitungen am Boden liegen; ruf die Feuerwehr (112)',
        'high',
      ],
      [
        'Photograph the car and the tree, and report the storm damage at once',
        'Fotografiere Auto und Baum und melde den Sturmschaden sofort',
        'high',
      ],
      [
        'Check the weather service for the wind strength of that night',
        'Prüf beim Wetterdienst die Windstärke jener Nacht',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Do not park under old trees when a storm warning is out. The few steps to a free place cost nothing; the damage costs a car.',
      'Park bei einer Sturmwarnung nicht unter alten Bäumen. Die paar Schritte zu einem freien Platz kosten nichts; der Schaden kostet ein Auto.',
    ],
  }),
];
