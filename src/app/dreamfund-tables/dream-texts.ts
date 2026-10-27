import { CASHFLOW_GAME_SETS } from '../shared/cashflow-content';
import type { DreamEventLine } from './dream-session.service';

/**
 * The words of the Dreamfund tables (like the classic tables' own: not the app's i18n JSON). English and German are written; another
 * language shows English until it is translated. The cards and the characters come from the game's own content, in the table's language.
 */

export interface DreamTexts {
  title: string;
  newTable: string;
  openTables: string;
  myTables: string;
  recentTables: string;
  noTables: string;
  joinWithCode: string;
  code: string;
  join: string;
  back: string;
  create: string;
  tableName: string;
  visibility: string;
  publicTable: string;
  privateTable: string;
  seats: string;
  difficulty: string;
  easy: string;
  medium: string;
  hard: string;
  easyHint: string;
  mediumHint: string;
  hardHint: string;
  map: string;
  shape: string;
  size: string;
  small: string;
  mediumSize: string;
  large: string;
  mode: string;
  guided: string;
  strict: string;
  characters: string;
  duplicates: string;
  unique: string;
  random: string;
  turnOrder: string;
  orderRandom: string;
  orderSeat: string;
  clock: string;
  clockNone: string;
  clockPerMove: string;
  clockBank: string;
  seconds: string;
  endCondition: string;
  firstWin: string;
  allDone: string;
  roundLimit: string;
  rounds: string;
  spectators: string;
  pace: string;
  fast: string;
  normal: string;
  slow: string;
  lobby: string;
  picking: string;
  playing: string;
  finished: string;
  closed: string;
  ready: string;
  notReady: string;
  start: string;
  leave: string;
  addBot: string;
  strategy: string;
  level: string;
  master: string;
  strong: string;
  casual: string;
  beginner: string;
  kick: string;
  host: string;
  invite: string;
  pick: string;
  pickCharacter: string;
  round: string;
  yourTurn: string;
  onTheMove: string;
  roll: string;
  endTurn: string;
  skip: string;
  payNow: string;
  payPlan: string;
  payDay: string;
  accept: string;
  decline: string;
  pass: string;
  take: string;
  cost: string;
  perMonth: string;
  points: string;
  cash: string;
  reserve: string;
  debts: string;
  dream: string;
  independence: string;
  passive: string;
  expenses: string;
  cashflow: string;
  netWorth: string;
  bankLoan: string;
  holdings: string;
  plans: string;
  goals: string;
  score: string;
  month: string;
  money: string;
  putInReserve: string;
  putInDream: string;
  repay: string;
  repayBank: string;
  amount: string;
  sell: string;
  offerTrade: string;
  price: string;
  to: string;
  everyone: string;
  withdraw: string;
  counter: string;
  harvest: string;
  sellIntoMarket: string;
  buyerOffers: string;
  ride: string;
  cashOut: string;
  markets: string;
  history: string;
  result: string;
  winner: string;
  rank: string;
  won: string;
  bankrupt: string;
  left: string;
  away: string;
  bot: string;
  connection: string;
  reconnecting: string;
  chooseHow: string;
  option: string;
  chooseBranch: string;
  chooseDream: string;
  choosePile: string;
  seed: string;
  sapling: string;
  tree: string;
  seedHint: string;
  saplingHint: string;
  treeHint: string;
  nothingToDecide: string;
  waiting: string;
  settleMonth: string;
  watch: string;
  closeTable: string;
  confirmClose: string;
  levelHint: string;
  classicLink: string;
}

