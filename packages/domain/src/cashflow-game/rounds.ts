import type { SubscriptionFrequency } from '../transactions/frequency-strategies';
import type { Clock } from './clock';
import {
  ownedGameSubscriptions,
  resolveCashflowBaby,
  resolveCashflowCharity,
  resolveCashflowDownsized,
  runCashflowPayday,
} from './engine';
import { textOrFallback, type GameText } from './game-text';
import type { GameStep } from './steps';
import {
  dateFromSubscriptionDay,
  gameSubscriptionDays,
  nextSmartDate,
  shiftedGameTransactionDates,
  usedDaysThisMonth,
} from './scheduling';
import type {
  CashflowGameState,
  CashflowProfession,
  CashflowStarterKitSubscription,
  CashflowTransactionRecord,
} from './types';

/**
 * The round rules: Payday, Baby, Charity and Downsized, as pure functions (todo/cashflow-game-pro.md slice A1(b)).
 *
 * Each one takes the **books** (the slice of the account it reads, in integer minor units), and returns the
 * **effects** (what to change). Nothing is mutated and nothing is read from the environment: "today" comes from a
 * `Clock` and every piece of text from a `GameText`. The Angular service applies the effects to its own entities and
 * the Pro API will apply them to the account's - same decisions, two ways of storing them.
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

/** A Grow project's notes: the one place Payday reaches into Grow (it drops stale market-buyer offers). */
export interface BookGrowNotes {
  title: string;
  notes: { text: string; createdAt: string }[];
}

/** Everything a round rule reads. */
export interface RoundBooks {
  state: CashflowGameState;
  subscriptions: BookSubscription[];
  /** Only dates and comments are read (to age game transactions and to find free day slots). */
  transactions: { date: string; comment?: string }[];
  growNotes?: BookGrowNotes[];
}

export interface RoundDeps {
  clock: Clock;
  text: GameText;
}

/** One entry of the game's History: what kind of step it was and what it was about. */
export type RoundStep = GameStep;

/** What a round rule changes. Positions refer to `RoundBooks.transactions`. */
export interface RoundEffects {
  state: CashflowGameState;
  step: RoundStep;
  /** Existing transactions whose date moves (Payday ages every game transaction back a month). */
  transactionDates: { index: number; date: string }[];
  /** New transactions, already dated. */
  appendedTransactions: CashflowTransactionRecord[];
  /** Subscriptions to create or update, matched by title, as they should read afterwards. */
  subscriptionUpserts: BookSubscription[];
  /** Projects whose notes are replaced (their full note list afterwards). */
  growNotes: BookGrowNotes[];
  /** What the caller has to write besides transactions and the game state. */
  persist: { subscriptions: boolean; grow: boolean };
  /** A decision is now waiting for the player (a kept dice card is due its Payday roll). */
  decisionNeeded: boolean;
}

/** The one note a market buyer's offer leaves on a property's Grow project (replaced by the next offer, removed at Payday). */
export const MARKET_NOTE_MARK = '💰 ';

const noEffects = (state: CashflowGameState, step: RoundStep): RoundEffects => ({
  state,
  step,
  transactionDates: [],
  appendedTransactions: [],
  subscriptionUpserts: [],
  growNotes: [],
  persist: { subscriptions: false, grow: false },
  decisionNeeded: false,
});

/** What the engine reads of a subscription. */
function engineSubscriptions(subscriptions: BookSubscription[]) {
  return subscriptions.map((sub) => ({
    title: sub.title,
    account: sub.account,
    amountMinor: sub.amountMinor,
    category: sub.category,
    comment: sub.comment,
  }));
}

/**
 * Books one-off game transactions on the next free day slots of the real current month, instead of the game
 * calendar's date (which runs months ahead as rounds pass). `fixedDate` overrides the slot (a loan taken from a
 * dialog keeps the day the dialog opened on).
 */
