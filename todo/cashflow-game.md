# Cashflow (board game) automation — Feature Plan

**Status:** Planning — awaiting sign-off on the one new storage path (section 4) before any code lands. Not
started. Revised twice on 2026-09-25 after JFK's corrections mid-planning — see section 2 for what changed and why.

## 1. What this is

An assistant for playing Robert Kiyosaki's **Cashflow** board game physically, for any account whose email contains
`cashflow` (case-insensitive substring, the existing gate in `GameModeService.isCashflowGame()`). It replaces
today's crude "payday" mechanism — shifting **every** real transaction's date by a month
([game-mode.service.ts](../src/app/shared/services/game-mode.service.ts)) — with automation scoped to only what
the game itself creates.

This doc is a **phase roadmap** (MVP → full product) meant to be worked through and checked off across sessions,
same as `todo/fund-settlement.md` was.

## 2. Locked decisions

1. **The app is used normally for the game, with real entities.** Real `Transaction`, `Subscription`, `Asset`,
   `Investment`, `Share`, `Liability` — the same entities and the same Balance Sheet / Subscriptions pages a
   personal account uses. Game mode extends the app with automation on top, it doesn't fork a parallel bookkeeping
   model.
2. **A cashflow account is a separate universe, not a personal account with extras.** It's never used for real
   personal finances — so game mode is free to reshape the UI/flows however best serves the game (extra
   dashboards, different framing on top of the same pages), while **every non-cashflow account stays pixel-for-
   pixel unaffected** — no shared code path changes behavior for them, no extra load, nothing. The existing
   self-hosted Pro API and MCP tools are **not built to recognize or support a cashflow account** in this plan —
   that's deliberate, not an oversight (see Phase 4). If a cashflow account happens to also hold a PAT and call the
   generic tools, nothing in this plan stops it, but nothing in this plan is designed around it either.
3. **Not a Pro feature.** Everything through Phase 3 below ships on both editions, gated only by the email check,
   like every other shared feature. **Only** Phase 4 (a dedicated REST/MCP surface for an agent to play the game)
   is self-hosted Pro.
4. **Full 6-language i18n is part of "done," not a nice-to-have** — every phase that adds user-facing text ships
   translations for en/de/es/fr/cn/ar in the same commit, matching every other feature in this repo.
5. **Multiple, swappable game sets.** "Cashflow" the physical game has different editions/house rules (different
   professions, different card decks, potentially different loan terms). The data model is a **game set**
   (profession catalog + loan rule parameters + later a card deck), not a single hardcoded ruleset — so a second
   or different set is a new data file later, not a rearchitecture. v1 ships exactly one game set.
6. **Card and profession data**: JFK provides the real values for each game set; nothing is invented from the
   summarized rules. Game sets are a **static, versioned catalog in the codebase**, not per-user stored data —
   every player of a given set uses the same physical cards. One placeholder game set (obviously fake numbers)
   ships until real data arrives, so the mechanic is testable early.
7. **Money**: the new game-meta state uses integer minor units (`docs/adr/0002`, new code); the real entities it
   creates use their existing float convention, unchanged.

## 3. The one new thing: a small game-meta state

Everything financial is a real entity (decision 1). What's genuinely new is bookkeeping the game itself has no
home for, plus the pluggable game-set concept (decision 5):

```ts
// packages/domain — new module, minor units
interface CashflowGameSet {
  // static catalog, shipped in code — one now, more later, never per-user stored
  id: string;
  title: string;
  loanRule: { incrementMinor: number; monthlyInterestPercent: number }; // e.g. 100000 / 10 — but not hardcoded
  professions: CashflowProfession[];
}

interface CashflowProfession {
  id: string;
  title: string;
  salaryMinor: number;
  taxesAndExpensesMinor: number; // one lump "other expenses" figure straight off the profession card
  perChildExpenseMinor: number;
  starterKit: {
    subscriptions: Array<{
      title: string;
      account: string;
      amountMinor: number;
      frequency: SubscriptionFrequency;
    }>;
    assets?: Array<{ tag: string; amountMinor: number }>;
    investments?: Array<{ tag: string; amountMinor: number; depositMinor: number }>;
    shares?: Array<{ tag: string; quantity: number; priceMinor: number }>;
    liabilities?: Array<{ tag: string; amountMinor: number }>;
  };
}

interface CashflowGameState {
  // per-user, the one new storage path
  gameSetId: string | null; // null until chosen
  professionId: string | null; // null until picked
  round: number; // paydays taken
  virtualDate: string; // the game's own calendar (ISO date). Starts when the profession is picked, advances
  // by exactly one month per Payday click. Independent of the real wall-clock date and
  // NEVER applied to any transaction the game didn't itself just create — the fix for
  // today's bug of shifting every unrelated transaction's date.
  children: number; // 0-3
  charityRoundsLeft: number; // dice-choice rounds remaining
  unemployedRoundsLeft: number; // paydays skipped
  gameSubscriptionTitles: string[]; // which real Subscriptions belong to this game (see below)
  history: CashflowLogEntry[]; // one entry per payday/loan/quick-action, for undo + a visible audit trail
}
```

**Marking which real entities are "the game's"**: game-created Subscriptions get a `#cashflow` marker in their
`comment` (the same established convention as `#bucket:`/`#settle:` elsewhere in this codebase — not the fragile
Grow DSL, a sanctioned pattern). `gameSubscriptionTitles` in the state is the fast lookup Payday uses; the comment
marker is the durable, inspectable source of truth if that list and reality ever diverge.

