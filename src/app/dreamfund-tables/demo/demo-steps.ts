import type { TableView } from '@money/domain';
import { extrasOf, moneyOf, pendingOf } from '../dream-table-view';
import { GAME_DE, GAME_EN, GAME_STEPS } from './demo-steps-game';

/**
 * The script of the guided demo game (JFK, 2026-11-06). The coach is a list of steps; each lights up a place of the real screen, says a
 * few words and either waits for a press of its button (`next: 'button'`) or for the person to do the thing it points at
 * (`next: 'event'`, with `done` saying when it has happened). A step an `assist` can do for the person ("do it for me") never leaves
 * them stuck. The story of the game itself - the dice and the cards - is fixed by the server (domain `demo.ts`): this file only
 * says what to look at while it happens.
 */

/** Where in the app the step is shown. */
export type DemoScreen = 'lobby' | 'room' | 'game';

/** What the coach knows about the app right now: read each moment from the table and the page. */
export interface DemoContext {
  screen: DemoScreen;
  /** The table's phase ('none' before there is one). */
  phase: 'none' | 'lobby' | 'picking' | 'briefing' | 'playing' | 'finished';
  /** Coach, the bot of the demo, sits at the table. */
  coachSeated: boolean;
  /** The table is the guided demo (its settings say so). */
  isDemo: boolean;
  /** How many turns I have rolled. */
  turns: number;
  /** It is my turn. */
  myTurn: boolean;
  /** The moves the server lists for me. */
  legal: ReadonlySet<string>;
  /** What I have to decide (the kind of the open card), if anything. */
  pending: string | null;
  /** What my last card came to (its kind), if anything. */
  resolved: string | null;
  paydayDue: boolean;
  cashMinor: number;
  reserveMinor: number;
  bankLoanMinor: number;
  dreamSavedMinor: number;
  /** The plans I pay into a project every Payday: how many. */
  plans: number;
  /** The Smile projects (dreams) taken. */
  smileCount: number;
  /** Whether something of the page is there (a CSS selector). */
  dom: (selector: string) => boolean;
}

export interface DemoStep {
  id: string;
  screen: DemoScreen;
  /** What to light up (a CSS selector, usually `[data-demo="..."]`); absent: a card in the middle. */
  target?: string;
  place?: 'top' | 'bottom' | 'center' | 'corner';
  /** `button`: Next. `event`: moves on by itself when `done` is true. */
  next: 'button' | 'event';
  done?: (context: DemoContext) => boolean;
  /** Does what the step asks for the person ("do it for me"). */
  assist?: string;
  /** The chapter, for the progress line. */
  chapter: string;
}

export interface DemoText {
  title: string;
  text: string;
}

/** The context from a table view and the page. */
export function demoContext(
  screen: DemoScreen,
  view: TableView | null,
  legal: readonly { action: string }[],
  dom: (selector: string) => boolean,
): DemoContext {
  const seat = view?.youSeat ?? null;
  const me = seat === null || !view ? null : (view.players[seat] ?? null);
  const money = view && seat !== null ? moneyOf(view, seat) : null;
  const pending = view && seat !== null ? pendingOf(view, seat) : null;
  const extras = view && seat !== null ? extrasOf(view, seat) : null;
  const life = (me as unknown as { dreamLife?: { turns?: number } } | null)?.dreamLife ?? null;
  const settings = view?.settings as unknown as { demo?: string } | undefined;
  return {
    screen,
    phase: !view
      ? 'none'
      : view.phase === 'playing' &&
          (view as unknown as { dreamBriefing?: boolean }).dreamBriefing === true
        ? 'briefing'
        : (view.phase as DemoContext['phase']),
    coachSeated: !!view?.players.some(
      (player) => (player.bot as { policyId?: string } | null)?.policyId === 'coach',
    ),
    isDemo: settings?.demo === 'basics',
    turns: life?.turns ?? 0,
    myTurn: !!view && seat !== null && view.activeSeat === seat,
    legal: new Set(legal.map((entry) => entry.action)),
    pending: pending?.kind ?? null,
    resolved: extras?.resolved?.kind ?? null,
    paydayDue: money?.paydayDue ?? false,
    cashMinor: money?.summary.cashMinor ?? 0,
    reserveMinor: money?.summary.reserveMinor ?? 0,
    bankLoanMinor: money?.summary.bankLoanMinor ?? 0,
    dreamSavedMinor: money?.summary.dreamSavedMinor ?? 0,
    plans: money?.summary.plans.length ?? 0,
    smileCount: money?.summary.smile.length ?? 0,
    dom,
  };
}

/** The steps, in the order of the story: the table, then the game screen. */
export const DEMO_STEPS: DemoStep[] = [...table(), ...GAME_STEPS];

