/**
 * More Life cards (JFK, 2026-11-04): life just happens - to the account only, never to another thing in the game. The stack is meant to
 * be balanced: for every blow there is a lift, the heavy blows end after a while or leave a roll to get out of them, and a character
 * with a bigger life feels both more (`scaledEffect` multiplies the money of a card by the character's price level - the windfall as
 * well as the bill). Amounts are printed for the Dual Student (net about 2,000 a month); shares of the income follow the character.
 * English and German. Kept out of the domain package's main entry like the other printed content.
 */
import type { DiceBand, LifeCard, LifeEffect, LifeRequirement } from './cashflow-game/life-deck';

const text = (en: string, de: string) => ({ en, de });

function fate(
  id: string,
  copies: number,
  title: [string, string],
  story: [string, string],
  effects: LifeEffect,
  requires?: LifeRequirement,
): LifeCard {
  return {
    id,
    copies,
    type: 'fate',
    title: text(...title),
    story: text(...story),
    links: [],
    ...(requires ? { requires } : {}),
    effects,
  };
}

/** A card the dice decide: every band is what the number brings (nothing, a small thing, a big one). */
function dice(
  id: string,
  copies: number,
  title: [string, string],
  story: [string, string],
  bands: DiceBand<LifeEffect | null>[],
  requires?: LifeRequirement,
  optional = false,
): LifeCard {
  return {
    id,
    copies,
    type: 'dice',
    title: text(...title),
    story: text(...story),
    links: [],
    ...(requires ? { requires } : {}),
    dice: bands,
    ...(optional ? { optional: true } : {}),
  };
}

const band = (from: number, to: number, value: LifeEffect | null): DiceBand<LifeEffect | null> => ({
  from,
  to,
  value,
});

const EMPLOYED: LifeRequirement = { employment: 'employed' };
const COUPLE: LifeRequirement = { relationship: ['partner', 'cohabiting', 'married'] };
const PARENT: LifeRequirement = { kidsAtLeast: 1 };
const RENTING: LifeRequirement = { home: ['own_flat', 'shared_flat'] };

