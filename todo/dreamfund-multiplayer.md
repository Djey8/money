# Dreamfund multiplayer (lobby, tables, bots, MCP, tournaments, ranking)

**Status:** plan locked 2026-10-27 (JFK's decisions below). Built slice by slice; each slice small, tested, one concern per commit,
pushed to `develop`. The classic multiplayer (`todo/cashflow-multiplayer.md`, `todo/cashflow-leaderboard.md`,
`todo/cashflow-tournament-and-bots.md`, `packages/domain/src/cashflow-game/table/`, `backend/services/game-room*.js`,
`src/app/tables/`) is the template for the flow, the settings, the history, the rooms, the bots and the rating; the Dreamfund
game brings its own cards, goals and board. Game accounts only; the normal app and the classic tables stay untouched (hard rule).

## Decisions (JFK, 2026-10-27)

1. **Lobby settings like classic:** end condition (first to win / everyone finishes / round limit), profession rule (pick /
   unique / random / duplicates), turn order, clock, visibility, seats, spectators, rewind, turn gate, bot pace, ranked, away rule.
   Plus the Dreamfund's own: **difficulty** (Easy / Normal / Hard), **map** (shape ring / infinity / rectangle / square / mountain,
   size), the Custom JFK rules mode (free / guided / strict) and its single rules (offers per landing, side hustles, savings copies...)
   from the solo setup. One setup screen for solo and online.
2. **Parallel play + a shared market:** everyone plays their own life and board position; the Harvest market (one index per market
   for the whole table), the card piles and the dice of table events are shared; whoever draws a Harvest card moves the markets and
   anyone may sell into it (the classic rule).
3. **Trading:** a player can offer an Opportunity card they own (a holding) to another player for a fee in cash; the other accepts
   or declines; the holding and the cash move; it is in the history for everybody (classic `trade.ts` adapted to holdings).
4. **Ranking and the final leaderboard count the Dreamfund goals:** dream points, debts repaid, the Mojo reserve, the dream lived and
   independence - not only the escape. Different characters and difficulties are not equal: the expected result of a player is
   handicapped from the map of `docs/dreamfund-balance/matrix.json` (a win as Dr. Jan on Hard is worth more than one as Peter on Easy).
5. **Schema approved:** a Dreamfund kind in `gamerooms` and in `gamestats` (new fields, the old documents unchanged and still read).
6. **Fully playable by agents (MCP) and bots:** every table command is also an MCP action; the bots are the 12 strategies of the
   simulation with the map as their strength.
