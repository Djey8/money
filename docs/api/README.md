# Money Manager Pro API

The self-hosted Pro API is versioned under `/api/v1`. Its source-of-truth contract is [openapi.yaml](openapi.yaml).

## Create an agent token

Use an authenticated browser session, never another PAT, to issue an agent token. The plaintext token is returned only in this response.

```bash
curl -X POST http://localhost:3000/api/v1/auth/tokens \
  -H "Authorization: Bearer <session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"household-agent","scopes":["transactions:rw","reports:r"],"expiresInDays":90}'
```

Store the returned `mmpat_...` value in a secret manager. Revoke it through `DELETE /api/v1/auth/tokens/{tokenId}` when no longer needed.

## Create a transaction

Use a PAT with `transactions:w`. Money is always supplied as an integer minor-unit amount; negative values are expenses.

```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account":"Daily","amountMinor":-1250,"date":"2026-09-06","time":"09:30","category":"@Groceries","comment":"Weekly shop"}'
```

The server assigns the transaction ID, retries a CouchDB conflict safely, and rebuilds the linked derived account and fund state in the same user-document write.

## Edit or delete a transaction

```bash
curl -X PATCH http://localhost:3000/api/v1/transactions/tx_01234567-89ab-cdef-0123-456789abcdef \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountMinor":-1500}'

curl -X DELETE http://localhost:3000/api/v1/transactions/tx_01234567-89ab-cdef-0123-456789abcdef \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

Both require `transactions:w` and rebuild the derived account and fund state the same way `POST /transactions` does. `PATCH` accepts a partial body — send only the fields you want to change.

## Copy a transaction

```bash
curl -X POST http://localhost:3000/api/v1/transactions/tx_01234567-89ab-cdef-0123-456789abcdef/copy \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Duplicates the source transaction's account, amount, category, and comment into a new transaction dated today (send a body with any of `account`/`amountMinor`/`date`/`time`/`category`/`comment` to override).

## Batch create/update/delete transactions

Requires a PAT with `transactions:bulk` (a separate grant from `transactions:w`) and a unique `Idempotency-Key` per logical batch — reusing the same key with the same body replays the original result; reusing it with a different body is rejected.

```bash
curl -X POST http://localhost:3000/api/v1/transactions/batch \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
        "atomic": false,
        "operations": [
          {"op":"create","account":"Daily","amountMinor":-850,"date":"2026-09-07","time":"08:15","category":"@Coffee","comment":""},
          {"op":"update","id":"tx_01234567-89ab-cdef-0123-456789abcdef","amountMinor":-1500},
          {"op":"delete","id":"tx_11111111-89ab-cdef-0123-456789abcdef"}
        ]
      }'
```

The response is always `200` once the request itself is well-formed; check each item's own `status` (`created`/`updated`/`deleted`/`error`, or `not_applied` when `atomic: true` rolled the whole batch back) rather than assuming success from the HTTP status alone.

## Export or import a full set of transactions

Requires a PAT with `transactions:bulk`. Export streams every transaction as newline-delimited JSON (no pagination); import bulk-creates from the same format and needs an `Idempotency-Key` like batch does.

```bash
curl http://localhost:3000/api/v1/transactions/export \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -o transactions.ndjson

curl -X POST http://localhost:3000/api/v1/transactions/import \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/x-ndjson" \
  -H "Idempotency-Key: $(uuidgen)" \
  --data-binary @transactions.ndjson
```

Import is additive only (every line is a create) and accepts up to 10,000 lines per call. Add `?atomic=true` to the import URL to make the whole call all-or-nothing instead of applying what parses and reporting the rest per line.

## Read the income statement for a period

Requires a PAT with `reports:r`. Returns revenues, interest/property/other income, per-account expenses, net result, and savings rate for the requested period plus the one before it.

```bash
curl "http://localhost:3000/api/v1/reports/income-statement?period=month&offset=0" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

`period` is one of `week`, `month`, `quarter`, `halfyear`, `year` (default `month`); `offset` counts periods back from the current one (default `0`).

## Read the cashflow statement for a period

Requires a PAT with `reports:r`. Splits every transaction into operating, investing, financing, and mojo cashflow, plus a net total, for the requested period plus the one before it.

```bash
curl "http://localhost:3000/api/v1/reports/cashflow?period=month&offset=0" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

