# Money Manager

Personal finance app built on the Barefoot Investor method (Daily/Splurge/Smile/Fire/Mojo accounts) plus a Rich-Dad-Poor-Dad-style investment tracker ("Grow"). Two independent editions from one Angular codebase: **Firebase** (free, UI-only trial — Firebase Auth + Realtime DB) and **self-hosted** (full product — Express + CouchDB, own server). See `docs/MASTER_PROMPT.md` and `PLAN.md` for the active agent-readiness/Pro-API/MCP project and its decisions.

## Edition model — read this before touching auth, storage, or routing

- Firebase edition ships **zero** Pro code — not disabled, absent from the built artifact. Never add a Pro feature (API client code, token UI, agent endpoints) without gating it through the build-time mechanism in `docs/adr/0004-edition-separation-mechanism.md` (conditional route array on `environment.edition`, never a runtime `*ngIf`).
- The two editions do not sync. Firebase↔self-hosted data movement is a manual one-time JSON export/import a user triggers themselves (`docs/SELFHOSTED.md`). Don't assume shared state between them.
- Mode/edition branching for already-shared features stays as today's pattern: `if (environment.mode === 'firebase') ... else ...` inside services (`auth.service.ts`, `database.service.ts`, `cryptic.service.ts`).

## Repo map

```
src/app/            Angular frontend (routes: main/, panels/, stats/, community/, registration/, landing/)
src/app/interfaces/ Entity type definitions (also the de facto persistence schema — no ORM)
src/app/shared/services/  Business logic: allocation math, encryption, subscriptions, income statement
backend/             Express API + CouchDB integration (self-hosted only)
backend/routes/      auth.js (real logic), community.js (real logic), data.js (generic blob store), logs.js
k8s/, docker-compose*.yml   Self-hosted deployment
scripts/             Deploy/backup/version-bump tooling
docs/                Human + agent docs; docs/discovery/ is Phase 0 findings, docs/adr/ is architecture decisions
todo/                Internal planning docs — several are historical/completed, not current instructions
```

## How to run / build / test

| Task | Command |
|---|---|
| Dev server (Firebase mode) | `npm start` |
| Build Firebase edition | `npm run build` |
| Build self-hosted edition | `npm run build:selfhosted` |
| Frontend unit tests | `npm test` |
| Backend unit tests | `npm run test:backend:unit` |
| Backend integration tests (needs CouchDB) | `cd backend && npx jest -- tests/integration` |
| E2E (Playwright) | `npm run test:e2e` |
| Everything frontend+backend unit | `npm run test:all` |
| One-shot quality gate | `npm run verify` (see `mm-conventions` skill for what it runs) |
| Self-hosted stack locally | `docker-compose up -d` (see `docs/SELFHOSTED.md`) |

Install deps first if `node_modules` is missing: `npm ci --legacy-peer-deps` (root, needs the flag) and `cd backend && npm ci` (no flag needed).

## Conventions

- **Money**: today's code uses decimal floats everywhere (`amount: number`). New v1 API/domain-package code uses integer minor units + ISO-4217 code per `docs/adr/0002-money-minor-units-migration.md` — do not add new float-based money handling to that code.
- **Entities are keyed by string, not ID**: `Transaction.category` (`@`-prefixed) matches `tag`/`title` on Revenue/Interest/Property/Share/Investment/Liability/Grow/Smile/Fire case-insensitively. There are no foreign keys. See `docs/discovery/DOMAIN_MODEL.md` §1/§4 before changing anything that touches this matching.
- **Never write to `Transaction.comment` as a DSL by hand** (the `"Buy Share X 10 x 25;"` pattern). It's fragile, unvalidated, and being replaced by explicit typed actions for the API (`docs/adr/0003-api-ui-write-consistency.md`, D-16 in `PLAN.md`). If you must touch it, use the parsing/generation helpers being centralized in the domain package, not `split(" ")`.
- **Known misspellings are canonical, not typos**: `liabilitie(s)`, `allIntrests`, `Mortage` appear consistently across interfaces, variables, i18n, and folder names (`add-liabilitie/`). Match existing spelling in code you touch; don't silently "fix" it as a drive-by.
- **Duplicated logic**: Smile/Fire bucket totals and Mojo-cap logic are each reimplemented in several places (`docs/discovery/DOMAIN_MODEL.md` §4). When fixing a bug in one copy, check whether the others need the same fix, or better, consolidate into the domain package per `PLAN.md` D-9.
- **Commits**: Conventional Commits, enforced by `.husky/commit-msg` (`feat|fix|docs|chore|refactor|test|ci|style|perf`). Small, reviewable, one concern per commit — never bundle a refactor with a behavior change (this repo's `auto-release.yml` also reads commit messages to auto-version and auto-deploy Firebase on push to `main`, so a wrong type has real consequences).
- **Language**: English in code, identifiers, commits, docs. Domain terms already in German in the codebase stay as-is (documented in `docs/discovery/DOMAIN_MODEL.md` §3 glossary), don't translate them.

## Ask before

- Changing the CouchDB/Firebase data schema or any storage path.
- Changing the Firebase build/deploy config (`angular.json` firebase configuration, `firebase.json`, `auto-release.yml`) — a push to `main` with a conventional commit auto-deploys to production.
- Deleting or renaming public files.
- Adding a dependency with a license other than MIT/Apache-2.0/BSD/ISC.
- Anything destructive (see global git-safety rules).
- Running the money-migration tool (`mm-admin migrate`) against anything but a test/restored copy of data.

## Pointers

- `docs/MASTER_PROMPT.md` — the active project brief (agent-readiness, Pro API, MCP).
- `PLAN.md` — decisions log and phase status, the single source of truth for scope.
- `docs/adr/` — one ADR per non-trivial architecture decision.
- `docs/discovery/` — Phase 0 findings: `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, `FEATURE_CATALOG.md`, `RISKS_AND_QUESTIONS.md`.
- `docs/SELFHOSTED.md`, `docs/DEPLOYMENT.md` — self-hosted setup and deploy-script flag reference.
- `backend/DATABASE_STRUCTURE.md` — CouchDB storage paths and the frontend's tiered-loading contract.
- Skills: `mm-conventions`, `mm-add-api-endpoint`, `mm-domain-rules`, `mm-release`, `mm-code-review` under `.claude/skills/`.
