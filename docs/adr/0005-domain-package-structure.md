# 0005. Domain package structure and sharing mechanism

## Status

Accepted

## Context

Master prompt §4.1 requires business logic needed by both the Angular UI and the backend to live in a framework-agnostic TypeScript package, and explicitly asks: "if the backend is not TypeScript, propose how to share the rules without duplication... and flag it as a decision." The self-hosted backend is plain Node/Express, CommonJS, not TypeScript (`ARCHITECTURE.md` §5). The repo is a single Angular application, not an existing monorepo/workspace (`ARCHITECTURE.md` §1) — there is no existing multi-package build pipeline to extend.

The logic that needs to move here is substantial and, per `DOMAIN_MODEL.md` §2/§4, partly duplicated and partly buggy: Barefoot allocation (`AppStateService.getAmount`), Mojo/bucket capping, Smile/Fire bucket totals, Grow buy/sell/dividend/payback/P&L, the financial statement/balance sheet/KPI calculations, the `CrypticService` v2 crypto (ADR-0001), and the future minor-units money conversion (ADR-0002).

## Decision

**The backend does not need to become TypeScript.** A compiled TypeScript package can be `require()`d from plain CommonJS Node code exactly like any other npm dependency — there is no genuine cross-language sharing problem here (contrast with, say, a Python or Go backend, where the master prompt's "spec + golden test vectors" fallback would actually be necessary). That fallback is not needed for this project.

- New package: `packages/domain/`, TypeScript, zero Angular imports, zero Express imports — pure functions and framework-agnostic classes only.
- Wired in via **npm workspaces**: root `package.json` gains a `"workspaces": ["packages/domain"]` entry; `backend/package.json` and the root Angular app both depend on `"@money/domain": "*"` resolved locally through the workspace (no publishing to a registry, ever, for this internal package).
- Build: `tsc` compiles `packages/domain/src` to CommonJS `packages/domain/dist` with `.d.ts` type declarations. Both consumers get typed, compiled JS:
  - Backend `require('@money/domain')` — completely normal CommonJS consumption, zero backend code changes needed to "become TypeScript."
  - Angular imports it as a regular TypeScript-aware dependency; the esbuild-based `application` builder (already in use, `ARCHITECTURE.md` §1) resolves and bundles workspace packages the same as any `node_modules` dependency.
- The package gets its own Jest test suite (`packages/domain/src/**/*.spec.ts`), run as part of `npm run verify`, and is the **single canonical implementation** — Angular services and Express routes both call into it rather than each having their own copy.
- Build ordering: `packages/domain` must build before the frontend build and before the backend starts, so a `pretsc`/`prebuild` step (or the root `verify`/`build` scripts) build `packages/domain` first. CI and local dev both need this step made explicit.

## Extraction order

Per `PLAN.md`'s slice plan (D-20), extraction happens together with each slice's API work, not as one big upfront move — starting with what slice 0/1 need:

1. **Slice 0 prerequisites**: `CrypticService` v2 port (ADR-0001), money minor-units conversion utilities (ADR-0002), the Grow comment-DSL parser/generator rewritten with real validation (ADR-0003/D-16).
2. **Barefoot allocation**: `getAmount()`-equivalent, Mojo cap (consolidating the 3 duplicate copies per `DOMAIN_MODEL.md` §4 item 6), Splurge/Daily/Smile/Fire bucket math.
3. **Smile/Fire bucket totals**: one canonical implementation (Smile currently has none at all, Fire has a half-duplicated one — `DOMAIN_MODEL.md` §4 items 3-4).
4. **Financial statement / balance sheet / KPI calculations**: `statement-calculations.ts` and the relevant parts of `stats-calculations.ts`, kept as **two** distinctly-named exports per `PLAN.md` D-7 (not merged).
5. **Grow P&L and typed buy/sell/dividend/payback/cashflow actions** (D-16), including keeping the denormalized `Grow.share/investment/liabilitie` copy in sync with the top-level arrays.
6. **Subscription frequency calculators**: already clean (Strategy pattern) — a comparatively low-risk, almost mechanical move, good to do early to validate the workspace/build plumbing on something low-stakes before tackling the messier areas above.

Each extraction follows `PLAN.md` D-9's cycle: characterization tests on current behavior → extract → fix/consolidate known bugs and duplicates → update tests to the corrected behavior with a documented rationale.

## Consequences

- No backend rewrite to TypeScript — the lowest-risk path that still gives single-source-of-truth domain logic.
- A new build step (compile `packages/domain` first) is added to local dev, `verify`, and CI — small but real onboarding/tooling surface area; document it in `CLAUDE.md`'s run/build table once slice 0 lands.
- The Angular frontend's existing service methods (`AppStateService.getAmount`, `IncomeStatementService.recalculate`, etc.) are refactored to call into `@money/domain` rather than containing the logic inline — this is itself a behavior-preserving refactor per entity, done as its own commit per `mm-conventions`' "never bundle a refactor with a behavior change" rule, verified by the characterization tests from the extraction cycle above.
- `packages/domain` becomes the one place that needs updating when a calculation's definition changes — directly closing the duplication problems cataloged in `DOMAIN_MODEL.md` §4.
