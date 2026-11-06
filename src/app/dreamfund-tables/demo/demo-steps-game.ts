import type { DemoStep, DemoText } from './demo-steps';

/**
 * The steps of the guided demo game inside the game screen: meeting Jonas, a tour of the screen, and the first rounds of the story the
 * server fixes (domain `demo.ts`): an Opportunity with a free saving, an Emergency that the Bank pays and the next Payday repays, a Harvest
 * card, a Dream with a plan, a Life card, a second Payday and a promotion. A step without a place to light up is a card in the corner: the
 * game stays usable under it.
 */

/** The card that was drawn is opened with this button. */
const OPEN = '[data-demo="open-card"]';
const ROLL = '.cf-solo-roll-row .btn--primary';

/** The step of a roll: the dice button lights up and the step is done when the roll is made. */
function roll(id: string, n: number): DemoStep {
  return {
    id,
    screen: 'game',
    chapter: 'turn',
    target: ROLL,
    next: 'event',
    done: (c) => c.turns >= n,
    assist: `click:${ROLL}`,
  };
}

export const GAME_STEPS: DemoStep[] = [
  // ── meet Jonas ──
  {
    id: 'meet-keep',
    screen: 'game',
    chapter: 'meet',
    target: '.tb-wide',
    next: 'event',
    done: (c) => !c.dom('.tb-person'),
    assist: 'click:.tb-wide',
  },
  {
    id: 'meet-sheet',
    screen: 'game',
    chapter: 'meet',
    target: '.tb-sheet',
    place: 'corner',
    next: 'button',
  },
  {
    id: 'meet-ready',
    screen: 'game',
    chapter: 'meet',
    target: '.tb-actions',
    next: 'event',
    done: (c) => c.dom('.id-sheet') || c.phase === 'playing',
    assist: 'click:.tb-actions .btn--primary',
  },
  {
    id: 'meet-insurance',
    screen: 'game',
    chapter: 'meet',
    target: '.id-sheet',
    next: 'event',
    done: (c) => c.phase === 'playing' && !c.dom('.id-overlay') && !c.dom('.tb-overlay'),
    assist: 'click:.id-wide',
  },
  // ── the screen ──
  {
    id: 'screen-turn',
    screen: 'game',
    chapter: 'screen',
    target: '.tl-status',
    next: 'button',
  },
  {
    id: 'screen-card',
    screen: 'game',
    chapter: 'screen',
    target: '.cf-summary',
    next: 'button',
  },
  {
    id: 'screen-money',
    screen: 'game',
    chapter: 'screen',
    target: '.cf-stat-row',
    next: 'button',
  },
  {
    id: 'screen-map',
    screen: 'game',
    chapter: 'screen',
    target: '.cf-solo-board',
    next: 'button',
  },
  {
    id: 'screen-bank',
    screen: 'game',
    chapter: 'screen',
    target: '.cf-loan-btn',
    next: 'button',
  },
  {
    id: 'screen-nav',
    screen: 'game',
    chapter: 'screen',
    target: '.cf-dash-rest',
    next: 'button',
  },
  // ── turn 1: an Opportunity and a free saving ──
  roll('t1-roll', 1),
  {
    id: 't1-open',
    screen: 'game',
    chapter: 'turn',
    target: OPEN,
    next: 'event',
    done: (c) => c.dom('.tc-pile') || c.dom('[data-card-id]') || c.turns >= 2,
    assist: `click:${OPEN}`,
  },
  {
    id: 't1-pile',
    screen: 'game',
    chapter: 'turn',
    target: '.tc-pile[data-pile="seed"]',
    next: 'event',
    done: (c) => c.dom('[data-card-id]') || c.turns >= 2,
    assist: 'click:.tc-pile[data-pile="seed"]',
  },
  {
    id: 't1-take',
    screen: 'game',
    chapter: 'turn',
    target: '[data-card-id="S01"] .tc-btn--primary',
    next: 'event',
    done: (c) => c.dom('.tc-btn--gold') || !c.dom('[data-card-id]') || c.turns >= 2,
    assist: 'click:[data-card-id="S01"] .tc-btn--primary',
  },
  {
    id: 't1-die',
    screen: 'game',
    chapter: 'turn',
    target: '.tc-btn--gold',
    next: 'event',
    done: (c) => !c.dom('.tc-btn--gold') || c.turns >= 2,
    assist: 'click:.tc-btn--gold',
  },
  {
    id: 't1-done',
    screen: 'game',
    chapter: 'turn',
    target: '.tc-done',
    next: 'event',
    done: (c) =>
      c.turns >= 2 ||
      (c.resolved === 'opportunity' && !c.dom('.tc-done') && !c.dom('.tc-btn--gold')),
    assist: 'click:.tc-done',
  },
  // ── turn 2: an Emergency, the Fire project and the Bank ──
  roll('t2-roll', 2),
  {
    id: 't2-open',
    screen: 'game',
    chapter: 'turn',
    target: OPEN,
    next: 'event',
    done: (c) => c.dom('.tc-btn--primary') || c.dom('.tc-done') || c.turns >= 3,
    assist: `click:${OPEN}`,
  },
  {
    id: 't2-create',
    screen: 'game',
    chapter: 'turn',
    target: '.tc-btn--primary',
    next: 'event',
    done: (c) => c.dom('.tc-done') || c.turns >= 3,
    assist: 'click:.tc-btn--primary',
  },
  {
    id: 't2-fire',
    screen: 'game',
    chapter: 'turn',
    target: '.tc-btn--primary',
    next: 'event',
    done: (c) => c.bankLoanMinor > 0 || c.turns >= 3 || !c.myTurn,
  },
  {
    id: 't2-bank',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-loan-btn',
    next: 'button',
  },
  // ── turn 3: a Harvest card ──
  roll('t3-roll', 3),
  {
    id: 't3-harvest',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 4,
  },
  // ── turn 4: Payday and repaying the Bank ──
  roll('t4-roll', 4),
  {
    id: 't4-payday',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 5,
  },
  // ── turn 5: a Dream ──
  roll('t5-roll', 5),
  {
    id: 't5-open',
    screen: 'game',
    chapter: 'turn',
    target: OPEN,
    next: 'event',
    done: (c) => c.dom('[data-card-id]') || c.turns >= 6,
    assist: `click:${OPEN}`,
  },
  {
    id: 't5-dream',
    screen: 'game',
    chapter: 'turn',
    target: '[data-card-id="D64"]',
    next: 'event',
    done: (c) => c.turns >= 6,
  },
  // ── turn 6: a Life card ──
  roll('t6-roll', 6),
  {
    id: 't6-life',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 7,
  },
  // ── turn 7: the second Payday ──
  roll('t7-roll', 7),
  {
    id: 't7-payday',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 8,
  },
  // ── turn 8: a promotion ──
  roll('t8-roll', 8),
  {
    id: 't8-career',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 9,
  },
  {
    id: 'end',
    screen: 'game',
    chapter: 'turn',
    next: 'button',
    place: 'center',
  },
];

