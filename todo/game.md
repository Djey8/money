# Real-Life Gamification — Analysis & Implementation Plan

> Turn the personal-finance app into a real-life Cashflow game.
> The existing `GameModeService` simulates board-game turns
> (shift all transactions ±1 month, replay subscriptions). This document
> plans a **separate** layer that gamifies the user's real finances.

---

## 1. Why this is feasible

Almost every primitive needed for a Kiyosaki-style game already exists
in the data model. The job is mostly *interpretation* and *presentation*,
not new bookkeeping.

| Cashflow board game concept | Already in app | Source |
|---|---|---|
| Salary | Income transactions | `transactions` (account = `income`) |
| Doodads (lifestyle expenses) | Expenses on Splurge / Daily | `transactions` (account = `daily`/`splurge`) |
| Assets producing cash flow | Investments, properties, shares, interests, dividends | `assets`, `investments`, `properties`, `shares`, `interests` |
| Liabilities | Liabilities, loans, subscriptions | `liabilities`, `subscriptions` |
| Passive income | Recurring positive cashflow from assets | `IncomeStatementService` |
| Big / Small deals | Add Asset / Add Investment panels | `Add*` panels |
| Rat race | Income statement + balance sheet | `cashflow`, `income`, `balance` views |
| Fast track | Anything beyond "passive income > expenses" | (new) |
| Dream / goal | Smile projects, FIRE emergencies | `smile`, `fire` |
| Emergency fund | Mojo bucket | `mojo` |
| Allocation | 60/10/10/20 (configurable) | Settings → Allocation |

**Conclusion:** No new core data is required. Gamification is a
**read-mostly view** plus a small write of game-state
(XP, level, streaks, completed quests, badges).

---

## 2. Design constraints (decided)

| Decision | Value |
|---|---|
| Architecture | New `GamificationService`, leaves `GameModeService` untouched |
| "Escape the rat race" rule | **User-configurable** (strict Kiyosaki / FIRE 4% / hybrid) |
| Scoring inputs | Cashflow events + net-worth Δ + habit streaks + passive-income ratio |
| Privacy | All state encrypted via existing `CrypticService` + `writeAndSync` |
| Modes | Must work in Firebase **and** Selfhosted, identically |
| Delivery (this iteration) | Documentation only, no code |
| Scope (final feature) | Light layer + Cashflow mirror + Quests + Deal cards + Coach + Multiplayer |

---

## 3. Architecture overview

```
                ┌──────────────────────────────┐
                │      GamificationService     │   (new, singleton)
                │  - score, level, streaks     │
                │  - quest engine              │
                │  - rat-race tracker          │
                │  - deal-card generator       │
                └─────┬───────────────┬────────┘
       reads          │               │  reads
   (no writes)        │               │ (no writes)
                      ▼               ▼
              AppStateService   IncomeStatementService
                      │               │
                      └───────┬───────┘
                              ▼
                      writeAndSync (encrypted)
                      key: data.gamification
```

The service is **derived state** on top of `AppStateService`.
It only **writes** its own `gamification` blob — never edits
transactions, assets, etc. This keeps gamification fully
optional and removable without data loss.

### New CouchDB / Firebase key

```jsonc
"data": {
  "gamification": {
    "version": 1,
    "enabled": true,
    "config": {
      "ratRaceRule": "kiyosaki" | "fire4" | "hybrid",
      "fireSafeWithdrawalRate": 0.04,
      "expenseWindowMonths": 3,        // rolling avg, smooths spikes
      "weeklyResetWeekday": 1,         // Monday
      "monthlyResetDay": 1,
      "notificationsEnabled": true
    },
    "score": { "xp": 0, "level": 1, "lifetimeXp": 0 },
    "streaks": {
      "loggingDailyDays": 0,
      "underBudgetWeeks": 0,
      "noDoodadDays": 0,
      "lastLoggedAt": "2026-04-25"
    },
    "ratRace": {
      "phase": "rat-race" | "near-escape" | "fast-track",
      "passiveIncome": 0,
      "expenses": 0,
      "ratio": 0,                       // passiveIncome / expenses
      "escapedAt": null
    },
    "quests": {
      "active": [ { "id": "...", "progress": 0, "expiresAt": "..." } ],
      "completed": [ { "id": "...", "completedAt": "..." } ]
    },
    "badges":  [ { "id": "first-asset", "earnedAt": "..." } ],
    "deals":   { "lastDrawnAt": "...", "drawer": [ /* RNG seed */ ] },
    "social":  { "groupId": null, "shareDream": false, "alias": null }
  }
}
```

