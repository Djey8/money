# API Agent Guidance

A self-hosted PAT is explicit consent for an agent to access only its granted scopes. Do not send its value in prompts or tool arguments; load it from a local environment variable.

Before making financial requests, call `GET /api/v1/me` with the PAT and inspect the exact scope list. Stop and report the missing scope rather than attempting unrelated endpoints.

PATs cannot create, list, or revoke tokens. Token lifecycle calls require the user's authenticated browser session or a human operator using `mm-admin` directly on the server. The API never issues `admin` scope tokens; use the CLI only for documented break-glass administration.

Every Pro API write is audit logged. Prefer narrowly scoped, expiring tokens and revoke a token as soon as its automation is retired.

## Add a transaction

1. Call `GET /api/v1/me` and require `transactions:w` before attempting a write.
2. Use `POST /api/v1/transactions` with a signed integer `amountMinor`, ISO `date`, account, category, time, and comment. An empty comment is valid.
3. Read the returned transaction rather than predicting its final amount or comment: Smile and Fire contributions may be capped at their fund target, which changes the stored amount and legacy `#bucket:` allocation tags.
4. `POST /transactions` itself has no idempotency key — do not retry an uncertain call blindly, since a retry after a dropped response could create a duplicate. Use `POST /transactions/batch` (below) with a single `create` operation instead if you need retry safety for a single transaction.

## Edit or delete a transaction

1. `PATCH /api/v1/transactions/{id}` accepts a partial body — only the fields you send are changed. Sending an unrecognized field is rejected as a validation error rather than silently ignored.
2. If the transaction's `comment` carries a `#bucket:Name:Amount` allocation tag (current or being set by this same request), `amountMinor` and `comment` must be sent together in the same `PATCH`. Sending only one is rejected with `validation_invalid` — it is never silently applied against the other field's stale value, since a tagged comment and the amount it encodes are one coupled value to the fund-allocation engine.
3. There is no per-transaction `If-Match`/version check yet: a concurrent edit to the same transaction can be silently overwritten (last write wins). Re-read the transaction immediately before an edit if another writer might be active.
4. As with create, read the response body rather than assuming your edit applied exactly as sent — Smile/Fire capping can still adjust the amount and comment.
5. `DELETE /api/v1/transactions/{id}` is not reversible through the API. Both PATCH and DELETE return `404` for an id that doesn't exist or belongs to another user — the two cases are indistinguishable by design.

## Copy a transaction

1. `POST /api/v1/transactions/{id}/copy` duplicates an existing transaction's account, amount, category, and comment into a new transaction. Date and time default to now — the same as the UI's copy action — unless overridden in the request body. "Now" is the server's local clock, not the caller's; pass explicit `date`/`time` if that distinction matters for your use case.
2. Any field may be overridden the same way as `PATCH`, and the same coupling rule applies: if the source (or an override) comment carries a `#bucket:` tag, `amountMinor` and `comment` must be overridden together.
3. This is a write — it requires `transactions:w`, is audit logged, and its response is the newly created transaction (with its own new id), not the source.
4. Copying a bucket-tagged transaction does not remove the source's own allocation — both now compete for the same bucket capacity. A full-value copy of an already-fully-allocated transaction will itself get capped; this is expected, not a bug.

## Create, update, or delete many transactions at once

