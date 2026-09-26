# Cashflow (board game) automation — Feature Plan

**Status:** MVP committed (`f1c1910`), companion-mode resolutions committed (`459fe21`), the Downsized fix + Grow
reuse + docs guide committed (`106affd`), find/draw-a-card + the menu entry + `resetGame` committed
(`459fe21`..`eae5cfb`). Decision 18 (itemized categorized expenses, computed starting cash, the real `cashflow`
game set with the Hausmeister/in profession, AND the overlay/panel UI conversion) committed across `dd416e7` and
`dd82039`. Decisions 19–21 (hiding the `placeholder` fixture from players, completing the View Card stats, moving
the reset button into Settings → Advanced, and fixing the bootstrap-timing bug that made Start Game a no-op) are
built and green (domain + frontend tests, full typecheck, both editions build), not yet committed as of this note.
Not yet playtested (JFK can't sit at a computer right now; we're developing ahead theoretically, per his explicit
go-ahead, until he can).

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
    existing Grow page's `sellProject` already pays off the mortgage correctly (`calculateSellInvestment`). It had
    no way to know about the `<Title> Cashflow` Subscription `executeDeal` created, though, so it would have kept
    paying out after a sale — JFK confirmed this needed fixing outright rather than waiting for playtest: fixed in
    `add.component.ts`'s existing "Sell Investment" handling (the one place that already detects a fully-closed
    position), gated behind `CashflowGameService.isCashflowGame()` so a normal account's sell is untouched.
15. **The whole truth of the game lives in Transactions, Subscriptions (for the current setup) and the Balance
    Sheet/Grow** (2026-09-26, JFK, restating decision 1 explicitly). `CashflowGameState` holds no financial fact —
    only bookkeeping metadata that isn't itself money (`round`, `professionId`, the reminder counters). If a number
    matters financially, it must be reconstructable from those real entities alone, never from the game-meta state.
16. **A card comes into play two ways** (2026-09-26, JFK: _"1) if I play with the real board, I pick a card and in
    the app I want to select (find) this card. 2) in this app we pick randomly a card"_). Both apply to any of the
    four physical decks (`dealSmall`/`dealBig`/`market`/`doodad`):
    - **Find** (`findCardsInDeck`, a real physical deck in hand): case-insensitive substring search on title — real
      cards aren't numbered, so title is what a player can actually search by.
    - **Draw** (`drawCard`, no physical deck): picks at random from whatever this deck hasn't already given out
      since its last reshuffle (`state.drawnCardIds`, per deck); reshuffles automatically once exhausted.
    - **Resolving what you found/drew**: a Deal card (`assetKind: share | investment`) plans it exactly like the
      manual form (`applyDealCard` → `planDeal`, decision 14) — the player still separately decides whether to
      execute it. A Doodad card is a single mandatory expense (`applyDoodadCard`, its own account/amount, not
      routed through Grow). A Market card is text only — real Market cards vary too much (a sale offer, a global
      event, a special case) to model generically without the real catalog; the player acts on it through the
      app's existing features. One placeholder card per deck ships now (decision 6), same spirit as the
      placeholder profession.
17. **Reset everything, with no confirmation prompt beyond the one destructive-action confirm** (2026-09-26, JFK:
    _"a reset button where everything is cleaned... for now we don't have to save the history or status of the
    game"_). `CashflowGameService.resetGame` wipes every real entity the game touches (Transactions,
    Subscriptions, Grow/Share/Investment/Asset/Liability, Smile/Fire/Mojo) and `CashflowGameState` itself back to
    blank — a testing/playtest convenience, not a feature of the physical game. Double-gated behind
    `isCashflowGame()` even though the whole page already is, since this is the single most destructive action in
    the app. No soft-delete, no undo — decision 15 already means nothing here needs to survive a reset except the
    real entities that were there. **The trigger button itself later moved into Settings** — see decision 19.
