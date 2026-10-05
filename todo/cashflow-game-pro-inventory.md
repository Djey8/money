# Cashflow game — rule inventory (slice A0)

**What this is:** the audit [`cashflow-game-pro.md`](cashflow-game-pro.md) slice A0 calls for. Every rule of the game
that the Pro API and solo mode must reproduce, where it lives today, whether it is already tested, and where it
goes in A1/A2. Written 2026-10-05 from a full read of `src/app/shared/services/cashflow-game.service.ts` (3,026
lines) plus the component's rule-bearing methods and all existing game specs.

Line numbers refer to the service as of commit `8141788`; they will drift, the method names will not.

## 1. Headline findings

1. **The arithmetic is mostly already shared.** `packages/domain/src/cashflow-game/` already holds Payday, Baby,
   Charity, Downsized, the bank loan, profession pick, card find/draw, game finances (`summarizeGameFinances`,
   `computeMonthlyCashflowMinor`), the Classic decks and the Grow buy calculators. What is **not** shared is the
   _orchestration_: the Angular service applies those results to `AppStateService`, writes the notes and titles,
   dates the transactions, keeps the undo stack and persists. A1 is therefore mostly "extract the orchestration as
   pure functions over plain data", not "port formulas".
2. **Test coverage is already broad: 206 service tests + 131 component + 18 saved-games + 21 engine + 10 cards.**
   A0 found only a handful of untested public helpers (§5) and added 11 characterization tests for them. The
   existing suite is the safety net for A1; no large new test-writing slice is needed first.
3. **Seven things in today's code would make a server port silently diverge from the UI.** They are §3 — each needs
   a decision or a design step _before_ A1 touches the code they sit in.

## 2. Rule inventory

Legend — **Domain**: logic already in `@money/domain` (service only applies it). **Orch**: orchestration only in the
Angular service. **UI**: lives in the component. **Tests**: where it is covered today.

### 2.1 Game lifecycle

| Rule                                                                                                                                                                              | Where (service)                                       | Status                                             | Tests                                            | A1 target                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Game-account gate (email contains `cashflow`; Firebase has no sets)                                                                                                               | `isCashflowGame` 258                                  | Orch (also in `backend/services/game-account.js`)  | `isCashflowGame`                                 | keep both; API uses the backend one                  |
| **Start game**: profession → starter kit (Savings tx, Salary/expense subscriptions, assets, investments, shares, liabilities), translated titles, smart dates, fresh undo history | `pickProfession` 715; engine `pickCashflowProfession` | Domain computes; Orch applies + translates + dates | `pickProfession`, profession content translation | `startGame(state, set, profession, ctx)` (§3 F1, F2) |
| **Reset**: wipe every entity the game touched + game state + history; game accounts only                                                                                          | `resetGame` 2506                                      | Orch                                               | `resetGame`                                      | `resetGame(state)`                                   |
| Live profession / title lookup, current game set                                                                                                                                  | `currentProfession` 2802, `liveProfessionTitle` 2797  | Orch                                               | **added A0**                                     | trivial helpers                                      |

### 2.2 Round, space and status rules

