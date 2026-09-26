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
  title: string;
  assetKind: 'share' | 'investment';
  quantity?: number;
  priceMinor?: number;
  depositMinor?: number;
  mortgageMinor?: number;
  cashflowMinor?: number;
}

/** A mandatory one-off cost — resolved as a single Transaction. */
export interface CashflowDoodadCard {
  id: string;
  title: string;
  costMinor: number;
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

export interface CashflowGameState {
  gameSetId: string | null;
  professionId: string | null;
  /** Chosen when the game starts (todo/cashflow-game.md decision 8). Only `companion` is resolvable today. */
  mode: 'companion' | 'solo';
  /** Solo mode's token position on the game set's `board`; always null in companion mode (no token tracked). */
  boardPosition: number | null;
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
  };
}
