import type { DemoStep, DemoText } from './demo-steps';

/**
 * The steps of the guided demo game inside the game screen: meeting Jonas, a tour of the screen, and the first rounds of the story the
 * server fixes (domain `demo.ts`): an Opportunity with a free saving, an Emergency that the Bank pays and the next Payday repays, a Harvest
 * card, a Dream with a plan, a Life card, a second Payday and a promotion. A step without a place to light up is a card in the corner: the
 * game stays usable under it.
 */

const roll = (n: number) => (c: { turns: number }) => c.turns >= n;

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
    place: 'bottom',
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
  // ── turn 1: an Opportunity ──
  {
    id: 't1-roll',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-solo-roll-row .btn--primary',
    next: 'event',
    done: (c) => roll(1)(c),
    assist: 'click:.cf-solo-roll-row .btn--primary',
  },
  {
    id: 't1-landed',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    // the pile is chosen: the cards of the pile are on the table
    done: (c) => c.pending === 'opportunity' || c.resolved === 'opportunity' || c.turns >= 2,
  },
  {
    id: 't1-take',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.resolved === 'opportunity' || c.turns >= 2,
  },
  // ── turn 2: an Emergency and the Bank ──
  {
    id: 't2-roll',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-solo-roll-row .btn--primary',
    next: 'event',
    done: (c) => roll(2)(c),
    assist: 'click:.cf-solo-roll-row .btn--primary',
  },
  {
    id: 't2-emergency',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.bankLoanMinor > 0 || c.turns >= 3,
  },
  {
    id: 't2-bank',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-loan-btn',
    next: 'button',
  },
  // ── turn 3 and 4: a Harvest card, a Payday and repaying ──
  {
    id: 't3-roll',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-solo-roll-row .btn--primary',
    next: 'event',
    done: (c) => roll(3)(c),
    assist: 'click:.cf-solo-roll-row .btn--primary',
  },
  {
    id: 't4-roll',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-solo-roll-row .btn--primary',
    next: 'event',
    done: (c) => roll(4)(c),
    assist: 'click:.cf-solo-roll-row .btn--primary',
  },
  {
    id: 't4-payday',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 5,
  },
  // ── turn 5 to 8: a dream, a life card, a second Payday, a promotion ──
  {
    id: 't5-roll',
    screen: 'game',
    chapter: 'turn',
    target: '.cf-solo-roll-row .btn--primary',
    next: 'event',
    done: (c) => roll(5)(c),
    assist: 'click:.cf-solo-roll-row .btn--primary',
  },
  {
    id: 't5-dream',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 6,
  },
  {
    id: 't6-life',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 7,
  },
  {
    id: 't7-payday',
    screen: 'game',
    chapter: 'turn',
    next: 'event',
    done: (c) => c.turns >= 8,
  },
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
  't1-landed': {
    title: 'An Opportunity',
    text: 'You landed on 🌱 **Opportunity**. Choose a pile: **Seed** (small, a few DT), **Sapling** (bigger, hundreds to thousands) or **Tree** (properties, with a mortgage). Choose **Seed** - and take the free saving card **AI Subscription Audit**: it costs nothing and lowers a monthly bill.',
  },
  't1-take': {
    title: 'A free saving',
    text: 'Some cards say "a die decides": throw it when the card asks. The saving shows up in **Grow** as a project that counts what you have saved. Press **Done** and end your turn - Coach plays next.',
  },
  't2-roll': {
    title: 'The next roll',
    text: 'Coach has played. Roll again.',
  },
  't2-emergency': {
    title: 'An Emergency',
    text: 'Something broke: 🔥 **A Chronic Illness: Part Time Only**, **1,800 DT**. Jonas has too little cash and too little reserve, so choose **Pay now** - the **Bank** lends what is missing.',
  },
  't2-bank': {
    title: 'You owe the Bank 1,000',
    text: 'The loan costs **10% a month**: 100 DT less every Payday until it is repaid. Look at your monthly cashflow: it fell by 100. At the next Payday you will pay it back.',
  },
  't3-roll': {
    title: 'A Harvest card',
    text: 'Roll. The next tile is a 🌾 **Harvest** tile: the markets move for everybody. The card says what happened and whether it touches something **you own**. When it does, **Done** takes you to Grow, where the project is marked and noted.',
  },
  't4-roll': {
    title: 'Payday!',
    text: 'Roll again - the next tile is a 💰 **Payday**. Your salary comes in and the bills go out.',
  },
  't4-payday': {
    title: 'Settle the month',
    text: 'Press **Pay day**/settle the month. With the money you have, **repay the Bank** (the Bank loan button): 1,000 repaid, no more 100 a month. Money that is left goes into a **plan**: a payment that moves part of every Payday into your reserve or your dream.',
  },
  't5-roll': {
    title: 'A Dream tile',
    text: 'Roll: 😊 a **Dream** tile.',
  },
  't5-dream': {
    title: 'A small dream',
    text: 'Dream cards are worth **points** and become a **Smile project** with buckets to fill. Take the small one, **D64**, and set a **plan of 50 a month** into it: it fills up by itself at every Payday.',
  },
  't6-life': {
    title: 'A Life card',
    text: 'Life happens: ❤ **Gym Membership**. Accept it - it leaves a **line**: a cost of 35 a month that stays. Life cards can be fate, a choice, a die or giving; some leave costs for a while, some for good.',
  },
  't7-payday': {
    title: 'A second Payday',
    text: 'Roll to the next 💰 Payday and settle it. Your **plan** pays 50 into the dream, and the strip above the map shows what is still running.',
  },
  't8-career': {
    title: 'A promotion',
    text: 'The 🎓 **Career** tile: a die decides - and Jonas is **promoted**. His salary rises, and so do his living costs. Careers are the other way, next to cards, to raise your income.',
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
  't1-landed': {
    title: 'Eine Chance',
    text: 'Du bist auf einer 🌱 **Chance** gelandet. Wähle einen Stapel: **Samen** (klein, ein paar TT), **Setzling** (größer, hunderte bis tausende) oder **Baum** (Immobilien, mit Hypothek). Wähle **Samen** - und nimm die kostenlose Sparkarte **KI-Abo-Check**: sie kostet nichts und senkt eine monatliche Rechnung.',
  },
  't1-take': {
    title: 'Eine kostenlose Ersparnis',
    text: 'Manche Karten sagen "ein Würfel entscheidet": wirf ihn, wenn die Karte es verlangt. Die Ersparnis erscheint in **Grow** als Projekt, das zählt, was du gespart hast. Drücke **Fertig** und beende deinen Zug - Coach ist dran.',
  },
  't2-roll': {
    title: 'Der nächste Wurf',
    text: 'Coach hat gespielt. Würfle wieder.',
  },
  't2-emergency': {
    title: 'Ein Notfall',
    text: 'Etwas ist kaputt: 🔥 **Eine chronische Krankheit: nur noch Teilzeit**, **1.800 TT**. Jonas hat zu wenig Bargeld und zu wenig Notgroschen, wähle also **Jetzt zahlen** - die **Bank** leiht, was fehlt.',
  },
  't2-bank': {
    title: 'Du schuldest der Bank 1.000',
    text: 'Der Kredit kostet **10 % im Monat**: 100 TT weniger bei jedem Zahltag, bis er zurückgezahlt ist. Sieh dir deinen monatlichen Cashflow an: er ist um 100 gefallen. Beim nächsten Zahltag zahlst du zurück.',
  },
  't3-roll': {
    title: 'Eine Ernte-Karte',
    text: 'Würfle. Das nächste Feld ist eine 🌾 **Ernte**: die Märkte bewegen sich für alle. Die Karte sagt, was passiert ist und ob es etwas betrifft, das **du besitzt**. Dann führt **Fertig** dich zu Grow, wo das Projekt markiert und notiert ist.',
  },
  't4-roll': {
    title: 'Zahltag!',
    text: 'Würfle wieder - das nächste Feld ist ein 💰 **Zahltag**. Dein Gehalt kommt, die Rechnungen gehen.',
  },
  't4-payday': {
    title: 'Den Monat abrechnen',
    text: 'Rechne den Monat ab. Mit dem Geld, das du hast, **zahle die Bank zurück** (Schaltfläche Bankkredit): 1.000 zurückgezahlt, keine 100 im Monat mehr. Was übrig ist, kommt in einen **Plan**: eine Zahlung, die einen Teil jedes Zahltags in deinen Notgroschen oder deinen Traum schiebt.',
  },
  't5-roll': {
    title: 'Ein Traum-Feld',
    text: 'Würfle: ein 😊 **Traum**-Feld.',
  },
  't5-dream': {
    title: 'Ein kleiner Traum',
    text: 'Traumkarten sind **Punkte** wert und werden zu einem **Smile-Projekt** mit Eimern zum Füllen. Nimm den kleinen, **D64**, und lege einen **Plan von 50 im Monat** darauf: er füllt sich bei jedem Zahltag von selbst.',
  },
  't6-life': {
    title: 'Eine Lebenskarte',
    text: 'Das Leben passiert: ❤ **Fitnessstudio**. Nimm es an - es hinterlässt eine **Zeile**: eine Ausgabe von 35 im Monat, die bleibt. Lebenskarten sind Schicksal, Wahl, Würfel oder Geben; manche kosten eine Weile, manche für immer.',
  },
  't7-payday': {
    title: 'Ein zweiter Zahltag',
    text: 'Würfle zum nächsten 💰 Zahltag und rechne ihn ab. Dein **Plan** zahlt 50 in den Traum, und der Streifen über der Karte zeigt, was noch läuft.',
  },
  't8-career': {
    title: 'Eine Beförderung',
    text: 'Das 🎓 **Karriere**-Feld: ein Würfel entscheidet - und Jonas wird **befördert**. Sein Gehalt steigt, seine Lebenshaltungskosten auch. Karriere ist neben den Karten der andere Weg, dein Einkommen zu erhöhen.',
  },
  end: {
    title: 'Das ist die Schleife',
    text: 'Würfeln, Karte lesen, entscheiden, Monat abrechnen, wiederholen - bis Notgroschen, Schulden, Traum und Unabhängigkeit erledigt sind. Du kannst gleich hier gegen Coach weiterspielen oder **Tutorial beenden** drücken, um diesen Demo-Tisch zu entfernen und einen echten zu eröffnen. Das Handbuch erklärt jede Karte genau.',
  },
};
