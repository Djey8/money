import { AppStateService } from '../../shared/services/app-state.service';

/**
 * Period granularities supported by the Financial Statement.
 */
export type StatementPeriodType = 'week' | 'month' | 'quarter' | 'halfyear' | 'year';

export interface PeriodRange {
  startDate: Date;
  endDate: Date;
  /** Label for the period, e.g. "Q2 2026", "Apr 2026", "W14 2026". */
  label: string;
}

export interface IncomeStatementRow {
  label: string;
  current: number;
  previous: number;
  change: number; // percent change vs previous; 0 if previous is 0
}

export interface IncomeStatement {
  revenues: IncomeStatementRow;
  interests: IncomeStatementRow;
  propertyIncome: IncomeStatementRow;
  otherIncome: IncomeStatementRow;
  totalIncome: IncomeStatementRow;
  expensesByAccount: IncomeStatementRow[]; // Daily, Splurge, Smile, Fire
  totalExpenses: IncomeStatementRow;
  netResult: IncomeStatementRow;
  savingsRate: IncomeStatementRow; // percent
}

export interface CashflowStatement {
  operating: IncomeStatementRow;
  investing: IncomeStatementRow; // transfers into Smile/Fire (savings buckets)
  financing: IncomeStatementRow; // liability paybacks (Payback Liabilitie comments)
  mojo: IncomeStatementRow;       // contributions to Mojo (emergency/long-term)
  netCashflow: IncomeStatementRow;
}

export interface BalanceSheet {
  assets: {
    cash: number;        // current bank/cash accounts total
    shares: number;
    investments: number;
    properties: number;
    total: number;
  };
  liabilities: {
    debts: number;
    total: number;
  };
  equity: number;          // total assets - total liabilities
  netWorth: number;        // alias for equity
  note: string;             // indicates snapshot is "current" (not historical)
}

export interface KeyRatios {
  savingsRate: number;        // %
  fixedCostRatio: number;     // %
  netMargin: number;          // %
  debtRatio: number;          // ratio (liabilities / assets)
  equityRatio: number;        // %
  interestCoverage: number;   // ratio (net result / interest expenses)
}

export interface CategoryAgg {
  category: string;
  amount: number;
  percent: number;
}

export interface FinancialStatement {
  period: PeriodRange;
  previousPeriod: PeriodRange;
  income: IncomeStatement;
  cashflow: CashflowStatement;
  balance: BalanceSheet;
  ratios: KeyRatios;
  previousRatios: KeyRatios;
  topExpenses: CategoryAgg[];
  topIncomes: CategoryAgg[];
}

const EXPENSE_ACCOUNTS = ['Daily', 'Splurge', 'Smile', 'Fire'] as const;
type ExpenseAccount = typeof EXPENSE_ACCOUNTS[number];

/** Categories that denote an inter-account transfer and must be excluded from P&L. */
const TRANSFER_CATEGORIES = new Set(['Income', 'Daily', 'Splurge', 'Smile', 'Fire', 'Mojo']);

// ===================================================================
// PERIOD BOUNDARIES
// ===================================================================

/**
 * Compute the date range for a given period type + offset from "now".
 * @param type Period granularity.
 * @param index 0 = current period, -1 = previous, +1 = next.
 */