Storage: **one** new path per user, `data.cashflowGame`, through the existing generic `POST/GET /api/data/{path}`
blob store — no backend route or schema change, both editions already support an arbitrary new path. **This is the
one thing I'd like your explicit go on before writing code**, per the "ask before changing the storage path" rule.
Game sets themselves need no storage path at all — they're code.

## 4. How the pieces behave

- **Choose a game set, then a profession**: creates the starter kit as real entities (Subscriptions,
  Asset/Investment/Share/Liability rows) exactly as if entered by hand, sets `professionId`/`gameSetId` and
  `virtualDate` to today.
- **Payday**: for each subscription in `gameSubscriptionTitles`, create exactly one Transaction dated at
  `virtualDate`, then advance `virtualDate` by one month and `round` by one. This does **not** call the generic
  subscription auto-generation machinery (which walks a subscription's own date window up to real "today") — that
  machinery is already skipped for cashflow accounts today (`app.component.ts`'s
  `!GameModeService.isCashflowGame()` guard), and stays skipped.
- **Undo**: pop the last history entry, delete the transactions it created, rewind `round`/`virtualDate`.
- **Bank loan** (the one fully automated financial mechanic): a dedicated action using the active game set's
  `loanRule`. Taking/repaying upserts one `Liability {tag: "Bank loan"}` and one matching
  `Subscription {title: "Bank loan interest", category: "@Bank loan", amount, #cashflow}`, recomputed on every
  change, never hand-edited.
- **Buying/selling other assets, a mortgage/car loan/etc., a Doodad card's cost**: the player uses the existing Add
  Asset / Add Investment / Add Share / Add Liability / Add Transaction panels directly for the MVP/Phase 1 — no new
  dialogs needed yet.
- **Baby / Charity / Downsized**: three quick-action buttons adjusting `children`/`charityRoundsLeft`/
  `unemployedRoundsLeft`, posting a one-off Transaction where the rule requires a payment.
- **Rat-race-exit indicator**: passive income (asset cashflow only) vs. total expenses, computed from the real
  entities the game already created.

## 5. Phase roadmap

### MVP — prove the loop works, nothing corrupts other data

The smallest slice that's actually clickable, before investing in the rest.

- Route `/cashflow-game`, gated and lazy-loaded, empty dashboard otherwise.
- One placeholder game set, one placeholder profession (obviously fake numbers).
- Choose profession → starter kit created as real entities.
- Payday → creates this round's transactions at `virtualDate`; Undo.
- Dashboard: cash, round, profession — read from the real entities the normal way.
- All 6 languages (decision 4 applies from the first commit, not deferred); no bank loan yet, no quick actions yet.
- **Exit criteria**: you can click through several rounds and the rest of the app (your own account, if you test
  as a non-cashflow user too) is untouched.

**Status: built, on `develop`, uncommitted at time of writing.** `packages/domain/src/cashflow-game/` (types,
static placeholder game set, engine, 8 tests), `CashflowGameService` (replaces `GameModeService`, which is
deleted), `AppStateService.cashflowGame` + a tier-3-style on-demand loader, the `/cashflow-game` route and
dashboard component, all 6 locales. `accounting.component`'s old round counter and its CSS are removed. Domain,
service and component tests all green; not yet played through by hand.

### Phase 1 (v1) — the playable core

- Real profession/game-set data (from you) replaces the placeholder.
- Bank loan automation (take/repay in the game set's increment, auto Subscription+Liability).
- Quick actions: baby, charity, downsized.
- Rat-race-exit indicator.
- Full 6-language i18n.
- Domain + component test coverage.
- **Exit criteria**: a live playtest with you, end to end, signed off.

### Phase 2 — digital card deck

- Deal/Market/Doodad cards: draw, resolve (buy/sell/pass), once you provide the real card catalog for this game
  set. Still one game set.
- **Exit criteria**: a full round playable without touching any existing Add panel by hand, another playtest.

### Phase 3 — multiple game sets

- Generalize the "choose game set" step (already modeled in section 3, just one set populated until now) to
  actually offer more than one: a different profession catalog, different loan terms, a different card deck — a
  new data file, no engine changes.
- **Exit criteria**: a second game set exists (even a small/house-rules one) and plays correctly alongside the
  first.

### Phase 4 — self-hosted Pro API + MCP for the game

- A dedicated REST resource group and MCP tool set for the Cashflow game (its own scopes, its own tools) — separate
  from, and not layered onto, today's generic Money Manager MCP tools (decision 2). Lets an agent play or track a
  game on your behalf.
- **Exit criteria**: playable end to end through the MCP tools, same as the UI.

### Phase 5 — stretch, not started until asked for

- Fast track (Kiyosaki's Phase 2 of the actual game).
- Any multiplayer/Auditor tracking beyond one player's own bookkeeping.

## 6. Open, not blocking the MVP

- Whether a cashflow account should be actively _blocked_ from the existing generic Pro API/MCP (a hard guard)
  rather than simply not being designed around it — flag if you want that enforced rather than assumed.
- Whether professions/card decks ever get an in-app editor instead of shipped-in-code data — not needed while
  you're the source of the data.
