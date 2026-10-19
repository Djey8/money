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

## D. A default bank location

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

## Questions (with my recommendation)

1. **A:** setting name and default - `Bank repay off turn`, default **on**? Does it also allow _borrowing_ off turn? (recommend: repay only.)
2. **B:** one setting for both (repay the bank and pay off a liability off turn), or paying off a liability **only on your own turn**?
   (recommend: one setting, both off turn.)
3. **B:** when the cash is short, may a payoff take a Bank loan first (as a purchase does), or is it refused? A bank loan costs 10%
   of its amount per month, so a payoff financed by it cannot lower the expenses much. (recommend: refused, cash only.)
4. **B:** the bots: an add-on thought for **all** strategies (cheap, no search) plus one new debt-first bot - or search a new champion
   for it later? (recommend: add-on + the new bot now.)
5. **C:** keep what was played and only move the base (as written), or also offer a full re-score of all results with the new
   bases? (recommend: only move the base; re-score stays a manual CLI.)
6. **D:** name of the default location in the six languages ("Bank account" / "Bankkonto" ...) and may the user **rename** it?
   (recommend: yes rename, never delete.)
7. **E:** where does **planned income** come from, for "Planned cashflow"? The salary subscription of the game (positive
   subscriptions of the month) is the natural planned income; other accounts have no planned income today - for them show only
   Income and Cashflow, or add a planned-income budget line? (recommend: planned income = positive subscriptions of the month; hide
   "Planned cashflow" when there are none.)
8. **E:** should the game also fill the budget **for months that already passed** in a running game, or only from now on? (recommend:
   from now on.)
