# 0010. Cashflow game multiplayer architecture

## Status

Accepted 2026-10-14 (JFK). Spikes M0(a)-(c) run 2026-10-14; results in `todo/cashflow-multiplayer.md` §5.0. Plan and slices: `todo/cashflow-multiplayer.md`. Nothing implemented yet. The `gamerooms` storage schema (S1) and the nginx streaming location (S2) are approved in principle; their concrete shapes are documented when those slices land.

## Context

JFK wants to play the Cashflow rat race online with friends: a lobby, tables with chosen settings, round-based turns on an optional chess clock with an automatic passive move on timeout, every player's cards and books visible to all, one token per player on the wheel, some actions for the whole table (Market cards) and some only for the active player. No player limit imposed by the design.

Today the game is solo: the pure rules engine in `packages/domain/src/cashflow-game/` runs against the player's own account, whose data is encrypted with that user's key. The backend is Express + CouchDB on a single replica; there is no push channel, room concept or server timer.

## Decision

- **The room owns the game.** Each table holds plain, server-side state: one `GameBooks` per player plus shared table state (decks, turn order, clock). Game data is public to the table by design and is stored unencrypted in its own `gamerooms` database. A multiplayer game never reads or writes any personal account's books; a finished game may be filed into each player's saved games as a read-only snapshot.
- **Server-authoritative pure reducer in the domain package:** `applyCommand(table, playerId, command, ctx)` (the table carries its own dice stream position, so the reducer needs no `rng`/`now` parameters) in `packages/domain/src/cashflow-game/table/`, built on the existing `playTurn`, deal, market, rules and game-end functions. Clients send typed intents only; the server validates turn ownership and `legalActions`, rolls all dice with a per-room secret-seeded RNG, and forces `reportRolls: forbidden` and `manualTransactions: forbidden`. No hand-written `Transaction.comment` DSL.
- **Transport: Server-Sent Events for push, REST for commands.** Commands carry a `clientCommandId` (idempotency) and `expectedVersion` (optimistic concurrency). SSE supports `Last-Event-ID` replay from the persisted event log and needs no new dependency. WebSocket stays an option if bidirectional chat is ever needed.
- **Persistence:** room doc + per-player books docs + append-only event docs in CouchDB; a restart reloads active rooms and re-arms clocks. CouchDB `_changes` is the future path to more than one backend replica.
- **Clock is server-side.** Deadlines live in the table state; clients render countdowns only. Timeout executes `passiveMoves` (roll, pass cards, buy/sell nothing, pay a Doodad only when passing is forbidden) through the same reducer, so a late command simply fails the version/turn check. After K consecutive timeouts a player is marked away and auto-played.
- **Visibility:** everything except deck order and the RNG seed is visible to every viewer; `projectFor(table, viewer)` is the single place that decides it.
- **Peer trades:** a player may offer a position to another player (or the table) at a named price; nothing moves until both sides agree on the price, then both books change atomically. Shares are never traded between players, and only the player who drew a Deal card can buy it. Selling exists only through a picked card: a Market card drawn by anyone makes its offer to every player, and each player who owns what it buys may sell into it, on or off their own turn. There is no selling without a card.
- **Limits:** host-set seats (default 6, UI up to 12, config ceiling 24); duplicate professions allowed. Access stays limited to game accounts.
- **Isolation (hard requirement):** multiplayer is a game-account feature only. Every endpoint, the event stream and the MCP tools sit behind the game-account guard and `game:r`/`game:w`; all state is in the new `gamerooms` database with no change to any existing path; domain code is additive; the UI is a lazy game-only route. A normal account must be provably unaffected (tests in the plan, §4.1).
- **MCP:** the existing `get_cashflow_game` / `play_cashflow_game` tools are extended so an agent can hold a seat; same server-side authorization, timeout and passive-move rules as a human.
- **Edition:** self-hosted only; no Pro/game code enters the Firebase build (ADR-0004).

## Consequences

- Multiplayer rules live next to the solo rules and reuse them; a rule fix applies to both.
- Table-level concepts missing today (shared decks, table-wide Market effects, turn order, real Downsized skips) must be added in the reducer, not bolted onto the solo state.
- No undo at a table; a host "rewind last turn" from a per-turn snapshot replaces it.
- The solo UI is coupled to the account through `CashflowGameService` (79 reads of the global app state, writes via the persistence service). Decided by spike M0(b): the service is left alone; presentational components are extracted from the solo template and a new table component with its own session service feeds them with server state.
- Game routes get their own rate-limit bucket: the existing per-IP/per-token limiters are shared with the normal app (M0(c)).
- A single replica means a restart drops streams and timers; clients reconnect with replay and timers re-arm from the database.
- nginx needs a dedicated streaming location (buffering off, long read timeout) for the events endpoint, like `/mcp`.
- Agent seats, bots, web push for daily games and text chat are possible later without redesign.