| Rule                                                                                                                                                                                                                        | Where                                    | Status                                                               | Tests                                                                           | A1 target                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Payday**: one transaction per game subscription, ages every prior game tx back a month, each tx dated from its own subscription's day clamped to the month, market offers cleared, recurring dice cards flagged `rollDue` | `payday` 857; engine `runCashflowPayday` | Domain computes; **Orch** dates/ages/clears (real calendar, F2)      | `payday and undo`, `payday date handling`, `Payday ages every game transaction` | `applyPayday` (needs clock, F2)                  |
| **Baby**: +1 child (max 3), children-expense subscription scaled and upserted by translated title                                                                                                                           | `resolveBaby` 1014; engine               | Domain + Orch (title translation, F1)                                | `resolveBaby`, translation tests                                                | `applyBaby`                                      |
| **Charity**: pay 10% of total income now, dice choice for 3 turns (`charityRoundsLeft`)                                                                                                                                     | `resolveCharity` 1098; engine            | Domain + Orch (one-off tx dating)                                    | `resolveCharity and resolveDownsized`                                           | `applyCharity`                                   |
| **Downsized**: pay total expenses once, `unemployedRoundsLeft = 2`, ends a charity bonus; never blocks Payday                                                                                                               | `resolveDownsized` 1114; engine          | Domain + Orch                                                        | same                                                                            | `applyDownsized`                                 |
| **Clear status** (spanner / charity reminder) — plain acknowledgement, no money                                                                                                                                             | `clearStatus` 1184; engine               | Domain + Orch                                                        | `clearStatus`                                                                   | `clearStatus` (solo: driven by the next roll)    |
| **Space preview** (what Baby/Charity/Downsized are about to do, nothing applied)                                                                                                                                            | `spacePreview` 1065                      | Orch (calls engine)                                                  | `spacePreview`                                                                  | pure `previewSpace`                              |
| **Monthly cashflow** = income − expenses over the game's own subscriptions; negative = losing                                                                                                                               | `monthlyCashflow` 1202                   | Domain                                                               | `monthlyCashflow`                                                               | already domain                                   |
| **Finances summary / rat-race escape / bankrupt** (passive ≥ expenses; monthly < 0)                                                                                                                                         | `liveGameSummary` 404; component 325–415 | Domain `summarizeGameFinances`, **duplicated in the component** (UI) | **added A0** (`liveGameSummary`)                                                | one place: the domain (§4 U1)                    |
| **Cash on hand** = Daily+Splurge+Smile+Fire (each account's own tx + its share of Income)                                                                                                                                   | `cash` 1218                              | **Orch, reads `AppStateService.getAmount` + allocation ratios**      | **added A0**, incl. a pinned rounding quirk                                     | pure `cashOnHand(transactions, allocation)` (F5) |

### 2.3 Bank loan and money moves

| Rule                                                                                                                                                                | Where                                                          | Status                                  | Tests                                       | A1 target                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- | --------------------------- |
| **Bank loan** borrow/repay in the set's increment: liability upsert, 10% interest subscription recomputed, **a real cash transaction** (decision 45), one undo step | `adjustBankLoan` 1130, `applyBankLoanAdjustment` 1150; engine  | Domain + Orch                           | `adjustBankLoan`, `Bank loan on a Grow buy` | `applyBankLoan`             |
| **Auto-borrow** the shortfall (rounded up to the step) before a purchase/doodad; its own undo step; the project's Loan field is switched off (`converted`)          | `beforeGrowTrade` 471                                          | Orch, **called by the Add dialog** (F3) | `Bank loan on a Grow buy`, `executeDeal`    | `planAutoLoan`              |
| **Paying a starting liability off ends its monthly expense**; bank loan → "Bank loan interest"                                                                      | `removeExpenseForPaidLiability` 1327                           | Orch                                    | `paying a starting liability off`           | `expenseForPaidLiability`   |
| One-off transaction **date slots** (1,3,5… then 2,4,6… ≤ 28th, of the _real_ current month)                                                                         | `nextSmartSubscriptionDate` 999, `nextGameTransactionDate` 978 | Orch, **wall clock** (F2)               | `date slots for one-off game transactions`  | `nextSlot(usedDays, clock)` |
| Sell a card to a friend (plain income, category `@<card> card sale`)                                                                                                | `sellCardToFriend` 2708                                        | Orch                                    | `sellCardToFriend` tests                    | `sellCard`                  |

### 2.4 Cards, deals and trades

| Rule                                                                                                                                                             | Where                                                                                                                          | Status                                                         | Tests                                                                        | A1 target                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Find / browse / draw** a card (random from what the deck has not given out; reshuffle when empty)                                                              | `findCardsInDeck` 2539, `browseCards` 2552, `drawCard` 2567; domain `cards.ts`                                                 | Domain, **`Math.random()` inside `drawRandomCard`** (F8)       | `cards: find, draw, apply`, `cards.spec`                                     | inject an `Rng` (A3)                                            |
| **Plan a deal** (share / investment / special asset) as a Grow project in `plan` phase; same card again re-plans the price; kind conflicts refused; notes        | `planDeal` 1238, `applyDealCard` 2603, `nextInvestmentLabel` 2662                                                              | Orch + translated notes (F1)                                   | `planDeal / executeDeal`, `stock cards`, `investment cards`                  | `planDeal`                                                      |
| **Execute a deal** = Grow buy through the existing calculators (`calculateBuyShare`/`Investment`), account `Fire`, auto-loan first, rollback of a half-done deal | `executeDeal` 2356                                                                                                             | Domain calculators + Orch; **emits the Grow comment DSL** (F3) | `planDeal / executeDeal`                                                     | `executeDeal` on **typed Grow actions**, never a comment string |
| **Investment income**: a bought property's cashflow becomes a `<title> Cashflow` subscription registered with Payday                                             | `registerInvestmentIncome` 2682                                                                                                | Orch                                                           | `executeDeal` (property), boost cards                                        | `registerInvestmentIncome`                                      |
| **Plan note** (bank loan needed for a buy; updated, never duplicated) and the project's Loan field                                                               | `syncPlanNote` 2206, `loanNeeded`, `loanNoteText`                                                                              | Orch + translated text (F1)                                    | `changing the quantity UPDATES…`                                             | `syncPlanNote` + text port                                      |
| **Phases** plan → execute → completed as the player trades; a sold property takes its market offer with it                                                       | `setPhaseAfterTrade` 1686                                                                                                      | Orch, called by the Add dialog (F3)                            | `phases: plan when planned…`                                                 | `setPhaseAfterTrade`                                            |
| **Share price card** (only for held shares; sets price on project + holding; note)                                                                               | `updateSharePrice` 1849, `heldShareProjectFor`                                                                                 | Orch                                                           | `a drawn stock card sets the market price`                                   | `applyPriceCard`                                                |
| **Stock split card** (dice: 1–3 doubles, 4–6 halves rounding up) — a pending decision                                                                            | `playShareSplitCard` 1900, `resolveShareSplit` 1964                                                                            | Orch                                                           | `stock split cards`                                                          | `splitCard` + decision                                          |
| **Boost cards** (investments paying ≤ limit gain an amount; subscription follows)                                                                                | `playBoostCard` 2010                                                                                                           | Orch                                                           | `cashflow boost cards`                                                       | `boostCard`                                                     |
| **Market buyer cards** (offers on owned property types incl. `-II` copies; price = profit %/fixed/per unit; offers live until Payday; sale via normal Sell)      | `playMarketCard` 1720, `marketSaleFor` 2163                                                                                    | Orch + **type labels computed in the component** (UI, F7)      | `market buyer cards`, apartment/condo/gold buyer suites                      | `marketCard`, `marketSaleFor`                                   |
| **Market cost cards** (tenant damage / broken pipe: the first owned property is charged via the Add dialog)                                                      | `playMarketCostCard` 2074                                                                                                      | Orch + Add dialog (F3)                                         | `cost cards for property owners`                                             | `marketCost`                                                    |
| **Doodad**: plain expense paid like a purchase (auto-loan when short), `#doodad` comment tag, "🏦" loan note                                                     | `doodadLoanNote` 2260; component `payActiveDoodad` 1619                                                                        | Orch + **UI** (F3, F7)                                         | component `payActiveDoodad…`, `doodadLoanNote lists cash, cost and the loan` | `payDoodad` + typed input                                       |
| **Special assets / dice cards**: gold coins, sister-in-law loan (1–3 lose, 4–6 get 10 000), Multi-Level-Marketing (one roll per Payday for all kept cards)       | `registerAssetDeal`, `beforeAssetBuy` 1409, `afterAssetBuy`, `resolveGamble` 1609, `resolvePaydayRoll` 1540, `paydayRollCount` | Orch                                                           | `gold coins`, `sister-in-law loan`, `Multi-Level-Marketing`                  | `assetDeals` module                                             |
| **Selling coins** (proportional cost, last coin removes the asset, notes); `sellAssetProblem` pre-check                                                          | `sellCoins` 1478, `sellAssetProblem` 1459, `coinsOwned`                                                                        | Orch, **parses the Sell comment with a regex** (F3)            | `selling coins`                                                              | typed `sellCoins`                                               |
| **Dice**: the app rolls a die when the player has none                                                                                                           | `rollDie` 1599                                                                                                                 | Orch, `Math.random()` (F8)                                     | **added A0**                                                                 | `Rng`                                                           |
| Open decisions (paid dice cards waiting for a roll; one decision per Payday group)                                                                               | `openDecisions` 1512                                                                                                           | Orch                                                           | dice-card suites                                                             | `pendingDecisions(state)` — also the API's `pending`            |

### 2.5 History, undo and saved games

| Rule                                                                                                                                                                           | Where                                                                      | Status                                | Tests                                                       | A2 target                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| **One undo step per action**: a full deep copy of every entity + game state taken _before_ the action; a failed action pops its step; a deal is two steps when it needs a loan | `pushUndoSnapshot` 301, step kinds 153                                     | Orch, **browser `localStorage`** (F4) | `undoLastAction…`, `History…`                               | `UndoHistory` over plain data |
| **Undo N steps** back to the oldest of them; keeps the saved-game slot                                                                                                         | `undoSteps` 684                                                            | Orch                                  | `undoSteps(n)…`, **added A0** (slot)                        | `undo(history, n)`            |
| **History list**: one line per step, newest first, transactions gained between snapshots; names legacy steps by inference                                                      | `historySteps` 623, `inferStep` 644                                        | Orch                                  | `History: one line per undo step`                           | `historySteps`                |
| **Persisted undo stack**, 200 steps, compact diff encoding, cleared on logout / new game / reset                                                                               | `loadPersistedUndoStack`, `exportUndoChain`, `undo-chain-codec.ts`         | Orch + shared codec (src/app)         | `undo stack persistence…`, codec spec                       | codec moves to domain (A2)    |
| **Snapshot capture / validate / restore** (the unit Undo and saved games share); a foreign file never replaces a live game                                                     | `captureGameSnapshot` 314, `isGameSnapshot` 332, `restoreGameSnapshot` 357 | Orch                                  | **added A0** (`isGameSnapshot`, refusal), saved-games suite | `snapshot` module             |
| **Game identity** (saved slot id + name); live summary for the games list                                                                                                      | `setGameIdentity` 389, `clearGameIdentity` 396, `liveGameSummary` 404      | Orch                                  | **added A0**                                                | `snapshot`/`saved-games`      |
| **Saved-game codec** (JSON → gzip → base64 `gz:`/`raw:` → encrypt) and the saved-games list                                                                                    | `src/app/shared/saved-game-codec.ts`, `cashflow-saved-games.service.ts`    | Orch, **browser gzip** (F9)           | `saved-game-codec.spec`, 18 tests                           | server-side codec (D4)        |

## 3. Cross-cutting findings — each one changes how A1 must be done

**F1 — Persisted text is written in the player's language.** The service calls `translate.instant()` to write
_stored_ data: subscription titles/categories ("`<profession> Salary`", "Children Expenses"), Grow notes (🏦/💰
lines, dice results, price moves), transaction comments ("Sold the X card to a friend"), and even liability tags.
`saved games` record the language they were played in. An API-created game must write the same text in the same
language or the account looks different depending on who played. **Decided (JFK, 2026-10-05): the account's
language, fixed for the whole game** — to play in another language, start a new game under that account
language; the API takes no per-call language. **For A1:** a `GameText` port (`text(key, params) → string`)
injected into the engine; the frontend supplies ngx-translate, the backend loads the same
`src/assets/i18n/*.json` catalogs for the game's language (stored on the game, as saved games already do). Keys
used as literal matching keys (`Bank loan`, `Bank loan interest`) stay untranslated, as today.

**F2 — Dating uses the real wall clock, not the game calendar.** One-off transactions go on "the next free slot of
this real month" (`nextSmartSubscriptionDate` via `todayIso()`), Payday posts into the current real month, and the
game's `virtualDate` only drives round/loan maths. The server runs in UTC and at a different moment than the
browser. **Decision for A1/A3:** inject a `Clock`; the API uses the account's timezone-less local date as the UI
does (calendar date at the moment of the call) and tests pin it.

**F3 — The deal/trade rules are split between this service and the Add dialog, and the dialog speaks the Grow
comment DSL.** `beforeGrowTrade`, `afterAssetBuy`, `afterAssetSell`, `setPhaseAfterTrade`,
`removeExpenseForPaidLiability`, `sellAssetProblem` and the doodad/market-cost payments are _hooks_ the Add
component calls around a Grow buy/sell, and they recover what happened by **regex over the comment string**
(`parsePurchase`, `tradeStep`, `sellAssetProblem`, `DOODAD_MARK`, `MARKET_COST_MARK`, `GROW_TRADE_COMMENT`). CLAUDE.md
and D-16 forbid the API from writing or parsing that DSL. **Decision for A1:** extract each hook as a pure function
over a _typed_ trade (`{ kind: 'buyShare', title, quantity, priceMinor }`); the backend's existing typed Grow
actions (`backend/repositories/grow-action-repository.js`, `domain/grow/actions.ts`) provide the trade itself and
the hooks run around it. The UI keeps producing the DSL for now and the extracted hooks are called with the typed
form it derives — one migration step per hook, never a comment-parsing port.

**F4 — The live game's undo history lives only in the browser's `localStorage`.** It is deliberately not synced
(decision 43). An API/agent has no browser, and an agent's undo must not depend on a UI session. **Decided (JFK,
2026-10-05): the live game's history is written to the account continuously**, not only on Save — saved games
already store the compact undo chain, a plain-text step log and a snapshot, and the live game now does the same on
every step, so an agent sees the whole game, can undo back to any step and can report on how it went. **For A2:**
a new additive path next to `cashflowGame` (the same `{ schema, payload }` shape and codec as a saved game), written
with every step through the existing batch write; the 200-step cap stays, and the write cost must be measured
(the user document is already ~2 MB on a long-lived account) before it ships.

