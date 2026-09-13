# Treasury & Transfers — Feature Plan

**Status:** Planned, not started — saved for later per user request (2026-09-13)
**Scope:** Firebase AND self-hosted editions, full parity. Not Pro-gated — this is core app functionality, available to every user regardless of edition.
**Owner note:** This plan was produced after research into the existing codebase (see "Research findings" below) and four locked product decisions (see "Locked decisions"). Nothing has been implemented yet. Before starting, re-read this file in full — a few of the decisions below deliberately deviate from existing app precedent and that reasoning needs to survive into the implementation.

---

## 1. What this feature is

Track **where money physically sits** — bank accounts, cash, a crypto exchange balance — as a first-class object called a **Treasury**. This is orthogonal to the existing Barefoot bucket concept (`Transaction.account` ∈ Daily/Splurge/Smile/Fire/Mojo): a bucket says *what the money is for*, a Treasury says *where it actually is*.

Three pieces:

1. **Treasury** — a named object with a current amount. Full CRUD (create, read, update, delete). List + add + info UI matching the existing Grow/Smile/Fire pattern.
2. **Transaction → Treasury link** — every transaction gets an optional `treasuryId`. When set, the transaction's amount is applied to that treasury's balance in addition to whatever else it already does (bucket allocation, income statement, etc. — all unchanged).
3. **Transfer** — a new, separate entity for moving money between two treasuries. Not a transaction, has its own list/table, own add flow, tracks source, destination, amount, date, and (optionally) a comment.

Real-world motivation from the user: currently 3 bank accounts, cash, and a crypto exchange balance — a set that "can change and grow dynamically," hence a full user-managed list rather than a fixed enum.

---

## 2. Locked decisions

Asked as four clarifying questions before writing this plan; answers below are final for v1 unless revisited.

1. **Balance model: freely-editable live counter**, not derived-by-replay. This is a deliberate deviation from how Mojo/Smile/Fire currently work (`packages/domain/src/transactions/fund-state.ts` fully recomputes those by replaying every transaction each time — see Research §3). Treasury instead stores a plain `amount` number that:
   - can be edited directly at any time via the Info modal's CRUD update (a manual correction/adjustment), **and**
   - is also incremented/decremented automatically by linked transactions and transfers.
   This means the app needs new delta-reconciliation logic it doesn't currently have anywhere else (see §5). This was chosen deliberately over the replay model for simplicity of mental model — be aware it can drift if reconciliation isn't applied consistently at every mutation site (create/edit/delete of a transaction or transfer).
2. **Deleting a Treasury with linked history: allowed, orphans the links.** Deleting a Treasury does not check for or block on existing references. Every Transaction/Transfer that referenced it has that reference reset to `null` (not left dangling, not cascade-deleted) — transaction/transfer history itself is preserved, just loses the "which treasury" attribution. The UI should display such orphaned records with something like "Deleted treasury" rather than a blank/broken field.
3. **No transfer fees in v1.** A Transfer always moves one exact amount: source `-amount`, destination `+amount`. No fee/spread field. Documented here as a deliberate scope cut — a fee could be added later as an optional field without a breaking change (extra optional field, defaults to zero effect on existing data).
4. **Audit the existing informal "transfer" convention**, don't leave it silently un-investigated. See §10 — brief, no guaranteed behavior change, just confirming the new Transfer entity doesn't double-count or conflict with the ~10 existing places that guess "this looks like a transfer" from category-name matching.

---

## 3. Research findings (grounding facts, so this plan doesn't need re-deriving them)

Full detail lives in this session's research; key facts condensed here:

