# Dreamfund tables - for an agent

A Dreamfund table is the Dreamfund game played by several people and bots at once: everybody lives their own life (a character, a
difficulty, a map) in parallel, the Harvest market is shared and a card can be traded for a fee. The usual job of an agent here is to
**watch a table and say how it goes** - not to play it.

## Watching a table (the cheap way)

1. Find the table: `get_cashflow_game` action `tables` (scope `mine` for the tables the user sits at, `open` for the public ones). A
   Dreamfund table says `kind: dreamfund`, its `difficulty`, map and mode.
2. Ask for the review on demand: `get_cashflow_game` action `table_review` with the `roomId`. It is one small page:
   - `summary` - the lines to start with (who leads, who won or went bankrupt, who is far behind),
   - per player: `rank`, `score`, `goals` in percent (`reserve` of three months of expenses, `debts` repaid, `dream` lived,
     `independence` = the passive income against the cost of living), `cash`, `reserve`, `passiveIncome`, `costOfLiving`,
     `monthlyCashflow`, `netWorth`, `bankLoan`, `holdings`, `months` played and `pace`,
   - `pace` - the progress against what the best strategies of the simulation reach for the same character and level at this month
     (100 = their pace; 60 or less is well behind; `null` before month 6),
   - `watch` - the dangers of that player (a thin month, a Bank loan, no reserve after a year, no income from any card, a dream funded
     before any income),
   - `markets` that moved most and a card on `trade`.
3. Judge in the light of the character: a surgeon on Hard wins about 3 in 100 simulated games, a bus driver on Easy over 80
   (`explain_concept` topic `dreamfund_map` has the whole table). A score is not comparable across characters; `pace` is.
4. Say it short: where the user stands, who is ahead and why (their cards: holdings, passive income), the one or two things to do
   next (the free saving cards, a first hustle, the reserve, repay the Bank loan, do not fund the dream before there is income).
   Topic `dreamfund_review_guide` says how a game's own history is judged; here nobody needs the history.

**Do not** poll, and do not read the whole table (`table`) or the log (`table_log`) to answer a question the review answers: they
are every player's books and every event, and an agent pays for all the text before it again with every call. Ask again only when the
user asks again.

## Being at a table as a seat (only when asked)

The user is a seat at their own table; as an agent you act with their account. `table` with `slim: true` shows your life and your
`legalActions`; `table_move` plays one move (`pay_emergency`, `answer_life`, `choose_pile`, `take_opportunity`, `take_dream`,
`fund_reserve`, `fund_dream`, `repay_debt`, `repay_bank_loan`, `set_plan`, `sell_holding`, the `harvest_*` moves, `offer_trade` /
`accept_trade`, `end_turn`). Always send a unique `clientCommandId` and the `expectedVersion`. A turn is a roll, the decisions the card
asks, and `end_turn`; the table's clock plays the most passive turn if time runs out. Playing a table move by move costs many calls -
do it only when the user wants the agent to play, and then use `table` with `wait: my_turn` and `slim: true`.

## Opening a table

`table_create` with `kind: dreamfund` and `settings` (`name`, `difficulty` easy|medium|hard, `shape`, `size`, `mode` guided|strict,
`professions` duplicates|unique|random, `endCondition` first-win|all-done|round-limit with `roundLimit`, `clock`, `spectators`). Seat
bots with `table_add_bot` and `policyId` `dream:<strategy>` (the strategies: `get_cashflow_game` `table_bots` with `kind: dreamfund`),
then `table_start`.

## In the app

A person plays a Dreamfund table on the solo Dreamfund screen, inside the same multiplayer flow as the classic game: the lobby, the create-table panel
and the leaderboard have a Classic / Dreamfund choice, the table opens on the one room page, and once it is played the app shows the books of the seat
on screen (the map with every token, the cards, the Smile, Fire and Mojo pages) with the table layer on top - the players in the queue, the popups of
what the others do, a panel for your own money - and the classic end screen with the ranking and what it meant for the rating. An agent does not need
any of that: it reads the table with `table_review` and plays with the moves in `legalActions`.
