# API Agent Guidance

A self-hosted PAT is explicit consent for an agent to access only its granted scopes. Do not send its value in prompts or tool arguments; load it from a local environment variable.

Before making financial requests, call `GET /api/v1/me` with the PAT and inspect the exact scope list. Stop and report the missing scope rather than attempting unrelated endpoints.

PATs cannot create, list, or revoke tokens. Token lifecycle calls require the user's authenticated browser session or a human operator using `mm-admin` directly on the server. The API never issues `admin` scope tokens; use the CLI only for documented break-glass administration.

Every Pro API write is audit logged. Prefer narrowly scoped, expiring tokens and revoke a token as soon as its automation is retired.

## Add a transaction

1. Call `GET /api/v1/me` and require `transactions:w` before attempting a write.
2. Use `POST /api/v1/transactions` with a signed integer `amountMinor`, ISO `date`, account, category, time, and comment. An empty comment is valid.
3. Read the returned transaction rather than predicting its final amount or comment: Smile and Fire contributions may be capped at their fund target, which changes the stored amount and legacy `#bucket:` allocation tags.
4. Treat a `409` response as a retryable concurrency result only when a future write endpoint exposes an idempotency key. Do not retry an uncertain POST blindly.

## Edit or delete a transaction

1. `PATCH /api/v1/transactions/{id}` accepts a partial body — only the fields you send are changed. Sending an unrecognized field is rejected as a validation error rather than silently ignored.
2. If the transaction's `comment` carries a `#bucket:Name:Amount` allocation tag (current or being set by this same request), `amountMinor` and `comment` must be sent together in the same `PATCH`. Sending only one is rejected with `validation_invalid` — it is never silently applied against the other field's stale value, since a tagged comment and the amount it encodes are one coupled value to the fund-allocation engine.
3. There is no per-transaction `If-Match`/version check yet: a concurrent edit to the same transaction can be silently overwritten (last write wins). Re-read the transaction immediately before an edit if another writer might be active.
4. As with create, read the response body rather than assuming your edit applied exactly as sent — Smile/Fire capping can still adjust the amount and comment.
5. `DELETE /api/v1/transactions/{id}` is not reversible through the API. Both PATCH and DELETE return `404` for an id that doesn't exist or belongs to another user — the two cases are indistinguishable by design.
