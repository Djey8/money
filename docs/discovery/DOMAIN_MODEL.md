# Domain Model

There is **no ORM or database schema layer**. TypeScript interfaces under `src/app/interfaces/` double as the persistence contract, and the actual persisted JSON is whatever `JSON.stringify()` of the relevant `AppStateService` field produces, written to a path in the generic blob store (see `FEATURE_CATALOG.md` and `ARCHITECTURE.md`). All schema, validation, and business rules therefore live entirely in the Angular frontend today.

## 1. Entities

### `TaggedAmount` — base shape
`{ tag: string; amount: number }` (`src/app/interfaces/tagged-amount.ts`). Composed into most simple ledger-style entities:

| Entity | Extra fields | Meaning | Persisted at |
|---|---|---|---|
| `Asset` | — | Physical asset (e.g. "Gold", "Car") | `balance/asset/assets` |
| `Expense` | — | Per-category running total inside `dailyExpenses`/`splurgeExpenses`/etc. — a derived reporting aggregate, **not** a transaction | derived, cached in `AppStateService` |
| `Interest` | — | Misnamed: represents interest/dividend-bearing **revenue** sources, not loan interest | `income/revenue/interests` |
| `Property` | — | Rental/property income aggregate | `income/revenue/properties` |
| `Revenue` | — | Generic income aggregate (fallback bucket for untagged income) | `income/revenue/revenues` |
| `Investment` | `deposit: number` | Real-estate-style investment: `amount` = mortgage/loan-financed value, `deposit` = own cash | `balance/asset/investments` |
| `Liability` | `investment: boolean; credit: number` | `amount` = principal owed, `credit` = interest/credit cost, `investment` flags whether it funds an investment vs. a personal debt | `balance/liabilities` |
| `Budget` | `date: string` | One planned amount per category per month | `budget` |

These are linked to `Transaction.category` and `Grow.title` **only by case-insensitive string equality of `tag`/`title`** with an `@` prefix convention — there are no numeric/UUID foreign keys anywhere in this data model (see §4 below for the consequences).

### `Share`
`{ tag: string; quantity: number; price: number }` (`share.ts`). Value = `quantity * price`, recomputed ad hoc at every call site — no single `getShareValue()` helper exists. Persisted at `balance/asset/shares`.

### `Transaction` — the single source of truth
```ts
{ account: string; amount: number; date: string; time: string; category: string; comment: string }
```
Almost every derived number in the app (balances, income statement, budget actuals, Smile/Fire bucket fill levels, Mojo balance, KPI charts) is computed by replaying this array. Persisted at `transactions` (tier 1, loaded eagerly). Conventions enforced only by string-matching, not the type system:

- `account` ∈ `{Income, Daily, Splurge, Smile, Fire, Mojo}` (plus transient arbitrary values).
- `category` is empty or **`@`-prefixed** (e.g. `@Salary`, `@SummerHoliday`, `@Mojo`), matched (lower-cased, stripped) against `tag`/`title` fields of `Revenue`/`Interest`/`Property`/`Share`/`Investment`/`Liability`/`Grow.title`/`Smile.title`/bucket titles to route the transaction's effect.
- `comment` doubles as a **hand-parsed structured side-channel** — a mini DSL embedded in a free-text field. Literal prefixes like `"Buy Asset "`, `"Buy Share "`, `"Buy Investment "`, `"Sell Asset "`, `"Sell Share "`, `"Sell Investment "`, `"Payback Liabilitie "`, `"CASHFLOW "`, `"Dividende Share "`, and bucket-allocation tags `#bucket:<BucketName>:<Amount>` (parsed by `IncomeStatementService.parseTransactionBucketAllocations`, `src/app/shared/services/income-statement.service.ts:29-49`). See §4 item 8 for why this is fragile.

### `Subscription` / `PlannedSubscription`
`Subscription`: `{ title, account, amount, startDate, endDate, category, comment, frequency: SubscriptionFrequency, changeHistory? }`, `SubscriptionFrequency = 'weekly'|'biweekly'|'monthly'|'quarterly'|'yearly'`. `SubscriptionChange` records field-level history with `effectiveDate`.

`PlannedSubscription` is a richer variant that auto-funds Smile/Fire **buckets**: adds `projectType: 'smile'|'fire'`, `projectTitle`, `targetDate`, `targetBucketIds` (`[]` = smart-allocate across all buckets), `originalCalculatedAmount`, `manuallyAdjusted`, lifecycle `status: 'planned'|'active'|'inactive'`, `activeSubscriptionId`. Nested **inside** `Smile.plannedSubscriptions` / `Fire.plannedSubscriptions`, not a top-level collection. Persisted at `subscriptions` (tier 1).

