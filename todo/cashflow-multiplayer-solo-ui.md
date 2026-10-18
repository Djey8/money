# The table plays in the solo game's own screen

**Decision (JFK, 2026-10-16, after the first playtest):** "I would like to have the same game design and flow, same features and design
as we have it for solo games, just with these extra online features ... the assets and the game logic live inside the lobby and not
on my own account ... So the solo game, extended to be played with friends."

The table screen built in phase U (`src/app/tables/`) is functional but a different product: no dice, no card faces, no real asset view,
none of the dashboards. This plan replaces its core with the solo game's panel and the normal app pages.

## What stays and what changes

- **Stays (server):** the room owns the game. Every player's books live in the room, the rules and the dice are the server's; a table never
  touches the books of anyone's account. Nothing about the API, the bots, the clock or the lobby changes.
- **Changes (client):** while you are at a table the app is in **table mode**: the app's in-memory state (`AppStateService`) shows _your
  table character's books_ instead of your account's, the solo panel (`CashflowGameComponent`) and the normal pages (Home, Daily, Income
  statement, Balance sheet, Subscriptions, Grow...) draw from it as they always do, and every action the panel makes is sent to the
  table as a command instead of being applied locally.

## Why this way (and what it costs)

The solo panel reads `AppStateService.instance` directly (79 places) and applies its moves through `CashflowGameService` (44 methods).
Abstracting both would be a rewrite; making them _believe_ the table character is the account is not. The price is that table mode
must be airtight:

1. **Nothing may be written to the account while in table mode.** A read-only guard in `DatabaseService` (`writeObject`,
   `writeObjectIfDirty`, `batchWrite`) and `AppDataService.applyBatchData` (no reload from the server over the table's books).
2. **Leaving table mode reloads the app** (`location.reload()`), so the account's own state comes back from the database - never from
   memory that held someone else's books.
3. **The tier flags are set** (`tier2Loaded`, `tier3*Loaded`) when the table's books are loaded, so no lazy loader fetches the
   account's data over them.
4. **Every action goes to the server.** In table mode the panel's handlers call a `TableGameDriver` (the same methods as the solo
   service's, answered by commands) and never mutate state locally; the next table update re-hydrates the books.

## Phases

| Phase  | What                                                                                                                                                                                             | Result                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **R0** | Spike: table mode (guard, hydrate from the table's books, panel opened over them) read-only                                                                                                      | the dashboard, balance sheet, assets, history and board of the table character, in the solo screen |
| **R1** | Actions: roll, pile choice, draw, buy (with the share count), pay Doodad, Market cards, pass, bank loan, dice decisions - each as a table command                                                | a whole turn played in the solo screen                                                             |
| **R2** | The online layer around it: all tokens on the board, who is on the move, the clock, the bots, the live feed, and **"look at player X" = the same dashboard hydrated read-only with their books** | the other players' dashboards, in the same views                                                   |
| **R3** | Selling and trading: sell into Market offers, "sell to a friend" = offer the card to the table, counters, accept                                                                                 | the solo flows for selling, as table commands                                                      |
| **R4** | Polish and cleanup: the old table screen goes (the lobby stays), tests, docs, the manual's chapter, the playtest checklist                                                                       | one game screen                                                                                    |

## Rules for every slice

- The solo game must behave exactly as before when not in table mode (its specs stay green and are the safety net).
- Table-mode code lives in the self-hosted chunk (`src/app/tables/`); the shared files carry only a generic **read-only** switch and
  hooks, no Pro text (docs/adr/0004). Verified by the Firebase build and a search of its output.
- A normal account never reaches table mode; the backend refuses it anyway.
- `npm run verify`-level checks before each commit; commits are small and separate.

## Status (2026-10-16)

JFK's second round of feedback (after the first playthrough): _the lobby is for setting up and the online extras; once the game runs
everything happens in the game screen_ - see the other players and their cards, bots/agents wait for people who can still sell, time
management, and pressing "Friends" while a game runs goes straight into it.

| Done  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0    | Table mode: the app shows the table character's books, nothing is written to the account (`DatabaseService.readOnly`), reload on leave                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R1    | The game screen's moves go to the table: roll (dice tumble on the server's faces), draw, buy (share count box), pay Doodad, pass, bank loan, dice decisions, "sell to a friend" = `offer_trade`; the generic seam is `shared/services/remote-game.ts`                                                                                                                                                                                                                                                                                                                                  |
| R2    | Online layer on top of the game screen (`table-layer.component.ts`, shown through `RemoteGameHook.layer`): whose turn, round, the clock countdown, who the table waits for, **Done**, every player as a chip (tap = look at their books, read only, the same screens), the live feed, back to the lobby                                                                                                                                                                                                                                                                                |
| R3    | Selling inside the layer: buyers' offers (`sell_position`), a friend's offer on the table (take / counter / decline), my own offer (withdraw, accept a counter)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Entry | The table room opens the game screen by itself once the game runs and I am seated (`?lobby=1` stays on the page); the lobby jumps into my only running table; the menu's Friends entry brings the game screen back while a table is on                                                                                                                                                                                                                                                                                                                                                 |
| Hold  | **The turn waits for people who can still sell.** When a turn ends and a _person_ (not a bot, not away) can still sell into an offer it left open (a Market card, a stock price), the table does not move on: `table.hold` lists them, they sell and press **Done** (command `done`), or can sell no more, or the hold's time is up (45 s on a per-move or bank clock; no limit without a clock). Bots and agents wait the same way - an agent sees `done` in its `legalActions` and its seat in `holdSeats`. Optional field `hold` on the table document (additive, nothing migrated) |

Still open: the token does not walk (it shows its new space after the roll), the old table screen's play UI is still in
`table-room.component.ts` for spectators (R4: remove what the game screen replaced), the Payday banner of a roll, Charity's dice choice
reset, and the manual's chapter and the playtest checklist describe the old screen.

### Update 2026-10-17 (JFK's third round of feedback)

Also done: the other players' turns are **told round by round** (`table-presenter.ts`: dice tumble, token walk, card with its
numbers, money patch), the **turn gate** is now _every person says Continue after every turn_ (`settings.turnGate`, default on for
tables people create; bots and away players are not waited for), **undo is a vote** (`propose_undo` / `vote_undo`, more than half of
the people; `allowRewind` switches it off), the History view lists everybody's moves, the card flow is the solo one (**plan_deal ->
Grow -> buy_planned**, `finish_card`; Grow's Buy/Sell are routed through `GrowTradeService`), the pages' local caches are shadowed
while a table is on (`LocalService.shadow`), the lobby and the room page have the app's toolbar, and `src-tauri/` is out of the docker
build context (it was 2 GB: image builds went from ~25 minutes to ~6).
