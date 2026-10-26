import type { OpportunityCard } from './opportunity-deck';
import type { HarvestCard } from './harvest-deck';
import type { PaymentDue } from './payments-due';
import type { OpportunityDeckState, OpportunityHolding } from './opportunity';
import type { HarvestPending } from './harvest';
import type { EmergencyCard, EmergencyDeckState, InsuranceKind, Localized } from './emergency-deck';
import type { CustomRules } from './custom-rules';
import type { DreamCard, DreamLog, DreamSettings } from './dream-deck';
import type { CareerResult, CareerSnapshot, CareerState, CareerTrack } from './career';
import type { LifeCard, LifeLine, LifeOutcome, LifeState, ScheduledLife } from './life-deck';
import type { BoardSetup } from './dreamfund-board';
import type { GameRules } from './rules';
/**
 * Types for the Cashflow (board game) MVP — see todo/cashflow-game.md for the
 * full plan. A "game set" is the pluggable physical edition/house-rules
 * catalog (professions, loan rule, later a card deck); it is static,
 * versioned data shipped in the codebase (`game-sets.ts`), never per-user
 * stored. `CashflowGameState` is the one new per-user storage path
 * (`data.cashflowGame`) — everything financial the game creates is a real
 * Subscription/Transaction/Asset/etc., not modeled here.
 */
import type { SubscriptionFrequency } from '../transactions/frequency-strategies';

export interface CashflowStarterKitSubscription {
  title: string;
  account: string;
  amountMinor: number;
  frequency: SubscriptionFrequency;
  category?: string;
  comment?: string;
}

export interface CashflowStarterKitEntry {
  tag: string;
  amountMinor: number;
  /** Stable, language-independent id for this entry — lets the frontend look up a translated label for it without touching `tag` itself, which stays the literal matching/linking value (todo/cashflow-game.md decision 48). Optional: a game set with no translations authored yet just falls back to `tag` as-is. */
  key?: string;
}

/**
 * A starting balance-sheet position — real estate, a mortgage/loan, a
 * position already owned — that isn't derived from `expenses`. Not needed
 * for a profession whose card has none (e.g. Hausmeister/in).
 */
export interface CashflowStarterKit {
  assets?: CashflowStarterKitEntry[];
  investments?: Array<CashflowStarterKitEntry & { depositMinor: number }>;
  shares?: Array<{ tag: string; quantity: number; priceMinor: number }>;
  /** The card's own "Verbindlichkeiten"/liabilities section — a balance-sheet fact, separate from the matching expense line's *payment* (see `CashflowProfession.expenses`). */
  liabilities?: CashflowStarterKitEntry[];
}

/**
 * One line of the profession card's "Ausgaben" (expenses) section — e.g.
 * `{ title: 'Eigenheim-Hypothek / Miete', amountMinor: 20000 }`. `title`
 * doubles as the real Subscription's title *and* its `@`-category
 * (JFK, 2026-09-26: "it could be exactly the name of the expense... we
 * have exactly these names with the correct amount"), so Budget/Stats can
 * break spending down the same way the card does. Positive, matching how
 * it's printed on the card — the engine negates it when posting.
 */
export interface CashflowExpenseLine {
  title: string;
  amountMinor: number;
  /** Stable, language-independent id for this line — lets the frontend look up a translated label without changing `title` itself, which stays the literal value used to build the real Subscription's title/category (todo/cashflow-game.md decision 48). Optional: a game set with no translations authored yet just falls back to `title` as-is. */
  key?: string;
  /** The account the monthly payment is booked to (default `Daily`): leisure belongs to `Splurge`, insurances to `Fire`. */
  account?: 'Daily' | 'Splurge' | 'Fire';
  /** The line is the premium of this insurance (liability, household...): it is paid while the insurance is held and stops when it is dropped. */
  insurance?: InsuranceKind;
}