### `Smile` / `Fire`
Nearly identical (duplicated) shapes:
```ts
{ title, sub, phase: 'idea'|'planning'|'saving'|'ready'|'completed', description,
  targetDate?, completionDate?,
  buckets: SmileBucket[] /* FireBucket[] */,  // required, ≥1
  links: [], actionItems: [], notes: [],
  createdAt, updatedAt, plannedSubscriptions?: PlannedSubscription[] }
```
`SmileBucket`/`FireBucket`: `{ id, title, target, amount, notes?, links?, targetDate?, completionDate? }`. The top-level project **has no stored total** — it's always derived from buckets, re-derived independently in ~7-10 places (§4 items 3-4). Persisted at `smile` / `fire` (tier 2, deferred load). Legacy pre-bucket data auto-migrates via `smile-migration.utils.ts` / `fire-migration.utils.ts` (wraps a flat `target`/`amount` into one "Main Goal" bucket).

### `Mojo`
`{ target: number; amount: number }` — singleton, not an array. The Barefoot "peace of mind" emergency buffer. Capped so it never exceeds `target` (cap logic duplicated 3×, §4 item 6). Category tag `@Mojo` routes income here directly, bypassing the Daily/Splurge/Smile/Fire split. Persisted at `mojo` (tier 2).

### `Grow` — richest entity, two representations of the same money
```ts
{ title, sub, phase: GrowPhase, description, strategy, riskScore, risks,
  cashflow, amount, isAsset: boolean,
  share: Share, investment: Investment, liabilitie: Liability,
  type?, category?, currentCost?, targetCost?, monthlySavings?, annualSavings?,
  reasoning?, alternative?, alternativeCost?, pattern?, insights?, status?,
  createdAt, updatedAt }
```
Note: the field is spelled `liabilitie` (not `liability`) consistently throughout the whole codebase — interfaces, variables, comments, i18n, even component folder names (`add-liabilitie`, `info-liabilitie`). Treat this as the canonical spelling in this codebase, not a typo to silently "fix."

`Grow.share`/`Grow.investment`/`Grow.liabilitie` are **denormalized copies** written at creation time (`add-grow.component.ts:330-338`). The actual balance-affecting records live in separate top-level arrays (`allShares`, `allInvestments`, `liabilities`, `allAssets`), linked to the `Grow` project only by `tag === title` string matching — two representations of "the same investment" kept in sync by hand (§4 item 7). Persisted at `grow` (tier 3, on-demand load).

### `Profile` (`interfaces/profile.ts`)
`{ info: {email, username}, transactions, smile, fire, mojo }` — **stale**: omits `grow`, `subscriptions`, `budget`, `allAssets/allShares/allInvestments/liabilities`, and the income-statement arrays entirely. Do not treat this as the canonical shape of user data — the real shape is whatever `AppStateService` holds.

### Central runtime state: `AppStateService`
`src/app/shared/services/app-state.service.ts` — an eager static singleton (`AppStateService.instance`) that is the actual in-memory "database" the whole app reads and writes. Fields: `allTransactions`, `allSubscriptions`, `allRevenues`, `allIntrests` (sic — consistent misspelling of "Interests"), `allProperties`, `dailyExpenses/splurgeExpenses/smileExpenses/fireExpenses/mojoExpenses`, `allAssets`, `allShares`, `allInvestments`, `liabilities`, `allBudgets`, `allGrowProjects`, `allSmileProjects`, `allFireEmergencies`, `mojo`, and the allocation ratios `daily=60.0, splurge=10.0, smile=10.0, fire=20.0`.

### Persistence paths actually written
`backend/DATABASE_STRUCTURE.md`'s examples (`info`, `transactions`, `smile`, `fire`, `mojo`) are a **simplified subset of the real schema**. The frontend writes many more nested paths:

```
transactions, subscriptions, smile, fire, mojo, budget, grow,
info/username, info/email,
income/expenses/{daily,splurge,smile,fire,mojo},
income/revenue/{interests,properties,revenues},
balance/asset/{assets,shares,investments},
balance/liabilities
```

These map 1:1 onto CouchDB/Firebase paths per the documented path convention (`a/b/c` → `data.a.b.c`). `AppDataService` (`src/app/shared/services/app-data.service.ts:47-63`) formalizes a **tiered lazy-loading contract** not documented anywhere else:

