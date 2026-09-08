/**
 * `GET /reports/grow/{id}/pnl` (GROW-7 endpoint table entry) ports
 * `grow.component.ts`'s `getGrowProjectsGV` — "GV" is German for
 * *Gewinn/Verlust* ("profit/loss") — the original app's only existing
 * Grow profit/loss calculation. It sums every transaction whose `category`
 * (with the leading `@` stripped) equals the Grow project's `title`, with
 * no account filtering and no transfer exclusion; that sum is this report's
 * `netCashflowMinor`, kept numerically identical to the original.
 *
 * The `investedMinor`/`returnedMinor` split is new — the original never
 * separates outflows from inflows, only ever displaying the net figure —
 * added because a caller asking "how is this project doing" needs to see
 * total capital committed alongside the net result, not just the
 * difference. This is a genuine addition, not a correction (per PLAN.md
 * D-9, additions are called out separately from bug fixes): `investedMinor`
 * is the sum of every matching transaction's negative `amountMinor`
 * (absolute value), `returnedMinor` the sum of every positive one, and
 * `investedMinor + netCashflowMinor === returnedMinor` always holds.
 *
 * Deliberately NOT included: any mark-to-model "current value" (e.g. a
 * share-kind project's `quantity * current priceMinor`) or unrealized
 * gain/loss. The original has no equivalent, and a share/investment's
 * "current price" here is only ever the last transaction price a user
 * typed in, not real market data — presenting that as a currentValueMinor
 * figure would imply a precision this API has no way to back up.
 */

export interface GrowPnlTransaction {
  category: string;
  amountMinor: number;
}

export interface GrowPnl {
  title: string;
  netCashflowMinor: number;
  investedMinor: number;
  returnedMinor: number;
  transactionCount: number;
}

export function computeGrowPnl(title: string, transactions: GrowPnlTransaction[]): GrowPnl {
  const matching = transactions.filter(
    (transaction) => transaction.category.replace('@', '') === title,
  );

  let investedMinor = 0;
  let returnedMinor = 0;
  for (const transaction of matching) {
    if (transaction.amountMinor < 0) {
      investedMinor += -transaction.amountMinor;
    } else {
      returnedMinor += transaction.amountMinor;
    }
  }

  return {
    title,
    netCashflowMinor: returnedMinor - investedMinor,
    investedMinor,
    returnedMinor,
    transactionCount: matching.length,
  };
}