**F5 — "Cash on hand" is `AppStateService.getAmount` + the account allocation ratios**, with a per-entry
cent-rounding quirk that drifts by a cent on tiny Income amounts (pinned by a test). It is the number every
auto-loan decision hangs on, so the API must reproduce it exactly. **A1(a):** `cashOnHand(transactions,
allocation)` in the domain, tested against the pinned cases, UI switched over first.

**F6 — Persistence is whole-collection writes plus a derived-state recompute.** `persistAll` always writes
`transactions` + `cashflowGame` + the income-statement derived arrays, plus optionally subscriptions, balance sheet
and Grow, then nudges pages. The backend already has the equivalent (`withTransactionsWrite`, `applyDerivedState`,
`withGrowActionWrite`). The extracted engine returns _effects_ (what changed); each side persists in its own way.

**F7 — Some rules sit in the component.** The market-card dispatch (which card kind calls which service method),
the property **type labels** (EFH/SFH/…) a market card's offers match against, card filtering/families, the Deals
pile choice, `canLandOnBaby`, and the finance widgets (`liveSalary`, `livePassiveIncome`, `escapedRatRace`, …) that
duplicate `summarizeGameFinances`. They must move with the rules or the API cannot play a card. **A1(c)/(d)** pulls
the dispatch and the type tables into the domain; the finance widgets are deleted in favour of the domain summary.