`gamification` is treated like any other tag by `DatabaseService` /
`PersistenceService` → encrypted, ETag-cached, batch-readable. **No
backend changes** for single-player.

---

## 4. Phased rollout

Each phase is independently shippable. Earlier phases unblock later
ones; later phases can be cancelled without rollback.

### Phase 1 — Foundation & Light Layer  *(MVP)*

Goal: users see a **score**, a **level**, and **streaks** on Home.
Zero new behavior; pure read of existing data.

- `GamificationService` (singleton like other services, registered in `app.config.ts`)
  - `currentXp$`, `currentLevel$`, `streaks$` observables
  - `recalc()` called on `transactionsUpdated$` and after Tier1 load
- XP rules (configurable defaults, all read-only over `AppStateService`):
  - +1 XP per logged transaction (caps at 5/day to discourage spam)
  - +5 XP per day with at least one logged transaction (streak bonus)
  - +10 XP per week ending under budget per category
  - +25 XP per month with positive cashflow (income − expenses ≥ 0)
  - +50 XP per **new** income-producing asset (`assets`/`shares`/`investments` length grows)
  - −10 XP per added Doodad-style liability (cars, vacations bucketed via category list)
- Levels: classic curve, `requiredXp(level) = 100 * level^1.5` (tunable)
- Surface: small badge in toolbar (`AppComponent`), full panel under
  Profile → "Game" (new panel `panels/game/game.component.ts`)
- Translations: add `Game.*` keys to all 6 locales (`en, de, es, fr, cn, ar`)

Acceptance:
- Existing flows untouched if `gamification.enabled === false` (default)
- Toggle in Settings opts in; state survives reload, sync, and logout/login
- Works offline (PWA service worker already caches the bundle)

### Phase 2 — Rat Race Tracker (Cashflow mirror)

Goal: show the user where they stand on the Kiyosaki track and which
phase they're in.

- New view `panels/game/rat-race.component.ts`
- Calculation (all derived; no new persisted fields):
  - **Passive income** = sum of recurring positive cashflow tagged
    as "asset income": dividends, rental income (`properties`),
    interest (`interests`), business income (configurable category set)
  - **Expenses** = trailing 3-month rolling average of negative cashflow
    excluding investments-bought-this-month
  - **Ratio** = `passiveIncome / expenses`
  - Phases:
    - `rat-race`        ratio < 0.5
    - `near-escape`     0.5 ≤ ratio < 1.0
    - `fast-track`      ratio ≥ 1.0
- The "rule" is user-configurable in Settings → Game:
  - **Kiyosaki strict** — uses ratio above
  - **FIRE 4%** — `(netWorth × swr) / annualExpenses ≥ 1`
  - **Hybrid** — meet either to unlock fast track
- Visual: progress ring + delta vs. last month. D3 (already in deps).
- One-time event: when ratio crosses 1.0 the first time, fire
  `rat-race-escaped` toast + badge + write `ratRace.escapedAt`.

### Phase 3 — Quests & Missions

Goal: weekly and monthly missions that nudge real behaviour.

- Quest = `{ id, type, scope: 'daily'|'weekly'|'monthly', target, reward, condition(fn) }`
- Quest library (initial set, ~15 quests):
  - **Daily:** "Log every transaction today", "Stay under daily budget"
  - **Weekly:** "Add at least 1 income-producing asset",
    "Keep Splurge under 10% of income", "Top up Mojo bucket"
  - **Monthly:** "Grow net-worth ≥ 1%", "Pay down 1 liability",
    "Beat last month's savings rate", "Complete 1 Smile project milestone"
- Engine:
  - On reset boundary (start of day / Monday / 1st), draw N quests
    (3 daily, 3 weekly, 2 monthly) using a deterministic seeded RNG
    so the user gets the **same set on different devices**
  - Each `recalc()` re-evaluates `condition(state)` and updates progress
  - On completion: award XP, write `quests.completed`, fire toast +
    optional sound (already wired via `ToastService`)
