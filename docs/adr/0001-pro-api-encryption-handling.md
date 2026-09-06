# 0001. Pro API encryption handling

## Status
Accepted

## Context

`CrypticService` (`src/app/shared/services/cryptic.service.ts`) lets a self-hosted user optionally enable `encryptDatabase`, in which case every value written to CouchDB is AES-256-CBC ciphertext (v2 format: PBKDF2-SHA256-derived key + HMAC-SHA256 authentication), opaque to the backend. In self-hosted mode the encryption key itself is already stored server-side (`auth.js /encryption-config`) and cached client-side only in `sessionStorage` — so self-hosted, encryption-enabled accounts are not zero-knowledge today; encryption protects data at rest (CouchDB, backups), not from the server process itself.

The master prompt requires the Pro API to support server-side filtering, sorting, calculations, and an audit log recording *what* changed on every write (§4.2). None of that is possible against opaque ciphertext. `todo/monertarize.md` separately recommends a *hosted SaaS* offering be architected as genuinely zero-knowledge (server cannot read plaintext, ever) as a privacy/legal moat — a stronger property than what exists today, and one this decision must not foreclose.

## Decision

The Pro API (self-hosted only) decrypts on read and encrypts on write **server-side**, using the same key the self-hosted backend already has access to for that user:

- Domain logic (validation, calculations, filtering, sorting) operates on plaintext in server memory only, for the duration of a request.
- CouchDB never stores plaintext — data at rest remains encrypted exactly as it is today.
- The shared domain package gets a byte-for-byte port of `CrypticService`'s v2 crypto (AES-256-CBC + PBKDF2-SHA256 + HMAC-SHA256), validated against golden test vectors generated from the current Angular implementation before any other code depends on it. The legacy passphrase format is supported read-only in the port (matching the frontend's own legacy-read behavior); nothing writes in the legacy format.
- Key resolution order per request: (1) the server-stored key for that user (default — matches today's self-hosted behavior), (2) an explicit per-request/session override (an `X-MM-Encryption-Key` header or an uploaded exported-key payload) held in memory only, for users who deliberately don't store their key server-side. Keys are never written to logs, never accepted as an MCP tool argument, and never appear in a prompt.
- Audit log entries encrypt any payload/diff content with the same per-user key; log metadata (who, token id, timestamp, path, operation) stays plaintext, since that's needed to search/administer the log without the key.

## Consequences

- Filtering, sorting, calculations, and detailed audit logging all work as specified, for every self-hosted user, regardless of whether they've enabled `encryptDatabase`.
- The self-hosted Pro API is **not** zero-knowledge — the server can read plaintext during a request, same as it structurally could already (it holds the key). This is a continuation of today's model, not a regression.
- A genuinely zero-knowledge **hosted SaaS** mode (per `todo/monertarize.md`) remains possible as a future, separate offering, but it cannot reuse this API's server-side filtering/audit design as-is — it would need a different mechanism (e.g., client-side filtering, or homomorphic/searchable-encryption techniques) if pursued later. That tradeoff is deferred, not decided, by this ADR.
- The `CrypticService` port must pass golden-vector tests before any entity work depends on it (see `PLAN.md` D-4, D-13) — this is slice 0, a hard prerequisite.
