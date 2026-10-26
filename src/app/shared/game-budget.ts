import type { CashflowBudgetMonth } from '@money/domain';
import { Budget } from '../interfaces/budget';

/**
 * The budget of a game (JFK, 2026-10-19): every Payday plans what the game's subscriptions cost in the month it is paid - the kids,
 * the mortgage and loan lines, a property's costs, every expense managed as a subscription. When the next Payday comes, everything
 * moves back a month, exactly like the transactions, and the new month is planned. The current month follows the game (a baby, a
 * property bought) until it is closed.
 *
 * The game keeps its own record of what it planned (`CashflowGameState.budgetPlan`, one entry per Payday, oldest first), so it
 * always knows which budget cells are its own: it never moves, replaces or removes a row the player planned by hand, and Undo,
 * Reset and a loaded game take back exactly what the game put there.
 */

export type PlanMonth = CashflowBudgetMonth;
export type PlanRow = PlanMonth['rows'][number];

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** 'YYYY-MM' moved by whole months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);
  const total = year * 12 + (number - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** The plan with its months one apart and ending at `current` - every Payday moves the earlier ones back, whatever they said. */
export function layout(plan: PlanMonth[], current: string): PlanMonth[] {
  return plan.map((entry, index) => ({
    month: shiftMonth(current, index - (plan.length - 1)),
    rows: entry.rows.map((row) => ({ ...row })),
  }));
}

/** The plan after one more Payday: the earlier months move back, the month it paid is the new current one. */
export function withPayday(plan: PlanMonth[], current: string, rows: PlanRow[]): PlanMonth[] {
  return layout([...plan, { month: current, rows }], current);
}

/** The cells of a plan: one per month and category, in the amounts the budget uses. */
function cellsOf(plan: PlanMonth[]): { date: string; tag: string; amount: number }[] {
  return plan.flatMap((entry) =>
    entry.rows.map((row) => ({
      date: entry.month,
      tag: row.tag,
      amount: round2(row.amountMinor / 100),
    })),
  );
}

/**
 * The budget after the game's plan changes from `before` to `after`: a cell the game no longer plans goes, a cell it plans now is
 * set to what it plans (never added onto whatever was in the budget: a row left by an earlier version or an earlier game would be
 * counted twice). What the player planned on cells the game does not plan is never touched.
 */
export function applyPlanChange(
  budgets: Budget[],
  before: PlanMonth[],
  after: PlanMonth[],
): Budget[] {
  const key = (cell: { date: string; tag: string }) => `${cell.date}|${cell.tag}`;
  const afterCells = cellsOf(after);
  const planned = new Set(afterCells.map(key));
  const dropped = new Set(
    cellsOf(before)
      .map(key)
      .filter((cell) => !planned.has(cell)),
  );
  const next = budgets.filter((row) => !dropped.has(key(row))).map((row) => ({ ...row }));
  for (const cell of afterCells) {
    const row = next.find((candidate) => key(candidate) === key(cell));
    if (row) {
      row.amount = cell.amount;
      row.game = true;
    } else next.push({ date: cell.date, tag: cell.tag, amount: cell.amount, game: true });
  }
  return next;
}

/**
 * Cells of the game's own categories that the plan does not have (JFK, 2026-10-26: the budget began a year before the game, with far
 * too much planned): what an earlier game or version left behind goes - the rows it flagged as the game's, and rows of the game's
 * categories outside the plan. What the player planned in other categories stays.
 */
export function dropStaleRows(
  budgets: Budget[],
  plan: PlanMonth[],
  gameTags: Set<string>,
): Budget[] {
  const planned = new Set(cellsOf(plan).map((cell) => `${cell.date}|${cell.tag}`));
  return budgets.filter(
    (row) => planned.has(`${row.date}|${row.tag}`) || (!row.game && !gameTags.has(row.tag)),
  );
}

/**
 * A plan that was never recorded (a game from before it existed) is made from what its Paydays posted: the expenses of each, the
 * latest in `current`, the others one month back each. Rows an earlier version of the planning left in the budget (flagged `game`,
 * or on the same month and category) are replaced, not doubled.
 */
export function planFromPaydays(paydays: PlanRow[][], current: string): PlanMonth[] {
  return layout(
    paydays.map((rows) => ({ month: current, rows })),
    current,
  );
}

export function healLegacyRows(budgets: Budget[], plan: PlanMonth[]): Budget[] {
  const cells = cellsOf(plan);
  const kept = budgets.filter(
    (row) => !row.game && !cells.some((cell) => cell.date === row.date && cell.tag === row.tag),
  );
  return applyPlanChange(kept, [], plan);
}

/** Cells the plan has but the budget lacks (the budget was not loaded when they were planned) are added; nothing else is touched. */
export function fillMissing(budgets: Budget[], plan: PlanMonth[]): Budget[] {
  const next = budgets.map((row) => ({ ...row }));
  for (const cell of cellsOf(plan)) {
    if (!next.some((row) => row.date === cell.date && row.tag === cell.tag)) {
      next.push({ date: cell.date, tag: cell.tag, amount: cell.amount, game: true });
    }
  }
  return next;
}

export function sameRows(a: PlanRow[], b: PlanRow[]): boolean {
  const key = (rows: PlanRow[]) =>
    JSON.stringify([...rows].sort((x, y) => x.tag.localeCompare(y.tag)));
  return key(a) === key(b);
}