export function getPeriodRange(type: StatementPeriodType, index: number): PeriodRange {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let label: string;

  switch (type) {
    case 'week': {
      // ISO week: Monday–Sunday.
      const day = (now.getDay() + 6) % 7; // 0=Mon…6=Sun
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      startDate = addDays(monday, index * 7);
      endDate = endOfDay(addDays(startDate, 6));
      const iso = isoWeek(startDate);
      label = `W${String(iso.week).padStart(2, '0')} ${iso.year}`;
      break;
    }
    case 'month': {
      const base = new Date(now.getFullYear(), now.getMonth() + index, 1);
      startDate = base;
      endDate = endOfDay(new Date(base.getFullYear(), base.getMonth() + 1, 0));
      label = `${monthShort(base)} ${base.getFullYear()}`;
      break;
    }
    case 'quarter': {
      const currentQ = Math.floor(now.getMonth() / 3);
      const qIndex = currentQ + index;
      const year = now.getFullYear() + Math.floor(qIndex / 4);
      const q = ((qIndex % 4) + 4) % 4;
      startDate = new Date(year, q * 3, 1);
      endDate = endOfDay(new Date(year, q * 3 + 3, 0));
      label = `Q${q + 1} ${year}`;
      break;
    }
    case 'halfyear': {
      const currentH = now.getMonth() < 6 ? 0 : 1;
      const hIndex = currentH + index;
      const year = now.getFullYear() + Math.floor(hIndex / 2);
      const h = ((hIndex % 2) + 2) % 2;
      startDate = new Date(year, h * 6, 1);
      endDate = endOfDay(new Date(year, h * 6 + 6, 0));
      label = `H${h + 1} ${year}`;
      break;
    }
    case 'year': {
      const year = now.getFullYear() + index;
      startDate = new Date(year, 0, 1);
      endDate = endOfDay(new Date(year, 11, 31));
      label = `${year}`;
      break;
    }
  }
  return { startDate, endDate, label };
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { week, year: target.getUTCFullYear() };
}

// ===================================================================
// TRANSACTION FILTERING
// ===================================================================

function txInRange(t: { date: string }, range: PeriodRange): boolean {
  const d = new Date(t.date);
  return d >= range.startDate && d <= range.endDate;
}

function cleanCategory(cat: string | undefined): string {
  return (cat || '').replace('@', '');
}

function isTransfer(t: { category?: string }): boolean {
  return TRANSFER_CATEGORIES.has(cleanCategory(t.category));
}

// ===================================================================
// INCOME STATEMENT
// ===================================================================

function classifyIncome(tag: string): 'interest' | 'property' | 'revenue' {
  const lower = tag.toLowerCase();
  const interestTags = new Set(
    AppStateService.instance.allIntrests.map(i => i.tag.toLowerCase())
      .concat(AppStateService.instance.allShares.map(s => s.tag.toLowerCase()))
  );
  const propertyTags = new Set(
    AppStateService.instance.allProperties.map(p => p.tag.toLowerCase())
      .concat(AppStateService.instance.allInvestments.map(i => i.tag.toLowerCase()))
  );
  if (interestTags.has(lower)) return 'interest';
  if (propertyTags.has(lower)) return 'property';
  return 'revenue';
}

function computeIncomeSide(range: PeriodRange): {
  revenues: number; interests: number; propertyIncome: number; otherIncome: number; total: number;
} {
  let revenues = 0, interests = 0, propertyIncome = 0, otherIncome = 0;
  const txs = AppStateService.instance.allTransactions.filter(t =>
    t.account === 'Income' && Number(t.amount) > 0 && !isTransfer(t) && txInRange(t, range)
  );
  for (const t of txs) {
    const amt = Number(t.amount);
    const tag = cleanCategory(t.category);
    if (!tag) {
      otherIncome += amt;
      continue;
    }
    const kind = classifyIncome(tag);
    if (kind === 'interest') interests += amt;
    else if (kind === 'property') propertyIncome += amt;
    else revenues += amt;
  }
  return {
    revenues, interests, propertyIncome, otherIncome,
    total: revenues + interests + propertyIncome + otherIncome,
  };
}

function computeExpenseSide(range: PeriodRange): { byAccount: Record<ExpenseAccount, number>; total: number } {
  const byAccount: Record<ExpenseAccount, number> = { Daily: 0, Splurge: 0, Smile: 0, Fire: 0 };
  const txs = AppStateService.instance.allTransactions.filter(t =>
    (EXPENSE_ACCOUNTS as readonly string[]).includes(t.account) &&
    Number(t.amount) < 0 &&
    !isTransfer(t) &&
    txInRange(t, range)
  );
  for (const t of txs) {
    byAccount[t.account as ExpenseAccount] += Math.abs(Number(t.amount));
  }
  const total = byAccount.Daily + byAccount.Splurge + byAccount.Smile + byAccount.Fire;
  return { byAccount, total };
}

function makeRow(label: string, current: number, previous: number): IncomeStatementRow {
  const change = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  return { label, current, previous, change };
}

