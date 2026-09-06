---
name: mm-add-api-endpoint
description: Step-by-step recipe for adding one Pro API endpoint to Money Manager's self-hosted backend, from OpenAPI contract through tests, docs, and MCP tool mapping. Use this for every new /api/v1 endpoint in Phase 3 — follow it exactly so every endpoint ends up consistent.
---

# Adding a Pro API endpoint

Follow every step, in order, for each endpoint. Don't skip docs/MCP mapping "for later" — that's how `docs/api/` and the MCP server drift from the code.

## 0. Preconditions

- Confirm the entity's domain logic (validation rules, calculations, side effects) exists in the shared domain package. If not, that's a separate prerequisite task — see `PLAN.md` D-9/D-20 for extraction order. Do not reimplement domain logic inline in the route handler.
- Confirm the money fields involved use integer minor units per `docs/adr/0002-money-minor-units-migration.md`, and that reads/writes go through the schema-version-aware conversion layer if the entity can exist in both v1 (decimal) and v2 (minor-unit) user documents.
- Confirm whether this entity's writes need the concurrency/derived-state handling in `docs/adr/0003-api-ui-write-consistency.md` (anything the UI also writes to). If yes, that mechanism must exist before this endpoint ships a write path.

## 1. OpenAPI contract

Add the operation to `docs/api/openapi.yaml` first, before writing any code:
- `operationId`, summary, description.
- Request/response schemas using integer minor units + ISO-4217 currency code for money, ISO-8601 UTC timestamps, cursor pagination for lists.
- At least one request and one response example, with realistic values (not `"string"`/`0`).
- Every error response this endpoint can produce, as an RFC 9457 Problem Details shape with a `code` from `docs/api/ERRORS.md`.
- The required scope(s) under the security requirement.
- If this is a bulk/list endpoint: filtering, sorting, and cursor pagination parameters; if a collection, note whether `POST .../batch` and `GET .../export` / `POST .../import` exist for it yet.

## 2. Validation schema

Write a schema (zod or valibot — whichever this project has already standardized on; check `backend/package.json` and existing endpoints, don't introduce a second library) matching the OpenAPI request schema exactly. Reuse types from the shared domain package rather than redefining them.

## 3. Handler → service → repository

- **Handler**: parses/validates the request, calls the service, maps the result/errors to the HTTP response. No business logic here.
- **Service**: the domain-package logic, given plaintext data (decryption already happened per `docs/adr/0001-pro-api-encryption-handling.md`) and `req.userId`.
- **Repository**: the only layer that talks to CouchDB. **User scoping is enforced here, not in the handler** — every query/write is scoped by `userId` at this layer, per the master prompt's cross-user-isolation requirement, so a handler bug can't leak another user's data.
- Encrypt on the way out, decrypt on the way in, at the repository boundary, using the domain package's port of `CrypticService`.
- Idempotency: if this is a write, check whether it needs to honor an `Idempotency-Key` header (required for anything under `.../batch`).
- Optimistic concurrency: updates take `If-Match`/`version` per the master prompt's §4.2 default — reject with 409 + Problem Details on mismatch.

## 4. Tests

All of the following, not a subset:
- **Unit** tests for the domain-package logic this endpoint calls (if not already covered).
- **Integration** tests against a real CouchDB (`docker-compose.test.yml`), not mocks — this repo's working agreement explicitly requires real-database integration tests.
- **Auth/scope tests**: request with no token, wrong scope, expired token, revoked token.
- **Cross-user isolation test**: user A's token must never be able to read/write user B's data, tested explicitly for this endpoint, not assumed from the general middleware.
- **Bulk/idempotency tests** if applicable: replaying the same `Idempotency-Key` produces the same result without double-applying the write.

## 5. Docs

- `docs/api/README.md`: add a `curl` recipe if this is one of the common tasks.
- `docs/api/AGENTS.md`: add this endpoint to the relevant "order of operations for common goals" section, written as instructions to an LLM tool-user.
- `docs/discovery/FEATURE_CATALOG.md`: mark the corresponding row(s) ✅ with the endpoint path.
- `docs/domain/`: if this endpoint exposes a calculation, make sure the formula/worked-example doc exists and is linked, rather than re-explaining the math in the API docs.

## 6. MCP tool definition

Add or update the MCP tool definition in `apps/mcp` (see Phase 5 design). The tool description is written for an LLM: when to use it, what it returns, side effects, and `confirm: true` if destructive. Schema is derived from the OpenAPI spec, not hand-duplicated.

## 7. Verify, review, commit

1. `npm run verify` — must be green (lint, format check, typecheck, unit tests, both frontend and backend).
2. Run `edition-guard` — confirm the Firebase build still contains none of this endpoint's markers.
3. Invoke the `code-reviewer` subagent against the diff.
4. Commit with a conventional-commit message scoped to this endpoint (`feat(api): add POST /transactions`), separate from any unrelated refactor.
5. Update `PLAN.md` with a one-paragraph status note for this slice.

Never start the DB schema change, add a bulk delete/import-with-overwrite capability, or anything else on the master prompt's "ask before" list without checking with JFK first, even mid-slice.
