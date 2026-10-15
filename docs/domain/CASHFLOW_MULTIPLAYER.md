# Cashflow at a table - playing with others

The solo game (`CASHFLOW_MANUAL_EN.md`, `CASHFLOW_GAME_GUIDE.md`) is you against the board. A **table** is the same game played by
several players at once, on the server: every player has their own books, the card piles are shared, and everything is open to
everyone - every player's profession, income statement and balance sheet - except the dice and the order of the piles. A table
never reads or writes your own account's books. It is for **game accounts only**; a normal account does not see it and is not
affected by it.

This page is the multiplayer manual. How an agent plays at a table, move by move, is section 10 of `CASHFLOW_GAME_GUIDE.md`; the
API is in `docs/api/openapi.yaml` (`/game/rooms`), the agent tools in `docs/api/MCP.md`.

## 1. What is the same, and what is not

|                                           | Solo                             | At a table                                                                  |
| ----------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| The board, the cards, the money rules     | the same                         | the same                                                                    |
| Who rolls                                 | you                              | the player whose turn it is; the dice are the server's                      |
| Card piles                                | yours                            | **shared**: a card drawn is gone for everyone until the pile is reshuffled  |
| Looking at a card                         | any pile, any card (free rules)  | one random card per space, take it or pass it (always)                      |
| Buying                                    | any time (free rules)            | only with the card in hand                                                  |
| Reporting a roll you made with a real die | allowed                          | never - only the server rolls                                               |
| Typing your own transactions              | allowed                          | never                                                                       |
| Selling                                   | at a price you name (free rules) | only into an offer a card made (see 4)                                      |
| Winning                                   | escape the rat race              | the first to escape, a round limit, or everyone finished - the host chooses |

These are forced, not options: a shared table cannot run under the solo game's loose rules, because a claimed roll, a typed-in
transaction, a peeked-at pile or a self-named sale price would let one player cheat the others.

## 2. Opening and joining a table

- **Open** from the lobby (menu, "Play with friends"): a name, the number of seats (2-12 in the screen, up to 24 through the API,
  6 by default), public (listed) or private (invite code only), the clock, how the game ends, how professions are chosen and
  whether spectators may watch.
- **Join** from the open tables, or with the invite code. You choose a name for the table; your account is never shown to the
  others.
- **Ready** up. The host starts the game when at least two players are ready.
- **Professions:** everyone picks at the same time and the picks stay hidden until the last one is in. Duplicates are allowed by
  default; the host can make professions unique, or random for everyone.

## 3. A turn

On your turn you roll; the token moves; what the space asks is settled (draw a Deal and buy or pass, pay a Doodad, a Market card is
drawn for the whole table); the next player is up. Payday is paid when a token reaches or passes it. The ring shows one token per
player, each with its colour and its first letter.

**The clock.** None, a time per move, a time bank per player (with an optional increment), or a daily clock for slow games. When
a player's time runs out the server plays the **most passive legal turn** for them: roll, pass the card, buy and sell nothing.
After a number of timeouts in a row (default 2) a player is marked **away** and their turns are played at once until they say they
are back. The host can pause and resume; a pause gives everyone the time back.

## 4. Selling and trading

Nobody sells on their own initiative. A **Market card** drawn by anyone makes an offer to every player who owns what it buys
(properties, gold); a **stock price card** moves that share's price for every holder. While such an offer is open for you, you can
sell into it - on your turn or off it - and the offer is gone when it is. No card, no selling.

The **Deal card in your hand** (a property or an asset, never a share) can be offered to the other players at a price. They can take
it at that price, answer with a price of their own, or decline; you can accept one of their prices. Nothing moves until both sides
agree, and the offer ends with your turn. Shares are never traded between players: only the player who drew the card can buy it.

## 5. Looking at the others

Every player's income statement and balance sheet can be opened at any time, next to the standings and a live feed of what
happened. There are no hidden hands.

## 6. Finishing

The game ends as the host set it: the **first player to escape the rat race** (the default), everyone finished, or after a number
of rounds. The ranking puts escapees first (earliest first), then by passive income, then the bankrupt, then those who left. Each
player can **save the game to their own saved games** (once), and from there it is an ordinary saved game: review it, compare it.

The host can **rewind** the last turn if something went wrong (a repair, not a re-roll: the dice carry on, and everyone sees it in
the log). This is an API / agent action for now.

## 7. Playing with an agent

An agent holds a seat like any player. It needs its own **game account**, a **personal access token** with the scopes `game:r` and
`game:w`, and the MCP server connected (`docs/api/MCP.md`). Then:

1. You open a table (or the agent does, `table_create`) and give the agent the invite code or the table id.
2. The agent joins (`table_join`), readies up (`table_ready`) and picks a profession (`table_profession`).
3. Once the game runs, the agent reads the table (`get_cashflow_game` `table`: its `version`, whose turn it is, and **its legal
   moves**) and plays one move at a time with `table_move`, always with a `clientCommandId` and the `expectedVersion` it read.
4. Ask it to tell you what it did and why, and when it is waiting for others.

The server enforces everything - the turn, the rules, the clock - so an agent cannot cheat and cannot play for a seat that is not
its own. A refused move changes nothing and comes back with the rule's own words. Do not let an agent rewind, kick or close a table
unless you asked.