export function placeOneOffTransactions(
  records: CashflowTransactionRecord[],
  books: Pick<RoundBooks, 'subscriptions' | 'transactions'>,
  today: string,
  fixedDate?: string,
): CashflowTransactionRecord[] {
  const used = usedDaysThisMonth(books.subscriptions, books.transactions, today);
  return records.map((record) => ({
    ...record,
    date: fixedDate ?? nextSmartDate(used, today),
  }));
}

/**
 * Creates or updates a Subscription by title - the "recomputed every time, never hand-edited" pattern Baby and the
 * bank loan share. An existing one keeps its own date and takes the new account, amount and frequency (and the
 * category, when one is given); a new one is dated on the next free day slot. Either way it carries `#cashflow`.
 */
export function upsertBookSubscription(
  subscriptions: BookSubscription[],
  upsert: CashflowStarterKitSubscription,
  today: string,
): BookSubscription {
  const existing = subscriptions.find((sub) => sub.title === upsert.title);
  if (existing) {
    return {
      ...existing,
      account: upsert.account,
      amountMinor: upsert.amountMinor,
      frequency: upsert.frequency,
      category: upsert.category ?? existing.category,
      comment: existing.comment.includes('#cashflow')
        ? existing.comment
        : existing.comment
          ? `${existing.comment}\n#cashflow`
          : '#cashflow',
    };
  }
  return {
    title: upsert.title,
    account: upsert.account,
    amountMinor: upsert.amountMinor,
    startDate: nextSmartDate(gameSubscriptionDays(subscriptions), today),
    endDate: '',
    category: upsert.category ?? '',
    comment: upsert.comment ? `${upsert.comment}\n#cashflow` : '#cashflow',
    frequency: upsert.frequency,
  };
}

/** The profession's title in the game's language, falling back to the game set's own (German) string. */
export function professionTitleText(text: GameText, profession: CashflowProfession): string {
  return textOrFallback(text, `CashflowGame.profession.${profession.id}.title`, profession.title);
}

/**
 * Runs a Payday: one transaction per subscription the game owns, each dated from its own subscription's day within
 * the current real month; every earlier game transaction ages back a month first; market buyers' offers (good for
 * one round only) go, with their notes; every kept Multi-Level-Marketing card now has its roll waiting. Payday
 * always runs - Charity and Downsized never gate it. Throws if no profession has been picked yet.
 */
export function playPayday(books: RoundBooks, deps: RoundDeps): RoundEffects {
  const { state } = books;
  const subscriptions = engineSubscriptions(books.subscriptions);
  const result = runCashflowPayday(state, subscriptions);
  const owned = ownedGameSubscriptions(state, subscriptions);
  const byTitle = new Map(books.subscriptions.map((sub) => [sub.title, sub]));
  const today = deps.clock.todayIso();

  const appendedTransactions = result.transactions.map((record, index) => ({
    ...record,
    date: dateFromSubscriptionDay(byTitle.get(owned[index]?.title)?.startDate, today),
  }));

  // The History keeps the dates that were actually written, not the game calendar's.
  const history = [...result.state.history];
  history[history.length - 1] = {
    ...history[history.length - 1],
    createdTransactions: appendedTransactions,
  };
  let next: CashflowGameState = { ...result.state, history };

  const hadOffers = (next.marketOffers ?? []).length > 0;
  const growNotes: BookGrowNotes[] = [];
  if (hadOffers) {
    next = { ...next, marketOffers: [] };
    for (const project of books.growNotes ?? []) {
      const kept = project.notes.filter((note) => !note.text.startsWith(MARKET_NOTE_MARK));
      if (kept.length !== project.notes.length)
        growNotes.push({ title: project.title, notes: kept });
    }
  }

  const recurring = (next.assetDeals ?? []).filter(
    (deal) => deal.recurring && deal.stage === 'owned',
  );
  if (recurring.length > 0) {
    next = {
      ...next,
      assetDeals: (next.assetDeals ?? []).map((deal) =>
        deal.recurring && deal.stage === 'owned' ? { ...deal, rollDue: true } : deal,
      ),
    };
  }

  return {
    ...noEffects(next, {
      kind: 'payday',
      detail: `${deps.text('CashflowGame.Round')} ${result.state.round}`,
    }),
    transactionDates: shiftedGameTransactionDates(books.transactions, -1),
    appendedTransactions,
    growNotes,
    persist: { subscriptions: false, grow: hadOffers },
    decisionNeeded: recurring.length > 0,
  };
}

