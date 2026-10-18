import { finalSummary, type GameBooks, type TableView } from '@money/domain';

/** One line of a statement: what it is and its amount in minor units. */
export interface StatementLine {
  label: string;
  amountMinor: number;
}

export interface IncomeStatement {
  salary: StatementLine[];
  passive: StatementLine[];
  expenses: StatementLine[];
  totalIncomeMinor: number;
  totalExpensesMinor: number;
  cashflowMinor: number;
}

export interface BalanceSheet {
  assets: StatementLine[];
  liabilities: StatementLine[];
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  netWorthMinor: number;
}

export interface Standing {
  seat: number;
  name: string;
  color: string;
  outcome: 'escaped' | 'bankrupt' | 'playing';
  passiveMinor: number;
  expensesMinor: number;
  cashMinor: number;
  /** Passive income as a share of expenses - 1 or more is out of the rat race. */
  coverage: number;
}

const sum = (lines: StatementLine[]) => lines.reduce((total, line) => total + line.amountMinor, 0);

/** The game's own monthly picture of one player, read from their public books: salary, passive income and expenses. */
export function incomeStatement(books: GameBooks): IncomeStatement {
  const titles = books.state.gameSubscriptionTitles;
  const owned = books.subscriptions.filter((sub) => titles.includes(sub.title));
  const salaryTitle = titles[0];
  const salary: StatementLine[] = [];
  const passive: StatementLine[] = [];
  const expenses: StatementLine[] = [];
  for (const sub of owned) {
    if (sub.amountMinor < 0) expenses.push({ label: sub.title, amountMinor: -sub.amountMinor });
    else if (sub.title === salaryTitle)
      salary.push({ label: sub.title, amountMinor: sub.amountMinor });
    else if (sub.amountMinor > 0) passive.push({ label: sub.title, amountMinor: sub.amountMinor });
  }
  const totalIncomeMinor = sum(salary) + sum(passive);
  const totalExpensesMinor = sum(expenses);
  return {
    salary,
    passive,
    expenses,
    totalIncomeMinor,
    totalExpensesMinor,
    cashflowMinor: totalIncomeMinor - totalExpensesMinor,
  };
}

/** What one player owns and owes, from their public books. Properties count at the deposit paid, shares at their price. */
export function balanceSheet(books: GameBooks, cashLabel: string): BalanceSheet {
  const cashMinor = finalSummary(books).cashMinor;
  const assets: StatementLine[] = [
    { label: cashLabel, amountMinor: cashMinor },
    ...(books.shares ?? []).map((share) => ({
      label: `${share.tag} × ${share.quantity}`,
      amountMinor: Math.round(share.quantity * share.priceMinor),
    })),
    ...(books.investments ?? []).map((investment) => ({
      label: investment.tag,
      amountMinor: investment.depositMinor,
    })),
    ...(books.assets ?? []).map((asset) => ({ label: asset.tag, amountMinor: asset.amountMinor })),
  ];
  const liabilities: StatementLine[] = (books.liabilities ?? []).map((liability) => ({
    label: liability.tag,
    amountMinor: liability.amountMinor,
  }));
  const totalAssetsMinor = sum(assets);
  const totalLiabilitiesMinor = sum(liabilities);
  return {
    assets,
    liabilities,
    totalAssetsMinor,
    totalLiabilitiesMinor,
    netWorthMinor: totalAssetsMinor - totalLiabilitiesMinor,
  };
}

/** Who is closest to escaping: out of the rat race first, then by how much of the expenses passive income covers. */
export function standings(view: TableView): Standing[] {
  const rows: Standing[] = [];
  for (const player of view.players) {
    const books = player.books as unknown as GameBooks | null;
    if (!books || !books.state.professionId) continue;
    const summary = finalSummary(books);
    const passiveMinor = summary.finances.passiveIncomeMinor;
    const expensesMinor = summary.finances.expensesMinor;
    rows.push({
      seat: player.seat,
      name: player.name,
      color: player.color,
      outcome: summary.outcome,
      passiveMinor,
      expensesMinor,
      cashMinor: summary.cashMinor,
      coverage: expensesMinor > 0 ? passiveMinor / expensesMinor : 0,
    });
  }
  const order = { escaped: 0, playing: 1, bankrupt: 2 } as const;
  return rows.sort(
    (a, b) =>
      order[a.outcome] - order[b.outcome] || b.coverage - a.coverage || b.cashMinor - a.cashMinor,
  );
}
