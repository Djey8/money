# Cashflow (board game) automation — Feature Plan

**Status:** MVP committed (`f1c1910`), companion-mode resolutions committed (`459fe21`), the Downsized fix + Grow
reuse + docs guide committed (`106affd`). A Deal-card feature (plan, then decide, then buy — decisions 10/14) is
built, not yet committed — see the status notes under Phase 1. Not yet playtested (JFK can't sit at a computer right
now; we're
developing ahead theoretically, per his explicit go-ahead, until he can).

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
9. **Baby/Charity/Downsized's "N rounds" are the physical board's turn order, not Paydays** (correction,
   2026-09-26 — JFK: _"it's not that you have to skip two salaries"_). Downsized pays total expenses once, then the
   player sits out while **opponents** take their next 2 turns; Charity lets the player choose 1 or 2 dice for
   their own next 3 turns. A single-player companion tool has no visibility into other players' turns, so
   `charityRoundsLeft`/`unemployedRoundsLeft` are **reminders the player manages themselves** (a dismiss action,
   `clearCashflowStatus`) — **Payday is never gated or skipped by them.** This reverses the MVP's first (wrong)
   implementation, which auto-skipped Payday.
10. **Deal-card purchases (shares, property) are not a new feature — they're the app's existing Grow feature**
    (2026-09-26, JFK: _"you already know with our app all the... how to calculate the passive income... what is
    different here?"_). A Small Deal share purchase is a Grow project (`kind: share`); a property (Small or Big
    Deal) is a Grow project (`kind: investment`) with its deposit, mortgage and periodic cashflow — Grow's existing
    buy/sell/deposit/cashflow/payback actions already do everything the game needs: deposit paid now, mortgage as a
    real Liability, cashflow added to the real income statement and a Subscription automatically. **No new buy/sell
    UI, no new entity types.** The Cashflow game only adds a decision-support layer on top (Deal card context, the
    debt-vs-cashflow tradeoff — see `docs/domain/CASHFLOW_GAME_GUIDE.md`), never the mechanics themselves. Shares
    are a **liquidity/capital-gains tool** here, not passive income — only property cashflow counts as passive
    income (relevant once the rat-race indicator is built). Every Grow project/Asset/Investment/Share/Liability on
    a cashflow account belongs to the game outright (decision 2 — the whole account is the game), no `#cashflow`
    marker needed, unlike Subscriptions.
