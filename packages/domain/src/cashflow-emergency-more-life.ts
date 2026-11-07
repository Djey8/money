import { elink, emergencyCard } from './cashflow-emergency-kit';

const VZ = elink(
  'Consumer advice centre',
  'Verbraucherzentrale',
  'https://www.verbraucherzentrale.de/',
);
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
const BMG = elink(
  'Federal Ministry of Health',
  'Bundesgesundheitsministerium',
  'https://www.bundesgesundheitsministerium.de/',
);
const AA = elink(
  'Foreign Office – travel advice',
  'Auswärtiges Amt – Reisehinweise',
  'https://www.auswaertiges-amt.de/',
);
const TIERARZT = elink(
  'Federal Chamber of Veterinarians',
  'Bundestierärztekammer',
  'https://www.bundestieraerztekammer.de/',
);

/**
 * New Emergency cards for the lives of the characters (JFK, 2026-11): a trip abroad, a pet, a child, a partner, a flat, a flatmate,
 * a study, a job lost or cut. A card that does not apply to a life is shuffled back, so the cards that do fall harder on the ones they
 * are for. The biggest are the ones an insurance (or the lack of it) decides.
 */
export const MORE_LIFE_CARDS = [
  emergencyCard({
    id: 'E52',
    tier: 'spark',
    category: 'fees',
    type: 'fixed',
    payment: 'pay_now',
    needs: { location: ['abroad_europe', 'other_continent'] },
    fixedPrice: true,
    title: ['The Wrong Cash Machine Abroad', 'Der falsche Geldautomat im Ausland'],
    story: [
      'The machine in the tourist street offered to "convert to euros" for you. You pressed yes. It was a very bad yes.',
      'Der Automat in der Touristenstraße bot an, "für dich in Euro umzurechnen". Du hast Ja gedrückt. Es war ein sehr schlechtes Ja.',
    ],
    description: [
      'Cash machines abroad add fees, and many offer a conversion at a bad rate ("dynamic currency conversion"). The money is small each time but adds up over a trip. Always choose the local currency, and use a card without a foreign fee.',
      'Geldautomaten im Ausland berechnen Gebühren, und viele bieten eine Umrechnung zu schlechtem Kurs an ("Dynamic Currency Conversion"). Das Geld ist jedes Mal wenig, summiert sich aber über eine Reise. Wähle immer die Landeswährung und nutze eine Karte ohne Auslandsgebühr.',
    ],
    buckets: [
      [
        'Fees and a bad rate',
        'Gebühren und ein schlechter Kurs',
        28,
        'A machine can charge 3-6 plus a conversion surcharge of 5-10 percent on the amount. A card without foreign fee costs nothing extra.',
        'Ein Automat kann 3-6 plus einen Umrechnungsaufschlag von 5-10 Prozent auf den Betrag berechnen. Eine Karte ohne Auslandsgebühr kostet nichts extra.',
        [TEST],
      ],
    ],
    links: [TEST, VZ],
    actions: [
      [
        'Always choose the local currency and decline the conversion offer',
        'Wähle immer die Landeswährung und lehne das Umrechnungsangebot ab',
        'high',
      ],
      [
        'Use a bank or a card without a foreign fee',
        'Nutze eine Bank oder Karte ohne Auslandsgebühr',
        'medium',
      ],
      [
        'Withdraw a bigger sum at once instead of many small ones',
        'Heb lieber einmal einen größeren Betrag ab als oft kleine',
        'low',
      ],
    ],
    tip: [
      'tip',
      'At a cash machine or a card terminal abroad the question "pay in euros or in the local currency?" has one right answer: the local currency. The other one gives the machine\'s own, bad rate.',
      'Am Geldautomaten oder Kartenterminal im Ausland hat die Frage "in Euro oder in Landeswährung zahlen?" eine richtige Antwort: die Landeswährung. Die andere gibt den eigenen, schlechten Kurs des Automaten.',
    ],
  }),
  emergencyCard({
    id: 'E53',
    tier: 'spark',
    category: 'fees',
    type: 'fixed',
    payment: 'pay_now',
    modifier: { when: 'openEmergency', add: 15 },
    title: ['Overdraft Interest', 'Dispozinsen'],
    story: [
      'The account was a few days in the red. The bank statement shows a little line: interest. It is not so little.',
      'Das Konto war ein paar Tage im Minus. Der Kontoauszug zeigt eine kleine Zeile: Zinsen. Sie ist nicht so klein.',
    ],
    description: [
      'An overdraft is the most expensive loan that is easy to get: the interest is often 10 to 14 percent. A few days cost little, but a habit costs a lot. With an emergency open, the account is more likely to be in the red.',
      'Der Dispo ist der teuerste Kredit, den man leicht bekommt: die Zinsen liegen oft bei 10 bis 14 Prozent. Ein paar Tage kosten wenig, aber eine Gewohnheit viel. Mit einem offenen Notfall ist das Konto eher im Minus.',
    ],
    buckets: [
      [
        'Interest of the overdraft',
        'Zinsen des Dispokredits',
        45,
        'The interest of an overdraft is about 10-14 percent a year, and above the agreed limit even more. With 1,000 in the red for a month it is about 10-12.',
        'Die Zinsen eines Dispos liegen bei etwa 10-14 Prozent im Jahr, über dem vereinbarten Limit noch mehr. Bei 1.000 im Minus für einen Monat sind es etwa 10-12.',
        [VZ],
      ],
    ],
    links: [VZ, FINANZTIP],
    actions: [
      [
        'Move money from savings to the account to leave the red',
        'Überweis Geld vom Sparkonto aufs Konto, um das Minus zu verlassen',
        'high',
      ],
      [
        'Ask the bank for a cheaper instalment loan if you are often in the red',
        'Frag die Bank nach einem günstigeren Ratenkredit, wenn du oft im Minus bist',
        'medium',
      ],
      [
        'Set an alert on your account when the balance falls below a small sum',
        'Stell einen Alarm auf dein Konto, wenn der Stand unter eine kleine Summe fällt',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Compare the overdraft interest of your bank with an instalment loan: it is often half. A small reserve in a separate account avoids the whole problem.',
      'Vergleiche den Dispozins deiner Bank mit einem Ratenkredit: er ist oft doppelt so hoch. Eine kleine Rücklage auf einem getrennten Konto vermeidet das ganze Problem.',
    ],
  }),
  emergencyCard({
    id: 'E54',
    tier: 'spark',
    category: 'health_pet',
    type: 'fixed',
    payment: 'plan_ok',
    requires: 'pet',
    title: ['Vaccination and Worming', 'Impfung und Entwurmung'],
    story: [
      'The yearly check at the vet: the booster, the worm tablet and a look at the teeth. The animal was brave. You pay.',
      'Der jährliche Check beim Tierarzt: die Auffrischung, die Wurmtablette und ein Blick auf die Zähne. Das Tier war tapfer. Du zahlst.',
    ],
    description: [
      'Prevention is the cheapest part of keeping a pet: a yearly vaccination and a worm treatment cost less than one night at the emergency vet. Rabies vaccination is required for travel abroad.',
      'Vorsorge ist der günstigste Teil der Tierhaltung: eine jährliche Impfung und eine Wurmkur kosten weniger als eine Nacht beim Notdienst. Die Tollwutimpfung ist für Reisen ins Ausland vorgeschrieben.',
    ],
    buckets: [
      [
        'Check, booster and worm tablet',
        'Check, Auffrischung und Wurmtablette',
        75,
        'A yearly check with a booster costs about 40-90, a worm tablet 10-20. Vets charge by the fee schedule.',
        'Ein jährlicher Check mit Auffrischung kostet etwa 40-90, eine Wurmtablette 10-20. Tierärzte rechnen nach der Gebührenordnung ab.',
        [TIERARZT],
      ],
    ],
    links: [TIERARZT],
    actions: [
      [
        'Keep the vaccination record and the dates of the next boosters',
        'Bewahre den Impfpass und die Termine der nächsten Auffrischungen auf',
        'medium',
      ],
      [
        'Ask the vet for a yearly plan: vaccination, worms, fleas',
        'Frag den Tierarzt nach einem Jahresplan: Impfung, Würmer, Flöhe',
        'medium',
      ],
      [
        'Put a small amount aside each month for the pet',
        'Leg jeden Monat einen kleinen Betrag fürs Tier zurück',
        'low',
      ],
    ],
    tip: [
      'tip',
      'A small monthly pet fund of 20 or 30 euros turns the next vet bill from a shock into a withdrawal, and it costs less than most pet insurances.',
      'Ein kleiner monatlicher Tierfonds von 20 oder 30 Euro macht aus der nächsten Tierarztrechnung eine Entnahme statt eines Schocks, und er kostet weniger als die meisten Tierversicherungen.',
    ],
  }),
  emergencyCard({
    id: 'E55',
    tier: 'spark',
    category: 'social',
    type: 'fixed',
    payment: 'pay_now',
    title: ['A Round for the Team', 'Eine Runde fürs Team'],
    story: [
      'Your promotion has been noticed. The whole office is standing at the bar, looking at you with kind eyes.',
      'Deine Beförderung hat sich herumgesprochen. Das ganze Büro steht an der Bar und sieht dich mit freundlichen Augen an.',
    ],
    description: [
      'Social costs are real money that no budget lists: a round for the team, a leaving present, a birthday cake. The sums are small, but ten of them a year are a month of groceries. A small social budget makes it easy to say yes without stress.',
      'Soziale Kosten sind echtes Geld, das kein Budget aufführt: eine Runde fürs Team, ein Abschiedsgeschenk, ein Geburtstagskuchen. Die Summen sind klein, aber zehn davon im Jahr sind ein Monat Lebensmittel. Ein kleines Sozialbudget macht es leicht, ohne Stress Ja zu sagen.',
    ],
    buckets: [
      [
        'The round',
        'Die Runde',
        40,
        'A round for eight people costs about 30-60 in a pub; a cake or snacks at the office about 15-25.',
        'Eine Runde für acht Personen kostet in einer Kneipe etwa 30-60; ein Kuchen oder Snacks im Büro etwa 15-25.',
      ],
    ],
    links: [FINANZTIP],
    actions: [
      [
        'Say yes: these moments matter for a team',
        'Sag Ja: diese Momente zählen für ein Team',
        'medium',
      ],
      [
        'Set a small monthly budget for social costs, so it never feels like a loss',
        'Leg ein kleines Monatsbudget für soziale Kosten fest, damit es sich nie wie ein Verlust anfühlt',
        'low',
      ],
      [
        'Offer a cheaper form: a cake at the office instead of a bar',
        'Biete eine günstigere Form an: ein Kuchen im Büro statt einer Bar',
        'low',
      ],
    ],
    tip: [
      'tip',
      'A budget line for "small joys" of 20 to 40 a month is not a luxury: it keeps the big plan alive, because nobody can save when every friendly moment feels like a cost.',
      'Eine Budgetzeile für "kleine Freuden" von 20 bis 40 im Monat ist kein Luxus: sie hält den großen Plan am Leben, denn niemand kann sparen, wenn sich jeder freundliche Moment wie Kosten anfühlt.',
    ],
  }),
  emergencyCard({
    id: 'E57',
    tier: 'spark',
    category: 'family',
    type: 'fixed',
    payment: 'plan_ok',
    needs: { kidsAtLeast: 1 },
    title: ['Three Birthday Parties in One Month', 'Drei Kindergeburtstage in einem Monat'],
    story: [
      'The class group chat explodes: three invitations, three presents, and a child who wants a very particular dinosaur.',
      'Der Klassenchat explodiert: drei Einladungen, drei Geschenke und ein Kind, das einen ganz bestimmten Dinosaurier will.',
    ],
    description: [
      "Children's parties bring presents, cakes and a lot of small costs. A shared budget per present, and a plan with the other parents, keeps it cheap. Children rarely care about the price.",
      'Kindergeburtstage bringen Geschenke, Kuchen und viele kleine Kosten. Ein festes Budget pro Geschenk und eine Absprache mit den anderen Eltern hält es günstig. Kindern ist der Preis selten wichtig.',
    ],
    buckets: [
      [
        'Presents and a cake',
        'Geschenke und ein Kuchen',
        55,
        'A present of 10-20 each, a cake or a small contribution for a party 10-15. Group presents among parents are cheaper.',
        'Ein Geschenk von je 10-20, ein Kuchen oder ein kleiner Beitrag zur Feier 10-15. Gemeinsame Geschenke unter Eltern sind günstiger.',
      ],
    ],
    links: [FINANZTIP],
    actions: [
      [
        'Agree a price limit for presents with the other parents',
        'Vereinbare mit den anderen Eltern ein Preislimit für Geschenke',
        'medium',
      ],
      [
        'Keep a small stock of gifts at home for the dates that come up',
        'Halte einen kleinen Vorrat an Geschenken zu Hause für Termine, die sich ergeben',
        'low',
      ],
      [
        'Make the cake yourself: it is a gift in itself',
        'Back den Kuchen selbst: er ist selbst ein Geschenk',
        'low',
      ],
    ],
    tip: [
      'tip',
      "Buy presents for children's parties when they are on sale and keep a small box: a gift at 8 euros bought in advance beats one at 20 in a hurry.",
      'Kauf Geschenke für Kindergeburtstage im Angebot und halte eine kleine Kiste bereit: ein Geschenk für 8 Euro im Voraus schlägt eines für 20 in Eile.',
    ],
  }),
  emergencyCard({
    id: 'E64',
    tier: 'flame',
    category: 'social',
    type: 'multi',
    payment: 'plan_ok',
    title: ['A Wedding Invitation', 'Eine Hochzeitseinladung'],
    story: [
      'Your best friend gets married in another city. It is a beautiful invitation. It does not say what it will cost you.',
      'Dein bester Freund heiratet in einer anderen Stadt. Es ist eine schöne Einladung. Sie sagt nicht, was sie dich kosten wird.',
    ],
    description: [
      'As a wedding guest you pay a present, an outfit, the way there and often a night in a hotel. It is easy to spend 500 without meaning to. Agree a limit before you say yes, and share a room or a ride with other guests.',
      'Als Hochzeitsgast zahlst du ein Geschenk, ein Outfit, die Anreise und oft eine Hotelnacht. Es ist leicht, 500 auszugeben, ohne es zu wollen. Leg vor der Zusage ein Limit fest und teil dir ein Zimmer oder eine Fahrt mit anderen Gästen.',
    ],
    buckets: [
      [
        'The present',
        'Das Geschenk',
        150,
        'Many guides suggest 50-100 per guest, more for family and close friends. A group present with other friends is cheaper per head.',
        'Viele Ratgeber nennen 50-100 pro Gast, mehr für Familie und enge Freunde. Ein Gruppengeschenk mit anderen Freunden ist pro Kopf günstiger.',
      ],
      [
        'An outfit',
        'Ein Outfit',
        120,
        'A suit or a dress for a wedding costs 80-250; borrowing or buying second-hand saves half.',
        'Ein Anzug oder Kleid für eine Hochzeit kostet 80-250; Leihen oder Gebrauchtkaufen spart die Hälfte.',
      ],
      [
        'Travel and a night',
        'Anreise und eine Nacht',
        220,
        "A train ticket 40-120 and a hotel night 80-150. Share a room with a friend, or look for a place with the wedding's special rate.",
        'Eine Zugfahrkarte 40-120 und eine Hotelnacht 80-150. Teil dir ein Zimmer mit einem Freund oder such eine Unterkunft mit dem Hochzeitstarif.',
        [
          elink(
            'Deutsche Bahn – saver fares',
            'Deutsche Bahn – Sparpreise',
            'https://www.bahn.de/',
          ),
        ],
      ],
    ],
    links: [FINANZTIP],
    actions: [
      [
        'Set your own limit before you say yes, and tell no one the sum',
        'Leg vor der Zusage dein eigenes Limit fest und nenn niemandem die Summe',
        'medium',
      ],
      [
        'Ask other guests for a shared room, a ride or a group present',
        'Frag andere Gäste nach einem gemeinsamen Zimmer, einer Mitfahrt oder einem Gruppengeschenk',
        'medium',
      ],
      [
        'Book the train early: the saver fares are gone fast',
        'Buch den Zug früh: die Sparpreise sind schnell weg',
        'low',
      ],
    ],
    tip: [
      'tip',
      'A heartfelt gift of your time - a speech, a photo book, helping on the day - is often more remembered than money, and it costs you less.',
      'Ein herzliches Geschenk deiner Zeit - eine Rede, ein Fotobuch, Hilfe am Tag selbst - bleibt oft mehr in Erinnerung als Geld, und es kostet dich weniger.',
    ],
  }),
  emergencyCard({
    id: 'E65',
    tier: 'flame',
    category: 'health_pet',
    type: 'fixed',
    payment: 'plan_ok',
    requires: 'pet',
    title: ['A Pet Sitter at Short Notice', 'Tierbetreuung auf die Schnelle'],
    story: [
      'A work trip that cannot be moved, and the neighbour who always helps is on holiday. The animal needs somebody for a week.',
      'Eine Dienstreise, die sich nicht verschieben lässt, und der Nachbar, der sonst immer hilft, ist im Urlaub. Das Tier braucht eine Woche lang jemanden.',
    ],
    description: [
      'A boarding place or a pet sitter at short notice costs more than one booked early. A trusted friend or a pet-sitting network can be cheaper and kinder. A list of two or three people you can call is the cheapest cover.',
      'Eine Tierpension oder ein Tiersitter kurzfristig kostet mehr als einer, der früh gebucht wird. Ein vertrauter Freund oder ein Tiersitter-Netzwerk kann günstiger und netter sein. Eine Liste mit zwei oder drei Menschen, die du anrufen kannst, ist die günstigste Absicherung.',
    ],
    buckets: [
      [
        'Boarding or a sitter for a week',
        'Pension oder Sitter für eine Woche',
        320,
        'A boarding place for a cat or a dog costs about 15-35 a day; a sitter who comes to your home 15-30 per visit. Last-minute booking can cost more.',
        'Eine Pension für Katze oder Hund kostet etwa 15-35 am Tag; ein Sitter, der zu dir nach Hause kommt, 15-30 pro Besuch. Eine Last-Minute-Buchung kann mehr kosten.',
        [TIERARZT],
      ],
    ],
    links: [TIERARZT],
    actions: [
      [
        'Ask friends and neighbours first; offer to return the favour',
        'Frag zuerst Freunde und Nachbarn; biete an, den Gefallen zurückzugeben',
        'high',
      ],
      [
        'Visit a boarding place before you leave the animal there',
        'Besuch eine Pension, bevor du das Tier dort lässt',
        'medium',
      ],
      [
        "Keep a list of two sitters and the vet's number ready for next time",
        'Halte für das nächste Mal eine Liste mit zwei Sittern und der Nummer des Tierarztes bereit',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Book boarding places for the holiday seasons months ahead: the good ones are full at Christmas and in the summer.',
      'Buch Tierpensionen für die Ferienzeiten Monate im Voraus: die guten sind an Weihnachten und im Sommer voll.',
    ],
  }),
  emergencyCard({
    id: 'E66',
    tier: 'flame',
    category: 'social',
    type: 'dice',
    payment: 'pay_now',
    needs: { location: ['other_city', 'abroad_europe', 'other_continent'] },
    title: ['Home for a Family Emergency', 'Heim wegen eines Notfalls in der Familie'],
    story: [
      'The phone rings at night: your grandmother is in hospital. You are not at home, and the next day you want to be.',
      'Nachts klingelt das Telefon: deine Großmutter ist im Krankenhaus. Du bist nicht zu Hause, und am nächsten Tag willst du es sein.',
    ],
    description: [
      'When something happens at home and you live far away, the way back costs money at the worst moment: a last-minute ticket is the most expensive kind. The further you live, the more it costs. Tell your employer at once: close family emergencies often give you the right to a few days off.',
      'Wenn zu Hause etwas passiert und du weit weg wohnst, kostet der Weg zurück Geld im schlechtesten Moment: ein Last-Minute-Ticket ist die teuerste Art. Je weiter du wohnst, desto mehr kostet es. Sag es sofort deinem Arbeitgeber: bei engen Familiennotfällen hast du oft Anspruch auf ein paar freie Tage.',
    ],
    dice: [
      [1, 3, 150],
      [4, 5, 450],
      [6, 6, 1400],
    ],
    buckets: [
      [
        'The journey home',
        'Die Reise nach Hause',
        150,
        'The die is the distance and the price: 1-3 a train or a bus within the country (150), 4-5 a flight within Europe at short notice (450), 6 an intercontinental flight (1,400).',
        'Der Würfel ist Entfernung und Preis: 1-3 Zug oder Bus im Land (150), 4-5 ein Flug in Europa kurzfristig (450), 6 ein Interkontinentalflug (1.400).',
        [
          elink(
            'Skyscanner – compare flights',
            'Skyscanner – Flüge vergleichen',
            'https://www.skyscanner.net/',
          ),
        ],
      ],
    ],
    links: [
      elink(
        'Skyscanner – compare flights',
        'Skyscanner – Flüge vergleichen',
        'https://www.skyscanner.net/',
      ),
    ],
    actions: [
      [
        'Tell your employer and ask for days off for the family emergency',
        'Sag es deinem Arbeitgeber und bitte um freie Tage für den Familiennotfall',
        'high',
      ],
      [
        'Compare train, coach and flights, also from a bigger airport nearby',
        'Vergleiche Zug, Bus und Flüge, auch von einem größeren Flughafen in der Nähe',
        'medium',
      ],
      [
        'Keep a small reserve for the day you have to go home at once',
        'Halte eine kleine Rücklage für den Tag bereit, an dem du sofort heim musst',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Some airlines have a bereavement or an emergency fare, and a short phone call to them is often cheaper than the web fare: ask. A paid day off for a close family emergency can be part of your contract.',
      'Manche Fluggesellschaften haben einen Trauer- oder Notfalltarif, und ein kurzer Anruf ist oft günstiger als der Webpreis: frag nach. Ein bezahlter freier Tag für einen engen Familiennotfall kann Teil deines Vertrags sein.',
    ],
  }),
  emergencyCard({
    id: 'E67',
    tier: 'flame',
    category: 'family',
    type: 'fixed',
    payment: 'plan_ok',
    needs: { kidsAtLeast: 1 },
    title: ["The Child's Glasses Break", 'Die Brille des Kindes geht kaputt'],
    story: [
      'A game of football at the playground, a hard ball, and the glasses lie in two pieces. The child can hardly see the board at school.',
      'Ein Fußballspiel auf dem Spielplatz, ein harter Ball, und die Brille liegt in zwei Teilen. Das Kind kann die Tafel in der Schule kaum erkennen.',
    ],
    description: [
      "For children up to 18 the statutory insurance pays the lenses, but not the frame. A sturdy children's frame is the part you pay. Choose a model with a flexible frame and a guarantee against breaking: children do not stop playing.",
      'Für Kinder bis 18 zahlt die gesetzliche Kasse die Gläser, aber nicht die Fassung. Eine robuste Kinderfassung ist der Teil, den du zahlst. Wähl ein Modell mit flexibler Fassung und einer Garantie gegen Bruch: Kinder hören nicht auf zu spielen.',
    ],
    buckets: [
      [
        'The frame and extras',
        'Fassung und Extras',
        200,
        "A children's frame costs about 60-200; some opticians include a free replacement in the first year. The lenses are paid by the insurer with a prescription.",
        'Eine Kinderfassung kostet etwa 60-200; manche Optiker schließen im ersten Jahr einen kostenlosen Ersatz ein. Die Gläser zahlt die Kasse mit einem Rezept.',
        [BMG],
      ],
    ],
    links: [BMG, TEST],
    actions: [
      [
        "Ask the optician for a children's frame with a guarantee against breaking",
        'Frag den Optiker nach einer Kinderfassung mit Garantie gegen Bruch',
        'high',
      ],
      [
        'Ask the doctor for a new prescription: the lenses are paid by the insurer',
        'Lass dir vom Arzt ein neues Rezept geben: die Gläser zahlt die Kasse',
        'medium',
      ],
      [
        'Keep an old pair as a spare for emergencies',
        'Halte eine alte Brille als Reserve für Notfälle bereit',
        'low',
      ],
    ],
    tip: [
      'tip',
      'Sports glasses with a strap cost a little more but survive football and a fall: for a child who plays hard, they are the cheaper choice.',
      'Sportbrillen mit Band kosten etwas mehr, überstehen aber Fußball und Stürze: für ein Kind, das hart spielt, sind sie die günstigere Wahl.',
    ],
  }),
  emergencyCard({
    id: 'E68',
    tier: 'flame',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: ['own_flat', 'shared_flat', 'with_partner'] },
    title: ['Mould in the Bathroom', 'Schimmel im Bad'],
    story: [
      'The black spots in the corner of the shower are not dirt. They come back every time you clean them.',
      'Die schwarzen Flecken in der Duschecke sind kein Schmutz. Sie kommen jedes Mal wieder, wenn du putzt.',
    ],
    description: [
      'Mould comes from moisture, and the cause matters: ventilation, or a defect of the building. If it is a defect, the landlord has to repair it and you may reduce the rent. Document everything with photos and write to the landlord.',
      'Schimmel kommt von Feuchtigkeit, und die Ursache zählt: Lüften oder ein Mangel am Gebäude. Ist es ein Mangel, muss ihn der Vermieter beheben, und du darfst die Miete mindern. Dokumentiere alles mit Fotos und schreib dem Vermieter.',
    ],
    buckets: [
      [
        'Cleaning and anti-mould treatment',
        'Reinigung und Schimmelbehandlung',
        180,
        'Anti-mould cleaner and a proper treatment of the wall cost about 30-80 if you do it yourself; a specialist costs 150-400.',
        'Schimmelentferner und eine richtige Behandlung der Wand kosten etwa 30-80, wenn du es selbst machst; ein Fachbetrieb kostet 150-400.',
        [
          elink(
            'German Environment Agency – mould',
            'Umweltbundesamt – Schimmel',
            'https://www.umweltbundesamt.de/',
          ),
        ],
      ],
      [
        'A dehumidifier and ventilation',
        'Ein Luftentfeuchter und Lüftung',
        220,
        'A dehumidifier costs about 120-250; a small extractor fan for the bathroom about 40-100. A hygrometer for 8 shows the humidity.',
        'Ein Luftentfeuchter kostet etwa 120-250; ein kleiner Abluftventilator fürs Bad etwa 40-100. Ein Hygrometer für 8 zeigt die Luftfeuchte.',
      ],
    ],
    links: [
      elink(
        'German Environment Agency – mould',
        'Umweltbundesamt – Schimmel',
        'https://www.umweltbundesamt.de/',
      ),
      MIETERBUND,
    ],
    actions: [
      [
        'Photograph the mould and tell the landlord in writing',
        'Fotografiere den Schimmel und sag es dem Vermieter schriftlich',
        'high',
      ],
      [
        'Ventilate three or four times a day for a few minutes with the window wide open',
        'Lüfte drei- bis viermal am Tag einige Minuten mit weit geöffnetem Fenster',
        'high',
      ],
      [
        "Ask your tenants' association whether you may reduce the rent",
        'Frag deinen Mieterverein, ob du die Miete mindern darfst',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A hygrometer for 8 euros tells you the truth: the humidity of a flat should stay between 40 and 60 percent. Above 60 for days is where mould starts.',
      'Ein Hygrometer für 8 Euro sagt dir die Wahrheit: die Luftfeuchte einer Wohnung sollte zwischen 40 und 60 Prozent bleiben. Über 60 für Tage ist der Punkt, an dem Schimmel beginnt.',
    ],
  }),
  emergencyCard({
    id: 'E75',
    tier: 'blaze',
    category: 'health_pet',
    type: 'multi',
    payment: 'plan_ok',
    requires: 'pet',
    afterEffect: {
      monthly: 45,
      months: 12,
      line: ['Special food and medicine for the pet', 'Spezialfutter und Medizin fürs Tier'],
    },
    title: ['The Pet Has a Chronic Illness', 'Das Tier ist chronisch krank'],
    story: [
      'The vet has a long face. It is a diagnosis you cannot cure, only manage: for years, with a pill, a diet and a check.',
      'Der Tierarzt macht ein langes Gesicht. Es ist eine Diagnose, die man nicht heilen, nur behandeln kann: über Jahre, mit einer Tablette, einer Diät und Kontrollen.',
    ],
    description: [
      'A chronic illness of a pet - diabetes, kidneys, a heart - means tests first and costs every month after. The decision is hard: it is about the animal and your budget. A pet health insurance or a pet fund makes it a choice of the heart, not of the purse.',
      'Eine chronische Erkrankung eines Tieres - Diabetes, Nieren, Herz - bedeutet erst Untersuchungen und danach jeden Monat Kosten. Die Entscheidung ist schwer: es geht um das Tier und dein Budget. Eine Tierkrankenversicherung oder ein Tierfonds macht daraus eine Entscheidung des Herzens, nicht des Geldbeutels.',
    ],
    buckets: [
      [
        'Diagnosis and tests',
        'Diagnose und Untersuchungen',
        450,
        'Blood tests, ultrasound and a specialist cost about 300-700.',
        'Blutuntersuchungen, Ultraschall und ein Facharzt kosten etwa 300-700.',
        [TIERARZT],
      ],
      [
        'The first treatment',
        'Die erste Behandlung',
        350,
        'A first stay, the first medicines and the set-up of the diet: about 250-500.',
        'Ein erster Aufenthalt, die ersten Medikamente und die Einstellung der Diät: etwa 250-500.',
      ],
    ],
    links: [TIERARZT, VZ],
    actions: [
      [
        'Ask the vet for all options and the monthly costs of each in writing',
        'Frag den Tierarzt nach allen Möglichkeiten und den Monatskosten jeder schriftlich',
        'high',
      ],
      [
        'Compare a pet health insurance for the next animal, it must be taken out young',
        'Vergleiche eine Tierkrankenversicherung für das nächste Tier, sie muss jung abgeschlossen werden',
        'medium',
      ],
      [
        'Ask about a payment plan at the vet; many offer one',
        'Frag den Tierarzt nach einer Ratenzahlung; viele bieten sie an',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Pet health insurance does not pay for an illness that is already known, so it is best taken out when the animal is young and healthy. Check the yearly limit and the waiting time.',
      'Eine Tierkrankenversicherung zahlt keine bereits bekannte Krankheit, man schließt sie deshalb am besten ab, wenn das Tier jung und gesund ist. Prüf das Jahreslimit und die Wartezeit.',
    ],
  }),
  emergencyCard({
    id: 'E76',
    tier: 'blaze',
    category: 'family',
    type: 'multi',
    payment: 'plan_ok',
    needs: { kidsAtLeast: 1 },
    title: ['The Daycare Is Closed for Two Weeks', 'Die Kita ist zwei Wochen geschlossen'],
    story: [
      'A letter: the daycare is closed for two weeks, staff shortage. Your boss has a project. The child has no other place.',
      'Ein Brief: die Kita ist zwei Wochen geschlossen, Personalmangel. Dein Chef hat ein Projekt. Das Kind hat keinen anderen Platz.',
    ],
    description: [
      'A closed daycare is a bill without a name: a nanny or a babysitter, unpaid days off, a missed shift. There is no pay from the state for a closure, so you plan it yourself. Ask about flexible hours or work from home, and share the days with the other parent or friends.',
      'Eine geschlossene Kita ist eine Rechnung ohne Namen: Nanny oder Babysitter, unbezahlte freie Tage, eine ausgefallene Schicht. Für eine Schließung zahlt der Staat nichts, du planst es selbst. Frag nach flexiblen Zeiten oder Homeoffice und teil die Tage mit dem anderen Elternteil oder Freunden.',
    ],
    buckets: [
      [
        'An emergency nanny for two weeks',
        'Eine Notfall-Betreuung für zwei Wochen',
        600,
        'A babysitter costs about 12-18 an hour; a few mornings a week from a trusted student or a neighbour is cheaper than a service.',
        'Ein Babysitter kostet etwa 12-18 die Stunde; einige Vormittage in der Woche von einer vertrauten Studentin oder einem Nachbarn sind günstiger als ein Dienst.',
      ],
      [
        'Lost pay and unpaid days',
        'Verlorener Lohn und unbezahlte Tage',
        350,
        'Days off without pay, or a reduced shift. Ask your employer first about flexible hours.',
        'Freie Tage ohne Lohn oder eine gekürzte Schicht. Frag zuerst deinen Arbeitgeber nach flexiblen Zeiten.',
        [FINANZTIP],
      ],
    ],
    links: [FINANZTIP],
    actions: [
      [
        'Ask your employer about flexible hours or work from home for the weeks',
        'Frag deinen Arbeitgeber für diese Wochen nach flexiblen Zeiten oder Homeoffice',
        'high',
      ],
      [
        'Ask other parents of the daycare to share the care by turns',
        'Bitte andere Eltern der Kita, die Betreuung abwechselnd zu teilen',
        'high',
      ],
      [
        'Ask the town about an emergency care place',
        'Frag die Stadt nach einem Notbetreuungsplatz',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A small network of two or three families who help each other with care is worth more than any one-day service. Build it before you need it.',
      'Ein kleines Netz aus zwei oder drei Familien, die sich bei der Betreuung helfen, ist mehr wert als jeder Eintagesdienst. Bau es auf, bevor du es brauchst.',
    ],
  }),
  emergencyCard({
    id: 'E77',
    tier: 'blaze',
    category: 'income',
    type: 'multi',
    payment: 'plan_ok',
    needs: { education: true },
    title: ['An Unpaid Internship Month', 'Ein unbezahlter Praktikumsmonat'],
    story: [
      'The internship is a great chance for your CV. It starts next month and pays nothing. The rent does not know that.',
      'Das Praktikum ist eine große Chance für den Lebenslauf. Es beginnt nächsten Monat und zahlt nichts. Die Miete weiß das nicht.',
    ],
    description: [
      'A compulsory internship of a study can be unpaid, and a voluntary one of more than three months must be paid at least the minimum wage. For the weeks that are unpaid you pay the rent, the travel and the clothes yourself. Plan it like a course: it is a cost for a future income.',
      'Ein Pflichtpraktikum im Studium darf unbezahlt sein, und ein freiwilliges von mehr als drei Monaten muss mindestens mit dem Mindestlohn bezahlt werden. Für die unbezahlten Wochen zahlst du Miete, Fahrten und Kleidung selbst. Plan es wie einen Kurs: es sind Kosten für ein künftiges Einkommen.',
    ],
    buckets: [
      [
        'Living without pay for a month',
        'Ein Monat Leben ohne Lohn',
        500,
        'Rent, food and insurance for a month: a student budget is about 800-1,100; this is the part that is not covered by other income.',
        'Miete, Essen und Versicherung für einen Monat: ein Studentenbudget liegt bei etwa 800-1.100; das ist der Teil, den kein anderes Einkommen deckt.',
      ],
      [
        'Travel and clothes',
        'Fahrten und Kleidung',
        200,
        'A monthly pass 50-80, a business outfit 80-150.',
        'Eine Monatskarte 50-80, ein Business-Outfit 80-150.',
      ],
    ],
    links: [
      elink(
        'Federal Ministry of Labour – minimum wage and internships',
        'Bundesarbeitsministerium – Mindestlohn und Praktikum',
        'https://www.bmas.de/',
      ),
      elink(
        'Studierendenwerke – student services',
        'Deutsches Studierendenwerk',
        'https://www.studierendenwerke.de/',
      ),
    ],
    actions: [
      [
        'Ask whether the internship pays at least a small allowance, even if it is not required',
        'Frag, ob das Praktikum wenigstens eine kleine Vergütung zahlt, auch wenn sie nicht vorgeschrieben ist',
        'high',
      ],
      [
        'Check a grant or a student loan for the months of the internship',
        'Prüf ein Stipendium oder ein Studiendarlehen für die Monate des Praktikums',
        'medium',
      ],
      [
        'Check the rule: a voluntary internship over three months needs the minimum wage',
        'Prüf die Regel: ein freiwilliges Praktikum über drei Monate braucht den Mindestlohn',
        'medium',
      ],
    ],
    tip: [
      'fact',
      'In Germany a voluntary internship of more than three months has to be paid at least the minimum wage; a compulsory one of a study and one of up to three months can be unpaid.',
      'In Deutschland muss ein freiwilliges Praktikum von mehr als drei Monaten mindestens mit dem Mindestlohn bezahlt werden; ein Pflichtpraktikum im Studium und eines bis zu drei Monaten dürfen unbezahlt sein.',
    ],
  }),
  emergencyCard({
    id: 'E78',
    tier: 'blaze',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    needs: { relationship: ['cohabiting', 'married'] },
    title: ['The Partner Moves Out', 'Der Partner zieht aus'],
    story: [
      'A long talk and two suitcases. The flat is big for one person, and the rent was always for two.',
      'Ein langes Gespräch und zwei Koffer. Die Wohnung ist groß für eine Person, und die Miete war immer für zwei.',
    ],
    description: [
      'A break-up in a shared flat leaves one rent for one salary. If both are in the lease, both are liable for the whole rent until the landlord releases one. Talk to the landlord early about a new contract or a sub-tenant, and split what belongs to whom.',
      'Eine Trennung in einer gemeinsamen Wohnung lässt eine Miete für ein Gehalt zurück. Stehen beide im Mietvertrag, haften beide für die ganze Miete, bis der Vermieter einen entlässt. Sprich früh mit dem Vermieter über einen neuen Vertrag oder einen Untermieter und teilt auf, was wem gehört.',
    ],
    buckets: [
      [
        'The whole rent for three months',
        'Die ganze Miete für drei Monate',
        1200,
        'Half the rent that your partner paid, for the time you need to find a sub-tenant or a smaller flat: about three months.',
        'Die Hälfte der Miete, die dein Partner gezahlt hat, für die Zeit, die du für einen Untermieter oder eine kleinere Wohnung brauchst: etwa drei Monate.',
        [MIETERBUND],
      ],
      [
        'Splitting contracts and things',
        'Verträge und Dinge aufteilen',
        300,
        'Internet, electricity and the furniture you have to buy again: about 200-500.',
        'Internet, Strom und die Möbel, die du neu kaufen musst: etwa 200-500.',
      ],
    ],
    links: [MIETERBUND, FINANZTIP],
    actions: [
      [
        'Talk to the landlord about a new lease for one person or a sub-tenant',
        'Sprich mit dem Vermieter über einen neuen Mietvertrag für eine Person oder einen Untermieter',
        'high',
      ],
      [
        'Split the contracts and the joint accounts in writing',
        'Teil Verträge und gemeinsame Konten schriftlich auf',
        'high',
      ],
      [
        'Ask friends for help: a break-up is not a moment to be alone',
        'Bitte Freunde um Hilfe: eine Trennung ist kein Moment, um allein zu sein',
        'low',
      ],
    ],
    tip: [
      'tip',
      'As long as both names are in the lease, the landlord can ask either of you for the full rent. Agree in writing who pays what and ask for a release of the one who moves out.',
      'Solange beide Namen im Mietvertrag stehen, kann der Vermieter von jedem von euch die volle Miete verlangen. Vereinbart schriftlich, wer was zahlt, und bitte um die Entlassung dessen, der auszieht.',
    ],
  }),
  emergencyCard({
    id: 'E79',
    tier: 'blaze',
    category: 'home',
    type: 'fixed',
    payment: 'plan_ok',
    needs: { home: ['own_flat', 'shared_flat', 'with_partner'] },
    insurance: 'household',
    deductible: 150,
    title: ['Lightning Strikes: Electronics Fried', 'Blitzeinschlag: Elektronik gegrillt'],
    story: [
      'A flash, a bang, and the smell of burnt plastic. The television, the router and the laptop charger are dead.',
      'Ein Blitz, ein Knall und der Geruch von verbranntem Plastik. Fernseher, Router und Laptop-Ladegerät sind tot.',
    ],
    description: [
      'A voltage surge from a nearby lightning strike can destroy several devices at once. Many household policies pay it, with a deductible; check your terms for "surge damage". A cheap surge protector helps in some cases but is no guarantee.',
      'Eine Überspannung durch einen nahen Blitzeinschlag kann mehrere Geräte auf einmal zerstören. Viele Hausratpolicen zahlen sie, mit Selbstbeteiligung; prüf deine Bedingungen auf "Überspannungsschäden". Ein günstiger Überspannungsschutz hilft in manchen Fällen, ist aber keine Garantie.',
    ],
    insuranceNote: [
      'Many household policies pay surge damage after a lightning strike: the replacement minus a deductible of about 150. Without one, you pay all.',
      'Viele Hausratpolicen zahlen Überspannungsschäden nach einem Blitzschlag: den Ersatz abzüglich einer Selbstbeteiligung von etwa 150. Ohne eine zahlst du alles.',
    ],
    buckets: [
      [
        'Television, router and charger',
        'Fernseher, Router und Ladegerät',
        1200,
        'A mid-range television 350-700, a router 80-150, other devices 100-300. Keep the receipts and photograph the damage.',
        'Ein Fernseher der Mittelklasse 350-700, ein Router 80-150, andere Geräte 100-300. Bewahre die Belege auf und fotografiere den Schaden.',
        [GDV],
      ],
    ],
    links: [GDV, TEST],
    actions: [
      [
        'Switch off and unplug everything damaged, and photograph the damage',
        'Schalte alles Beschädigte aus und zieh die Stecker, und fotografiere den Schaden',
        'high',
      ],
      [
        'Report to the household insurer with the receipts and the date of the storm',
        'Melde es der Hausratversicherung mit Belegen und dem Datum des Gewitters',
        'high',
      ],
      [
        'Check whether a surge-protected socket strip is a good idea for your devices',
        'Prüf, ob eine Steckerleiste mit Überspannungsschutz für deine Geräte sinnvoll ist',
        'low',
      ],
    ],
    tip: [
      'tip',
      'In a thunderstorm unplug the aerial and the router, not only the plug: a surge also comes through the cable. A strike nearby, not a direct hit, causes most damage.',
      'Zieh bei einem Gewitter Antennen- und Routerstecker, nicht nur den Netzstecker: eine Überspannung kommt auch durchs Kabel. Ein Einschlag in der Nähe, nicht ein direkter Treffer, verursacht die meisten Schäden.',
    ],
  }),
  emergencyCard({
    id: 'E82',
    tier: 'blaze',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: 'with_parents' },
    title: ["Moving Out of the Parents' House", 'Auszug aus dem Elternhaus'],
    story: [
      'You found a flat. A small one, but your own. It comes with a deposit, an empty kitchen and a very expensive first week.',
      'Du hast eine Wohnung gefunden. Eine kleine, aber deine eigene. Sie kommt mit einer Kaution, einer leeren Küche und einer sehr teuren ersten Woche.',
    ],
    description: [
      'The first flat costs much more than the rent: a deposit of up to three months, furniture, a kitchen, and the first connection fees. Many parents help, and many things can be bought second-hand or inherited. Make a list of what you need first and what can wait.',
      'Die erste Wohnung kostet viel mehr als die Miete: eine Kaution von bis zu drei Monaten, Möbel, eine Küche und die ersten Anschlussgebühren. Viele Eltern helfen, und vieles lässt sich gebraucht kaufen oder erben. Mach eine Liste, was du zuerst brauchst und was warten kann.',
    ],
    buckets: [
      [
        'The deposit',
        'Die Kaution',
        900,
        "Up to three months' rent (cold) is allowed; you can pay it in three instalments by law.",
        'Bis zu drei Monatskaltmieten sind erlaubt; du darfst sie nach dem Gesetz in drei Raten zahlen.',
        [MIETERBUND],
      ],
      [
        'Basic furniture and kitchen things',
        'Grundmöbel und Küchensachen',
        600,
        'A bed, a table, a wardrobe, a pot and a pan: about 500-900 second-hand, double new. A kitchen is often a separate cost.',
        'Ein Bett, ein Tisch, ein Schrank, ein Topf und eine Pfanne: gebraucht etwa 500-900, neu das Doppelte. Eine Küche ist oft ein eigener Posten.',
      ],
      [
        'Moving and connection fees',
        'Umzug und Anschlussgebühren',
        200,
        'A van for a day 50-100, an internet connection fee 0-80, and the registration of the new address.',
        'Ein Transporter für einen Tag 50-100, eine Internet-Anschlussgebühr 0-80 und die Anmeldung der neuen Adresse.',
      ],
    ],
    links: [MIETERBUND, FINANZTIP],
    actions: [
      [
        'Make a list: what you need on day one and what can wait',
        'Mach eine Liste: was du am ersten Tag brauchst und was warten kann',
        'high',
      ],
      [
        'Ask family and friends for furniture and kitchen things before you buy',
        'Frag Familie und Freunde nach Möbeln und Küchensachen, bevor du kaufst',
        'medium',
      ],
      [
        'Pay the deposit in three instalments if the law allows it in your case',
        'Zahl die Kaution in drei Raten, wenn das Gesetz es in deinem Fall erlaubt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      "You may pay the deposit in three equal monthly instalments by law: it eases the first month a lot. Ask for the deposit account in writing, so it is kept apart from the landlord's money.",
      'Du darfst die Kaution nach dem Gesetz in drei gleichen Monatsraten zahlen: das entlastet den ersten Monat sehr. Lass dir das Kautionskonto schriftlich nennen, damit sie getrennt vom Geld des Vermieters angelegt wird.',
    ],
  }),
  emergencyCard({
    id: 'E89',
    tier: 'wildfire',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: ['own_flat', 'shared_flat', 'with_partner'] },
    insurance: 'household',
    title: ['A Pipe Bursts in Your Flat', 'In deiner Wohnung platzt ein Rohr'],
    story: [
      'A winter night, a cold snap, and a pipe that gave up. By the morning there is water on the floor and a wet sofa.',
      'Eine Winternacht, ein Kälteeinbruch und ein Rohr, das aufgegeben hat. Am Morgen steht Wasser auf dem Boden, und das Sofa ist nass.',
    ],
    description: [
      'Water from a burst pipe damages your furniture, your floor coverings and sometimes the floor itself. The building belongs to the landlord, so his building insurance pays the pipe and the walls; your household insurance pays your things. Turn off the main valve, and tell the landlord at once.',
      'Wasser aus einem geplatzten Rohr beschädigt deine Möbel, deine Bodenbeläge und manchmal den Boden selbst. Das Gebäude gehört dem Vermieter, seine Gebäudeversicherung zahlt also Rohr und Wände; deine Hausrat zahlt deine Sachen. Dreh das Hauptventil zu und sag es sofort dem Vermieter.',
    ],
    insuranceNote: [
      "Household insurance pays tap water damage to your things up to the sum insured; you pay the deductible. The pipe and the walls are for the landlord's building insurance.",
      'Die Hausrat zahlt Leitungswasserschäden an deinen Sachen bis zur Versicherungssumme; du zahlst die Selbstbeteiligung. Rohr und Wände sind Sache der Gebäudeversicherung des Vermieters.',
    ],
    buckets: [
      [
        'Drying and tearing out',
        'Trocknen und Rückbau',
        1400,
        'A drying company for a week costs about 800-2,000; in a rented flat the landlord arranges it for the building parts.',
        'Eine Trocknungsfirma für eine Woche kostet etwa 800-2.000; in einer Mietwohnung veranlasst es der Vermieter für die Gebäudeteile.',
        [GDV],
      ],
      [
        'Furniture and floor coverings',
        'Möbel und Bodenbeläge',
        2600,
        'A sofa, a bed, a carpet and some electrical items: about 1,500-4,000 at the new price with household insurance.',
        'Ein Sofa, ein Bett, ein Teppich und einige Elektrogeräte: etwa 1.500-4.000 zum Neuwert mit der Hausrat.',
      ],
      [
        'Nights elsewhere',
        'Nächte woanders',
        500,
        'A few nights at a hotel or friends while the flat is dried; household insurance often pays the hotel for a limited time.',
        'Einige Nächte im Hotel oder bei Freunden, während die Wohnung getrocknet wird; die Hausrat zahlt das Hotel oft für begrenzte Zeit.',
      ],
    ],
    links: [GDV, VZ],
    actions: [
      [
        'Turn off the main water valve and switch off the power in wet rooms',
        'Dreh das Hauptventil zu und schalte in nassen Räumen den Strom ab',
        'high',
      ],
      [
        'Tell the landlord at once and the household insurer within days',
        'Sag es sofort dem Vermieter und binnen Tagen der Hausratversicherung',
        'high',
      ],
      [
        'Photograph everything before you move or throw anything away',
        'Fotografiere alles, bevor du etwas bewegst oder wegwirfst',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'In a cold snap leave the heating on at a low level and open the cupboard doors under the sink: a pipe in an unheated wall is the first to freeze.',
      'Lass bei einem Kälteeinbruch die Heizung auf niedriger Stufe an und öffne die Türen des Schranks unter der Spüle: ein Rohr in einer ungeheizten Wand friert als erstes ein.',
    ],
  }),
  emergencyCard({
    id: 'E91',
    tier: 'wildfire',
    category: 'liability',
    type: 'dice',
    payment: 'plan_ok',
    requires: 'pet',
    needs: { pet: 'dog' },
    estimate: true,
    title: ['Your Dog Bites a Child', 'Dein Hund beißt ein Kind'],
    story: [
      'A dog that never did harm: a sudden noise, a child with a stick, and a bite. The child cries. The parents are very pale.',
      'Ein Hund, der nie etwas getan hat: ein plötzliches Geräusch, ein Kind mit einem Stock und ein Biss. Das Kind weint. Die Eltern sind sehr blass.',
    ],
    description: [
      'The owner of a dog is liable for what it does, whatever the reason. A dog liability insurance is separate from the private liability, and in many states it is the law. Without it you pay the treatment, the pain money and sometimes a lifelong claim yourself.',
      'Der Halter eines Hundes haftet für das, was er tut, egal aus welchem Grund. Eine Hundehaftpflicht ist von der Privathaftpflicht getrennt, und in vielen Bundesländern ist sie Pflicht. Ohne sie zahlst du Behandlung, Schmerzensgeld und manchmal eine lebenslange Forderung selbst.',
    ],
    dice: [
      [1, 3, 1500],
      [4, 5, 5000],
      [6, 6, 9000],
    ],
    buckets: [
      [
        'Treatment and compensation',
        'Behandlung und Entschädigung',
        1500,
        'The die: 1-3 a small wound and a visit to the doctor (1,500), 4-5 stitches and pain money (5,000), 6 a serious injury with lasting damage (9,000).',
        'Der Würfel: 1-3 eine kleine Wunde und ein Arztbesuch (1.500), 4-5 Nähen und Schmerzensgeld (5.000), 6 eine schwere Verletzung mit Dauerschaden (9.000).',
        [GDV],
      ],
    ],
    links: [GDV, VZ],
    actions: [
      [
        'Help the child first: call 112 if needed, and give your details to the parents',
        'Hilf zuerst dem Kind: ruf bei Bedarf die 112 und gib den Eltern deine Daten',
        'high',
      ],
      [
        'Tell your dog liability insurer at once and do not admit guilt in writing',
        'Melde es sofort deiner Hundehaftpflicht und erkenne keine Schuld schriftlich an',
        'high',
      ],
      [
        'Think about a dog school and a muzzle in a crowd',
        'Denk über eine Hundeschule und einen Maulkorb in der Menge nach',
        'medium',
      ],
    ],
    tip: [
      'fact',
      'In many German states a dog liability insurance is required by law; in others it is strongly advised. It costs only 50 to 100 euros a year and pays several million.',
      'In vielen deutschen Bundesländern ist eine Hundehaftpflicht gesetzlich vorgeschrieben; in anderen wird sie dringend empfohlen. Sie kostet nur 50 bis 100 Euro im Jahr und zahlt mehrere Millionen.',
    ],
  }),
  emergencyCard({
    id: 'E93',
    tier: 'wildfire',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: 'shared_flat' },
    title: ['The Flatmate Is Gone', 'Der Mitbewohner ist weg'],
    story: [
      "The room is empty, the key is on the table, and the flatmate's phone does not answer. The rent for three months is not paid.",
      'Das Zimmer ist leer, der Schlüssel liegt auf dem Tisch, und das Handy des Mitbewohners ist aus. Die Miete für drei Monate ist nicht gezahlt.',
    ],
    description: [
      'In a flat share with one lease all tenants are liable for the whole rent. When one leaves without paying, the others have to cover it. A separate lease for each room is safer. Ask the landlord for a release, and try to recover the money in writing.',
      'In einer WG mit einem Mietvertrag haften alle Mieter für die ganze Miete. Wenn einer ohne zu zahlen geht, müssen die anderen einspringen. Ein eigener Vertrag für jedes Zimmer ist sicherer. Bitte den Vermieter um eine Entlassung und versuch, das Geld schriftlich zurückzuholen.',
    ],
    buckets: [
      [
        'The missing rent for three months',
        'Die fehlende Miete für drei Monate',
        1200,
        "The room's share of the rent for the months that are unpaid. Ask the landlord for a payment plan.",
        'Der Anteil des Zimmers an der Miete für die unbezahlten Monate. Frag den Vermieter nach einer Ratenzahlung.',
        [MIETERBUND],
      ],
      [
        'The deposit and the damages',
        'Die Kaution und die Schäden',
        700,
        'The share of the deposit that has to be filled again, and damages the flatmate left.',
        'Der Anteil der Kaution, der wieder aufgefüllt werden muss, und Schäden, die der Mitbewohner hinterlassen hat.',
      ],
      [
        'The unpaid bills',
        'Die offenen Rechnungen',
        400,
        'A share of electricity, internet and the broadcasting fee that is still in the name of the lease.',
        'Ein Anteil an Strom, Internet und dem Rundfunkbeitrag, der noch auf den Mietvertrag läuft.',
      ],
    ],
    links: [MIETERBUND, VZ],
    actions: [
      [
        'Write a clear message to the flatmate with the sum, and keep a copy',
        'Schreib dem Mitbewohner eine klare Nachricht mit der Summe und behalte eine Kopie',
        'high',
      ],
      [
        'Ask the landlord to release the flatmate and to write a new lease for the room',
        'Bitte den Vermieter, den Mitbewohner zu entlassen und einen neuen Vertrag fürs Zimmer zu schreiben',
        'high',
      ],
      [
        'Look for a new flatmate quickly: an empty room costs every month',
        'Such schnell einen neuen Mitbewohner: ein leeres Zimmer kostet jeden Monat',
        'medium',
      ],
    ],
    tip: [
      'tip',
      "A written flatmate contract with notice periods and who pays what costs nothing and saves a lot of trouble. Ask your tenants' association for a template.",
      'Ein schriftlicher Mitbewohnervertrag mit Kündigungsfristen und der Aufteilung der Kosten kostet nichts und erspart viel Ärger. Frag deinen Mieterverein nach einer Vorlage.',
    ],
  }),
  emergencyCard({
    id: 'E96',
    tier: 'inferno',
    category: 'liability',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: ['own_flat', 'shared_flat', 'with_partner'] },
    insurance: 'liability',
    unique: true,
    estimate: true,
    uninsuredExtra: {
      label: ['Lawyers and court', 'Anwälte und Gericht'],
      amount: 3500,
      notes: [
        'Without a liability insurance you also pay your own lawyer and the court, and the claims of several neighbours.',
        'Ohne Haftpflicht zahlst du auch den eigenen Anwalt und das Gericht und die Forderungen mehrerer Nachbarn.',
      ],
    },
    title: ['The Fire You Caused Spreads', 'Der Brand, den du verursacht hast, breitet sich aus'],
    story: [
      "A candle on the sofa, a forgotten pot, a moment away. The smoke alarm goes. By the time the fire brigade is there, the neighbours' flats are burning too.",
      'Eine Kerze auf dem Sofa, ein vergessener Topf, ein Moment weg. Der Rauchmelder schlägt an. Als die Feuerwehr da ist, brennen auch die Wohnungen der Nachbarn.',
    ],
    description: [
      "When you cause a fire that damages other people's homes, the private liability insurance pays their damage and their rehousing, up to the sum insured. Without it you owe the sum for years or for life: it is the biggest reason why this insurance exists. Make sure the sum insured is at least 10 million.",
      'Wenn du einen Brand verursachst, der fremde Wohnungen beschädigt, zahlt die Privathaftpflicht deren Schäden und die Unterbringung, bis zur Deckungssumme. Ohne sie schuldest du die Summe jahrelang oder lebenslang: es ist der größte Grund, warum es diese Versicherung gibt. Achte darauf, dass die Deckungssumme mindestens 10 Millionen beträgt.',
    ],
    insuranceNote: [
      'The private liability insurance pays the damage to the neighbours and their rehousing; you pay only the deductible. Without it this is the card that can ruin you.',
      'Die Privathaftpflicht zahlt den Schaden bei den Nachbarn und deren Unterbringung; du zahlst nur die Selbstbeteiligung. Ohne sie ist das die Karte, die dich ruinieren kann.',
    ],
    buckets: [
      [
        "Damage to the neighbours' flats",
        'Schäden an den Wohnungen der Nachbarn',
        20000,
        "Repairs after a fire and smoke in two or three flats cost 15,000-60,000 or more; the neighbours' own insurers pay and then claim it from you.",
        'Reparaturen nach Brand und Rauch in zwei oder drei Wohnungen kosten 15.000-60.000 oder mehr; die Versicherer der Nachbarn zahlen und fordern es dann von dir.',
        [GDV],
      ],
      [
        'Housing the neighbours for months',
        'Unterbringung der Nachbarn über Monate',
        6000,
        'Hotels or flats for the neighbours for three to six months while their homes are repaired.',
        'Hotels oder Wohnungen für die Nachbarn für drei bis sechs Monate, während ihre Wohnungen repariert werden.',
      ],
      [
        'Your own flat and things',
        'Deine eigene Wohnung und deine Sachen',
        3000,
        'Your own things are for your household insurance; the part of the damage in the building is for the building insurance.',
        'Deine eigenen Sachen sind Sache deiner Hausrat; der Teil des Schadens im Gebäude ist Sache der Gebäudeversicherung.',
      ],
    ],
    links: [GDV, FINANZTIP],
    actions: [
      [
        'Get out and call 112, and let nobody go back in',
        'Geh raus und ruf die 112, und lass niemanden zurück hinein',
        'high',
      ],
      [
        'Tell the liability insurer at once and do not admit guilt in writing',
        'Melde es sofort der Haftpflichtversicherung und erkenne keine Schuld schriftlich an',
        'high',
      ],
      [
        'After the fire: check that your liability sum insured is at least 10 million',
        'Prüf nach dem Brand, ob deine Haftpflicht-Deckungssumme mindestens 10 Millionen beträgt',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Never leave a candle or a pot unattended, and fit smoke alarms in every bedroom and in the corridor: in Germany they are required, and they give you minutes that matter.',
      'Lass nie eine Kerze oder einen Topf unbeaufsichtigt und bring in jedem Schlafzimmer und im Flur Rauchmelder an: sie sind in Deutschland Pflicht, und sie schenken dir Minuten, die zählen.',
    ],
  }),
  emergencyCard({
    id: 'E98',
    insurance: 'travel',
    deductible: 50,
    insuranceNote: [
      'Travel health insurance pays the hospital, the flight home with a doctor and the journey of a parent; you pay about 50.',
      'Die Auslandsreisekrankenversicherung zahlt Klinik, Rückflug mit Arzt und die Reise eines Elternteils; du zahlst etwa 50.',
    ],
    tier: 'inferno',
    category: 'health',
    type: 'multi',
    payment: 'plan_ok',
    needs: { kidsAtLeast: 1, location: ['abroad_europe', 'other_continent'] },
    unique: true,
    estimate: true,
    title: ['Your Child Is Hurt Abroad', 'Dein Kind verletzt sich im Ausland'],
    story: [
      'A fall from a balcony railing on holiday. The child is alive, awake, and in a foreign hospital where you understand half of what they say.',
      'Ein Sturz vom Balkongeländer im Urlaub. Das Kind lebt, ist wach und liegt in einem fremden Krankenhaus, in dem du die Hälfte verstehst.',
    ],
    description: [
      'A serious accident of a child abroad is the nightmare that a travel health insurance is made for: it pays the hospital, the flight home with a doctor, and the journey of a parent. Without it you pay a foreign hospital and an air ambulance, which can cost tens of thousands.',
      'Ein schwerer Unfall eines Kindes im Ausland ist der Albtraum, für den es die Auslandsreisekrankenversicherung gibt: sie zahlt Klinik, Rückflug mit Arzt und die Reise eines Elternteils. Ohne sie zahlst du ein fremdes Krankenhaus und einen Ambulanzflug, was Zehntausende kosten kann.',
    ],
    buckets: [
      [
        'The hospital abroad',
        'Das Krankenhaus im Ausland',
        7500,
        'A week in a foreign hospital with an operation and intensive care costs 5,000-20,000, depending on the country. Within the EU the health card pays part at local rates.',
        'Eine Woche in einem fremden Krankenhaus mit Operation und Intensivstation kostet 5.000-20.000, je nach Land. Innerhalb der EU zahlt die Gesundheitskarte einen Teil zu örtlichen Sätzen.',
        [AA],
      ],
      [
        'The flight home with a doctor',
        'Der Rückflug mit Arzt',
        9000,
        'An air ambulance or a stretcher flight with a doctor costs 8,000-30,000 depending on the distance.',
        'Ein Ambulanzflug oder Liegendtransport mit Arzt kostet je nach Entfernung 8.000-30.000.',
      ],
      [
        "The parents' travel and hotel",
        'Reise und Hotel der Eltern',
        2500,
        'A hotel near the hospital and a flight for the parent who stays; a travel insurance usually pays them.',
        'Ein Hotel nahe der Klinik und ein Flug für den Elternteil, der bleibt; eine Reiseversicherung zahlt sie meist.',
      ],
    ],
    links: [AA, BMG, VZ],
    actions: [
      [
        'Call the emergency number of your insurer or the German embassy at once',
        'Ruf sofort die Notrufnummer deines Versicherers oder die deutsche Botschaft an',
        'high',
      ],
      [
        'Keep all bills and medical reports; ask for copies in English',
        'Bewahre alle Rechnungen und Arztberichte auf; bitte um Kopien auf Englisch',
        'high',
      ],
      [
        'Before the next trip: take out a family travel health insurance',
        'Schließ vor der nächsten Reise eine Familien-Auslandsreisekrankenversicherung ab',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'A family travel health insurance costs about 20 to 40 euros a year for the whole family and includes the return transport with a doctor. It is the cheapest cover for the most expensive moment of a holiday.',
      'Eine Familien-Auslandsreisekrankenversicherung kostet etwa 20 bis 40 Euro im Jahr für die ganze Familie und schließt den Rücktransport mit Arzt ein. Sie ist die günstigste Absicherung für den teuersten Moment eines Urlaubs.',
    ],
  }),
  emergencyCard({
    id: 'E99',
    tier: 'inferno',
    category: 'home',
    type: 'multi',
    payment: 'plan_ok',
    needs: { home: 'own_flat' },
    unique: true,
    estimate: true,
    title: ['The River Floods the Ground Floor', 'Der Fluss überschwemmt das Erdgeschoss'],
    story: [
      'Three days of rain, then the river rises. At night you hear the water in the stairwell. By the morning it has taken the whole ground floor.',
      'Drei Tage Regen, dann steigt der Fluss. Nachts hörst du das Wasser im Treppenhaus. Am Morgen hat es das ganze Erdgeschoss genommen.',
    ],
    description: [
      'A flood is a natural hazard that a normal household insurance does not pay: you need an extra cover for natural hazards (Elementarschäden). Many people do not have it. Without it you pay the drying, the floors, the furniture and a flat for months. It is the most important lesson of an insurance gap.',
      'Eine Überschwemmung ist ein Elementarschaden, den eine normale Hausratversicherung nicht zahlt: du brauchst eine Zusatzabsicherung gegen Elementarschäden. Viele haben sie nicht. Ohne sie zahlst du Trocknung, Böden, Möbel und eine Wohnung für Monate. Es ist die wichtigste Lektion einer Versicherungslücke.',
    ],
    insuranceNote: [
      "A normal household insurance does not pay a flood: it needs the add-on for natural hazards, which costs only a few euros a month in most areas. It is not part of the game's insurances, so everybody pays here.",
      'Eine normale Hausrat zahlt keine Überschwemmung: sie braucht den Zusatzbaustein für Elementarschäden, der in den meisten Gegenden nur wenige Euro im Monat kostet. Er gehört nicht zu den Versicherungen des Spiels, hier zahlen also alle.',
    ],
    buckets: [
      [
        'Clean-up, drying and disinfection',
        'Aufräumen, Trocknen und Desinfektion',
        4500,
        'After a flood the walls and floors are dried for weeks and often disinfected; a specialist company costs 3,000-8,000 for a flat.',
        'Nach einer Flut werden Wände und Böden wochenlang getrocknet und oft desinfiziert; eine Fachfirma kostet für eine Wohnung 3.000-8.000.',
        [GDV],
      ],
      [
        'Floors, kitchen and furniture',
        'Böden, Küche und Möbel',
        11000,
        'New floors, a kitchen and the furniture of the ground floor: about 8,000-20,000 depending on the flat.',
        'Neue Böden, eine Küche und die Möbel des Erdgeschosses: etwa 8.000-20.000 je nach Wohnung.',
      ],
      [
        'A flat for three months',
        'Eine Wohnung für drei Monate',
        3500,
        'A temporary flat or a hotel while the home is repaired, about 3,000-5,000 for three months.',
        'Eine Übergangswohnung oder ein Hotel, während die Wohnung repariert wird, etwa 3.000-5.000 für drei Monate.',
      ],
    ],
    links: [
      GDV,
      elink(
        'Federal Office for Civil Protection',
        'Bundesamt für Bevölkerungsschutz',
        'https://www.bbk.bund.de/',
      ),
    ],
    actions: [
      [
        'Get to safety first and call 112; do not go into water in a cellar with power',
        'Bring dich zuerst in Sicherheit und ruf die 112; geh nicht in ein Wasser im Keller mit Strom',
        'high',
      ],
      [
        'Photograph the damage and ask the town about a flood aid and a grant',
        'Fotografiere den Schaden und frag die Stadt nach Fluthilfe und Zuschüssen',
        'high',
      ],
      [
        'Afterwards ask your insurer for a natural hazards cover for the next time',
        'Frag danach deinen Versicherer nach einer Elementarschadenabsicherung für das nächste Mal',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'Check the flood risk of your address on the official hazard maps before you rent or buy: a ground-floor flat near a river deserves an extra cover for natural hazards.',
      'Prüf das Hochwasserrisiko deiner Adresse auf den amtlichen Gefahrenkarten, bevor du mietest oder kaufst: eine Erdgeschosswohnung nahe an einem Fluss verdient eine Elementarschadenabsicherung.',
    ],
  }),
  emergencyCard({
    id: 'E100',
    tier: 'inferno',
    category: 'family',
    type: 'multi',
    payment: 'plan_ok',
    needs: { relationship: 'married' },
    unique: true,
    estimate: true,
    afterEffect: {
      monthly: 200,
      months: 24,
      line: ['Two households instead of one', 'Zwei Haushalte statt einem'],
    },
    title: ['A Divorce', 'Eine Scheidung'],
    story: [
      'A long conversation, a year of silence, and then a letter from a lawyer. Two lives that were one have to be taken apart carefully.',
      'Ein langes Gespräch, ein Jahr Schweigen und dann ein Brief von einem Anwalt. Zwei Leben, die eins waren, müssen vorsichtig getrennt werden.',
    ],
    description: [
      'A divorce costs lawyers, the court and a second household. In an agreed divorce one lawyer for the petitioner is enough and it is much cheaper than a fight. Legal protection insurance usually does not pay for family law. The costs are only part of it: take the time and take advice.',
      'Eine Scheidung kostet Anwälte, das Gericht und einen zweiten Haushalt. Bei einer einvernehmlichen Scheidung reicht ein Anwalt für den Antragsteller und es ist viel günstiger als ein Streit. Die Rechtsschutz zahlt für Familienrecht meist nicht. Die Kosten sind nur ein Teil: nimm dir Zeit und Rat.',
    ],
    insuranceNote: [
      'Legal protection insurance usually does not cover divorce and family law: here you pay yourself. A divorce by agreement with one lawyer is the cheapest way.',
      'Die Rechtsschutzversicherung deckt Scheidung und Familienrecht meist nicht: hier zahlst du selbst. Eine einvernehmliche Scheidung mit einem Anwalt ist der günstigste Weg.',
    ],
    buckets: [
      [
        'Lawyers',
        'Anwälte',
        3500,
        'A lawyer for a divorce by agreement costs about 1,500-3,000; a contested divorce with two lawyers and many questions 4,000-10,000.',
        'Ein Anwalt für eine einvernehmliche Scheidung kostet etwa 1.500-3.000; eine streitige Scheidung mit zwei Anwälten und vielen Fragen 4.000-10.000.',
        [elink('Federal Ministry of Justice', 'Bundesjustizministerium', 'https://www.bmj.de/')],
      ],
      [
        'Court costs',
        'Gerichtskosten',
        1500,
        'Court costs depend on the incomes of both and on the pension adjustment: about 800-2,500.',
        'Die Gerichtskosten hängen von den Einkommen beider und vom Versorgungsausgleich ab: etwa 800-2.500.',
      ],
      [
        'A second flat',
        'Eine zweite Wohnung',
        5500,
        'A deposit, a move and the first furniture for one of you: about 4,000-8,000.',
        'Eine Kaution, ein Umzug und die ersten Möbel für einen von euch: etwa 4.000-8.000.',
      ],
      [
        'Splitting the finances',
        'Die Finanzen trennen',
        800,
        'A tax advisor or a financial advisor for the split of accounts, a house and pensions: about 500-1,500.',
        'Ein Steuer- oder Finanzberater für die Aufteilung von Konten, Haus und Renten: etwa 500-1.500.',
        [FINANZTIP],
      ],
    ],
    links: [
      elink('Federal Ministry of Justice', 'Bundesjustizministerium', 'https://www.bmj.de/'),
      FINANZTIP,
    ],
    actions: [
      [
        'Ask a mediator or a family counselling service before you go to lawyers',
        'Frag einen Mediator oder eine Familienberatung, bevor ihr zu Anwälten geht',
        'high',
      ],
      [
        'Make a list of all joint accounts, contracts, debts and things',
        'Mach eine Liste aller gemeinsamen Konten, Verträge, Schulden und Dinge',
        'high',
      ],
      [
        'Open an account of your own and take care of insurances and the will',
        'Eröffne ein eigenes Konto und kümmere dich um Versicherungen und das Testament',
        'medium',
      ],
    ],
    tip: [
      'tip',
      'In an agreed divorce, one lawyer who represents the petitioner is enough for both: the other does not need one. It can halve the costs, but only if both are truly in agreement.',
      'Bei einer einvernehmlichen Scheidung reicht ein Anwalt, der den Antragsteller vertritt, für beide: der andere braucht keinen. Es kann die Kosten halbieren, aber nur, wenn beide wirklich einig sind.',
    ],
  }),
];