export function computeIncomeStatement(current: PeriodRange, previous: PeriodRange): IncomeStatement {
  const curIn = computeIncomeSide(current);
  const prevIn = computeIncomeSide(previous);
  const curEx = computeExpenseSide(current);
  const prevEx = computeExpenseSide(previous);

  const revenues = makeRow('Statement.revenues', curIn.revenues, prevIn.revenues);
  const interests = makeRow('Statement.interestIncome', curIn.interests, prevIn.interests);
  const propertyIncome = makeRow('Statement.propertyIncome', curIn.propertyIncome, prevIn.propertyIncome);
  const otherIncome = makeRow('Statement.otherIncome', curIn.otherIncome, prevIn.otherIncome);
  const totalIncome = makeRow('Statement.totalIncome', curIn.total, prevIn.total);

  const expensesByAccount: IncomeStatementRow[] = (EXPENSE_ACCOUNTS as readonly ExpenseAccount[]).map(acc =>
    makeRow(`Menu.${acc.toLowerCase()}`, curEx.byAccount[acc], prevEx.byAccount[acc])
  );
  const totalExpenses = makeRow('Statement.totalExpenses', curEx.total, prevEx.total);

  const netCurrent = curIn.total - curEx.total;
  const netPrevious = prevIn.total - prevEx.total;
  const netResult = makeRow('Statement.netResult', netCurrent, netPrevious);

  const srCur = curIn.total > 0 ? (netCurrent / curIn.total) * 100 : 0;
  const srPrev = prevIn.total > 0 ? (netPrevious / prevIn.total) * 100 : 0;
  const savingsRate = makeRow('Statement.savingsRate', srCur, srPrev);

  return {
    revenues, interests, propertyIncome, otherIncome, totalIncome,
    expensesByAccount, totalExpenses, netResult, savingsRate,
  };
}

// ===================================================================
// CASHFLOW STATEMENT
// ===================================================================

function computeCashflowOne(range: PeriodRange): {
  operating: number; investing: number; financing: number; mojo: number;
} {
  let operating = 0, investing = 0, financing = 0, mojo = 0;
  for (const t of AppStateService.instance.allTransactions) {
    if (!txInRange(t, range)) continue;
    if (Number(t.amount) === 0) continue;
    const amt = Number(t.amount);
    const cat = cleanCategory(t.category);
    const comment = (t.comment || '').toLowerCase();

    // Financing: liability paybacks (regardless of account)
    if (comment.includes('payback liabilitie')) {
      financing += Math.abs(amt);
      continue;
    }

    // Investing: transfers into long-term buckets Smile + Fire from Income
    if (t.account === 'Income' && amt < 0 && (cat === 'Smile' || cat === 'Fire')) {
      investing += Math.abs(amt);
      continue;
    }

    // Mojo contributions (transfers to Mojo or Mojo account inflows)
    if (t.account === 'Mojo' && amt > 0) {
      mojo += amt;
      continue;
    }
    if (t.account === 'Income' && amt < 0 && cat === 'Mojo') {
      mojo += Math.abs(amt);
      continue;
    }

    // Operating: anything else that isn't an internal transfer
    if (isTransfer(t)) continue;
    if (t.account === 'Income' && amt > 0) operating += amt;
    else if ((EXPENSE_ACCOUNTS as readonly string[]).includes(t.account) && amt < 0) operating -= Math.abs(amt);
  }
  return { operating, investing, financing, mojo };
}

export function computeCashflow(current: PeriodRange, previous: PeriodRange): CashflowStatement {
  const cur = computeCashflowOne(current);
  const prev = computeCashflowOne(previous);
  const operating = makeRow('Statement.operating', cur.operating, prev.operating);
  const investing = makeRow('Statement.investing', cur.investing, prev.investing);
  const financing = makeRow('Statement.financing', cur.financing, prev.financing);
  const mojo = makeRow('Income.Mojo', cur.mojo, prev.mojo);
  const netCashflow = makeRow(
    'Statement.netCashflow',
    cur.operating - cur.investing - cur.financing - cur.mojo,
    prev.operating - prev.investing - prev.financing - prev.mojo,
  );
  return { operating, investing, financing, mojo, netCashflow };
}

// ===================================================================
// BALANCE SHEET (current snapshot — not historical)
// ===================================================================

