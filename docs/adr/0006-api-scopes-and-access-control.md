# 0006. API scopes, PAT privilege model, rate limiting, and audit logging

## Status

Accepted

## Context

Master prompt §4.3 requires scopes of the form `<resource>:<r|w|rw>` plus `admin`, with bulk import/delete needing an explicit `…:bulk` scope. §4.2 requires rate limiting and an audit log of every write. The existing self-hosted backend already has a proven pattern for token lifecycle (refresh-token rotation with server-side revocation, `ARCHITECTURE.md` §6) and for security event logging (`logSecurityEvent` with a webhook, `ARCHITECTURE.md` §5) — both are extended here, not replaced. `PLAN.md` D-19 already decided PATs are stored hashed as `pat_<id>` documents in `auth`, using the refresh-token pattern.

One risk not yet addressed: **privilege escalation via token management itself.** If a PAT with any scope could create a new PAT with broader scopes, a leaked low-privilege token becomes a path to full account compromise.

## Decision

### Scope taxonomy

`<resource>:<r|w>` (combine as `rw` in a request for convenience, stored/checked as the union of `r` and `w`), plus `:bulk` per resource for its batch/import/export endpoints, plus a standalone `admin` scope. Resources, matching the entities in `DOMAIN_MODEL.md` §1:

`transactions`, `subscriptions`, `smile`, `fire`, `mojo`, `grow`, `balance` (assets/shares/investments/liabilities not wrapped in a Grow project), `income` (revenues/interests/properties), `budget`, `settings` (allocation ratios, currency, date format, language, theme), `encryption` (encryption config — kept separate from `settings` given its sensitivity), `account` (profile/email/password/delete-account actions), `reports` (read-only; calculations never take a `:w`), `data` (full backup export/import — the highest-blast-radius resource, always requires `:bulk` and never bundled into a plain `:w`).

### PAT privilege model — preventing self-escalation

- **Token management endpoints (`/api/v1/auth/tokens*`) can never be called using a PAT.** Only an authenticated browser session (the existing JWT/refresh-cookie flow) or the `mm-admin` CLI (which talks to CouchDB directly, not through the API) can create, list, or revoke PATs. A PAT is structurally incapable of managing tokens, including its own — this eliminates the escalation path entirely rather than relying on scope-checking discipline.
- A PAT's scopes are fixed at creation and immutable — revoke and re-issue to change them, never "edit" a live token's scopes.
- The `admin` scope is never granted to a PAT created for agent/MCP use; it exists for the human's own session and for `mm-admin`-created break-glass tokens, documented as such in the setup flow.
- `GET /api/v1/me` returns the caller's `userId`, token name (if a PAT), and exact scope list, so an agent can self-verify what it's allowed to do before attempting a call — per master prompt §4.3.

### Rate limiting

Extend the existing `express-rate-limit` pattern (`ARCHITECTURE.md` §5) with a third tier for `/api/v1/*`: per-token (not just per-IP) limits, since a single self-hosted user could otherwise be rate-limited by their own agent's burst traffic sharing an IP with their browser. Bulk/`:bulk`-scoped endpoints get a stricter, separate limit given their larger blast radius per call.

### Audit log

A new `audit` CouchDB database (mirroring the `users`/`auth`/`community` pattern in `config/db.js`), one document per write, containing: `userId`, token id (or "session" for browser-originated writes), timestamp, HTTP method + path, resource + resource id, and — per ADR-0001 — an encrypted payload/diff when the write touched user financial data, using the same per-user key. Metadata fields stay plaintext so the log remains searchable/administrable without the key. Every `:w`/`:bulk` endpoint writes exactly one audit entry per logical operation (a batch write is one entry with an item count, not N entries) as part of the same request, not a fire-and-forget side effect that could silently fail to log.

## Consequences

- Agents/MCP tokens are structurally unable to mint more powerful tokens for themselves — the most important escalation vector is closed by design rather than by convention.
- Every scope check happens at the repository layer per `mm-add-api-endpoint`, and needs a test per scope/route combination per the master prompt's cross-user-isolation testing requirement, extended here to cross-scope testing.
- The audit log is a new database and a new write on every mutating request — a real (small) performance cost, accepted as the price of the master prompt's explicit "audit log is a first-class feature, not an afterthought" requirement.
- `mm-admin token create --user <id> --name "..." --scopes transactions:rw,reports:r` (per master prompt §4.3's example) is the only way to mint an agent-usable token, keeping token issuance a deliberate, human-initiated action even though revocation can later be exposed via the browser UI (§4.3, Pro settings page) for convenience.
