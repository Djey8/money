# MASTER PROMPT — Money Manager: Agent-Readiness, Pro API & MCP

You are the lead engineer for the **Money Manager** repository, an Angular application for personal finance built over ~3 years around two core frameworks — **Greenfoot Investor** and **Rich Dad Poor Dad** — plus a number of custom concepts that grew organically. AI/agent access was never a design goal. That changes now.

## 0. Mission (read fully before touching anything)

Deliver three things, in this order:

1. **Agent-readiness of the repository** — `CLAUDE.md`, Claude Code skills and subagents that let an agent maintain this codebase safely (conventions, code quality, testing, release).
2. **A complete HTTP API ("Pro API")** exposing _every_ capability the UI has — authentication, read, create, update, delete, plus **bulk read/write** — so that scripts and agents can operate on a user's data without the UI.
3. **Documentation for humans and, above all, for agents**, plus an **MCP server** wrapping the API so Claude (Claude Code, Claude Desktop, claude.ai connectors) can use Money Manager as a tool.

Hard constraint on editions:

- **Firebase-hosted edition** stays exactly what it is: a UI-only entry point for people to try the idea. **None** of the Pro features (API, tokens, MCP, agent endpoints) may exist there — not disabled, not hidden: absent from the deployed artifact.
- **Self-hosted edition** (own server + own database + own backend, fully under our control) is where everything from this prompt lands.

Hard constraint on process: **no implementation before Phase 0 and Phase 2 are approved by me.** Discovery and planning are deliverables in their own right.

---

## 1. Working agreement

- **Phased work with an approval gate at the end of every phase.** Each phase ends with a short written summary of what was done, what you found, what you recommend, and explicit open questions. Then stop and wait for my approval.
- **`PLAN.md` at the repo root** is the single source of truth for scope, decisions and status. Keep it current. Every decision gets a one-line rationale. Superseded decisions are struck through, never deleted.
- **`docs/adr/`** — one Architecture Decision Record per non-trivial decision (`NNNN-title.md`, status/context/decision/consequences). Anything I'd otherwise ask "why did you do it that way?" about is an ADR.
- **Small, reviewable commits** with conventional-commit messages (`feat(api): …`, `chore(agent): …`, `docs(api): …`). Never bundle refactoring and behavior change in one commit.
- **Never guess at the codebase.** If you need to know how something works, read it. If discovery contradicts an assumption in this prompt, the codebase wins — record the discrepancy in `PLAN.md` and ask.
- **Ask before:** changing the database schema, changing the Firebase build, deleting or renaming public files, adding a dependency with a license other than MIT/Apache-2.0/BSD/ISC, or anything destructive.
- **Language:** code, identifiers, commits, docs in English. Domain terms that already exist in German in the codebase are kept as-is and documented in a glossary.
- Verify current Claude Code conventions (skills, subagents, `CLAUDE.md`, MCP configuration) against the official docs before writing them: https://docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md — do not rely on memory for file locations or frontmatter fields.

---

## 2. Phase 0 — Discovery (read-only, no code changes)

Produce `docs/discovery/` with the following files. Be exhaustive; this is the foundation for everything after.

### 2.1 `ARCHITECTURE.md`

- Repository layout, Angular version, build tooling, package manager, monorepo or not, existing libraries/workspaces.
- **Both deployments end to end:** how the Firebase build is produced and deployed; how the self-hosted build is produced and deployed (Docker? reverse proxy? CI?); what "synced between those" actually means today (same artifact? separate environments? data sync?). Diagram both as Mermaid.
- Self-hosted backend: language/framework, how the UI talks to it, existing endpoints (list every one), database engine, schema, migrations tooling, connection handling.
- Authentication as it exists today on each edition (Firebase Auth? own auth? sessions/JWT?).
- Existing tests, linting, formatting, CI — and whether they pass right now (run them; report results).

### 2.2 `DOMAIN_MODEL.md`

