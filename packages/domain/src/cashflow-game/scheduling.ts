import { addMonthsToIsoDate } from './engine';

/**
 * When the game's transactions and subscriptions are dated (todo/cashflow-game.md decisions 33/39/41/56).
 *
 * The game has its own calendar (`virtualDate`), but what it **writes** is dated on the real current month, spread
 * over its days so Stats reads like real time passed: a profession's Salary lands on the 1st, taxes on the 3rd, and
 * so on. All of it is a function of "today", which is passed in (see `Clock`) - nothing here reads the system time.
 */

const pad = (value: number) => String(value).padStart(2, '0');

function yearAndMonth(today: string): [number, number] {
  const [year, month] = today.split('-').map(Number);
  return [year, month];
}

/** How many days the month of `today` has. */
function daysInMonthOf(today: string): number {
  const [year, month] = yearAndMonth(today);
  return new Date(year, month, 0).getDate();
}

/**
 * The day-of-month for a newly dated Subscription or one-off transaction, taken in this order: 1, 3, 5 ... 27,
 * then 2, 4, 6 ... 28 (nothing past the 28th for the first pass, because of February), then 29-31, skipping days
 * already in `usedDays` - so a Salary lands on the 1st, taxes on the 3rd, and so on (JFK, 2026-09-29+/2026-10-03).
 * When every day is taken it reuses the least crowded one rather than ever refusing to date something.
 *
 * Adds the chosen day to `usedDays` (the caller keeps one set across a batch, so consecutive picks differ).
 */
export function nextSmartDate(usedDays: Set<number>, today: string): string {
  const [year, month] = yearAndMonth(today);
  const daysInMonth = daysInMonthOf(today);
  const order: number[] = [];
  for (let day = 1; day <= 27; day += 2) order.push(day);
  for (let day = 2; day <= 28; day += 2) order.push(day);
  for (let day = 29; day <= daysInMonth; day++) order.push(day);
  const day =
    order.find((candidate) => candidate <= daysInMonth && !usedDays.has(candidate)) ??
    Math.min(daysInMonth, (usedDays.size % daysInMonth) + 1);
  usedDays.add(day);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Every day-of-month a `#cashflow` Subscription recurs on. A Subscription's `startDate` can sit in an earlier month
 * than today (the game started weeks ago), but it still pays on that day every month - so only its day counts.
 */
export function gameSubscriptionDays(
  subscriptions: { startDate?: string; comment?: string }[],
): Set<number> {
  const days = new Set<number>();
  for (const subscription of subscriptions) {
    const day = Number(subscription.startDate?.split('-')[2]);
    if (subscription.comment?.includes('#cashflow') && day >= 1) days.add(day);
  }
  return days;
}

/** Days already taken in this real month: the game Subscriptions' days plus any transaction dated this month. */
export function usedDaysThisMonth(
  subscriptions: { startDate?: string; comment?: string }[],
  transactions: { date?: string }[],
  today: string,
): Set<number> {
  const days = gameSubscriptionDays(subscriptions);
  const prefix = `${today.slice(0, 7)}-`;
  for (const transaction of transactions) {
    if (transaction.date?.startsWith(prefix)) days.add(Number(transaction.date.split('-')[2]));
  }
  return days;
}

/**
 * One Subscription's own `startDate` day-of-month, placed in the month of `today` - clamped to that month's actual
 * length (JFK, 2026-09-29: "we just need to make sure the highest day used is the 28th, because of February",
 * "same for 31 to 30 month"). A missing Subscription or an unreadable day counts as the 1st.
 */
export function dateFromSubscriptionDay(startDate: string | undefined, today: string): string {
  const [year, month] = yearAndMonth(today);
  const day = startDate ? Number(startDate.split('-')[2]) || 1 : 1;
  const clampedDay = Math.min(day, daysInMonthOf(today));
  return `${year}-${pad(month)}-${pad(clampedDay)}`;
}

/**
 * Grow's own trade comments ("Buy Share OK4U 250 x 10;", "Sell Investment EFH ...", "Dividende Share ...") from
 * before the Add dialog tagged game transactions. **Read only**: this recognizes old data, it never writes the
 * comment format (CLAUDE.md, PLAN.md D-16).
 */
const GROW_TRADE_COMMENT =
  /^(Buy|Sell) (Share|Investment|Asset) |^Dividende Share |^Payback Liabilitie /;

/**
 * Every game transaction: those tagged `#cashflow`, plus Grow trades made through the Add dialog before it tagged
 * them - so older games age their purchases back at Payday too (JFK, 2026-10-03: a share bought two Paydays ago
 * stayed put).
 */
export function isGameTransaction(transaction: { comment?: string }): boolean {
  const comment = transaction.comment ?? '';
  return comment.includes('#cashflow') || GROW_TRADE_COMMENT.test(comment);
}

/**
 * The new dates for every game transaction moved by `months` (Payday ages them back one month). Returns only what
 * changes, by position, so a caller can apply it to its own list without rebuilding the entries.
 */
export function shiftedGameTransactionDates(
  transactions: { date: string; comment?: string }[],
  months: number,
): { index: number; date: string }[] {
  const changes: { index: number; date: string }[] = [];
  transactions.forEach((transaction, index) => {
    if (!isGameTransaction(transaction)) return;
    const date = addMonthsToIsoDate(transaction.date, months);
    if (date !== transaction.date) changes.push({ index, date });
  });
  return changes;
}
