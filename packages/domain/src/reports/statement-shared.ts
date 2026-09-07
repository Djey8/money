import { ApiTransaction } from '../transactions/transaction';
import { PeriodRange } from './period-range';

/**
 * Helpers shared by every report ported from
 * `src/app/stats/statement/statement-calculations.ts` (the Financial
 * Statement — canonical per PLAN.md D-22). Extracted once both
 * income-statement.ts and cashflow.ts needed the identical transfer-exclusion
 * and period-filtering logic, rather than duplicating a second copy.
 */

export interface StatementRow {
  /** Money rows: integer minor units. A percentage row (e.g. savings rate): a percentage point value. */
  current: number;
  previous: number;
  /** Relative percent change vs. `previous` — `((current - previous) / abs(previous)) * 100`, or 0 if `previous` is 0. Note this is a relative change, not a percentage-point difference, even for a percentage row (a move from 20% to 25% is a +25% change, not +5). */
  changePercent: number;
}

export function makeRow(current: number, previous: number): StatementRow {
  const changePercent = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  return { current, previous, changePercent };
}

export const EXPENSE_ACCOUNTS = ['Daily', 'Splurge', 'Smile', 'Fire'] as const;
export type ExpenseAccount = (typeof EXPENSE_ACCOUNTS)[number];

/** Categories that denote an inter-account transfer and must be excluded from P&L/cashflow. */
const TRANSFER_CATEGORIES = new Set(['Income', 'Daily', 'Splurge', 'Smile', 'Fire', 'Mojo']);

export function cleanCategory(category: string): string {
  return category.replace('@', '');
}

export function isTransfer(category: string): boolean {
  return TRANSFER_CATEGORIES.has(cleanCategory(category));
}

export function inRange(transaction: ApiTransaction, range: PeriodRange): boolean {
  return transaction.date >= range.startDate && transaction.date <= range.endDate;
}
