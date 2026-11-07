import type { DemoStep, DemoText } from './demo-steps';
import { TURN_DE, TURN_EN, TURN_STEPS } from './demo-steps-turns';

/**
 * The steps of the guided demo game inside the game screen: meeting Jonas, a tour of the screen, and the first rounds of the story the
 * server fixes (domain `demo.ts`): an Opportunity with a free saving, an Emergency that the Bank pays and the next Payday repays, a Harvest
 * card, a Dream with a plan, a Life card, a second Payday and a promotion. A step without a place to light up is a card in the corner: the
 * game stays usable under it.
 */

const HEAD_STEPS: DemoStep[] = [
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
];

const HEAD_EN: Record<string, DemoText> = {
  'meet-keep': {
    title: 'Meet Jonas',
    text: 'In a normal game you could choose any of the ten characters here. In the demo you play **Jonas**, a dual student of computer science. Press **Keep the character I was dealt**.',
  },
  'meet-sheet': {
    title: 'Who you are',
    text: 'Scroll through his sheet: his story, what matters to him, and **his dream** - a mountain guide, his first **Dream project**. Further down are his **emergency reserve** (the **Mojo**, three months of expenses), his income, his expenses and his two debts. Take your time, then press **Next**.',
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
  'screen-nav-unused': {
    title: 'Everything else',
    text: '**History** lists every step, **Settings** and **Menu** are the table menu (pause, autoplay while you are away, pop-ups) and **Resign** gives up your seat. Below, the bottom bar leads to your **Dream** (dreams), **Fire** (reserve, emergencies) and **Grow** (investments) pages - the books of the game.',
  },
};

const HEAD_DE: Record<string, DemoText> = {
  'meet-keep': {
    title: 'Triff Jonas',
    text: 'In einem normalen Spiel könntest du hier eine der zehn Figuren wählen. In der Demo spielst du **Jonas**, einen dualen Informatikstudenten. Drücke **Die zugeteilte Figur behalten**.',
  },
  'meet-sheet': {
    title: 'Wer du bist',
    text: 'Blättere durch sein Blatt: seine Geschichte, was ihm wichtig ist, und **sein Traum** - Bergführer, sein erstes **Traumprojekt**. Weiter unten: sein **Notgroschen** (der **Mojo**, drei Monatsausgaben), sein Einkommen, seine Ausgaben und seine zwei Schulden. Lass dir Zeit, dann drücke **Weiter**.',
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
    text: '**Verlauf** listet jeden Schritt, **Einstellungen** und **Menü** sind das Tischmenü (Pause, Autospiel bei Abwesenheit, Pop-ups) und **Aufgeben** gibt deinen Platz auf. Unten führt die Leiste zu deinen Seiten **Traum** (Träume), **Fire** (Notgroschen, Notfälle) und **Grow** (Geldanlagen) - den Büchern des Spiels.',
  },
};

export const GAME_STEPS: DemoStep[] = [...HEAD_STEPS, ...TURN_STEPS];
export const GAME_EN: Record<string, DemoText> = { ...HEAD_EN, ...TURN_EN };
export const GAME_DE: Record<string, DemoText> = { ...HEAD_DE, ...TURN_DE };
