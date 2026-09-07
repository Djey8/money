import { ApiTransaction } from '../transactions/transaction';
import { PeriodRange } from './period-range';

/**
 * Ports `computeIncomeStatement`/`computeIncomeSide`/`computeExpenseSide`/
 * `classifyIncome` from `src/app/stats/statement/statement-calculations.ts`
 * (the Financial Statement, STATS-7/CASH-2's canonical source per PLAN.md
 * D-22 — the only one of three independently-computed income/expense paths
 * in this codebase with correct transfer exclusion and discrete period
 * semantics).
 *
 * Deliberately NOT the same classification as
 * `packages/domain/src/transactions/accounting.ts` (Slice 1's derived-state
 * writer, which matches `IncomeStatementService.recalculate()`'s simpler
 * shares/investments-only, no-transfer-exclusion rule instead) — these are
 * two genuinely different, independently-shipping calculations in the
 * original app, not a duplicate to consolidate. Don't merge them.
 */

export interface IncomeClassificationTags {
  /** Tags of `income/revenue/interests` entries. */
  interestTags?: string[];
  /** Tags of `balance/asset/shares` entries — also counted as interest income, matching the original's combined set. */
  shareTags?: string[];
  /** Tags of `income/revenue/properties` entries. */
  propertyTags?: string[];
  /** Tags of `balance/asset/investments` entries — also counted as property income, matching the original's combined set. */
  investmentTags?: string[];
}

export interface StatementRow {
  /** Money rows: integer minor units. The `savingsRatePercent` row: a percentage point value. */
  current: number;
  previous: number;
  /** Relative percent change vs. `previous` — `((current - previous) / abs(previous)) * 100`, or 0 if `previous` is 0. Note this is a relative change, not a percentage-point difference, even for the `savingsRatePercent` row (a move from 20% to 25% is a +25% change, not +5). */
  changePercent: number;
}

const EXPENSE_ACCOUNTS = ['Daily', 'Splurge', 'Smile', 'Fire'] as const;
type ExpenseAccount = (typeof EXPENSE_ACCOUNTS)[number];

export interface IncomeStatement {
  revenues: StatementRow;
  interests: StatementRow;
  propertyIncome: StatementRow;
  otherIncome: StatementRow;
  totalIncome: StatementRow;
  expensesByAccount: Record<ExpenseAccount, StatementRow>;
  totalExpenses: StatementRow;
  netResult: StatementRow;
  savingsRatePercent: StatementRow;
}

/** Categories that denote an inter-account transfer and must be excluded from P&L. */
const TRANSFER_CATEGORIES = new Set(['Income', 'Daily', 'Splurge', 'Smile', 'Fire', 'Mojo']);

function cleanCategory(category: string): string {
  return category.replace('@', '');
}

function isTransfer(category: string): boolean {
  return TRANSFER_CATEGORIES.has(cleanCategory(category));
}

function inRange(transaction: ApiTransaction, range: PeriodRange): boolean {
  return transaction.date >= range.startDate && transaction.date <= range.endDate;
}

interface ClassificationSets {
  interestSet: Set<string>;
  propertySet: Set<string>;
}

function buildClassificationSets(tags: IncomeClassificationTags): ClassificationSets {
  return {
    interestSet: new Set(
      [...(tags.interestTags ?? []), ...(tags.shareTags ?? [])].map((tag) => tag.toLowerCase()),
    ),
    propertySet: new Set(
      [...(tags.propertyTags ?? []), ...(tags.investmentTags ?? [])].map((tag) =>
        tag.toLowerCase(),
      ),
    ),
  };
}

function classifyIncome(tag: string, sets: ClassificationSets): 'interest' | 'property' | 'revenue' {
  const lower = tag.toLowerCase();
  if (sets.interestSet.has(lower)) return 'interest';
  if (sets.propertySet.has(lower)) return 'property';
  return 'revenue';
}

function computeIncomeSide(
  transactions: ApiTransaction[],
  range: PeriodRange,
  tags: IncomeClassificationTags,
): { revenues: number; interests: number; propertyIncome: number; otherIncome: number; total: number } {
  const sets = buildClassificationSets(tags);
  let revenues = 0;
  let interests = 0;
  let propertyIncome = 0;
  let otherIncome = 0;
  for (const transaction of transactions) {
    if (transaction.account !== 'Income') continue;
    if (transaction.amountMinor <= 0) continue;
    if (isTransfer(transaction.category)) continue;
    if (!inRange(transaction, range)) continue;
    const tag = cleanCategory(transaction.category);
    if (!tag) {
      otherIncome += transaction.amountMinor;
      continue;
    }
    const kind = classifyIncome(tag, sets);
    if (kind === 'interest') interests += transaction.amountMinor;
    else if (kind === 'property') propertyIncome += transaction.amountMinor;
    else revenues += transaction.amountMinor;
  }
  return { revenues, interests, propertyIncome, otherIncome, total: revenues + interests + propertyIncome + otherIncome };
}

function computeExpenseSide(
  transactions: ApiTransaction[],
  range: PeriodRange,
): { byAccount: Record<ExpenseAccount, number>; total: number } {
  const byAccount: Record<ExpenseAccount, number> = { Daily: 0, Splurge: 0, Smile: 0, Fire: 0 };
  for (const transaction of transactions) {
    if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account)) continue;
    if (transaction.amountMinor >= 0) continue;
    if (isTransfer(transaction.category)) continue;
    if (!inRange(transaction, range)) continue;
    byAccount[transaction.account as ExpenseAccount] += Math.abs(transaction.amountMinor);
  }
  const total = EXPENSE_ACCOUNTS.reduce((sum, account) => sum + byAccount[account], 0);
  return { byAccount, total };
}

function makeRow(current: number, previous: number): StatementRow {
  const changePercent = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  return { current, previous, changePercent };
}

export function computeIncomeStatement(
  transactions: ApiTransaction[],
  currentRange: PeriodRange,
  previousRange: PeriodRange,
  tags: IncomeClassificationTags = {},
): IncomeStatement {
  const curIn = computeIncomeSide(transactions, currentRange, tags);
  const prevIn = computeIncomeSide(transactions, previousRange, tags);
  const curEx = computeExpenseSide(transactions, currentRange);
  const prevEx = computeExpenseSide(transactions, previousRange);

  const expensesByAccount = Object.fromEntries(
    EXPENSE_ACCOUNTS.map((account) => [
      account,
      makeRow(curEx.byAccount[account], prevEx.byAccount[account]),
    ]),
  ) as Record<ExpenseAccount, StatementRow>;

  const netCurrent = curIn.total - curEx.total;
  const netPrevious = prevIn.total - prevEx.total;

  const savingsRateCurrent = curIn.total > 0 ? (netCurrent / curIn.total) * 100 : 0;
  const savingsRatePrevious = prevIn.total > 0 ? (netPrevious / prevIn.total) * 100 : 0;

  return {
    revenues: makeRow(curIn.revenues, prevIn.revenues),
    interests: makeRow(curIn.interests, prevIn.interests),
    propertyIncome: makeRow(curIn.propertyIncome, prevIn.propertyIncome),
    otherIncome: makeRow(curIn.otherIncome, prevIn.otherIncome),
    totalIncome: makeRow(curIn.total, prevIn.total),
    expensesByAccount,
    totalExpenses: makeRow(curEx.total, prevEx.total),
    netResult: makeRow(netCurrent, netPrevious),
    savingsRatePercent: makeRow(savingsRateCurrent, savingsRatePrevious),
  };
}
