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
}

export interface CashflowProfession {
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
}

export type CashflowDeckKind = 'dealSmall' | 'dealBig' | 'market' | 'doodad';

export interface CashflowDecks {
  dealSmall?: CashflowDealCard[];
  dealBig?: CashflowDealCard[];
  market?: CashflowMarketCard[];
  doodad?: CashflowDoodadCard[];
}

export interface CashflowGameSet {
  id: string;
  title: string;
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
export interface CashflowPendingDecision {
  kind: 'deal' | 'market' | 'doodad';
  /** The ring index of the space. A Deals space leaves the pile (Small or Big) to the player. */
  spaceIndex: number;
}

/**
 * Where a solo game's turn stands (todo/cashflow-game-pro.md slice B3). `roll`: waiting for the next roll. `decide`: the
 * token landed on a card space and the turn stays open until the card is dealt with or passed.
 */
export interface CashflowSoloTurn {
  phase: 'roll' | 'decide';
  /** How many rolls have been made. */
  count: number;
  /** The dice of the last roll. */
  lastRoll?: number[];
  pending?: CashflowPendingDecision;
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