function table(): DemoStep[] {
  return [
    // ── the lobby: find the way to a table ──
    {
      id: 'welcome',
      screen: 'lobby',
      chapter: 'table',
      next: 'button',
      place: 'center',
    },
    {
      id: 'lobby-open',
      screen: 'lobby',
      chapter: 'table',
      target: '#addbtn',
      next: 'event',
      done: (c) => c.screen !== 'lobby' || c.dom('.at-panel'),
      assist: 'click:#addbtn',
    },
    // ── the new-table panel ──
    {
      id: 'add-name',
      screen: 'lobby',
      chapter: 'table',
      target: '[data-demo="at-name"]',
      next: 'button',
    },
    {
      id: 'add-ranked',
      screen: 'lobby',
      chapter: 'table',
      target: '[data-demo="at-ranked"]',
      next: 'button',
    },
    {
      id: 'add-difficulty',
      screen: 'lobby',
      chapter: 'table',
      target: '[data-demo="at-difficulty"]',
      next: 'button',
    },
    {
      id: 'add-open',
      screen: 'lobby',
      chapter: 'table',
      target: '[data-demo="at-open"]',
      next: 'event',
      done: (c) => c.screen !== 'lobby',
      assist: 'click:[data-demo="at-open"]',
    },
    // ── the waiting room ──
    {
      id: 'room-settings',
      screen: 'room',
      chapter: 'table',
      target: '[data-demo="wr-settings"]',
      next: 'button',
    },
    {
      id: 'room-bot',
      screen: 'room',
      chapter: 'table',
      target: '[data-demo="wr-add-bot"]',
      next: 'event',
      done: (c) => c.dom('[data-demo="wr-bots"]') || c.coachSeated,
      assist: 'click:[data-demo="wr-add-bot"]',
    },
    {
      id: 'room-coach',
      screen: 'room',
      chapter: 'table',
      target: '[data-demo="bot-coach"]',
      next: 'event',
      done: (c) => c.coachSeated,
      assist: 'click:[data-demo="bot-coach"] .tx-btn--primary',
    },
    {
      id: 'room-fixed',
      screen: 'room',
      chapter: 'table',
      target: '[data-demo="wr-settings"]',
      next: 'button',
    },
    {
      id: 'room-start',
      screen: 'room',
      chapter: 'table',
      target: '[data-demo="wr-start"]',
      next: 'event',
      done: (c) => c.phase === 'briefing' || c.phase === 'playing',
      assist: 'click:[data-demo="wr-start"]',
    },
  ];
}

const EN: Record<string, DemoText> = {
  ...GAME_EN,
  welcome: {
    title: 'Welcome to the guided demo',
    text: 'In about fifteen minutes you play the first rounds of Dreamfund against a friendly bot - with fixed dice and fixed cards, so I can tell you exactly what comes next. It is the real game. You can stop any time with **Stop tutorial** and play for real.',
  },
  'lobby-open': {
    title: 'Every game starts at a table',
    text: 'This is the lobby: the open tables, your own tables and the leaderboard. To play you open a table. Press the **+**.',
  },
  'add-name': {
    title: 'Name your table',
    text: 'Any name will do - or leave it empty and the lobby picks one. Other players see it in the list.',
  },
  'add-ranked': {
    title: 'Ranked is off',
    text: 'A **ranked** game counts for your rating on the leaderboard. The demo never does, so it is switched off. Later, when you play for real, switch it on to climb the board.',
  },
  'add-difficulty': {
    title: 'The difficulty',
    text: 'Easy, Normal or Hard change the numbers of the character and the cards - and the stake of the rating. The demo plays on **Normal**.',
  },
  'add-open': {
    title: 'Open the table',
    text: 'The other settings - the map, the rules, the clock - are fine as they are. Press **Open the table**.',
  },
  'room-settings': {
    title: 'Your table',
    text: 'This is the waiting room. The chips show the rules of the table: ranked or friendly, how many seats, the difficulty, the map, how the game ends. You change them with **Change settings** until the game starts.',
  },
  'room-bot': {
    title: 'Seat a bot',
    text: 'A table needs two seats. Press **Add a bot** to see who can sit down with you.',
  },
  'room-coach': {
    title: 'Pick Coach',
    text: '**Coach** is your guide: a steady, friendly player. When Coach sits down, the table becomes the guided demo - press **Add to the table**.',
  },
  'room-fixed': {
    title: 'The demo table',
    text: 'See: the settings are now fixed - one seat for you, one for Coach, a fixed map, **friendly** (not ranked), Normal. And you will play **Jonas**, a dual student of computer science who dreams of becoming a mountain guide.',
  },
  'room-start': {
    title: 'Start the game',
    text: 'Everybody is ready. Press **Start the game**.',
  },
};