1. `POST /api/v1/transactions/batch` requires `transactions:bulk` — a separate, explicit grant, not satisfied by `transactions:rw`. It also requires an `Idempotency-Key` header on every call, and up to 100 operations per call.
2. Generate a fresh, unique key per logical batch (a UUID is fine) and reuse the _exact same_ key, with the _exact same JSON body_, if you need to retry after a network error or timeout — the server returns the original result without reapplying anything. The check re-serializes and hashes your JSON body, so it tolerates whitespace differences but not a reordered `operations` array or a different key order from a different HTTP client library; when in doubt, replay with the identical bytes you sent the first time. Reusing a key with a genuinely different body is rejected with `409 conflict_idempotency_mismatch`; never reuse a key across genuinely different requests.
3. **Known gap**: the write and the idempotency record are not one atomic transaction. In the narrow window where the write succeeds but the server crashes or the audit write fails before recording the replay entry, a same-key retry has no record to find and will reapply the batch. This is a real, understood limitation, not a documented guarantee — if that risk matters for your use case, verify results (e.g. re-read the affected transactions) rather than trusting a retry to be perfectly safe.
4. Each operation is `{op: 'create', ...}` (same fields as a single create), `{op: 'update', id, ...fields}` (partial, same rules as `PATCH`, including the bucket-tag coupling rule), or `{op: 'delete', id}`.
5. Default (`atomic: false`): operations are applied independently — read every item's own `status` (`created`/`updated`/`deleted`/`error`) rather than assuming the whole call succeeded because the HTTP status was 200. A batch call always returns 200 once the request itself is well-formed; per-item failures do not change the HTTP status.
6. `atomic: true`: if any operation fails, none are applied — failed items are `error`, everything else that would have succeeded is `not_applied`. A `not_applied` `create` result's `id` was never persisted — don't use it in a later request. Use `atomic: true` when partial application would leave your data in a state you can't reconcile (e.g. a set of transfers that must all happen together).
7. This is still one document write like every other transaction write here — the fund/derived-state recalculation happens once, over the whole resulting transaction list, not once per operation.

## Move a full set of transactions (export/import)

1. `GET /api/v1/transactions/export` requires `transactions:bulk` and returns every transaction the caller owns as newline-delimited JSON (`application/x-ndjson`, one `ApiTransaction` per line, no pagination). Use this for a full-account backup or migration, not for browsing — use `GET /transactions` for that.
2. `POST /api/v1/transactions/import` requires `transactions:bulk` and an `Idempotency-Key` header, same replay/mismatch contract and same known write-then-record-ordering gap as `POST /transactions/batch` (see above). Send the body as `Content-Type: application/x-ndjson`, one transaction-creation object per line (same fields as a single create), up to 10,000 lines of at most 16KB each.
3. Import's idempotency check hashes the **raw body bytes**, not a re-serialized JSON value like batch does (import's body isn't JSON, so there's nothing to re-serialize). This means two payloads that are semantically identical but differ in trailing whitespace, blank lines, or line-ending style (`\r\n` vs `\n`) will hash differently and trip `409 conflict_idempotency_mismatch` on replay, even though `parseImportLines` itself would treat them the same. Replay with the exact bytes you sent the first time.
4. Import is purely additive — every line becomes a `create`, there is no update/delete form of import. Per-line results come back in the same shape as a batch response (`status`: `created`/`error`, or `not_applied` under `?atomic=true`); a malformed line (bad JSON, missing/invalid fields, or a line over 16KB) is reported as that line's own error and does not fail the rest, unless `?atomic=true` is set.
5. This does not overwrite or replace existing data — it only ever adds transactions. There is no "confirm" flag because there is nothing destructive to confirm; contrast with the master prompt's `data:bulk` full-account import, which is a separate, not-yet-built endpoint that can overwrite and will require `confirm: true`.

## Read the income statement for a period

1. `GET /api/v1/reports/income-statement` requires `reports:r` (a read-only scope, separate from `transactions:r`). It takes `period` (`week`/`month`/`quarter`/`halfyear`/`year`, default `month`) and `offset` (integer, default `0`; `0` is the period containing today, `-1` the one before it).
2. The response always includes both the requested period and the immediately preceding period of the same length (`period`/`previousPeriod`), with every figure as a `{current, previous, changePercent}` row so you don't need a second call to show a comparison.
3. `changePercent` on every row is a **relative** change of `current` vs `previous` (20 → 25 is `25`, not `+5`), and is `0` when `previous` is `0` — don't treat a `0` there as "no data," check the `previous` value itself if that distinction matters.
4. Inter-account transfers (`Income` → `Daily`/`Splurge`/`Smile`/`Fire`/`Mojo`) are excluded from both income and expenses, same as the UI's own statement page. This is a different, and more correct, calculation than the `src/app/main/cashflow/*` frontend components use internally — see `PLAN.md` D-22 — so numbers from this endpoint will not always match those specific screens.
5. `interests`/`propertyIncome` classification depends on tags the user has assigned to their shares/investments/interest/property entries elsewhere in the app; an otherwise-uncategorized `Income`-account transaction falls into `otherIncome`, not `revenues`.
6. This is a read; it is not audit logged and does not require `transactions:r`.