const EN: DreamTexts = {
  title: 'Dreamfund tables',
  newTable: 'Open a table',
  openTables: 'Open tables',
  myTables: 'My tables',
  recentTables: 'Finished tables',
  noTables: 'No tables here yet.',
  joinWithCode: 'Join with a code',
  code: 'Invite code',
  join: 'Join',
  back: 'Back',
  create: 'Open the table',
  tableName: 'Name of the table',
  visibility: 'Who can see it',
  publicTable: 'Public',
  privateTable: 'Private (invite code)',
  seats: 'Seats',
  difficulty: 'Difficulty',
  easy: 'Easy',
  medium: 'Normal',
  hard: 'Hard',
  easyHint:
    'A good place to start, also for children: round numbers, fewer lines in the budget, friendlier cards.',
  mediumHint: 'For everyone: a realistic budget and cards with real prices.',
  hardHint: 'A real challenge: everything is tight, mistakes hurt, it takes a strategy and luck.',
  map: 'The map',
  shape: 'Shape',
  size: 'Size',
  small: 'Small',
  mediumSize: 'Medium',
  large: 'Large',
  mode: 'Rules',
  guided: 'Guided',
  strict: 'Strict',
  characters: 'Characters',
  duplicates: 'Everybody picks, the same character may be played twice',
  unique: 'Everybody picks, each character only once',
  random: 'Everybody gets a random character',
  turnOrder: 'Turn order',
  orderRandom: 'Random',
  orderSeat: 'As they sat down',
  clock: 'Clock',
  clockNone: 'No clock',
  clockPerMove: 'Time per turn',
  clockBank: 'Chess clock',
  seconds: 'seconds',
  endCondition: 'The game ends',
  firstWin: 'when the first player reaches all goals',
  allDone: 'when nobody is still playing',
  roundLimit: 'after a number of rounds (ranked by goals and dream points)',
  rounds: 'rounds',
  spectators: 'Others may watch',
  pace: 'Pace of the bots',
  fast: 'Fast',
  normal: 'Normal',
  slow: 'Slow',
  lobby: 'In the lobby',
  picking: 'Choosing characters',
  playing: 'Playing',
  finished: 'Finished',
  closed: 'Closed',
  ready: 'Ready',
  notReady: 'Not ready',
  start: 'Start the game',
  leave: 'Leave',
  addBot: 'Seat a bot',
  strategy: 'Strategy',
  level: 'Skill',
  master: 'Master',
  strong: 'Strong',
  casual: 'Casual',
  beginner: 'Beginner',
  kick: 'Remove',
  host: 'Host',
  invite: 'Invite code',
  pick: 'Pick',
  pickCharacter: 'Pick your character',
  round: 'Round',
  yourTurn: 'Your turn',
  onTheMove: 'is on the move',
  roll: 'Roll the dice',
  endTurn: 'End the turn',
  skip: 'Leave it',
  payNow: 'Pay now',
  payPlan: 'Pay over',
  payDay: 'Paydays',
  accept: 'Accept',
  decline: 'Decline',
  pass: 'Pass',
  take: 'Take',
  cost: 'Costs',
  perMonth: 'a month',
  points: 'points',
  cash: 'Cash',
  reserve: 'Reserve',
  debts: 'Debts',
  dream: 'Dream',
  independence: 'Independence',
  passive: 'Passive income',
  expenses: 'Cost of living',
  cashflow: 'Cash flow',
  netWorth: 'Net worth',
  bankLoan: 'Bank loan',
  holdings: 'What you own',
  plans: 'Payment plans',
  goals: 'Goals',
  score: 'Score',
  month: 'Month',
  money: 'Your money',
  putInReserve: 'Into the reserve',
  putInDream: 'Into the dream',
  repay: 'Pay off',
  repayBank: 'Repay the Bank loan',
  amount: 'Amount',
  sell: 'Sell',
  offerTrade: 'Offer to the others',
  price: 'Price',
  to: 'To',
  everyone: 'Everyone',
  withdraw: 'Withdraw',
  counter: 'Counter offer',
  harvest: 'The market moved',
  sellIntoMarket: 'Sell into the market',
  buyerOffers: 'A buyer offers',
  ride: 'Ride the hype',
  cashOut: 'Cash out',
  markets: 'Markets',
  history: 'What happened',
  result: 'The result',
  winner: 'Winner',
  rank: 'Place',
  won: 'Won',
  bankrupt: 'Bankrupt',
  left: 'Left',
  away: 'away',
  bot: 'bot',
  connection: 'Connection',
  reconnecting: 'Reconnecting...',
  chooseHow: 'Choose how to deal with it',
  option: 'Option',
  chooseBranch: 'Choose your path',
  chooseDream: 'A dream to take',
  choosePile: 'Which pile do you draw from?',
  seed: 'Seed',
  sapling: 'Sapling',
  tree: 'Tree',
  seedHint: 'Small and cheap',
  saplingHint: 'Businesses and shares',
  treeHint: 'Big property and companies',
  nothingToDecide: 'Nothing to decide.',
  waiting: 'Waiting for the others...',
  settleMonth: 'Done with the month',
  watch: 'Watch',
  closeTable: 'Close the table',
  confirmClose: 'Closing the table ends it for everyone. Close it?',
  levelHint: 'The lower the skill, the more often a bot slips.',
  classicLink: 'Classic tables',
};