export function computeBalanceSheet(): BalanceSheet {
  const s = AppStateService.instance;
  const cash = (s.allAssets || []).reduce((acc, a) => acc + Number(a.amount || 0), 0);
  const shares = (s.allShares || []).reduce((acc, x) => acc + Number(x.quantity || 0) * Number(x.price || 0), 0);
  const investments = (s.allInvestments || []).reduce((acc, i) => acc + Number(i.amount || 0) + Number(i.deposit || 0), 0);
  const properties = (s.allProperties || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const assetsTotal = cash + shares + investments + properties;
  const debts = (s.liabilities || []).reduce((acc, l) => acc + Number(l.amount || 0), 0);
  const equity = assetsTotal - debts;
  return {
    assets: { cash, shares, investments, properties, total: assetsTotal },
    liabilities: { debts, total: debts },
    equity,
    netWorth: equity,
    note: 'Statement.balanceSheetNote',
  };
}

// ===================================================================
// KEY RATIOS
// ===================================================================

function computeRatiosForRange(range: PeriodRange, balance: BalanceSheet): KeyRatios {
  const income = computeIncomeSide(range);
  const expenses = computeExpenseSide(range);
  const net = income.total - expenses.total;

  // Fixed cost ratio: fixed costs are expenses whose category matches an active subscription.
  const subs = AppStateService.instance.allSubscriptions || [];
  const fixedCategories = new Set(subs.map(s => cleanCategory(s.category)));
  let fixedTotal = 0;
  for (const t of AppStateService.instance.allTransactions) {
    if (!txInRange(t, range)) continue;
    if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(t.account)) continue;
    if (Number(t.amount) >= 0) continue;
    if (isTransfer(t)) continue;
    if (fixedCategories.has(cleanCategory(t.category))) {
      fixedTotal += Math.abs(Number(t.amount));
    }
  }

  // Interest expenses within the range
  let interestExpenses = 0;
  for (const t of AppStateService.instance.allTransactions) {
    if (!txInRange(t, range)) continue;
    if ((t.comment || '').toLowerCase().includes('payback liabilitie')) {
      interestExpenses += Math.abs(Number(t.amount));
    }
  }

  return {
    savingsRate: income.total > 0 ? (net / income.total) * 100 : 0,
    fixedCostRatio: expenses.total > 0 ? (fixedTotal / expenses.total) * 100 : 0,
    netMargin: income.total > 0 ? (net / income.total) * 100 : 0,
    debtRatio: balance.assets.total > 0 ? balance.liabilities.total / balance.assets.total : 0,
    equityRatio: balance.assets.total + balance.liabilities.total > 0
      ? (balance.equity / (balance.assets.total + balance.liabilities.total)) * 100
      : 0,
    interestCoverage: interestExpenses > 0 ? net / interestExpenses : 0,
  };
}

// ===================================================================
// TOP CATEGORIES
// ===================================================================

function topCategories(range: PeriodRange, side: 'expense' | 'income', limit = 5): CategoryAgg[] {
  const map = new Map<string, number>();
  for (const t of AppStateService.instance.allTransactions) {
    if (!txInRange(t, range)) continue;
    if (isTransfer(t)) continue;
    const amt = Number(t.amount);
    if (amt === 0) continue;
    const cat = cleanCategory(t.category) || '—';

    if (side === 'expense') {
      if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(t.account)) continue;
      if (amt >= 0) continue;
      map.set(cat, (map.get(cat) || 0) + Math.abs(amt));
    } else {
      if (t.account !== 'Income' || amt <= 0) continue;
      map.set(cat, (map.get(cat) || 0) + amt);
    }
  }
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }));
}

// ===================================================================
// ORCHESTRATOR
// ===================================================================

export function computeStatement(type: StatementPeriodType, index: number): FinancialStatement {
  const period = getPeriodRange(type, index);
  const previousPeriod = getPeriodRange(type, index - 1);
  const balance = computeBalanceSheet();
  return {
    period,
    previousPeriod,
    income: computeIncomeStatement(period, previousPeriod),
    cashflow: computeCashflow(period, previousPeriod),
    balance,
    ratios: computeRatiosForRange(period, balance),
    previousRatios: computeRatiosForRange(previousPeriod, balance),
    topExpenses: topCategories(period, 'expense'),
    topIncomes: topCategories(period, 'income'),
  };
}
