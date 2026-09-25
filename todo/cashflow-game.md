# Cashflow (board game) automation — Feature Plan

**Status:** MVP committed (`f1c1910`). Phase 1's companion-mode resolutions (Baby/Charity/Downsized, bank loan,
Payday's skip/charity-tick fix) are built but not yet committed — see the status notes under Phase 1 below. Not yet
playtested with real profession/board/card data.

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
8. **Two play modes, one shared resolution engine** (2026-09-26): a "turn" is landing on a **space**, not just
   clicking Payday. JFK's primary use case is playing the physical board with a real die and (optionally) another
   person, using the app only to simulate what a space does and, later, to reveal its card:
   - **Companion mode** (build first): the player moves their own token on the physical board. In the app they
     just say which space they landed on; the app resolves it (Payday's math today, Baby/Charity/Downsized next,
     Deal/Market/Doodad once Phase 2's card data exists). No token position is tracked.
   - **Solo mode** (later, tied to a game set that actually provides a `board` — "mit weiteren Gamesets" per JFK):
     the app itself rolls the die and moves a token around a digitized board, landing on and resolving spaces
     automatically — playing a whole life with no physical board and no second person.
   - Both modes call the same per-space resolution function; solo mode is only an extra layer (dice + position) on
     top of what companion mode already needs. A game set's `board` (the space sequence) is real physical-game
     content, so it's provided by JFK the same as professions and cards (decision 6) — a small placeholder board
     ships meanwhile.

## 3. The one new thing: a small game-meta state

Everything financial is a real entity (decision 1). What's genuinely new is bookkeeping the game itself has no
home for, plus the pluggable game-set concept (decision 5):

```ts
// packages/domain — new module, minor units
type CashflowSpaceKind =
  'payday' | 'dealBig' | 'dealSmall' | 'market' | 'doodad' | 'baby' | 'charity' | 'downsized';

interface CashflowGameSet {
  // static catalog, shipped in code — one now, more later, never per-user stored
  id: string;
  title: string;
  loanRule: { incrementMinor: number; monthlyInterestPercent: number }; // e.g. 100000 / 10 — but not hardcoded
  professions: CashflowProfession[];
  /**
   * The physical board's space sequence, in order — real game content from
   * JFK, like professions. Optional: a game set with no board can still be
   * played in companion mode (the player says what they landed on); solo
   * mode (decision 8) needs it to roll a die and move a token.
   */
  board?: CashflowSpaceKind[];
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
  mode: 'companion' | 'solo'; // decision 8 — chosen when the game starts
  boardPosition: number | null; // solo mode only; null in companion mode (no token tracked)
  round: number; // paydays taken
  virtualDate: string; // the game's own calendar (ISO date). Starts when the profession is picked, advances
  // by exactly one month per Payday. Independent of the real wall-clock date and NEVER
  // applied to any transaction the game didn't itself just create — the fix for today's
  // bug of shifting every unrelated transaction's date.
  children: number; // 0-3
  charityRoundsLeft: number; // dice-choice rounds remaining
  unemployedRoundsLeft: number; // paydays skipped
  gameSubscriptionTitles: string[]; // which real Subscriptions belong to this game (see below)
  history: CashflowLogEntry[]; // one entry per resolved space/loan action, for undo + a visible audit trail
}
```

Today only `payday` is a resolvable space kind (the MVP); `baby`/`charity`/`downsized` are next (Phase 1, no card
data needed), `dealBig`/`dealSmall`/`market`/`doodad` need Phase 2's real card catalog first. Companion mode calls
the resolver directly with whichever kind the player says they landed on; solo mode (Phase "board simulation"
below) calls it after rolling and moving.

**Marking which real entities are "the game's"**: game-created Subscriptions get a `#cashflow` marker in their
`comment` (the same established convention as `#bucket:`/`#settle:` elsewhere in this codebase — not the fragile
Grow DSL, a sanctioned pattern). `gameSubscriptionTitles` in the state is the fast lookup Payday uses; the comment
marker is the durable, inspectable source of truth if that list and reality ever diverge.

Storage: **one** new path per user, `data.cashflowGame`, through the existing generic `POST/GET /api/data/{path}`
blob store — no backend route or schema change, both editions already support an arbitrary new path. **This is the
one thing I'd like your explicit go on before writing code**, per the "ask before changing the storage path" rule.
Game sets themselves need no storage path at all — they're code.

## 4. How the pieces behave

- **Choose a game set, a profession, and a mode** (companion or solo, decision 8): creates the starter kit as real
  entities (Subscriptions, Asset/Investment/Share/Liability rows) exactly as if entered by hand, sets
  `professionId`/`gameSetId`/`mode` and `virtualDate` to today; `boardPosition` starts at 0 in solo mode.
- **A turn = landing on (or crossing) a space.** In companion mode the player rolled their physical die and moved
  their own token, then tells the app which space kind they landed on. In solo mode the app rolls and moves the
  token itself, then resolves whatever it landed on the same way. Per JFK's original rules, Payday fires **on
  landing or on crossing** — solo mode's move step checks every space passed over, not just the final one.
- **Payday** (the only resolvable kind today — MVP): for each subscription in `gameSubscriptionTitles`, create
  exactly one Transaction dated at `virtualDate`, then advance `virtualDate` by one month and `round` by one. This
  does **not** call the generic subscription auto-generation machinery (which walks a subscription's own date
  window up to real "today") — that machinery is already skipped for cashflow accounts today
  (`app.component.ts`'s `!CashflowGameService.isCashflowGame()` guard), and stays skipped.
- **Undo**: pop the last history entry, delete the transactions it created, rewind `round`/`virtualDate`.
- **Bank loan** (the one fully automated financial mechanic): a dedicated action using the active game set's
  `loanRule`. Taking/repaying upserts one `Liability {tag: "Bank loan"}` and one matching
  `Subscription {title: "Bank loan interest", category: "@Bank loan", amount, #cashflow}`, recomputed on every
  change, never hand-edited.
- **Buying/selling other assets, a mortgage/car loan/etc., a Doodad card's cost**: the player uses the existing Add
  Asset / Add Investment / Add Share / Add Liability / Add Transaction panels directly for the MVP/Phase 1 — no new
  dialogs needed yet.
- **Baby / Charity / Downsized**: resolving one of these spaces (companion: the player says they landed on it;
  solo: the board move lands on it) adjusts `children`/`charityRoundsLeft`/`unemployedRoundsLeft`, posting a
  one-off Transaction where the rule requires a payment.
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

### Phase 1 (v1) — companion mode, the playable core

Targets JFK's primary use case: play the physical board with a real die (and optionally another person), use the
app to simulate what each space does.

- Real profession/game-set data, and a real board space sequence (from you) replaces the placeholders.
- A "which space did you land on?" trigger (companion mode) — one shared resolver behind Payday and the three
  below, instead of disconnected buttons.
- Baby / Charity / Downsized resolutions (no card data needed).
- Bank loan automation (take/repay in the game set's increment, auto Subscription+Liability) — usable any time,
  not tied to a space.
- Rat-race-exit indicator.
- Full 6-language i18n.
- Domain + component test coverage.
- **Exit criteria**: a live playtest with you, end to end, signed off — playing the physical board, using the app
  only for Payday/Baby/Charity/Downsized/loans (Deal/Market/Doodad spaces are noted but not yet resolved).

**Status: mostly built, not yet committed.** Baby/Charity/Downsized resolutions and bank loan automation are done
in the engine (`resolveCashflowBaby/Charity/Downsized`, `adjustCashflowBankLoan`, 9 new domain tests), the service
(`CashflowGameService.resolveBaby/Charity/Downsized/adjustBankLoan`, 7 new tests) and the dashboard (a "which space
did you land on?" section, a bank-loan form, status badges, all 6 locales). Payday now correctly skips outright
during an active `unemployedRoundsLeft` and ticks `charityRoundsLeft` down, both reversibly by Undo. Still
placeholder data (no real professions/board/cards from you yet), and the rat-race-exit indicator isn't built —
it needs a clean way to tell salary from passive income that the engine doesn't have yet.

### Phase 2 — digital card deck

- Deal/Market/Doodad spaces fully resolvable: draw, reveal, resolve (buy/sell/pass), once you provide the real
  card catalog for this game set. Still companion mode, still one game set.
- **Exit criteria**: a full round playable without touching any existing Add panel by hand, another playtest.

### Phase 3 — solo board simulation

- The mode JFK described as "mit weiteren Gamesets": the app rolls the die itself, moves a token along the game
  set's `board`, and resolves whatever it lands on (or crosses, for Payday) — a whole life playable with no
  physical board and no second person. Needs a game set that actually supplies `board`.
- **Exit criteria**: a full solo game playable end to end, another playtest.

### Phase 4 — multiple game sets

- Generalize the "choose game set" step (already modeled in section 3, just one set populated until now) to
  actually offer more than one: a different profession catalog, board, loan terms, card deck — a new data file, no
  engine changes.
- **Exit criteria**: a second game set exists (even a small/house-rules one) and plays correctly alongside the
  first, in both modes.

### Phase 5 — self-hosted Pro API + MCP for the game

- A dedicated REST resource group and MCP tool set for the Cashflow game (its own scopes, its own tools) — separate
  from, and not layered onto, today's generic Money Manager MCP tools (decision 2). Lets an agent play or track a
  game on your behalf.
- **Exit criteria**: playable end to end through the MCP tools, same as the UI.

### Phase 6 — stretch, not started until asked for

- Fast track (Kiyosaki's Phase 2 of the actual game).
- Multiplayer tracking beyond one player's own bookkeeping (today: each player is simply their own "cashflow"
  account).

## 6. Open, not blocking the MVP

- Whether a cashflow account should be actively _blocked_ from the existing generic Pro API/MCP (a hard guard)
  rather than simply not being designed around it — flag if you want that enforced rather than assumed.
- Whether professions/card decks ever get an in-app editor instead of shipped-in-code data — not needed while
  you're the source of the data.
