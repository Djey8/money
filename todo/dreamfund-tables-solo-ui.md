# Dreamfund tables on the solo screen (the final form of the multiplayer)

JFK, 2026-10-28: the Dreamfund table must feel exactly like a classic table - players in the queue at the top, round by round, the
solo Dreamfund screen with its map and every token on it, the popups of what the others do, the table settings, saving the game, the
end screen with the ranking and what it means for a ranked game, and switching to another player's books. What exists now (the
`dream-room` page) is a stop-gap and goes when this is done.

## How the classic table does it (and why Dreamfund can do the same)

- The server holds each player's **books** (`GameBooks`, `packages/domain/src/cashflow-game/books.ts`) and sends them in the view
  (`PublicBooks`); the browser's **table mode** (`src/app/tables/table-mode.service.ts`, `applyBooksToApp`) puts the books of the seat on
  screen into `AppStateService`, so the solo game screen and the app's pages draw from them as they do in a solo game.
- The solo screen's moves go through the `RemoteGame` seam (`src/app/shared/services/remote-game.ts`) as commands to the server; the
  table layer (`table-layer.component.ts`), the presenter (popups), the stage, the banner and the history are the table's own.
- The Dreamfund engine (`DreamPlayer`) is **already built on `GameBooks`** (`books`, with `books.state` holding the turn, the position
  and the pending tile). What it keeps beside them - the reserve (Mojo), the dream's savings, the Smile projects, the payment plans, the
  points - is what the solo screen keeps as app entities (Mojo, `allSmileProjects`, `allFireEmergencies`, `#dreamfund` subscriptions).

So the work is a **bridge**, not a rewrite: the view carries each seat's books and Dreamfund extras; the browser turns them into the
app's entities; the Dreamfund tile cards send their decisions to the table instead of the local service.

## Slices

| #      | Slice                                                                                                                                                                                                                                                                                 | Done when                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| R1 ✅  | **Books in the view (already carried as `life` of every seat).** The Dreamfund table view carries each seat's `books` (public, like the classic) and the extras (reserve, dream savings, projects, plans, points, board setup); domain spec; OpenAPI/MCP description of the view      | a spec shows the books of a started table; the review page still works                                              |
| R2 ✅  | **Bridge to the app.** One pure function turns a seat's books + extras into the app's entities (Mojo, Smile projects with buckets, Fire reserve and emergencies, `#dreamfund` subscriptions), using the solo's own card builders                                                      | the books of a played table show in the Smile/Fire/Mojo pages as the solo game shows them (spec against the solo's) |
| R3     | **Table mode for Dreamfund.** `DreamSessionService` has the classic session's shape; `TableModeService` takes either game; the table route opens the solo screen with the map, every token, the players' queue, looking at another player's books (read only)                         | a table can be opened, watched and looked through on the solo screen; no moves yet                                  |
| R4a ✅ | **Roll.** The server reports the dice and the way the token walked; the Dreamfund driver sends `roll` / `end_turn` / `skip`; the stack tiles are on for a Dreamfund table; the card the server drew is written into the turn's pending decision (Emergency, Life, Dream, Opportunity) | a person rolls at a table on the solo screen, the token walks, the others see the popup (checked in the browser)    |
| R4b    | **Emergency and Life tiles.** The card's choices and dice are the server's (commands to choose, roll and re-roll; pay now or on a plan); the tile card sends them                                                                                                                     | a person pays an emergency and answers a life card at a table                                                       |
| R4c    | **Career and Dream tiles** (the roll and the branch; take or decline a dream; the moment)                                                                                                                                                                                             | both flows play at a table                                                                                          |
| R4d    | **Opportunity tile** (pile, cards, buy with the choices)                                                                                                                                                                                                                              | an Opportunity card is bought at a table                                                                            |
| R4e    | **Harvest tile** (sell in the window, accept a sale, ride or cash a hype)                                                                                                                                                                                                             | a Harvest card is answered at a table                                                                               |
| R4f    | **The player's own money** from the app's pages (fund the reserve and the dreams, repay a debt, the plans, the Payday settlement) through the remote seam                                                                                                                             | the Smile, Fire and Mojo pages act on the table's books                                                             |
| R5     | **Table things.** Trading and standing sales in the solo UI, hold/continue gate, clock, table settings and menu, history lines for every Dreamfund event, away/leave/resign                                                                                                           | everything the classic table layer offers works for a Dreamfund table                                               |
| R6     | **The end.** End screen with ranking, goals, dream points and what the game did to the rating (ranked); saving the finished game into the saved games; the review page for agents                                                                                                     | a ranked game ends with the classic end screen and a saved game                                                     |
| R7     | **Retire the stop-gap.** Remove `dream-room`, its texts and specs; docs and the manual; languages                                                                                                                                                                                     | one table screen for both games                                                                                     |

Rules for every slice: the Firebase edition stays free of all of it; the classic table must not change behaviour (its specs are the
guard); one concern per commit; `npm run verify` and `npm run build:selfhosted` before each push.

## Open points to check while building

- The solo screen builds its Smile/Fire entities with translated titles in the game's language; the bridge builds them from card ids in
  the viewer's language (the cards are in the client).
- What the table keeps per seat that the solo keeps globally (the Harvest markets are shared at a table; the solo has its own).
- Looking at another player's books must show their Smile/Fire pages too, read only.
