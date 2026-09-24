# Grow profit/loss formula reference

`GET /api/v1/reports/grow/{id}/pnl` (the last row of the Grow endpoint table, closing out GROW-7's "GV" list column) ports `grow.component.ts`'s `getGrowProjectsGV` — "GV" is German for _Gewinn/Verlust_ ("profit/loss") — the original app's only existing Grow profit/loss calculation.

## Formula

```
matching        = every transaction whose category (with the leading '@' stripped) equals the
                   Grow project's title — case-sensitive, no account filter, exactly like the original
investedMinor   = sum of |amountMinor| over matching transactions where amountMinor < 0
returnedMinor   = sum of amountMinor over matching transactions where amountMinor >= 0
netCashflowMinor = returnedMinor - investedMinor
```

`investedMinor + netCashflowMinor === returnedMinor` always holds by construction. `netCashflowMinor` is numerically identical to what the original's `getGrowProjectsGV` computes (it sums every matching transaction's signed `amount` directly, with no invested/returned split).

## One structural note, one genuine addition — not corrections

Unlike `docs/domain/FIRE_COVERAGE_FORMULA.md`'s four corrections or `PAYMENT_PLAN_FORMULA.md`'s two, this port makes no behavioral correction at all: `getGrowProjectsGV` has no known bug, no transfer-exclusion gap, and no account filter to reconsider — it is faithfully reproduced byte-for-byte in `netCashflowMinor`.

1. **Structural: integer minor units instead of the original's decimal floats**, per every other endpoint in this API (`docs/adr/0002-money-minor-units-migration.md`).
2. **Addition: the `investedMinor`/`returnedMinor` split.** The original only ever displays the single net figure — a caller asking "how is this project doing" needs to see total capital committed alongside the net result, not just the difference, so this report adds the breakdown on top of the ported total.

**Deliberately not included**: any mark-to-model "current value" or unrealized gain/loss (e.g. a share-kind project's `quantity * current priceMinor`). The original has no equivalent, and a share/investment's "current price" in this system is only ever the last value a user typed into a buy/sell action, never real market data — presenting that as a `currentValueMinor` figure would imply a precision this API has no way to back up.

## Worked example

A share-kind Grow project titled "MSFT" has three transactions on its category, `@MSFT`: a buy of €4,150.00 (`amountMinor` -415000), a dividend of €50.00 (`amountMinor` 5000), and a later sale for €4,500.00 (`amountMinor` 450000). A fourth, unrelated transaction on `@Groceries` is ignored.

- `investedMinor` = 415000 (the one negative-amount transaction).
- `returnedMinor` = 5000 + 450000 = 455000.
- `netCashflowMinor` = 455000 - 415000 = 40000 (€400.00 net profit).
- Response: `{title: "MSFT", investedMinor: 415000, returnedMinor: 455000, netCashflowMinor: 40000, transactionCount: 3}`.

## Trade breakdown (average cost)

From the project's trade statements, oldest first:

- **Share buys** add `quantity` and `round(quantity × price)` to the running cost.
- **Share sales** remove `round(cost × soldQuantity / heldQuantity)` from the cost;
  `realizedGainMinor += proceeds − removedCost`.
- `dividendsMinor` sums `Dividende Share` statements; `cashflowIncomeMinor` sums `CASHFLOW` statements (cashflow −
  credit).
- For a share-kind project, `sharePosition` compares the remaining cost (`costBasisMinor`, `averageCostMinor`) with
  the balance-sheet Share tagged with the project's title: `marketValueMinor = quantity × lastPriceMinor`,
  `unrealizedGainMinor = marketValueMinor − costBasisMinor`.
- `valuationSource: "last-entered-price"` — the price is whatever was last entered (a trade or a revaluation), never
  market data.
- `incompleteHistory: true` when units were sold that no recorded buy covers, or the balance-sheet quantity differs
  from the trades' net quantity (e.g. holdings from before the trades were recorded). The figures are then lower
  bounds.

Worked example: buy 4 @ 100, buy 2 @ 150 (cost 700, 6 units), sell 3 @ 150 → removed cost 350, realized gain 100;
3 units left at cost 350 (average 116.67); at a last price of 90 the market value is 270, unrealized gain −80.