**F8 — Randomness is unseeded in three places:** `drawRandomCard` (domain, `Math.random`), `rollDie` (service) and
`shuffleProfession` (component). **A3** introduces an `Rng` interface with a seeded implementation; production
passes a real one.

**F9 — Saved games depend on browser gzip** (`CompressionStream`), with a `raw:` fallback. The server needs a
Node gzip that produces output the browser reads (and vice versa); a golden fixture pins it (D4).

**F10 — Floats at the edges.** The UI keeps decimal `amount: number`; the domain uses minor units. Every service
method converts at the boundary (`toMinorUnits`/`fromMinorUnits`). Extracted functions take and return minor
units; each caller converts as it already does (the backend repositories apply the schema-version conversion).

## 4. UI-side duplication to remove during A1

| #   | Duplicate                                                                                                   | Resolution                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| U1  | Component finance getters (`liveSalary`, `livePassiveIncome`, `liveTotalExpenses`, `escapedRatRace`, …)     | Use `summarizeGameFinances` only                             |
| U2  | `matches`/`labelMatches` property-label regex defined twice in the service (`playMarketCard`, module scope) | One domain function                                          |
| U3  | Loan-needed rounding repeated in `loanNeeded`, `loanNoteText.loanFor`, `doodadLoanNote`, `beforeGrowTrade`  | One `loanForShortfall(costMinor, cashMinor, incrementMinor)` |

## 5. What A0 added

11 characterization tests in `cashflow-game.service.spec.ts` (`describe('A0 characterization: …')`) for the helpers
that had **no** direct test: `cash` (3, including the pinned one-cent rounding quirk), `rollDie` (1),
`liveProfessionTitle` (1), `liveGameSummary` (1), `setGameIdentity`/`clearGameIdentity` (1), Undo keeping the saved
slot (1), `isGameSnapshot` (1), `restoreGameSnapshot` refusing a foreign file (1), `removeSubscriptionByTitle` (1).
Still untested and deliberately left for the slice that moves them: `autoLoanMessage` and
`expenseRemovedMessage` (pure translation pass-throughs).

## 6. Consequences for the plan

- **A1 order, refined** (smallest coupling first): (a) cash on hand, finances summary, loan arithmetic (F5, U1, U3) →
  (b) bank loan + payday + status + Baby/Charity/Downsized orchestration, with the `Clock` and `GameText` ports
  (F1, F2) → (c) card dispatch + market/boost/split/price/cost cards (F7, U2) → (d) deals and typed trade hooks
  (F3) → (e) special assets, dice cards, coins → (f) doodads.
- **A2** gets one extra item: persisting the live history to the account on every step (F4, decided).
- **A3** gains `shuffleProfession` (F8).
- **Decisions F1 and F4 are made** (account language fixed per game; history saved to the account continuously).
  Nothing is blocked on JFK; A1(a) can start.

## 7. Progress