18. **The Cashflow game becomes a slide-in overlay panel, not a routed page — and every profession card gets its
    own real profession data, not one lump figure** (2026-09-26, JFK, giving the real "Hausmeister/in" card as the
    first example, with more to follow: _"this feature cash flow is just a component and I would say it should be
    an add-on component you open up and then close... we never put any category in... it could be exactly the name
    of the expense. So Steuern, it's category Steuern... we begin with Ersparnisse as a start amount and we add one
    time the current cash flow and that's how you start with game zero"_). Concretely:
    - `CashflowProfession.expenses: CashflowExpenseLine[]` replaces the old single `taxesAndExpensesMinor` lump —
      one `{title, amountMinor}` per line straight off the card, each becoming its own Subscription **and**
      `@`-category of that same title (a zero-amount line, e.g. an unused loan type, is skipped). This is what
      makes Budget/Stats break spending down exactly the way the physical card does.
    - Starting cash is **computed, never hand-entered**: `savingsMinor` (the card's "Ersparnisse") plus one month's
      cashflow (salary minus the sum of `expenses`) — `computeCashflowProfessionMonthlyCashflowMinor` in
      `engine.ts`. `PickProfessionResult.startingCashTransaction` is derived from this, same as before.
    - `CashflowStarterKit.subscriptions` is gone — `pickCashflowProfession` now builds the salary + per-expense-line
      Subscriptions itself (from `expenses`) and returns them as a new top-level `PickProfessionResult.subscriptions`
      field, sibling to `starterKit` (which now only ever holds non-derived balance-sheet facts: `assets`,
      `investments`, `shares`, `liabilities`). Card/profession figures are stored **positive**, matching how
      they're printed — the engine negates each one (salary is the exception, staying positive as income) at the
      point it becomes a Subscription/Transaction; `perChildExpenseMinor` flipped from negative to positive to
      match, and `resolveCashflowBaby` now negates it explicitly.
    - A new real game set, `id: 'cashflow'` (title still says "board/cards still to come"), holds JFK's real
      professions as he sends each one — Hausmeister/in is the first, transcribed exactly (salary 1.600€, seven
      itemized expense lines with two currently zero, "Ausgaben pro Kind" 100€, Ersparnisse 600€, three starting
      liabilities). It's first in `CASHFLOW_GAME_SETS`, ahead of the placeholder, so it's the default. Explicitly
      scoped by JFK to just this one profession for now: _"just implement the Hausmeister and later we have our own
      game sets. And I give you also for this game set all the professions we have."_ More real professions, and
      eventually a friendlier way to manage this data (JFK: "later on... it could be completely different ones
      where we could modify a bit more"), are deliberately deferred.
    - **UI architecture change**: the game moves from its own route (`/cashflow-game`) into an always-hosted overlay
      panel matching the app's existing Add/Info modal-dialog pattern (`isOpen`/`highlight()`/`closeWindow()`,
      `role="dialog"`, hosted directly in `app.component.html`) — "not the main place to play the game." Starting a
      game closes the overlay and lands on `/home` with everything already posted, so the player browses
      Balance/Stats/etc. through the normal app immediately. Profession selection supports both a direct pick and a
      "shuffle" (random pick), and shows the full card (income, itemized expenses, liabilities, starting cash) —
      with an info affordance to reopen that same card view later, during the game, not just at selection time. The
      menu entry becomes a full-row-width button (it's alone in its row) that toggles the panel instead of routing.
      **Built**, alongside the data-model half: `CashflowGameComponent` now carries `static isOpen`/`zIndex`,
      `highlight()`/`closeWindow()` exactly matching Add/Info/Menu, is hosted directly in `app.component.html`
      (`<app-cashflow-game>`), and the `/cashflow-game` route is gone. `MenuComponent.clickedCashflowGame()` sets
      `CashflowGameComponent.isOpen = true` instead of navigating; the menu button spans the full row
      (`.menu-item--full-row`, `grid-column: 1 / -1`). `startGame()` closes the panel and navigates to `/home` on
      success. `shuffleProfession()` picks a random profession from the selected game set; `openProfessionCard`/
      `closeProfessionCard` show the full card (salary, itemized expenses, per-child expense, savings, computed
      starting cash, liabilities) both at selection time and via an "ℹ" button next to the active profession's
      title during the game.
19. **A player must never see the internal "placeholder" test fixture, and the profession card must show every
    derivable figure, not just the ones already needed elsewhere** (2026-09-26, JFK: _"can you replace the
    Placeholder profession with hausmeister and add all the values this card has, and please finish the View Card
    fields, with all the attributes"_). The `placeholder` game set (decision 6) stays exactly as-is in
    `packages/domain` — deleting it would re-couple engine/service tests to JFK's real, still-growing card data,
    exactly what decision 6 was written to avoid. Instead `CashflowGameComponent.playableGameSets` filters it out
    of the "Game set" dropdown (and that field is hidden entirely while only one playable set exists), so a real
    account can never select it or see "Placeholder profession" — `cashflow`/Hausmeister is the only thing a
    player can ever reach. The View Card modal gained two stats it was missing — `professionTotalExpenses` (sum of
    every `expenses` line) and `professionMonthlyCashflow` (salary minus that sum, the same figure
    `computeCashflowProfessionMonthlyCashflowMinor` already fed into starting cash) — so every figure the physical
    card implies is now shown explicitly, not just the ones the starting-cash formula happened to need.
20. **The reset button moved out of the game panel and into Settings → Advanced, styled and gated like account
    deletion** (2026-09-26, JFK: _"the reset game button should be in the settings component under advanced above
    delete, in the same design as the delete button. And the button should only appear if a game is already
    running"_). `SettingsComponent.resetCashflowGame()` (same `ConfirmService.confirm` + `CashflowGameService
.resetGame` call the panel used to make) replaces `CashflowGameComponent.resetGame()`, which is deleted —
    the panel no longer has a reset entry point at all. The settings-page button reuses the exact
    `settings-menu-item delete-item` class the account-deletion button uses, sits directly above it, and is
    `*ngIf="isCashflowGameActive"` — visible only once `AppStateService.instance.cashflowGame.professionId` is set
    (double-gated with `CashflowGameService.isCashflowGame()`, same defensive pattern as everywhere else in this
    feature).
21. **Bug fix: nothing showed and Start did nothing, for every player** (2026-09-26, JFK: _"I cant start a game and
    I dont see the data for out dataset, there is no profession to be selected"_ / _"Start game is not doing
    anything"_). Root cause: converting the panel to be hosted eagerly at app bootstrap (decision 18) meant
    `CashflowGameComponent`'s constructor now runs before login/profile data has loaded — but `selectedProfessionId`
    was only ever populated inside `ngOnInit()`, gated behind `CashflowGameService.isCashflowGame()` (itself gated
    on `ProfileComponent.mail`, populated asynchronously by auth). That gate failed at construction time, and since
    `ngOnInit()` only runs once, `selectedProfessionId` stayed `''` forever — `startGame()`'s own guard
    (`if (!selectedProfessionId) return`) then made the button silently do nothing. Fixed by removing the
    auth-timing dependency entirely: `selectedGameSetId`/`selectedProfessionId` are now plain field initializers
    (no gate, since picking a default profession is harmless for anyone and the whole panel is invisible to a
    non-cashflow account regardless), and the one thing that _does_ need to wait for auth — loading the persisted
    `cashflowGame` state — moved out of `ngOnInit` into a new `static CashflowGameComponent.open()`, called only
    from `MenuComponent.clickedCashflowGame()`. By the time a player can actually click that menu entry, the menu's
    own `*ngIf="isCashflowGame()"` binding has already re-evaluated correctly (unlike a one-shot lifecycle hook),
    so the auth race is structurally gone, not just delayed. `CashflowGameComponent.instance` (a static
    self-reference set in the constructor, same pattern `AppComponent`/`AppStateService` already use) is what lets
    a static method reach the one open instance's injected `AppDataService`.

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
  // decision 18 — itemized expenses, computed starting cash, positive card-printed figures
  id: string;
  title: string;
  salaryMinor: number;
  expenses: Array<{ title: string; amountMinor: number }>; // one line per card expense; title doubles as
  // the real Subscription's title AND its `@`-category; a zero-amount line is skipped
  perChildExpenseMinor: number; // "Ausgaben pro Kind", positive as printed
  savingsMinor: number; // "Ersparnisse" — starting cash = this + one month's cashflow (salary - expenses)
  starterKit: {
    // non-derived balance-sheet facts only — the Subscriptions above are derived, not stored here
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
account uses. Selling needs no new code (decision 14) — the existing Grow page's `sellProject` already does it;
the one gap it had, a stale `<Title> Cashflow` Subscription surviving a sale, is fixed (`add.component.ts`'s
existing Sell Investment handling now also removes it, gated to cashflow accounts). Find/draw a card (decision 16) — `packages/domain/src/cashflow-game/cards.ts` (`drawRandomCard`/`findCards`, deck-agnostic, 7 tests),
`CashflowGameService.findCardsInDeck`/`drawCard`/`applyDealCard`/`applyDoodadCard`, a "Cards" dashboard section,
one placeholder card per deck. A menu entry (`f1c1910` shipped the route with nothing linking to it — fixed).
`resetGame` (decision 17): wipes every real entity plus the game-meta state, one confirm, gated to cashflow
accounts. All of the above across commits `459fe21`..`c529ecf`. Still placeholder profession/board/full card
data. Not built: the rat-race-exit indicator (well-defined now — property-cashflow Grow projects only, decision
10 — just not wired up).

### Phase 2 — the real card catalog

- Find/draw/resolve is already built (decision 16) — this phase is just replacing the one placeholder card per
  deck with JFK's real catalog. A Deal card's exact numbers, a Market event's real text, a Doodad's real cost.
  No new mechanism needed, only data.
- A debt-vs-cashflow context note shown alongside a Deal card before planning it (decision 10's strategy point,
  `CASHFLOW_GAME_GUIDE.md` §4) — the one still-open piece of UI work, everything else here is data entry.
- **Exit criteria**: a full round playable with the real deck, another playtest.

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
