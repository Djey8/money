---
name: mm-conventions
description: Coding conventions and patterns for the Money Manager codebase (Angular frontend + Express backend) — naming, folder structure, state management, error handling, testing, and commit style, with real examples from the repo. Use before writing or reviewing any code in this project.
---

# Money Manager — coding conventions

## Frontend (Angular 20, standalone components, Jest)

- **Feature folders under `src/app/`**: `main/<feature>/` for a page, `panels/add/add-<entity>/` and `panels/info/info-<entity>/` for the create/edit dialogs of that entity (e.g. `panels/add/add-smile/`, `panels/info/info-smile/`). Follow this pairing for any new entity rather than inventing a new folder shape.
- **State**: one eager static singleton, `AppStateService.instance`, holds essentially all in-memory data (`allTransactions`, `allSmileProjects`, `mojo`, allocation ratios, etc.). Components read/write it directly rather than through NgRx or a similar store — this repo does not use a state-management library. Don't introduce one for a single feature; extend `AppStateService` consistently with its existing shape.
- **Persistence boundary**: `DatabaseService` / `PersistenceService` / `AppDataService` are the only things that should talk to the backend or Firebase. Components call these, never `fetch`/`HttpClient` directly, and never write to `localStorage` for anything that needs to sync — see `AppDataService`'s Tier 1/2/3 loading contract in `docs/discovery/DOMAIN_MODEL.md` before adding a new persisted field, since where you register it affects when it becomes available.
- **Entity linking is string-based, not ID-based**: a transaction's `category` (`@`-prefixed) matches a `tag`/`title` field elsewhere, case-insensitively, with the `@` stripped. There is no foreign key. New entities should either follow this existing convention (simplest, consistent) or, if you're extracting logic into the domain package per the current Phase 2/3 project (`PLAN.md` D-9, D-16), take the opportunity to add real validation instead of copying the string-matching pattern forward.
- **Money**: today's code is `number` (decimal float) everywhere in the frontend — this is intentional status quo per `docs/adr/0002-money-minor-units-migration.md`, not something to "fix" ad hoc. New domain-package/API code uses integer minor units; don't mix the two representations in the same function.
- **Tests**: Jest + `jest-preset-angular`, not Karma/Jasmine. Every component/service should have a `.spec.ts` beside it. Known gaps (don't assume "no spec = safe to skip" is the norm — it's a tracked gap): `subscription-processing.service.ts`, `payment-planner.service.ts`, `statement-calculations.ts`, and the ~9,000 lines of BI/analytics/chart code (`bi-dashboard.ts`, `kpi-charts.ts`, `core-charts.ts`, `predictive.ts`, `prescriptive.ts`) have no tests at all — see `docs/discovery/DOMAIN_MODEL.md` §4 item 12. Don't add to these files without at least covering your own change.
- **i18n**: every user-facing string goes through `@ngx-translate/core` with keys added to all 6 locale files under `src/assets/i18n/` (en/de/es/fr/cn/ar). Don't hardcode UI text.

## Backend (Express, CommonJS, Jest + Supertest)

- **Route files** live in `backend/routes/`, one file per resource area (`auth.js`, `data.js`, `community.js`, `logs.js`). New Pro API resources get their own route file, mounted in `server.js`.
- **Auth**: every non-public route uses the `authenticateToken` middleware (`backend/middleware/auth.js`), which sets `req.userId`/`req.userEmail`/`req.userRole`/`req.isAdmin` from the verified JWT/PAT. Never trust a `userId` from the request body or query string — always use `req.userId`.
- **Logging**: use the helpers in `backend/middleware/logging.js` (`logDatabaseOperation`, `logUserActivity`, `logSecurityEvent`) rather than raw `console.log`, so entries reach the structured Winston/Loki pipeline. `logSecurityEvent` auto-fires a webhook for a fixed set of high-severity event types — use it for anything auth/scope/security-relevant.
- **CouchDB access**: through `backend/config/db.js`'s `nano` client only. No direct HTTP calls to CouchDB from route handlers.
- **Validation**: today's `backend/routes/data.js` has essentially none (it's a generic blob store). New Pro API endpoints must validate request bodies against an explicit schema (zod/valibot — pick one and use it consistently, see `mm-add-api-endpoint`) before touching the database.
- **Tests**: `tests/unit/` (mocked DB) and `tests/integration/` (real CouchDB via `docker-compose.test.yml`). New endpoints need both.

## Commits & quality gates

- Conventional Commits (`feat|fix|docs|chore|refactor|test|ci|style|perf`), enforced by `.husky/commit-msg`. This is not just style — `auto-release.yml` reads these to auto-bump the version and auto-deploy Firebase on every push to `main`, so getting the type wrong has real consequences.
- Never bundle a refactor with a behavior change in the same commit.
- Run `npm run verify` before committing (lint + format check + typecheck + unit tests, both frontend and backend) — see `mm-code-review` for the full pre-commit checklist.