## Read the cashflow statement for a period

1. `GET /api/v1/reports/cashflow` requires `reports:r`, takes the same `period`/`offset` query parameters as `/reports/income-statement`, and returns the same `period`/`previousPeriod`/`{current, previous, changePercent}` shape.
2. Unlike the income statement (which only looks at the `Income` account and the four expense accounts), this classifies **every** transaction: `operating` is ordinary Income/expense-account activity, `investing` is a transfer from `Income` into `Smile` or `Fire`, `financing` is any transaction whose `comment` contains `payback liabilitie` (case-insensitive, regardless of account), and `mojo` is a Mojo contribution (a direct inflow on the `Mojo` account, or a transfer from `Income` tagged `@Mojo`).
3. A transfer that doesn't match any of those four buckets (e.g. `Income` → `Daily`/`Splurge`) is dropped entirely — it is not double-counted as operating.
4. `netCashflow` is `operating - investing - financing - mojo`.
5. This is a read; it is not audit logged.

## Read the current balance sheet

1. `GET /api/v1/reports/balance-sheet` requires `reports:r` and takes **no** query parameters — unlike the other report endpoints, this is a current snapshot with no period/previous-period comparison, matching the original app's own lack of historical balance-sheet tracking.
2. `assets.shares` is the sum of each share's `quantity × price`; `assets.investments` is the sum of each investment's `amount + deposit` (a mortgage-financed investment counts its own cash deposit as an asset, not just the financed value). `assets.cash` and `assets.properties` are plain sums.
3. `equity`/`netWorth` (the same value under two names, matching the original) is total assets minus total liabilities and can be negative.
4. This reads entity data that has no write endpoint yet (`balance/asset/*`, `balance/liabilities`, `income/revenue/properties` — Slice 4 on the project roadmap); until then the only way to change these values is through the UI.
5. This is a read; it is not audit logged.

## Read key ratios, top categories, and KPI-dashboard ratios for a period

1. `GET /api/v1/reports/kpis` requires `reports:r`, takes the same `period`/`offset` query parameters as `/reports/income-statement`, and returns `ratios`/`previousRatios` (six key ratios each), `topExpenses`/`topIncomes` (up to 5 categories for the current period only, no `previous` comparison), and four `dashboard*` fields.
2. **Read `dashboardSavingsRatePercent`/`dashboardFixedCostRatioPercent` as genuinely different numbers from `ratios.savingsRatePercent`/`ratios.fixedCostRatioPercent`, not a formatting variant of the same one.** They come from two independently-maintained formulas in the original app (see `docs/domain/KPI_FORMULAS.md` for the exact math and a worked example of where they diverge) — don't average them, don't assume one is stale, and don't be surprised if they disagree by a few points on an account with Mojo activity.
3. `ratios.netMarginPercent` is intentionally identical to `ratios.savingsRatePercent` — that's a pre-existing redundancy in the original app's own `KeyRatios` type, not a bug in this port.
4. `ratios.debtRatio` and `ratios.interestCoverage` are plain ratios, not percentages, despite sitting next to fields that are.
5. `topExpenses`/`topIncomes` each cap at 5 entries sorted by amount descending; an untagged transaction's category shows as `—` rather than being dropped.
6. This is a read; it is not audit logged.

## Read the Fire emergency-fund coverage ratio