export const GAME_EN: Record<string, DemoText> = {
  'meet-keep': {
    title: 'Meet Jonas',
    text: 'In a normal game you could choose any of the ten characters here. In the demo you play **Jonas**, a dual student of computer science. Press **Keep the character I was dealt**.',
  },
  'meet-sheet': {
    title: 'Who you are',
    text: 'Scroll through his sheet: his story, what matters to him, and **his dream** - a mountain guide, his first **Smile project**. Further down are his **emergency reserve** (the **Mojo**, three months of expenses), his income, his expenses and his two debts. Take your time, then press **Next**.',
  },
  'meet-ready': {
    title: 'I know who I am',
    text: 'Scroll to the bottom and press **I know who I am - start**.',
  },
  'meet-insurance': {
    title: 'Insurances',
    text: 'An insurance is a small price every month against a big damage. Jonas starts with liability and household insurance - leave them as they are and press **Done**. Before the first roll a change counts at once; later it counts from the next Payday.',
  },
  'screen-turn': {
    title: 'Whose turn it is',
    text: 'Here you see whose turn it is, the table round, and the players with their progress. Coach plays too: its moves appear in the line below. Tap a player to look at their books.',
  },
  'screen-card': {
    title: 'Jonas at a glance',
    text: 'The **badges** are his life: relationship, children, home, job, car, insurances, career. They decide which cards can find him - a life without a car never meets the flat tyre. Tap one to read what it does.',
  },
  'screen-money': {
    title: 'Your money',
    text: '**Cash** is what you can spend now. **Monthly cashflow** is what is left of every Payday after the bills - Jonas has about **500**. If it ever turns negative, the game is over for you. Your goal: a full reserve, no debts, your dream lived and passive income that pays the bills.',
  },
  'screen-map': {
    title: 'The map',
    text: 'Your totem walks this closed track. Every tile is a pile of cards: 🌱 Opportunity to invest in, 🌾 Harvest (the markets), 🔥 Emergency, ❤ Life, 🎓 Career, 😊 Dream - and 💰 **Payday**, a month: salary in, bills out. The next Payday tile is marked below the map.',
  },
  'screen-bank': {
    title: 'The Bank',
    text: 'If a payment is bigger than your cash, the **Bank** lends the rest - in steps of 1,000, at **10% a month**. It is an emergency tool: repay it as soon as you can. Here you see it and repay it.',
  },
  'screen-nav': {
    title: 'Everything else',
    text: '**History** lists every step, **Settings** and **Menu** are the table menu (pause, autoplay while you are away, pop-ups) and **Resign** gives up your seat. Below, the bottom bar leads to your **Smile** (dreams), **Fire** (reserve, emergencies) and **Grow** (investments) pages - the books of the game.',
  },
  't1-roll': {
    title: 'Roll the dice',
    text: 'Time for the first roll. In this demo the dice are fixed, so I know exactly where you will land. Press **Roll the dice**.',
  },
  't1-open': {
    title: 'An Opportunity',
    text: 'You landed on 🌱 **Opportunity**. A card was drawn for you - press **Open the card** to read it.',
  },
  't1-pile': {
    title: 'Choose a pile',
    text: 'Three piles: **Seed** (small, savings and first steps), **Sapling** (hundreds to thousands) and **Tree** (properties, with a mortgage). Take **Seed**.',
  },
  't1-take': {
    title: 'A free saving',
    text: 'Two cards are offered. **AI Subscription Audit** is a saving: it costs **nothing** and lowers a monthly bill. Press **Take this card** under it.',
  },
  't1-die': {
    title: 'A die decides',
    text: 'Some cards say "a die decides". Every die in the game is yours to throw - the card shows what each number does. Press **Throw the die**.',
  },
  't1-done': {
    title: 'Done',
    text: 'The saving is booked: it shows up in **Grow** as a project that counts what you save every month. Press **Done**. Then Coach plays its turn.',
  },
  't2-roll': {
    title: 'The next roll',
    text: 'Coach has played. Roll again - the next tile is a 🔥 **Emergency**.',
  },
  't2-open': {
    title: 'Something broke',
    text: 'Open the card to see what happened.',
  },
  't2-create': {
    title: 'An Emergency: 1,800 DT',
    text: '🔥 **A Chronic Illness: Part Time Only**. No insurance covers it, and Jonas has almost no cash and no reserve. Press **Create the Fire project**: the bill becomes a project in your **Fire** page, where you pay it.',
  },
  't2-fire': {
    title: 'Pay it from the Fire project',
    text: 'The project is made. Press **Open the Fire project** (this page leaves the table for a moment): it opens the **Fire** page with your emergency. Press **Pay** there and pay the whole bill - Jonas has too little cash, so the **Bank lends the rest** (1,000 DT). Then come back with **CASHFLOW** in the bottom bar; I will be here.',
  },
  't2-bank': {
    title: 'You owe the Bank',
    text: 'The loan costs **10% a month**: 100 DT less every Payday until it is repaid. Look at your monthly cashflow: it fell by 100. At the next Payday you pay it back.',
  },
  't3-roll': {
    title: 'A Harvest card',
    text: 'Roll. The next tile is a 🌾 **Harvest** tile: the markets move for everybody. Open the card: it says what happened and whether it touches something **you own**. When it does, **Done** takes you to Grow, where the project is marked and noted.',
  },
  't3-harvest': {
    title: 'Markets move',
    text: 'Jonas owns nothing the market card touches, so nothing happens to him - Coach may have more to lose. Press **Done** and end your turn.',
  },
  't4-roll': {
    title: 'Payday!',
    text: 'Roll again - the next tile is a 💰 **Payday**: your salary comes in and the bills go out.',
  },
  't4-payday': {
    title: 'Settle the month and repay the Bank',
    text: 'Settle the month. With the money you have, **repay the Bank** (the Bank loan button): 1,000 repaid, no more 100 a month. Money that is left goes into a **plan**: a payment that moves part of every Payday into your reserve or your dream.',
  },
  't5-roll': {
    title: 'A Dream tile',
    text: 'Roll: 😊 a **Dream** tile.',
  },
  't5-open': {
    title: 'A dream card',
    text: 'Open the card: dream cards are offered, each worth **points**.',
  },
  't5-dream': {
    title: 'A small dream',
    text: 'Take the small one, **Paraglide Over the Alps**: it becomes a **Smile project** with buckets to fill. Then set a **plan of 50 a month** into it: it fills up by itself at every Payday.',
  },
  't6-roll': {
    title: 'A Life card',
    text: 'Roll: the next tile is ❤ **Life**.',
  },
  't6-life': {
    title: 'Life happens',
    text: '**Gym Membership**: accept it - it leaves a **line**, a cost of 35 a month that stays. Life cards can be fate, a choice, a die or giving; some leave costs for a while, some for good.',
  },
  't7-roll': {
    title: 'A second Payday',
    text: 'Roll to the next 💰 Payday.',
  },
  't7-payday': {
    title: 'Plans pay in',
    text: 'Settle it. Your **plan** pays 50 into the dream, and the strip above the map shows what is still running.',
  },
  't8-roll': {
    title: 'The Career tile',
    text: 'Roll: the 🎓 **Career** tile.',
  },
  't8-career': {
    title: 'A promotion',
    text: 'A die decides - and Jonas is **promoted**. His salary rises, and so do his living costs (and the job costs 300 once). Careers are, next to cards, the other way to raise your income.',
  },
  end: {
    title: 'That is the loop',
    text: 'Roll, read the card, decide, settle the month, repeat - until your reserve, debts, dream and independence are done. You can play on against Coach right here, or press **Stop tutorial** to remove this demo table and open a real one. The manual explains every card in detail.',
  },
};

