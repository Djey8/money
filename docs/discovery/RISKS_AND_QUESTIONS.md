# Risks & Open Questions

## A. Technical debt that Phase 2/3 will have to fight

**R-1. There is no per-entity backend to extend — Phase 2's API design starts from zero, not from refactoring.**
`backend/routes/data.js` is a generic path-addressed JSON-blob store (see `FEATURE_CATALOG.md`). Every entity's schema, validation, and CRUD semantics live client-side, in Angular components, encoded as calls like `writeObject('transactions', array)`. Building `/api/v1/transactions` means writing the entity's server-side model, validation, and repository layer for the first time — the existing backend gives no head start beyond authentication and the Community feature. This changes the Phase 2 estimate: §4.7's "vertical slice" plan should budget full-stack work per entity, not "wire up an existing model."

**R-2. Client-side AES encryption is user-toggleable and opaque to the server when enabled — this collides with several Pro API requirements.**
`CrypticService` (`src/app/shared/services/cryptic.service.ts`) has an `encryptDatabase` flag (user-controlled, off by default). When on, every value written to CouchDB is ciphertext the backend cannot parse. This directly conflicts with:

- §4.2 "every list endpoint supports filtering, sorting" — impossible server-side on encrypted fields.
- §4.2 "audit log of ... what" — the backend can log _that_ a write happened and to which path, but not _what changed_, when encryption is on.
- §4.1 "shared domain logic... consumed by both the Angular app and the backend" — domain calculations (Greenfoot/RDPD/Grow P&L) need plaintext numbers; a shared package can't run server-side against encrypted data.
- The monetization plan in `todo/monertarize.md` explicitly recommends the _opposite_ direction: making the **hosted SaaS** version client-side-encrypted "so even you cannot read user transactions" as a deliberate privacy/legal moat (§6.3, §10.2 of that document). A Pro API that requires plaintext access for filtering/audit is in tension with that stated business strategy for a _hosted_ multi-tenant offering, even though the master prompt scopes Pro features to self-hosted only.

**Recommendation for the ADR this needs**: scope the Pro API's filtering/sorting/audit guarantees to apply when `encryptDatabase` is off (the default), document that turning database encryption on trades those Pro capabilities away, and treat this as an explicit user-facing tradeoff rather than something the API silently degrades on. This preserves both the master prompt's API requirements and the zero-knowledge option from `todo/monertarize.md` for users who want it.

**R-3. Money is stored as floats today; the ISO-4217 minor-units migration in §4.2 is real, not contingent.**
Confirmed in `backend/DATABASE_STRUCTURE.md`'s own examples (`"amount": 100.50`) and throughout the domain model (`Transaction.amount: number`, `Share.price: number`, etc.). No entity anywhere uses integer cents. This migration touches every entity, the encryption layer (which encrypts stringified values), CSV export/import, and the financial-statement/statistics calculations — it is the single largest cross-cutting change implied by §4.2 and should be its own early vertical slice or a prerequisite to the first one, not bundled into whichever entity is picked first.

**R-4. There is already a working, philosophically different "AI integration" in the codebase — the master prompt's MCP/agent plan needs to be reconciled with it, not built alongside it unremarked.**
`src/app/panels/ai-assistant/` + `src/app/shared/services/prompt-generator.service.ts` implement (per `todo/ai.md`, and confirmed present in the working tree) a **client-side-only, copy-paste prompt generator**: it builds an anonymized-by-default text prompt from the user's financial snapshot, the user pastes it into any external LLM, and pastes the JSON response back in to import as Grow/Smile/Fire projects. There is **no HTTP call to any AI API** — this is the app's entire current "AI" story, and it's explicitly marketed (in `todo/monertarize.md`) as a privacy differentiator: _"the only personal finance app that turns your data into AI strategies without ever sharing it with us."_

The master prompt's MCP server is the opposite shape: an agent with a token gets **direct read/write API access to real financial data**, no anonymization, no copy-paste step. Both can coexist (MCP is self-hosted-only and explicitly opt-in per the master prompt's auth model), but:

- The anonymization-by-default principle from `todo/ai.md` §0 ("no exact amounts unless the user explicitly opts in") has no analogue in the MCP design as specified. Worth deciding whether MCP tools should offer an anonymized-response mode, or whether "self-hosted + PAT you control" is considered sufficient consent to skip that principle for MCP specifically.
- `docs/api/AGENTS.md` (Phase 4) should probably cross-reference the existing prompt-generator feature so a human reading both doesn't conclude the app has two competing, undocumented AI stories.

