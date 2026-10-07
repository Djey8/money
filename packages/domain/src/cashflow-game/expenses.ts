import { applyEffectsToBooks, type GameBooks } from './books';
import { cashOnHandMinor } from './cash';
import { doodadLoanNote, type DealDeps } from './deals';
import { emptyEffects, type GameEffects } from './effects';
import { planAutoLoan, playBankLoan } from './loan';
import { nextOneOffDate, placeOneOffTransactions } from './rounds';
import { gameTradeStep } from './trades';
import type { CashflowDoodadCard } from './types';

/**
 * Paying a card's one-off cost (todo/cashflow-game-pro.md slice A1(f)): a Doodad (Schnickschnack) card, or a Market
 * card that costs a property owner money (tenant damage, a broken sewer pipe). Both are plain expenses paid like a
 * purchase - short of cash, the game takes a Bank loan first (JFK, 2026-10-03) - and both carry a tag in their comment
 * so every one can be found again later.
 *
 * The game page pre-fills the Add dialog with `cardExpenseComment` and `doodadAccount`, and the dialog books the
 * payment; the Pro API calls `payCardExpense`, which returns the same two steps (the loan, then the expense). Either
 * way the comment, the account, the loan decision and the History step come from here.
 */

export type CardExpenseKind = 'doodad' | 'marketCost';

/** The tag a payment carries so it can be recognised later: `#doodad` or `#market`. */
const TAG: Record<CardExpenseKind, string> = { doodad: '#doodad', marketCost: '#market' };

/** The account a Doodad is suggested to come out of: a big treat is a Smile, small stuff you just splurge. The player can change it. */
export function doodadAccount(card: Pick<CashflowDoodadCard, 'account'>): string {
  return card.account ?? 'Splurge';
}

/** The account a Market cost is paid from: the property is an investment, so it comes out of Fire. */
export const MARKET_COST_ACCOUNT = 'Fire';

/**
 * The comment a card payment carries: what was bought, the joke, the cash / bank-loan note, then the tag - each block
 * after a blank line. A missing block is left out.
 */
export function cardExpenseComment(
  kind: CardExpenseKind,
  parts: { title?: string; flavor?: string },
  loanNote: string,
): string {
  return `${[parts.title, parts.flavor, loanNote].filter(Boolean).join('\n\n')}\n\n${TAG[kind]}`;
}

export interface CardExpenseInput {
  kind: CardExpenseKind;
  /** What was bought, as the card names it in the game's language. */
  title?: string;
  /** The card's light-hearted line, or what a Market cost says about the property. */
  flavor?: string;
  /** The spending category (without the `@`): a Doodad's group, or the property's label. */
  category: string;
  costMinor: number;
  account: string;
  /** The day to book the expense on; the next free day slot of the real month when absent. */
  date?: string;
  /** The day the loan, if one is needed, is booked on; the next free slot when absent. */
  loanDate?: string;
}

/**
 * Pays a card's cost: the Bank loan first when cash on hand does not cover it - its own undo step, rounded up to the
 * loan step - then the expense itself, one step named after the category. Everything is decided before anything is
 * returned, so a refused payment changes nothing. Throws before a game has started and for a cost that is not above zero.
 */
export function payCardExpense(
  books: GameBooks,
  input: CardExpenseInput,
  deps: DealDeps,
): GameEffects[] {
  if (!books.state.virtualDate) throw new Error('Pick a profession first.');
  if (!(input.costMinor > 0)) throw new Error('Enter what this costs.');

  const today = deps.clock.todayIso();
  const comment = cardExpenseComment(
    input.kind,
    { title: input.title, flavor: input.flavor },
    doodadLoanNote(books, input.costMinor, deps),
  );
  const steps: GameEffects[] = [];
  let working = books;

  const plan = planAutoLoan({
    costMinor: input.costMinor,
    cashMinor: cashOnHandMinor(books.transactions, books.allocation),
    financedMinor: 0,
    incrementMinor: books.gameSet?.loanRule.incrementMinor ?? 0,
  });
  if (plan.loanMinor > 0) {
    const loanDate = input.loanDate ?? nextOneOffDate(books, today);
    const loan = playBankLoan(books, plan.loanMinor, deps, { date: loanDate });
    loan.step = { kind: 'loanAuto', detail: deps.money(plan.loanMinor) };
    steps.push(loan);
    working = applyEffectsToBooks(working, loan);
  }

  const pay = emptyEffects(working.state, gameTradeStep(comment, `@${input.category}`));
  pay.appendedTransactions = placeOneOffTransactions(
    [
      {
        account: input.account,
        amountMinor: -input.costMinor,
        date: '',
        time: '',
        category: `@${input.category}`,
        comment,
      },
    ],
    working,
    today,
    input.date,
  );
  steps.push(pay);
  return steps;
}