- Surface: Game panel "Active quests" tab + tiny badge with count on
  the bottom-nav game icon

### Phase 4 — Deal Cards (Coach light)

Goal: surface real opportunities/threats the way the board game does.

- Deal types map to existing flows:
  - **Small Deal** (low-cost asset suggestion): "Increase Smile %
    by 1% this month — projected cashflow +€X"
  - **Big Deal** (large asset): "Your Mojo is full. Convert excess
    cash into an income asset?"
  - **Doodad** (warning): "Splurge spending up 35% vs. trailing avg —
    skip 1 doodad to save €Y"
  - **Market** (rebalance): "Asset Z hasn't paid out in 90 days —
    review/sell?"
- Deals are **suggestions only**. Tapping a card opens the appropriate
  existing `Add*` / `Info*` panel pre-filled. Nothing happens
  automatically — preserves user trust.
- Trigger rules: deterministic, derived from real numbers (no LLM):
  - Mojo > target × 1.2 → Big Deal: invest excess
  - Splurge 7-day trend > 30% above avg → Doodad warning
  - Smile project < 50% funded with > 50% time elapsed → Re-plan card
  - Liability with rate above the user's avg asset return → Pay-down card
- Reward XP only on **action taken** (the `Add*` panel actually writes)
  to avoid gaming the system by dismissing cards.

### Phase 5 — Coach Mode (adaptive nudges)

Goal: personalised next-best-action.

- Pure local heuristic engine in `GamificationService.coach()`:
  ```text
  if ratio < 0.2:          focus = "build first asset"
  elif ratio < 0.5:        focus = "increase asset count"
  elif ratio < 1.0:        focus = "scale cashflow / refinance liabilities"
  elif ratio < 2.0:        focus = "fast track — bigger deals"
  else:                    focus = "pursue dream (Smile project)"
  ```
- One sentence rendered on Home above bottom nav. Translated.
- No external AI calls — keeps everything offline-friendly and private.
- Optional Phase 5b (later): replace heuristics with a tiny on-device
  rules engine fed from `IncomeStatementService` outputs. Deferred.

### Phase 6 — Social / Multiplayer

Goal: shared dreams, friendly comparison — without leaking data.

This is the **only** phase that needs backend work. Designed last on
purpose so we can ship Phases 1–5 without it.

- New CouchDB DB `groups` (selfhosted) / Firebase node `groups/`:
  - `groupId`, `name`, `createdBy`, `members[]` (userIds), `dreamId`
- New backend route (`backend/routes/groups.js`):
  - `POST /api/groups` create, `POST /api/groups/:id/join` join
  - `GET  /api/groups/:id/leaderboard` — returns **derived metrics
    only**, no raw transactions:
    ```json
    [{ "alias": "...", "level": 7, "ratio": 0.42,
       "streakDays": 12, "lastActiveAt": "..." }]
    ```
- Frontend opt-in: Settings → Game → "Share progress with group".
  Sets `social.shareDream = true`. Until the user explicitly enables
  it, **nothing leaves the device**.
- Privacy:
  - Users push only **aggregate, derived** fields, never amounts
  - Server stores plaintext aggregates (no raw finances ever leave)
  - Aliases, never real emails
  - Leaving a group purges your row server-side
- Firebase mode: same shape via Realtime DB rules; users can only
  read members of groups they belong to.
- Out of scope: chat, comments, goal sharing beyond the dream label.

---

## 5. UX surfaces

| Surface | Where | Phase |
|---|---|---|
| Score badge in toolbar | `AppComponent` toolbar | 1 |
| Game panel | `panels/game/` (lazy import like other panels) | 1+ |
| Streak indicator | Home (next to mojo) | 1 |
| Rat-race ring | Home + Cashflow | 2 |
| Active quests | Game panel + bottom-nav badge | 3 |
| Deal card carousel | Home, dismissible | 4 |
| Coach line | Home, single sentence | 5 |
| Group leaderboard | Game panel "Group" tab | 6 |
| Settings | Profile → Settings → "Game" group | 1+ |

All surfaces hidden when `gamification.enabled === false`.

---

## 6. i18n / Translations

Add to all 6 locale files (`src/assets/i18n/{en,de,es,fr,cn,ar}.json`):

