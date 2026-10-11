import { calculateOccurrences, SubscriptionFrequency } from './frequency-strategies';

/**
 * Keeps a subscription's generated transactions in line with the subscription (JFK, 2026-10-10: "if I change the
 * subscription details, delete the old transactions and add all the new ones up to today; if I only move the end date into
 * the past, remove the ones after it; into the future, add the missing ones").
 *
 * A subscription has no link to the transactions it generated - they are recognised by what they look like: the
 * subscription's account, amount and category, the comment `title` (or `title + comment`) - possibly followed by the
 * `#bucket:` / `#settle:` tags the fund engine appends for Smile and Fire - and a date that is one of the occurrences the
 * subscription had. That last condition keeps a hand-made transaction with the same account, amount and category (on
 * another day, or with another comment) out of harm's way.
 *
 * One rule covers every edit: remove what the OLD subscription generated and the NEW one would not generate. Details
 * changed - nothing of the old one matches the new, so all of it goes; end date earlier - the occurrences after it go;
 * end date later or nothing changed - nothing goes. Adding what is missing is the ordinary generation
 * (`generateDueSubscriptionTransactions`), which skips whatever already exists.
 */

/** The fields of a subscription that decide which transactions it generates. */
export interface SyncSubscription {
  title: string;
  account: string;
  amountMinor: number;
  startDate: string;
  /** `null` (or `''`) means no end date. */
  endDate: string | null;
  category: string;
  comment: string;
  frequency: SubscriptionFrequency;
}

export interface SyncTransaction {
  date: string;
  account: string;
  amountMinor: number;
  category: string;
  comment: string;
}

/** The comment a generated transaction carries. */
export function constructedSubscriptionComment(title: string, comment: string): string {
  return comment ? `${title} + ${comment}` : title;
}

const FUND_TAGS_ONLY = /^(?:\s*#(?:bucket|settle):[^:]+:[\d.]+)+\s*$/;

/** True when `comment` is the generated comment, with nothing after it but fund tags. */
export function isGeneratedComment(comment: string, constructed: string): boolean {
  if (comment === constructed) return true;
  return comment.startsWith(constructed) && FUND_TAGS_ONLY.test(comment.slice(constructed.length));
}

/**
 * The dates a subscription is due on, up to today or its end date, whichever is earlier - the dates
 * `generateDueSubscriptionTransactions` creates transactions for. None for a subscription that has not started.
 */
export function subscriptionOccurrenceDates(subscription: SyncSubscription, now: Date): string[] {
  const start = new Date(subscription.startDate);
  if (start >= now) return [];
  const end = subscription.endDate ? new Date(subscription.endDate) : null;
  const boundary = end && end < now ? end : now;
  return calculateOccurrences(
    subscription.frequency || 'monthly',
    subscription.startDate,
    boundary,
  );
}

/** True when `transaction` looks like one the subscription generated (see the header). */
export function isGeneratedBy(
  subscription: SyncSubscription,
  transaction: SyncTransaction,
  dates: ReadonlySet<string>,
): boolean {
  return (
    transaction.account === subscription.account &&
    transaction.amountMinor === subscription.amountMinor &&
    transaction.category === subscription.category &&
    dates.has(transaction.date) &&
    isGeneratedComment(
      transaction.comment,
      constructedSubscriptionComment(subscription.title, subscription.comment),
    )
  );
}

/**
 * The indices of `transactions` to remove because `before` generated them and `after` would not. `after` is `null` when
 * the subscription is deleted (everything it generated goes).
 */
export function staleGeneratedTransactions(
  before: SyncSubscription,
  after: SyncSubscription | null,
  transactions: readonly SyncTransaction[],
  now: Date,
): number[] {
  const beforeDates = new Set(subscriptionOccurrenceDates(before, now));
  const afterDates = after ? new Set(subscriptionOccurrenceDates(after, now)) : new Set<string>();
  const stale: number[] = [];
  transactions.forEach((transaction, index) => {
    if (!isGeneratedBy(before, transaction, beforeDates)) return;
    if (after && isGeneratedBy(after, transaction, afterDates)) return;
    stale.push(index);
  });
  return stale;
}

// ── Editing in place ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedTransactionUpdate {
  /** Index into the transactions that were passed in. */
  index: number;
  date: string;
  account: string;
  amountMinor: number;
  category: string;
  comment: string;
}

