import { hasGameTag } from '../cashflow-game/game-tag';
/**
 * The income the Budget chart draws as its green line (JFK, 2026-10-19): what was actually earned in a month - the salary, the
 * income of positive subscriptions, the bonus of a Multi-Level-Marketing card, the interest of a loan to a relative, a one-time
 * payment such as a deal card sold to another player. It is every transaction booked to the Income account with a positive amount,
 * EXCEPT money that is only a change of what is owned: the proceeds of selling an asset, a share, an investment or gold (a sale of
 * 40.000 would flatten every other month of the chart), and borrowed money (a Bank loan goes to the Daily account, so it never
 * counts). The starting savings of a game are a starting balance, not earnings. Paying a deposit for a property is NOT excluded
 * from the actual expenses: it is a negative amount and counts as one.
 */

export interface IncomeCandidate {
  account: string;
  amountMinor: number;
  comment?: string;
  category?: string;
}

/** The "savings" word of the game in each of its six languages: the starting savings are booked under it. */
const STARTING_SAVINGS = ['savings', 'ersparnisse', 'ahorros', 'épargne', '储蓄', 'المدخرات'];

/** A sale as the Add dialog writes it into a transaction's comment ("Sell Share X 10 x 25;", "Sell Asset ...", "Sell Investment ...", gold). */
const SALE_COMMENT = /\bSell\s+(Asset|Share|Investment|Coins?|Gold|Property)\b/i;

export function isActualIncome(transaction: IncomeCandidate): boolean {
  if (transaction.account !== 'Income' || !(transaction.amountMinor > 0)) return false;
  if (SALE_COMMENT.test(transaction.comment ?? '')) return false;
  const category = (transaction.category ?? '').replace(/^@/, '').trim().toLowerCase();
  if (STARTING_SAVINGS.includes(category) && hasGameTag(transaction.comment)) {
    return false;
  }
  return true;
}

/** The planned budget a Payday adds: the expenses its subscriptions posted, per month and category (the tag as the budget keeps it). */
export interface PlannedBudgetRow {
  date: string;
  tag: string;
  amountMinor: number;
}

export function plannedBudgetFromPayday(
  paydayTransactions: { account: string; amountMinor: number; date: string; category?: string }[],
): PlannedBudgetRow[] {
  const totals = new Map<string, PlannedBudgetRow>();
  for (const transaction of paydayTransactions) {
    if (transaction.account === 'Income' || !(transaction.amountMinor < 0)) continue;
    const date = transaction.date.slice(0, 7);
    const tag = transaction.category ? transaction.category : '@others';
    const key = `${date}|${tag}`;
    const row = totals.get(key) ?? { date, tag, amountMinor: 0 };
    row.amountMinor += -transaction.amountMinor;
    totals.set(key, row);
  }
  return [...totals.values()];
}