Same `period`/`offset` parameters as `/reports/income-statement`.

## Read the current balance sheet

Requires a PAT with `reports:r`. Returns a current snapshot of assets, liabilities, and equity — no period parameters, unlike the other report endpoints.

```bash
curl "http://localhost:3000/api/v1/reports/balance-sheet" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Read key ratios, top categories, and KPI-dashboard ratios for a period

Requires a PAT with `reports:r`. Returns savings rate, fixed cost ratio, and other key ratios (current and previous period), the top 5 expense and income categories, and a second, independently-computed pair of savings-rate/fixed-cost-ratio values matching the app's KPI dashboard — see `docs/domain/KPI_FORMULAS.md` for why there are two of each.

```bash
curl "http://localhost:3000/api/v1/reports/kpis?period=month&offset=0" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

Same `period`/`offset` parameters as `/reports/income-statement`.

## Read the Fire emergency-fund coverage ratio

Requires a PAT with `reports:r`. A current snapshot (no `period`/`offset`, like `/reports/balance-sheet`) of how many months of average expenses the Mojo reserve would cover — see `docs/domain/FIRE_COVERAGE_FORMULA.md` for the formula and its four deliberate corrections versus the original UI gauge. `coverageRatio` is `null`, not a fabricated number, when there's no expense history yet.

```bash
curl "http://localhost:3000/api/v1/reports/fire-coverage" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Read or update the Mojo reserve

Requires a PAT with `mojo:r` (read) or `mojo:w` (update). There is one Mojo balance per user; `PUT` only accepts `targetMinor` — the current amount is derived from transaction history.

```bash
curl "http://localhost:3000/api/v1/mojo" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X PUT "http://localhost:3000/api/v1/mojo" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetMinor": 200000}'
```

## List or create Smile projects

Requires a PAT with `smile:r` (list) or `smile:w` (create). Provide either `targetMinor` or a non-empty `buckets` array when creating.

```bash
curl "http://localhost:3000/api/v1/smile" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/smile" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Summer Vacation", "buckets": [{"title": "Flights", "targetMinor": 150000}]}'
```

## Get, update, or delete a single Smile project

Requires a PAT with `smile:r` (get) or `smile:w` (update/delete). `PATCH` is partial for scalar fields, but array fields (`buckets`/`links`/`actionItems`/`notes`) replace the whole array — see `docs/api/AGENTS.md` for the echo-back rules that preserve bucket/note identity across an update.

```bash
curl "http://localhost:3000/api/v1/smile/smile_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X PATCH "http://localhost:3000/api/v1/smile/smile_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase": "ready"}'

curl -X DELETE "http://localhost:3000/api/v1/smile/smile_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List or create Fire projects

Requires a PAT with `fire:r` (list) or `fire:w` (create). Fire projects are shaped identically to Smile projects — see above for the create rules (either `targetMinor` or a non-empty `buckets` array).

```bash
curl "http://localhost:3000/api/v1/fire" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/fire" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "6-Month Emergency Fund", "targetMinor": 1200000}'
```

## Get, update, or delete a single Fire project

Requires a PAT with `fire:r` (get) or `fire:w` (update/delete). Same partial-update / full-array-replace rules as Smile — see `docs/api/AGENTS.md` for the echo-back rules and the one deliberate divergence (no `completionDate` auto-clear).

```bash
curl "http://localhost:3000/api/v1/fire/fire_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X PATCH "http://localhost:3000/api/v1/fire/fire_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase": "completed"}'

curl -X DELETE "http://localhost:3000/api/v1/fire/fire_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Create a payment plan for a Smile or Fire project's buckets

Requires a PAT with `smile:w` or `fire:w` (both endpoints behave identically — see `docs/domain/PAYMENT_PLAN_FORMULA.md` for the formula). Only creation is exposed; the plan is appended to the project's `plannedSubscriptions` array with `status: "planned"`.

```bash
curl -X POST "http://localhost:3000/api/v1/smile/smile_<id>/payment-plan" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planTitle": "Flight Fund", "startDate": "2026-01-01", "targetDate": "2026-04-01", "frequency": "monthly", "account": "Daily"}'
```

## List, create, get, update, or delete assets

Requires a PAT with `balance:r` (list/get) or `balance:w` (create/update/delete). `tag` must not collide with an existing Asset, Share, or Investment tag — see `docs/api/AGENTS.md` for the full cross-entity uniqueness rule.

```bash
curl "http://localhost:3000/api/v1/balance/assets" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/balance/assets" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag": "Car", "amountMinor": 800000}'