| Slice                                                                       | Status   | Commits                                                                                                                                       |
| --------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A0 — inventory + characterization tests                                     | done     | `fa6bae6`                                                                                                                                     |
| A1(a) — cash on hand, finances, loan arithmetic                             | **done** | `0ccb3f1` (domain `cash.ts`), `9e65a08` (service switched over), the component-totals commit after it                                         |
| A1(b) — Payday, Baby, Charity, Downsized, with the Clock and GameText ports | **done** | `455bbf5` (clock, text, scheduling), `d5d992c` (service dates through them), `e72d82d` (rules as pure functions), the adapter commit after it |
| A1(c) — Market cards: buyers, gold, splits, boosts, cost and price cards    | **done** | `d4fe38f` (step types), `186e0a0` (rules), the adapter commit after it                                                                        |

**A1(a) results.** F5 and U1/U3 are resolved: `cashOnHandMinor` and `loanForShortfallMinor` live in the domain, the
service's `cash` and its four copies of the loan rounding call them, and the game page's salary / passive income /
expenses / "escaped the rat race" come from `summarizeGameFinances` — the same function a saved game's summary
uses. The cash port keeps the legacy float arithmetic on purpose (an integer rewrite differs in ~1% of random cases
at half-cent boundaries); a 100,000-case fuzz test pins it to the original.

**One deliberate edge fix inside the otherwise behaviour-neutral component change:** the page now decides "escaped
the rat race" in whole minor units, so an exact tie between passive income and expenses is a tie. With decimal sums
0.1 + 0.2 ≠ 0.3 it could read as not escaped (a test pins this, and fails against the old code).

**Known divergence left as is (not introduced here):** the page's `liveCashflow` is salary + passive − expenses,
while the dashboard's `monthlyCashflow` is the sum of _every_ game subscription. They agree for every subscription
the game itself creates; they would differ only for a positive game subscription that is neither the salary nor a
`<name> Cashflow` one. Worth unifying when A1(b) moves payday and the status rules.

**A1(b) results.** F1 and F2 are resolved at the engine level: the round rules take a `Clock` and a `GameText` and read
nothing else. `rounds.ts` holds `playPayday`, `playBaby`, `playCharity`, `playDownsized` and `previewSpace`; each takes
the books (subscriptions, transaction dates, Grow notes, in minor units) and returns **effects** - the new game
state, the History step, which existing transactions change date (by position), the new transactions already dated on
free slots of the real current month, the subscriptions to upsert, the notes to replace, and what to persist. A
deep-freeze test proves they never mutate their input. The Angular service's methods are now adapters: build the
books, call the rule, push the undo step, apply the effects **in place** (so ids and change history on existing
entries survive), persist. The scheduling (smart day slots, clamping, aging) moved with them. All 372 existing game
tests passed unchanged through the move.

**Left for the next slices:** `upsertSubscription`/`pushOneOffTransactions` are still used by the bank loan and the
deal code (A1(c)-(f)) - the domain versions (`upsertBookSubscription`, `placeOneOffTransactions`) are ready for them.
The page's `liveCashflow` vs the dashboard's `monthlyCashflow` divergence is still open.

**A1(c) results.** The Market cards are pure functions in `market-cards.ts`, in the same shape as the round rules:
books in minor units plus a clock, a text function and a money formatter in, effects out (new game state, the History
step, project note/cashflow/price updates, share prices, subscription upserts, what to persist). `playMarketBuyerCard`
covers property buyers (a percentage, a fixed profit, a fixed price, a price per unit) and the gold buyer;
`playShareSplitCard`, `playBoostCard`, `playMarketCostCard` and `updateSharePrice` the rest; `marketSaleFor` (the offer
behind the Sell button) is pure too. The property-label matcher exists once, in the domain (U2 resolved), and the
game page's inline dispatch - which symbols a card names, the labels they go by, which businesses a boost helps - is
now `marketCardKind`, `buyerCardTypes`, `propertyCardTypes` and `businessCardLabels` (F7 resolved for the Market
cards). The history step types moved to the domain too (`steps.ts`), since the API reports and undoes the same steps.
The service's seven card methods are adapters; 374 existing tests passed unchanged through the move, and the service
lost ~170 lines.

**What the API will need for these (not part of A1(c)):** the card-text catalog that turns a symbol into the label a
game's language gives it (EFH / SFH), the same lazily loaded per-language files the game page uses. The rules take the
resolved labels as input, so only the lookup has to exist server-side.

**Left for the next slices:** the stock split's _resolution_ (`resolveShareSplit`, reached through `resolveGamble`) and
the dice cards belong to A1(e); deals and trades to A1(d); the Doodad payment to A1(f).

**A1(d), part 1 results** (`43c0bee`, `d1f6471`, `692f0f8`, `20c2ddc`, `8372b0f`):

- **One parser of the Grow comment (F3, first half).** `trades.ts` replaces the three regex readers the service carried
  (`tradeStep`, `parsePurchase`, `sellAssetProblem`) and two module-level tag constants with `gameTradeStep`,
  `tradePurchase` and `sellAssetProblem`, decided from the statements the domain's own Grow parser returns - a title
  with a space now reads correctly. The typed forms (`purchaseOfStatements`, `sellAssetProblemOf`) are what the API
  will call; it never writes or parses a comment. One long-standing rule is kept on purpose and documented: only a
  _single-unit_ special-asset buy counts as a purchase.
- **One effects type.** `GameEffects` (`effects.ts`) is the single description every rule returns - state, History step,
  transaction dates and appends, subscription and liability upserts and removals, project updates, share prices, what to
  persist. `RoundEffects` and `CardEffects` are aliases; the Angular service applies any rule's effects with one
  `applyGameEffects`.
