# Fire coverage formula reference

`GET /api/v1/reports/fire-coverage` (FIRE-2) ports the "emergency fund coverage" gauge from `src/app/main/fire/fire.component.ts`'s `getEmergencyCoverage`/`getAverageMonthlyExpenses` — how many months of average expenses the Mojo reserve would cover. Unlike the KPI ratios in `docs/domain/KPI_FORMULAS.md`, this is not a case of two already-shipped, independently-correct formulas that must stay distinct (PLAN.md D-7/D-22/D-23) — this gauge had never been ported into the API/domain package before, so PLAN.md D-9's fix-during-extraction mandate applies directly: the one existing implementation's bugs are fixed here, not preserved.

## Formula

```
For every transaction on a Daily/Splurge/Smile/Fire account with amountMinor < 0,
whose category is not a transfer (Income/Daily/Splurge/Smile/Fire/Mojo),
group abs(amountMinor) by calendar month (YYYY-MM), excluding the current month.

monthsConsidered            = number of distinct months in that group
averageMonthlyExpensesMinor = monthsConsidered > 0
                                 ? round(sum of all months' totals / monthsConsidered)
                                 : 0
coverageRatio                = monthsConsidered > 0
                                 ? mojoAmountMinor / averageMonthlyExpensesMinor
                                 : null
```

`mojoAmountMinor` is the same derived Mojo balance `GET /mojo` exposes — it is never recomputed by this endpoint, only read.

## Four deliberate corrections versus the UI gauge

1. **Transfer exclusion.** The original `getAverageMonthlyExpenses` sums the raw, signed `amount` of _every_ transaction on a non-`Income` account, with no transfer exclusion at all — the same bug class flagged for CASH-1/2/3 in D-22, just in a third, previously-undocumented location. An `Income → Smile` contribution posted from the `Smile` account (category `Smile`, a transfer) would be counted as an ordinary expense, inflating the average and understating true coverage. This endpoint reuses the same canonical `EXPENSE_ACCOUNTS`/`isTransfer` definitions that `income-statement`/`cashflow`/`kpis` already use.
2. **`Mojo` excluded from "expenses."** `EXPENSE_ACCOUNTS` is `Daily`/`Splurge`/`Smile`/`Fire` — it does not include `Mojo`. The original's `account !== 'Income'` check counts a direct `Mojo`-account transaction as an ordinary expense too. This endpoint instead matches the convention every other expense classification in this codebase already follows (`bi-dashboard.ts`, `predictive.ts`, `plan.component.ts` all exclude `Mojo`) — the original gauge was the one outlier, not the other way around.
3. **Refunds/positive entries are excluded, not netted.** Only transactions with `amountMinor < 0` are summed per month. The original nets _all_ signed amounts (positive and negative) together before negating the monthly total, so a refund (a positive amount on an expense account) would partially offset that month's spending there. This endpoint instead ignores refunds entirely rather than netting them against the month's expenses — a genuine behavioral difference for any month containing one.
4. **No fabricated ratio on empty history.** When there's no expense data to average (a brand-new account, or one whose only expense months are the current month), the original falls back to dividing by a hardcoded `1` (one whole currency unit) — in minor units that would produce a wildly meaningless multi-thousand× reading rather than a merely-large one. This endpoint returns `coverageRatio: null` instead, so a caller/agent can tell "not enough data yet" apart from a real ratio.

Kept faithful to the original: the average is computed over _all_ historical months with expense data, not a fixed trailing window (e.g. the last 12 months), and the current calendar month is always excluded since it's necessarily incomplete.

## Worked example

Transactions: a €100 grocery run last month (`Daily`, `@Groceries`, amountMinor -10000), a €200 hobby purchase two months ago (`Splurge`, `@Hobby`, amountMinor -20000), and a €50 `Income → Smile` transfer last month (`Smile`, category `Smile`, amountMinor -5000). Mojo reserve: €450 (`mojoAmountMinor` 45000).

- The `Smile`-category transfer is excluded — it isn't an expense.
- `monthsConsidered` = 2 (last month and two months ago each have qualifying expense data).
- `averageMonthlyExpensesMinor` = (10000 + 20000) / 2 = 15000 (€150).
- `coverageRatio` = 45000 / 15000 = **3** — the Mojo reserve covers 3 months of average expenses.

Had the transfer not been excluded (the original UI's behavior), last month's total would have been 10000 + 5000 = 15000, changing the average to (15000 + 20000) / 2 = 17500 and the ratio to ~2.57 — a real, silent difference the transfer-exclusion fix corrects.
