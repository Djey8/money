# 0002. Money representation migration to integer minor units

## Status
Accepted

## Context

Every monetary field in the app today is a JavaScript `number` holding a decimal value (confirmed in `backend/DATABASE_STRUCTURE.md`'s own examples and throughout `DOMAIN_MODEL.md`): `Transaction.amount`, `Share.price`, `Investment.amount`/`deposit`, `Liability.amount`/`credit`, `Budget.amount`, bucket `target`/`amount` fields, `Mojo.target`/`amount`, and more. The master prompt requires the API to represent money as integer minor units (cents) + ISO-4217 currency code, never floats (§4.2), and anticipated this would need a migration strategy.

JFK's explicit requirement for this migration: **nothing he uses today may break at any point, and the migration must be reversible.** The app has no schema/migration framework at all today (confirmed in `ARCHITECTURE.md` §5) — CouchDB is fully schemaless, so any migration mechanism has to be built from scratch, and it has to be safe enough to run against his real production data.

## Decision

Migrate storage to integer minor units now, self-hosted only, per user, opt-in via an explicit admin command — not a big-bang cutover.

- **Schema version marker**: `meta/schemaVersion` on the user's document. `1` (implicit, absent = 1) means today's decimal-float storage. `2` means integer minor units + a currency code. Firebase-edition users never migrate — they stay on `1` permanently, since Firebase is UI-only per the master prompt's hard constraint and gets no Pro/API code at all.
- **Frontend stays on floats internally.** The existing ~9,000+ lines of UI, statistics, and BI code (see `RISKS_AND_QUESTIONS.md` R-5) keep operating on decimal floats exactly as today. `DatabaseService`/`PersistenceService` (the frontend's persistence boundary) gain a conversion layer keyed by `schemaVersion`: reading a v2 document converts minor units → decimal for the UI; writing converts decimal → minor units (round-half-up to the currency's minor-unit count, 2 for EUR/USD) before it leaves the browser. This is the only frontend change; moving the UI's internal representation to integers is explicitly deferred as future work, not part of this migration.
- **Domain package, API, and backend work natively in minor units.** They read v1 (decimal) documents through the same conversion utility used by the frontend, so v1 API endpoints work against unmigrated users too — read/write both directions, not read-only, since the conversion is lossless (2-decimal currencies) or explicitly flagged when it isn't (see rounding rule below).
- **Migration tool**: `mm-admin migrate --user <id>` with `--dry-run`, `--verify`, `--rollback`.
  1. Takes a full backup automatically first, reusing the existing backup scripts/mechanism.
  2. Decrypts (via the ADR-0001 encryption port), converts every monetary field across every documented path (transactions, subscriptions, all balance/income arrays, smile/fire buckets and planned subscriptions, mojo, budget, grow snapshots) to integer minor units, re-encrypts, writes.
  3. Idempotent: running it twice on an already-migrated user is a no-op.
  4. Verification: financial statement, balance sheet, and every per-account balance are computed from the data before and after conversion; any mismatch (to the cent) triggers automatic rollback to the pre-migration backup and aborts with a report. Migration only completes if verification passes.
  5. Rounding: decimal → minor units uses round-half-up to 2 decimal places. Any value that isn't cleanly representable at 2 decimals is reported in `--dry-run` output and requires explicit review before a real run proceeds.
- **Sequencing**: this migration is part of "slice 0," built and tested together with the ADR-0001 encryption port (the migration tool depends on it), before any entity's Phase 3 API work begins. It is tested end-to-end against a restored copy of JFK's real backup data in the `docker-compose.test.yml` stack before ever running against production.
- **Cross-edition bridge**: the manual Firebase→self-hosted export/import path documented in `docs/SELFHOSTED.md` must handle both schema versions on import (a Firebase export is always v1; importing into an already-v2 self-hosted account converts on the way in).

## Consequences

- No user-facing behavior changes for anyone who never runs the migration tool — v1 remains fully supported indefinitely, including by the new API.
- Migrating is an explicit, auditable, reversible action per user, not an automatic upgrade — this directly satisfies "nothing breaks, must be reversible."
- The frontend's internal float representation is untouched in this project; a future project would be needed to move UI internals to integer minor units, at which point the dual-format conversion boundary described here can be retired.
- The domain package, once built, is the only place minor-units arithmetic actually happens for anything the API touches — this is a forcing function for the domain-package extraction work in Phase 2/3 (see D-9): a calculation can't be "extracted as-is" if it's still doing float arithmetic, it has to be rebuilt against the new representation, which is additional reason to fix known bugs/duplication during extraction rather than after.
