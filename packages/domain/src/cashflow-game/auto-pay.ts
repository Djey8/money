import { applyEffectsToBooks, type GameBooks } from './books';
import { cashOnHandMinor } from './cash';
import type { GameEffects } from './effects';
import { planAutoLoan, playBankLoan } from './loan';
import type { CardDeps } from './market-cards';
import { playCharity, playDownsized, type RoundBooks } from './rounds';

/**
 * Money a space takes out of the account is never taken into the red (JFK, 2026-10-06: "you cannot go negative on your
 * balance"): when cash on hand does not cover it, the game's Bank loan is taken first - the shortfall rounded **up** to
 * the loan step, as its own step, exactly as a deal or a Doodad does - and then the payment is made.
 */

/** What a payment took out of the account: the sum of its outgoing transactions. */
function outflowMinor(effects: GameEffects): number {
  return effects.appendedTransactions.reduce(
    (sum, record) => (record.amountMinor < 0 ? sum - record.amountMinor : sum),
    0,
  );
}

/** The slimmer view of the books the round rules read. */
export function roundBooksOf(books: GameBooks): RoundBooks {
  return {
    state: books.state,
    subscriptions: books.subscriptions,
    transactions: books.transactions,
    growNotes: books.growProjects.map((project) => ({
      title: project.title,
      notes: project.notes,
    })),
  };
}

export interface PaidWithLoan {
  /** In order: each automatic loan (its own step), then the payment itself. */
  effects: GameEffects[];
  /** What was borrowed, one entry per loan taken, in minor units (empty when cash covered it). */
  loansMinor: number[];
}

/**
 * Plays a payment rule over the books, taking the Bank loan first when cash on hand is short. The payment is worked out
 * again after a loan, because the loan itself adds an interest expense that a payment of "every expense" includes.
 * Throws when a loan is needed but no game has started, or when no loan could cover it.
 */
export function payWithAutoLoan(
  books: GameBooks,
  play: (books: RoundBooks) => GameEffects,
  deps: CardDeps,
): PaidWithLoan {
  const effects: GameEffects[] = [];
  const loansMinor: number[] = [];
  let working = books;
  for (let attempt = 0; attempt < 5; attempt++) {
    const payment = play(roundBooksOf(working));
    const costMinor = outflowMinor(payment);
    const cashMinor = cashOnHandMinor(working.transactions, working.allocation);
    if (costMinor <= cashMinor) {
      effects.push(payment);
      return { effects, loansMinor };
    }
    if (!working.gameSet) throw new Error('Pick a profession first.');
    const { loanMinor } = planAutoLoan({
      costMinor,
      cashMinor,
      financedMinor: 0,
      incrementMinor: working.gameSet.loanRule.incrementMinor,
    });
    const loan = playBankLoan(working, loanMinor, deps);
    loan.step = { kind: 'loanAuto', detail: deps.money(loanMinor) };
    effects.push(loan);
    loansMinor.push(loanMinor);
    working = applyEffectsToBooks(working, loan);
  }
  throw new Error('This payment could not be covered by a bank loan.');
}

/** A Charity space: the 10 % donation, with the bank loan first when cash falls short. */
export function playCharityPaying(books: GameBooks, deps: CardDeps): PaidWithLoan {
  return payWithAutoLoan(books, (round) => playCharity(round, deps), deps);
}

/** A Downsized space: every expense paid once, with the bank loan first when cash falls short. */
export function playDownsizedPaying(books: GameBooks, deps: CardDeps): PaidWithLoan {
  return payWithAutoLoan(books, (round) => playDownsized(round, deps), deps);
}