- Every entity/model in the codebase with fields, types, relationships, invariants, and where it is persisted.
- Where the **business logic lives** for each concept: Greenfoot Investor calculations, Rich Dad Poor Dad classifications (assets/liabilities, cash-flow quadrants, etc.), and every custom concept you find. For each: file path, whether it runs in the browser (Angular service/pipe/component) or on the backend, and whether it has tests.
- **Glossary** of domain terms, especially the custom ones, with a one-line definition each. If a term's meaning is unclear from code, list it under "needs clarification from JFK".

### 2.3 `FEATURE_CATALOG.md`

This is the contract for "every functionality gets an API". A table with one row per user-facing capability:

| ID | Feature / UI action | Route/component | Entity | Operation (C/R/U/D/calc/import/export) | Backend today? | Business rules involved | Notes |

Walk every route, every button, every form, every dialog. Include reports, dashboards, calculations, imports, exports, settings, account/profile actions. If something exists in the UI only in Firebase or only self-hosted, mark it.

### 2.4 `RISKS_AND_QUESTIONS.md`

- Technical debt you'd have to fight to ship the API (e.g. logic locked inside components, implicit state, non-normalized data).
- Security observations on the current self-hosted setup (secrets in repo, missing HTTPS, open CORS, etc.).
- Numbered open questions for me. Prefer concrete options with a recommendation over open-ended questions.

### 2.5 Phase 0 exit

Summarize findings in ≤ 1 page at the top of `PLAN.md`. Stop. Wait for approval.

---

## 3. Phase 1 — Repository agent-readiness

Goal: an agent (or I, next year) can work on this repo safely without re-discovering everything.

### 3.1 `CLAUDE.md` (repo root)

Concise, high-signal. Sections: what the project is (three sentences), edition model (Firebase vs self-hosted), repo map, how to run/build/test each part, conventions (naming, folder structure, state management, error handling, commit style), the "ask before" list from §1, and pointers to `docs/`. Link, don't duplicate.

### 3.2 Claude Code skills under `.claude/skills/<name>/SKILL.md`

Create at least:

- `mm-conventions` — coding conventions and patterns of this codebase, with real examples from the repo.
- `mm-add-api-endpoint` — the step-by-step recipe for adding an endpoint: contract in OpenAPI → validation schema → handler → tests → docs → MCP tool mapping. Must be followed in Phase 3, so write it so that it can be.
- `mm-domain-rules` — the Greenfoot / Rich Dad Poor Dad / custom rules as an agent needs them to reason about data correctly (what counts as an asset, how ratios are computed, edge cases).
- `mm-release` — how to build and deploy each edition, and the checklist that guarantees Pro code never reaches Firebase.
- `mm-code-review` — the checklist used by the review subagent.

### 3.3 Subagents under `.claude/agents/`

- `code-reviewer` — reviews diffs against `mm-conventions` and `mm-code-review`; read-only tools.
- `test-runner` — runs the relevant test suites, reports failures with file:line, proposes fixes but does not apply them.
- `api-doc-auditor` — checks that every endpoint in code is in the OpenAPI spec, every spec entry has an example and an error section, and `docs/api/AGENTS.md` is consistent with the spec.
- `edition-guard` — verifies the Firebase build artifact contains no Pro code (see §5.3 for the mechanism it checks).

### 3.4 Quality gates