- **Tier 1** (blocks UI): `transactions`, `subscriptions`, `income/revenue/*`, `income/expenses/*`
- **Tier 2** (deferred, async after render): `smile`, `fire`, `mojo`, `budget`
- **Tier 3** (on-demand, loaded when the user navigates there): `grow`, `balance/asset/*`, `balance/liabilities`

Anyone building an API/agent layer directly from `DATABASE_STRUCTURE.md` alone would miss roughly half the real schema and the loading-tier semantics.

## Invariants found in code

- **Title uniqueness** across Smile/Fire/Grow projects: `isDuplicateTitle()` (`src/app/shared/validation.utils.ts:8-10`).
- **Allocation percentages must sum to 100%** — enforced only in `SettingsComponent.updateSettings()` (`settings.component.ts:1756-1778`), not in `AppStateService` itself, so nothing stops an out-of-band write from violating it.
- **Bucket amounts capped at `bucket.target`**, never allowed to overshoot, in `IncomeStatementService.recalculate()` — overflow is either dropped (Mojo, with a `console.warn`) or the transaction amount is silently rewritten to match what was actually applied (Smile bucket comment-tag rewrite).
- **Mojo cannot exceed its `target`** — the identical cap check is duplicated in three separate files (§4 item 6).

## 2. Where business logic lives

### Barefoot Investor account allocation (60/10/10/20 split)
- Defaults: `AppStateService.daily/splurge/smile/fire = 60/10/10/20`.
- User override + validation: `SettingsComponent.updateSettings()`, persisted to `localStorage` (`dailyR/splurgeR/smileR/fireR`).
- **Core formula**: `AppStateService.getAmount(account, p)` — for each transaction, if `account` matches the target bucket, add its amount; if the transaction's account is `"Income"`, add `round(amount * p, 2)`. This one function is the entire automatic-split mechanism.
- Runs in the browser (plain TS class). **Has a spec** (`app-state.service.spec.ts`, dedicated `getAmount()` block).
- There is **no automatic overflow-forwarding** from a full Fire bucket to Mojo — money simply stops being absorbed once a bucket is full; the Barefoot "overflow to long-term wealth" idea is not implemented as such.

### Greenfoot Investor calculations
`grep -ri "greenfoot"` across `src/` returns **zero matches**. The term appears only in `docs/MASTER_PROMPT.md` — never in application code, comments, or any of the 6 i18n locale files. The closest implemented analogue is the **`Grow` feature** (buy/sell/dividend/payback/cashflow/P&L for shares, leveraged investments, and generic assets). This mapping is a plausible inference, not something stated anywhere in the codebase — see "needs clarification" in the glossary.

Implementation, all client-side, all inside components:
- **Buy/Sell**: `GrowComponent.buyProject()`/`sellProject()` (`grow.component.ts:186-270`) — pre-fills the Add-Transaction form with a magic-string comment (e.g. `"Buy Share X 10 x 25;"`), handed to `AddComponent`, which parses that same string back out to mutate `allShares`/`allAssets`/`allInvestments`/`liabilities` (`add.component.ts:600-960`; edit path in `info.component.ts:200-620`).
- **Dividend**: `GrowComponent.dividende(index)` (`grow.component.ts:393-405`).
- **Payback**: `GrowComponent.paybackProject(index)` (`grow.component.ts:411-434`).
- **Cashflow**: `GrowComponent.cashflowProject(index)` (`grow.component.ts:357-376`), subtracts `liabilitie.credit` from `cashflow` inline.
- **P&L ("GV")**: `GrowComponent.getGrowProjectsGV(index)` (`grow.component.ts:312-320`) sums every transaction whose `category` matches the project's `title`. Likely German *Gewinn/Verlust* — needs clarification.
- **Tests**: `grow.component.spec.ts` exists but only covers sorting and a static getter/setter — **none of buy/sell/dividend/payback/P&L is tested**, and the actual parsing logic in `add.component.ts`/`info.component.ts` has specs of unverified depth on those branches.