/** The Smile project of a character's dream, in one language: its buckets with what they cost and why, links, tasks and notes. */
export interface CashflowDreamProject {
  /** The project's name: also the category its payments carry. */
  title: string;
  sub: string;
  description: string;
  buckets: {
    id: string;
    title: string;
    targetMinor: number;
    notes: string;
    links?: { label: string; url: string }[];
  }[];
  links: { label: string; url: string }[];
  actionItems: { text: string; priority: 'low' | 'medium' | 'high' }[];
  /** What the character thinks and finds on the way, as notes of the project. */
  notes: string[];
}

/** The conditions of winning a character has; each is ticked off once it is met. */
export type CashflowGoalId = 'parentsLoan' | 'carLoan' | 'dream' | 'reserve' | 'independence';

/** What a character is about, in one language (JFK, 2026-10-25): shown when a character is chosen. */
export interface CashflowProfileTexts {
  name: string;
  /** One line under the name. */
  tagline: string;
  background: string;
  /** What matters to this character. */
  values: string[];
  /** What it takes to win: a lead-in line, then the conditions as a checklist (all of them have to come true). */
  goal: string;
  goalItems: { id: CashflowGoalId; text: string }[];
  /** The dream the character starts with (their first Smile project). */
  dream: { title: string; summary: string; project?: CashflowDreamProject };
  /** The emergency reserve every character has to build (three monthly expenses): a Fire project from the first day. */
  reserve?: { summary: string; project: CashflowDreamProject };
}

/** The story of a character of a custom edition, by language code; a language without an entry falls back to `en`. */
export interface CashflowProfessionProfile {
  texts: Record<string, CashflowProfileTexts> & { en: CashflowProfileTexts };
}

export interface CashflowProfession {
  /** The ladder of this character's career (every profession has its own); absent: the Career tile has nothing to give. */
  career?: CareerTrack;
  /**
   * What things cost this character compared with the Dual Student, who is 1 (JFK, 2026-10-26): a higher life level makes the
   * cards' amounts - emergencies first - higher, so every character has the same chance. Absent: 1.
   */
  priceFactor?: number;
  id: string;
  title: string;
  salaryMinor: number;
  /** The card's itemized "Ausgaben" — each becomes its own Subscription, categorized by its own name. A zero-amount line is skipped. */
  expenses: CashflowExpenseLine[];
  /** "Ausgaben pro Kind" — positive, per child, matching the card; multiplied by `CashflowGameState.children` for the "Children Expenses" subscription (`resolveCashflowBaby` negates it). */
  perChildExpenseMinor: number;
  /** "Ersparnisse" — the card's starting savings figure. Starting cash is computed, not stored: savings plus one month's cashflow (salary minus `expenses`) — JFK, 2026-09-26. */
  savingsMinor: number;
  starterKit: CashflowStarterKit;
  /** Custom editions: who this is, what matters to them and what they dream of. The classic cards have none. */
  profile?: CashflowProfessionProfile;
}

export interface CashflowLoanRule {
  incrementMinor: number;
  monthlyInterestPercent: number;
}

/**
 * A space kind on the physical board. `payday` is the only one resolvable
 * today; `baby`/`charity`/`downsized` need no card data and are next;
 * `dealBig`/`dealSmall`/`market`/`doodad` need a real card catalog (Phase 2).
 */
export type CashflowSpaceKind =
  'payday' | 'dealBig' | 'dealSmall' | 'market' | 'doodad' | 'baby' | 'charity' | 'downsized';

