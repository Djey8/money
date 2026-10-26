import { applyEffectsToBooks, type GameBooks } from './books';
import { cashOnHandMinor } from './cash';
import { expenseTitleForLiability, type DealDeps } from './deals';
import { emptyEffects, type GameEffects } from './effects';
import { textOrFallback } from './game-text';
import { BANK_LOAN_TAG, planAutoLoan, playBankLoan } from './loan';
import { nextOneOffDate, placeOneOffTransactions } from './rounds';
import { summarizeGameFinances } from './saved-games';
import type { CashflowProfession } from './types';

/**
 * Paying a liability off - the home mortgage, a car loan, a credit card debt, a student loan (JFK, 2026-10-19) - in ONE payment
 * of the full amount. It ends the monthly expense that went with it, so the expenses fall: a way to lower them and so to escape
 * (a tactic). Short of cash the normal borrowing rule applies (a Bank loan, in whole loan steps), which rarely makes sense but is
 * allowed - **unless the payoff and the loan it needs would leave the monthly cashflow negative**: nobody can put themselves into
 * bankruptcy by paying a debt off. Not for the Bank loan itself (that is repaid in steps) and not for a property's own mortgage.
 */

export interface PayoffPlan {
  tag: string;
  /** The whole amount owed, paid at once. */
  amountMinor: number;
  cashMinor: number;
  /** What has to be borrowed first (0 when the cash covers it), in whole loan steps. */
  borrowMinor: number;
  /** The monthly expense that ends with it (its title), or null when the liability has none. */
  expenseTitle: string | null;
  /** What that expense was per month (positive). */
  freedMonthlyMinor: number;
  /** The monthly cashflow before and after (the new loan's own payment included). */
  cashflowBeforeMinor: number;
  cashflowAfterMinor: number;
  /** Whether it may be done now, and when not, why (the words for the player). */
  ok: boolean;
  reason?: string;
}

/** The liabilities that can be paid off this way: the starting debts, not the Bank loan and not a property's mortgage. */
export function payableLiabilities(
  books: Pick<GameBooks, 'liabilities'>,
): GameBooks['liabilities'] {
  return books.liabilities.filter(
    (liability) =>
      liability.tag !== BANK_LOAN_TAG && !liability.investment && liability.amountMinor > 0,
  );
}

/** The steps that do it: the Bank loan first when the cash is short (its own step), then the payment that ends the debt. */
function steps(
  books: GameBooks,
  profession: CashflowProfession | undefined,
  tag: string,
  deps: DealDeps,
): { effects: GameEffects[]; plan: Omit<PayoffPlan, 'ok' | 'reason' | 'cashflowAfterMinor'> } {
  if (!books.state.virtualDate || !books.gameSet) throw new Error('Pick a profession first.');
  const liability = payableLiabilities(books).find((candidate) => candidate.tag === tag);
  if (!liability) {
    throw new Error(
      `There is no ${tag} to pay off (the Bank loan is repaid in steps, a property's mortgage with it).`,
    );
  }
  const amountMinor = liability.amountMinor;
  const cashMinor = cashOnHandMinor(books.transactions, books.allocation);
  const borrowMinor = planAutoLoan({
    costMinor: amountMinor,
    cashMinor,
    financedMinor: 0,
    incrementMinor: books.gameSet.loanRule.incrementMinor,
  }).loanMinor;
  const expenseTitle = expenseTitleForLiability(books.state, profession, tag, deps.text);
  const expense = expenseTitle
    ? books.subscriptions.find((subscription) => subscription.title === expenseTitle)
    : undefined;
  const freedMonthlyMinor = expense && expense.amountMinor < 0 ? -expense.amountMinor : 0;
  const today = deps.clock.todayIso();

  const effects: GameEffects[] = [];
  let working = books;
  if (borrowMinor > 0) {
    // an ordinary Bank loan, subject to the game's borrowing rules (not a forced one)
    const loan = playBankLoan(books, borrowMinor, deps, { date: nextOneOffDate(books, today) });
    loan.step = { kind: 'loanAuto', detail: deps.money(borrowMinor) };
    effects.push(loan);
    working = applyEffectsToBooks(working, loan);
  }
  const pay = emptyEffects(
    {
      ...working.state,
      gameSubscriptionTitles: expenseTitle
        ? working.state.gameSubscriptionTitles.filter((title) => title !== expenseTitle)
        : working.state.gameSubscriptionTitles,
    },
    { kind: 'payoff', detail: tag },
  );
  pay.appendedTransactions = placeOneOffTransactions(
    [
      {
        account: 'Daily',
        amountMinor: -amountMinor,
        date: '',
        time: '',
        category: `@${tag}`,
        comment: `${textOrFallback(deps.text, 'CashflowGame.liabilityPaidComment', `Paid off ${tag} in one payment`)}\n#dreamfund`,
      },
    ],
    working,
    today,
  );
  pay.liabilityRemovals = [tag];
  if (expenseTitle) pay.subscriptionRemovals = [expenseTitle];
  pay.persist = { subscriptions: true, grow: false, balanceSheet: true };
  effects.push(pay);

  return {
    effects,
    plan: {
      tag,
      amountMinor,
      cashMinor,
      borrowMinor,
      expenseTitle,
      freedMonthlyMinor,
      cashflowBeforeMinor: summarizeGameFinances(books.state, books.subscriptions)
        .monthlyCashflowMinor,
    },
  };
}

/** What paying `tag` off would do, and whether it is allowed - never throws (the screen shows `reason`). */
export function planLiabilityPayoff(
  books: GameBooks,
  profession: CashflowProfession | undefined,
  tag: string,
  deps: DealDeps,
): PayoffPlan {
  let built: ReturnType<typeof steps>;
  try {
    built = steps(books, profession, tag, deps);
  } catch (error) {
    return {
      tag,
      amountMinor: 0,
      cashMinor: 0,
      borrowMinor: 0,
      expenseTitle: null,
      freedMonthlyMinor: 0,
      cashflowBeforeMinor: 0,
      cashflowAfterMinor: 0,
      ok: false,
      reason: (error as Error).message,
    };
  }
  const after = built.effects.reduce(applyEffectsToBooks, books);
  const cashflowAfterMinor = summarizeGameFinances(
    after.state,
    after.subscriptions,
  ).monthlyCashflowMinor;
  if (cashflowAfterMinor < 0) {
    return {
      ...built.plan,
      cashflowAfterMinor,
      ok: false,
      reason: `You would have to borrow ${deps.money(built.plan.borrowMinor)}, and the loan's monthly payment would leave your monthly cashflow at ${deps.money(cashflowAfterMinor)}: paying this off would put you into bankruptcy.`,
    };
  }
  return { ...built.plan, cashflowAfterMinor, ok: true };
}

/** The steps that pay `tag` off in one payment. Throws with the reason when it is not allowed; nothing changes then. */
export function payOffLiability(
  books: GameBooks,
  profession: CashflowProfession | undefined,
  tag: string,
  deps: DealDeps,
): GameEffects[] {
  const plan = planLiabilityPayoff(books, profession, tag, deps);
  if (!plan.ok) throw new Error(plan.reason ?? `${tag} cannot be paid off now.`);
  return steps(books, profession, tag, deps).effects;
}