1. `GET /api/v1/reports/fire-coverage` requires `reports:r`. Like `/reports/balance-sheet`, it's a current snapshot with no `period`/`offset` — the endpoint itself picks which historical calendar months to average expenses over (every month with qualifying expense-account spending, excluding the current, necessarily incomplete month).
2. `coverageRatio` is `mojoAmountMinor / averageMonthlyExpensesMinor` — "how many months of average expenses the Mojo reserve would cover." **It can be `null`** when `monthsConsidered` is 0 (no expense history yet) — treat that as "not enough data," not as zero coverage.
3. Unlike the original UI gauge this is ported from: expense-account transfers (e.g. an `Income → Smile` contribution posted from `Smile`) and `Mojo`-account transactions are excluded from the average; a refund (a positive amount on an expense account) is excluded rather than netted against that month's spending; and an empty history returns `null` rather than a fabricated ratio. See `docs/domain/FIRE_COVERAGE_FORMULA.md` for the full rationale, formula, and a worked example of where the corrected value diverges from the original.
4. This is a read; it is not audit logged.

## Read or update the Mojo emergency/long-term reserve

1. `GET /api/v1/mojo` requires `mojo:r`. There is exactly one Mojo balance per user — this is not a list endpoint. The response adds `remainingMinor` (`max(0, targetMinor - amountMinor)`) and `percentFilled` (not clamped to 100 — see below) as read-side conveniences on top of the raw balance.
2. `PUT /api/v1/mojo` requires `mojo:w` and accepts only `{ "targetMinor": <integer >= 1> }`. **`amountMinor` cannot be set directly** — it's derived from transaction history (a `@Mojo`-tagged contribution, or a transaction posted directly on the `Mojo` account) and is recalculated by every transaction write, matching the UI's own Mojo editor which only ever lets you change the target.
3. `percentFilled` can exceed 100: only `@Mojo`-category contributions are capped at the target on write; a transaction posted directly on the `Mojo` account is not. Don't assume `amountMinor <= targetMinor`.
4. Every `PUT` is audit logged.

## List or create Smile projects

1. `GET /api/v1/smile` requires `smile:r` and returns every Smile project owned by the caller, each with a `totals` field (`{targetMinor, amountMinor, remainingMinor, percentFilled}`) computed by summing all of that project's buckets — not stored, computed on every read.
2. `POST /api/v1/smile` requires `smile:w`. Provide **either** `targetMinor` (optionally with `amountMinor`) **or** a non-empty `buckets` array — matching the UI's own Add Smile form, which accepts either a flat target or custom buckets and merges both if both are given (a `targetMinor` bucket is always created first, named after the project's own `title`, before any explicit `buckets`).
3. `title` must not exactly match an existing Smile project's title. This check is **case-sensitive** — the original app's own duplicate check is exact-match, not case-insensitive, despite this codebase's usual case-insensitive category/title matching elsewhere. Don't assume "Vacation" and "vacation" collide.
4. `notes[].createdAt` is always server-generated at creation time — a value you send for it is ignored, don't rely on round-tripping a client-supplied timestamp there.
5. Every project has a stable `id` — existing Smile projects created before this endpoint shipped need `mm-admin migrate-fund-project-ids --collection smile` run first (the legacy storage shape has no project-level id, only bucket-level ids); this endpoint fails clearly rather than silently if it isn't.
6. `POST` is audit logged.

## Get, update, or delete a single Smile project