/** Small/Big Deal: the numbers `planDeal` needs, straight off the card. */
export interface CashflowDealCard {
  id: string;
  /** Language-neutral: a company name or property name, the same in every language. Flavor text and notes live in the lazily loaded per-language card texts, keyed by `id` (`CashflowCardTextService`). */
  title: string;
  assetKind: 'share' | 'investment' | 'asset';
  /** Share cards: what the physical card calls itself - "Aktie" (stock) or "Investmentfonds" (fund). Both are bought and sold as shares. */
  securityKind?: 'stock' | 'fund';
  /** Investment cards: a "Du findest einen Super Deal!" card - the printed card says you should buy it. */
  superDeal?: boolean;
  /** Share cards only: the ticker symbol. Becomes the Grow project title and the Share's tag, so the same stock at a different price lands on the same position. */
  symbol?: string;
  /** A fixed share count (placeholder cards) — real stock cards leave it out, the player picks how many to buy. */
  quantity?: number;
  /** Share cards: today's price per share. */
  priceMinor?: number;
  /** Share cards: the price range this stock trades in over the game. */
  rangeMinMinor?: number;
  rangeMaxMinor?: number;
  depositMinor?: number;
  mortgageMinor?: number;
  cashflowMinor?: number;
  /** Asset cards (gold coins): the price paid. `quantity` is how many coins (units) it buys. */
  costMinor?: number;
  /** Asset cards decided by a die: a roll of at least this wins the asset; absent = a plain purchase. */
  successOn?: number;
  /** A dice card that pays cash instead of coins: a winning roll returns this amount (the loan to a relative), and no asset is created. */
  payoutMinor?: number;
  /** The card is kept and rolled for at every Payday (Multi-Level-Marketing): each win pays `payoutMinor` again, and it is never "completed". */
  recurring?: boolean;
}

/** A mandatory one-off cost — resolved as a single Transaction. */
export interface CashflowDoodadCard {
  id: string;
  title: string;
  costMinor: number;
  /** The account the cost is suggested to come out of: a big treat is a Smile, small stuff you just splurge. The player can change it in the Add dialog. */
  account?: 'Daily' | 'Splurge' | 'Smile' | 'Fire';
  /** Language-neutral spending group (leisure, events, home...) - its translated name becomes the transaction's category, so the income statement shows where the money goes over a life. */
  group?: string;
  /** A line the printed card carries under its title: take a bank loan if you have to, only if you have a child, or both. */
  hint?: 'loan' | 'child' | 'loanChild';
}

/**
 * Real Market cards vary too much (a sale offer, a global event, a special
 * case) to model generically without the real catalog — shown as text only,
 * the player acts on it through the app's existing features (todo/
 * cashflow-game.md decision 16).
 */
export interface CashflowMarketCard {
  id: string;
  title: string;
  description: string;
  /** A one-off cost that hits a player who owns a property (a tenant's damage, a broken sewer pipe); ignored by anyone without one. */
  pays?: { costMinor: number };
  /** A star card: a jackpot for whoever holds the right assets. */
  star?: boolean;
  /** A stock split card: one dice roll for the whole table decides - 1-3 doubles the shares of this ticker, 4-6 halves them. */
  splits?: { symbol: string };
  /** A cashflow boost: every cash-flowing investment with a monthly cashflow of up to `maxCashflowMinor` gains `addMinor` a month. */
  boost?: { maxCashflowMinor: number; addMinor: number; onlyBusinesses?: boolean };
  /**
   * A buyer card: everyone may sell properties of this type at the offered price. `family` is the
   * property type's deck label (EFH...); the offer is the original price plus a percentage or a fixed
   * amount. Cards without it (placeholders) are shown as text only.
   */
  sells?: {
    family: string;
    /** The deck symbols of the property types that may sell to this buyer (default: just `family`). */
    symbols?: string[];
    plusPercent?: number;
    plusMinor?: number;
    /** A fixed price for the whole property (condo buyers), whatever it cost. */
    priceMinor?: number;
    /** A price for every unit (WE) of the building (apartment complex buyers): this times the unit count, the number in the deck symbol (APH24 = 24). */
    pricePerUnitMinor?: number;
    /** Gold buyers: cash for every coin; sell as many as you like. */
    pricePerCoinMinor?: number;
  };
}