```
Game.title, Game.level, Game.xp, Game.streak, Game.ratrace,
Game.fasttrack, Game.passiveIncome, Game.expenses, Game.ratio,
Game.quest.daily, Game.quest.weekly, Game.quest.monthly,
Game.quest.<id>.title, Game.quest.<id>.desc,
Game.deal.smallTitle, Game.deal.bigTitle, Game.deal.doodadTitle,
Game.coach.<focus>,
Game.badge.<id>.title, Game.badge.<id>.desc,
Game.settings.enable, Game.settings.rule, ...
```

The Instructions panel (`panels/instructions/`) needs a new
**"Game" category** mirroring the existing structure (Accounts /
Transactions / Projects / Reports / Settings → +Game).

---

## 7. Testing strategy

| Layer | Tests |
|---|---|
| `GamificationService` unit | XP math, level curve, streak rollover at midnight, quest condition fns, rat-race phase transitions, deal-trigger rules — pure, no DB |
| Components | `game.component.spec.ts`, `rat-race.component.spec.ts` follow `templates/component.spec.template.ts` |
| Integration (backend) | groups route in `backend/tests/integration/` (Phase 6 only) |
| E2E | `e2e/game.spec.ts` — toggle on, log txns, see XP rise, complete a daily quest, see badge |
| Performance | Recalc should add < 5 ms to `transactionsUpdated$` cycle (≈10k transactions). Test in `backend/tests/unit/batch-read.test.js`-style perf block |

Pre-existing Husky pre-commit + Playwright E2E pipeline already covers the regression surface.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Users gaming XP by spam-logging | Daily cap, idempotent quest conditions, recompute from raw data not from increments |
| Wrong "passive income" classification | User-editable category → `isPassiveIncome` mapping, default seeded |
| Breaks Selfhosted parity | Phase 6 designed identical-shape for both backends; Phases 1–5 don't touch backend |
| Privacy regression in social mode | Opt-in only, derived aggregates only, server stores no raw amounts |
| Data bloat | Quest history pruned after 90 days, badge list capped at 100 (oldest dropped) |
| Performance on Pi | All work is sync, in-memory, < 5 ms; no extra HTTP round-trips |
| Forgot to encrypt new key | Routed through existing `writeAndSync` → server-side encryption applied automatically (the same path as `mojo`, `assets`, etc.) |

---

## 9. Conventional-commit-friendly task breakdown

Phase 1 (`feat(game): foundation`):
1. `feat(game): add gamification service skeleton, settings toggle and persisted state`
2. `feat(game): xp math, level curve and streak engine`
3. `feat(game): home toolbar badge and game panel UI`
4. `feat(i18n): add Game.* keys for all 6 locales`
5. `test(game): unit tests for xp math, levels, streak rollover`

Phase 2 (`feat(game): rat race`):
6. `feat(game): rat-race ratio calculation with configurable rule`
7. `feat(game): rat-race ring on home and cashflow views`
8. `feat(game): one-time fast-track unlock badge and toast`

Phase 3 (`feat(game): quests`):
9. `feat(game): seeded quest engine, library and reset boundaries`
10. `feat(game): active-quests UI in game panel + bottom-nav badge`
11. `test(game): quest condition fns and reset boundaries`

Phase 4 (`feat(game): deal cards`):
12. `feat(game): derived deal-card generator and triggers`
13. `feat(game): home deal-card carousel pre-filling existing add panels`

Phase 5 (`feat(game): coach`):
14. `feat(game): heuristic coach focus on home`

Phase 6 (`feat(game): social`):
15. `feat(backend): groups route with leaderboard aggregates`
16. `feat(game): opt-in group leaderboard tab`
17. `test(game): backend integration tests for groups route`

Each commit ships independently and respects the rule in
[docs/VERSIONING.md](VERSIONING.md): one logical change per commit, conventional types, MINOR bumps for `feat`.

---

## 10. Open questions for later

1. Should "Doodad" categories be auto-detected from spending patterns
   or opt-in tagged by the user?
2. Should levels unlock new app features (e.g. "advanced stats unlocks
   at L5") or stay purely cosmetic?
3. Should family/partner accounts (Phase 6) share **one** rat-race
   ratio or compete?
4. Soft-launch behind a `gamification.beta` flag or ship straight to GA?

These can be decided per-phase; none block Phase 1.

---

*Last updated: 2026-04-25*