1. `GET /api/v1/smile/{id}` requires `smile:r`. `PATCH`/`DELETE` require `smile:w`. All three return `404` uniformly for an id that doesn't exist or belongs to another user.
2. `PATCH` accepts a **partial** body — only the fields you send are changed — but `buckets`/`links`/`actionItems`/`notes`, when sent, each **replace the entire array**, not a per-item merge. Send the complete list you want, including entries you aren't changing, or they'll be dropped.
3. For `buckets`: echo back an existing bucket's `id` to edit it in place (any field you include on that entry — `title`, `targetMinor`, `amountMinor`, etc. — replaces the stored value); omit `id` to add a new bucket; any existing bucket whose `id` isn't present in the new array is removed. Unlike Mojo, a Smile bucket's `amountMinor` **is** directly settable — matching the UI's own bucket editor, it is not exclusively transaction-derived. Two entries cannot request the same `id` in one patch — rejected with `400`, not silently resolved.
4. For `actionItems`: **`done` is required on every item, with no default** — since this replaces the whole array, an omitted `done` cannot safely default to `false` the way it does at creation (that would silently un-complete an already-done item you forgot to echo back). Always resend every item's current `done` state, not just the one you're changing.
5. For `notes`: echo back an existing note's `createdAt` to preserve it; omit it on a genuinely new note to get a fresh server timestamp.
6. A changed `title` is checked for an exact-match collision against the caller's *other* Smile projects (never against itself), using the same case-sensitive rule as `POST`.
7. Moving `phase` to `completed` stamps `completionDate` automatically if one isn't already set (matching the UI's quick "advance phase" action) — but never overwrites an explicit `completionDate` sent in the same request, and moving away from `completed` never clears a previously-set `completionDate`.
8. `DELETE` is not reversible through the API.
9. `PATCH`/`DELETE` are audit logged.

## List or create Fire projects

1. `GET /api/v1/fire` requires `fire:r` and returns every Fire project owned by the caller, with the same computed `totals` field as Smile. `POST /api/v1/fire` requires `fire:w` and follows the exact same rules as `POST /api/v1/smile` — either `targetMinor` (optionally with `amountMinor`) or a non-empty `buckets` array, a case-sensitive exact-match title-collision check, server-generated `notes[].createdAt`.
2. Fire and Smile projects are stored, validated, and shaped identically — the only difference between the two APIs is which CouchDB array they read/write (`data.fire` vs `data.smile`). If you've integrated one, the other needs no new logic beyond swapping the path and scope.
3. Existing Fire projects created before this endpoint shipped need `mm-admin migrate-fund-project-ids --collection fire` run first, same as Smile.
4. `POST` is audit logged.

## Get, update, or delete a single Fire project

1. `GET /api/v1/fire/{id}` requires `fire:r`. `PATCH`/`DELETE` require `fire:w`. All three return `404` uniformly for an id that doesn't exist or belongs to another user.
2. Every rule from "Get, update, or delete a single Smile project" above applies unchanged: partial body with full-array-replace for `buckets`/`links`/`actionItems`/`notes`, echo-back-`id`/`createdAt` to preserve identity, required non-defaulted `done` on `actionItems`, duplicate-bucket-id rejection, case-sensitive title-collision check against the caller's other Fire projects, and the `completionDate` auto-stamp on `phase` → `completed`.
3. One deliberate divergence from the UI: the Fire edit form's `updateFireEmergencie()` also auto-*clears* `completionDate` back to `''` on save when its local date field is empty and `phase` isn't `completed` — a side effect of that form always resubmitting the whole record. This API does **not** replicate that clear, since `PATCH` is a partial update: omitting `completionDate` from a request never touches it, matching every other omitted field. There is currently no way to explicitly clear an already-set `completionDate` through this endpoint, only to overwrite it with a new value.
4. `DELETE` is not reversible through the API.
5. `PATCH`/`DELETE` are audit logged.

## Create a payment plan for a Smile or Fire project's buckets