/** A market buyer's offer for one of the player's properties - good until the next Payday. */
export interface CashflowMarketOffer {
  /** The Grow project / investment label, e.g. EFH, EFH-II. */
  title: string;
  /** What the buyer pays in total (original price + the offer); the mortgage is paid off from it. */
  salePriceMinor: number;
  cardId: string;
  /** The offer as printed: "+20%" or "+20.000 €". */
  label: string;
  /** Gold buyers: the price for every coin - the total follows the coins still owned. */
  pricePerCoinMinor?: number;
  /** A stock price card: the price for every share held, which is what a sale under the rules gets. */
  pricePerShareMinor?: number;
  /** The player's roll count when the card was played: with `sellOfferRolls` it decides how long the offer stays open. */
  offeredAtRoll?: number;
}

export type CashflowDeckKind = 'dealSmall' | 'dealBig' | 'market' | 'doodad';

export interface CashflowDecks {
  /** The Dream stack of a Dreamfund game: generic dreams to take as Smile projects. */
  dream?: DreamCard[];
  /** The Life stack of a Dreamfund game (the heart tile). */
  life?: LifeCard[];
  /** The Emergency stack of a Dreamfund game (the Fire tile). */
  emergency?: EmergencyCard[];
  /** The Opportunity stack (Seed, Sapling, Tree): ways to raise the monthly cash flow, each becoming a Grow project. */
  opportunity?: OpportunityCard[];
  /** The Harvest stack: the market (indices, buyers, hype, traps revealed). */
  harvest?: HarvestCard[];
  dealSmall?: CashflowDealCard[];
  dealBig?: CashflowDealCard[];
  market?: CashflowMarketCard[];
  doodad?: CashflowDoodadCard[];
}

export interface CashflowGameSet {
  id: string;
  title: string;
  /** `custom`: JFK's own characters with a story and a dream; `classic`: the printed professions. Absent: classic. */
  edition?: 'classic' | 'custom';
  loanRule: CashflowLoanRule;
  professions: CashflowProfession[];
  /**
   * The physical board's space sequence, in order — real game content from
   * JFK, like professions. Optional: companion mode (todo/cashflow-game.md
   * decision 8) never reads this, the player says what they landed on; solo
   * mode needs it to roll a die and move a token (not yet built).
   */
  board?: CashflowSpaceKind[];
  /**
   * The four physical card decks — real game content from JFK, like
   * professions and the board. Optional, and independently so per deck: a
   * game set can ship Deal cards before Market/Doodad content exists.
   */
  decks?: CashflowDecks;
}

export interface CashflowTransactionRecord {
  account: string;
  amountMinor: number;
  date: string;
  time: string;
  category: string;
  comment: string;
}

export interface CashflowLogEntry {
  /** The round this happened at — only Payday itself advances `round`. */
  round: number;
  virtualDateBefore: string;
  virtualDateAfter: string;
  kind: CashflowSpaceKind;
  createdTransactions: CashflowTransactionRecord[];
}

/**
 * A special-asset card (gold coins) in play. A plain offer is just bought; a gamble card is paid for
 * first and then decided by a die roll, so "paid, waiting for the roll" has to survive a reload and be
 * undoable - which is why it lives in the game's own state and not on the Asset record.
 */
export interface CashflowAssetDeal {
  /** The Grow project's title - the label, e.g. GOLD, GOLD-II. Also the Asset's tag once it is owned. */
  title: string;
  /** How many coins the card is about. Tracked here (and in the Grow project), not on the Asset. */
  coins: number;
  costMinor: number;
  /** A die roll of at least this wins the coins; absent for a plain purchase. */
  successOn?: number;
  /** A winning roll pays this cash back instead of giving coins (the loan to a relative). */
  payoutMinor?: number;
  /** Rolled for at every Payday while owned (Multi-Level-Marketing). */
  recurring?: boolean;
  /** A Payday has passed and the roll for this recurring card has not been made yet. */
  rollDue?: boolean;
  /** A stock split decision (Market card): not an asset deal at all - the roll doubles (1-3) or halves (4-6) the quantity of this share. */
  split?: { shareTag: string };
  stage: 'planned' | 'awaitingRoll' | 'owned' | 'lost' | 'sold' | 'paidBack';
  /** What the roll reads, translated when the card was planned (the language picked for the game). */
  successText?: string;
  failureText?: string;
}