export const LIFE_CARDS_MORE: LifeCard[] = [
  // ── love, family, friends ──
  fate(
    'L28',
    1,
    ['Divorce', 'Scheidung'],
    [
      'The papers are signed. Two lawyers, one flat to split, and the quiet that follows.',
      'Die Papiere sind unterschrieben. Zwei Anwälte, eine Wohnung zum Aufteilen und die Stille danach.',
    ],
    {
      oneTimeMinor: -200000,
      monthlyMinor: 24000,
      durationPaydays: 12,
      setState: { relationship: 'single', home: 'own_flat' },
    },
    { relationship: 'married', kids: 0 },
  ),
  fate(
    'L29',
    1,
    ['Divorce With Children', 'Scheidung mit Kindern'],
    [
      'The children stay with you most of the week. Support is fair, and it is long.',
      'Die Kinder sind die meiste Zeit bei dir. Der Unterhalt ist fair - und er läuft lange.',
    ],
    {
      oneTimeMinor: -220000,
      monthlyMinor: 28000,
      durationPaydays: 18,
      incomeMonthlyMinor: 12000,
      unscaledIncome: true,
      setState: { relationship: 'single', home: 'own_flat' },
    },
    { relationship: 'married', kidsAtLeast: 1 },
  ),
  fate(
    'L30',
    2,
    ['Anniversary Trip', 'Hochzeitstag-Reise'],
    [
      'Three days by the sea, no phones. You remember why you started.',
      'Drei Tage am Meer, keine Handys. Du erinnerst dich, warum ihr angefangen habt.',
    ],
    { oneTimeMinor: -60000, rewardTurns: 2 },
    COUPLE,
  ),
  fate(
    'L31',
    1,
    ['Partner Gets a Raise', 'Partner bekommt mehr Gehalt'],
    [
      'Your partner comes home with a bottle and a grin. The household is a little richer for good.',
      'Dein Partner kommt mit einer Flasche und einem Grinsen nach Hause. Der Haushalt ist dauerhaft etwas reicher.',
    ],
    { incomeMonthlyMinor: 18000 },
    COUPLE,
  ),
  fate(
    'L32',
    1,
    ['Partner Between Jobs', 'Partner zwischen zwei Jobs'],
    [
      'The contract ended and the next one starts in a few months. You cover for a while.',
      'Der Vertrag lief aus, der nächste beginnt in ein paar Monaten. Du springst eine Weile ein.',
    ],
    { monthlyMinor: 25000, durationPaydays: 4 },
    COUPLE,
  ),
  fate(
    'L33',
    1,
    ['The Nephews for the Summer', 'Die Neffen für den Sommer'],
    [
      "Your sister has a conference, so for two weeks your flat is a campsite. It's loud, it's messy, and you'll miss it.",
      'Deine Schwester hat einen Kongress, also ist deine Wohnung zwei Wochen lang ein Zeltlager. Es ist laut, chaotisch - und du wirst es vermissen.',
    ],
    { oneTimeMinor: -25000, rewardTurns: 3 },
  ),
  fate(
    'L34',
    1,
    ['Godchild', 'Patenkind'],
    [
      "You're asked to stand beside the font. A gift, a card, a lifelong job.",
      'Du wirst gebeten, Pate zu werden. Ein Geschenk, eine Karte, eine lebenslange Aufgabe.',
    ],
    { oneTimeMinor: -12000, rewardTurns: 1 },
  ),
  fate(
    'L35',
    1,
    ['Weekend With Old Friends', 'Wochenende mit alten Freunden'],
    [
      'A cabin, a lake, too much food. Nobody mentions work once.',
      'Eine Hütte, ein See, viel zu viel Essen. Niemand spricht ein einziges Mal über die Arbeit.',
    ],
    { oneTimeMinor: -15000, rewardTurns: 2 },
  ),
  fate(
    'L36',
    1,
    ['Friends Wedding Season', 'Hochzeitssaison im Freundeskreis'],
    [
      'Three invitations in one summer: travel, a suit, a gift each time.',
      'Drei Einladungen in einem Sommer: Anreise, Anzug, jedes Mal ein Geschenk.',
    ],
    { oneTimeMinor: -22000 },
    { relationship: ['single', 'partner'] },
  ),
  fate(
    'L37',
    1,
    ['Child Benefit Goes Up', 'Kindergeld steigt'],
    [
      'The state tops up the child benefit. It is the same for everybody, and it comes every month.',
      'Der Staat erhöht das Kindergeld. Es ist für alle gleich - und es kommt jeden Monat.',
    ],
    { incomeMonthlyMinor: 6000, unscaledIncome: true },
    PARENT,
  ),
  fate(
    'L38',
    1,
    ['A Daycare Place at Last', 'Endlich ein Kita-Platz'],
    [
      'The letter you waited for: a place, ten minutes away. The sitter can go.',
      'Der Brief, auf den du gewartet hast: ein Platz, zehn Minuten entfernt. Die Tagesmutter kann gehen.',
    ],
    { monthlyMinor: -20000, durationPaydays: 12 },
    PARENT,
  ),
  fate(
    'L39',
    1,
    ['The Teenage Years', 'Die Pubertät'],
    [
      'Sneakers, a phone, a growth spurt every three months. Dinner is a negotiation.',
      'Sneaker, ein Handy, alle drei Monate ein Wachstumsschub. Das Abendessen ist eine Verhandlung.',
    ],
    { monthlyMinor: 22000, durationPaydays: 10 },
    PARENT,
  ),
  fate(
    'L40',
    1,
    ['School Trip and New Gear', 'Klassenfahrt und neue Ausrüstung'],
    [
      'A week by the Baltic Sea and a backpack that survived exactly one term.',
      'Eine Woche an der Ostsee und ein Rucksack, der genau ein Halbjahr überlebt hat.',
    ],
    { oneTimeMinor: -18000 },
    PARENT,
  ),
  fate(
    'L41',
    1,
    ['Grandparents Take a Day', 'Die Großeltern übernehmen einen Tag'],
    [
      'Every Thursday the grandparents pick the children up. You get your evenings back - and a bit of money.',
      'Jeden Donnerstag holen die Großeltern die Kinder ab. Du bekommst deine Abende zurück - und etwas Geld.',
    ],
    { monthlyMinor: -12000, durationPaydays: 8, rewardTurns: 1 },
    PARENT,
  ),
  fate(
    'L42',
    1,
    ['A Parent Moves Into Care', 'Ein Elternteil zieht ins Pflegeheim'],
    [
      'It was the right decision, and still it hurts. The home costs more than the pension covers, and the family shares the rest.',
      'Es war die richtige Entscheidung, und trotzdem tut es weh. Das Heim kostet mehr, als die Rente deckt, und die Familie teilt den Rest.',
    ],
    { monthlyMinor: 30000, durationPaydays: 12 },
  ),
  dice(
    'L43',
    2,
    ['A Distant Aunt Passes Away', 'Eine entfernte Tante ist gestorben'],
    [
      'You hardly knew her - the lawyer says she knew you. Let the dice open the will.',
      'Du hast sie kaum gekannt - der Notar sagt, sie kannte dich. Die Würfel öffnen das Testament.',
    ],
    [band(1, 1, null), band(2, 4, { oneTimeMinor: 80000 }), band(5, 6, { oneTimeMinor: 250000 })],
  ),
  fate(
    'L44',
    1,
    ['A Quiet Evening Together', 'Ein ruhiger Abend zu zweit'],
    [
      'No plans, no screens. A pot of soup and a long talk.',
      'Keine Pläne, keine Bildschirme. Ein Topf Suppe und ein langes Gespräch.',
    ],
    { rewardTurns: 1 },
    COUPLE,
  ),
  fate(
    'L45',
    1,
    ['The Tax Class Pays Off', 'Die Steuerklasse zahlt sich aus'],
    [
      'The tax office has re-sorted your marriage. The refund shows up on every payslip.',
      'Das Finanzamt hat eure Ehe neu sortiert. Der Vorteil taucht auf jeder Gehaltsabrechnung auf.',
    ],
    { incomeMonthlyMinor: 10000 },
    { relationship: 'married' },
  ),
  fate(
    'L46',
    1,
    ['A Joint Policy Saves Money', 'Gemeinsamer Vertrag spart Geld'],
    [
      'Two flats of contracts become one: one internet line, one policy, one bill.',
      'Aus zwei Vertragsbergen wird einer: ein Internetanschluss, eine Police, eine Rechnung.',
    ],
    { monthlyMinor: -5000 },
    { relationship: ['cohabiting', 'married'] },
  ),

  // ── work ──
  fate(
    'L47',
    2,
    ['A Bonus', 'Eine Prämie'],
    [
      'The year ended better than planned and your name is on the list.',
      'Das Jahr war besser als geplant, und dein Name steht auf der Liste.',
    ],
    { oneTimePercentOfNet: 60 },
    EMPLOYED,
  ),
  dice(
    'L48',
    2,
    ['The Salary Review', 'Das Gehaltsgespräch'],
    [
      'You prepared three arguments. The number the dice show is how the room felt.',
      'Du hast drei Argumente vorbereitet. Die Zahl auf dem Würfel zeigt, wie der Raum gestimmt war.',
    ],
    [
      band(1, 2, null),
      band(3, 5, { incomePercentOfNet: 4 }),
      band(6, 6, { incomePercentOfNet: 9 }),
    ],
    EMPLOYED,
  ),
  dice(
    'L49',
    1,
    ['Burnout Warning', 'Warnsignal Burnout'],
    [
      'Sleep is short, the inbox is long. Your doctor says: now, not later.',
      'Der Schlaf ist kurz, das Postfach lang. Deine Ärztin sagt: jetzt, nicht später.',
    ],
    [
      band(1, 2, { incomePercentOfNet: -30, durationPaydays: 4 }),
      band(3, 4, { incomePercentOfNet: -15, durationPaydays: 2 }),
      band(5, 6, { oneTimeMinor: -6000 }),
    ],
    EMPLOYED,
  ),
  dice(
    'L50',
    2,
    ['A Side Gig Knocks', 'Ein Nebenjob klopft an'],
    [
      'A former colleague needs somebody for a project in the evenings. Roll to see how big it gets.',
      'Ein ehemaliger Kollege sucht jemanden für ein Abendprojekt. Würfle, wie groß es wird.',
    ],
    [
      band(1, 2, null),
      band(3, 4, { incomeMonthlyMinor: 20000, durationPaydays: 4 }),
      band(5, 6, { incomeMonthlyMinor: 35000, durationPaydays: 8 }),
    ],
    EMPLOYED,
  ),
  fate(
    'L51',
    2,
    ["Taking Over a Colleague's Tasks", 'Aufgaben eines Kollegen übernehmen'],
    [
      'He moved on and you inherit his projects. The title stays, the pay catches up for a while.',
      'Er ist weitergezogen, du erbst seine Projekte. Der Titel bleibt, das Gehalt zieht eine Weile nach.',
    ],
    { incomePercentOfNet: 5, durationPaydays: 6 },
    EMPLOYED,
  ),
  fate(
    'L52',
    2,
    ['Profit Sharing', 'Gewinnbeteiligung'],
    [
      'The company had a good quarter and shares it with everybody who was there.',
      'Die Firma hatte ein gutes Quartal und teilt es mit allen, die dabei waren.',
    ],
    { oneTimePercentOfNet: 35 },
    EMPLOYED,
  ),
  fate(
    'L53',
    2,
    ['The Course Pays Off', 'Die Weiterbildung zahlt sich aus'],
    [
      'Evenings of learning, and now a certificate that moves your pay up a step.',
      'Abende voller Lernen, und jetzt ein Zertifikat, das dein Gehalt eine Stufe hebt.',
    ],
    { incomePercentOfNet: 3 },
    EMPLOYED,
  ),
  fate(
    'L54',
    1,
    ['The Commute Gets Dearer', 'Der Arbeitsweg wird teurer'],
    [
      'The ticket price jumps and the line you take is now the fast one.',
      'Der Fahrpreis springt, und die Linie, die du nimmst, ist jetzt die schnelle.',
    ],
    { monthlyMinor: 9000, durationPaydays: 8 },
    EMPLOYED,
  ),
  dice(
    'L55',
    1,
    ['Flu Season', 'Grippewelle'],
    [
      'The whole office is coughing. Whether it catches you is up to the dice.',
      'Das ganze Büro hustet. Ob es dich erwischt, entscheiden die Würfel.',
    ],
    [band(1, 2, { incomePercentOfNet: -25, durationPaydays: 2 }), band(3, 6, null)],
    EMPLOYED,
  ),
  // ── when the job is gone: the lifts that keep a bad spell from becoming a spiral ──
  fate(
    'L57',
    2,
    ['Family Helps Out', 'Die Familie hilft aus'],
    [
      'Nobody asks questions. A transfer here, a full fridge there, for as long as it takes.',
      'Niemand stellt Fragen. Hier eine Überweisung, dort ein voller Kühlschrank - so lange, wie es dauert.',
    ],
    { incomeMonthlyMinor: 20000, durationPaydays: 4 },
    { employment: ['unemployed', 'short_time'] },
  ),
  fate(
    'L58',
    1,
    ['A Short Gig While You Search', 'Ein kurzer Auftrag während der Suche'],
    [
      'A friend of a friend needs a quick job done. It is not your career, but it pays.',
      'Ein Freund eines Freundes braucht schnell Hilfe. Es ist nicht deine Karriere, aber es bringt Geld.',
    ],
    { incomeMonthlyMinor: 25000, durationPaydays: 3 },
    { employment: 'unemployed' },
  ),
  fate(
    'L59',
    1,
    ['Housing Benefit Approved', 'Wohngeld bewilligt'],
    [
      'The letter took weeks, and now it helps with the rent for half a year.',
      'Der Bescheid hat Wochen gedauert, und jetzt hilft er ein halbes Jahr lang bei der Miete.',
    ],
    { incomeMonthlyMinor: 20000, durationPaydays: 6 },
    { employment: ['unemployed', 'short_time'] },
  ),
  fate(
    'L60',
    1,
    ['A Friend Knows Somebody', 'Ein Freund kennt jemanden'],
    [
      'One phone call, one coffee, one handshake. The door was open all along.',
      'Ein Anruf, ein Kaffee, ein Handschlag. Die Tür stand die ganze Zeit offen.',
    ],
    { oneTimeMinor: 20000, rewardTurns: 2 },
    { employment: 'unemployed' },
  ),

  // ── money and everyday luck ──
  fate(
    'L61',
    2,
    ['Tax Refund', 'Steuererstattung'],
    [
      'The envelope you ignored for months holds a surprise: they owe you.',
      'Der Umschlag, den du monatelang ignoriert hast, enthält eine Überraschung: Sie schulden dir Geld.',
    ],
    { oneTimePercentOfNet: 30 },
  ),
  fate(
    'L62',
    1,
    ['Tax Back-Payment', 'Steuernachzahlung'],
    [
      'The assessment is final and not in your favour. Pay it and move on.',
      'Der Bescheid ist rechtskräftig und nicht zu deinen Gunsten. Zahlen und weitermachen.',
    ],
    { oneTimePercentOfNet: -25 },
  ),
  dice(
    'L63',
    1,
    ['A Scratch Card', 'Ein Rubbellos'],
    [
      'A euro, a coin, a small hope. You may skip it.',
      'Ein Euro, eine Münze, eine kleine Hoffnung. Du darfst es auch lassen.',
    ],
    [
      band(1, 4, { oneTimeMinor: -800 }),
      band(5, 5, { oneTimeMinor: 2000 }),
      band(6, 6, { oneTimeMinor: 12000 }),
    ],
    undefined,
    true,
  ),
  fate(
    'L64',
    1,
    ['Energy Prices Spike', 'Energiepreise steigen'],
    [
      'The new tariff arrives in a grey envelope. The winter will be expensive.',
      'Der neue Tarif kommt im grauen Umschlag. Der Winter wird teuer.',
    ],
    { monthlyMinor: 7000, durationPaydays: 8 },
  ),
  fate(
    'L65',
    2,
    ['Energy Refund', 'Energie-Rückzahlung'],
    [
      'The meter was read right and the deposit was too high. A cheque is on its way.',
      'Der Zähler wurde richtig abgelesen, und der Abschlag war zu hoch. Ein Scheck ist unterwegs.',
    ],
    { oneTimePercentOfNet: 12 },
  ),
  fate(
    'L66',
    1,
    ['The Landlord Renovates', 'Der Vermieter modernisiert'],
    [
      'New windows, new heating, and a letter explaining how much of it lands on the rent.',
      'Neue Fenster, neue Heizung und ein Brief, der erklärt, wie viel davon auf die Miete umgelegt wird.',
    ],
    { monthlyMinor: 8000, group: 'rent' },
    RENTING,
  ),
  fate(
    'L67',
    2,
    ['A Fair Landlord', 'Ein fairer Vermieter'],
    [
      'He checked the index and lowered the rent a little. Rare, and he means it.',
      'Er hat den Index geprüft und die Miete etwas gesenkt. Selten - und er meint es ernst.',
    ],
    { monthlyMinor: -6000, group: 'rent' },
    RENTING,
  ),
  fate(
    'L68',
    2,
    ['Health Insurer Bonus', 'Bonus der Krankenkasse'],
    [
      'Check-ups, a gym card, a few steps a day. The insurer pays you back for staying well.',
      'Vorsorge, ein Fitnessarmband, ein paar Schritte am Tag. Die Kasse belohnt dich für deine Gesundheit.',
    ],
    { oneTimeMinor: 12000 },
  ),
  fate(
    'L69',
    2,
    ['Good Neighbours', 'Gute Nachbarn'],
    [
      'They water your plants, take your parcels and leave soup at the door when you are ill.',
      'Sie gießen deine Pflanzen, nehmen deine Pakete an und stellen Suppe vor die Tür, wenn du krank bist.',
    ],
    { rewardTurns: 2 },
  ),
  fate(
    'L70',
    2,
    ['A Local Award', 'Ein Preis aus der Nachbarschaft'],
    [
      'The club names you volunteer of the year. There is a plaque and a small cheque.',
      'Der Verein ernennt dich zum Ehrenamtler des Jahres. Es gibt eine Urkunde und einen kleinen Scheck.',
    ],
    { oneTimeMinor: 20000, rewardTurns: 2 },
  ),
  fate(
    'L71',
    1,
    ['The Dog Park Crowd', 'Die Hundewiesen-Truppe'],
    [
      'Every morning the same faces, the same dogs, the same jokes. It lifts you.',
      'Jeden Morgen dieselben Gesichter, dieselben Hunde, dieselben Witze. Es baut dich auf.',
    ],
    { rewardTurns: 2 },
    { pet: 'dog' },
  ),
  fate(
    'L72',
    1,
    ['Car Pool Saves Fuel', 'Fahrgemeinschaft spart Sprit'],
    [
      'Two colleagues live on your way. Three in one car is cheaper and louder.',
      'Zwei Kollegen wohnen auf deinem Weg. Zu dritt im Auto ist es billiger - und lauter.',
    ],
    { monthlyMinor: -5000, durationPaydays: 8 },
    { car: true },
  ),
  fate(
    'L73',
    1,
    ['Parking Permit Goes Up', 'Anwohnerparken wird teurer'],
    [
      'The city wants fewer cars. Yours stays, and so does the new fee.',
      'Die Stadt will weniger Autos. Deins bleibt - und die neue Gebühr auch.',
    ],
    { monthlyMinor: 4000 },
    { car: true },
  ),
  fate(
    'L74',
    1,
    ['A Scholarship', 'Ein Stipendium'],
    [
      'A foundation read your letter twice. For half a year you can focus on the learning.',
      'Eine Stiftung hat deinen Brief zweimal gelesen. Ein halbes Jahr lang kannst du dich aufs Lernen konzentrieren.',
    ],
    { incomeMonthlyMinor: 25000, durationPaydays: 6 },
    { education: true },
  ),
  fate(
    'L75',
    1,
    ['The Exam Retake', 'Die Nachprüfung'],
    [
      'One module went wrong. The fee is small, the weekend in the library is not.',
      'Ein Modul ist schiefgegangen. Die Gebühr ist klein, das Wochenende in der Bibliothek nicht.',
    ],
    { oneTimeMinor: -9000 },
    { education: true },
  ),
  fate(
    'L76',
    1,
    ['A Date That Goes Nowhere', 'Ein Date, das nirgendwohin führt'],
    [
      'Good food, no spark. At least the story is worth telling.',
      'Gutes Essen, kein Funke. Wenigstens ist die Geschichte erzählenswert.',
    ],
    { oneTimeMinor: -4000, rewardTurns: 1 },
    { relationship: 'single' },
  ),
];