export interface SubscriptionReconciliation {
  /** Transactions to change in place (they keep their id and their place in the list). */
  updates: GeneratedTransactionUpdate[];
  /** Transactions to delete: the old subscription generated them and the new one has no occurrence for them. */
  removals: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / DAY_MS);
}

/** The calendar period an occurrence belongs to; weekly and biweekly ones have none (matched by distance). */
function periodOf(frequency: SubscriptionFrequency, date: string): string | null {
  const [year, month] = date.split('-').map(Number);
  switch (frequency) {
    case 'weekly':
    case 'biweekly':
      return null;
    case 'quarterly':
      return `${year}-Q${Math.floor((month - 1) / 3)}`;
    case 'yearly':
      return `${year}`;
    default:
      return `${year}-${month}`;
  }
}

/**
 * Changes a subscription's generated transactions in place where it can (JFK, 2026-10-10: keep the id and the order of
 * the transactions unless one really goes). Each occurrence of the new subscription takes over the old generated
 * transaction of the same period - the same month for a monthly one, the nearest day within half an interval for a weekly
 * one - changing its date, account, amount, category and comment to the new values. Old transactions with no occurrence
 * left are removed; occurrences with no old transaction are not handled here (the ordinary generation adds them, at the
 * end of the list). `after` is `null` when the subscription is deleted: everything it generated goes.
 */
export function reconcileGeneratedTransactions(
  before: SyncSubscription,
  after: SyncSubscription | null,
  transactions: readonly SyncTransaction[],
  now: Date,
): SubscriptionReconciliation {
  const beforeDates = new Set(subscriptionOccurrenceDates(before, now));
  const candidates: number[] = [];
  transactions.forEach((transaction, index) => {
    if (isGeneratedBy(before, transaction, beforeDates)) candidates.push(index);
  });
  if (!after) return { updates: [], removals: candidates };

  const frequency = after.frequency || 'monthly';
  const maxDistance = frequency === 'weekly' ? 3 : frequency === 'biweekly' ? 7 : 0;
  const free = new Set(candidates);
  const takeFor = (date: string): number | null => {
    const period = periodOf(frequency, date);
    let best: number | null = null;
    let bestDistance = Infinity;
    for (const index of free) {
      const other = transactions[index].date;
      const distance = Math.abs(dayNumber(other) - dayNumber(date));
      const fits =
        period !== null ? periodOf(frequency, other) === period : distance <= maxDistance;
      // within a period the closest day wins; the earlier transaction wins a tie
      if (
        fits &&
        (distance < bestDistance || (distance === bestDistance && index < (best ?? Infinity)))
      ) {
        best = index;
        bestDistance = distance;
      }
    }
    if (best !== null) free.delete(best);
    return best;
  };

  const constructed = constructedSubscriptionComment(after.title, after.comment);
  const updates: GeneratedTransactionUpdate[] = [];
  for (const date of subscriptionOccurrenceDates(after, now)) {
    const index = takeFor(date);
    if (index === null) continue;
    const current = transactions[index];
    // fund tags after the comment stay while the comment does
    const comment = isGeneratedComment(current.comment, constructed)
      ? current.comment
      : constructed;
    if (
      current.date !== date ||
      current.account !== after.account ||
      current.amountMinor !== after.amountMinor ||
      current.category !== after.category ||
      current.comment !== comment
    ) {
      updates.push({
        index,
        date,
        account: after.account,
        amountMinor: after.amountMinor,
        category: after.category,
        comment,
      });
    }
  }
  return { updates, removals: [...free].sort((a, b) => a - b) };
}
