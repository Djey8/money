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
  /** Not used by the MVP engine yet — carried so the type doesn't need to change again in Phase 1. */
  perChildExpenseMinor: number;
  starterKit: CashflowStarterKit;
}

export interface CashflowLoanRule {
  incrementMinor: number;
  monthlyInterestPercent: number;
}

export interface CashflowGameSet {
  id: string;
  title: string;
  loanRule: CashflowLoanRule;
  professions: CashflowProfession[];
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
  round: number;
  virtualDateBefore: string;
  virtualDateAfter: string;
  kind: 'payday';
  createdTransactions: CashflowTransactionRecord[];
}

export interface CashflowGameState {
  gameSetId: string | null;
  professionId: string | null;
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
    round: 0,
    virtualDate: null,
    children: 0,
    charityRoundsLeft: 0,
    unemployedRoundsLeft: 0,
    gameSubscriptionTitles: [],
    history: [],
  };
}