const DE: Partial<DreamTexts> = {
  title: 'Traumtopf-Tische',
  newTable: 'Tisch eröffnen',
  openTables: 'Offene Tische',
  myTables: 'Meine Tische',
  recentTables: 'Beendete Tische',
  noTables: 'Noch keine Tische.',
  joinWithCode: 'Mit Code beitreten',
  code: 'Einladungscode',
  join: 'Beitreten',
  back: 'Zurück',
  create: 'Tisch eröffnen',
  tableName: 'Name des Tisches',
  visibility: 'Wer ihn sieht',
  publicTable: 'Öffentlich',
  privateTable: 'Privat (Einladungscode)',
  seats: 'Plätze',
  difficulty: 'Schwierigkeit',
  easy: 'Leicht',
  medium: 'Normal',
  hard: 'Schwer',
  easyHint:
    'Ein guter Einstieg, auch für Kinder: runde Zahlen, weniger Zeilen im Budget, freundlichere Karten.',
  mediumHint: 'Für alle: ein realistisches Budget und Karten mit echten Preisen.',
  hardHint:
    'Eine echte Herausforderung: alles ist knapp, Fehler tun weh, es braucht Strategie und Glück.',
  map: 'Die Karte',
  shape: 'Form',
  size: 'Größe',
  small: 'Klein',
  mediumSize: 'Mittel',
  large: 'Groß',
  mode: 'Regeln',
  guided: 'Geführt',
  strict: 'Streng',
  characters: 'Charaktere',
  duplicates: 'Alle wählen, derselbe Charakter darf doppelt gespielt werden',
  unique: 'Alle wählen, jeder Charakter nur einmal',
  random: 'Alle bekommen einen zufälligen Charakter',
  turnOrder: 'Reihenfolge',
  orderRandom: 'Zufällig',
  orderSeat: 'Wie sie sich gesetzt haben',
  clock: 'Uhr',
  clockNone: 'Keine Uhr',
  clockPerMove: 'Zeit pro Zug',
  clockBank: 'Schachuhr',
  seconds: 'Sekunden',
  endCondition: 'Das Spiel endet',
  firstWin: 'wenn der Erste alle Ziele erreicht',
  allDone: 'wenn niemand mehr spielt',
  roundLimit: 'nach einer Anzahl Runden (Rang nach Zielen und Traumpunkten)',
  rounds: 'Runden',
  spectators: 'Andere dürfen zuschauen',
  pace: 'Tempo der Bots',
  fast: 'Schnell',
  normal: 'Normal',
  slow: 'Langsam',
  lobby: 'In der Lobby',
  picking: 'Charakterwahl',
  playing: 'Im Spiel',
  finished: 'Beendet',
  closed: 'Geschlossen',
  ready: 'Bereit',
  notReady: 'Nicht bereit',
  start: 'Spiel starten',
  leave: 'Verlassen',
  addBot: 'Einen Bot setzen',
  strategy: 'Strategie',
  level: 'Können',
  master: 'Meister',
  strong: 'Stark',
  casual: 'Locker',
  beginner: 'Anfänger',
  kick: 'Entfernen',
  host: 'Gastgeber',
  invite: 'Einladungscode',
  pick: 'Wählen',
  pickCharacter: 'Wähle deinen Charakter',
  round: 'Runde',
  yourTurn: 'Du bist dran',
  onTheMove: 'ist am Zug',
  roll: 'Würfeln',
  endTurn: 'Zug beenden',
  skip: 'Lassen',
  payNow: 'Jetzt zahlen',
  payPlan: 'Zahlen über',
  payDay: 'Zahltage',
  accept: 'Annehmen',
  decline: 'Ablehnen',
  pass: 'Passen',
  take: 'Nehmen',
  cost: 'Kostet',
  perMonth: 'im Monat',
  points: 'Punkte',
  cash: 'Kasse',
  reserve: 'Notgroschen',
  debts: 'Schulden',
  dream: 'Traum',
  independence: 'Unabhängigkeit',
  passive: 'Passives Einkommen',
  expenses: 'Lebenshaltung',
  cashflow: 'Cashflow',
  netWorth: 'Vermögen',
  bankLoan: 'Bankkredit',
  holdings: 'Was dir gehört',
  plans: 'Zahlpläne',
  goals: 'Ziele',
  score: 'Punktzahl',
  month: 'Monat',
  money: 'Dein Geld',
  putInReserve: 'In den Notgroschen',
  putInDream: 'In den Traum',
  repay: 'Abbezahlen',
  repayBank: 'Bankkredit zurückzahlen',
  amount: 'Betrag',
  sell: 'Verkaufen',
  offerTrade: 'Den anderen anbieten',
  price: 'Preis',
  to: 'An',
  everyone: 'Alle',
  withdraw: 'Zurückziehen',
  counter: 'Gegenangebot',
  harvest: 'Der Markt hat sich bewegt',
  sellIntoMarket: 'In den Markt verkaufen',
  buyerOffers: 'Ein Käufer bietet',
  ride: 'Den Hype reiten',
  cashOut: 'Auszahlen',
  markets: 'Märkte',
  history: 'Was geschah',
  result: 'Das Ergebnis',
  winner: 'Sieger',
  rank: 'Platz',
  won: 'Gewonnen',
  bankrupt: 'Pleite',
  left: 'Gegangen',
  away: 'abwesend',
  bot: 'Bot',
  reconnecting: 'Verbindung wird wiederhergestellt...',
  chooseHow: 'Wähle, wie du damit umgehst',
  option: 'Möglichkeit',
  chooseBranch: 'Wähle deinen Weg',
  chooseDream: 'Ein Traum zum Mitnehmen',
  choosePile: 'Von welchem Stapel ziehst du?',
  seed: 'Samen',
  sapling: 'Setzling',
  tree: 'Baum',
  seedHint: 'Klein und günstig',
  saplingHint: 'Geschäfte und Aktien',
  treeHint: 'Große Immobilien und Firmen',
  nothingToDecide: 'Nichts zu entscheiden.',
  waiting: 'Warten auf die anderen...',
  settleMonth: 'Monat erledigt',
  watch: 'Achtung',
  closeTable: 'Tisch schließen',
  confirmClose: 'Das Schließen beendet den Tisch für alle. Schließen?',
  levelHint: 'Je niedriger das Können, desto öfter patzt ein Bot.',
  classicLink: 'Klassische Tische',
};

