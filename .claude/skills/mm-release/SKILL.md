---
name: mm-release
description: How to build and deploy each Money Manager edition (Firebase, self-hosted), and the checklist that guarantees Pro code never reaches the Firebase build. Use before any release, deploy, or when asked whether it's safe to push to main.
---

# Release process

## What happens automatically — know this before you push to `main`

`.github/workflows/auto-release.yml` triggers on **every push to `main`**. If any commit since the last tag is a conventional-commit `feat`/`fix`/`perf`/breaking change, it automatically: bumps the version, updates `CHANGELOG.md`, tags, builds the **Firebase** edition, and deploys it live via `FirebaseExtended/action-hosting-deploy@v0` — no manual approval gate. A `chore`/`docs`-only push does not trigger a release. This means:

- Never push directly to `main` without confirming with JFK first (per this repo's global "ask before" rules) — a push can mean a live production deploy within minutes.
- Get the commit type right. A `feat`/`fix` commit for something that shouldn't ship yet will deploy it.

## Building each edition

| Edition | Command | Config swapped in |
|---|---|---|
| Firebase | `npm run build` (= `ng build --configuration firebase`) | `src/environments/environment.production.ts` — `mode: 'firebase'`, live Firebase config |
| Self-hosted | `npm run build:selfhosted` | `src/environments/environment.selfhosted.ts` — `mode: 'selfhosted'`, `apiUrl: '/api'` |

Both configurations are defined in `angular.json`; the only thing that differs today is the environment file via `fileReplacements` (see `docs/discovery/ARCHITECTURE.md` §2-3 for the full pipeline diagrams).

## Self-hosted deploy

- Docker Compose (simplest): `docker-compose up -d` — 3 containers (CouchDB, backend, frontend). Add `-f docker-compose.logging.yml` on top only when actively debugging (it roughly doubles memory usage).
- K3s: `./scripts/deploy.sh` (Linux/Pi) or `./scripts/deploy-local.ps1` (Windows/WSL). Presets: `--prd` (`--no-cache --no-logging`), `--dev` (`--no-cache`, logging on). Full flag reference: `docs/DEPLOYMENT.md`.
- Backups run automatically via `k8s/backup-cronjob-{hourly,daily}.yaml`; manual backup/restore/list scripts are in `scripts/`.

## The Pro-code-never-reaches-Firebase checklist

Run this before merging anything that touches routing, a new feature module, or the API client:

1. **Build the Firebase edition**: `ng build --configuration firebase`.
2. **Run (or trust CI's) `edition-guard` subagent** against `dist/money` — it greps the built artifact for the documented Pro markers (Pro route path, Pro module/chunk name, the literal string `/api/v1`) and fails if any are present. See `docs/adr/0004-edition-separation-mechanism.md` for exactly what it checks and why a runtime `*ngIf` is not sufficient — Pro-only UI must be excluded via the conditional route array (`environment.edition === 'selfhosted'`) at build time, not hidden at runtime.
3. If `edition-guard` fails: the fix is almost always that new Pro UI was added to a route/module that's included in both build configurations. Move it behind the conditional route array; do not "fix" it by hiding it with a runtime check.
4. This check has nothing to verify yet until the first Pro module exists (early Phase 3) — that's expected, not a bug in the guard.

## Versioning

Version lives in `package.json`, kept in sync with `backend/package.json`. Conventional Commits drive automatic version bumps (see above). Manual equivalents exist in `scripts/version-bump.ps1`, `scripts/auto-bump.ps1`, `scripts/changelog.ps1` if you need to bump without pushing to `main` first.
