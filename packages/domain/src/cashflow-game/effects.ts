import type { SubscriptionFrequency } from '../transactions/frequency-strategies';
import type { GameStep } from './steps';
import type { CashflowGameState, CashflowTransactionRecord } from './types';

/**
 * The one description every game rule returns of what it changed (todo/cashflow-game-pro.md, slices A1(b)-(d)).
 *
 * A rule reads the **books** - the slice of the account it needs, in integer minor units - and returns these
 * **effects**; it mutates nothing and reads nothing from the environment. The Angular service applies the effects to
 * its own entities and the Pro API applies them to the account it loaded: the same decisions, stored two ways. Only
 * the fields a rule actually uses are filled in.
 */

/** A subscription as the game reads and writes it, in minor units. */
export interface BookSubscription {
  title: string;
  account: string;
  amountMinor: number;
  startDate: string;
  endDate: string;
  category: string;
  comment: string;
  frequency: SubscriptionFrequency;
}

/** A liability as the game writes it: the Bank loan and the starting card's debts. */
export interface BookLiability {
  tag: string;
  amountMinor: number;
  /** A mortgage-style liability tied to an investment (as opposed to a plain debt). */
  investment: boolean;
}

/** A change to one Grow project. Only the fields that are present change. */
export interface BookGrowUpdate {
  title: string;
  /** The project's whole note list afterwards. */
  notes?: { text: string; createdAt: string }[];
  cashflowMinor?: number;
  sharePriceMinor?: number;
  updatedAt?: string;
}

export interface GameEffects {
  state: CashflowGameState;
  /** The History step; null when nothing is recorded (a cost card that applies is booked by the Add dialog). */
  step: GameStep | null;
  /** Existing transactions whose date moves, by position (Payday ages every game transaction back a month). */
  transactionDates: { index: number; date: string }[];
  /** New transactions, already dated. */
  appendedTransactions: CashflowTransactionRecord[];
  /** Subscriptions to create or update, matched by title, as they should read afterwards. */
  subscriptionUpserts: BookSubscription[];
  /** Titles of subscriptions to delete (a repaid loan's interest). */
  subscriptionRemovals: string[];
  /** Liabilities to create or set to this amount, matched by tag. */
  liabilityUpserts: BookLiability[];
  /** Tags of liabilities to delete. */
  liabilityRemovals: string[];
  growUpdates: BookGrowUpdate[];
  /** New prices of held shares. */
  sharePrices: { tag: string; priceMinor: number }[];
  /** What the caller has to write besides transactions and the game state. */
  persist: { subscriptions: boolean; grow: boolean; balanceSheet: boolean };
  /** False when the rule changed nothing in the account (the step is still a History entry). */
  write: boolean;
  /** A decision is now waiting for the player (a kept dice card's Payday roll, a stock split's dice). */
  decisionNeeded: boolean;
}

/** No changes: the new state and the step, everything else empty. Rules fill in what they touch. */
export function emptyEffects(state: CashflowGameState, step: GameStep | null): GameEffects {
  return {
    state,
    step,
    transactionDates: [],
    appendedTransactions: [],
    subscriptionUpserts: [],
    subscriptionRemovals: [],
    liabilityUpserts: [],
    liabilityRemovals: [],
    growUpdates: [],
    sharePrices: [],
    persist: { subscriptions: false, grow: false, balanceSheet: false },
    write: true,
    decisionNeeded: false,
  };
}
