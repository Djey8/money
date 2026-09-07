import { ApiTransaction } from '../transactions/transaction';
import { EXPENSE_ACCOUNTS, isTransfer } from './statement-shared';

/**
 * Ports `getEmergencyCoverage`/`getAverageMonthlyExpenses` from
 * `src/app/main/fire/fire.component.ts` (FIRE-2's gauge: "how many months of
 * average expenses does the Mojo reserve cover") as the first genuinely new
 * calculation for this endpoint — unlike KPIs/income-statement/cashflow,
 * there was no prior canonical port to reuse, so the fix-during-extraction
 * mandate (PLAN.md D-9) applies directly, not the "expose both, don't pick a
 * winner" precedent from D-7/D-22/D-23 (which is for two *already-shipped*,
 * independently-correct duplicates — this gauge has never been ported
 * before, so there is only one implementation to fix).
 *
 * Four deliberate corrections versus the original:
 *
 * 1. `getAverageMonthlyExpenses` sums the raw, signed `amount` of every
 *    transaction on a non-`Income` account with no transfer exclusion at
 *    all — the same bug class flagged for CASH-1/2/3 in D-22, just in a
 *    third location. An inter-account transfer (e.g. an `Income → Smile`
 *    contribution posted from `Smile`, or the mirror leg on `Income`) is
 *    counted as an ordinary expense/inflow, skewing the average. This port
 *    reuses `statement-shared.ts`'s canonical `EXPENSE_ACCOUNTS`/`isTransfer`
 *    (the same transfer definition income-statement/cashflow/kpis already
 *    use), matching what "average monthly expenses" means everywhere else
 *    in this API.
 * 2. `EXPENSE_ACCOUNTS` (`Daily`/`Splurge`/`Smile`/`Fire`) does not include
 *    `Mojo`, whereas the original's `account !== 'Income'` check counts a
 *    direct `Mojo`-account transaction as an ordinary expense too. Every
 *    other place in this codebase that classifies "expenses" (`bi-dashboard.ts`,
 *    `predictive.ts`, `plan.component.ts`) excludes `Mojo`, so this port
 *    matches that established convention rather than the one outlier.
 * 3. Only transactions with `amountMinor < 0` are summed — a positive entry
 *    on an expense account (e.g. a refund) is excluded entirely, rather than
 *    netted into the month's total the way the original's unfiltered signed
 *    sum would. A month with a refund alongside a purchase therefore nets
 *    differently here than in the original.
 * 4. When there's no expense history at all (a brand-new account, or one
 *    whose only expense months are the current month), the original falls
 *    back to dividing by a hardcoded 1 (one whole currency unit) — in minor
 *    units that fallback would produce a wildly meaningless multi-thousand×
 *    ratio rather than a merely-large one. `coverageRatio` is `null` instead
 *    when `monthsConsidered` is 0, signaling "not enough data" rather than a
 *    fabricated number.
 *
 * Kept faithful to the original: the average is computed over *all*
 * historical months with expense data (not a fixed trailing window), and the
 * current calendar month is always excluded from the average (it's
 * necessarily incomplete).
 */

export interface FireCoverageReport {
  /** Mojo's reserve amount divided by `averageMonthlyExpensesMinor`. `null` when `monthsConsidered` is 0 — there is no expense baseline to divide by. */
  coverageRatio: number | null;
  mojoAmountMinor: number;
  averageMonthlyExpensesMinor: number;
  /** Distinct calendar months (YYYY-MM), excluding the current one, that had at least one qualifying expense — the denominator's sample size. */
  monthsConsidered: number;
}

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function computeFireCoverage(
  transactions: ApiTransaction[],
  mojoAmountMinor: number,
  now: Date = new Date(),
): FireCoverageReport {
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthlyTotals = new Map<string, number>();
  for (const transaction of transactions) {
    if (!(EXPENSE_ACCOUNTS as readonly string[]).includes(transaction.account)) continue;
    if (transaction.amountMinor >= 0) continue;
    if (isTransfer(transaction.category)) continue;
    const key = monthKey(transaction.date);
    if (key === currentMonthKey) continue;
    monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + Math.abs(transaction.amountMinor));
  }

  const monthsConsidered = monthlyTotals.size;
  const totalExpensesMinor = Array.from(monthlyTotals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const averageMonthlyExpensesMinor =
    monthsConsidered > 0 ? Math.round(totalExpensesMinor / monthsConsidered) : 0;

  return {
    coverageRatio: monthsConsidered > 0 ? mojoAmountMinor / averageMonthlyExpensesMinor : null,
    mojoAmountMinor,
    averageMonthlyExpensesMinor,
    monthsConsidered,
  };
}