### Rich Dad Poor Dad classifications
No "cash-flow quadrant" concept exists anywhere (`grep -i quadrant` → 0 matches in `src/`). What exists is a binary **asset vs. liability** classification via `Grow.isAsset: boolean`, read by `GrowComponent.getProjectType()`. Real balance-sheet aggregation happens independently in `computeBalanceSheet()` (`src/app/stats/statement/statement-calculations.ts:326-341`) — sums `allAssets` + `allShares` (`quantity*price`) + `allInvestments` (`amount+deposit`) + `allProperties`, vs. `liabilities`, `equity = assets - liabilities`. **This function does not consult `Grow.isAsset` at all** — it trusts the separately-maintained top-level arrays only. No spec file exists for `statement-calculations.ts` or `financial-statement.component.ts`. The only reference to "Rich Dad Poor Dad" in the app is a book link in `instructions.component.html` and generic i18n instruction copy — the classification/quadrant framework described in the master prompt is **not implemented**.

### Subscriptions (recurring transaction generation)
Cleanly factored **Strategy pattern** — the best-tested part of the domain layer:
- `src/app/shared/services/frequency-strategies/{weekly,biweekly,monthly,quarterly,yearly}-frequency.ts`, each implementing `FrequencyStrategy.calculateOccurrences()`.
- `FrequencyCalculatorService` — dispatcher.
- `SubscriptionProcessingService.setTransactionsForSubscriptions()` — walks active subscriptions, computes due dates, dedupes by date+account+amount+category+comment, generates `Transaction` rows, and owns Mojo/Smile/Fire allocation side effects (duplicated cap logic, §4 item 6).
- `SubscriptionActivationService` — activates/deactivates `PlannedSubscription`s.
- `PaymentPlannerService` — computes smart bucket-targeted payment amounts.
- **Tested**: `frequency-strategies.spec.ts` (~40 cases), `frequency-calculator.service.spec.ts`. **Untested**: `subscription-processing.service.ts`, `subscription-activation.service.ts`, `payment-planner.service.ts` — i.e. the actual transaction generation and fund-cap logic has no spec coverage.
- Entirely client-side; nothing subscription-related exists on the backend beyond generic JSON path read/write.

