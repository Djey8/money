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