- **The bank loan** is `playBankLoan` (borrow / repay in the game set's step, the liability and its recomputed interest
  subscription, and the cash that really changes hands, dated after the interest subscription - the order the app has
  always used, which a first draft got wrong and a test caught) and `planAutoLoan` (the larger of the loan the player typed
  and the cash shortfall, rounded up to the step). `adjustBankLoan`, the Add dialog's auto-loan and `executeDeal` use them;
  a refused amount no longer needs a "push then pop" of the undo step.
- 374 existing game tests passed unchanged through all of it.

**Still to do in A1(d), part 2 - the deal lifecycle:** `planDeal` / `applyDealCard` (a card becomes a Grow project in the
`plan` phase), `executeDeal` (the buy, on the existing Grow calculators), `syncPlanNote`, `registerInvestmentIncome`,
`setPhaseAfterTrade`, `removeExpenseForPaidLiability`, `sellCardToFriend`. These create and edit whole Grow projects, so
`GameEffects` needs project creation (and the share / investment / asset positions a buy writes) - the one place the effects
model grows again. The asset-specific hooks (`beforeAssetBuy`, `afterAssetBuy`, `afterAssetSell`, `sellCoins`) and the dice
cards stay in A1(e).

**A1(d), part 2 results - the deal lifecycle** (`20cadd6`, `abf082f`, and the adapter commit after them):

- **`deals.ts`** holds `planDeal` (a Deal card becomes a planned Grow project - share, property or special asset - with
  the card's text and range), `syncPlanNote` (the one "🏦 bank loan needed" note, updated in place, plus a share's
  project Loan field and Deposit), `executeDeal` (the buy on the existing Grow calculators, returning the undo steps in
  order - the automatic loan first when cash is short, then the purchase dated after it - and deciding everything before
  returning, so a refused deal has nothing to roll back), `registerInvestmentIncome`, `setPhaseAfterTrade`,
  `removeExpenseForPaidLiability` (matched under the language the game was started in), `sellCardToFriend`,
  `doodadLoanNote`, `dealInputFromCard`, `nextInvestmentLabel` and `plannedDeals`.
- **`books.ts`** adds the full `GameBooks` and `applyEffectsToBooks`, so a rule that does several things in a row sees the
  result of each before deciding the next. `GameEffects` grew to carry share and property positions and Grow project
  creation / field updates.
- The Angular service's deal methods are adapters; it went from 3,026 lines at the start of A1 to 2,321. **All 374
  existing game tests passed unchanged on the first run through the move**, and the dead private helpers it left behind
  (`upsertGrowProject`, `upsertSubscription`, `removeCreatedTransactions`, ...) are gone.
- F3 is resolved for the deal lifecycle: no deal rule reads or writes the Grow comment by hand. The one comment a purchase
  carries is the canonical one `calculateBuyShare` / `calculateBuyInvestment` generate. What still goes through the Add
  dialog's comment text is the _trade_ the player makes there (the dialog builds and parses it with `split(' ')` itself);
  the game hooks around it now read it with the domain parser (`trades.ts`).

**Two inconsistencies found.** (1) The "🏦" notes and the Doodad note format money with the browser's own locale
(`toLocaleString()`), while every other game text uses the app's number format - the rules take a separate `plainMoney`
formatter to keep that exact; changing it changes what is stored, so it is left for its own decision. (2) ~~`sellCardToFriend`'s
transaction comment ("Sold the X card to a friend") was hardcoded English~~ - **fixed**: it is now the translated
`CashflowGame.cardSaleComment` in all six languages, so it follows the game's language like the rest. Its _category_
(`@<card> card sale`) deliberately stays a literal key: History names a card sale by it, and old games carry it.

**Still to do:** A1(e) - special assets, dice cards, coins, the stock split's resolution (`beforeAssetBuy`,
`afterAssetBuy`, `afterAssetSell`, `sellCoins`, `resolveGamble`, `resolvePaydayRoll`, `resolveShareSplit`,
`openDecisions`, `paydayRollCount`); A1(f) - the Doodad payment, then A2 and A3.

**A1(e) results - special assets, dice cards, coins and the split roll** (`9bd045d` and the adapter commit after it):

- **`asset-deals.ts`** holds the hooks around the Add dialog's Buy / Sell Asset (`beforeAssetBuy` - a dice card is paid for
  but waits for its roll; `afterAssetBuy`; `afterAssetSell` - selling the last of an asset completes its project),
  `sellCoins` (the asset and the project keep the cost of the coins left; the last coin removes the asset; fractions
  allowed), `openDecisions` / `paydayRollCount` / `recurringOwned`, and `resolveGamble`, which settles a paid dice card
  (won: the coins as an Asset at what was paid; a loan to a relative: the cash back as income; lost: gone), a kept card's
  **one Payday roll covering every due card of its kind** (a win pays once per card, on different days) and a stock
  split's roll (double / halve, the half you keep rounding up). The die is an input, so every rule is deterministic.
- `GameEffects` and the books gained asset positions (upsert and removal). The service's methods are adapters; the dead
  private helpers (`resolvePaydayRoll`, `resolveShareSplit`, `recurringOwned`, `assetDeals`, `setAssetDeal`) are gone.
  All 375 game tests passed unchanged on the first run.

**Left for A3:** the app still rolls its own die (`rollDie`, `Math.random`) and a card is still drawn with the domain's
unseeded `drawRandomCard`; both become an injected `Rng`.