11. **Losing**: JFK, 2026-09-26: _"the moment we go on a negative cashflow for the next months, game is over."_
    `computeMonthlyCashflowMinor` (income minus expenses across every Subscription the game owns) — surfaced only
    as a warning banner once negative (decision 13 says don't duplicate the number itself). Advisory, like
    everything else here — it doesn't lock the UI.
12. **Rules and strategy are documented for the player, not just the agent**: `docs/domain/CASHFLOW_GAME_GUIDE.md`
    (JFK: _"I would like to have a page describing the basic rules of this game... you as a user, you have a way
    to read all of this"_). It's picked up by `explain_concept` automatically like every other `docs/domain/*.md`
    file, and is readable directly as a file/on GitHub. **Open point**: whether it should also render in-app (the
    existing `docs.component.ts` is hand-authored TS content for self-hosted setup docs, a different thing, and
    isn't a markdown viewer) — not built; flag if you want that specifically.
13. **Reuse the app's own views; don't duplicate them** (2026-09-26, JFK: _"I want to use the normal app as much
    as possible... in Subscription we already have the monthly cashflow view... stats, even budget if you want"_).
    The dashboard dropped its own "cash" and "monthly cashflow" tiles in favor of a single shared `cash` getter
    (used internally for deal affordability too) and plain links out to Subscriptions/Grow/Balance
    Sheet/Stats/Budget. Only what has no home elsewhere — Payday, space resolutions, the bank loan, Deal
    plan/execute — gets its own UI here.
14. **A Deal card is a Grow project, planned then decided, not bought in one step** (2026-09-26, JFK: _"every card
    we add this as a grow feature... first plan (you have the option), then you make it reality"_).
    `planDeal` saves the numbers as a Grow project's **plan** — exactly Grow's own existing plan/action split
    (`docs/domain/GROW_GUIDE.md` §3–4) — with no money moved. `executeDeal` is the moment the player says yes: it
    reads the plan's numbers and runs the same automated buy as before (auto-borrow any shortfall, `Fire` account,
    real Grow/Share/Investment/Liability/Subscription). A Grow project with a plan but no matching Share/Investment
    entry yet is "planned, not bought" (`plannedDeals`) — buying more later is just planning the extra amount and
    executing again; the calculators already add to whatever position exists. **Selling needs no new code either**
    (2026-09-26, JFK: _"sell we already have, once I bought the grow project, I have the option to sell"_) — the
    existing Grow page's `sellProject` already pays off the mortgage correctly (`calculateSellInvestment`). One
    known gap, to confirm at playtest rather than guess at now: it has no way to know about the `<Title> Cashflow`
    Subscription `executeDeal` created, so that keeps paying out after a sale until it's removed by hand — a small
    fix if playtest confirms it matters, not a redesign.
15. **The whole truth of the game lives in Transactions, Subscriptions (for the current setup) and the Balance
    Sheet/Grow** (2026-09-26, JFK, restating decision 1 explicitly). `CashflowGameState` holds no financial fact —
    only bookkeeping metadata that isn't itself money (`round`, `professionId`, the reminder counters). If a number
    matters financially, it must be reconstructable from those real entities alone, never from the game-meta state.

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
- **Undo**: pop the last history entry, delete the transactions it created, rewind `round`. Payday only (undoing
  Baby/Charity/Downsized isn't built — see §6 open points).
- **Bank loan** (the one fully automated financial mechanic): a dedicated action using the active game set's
  `loanRule`. Taking/repaying upserts one `Liability {tag: "Bank loan"}` and one matching
  `Subscription {title: "Bank loan interest", category: "@Bank loan", amount, #cashflow}`, recomputed on every
  change, never hand-edited.
- **Deal card (`planDeal` then `executeDeal`)**: `planDeal` saves the deal's numbers as a Grow project's plan — no
  money moves, matching Grow's own plan/action split (decision 14). `executeDeal` is the decision to actually buy:
  auto-borrows any shortfall via the Bank loan mechanic, then runs the exact same Grow buy calculators/DSL/account
  (`Fire`) a personal account's own Grow page would (decision 10). A property (`kind: investment`) additionally
  gets a real Subscription for its cashflow. `plannedDeals` lists projects with a plan but no matching
  Share/Investment yet — "you have the option" until you call `executeDeal`. Selling (with cleanup — the
  cashflow Subscription, the mortgage, the position) is future work, not built. A Doodad card's one-off cost: the
  existing Add Transaction panel.
- **Baby**: +1 child (max 3), scales a dedicated "Children Expenses" Subscription that then feeds every future
  Payday.
- **Charity**: pay 10% of current income once; sets a `charityRoundsLeft` reminder (not auto-decremented by
  Payday — decision 9).
- **Downsized**: pay total expenses once; sets an `unemployedRoundsLeft` reminder and clears any active charity
  reminder. **Never gates or skips Payday** (decision 9 — this was the MVP's bug, now fixed).
- **Dismissing a reminder** (`clearCashflowStatus`): the player says their own physical turns have played out;
  zeroes the counter, no financial effect, not logged to history.
- **Monthly cashflow / bankruptcy warning**: `computeMonthlyCashflowMinor` sums every Subscription the game owns;
  shown live on the dashboard, a warning banner once negative (decision 11).
- **Rat-race-exit indicator**: passive income (property/`investment`-kind Grow cashflow only, **not** share
  trades — decision 10) vs. total expenses. Not built yet — needs a clean way to read only investment-kind Grow
  cashflow for a cashflow account's projects.

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
  for Payday/Baby/Charity/Downsized/loans/Deal-card purchases (the last via the existing Grow feature, decision
  10 — Market/Doodad spaces still need real card data, Phase 2).

**Status: built across three commits, a fourth pending.** Commit 1 (`459fe21`): Baby/Charity/Downsized resolutions
and bank loan automation. Commit 2 (`106affd`): the Downsized/Payday-skip correction (decision 9 — Payday is
unconditional again, `clearCashflowStatus` lets the player dismiss a reminder themselves), `computeMonthlyCashflowMinor`,
and `docs/domain/CASHFLOW_GAME_GUIDE.md` (decision 12). Commit 3 (in progress, 2026-09-26): the dashboard now reuses
the app's own views instead of duplicating them (decision 13 — links to Subscriptions/Grow/Balance
Sheet/Stats/Budget, one shared `cash` getter); and the Deal feature, `planDeal`/`executeDeal`/`plannedDeals` on
`CashflowGameService` (decision 14) — a Deal card becomes a real Grow project's plan, the player decides whether
to execute it, execution auto-borrows any shortfall and buys through the exact same Grow mechanics a personal
account uses. Still placeholder profession/board/card data. Selling needs no new code (decision 14) — the
existing Grow page's `sellProject` already does it, a stale `<Title> Cashflow` Subscription after a sale is a
playtest-confirm item, not built preemptively. Not built: the rat-race-exit indicator (well-defined now —
property-cashflow Grow projects only, decision 10 — just not wired up).

### Phase 2 — digital card deck

- Deal/Market/Doodad **cards** (the text/values/context — a Deal card's asking price, a Market event, a Doodad's
  cost) fully resolvable: draw, reveal, resolve, once you provide the real card catalog for this game set. The
  Deal mechanics themselves need no new code (decision 10) — this phase is the card catalog plus a thin "here's
  what you drew, here's the affordability/debt-vs-cashflow context" layer in front of the existing Grow actions,
  not a new buy/sell system.
- **Exit criteria**: a full round playable without touching the Grow page's own forms _unprompted_ — the game
  still routes you there for the actual purchase, but tells you what to enter.
- **If playtest confirms the stale-cashflow-Subscription gap (decision 14) matters**: remove `<Title> Cashflow`
  when a sale (via the existing Grow `sellProject`) brings that position to zero.

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
- Undo is Payday-only. Baby/Charity/Downsized aren't undoable yet (fix by hand: delete the transaction, adjust
  `children`/edit the Subscription) — flag if this needs building before the playtest.
- `docs/domain/CASHFLOW_GAME_GUIDE.md` isn't rendered in-app — readable as a file/on GitHub today. Say if you want
  an in-app "Rules" view; the app has no markdown viewer to reuse for that yet.
- The rat-race-exit indicator (decision 10/11): reading only investment-kind Grow project cashflow cleanly isn't
  built.
