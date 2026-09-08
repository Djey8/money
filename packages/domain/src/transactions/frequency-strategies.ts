/**
 * Ports `src/app/shared/services/frequency-strategies/{weekly,biweekly,monthly,
 * quarterly,yearly}-frequency.ts` and `FrequencyCalculatorService`'s dispatch —
 * the recurring-occurrence engine `SubscriptionProcessingService` uses to
 * compute which dates a subscription is due on. This is the best-tested part
 * of the original domain layer (`frequency-strategies.spec.ts`, ~40 cases) and
 * has no confirmed bugs, so it's a straight port with no behavioral changes —
 * `frequency-strategies.spec.ts` in this package carries the same cases over
 * as characterization tests.
 *
 * All five strategies share the same shape: the boundary is inclusive through
 * end-of-day, `startDate` is used verbatim (not the previous occurrence) as
 * the anchor every cycle for monthly/quarterly/yearly, and weekly/biweekly are
 * pure day-count arithmetic with no calendar-month awareness at all.
 */

export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function calculateFixedIntervalOccurrences(
  startDate: string,
  boundaryDate: Date,
  intervalDays: number,
): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const boundary = new Date(boundaryDate);
  current.setHours(0, 0, 0, 0);
  boundary.setHours(23, 59, 59, 999);

  while (current <= boundary) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + intervalDays);
  }

  return dates;
}

function calculateMonthStepOccurrences(
  startDate: string,
  boundaryDate: Date,
  monthStep: number,
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const boundary = new Date(boundaryDate);
  start.setHours(0, 0, 0, 0);
  boundary.setHours(23, 59, 59, 999);

  const targetDay = start.getDate();
  let year = start.getFullYear();
  let month = start.getMonth();

  while (true) {
    const clampedDay = Math.min(targetDay, getDaysInMonth(year, month));
    const occurrence = new Date(year, month, clampedDay);
    if (occurrence > boundary) break;
    dates.push(formatDate(occurrence));

    month += monthStep;
    if (month > 11) {
      year += Math.floor(month / 12);
      month = month % 12;
    }
  }

  return dates;
}

function calculateYearlyOccurrences(startDate: string, boundaryDate: Date): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const boundary = new Date(boundaryDate);
  start.setHours(0, 0, 0, 0);
  boundary.setHours(23, 59, 59, 999);

  const targetMonth = start.getMonth();
  const targetDay = start.getDate();
  let currentYear = start.getFullYear();

  while (true) {
    const day = targetMonth === 1 && targetDay === 29 && !isLeapYear(currentYear) ? 28 : targetDay;
    const occurrence = new Date(currentYear, targetMonth, day);
    if (occurrence > boundary) break;
    dates.push(formatDate(occurrence));
    currentYear++;
  }

  return dates;
}

/** Dispatches to the matching strategy; an unrecognized frequency falls back to monthly, matching `FrequencyCalculatorService.getStrategy()`'s own defensive fallback for corrupt/legacy stored data. */
export function calculateOccurrences(
  frequency: SubscriptionFrequency,
  startDate: string,
  boundaryDate: Date,
): string[] {
  switch (frequency) {
    case 'weekly':
      return calculateFixedIntervalOccurrences(startDate, boundaryDate, 7);
    case 'biweekly':
      return calculateFixedIntervalOccurrences(startDate, boundaryDate, 14);
    case 'quarterly':
      return calculateMonthStepOccurrences(startDate, boundaryDate, 3);
    case 'yearly':
      return calculateYearlyOccurrences(startDate, boundaryDate);
    case 'monthly':
    default:
      return calculateMonthStepOccurrences(startDate, boundaryDate, 1);
  }
}
