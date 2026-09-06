# 0004. Edition separation mechanism

## Status

Accepted — `edition-guard` implemented in Phase 1 ahead of any Pro module existing

## Context

The master prompt's hard constraint: the Firebase edition must contain **no** Pro code (API, tokens, MCP, agent endpoints) — absent from the built artifact, not merely disabled (§0). The default design in §4.4 assumes Pro UI lives in lazy-loaded feature modules routed/included only under a `selfhosted` build configuration, tree-shaken out of the Firebase bundle, verified by an `edition-guard` subagent that greps a Firebase build for Pro markers.

`RISKS_AND_QUESTIONS.md` R-8 found that **no such pattern exists today**: the only thing that differs between the `firebase` and `selfhosted` Angular build configurations is `src/environments/environment*.ts`, swapped via `angular.json` file-replacement. Every route and component is present in both builds; all edition branching happens at runtime inside services (`if (environment.mode === 'firebase') ... else ...`). There is nothing to extend — this has to be built as new infrastructure.

## Decision

- Pro-only UI (token management, API status/agent pages, anything else added under this project) is placed in a new lazy-loaded route registered conditionally at the routing-config level, gated on `environment.edition === 'selfhosted'` (a build-time constant, not a runtime check) — e.g. the route array is assembled as `[...baseRoutes, ...(environment.edition === 'selfhosted' ? proRoutes : [])]` in `app.routes.ts`, so a dead-code-eliminating build genuinely never includes the Pro route's lazy chunk in a Firebase build, rather than including it and hiding it behind a runtime guard.
- The backend/API is already a separate deployable (Express, only ever deployed in the self-hosted stack) — nothing changes there; Firebase never gets a backend, consistent with today.
- `edition-guard` (Phase 1 subagent) runs `ng build --configuration firebase`, then inspects the output artifact (`dist/money`) for a documented set of Pro markers: the Pro route path string, the Pro module/chunk filename pattern, and the literal string `/api/v1`. It fails the build (and `verify`) if any marker is found.
- Because no Pro module exists yet, `edition-guard` is wired into Phase 1's `verify` script and CI now, and passes trivially (there is nothing to find) until the first Pro route is added in Phase 3. This is intentional: the guard needs to exist and be exercised (even trivially) before there's anything real to protect, so its own correctness isn't first tested under pressure.

## Consequences

- Every future Pro UI addition must go through the conditional route array, not a runtime `*ngIf`/service check alone — this is a convention Phase 1's `mm-conventions` skill and `CLAUDE.md` need to state explicitly, since the existing codebase's habit (service-level runtime branching) is exactly the pattern that must _not_ be used for anything Pro-only.
- `edition-guard`'s marker list needs to be updated every time a genuinely new class of Pro-only artifact is introduced (e.g. a new chunk naming scheme) — it's a maintained allowlist, not a one-time check.
- This does not change how the _existing_ Firebase/selfhosted runtime branching works for already-shared features (encryption config fetch, auth flow, etc.) — those continue to branch on `environment.mode` at runtime as they do today. Only genuinely Pro-exclusive surface area uses the new build-time route-exclusion mechanism.
