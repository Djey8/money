# Cashflow (board game) automation — Feature Plan

**Status:** MVP committed (`f1c1910`), companion-mode resolutions committed (`459fe21`), the Downsized fix + Grow
reuse + docs guide committed (`106affd`), find/draw-a-card + the menu entry + `resetGame` committed
(`459fe21`..`eae5cfb`). Decision 18 (itemized categorized expenses, computed starting cash, the real `cashflow`
game set with the Hausmeister/in profession, AND the overlay/panel UI conversion) committed across `dd416e7` and
`dd82039`. Decisions 19–28 (hiding the `placeholder` fixture from players, completing the View Card stats, moving
the reset button into Settings → Advanced, the bootstrap-timing fix, itemized Savings/Salary/expense starting
transactions, the missing-category bug in Payday/Charity, Downsized paying real per-line expenses, and the
step-by-step dashboard flow) are committed across `80f0b13`/`6508774` and earlier. Decision 29 (the real fix for
stale visuals after Cashflow actions — `transactionsUpdated$`/`subscriptionsUpdated$` instead of the page reloads
decisions 24/28 had used) is committed (`d2c4b5f`). Decision 30 (the profession card's Income Statement/Balance
Sheet, both starting and live — plus the `gameSubscriptionTitles` bug found while building it, flagged not fixed)
is committed (`29a433b`). JFK's first real playtest is underway. Decisions 31–35 (reliably detecting an active
game for the reset button, Start Game posting only Savings so Subscriptions can be edited before the first real
Payday, Payday spreading transactions across the month and aging older ones back so Stats reads like real time
passed, the profession card's Starting/Live toggle reusing the app's own Cashflow widget design, and disabling the
generic subscription auto-generation machinery for cashflow accounts everywhere it could still fire) are committed
(`bf0f7d4`, `7aef497`). Decisions 36–37 (dropping the rat-race bars and sizing the mini cashflow box to its own
amount pills, then putting Passive Income back as a row inside that same box) are committed (`0f764b2`, `97fad4f`).
Decision 38 (removing the manual Deal-card form, dropping Payday from the space grid and fixing it to two rows of
three, hiding Bank Loan/Payback Loan behind their own triggers with a Back button, and moving the Menu button to
the end of the dashboard as a real button) is committed (`36242c9`). Decision 39 (Payday dates each transaction
from its own Subscription's `startDate` day, not an auto-computed spread) is committed (`c99e655`). Decisions
40–41 (a general full-state "undo the last action" replacing the Payday-only undo that silently refused to undo
Baby/Charity/Downsized/loan actions; missing categories filled in — Salary, Children Expenses, Bank loan interest,
a bought property's Cashflow subscription, a Doodad's transaction; and smart non-overlapping default dates for
every auto-created Subscription, not just Payday's own) are committed (`7230577`). Decision 42 (spacing between the
dashboard's cards, a redesigned Bank Loan trigger and Menu row — the actual bug behind the "messed up" look was the
global `.btn` class's 80%-width/10%-margin-left box model fighting a width override — and History hidden behind its
own trigger with a Category column) is committed (`4740fcd`). Decision 43 (persisting the undo stack to raw
`localStorage` so it survives a reload/`npm start` restart, explicitly cleared on logout in both editions) is
committed (`591f5e0`). Decision 44 (a Category column on the Subscriptions page, previously missing for every
subscription, not just Cashflow ones — decision 41's category fixes were correct the whole time, just invisible)
is committed (`2552029`). Decision 45 (borrowing/repaying a bank loan now actually moves cash via a real
Transaction, fixing a real bug that also silently broke `executeDeal`'s auto-borrow) is built and green (domain +
frontend tests, full typecheck, both editions build), not yet committed as of this note. The framework
in decision 27 is what's needed before wiring up the first real Card Deck (Phase 2, next).

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
      `engine.ts`. `PickProfessionResult.startingTransactions` realizes this net figure as itemized transactions,
      not one lump sum — see decision 23.
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
22. **The active-game dashboard becomes a board-space selector, colored to match the physical board, and drops the
    duplicated app-links nav for a single link to the Menu** (2026-09-26, JFK: _"below I would like to place the
    monthly cashflow calculation... choice of the fields you can land on with the color we have on the board Green
    Deals, Red Schnickschnack, Purple Charity, Orange Zahltag (Payday), Blue Der Markt, Purple Arbeitslos
    (Downsized), Purple Baby... each of these field buttons trigger the event. Baby, Charity and Downsize directly
    apply and for the cards (Deals, Schnickschnack and Markt) you have the choice (select the card you picked, or
    pull random) for Deals you can choose from which pile you picked (Großer Deal oder Kleiner Deal)... below I
    would like to have a short link to the Menu (so remove the View Subscription, View Grow...)"_).
    - A quiet, always-visible "monthly cashflow" figure sits right under the Cash/Round/Game-date row (same
      `cf-stat` styling, smaller font — `.cf-stat-value--sm`) — the bankruptcy warning banner still only shows
      once it goes negative, this is just the number itself, visible at a glance every turn.
    - The "which space did you land on?" card is now 7 color-coded buttons, one per physical board space kind,
      instead of just Baby/Charity/Downsized: green **Deals**, red **Doodad** (Schnickschnack), purple
      **Charity**, orange **Payday** (Zahltag), blue **Market** (Der Markt), purple **Downsized** (Arbeitslos),
      purple **Baby** — English names reused from existing deck/space translation keys wherever one already
      existed (`deckDoodad`, `deckMarket`, `charity`, `payday`, `downsized`, `baby`); only `spaceDeals` ("Deals")
      is new. Colors use existing tokens (`--color-success`/`--color-danger`/`--color-warning`/`--color-info`)
      plus a new one, `--color-cf-purple` (`src/styles.css`, light+dark), since nothing else in the app needed
      purple before.
    - Baby/Charity/Downsized/Payday **apply immediately** on click (unchanged handlers, just moved/re-skinned).
      Deals/Doodad/Market **don't** — clicking one sets `activeDeckKind` (and, for Deals, first asks which pile —
      `showDealPileChoice`, resolved by `chooseDealPile('dealSmall' | 'dealBig')`) and the existing find-or-draw UI
      (decision 16, unchanged) does the rest. The Cards section's old manual deck `<select>` is gone — the space
      buttons _are_ the deck picker now; its heading shows the active deck's translated name instead
      (`activeDeckLabel`).
    - The dashboard's `cf-app-links` nav (View Subscriptions/Grow/Balance Sheet/Stats/Budget) is replaced by one
      `openMenu()` button that closes this panel and calls `AppComponent.openNavBar()` — the same hamburger menu
      every other page already has, rather than a second, duplicated list of links (decision 13, taken further).
      The bankruptcy warning's own "View Subscriptions" link is untouched, it isn't part of that nav.
    - This is explicitly a framework/scaffolding change, not new card content — JFK: _"Implement this framework
      and then we start with the first Card Deck (one Example)"_. The real Small/Big Deal, Market and Doodad card
      catalogs (Phase 2) are still the placeholder data from decision 6, one deck at a time, next.
23. **Starting cash is itemized into real transactions, not one lump sum** (2026-09-26, JFK: _"With start game you
    get your savings as Income (category Savings), you get your first salary (category Salary) and you have to
    pay all your expenses once, so you are left with savings + cashflow"_). `PickProfessionResult
.startingCashTransaction` (one opaque, uncategorized `Income` transaction) is replaced by `.startingTransactions:
CashflowTransactionRecord[]` — Savings (`@Savings`) and Salary (`@Salary`) each post to `Income` (so they're
    ratio-split across Daily/Splurge/Smile/Fire exactly like a real Payday), then one payment per non-zero
    `expenses` line posts to `Daily`, categorized `@${line.title}` — the exact same shape as that line's own
    Subscription, just a one-off. The net total (savings + one month's cashflow) is unchanged; only its
    transparency to Budget/Stats/Balance changed, matching decision 16's expense-categorization philosophy.
24. **Bug fix: resetting the game left every other page showing stale data until a manual page refresh**
    (2026-09-26, JFK: _"when I reset the game the already loaded data is not refreshed, I need to refresh the page
    to see the effect. The whole app should be wiped and clean to start another game"_). `resetCashflowGame()`
    (Settings → Advanced, decision 20) now reloads the page (`window.location.reload()`) 1.5s after
    `CashflowGameService.resetGame` succeeds — long enough for the confirmation toast to show first. This is the
    same guaranteed-correct pattern already used elsewhere in `settings.component.ts` (e.g. after a successful
    migration import) for exactly this class of problem: other pages (Home, Balance Sheet, Subscriptions...) may
    have already read `AppStateService`'s arrays into their own local component state by the time a reset fires
    from a completely different panel, and nothing notifies them to re-read it short of starting fresh. **The
    reload itself turned out to be the wrong fix, and was removed** — see decision 29.
25. **Bug fix: Payday/Charity/Downsized transactions were created with no category at all** (2026-09-26, JFK,
    after his first live Payday click: _"when I clicked it right now, the correct categories where missing please
    fix this"_). The `cashflowTransaction()` helper in `engine.ts` hardcoded `category: ''` and had no parameter
    for one — `runCashflowPayday` passed a subscription's `account`/`amountMinor`/`comment` through but silently
    dropped its `category`, even though `CashflowGameSubscription.category` and the real Subscription both had it
    all along. Fixed by giving `cashflowTransaction` a `category` parameter (default `''`, so nothing else
    calling it changes behavior) and passing `sub.category ?? ''` through at the Payday call site; Charity also
    gained its own `@Charity` category (previously text only in the comment) for the same reason — every
    transaction this engine creates should be as traceable in Budget/Stats as its Subscription counterpart.
26. **Downsized pays the current month's real expense lines, not one lump "Downsized"-categorized transaction**
    (2026-09-26, JFK, correcting the `@Downsized` category just added the same session: _"Downsized should just
    trigger the current Expenses for the current month, so skipping any income. not its own category, do you
    understand?"_). `resolveCashflowDownsized` no longer sums every negative subscription into one `Daily`
    transaction — it now maps each owned expense subscription (`amountMinor < 0`, i.e. every game subscription
    except the salary) straight to its own transaction via `cashflowTransaction`, keeping that subscription's own
    account/category/comment, exactly like `runCashflowPayday` does — just skipping the salary. `DownsizedResult
.transaction` (singular) is now `.transactions: CashflowTransactionRecord[]`, matching `PaydayResult`'s shape.
27. **The active-game dashboard becomes a step-by-step flow: one focused view at a time, a way back from every
    one, bigger space buttons, and closing the panel after a direct action** (2026-09-26, JFK: _"when you click
    one then the panel cleans from the current view and only shows this the selection of dealing the card...
    ALSO the load option should be first hidden and we should have another button to load and then this option
    is present, from all these pages there should be an option to go back. The buttions of the cards should be
    bigger and when you click them and its a direct action you close the cashflow panel"_).
    - `CashflowGameComponent.dashboardView: 'main' | 'dealPile' | 'cards'` replaces the old `showDealPileChoice`
      boolean. `'main'` is the normal dashboard (stats, the space grid, the manual Deal form, planned deals, bank
      loan, history); landing on Deals/Doodad/Market switches to `'dealPile'` or `'cards'` and hides everything
      else in the dashboard, showing only that step plus a `‹ Back` button (`backToMain()`, which also clears
      `activeCard`/`cardQuery`/`showCardFind`).
    - Inside the Cards step, the find-a-specific-card input+results start collapsed behind their own toggle
      button (`showCardFind`) — Draw is the primary, prominent action; look-up is secondary and one click away
      (JFK: "the load option should be first hidden... another button to load").
    - `.cf-space-btn` padding/font-size increased (`min-height: 64px`, `1rem` font) — "the buttons of the cards
      should be bigger."
    - Baby/Charity/Downsized/the space-grid's own Payday button now close the whole panel on success
      (`runAction`'s `onSuccess` calls `closeWindow()`; a new `landOnPayday()` mirrors the main Payday button but
      closes afterward). The **main** Payday button above the space grid deliberately does **not** close the
      panel — it's the repeated, once-per-round action, and auto-closing it every round would be disruptive; only
      the space-grid's landing buttons (used once per turn) close. `applyActiveCard()` (planning a Deal or paying
      a Doodad) returns to `'main'` via `backToMain()` on success rather than closing the panel outright, since
      Deals/Doodad/Market are the "you have a choice" spaces, not "direct" ones (JFK's own distinction).
28. **Bug fix: Start Game only visibly added the Savings transaction until a manual page reload** (2026-09-26/29,
    JFK: _"when you pick a profession the game is not directly started... the only transaction that is directly
    added are the savings... I needed to reload the page to see the initial transactions"_). All of decision 23's
    itemized starting transactions were in fact created correctly — the bug was purely that `startGame()`
    navigated with `router.navigate(['/home'])`, which is a no-op in Angular when you're already on `/home` (the
    common case, since the panel is opened from wherever you are), so `HomeComponent` never re-ran its own data
    load and kept showing whatever it had snapshotted before the game started. First patched with a full
    `window.location.href` navigation (matching decision 24's reload-based fix for reset) — both were replaced a
    session later by decision 29's real fix, once JFK flagged the reload itself as the actual complaint.
29. **The real fix: notify the pages that hold a stale snapshot, instead of reloading the page** (2026-09-29, JFK:
    _"one thing that I really dont like is the refresh of the visuals... can we refresh just the tables,
    variables, values on the page!! as a general rule, when we add, update data the visuals should be updated as
    well across this whole feature cashflow feature!... it works for the normal app, but for the new cashflow
    feature its not always working"_). Investigation found the real, narrow cause, and it wasn't a change-
    detection problem: most core pages (Grow, Balance Sheet, Smile/Fire projects, Mojo) already read
    `AppStateService.instance` through **live getters**, so they were already reactive to any mutation without any
    special signal — decisions 24/28's reloads were never fixing those. The two genuine offenders both use a
    **static snapshot captured once**, not a live binding: `HomeComponent.allTransactions` (used by its own
    `getAmounts()` totals) and `SubscriptionComponent.allSubscriptions`/its two Material `dataSource`s. Home
    already had the fix for this shape of problem — `AppStateService.transactionsUpdated$`, a `Subject<void>`
    triggered today only by `subscription-processing.service.ts`, that `HomeComponent` and the shared
    `base-account.component.ts` (the Daily/Splurge/Smile/Fire/Mojo account list pages) already subscribe to,
    re-snapshotting and calling `cdr.markForCheck()` on emission. `SubscriptionComponent` had no equivalent, so a
    matching `subscriptionsUpdated$` was added and wired into its `ngOnInit` the same way. `CashflowGameService
.persistAll` — the one funnel nearly every mutation in this service already goes through — now calls
    `state.transactionsUpdated$.next()` unconditionally and `state.subscriptionsUpdated$.next()` whenever
    `options.includeSubscriptions` was set, right before `callbacks.onSuccess()`. This one change point covers
    Start Game, Payday, Undo, Baby/Charity/Downsized, the Deal/Doodad/Market flow, the bank loan, and Reset — every
    action that funnels through `persistAll` — for free, with no reload anywhere. `startGame()`'s navigation went
    back to plain `router.navigate(['/home'])` (now harmless even as a same-URL no-op, since Home refreshes itself
    reactively regardless of whether the navigation itself did anything), and `resetCashflowGame()`'s
    `window.location.reload()` was removed outright.
30. **The profession card becomes a compact Income Statement/Balance Sheet, the same shape as the physical board's
    own player sheet — plus, once a game is running, the live equivalent read from the actual game** (2026-09-29,
    JFK: _"salary + passive = income - expense = cashflow in a small version... two lines from passive to
    expenses describing that the goal is to have more passive than expenses and thats how you leave the rat
    race... first Income with the element salary... then before the Liabilities we have Assets where the only
    point is Ersparnisse... This should be the same if while the game is running you click on the ?... at the
    start you see there the start scenario and then the live data from the actual data on the app"_).
    - A compact one-line summary (`Salary + Passive = Income`, `Income − Expenses = Cashflow`) plus two
      horizontal bars comparing Passive Income against Expenses — the rat-race exit condition made visual
      (`ratRaceBarWidth`, scaled to whichever of the two is larger, clamped to a visible 2% sliver so a zero value
      never fully disappears).
    - Below that, the card's full breakdown reordered into **Income** (Salary) → **Expenses** (itemized, as
      before) → **Assets** (Savings — the only asset a profession ever starts with) → **Liabilities** (itemized,
      as before).
    - **While a game is running**, the same structure repeats a second time below a divider, labeled "Live —
      Current Game," reading actual current data instead of the frozen card: `liveSalary` (the Salary
      subscription's current amount — the player can edit it and it sticks, decision 16), `livePassiveIncome`
      (investment-kind Grow project `cashflow` summed — shares don't count, decision 10/11; this is the rat-race
      indicator flagged as "not built yet" in decision 11, now built), `liveExpenseLines` (every current game
      subscription with `amountMinor < 0`, itemized by its own title/category), `liveLiabilities` (the account's
      real, current `liabilities` array — no game-specific filtering needed, decision 2).
    - **Found in the process, not yet fixed**: `executeDeal()`'s property-cashflow Subscription (`${title}
Cashflow`) is never added to `state.cashflowGame.gameSubscriptionTitles`. `livePassiveIncome` reads Grow
      projects directly, sidestepping this for display — but Payday itself only ever acts on subscriptions listed
      in `gameSubscriptionTitles` (`ownedSubscriptions` in `engine.ts`), so **a bought property's monthly cashflow
      is never actually paid out by Payday today**, and the existing `monthlyCashflow`/"Monthly cashflow" dashboard
      stat (which sums `gameSubscriptions()`, not Grow projects) silently excludes it too. Flagged for JFK to
      prioritize next rather than fixed as a drive-by (his own "fix issues one by one," 2026-09-29) — likely fix:
      have `executeDeal()` append the new subscription's title to `gameSubscriptionTitles` the same way
      `resolveCashflowBaby`/`pickCashflowProfession` already do for the subscriptions they create.
31. **Bug fix: Settings' reset button couldn't reliably tell whether a game was running** (2026-09-29, JFK: "its
    not reliable to detect if a game is running or not. The reset button is currently not available because the
    component does not know we started a game"). `cashflowGame` was tier-3, on-demand data — loaded only when
    `CashflowGameComponent.open()` ran, i.e. only once the player had opened the game panel this session. Visiting
    Settings directly (without opening the panel first) left `AppStateService.instance.cashflowGame` at its
    never-loaded default (`professionId: null`), so `isCashflowGameActive` read "no game" even when one existed on
    the server. Fixed in `app.component.ts`'s tier-1 completion handler: a cashflow account now also calls
    `AppDataService.instance.loadCashflowGameData()` right there, the same point non-cashflow accounts trigger
    subscription auto-generation — for this account type, the game state is effectively tier-1, not truly
    deferred.
32. **Start Game posts only Savings; the first Payday is what posts Salary/Expenses "for real," giving the player
    a window to edit their Subscriptions first** (2026-09-29, JFK: "when we start the game we only add the
    transaction for the Savings. Then I have time as a user to modify the subscriptions, like changing the
    category name or account for the subscription or even the dates... then I have a button start (current
    Payday) and that is adding for the first time the transactions we have in subscriptions"). Reverts the Salary/
    Expense half of decision 23's itemized starting transactions — `pickCashflowProfession`'s
    `startingTransactions` is back down to just the one Savings entry. Nothing else changes: the Salary/expense
    Subscriptions are still created immediately (so there's something to edit), and the first `payday()` call
    posts them exactly as `runCashflowPayday` already did before decision 23 existed.
33. **Payday transactions spread across the current real month, and every earlier game transaction ages back a
    month first — so each Payday reads like an elapsed month once you look at Stats** (2026-09-29, JFK: "all
    added transactions from the subscription are from the current date! The idea is to spread these subscriptions
    dates over the current month and when we add a payday these transactions are added with the dates of the
    current month, but all already existing transactions should be moved back by a month, so while tho play the
    game your transactions are moved into the past... it feels like a game round / payday simulates a month went
    past"). Implemented entirely in `cashflow-game.service.ts` (not the domain engine — `runCashflowPayday`'s own
    `virtualDate` still advances forward exactly as before, unchanged, and stays the source of truth for
    round-tracking/loan-interest math; only what actually gets **persisted** as each Transaction's `date` changes):
    - `shiftGameTransactionDates(months)`: every transaction whose `comment` includes `#cashflow` — and _only_
      those, the player's own real bookkeeping is never touched — gets `addMonthsToIsoDate(date, months)` applied
      in place.
    - `payday()` now calls `shiftGameTransactionDates(-1)` **before** creating this round's transactions, then
      posts them via `spreadDateAcrossMonth(todayIso(), index, total)`, which distributes `total` same-round
      transactions evenly across the real days of today's month (`1 + floor(index × daysInMonth / total)`) instead
      of stacking them all on one date.
    - `state.cashflowGame.history`'s last entry is patched to record these same actual dates (not the engine's own
      `virtualDate`-based ones), because `undoLastPayday`'s existing `removeCreatedTransactions` matches
      transactions by exact field equality including `date` — without this, undo couldn't find what it created.
    - `undoLastPayday()` mirrors the shift with `shiftGameTransactionDates(+1)` after removing the round's
      transactions, fully reversing the aging.
    - **Deliberately out of scope for this pass**: Baby/Charity/Downsized and Deal/Doodad-execution transactions
      still date themselves at `state.cashflowGame.virtualDate` (the forward-advancing one), not today's spread
      month — flagged as an inconsistency worth unifying later, not fixed now, to keep this change scoped to what
      was actually asked ("when we add a payday").
34. **The profession card toggles between Starting/Live instead of stacking both, and its summary reuses the
    app's own Cashflow widget design, scaled down** (2026-09-29, correcting decision 30 the same session: "in a
    live game the active view should be just the Current Game panel and we can add a switch to visualize the
    start data NOT both at the same time" / "I really meant that below the Hausmeister I would like to add the
    cashflow component in small. So how we design it in the real app with its design I would like to add this in
    a small version"). `professionCardView: 'start' | 'live'` replaces showing both sections stacked;
    `openProfessionCard()`/`shuffleProfession()` default it to `'live'` once `hasActiveGame`, `'start'`
    otherwise, and a two-button toggle (visible only once a game exists) switches between them. The compact
    summary that used to be plain text (`Salary + Passive = Income...`) is now `.cf-mini-cashflow-box` — a scaled-
    down copy of the exact widget `cashflow.component.html`/`subscription.component.html` already use
    (`.cashflowBox`/`.TextLable`/`.amountLable-positive`/`-negative`, reusing their own `Cashflow.Income`/
    `Cashflow.Expenses`/`Cashflow.title` translations directly) rather than a bespoke look invented for this
    panel. The passive-vs-expenses rat-race bars (decision 30) stay, directly below the mini box, since they're a
    genuinely new visual, not part of that existing widget.
35. **Bug fix: the generic subscription auto-generation machinery could still fire for a cashflow account, bypassing Payday entirely** (2026-09-29, JFK: "In general the normal behaviour of the subscription auto add should be disabled for a game account"). The login-time trigger (`app.component.ts`) was already guarded (todo/cashflow-game.md's original MVP notes), but `SubscriptionComponent`'s manual "↻ Refresh" button called `SubscriptionProcessingService.setTransactionsForSubscriptions()` directly with no such guard — a cashflow player clicking it would auto-generate transactions up to the real wall-clock date for every Subscription, completely bypassing Payday's controlled, one-round-at-a-time posting. Fixed at the source, not just the one call site: `setTransactionsForSubscriptions()` itself now returns immediately (`{transactionsCreated: 0, subscriptionsProcessed: 0}`) when `CashflowGameService.isCashflowGame()`, so any future caller is automatically safe. The Refresh button is also hidden outright for a cashflow account (`*ngIf="!isCashflowGame()"`) rather than left visible as a silent no-op.
36. **The rat-race bars are gone; the mini cashflow box is sized to match its own amount pills, not the full panel width** (2026-09-29, JFK, after seeing them render: _"Passive Income 0,00 / Total expenses +1.000,00 — can you remove this part"_ / _"the width of the blue box can be a bit adjusted to the width of amount boxes"_). Decision 30's passive-vs-expenses comparison bars (`.cf-rat-race*`, `ratRaceBarWidth()`) are removed entirely from both the Starting and Live views — the itemized Income/Expenses/Assets/Liabilities lists and the mini `Cashflow.Income`/`Expenses`/`title` box (decision 34) already carry the same information without them. `.cf-mini-cashflow-box` now has `max-width: 252px` (the amount pill's own `220px` plus its `16px` side padding) and is centered, instead of stretching to the card's full width — so the blue box visually hugs the pills inside it rather than dwarfing them.
37. **A Passive Income row goes back into the mini cashflow box itself, having only just been removed as bars in
    decision 36** (2026-09-29, JFK, after decision 36 shipped: _"the passive box is missing. Can you add it in the
    info for start and live card"_). Not a revert of decision 36 — the _bars_ (a separate comparison widget below
    the box) stay gone; what's back is a third `Cashflow.Income`-style label+pill pair inside
    `.cf-mini-cashflow-box` itself, between Income and the `−` operator: `CashflowGame.passiveIncome` showing
    `professionStartingPassive` (always `0`, re-added as a small readonly field) on the Starting view and
    `livePassiveIncome` on the Live view — same figures decision 30 already computed, just given a place in the
    box again after decision 36 took away their only visible home.

38. **The manual Deal-card form is gone; Payday drops out of the space grid; Bank Loan/Payback Loan are each hidden
    behind their own trigger; the Menu button moves to the end of the dashboard and becomes a real button**
    (2026-09-29, JFK, verbatim across four asks in one message: _"can you remove this part of the current cashflow
    component"_ [the Deal card form] / _"can you remove the payday button (as we have it above) and Deals, Doodad
    and Market in one row and the 3 purply ones in the next row (Charity, Downsize and Baby)"_ / _"Can you hide the
    Bank loan panel behind a button and this opens when you click with a back button ..., same for Payback loan
    (here I want to see how much loan I have right now) and this button should only appear once I have a loan"_ /
    _"the Menu button should be at the end of this component and the style should fit more to this component, not
    only a text with underline a real button"_). Four independent changes to the active-game dashboard:
    - The manual "Deal card" form (Kind/Title/Quantity-or-Deposit-Mortgage-Cashflow/"Save as planned") is deleted
      outright — planning a deal now only happens through the card-draw flow (Deals space → pile choice → draw/find
      → Apply), which already covers the same `planDeal` call via `applyDealCard`. `dealKind`/`dealTitle`/
      `dealQuantity`/`dealPrice`/`dealDeposit`/`dealMortgage`/`dealCashflow`/`dealCost`/`dealShortfall`/
      `canSubmitDeal`/`submitDeal()` are removed from the component entirely (unused by anything else).
    - The space grid's own Payday button is removed (redundant with the main Payday button above it); the
      remaining six buttons are reordered into two fixed rows of three — Deals/Doodad/Market, then
      Charity/Downsized/Baby — via `grid-template-columns: repeat(3, 1fr)` instead of `auto-fill`, so the grouping
      holds regardless of panel width.
    - The always-visible Bank Loan card (outstanding amount + increments input + Borrow/Repay buttons together) is
      replaced with two small trigger buttons ("Bank Loan", always shown when `currentGameSet`; "Payback Loan",
      only shown once `currentLoanPrincipal > 0`). Each opens its own focused sub-view (`dashboardView: 'bankLoan'`
      / `'payLoan'`) with a Back button, the same pattern as the Deal-pile/Cards steps — Borrow lives in the first,
      Repay in the second, both showing the current outstanding amount. `borrowLoan()`/`repayLoan()` now call
      `backToMain()` on success instead of leaving the player stranded in the sub-view.
    - The Menu link moves from inside the `cf-summary` card (right after Payday/Undo) to the very end of the
      dashboard, after History — and changes from a plain underlined text link (`.cf-menu-link`) to a real button
      (`btn btn--sm cf-menu-btn`, matching every other action button in this component).

39. **Payday dates each transaction from its own Subscription's `startDate` day-of-month, not an auto-computed
    spread** (2026-09-29, JFK: _"this should be handled with the Date in the Subscription, the date we have there
    is what will be used, so the user can modify it. When you start the game, you current dates are used for these
    ones and if the user wants to change them he can by modifying the subscription date we just need to make sure
    the highest day used is the 28th, because of February as all of these transactions go back in time, moving
    through february at one point. We can just make sure once a transaction is moved into a february and its
    currently 31 we will adjust to the last day of the month, and its ok that from that onwards we will move it
    back on 28 february. same for 31 to 30 month"_). Supersedes decision 33's `spreadDateAcrossMonth` (auto-spread
    by index/total) — that gave the player no control at all, and decision 33's own framing ("so the user can
    modify it") was really always about Subscriptions, not a computed spread. `pickCashflowProfession`/
    `upsertSubscription` already set a new game Subscription's `startDate` to `todayIso()` (unchanged — "your
    current dates are used for these ones" was already true), so the player can freely edit each Subscription's
    date on the Subscriptions page before the first real Payday, exactly like they can already edit its
    account/category/amount. `payday()` now pairs each of `runCashflowPayday`'s output transactions with its
    source Subscription (`ownedGameSubscriptions()` — replicates the engine's own `ownedSubscriptions` title
    filter/order so the zip-by-index is guaranteed correct) and dates it via `dateFromSubscriptionDay`: the
    Subscription's `startDate` day-of-month, placed in the current real year/month, clamped to
    `min(day, daysInMonth(year, month))`. No separate "cap at 28" rule was added — that clamp already produces
    exactly the day-28-in-February outcome JFK described, without needlessly truncating a Subscription dated the
    29th/30th in every month that actually has that day. The clamp only fires once a transaction's day doesn't fit
    that month; from then on the transaction's own stored date carries the reduced day forward, so it never jumps
    back up in a later month with more days — `shiftGameTransactionDates`/`addMonthsToIsoDate` (decision 33)
    already worked this way for the *backward* aging shift and needed no change; this decision only changes how
    the *new* round's date is picked in the first place.

40. **A general "undo the last action" replaces the Payday-only undo, which silently refused to undo anything
    else** (2026-09-29+, JFK: _"I realized that we need a back button that can revert actions we did. For example
    I press Baby and I add the subscription for having a baby. I accidentally pressed the wrong button, I need to
    revert. Same for loan or anything else. so we need to keep track of the history of inputs the user is giving
    us and we need to make sure we can revert each move, so after a revert the game is in a state before he did
    the action"_). Bug found while building this: `undoLastPayday()`/the engine's `undoLastCashflowPayday()`
    explicitly throw `"Only the most recent Payday can be undone"` whenever the last history entry isn't
    `kind: 'payday'` — but Baby/Charity/Downsized *also* push their own `history` entries, so the pre-existing
    "Undo" button was already enabled (`history.length > 0`) right after any of those, and clicking it just
    errored instead of doing anything. Replaced with a full-state undo stack, frontend-only
    (`CashflowGameService.undoStack: CashflowGameSnapshot[]`, capped at `UNDO_STACK_LIMIT = 50`): every public
    mutating method (`pickProfession`, `payday`, `resolveBaby`, `resolveCharity`, `resolveDownsized`,
    `adjustBankLoan`, `planDeal`, `executeDeal`, `applyDoodadCard`, `resetGame`) calls `pushUndoSnapshot()` right
    after its own validation succeeds and before its first mutation — a deep (JSON round-trip) copy of every real
    entity a game action can touch: Transactions, Subscriptions, Grow projects, Shares, Investments, Assets,
    Liabilities, Smile/Fire/Mojo (only `resetGame` touches the last three, but undoing a reset should restore them
    too), and `cashflowGame` itself. `undoLastAction()` just pops the top snapshot and restores every field from
    it wholesale — correct by construction for *any* action, current or future, without a bespoke reversal
    written per action kind. Calling it repeatedly walks back further, one action at a time. Deliberately **not
    persisted** — a page reload starts a fresh (empty) stack; the game's real data is always safely persisted
    normally regardless, this is only a same-session safety net for a wrong click, and persisting it would mean
    a CouchDB/Firebase schema change (`CLAUDE.md`: "Ask before... changing the storage schema"), which nothing
    here needed. `clearStatus` and `drawCard` deliberately stay out of the stack — dismissing a reminder and
    drawing a card were already documented as not financial actions worth tracking. The component's `canUndo`
    getter and "Undo" button (previously `undoPayday()`) now read `CashflowGameService.canUndo`/call
    `undoLastAction()` instead. Found, flagged, not fixed while here: `resetGame()`'s own `persistAll` call never
    writes the `smile`/`fire`/`mojo` tags at all (only transactions/cashflowGame/subscriptions/balance-sheet/grow),
    so a reset's wipe of `allSmileProjects`/`allFireEmergencies`/`mojo` was already silently memory-only before
    this decision — a page reload right after a reset would bring the old Smile/Fire/Mojo data back from the DB.
    Undoing a reset happens to paper over this within the same session (the snapshot restores the in-memory values
    either way), but the underlying gap in `resetGame()`'s persistence is untouched.

41. **New profession Subscriptions get a real category (Salary was blank) and spread-out default dates instead of
    all landing on today; the same applies to every other auto-created Subscription** (2026-09-29+, JFK: _"can you
    fix that when we start a game with the profession that the subscriptions have the correct data, please fill in
    the correct Categories (currently Salary is missing) and the dates are still today, can you spread out as
    before these transactions (salary on the first, tax on third ...) just do it in the initial subscriptions...
    also I tried the loan feature and also here the Category is missing for that subscription (can we also have
    here a logical position for the date? ... in general we need a rule that if our automation is creating
    subscriptions (adding income passive cashflow or having a kid expenses) we add them with a good category AND
    we fill the date smart so it looks good in the stats, general rule each transaction should have its own date
    in the month, if possible not overlapping"_). Two independent fixes:
    - **Categories.** `pickCashflowProfession`'s Salary subscription gets `category: '@Salary'` (every expense
      line already had one). `resolveCashflowBaby`'s Children Expenses subscription gets `'@Children Expenses'`.
      `adjustCashflowBankLoan`'s interest subscription gets `'@Bank loan'` (matching the Liability's own tag —
      a real, meaningful `@`-link, not just a display label). `executeDeal`'s property-cashflow subscription gets
      `` `@${title}` `` (matching the Fire purchase transaction's own category). `applyDoodadCard`'s transaction
      gets `` `@${card.title}` `` too — same bug class (an automation-created financial record with no category),
      found while auditing every place this game creates one, even though Doodad creates a transaction, not a
      subscription.
    - **Dates.** `pickCashflowProfession`'s date-spreading (decision 33's `spreadDateAcrossMonth`, removed by
      decision 39 for a different reason — Payday reading dates *from* Subscriptions rather than computing them)
      comes back, but now at Subscription-*creation* time instead of at every Payday: two new private helpers in
      `cashflow-game.service.ts`, `currentMonthGameSubscriptionDays()` (every day-of-month already used by another
      `#cashflow` Subscription this real month) and `nextSmartSubscriptionDate(usedDays)` (every-other-day — 1st,
      3rd, 5th, ... — before any day already taken, falling back to any free day, then to the least-crowded day
      rather than ever refusing to create the Subscription). `pickProfession()` threads one `usedDays` Set through
      all of a profession's starter Subscriptions in order, so Salary lands on the 1st and the first expense line
      on the 3rd, matching JFK's own example exactly. `upsertSubscription()`'s "new" branch (Baby, Bank loan
      interest, a property's Cashflow subscription — every other auto-creation path, all funneled through this one
      function already) uses the same helper, so **every** newly auto-created game Subscription gets a
      non-overlapping date this way, not just the ones created at game start — satisfying the "general rule" as
      asked, through the one shared code path rather than three separate implementations. `upsertSubscription`'s
      *existing* branch also now refreshes `category` (previously only account/amount/frequency were "recomputed
      every time" — category joins that existing pattern rather than getting special-cased).

42. **Dashboard polish: spacing between cards, a redesigned Bank Loan trigger, History hidden behind a button
    with its Category column, and the real bug behind the "messed up" Menu button** (2026-09-29+, JFK: _"can you
    add space between the different components — Persona to Field/buttons to Bank loan to History to Menu"_ /
    _"can you design better the Bank loan button and the Menu button (especially the menu button is css messed
    up)"_ / _"can you hide the history behind a button... show Account · Category · Amount (so add the
    Category)"_). Three changes:
    - **Spacing.** `.cf-dashboard` had no layout rules of its own — its `*ngIf="dashboardView === 'main'"`
      `ng-container` has no DOM node, so every card inside it (summary, space grid, planned deals, loan triggers,
      history/menu rows) rendered as a *direct* child of `.cf-dashboard`, flush against each other with none of
      `.cashflow-game-page`'s own `gap: 16px` (that gap only applies to *its own* direct children, and
      `.cf-dashboard` is the only one of those inside the active-game view). Given `display: flex; flex-direction:
      column; gap: 16px`, matching `.cashflow-game-page`'s own convention.
    - **The Menu button bug, found while designing "better."** The global `.btn` class (`src/styles.css`) sets
      `width: 80%; margin-left: 10%` — a box model built for exactly one standalone button per row (see "Start
      Game"), not something meant to be widened. Decision 38's `.cf-menu-btn { width: 100%; }` fought that without
      touching `margin-left`, so the rendered button was effectively 110% wide, pushed right off the card — the
      actual "css messed up" JFK saw. Same risk existed for the Bank Loan trigger's two `btn btn--sm` buttons side
      by side (two 80%-wide flex items in one row). Fixed by giving both their own dedicated classes instead of
      layering onto `.btn`: `.cf-loan-btn` (bordered/colored like the space-grid buttons, reusing the amber/warning
      color the grid no longer needs since Payday isn't in it — decision 38) for Bank Loan/Payback Loan, and
      `.cf-row-btn` (a full-width bordered "go see more" row with a trailing `›`) for both History and Menu, which
      share the same "opens something else" shape.
    - **History hidden behind its own trigger**, exactly the Deal-pile/Cards/Bank-loan pattern: a `.cf-row-btn`
      shown only when `appState.cashflowGame.history.length`, opening `dashboardView: 'history'` with a Back
      button. Each transaction line now reads `Account · Category · Amount` instead of just `Account · Amount` —
      `CashflowTransactionRecord.category` was already recorded in `createdTransactions`, just never shown; the
      category is only printed when non-empty (older history entries predating decision 41 may still have a blank
      one, from before every automation path filled one in).

43. **The undo stack (decision 40) is persisted to raw `localStorage`, surviving a reload/`npm start` restart —
    but explicitly cleared on logout** (2026-09-29+, JFK, after being told decision 40's stack was in-memory only:
    _"but can we at least persist the history in the local Storage of the browser? so it survives a reload,
    refresh, npm start... but not a clear browser cache..., we just need to make sure that when we logout we
    remove also this part for the localStorage. So logout login we dont have a history, just refresh we still
    have the current game history"_). Deliberately **not** routed through `PersistenceService`/`LocalService` —
    those encrypt and sync to the DB, which the undo stack must never do (still same-session-scoped in spirit,
    just surviving a reload now, not a whole new login) — a plain `localStorage.getItem`/`setItem` under
    `'cashflowUndoStack'`, mirroring `CrypticService.loadConfig()`'s guarded-read pattern (corrupt/missing JSON
    just starts empty, never throws). `CashflowGameService`'s `undoStack` field now initializes from
    `loadPersistedUndoStack()` instead of `[]`, and every mutation (`pushUndoSnapshot`, `undoLastAction`, the
    no-op cleanup in `adjustBankLoan`'s catch) calls `persistUndoStack()` to keep the localStorage copy in sync.
    A cleared browser cache/site-data wipes it same as everything else in localStorage — no extra code needed for
    that part, exactly as JFK expected.
    - **Logout, both editions.** A new `clearPersistedUndoStack()` resets the in-memory `undoStack` to `[]` *and*
      removes the localStorage key — both matter: since neither logout flow does a hard page reload (`AppComponent`
      navigates via `router.navigate`, `ProfileComponent` likewise), the `CashflowGameService` singleton survives
      logout and would otherwise carry a stale in-memory stack into the next login even after storage is cleared.
      `AppComponent.logOut()` (`app.component.ts`, the forced/interceptor-driven path) now injects
      `CashflowGameService` and calls it alongside its other ~22 targeted `localStorage.removeData(...)` calls.
      `ProfileComponent.logOut()` (the user-facing Sign Out button) already did a blanket `localStorage.clear()`
      that incidentally wipes the storage side for free, but never touched any in-memory service state — it now
      also calls `clearPersistedUndoStack()` explicitly, for the in-memory half.
    - **Found, flagged, not fixed while researching this** (pre-existing, unrelated to the undo stack):
      `ProfileComponent.logOut()` never branches on `environment.mode`/`appMode` and never calls
      `AuthService.signOut()` or the selfhosted logout endpoint, unlike `AppComponent.logOut()` — a selfhosted
      user clicking "Sign Out" in the Profile panel never hits the server's `/auth/logout` to revoke the
      refresh-token cookie, only clears local state. Worth a look separately; out of scope here.

44. **The Subscriptions page never had a Category column at all — decision 41's category fixes were working
    correctly the whole time, just invisible** (2026-09-29+, JFK, after decision 41 shipped, pasting a
    freshly-created "Hausmeister/in Salary" subscription row with no category showing: _"still as you see there
    is now [no] category for Salary when we start a new game"_, then, after being walked through verifying the
    built domain package and Vite's dep cache both already had the fix: _"also loan and baby does not have one in
    the subscription"_). Not a regression, and not caused by anything in decisions 41–43 — `subscription.component
    .html`'s `mat-table` (`displayedColumns`/`displayedColumnsIn` in `subscription.component.ts`) only ever
    defined `id`/`title`/`account`/`amount`/`startDate` (or `endDate`) columns; there was never a `category`
    column to render one in, for *any* subscription, cashflow-game or not — confirmed by grepping the template for
    "category" and finding nothing, before this decision added it. Meanwhile `packages/domain/dist/cashflow-game
    /engine.js` and the dev server's Vite dependency cache (`.angular/cache/*/vite/deps/@money_domain.js`) were
    both directly inspected and already had `'@Salary'`/`'@Bank loan'`/`'@Children Expenses'` correctly compiled
    in — the underlying data was right the whole time. Fixed by adding a `category` column to both tables
    (Active/Inactive), right after Account, following the same `category.replace('@', '')` display convention
    every other account page (Daily/Splurge/Smile/Fire/Accounting) already uses for its own transaction category
    column — reuses the existing `Common.category` translation key (all 6 locales already had it), no new i18n
    needed.

45. **Taking or repaying a bank loan now actually moves cash, not just the Liability and interest Subscription**
    (2026-09-29+, JFK, once decision 44's Category column let the real bug from decision 41 be ruled out: _"ok
    seems to work. when I take a loan with the loan button can you add an income transaction adding this amount to
    my balance"_). Real bug, not a regression: `adjustCashflowBankLoan` never created a Transaction at all — only
    a Liability upsert and an interest Subscription upsert — so borrowing raised your debt and started a recurring
    interest payment without ever actually paying out the cash, and repaying erased that debt for free (no
    transaction meant no cost either). Also silently broke `executeDeal`'s auto-borrow path (`todo/cashflow-game
    .md` §4, `applyBankLoanAdjustment` is shared by both the standalone Borrow button and the auto-borrow-when-you-
    can't-afford-a-deal flow): buying something you couldn't afford would auto-borrow the shortfall and then still
    post the full purchase cost as a debit with nothing offsetting it, driving cash negative by the shortfall —
    the exact same missing-transaction bug, just invisible until you actually checked your balance. Fixed in the
    domain engine (`adjustCashflowBankLoan`, `packages/domain/src/cashflow-game/engine.ts`): `BankLoanResult`
    gains a `transaction` field — `+deltaMinor` to `Daily`, categorized `@Bank loan`, commented "Bank loan" or
    "Bank loan repayment" depending on sign, dated at the game's `virtualDate` like every other one-off action
    (Charity/Downsized/Doodad) — and `applyBankLoanAdjustment` (`cashflow-game.service.ts`) pushes it alongside
    the Liability/Subscription updates, for both callers. Verified the auto-borrow math now actually nets to zero
    cash left over when a purchase exactly exhausts an exact-increment loan (a new test asserts `service.cash ===
    0` after the fact, where before this fix it would have been silently negative).

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
