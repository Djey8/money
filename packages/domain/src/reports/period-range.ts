/**
 * Ports `getPeriodRange` from `src/app/stats/statement/statement-calculations.ts`
 * (the Financial Statement's period-boundary logic) for the Pro API's report
 * endpoints. Faithful to the original algorithm for every period type, with
 * two deliberate boundary changes:
 *
 * - `now` is a parameter (defaulting to `new Date()`), not read from a global
 *   clock inside the function, so callers/tests can pin it.
 * - Boundaries are returned as `YYYY-MM-DD` strings, not `Date` objects, and
 *   are meant to be compared against `ApiTransaction.date` (also a plain
 *   `YYYY-MM-DD` string) via ordinary string comparison. The original
 *   compares `new Date(transaction.date)` (parsed as UTC midnight, per the
 *   ECMAScript date-only-string rule) against local-time `Date` boundaries —
 *   a real, if narrow, timezone-dependent off-by-one-day risk near midnight
 *   that string comparison of same-format dates sidesteps entirely, rather
 *   than porting it forward.
 */

export type StatementPeriodType = 'week' | 'month' | 'quarter' | 'halfyear' | 'year';

export interface PeriodRange {
  /** Inclusive, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive, `YYYY-MM-DD`. */
  endDate: string;
  /** e.g. "Q2 2026", "Sep 2026", "W36 2026". */
  label: string;
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function monthShort(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short' });
}

function isoWeek(d: Date): { week: number; year: number } {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { week, year: target.getUTCFullYear() };
}

/**
 * The date range for a given period type + offset from `now`.
 * @param type Period granularity.
 * @param index 0 = current period, -1 = previous, +1 = next.
 * @param now Reference "today" — defaults to the real current time.
 */
export function getPeriodRange(
  type: StatementPeriodType,
  index: number,
  now: Date = new Date(),
): PeriodRange {
  let startDate: Date;
  let endDate: Date;
  let label: string;

  switch (type) {
    case 'week': {
      // ISO week: Monday-Sunday.
      const day = (now.getDay() + 6) % 7; // 0=Mon…6=Sun
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      startDate = addDays(monday, index * 7);
      endDate = addDays(startDate, 6);
      const iso = isoWeek(startDate);
      label = `W${String(iso.week).padStart(2, '0')} ${iso.year}`;
      break;
    }
    case 'month': {
      const base = new Date(now.getFullYear(), now.getMonth() + index, 1);
      startDate = base;
      endDate = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      label = `${monthShort(base)} ${base.getFullYear()}`;
      break;
    }
    case 'quarter': {
      const currentQ = Math.floor(now.getMonth() / 3);
      const qIndex = currentQ + index;
      const year = now.getFullYear() + Math.floor(qIndex / 4);
      const q = ((qIndex % 4) + 4) % 4;
      startDate = new Date(year, q * 3, 1);
      endDate = new Date(year, q * 3 + 3, 0);
      label = `Q${q + 1} ${year}`;
      break;
    }
    case 'halfyear': {
      const currentH = now.getMonth() < 6 ? 0 : 1;
      const hIndex = currentH + index;
      const year = now.getFullYear() + Math.floor(hIndex / 2);
      const h = ((hIndex % 2) + 2) % 2;
      startDate = new Date(year, h * 6, 1);
      endDate = new Date(year, h * 6 + 6, 0);
      label = `H${h + 1} ${year}`;
      break;
    }
    case 'year': {
      const year = now.getFullYear() + index;
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
      label = `${year}`;
      break;
    }
  }
  return { startDate: toIsoDate(startDate), endDate: toIsoDate(endDate), label };
}
