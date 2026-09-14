/**
 * Ports `computeBalanceSheet` from
 * `src/app/stats/statement/statement-calculations.ts` (canonical per
 * PLAN.md D-22). Unlike income-statement/cashflow, this is a **current
 * snapshot** — it has no period/previous-period split, matching the
 * original (the app has no historical balance-sheet capability).
 *
 * Input entries are already decrypted and normalized to integer minor
 * units by the caller (see `backend/repositories/report-repository.js`) —
 * this module contains only the aggregation, no I/O or encryption concerns,
 * consistent with income-statement.ts/cashflow.ts.
 */

export interface AssetEntry {
  amountMinor: number;
}

export interface ShareEntry {
  quantity: number;
  priceMinor: number;
}

export interface InvestmentEntry {
  amountMinor: number;
  depositMinor: number;
}

export interface PropertyEntry {
  amountMinor: number;
}

export interface LiabilityEntry {
  amountMinor: number;
}

export interface BalanceSheetInput {
  assets: AssetEntry[];
  shares: ShareEntry[];
  investments: InvestmentEntry[];
  properties: PropertyEntry[];
  liabilities: LiabilityEntry[];
}

export interface BalanceSheet {
  assets: {
    cash: number;
    shares: number;
    investments: number;
    properties: number;
    total: number;
  };
  liabilities: {
    debts: number;
    total: number;
  };
  /** Total assets minus total liabilities. */
  equity: number;
  /** Alias for `equity`, matching the original's own naming. */
  netWorth: number;
}

function sum<T>(entries: T[], amount: (entry: T) => number): number {
  return entries.reduce((total, entry) => total + amount(entry), 0);
}

export function computeBalanceSheet(input: BalanceSheetInput): BalanceSheet {
  const cash = sum(input.assets, (a) => a.amountMinor);
  // Rounded per-entry, not just at the total: a fractional share quantity
  // (e.g. 3.54) times an integer priceMinor produces a fractional-cent
  // result, which would violate every minor-unit money field's integer
  // contract (docs/adr/0002-money-minor-units-migration.md).
  const shares = sum(input.shares, (s) => Math.round(s.quantity * s.priceMinor));
  const investments = sum(input.investments, (i) => i.amountMinor + i.depositMinor);
  const properties = sum(input.properties, (p) => p.amountMinor);
  const assetsTotal = cash + shares + investments + properties;
  const debts = sum(input.liabilities, (l) => l.amountMinor);
  const equity = assetsTotal - debts;

  return {
    assets: { cash, shares, investments, properties, total: assetsTotal },
    liabilities: { debts, total: debts },
    equity,
    netWorth: equity,
  };
}
