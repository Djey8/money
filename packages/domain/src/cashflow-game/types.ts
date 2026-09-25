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

export interface CashflowStarterKit {
  subscriptions: CashflowStarterKitSubscription[];
  assets?: CashflowStarterKitEntry[];
  investments?: Array<CashflowStarterKitEntry & { depositMinor: number }>;
  shares?: Array<{ tag: string; quantity: number; priceMinor: number }>;
  liabilities?: CashflowStarterKitEntry[];
}

export interface CashflowProfession {
  id: string;
  title: string;
  /** One-off cash a profession starts with, materialized as a single starting Transaction. */
  startingCashMinor: number;
  salaryMinor: number;
  /** A single lump "taxes and other expenses" figure straight off the profession card; signed (negative). */
  taxesAndExpensesMinor: number;
  /** Signed (negative); multiplied by `CashflowGameState.children` for the "children expenses" subscription. */
  perChildExpenseMinor: number;
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
  /** True for a Payday that was skipped outright (an active `unemployedRoundsLeft`) — round/date still advance, but nothing was created. */
  skipped?: boolean;
  /** Payday only — a snapshot so `undoLastCashflowPayday` can restore these exactly rather than trying to infer the reversal. */
  unemployedRoundsLeftBefore?: number;
  charityRoundsLeftBefore?: number;
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
  charityRoundsLeft: number;
  unemployedRoundsLeft: number;
  /** Which real Subscription titles belong to this game — Payday only ever acts on these. */
  gameSubscriptionTitles: string[];
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
    history: [],
  };
}
