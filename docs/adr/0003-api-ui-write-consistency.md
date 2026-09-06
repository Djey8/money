# 0003. API/UI write consistency: concurrency and derived state

## Status
Accepted — mechanism to be finalized during Phase 2 detailed design

## Context

Today's UI writes whole arrays to the generic blob store — e.g. `writeObject('transactions', allTransactions)` replaces the entire `transactions` path with whatever the frontend currently has in memory (`FEATURE_CATALOG.md`, `DOMAIN_MODEL.md`). The v1 Pro API is required to read and write the **same** CouchDB paths the UI uses (`PLAN.md` D-14), so that agent-written data is immediately visible in the UI without a UI rewrite.

This creates two concrete hazards that must be solved before any v1 write endpoint ships, not discovered after:

1. **Blob-clobber**: an agent calls `POST /api/v1/transactions` to add one transaction. Before the UI's next save, it clobbers the whole `transactions` array with its own (now-stale) in-memory copy, silently discarding the agent's write.
2. **Derived-state staleness**: the UI caches derived totals client-side (`income/expenses/*`, Smile/Fire bucket `amount`, `Mojo.amount`) that are only recomputed when the UI itself processes a transaction through `IncomeStatementService`. An API write that doesn't also update (or trigger recomputation of) these caches leaves the UI showing stale bucket balances until the user forces a "Fix Accounting" recalculation.

## Decision

**Concurrency (blob-clobber):**
- Every write-bearing GET the UI performs already returns (or can cheaply return) the document's `updatedAt` timestamp (`GET /api/data/updatedAt`, `ETag`/`If-None-Match` already exist per `ARCHITECTURE.md` §5). The frontend's `AppDataService` is changed to re-read (Tier 1 batch) before any whole-array write if its cached `updatedAt` is older than the server's current value — i.e. re-read-and-merge on write, not blind overwrite. This closes the immediate gap using infrastructure that already exists (ETag/`updatedAt`) rather than introducing a new mechanism.
- The v1 API's own writes go through per-item semantics from day one where the entity allows it (e.g. `POST /transactions` appends one item via a CouchDB-side read-modify-write cycle scoped to that one array element, not a full-array replace), so an API write is never itself the thing doing the clobbering.
- Per-item storage (one CouchDB/Mango document per transaction, etc., replacing "one array field on one big document") is noted as the durable long-term fix and tracked as a future improvement; it is not required to unblock v1, given the mitigation above.

**Derived state:**
- v1 write endpoints run the same domain-package logic the UI runs (allocation math, bucket caps, Mojo cap, category-based routing) as part of the write itself, so derived caches are updated consistently at write time — this is only possible once the domain package exists (slice 0), which is why write endpoints for any entity with derived side effects (transactions, subscriptions, smile/fire) cannot ship before slice 0 completes.
- As an explicit fallback for the very first write-capable slice, if full parity with `IncomeStatementService.recalculate()` isn't ready yet, the API may instead trigger a server-side equivalent of "Fix Accounting" after the write and report its result — slower, but never inconsistent. Which approach a given slice uses is recorded in that slice's status note in `PLAN.md`, not assumed.
- Acceptance test for both mechanisms: after an API write, the values the UI would independently compute (income statement, balance sheet, per-account balances) must match what the API's own read endpoints report — this is checked in integration tests per slice, not just eyeballed.

## Consequences

- No v1 write endpoint ships for an entity with derived side effects until the domain package's equivalent of that entity's UI logic exists and is tested against it.
- The UI gains a small but real change (re-read-before-write using `updatedAt`) as part of this work — this is in scope for Phase 3, not purely an API-side change, and should be called out per-slice in `PLAN.md`.
- This does not fully solve concurrent-write races between two *simultaneous* agent writes to the same array-based entity; the per-item CouchDB write should use its own retry-on-409 logic (already proven in `backend/routes/data.js`'s batch-write retry logic) to serialize those safely at the document level.
- Per-item storage remains the correct long-term architecture and should be revisited once the UI itself is migrated toward v1 (a later, separate project per D-14).
