# Payment plan formula reference

`POST /api/v1/{smile,fire}/{id}/payment-plan` (SMILE-7, "Payment planner for buckets", shared by Smile and Fire) ports `PaymentPlannerService` (`src/app/shared/services/payment-planner.service.ts`) — computes a suggested per-period contribution to fund a project's buckets by a target date, then persists it (`status: "planned"`) onto the project's `plannedSubscriptions` array. Only the create/calculate path (`calculatePaymentPlan`/`validatePaymentPlan`, the same pair `savePlan()` calls in `payment-planner-dialog.component.ts`) is exposed — activating a plan into a real recurring subscription is a separate feature (`SubscriptionActivationService`) not itemized in `FEATURE_CATALOG.md` and not part of this API.

## Formula

```
missingMinor = sum over funded buckets of max(0, bucket.targetMinor - bucket.amountMinor)
periods      = calculateNumberOfPeriods(startDate, targetDate, frequency)   — see below
originalCalculatedAmountMinor = periods > 0 ? round(missingMinor / periods) : missingMinor
amountMinor  = manualAmountMinor if provided, otherwise originalCalculatedAmountMinor

allocations  = amountMinor distributed proportionally across the funded buckets by their
               own missing amount (a single funded bucket gets 100% of amountMinor, even if
               already full); every allocation but the last is rounded, the last absorbs
               whatever's left so the allocations always sum to exactly amountMinor
comment      = one "#bucket:Title:Amount" tag per allocation, joined by spaces
```

"Funded buckets" is every bucket on the project when `selectedBucketIds` is empty, or only the buckets whose id is in `selectedBucketIds` otherwise. `calculateNumberOfPeriods` counts whole periods between `startDate` and `targetDate`: `ceil(days / 7)` for weekly, `ceil(days / 14)` for biweekly, the calendar-month difference (minimum 1) for monthly, `ceil(calendar months / 3)` (minimum 1) for quarterly, and the calendar-year difference (minimum 1) for yearly — crossing a period boundary by even a single day counts as a full period, an intentional approximation carried over from the original, not a bug.

## Two structural adaptations and two behavioral corrections versus the original service

This is the first time `PaymentPlannerService`'s logic has been ported anywhere outside the Angular app, so per `PLAN.md` D-9 any real bugs are fixed during the port rather than preserved — unlike the `docs/domain/KPI_FORMULAS.md`/`FIRE_COVERAGE_FORMULA.md` cases, there's no second, already-shipped call site whose behavior must stay distinct. Of the four changes below, the first two are structural adaptations for this API's own conventions (not bugs in the original — it was correct for its own client-side context); the last two are genuine behavioral corrections.

1. **Structural: integer minor units instead of floats.** The original computes everything in decimal currency with `Math.round(x * 100) / 100` scattered through every method — the usual float-drift risk this API avoids everywhere else (`docs/adr/0002-money-minor-units-migration.md`). All money fields here are integer minor units; `calculateProportionalDistribution`'s last-bucket-absorbs-the-remainder technique guarantees the allocations sum to exactly `amountMinor` with zero drift — a welcome side effect of the unit change, not a separately-targeted fix.
2. **Structural: no client-generated `id`/timestamps.** The original's `generatePaymentPlanId()` mints an id from `Date.now()` + `Math.random()` and stamps `createdAt`/`updatedAt` itself, since it runs client-side and must hand back a fully-formed object immediately. Here, the domain calculation (`packages/domain/src/transactions/payment-plan.ts`) is a pure function of its inputs — `id`/`createdAt`/`updatedAt` are assigned by the repository at write time (`crypto.randomUUID()`, matching every other entity id in this API), the same domain/repository split every other endpoint in this API already follows.
3. **Correction: `selectedBucketIds` must reference real buckets.** The original never validates this — the UI only ever offers checkboxes for buckets it already knows exist, so a mismatched id can't happen there. An API caller has no such guarantee, so a `selectedBucketIds` entry naming a bucket that doesn't exist on the project is rejected with `400 validation_invalid` rather than silently producing a plan that funds nothing.
4. **Correction: date comparison by string, not `Date` object, in `validatePaymentPlan`.** The original constructs `new Date(startDate)`/`new Date(targetDate)` to compare them; since both are `YYYY-MM-DD` strings, plain string comparison is equivalent and sidesteps the same kind of timezone-parsing pitfall `packages/domain/src/reports/period-range.ts` already documents avoiding for date-only strings.

## Worked example

A Smile project has one bucket, "Flights", target 3000.00 (`targetMinor` 300000), currently empty. `POST /smile/{id}/payment-plan` with `{planTitle: "Flight Fund", startDate: "2026-01-01", targetDate: "2026-04-01", frequency: "monthly", account: "Daily"}`:

- `missingMinor` = 300000 (the one bucket, unfunded).
- `periods` = 3 (Apr − Jan, monthly).
- `originalCalculatedAmountMinor` = round(300000 / 3) = 100000 (€1000.00 per month).
- No `manualAmountMinor` sent, so `amountMinor` = 100000.
- One funded bucket ("Flights") gets 100% of the payment: allocation `{bucketId, bucketTitle: "Flights", amountMinor: 100000}`.
- `comment` = `"#bucket:Flights:1000.00"`.
- Response: `{id: "plan_...", status: "planned", projectType: "smile", projectTitle: "<project title>", amountMinor: 100000, category: "@<project title>", comment: "#bucket:Flights:1000.00", ...}`, and the same object is appended to the project's `plannedSubscriptions` array.

If the caller instead sent `manualAmountMinor: 50000` (funding pace half the calculated amount), `amountMinor` would be 50000, `originalCalculatedAmountMinor` would still be 100000, and `manuallyAdjusted` would be `true`.
