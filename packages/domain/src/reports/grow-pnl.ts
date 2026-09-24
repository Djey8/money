import { parseGrowComment } from '../grow/dsl';
import { multiplyQuantityPrice, normalizeQuantity } from '../grow/actions';

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
 * Also derived from the project's trade statements (added at JFK's request
 * for full Grow portfolio management): average-cost `realizedGainMinor` on
 * share sales, `dividendsMinor`, `cashflowIncomeMinor`, and — given the
 * balance-sheet Share — a `sharePosition` with cost basis and unrealized
 * gain. Its valuation uses the price last entered in the app/API, never
 * market data, and says so (`valuationSource`); `incompleteHistory` flags
 * a position the recorded trades can't fully explain (e.g. holdings that
 * predate the tracked trades), where the figures are lower bounds.
 */

export interface GrowPnlTransaction {
  category: string;
  amountMinor: number;
  /** Needed for the trade breakdown (cost basis, realized gain); a transaction without it only counts toward the cashflow totals. */
  comment?: string;
  date?: string;
  time?: string;
}

/** The project's current balance-sheet position, as last entered — not market data. */
export interface GrowCurrentShare {
  quantity: number;
  priceMinor: number;
}

export interface GrowSharePosition {
  quantity: number;
  /** Remaining cost of the units still held, average-cost method. */
  costBasisMinor: number;
  averageCostMinor: number;
  /** From the balance-sheet Share: its quantity and last entered price. */
  lastPriceMinor: number;
  marketValueMinor: number;
  unrealizedGainMinor: number;
}

export interface GrowPnl {
  title: string;
  netCashflowMinor: number;
  investedMinor: number;
  returnedMinor: number;
  transactionCount: number;
  /** Sales proceeds minus the average cost of the units sold (share trades). */
  realizedGainMinor: number;
  dividendsMinor: number;
  /** Net of CASHFLOW statements (e.g. rent, minus credit). */
  cashflowIncomeMinor: number;
  /** Present for a share-kind project with a balance-sheet position. */
  sharePosition: GrowSharePosition | null;
  /** Valuation uses the price last entered in the app/API (`last-entered-price`), never live market data. */
  valuationSource: 'last-entered-price';
  /**
   * True when the recorded trades can't explain the position — e.g. units
   * were sold that no recorded buy covers, or the balance-sheet quantity
   * differs from the trades' net quantity (history predates the tracked
   * trades). Cost basis and gains are then lower bounds, not exact.
   */
  incompleteHistory: boolean;
}

interface ShareLedger {
  quantity: number;
  costMinor: number;
  realizedGainMinor: number;
  incomplete: boolean;
}

/** Average-cost accounting over the project's share trades, oldest first. */
function shareLedger(title: string, transactions: GrowPnlTransaction[]): ShareLedger {
  const ledger: ShareLedger = {
    quantity: 0,
    costMinor: 0,
    realizedGainMinor: 0,
    incomplete: false,
  };
  const chronological = [...transactions].sort((a, b) =>
    `${a.date ?? ''} ${a.time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.time ?? ''}`),
  );
  for (const transaction of chronological) {
    for (const statement of parseGrowComment(transaction.comment ?? '')) {
      if (!('title' in statement) || statement.title !== title) continue;
      if (statement.kind === 'buyShare') {
        ledger.quantity = normalizeQuantity(ledger.quantity + statement.quantity);
        ledger.costMinor += multiplyQuantityPrice(statement.quantity, statement.priceMinor);
      } else if (statement.kind === 'sellShare') {
        const proceedsMinor = multiplyQuantityPrice(statement.quantity, statement.priceMinor);
        const coveredQuantity = Math.min(statement.quantity, ledger.quantity);
        if (coveredQuantity < statement.quantity) ledger.incomplete = true;
        const costRemovedMinor =
          ledger.quantity > 0
            ? Math.round((ledger.costMinor * coveredQuantity) / ledger.quantity)
            : 0;
        ledger.realizedGainMinor += proceedsMinor - costRemovedMinor;
        ledger.costMinor -= costRemovedMinor;
        ledger.quantity = normalizeQuantity(ledger.quantity - coveredQuantity);
      }
    }
  }
  return ledger;
}

export function computeGrowPnl(
  title: string,
  transactions: GrowPnlTransaction[],
  currentShare: GrowCurrentShare | null = null,
): GrowPnl {
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

  let dividendsMinor = 0;
  let cashflowIncomeMinor = 0;
  for (const transaction of matching) {
    for (const statement of parseGrowComment(transaction.comment ?? '')) {
      if (statement.kind === 'dividendShare') {
        dividendsMinor += multiplyQuantityPrice(statement.quantity, statement.priceMinor);
      } else if (statement.kind === 'cashflow') {
        cashflowIncomeMinor += statement.cashflowMinor - (statement.creditMinor ?? 0);
      }
    }
  }

  const ledger = shareLedger(title, matching);
  let sharePosition: GrowSharePosition | null = null;
  let incompleteHistory = ledger.incomplete;
  if (currentShare) {
    if (normalizeQuantity(currentShare.quantity) !== ledger.quantity) incompleteHistory = true;
    const marketValueMinor = multiplyQuantityPrice(currentShare.quantity, currentShare.priceMinor);
    sharePosition = {
      quantity: currentShare.quantity,
      costBasisMinor: ledger.costMinor,
      averageCostMinor: ledger.quantity > 0 ? Math.round(ledger.costMinor / ledger.quantity) : 0,
      lastPriceMinor: currentShare.priceMinor,
      marketValueMinor,
      unrealizedGainMinor: marketValueMinor - ledger.costMinor,
    };
  }

  return {
    title,
    netCashflowMinor: returnedMinor - investedMinor,
    investedMinor,
    returnedMinor,
    transactionCount: matching.length,
    realizedGainMinor: ledger.realizedGainMinor,
    dividendsMinor,
    cashflowIncomeMinor,
    sharePosition,
    valuationSource: 'last-entered-price',
    incompleteHistory,
  };
}