- **"Locations" was never actually planned.** Three empty directories exist (`src/app/main/locations/`, `src/app/panels/add/add-location/`, `src/app/panels/info/info-location/`) mirroring the Grow/Smile/Fire triad naming, and nothing else — no interface, no doc, no ADR, no todo entry, not in git history. Every textual "location" hit elsewhere in the repo is either the substring inside "allocation" or the English word meaning "where in a file/UI." **Decision: use "Treasury" as the name throughout** (matches how the user described it consistently); the three empty stub directories can be deleted or repurposed — don't assume they contain anything.
- **Grow/Smile/Fire's add-info-list pattern** (this is the UI template to match):
  - **List page**: `src/app/main/<feature>/<feature>.component.{ts,html,css}`, standalone component, registered as a route in **both** `src/app/app.routes.base.ts` and the legacy `src/app/app-routing.module.ts`. State is a static getter/setter proxying `AppStateService` (e.g. `Grow.allGrowProjects` → `AppStateService.instance.allGrowProjects`). Table via `MatTableDataSource` + `MatSort` + `MatPaginator`.
  - **Add flow is a global modal, not a route.** `src/app/panels/add/add-<feature>/add-<feature>.component.*`, rendered once in the app shell (`app.component.html`), visibility toggled by a **static boolean flag** the list page sets (e.g. `AddGrowComponent.zIndex = 1; AddGrowComponent.isAddSmile = true;` — note the copy-pasted flag name, don't propagate that naming quirk to Treasury). Save path: build the object → push into the `AppStateService` array → `persistence.batchWriteAndSync(...)`.
  - **Info/detail flow is a modal owned by the list page** (not global, not a route). `src/app/panels/info/info-<feature>/info-<feature>.component.*`, rendered inside the list page's own template, opened on row click. Carries the **U and D of CRUD** — edit and delete both happen here, via static fields mirroring the interface.
  - **Interface**: plain TS interface in `src/app/interfaces/<feature>.ts`, no base class, identity is usually a unique `title`/name string rather than a synthetic id (confirm whether Treasury needs a real `id` — recommend yes, since amounts will be referenced by Transactions/Transfers via id, and names should be renameable without breaking those references, unlike Grow which keys by title).
  - Nav entry: `src/app/panels/menu/menu.component.html`.
- **Transaction interface is a flat 6 fields**, no location concept: `{ account, amount, date, time, category, comment }` (`src/app/interfaces/transaction.ts`). `account` is purely the Barefoot bucket, hardcoded to Daily/Splurge/Smile/Fire/Mojo/Income in multiple places (UI dropdowns, `packages/domain/src/transactions/accounting.ts`'s `EXPENSE_ACCOUNTS`). A `treasuryId` field is a genuinely new, orthogonal dimension — nothing to reconcile it against.
- **`packages/domain`'s derived-state calculators are closed, hardcoded shapes**, not a generic per-dimension accumulator: `FundState = { mojo, smile, fire }` (3 fixed members), `TransactionAccountingSummary`'s `expenses` is a `Record` over exactly 5 literal account names. A treasury-balance accumulator is a **new, additional** calculation, not a plug-in to the existing one.
- **No Transfer entity exists anywhere** (interface, route, repository — nothing). What exists is an **informal, undocumented convention**: a transaction whose `category` matches another account name is treated as an inter-bucket transfer and excluded from expense math, applied ad hoc in ~10 places: `src/app/stats/bi/bi-dashboard.ts` (multiple line numbers), `src/app/stats/analytics/explorative.ts`, `src/app/stats/analytics/prescriptive.ts`, `src/app/shared/services/prompt-generator.service.ts`. This predates and is unrelated to the new Transfer entity — it's about inter-*bucket* movement (Daily→Splurge), not inter-*treasury* movement (Checking→Savings). Both concepts can coexist. See §10.
- **Balance (assets/shares/investments/liabilities) is fully distinct from Treasury** — no code-level overlap, purely conceptual risk (a user could double-model "Bank" as both an Asset and a Treasury; that's a user modeling choice, not a system conflict to solve).
- **Subscription already has an `account` field** (the Barefoot bucket) that generated transactions inherit verbatim, both in the frontend (`subscription-processing.service.ts`) and the domain package (`packages/domain/src/transactions/subscription-generation.ts`). Adding an optional `treasuryId` to Subscription is the same pattern: extend the interface, extend generated-transaction construction, extend the dedup key comparison (`subscription-generation.ts`'s `DedupKey` currently compares 5 fields — a treasury-only difference between two otherwise-identical subscriptions would currently collide as duplicates unless `treasuryId` is added there too), and extend `SubscriptionChange.field`'s closed union (currently `'amount'|'account'|'category'|'frequency'`) to include the new field name for change-history tracking.
- **Storage layer is fully generic — no schema/rules changes needed for the basic data path.** Both Firebase RTDB (`users/{uid}/<tag>`) and self-hosted CouchDB (`backend/routes/data.js`'s generic `path.split('/')` read/write) will happily store a new `treasuries`/`transfers` tag with zero backend code changes. The real cost is entirely in the **frontend tiered-loading contract**:
  - `src/app/shared/services/app-state.service.ts` — new fields (`allTreasuries`, `allTransfers`) + a `tierXLoaded` flag if not tier 1.
  - `src/app/shared/services/app-data.service.ts` — add to the relevant `TIERn_PATHS` array, add a `case` in the `applyPathData` switch (this is the single biggest per-entity plumbing cost — one hand-written case per entity, each doing manual field-by-field decryption), add to `saveAllToLocalStorage()`/`updateDatabase()`'s tag lists, add a tier loader function if on-demand (mirroring `loadGrowData()`/`loadBalanceData()`).
  - **Tier placement matters**: since every Transaction display (tier 1) needs to resolve/show its linked treasury name, Treasury itself likely needs to be **tier 1** (loaded eagerly, alongside `transactions`/`subscriptions`), not tier 2/3 like Grow/Balance. Transfers can likely be tier 2 or on-demand (tier 3) since they have their own dedicated page, not shown inline elsewhere.
  - `packages/domain/src/money/convert-document.ts`'s `MONEY_FIELD_NAMES`/`NUMERIC_FIELD_NAMES`/`BOOLEANIZED_FIELD_NAMES` registries — register Treasury's `amount` and Transfer's `amount` field names, or schemaVersion-2 minor-units conversion silently skips them.
  - The Pro API (per-entity repositories in `backend/repositories/`, routes in `backend/routes/api.js`, `docs/api/openapi.yaml`) is separate, hand-written-per-entity work — **out of scope for v1** per this plan (see §14) but should be planned as an explicit follow-up once the UI-facing feature ships, so Treasury/Transfer become visible to the Pro API/MCP tools like every other entity.
  - **Known duplication precedent** (CLAUDE.md, PLAN.md D-9): Smile/Fire/Mojo bucket logic is independently reimplemented in the Angular frontend AND in `packages/domain` (used by the backend API). Treasury balance mutation will need the same frontend-side logic (for the add/info modals and subscription-processing.service.ts) as well as domain-package logic (for the eventual Pro API path) — this plan does **not** attempt to consolidate that existing duplication (out of scope, a much larger separate undertaking), just accepts the same pattern for the new entity.

---

## 4. Data model

### 4.1 New interface: `src/app/interfaces/treasury.ts`

```ts
export interface Treasury {
  id: string; // real synthetic id, not a title/name key — Transactions/Transfers reference this,
              // and a Treasury must be freely renameable without breaking those references
              // (unlike Grow, which keys by title today)
  name: string;
  amount: number; // freely-editable live counter — see §2 decision 1 and §5
  createdAt: string;
  updatedAt: string;
}
```

Open question to resolve during implementation, not blocking this plan: does a Treasury need a `type`/icon field (bank/cash/crypto/other) for display purposes, or is a plain name enough for v1? User's examples ("3 bank accounts, cash, one crypto bank") suggest a light categorization could help the list UI visually, but nothing in the ask requires it functionally. Recommend: add an optional `icon`/`kind` enum-ish string field, purely cosmetic, defaulting to a generic icon if unset — cheap to add now, annoying to retrofit later if the list page ends up wanting icons.

### 4.2 New interface: `src/app/interfaces/transfer.ts`

```ts
export interface Transfer {
  id: string;
  sourceTreasuryId: string | null; // null after the referenced treasury is deleted (orphaned, §2 decision 2)
  destinationTreasuryId: string | null;
  amount: number; // always positive; direction is source -> destination
  date: string;
  time: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}
```

No fee field (§2 decision 3). Completely separate collection from Transaction — never appears in the transactions table, never flows through `packages/domain`'s transaction accounting/fund-state calculators.

### 4.3 `Transaction` interface change

Add one optional field:

```ts
export interface Transaction {
  account: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  comment: string;
  treasuryId?: string | null; // NEW — optional, orthogonal to `account`
}
```

Backward compatible: every existing transaction simply has no `treasuryId`, which must remain valid forever (this field is never required).

### 4.4 `Subscription` interface change

Same pattern:

```ts
export interface Subscription {
  title: string;
  account: string;
  amount: number;
  startDate: string;
  endDate: string;
  category: string;
  comment: string;
  frequency: SubscriptionFrequency;
  treasuryId?: string | null; // NEW
  changeHistory?: SubscriptionChange[];
}
```

`SubscriptionChange.field` union must gain `'treasuryId'`: `'amount' | 'account' | 'category' | 'frequency' | 'treasuryId'`.

---

## 5. Balance reconciliation logic (the new thing this app doesn't have yet)

Because the balance model is a freely-editable live counter (§2 decision 1), every code path that creates, edits, or deletes a Transaction/Subscription-generated-transaction/Transfer with a treasury link must apply a **delta** to the relevant Treasury's `amount`. This logic needs to exist in every place transactions are currently mutated:

| Mutation | Effect on Treasury balance |
| --- | --- |
| Create transaction with `treasuryId` set | `treasury.amount += transaction.amount` (transaction amount is already signed — negative for expense, positive for income, per existing convention) |
| Edit transaction, `treasuryId` unchanged | `treasury.amount += (newAmount - oldAmount)` |
| Edit transaction, `treasuryId` changed from A to B | `A.amount -= oldAmount; B.amount += newAmount` |
| Edit transaction, `treasuryId` cleared (was set) | `treasury.amount -= oldAmount` |
| Delete transaction with `treasuryId` set | `treasury.amount -= transaction.amount` |
| Create transfer | `source.amount -= transfer.amount; destination.amount += transfer.amount` |
| Edit transfer (amount/source/destination changed) | reverse the old effect, apply the new one (same pattern as transaction edit) |
| Delete transfer | reverse: `source.amount += transfer.amount; destination.amount -= transfer.amount` |
| Delete a Treasury referenced by a transaction/transfer | no balance effect (the Treasury itself is gone) — just null the reference on the transaction/transfer (§2 decision 2) |
| Subscription-generated transaction (auto-created due date) | same as "create transaction" above — the generation code path must also apply this delta, in both the frontend (`subscription-processing.service.ts`) and `packages/domain` (`subscription-generation.ts`) |
| Direct manual edit of `Treasury.amount` via the Info modal | plain overwrite, no reconciliation — this is the user's explicit "correction" mechanism |

This table is the actual functional spec for the feature — implementation should be checked against every row, in every place a transaction can be created/edited/deleted (manual add/info modals, subscription auto-generation, CSV/data import if that path also creates transactions, and the eventual Pro API once that's built).

---

## 6. UI structure (mirrors Grow/Smile/Fire exactly, per the research)

### 6.1 Treasury list page — `src/app/main/treasury/treasury.component.*`

- Table of all treasuries: name, current amount, maybe an icon.
- "+" button opens the add-treasury modal (same static-flag pattern as Grow).
- Row click opens the info-treasury modal.
- Route `treasury`, registered in both `app.routes.base.ts` and `app-routing.module.ts`.
- Nav entry in `menu.component.html`.

### 6.2 Add modal — `src/app/panels/add/add-treasury/add-treasury.component.*`

- Fields: name, starting amount.
- Duplicate-name validation via the existing `src/app/shared/validation.utils.ts`'s `isDuplicateTitle()` helper, same as Grow.
- Rendered globally in `app.component.html` alongside the other `<app-add-*>` components.

### 6.3 Info modal — `src/app/panels/info/info-treasury/info-treasury.component.*`

- Shows: name (editable), current amount (editable — the manual-correction path from §5's last row), created/updated timestamps.
- **A table of every transaction and transfer linked to this treasury** — this is the "under info we have a table with all transactions linked to this treasury" requirement. Needs a filtered view combining: transactions where `treasuryId === this.id`, plus transfers where `sourceTreasuryId === this.id OR destinationTreasuryId === this.id` (shown distinctly from transactions — different columns, since a transfer has two treasuries not one bucket/category).
- Edit + delete (the U/D of CRUD), matching Grow/Smile's info modal pattern.
- Delete confirmation should mention that linked transactions/transfers will show as "no treasury" afterward (§2 decision 2), so the user isn't surprised.

### 6.4 Transfers page — new, separate from the Treasury pages

Per the user: "an under page with another transfer table," not part of the normal Transactions table.

- `src/app/main/transfers/transfers.component.*` (or nested under treasury — pick during implementation; a standalone top-level page is more discoverable, a nested "Transfers" tab under Treasury keeps navigation flatter — recommend a standalone page since transfers are a first-class thing a user may want to see across all treasuries at once, not just from one treasury's info view).
- Table: date, source treasury name, destination treasury name, amount, comment.
- Add flow: pick source treasury, destination treasury (must differ), amount, date, comment. Apply the balance delta from §5 on save.
- Edit/delete similarly apply the reversal logic from §5.

### 6.5 Transaction add/info forms

- `src/app/panels/add/add.component.html`/`.ts` and `src/app/panels/info/info.component.html`/`.ts` need a new **optional** treasury picker (dropdown of existing treasuries, "None" as a valid default) alongside the existing account/category fields.
- Same for the subscription add/info forms (`src/app/panels/add/add-subscription/`, `src/app/panels/info/info-subscription/` — exact paths to confirm during implementation, not fully enumerated by this session's research).

---

## 7. `packages/domain` changes

- New calculator, e.g. `packages/domain/src/treasury/treasury-balance.ts` (new directory, doesn't belong under `transactions/` since it's a distinct dimension) implementing the delta table from §5, for use by the eventual Pro API/backend path.
- `packages/domain/src/transactions/transaction.ts`: add `treasuryId` to `LegacyTransaction`/`Transaction`/`ApiTransaction`, update `normalizeTransaction` validation, `transactionToApi`/`transactionFromApi` mapping.
- `packages/domain/src/transactions/subscription-generation.ts`: add `treasuryId` to `SubscriptionForGeneration`/`GeneratedTransaction`, add it to `DedupKey` and its comparison (currently 5 fields, would become 6) — **without this, two subscriptions identical except for treasury would be wrongly deduplicated against each other's generated transactions.**
- `packages/domain/src/money/convert-document.ts`: register `amount` usage is already covered generically by field-name (`amount` is already a registered money field name for other entities), but confirm Treasury's and Transfer's specific field names are covered by the existing registries or need explicit addition — check `MONEY_FIELD_NAMES`/`NUMERIC_FIELD_NAMES` at implementation time.

---

## 8. Reports/Stats integration

- Every derived report (Income Statement, KPIs, Cashflow, Budget-from-subscriptions, `bi-dashboard.ts`'s analytics) currently iterates transactions and classifies by `account`/`category`. Adding `treasuryId` to Transaction **must not** change any of that classification — a transaction linked to a treasury is still exactly the same kind of income/expense it always was. Treasury is a pure add-on dimension for these calculators; no existing report logic should need to change because of it.
- Transfers are **never** included in Income Statement/KPI/Cashflow/Budget calculations — they're not income or expense, they're money moving between two places the user already owns. This should be true by construction (Transfers live in a completely separate collection, never merged into the transactions array these calculators consume), not by needing a filter — confirm this stays true rather than someone later merging transfers into the transaction stream for a "unified activity feed" without realizing the accounting implication.

---

## 9. Legacy "transfer" convention audit (§2 decision 4)

Before/during implementation, review each of these for whether the new Transfer entity could ever interact with them (e.g., a user manually creating a transaction between two Barefoot buckets, tagged the old ad hoc way, AND that same movement also being represented as a real Transfer — would that double-exclude or double-count anywhere?):

- `src/app/stats/bi/bi-dashboard.ts` — multiple spots filtering `accountCategoriesToExclude` to exclude inter-account transfers from expense math.
- `src/app/stats/analytics/explorative.ts`
- `src/app/stats/analytics/prescriptive.ts`
- `src/app/shared/services/prompt-generator.service.ts`
- `docs/domain/FIRE_COVERAGE_FORMULA.md` — already documents "no transfer exclusion at all" as a known bug class in one calculation; worth checking whether this plan's work touches that same formula.

Expected outcome: these are about inter-*bucket* transfers (Daily→Splurge), Treasury Transfers are about inter-*treasury* transfers (Checking→Savings) — different concepts that can coexist without conflict, since Transfers never enter the transaction stream these calculators read from at all (§8). Document the audit's conclusion here (or in a follow-up note) once done — if a real conflict is found, it needs its own fix, scoped separately from just "add Treasury."

---

## 10. i18n

New/changed strings needed across all locale files (`src/assets/i18n/{en,de,ar,cn,es,fr}.json` at minimum — confirm the full locale list at implementation time):

- Treasury list page: title, subtitle, empty state, table headers (name, amount).
- Add-treasury modal: field labels, validation messages (duplicate name).
- Info-treasury modal: field labels, linked-transactions table headers, delete-confirmation copy (mentioning orphaning per §2 decision 2).
- Transfers page: title, table headers (date, source, destination, amount, comment), add-transfer form labels, "source and destination must differ" validation message.
- Transaction/subscription add/info forms: new treasury picker label, "None" option text.
- Nav menu entry label for Treasury (and Transfers, if it gets its own top-level nav entry rather than living under Treasury).

---

## 11. Migration / backward compatibility

- No migration is strictly required — `treasuryId` is optional everywhere, existing data is valid as-is with no treasury links.
- If this app's schemaVersion-2 minor-units migration (`docs/adr/0002`) is still an active concern for new fields, confirm Treasury's/Transfer's `amount` fields get correctly converted for any account that migrates after this feature ships (see §7's money-field registry note).
- No changes needed to the one real production user's existing data for this feature to ship safely.

---

## 12. Out of scope for v1 (explicit)

- **Pro API/MCP exposure** for Treasury/Transfer (new repository, route, OpenAPI spec entries, MCP tool). Should be planned as an explicit follow-up once the UI-facing feature is stable — flagged here so it isn't forgotten, not because it's unimportant.
- Transfer fees (§2 decision 3).
- Consolidating the existing frontend/domain-package duplication pattern for bucket logic (§3's "known duplication precedent") — Treasury follows the existing pattern rather than fixing it.
- Any relationship/integration between Treasury and the existing Balance (assets/shares/investments/liabilities) — they stay conceptually separate.
- Multi-currency support (nothing in the existing app suggests this is needed; not raised by the user).

---

## 13. Suggested implementation slices

Purely a suggested order, not a locked commitment — revisit when work actually starts:

1. **Treasury CRUD + list/add/info UI**, no linkage to anything else yet. Ships a usable feature on its own (a place to just track named balances manually), fully testable in isolation.
2. **Transaction ↔ Treasury linkage** — the `treasuryId` field, the picker in add/info transaction forms, the §5 reconciliation logic for manual transaction CRUD. Includes the info-treasury modal's linked-transactions table.
3. **Subscription ↔ Treasury linkage** — the `treasuryId` field on Subscription, generation-time inheritance, `DedupKey` fix, `SubscriptionChange.field` union update.
4. **Transfer entity + its own list/add/info UI** — fully separate from transactions, with its own reconciliation logic (§5's transfer rows).
5. **Reports/legacy-convention audit** (§9) — done once the rest exists, so there's a real Transfer entity to check against, not a hypothetical one.
6. **(Follow-up, separate plan) Pro API/MCP exposure.**

---

## 14. Risks / things to watch

- The freely-editable-counter balance model (§2 decision 1) is a genuine deviation from every other stored balance in this app. Whoever implements this should re-read §5's table carefully and add tests for every row — reconciliation bugs here are silent (a treasury balance quietly drifting wrong) rather than loud, which is exactly the kind of bug this app has already been burned by once this session (the schemaVersion-2 migration display bug, and the CrypticService non-string crash) — both were "worked in the common case, broke silently in an edge case" bugs.
- Tier placement (treasury likely tier 1, since transaction displays need it) has real performance/load-time implications — check against the existing tier-loading contract's actual behavior before committing to tier 1, don't just assume.
- The duplicated frontend/domain-package logic (§3, §7) means every reconciliation rule in §5 needs to be implemented and tested **twice** — once for the Angular UI path, once for `packages/domain` (used by the future Pro API path). Don't let the second copy silently drift from the first.
