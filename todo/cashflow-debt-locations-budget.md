# Debt payoff, base ratings, default location, the game's budget - plan

Status: **planned, waiting for JFK's answers** (2026-10-19). Four workstreams, each shippable on its own. Order: **A** (bank off turn,
a setting) -> **B** (pay off a liability: rules, balance sheet, dashboard, bots) -> **C** (base ratings you can re-set, history kept) ->
**D** (default bank location) -> **E** (budget: the game fills it, the new chart). C must follow B (the bots change, so the base
ratings are measured again). D comes before E (the budget and the locations both read the game's transactions).

## A. Paying the bank back at any time (a table setting)

- New table setting `bankRepayOffTurn` (default **on**, host can switch it off when opening the table; fixed once the game starts).
- With it on, `bank_loan` with a **negative** amount (repay) is accepted from any seated player at any time the game is running (not
  paused, not over for that player), exactly like selling into an offer is today (`anytime` in `reducer.ts play()`); borrowing stays
  a move of the player's own turn. With it off nothing changes.
- UI: the Repay button of the dashboard is usable when it is not my turn (the roll button's rule no longer gates it); the Add table
  panel gets the switch; `legal.ts` lists `bank_loan` (repay only) off turn; OpenAPI + AGENTS.md + MCP note; the manual's loans chapter.
- Tests: domain (off turn allowed / refused by the setting, borrowing off turn refused), UI spec, integration.

## B. Paying off a Mortgage, Car Loan or Credit Card Debt (and the bots using it)

What exists: the solo game and the Add dialog already have `Payback Liabilitie` (`removeExpenseForPaidLiability` in `deals.ts`).
What is missing: a table command, the buttons, and the bots.

- **Rule:** one payment of the **full outstanding amount** of one liability (mortgage / car loan / credit card / student loan /
  the bank loan is separate, A). It books the payment, removes the liability and **ends the monthly expense subscription** of it
  (so expenses fall and escape gets closer). Not partial. Needs the cash (see question 3).
- **Domain:** `pay_liability {tag}` table command (`planMove`), `legal.ts` entry when the player owns one and has the cash (or
  can borrow), event `liability_paid` told on the stage and in the history, same off-turn rule as A (setting
  `bankRepayOffTurn` -> rename `repayOffTurn`, covering both) - see question 2.
- **UI:** (1) the Balance sheet row of a liability gets **Pay back** (opens the app's Add dialog prefilled with the payback
  statement; at a table it sends `pay_liability`); (2) the dashboard's player info card (the balance line) opens that balance item in
  the Info panel, where the same button is.
- **Bots:** one thought on top of every strategy (like the trade offer: `bot-trade.ts` pattern, used by the server driver only,
  no profile is searched again): pay a liability off when it pays back - monthly payment x N months >= the amount, with cash left
  for the next deal, and when it brings escape within reach (passive income >= expenses minus the payment). Likelihood and the N by
  skill level and style (a beginner never). **Plus one new bot** whose whole plan is debt first ("Debt-free Dana") at four levels,
  so there is a pure strategy to measure the idea against.
- Tests: domain rules, bot thought spec, the simulation of whole tables with the new bot (invariants), integration.

## C. Base ratings you can set again, history kept

Today a bot profile has `rating` = start (from `bot-ratings.ts`) moved by every counted game. After B the bots are different, so the
start must be measured again - but the games already played (since the release yesterday) must stay.

- **Rule:** `rating = baseRating + sum of the deltas of the counted games` (the result records already hold every `delta`). The
  base of a bot is `BOT_START_RATINGS[botId]` of the **current deployment** (`BOT_RATINGS_VERSION`); a human's base is 1500.
- **Mechanism:** the profile stores `baseRating` and `baseVersion`. At backend start (after `seedBots`) a reconcile pass finds
  bots whose `baseVersion` differs from the deployed one, sets the new base and recomputes `rating = base + sum(deltas)` and `peak`
  from the result records - no game is lost or replayed, the deltas stay as they were played. Changing the table of bases and bumping
  the version in a deployment is the whole procedure (`scripts/calibrate-bot-ratings.js --write` writes the table and the version).
- **Visible:** the profile card shows **Base rating** (and the version / date it was set), the chart draws the base as a dotted line
  and as the starting point of the line, and the API gives `baseRating` and `baseVersion` (`GamePlayer`, OpenAPI).
- Open: should a change of base also move humans' ratings? No (their base stays 1500). A **second option** is to re-score all
  results from scratch with the new bases (`rebuild`): different numbers, because every opponent rating changes - see question 5.

## D. A default bank location (DONE 2026-10-19)

Built as: the location "Bank" - "Main" (translated `CashflowGame.bankLocationName/Sub`), found by the stable id `GAME_BANK_LOCATION_ID = 'game-bank'` (domain `game-location.ts`), not by name or flag. Solo: created at game start, stamped on every effect (`applyGameEffects`), its balance moves with the bookings, Undo restores locations (snapshot `allLocations`). Table: `applyBooksToApp` shows every booking on it (balance = sum). Delete: no button in the Info panel, `DELETE /locations/game-bank` answers 409 `conflict_protected`.

- Every game (solo and table) starts with the locations feature **on** and one location **"Bank account"** (language of the game),
  flagged `isDefault`. Every booking the game makes (Payday, subscriptions it generates, Doodads, Market costs, deals, loans, payoffs)
  gets this location unless the user chose another one; a new subscription made by the game gets it too.
- The user may add locations, rename and use others, and change a booking's location. **The default location cannot be deleted**
  (the delete button is not there, the API refuses it), so the automation never points at nothing.
- Where: `locationId` on transactions/subscriptions exists already; the game's starting state creates the location and sets
  `locations enabled`; `placeOneOffTransactions` / the subscription upserts of the game set `locationId`. The locations page and the
  location API refuse deleting the flagged one. Saved games and old games are left as they are.

## E. The budget: the game fills it, and the new chart

- **Filling:** every Payday the game makes, each subscription expense of that month is **planned** in the budget of that month
  (so a subscription is always planned as it happens). Doodads and Market costs are **not planned**: they land only in the actuals,
  so they show as over budget - that is the point (you see what was not planned).
- **Chart (Budget page, every account):** bars as today (actual vs planned, over/under in blue and red); **Planned** becomes
  **purple**; a **new green line with bullets: actual income** of the month. Reading it: income - actual = actual cashflow, income -
  planned = planned cashflow (not drawn, readable).
- **Info on a bar** (small and large screens, no sideways scroll): month, Actual, Planned, Over budget, then Income, Planned
  cashflow, Cashflow. The legend names the green line Income. The info triggers of the budget page are adapted for the new numbers.
- Needs: a monthly **income** series from the transactions (and a planned income, see question 6), the budget fill in the game's
  payday step (domain `rounds.ts` -> effects `budgetUpserts`), the chart code (`budget.component.ts`, d3), texts in six languages.

## Decisions (JFK, 2026-10-19)

- **A:** a table setting, **default on**: with it on any seated player may repay the bank at any time, not only on their own turn;
  it is written to the history for everybody. With it off (host's choice when opening the table) only in your own turn. Repay only,
  never borrowing off turn.
- **B:** the same setting covers paying off a liability. Not enough cash: the normal borrowing rule applies, with a **warning** of how
  much has to be borrowed (it rarely makes sense, but it is allowed). **Forbidden** when the borrowing needed would put the player
  into bankruptcy - i.e. when the monthly cashflow after the payoff (expenses lower by the liability's payment, higher by the new
  bank loan's payment) would be negative.
- **Bots:** the payoff thought for all strategies plus a new debt-first bot; once it is deployed, **recalculate all bots and
  strategies, search a new champion and get new start ratings** (a later step, after the deploy of the features).
- **C:** the existing bot profiles and all their statistics stay. Only the **base** moves; every game played after the base was set
  stays applied on top of it (history never re-scored). New bots get their own profile with a measured base.
- **D:** every game starts with the location "Bank account" (translated); automations book to it; the user may add locations,
  change bookings and **rename** the default one (the automation finds it by its flag, not its name); it cannot be deleted.
  Only new games.
- **E:** the game fills the budget on its own (subscriptions planned as they happen; Doodads and Market costs not planned). The
  income line is for **all accounts**: the **actual income** of a month = the sum of the month's income transactions (in the game:
  salary, passive income, MLM, the interest of a loan to a relative, a card sold to someone ...). Planned cashflow = income - planned
  expenses; cashflow = income - actual expenses. Only from now on (games started after the release).

## Still to confirm

1. Do the **proceeds of selling a position** (shares, a property, gold) count as income in the chart? Recommendation: **no** - they
   are capital, not earnings, and would make a month's cashflow jump; a deal card sold to a player **does** count, as you said.
   Money borrowed from the bank does not count either.
2. The payoff rule for "cannot afford" is as written above (cashflow after the payoff and its loan must stay >= 0). Right?
