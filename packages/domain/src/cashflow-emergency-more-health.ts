import { elink, emergencyCard } from './cashflow-emergency-kit';

const VZ = elink(
  'Consumer advice centre',
  'Verbraucherzentrale',
  'https://www.verbraucherzentrale.de/',
);
const TEST = elink('Stiftung Warentest', 'Stiftung Warentest', 'https://www.test.de/');
const FINANZTIP = elink('Finanztip', 'Finanztip', 'https://www.finanztip.de/');
const MIETERBUND = elink(
  "German Tenants' Association",
  'Deutscher Mieterbund',
  'https://www.mieterbund.de/',
);
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

/**
 * New Emergency cards about health, the law and income (JFK, 2026-11): the dentist (the dental top-up works on three of them), the
 * lawyer (the legal protection works on six), lost income and a hospital abroad. Some fall only on a life that fits: a job, none, short
 * time, a trip abroad.
 */
export const MORE_HEALTH_CARDS = [
  emergencyCard({
    id: 'E56',
    tier: 'spark',
    category: 'health',
    type: 'fixed',
    payment: 'pay_now',
    title: ['Cold Season at the Pharmacy', 'Erkältungszeit in der Apotheke'],
    story: [
      'Three days of a cold: nose spray, lozenges, a thermometer that finally works, and tea for the whole week.',
      'Drei Tage Erkältung: Nasenspray, Halstabletten, ein Thermometer, das endlich funktioniert, und Tee für die ganze Woche.',
    ],
    description: [
      'Over-the-counter medicines are not paid by the statutory insurance, and they add up: a cold costs more than people think. Generic products with the same active substance are often half the price of the brands.',
      'Rezeptfreie Medikamente zahlt die gesetzliche Kasse nicht, und sie läppern sich: eine Erkältung kostet mehr, als man denkt. Generika mit demselben Wirkstoff kosten oft die Hälfte der Markenprodukte.',
    ],
    buckets: [
      [
        'Medicine and small things',
        'Medizin und Kleinigkeiten',
        38,
        'Nose spray 5-8, lozenges 6-9, a pain reliever 5-9, a thermometer 8-15. Ask the pharmacist for the cheaper generic.',
        'Nasenspray 5-8, Halstabletten 6-9, ein Schmerzmittel 5-9, ein Thermometer 8-15. Frag den Apotheker nach dem günstigeren Generikum.',
        [BMG],
      ],
    ],
    links: [BMG],
    actions: [
      [
        'Ask the pharmacist for the cheaper product with the same active substance',
        'Frag den Apotheker nach dem günstigeren Produkt mit demselben Wirkstoff',
        'medium',
      ],
      [
        'Stay at home: sleep and fluids cost nothing and shorten it',
        'Bleib zu Hause: Schlaf und Flüssigkeit kosten nichts und verkürzen es',
        'medium',
      ],
      [
        'Keep a small medicine box with the basics, bought on sale',
        'Halte eine kleine Hausapotheke mit dem Nötigsten bereit, im Angebot gekauft',
        'low',
      ],
    ],
    tip: [
      'tip',
      'A cold with a high fever for more than three days, or with trouble breathing, is not a pharmacy matter: see a doctor. The statutory insurance pays the visit and the prescription.',
      'Eine Erkältung mit hohem Fieber über mehr als drei Tage oder mit Atemnot ist keine Sache für die Apotheke: geh zum Arzt. Die gesetzliche Kasse zahlt Besuch und Rezept.',
    ],
  }),
  emergencyCard({
    id: 'E60',
    tier: 'flame',
    category: 'legal',
    type: 'fixed',
    payment: 'plan_ok',
    insurance: 'legal',
    deductible: 100,
    title: ['The Seller Refuses to Take It Back', 'Der Verkäufer nimmt es nicht zurück'],
    story: [
      'The washing machine you bought six months ago is dead. The shop says it is your fault. The warranty says it is theirs.',
      'Die Waschmaschine, die du vor sechs Monaten gekauft hast, ist kaputt. Der Laden sagt, es sei dein Fehler. Die Gewährleistung sagt, es ist seiner.',
    ],
    description: [
      'In a dispute with a seller you have the law on your side: two years of statutory warranty, and in the first twelve months the seller must prove the defect was not there from the start. A letter often ends it; if not, a lawyer does, and legal protection insurance pays for it.',
      'Im Streit mit einem Verkäufer hast du das Gesetz auf deiner Seite: zwei Jahre gesetzliche Gewährleistung, und in den ersten zwölf Monaten muss der Verkäufer beweisen, dass der Mangel nicht von Anfang an da war. Oft beendet ein Brief den Streit; wenn nicht, tut es ein Anwalt, und die Rechtsschutz zahlt ihn.',
    ],
    insuranceNote: [
      'Legal protection pays the lawyer in a dispute about a purchase; you pay a deductible of about 100. Without it, a small claim is often not worth a lawyer.',
      'Die Rechtsschutz zahlt den Anwalt im Streit um einen Kauf; du zahlst eine Selbstbeteiligung von etwa 100. Ohne sie lohnt sich ein Anwalt bei einer kleinen Forderung oft nicht.',
    ],
    buckets: [
      [
        'Lawyer for the claim',
        'Anwalt für die Forderung',
        500,
        'A first letter from a lawyer costs about 150-300, a court case about 500-900 in all. A consumer advice centre can write the first letter for a small fee.',
        'Ein erster Anwaltsbrief kostet etwa 150-300, ein Verfahren insgesamt etwa 500-900. Eine Verbraucherzentrale kann den ersten Brief gegen kleine Gebühr schreiben.',
        [VZ],
      ],
    ],
    links: [VZ, TEST],
    actions: [
      [
        'Write to the seller with a deadline and ask for repair, replacement or a refund',
        'Schreib dem Verkäufer mit einer Frist und verlang Reparatur, Ersatz oder Erstattung',
        'high',
      ],
      [
        'Keep the receipt, the photos and all messages in one folder',
        'Bewahre Beleg, Fotos und alle Nachrichten in einem Ordner auf',
        'medium',
      ],
      [
        'Ask a consumer advice centre before you pay for a lawyer',
        'Frag eine Verbraucherzentrale, bevor du einen Anwalt bezahlst',
        'medium',
      ],
    ],
    tip: [
      'fact',
      "In Germany a seller has to prove for twelve months that a defect was not there when you bought the thing, and your right to a repair or a replacement lasts two years: the maker's warranty is extra, not instead.",
      'In Deutschland muss ein Verkäufer zwölf Monate lang beweisen, dass ein Mangel beim Kauf nicht da war, und dein Recht auf Reparatur oder Ersatz dauert zwei Jahre: die Herstellergarantie kommt zusätzlich, nicht stattdessen.',
    ],
  }),
  emergencyCard({
    id: 'E62',
    tier: 'flame',
    category: 'health',
    type: 'choice',
    payment: 'plan_ok',
    title: ['Wisdom Teeth Out', 'Weisheitszähne raus'],
    story: [
      'The dentist looks at the X-ray and says: all four, soon. Local anaesthetic, or you sleep through it?',
      'Der Zahnarzt schaut aufs Röntgenbild und sagt: alle vier, bald. Örtliche Betäubung, oder lieber schlafen?',
    ],
    description: [
      'Removing wisdom teeth is paid by the statutory insurance when it is medically needed. What you pay is the comfort: a sedation or a general anaesthetic is an extra, and it is not cheap. Plan a few days off and soft food.',
      'Das Entfernen von Weisheitszähnen zahlt die gesetzliche Kasse, wenn es medizinisch nötig ist. Was du zahlst, ist der Komfort: eine Sedierung oder Vollnarkose ist ein Extra und nicht billig. Plane ein paar Tage frei und weiche Kost ein.',
    ],
    choices: [
      {
        id: 'A',
        label: ['Local anaesthetic', 'Örtliche Betäubung'],
        amount: 60,
        notes: [
          'The removal under local anaesthetic is paid by the insurance; you pay the co-payments and small extras, about 30-80.',
          'Das Entfernen unter örtlicher Betäubung zahlt die Kasse; du zahlst Zuzahlungen und kleine Extras, etwa 30-80.',
        ],
        links: [BMG],
      },
      {
        id: 'B',
        label: ['Sedation or general anaesthetic', 'Dämmerschlaf oder Vollnarkose'],
        amount: 380,
        notes: [
          'An anaesthetist for the sedation costs about 250-500 and is often not paid by the insurance unless it is medically needed.',
          'Ein Anästhesist für die Sedierung kostet etwa 250-500 und wird von der Kasse oft nicht gezahlt, wenn sie nicht medizinisch nötig ist.',
        ],
      },
    ],
    links: [BMG, TEST],
    actions: [
      [
        'Ask whether the sedation is medically needed: then the insurer pays',
        'Frag, ob die Sedierung medizinisch nötig ist: dann zahlt die Kasse',
        'high',
      ],
      [
        'Plan two or three days off and someone to take you home',
        'Plane zwei oder drei Tage frei und jemanden ein, der dich nach Hause bringt',
        'medium',
      ],
      [
        'Buy soft food, ice packs and the prescribed painkillers before the day',
        'Kauf weiche Kost, Kühlpads und die verschriebenen Schmerzmittel vor dem Tag',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Do not rinse your mouth or drink through a straw in the first days: it can loosen the clot and cause a painful dry socket.',
      'Spül in den ersten Tagen den Mund nicht und trink nicht mit einem Strohhalm: es kann das Blutgerinnsel lösen und eine schmerzhafte Alveolitis verursachen.',
    ],
  }),
  emergencyCard({
    id: 'E63',
    tier: 'flame',
    category: 'health',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'dental',
    deductible: 150,
    title: ['Gum Disease', 'Zahnfleischentzündung'],
    story: [
      'Your gums bleed when you brush, and the dentist shows you a picture of the pockets. This is not a cleaning: it is a treatment.',
      'Dein Zahnfleisch blutet beim Putzen, und der Zahnarzt zeigt dir ein Bild der Taschen. Das ist keine Reinigung: es ist eine Behandlung.',
    ],
    description: [
      'Gum disease is common and is paid in its first step by the statutory insurance. What comes after - the regular professional cleanings that keep it away - is largely your own cost, and the dental top-up pays much of it.',
      'Parodontitis ist häufig, und ihren ersten Schritt zahlt die gesetzliche Kasse. Was danach kommt - die regelmäßigen professionellen Reinigungen, die sie fernhalten - ist großteils dein eigener Posten, und die Zahnzusatzversicherung zahlt davon viel.',
    ],
    insuranceNote: [
      'A dental top-up pays most of the professional cleanings that follow the treatment; you pay a share. Without it all of them are yours.',
      'Eine Zahnzusatzversicherung zahlt das meiste der professionellen Reinigungen nach der Behandlung; du zahlst einen Anteil. Ohne sie sind alle deine.',
    ],
    buckets: [
      [
        'Treatment of the pockets',
        'Behandlung der Zahnfleischtaschen',
        520,
        'The treatment is paid by the statutory insurance when it is approved; you pay the extras, such as a better local anaesthetic and a follow-up, about 300-700.',
        'Die Behandlung zahlt die gesetzliche Kasse, wenn sie genehmigt ist; du zahlst die Extras, etwa bessere Betäubung und eine Nachkontrolle, etwa 300-700.',
        [BMG],
      ],
      [
        'Professional cleanings for a year',
        'Professionelle Zahnreinigungen für ein Jahr',
        240,
        'A professional cleaning costs about 60-120; for gum disease it is recommended two to four times a year.',
        'Eine professionelle Zahnreinigung kostet etwa 60-120; bei Parodontitis wird sie zwei- bis viermal im Jahr empfohlen.',
      ],
    ],
    links: [TEST, BMG],
    actions: [
      [
        'Ask for a treatment and cost plan and send it to your top-up insurer first',
        'Lass dir einen Behandlungs- und Kostenplan geben und schick ihn zuerst an deine Zusatzversicherung',
        'high',
      ],
      [
        'Brush twice a day, use interdental brushes and keep the check-ups',
        'Putz zweimal am Tag, nutze Interdentalbürsten und halte die Kontrolltermine ein',
        'medium',
      ],
      [
        'Stop smoking if you do: it is the biggest risk for the gums',
        'Hör auf zu rauchen, falls du es tust: es ist das größte Risiko für das Zahnfleisch',
        'medium',
      ],
    ],
    tip: [
      'fact',
      'Gum disease can be connected with the heart and with diabetes. A dentist who treats it early protects more than the teeth.',
      'Parodontitis kann mit dem Herzen und mit Diabetes zusammenhängen. Ein Zahnarzt, der sie früh behandelt, schützt mehr als nur die Zähne.',
    ],
  }),
  emergencyCard({
    id: 'E72',
    tier: 'blaze',
    category: 'legal',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'employed' },
    insurance: 'legal',
    deductible: 250,
    title: ['The Dismissal Is Wrong', 'Die Kündigung ist falsch'],
    story: [
      'A letter on Friday afternoon: dismissed, effective at the end of the month. No warning, no reason you can follow. You have three weeks to react.',
      'Ein Brief am Freitagnachmittag: gekündigt, zum Monatsende. Keine Abmahnung, kein Grund, dem du folgen kannst. Du hast drei Wochen zum Reagieren.',
    ],
    description: [
      'In Germany you have three weeks after the notice to file a claim at the labour court. A lawyer shows whether the dismissal is valid; often it ends with a settlement and a payment. In the first instance each side pays its own lawyer, whoever wins, so the legal protection insurance is worth a lot here.',
      'In Deutschland hast du nach der Kündigung drei Wochen Zeit, beim Arbeitsgericht zu klagen. Ein Anwalt zeigt, ob die Kündigung wirksam ist; oft endet es mit einem Vergleich und einer Zahlung. In der ersten Instanz zahlt jede Seite ihren Anwalt selbst, wer auch gewinnt, deshalb ist die Rechtsschutz hier viel wert.',
    ],
    insuranceNote: [
      'Legal protection with the employment module pays your lawyer and the court costs; you pay a deductible of about 250. It starts after a waiting period of about three months.',
      'Die Rechtsschutz mit dem Arbeitsrechtsbaustein zahlt deinen Anwalt und die Gerichtskosten; du zahlst eine Selbstbeteiligung von etwa 250. Sie beginnt nach einer Wartezeit von etwa drei Monaten.',
    ],
    buckets: [
      [
        'Lawyer, first instance',
        'Anwalt, erste Instanz',
        1300,
        'A labour lawyer costs about 800-2,000 depending on your salary, because the fee depends on the value of the case. Many offer a first talk for a small fee.',
        'Ein Fachanwalt für Arbeitsrecht kostet etwa 800-2.000, je nach Gehalt, denn das Honorar hängt vom Streitwert ab. Viele bieten ein Erstgespräch gegen kleine Gebühr an.',
        [elink('Federal Ministry of Labour', 'Bundesarbeitsministerium', 'https://www.bmas.de/')],
      ],
      [
        'Court costs and an expert',
        'Gerichtskosten und Gutachter',
        400,
        'In the first instance the labour court costs are small; a witness or an expert can add to it.',
        'In der ersten Instanz sind die Gerichtskosten beim Arbeitsgericht klein; ein Zeuge oder Gutachter kann etwas dazukommen.',
      ],
    ],
    links: [BA, VZ],
    actions: [
      [
        'File the claim at the labour court within three weeks of the notice',
        'Reich die Klage beim Arbeitsgericht innerhalb von drei Wochen nach der Kündigung ein',
        'high',
      ],
      [
        'Register as job-seeking at the employment agency within three days',
        'Melde dich innerhalb von drei Tagen bei der Agentur für Arbeit arbeitssuchend',
        'high',
      ],
      [
        'Ask the works council, a union or a lawyer for advice before you sign anything',
        'Hol Rat beim Betriebsrat, einer Gewerkschaft oder einem Anwalt, bevor du etwas unterschreibst',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Do not sign a termination agreement or a receipt on the spot: it can cost you a waiting period for unemployment pay. Take the paper home and have it checked.',
      'Unterschreib keinen Aufhebungsvertrag und keine Quittung auf der Stelle: es kann dich eine Sperrzeit beim Arbeitslosengeld kosten. Nimm das Papier mit nach Hause und lass es prüfen.',
    ],
  }),
  emergencyCard({
    id: 'E73',
    tier: 'blaze',
    category: 'health',
    type: 'choice',
    payment: 'plan_ok',
    insurance: 'dental',
    deductible: 450,
    title: ['A Tooth Has to Go: Bridge or Implant', 'Ein Zahn muss weg: Brücke oder Implantat'],
    story: [
      'The tooth cannot be saved. The dentist puts two plans on the table: a bridge or an implant. One price has a comma and the other has a bigger comma.',
      'Der Zahn ist nicht zu retten. Der Zahnarzt legt zwei Pläne auf den Tisch: eine Brücke oder ein Implantat. Ein Preis hat ein Komma, der andere ein größeres.',
    ],
    description: [
      'Replacing a tooth is paid by the statutory insurance only as a fixed share for the standard solution. An implant costs several times more, and a good dental top-up pays much of it. Get two plans and compare before you decide.',
      'Den Zahnersatz zahlt die gesetzliche Kasse nur als Festzuschuss für die Regelversorgung. Ein Implantat kostet ein Vielfaches mehr, und eine gute Zahnzusatzversicherung zahlt davon viel. Hol zwei Pläne ein und vergleiche, bevor du dich entscheidest.',
    ],
    insuranceNote: [
      'A dental top-up pays a large share of a bridge or an implant, up to a yearly limit; you pay a share of about 450 here. Without it, all of it is yours.',
      'Eine Zahnzusatzversicherung zahlt einen großen Anteil von Brücke oder Implantat, bis zu einem Jahreslimit; du zahlst hier einen Anteil von etwa 450. Ohne sie ist alles deins.',
    ],
    choices: [
      {
        id: 'A',
        label: ['A bridge', 'Eine Brücke'],
        amount: 900,
        notes: [
          'A bridge costs about 1,200-2,500 in all; the insurer pays a fixed share of the standard type, you pay the rest, here about 900.',
          'Eine Brücke kostet insgesamt etwa 1.200-2.500; die Kasse zahlt einen Festzuschuss auf die Regelversorgung, den Rest zahlst du, hier etwa 900.',
        ],
        links: [TEST],
      },
      {
        id: 'B',
        label: ['An implant', 'Ein Implantat'],
        amount: 2400,
        notes: [
          "An implant with a crown costs about 2,000-4,000; the insurer pays only the fixed share, the rest is yours or your top-up's.",
          'Ein Implantat mit Krone kostet etwa 2.000-4.000; die Kasse zahlt nur den Festzuschuss, der Rest ist deiner oder der deiner Zusatzversicherung.',
        ],
      },
    ],
    links: [TEST, FINANZTIP],
    actions: [
      [
        'Ask for a Heil- und Kostenplan from two dentists and compare',
        'Lass dir von zwei Zahnärzten einen Heil- und Kostenplan geben und vergleiche',
        'high',
      ],
      [
        'Send the plan to your top-up insurer before the treatment begins',
        'Schick den Plan an deine Zusatzversicherung, bevor die Behandlung beginnt',
        'high',
      ],
      [
        'Ask about the material and the guarantee of the work',
        'Frag nach Material und Garantie der Arbeit',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'The fixed share of the statutory insurance rises with a complete bonus booklet: ten years of check-ups add up to a higher share, so keep it up.',
      'Der Festzuschuss der gesetzlichen Kasse steigt mit einem lückenlosen Bonusheft: zehn Jahre Kontrollen bringen einen höheren Anteil, halte es also lückenlos.',
    ],
  }),
  emergencyCard({
    id: 'E74',
    tier: 'blaze',
    category: 'legal',
    type: 'fixed',
    payment: 'plan_ok',
    needs: { home: ['own_flat', 'shared_flat', 'with_partner'] },
    insurance: 'legal',
    deductible: 200,
    title: ['A Rent Increase That Is Too High', 'Eine Mieterhöhung, die zu hoch ist'],
    story: [
      'The landlord wants 30 percent more rent from next month, "because of the market". The letter is polite. The sum is not.',
      'Der Vermieter will ab nächsten Monat 30 Prozent mehr Miete, "wegen des Marktes". Der Brief ist höflich. Die Summe nicht.',
    ],
    description: [
      "In Germany a rent increase has to follow rules: it is limited to a share in three years (20 percent, 15 in tight markets) and bound to the local rent index. You can object, and a tenants' association or a lawyer shows what is allowed. Legal protection insurance pays the lawyer.",
      'In Deutschland muss eine Mieterhöhung Regeln folgen: sie ist auf einen Anteil in drei Jahren begrenzt (20 Prozent, in angespannten Märkten 15) und an den Mietspiegel gebunden. Du kannst widersprechen, und ein Mieterverein oder ein Anwalt zeigt, was erlaubt ist. Die Rechtsschutz zahlt den Anwalt.',
    ],
    insuranceNote: [
      "Legal protection with the tenancy module pays the lawyer; you pay a deductible of about 200. A tenants' association costs less per year than one hour of a lawyer.",
      'Die Rechtsschutz mit dem Mietrechtsbaustein zahlt den Anwalt; du zahlst eine Selbstbeteiligung von etwa 200. Ein Mieterverein kostet im Jahr weniger als eine Anwaltsstunde.',
    ],
    buckets: [
      [
        'Lawyer for the rent dispute',
        'Anwalt für den Mietstreit',
        1000,
        'A lawyer for a rent dispute costs about 500-1,500 depending on the case value. Often a letter with the right figures is enough.',
        'Ein Anwalt für einen Mietstreit kostet etwa 500-1.500, je nach Streitwert. Oft reicht ein Brief mit den richtigen Zahlen.',
        [MIETERBUND],
      ],
    ],
    links: [MIETERBUND, VZ],
    actions: [
      [
        'Check the increase against the local rent index and the 20 percent limit',
        'Prüf die Erhöhung gegen den Mietspiegel und die 20-Prozent-Grenze',
        'high',
      ],
      [
        "Do not sign a consent before a tenants' association has seen it; you have until the end of the second month to decide",
        'Unterschreib keine Zustimmung, bevor sie ein Mieterverein gesehen hat; du hast bis zum Ende des zweiten Monats zur Entscheidung',
        'high',
      ],
      [
        "Join a tenants' association: it is cheaper than a lawyer",
        'Tritt einem Mieterverein bei: er ist günstiger als ein Anwalt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'You have until the end of the second month after the letter to agree or to object, and the new rent only starts after that. Never agree in a hurry because of a deadline in the letter.',
      'Du hast bis zum Ende des zweiten Monats nach dem Brief Zeit zuzustimmen oder zu widersprechen, und die neue Miete beginnt erst danach. Stimm nie in Eile zu wegen einer Frist im Brief.',
    ],
  }),
  emergencyCard({
    id: 'E80',
    tier: 'blaze',
    category: 'income',
    type: 'fixed',
    payment: 'plan_ok',
    needs: { employment: 'short_time' },
    title: ['Short-Time Work: The Pay Drops', 'Kurzarbeit: Das Gehalt sinkt'],
    story: [
      'The company has fewer orders. For the next months you work 60 percent. The rent still asks for 100.',
      'Die Firma hat weniger Aufträge. In den nächsten Monaten arbeitest du 60 Prozent. Die Miete verlangt weiter 100.',
    ],
    description: [
      'Short-time work keeps the job, and the state pays short-time allowance for the lost hours: 60 percent of the lost net pay, 67 with a child. The rest is a gap in your monthly budget that you have to bridge, often with the reserve.',
      'Kurzarbeit erhält den Job, und der Staat zahlt Kurzarbeitergeld für die ausgefallenen Stunden: 60 Prozent des ausgefallenen Nettos, 67 mit Kind. Der Rest ist eine Lücke im Monatsbudget, die du überbrücken musst, oft mit der Rücklage.',
    ],
    buckets: [
      [
        'The gap over three months',
        'Die Lücke über drei Monate',
        900,
        'Short-time allowance replaces 60 percent of the lost net pay; the other 40 percent is yours. For three months this is about a month of rent.',
        'Das Kurzarbeitergeld ersetzt 60 Prozent des ausgefallenen Nettos; die anderen 40 Prozent sind deine. Über drei Monate ist das etwa eine Monatsmiete.',
        [BA],
      ],
    ],
    links: [BA, FINANZTIP],
    actions: [
      [
        'Ask your employer for the exact plan: the hours and the months',
        'Frag deinen Arbeitgeber nach dem genauen Plan: Stunden und Monate',
        'high',
      ],
      [
        'Cut the flexible costs for the months and note what you save',
        'Kürze die flexiblen Kosten für diese Monate und notiere, was du sparst',
        'medium',
      ],
      [
        'Use the time: a course or a side job for the free hours',
        'Nutze die Zeit: ein Kurs oder ein Nebenjob für die freien Stunden',
        'low',
      ],
    ],
    tip: [
      'fact',
      'Short-time allowance was used massively in the pandemic: it kept millions of jobs. The company applies for it, you do not.',
      'Das Kurzarbeitergeld wurde in der Pandemie massenhaft genutzt: es hat Millionen Jobs erhalten. Die Firma beantragt es, nicht du.',
    ],
  }),
  emergencyCard({
    id: 'E81',
    tier: 'blaze',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    needs: { employment: 'unemployed' },
    title: ['Out of Work: The Costs of Looking', 'Ohne Arbeit: Die Kosten der Suche'],
    story: [
      'Applications, a train to an interview, a certificate that the new field wants, and the first unemployment pay is three weeks away.',
      'Bewerbungen, ein Zug zum Vorstellungsgespräch, ein Zertifikat, das das neue Feld verlangt, und das erste Arbeitslosengeld ist noch drei Wochen entfernt.',
    ],
    description: [
      'Looking for a job costs money before it brings any: applications, travel and sometimes a course. The employment agency can pay part of the application costs and of a training, if you ask before you spend. The first payment of unemployment pay needs time.',
      'Die Jobsuche kostet Geld, bevor sie welches bringt: Bewerbungen, Fahrten und manchmal ein Kurs. Die Arbeitsagentur kann einen Teil der Bewerbungskosten und einer Weiterbildung zahlen, wenn du fragst, bevor du ausgibst. Die erste Zahlung des Arbeitslosengeldes braucht Zeit.',
    ],
    buckets: [
      [
        'Applications and interview travel',
        'Bewerbungen und Fahrten zu Gesprächen',
        220,
        'Photos, prints and train tickets for interviews: about 100-300. The agency can refund a part of them if you ask beforehand.',
        'Fotos, Ausdrucke und Fahrkarten zu Vorstellungsgesprächen: etwa 100-300. Die Agentur kann einen Teil erstatten, wenn du vorher fragst.',
        [BA],
      ],
      [
        'A course or certificate',
        'Ein Kurs oder Zertifikat',
        350,
        'A short course for the new field costs about 200-600; with an education voucher of the agency it can be free.',
        'Ein kurzer Kurs für das neue Feld kostet etwa 200-600; mit einem Bildungsgutschein der Agentur kann er kostenlos sein.',
      ],
      [
        'The gap until the first payment',
        'Die Lücke bis zur ersten Zahlung',
        600,
        'Unemployment pay is paid at the end of the month for the month before: the first weeks need a reserve.',
        'Das Arbeitslosengeld wird am Monatsende für den Vormonat gezahlt: die ersten Wochen brauchen eine Rücklage.',
      ],
    ],
    links: [BA, FINANZTIP],
    actions: [
      [
        'Register as unemployed within three days and apply for the unemployment pay',
        'Melde dich innerhalb von drei Tagen arbeitslos und beantrage das Arbeitslosengeld',
        'high',
      ],
      [
        'Ask the agency for a refund of the application costs before you spend',
        'Frag die Agentur nach der Erstattung der Bewerbungskosten, bevor du ausgibst',
        'high',
      ],
      [
        'Ask for an education voucher before you pay for a course yourself',
        'Frag nach einem Bildungsgutschein, bevor du einen Kurs selbst bezahlst',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Register as job-seeking as soon as you know the end date of the job: a late report can cost you a waiting period for the unemployment pay.',
      'Melde dich arbeitssuchend, sobald du das Ende des Jobs kennst: eine verspätete Meldung kann dich eine Sperrzeit beim Arbeitslosengeld kosten.',
    ],
  }),
  emergencyCard({
    id: 'E87',
    tier: 'wildfire',
    category: 'legal',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: ['own_flat', 'shared_flat', 'with_partner'] },
    insurance: 'legal',
    deductible: 300,
    title: ['A Neighbour Dispute Goes to Court', 'Ein Nachbarschaftsstreit landet vor Gericht'],
    story: [
      'It began with a hedge and a noise. Now there are letters from two lawyers, and a hearing at the local court.',
      'Es begann mit einer Hecke und einem Geräusch. Jetzt gibt es Briefe von zwei Anwälten und einen Termin am Amtsgericht.',
    ],
    description: [
      'Neighbour disputes are slow and costly: lawyers, an expert and the court, and the loser pays all. Mediation by a local arbitrator is cheap and often works. Legal protection pays the costs, if the module covers neighbours.',
      'Nachbarschaftsstreit ist langsam und teuer: Anwälte, ein Gutachter und das Gericht, und der Verlierer zahlt alles. Eine Schlichtung durch einen Schiedsmann ist billig und klappt oft. Die Rechtsschutz zahlt die Kosten, wenn der Baustein Nachbarn abdeckt.',
    ],
    insuranceNote: [
      'Legal protection pays the lawyer and the court costs if the neighbour module is part of the policy; you pay a deductible of about 300. Check the module before you need it.',
      'Die Rechtsschutz zahlt Anwalt und Gerichtskosten, wenn der Nachbarschaftsbaustein Teil der Police ist; du zahlst eine Selbstbeteiligung von etwa 300. Prüf den Baustein, bevor du ihn brauchst.',
    ],
    bucketDice: {
      bucket: 1,
      bands: [
        [1, 2, 300],
        [3, 5, 1200],
        [6, 6, 2600],
      ],
    },
    buckets: [
      [
        'Lawyer',
        'Anwalt',
        1800,
        'A lawyer for a dispute about a hedge or a noise costs about 800-2,500 in all. A conciliation by the local arbitrator costs about 30-100.',
        'Ein Anwalt für einen Streit um Hecke oder Lärm kostet insgesamt etwa 800-2.500. Eine Schlichtung durch den Schiedsmann kostet etwa 30-100.',
        [VZ],
      ],
      [
        'Court and expert costs',
        'Gerichts- und Gutachterkosten',
        300,
        'The die is the outcome: 1-2 a settlement (300), 3-5 a hearing with an expert (1,200), 6 a long case with the loser paying all (2,600).',
        'Der Würfel ist der Ausgang: 1-2 ein Vergleich (300), 3-5 ein Termin mit Gutachter (1.200), 6 ein langer Prozess, in dem der Verlierer alles zahlt (2.600).',
      ],
    ],
    links: [VZ],
    actions: [
      [
        'Try a talk or the local arbitrator before any lawyer',
        'Versuch ein Gespräch oder den Schiedsmann, bevor ein Anwalt kommt',
        'high',
      ],
      [
        'Document the problem with dates, photos and recordings of noise logs',
        'Dokumentiere das Problem mit Daten, Fotos und einem Lärmprotokoll',
        'medium',
      ],
      [
        'Ask your legal protection insurer before you hire a lawyer',
        'Frag deine Rechtsschutz, bevor du einen Anwalt beauftragst',
        'high',
      ],
    ],
    tip: [
      'tip',
      'Many German states require an attempt at conciliation by the arbitrator before the court for neighbour disputes: it costs about 30 euros and solves more than half of the cases.',
      'Viele deutsche Länder verlangen bei Nachbarstreit vor dem Gericht einen Schlichtungsversuch beim Schiedsmann: er kostet etwa 30 Euro und löst mehr als die Hälfte der Fälle.',
    ],
  }),
  emergencyCard({
    id: 'E88',
    tier: 'wildfire',
    category: 'health',
    type: 'dice',
    payment: 'plan_ok',
    needs: { location: ['abroad_europe', 'other_continent'] },
    estimate: true,
    title: ['Hospital Abroad, No Cover', 'Krankenhaus im Ausland, ohne Schutz'],
    story: [
      'A fall from a scooter on a holiday island, a night in the emergency room and a bill in a language you cannot read.',
      'Ein Sturz vom Roller auf einer Urlaubsinsel, eine Nacht in der Notaufnahme und eine Rechnung in einer Sprache, die du nicht lesen kannst.',
    ],
    description: [
      'Within the EU the European health card gives you state care at the local rates, but not private clinics and not the way home. Outside the EU the statutory insurance pays nothing. A travel health insurance costs a few euros and pays the hospital and the flight home.',
      'Innerhalb der EU gibt dir die Europäische Krankenversicherungskarte staatliche Versorgung zu den örtlichen Sätzen, aber keine Privatkliniken und nicht den Heimweg. Außerhalb der EU zahlt die gesetzliche Kasse nichts. Eine Auslandsreisekrankenversicherung kostet wenige Euro und zahlt Klinik und Rückflug.',
    ],
    dice: [
      [1, 3, 600],
      [4, 5, 4000],
      [6, 6, 9000],
    ],
    buckets: [
      [
        'Treatment abroad',
        'Behandlung im Ausland',
        600,
        'The die: 1-3 an emergency room and X-rays (600), 4-5 an operation and some days in a ward (4,000), 6 a long stay and the flight home with a doctor (9,000).',
        'Der Würfel: 1-3 Notaufnahme und Röntgen (600), 4-5 eine Operation und einige Tage auf Station (4.000), 6 ein langer Aufenthalt und der Rückflug mit Arzt (9.000).',
        [AA],
      ],
    ],
    links: [AA, BMG, VZ],
    actions: [
      [
        'Call the assistance number of your insurer or the German embassy for help',
        'Ruf die Notrufnummer deines Versicherers oder die deutsche Botschaft an',
        'high',
      ],
      [
        'Keep every bill and the medical report; ask for an invoice in English',
        'Bewahre jede Rechnung und den Arztbericht auf; bitte um eine Rechnung auf Englisch',
        'high',
      ],
      [
        'Before the next trip: take out a travel health insurance for a few euros a year',
        'Schließ vor der nächsten Reise eine Auslandsreisekrankenversicherung für wenige Euro im Jahr ab',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A yearly travel health insurance costs about 10 to 20 euros and pays the hospital and a return flight with a doctor. It is the cheapest insurance there is for what a flight home can cost.',
      'Eine jährliche Auslandsreisekrankenversicherung kostet etwa 10 bis 20 Euro und zahlt Klinik und Rückflug mit Arzt. Sie ist die günstigste Versicherung gegen das, was ein Rückflug kosten kann.',
    ],
  }),
  emergencyCard({
    id: 'E90',
    tier: 'wildfire',
    category: 'admin',
    type: 'multi',
    payment: 'plan_ok',
    insurance: 'legal',
    deductible: 300,
    title: ['Your Identity Was Stolen', 'Deine Identität wurde gestohlen'],
    story: [
      'A letter about a contract you never signed. Then a second, from a debt collector. Somebody has been using your name for months.',
      'Ein Brief über einen Vertrag, den du nie unterschrieben hast. Dann ein zweiter, von einem Inkassobüro. Jemand benutzt seit Monaten deinen Namen.',
    ],
    description: [
      'Identity theft is slow to undo: you have to prove that you are not the debtor, correct the credit records and answer collectors. A lawyer speeds it up, and legal protection insurance pays for it. The first hours decide how much money is lost.',
      'Identitätsdiebstahl ist langsam rückgängig zu machen: du musst beweisen, dass du nicht der Schuldner bist, die Auskunfteien korrigieren und Inkassobüros antworten. Ein Anwalt beschleunigt es, und die Rechtsschutz zahlt ihn. Die ersten Stunden entscheiden, wie viel Geld verloren geht.',
    ],
    insuranceNote: [
      'Legal protection pays the lawyer who clears your name; you pay a deductible of about 300. The money that was taken is yours to claim back.',
      'Die Rechtsschutz zahlt den Anwalt, der deinen Namen reinwäscht; du zahlst eine Selbstbeteiligung von etwa 300. Das genommene Geld musst du selbst zurückfordern.',
    ],
    buckets: [
      [
        'Lawyer and the creditors',
        'Anwalt und die Gläubiger',
        1200,
        'A lawyer who writes to every creditor and the collection agencies costs about 800-2,000.',
        'Ein Anwalt, der jedem Gläubiger und den Inkassobüros schreibt, kostet etwa 800-2.000.',
        [VZ],
      ],
      [
        'Credit records and corrections',
        'Auskunfteien und Korrekturen',
        150,
        'A copy of your credit data is free once a year; corrections cost time more than money.',
        'Eine Kopie deiner Auskunftsdaten ist einmal im Jahr kostenlos; Korrekturen kosten mehr Zeit als Geld.',
      ],
      [
        'Money lost in the first weeks',
        'Geld, das in den ersten Wochen verloren ging',
        900,
        'Goods ordered in your name and some payments that cannot be reversed.',
        'In deinem Namen bestellte Waren und einige Zahlungen, die sich nicht zurückholen lassen.',
      ],
    ],
    links: [
      elink('BSI – identity theft', 'BSI – Identitätsdiebstahl', 'https://www.bsi.bund.de/'),
      VZ,
    ],
    actions: [
      [
        'File a report with the police and keep the number of the case',
        'Erstatte Anzeige bei der Polizei und behalte das Aktenzeichen',
        'high',
      ],
      [
        'Ask the credit agency for your data and put a note on your file',
        'Frag bei der Auskunftei nach deinen Daten und lass einen Hinweis in deiner Akte anbringen',
        'high',
      ],
      [
        'Write to every creditor in writing, deny the contract and attach the report',
        'Schreib jedem Gläubiger schriftlich, widersprich dem Vertrag und leg die Anzeige bei',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'In Germany you can get a free copy of your credit data once a year: look at it from time to time, a theft shows there first.',
      'In Deutschland bekommst du einmal im Jahr eine kostenlose Kopie deiner Auskunftsdaten: schau sie dir von Zeit zu Zeit an, ein Diebstahl zeigt sich dort zuerst.',
    ],
  }),
  emergencyCard({
    id: 'E97',
    tier: 'inferno',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    unique: true,
    estimate: true,
    title: ['A Year Unable to Work', 'Ein Jahr arbeitsunfähig'],
    story: [
      'A diagnosis in spring. A therapy, a rehab, a long road back. The summer passes, the autumn too, and the pay is a part of what it was.',
      'Eine Diagnose im Frühjahr. Eine Therapie, eine Reha, ein langer Weg zurück. Der Sommer vergeht, der Herbst auch, und das Geld ist ein Teil von dem, was es war.',
    ],
    description: [
      'A year of illness shows what the safety net holds and what not. For six weeks the employer pays the salary, then the health insurance pays sick pay of about 70 percent of the gross pay. The gap is your own, and it grows with the extra costs. Insurance against not being able to work in your job is the one that closes it.',
      'Ein Jahr Krankheit zeigt, was das Netz trägt und was nicht. Sechs Wochen zahlt der Arbeitgeber das Gehalt, dann zahlt die Krankenkasse Krankengeld von etwa 70 Prozent des Bruttos. Die Lücke ist deine und wächst mit den Zusatzkosten. Die Versicherung gegen die Berufsunfähigkeit ist die, die sie schließt.',
    ],
    buckets: [
      [
        'The income gap for ten months',
        'Die Einkommenslücke über zehn Monate',
        5000,
        'Sick pay is at most 90 percent of the net pay; with the usual cuts you lose about 20-30 percent of your monthly net for ten months.',
        'Das Krankengeld beträgt höchstens 90 Prozent des Nettos; mit den üblichen Abzügen fehlen dir etwa 20-30 Prozent deines Monatsnetto über zehn Monate.',
        [BMG],
      ],
      [
        'Therapy, aids and journeys',
        'Therapie, Hilfsmittel und Fahrten',
        1800,
        'Co-payments, aids, journeys to rehab and a few things that make daily life easier.',
        'Zuzahlungen, Hilfsmittel, Fahrten zur Reha und einige Dinge, die den Alltag erleichtern.',
      ],
      [
        'Fixed costs and help at home',
        'Fixkosten und Hilfe zu Hause',
        3000,
        'Rent, car and contracts run on; some help with shopping or the house may be needed.',
        'Miete, Auto und Verträge laufen weiter; etwas Hilfe beim Einkaufen oder im Haushalt kann nötig sein.',
      ],
    ],
    links: [FINANZTIP, BMG],
    actions: [
      [
        'Ask the health insurer for the sick pay and keep every certificate in time',
        'Frag die Krankenkasse nach dem Krankengeld und reiche jede Bescheinigung rechtzeitig ein',
        'high',
      ],
      [
        'Look at all your fixed costs and ask for a break or a payment plan',
        'Schau auf alle Fixkosten und bitte um eine Pause oder einen Zahlungsplan',
        'high',
      ],
      [
        'When you are well: look at an insurance against not being able to work in your job',
        'Wenn du wieder gesund bist: schau dir eine Versicherung gegen Berufsunfähigkeit an',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'An insurance against not being able to work in your job (Berufsunfähigkeitsversicherung) is best taken out young and healthy: it pays a monthly pension for years, and it is the one cover nearly every adviser puts first.',
      'Eine Berufsunfähigkeitsversicherung schließt man am besten jung und gesund ab: sie zahlt über Jahre eine monatliche Rente und ist die eine Absicherung, die fast jeder Berater an erste Stelle setzt.',
    ],
  }),
];