/**
 * Resolves a Baby space: +1 child (at most 3) and the children-expense subscription scaled to match. The
 * subscription's title and category are written in the game's language, and the game keeps the **translated**
 * title in `gameSubscriptionTitles`, so a second child updates the same subscription instead of adding another.
 */
export function playBaby(
  books: RoundBooks,
  profession: CashflowProfession,
  deps: RoundDeps,
): RoundEffects {
  const result = resolveCashflowBaby(books.state, profession);
  const title = deps.text('CashflowGame.childrenExpensesSubscriptionTitle', {
    profession: professionTitleText(deps.text, profession),
  });
  const category = `@${deps.text('CashflowGame.childrenExpenses')}`;
  const upsert = upsertBookSubscription(
    books.subscriptions,
    { ...result.subscriptionUpsert, title, category },
    deps.clock.todayIso(),
  );
  const titles = books.state.gameSubscriptionTitles;
  return {
    ...noEffects(
      {
        ...result.state,
        gameSubscriptionTitles: titles.includes(title) ? titles : [...titles, title],
      },
      { kind: 'baby' },
    ),
    subscriptionUpserts: [upsert],
    persist: { subscriptions: true, grow: false },
  };
}

/** Resolves a Charity space: pay 10% of the total income now; the dice choice is open for the next 3 turns. */
export function playCharity(books: RoundBooks, deps: RoundDeps): RoundEffects {
  const result = resolveCashflowCharity(books.state, engineSubscriptions(books.subscriptions));
  return {
    ...noEffects(result.state, { kind: 'charity' }),
    appendedTransactions: placeOneOffTransactions(
      [result.transaction],
      books,
      deps.clock.todayIso(),
    ),
  };
}

/** Resolves a Downsized space: pay every current expense once (no income) and show the sitting-out reminder. */
export function playDownsized(books: RoundBooks, deps: RoundDeps): RoundEffects {
  const result = resolveCashflowDownsized(books.state, engineSubscriptions(books.subscriptions));
  return {
    ...noEffects(result.state, { kind: 'downsized' }),
    appendedTransactions: placeOneOffTransactions(
      result.transactions,
      books,
      deps.clock.todayIso(),
    ),
  };
}

/**
 * What a Baby / Charity / Downsized space is about to do, for the confirmation shown before it is played: the
 * money involved (the monthly expense a baby adds, the 10% charity pays, all expenses Downsized pays) and the
 * child count after a baby. Nothing is applied. Null when the space cannot be played.
 */
export function previewSpace(
  books: Pick<RoundBooks, 'state' | 'subscriptions'>,
  kind: 'baby' | 'charity' | 'downsized',
  profession: CashflowProfession | undefined,
  text: GameText,
): { amountMinor: number; children?: number } | null {
  try {
    const subscriptions = engineSubscriptions(books.subscriptions);
    if (kind === 'charity') {
      const result = resolveCashflowCharity(books.state, subscriptions);
      return { amountMinor: Math.abs(result.transaction.amountMinor) };
    }
    if (kind === 'downsized') {
      const result = resolveCashflowDownsized(books.state, subscriptions);
      return {
        amountMinor: result.transactions.reduce((sum, t) => sum + Math.abs(t.amountMinor), 0),
      };
    }
    if (!profession) return null;
    const result = resolveCashflowBaby(books.state, profession);
    const title = text('CashflowGame.childrenExpensesSubscriptionTitle', {
      profession: professionTitleText(text, profession),
    });
    const current = books.subscriptions.find((sub) => sub.title === title);
    const currentMinor = current ? Math.abs(current.amountMinor) : 0;
    return {
      amountMinor: Math.max(0, Math.abs(result.subscriptionUpsert.amountMinor) - currentMinor),
      children: result.state.children,
    };
  } catch {
    return null;
  }
}
