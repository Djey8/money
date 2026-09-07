# KPI formula reference

`GET /api/v1/reports/kpis` exposes two pairs of independently-computed ratios that look like duplicates but are deliberately kept separate — see `PLAN.md` D-7 (savings rate) and D-23 (fixed cost ratio). This doc is the canonical place for their exact formulas and a worked example each, per `mm-add-api-endpoint`'s docs step, so the API docs don't have to re-explain the math.

Both pairs share the same shape: a **statement** formula (ported from `src/app/stats/statement/statement-calculations.ts`, the Financial Statement's own canonical calculation per `PLAN.md` D-22) and a **dashboard** formula (ported from `src/app/stats/stats-calculations.ts`, the KPI dashboard, STATS-1). They differ in exactly one place each: whether `Mojo` is excluded as an inter-account transfer.

## Savings rate

**Statement** (`ratios.savingsRatePercent`, same value as `GET /reports/income-statement`'s `savingsRatePercent`):

```
income   = sum(amountMinor) of Income-account transactions with amountMinor > 0,
           excluding any transaction whose category is Income/Daily/Splurge/Smile/Fire/Mojo (a transfer)
expenses = sum(abs(amountMinor)) of Daily/Splurge/Smile/Fire transactions with amountMinor < 0,
           excluding the same transfer categories
savingsRatePercent = income > 0 ? (income - expenses) / income * 100 : 0
```

**Dashboard** (`dashboardSavingsRatePercent`):

```
income   = sum(amountMinor) of Income-account transactions with amountMinor > 0 (no category exclusion)
expenses = sum(abs(amountMinor)) of Daily/Splurge/Smile/Fire transactions with amountMinor < 0,
           excluding categories Daily/Splurge/Smile/Fire/Income — NOT Mojo
dashboardSavingsRatePercent = income > 0 ? (income - expenses) / income * 100 : 0
```

**Worked example — where they diverge:** a €100 salary (`Income` account, `@Salary`) and a €10 expense tagged `@Mojo` posted from the `Daily` account (amountMinor -1000).

- Statement: `@Mojo` is a transfer category, so the €10 is excluded entirely → income 10000, expenses 0 → **100%**.
- Dashboard: `Mojo` isn't in the dashboard's exclude set, so the €10 counts as an ordinary expense → income 10000, expenses 1000 → **90%**.

## Fixed cost ratio

Both formulas need a set of "fixed cost categories" — the cleaned (`@`-stripped) `category` of every entry in `subscriptions`.

**Statement** (`ratios.fixedCostRatioPercent`):

```
expenses   = sum(abs(amountMinor)) of Daily/Splurge/Smile/Fire transactions with amountMinor < 0,
             excluding transfer categories (Income/Daily/Splurge/Smile/Fire/Mojo)
fixedCosts = the subset of `expenses` whose category is in the fixed-cost category set
fixedCostRatioPercent = expenses > 0 ? fixedCosts / expenses * 100 : 0
```

**Dashboard** (`dashboardFixedCostRatioPercent`):

```
expenses   = sum(abs(amountMinor)) of Daily/Splurge/Smile/Fire transactions with amountMinor < 0,
             excluding categories Daily/Splurge/Smile/Fire/Income — NOT Mojo
fixedCosts = the subset of `expenses` whose category is in the fixed-cost category set
dashboardFixedCostRatioPercent = expenses > 0 ? fixedCosts / expenses * 100 : 0
```

**Worked example:** one subscription (`Netflix`, category `@Netflix`), plus a €10 `@Netflix` expense and a €10 `@Mojo` expense in the period (both from `Daily`, both amountMinor -1000).

- Statement: the `@Mojo` expense is excluded as a transfer, so `expenses` = 1000 (the Netflix charge only), `fixedCosts` = 1000 → **100%**.
- Dashboard: neither expense is excluded (Mojo isn't in the dashboard's set), so `expenses` = 2000, `fixedCosts` = 1000 (only the Netflix one matches the subscription category) → **50%**.

## Why not unify them

Both formulas are correct for the page that already ships them — reconciling the Mojo-exclusion gap is a product decision (should a Mojo contribution ever count as an ordinary expense on the dashboard?), not something an API-design project should decide unilaterally. Per D-7/D-23, the API's job is to expose both accurately and distinctly named, not to silently pick a winner. Unifying them is tracked as a future improvement outside this project's scope.