export function dreamTexts(lang: string): DreamTexts {
  return lang === 'de' ? { ...EN, ...DE } : EN;
}

// ── the game's own content ──

const set = CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');
type Localized = Record<string, string | undefined>;
interface Card {
  id: string;
  title: Localized;
  story?: Localized;
  choices?: { id: string; label?: Localized }[];
}

const text = (value: Localized | undefined, lang: string) => value?.[lang] ?? value?.['en'] ?? '';

/** A card of a pile by its id, in the table's language: its title and story. */
export function cardText(
  deck: 'emergency' | 'life' | 'dream' | 'opportunity',
  id: string,
  lang: string,
): { title: string; story: string } {
  const cards = ((set?.decks as unknown as Record<string, Card[]> | undefined)?.[deck] ??
    []) as Card[];
  const card = cards.find((candidate) => candidate.id === id);
  return { title: text(card?.title, lang) || id, story: text(card?.story, lang) };
}

/** A card's choices (an emergency may ask how to deal with it), with their labels. */
export function choicesOf(id: string, lang: string): { id: string; label: string }[] {
  const cards = ((set?.decks as unknown as Record<string, Card[]> | undefined)?.['emergency'] ??
    []) as Card[];
  const card = cards.find((candidate) => candidate.id === id);
  return (card?.choices ?? []).map((choice) => ({
    id: choice.id,
    label: text(choice.label, lang) || choice.id,
  }));
}

/** The characters of the edition (the Normal version of each) with their name and tagline. */
export function characters(lang: string): { id: string; name: string; tagline: string }[] {
  return (set?.professions ?? [])
    .filter((profession) => !profession.variantOf)
    .map((profession) => {
      const profile = profession.profile?.texts[lang] ?? profession.profile?.texts['en'];
      return {
        id: profession.id,
        name: profile?.name ?? profession.title,
        tagline: profile?.tagline ?? '',
      };
    });
}

export const characterName = (id: string | null, lang: string) =>
  characters(lang).find((c) => c.id === id)?.name ?? '';

/** Money of the game: Dream Taler (Traumtaler in German), whole units. */
export function dreamMoney(minor: number, lang: string): string {
  const units = Math.round(minor / 100);
  return `${units.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')} ${lang === 'de' ? 'TT' : 'DT'}`;
}