1. `POST /api/v1/smile/{id}/payment-plan` and `POST /api/v1/fire/{id}/payment-plan` require `smile:w`/`fire:w` respectively and behave identically (SMILE-7 is shared by both project types). Required fields: `planTitle`, `startDate`, `targetDate`, `frequency` (`weekly|biweekly|monthly|quarterly|yearly`), `account`. Optional: `selectedBucketIds` (which buckets to fund — omit or send `[]` to fund every bucket with smart proportional allocation) and `manualAmountMinor` (override the calculated per-period amount).
2. The calculated amount is `sum(max(0, bucket.targetMinor - bucket.amountMinor))` across the funded buckets, divided by the number of payment periods between `startDate` and `targetDate` at the given `frequency`. See `docs/domain/PAYMENT_PLAN_FORMULA.md` for the exact period-counting rules and a worked example.
3. Every `selectedBucketIds` entry must name a bucket that actually exists on the project — an unrecognized id is rejected with `400 validation_invalid`, not silently ignored (unlike the original UI, which never needs to validate this since its bucket checkboxes are already scoped to real buckets).
4. Only **creation** is exposed. The response's `status` is always `"planned"` — activating a plan into a real recurring subscription, or editing/deleting an existing plan, isn't part of this API.
5. `comment` on the created plan carries `#bucket:Title:Amount` tags — the same allocation DSL a transaction's own comment uses (see "Add a transaction" above). This plan is not itself a transaction; nothing is posted to `/transactions` by this endpoint.
6. The plan is appended to the target project's `plannedSubscriptions` array — fetch the project again (`GET /smile/{id}` or `GET /fire/{id}`) to see it alongside any others.
7. Returns `404` uniformly for a project id that doesn't exist or belongs to another user.
8. `POST` is audit logged.

## List, create, get, update, or delete assets