7. **Afterwards: a tournament mode** for the bots - rankings and Elo per difficulty (the edition's extra dimension).

## The big design: one pure engine for solo, the simulation and the table

Today the Dreamfund turn is split: the pure rules (`playTurn`, `opportunity.ts`, `harvest.ts`, `emergency-deck.ts`, `life-deck.ts`,
`career.ts`, `dream-deck.ts`, `difficulty.ts`) are in the domain package; the solo game wires them in the Angular service and the
app's Smile / Fire / Mojo pages; the simulation (`dreamfund-sim/world.ts`) re-implements the wiring headless with a few numbers
(reserve, dream saved, payment plans) kept beside the books. A table needs the wiring on the server, for every player, driven by
commands - so it is extracted once:

- `dreamfund/player.ts` - `DreamPlayer`: plain data per player: the `GameBooks`, the reserve (Mojo), the dreams and their funding,
  the payment plans, dream points, the goals reached. Serializable, no Angular.
- `dreamfund/turn.ts` - the turn as a state machine with **pending decisions** (an emergency to pay or plan, a Life card to accept,
  Opportunity offers to take, a Harvest ride, a Dream to pick, a promotion branch): `step(player, table, command)` returns the new
  state and the next pending decision or `done`. The simulation answers the decisions from a policy, the table from a command.
- `dreamfund/table.ts` - the shared things: Harvest market indices, the piles' shuffle and discard, the turn order, rounds, the end
  condition; the reducer `applyDreamCommand(table, actor, command)` (classic `table/reducer.ts` as the model).

Proof of the extraction: the simulation moves onto it and plays the same games seed for seed (the map's numbers are unchanged).

## Slices

| #    | Slice                                                                                                                     | Done when                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | The engine: `DreamPlayer` + the turn as decisions; the simulation runs on it                                              | `npm run simulate:dreamfund` gives the same games as before (same seeds, same records); unit tests of each decision |
| 2    | Table state and reducer: settings, seats, phases, shared markets and piles, turn order, end conditions, goals and scoring | a scripted 4-player table (strategies as players) plays to each end condition in a test; golden fixture             |
| 3    | Bots: the 12 strategies as table players (+ pace, away auto-play, the most passive legal move)                            | a table of bots finishes; results match the simulation's win rates within noise                                     |
| 4    | Trading of Opportunity cards for a fee                                                                                    | offer / accept / decline / expire, holdings and cash move, history, bots may trade                                  |
| 5    | Server: room kind `dreamfund` (`gamerooms`), lobby API, live channel, commands, clock, away                               | integration test with CouchDB: lobby -> start -> play -> finish; reconnect; timeout                                 |
| 6    | MCP: every command, the table view and the lobby for agents                                                               | an agent plays a table through the MCP in a test                                                                    |
| 7    | Frontend: the shared setup (solo + online), lobby, waiting room, the table view with N players                            | usable by hand; the solo game unchanged                                                                             |
| 8 ✅ | Ranking: result records with goals and dream points, handicap from the map, leaderboard per difficulty                    | scoring unit tests; leaderboard page                                                                                |
| 9    | Tournaments for bots: brackets / round robin per difficulty, Elo per bot per difficulty                                   | a tournament runs headless; the ratings table                                                                       |

Slices 1-4 are pure domain (fast tests, no server); 5-6 the backend; 7 the frontend; 8-9 the competition.

## Open design points (decided as we reach them)

- The shared Harvest market: one index per market for the table, one card drawn per Harvest landing by whoever lands - the same
  card is applied to every player's holdings (each player's own `harvest` effects with their own dice where a die is rolled).
- Dice cards with a roll (side hustles, businesses) are rolled for the player who owns them, from the table's seeded Rng so a replay is exact.
- The reserve and the dream funding are inside `DreamPlayer` (not in an account), with the same numbers the solo pages show.
- Win rules for a table: `first-win` (first to all five goals), `all-done` (until everyone has won or is bankrupt),
  `round-limit` (ranked by goal progress and dream points).
- Ranking handicap: the expected score of a player in the Elo duels uses the map's win rate of their character and difficulty.

## The leaderboard and the competition (JFK, 2026-10-27; slices 8 and 9)

- **A world of its own.** The Dreamfund has its own tab and its own leaderboard - nothing of the classic ratings, results or screens is
  reused or shown in it; the classic edition stays as the backup tab until it is cleaned out. New storage (approved) with a `dreamfund`
  kind, never mixing the two games' players, results or ratings.
- **One rating per player and per difficulty.** A person and a bot have a rating for each of Easy, Normal and Hard (three, as the game
  has three; the dimension is easy to extend) - "the edition has another dimension, the difficulty". The characters are a dimension of
  the bots: every bot is a strategy playing a character, each at every difficulty, so everybody can be put at every table and the
  leaderboard shows how a bot progresses through the levels.
- **Bots start with their own Elo**, seeded from the map (`docs/dreamfund-balance/matrix.json`: the win rate of a strategy on a
  character and level) and then move with their results; the more they play, the more they appear on the board (provisional until a
  number of rated games, like the classic).
- **What counts in a result:** the goals reached, the dream points, debts repaid and the Mojo reserve, and the win (`scoring.ts`), and
  the handicap of the character and level (the expected result of a player comes from the map).
- **Tournaments for the bots (slice 9):** headless round robins / brackets per difficulty over the strategies and characters, run on the
  server or by script, that give every bot persona its starting rating per level; the same machinery later runs seasons.
- **Open question:** whether a bot persona is `strategy x character` (many more rows) or a strategy that plays a random character at
  each table (fewer rows, the character's difficulty averaged out). Recommended: persona = strategy; the board can be filtered by
  character, and the rating is kept per strategy and level (with a per-character breakdown).

## What the MCP is for (slice 6, decided with JFK)

Playing a table move by move through an agent costs too many tokens (every call re-reads all the text before it), so the MCP is
deliberately small: **an agent watches a table on demand** (`get_cashflow_game` action `table_review`: one page with every player's
goals, pace against the simulation and what to watch) and can open or join a table or play when asked; the guide for agents is
`docs/domain/DREAMFUND_TABLE_GUIDE.md`.
