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
  howPoints: string;
  planPerPayday: string;
  takeCharacter: string;
  briefingTitle: string;
  debugTitle: string;
  debugHint: string;
  debugRandom: string;
  debugSearch: string;
  harvestAffected: string;
  debugGame: string;
  debugGameHint: string;
  bankStep: string;
  bankStepHint: string;
  bankStepStandard: string;
  bankStepFree: string;
  bankInterest: string;
  bankInterestHint: string;
  jobTitle: string;
  jobChances: string;
  jobThrow: string;
  jobFound: string;
  jobMissed: string;
  jobFallback: string;
  briefingIntro: string;
  briefingInsurance: string;
  briefingInsuranceHint: string;
  briefingHeld: string;
  briefingNotHeld: string;
  briefingStart: string;
  briefingWaiting: string;
  briefingWaitingFor: string;
  briefingBack: string;
  characterTaken: string;
  characterRandom: string;
  dreamPointsTitle: string;
  dreamPointsHint: string;
  dreamPointsOffHint: string;
  dreamPointsGoal: string;
  dreamPointsUnit: string;
  dreamPointsAlone: string;
  dreamOffersTitle: string;
  dreamOffersHint: string;
  dreamOffersChance: string;
  groupDreams: string;
  maxOpenTitle: string;
  maxOpenHint: string;
  sellValidTitle: string;
  sellValidHint: string;
  sellValidTurns: string;
  editRefused: string;
  maxOpenNoLimit: string;
  characterChoose: string;
  characterCashflow: string;
  characterKeep: string;
  characterHeld: string;
  modeFriendsHint: string;
  boardHint: string;
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
  gameChoice: string;
  gameClassic: string;
  gameDream: string;
  gameClassicHint: string;
  gameDreamHint: string;
  leaderboard: string;
  rating: string;
  games: string;
  tableWins: string;
  avgPlace: string;
  showMe: string;
  provisional: string;
  rankedGame: string;
  rankedHint: string;
  everybody: string;
  people: string;
  bots: string;
  noPlayers: string;
  myRatings: string;
  nameCol: string;
  placeCol: string;
  recent: string;
  counted: string;
  notCounted: string;
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
  howPoints: 'How the points are worked out',
  planPerPayday: 'Set aside at every Payday',
  takeCharacter: 'Take this character',
  briefingTitle: 'Who you are',
  debugTitle: 'Debug: choose the card',
  debugHint: 'You landed on this tile. Choose the card it deals, or let chance decide.',
  debugRandom: 'A random card',
  debugSearch: 'Search a card',
  harvestAffected:
    'This Harvest card affects you this turn: the markets are open to sell into, or a buyer has made an offer (see the money panel). It is only valid until this turn ends - press Continue when you have dealt with it.',
  debugGame: 'Debug game',
  debugGameHint:
    'For finding what is wrong with the cards: the host chooses the card of every tile they land on. Everybody else plays as usual. Never ranked.',
  bankStep: 'Bank loan: step',
  bankStepHint:
    'You borrow and repay in steps of this size. Standard is the own step of the character; Free is any amount.',
  bankStepStandard: 'Standard',
  bankStepFree: 'Free',
  bankInterest: 'Bank loan: interest a month',
  bankInterestHint: 'What the loan costs every month, as a share of what is borrowed.',
  jobTitle: 'Looking for a job',
  jobChances:
    'At this Payday you look for a new job. Throw {from} or more and you find one; if not you keep looking - {left} more Paydays, then the next offer pays less.',
  jobThrow: 'Throw the die',
  jobFound: 'You found a job again.',
  jobMissed: 'Missed - you are still without a job.',
  jobFallback: 'The search is over: you take a job that pays less.',
  briefingIntro:
    'Read your character before the game begins: the story, what matters to them, the goals, the income, the expenses and the debts. Choose your insurances - they count at once.',
  briefingInsurance: 'Your insurances',
  briefingInsuranceHint:
    'A premium is paid every Payday; an insured emergency costs only the deductible.',
  briefingHeld: 'Insured',
  briefingNotHeld: 'Not insured',
  briefingStart: 'I know who I am - start',
  briefingWaiting: 'Ready - waiting for the others',
  briefingWaitingFor: 'Still reading:',
  briefingBack: 'Choose another character',
  characterTaken: 'This is your character',
  characterRandom: 'A random character',
  dreamPointsTitle: 'Play for dream points',
  dreamPointsHint:
    'Besides your life dream you have to live other dreams until you have the points: small dreams are worth little, big ones a lot. The map has Smile tiles to find them.',
  dreamPointsOffHint:
    'A short game for the life dream alone: nothing else to collect, and the map has no Smile tiles.',
  dreamPointsGoal: 'Dream points to win',
  dreamPointsUnit: 'dream points',
  dreamPointsAlone: 'Life dream only',
  dreamOffersTitle: 'Dreams at a Smile tile',
  dreamOffersHint: 'How many dreams a landing offers: one, two, or one or two by chance.',
  dreamOffersChance: '1 or 2',
  groupDreams: 'Dreams',
  maxOpenTitle: 'Dreams open at once',
  maxOpenHint:
    'How many dreams a player can have open in parallel; no limit lets everybody take as many as they like.',
  maxOpenNoLimit: 'No limit',
  sellValidTitle: 'How long a sell offer stays open',
  sellValidHint:
    'A Harvest card that opens the market or brings a buyer makes an offer for the things you own. It stays open for this many of your own turns - then the deal is off and life goes on.',
  sellValidTurns: 'turns',
  editRefused:
    'The amount, the date and the comment of a booking belong to the game and cannot be changed. The category, the time and the account can.',
  characterChoose: 'Who do you want to be?',
  characterCashflow: 'Cashflow',
  characterKeep: 'Keep the character I was dealt',
  characterHeld: 'taken',
  modeFriendsHint:
    'Guided helps you learn the game with friends. A ranked game is always played strict.',
  boardHint:
    'Only ranked games count: finished, with a person at the table and at least 8 rounds (or a winner). Beating strong players earns more; a win on Hard earns 1.5 x the points, on Easy 0.7 x.',
  easyHint:
    'A good place to start, also for children: round numbers, fewer lines in the budget, friendlier cards. Ranked wins earn 0.7 x the points.',
  mediumHint:
    'For everyone: a realistic budget and cards with real prices. Ranked wins earn the normal points.',
  hardHint:
    'A real challenge: everything is tight, mistakes hurt, it takes a strategy and luck. Ranked wins earn 1.5 x the points.',
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
  money: 'At the table',
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
  gameChoice: 'Game',
  gameClassic: 'Classic',
  gameDream: 'Dreamfund',
  gameClassicHint: 'The Cashflow game on the classic board.',
  gameDreamHint:
    'The Dreamfund: your dream, the card stacks and the maps of the solo game, played together.',
  leaderboard: 'Leaderboard',
  rating: 'Rating',
  games: 'Games',
  tableWins: 'Wins',
  avgPlace: 'Avg. place',
  showMe: 'Show me on the board',
  provisional: 'provisional',
  rankedGame: 'Ranked game (counts for the leaderboard)',
  rankedHint:
    'A ranked game counts when somebody won or at least eight rounds were played, and a person sat at it.',
  everybody: 'Everybody',
  people: 'People',
  bots: 'Bots',
  noPlayers: 'Nobody has played a ranked game at this difficulty yet.',
  myRatings: 'My ratings',
  nameCol: 'Player',
  placeCol: 'Place',
  recent: 'Last games',
  counted: 'counted',
  notCounted: 'did not count',
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
  howPoints: 'So werden die Punkte berechnet',
  planPerPayday: 'Bei jedem Zahltag zurücklegen',
  takeCharacter: 'Diesen Charakter wählen',
  briefingTitle: 'Wer du bist',
  debugTitle: 'Debug: Karte wählen',
  debugHint:
    'Du bist auf diesem Feld gelandet. Wähle die Karte, die es austeilt, oder lass den Zufall entscheiden.',
  debugRandom: 'Eine zufällige Karte',
  debugSearch: 'Karte suchen',
  harvestAffected:
    'Diese Ernte-Karte betrifft dich in diesem Zug: die Märkte sind offen zum Verkaufen, oder ein Käufer hat ein Angebot gemacht (siehe Geld-Panel). Sie gilt nur bis zum Ende dieses Zuges - drücke Weiter, wenn du damit fertig bist.',
  debugGame: 'Debug-Spiel',
  debugGameHint:
    'Um herauszufinden, was an den Karten nicht stimmt: Der Host wählt die Karte jedes Feldes, auf dem er landet. Alle anderen spielen wie gewohnt. Nie gewertet.',
  bankStep: 'Bankkredit: Schrittweite',
  bankStepHint:
    'Du leihst und zahlst in Schritten dieser Größe. Standard ist die Schrittweite des Charakters; Frei ist jeder Betrag.',
  bankStepStandard: 'Standard',
  bankStepFree: 'Frei',
  bankInterest: 'Bankkredit: Zinsen im Monat',
  bankInterestHint: 'Was der Kredit jeden Monat kostet, als Anteil des geliehenen Betrags.',
  jobTitle: 'Jobsuche',
  jobChances:
    'Am Zahltag suchst du eine neue Stelle. Wirf {from} oder mehr und du findest eine; sonst suchst du weiter - noch {left} Zahltage, dann zahlt das nächste Angebot weniger.',
  jobThrow: 'Würfeln',
  jobFound: 'Du hast wieder einen Job.',
  jobMissed: 'Verpasst - du bist weiter ohne Job.',
  jobFallback: 'Die Suche ist vorbei: Du nimmst eine Stelle, die weniger zahlt.',
  briefingIntro:
    'Lies deinen Charakter, bevor das Spiel beginnt: die Geschichte, was ihm wichtig ist, die Ziele, das Einkommen, die Ausgaben und die Schulden. Wähle deine Versicherungen - sie gelten sofort.',
  briefingInsurance: 'Deine Versicherungen',
  briefingInsuranceHint:
    'Die Prämie wird an jedem Zahltag gezahlt; ein versicherter Notfall kostet nur die Selbstbeteiligung.',
  briefingHeld: 'Versichert',
  briefingNotHeld: 'Nicht versichert',
  briefingStart: 'Ich weiß, wer ich bin - los',
  briefingWaiting: 'Bereit - wir warten auf die anderen',
  briefingWaitingFor: 'Lesen noch:',
  briefingBack: 'Anderen Charakter wählen',
  characterTaken: 'Das ist dein Charakter',
  characterRandom: 'Ein zufälliger Charakter',
  dreamPointsTitle: 'Um Traumpunkte spielen',
  dreamPointsHint:
    'Neben deinem Lebenstraum musst du weitere Träume leben, bis du die Punkte hast: kleine Träume zählen wenig, große viel. Auf der Karte findest du sie auf Smile-Feldern.',
  dreamPointsOffHint:
    'Ein kurzes Spiel nur um den Lebenstraum: nichts weiter zu sammeln, und die Karte hat keine Smile-Felder.',
  dreamPointsGoal: 'Traumpunkte zum Sieg',
  dreamPointsUnit: 'Traumpunkte',
  dreamPointsAlone: 'Nur der Lebenstraum',
  dreamOffersTitle: 'Träume auf einem Smile-Feld',
  dreamOffersHint: 'Wie viele Träume ein Feld anbietet: einen, zwei oder zufällig einen oder zwei.',
  dreamOffersChance: '1 oder 2',
  groupDreams: 'Träume',
  maxOpenTitle: 'Gleichzeitig offene Träume',
  maxOpenHint:
    'Wie viele Träume ein Spieler gleichzeitig offen haben kann; ohne Limit darf jeder so viele nehmen, wie er will.',
  maxOpenNoLimit: 'Kein Limit',
  sellValidTitle: 'Wie lange ein Verkaufsangebot offen bleibt',
  sellValidHint:
    'Eine Ernte-Karte, die den Markt öffnet oder einen Käufer bringt, macht ein Angebot für das, was du besitzt. Es bleibt so viele eigene Züge offen - dann ist das Geschäft vorbei und das Leben geht weiter.',
  sellValidTurns: 'Züge',
  editRefused:
    'Betrag, Datum und Kommentar einer Buchung gehören zum Spiel und lassen sich nicht ändern. Kategorie, Uhrzeit und Konto schon.',
  characterChoose: 'Wer willst du sein?',
  characterCashflow: 'Cashflow',
  characterKeep: 'Den zugeteilten Charakter behalten',
  characterHeld: 'vergeben',
  modeFriendsHint:
    'Geführt hilft beim Lernen mit Freunden. Ein gewertetes Spiel wird immer streng gespielt.',
  boardHint:
    'Nur gewertete Spiele zählen: beendet, mit einem Menschen am Tisch und mindestens 8 Runden (oder einem Sieger). Starke Gegner zu schlagen bringt mehr; ein Sieg auf Schwer das 1,5-fache der Punkte, auf Leicht das 0,7-fache.',
  easyHint:
    'Ein guter Einstieg, auch für Kinder: runde Zahlen, weniger Zeilen im Budget, freundlichere Karten. Gewertete Siege bringen das 0,7-fache der Punkte.',
  mediumHint:
    'Für alle: ein realistisches Budget und Karten mit echten Preisen. Gewertete Siege bringen die normalen Punkte.',
  hardHint:
    'Eine echte Herausforderung: alles ist knapp, Fehler tun weh, es braucht Strategie und Glück. Gewertete Siege bringen das 1,5-fache der Punkte.',
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
  money: 'Am Tisch',
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
  gameChoice: 'Spiel',
  gameClassic: 'Klassisch',
  gameDream: 'Traumtopf',
  gameClassicHint: 'Das Cashflow-Spiel auf dem klassischen Brett.',
  gameDreamHint:
    'Der Traumtopf: dein Traum, die Kartenstapel und die Karten des Solospiels, zusammen gespielt.',
  leaderboard: 'Bestenliste',
  rating: 'Wertung',
  games: 'Spiele',
  tableWins: 'Siege',
  avgPlace: 'Ø Platz',
  showMe: 'Mich in der Liste zeigen',
  provisional: 'vorläufig',
  rankedGame: 'Gewertetes Spiel (zählt für die Bestenliste)',
  rankedHint:
    'Ein gewertetes Spiel zählt, wenn jemand gewonnen hat oder mindestens acht Runden gespielt wurden und ein Mensch am Tisch saß.',
  everybody: 'Alle',
  people: 'Menschen',
  bots: 'Bots',
  noPlayers: 'Auf dieser Schwierigkeit hat noch niemand ein gewertetes Spiel gespielt.',
  myRatings: 'Meine Wertungen',
  nameCol: 'Spieler',
  placeCol: 'Platz',
  recent: 'Letzte Spiele',
  counted: 'gezählt',
  notCounted: 'nicht gezählt',
};

