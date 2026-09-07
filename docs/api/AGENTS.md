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
