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