export function dreamTexts(lang: string): DreamTexts {
  return lang === 'de' ? { ...EN, ...DE } : EN;
}

// ── the game's own content ──

// looked up when it is asked: the content arrives after the first screen
const jfkSet = () => CASHFLOW_GAME_SETS.find((candidate) => candidate.id === 'jfk-stories');
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
  deck: 'emergency' | 'life' | 'dream' | 'opportunity' | 'harvest',
  id: string,
  lang: string,
): { title: string; story: string } {
  const cards = ((jfkSet()?.decks as unknown as Record<string, Card[]> | undefined)?.[deck] ??
    []) as Card[];
  const card = cards.find((candidate) => candidate.id === id);
  return { title: text(card?.title, lang) || id, story: text(card?.story, lang) };
}

/** A card's choices (an emergency may ask how to deal with it), with their labels. */
export function choicesOf(id: string, lang: string): { id: string; label: string }[] {
  const cards = ((jfkSet()?.decks as unknown as Record<string, Card[]> | undefined)?.[
    'emergency'
  ] ?? []) as Card[];
  const card = cards.find((candidate) => candidate.id === id);
  return (card?.choices ?? []).map((choice) => ({
    id: choice.id,
    label: text(choice.label, lang) || choice.id,
  }));
}

/** The characters of the edition (the Normal version of each) with their name and tagline. */
export function characters(lang: string): { id: string; name: string; tagline: string }[] {
  return (jfkSet()?.professions ?? [])
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
  const cards = ((jfkSet()?.decks as unknown as Record<string, unknown[]> | undefined)?.['life'] ??
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
