---
name: mm-code-review
description: The review checklist for Money Manager diffs — used directly by the code-reviewer subagent, and by anyone reviewing a PR by hand. Covers conventions, domain correctness, security, and edition separation specific to this repo.
---

# Code review checklist

Check a diff against every section below. Cite file:line for each finding; don't just say "looks fine."

## Conventions (see `mm-conventions` for detail)

- [ ] New entities follow the `main/<feature>`, `panels/add/add-<entity>`, `panels/info/info-<entity>` folder pattern.
- [ ] No direct `HttpClient`/`fetch` calls from components — only through `DatabaseService`/`PersistenceService`/`AppDataService`.
- [ ] No new state-management library introduced for a single feature.
- [ ] New backend routes use `authenticateToken` and read `req.userId`, never a client-supplied user id.
- [ ] New backend code uses the `backend/middleware/logging.js` helpers, not raw `console.log`, for anything worth auditing.
- [ ] Conventional Commit type matches what actually changed (a `feat`/`fix` on `main` triggers an automatic Firebase deploy — see `mm-release`).
- [ ] No refactor bundled with a behavior change in the same commit.

## Domain correctness (see `mm-domain-rules` for detail)

- [ ] Money fields: decimal float in existing frontend code, integer minor units + currency in new domain-package/API code — flag any code that mixes the two representations without going through the conversion boundary.
- [ ] No new hand-parsed `Transaction.comment` DSL usage (`split(" ")`-style parsing of magic strings). New Grow actions must use the typed-action + domain-package-DSL-generation pattern.
- [ ] If a bucket total, Mojo cap, or savings-rate calculation is touched, check whether the change needs to be mirrored in the other known-duplicate copies (`docs/discovery/DOMAIN_MODEL.md` §4) — or better, flag that this is exactly the kind of change that should trigger consolidation into the domain package.
- [ ] Any new `@`-prefixed category or `tag`/`title` string-matching code: is this genuinely following the existing convention (acceptable for UI-only code) or is it new API/domain-package code that should use a real reference instead (per `mm-add-api-endpoint`)?

## Security

- [ ] Every new endpoint scoped by `userId` at the repository layer, not just checked in the handler.
- [ ] Cross-user isolation has a test, not just an assumption.
- [ ] No secret, key, or token logged, printed, or included in an error message.
- [ ] No new dependency with a license outside MIT/Apache-2.0/BSD/ISC without JFK's sign-off.
- [ ] Encryption keys: never accepted as a function argument that could end up in a log or an MCP tool argument; only via the mechanism in `docs/adr/0001-pro-api-encryption-handling.md`.
- [ ] Destructive operations (bulk delete, import-with-overwrite) require explicit confirmation and are never auto-executed by an agent without it.

## Edition separation

- [ ] Any new Pro-only UI is added via the conditional route array (`environment.edition === 'selfhosted'`), not a runtime `*ngIf`/service check (`docs/adr/0004-edition-separation-mechanism.md`).
- [ ] `edition-guard`'s marker list updated if this diff introduces a new class of Pro-only build artifact (new chunk name pattern, new route path).

## Tests

- [ ] New backend logic has both unit and integration tests (real CouchDB, not mocked) — this repo's working agreement requires integration tests against a real database.
- [ ] New API endpoints have auth/scope tests and a cross-user isolation test.
- [ ] `npm run verify` passes.

## Docs

- [ ] `docs/api/openapi.yaml`, `docs/api/AGENTS.md`, and `docs/discovery/FEATURE_CATALOG.md` are updated if this diff adds/changes an API surface (see `mm-add-api-endpoint`).
- [ ] `PLAN.md` has a status note if this diff completes or changes a slice.
