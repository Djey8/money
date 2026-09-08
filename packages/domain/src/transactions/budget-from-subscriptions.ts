import { SubscriptionFrequency } from './frequency-strategies';

/**
 * Ports `plan.component.ts`'s `subscriptions()` ("import budget from
 * subscriptions") for `POST /budget/from-subscriptions`. The original sums
 * `Math.abs(sub.amount)` into `monthlyCategoryAmounts[budgetDate][sub.category]`
 * for every calendar month a subscription is active — confirmed by reading it
 * directly, `sub.frequency` is never read anywhere in that method, so a
 * quarterly subscription's full nominal amount gets added into *every* month
 * (not amortized to a third of it, and not skipped in the two non-billing
 * months), and a yearly subscription's full annual amount gets added to every
 * single month — a real over-budgeting bug, not a rounding quirk. This port
 * fixes it by converting each subscription's amount to its real
 * monthly-equivalent before accumulating: `amount * (occurrences per year / 12)`.
 *
 * The original also has a separate, narrower quirk in its end-month handling
 * (a transaction-matching heuristic that only sometimes includes the
 * subscription's own end month) — that's unrelated to the frequency bug and
 * not preserved here: a subscription's active range is simply every calendar
 * month from `startDate`'s month through `endDate`'s month inclusive (or
 * through `now`'s month if there's no end date), a cleaner rule than the
 * original's heuristic without changing which subscriptions get processed at
 * all in the common case (no end date, or an end date that isn't this month).
 */

const MONTHLY_EQUIVALENT_FACTOR: Record<SubscriptionFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export interface SubscriptionForBudget {
  account: string;
  amountMinor: number;
  startDate: string;
  /** `null` (or `''`) means no end date — active through `now`. */
  endDate: string | null;
  category: string;
  frequency: SubscriptionFrequency;
}

export interface BudgetRowFromSubscriptions {
  date: string;
  tag: string;
  amountMinor: number;
}

function monthOf(dateString: string): string {
  return dateString.slice(0, 7);
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetweenInclusive(startMonth: string, endMonth: string): string[] {
  const [startYear, startMonthNumber] = startMonth.split('-').map(Number);
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
  const startTotal = startYear * 12 + (startMonthNumber - 1);
  const endTotal = endYear * 12 + (endMonthNumber - 1);
  const months: string[] = [];
  for (let total = startTotal; total <= endTotal; total += 1) {
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

function monthlyEquivalentAmountMinor(subscription: SubscriptionForBudget): number {
  const factor = MONTHLY_EQUIVALENT_FACTOR[subscription.frequency] ?? 1;
  return Math.round(Math.abs(subscription.amountMinor) * factor);
}

/**
 * Computes one aggregated `{date, tag, amountMinor}` row per (month,
 * category) pair with at least one active subscription, summing every
 * subscription that shares that category and is active that month —
 * matching the original's per-category-per-month summing exactly. Skips
 * subscriptions on the `Income` account, matching the original.
 */
export function computeBudgetRowsFromSubscriptions(
  subscriptions: SubscriptionForBudget[],
  now: Date = new Date(),
): BudgetRowFromSubscriptions[] {
  const currentMonth = formatMonth(now);
  // Keyed by month + category concatenated directly (no separator): `month` is always
  // exactly 7 characters (YYYY-MM), so the fixed-offset split below is safe even when
  // `category` itself contains a space (e.g. "@Side job") — a delimiter like " " or "|"
  // would not be, since a category could coincidentally contain it too.
  const totals = new Map<string, number>();

  for (const subscription of subscriptions) {
    if (subscription.account === 'Income') continue;
    const startMonth = monthOf(subscription.startDate);
    const endMonth = subscription.endDate ? monthOf(subscription.endDate) : currentMonth;
    const monthlyAmount = monthlyEquivalentAmountMinor(subscription);
    for (const month of monthsBetweenInclusive(startMonth, endMonth)) {
      const key = `${month}${subscription.category}`;
      totals.set(key, (totals.get(key) || 0) + monthlyAmount);
    }
  }

  return [...totals.entries()].map(([key, amountMinor]) => {
    const date = key.slice(0, 7);
    const tag = key.slice(7);
    return { date, tag, amountMinor };
  });
}