/** One line of the history, in words. */
export function eventText(
  line: DreamEventLine,
  names: string[],
  lang: string,
  money: (minor: number) => string,
): string {
  const who = line.seat !== null && line.seat !== undefined ? (names[line.seat] ?? '') : '';
  const d = line.data ?? {};
  const de = lang === 'de';
  const card = (deck: 'opportunity', id: unknown) => cardText(deck, String(id), lang).title;
  switch (line.type) {
    case 'play_started':
      return de ? 'Das Spiel beginnt.' : 'The game begins.';
    case 'round_started':
      return de ? `Runde ${d['round']}` : `Round ${d['round']}`;
    case 'turn_started':
      return de ? `${who} ist am Zug.` : `${who} is on the move.`;
    case 'rolled':
      return de
        ? `${who} würfelt und landet auf: ${d['landed']}.`
        : `${who} rolls and lands on: ${d['landed']}.`;
    case 'payday':
      return de ? `${who}: Zahltag.` : `${who}: Payday.`;
    case 'emergency':
      return de ? `${who}: ein Notfall.` : `${who}: an emergency.`;
    case 'life':
      return de ? `${who}: das Leben spielt mit.` : `${who}: life happens.`;
    case 'career':
      return de ? `${who}: die Karriere.` : `${who}: the career tile.`;
    case 'dream':
      return de ? `${who}: ein Traum.` : `${who}: a dream.`;
    case 'opportunity':
      return de ? `${who}: eine Gelegenheit.` : `${who}: an opportunity.`;
    case 'opportunity_taken':
      return de
        ? `${who} nimmt ${card('opportunity', d['cardId'])} (${money(Number(d['costMinor']))}).`
        : `${who} takes ${card('opportunity', d['cardId'])} (${money(Number(d['costMinor']))}).`;
    case 'harvest':
      return de
        ? `Die Märkte bewegen sich (${d['cardId']}).`
        : `The markets move (${d['cardId']}).`;
    case 'money_moved':
      return de ? `${who} bewegt Geld (${d['what']}).` : `${who} moves money (${d['what']}).`;
    case 'holding_sold':
      return de ? `${who} verkauft ${d['holding']}.` : `${who} sells ${d['holding']}.`;
    case 'trade_offered':
      return de
        ? `${who} bietet ${d['holding']} für ${money(Number(d['priceMinor']))} an.`
        : `${who} offers ${d['holding']} for ${money(Number(d['priceMinor']))}.`;
    case 'trade_made':
      return de
        ? `Handel: ${d['holding']} für ${money(Number(d['priceMinor']))}.`
        : `Trade: ${d['holding']} for ${money(Number(d['priceMinor']))}.`;
    case 'trade_declined':
      return de ? `${who} lehnt das Angebot ab.` : `${who} declines the offer.`;
    case 'trade_countered':
      return de ? `${who} macht ein Gegenangebot.` : `${who} makes a counter offer.`;
    case 'trade_expired':
      return de ? 'Das Angebot ist verfallen.' : 'The offer expired.';
    case 'trade_withdrawn':
      return de ? 'Das Angebot wurde zurückgezogen.' : 'The offer was withdrawn.';
    case 'goal_reached':
      return de
        ? `${who} erreicht das Ziel: ${d['goal']}.`
        : `${who} reaches a goal: ${d['goal']}.`;
    case 'player_won':
      return de ? `${who} hat gewonnen!` : `${who} has won!`;
    case 'player_bankrupt':
      return de ? `${who} ist pleite.` : `${who} is bankrupt.`;
    case 'player_away':
      return de ? `${who} ist abwesend.` : `${who} is away.`;
    case 'turn_timeout':
      return de ? `${who}: die Zeit ist um.` : `${who}: time is up.`;
    case 'game_finished':
      return de ? 'Das Spiel ist zu Ende.' : 'The game is over.';
    default:
      return '';
  }
}

/** What a Life card asks of the player: which answers it takes. */
export function lifeCardOf(
  id: string,
  lang: string,
): {
  type: string;
  optional: boolean;
  options: { id: string; label: string }[];
  title: string;
  story: string;
} {
  const cards = ((set?.decks as unknown as Record<string, unknown[]> | undefined)?.['life'] ??
    []) as {
    id: string;
    type: string;
    optional?: boolean;
    title?: Localized;
    story?: Localized;
    options?: { id: string; label?: Localized }[];
    give?: unknown;
    lend?: unknown;
  }[];
  const card = cards.find((candidate) => candidate.id === id);
  return {
    type: card?.type ?? 'choice',
    optional: card?.optional === true,
    options: (card?.options ?? []).map((o) => ({ id: o.id, label: text(o.label, lang) || o.id })),
    title: text(card?.title, lang) || id,
    story: text(card?.story, lang),
  };
}