**R-5. The domain layer has real, currently-shipping correctness bugs and duplicated logic that Phase 2's "extract shared domain logic" (§4.1) will otherwise propagate into the API.**
Full detail in `DOMAIN_MODEL.md` §4. Highlights:

- A live bug: `SplurgeComponent` (`splurge.component.ts:91`) uses the `daily` ratio instead of `splurge` when recomputing the Splurge balance on refresh.
- Two independently-computed "Savings Rate" formulas (`stats-calculations.ts` vs. `statement-calculations.ts`) that use different income aggregation and can legitimately disagree for the same period — an API exposing "savings rate" as a read endpoint (§4.2, "calculations get read endpoints of their own") needs to pick one, and that's a product decision, not just a refactor.
- Smile bucket totals are recomputed ad hoc in ~7-10 different files with no shared helper (Fire has a _partial_ shared helper, itself duplicated 4 ways).
- The entire Grow buy/sell/dividend/payback/cashflow flow works by writing a magic-prefixed sentence into `Transaction.comment` and parsing it back out by `split(" ")` array index, with no schema validation — this is the actual "business logic" behind Grow's P&L, and it is fragile (unchecked `NaN` propagation on a malformed comment) and largely untested (`grow.component.spec.ts` doesn't cover it).
- ~9,000 lines of BI/analytics/statistics code (`bi-dashboard.ts`, `kpi-charts.ts`, `core-charts.ts`, `predictive.ts`, `prescriptive.ts`) have **no test coverage at all**.

**Recommendation**: §4.1's domain-package extraction should explicitly budget time to consolidate the duplicated bucket-total/savings-rate/Mojo-cap logic and add tests _during_ extraction, not treat extraction as a mechanical lift-and-shift. Extracting buggy, duplicated logic into a shared package just gives the bug an API surface.

**R-6. `backend/DATABASE_STRUCTURE.md` documents roughly half the real schema.**
It shows `data.{info, transactions, smile, fire, mojo}` as the complete shape. The actual frontend also writes `income/expenses/{daily,splurge,smile,fire,mojo}`, `income/revenue/{interests,properties,revenues}`, `balance/asset/{assets,shares,investments}`, `balance/liabilities`, `subscriptions`, `budget`, `grow` — and none of these paths, nor the tiered lazy-loading contract in `AppDataService` (Tier 1/2/3, see `DOMAIN_MODEL.md`), are documented anywhere. Anyone (agent or human) building the Phase 2 endpoint matrix from that doc alone would miss roughly half the entities.

**R-7. No linter exists — §3.4's "make lint runnable" is a from-scratch task, not a wiring task.**
No ESLint/Prettier config or dependency anywhere in the repo (confirmed by direct inspection, not inference). `lint-staged` currently runs targeted tests, not a linter. This is a small but real scope item for Phase 1 — a linter needs to be chosen, configured, and its ruleset agreed (e.g. does it also need `eslint-plugin-security`, mentioned as a CI TODO in `todo/security.md` §14).

**R-8. Edition separation today is a runtime service-layer switch, not a build-time module split — §4.4's "lazy-loaded feature modules only included under selfhosted" has no existing pattern to extend.**
Confirmed by both the architecture and feature-catalog research: the only thing that differs per build is `src/environments/environment*.ts` (via `angular.json` file-replacement). No route or component is routed/imported only under one configuration; all mode branching happens inside services (`if (mode === 'firebase') ... else ...`). The one Pro-relevant UI surface today (a cosmetic edition badge in Settings) is a template conditional, not a module boundary. §4.4's default design is sound, but it needs to be built as new infrastructure, and the `edition-guard` subagent (Phase 1) has no existing tree-shaking behavior to verify against yet — it will need a real Pro module to exist first before it can meaningfully fail a build.

**R-9. E2E tests are wired up but disabled in CI.** `.github/workflows/test.yml`'s `e2e` job has `if: false` ("Temporarily disabled"). This means the only CI-enforced tests today are frontend/backend unit + backend integration (all passing, confirmed live in this session: 776+69 unit tests, plus a separate integration suite requiring a live CouchDB not run in this environment). Any Pro API work that depends on full user-journey correctness (e.g. the §7 MCP smoke test) will be exercised locally at best until this is re-enabled — worth deciding whether re-enabling E2E is a Phase 1 prerequisite or can wait.

## B. Security observations

