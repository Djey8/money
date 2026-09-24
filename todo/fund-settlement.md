# Smile/Fire: plan↔subscription sync and bucket settlement — Feature Plan

**Status:** In progress (started 2026-09-24).
**Scope:** Self-hosted API + app UI first; Firebase UI afterwards (it needs the app to compute buckets with the shared domain engine, since Firebase has no server). Not Pro-gated for the UI parts.

---

## 1. What this is

Two related pieces for Smile projects and Fire funds (dream or emergency goals split into buckets):

1. **Payment plans stay in line with their subscriptions** — both ways, and a plan finishes when its goal is reached.
2. **Settling a bucket** — the moment the real bill is paid: the actual cost replaces the planned one, the difference is topped up or released, and the bucket is marked as used with its receipt.

Motivating example (mountain guide): planned 500, saved 500, the guide actually costs 650 → settle records −150 and the bucket shows planned 500 / actual 650. Petrol: saved 40, tank for 50 → −10. Saved 60, bill 50 → +10 released back.

---

## 2. Locked decisions

1. **The plan owns its subscription.** The API refuses direct edits/deletes of a plan-owned subscription (points to the plan endpoints). Every rebuild reconciles: a plan whose subscription is gone becomes `inactive`; a plan whose target buckets are all full (or settled) becomes the new status **`completed`** and its subscription ends on the date it filled. Active non-manual plans are recalculated when a bucket target changes.
2. **Settlement is a transaction**, tagged `#settle:<Bucket>:<actual>`, so the settled state is derived by replay like every other amount. Undo = delete it (or `unsettle`). Receipt text lives in its comment.
3. **Buckets are one-off.** No recurring cycles. Settling a settled bucket again updates the same settlement (new actual, recomputed difference, new receipt); `unsettle` reopens it with its earlier savings.
4. **Order:** self-hosted API + app UI first, Firebase UI afterwards.

---

## 3. Grounding facts (from the 2026-09-24 audit)

- Bucket and Mojo amounts are rebuilt from transactions on every write (`packages/domain/src/transactions/fund-state.ts`, `backend/services/rebuild-derived.js`). A transaction counts toward a Smile project by category `@<project>`, a Fire fund by `@<project>`/`@<bucket>`; the amount's sign is ignored; `#bucket:` tags route; everything is capped at the target (a capped transaction's stored amount is reduced).
- Payment plans live in `project.plannedSubscriptions`; activation creates a subscription (negative amount, `@<project>`, the plan's `#bucket:` tags). API plan lifecycle: `fund-project-repository.js` (`withPlanWrite`).
- `subscription-repository.js` knows nothing about plans — editing/deleting a plan's subscription leaves the plan stale.
- `isTargetAlreadyFull` in `subscription-generation.ts` only checks Smile and Mojo (**bug: Fire plans keep generating transactions the cap reduces to €0**) and checks the whole project, not the plan's target buckets.

---

## 4. Part 1 — plan ↔ subscription

| Step | Change |
| ---- | ------ |
| 1a | Fix `isTargetAlreadyFull`: cover Fire (`@<project>` and `@<bucket>`), and when the subscription's comment has `#bucket:` tags, check those buckets (full = no room left). |
| 1b | New plan status `completed` (+ `completedAt`). Every rebuild reconciles plans: target buckets all full/settled → `completed`, subscription `endDate` = the day it filled; subscription missing → `inactive`. |
| 1c | Generic subscription endpoints refuse PATCH/DELETE of a plan-owned subscription (`activeSubscriptionId`, or title+category+frequency match) with a pointer to the plan endpoints. |
| 1d | A bucket target change recalculates active plans without `manuallyAdjusted` (amount, tags, subscription), reported in `effects`. |

---

## 5. Part 2 — settlement

**Action:** `POST /smile|fire/{id}/buckets/{bucketId}/settle` `{actualMinor, account?, date?, receipt?, surplus?: {moveToBucketId}}`, `POST .../unsettle`. MCP: `settle_bucket`, `unsettle_bucket`.

**Engine** (domain, shared with the app): at a `#settle:<Bucket>:<actual>` transaction during replay, the bucket's effective target becomes `actual`, its amount becomes `actual`, and the transaction's amount is rewritten to `−(actual − saved at that moment)` (negative = top-up from the account, positive = surplus released, 0 = exact, allowed only for settlement transactions). A settled bucket takes no further contributions.

**Derived bucket fields:** `status: 'open' | 'settled'`, `settledMinor`, `settledDate`, `varianceMinor = settled − planned target`. The planned `targetMinor` is kept (plan vs actual). Project totals report planned and actual.

**Surplus:** default release (+ back to the account); `surplus: {moveToBucketId}` records a matching contribution to another bucket of the same project (net zero).

**Effects on the rest:** payment plans skip settled buckets; a plan whose buckets are all settled/full → `completed`; all buckets settled → project `phase: completed`. Accounting: savings were already expensed on contribution, so only the difference is booked — the income statement ends at the actual cost.

**App UI (self-hosted first):** Settle button per bucket (actual cost, receipt, surplus choice), settled badge with plan vs actual, plan status `completed`, and the loader/migration must keep the new derived bucket/plan fields when saving.

---

## 6. Order of work

1. 1a Fire/bucket skip fix (bug).
2. Engine: `#settle` tag + derived fields (domain, tested).
3. API: settle/unsettle, 0-amount settlement transactions, contribute refuses settled buckets.
4. 1b/1c/1d plan reconciliation + plan-owned subscriptions.
5. Docs: guide section, OpenAPI, AGENTS.md, MCP.
6. App UI (self-hosted), then Firebase UI.
