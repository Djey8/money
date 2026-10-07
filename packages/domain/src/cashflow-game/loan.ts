import { emptyEffects, type GameEffects } from './effects';
import { adjustCashflowBankLoan } from './engine';
import {
  cashOnHandMinor,
  loanForShortfallMinor,
  type CashAllocation,
  type CashTransaction,
} from './cash';
import { placeOneOffTransactions, upsertBookSubscription } from './rounds';
import type { CardDeps } from './market-cards';
import type { RoundBooks } from './rounds';
import type { BookLiability, BookSubscription } from './effects';
import type { CashflowGameSet } from './types';

/**
 * The bank loan as a pure rule (todo/cashflow-game-pro.md slice A1(d)): the player's own Borrow / Repay, and the
 * automatic loan a purchase takes when cash is short. Same shape as every game rule - books in, `GameEffects` out.
 */

export const BANK_LOAN_TAG = 'Bank loan';
export const BANK_LOAN_INTEREST_TITLE = 'Bank loan interest';

export interface LoanBooks extends Pick<RoundBooks, 'state' | 'subscriptions'> {
  /** The account's transactions: the loan's cash moves are dated by them, and a repayment is limited by their balance. */
  transactions: (RoundBooks['transactions'][number] & CashTransaction)[];
  liabilities: { tag: string; amountMinor: number }[];
  /** The account split the cash on hand depends on: a repayment is limited by it. */
  allocation: CashAllocation;
  /** The running game's set (it holds the loan rule); undefined before a profession is picked. */
  gameSet: CashflowGameSet | undefined;
}

/**
 * The most that can be repaid right now: the whole loan, or the whole steps of it the cash on hand covers - whichever is
 * less (JFK, 2026-10-07: you cannot repay into the red). Never negative.
 */
export function maxRepayableMinor(
  cashMinor: number,
  principalMinor: number,
  stepMinor: number,
): number {
  if (!(stepMinor > 0) || !(principalMinor > 0)) return 0;
  const affordable = Math.floor(Math.max(0, cashMinor) / stepMinor) * stepMinor;
  return Math.min(principalMinor, affordable);
}

/**
 * Takes (`deltaMinor > 0`) or repays (`< 0`) a bank loan in the game set's step. The Bank loan liability and its
 * interest subscription are recomputed from the new principal every time (never hand-edited); a repaid loan removes
 * both. The money moves for real: a transaction credits a borrow and debits a repayment (JFK, 2026-09-29+), booked on
 * the next free day slot of the real month - or on `options.date` when a dialog fixed the day.
 *
 * Throws when no game has started, for a zero or off-step amount, and for repaying more than is owed.
 */
export function playBankLoan(
  books: LoanBooks,
  deltaMinor: number,
  deps: CardDeps,
  options: { date?: string } = {},
): GameEffects {
  if (!books.gameSet) throw new Error('Pick a profession first.');
  const currentPrincipalMinor =
    books.liabilities.find((liability) => liability.tag === BANK_LOAN_TAG)?.amountMinor ?? 0;
  const result = adjustCashflowBankLoan(
    books.state,
    books.gameSet,
    currentPrincipalMinor,
    deltaMinor,
  );
  if (deltaMinor < 0) {
    // Repaying is paid out of the cash on hand and may not take the account below zero.
    const cashMinor = cashOnHandMinor(books.transactions, books.allocation);
    const allowed = maxRepayableMinor(
      cashMinor,
      currentPrincipalMinor,
      books.gameSet.loanRule.incrementMinor,
    );
    if (-deltaMinor > allowed) {
      throw new Error(
        `You can repay at most ${deps.money(allowed)} now: repaying is paid from the cash you have (${deps.money(Math.max(0, cashMinor))}), in whole loan steps.`,
      );
    }
  }
  const today = deps.clock.todayIso();

  const effects = emptyEffects(result.state, {
    kind: deltaMinor > 0 ? 'loanTaken' : 'loanRepaid',
    detail: deps.money(Math.abs(deltaMinor)),
  });
  if (result.liabilityUpsert) {
    const upsert: BookLiability = {
      tag: result.liabilityUpsert.tag,
      amountMinor: result.liabilityUpsert.amountMinor,
      investment: false,
    };
    effects.liabilityUpserts = [upsert];
  } else {
    effects.liabilityRemovals = [BANK_LOAN_TAG];
  }
  // The cash is dated after the interest subscription exists, so it takes the next free day *after* that one's.
  let subscriptions: BookSubscription[];
  if (result.subscriptionUpsert) {
    const upsert = upsertBookSubscription(books.subscriptions, result.subscriptionUpsert, today);
    effects.subscriptionUpserts = [upsert];
    subscriptions = books.subscriptions.some((sub) => sub.title === upsert.title)
      ? books.subscriptions.map((sub) => (sub.title === upsert.title ? upsert : sub))
      : [...books.subscriptions, upsert];
  } else {
    effects.subscriptionRemovals = [BANK_LOAN_INTEREST_TITLE];
    subscriptions = books.subscriptions.filter((sub) => sub.title !== BANK_LOAN_INTEREST_TITLE);
  }
  effects.appendedTransactions = placeOneOffTransactions(
    [result.transaction],
    { subscriptions, transactions: books.transactions },
    today,
    options.date,
  );
  effects.persist = { subscriptions: true, grow: false, balanceSheet: true };
  return effects;
}

export interface AutoLoanPlan {
  /** What to borrow, in the game set's loan step; 0 when nothing is needed. */
  loanMinor: number;
  /** The player had asked for a loan on the purchase: the game's Bank loan takes it over from the project's own Loan field. */
  converted: boolean;
}

/**
 * The automatic Bank loan a purchase takes (JFK, 2026-10-03: a buy is financed by the game's Bank loan, never by a
 * separate per-project liability): whichever is more of what the player typed into the Loan field and whatever cash is
 * short, rounded **up** to the loan step.
 */
export function planAutoLoan(input: {
  costMinor: number;
  cashMinor: number;
  /** The loan the player entered on the purchase (0 if none). */
  financedMinor: number;
  incrementMinor: number;
}): AutoLoanPlan {
  const shortfallMinor = Math.max(0, input.costMinor - input.cashMinor);
  const financedMinor = Math.max(0, input.financedMinor);
  const wantedMinor = Math.max(shortfallMinor, financedMinor);
  if (wantedMinor <= 0) return { loanMinor: 0, converted: false };
  return {
    loanMinor: loanForShortfallMinor(wantedMinor, 0, input.incrementMinor),
    converted: financedMinor > 0,
  };
}