**Still to do:** A1(f) - the Doodad payment (partly the component's `payActiveDoodad` and the Add dialog), then A2
(undo, snapshots, reset, saved games, and writing the live history to the account on every step) and A3 (`Rng`).

**A1(f) results - the Doodad and Market-cost payments** (`03b4764` and the page commit after it):

- **`expenses.ts`**: `cardExpenseComment` composes the comment a card payment carries (what was bought, the joke, the
  cash / bank-loan note, then the `#doodad` or `#market` tag), `doodadAccount` is the suggested account (`Splurge` unless
  the card says otherwise), `MARKET_COST_ACCOUNT` is `Fire`, and `payCardExpense` is the whole payment as the Pro API
  will make it: the automatic Bank loan first when cash is short (its own undo step, rounded up to the loan step), then the
  expense, one step named after its category, on the next free day of the real month - decided before anything is
  returned, so a refused payment changes nothing.
- The game page pre-fills the Add dialog with the same comment and account rules instead of composing them inline (F7 for
  the Doodad and Market-cost dispatch). **The dialog still books the payment** - it is a 1,800-line general-purpose
  component - so the UI path and `payCardExpense` share the comment, the account, the loan decision (`planAutoLoan` /
  `playBankLoan`), the step (`gameTradeStep`) and the date slotting, and differ only in the dialog's own transaction
  construction. Worth a characterization test against the dialog if that ever drifts.

## A1 is complete

Every rule of the game that the Pro API and solo mode need - except undo / snapshots / saved games (A2) and the random
source (A3) - now lives in `@money/domain` as a pure function over minor-unit books, returning `GameEffects`:

| Module                   | Rules                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `cash.ts`                | cash on hand (the pinned float arithmetic), the loan for a shortfall                                            |
| `rounds.ts`              | Payday, Baby, Charity, Downsized, one-off day slots, subscription upserts, space previews                       |
| `market-cards.ts`        | property and gold buyers, stock splits, boosts, cost cards, a stock's new price, `marketSaleFor`                |
| `trades.ts`              | what a trade is and costs, read through the domain's Grow parser                                                |
| `loan.ts`                | the bank loan, the automatic purchase loan                                                                      |
| `deals.ts`               | plan, plan note, execute (loan then buy), investment income, phase after a trade, paid-off liability, card sale |
| `asset-deals.ts`         | dice cards, kept cards' Payday roll, stock-split roll, gold coins, the open-decision list                       |
| `expenses.ts`            | Doodad and Market-cost payments                                                                                 |
| `effects.ts`, `books.ts` | the single effects type, the full books, `applyEffectsToBooks`                                                  |

The Angular `CashflowGameService` went from **3,026 to 2,121 lines**; its remaining logic is orchestration (build the books,
call a rule, push the undo step, apply the effects in place, persist), the undo / saved-game machinery that A2 takes, and
the translation of persisted text. Throughout A1 the existing game tests (374 at the start, 375 now) were never changed to
make a move pass, and the domain gained ~640 tests of its own.

**Next:** A3 (an injected `Rng` for `rollDie`, `drawRandomCard` and `shuffleProfession`), then Phase B (the solo engine).

## A2 wrap-up (2026-10-05)

Undo stack, snapshots, history list and reset are pure functions in `history.ts` (`pushUndoSnapshot`, `popUndoSteps`,
`keepSavedSlot`, `captureGameSnapshot`, `blankGameData`, `historySteps`, `inferStep`), the undo-chain codec moved to
`undo-chain.ts`, and the **live history is written to the account** (`live-history.ts`, path `cashflowGameHistory`,
documented in `backend/DATABASE_STRUCTURE.md`):

- the document is `{ schema, updatedAt, gameId?, undo, steps }`, packed and encrypted exactly like a saved game;
- the browser writes it ~3 s after the last step (`CashflowHistorySyncService`, debounced, in the background - never part
  of an action's own batch), keeps a local copy with its own timestamp, and on load takes whichever copy is newer;
  a newer browser copy is written out, an equal one is left alone, a damaged or newer-schema one is ignored;
- a new game, a loaded saved game and a reset replace it, logout leaves the account's copy untouched;
- measured on a synthetic 200-step game with 600 transactions: 194 KB JSON, **~9 KB packed, ~80 ms to build** - cheap.

Open for D: the server must write the same document (Node zlib + the `EncryptionSession`) with each API step, and an
agent's "undo back to step n" reads it from there. Saved-game blob types (`SavedGameBlob`, step log) still live in the
Angular service; they move with D4 when the server needs them.

## A3 wrap-up (2026-10-05)

Chance is injected like the clock: `rng.ts` has `Rng`, `systemRng` (looks `Math.random` up per call), `seededRng`
(mulberry32), `rollDie` and `pickOne`. `drawRandomCard` takes an optional `Rng`; `CashflowGameService.rng` feeds
`rollDie`, card draws and (through the component) `shuffleProfession`. Behaviour in the app is unchanged; the solo engine
and the API can now play a game from a seed. Left alone on purpose: `Math.random` in id generators (saved-game ids etc.),
which are not game chance. **Next:** Phase B, the solo engine (board data from the picture, dice and movement, turn state
machine, game end, simulation tests).

## B1 wrap-up (2026-10-05)

`board.ts`: `RatRaceSpaceKind` (`deal` is one kind - the pile is chosen when landing), `CLASSIC_RAT_RACE_BOARD` (24 frozen
spaces with the printed German word), `validateRatRaceBoard`, `spaceAt` (wraps both ways) and `spaceAngle` for drawing
the ring (START sits half a step before space 0). A golden test pins it to the plan §3.1 transcription and to the
8-space pattern. The game set's old unused `board?: CashflowSpaceKind[]` is left alone. **Next:** B2 (dice, movement,
passing vs landing a Payday; the additive solo state fields JFK already approved).

## B2 wrap-up (2026-10-05)

`movement.ts`, pure: `rollDice(count, rng)`, `diceAllowed(charityRoundsLeft, wanted)` (two dice only while Charity runs and
the player chose them), `moveToken(board, from, steps)` -> `Move` (every space entered, landing, `paydays` = Paydays entered
landing included - each pays once - plus `passedPaydays` and `landedOnPayday`). A token position is the ring index, `null`
at START, so the first roll of n lands on n - 1. No turn of up to 12 can cross more than two Paydays. **The saved-state
fields (last roll, dice, phase, pending decision) are deliberately not added yet:** B2 touches no storage; they arrive
with B3, where the turn state machine actually writes them (additive and optional, as JFK approved). **Next:** B3.

## B3 wrap-up (2026-10-05)

`turn.ts`: `playTurn(books, deps, { dice })` rolls (one die, two while Charity runs), clears Downsized's spanner, moves the
token, **pays one Payday for every Payday space entered** (passed or landed), then resolves the landing: Baby / Charity /
Downsized through the existing round rules, a card space (`deal` / `market` / `doodad`) leaves a **pending decision** and
the turn open (`phase: 'decide'`) until `settleDecision(state, 'done' | 'passed')`. A roll is **one History step**
(`roll`, e.g. "4 -> market (7)"): the caller takes one snapshot and applies `effects` in order; `passed` is its own step
(`skipCard`), `done` is not (the card's own steps are already in the history). Charity: each roll while it runs uses up one
of its 3 turns. A Baby space with 3 children does nothing (found by the seeded simulation: it used to throw).

State (additive, optional - JFK approved): `CashflowGameState.turn` (`CashflowSoloTurn`), `boardPosition` is now `null` at
START for solo (it used to start at 0, unused). The loader (`decryptCashflowGameState`) reads `turn` back; storage doc
updated. Step kinds `roll` and `skipCard` are new: **the History UI needs labels for them in C-phase.**
Not yet: game end (B4), the loan-aware cash checks on a card decision (the card flows already do those), simulation
policies (B5). **Next:** B4.

## B4 + B5 wrap-up (2026-10-05) - Phase B, the solo engine, is complete

**B4, `game-end.ts`:** `gameOutcome`, `endIfOver`, `finalSummary`. Escaping the rat race (passive income >= expenses) and
bankruptcy (negative monthly cashflow) are exactly the dashboard's and the games list's existing definitions
(`summarizeGameFinances`), checked after every roll (`playTurn`) and, when the books are passed, when a card decision is
settled (`settleDecision(state, how, subscriptions)`) - a purchase can win the game. The terminal state is
`turn.phase: 'over'` with `turn.outcome`; nothing more can be rolled. The loader reads `outcome` back.

**B5, `solo-simulation.spec.ts`:** whole seeded games through the real rules on the Classic set, with two policies. Every
turn: the input books are deep-frozen (a rule that mutates throws), the token stays on the ring, round == Paydays entered,
children <= 3, every amount an integer, cash finite. Results: **never buying** plays 150+ turns and never ends (salary
alone does not escape); **buying affordable investment deals** escapes the rat race on every seed in 78-116 turns; the same
seed replays identically; a golden game (seed 4: 78 turns, 40 rounds, 7 properties) and its first six rolls are pinned for
the Pro API's scripted test (D5). `playSoloGame` is exported from that spec file; D5 should move it to a shared helper.

**Phase C next (solo UI):** the History needs labels for the `roll` and `skipCard` steps; the ring + token + dice UI; start
a solo game; the card decision hands over to the existing find-or-draw flow and then `settleDecision`. Everything the UI
needs is `playTurn`, `settleDecision`, `endIfOver`, `finalSummary` and the board.

## Phase C wrap-up (2026-10-05) - solo mode in the app

- **C1** the language step also asks _how to play_ (companion pre-selected); `pickProfession(..., mode)`; every game set can
  play solo (the Classic ring is universal board content, not a per-set field).
- **C2** `rat-race-board.component.ts`: SVG ring of 24 named cells coloured with the existing tokens, START marker, token;
  `role="img"` with a position label and a `<title>` per cell. **C3/C4** die faces from the engine's roll (existing `cf-die`
  styling, a short shake while the token walks), the token steps space by space with a Payday flash, Skip, and
  `prefers-reduced-motion` jumps straight to the landing.
- **C5** `CashflowGameService.rollTurn` (one snapshot, effects applied in order, persisted, returns the roll and move) and
  `settleSoloDecision`; the page replaces the Payday button and the "landed on" grid with the solo card in solo games; a
  card space opens the existing card flow (Deals asks the pile first) and the turn stays open until **Done** or **Pass**;
  Charity/Downsized badges have no manual dismiss in solo. History labels for `roll` and `skipCard` exist in all six languages.
- **C6** HUD: position, spaces to the next Payday, last roll, Charity turns left, the Downsized spanner; end screen for
  escaped / bankrupt with the closing numbers, Save game and New game (the existing flows).
- **C7** 37 strings in en/de/es/fr/cn/ar, guide section 8, `todo/cashflow-solo-playtest.md` (the manual checklist for JFK's playtest).

Known simplifications, to settle with JFK's playtest: "Done" is a button (the card flows do not yet settle the turn by
themselves when a card is applied); the dice are shown at once and the token then walks (no separate dice-tumble phase);
the bank loan and Undo stay available during a turn as in companion mode. Not run in a browser by me - the playtest is the
first real look at the screen. **Next:** JFK's playtest, then Phase D.