curl -X PATCH "http://localhost:3000/api/v1/balance/assets/assets_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountMinor": 900000}'

curl -X DELETE "http://localhost:3000/api/v1/balance/assets/assets_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List, create, get, update, or delete liabilities

Requires a PAT with `balance:r` (list/get) or `balance:w` (create/update/delete). Unlike Assets, a liability's `tag` has its own independent namespace — it never collides with an Asset/Share/Investment tag.

```bash
curl "http://localhost:3000/api/v1/balance/liabilities" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/balance/liabilities" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag": "Mortgage", "amountMinor": 15000000, "investment": true, "creditMinor": 5000000}'

curl -X PATCH "http://localhost:3000/api/v1/balance/liabilities/liabilities_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"creditMinor": 4000000}'

curl -X DELETE "http://localhost:3000/api/v1/balance/liabilities/liabilities_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List, create, get, update, or delete investments

Requires a PAT with `balance:r` (list/get) or `balance:w` (create/update/delete). `tag` shares the same cross-entity namespace as Assets/Shares — see `docs/api/AGENTS.md` for the full rule. Renaming an investment's `tag` also renames any matching `income.revenue.properties` entry, atomically.

```bash
curl "http://localhost:3000/api/v1/balance/investments" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/balance/investments" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag": "Rental Unit A", "amountMinor": 18000000, "depositMinor": 3000000}'

curl -X PATCH "http://localhost:3000/api/v1/balance/investments/investments_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"depositMinor": 4000000}'

curl -X DELETE "http://localhost:3000/api/v1/balance/investments/investments_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List, create, get, update, or delete shares

Requires a PAT with `balance:r` (list/get) or `balance:w` (create/update/delete). `tag` shares the same cross-entity namespace as Assets/Investments and has every space stripped. Renaming a share's `tag`, or just updating `quantity`/`priceMinor`, also syncs any linked Grow project and Interest entry — see `docs/api/AGENTS.md` for the full rule.

```bash
curl "http://localhost:3000/api/v1/balance/shares" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/balance/shares" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tag": "MSFT", "quantity": 10, "priceMinor": 41500}'

curl -X PATCH "http://localhost:3000/api/v1/balance/shares/shares_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 20, "priceMinor": 42000}'

curl -X DELETE "http://localhost:3000/api/v1/balance/shares/shares_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Read revenue, interest, and property income sources

Requires a PAT with `income:r`. All three are read-only — they're fully derived from transaction history and get recomputed on every transaction write, so editing/deleting the underlying transaction (`PATCH/DELETE /transactions/{id}`) is the only durable way to change one. See `docs/api/AGENTS.md` for the full explanation.

```bash
curl "http://localhost:3000/api/v1/income/revenues" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl "http://localhost:3000/api/v1/income/interests" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl "http://localhost:3000/api/v1/income/properties" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List, create, get, update, delete, or act on Grow projects

Requires a PAT with `grow:r` (list/get) or `grow:w` (create/update/delete/act). A project's kind (`isAsset`/`share`/`investment`) is fixed at creation and determines which fields `buy`/`sell` expect. `PATCH` only accepts metadata — use the typed actions for money-moving changes. See `docs/api/AGENTS.md` and `docs/domain/GROW_DSL_FORMULA.md` for the full rules.

```bash
curl "http://localhost:3000/api/v1/grow" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/grow" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "MSFT", "share": true, "phase": "plan"}'

curl -X PATCH "http://localhost:3000/api/v1/grow/grow_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phase": "monitor", "riskScore": 4}'

curl -X POST "http://localhost:3000/api/v1/grow/grow_<id>/buy" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 10, "priceMinor": 41500}'

curl -X POST "http://localhost:3000/api/v1/grow/grow_<id>/sell" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 5, "priceMinor": 42000}'

curl -X DELETE "http://localhost:3000/api/v1/grow/grow_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Read a grow project's profit/loss summary

Requires a PAT with `reports:r`. An all-time snapshot (no `period`/`offset`) summing every transaction whose category matches the project's title. See `docs/api/AGENTS.md` and `docs/domain/GROW_PNL_FORMULA.md`.

```bash
curl "http://localhost:3000/api/v1/reports/grow/grow_<id>/pnl" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List, create, get, update, or delete subscriptions