The self-hosted stack has already been through a thorough internal security audit (`todo/security.md`, dated 2026-04-20) whose fixes I spot-checked and **confirmed present in the current code** — httpOnly cookies with SameSite=Strict, refresh-token rotation with server-side revocation, CSP/HSTS headers in `nginx.conf`, account lockout, PBKDF2-SHA256+HMAC encryption, secrets moved out of git, CouchDB admin proxy removed, CI security-audit/Trivy/gitleaks/SBOM jobs all present and passing. This repo is materially more security-mature than a first-glance "no linter, no PLAN.md" read would suggest. Two items remain open by that audit's own accounting and are worth carrying into Pro API design:

- **M3 (email verification)** — intentionally skipped by design ("fake accounts are a feature" per the audit's own note). Relevant because §4.3's PAT/user-setup flow should decide whether an unverified email is acceptable for an account that can also mint API tokens.
- **API authorization is "no secondary ownership check beyond `userId` from JWT"** (`todo/security.md` §10, marked ⚠️ WARN, not a blocker) — worth confirming the same pattern (trust the token's `userId`, no additional check) is sufficient once PAT scopes are introduced, since a scope-check bug would have a larger blast radius than today's single-blob read/write.
- Nothing new and CRITICAL/HIGH was found in this discovery pass beyond what that audit already tracked — I did not attempt a fresh security audit as part of Phase 0 (out of scope; `security-review` skill exists separately if wanted before Phase 3 implementation begins).

## C. Numbered open questions for JFK

1. **"Greenfoot Investor" and RDPD "cash-flow quadrants" — do these exist anywhere I haven't found, or should they be dropped from scope?** `grep -ri "greenfoot"` and `grep -i quadrant` across `src/` return zero matches. The closest implemented analogue to "Greenfoot Investor" is the `Grow` feature (buy/sell/dividend/payback/P&L for shares/investments/assets), but nothing in code confirms that mapping. **Recommendation**: confirm the Grow↔Greenfoot mapping so `docs/domain/` can document it correctly, and decide whether "cash-flow quadrant" is a real planned feature (in which case it needs a design) or should be dropped from the master prompt's scope as aspirational-but-never-built.

2. **How should the Pro API treat `encryptDatabase`-enabled accounts?** See R-2. **Recommendation**: Pro filtering/sorting/audit-detail apply only when database encryption is off; document this as a user-facing tradeoff rather than silently degrading. Confirm this matches your intent for the self-hosted Pro offering.

3. **Should the MCP/agent design incorporate the existing anonymization-by-default principle from `todo/ai.md`, or is a self-hosted PAT considered sufficient user consent to skip it?** See R-4. **Recommendation**: skip it for MCP (a self-hosted token the user explicitly minted is a stronger consent signal than a copy-paste prompt), but say so explicitly in `docs/api/AGENTS.md` so the two AI stories don't read as contradictory to a future reader.

4. **Which of the two disagreeing "Savings Rate" formulas should the API's canonical read endpoint use** (`stats-calculations.ts`'s KPI-dashboard version vs. `statement-calculations.ts`'s financial-statement version — see R-5, `DOMAIN_MODEL.md` §4 item 5)? This is a product decision I can't make unilaterally; it likely also means picking one and visibly reconciling the other in the UI as a follow-up, not just in the new API.

5. **Is re-enabling the disabled Playwright E2E CI job (`test.yml`, `e2e: if: false`) in scope for Phase 1's quality-gates work, or should it stay deferred?** Low effort either way but affects the Phase 1 estimate.

6. **Should Phase 2's domain-package extraction (§4.1) explicitly include fixing the known duplicated/buggy logic in R-5, or should that be tracked as separate follow-up work after the API ships against the current (buggy) behavior?** My recommendation is to fix during extraction — shipping an API on top of the Splurge-ratio bug or the ungoverned Smile-bucket-total duplication just gives those bugs a stable, harder-to-change surface — but this affects the Phase 2 time estimate materially and is your call.

7. **`todo/monertarize.md` recommends AGPLv3 open-core licensing and migrating the hosted SaaS off Firebase entirely.** Neither is in scope of this master prompt, but both would materially change the edition-separation and licensing constraints in §1 ("ask before adding a dependency with a license other than MIT/Apache-2.0/BSD/ISC") if pursued later — worth a one-line confirmation that this agent-readiness/API/MCP work should proceed independently of that monetization plan for now, with the ADRs written so they don't foreclose it later.

## D. Documents outside this discovery's scope

`todo/uni.md`, `todo/game.md`, and `todo/marketing.md` were listed in the `todo/` directory but not reviewed in depth for this discovery — they didn't appear directly relevant to agent-readiness/API/MCP scope on a title-level pass. Flagging their existence in case they contain constraints I should know about; happy to review on request.
