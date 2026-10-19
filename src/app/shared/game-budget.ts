import { Budget } from '../interfaces/budget';

/**
 * The budget of a game (JFK, 2026-10-19): every Payday plans what the game's subscriptions cost in the month they are paid - the
 * kids, the mortgage and loan lines, a property's costs, every expense managed as a subscription. The planned rows move back a
 * month with each Payday, exactly like the transactions do (the game's calendar ages them), so a planned row always sits next to
 * the actuals it belongs to. The rows the game makes carry `game: true`; whatever the player planned by hand is never moved.
 */

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** 'YYYY-MM' moved by whole months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);
  const total = year * 12 + (number - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export interface PlannedAmount {
  date: string;
  tag: string;
  amount: number;
}

/** Adds planned amounts: into the row of that month and category when there is one, else as a new row of the game. */
export function addPlanned(rows: Budget[], planned: PlannedAmount[]): Budget[] {
  const next = rows.map((row) => ({ ...row }));
  for (const item of planned) {
    const existing = next.find((row) => row.date === item.date && row.tag === item.tag);
    if (existing) existing.amount = round2(Number(existing.amount) + item.amount);
    else next.push({ date: item.date, tag: item.tag, amount: round2(item.amount), game: true });
  }
  return next;
}

/** Every planned row of the game moves `months` (negative: back); rows that land on the same month and category add up. */
export function shiftGameRows(rows: Budget[], months: number): Budget[] {
  const kept = rows.filter((row) => !row.game).map((row) => ({ ...row }));
  const moved: PlannedAmount[] = rows
    .filter((row) => row.game)
    .map((row) => ({
      date: shiftMonth(row.date, months),
      tag: row.tag,
      amount: Number(row.amount) || 0,
    }));
  return addPlanned(kept, moved);
}

export function hasGameRows(rows: Budget[]): boolean {
  return rows.some((row) => row.game);
}

/**
 * What one Payday does to the budget: the rows of the game move back a month, then the month this Payday paid is planned. A game
 * that was played before the budget was planned has none of its rows yet: its last month (the Payday before this one) is planned
 * from the subscriptions as they stand, so the chart is not empty for it.
 */
export function planPayday(
  rows: Budget[],
  payday: PlannedAmount[],
  standing: PlannedAmount[] | null,
): Budget[] {
  if (payday.length === 0) return rows;
  const month = payday[0].date;
  const seed = !hasGameRows(rows) && standing && standing.length > 0;
  let next = shiftGameRows(rows, -1);
  if (seed) {
    next = addPlanned(
      next,
      standing.map((item) => ({ ...item, date: shiftMonth(month, -1) })),
    );
  }
  return addPlanned(next, payday);
}