1. `GET/POST /api/v1/balance/assets` and `GET/PATCH/DELETE /api/v1/balance/assets/{id}` require `balance:r`/`balance:w`. An asset is just a `{tag, amountMinor}` pair — a simple named value (ASSET-1/2/3), no linked Grow project or bucket structure.
2. `tag` must not collide (case-sensitive exact match) with an existing Asset, Share, *or* Investment tag — these three entity types share one tag namespace in the original app, since a `Transaction.category` like `@Car` must unambiguously resolve to one balance-sheet entry. This applies on both `POST` and a `PATCH` that changes `tag` (checked against the caller's other assets/shares/investments, not against itself). Liabilities have their own separate tag namespace and are never part of this check.
3. Existing assets need `mm-admin migrate-balance-entity-ids --collection assets` run first (the legacy storage shape has no id, only `tag`) — same pattern as Smile/Fire's own migration tool, just a different CLI command since assets live at a nested storage path (`data.balance.asset.assets`) rather than a top-level array.
4. `PATCH` is partial — send only the fields you want to change (`tag` and/or `amountMinor`).
5. `DELETE` is not reversible through the API.
6. `POST`/`PATCH`/`DELETE` are audit logged.

## List, create, get, update, or delete liabilities

1. `GET/POST /api/v1/balance/liabilities` and `GET/PATCH/DELETE /api/v1/balance/liabilities/{id}` require `balance:r`/`balance:w`. A liability is `{tag, amountMinor, investment, creditMinor}` (LIAB-1/2/3) — `investment` flags whether it's tied to an investment (e.g. a mortgage on a rental property), `creditMinor` tracks the remaining credit/loan amount separately from `amountMinor`.
2. Unlike Assets/Shares/Investments, a liability's `tag` has its own **independent** namespace — confirmed by reading `add-liabilitie.component.ts`/`info-liabilitie.component.ts` directly, both only check against other liabilities. A liability's `tag` can freely match an existing Asset/Share/Investment tag without conflict.
3. The "payback" quick-action in the original UI (`info-liabilitie.component.ts`'s `payback()`) only pre-fills the Add Transaction panel with a `Payback Liabilitie <amount> <credit>;` comment — it never touches the liability record itself, so there's no dedicated endpoint for it; use `POST /transactions` directly the same way Smile/Fire's Mojo quick-add does (see "Add a transaction" above).
4. Existing liabilities need `mm-admin migrate-balance-entity-ids --collection liabilities` run first (same migration tool as Assets, different `--collection`).
5. `PATCH` is partial — send only the fields you want to change.
6. `DELETE` is not reversible through the API.
7. `POST`/`PATCH`/`DELETE` are audit logged.

## List, create, get, update, or delete investments

1. `GET/POST /api/v1/balance/investments` and `GET/PATCH/DELETE /api/v1/balance/investments/{id}` require `balance:r`/`balance:w`. An investment is `{tag, amountMinor, depositMinor}` (INV-1/2/3). `tag` shares the same cross-entity namespace as Assets/Shares (see "List, create, get, update, or delete assets" above) — it must not collide with an existing Asset, Share, or another Investment's tag. Confirmed by reading `add-investment.component.ts`/`info-investment.component.ts` directly.
2. **Renaming an investment's `tag` (via `PATCH`) also renames any `income.revenue.properties` entry whose `tag` matched the old value** — a Property income record is matched to its Investment by tag string, not a foreign key, same convention as everywhere else in this domain. This mirrors `info-investment.component.ts`'s own "update Income properties" cascade, done atomically in the same document write here (the original does it as two separate, non-atomic writes — a partial failure there can leave the two collections disagreeing about a renamed tag, which can't happen through this endpoint).
3. Unlike Share (see below), editing an Investment never touches a linked Grow project. `Grow.investment` exists on the interface, but the original edit form never writes to `data.grow`.
4. Existing investments need `mm-admin migrate-balance-entity-ids --collection investments` run first (same migration tool as Assets/Liabilities).
5. `PATCH` is partial — send only the fields you want to change.
6. `DELETE` is not reversible through the API.
7. `POST`/`PATCH`/`DELETE` are audit logged.

## List, create, get, update, or delete shares

1. `GET/POST /api/v1/balance/shares` and `GET/PATCH/DELETE /api/v1/balance/shares/{id}` require `balance:r`/`balance:w`. A share is `{tag, quantity, priceMinor}` (SHARE-1/2/3). `quantity` is a plain share count, not money. `tag` shares the same cross-entity namespace as Assets/Investments — it must not collide with an existing Asset, Investment, or another Share's tag.
2. **Every space is stripped from `tag`**, on both create and a `PATCH` that changes it — a corrected version of the original `add-share.component.ts`'s own space-stripping (`title.replace(' ', '')` only removes the *first* space, so "Rental Property Fund" became "RentalProperty Fund" there; this API strips every space, matching the evident ticker-like intent).
3. **Renaming a share's `tag` also renames any `income.revenue.interests` entry whose `tag` matched the old value** — same convention as Investment's Property-rename cascade, done in the same atomic write.
4. **Independently of any rename, saving `quantity`/`priceMinor` also syncs the embedded `share.quantity`/`share.price` on any Grow project whose `title` equals the (possibly just-renamed) tag** — `Grow.share: Share` is a second, embedded copy of the same data the original UI keeps in sync by title match, not a foreign key (confirmed by reading `info-share.component.ts`'s `updateShare()` directly). This sync runs on every successful `PATCH`, not only when the tag changes — mirroring the original's own unconditional "update Grow Projects" loop. Only `share.quantity`/`share.price` are overwritten; the embedded copy's own `share.tag` is left untouched, matching the original exactly. All of this (Share update, Interest rename, Grow sync) happens in one atomic CouchDB write, unlike the original's up to three separate, non-atomic writes.
5. `DELETE` does not clean up any Interest entry or Grow-project reference that pointed at the deleted share's tag — matching the original, which doesn't either.
6. Existing shares need `mm-admin migrate-balance-entity-ids --collection shares` run first (same migration tool as Assets/Liabilities/Investments).
7. `PATCH` is partial — send only the fields you want to change.
8. `POST`/`PATCH`/`DELETE` are audit logged.

## Read revenue, interest, and property income sources

1. `GET /api/v1/income/revenues`, `GET /api/v1/income/interests`, and `GET /api/v1/income/properties` require `income:r` — all three are **read-only** (REV-1/INT-1/PROP-1). Each entry is `{tag, amountMinor}`, with no `id` — there's nothing to address or migrate here.
2. **These three are fully derived from transaction history, recomputed from scratch on every `POST/PATCH/DELETE /transactions` write, with no merge against whatever was previously stored** — confirmed by reading `transaction-derived-state.js`'s `applyDerivedState` and `packages/domain/src/transactions/accounting.ts`'s `summarizeTransactionAccounting` directly. A `PATCH`/`DELETE` endpoint for one of these entries would have its effect silently discarded the next time *any* transaction anywhere in the account changes — so none is exposed. This mirrors the original app's own equivalent (`IncomeStatementService.recalculate()`, the all-time cumulative engine flagged in `PLAN.md` D-22), which has the identical characteristic; it isn't a gap introduced by this API.
3. A new tag appears automatically the first time an `@`-tagged transaction posts against the `Income` account with that category — no dedicated "add" endpoint exists (or ever existed in the original UI: there's no `add-revenue`/`add-interest`/`add-property` component). Editing or deleting that transaction is the only way to change or remove an entry — use `PATCH/DELETE /transactions/{id}` directly.
4. A transaction is classified as **interest** income rather than plain revenue when its tag matches an existing Share's tag, and as **property** income when it matches an existing Investment's tag — everything else on the `Income` account is plain revenue.
5. This is a read; none of the three are audit logged.

## List, create, get, update, delete, or act on Grow projects

1. `GET/POST /api/v1/grow` and `GET/PATCH/DELETE /api/v1/grow/{id}` require `grow:r`/`grow:w` (GROW-1/2/7). `title` must not collide with an existing Grow project's title (checked against Grow's own list only — confirmed by reading `add-grow.component.ts`'s `invalidTitle()` directly, not the three-way Smile/Fire/Grow check `docs/discovery/DOMAIN_MODEL.md` describes for a different call site).
2. **A Grow project's kind — `isAsset`/`share`/`investment` — is a mutually exclusive boolean set at creation and never changed afterwards.** It determines which body shape `POST /grow/{id}/buy` and `.../sell` expect. Sending a body shaped for the wrong kind (e.g. share fields to an asset-kind project) is rejected with `400 validation_invalid` rather than silently producing corrupted data.
3. **`PATCH` only accepts metadata fields** — `amountMinor`, `cashflowMinor`, `share`, `investment`, and `liabilitie` are rejected; use the typed action endpoints below instead.
4. **`POST /grow/{id}/{buy,sell,dividend,payback,cashflow,deposit}` (GROW-3/4/5) replace hand-writing the legacy `Transaction.comment` DSL** (`docs/domain/GROW_DSL_FORMULA.md` has the full format reference, mutation semantics, and the three corrections made during the rewrite). Each typed action atomically creates a Transaction, patches the Grow project, and patches any linked Asset/Share/Investment/Liability in one CouchDB write — the same `applyDerivedState` recompute every other transaction write goes through runs here too, so these transactions correctly feed Smile/Fire fund state and the Income accounting rebuild.
5. **`buy` optionally attaches a financing `liabilitie`** (`{loanMinor, creditMinor}`), tagged with the Grow project's own title — reduces the recorded transaction/`Grow.amount` by the loan, upserts a standalone Liability, and reflects the resulting debt onto the Grow project's own `liabilitie` field too (so a later `payback` has something to act on). An Investment-kind buy/sell always creates/updates the companion `M-<title>` mortgage liability unconditionally, distinct from this attachment.
6. **`sell` on an investment-kind project optionally includes `payback`** (`{amountMinor, creditMinor}`) to settle the attached liability atomically with the sale — requires the project to already have a `liabilitie` (400 otherwise).
7. **`payback` works on any kind**, not just investment — available whenever the project has an attached `liabilitie` (matches `grow.component.ts`'s `paybackProject()`, which has no kind check). Zeroing both the liability's amount and credit removes it and nulls `liabilitie`.
8. **`dividend` only works on a share-kind project** and, confirmed by reading the source, produces a transaction with no Share/Grow state mutation. **`cashflow`/`deposit` work on any kind** and likewise produce a transaction only.
9. `date`/`time` are optional on every typed action, defaulting to now.
10. Existing Grow projects need `mm-admin migrate-balance-entity-ids --collection grow` run first (same migration tool as Assets/Liabilities/Investments/Shares).
11. `POST`/`PATCH`/`DELETE /grow` and every typed action are audit logged.