/** A card space the token landed on, waiting for the player to deal with its card (or pass). */
type DreamfundTileKind = 'dream' | 'emergency' | 'opportunity' | 'harvest' | 'life' | 'career';

export interface CashflowPendingDecision {
  /**
   * `story`: a tile of a Dreamfund map (dream, emergency, opportunity, harvest, life, career) - its card is read and ticked off;
   * what the tiles do comes with their cards (`tile` says which).
   */
  kind: 'deal' | 'market' | 'doodad' | 'story';
  /**
   * With an Emergency tile: the card that was drawn and what has been picked and rolled on it so far (it is kept with the game, so
   * the card stays as it is when the game is closed and opened again).
   */
  life?: {
    cardId: string;
    skipped?: string[];
    /** What the decision came to (shown afterwards); absent while the card waits. */
    outcome?: LifeOutcome;
    decision?: string;
  };
  /** With a Career tile: what the roll came to, and the books before and after a promotion (for the comparison). */
  career?: {
    result: CareerResult;
    done?: boolean;
    before?: CareerSnapshot;
    after?: CareerSnapshot;
    /** The stage reached (a promotion). */
    reached?: string;
  };
  /** With a Dream tile: the offered dreams or the moment, and what the player did with them. */
  dream?: {
    offers?: string[];
    moment?: string;
    /** The Smile project of the dream that was taken. */
    taken?: string;
    declined?: boolean;
    /** A moment that has been applied: what it did, in words for the log. */
    applied?: { en: string; de: string };
    /** A swap of dreams waits for the new dream: the project that goes. */
    swapping?: string;
  };
  /** With a Harvest tile: what the card did, and what the player may do about it (sell, ride a hype). */
  harvest?: HarvestPending;
  /** With an Opportunity tile: the pile chosen, the cards offered, and what the player did with them. */
  opportunity?: {
    pile?: string;
    offers?: string[];
    /** The card taken (its id), and the choice made on it. */
    taken?: string;
    units?: number;
    steps?: number;
    swapOut?: string;
    passed?: boolean;
    /** What the dice said, in words (kept so the card can be read again). */
    told?: string[];
    /** The card was bought and its project made (or planned in Grow: `planned`). */
    projectTitle?: string;
    planned?: boolean;
  };
  emergency?: {
    cardId: string;
    choiceId?: string;
    rolls?: Record<string, number>;
    rerolled?: boolean;
    /** Cards that did not apply on the way (lucky: nothing happened). */
    skipped?: string[];
    /** The Fire project the card became. */
    projectTitle?: string;
  };
  /** With `story`: which tile it is. */
  tile?: DreamfundTileKind;
  /** With `story`: the card drawn from the tile's stack. */
  storyCardId?: string;
  /** The ring index of the space. A Deals space leaves the pile (Small or Big) to the player. */
  spaceIndex: number;
  /**
   * Under the rule `cardChoice: 'offered-once'`: the one card drawn for this space. It is the only card that may be
   * played here; nothing else can be drawn or named until the space is settled.
   */
  offered?: { deck: CashflowDeckKind; cardId: string; title?: string };
  /** The card of this space has been played (planned, played, paid): it can be looked at or ticked off, but not passed. */
  played?: boolean;
  /** The card on this space has to be paid (a Market cost card for a player who owns a property): the Doodad rule applies to it. */
  paymentDue?: boolean;
  /** A property or an asset (gold, a dice card) was bought with the card of this space: a card buys once. */
  purchased?: boolean;
  /** The card was dealt with without a project: sold to a friend or declined. It is only read afterwards, like a played card. */
  closed?: boolean;
  /** The card was offered to the table once (at a table): a bot does not offer the same card again. */
  tradeTried?: boolean;
}