**Challenge the agent:** tell it its task is to beat the others - to escape first. It plays within the rules and from the same
information a human has. Seat it next to people, or next to bots (section 8).

## 8. Bots

A **bot** is a seat played by the server with one of the strategies of the strategy lab (`CASHFLOW_STRATEGY_LAB.md`). It has no
account; it is always ready, picks its own profession (the one you name, else random), and takes its turn a moment after the
table changes - through the same rules, the same clock and the same log as a person, so everyone watches it play move by move and
it shows in the table with a bot marker. It sees only what a player sees (its own books and everyone's public books), never the
dice or the order of the piles.

The host seats bots in the lobby (`POST /game/rooms/{id}/bots`, MCP `table_add_bot`) and removes one with the kick of its seat. The
characters (`GET /game/rooms/bots`, MCP `table_bots`) run from easy to hard:

| Level      | Bots                                                                                           | How they play                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| easy       | Sleepy Sam, Careful Carla, Cash Charlie                                                        | never invests / only picky properties / only what cash pays for                                                                                                                               |
| medium     | Trader Tina, Banker Ben, Marketing Mia, Steady Stella, Gambler Gus                             | stocks for deposits / borrows when it pays / marketing first / small then big deals / leveraged big deals                                                                                     |
| hard       | Allie All-Round, Quick Quinn                                                                   | the best all-round strategies of the lab and the search                                                                                                                                       |
| champion   | Champion Cleo, Champion Cleo II, Master Maxine                                                 | Cleo plays the one strategy that won the most tables; Cleo II the global champion of the second search; Maxine plays the champion of her own profession                                       |
| characters | Investor Ines, Stock Sasha, Network Nils, Leverage Leo, Lucky Lena, Prudent Paula, Chaser Chen | the best version of one style each - only properties / stocks / marketing / borrowing / dice cards and marketing / no loans and safe / more risk when behind - from hard to champion strength |

**What the tournament found** (18,720 tables: 2, 4 and 6 seats, guided and strict rules, every profession, everyone the same profession or everyone a different one; every strategy in every seat): Champion Cleo won about **70-80%** of the tables she sat at, whatever the table size or rule set - against 17-50% by luck - and the best hand-built strategy, Allie All-Round, about **52-69%**. The solo search's best, Quick Quinn, which escapes fastest _alone_, wins far fewer tables (about 15-55%): a race is not the same as a solo run, and the strategy that wins it takes more risk when a rival pulls ahead. The numbers, with their 95% ranges, are in `CASHFLOW_TOURNAMENT.md`; they are not a promise for any one game - the dice decide a lot, and a human who reads the table well can beat her.

The difficulty is how often a strategy won tables in the **tournament** (`CASHFLOW_TOURNAMENT.md`, generated by
`scripts/tournament-lab.js`): whole tables played in memory with a strategy at every seat and a profession at every seat, every
strategy in every seat, again and again. The tournament is how the best strategies are found; `scripts/tournament-search.js` varies
the strategies' knobs - including ones that read how close each rival is to escaping - and keeps what wins, verified on games the
search never saw. A bot in the lobby screen is planned (`todo/cashflow-tournament-and-bots.md`); until then the host seats bots
through the API or an agent.

**Skill levels:** any bot can be seated at a level - `master` (plays its plan as found), `strong`, `casual` or `beginner` (API/MCP `level`, or the lobby's skill menu). The lower levels slip now and then - pass a deal their plan would take, take one it would leave, pay a Doodad they could pass, forget to sell - so the same character is a different opponent. The slips come from the position itself, not from chance, so a game stays reproducible.

**Agents against bots:** seat a few bots, then let an agent sit at the same table (section 7). The agent plays by the rules and
the same information as a person; the bots play their strategies. Win rates in the tournament say what to expect.

### Keeping the champions current

The champions are not frozen forever: they are what a search found on **these** rules. `npm run champions:refresh` runs the whole loop again - the tournament, a global search, a search per profession and a search per style - and ships a new champion only when it beats the one we have on games the search never saw. A test (`champions-fresh.spec.ts`) fails whenever a card, a profession, the loan rule, the board or the simulator changes, until a refresh has been run, so a bot can never be sold as a champion on rules it was not measured on. Nothing learns from live games or from people: it is offline search on simulated tables, reproducible from its seeds. See `CASHFLOW_CHAMPIONS.md` for the champion of every profession and the characters, and `CASHFLOW_TOURNAMENT.md` for the tournament.

**A rule worth knowing:** under the **guided** rules a Doodad may be passed without paying (a freedom of the guided preset; the strict rules forbid it). A strategy that takes it wins noticeably more tables - the champions do. If you want a table where nobody can skip a Doodad, play with the strict rules.

## 9. Good to know

- The table and its record live on the server. You can close the browser and come back: "My tables" lists the tables you are in.
- Everything that happens is in the log (`GET /game/rooms/{id}/log`) and in the live feed.
- The clock shown on your screen runs on your device's time against the server's deadline; the server alone decides a timeout.
- If a table misbehaves, tell the host; the host can pause, and rewind the last turn.