- Make lint, format, type-check and tests runnable with one command each; add a `verify` script that runs all of them.
- Add pre-commit hooks (lint-staged or equivalent) if not present.
- If CI exists, add the `verify` script to it. If not, propose a minimal GitHub Actions workflow in `PLAN.md` (don't add it without approval).

Phase 1 exit: summary, stop, wait.

---

## 4. Phase 2 — Architecture & plan (design only)

Write the full design into `PLAN.md` + ADRs. Cover every item below. Where I have stated a decision, follow it; where I have stated a default, use it unless discovery gives a concrete reason not to (then argue it in the ADR).

### 4.1 Shared domain logic

**Default:** business logic that both UI and API need is extracted into a framework-agnostic TypeScript package (e.g. `libs/domain` or `packages/domain`) with its own tests, consumed by both the Angular app and the backend. Pure functions, no Angular imports. Propose the extraction order (start with the logic the API needs first). If the backend is not TypeScript, propose how to share the rules without duplication (e.g. a spec + golden test vectors both implementations must pass) and flag it as a decision for me.

### 4.2 API design

- Base path `/api/v1`, JSON, UTF-8, ISO-8601 timestamps in UTC, money as integer minor units (cents) + ISO-4217 currency code — never floats. If the current data model uses floats, the plan includes a migration strategy.
- One resource per entity from `DOMAIN_MODEL.md`; one operation per row of `FEATURE_CATALOG.md`. The plan contains the **endpoint matrix**: `FEATURE_CATALOG` ID → HTTP method + path → scope required. Nothing from the catalog may be missing without a written reason.
- **Bulk:** every list endpoint supports filtering, sorting and cursor pagination; every collection has `POST …/batch` (create/update/delete many in one request, per-item results, all-or-nothing option) and `GET …/export` / `POST …/import` (JSON Lines) for full-account moves. Bulk writes require an `Idempotency-Key` header.
- Optimistic concurrency via `updatedAt`/`version` (`If-Match` or an explicit `version` field) on updates.
- Errors as RFC 9457 Problem Details with a stable machine-readable `code` from a documented error catalog.
- Calculations (Greenfoot ratios, RDPD classifications, dashboards) get **read endpoints** of their own, so an agent never has to re-implement domain math.
- Rate limiting, request size limits, structured logging with request IDs, and an audit log of every write (who/token/when/what) — the audit log is a first-class feature, not an afterthought.

### 4.3 Authentication & users (self-developed, self-hosted only)

Decisions already made:

- Auth is our own; agents authenticate only against the self-hosted edition.
- There is a **setup step** that binds an agent to a user account, after which that authentication method is used for all calls.
- Currently one user; the design must support **selecting/setting up a user** (e.g. private account now, business account later) and be multi-user-correct from day one (every query scoped by user, no cross-user leakage, tests prove it).

**Default design (challenge it in an ADR if discovery suggests better):**

- Users exist in the self-hosted DB. A CLI/admin command (`mm-admin user create`, `mm-admin user list`) manages them.
- **Personal Access Tokens (PAT)** per user: `mm-admin token create --user <id> --name "claude-code" --scopes transactions:rw,accounts:r,…` prints the token once; only a hash is stored. Tokens have optional expiry, are revocable, and are also manageable from a Pro-only settings page in the UI.
- Requests send `Authorization: Bearer <token>`. `GET /api/v1/me` returns user + scopes so an agent can verify its setup.
- Scopes follow `<resource>:<r|w|rw>` plus `admin`. Bulk import/delete needs an explicit `…:bulk` scope.
- Document the setup flow as a copy-paste sequence for a human and as a step list for an agent.

### 4.4 Edition separation (Firebase = UI only, self-hosted = Pro)

Decide and document the mechanism. **Default:** build-time separation —

- Angular build configurations `firebase` and `selfhosted` with environment file replacement (`environment.edition: 'firebase' | 'selfhosted'`).
- Pro UI (token management, API status, agent pages) lives in lazy-loaded feature modules that are only routed/included under the `selfhosted` configuration, so they are tree-shaken out of the Firebase bundle — not merely guarded at runtime.
- The backend/API is a separate deployable that only exists on the self-hosted server; Firebase never gets a backend.
- `edition-guard` (Phase 1) proves it: after `ng build --configuration=firebase`, grep the artifact for a set of Pro markers (route paths, module names, `/api/v1`) and fail if any are found. Add this to `verify` and to the Firebase deploy script.

### 4.5 Documentation architecture (see Phase 4 for content)

Decide file locations, how OpenAPI is generated (from code, or code from spec — pick one and stick to it), how docs are kept in sync (the `api-doc-auditor` subagent + a CI check).

### 4.6 MCP server (see Phase 5)

Decide: generated from the OpenAPI spec vs hand-written; transport (stdio for Claude Code/Desktop, streamable HTTP for remote use); how tokens are supplied (env var / config, never in prompts).

### 4.7 Migration & rollout

Ordered implementation plan in vertical slices (one entity end to end before the next), starting with the entity that unblocks the most value (likely accounts + transactions). Estimate each slice in "sessions", not hours.

Phase 2 exit: `PLAN.md` complete, ADRs written. Stop. Wait for approval.

---

## 5. Phase 3 — Implementation (after approval, slice by slice)

For every slice follow `mm-add-api-endpoint` exactly:

1. OpenAPI contract for the slice (request/response schemas, examples, error cases).
2. Validation schema (zod/valibot/class-validator — whatever the stack decision was), shared with the domain package where possible.
3. Handler → service → repository; user scoping enforced in the repository layer, not in handlers.
4. Tests: unit for domain rules, integration against a real test database (no mocks of the DB), auth/scope tests, **cross-user isolation tests**, bulk/idempotency tests.
5. Docs updated (`docs/api/`), `FEATURE_CATALOG.md` row marked ✅ with the endpoint.
6. MCP tool definition updated.
7. Run `verify`, run `edition-guard`, invoke `code-reviewer`, commit.

After each slice: one-paragraph status in `PLAN.md`. Ask before starting anything that changes the DB schema.

---

## 6. Phase 4 — Documentation for humans and agents

Under `docs/api/`:

- `openapi.yaml` — OpenAPI 3.1, every operation with `operationId`, summary, description, at least one request and response example, all error responses, security requirements/scopes. Served by the backend at `/api/v1/openapi.json` and rendered at `/api/docs`.
- `README.md` (humans) — what the API is, editions, setup (user + token creation, first `GET /me`), conventions (money, dates, pagination, concurrency, errors, bulk), a "recipes" section with `curl` examples for the 10 most common tasks, changelog policy.
- `AGENTS.md` (agents — the most important file) — written as instructions to an LLM tool-user: how to authenticate, how to discover capabilities (`/openapi.json`, `/me`), the order of operations for common goals ("import a month of transactions", "classify holdings per RDPD", "compute Greenfoot metrics for a date range"), what to do on each error code, idempotency and retry rules, what must **never** be done without explicit user confirmation (bulk delete, import with overwrite), domain glossary, and worked examples with real JSON. Keep every example runnable.
- `ERRORS.md` — the error catalog (`code`, HTTP status, meaning, recommended agent action).
- `llms.txt` at the docs root pointing to the files above, so any agent that lands on the server finds its way.
- `docs/domain/` — the Greenfoot / RDPD / custom concept docs extracted in Phase 0, cleaned up: what each metric means, formula, inputs, worked example. The API docs link here instead of re-explaining.

Docs are part of the definition of done for every slice; `api-doc-auditor` enforces it.

---

## 7. Phase 5 — MCP server

- Package `apps/mcp` (or equivalent) exposing the API as MCP tools: one tool per operation group, with schemas derived from the OpenAPI spec, descriptions written for an LLM (when to use, what it returns, side effects). Include read-only "explain" tools for the domain (e.g. `explain_greenfoot_metric`) backed by `docs/domain/`.
- Configuration via environment: `MM_API_URL`, `MM_API_TOKEN`. Never accept tokens as tool arguments.
- Destructive tools require a `confirm: true` argument and say so in their description.
- Provide `.mcp.json` for Claude Code (project scope) and a documented snippet for Claude Desktop; verify against the current Claude Code docs.
- Smoke test: from Claude Code, with a fresh token, run `me` → list accounts → create a transaction → read it back → delete it. Record the transcript in `docs/api/MCP.md`.
- Fallback if MCP is not viable for a reason you discover: document the plain-HTTP workflow for a Claude chat (curl/fetch examples an agent can execute) — but try MCP first.

---

## 8. Phase 6 — Verification & handoff

- Full `verify` green; `edition-guard` green on a real Firebase build; integration tests green against a fresh database.
- `FEATURE_CATALOG.md`: 100 % of rows covered or explicitly deferred with reason.
- A new agent, given only `CLAUDE.md`, `docs/api/AGENTS.md` and a token, can complete the smoke test in §7 without asking questions. Test this with a fresh Claude Code session and fix whatever it stumbles on.
- Final summary in `PLAN.md`: what shipped, what's deferred, recommended next steps (e.g. business-account onboarding, webhooks, scheduled agent jobs).

---

## 9. Start now

Begin with **Phase 0**. Do not write or change code. First message back to me: your understanding of this prompt in five bullet points, plus anything in it that already conflicts with what you see in the repository at first glance.