### Smile projects
Model in `smile.ts`; migration in `smile-migration.utils.ts` (**no spec file**, unlike Fire's equivalent). Logic mostly inline in `smile-projects.component.ts` and `info-smile.component.ts` (bucket totals computed ad hoc — not delegated to a shared service, §4 item 4). Bucket-fill/phase-completion side effects live in `IncomeStatementService.recalculate()`.

### Fire emergencies
Model in `fire.ts`; migration in `fire-migration.utils.ts` (has a spec). Bucket totals are *partly* centralized in `IncomeStatementService` but duplicated internally (dead instance methods vs. used static methods in the same file, §4 item 3). Auto-completion: when all buckets reach target, `phase` flips to `'completed'` and `completionDate` is stamped from the triggering transaction's date. `fire.component.ts` computes "months of Mojo coverage" = `mojo.amount / avgMonthExpenses`.

### Financial statements
`src/app/stats/statement/statement-calculations.ts` (469 lines, pure functions, no Angular DI) computes `IncomeStatement`, `CashflowStatement` (operating/investing/financing/mojo), `BalanceSheet`, `KeyRatios` (savings rate, fixed-cost ratio, net margin, debt ratio, equity ratio, interest coverage), parameterized by period (`week|month|quarter|halfyear|year`) with automatic prior-period comparison. **No spec file at all** — the single largest untested pure-calculation surface given its size and importance. A second, independent full-ledger-replay engine (`IncomeStatementService.recalculate()`, exposed to users as "Fix Accounting") rebuilds every derived total from `allTransactions` from scratch — it does have a spec.

### Budget
No dedicated `BudgetService` — logic lives directly in `plan.component.ts` (780 lines): actuals caching, budget-amount lookup, zero-plan detection for an `@others` catch-all bucket. Has specs (`plan.component.spec.ts`, `budget.component.spec.ts`).

### Statistics
Very large and mostly untested D3-heavy code: `stats-calculations.ts` (451 lines, **has** a spec) vs. `charts/core-charts.ts` (1691 lines), `charts/kpi-charts.ts` (2926 lines), `bi/bi-dashboard.ts` (4506 lines!), `analytics/{explorative,predictive,prescriptive}.ts` (1224/1359/2006 lines) — **none of these five files have a spec**, roughly 9,000 lines of untested calculation+rendering code, the largest untested surface in the whole app. Function names inside predictive/prescriptive use German (`createPraediktiveAnalytics`, `createPraeskriptiveAnalytics`).

### Backup & restore
No dedicated service — implemented directly in `SettingsComponent`: CSV exports via `CsvService`; `exportMigrationData()` builds one JSON bundle (all collections + settings) that **embeds the plaintext encryption key** (`encryptKey: this.cryptic.getKey()`) alongside allocation ratios/language/theme; `onImportMigration()`/`writeMigrationData()` restores it, including the key. `CrypticService` handles AES-256-CBC + PBKDF2-SHA256 + HMAC with a `v2:` versioning prefix and legacy-passphrase backward compatibility. No backend endpoint exists for backup/restore beyond the generic JSON path API.

## 3. Domain glossary

| Term | Definition |
|---|---|
| **Daily** | Everyday-spending account (groceries, fuel, bills); default 60% of income. |
| **Splurge** | Guilt-free discretionary spending account; default 10% of income. |
| **Smile** | Medium-term savings-goal account (holidays, gadgets); default 10% of income; organized into "**Smile Projects**," each with one or more **buckets** (sub-goals with their own target/amount). |
| **Fire** | Emergency-fund/safety-net account; default 20% of income; organized into "**Fire Emergencies**" with buckets, same shape as Smile. (This is the Barefoot Investor "Fire Extinguisher" account — not the FIRE/Financial-Independence-Retire-Early movement, though the UI's Fire/emergency framing and any future "FI ratio" language could get confused with it — worth a one-line disambiguation in agent-facing docs.) |
| **Mojo** | Sub-account conceptually nested inside Fire: the primary long-term emergency buffer, sized by "months of expenses covered." Has only `target`/`amount`, no buckets. `@Mojo` category tag routes income here directly, bypassing the Daily/Splurge/Smile/Fire split. |
| **Income** | Virtual "account" every incoming transaction posts to before being algorithmically split across Daily/Splurge/Smile/Fire (and optionally Mojo). |
| **Grow** | Investment/side-project tracker: buy/sell shares, leveraged property investments, generic assets, dividends, loan paybacks, cashflow income, and profit/loss. |
| **GV** | Displayed label for a Grow project's profit/loss. Likely German *Gewinn/Verlust* ("profit and loss") — **needs clarification**, not documented as an acronym anywhere. |
| **Liabilitie(s)** | Consistent misspelling of "Liability/Liabilities" throughout interfaces, variables, comments, i18n, and a component folder name. Canonical spelling in this codebase — do not "fix" without a deliberate, full rename pass. |
| **Intrest(s)** | Consistent misspelling of "Interest(s)" in variable names (the storage *path* uses the correct spelling, the *variable* does not). Represents dividend/interest-bearing revenue tags. |
| **Mortage** | Consistent misspelling of "mortgage" in variable names — refers to `Investment.amount` (financed property value), distinct from `Investment.deposit` (own cash). |
| **`@` category prefix** | Marks a transaction's `category` as a reference to a named entity (revenue tag, Smile/Fire project or bucket title, Grow project title, liability tag). Matching is case-insensitive string equality after stripping `@` — not a real foreign key. |
| **`#bucket:Name:Amount` comment tag** | Embedded syntax inside `Transaction.comment` recording how a payment split across a project's buckets. |
| **"Fix Accounting"** | User-facing settings action for `IncomeStatementService.recalculate()` — a full ledger replay rebuilding every derived total from `allTransactions`. |
| **Tier 1/2/3 (data loading)** | Internal lazy-loading classification in `AppDataService` controlling what blocks initial render vs. loads later/on-demand. An engineering convention, not a finance term, but essential context for anything reading "current state." |
| **Praediktive / Praeskriptive** | German ("prädiktiv"/"präskriptiv," umlauts dropped) baked into function/i18n-key names for the predictive/prescriptive analytics dashboards. |
| **Ist / Soll** | German for "actual/target," appears in a `calculateBudgetCompliance` formula comment. |
| **"Greenfoot Investor"** | Named in `docs/MASTER_PROMPT.md` as one of two founding frameworks. **Needs clarification from JFK** — no matching string, comment, class, or i18n key exists anywhere in `src/`. Best guess is it maps to the "Grow" feature, but this is unconfirmed. |
| **Cash-flow quadrant** | An RDPD concept named in the master prompt as something to document. **Needs clarification** — not implemented anywhere in the app; unclear if this is planned-but-unbuilt or a documentation-only aspiration that should be dropped from scope. |

## 4. Duplicated / inconsistent logic (technical debt relevant to building an API on top of this)

Numbered so `RISKS_AND_QUESTIONS.md` can reference these directly.

1. **Dead duplicate**: `AppStateService.getAmount()` (used, tested) vs. a byte-identical, never-called copy `HomeComponent.getAmount()` (`home.component.ts:84-96`). Low risk today, but a trap for whoever edits one copy expecting it to affect both.
2. **Bug — wrong ratio in Splurge refresh**: `SplurgeComponent` (`splurge.component.ts:91`) recomputes `splurgeAmount` using `AppStateService.instance.daily / 100` instead of `.splurge / 100`, while the constructor and another refresh path correctly use `.splurge`. Looks like a copy-paste bug producing a wrong displayed Splurge balance on at least one refresh path.
3. **Fire bucket totals duplicated 4 ways**: unused instance methods `getTotalFireTarget`/`getTotalFireAmount` vs. used static methods in the *same file* (`income-statement.service.ts:373-393` vs. `412-423`), plus ad hoc `reduce()` re-implementations in `info-fire.component.ts`, `fire-emergencies.component.ts`, `fire-migration.utils.ts`.
4. **Smile bucket totals duplicated ~7-10 ways with no shared helper at all** (worse than Fire): `smile-projects.component.ts`, `info-smile.component.ts`, `info.component.ts`, `add.component.ts`, `subscription-processing.service.ts`, `income-statement.service.ts`, `smile-migration.utils.ts`, `core-charts.ts`. Any change to bucket-total semantics needs replicating by hand in ~10 places.
5. **Two independent "Savings Rate" calculations that can disagree**: `calculateSavingsRate()` in `stats-calculations.ts` (KPI dashboard) vs. `computeIncomeStatement`/`computeRatiosForRange` in `statement-calculations.ts` (Financial Statement page) use different income aggregation and different transfer-exclusion rules (`TRANSFER_CATEGORIES` is not reused between the two files). The same-labeled number can legitimately show differently on two pages for the same period.
6. **Mojo overflow-cap logic duplicated 3 times** with the identical `if (amount - result > target) { result = target - amount; ... }` pattern: `income-statement.service.ts:89-98`, `add.component.ts:1354-1372`, `subscription-processing.service.ts:304-320`.
7. **Grow's two representations of the same investment kept in sync manually**: `Grow.share`/`Grow.investment`/`Grow.liabilitie` (snapshot at creation) vs. `AppStateService.allShares`/`allInvestments`/`liabilities` (what `computeBalanceSheet()` actually uses), linked only by `tag === title` string matching, mutated only by parsing hand-built comment strings back out. Renaming a Grow project, or a user editing a transaction comment, silently breaks the link with no validation or error surfaced.
8. **Fragile comment-string DSL drives real financial side effects**: the entire Buy/Sell/Payback/Dividend/Cashflow flow for Grow works by writing a magic-prefixed sentence into `Transaction.comment` (e.g. `"Sell Investment X 50000 200000;"`) and `split(" ")`-parsing it back by fixed array index. No schema/regex validation — a comment edit with the wrong word count or ordering silently corrupts derived numbers (unchecked `NaN` propagation).
9. **`Profile` interface is stale** relative to the real `AppStateService` runtime shape (see §1).
10. **No single calculation home for BI/analytics**: `bi-dashboard.ts` and `predictive.ts`/`prescriptive.ts` mix D3 rendering and math inline in very large files, unlike `statement-calculations.ts`'s clean separation. Finding "the" formula behind a BI chart means reading through rendering code.
11. **Backend/frontend persistence-shape mismatch**: `backend/DATABASE_STRUCTURE.md` documents roughly half the real schema (see §1, "Persistence paths actually written").
12. **Untested surface, largest first**: `bi-dashboard.ts` (4506 lines), `kpi-charts.ts` (2926), `prescriptive.ts` (2006), `core-charts.ts` (1691), `predictive.ts` (1359), `explorative.ts` (1224), `statement-calculations.ts` (469 — the financial-statement math), `payment-planner.service.ts` (427), `subscription-processing.service.ts` (453 — actual transaction generation + fund caps), `subscription-activation.service.ts` (383), plus `smile-migration.utils.ts` and `grow-migration.utils.ts` (no specs, vs. `fire-migration.utils.ts` and `subscription-migration.utils.ts` which have them).

This matters directly for Phase 2 (§4.1, shared domain logic extraction): the "business logic" the master prompt assumes can be lifted into a framework-agnostic package is, in several of the highest-value areas (Grow P&L, bucket totals, savings rate), duplicated, partially untested, and in one case (Splurge ratio) outright buggy. Extraction should start by consolidating these duplicates and adding tests, not just moving the existing code verbatim — see `RISKS_AND_QUESTIONS.md`.