Requires a PAT with `subscriptions:r`/`subscriptions:w`. Creating or editing never generates a transaction by itself — call refresh (below) afterward. See `docs/api/AGENTS.md` for the PATCH cascade-cleanup and DELETE `?deleteTransactions=` behavior.

```bash
curl "http://localhost:3000/api/v1/subscriptions" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/subscriptions" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Spotify", "account": "Daily", "amountMinor": -1000, "startDate": "2026-01-01", "category": "@Streaming", "frequency": "monthly"}'

curl -X PATCH "http://localhost:3000/api/v1/subscriptions/subscriptions_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountMinor": -1200}'

curl -X DELETE "http://localhost:3000/api/v1/subscriptions/subscriptions_<id>?deleteTransactions=true" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Generate due transactions from subscriptions

Requires a PAT with `subscriptions:w`. Safe to call repeatedly — an occurrence already generated is skipped, not duplicated. See `docs/api/AGENTS.md` for the Mojo/Smile target-cap skip behavior.

```bash
curl -X POST "http://localhost:3000/api/v1/subscriptions/refresh" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## List, create, get, update, or delete budget rows

Requires a PAT with `budget:r`/`budget:w`. `date` is always `YYYY-MM` (month, no day). `POST` upserts by `(date, tag)` — a second POST for the same month/category overwrites the amount rather than creating a duplicate row.

```bash
curl "http://localhost:3000/api/v1/budget?month=2026-01" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X POST "http://localhost:3000/api/v1/budget" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01", "tag": "@Groceries", "amountMinor": 30000}'

curl -X PATCH "http://localhost:3000/api/v1/budget/budget_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amountMinor": 45000}'

curl -X DELETE "http://localhost:3000/api/v1/budget/budget_<id>" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Bulk-populate a month's budget (fill-forward, copy, delete-month)

Requires a PAT with `budget:w`. Fill-forward is add-only (never overwrites); copy overwrites the target month's matching rows. See `docs/api/AGENTS.md` for the exact chaining/overwrite semantics.

```bash
curl -X POST "http://localhost:3000/api/v1/budget/fill-forward" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetMonth": "2026-04"}'

curl -X POST "http://localhost:3000/api/v1/budget/copy" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromMonth": "2026-01", "toMonth": "2026-02"}'

curl -X DELETE "http://localhost:3000/api/v1/budget?month=2026-01" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Populate budget rows from active subscriptions

Requires a PAT with `budget:w`. No request body — always evaluates every active subscription on the account, converting each to its real monthly-equivalent amount by frequency. See `docs/domain/BUDGET_FROM_SUBSCRIPTIONS_FORMULA.md`.

```bash
curl -X POST "http://localhost:3000/api/v1/budget/from-subscriptions" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"
```

## Read or update settings

Requires a PAT with `settings:r`/`settings:w`. `email` is not a settings field — see `PATCH /account`. `allocation` is replaced as a whole unit (all four fields, summing to 100), never merged field-by-field.

```bash
curl "http://localhost:3000/api/v1/settings" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

curl -X PATCH "http://localhost:3000/api/v1/settings" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"theme": "dark", "currency": "$"}'
```

## Read or update encryption configuration

Requires `encryption:r` for `GET` (a PAT with any scope works). `PUT` requires an actual login session — it cannot be called with a PAT at all, regardless of scope. `GET` never returns the raw key. Changing an already-active key is rejected; use `mm-admin rotate-encryption-key` on the server for that.

```bash
curl "http://localhost:3000/api/v1/encryption-config" \
  -H "Authorization: Bearer $MONEY_MANAGER_TOKEN"

# PUT requires a session cookie/bearer token from the logged-in browser, not a PAT.
curl -X PUT "http://localhost:3000/api/v1/encryption-config" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"encryptDatabase": true}'
```
