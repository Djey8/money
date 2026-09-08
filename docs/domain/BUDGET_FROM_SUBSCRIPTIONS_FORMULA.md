# Budget-from-subscriptions formula reference

`POST /api/v1/budget/from-subscriptions` (BUD-6) ports `plan.component.ts`'s `subscriptions()` method ("import budget from subscriptions") — populates budget rows from the caller's active subscriptions, one aggregated row per (month, category) pair.

## Formula

```
for each subscription where account !== 'Income':
  monthlyEquivalentAmountMinor = round(abs(amountMinor) * factor(frequency))
  activeMonths = every calendar month from startDate's month through endDate's month
                 (inclusive), or through the current month if there is no endDate

  factor(weekly)    = 52 / 12
  factor(biweekly)  = 26 / 12
  factor(monthly)   = 1
  factor(quarterly) = 1 / 3
  factor(yearly)    = 1 / 12

for each (month, category) pair with at least one active subscription:
  amountMinor = sum of monthlyEquivalentAmountMinor over every subscription
                active that month in that category

Each computed row unconditionally overwrites any existing budget row for the
same (date, tag) pair; a (month, category) pair with no active subscription
is left untouched.
```

## The bug this corrects

Reading `plan.component.ts`'s `subscriptions()` directly confirms `sub.frequency` is never read anywhere in that method — it always adds the subscription's full nominal `amount` into every month it's active, with no frequency-based scaling at all:

- A **quarterly** €300 subscription gets €300 added into *every* month it's active, not €100 (a third of it, since it only actually bills once a quarter) — a 3x over-budget for two months out of three, and correct only by coincidence in the billing month itself.
- A **yearly** €1200 subscription gets its full €1200 added to *every single month* — a 12x over-budget every month.
- A **weekly**/**biweekly** subscription only gets its nominal amount added once per month, when it actually recurs roughly 4.33/2.17 times a month — a real under-budget.
- Only **monthly** frequency happens to be correct, because a monthly subscription's nominal amount already is its own per-month cost.

This is a real over/under-budgeting bug, not a rounding nuance — for a caller relying on this endpoint to build an accurate monthly budget, the original behavior would be actively misleading for every frequency but monthly. Per `PLAN.md` D-9, this is fixed during the port (this is the first time this logic has been exposed as an API, so there's no second, already-shipped call site whose behavior must stay bug-for-bug identical): each subscription's amount is converted to its real monthly-equivalent (`amount × occurrences-per-year ÷ 12`) before being summed, and the result is rounded to the nearest whole minor unit.

## A structural adaptation, not a correction

The original also has a narrower, unrelated quirk in its end-month handling: a transaction-matching heuristic that only *sometimes* includes a subscription's own end month (`plan.component.ts` lines ~561–578), depending on whether a matching transaction exists that month. This port doesn't replicate that heuristic — a subscription's active range is simply every calendar month from `startDate`'s month through `endDate`'s month inclusive (or through `now`'s month if there's no end date). This is a cleaner, more predictable rule that doesn't depend on unrelated transaction history, and doesn't change which subscriptions get processed at all in the common case (no end date, or an end date that isn't the current month) — see `packages/domain/src/transactions/budget-from-subscriptions.ts`'s header comment for the full reasoning.

## Worked example

Two subscriptions, both starting `2026-01-01` with no end date, evaluated with `now = 2026-01-15` (so both are active only in `2026-01` so far):

- `{account: "Daily", amountMinor: -30000, category: "@Insurance", frequency: "quarterly"}` → monthly-equivalent = `round(30000 × (1/3))` = `10000`.
- `{account: "Daily", amountMinor: -1200, category: "@Domain", frequency: "yearly"}` → monthly-equivalent = `round(1200 × (1/12))` = `100`.

Result: two budget rows, `{date: "2026-01", tag: "@Insurance", amountMinor: 10000}` and `{date: "2026-01", tag: "@Domain", amountMinor: 100}` — each created fresh, or overwriting whatever amount an existing `2026-01`/`@Insurance` (or `@Domain`) row already had.

If a third subscription shares `@Insurance` in the same month (e.g. a second policy, monthly, `amountMinor: -5000`), its own monthly-equivalent (`5000`) is added to the same row: `10000 + 5000 = 15000`.
