# Dreamfund tables - for an agent

A Dreamfund table is the Dreamfund game played by several people and bots at once: everybody lives their own life (a character, a
difficulty, a map) in parallel, the Harvest market is shared and a card can be traded for a fee. An agent has four jobs here, from the
cheapest to the dearest:

1. **Watch** a table and say how it goes - `table_review` (below).
2. **Guide** the user - `table_advice`: their goals, their money, the move a strategy would make now and why, what to keep in mind.
3. **Explain** a card - `dream_cards` finds every printed card (deck `opportunity`, `harvest`, `life`, `emergency`, `dream`); read the
   card before you advise on it, and say in plain words what it does and what it risks.
4. **Play** for the user, when they ask - `table_autoplay` (a strategy plays their seat for a while) or `table_move` (one move you choose).

Read `dreamfund_strategy` for how the game is won, `dreamfund_game_en` (or `_de`) for the whole game, `dreamfund_map` for how hard each
character is. **The user's own solo game** (the one in their account, not a table) is read with `get_cashflow_game` `game` and judged
with `review`; its moves cannot be sent through the API. To play a game yourself through the API, open a table with the user and one bot
(`table_create` with `kind: dreamfund`, then `table_add_bot`, `table_start`): a table needs two seats.

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

## Guiding the user: table_advice

`get_cashflow_game` action `table_advice` with the `roomId` (and `strategy`, default `expert`). One small page for the user's seat:

- `yourTurn` and `open` - what the table waits for (a roll, a card to decide, the month to settle, nothing),
- `goals` in percent and `dreamPoints` (have / goal), `money` (cash, reserve, passive income against the cost of living, monthly cash flow,
  net worth, Bank loan),
- `next` - the moves the strategy would send right now, **in order** (a step is sometimes a few moves: the plans of a month, then settling it), each with `says` (why). `command` is exactly what `table_move` takes,
- `attention` - what to keep in mind: an offer to buy that is about to close (with the turns left), a plan the user pays into, the tax on
  a sale, a payment due, the dangers of the review,
- `toWin` - what it takes to win, `strategies` - the ways to play (`expert` is the best of the simulation; others favour savings, ETFs,
  properties, hustles, dividends, the Sapling or Tree pile, the dreams).

Say it short and in the user's words: where they stand, the one or two moves that matter and why, and what could go wrong. You do not
have to send the move: the user decides unless they asked you to play.

## Playing for the user: table_autoplay

Only when the user asked you to ("play my turns", "play for a while with the best strategy"). `play_cashflow_game` action `table_autoplay`
with the `roomId` and optional `strategy` (default `expert`), `maxTurns` (their turns to play, default 1, at most 10), `maxMoves` (at most 80),
`waitSeconds` (wait for the others and go on when it is their turn again, at most 25). The server sends, one after the other and through
the rules, the very moves a bot of that strategy would send for the seat; everything is a normal move that the table and the other players
see as the user's. The answer has `played` (each command with the events it caused, or the refusal), `stopped`
(`turns_limit`, `moves_limit`, `not_your_turn`, `waiting_for_others`, `game_over`, `refused`), `turnsPlayed`, `movesPlayed` and `advice` for what comes next.
Call it again to go on; after `not_your_turn` use `table` with `wait: my_turn` or pass `waitSeconds`. **Tell the user what was played** (the
cards taken, the sales, the plans) and stop when they say stop. A strategy never knows what you were told about the user's wishes: when they
want something particular (a dream first, no risk, no sale), play with `table_move` yourself or choose the strategy that fits.

## Being at a table as a seat (move by move)

The user is a seat at their own table; as an agent you act with their account. `table` with `slim: true` shows your life and your
`legalActions`; `table_move` plays one move. Always send a unique `clientCommandId` and the `expectedVersion`. A turn is a roll, the
decisions the card asks, and `end_turn`; the table's clock plays the most passive turn if time runs out. Use `table` with `wait: my_turn` and
`slim: true` to wait. The moves (the fields go in `command`):

| move                                                                   | when                                                        | fields                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `roll`                                                                 | start of the turn                                           |                                                                                   |
| `pay_emergency`                                                        | an Emergency card                                           | `pay`: now, 3, 6 or 12 Paydays; `choiceId`                                        |
| `emergency_choose`, `emergency_roll`, `emergency_reroll`               | the options and dice of an Emergency card                   | `choiceId`, `key`                                                                 |
| `answer_life`                                                          | a Life card                                                 | `decision`: accept, decline, roll, pass, give, lend, option; `option`             |
| `choose_career_branch`                                                 | a career fork                                               | `index`                                                                           |
| `take_dream`                                                           | a Dream tile                                                | `cardId` (or `skip` to refuse)                                                    |
| `choose_pile`                                                          | an Opportunity tile                                         | `pile`: seed, sapling, tree                                                       |
| `take_opportunity`                                                     | one of the offered cards                                    | `cardId`, `units` (shares), `steps` (a saving), `swapOut` (a side hustle to drop) |
| `plan_opportunity`, `buy_planned`, `roll_opportunity`                  | plan a card in Grow first, buy it from there, throw its die | `cardId`; `title`, `units`                                                        |
| `skip`                                                                 | leave the card (an offer, a dream)                          |                                                                                   |
| `settle_payday`                                                        | the month is due                                            |                                                                                   |
| `fund_reserve`, `fund_dream`, `fund_emergency`                         | put money in                                                | `amountMinor`, `id`                                                               |
| `set_plan`                                                             | a monthly plan per project (0 stops it)                     | `kind`: mojo, life, smile, emergency; `id`; `perMinor`                            |
| `repay_debt`, `repay_bank_loan`                                        | pay a debt off                                              | `tag`; `amountMinor`                                                              |
| `sell_holding`                                                         | sell something you own at its standing price                | `holding`                                                                         |
| `harvest_sell`, `harvest_accept`, `harvest_ladder`, `harvest_continue` | the options of a Harvest card                               | `holding`; `action`: ride, cash                                                   |
| `offer_trade`, `accept_trade`, `decline_trade`                         | trade a card with the others                                | `holding`, `priceMinor`                                                           |
| `set_insurance`                                                        | an insurance on or off                                      | `kind`, `on`                                                                      |
| `edit_transaction`                                                     | change how a booking is kept - **any time**                 | `index`, `patch`: category, account (Daily, Splurge, Smile, Fire), time           |
| `edit_subscription`                                                    | the account a running payment is paid from                  | `title`, `account`                                                                |
| `set_phase`                                                            | the phase of a project                                      | `kind`: grow, smile, fire; `id` (`life`, a card id, `mojo`); `phase`              |
| `end_turn`                                                             | the turn is played                                          |                                                                                   |

The amount, the date and the comment of a booking belong to the game and cannot be changed. Only a move listed in `legalActions` is accepted.

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

## The leaderboard and the points

One rating for everybody - people and bots on one list, start 1500, bots about 1270 to 1700. A ranked, finished game with a person at the table and at least 8 rounds (or a winner) moves it: everybody is placed by score (250 per goal in proportion to its progress, 25 per dream point, 1000 for the win; winners first, bankrupt and left last), and each player is compared with every other one - beating a higher rating earns more, losing to a lower one costs more. The difficulty is the stake: the points GAINED are multiplied by 0.7 (Easy), 1 (Normal) or 1.5 (Hard); losses are not. At an even table of four a win is about +20 on Normal, last place about -13. `dream_leaderboard` lists the board, `dream_my_player` is your rating and last games.