export const GAME_DE: Record<string, DemoText> = {
  'meet-keep': {
    title: 'Triff Jonas',
    text: 'In einem normalen Spiel könntest du hier eine der zehn Figuren wählen. In der Demo spielst du **Jonas**, einen dualen Informatikstudenten. Drücke **Die zugeteilte Figur behalten**.',
  },
  'meet-sheet': {
    title: 'Wer du bist',
    text: 'Blättere durch sein Blatt: seine Geschichte, was ihm wichtig ist, und **sein Traum** - Bergführer, sein erstes **Smile-Projekt**. Weiter unten: sein **Notgroschen** (der **Mojo**, drei Monatsausgaben), sein Einkommen, seine Ausgaben und seine zwei Schulden. Lass dir Zeit, dann drücke **Weiter**.',
  },
  'meet-ready': {
    title: 'Ich weiß, wer ich bin',
    text: 'Blättere nach unten und drücke **Ich weiß, wer ich bin - los**.',
  },
  'meet-insurance': {
    title: 'Versicherungen',
    text: 'Eine Versicherung ist ein kleiner Preis pro Monat gegen einen großen Schaden. Jonas startet mit Haftpflicht und Hausrat - lass sie so und drücke **Fertig**. Vor dem ersten Wurf gilt eine Änderung sofort, später ab dem nächsten Zahltag.',
  },
  'screen-turn': {
    title: 'Wer dran ist',
    text: 'Hier siehst du, wer am Zug ist, die Tischrunde und die Spieler mit ihrem Fortschritt. Coach spielt mit: seine Züge erscheinen in der Zeile darunter. Tippe einen Spieler an, um seine Bücher zu sehen.',
  },
  'screen-card': {
    title: 'Jonas auf einen Blick',
    text: 'Die **Abzeichen** sind sein Leben: Beziehung, Kinder, Wohnung, Beruf, Auto, Versicherungen, Karriere. Sie bestimmen, welche Karten ihn treffen können - wer kein Auto hat, erlebt keinen Platten. Tippe eins an, um zu lesen, was es bewirkt.',
  },
  'screen-money': {
    title: 'Dein Geld',
    text: '**Bargeld** kannst du jetzt ausgeben. Der **monatliche Cashflow** bleibt von jedem Zahltag nach den Rechnungen übrig - Jonas hat etwa **500**. Wird er je negativ, ist das Spiel für dich vorbei. Dein Ziel: voller Notgroschen, keine Schulden, der Traum gelebt und passives Einkommen, das die Rechnungen zahlt.',
  },
  'screen-map': {
    title: 'Die Karte',
    text: 'Deine Figur läuft diese geschlossene Bahn. Jedes Feld ist ein Kartenstapel: 🌱 Chance zum Investieren, 🌾 Ernte (die Märkte), 🔥 Notfall, ❤ Leben, 🎓 Karriere, 😊 Traum - und 💰 **Zahltag**, ein Monat: Gehalt rein, Rechnungen raus. Der nächste Zahltag steht unter der Karte.',
  },
  'screen-bank': {
    title: 'Die Bank',
    text: 'Ist eine Zahlung größer als dein Bargeld, leiht die **Bank** den Rest - in Schritten zu 1.000, mit **10 % im Monat**. Sie ist ein Notbehelf: zahle sie zurück, sobald du kannst. Hier siehst du sie und zahlst zurück.',
  },
  'screen-nav': {
    title: 'Alles andere',
    text: '**Verlauf** listet jeden Schritt, **Einstellungen** und **Menü** sind das Tischmenü (Pause, Autospiel bei Abwesenheit, Pop-ups) und **Aufgeben** gibt deinen Platz auf. Unten führt die Leiste zu deinen Seiten **Smile** (Träume), **Fire** (Notgroschen, Notfälle) und **Grow** (Geldanlagen) - den Büchern des Spiels.',
  },
  't1-roll': {
    title: 'Würfle',
    text: 'Zeit für den ersten Wurf. In dieser Demo sind die Würfel fest, ich weiß also genau, wo du landest. Drücke **Würfeln**.',
  },
  't1-open': {
    title: 'Eine Chance',
    text: 'Du bist auf einer 🌱 **Chance** gelandet. Eine Karte wurde für dich gezogen - drücke **Karte öffnen**, um sie zu lesen.',
  },
  't1-pile': {
    title: 'Wähle einen Stapel',
    text: 'Drei Stapel: **Samen** (klein, Ersparnisse und erste Schritte), **Setzling** (hunderte bis tausende) und **Baum** (Immobilien, mit Hypothek). Nimm **Samen**.',
  },
  't1-take': {
    title: 'Eine kostenlose Ersparnis',
    text: 'Zwei Karten werden angeboten. Der **KI-Abo-Check** ist eine Ersparnis: er kostet **nichts** und senkt eine monatliche Rechnung. Drücke **Diese Karte nehmen** darunter.',
  },
  't1-die': {
    title: 'Ein Würfel entscheidet',
    text: 'Manche Karten sagen "ein Würfel entscheidet". Jeder Würfel im Spiel gehört dir - die Karte zeigt, was jede Zahl bewirkt. Drücke **Würfel werfen**.',
  },
  't1-done': {
    title: 'Fertig',
    text: 'Die Ersparnis ist gebucht: sie erscheint in **Grow** als Projekt, das zählt, was du jeden Monat sparst. Drücke **Fertig**. Dann spielt Coach seinen Zug.',
  },
  't2-roll': {
    title: 'Der nächste Wurf',
    text: 'Coach hat gespielt. Würfle wieder - das nächste Feld ist ein 🔥 **Notfall**.',
  },
  't2-open': {
    title: 'Etwas ist kaputt',
    text: 'Öffne die Karte, um zu sehen, was passiert ist.',
  },
  't2-create': {
    title: 'Ein Notfall: 1.800 TT',
    text: '🔥 **Eine chronische Krankheit: nur noch Teilzeit**. Keine Versicherung deckt es, und Jonas hat fast kein Bargeld und keinen Notgroschen. Drücke **Fire-Projekt anlegen**: die Rechnung wird zu einem Projekt auf deiner **Fire**-Seite, wo du sie bezahlst.',
  },
  't2-fire': {
    title: 'Aus dem Fire-Projekt bezahlen',
    text: 'Das Projekt ist angelegt. Drücke **Fire-Projekt öffnen** (die Seite verlässt kurz den Tisch): sie öffnet die **Fire**-Seite mit deinem Notfall. Drücke dort **Bezahlen** und zahle die ganze Rechnung - Jonas hat zu wenig Bargeld, die **Bank leiht den Rest** (1.000 TT). Komm dann mit **CASHFLOW** in der unteren Leiste zurück; ich bin hier.',
  },
  't2-bank': {
    title: 'Du schuldest der Bank',
    text: 'Der Kredit kostet **10 % im Monat**: 100 TT weniger bei jedem Zahltag, bis er zurückgezahlt ist. Sieh dir deinen monatlichen Cashflow an: er ist um 100 gefallen. Beim nächsten Zahltag zahlst du zurück.',
  },
  't3-roll': {
    title: 'Eine Ernte-Karte',
    text: 'Würfle. Das nächste Feld ist eine 🌾 **Ernte**: die Märkte bewegen sich für alle. Öffne die Karte: sie sagt, was passiert ist und ob es etwas betrifft, das **du besitzt**. Dann führt **Fertig** dich zu Grow, wo das Projekt markiert und notiert ist.',
  },
  't3-harvest': {
    title: 'Die Märkte bewegen sich',
    text: 'Jonas besitzt nichts, was die Marktkarte trifft, also passiert ihm nichts - Coach hat vielleicht mehr zu verlieren. Drücke **Fertig** und beende deinen Zug.',
  },
  't4-roll': {
    title: 'Zahltag!',
    text: 'Würfle wieder - das nächste Feld ist ein 💰 **Zahltag**: dein Gehalt kommt, die Rechnungen gehen.',
  },
  't4-payday': {
    title: 'Den Monat abrechnen und die Bank bezahlen',
    text: 'Rechne den Monat ab. Mit dem Geld, das du hast, **zahle die Bank zurück** (Schaltfläche Bankkredit): 1.000 zurückgezahlt, keine 100 im Monat mehr. Was übrig ist, kommt in einen **Plan**: eine Zahlung, die einen Teil jedes Zahltags in deinen Notgroschen oder deinen Traum schiebt.',
  },
  't5-roll': {
    title: 'Ein Traum-Feld',
    text: 'Würfle: ein 😊 **Traum**-Feld.',
  },
  't5-open': {
    title: 'Eine Traumkarte',
    text: 'Öffne die Karte: Traumkarten werden angeboten, jede **Punkte** wert.',
  },
  't5-dream': {
    title: 'Ein kleiner Traum',
    text: 'Nimm den kleinen, **Mit dem Gleitschirm über die Alpen**: er wird zu einem **Smile-Projekt** mit Eimern zum Füllen. Lege dann einen **Plan von 50 im Monat** darauf: er füllt sich bei jedem Zahltag von selbst.',
  },
  't6-roll': {
    title: 'Eine Lebenskarte',
    text: 'Würfle: das nächste Feld ist ❤ **Leben**.',
  },
  't6-life': {
    title: 'Das Leben passiert',
    text: '**Fitnessstudio**: nimm es an - es hinterlässt eine **Zeile**, eine Ausgabe von 35 im Monat, die bleibt. Lebenskarten sind Schicksal, Wahl, Würfel oder Geben; manche kosten eine Weile, manche für immer.',
  },
  't7-roll': {
    title: 'Ein zweiter Zahltag',
    text: 'Würfle zum nächsten 💰 Zahltag.',
  },
  't7-payday': {
    title: 'Pläne zahlen ein',
    text: 'Rechne ihn ab. Dein **Plan** zahlt 50 in den Traum, und der Streifen über der Karte zeigt, was noch läuft.',
  },
  't8-roll': {
    title: 'Das Karriere-Feld',
    text: 'Würfle: das 🎓 **Karriere**-Feld.',
  },
  't8-career': {
    title: 'Eine Beförderung',
    text: 'Ein Würfel entscheidet - und Jonas wird **befördert**. Sein Gehalt steigt, seine Lebenshaltungskosten auch (und der Job kostet einmal 300). Karriere ist neben den Karten der andere Weg, dein Einkommen zu erhöhen.',
  },
  end: {
    title: 'Das ist die Schleife',
    text: 'Würfeln, Karte lesen, entscheiden, Monat abrechnen, wiederholen - bis Notgroschen, Schulden, Traum und Unabhängigkeit erledigt sind. Du kannst gleich hier gegen Coach weiterspielen oder **Tutorial beenden** drücken, um diesen Demo-Tisch zu entfernen und einen echten zu eröffnen. Das Handbuch erklärt jede Karte genau.',
  },
};