/**
 * Where a solo game's turn stands (todo/cashflow-game-pro.md slice B3). `roll`: waiting for the next roll. `decide`: the
 * token landed on a card space and the turn stays open until the card is dealt with or passed. `over`: the game has
 * ended - see `outcome`; nothing more is rolled.
 */
export interface CashflowSoloTurn {
  phase: 'roll' | 'decide' | 'over';
  /** How many rolls have been made. */
  count: number;
  /** The dice of the last roll. */
  lastRoll?: number[];
  pending?: CashflowPendingDecision;
  /** Set with `phase: 'over'`: out of the rat race, or lost. */
  outcome?: 'escaped' | 'bankrupt';
  /** The Grow projects a Market card of this turn touched (an offer, a price move, a boost, a cost): to check for an update. */
  affected?: string[];
}

/**
 * What the game planned in the budget for one month (JFK, 2026-10-19): the expenses its subscriptions cost, per category. The plan
 * is the game's own record - which budget cells are the game's - so it moves back a month with each Payday like the transactions do,
 * and is undone, saved and reset with the game.
 */
export interface CashflowBudgetMonth {
  /** 'YYYY-MM'; the last entry is the current month, the others follow one month apart. */
  month: string;
  rows: { tag: string; amountMinor: number }[];
}

export interface CashflowGameState {
  gameSetId: string | null;
  professionId: string | null;
  /** Chosen when the game starts (todo/cashflow-game.md decision 8). Only `companion` is resolvable today. */
  mode: 'companion' | 'solo';
  /** Solo mode's token: the ring index of its space, null at START (and always null in companion mode, which tracks no token). */
  boardPosition: number | null;
  /** Solo mode only; absent on every game saved before it existed and in companion mode. */
  turn?: CashflowSoloTurn;
  round: number;
  /** The game's own calendar (ISO date), independent of the real wall-clock date. Null until a profession is picked. */
  virtualDate: string | null;
  children: number;
  /** A reminder, not a countdown the app drives: "choose 1 or 2 dice for your next N turns." Cleared by `clearCashflowStatus` when the player's own turns have played out — never by Payday. */
  charityRoundsLeft: number;
  /** A reminder, not a countdown the app drives: "sit out while opponents play N turns." Cleared by `clearCashflowStatus` — never by Payday, which always runs regardless. */
  unemployedRoundsLeft: number;
  /** Which real Subscription titles belong to this game — Payday only ever acts on these. */
  gameSubscriptionTitles: string[];
  /**
   * Payment plans that fund a Smile project or a Fire emergency (JFK, 2026-10-25): Payday posts them like the game's own
   * subscriptions - one payment per Payday, from the plan's start to its end in game dates - but they are savings, not expenses, so
   * they are never part of the monthly picture (`summarizeGameFinances` reads `gameSubscriptionTitles` only).
   */
  fundingSubscriptionTitles?: string[];
  /** The map of a Dreamfund game (shape, size, seed): the tiles and where they stand are made from it. Absent: the classic ring. */
  boardSetup?: BoardSetup;
  /** The Emergency stack: what was drawn since the last reshuffle, and what is out of the game for good. */
  emergencyDeck?: EmergencyDeckState;
  /**
   * The insurances of the character (JFK, 2026-10-25): which are held, the premium line each one pays, and the changes waiting for the
   * next Payday (hop in, hop out - they take effect with the next Payday, for the premium and for the cover alike).
   */
  insurance?: {
    active: string[];
    premiums: Record<string, string>;
    pending: { kind: string; on: boolean }[];
  };
  /** The life of the character (JFK, 2026-10-26): partner, children, pet, car, home, city, job - the badges of the profile. */
  life?: LifeState;
  /** The dreams of the game (JFK, 2026-10-26): open, lived, points; and what the player set for them. */
  dreams?: DreamLog;
  dreamSettings?: DreamSettings;
  /** The rules of the Custom JFK edition: what the player may decide and what the cards decide (JFK, 2026-10-26). */
  customRules?: CustomRules;
  dreamDeck?: EmergencyDeckState;
  /** Where the character stands on the career ladder (JFK, 2026-10-26). */
  career?: CareerState;
  /** The monthly lines life cards left behind (each is also a subscription of the game). */
  lifeLines?: LifeLine[];
  /** What is going to happen at later Paydays (a baby, lent money coming back). */
  lifeScheduled?: ScheduledLife[];
  /** What cards ask to be paid, to be paid in the Add dialog (JFK, 2026-10-26). */
  paymentsDue?: PaymentDue[];
  /** The Opportunity piles: what each has been through since it was last shuffled. */
  opportunityDeck?: OpportunityDeckState;
  /** What the player owns of the Opportunity cards (and what is still running of them). */
  holdings?: OpportunityHolding[];
  /** The Grow projects planned from Opportunity cards (the plan becomes a holding when it is bought in Grow). */
  opportunityPlans?: { title: string; cardId: string; swapOut?: string; turnsLeft?: number }[];
  /** The indices of the markets (1.00 at the start) that the Harvest cards move, and the Harvest pile. */
  markets?: Record<string, number>;
  harvestDeck?: EmergencyDeckState;
  /** What a card of the market said would come at the next Payday (indices), and costs that run for some Paydays. */
  nextPaydayIndex?: Record<string, number>;
  marketEffects?: { title: string; paydaysLeft: number; expensesMinor: number }[];
  /** Living costs and mortgage rates that the market changed for good. */
  expensesPercentTotal?: number;
  mortgageRatePp?: number;
  /** The Life stack: what was drawn since the last reshuffle. */
  lifeDeck?: EmergencyDeckState;
  /** A job is being looked for (the Paydays left, the roll that finds one). */
  jobSearch?: { title: Localized; rollFrom: number; paydaysLeft: number; fallbackPercent: number };
  /** What the last Payday brought to the life of the character (a baby, a job): shown once. */
  lifeNews?: { kind: string; title: string }[];
  /** A sponsorship gives two dice for the first turn after each Payday. */
  sponsorship?: boolean;
  /** What things cost this character compared with the Dual Student (1): grows with the career. */
  livingStandard?: number;
  /** The title the subscription of an expense line was given (by its key): the career changes the tax lines by it. */
  lineTitles?: Record<string, string>;
  /** What the character owns that cards ask for: `car`, `pet`. */
  possessions?: string[];
  /** What is true of the character (a complete bonus booklet, a side gig); cards read it. */
  traits?: string[];
  /** One-off effects waiting to be used (skip the next Career card). */
  flags?: string[];
  /** Card ids drawn since the deck's last reshuffle, per deck — the "discard pile" a random draw skips and a reshuffle clears. */
  drawnCardIds: Record<CashflowDeckKind, string[]>;
  history: CashflowLogEntry[];
  /** Special-asset cards planned, awaiting a roll or owned. Absent on games saved before it existed. */
  assetDeals?: CashflowAssetDeal[];
  /** Market buyers' offers for the player's properties, cleared at the next Payday or once sold. */
  marketOffers?: CashflowMarketOffer[];
  /** The saved game this live game belongs to (set when it is first saved); a loaded game keeps its slot. */
  gameId?: string;
  /** The name it goes by in the games list. */
  gameName?: string;
  /** The rules the game is played under, fixed at its start (rules.ts); absent: `free`, as before rules existed. */
  rules?: GameRules; /** The budget the game planned, oldest month first; absent on a game from before it planned one. */
  budgetPlan?: CashflowBudgetMonth[];
}

export function initialCashflowGameState(): CashflowGameState {
  return {
    gameSetId: null,
    professionId: null,
    mode: 'companion',
    boardPosition: null,
    round: 0,
    virtualDate: null,
    children: 0,
    charityRoundsLeft: 0,
    unemployedRoundsLeft: 0,
    gameSubscriptionTitles: [],
    drawnCardIds: { dealSmall: [], dealBig: [], market: [], doodad: [] },
    history: [],
    assetDeals: [],
    marketOffers: [],
  };
}