const DE: Record<string, DemoText> = {
  ...GAME_DE,
  welcome: {
    title: 'Willkommen zur geführten Demo',
    text: 'In etwa fünfzehn Minuten spielst du die ersten Runden Traumtopf gegen einen freundlichen Bot - mit festen Würfen und festen Karten, damit ich dir genau sagen kann, was kommt. Es ist das echte Spiel. Mit **Tutorial beenden** kannst du jederzeit aufhören und richtig spielen.',
  },
  'lobby-open': {
    title: 'Jedes Spiel beginnt an einem Tisch',
    text: 'Das ist die Lobby: die offenen Tische, deine eigenen Tische und die Bestenliste. Zum Spielen eröffnest du einen Tisch. Drücke das **+**.',
  },
  'add-name': {
    title: 'Gib dem Tisch einen Namen',
    text: 'Irgendein Name genügt - oder lass das Feld leer, dann wählt die Lobby einen. Andere Spieler sehen ihn in der Liste.',
  },
  'add-ranked': {
    title: 'Gewertet ist aus',
    text: 'Ein **gewertetes** Spiel zählt für deine Wertung in der Bestenliste. Die Demo nie, darum ist es ausgeschaltet. Wenn du später richtig spielst, schalte es ein, um aufzusteigen.',
  },
  'add-difficulty': {
    title: 'Die Schwierigkeit',
    text: 'Leicht, Normal oder Schwer ändern die Zahlen der Figur und der Karten - und den Einsatz der Wertung. Die Demo läuft auf **Normal**.',
  },
  'add-open': {
    title: 'Den Tisch eröffnen',
    text: 'Die anderen Einstellungen - Karte, Regeln, Uhr - passen so. Drücke **Tisch eröffnen**.',
  },
  'room-settings': {
    title: 'Dein Tisch',
    text: 'Das ist der Warteraum. Die Chips zeigen die Regeln des Tisches: gewertet oder freundschaftlich, wie viele Plätze, die Schwierigkeit, die Karte, wie das Spiel endet. Mit **Einstellungen ändern** änderst du sie bis zum Start.',
  },
  'room-bot': {
    title: 'Einen Bot setzen',
    text: 'Ein Tisch braucht zwei Plätze. Drücke **Bot hinzufügen**, um zu sehen, wer sich zu dir setzen kann.',
  },
  'room-coach': {
    title: 'Wähle Coach',
    text: '**Coach** ist dein Führer: ein ruhiger, freundlicher Spieler. Setzt er sich, wird der Tisch zur geführten Demo - drücke **Zum Tisch hinzufügen**.',
  },
  'room-fixed': {
    title: 'Der Demo-Tisch',
    text: 'Sieh: Die Einstellungen sind jetzt fest - ein Platz für dich, einer für Coach, eine feste Karte, **freundschaftlich** (nicht gewertet), Normal. Und du spielst **Jonas**, einen dualen Informatikstudenten, der Bergführer werden will.',
  },
  'room-start': {
    title: 'Das Spiel starten',
    text: 'Alle sind bereit. Drücke **Spiel starten**.',
  },
};

/** The words of a step in the language (English for any language that is not written yet). */
export function demoText(id: string, language: string): DemoText {
  const table = language.toLowerCase().startsWith('de') ? DE : EN;
  return table[id] ?? EN[id] ?? { title: id, text: '' };
}

/** The words of the coach's own buttons. */
export const DEMO_LABELS = {
  en: {
    next: 'Next',
    back: 'Back',
    stop: 'Stop tutorial',
    assist: 'Do it for me',
    step: 'Step',
    of: 'of',
    learn: 'Learn the game',
    stopConfirm: 'Stop the tutorial? The demo table is removed and you can play for real.',
    stopped: 'The tutorial is stopped - open a table and play.',
    finish: 'Finish',
    skip: 'Skip this step',
    chapters: {
      table: 'The table',
      meet: 'Meet Jonas',
      screen: 'The screen',
      turn: 'The first rounds',
    } as Record<string, string>,
  },
  de: {
    next: 'Weiter',
    back: 'Zurück',
    stop: 'Tutorial beenden',
    assist: 'Mach das für mich',
    step: 'Schritt',
    of: 'von',
    learn: 'Das Spiel lernen',
    stopConfirm:
      'Das Tutorial beenden? Der Demo-Tisch wird entfernt und du kannst richtig spielen.',
    stopped: 'Das Tutorial ist beendet - eröffne einen Tisch und spiele.',
    finish: 'Fertig',
    skip: 'Schritt überspringen',
    chapters: {
      table: 'Der Tisch',
      meet: 'Triff Jonas',
      screen: 'Der Bildschirm',
      turn: 'Die ersten Runden',
    } as Record<string, string>,
  },
};

export function demoLabels(language: string): typeof DEMO_LABELS.en {
  return language.toLowerCase().startsWith('de') ? DEMO_LABELS.de : DEMO_LABELS.en;
}
