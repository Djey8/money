# Cashflow game — online multiplayer (lobby, tables, turns, chess clock)

**Status:** plan locked 2026-10-14 (JFK answered Q1–Q7, approved S1 `gamerooms` schema and S2 nginx change; Q8–Q15 take the
recommendation unless JFK objects). **Nothing is built. M0 done 2026-10-14 (ADR-0010 + three spikes, results in §5.0); Phase T (table engine T1-T7) is built and committed; S1 (rooms store + lobby API), S2 (live channel) and S3 (command endpoint) and S4 (clock service) and S5 (finish and archive) are built; next: S6 (bot-client harness).** Supersedes the one-line
"Phase 6 — multiplayer" stub in [`cashflow-game.md`](cashflow-game.md); builds on the solo engine from
[`cashflow-game-pro.md`](cashflow-game-pro.md) (Phases A–D) and the rules/legal-actions work in `packages/domain`.

## 1. Goal

Play the Cashflow rat race **online with friends**, with no player limit that the design imposes:

1. **Find players** — a lobby of open tables, invite links/codes, friends.
2. **Start a table with chosen settings** — rules, clock, end condition, seats.
3. **Round-based play**, each player takes their own turn, on a **chess clock** (per-player time bank) or **no limit**.
   A player who runs out of time gets the **most passive legal move** played for them automatically.
4. Everyone **picks a profession**, and **everything is visible to everyone**: every player's cards, books and history can be
   inspected at any time. The wheel shows **one token per player**.
5. Some actions belong to the table (a Market card is for everyone — anyone may sell into it), some only to the player who
   drew the card (a Deal on _your_ space, a Doodad).

**Exit criterion:** 4+ friends, each on their own device, play a full game from the lobby to the end condition on the
self-hosted server, survive one reconnect and one timeout, and nobody's own account books were touched.

## 2. Analysis — what exists, what it means

### 2.1 What we can reuse (and it is a lot)

| Existing                                                                                                                                          | Why it matters for multiplayer                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/cashflow-game/` is **pure** (`playTurn(books, deps)` → effects, injectable `Rng` and clock, ~15k lines incl. tests)          | The server can run **the same rules** for every player. This was the point of A1–A3; `rules.ts` already says "the app, the Pro API, an agent and a future multiplayer server all go through the same functions". |
| `GameBooks` / `applyEffectsToBooks` (`books.ts`) — plain-data books                                                                               | One `GameBooks` per player, held by the room, no Angular, no personal account involved.                                                                                                                          |
| `legalActions()`, `whyCannotRoll/Settle/Draw/…`                                                                                                   | The server needs "what may this player do now" for authorization **and** for the passive auto-move. It already exists.                                                                                           |
| `GameRules` (`strict` = offered-once cards, with-offer sells, no manual transactions, no claimed rolls)                                           | Exactly the anti-cheat set a shared table needs; multiplayer forces its cheat-relevant settings.                                                                                                                 |
| `game-end.ts` (`escaped` / `bankrupt`), `endIfOver`                                                                                               | Terminal states per player already exist.                                                                                                                                                                        |
| Seeded `rng.ts`, `simulation/`, `solo-simulation.spec.ts`                                                                                         | Deterministic table simulation tests and **replay** come almost free.                                                                                                                                            |
| `rat-race-board.component.ts` (SVG ring, 24 cells, one token)                                                                                     | Extends to N tokens; the board data (`board.ts`) is unchanged.                                                                                                                                                   |
| Snapshot codec / saved games (`saved-games.ts`, `game-snapshot.js`)                                                                               | A finished table game can be filed into each player's saved games as a read-only snapshot.                                                                                                                       |
| Game-account gate (`game-account.js`: email contains `cashflow` + game password)                                                                  | A closed community (you + friends) — shapes lobby, moderation and capacity a lot (§4 Q13).                                                                                                                       |
| nginx already proxies long-lived streaming for `/mcp` (`proxy_buffering off`, 3600 s read timeout); backend is Express + CouchDB, JWT cookie auth | A push channel is feasible **without a new dependency** (SSE).                                                                                                                                                   |

### 2.2 What does **not** transfer — the real work

1. **Today the game writes into the player's own account.** Solo play creates real Subscriptions/Transactions/Grow
   projects in _that user's_ encrypted document (`game-play.js` → the user's books). Multiplayer cannot work that way:
   - Other players must read your books, but your document is encrypted with **your** key, which the server may not hold
     (see memory: ADR-0001's per-request key header was never implemented).
   - Seven people writing into seven personal accounts, driven by one shared event stream, is a desync factory.
   - It would pollute people's real data with game data they didn't ask for.

   → **The room owns the game state** (plain, server-side, one `GameBooks` per player). Game data is public to the table
   by design, so no encryption at rest is needed for it — and it must never contain anything from a real account.
   (Recommendation for Q1; this is the single biggest decision in the plan.)

2. **The engine models one player at a table of one.** Things that are per-player today but are _table_ concepts in the
   real game:
   - **Card decks** — `drawnCardIds` (the discard pile) lives in each player's `CashflowGameState`. A table has **one**
     set of piles, one reshuffle.
   - **Market cards** — one player draws it, **every** player may be affected/sell: buyer offers
     (`marketOffers`, per-player `offeredAtRoll` already!), stock split (one roll for the whole table), cashflow boost,
     cost cards for property owners. Today `market-cards.ts` applies a card to one set of books.
   - **Turn order and "rounds"** — `turn.count` is a roll counter, `round` is the player's own Payday calendar. The table
     needs a turn pointer, an order, and a table round.
   - **Downsized "sit out 2 rounds"** and **Charity "1 or 2 dice for 3 turns"** — reminders today; with other players
     they become real skipped turns / real counters.
   - **Deal cards** — the lander decides, but in the physical game _passed_ deals can be bought by others (Q5).
   - **Hidden information** — only the deck order and the RNG seed. Everything else is open information in the real game.

3. **Real-time, authoritative, multi-client.** There is no push channel, no room concept, no server-side timers and no
   per-viewer projection today. Backend is a **single replica** (`k8s/backend.yaml`, `replicas: 1`), which makes
   in-process fan-out legitimate now — but the design should not make a second replica impossible later.

4. **The solo UI is bound to the player's own account.** `cashflow-game.component.ts` (~2.8k lines) and
   `cashflow-game.service.ts` (~2.7k) drive the card flows (deal pile choice, find-or-draw, doodad pay, market offers,
   dice cards) through services that mutate the user's account. The table UI needs the same flows against **remote
   state + commands**. _Hypothesis to verify in M0, not a fact:_ a "session port" (`LocalAccountSession` today,
   `TableSession` new) with the presentational parts extracted is cheaper than forking the component. This is the
   largest frontend risk.

5. **Clock = server time.** Deadlines must be server-authoritative (clients only render a countdown), survive a backend
   restart (re-arm timers from the database on boot), and be fair to latency (the clock stops when the move is _received_
   by the server, with a small grace).

6. **Scale of "no limit".** There are only **~16 professions** in the game set, so a table larger than 16 _must_ allow
   duplicates; 24 board spaces get crowded past ~12 tokens; and turn latency grows linearly (20 players × 30 s ≈ 10 min
   between your turns). Technically the engine has no limit; the plan treats the cap as a **host setting with a hard
   server ceiling** and the UX as the real limit (Q2).

_Update after M0: the "session port" idea in point 4 is replaced by extracting presentational components (§5.0(b))._

### 2.3 Architecture (recommended)

```
 Angular table UI ──REST commands (POST /game/rooms/{id}/commands, version + client id)──▶ Express
        ▲                                                                                   │
        └──────────── SSE event stream (GET /game/rooms/{id}/events, Last-Event-ID) ◀───────┤
                                                                                            ▼
 packages/domain/src/cashflow-game/table/   ← NEW pure reducer: applyCommand(table, playerId, cmd, rng, now)
        │  uses playTurn / market-cards / deals / rules / game-end per player's GameBooks
        ▼
 CouchDB `gamerooms` (room doc + per-player books docs + append-only event docs)   +  clock scheduler (server timers, re-armed on boot)
```

- **Server-authoritative reducer in the domain package.** Clients send _intents_ (`roll`, `buy_deal`, `pass_card`, `sell`,
  `end_turn`, `pick_profession`, …), the server validates against `legalActions` + turn ownership, applies the reducer,
  persists, then broadcasts events. Nothing the client says about dice or amounts is trusted: `reportRolls: forbidden`,
  `manualTransactions: forbidden`, server RNG with a per-room secret seed.
- **Transport: SSE for push + plain REST for commands.** Commands are discrete, idempotent (`clientCommandId`) and
  version-checked (optimistic concurrency); SSE gives reconnect + `Last-Event-ID` replay for free, works with the
  existing cookie auth and nginx (needs its own `location` with buffering off, like `/mcp`), and adds **no dependency**.
  WebSocket (`ws`, MIT) is the alternative — only worth it if we later want sub-100 ms bidirectional chat/cursors.
- **Persistence:** every accepted command appends an event doc; the room doc holds the current table state (version
  counter). A restart re-reads active rooms, re-arms clocks. CouchDB's `_changes` feed is the future path to multiple
  replicas (events become the pub/sub).
- **Per-viewer projection:** `projectFor(table, viewerId)` strips only deck order/seed. (Kept as a function so a hidden-info
  variant or spectator view needs no restructuring.)
- **No undo in multiplayer** (a table game): replaced by an optional host "rewind last turn" backed by a per-turn
  snapshot (Q8). The solo undo chain stays for solo.
- **Edition:** self-hosted only, behind the game-account guard; no Firebase impact (ADR-0004). New ADR: **0010 multiplayer
  architecture** (M0).
- **Finish:** the table result is archived; each player can file their final books as a normal saved game (existing
  snapshot format, read-only history) — their real account books are never written during play.

## 3. Game design for the table

### 3.1 Lifecycle

`lobby` → `picking` (professions) → `playing` → `finished` (also `abandoned` on TTL).

- **Lobby:** host creates a table with settings (§3.2); others join from the list/code; ready checks; host may kick,
  change seats, start. Late join after start: off by default (Q-minor), spectate instead.
- **Picking:** each player picks a profession (rules per Q4). Starter kit → their books via the existing start function
  (`startGame` equivalents), with **their** starting cash.
- **Playing:** a **turn** = `roll → (auto: paydays, baby, charity, downsized) → decide card (active player) → end`. Turn order is
  fixed at start (random or host-set). Players who are **sitting out** (Downsized), **bankrupt** (eliminated, spectate) or
  **away** are skipped / auto-played.
- **Out-of-turn actions** (any player, any time the legal-action set allows): sell into an open Market offer, inspect, chat.
  The server serializes them; they never advance the turn.
- **Finished:** per end condition (Q3), with a results screen and per-player summary (the existing `summarizeGameFinances`).

### 3.2 Table settings (chosen at creation, frozen at start — like `GameRules`)

| Setting          | Options                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name, visibility | public (listed) / private (code / invite only)                                                                                                                   |
| Seats            | min 2, max N (host-set, server ceiling, Q2); optional spectators                                                                                                 |
| Game set         | existing sets that ship board + decks (Classic)                                                                                                                  |
| Rules            | `guided` or `strict` base **plus** the multiplayer-forced settings (no claimed rolls, no manual transactions); host may tune loan cap, doodad passing, sell rule |
| Professions      | unique per player / duplicates allowed / random assignment                                                                                                       |
| Turn order       | random / host-set                                                                                                                                                |
| **Clock**        | `none` · `per-move` (X s each) · `bank` (Y min per player, + optional increment Z s/move — a chess clock) · `daily` (hours per move, Q6)                         |
| On timeout       | passive auto-move (always); after K consecutive timeouts → player marked **away** (instant auto-play, rejoinable) or removed                                     |
| End condition    | first player to escape · everyone finishes (escaped/bankrupt) · fixed number of rounds / wall-clock limit, ranked by passive income (Q3)                         |
| Seed             | server-side random; stored so the game can be replayed after it ends                                                                                             |

### 3.3 What is shared and what is personal

| Thing                                                                                                | Scope                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Deal Small/Big, Market, Doodad piles + discard                                                       | **Table** (one set; reshuffle when exhausted)                                                                |
| The card currently on the table                                                                      | **Visible to all**; **actionable** by the active player (Deal/Doodad), by **everyone** (Market offers/sells) |
| Market card effects: buyer offers, price moves, splits (one table-wide roll), boosts, property costs | Applied to **every** player's books that qualify; each player acts on their own offers                       |
| Books, history, positions, calendar (Payday month)                                                   | **Personal**, **readable by all** (inspector)                                                                |
| Clock bank                                                                                           | **Personal**                                                                                                 |
| Deck order, RNG seed                                                                                 | **Server only**                                                                                              |

### 3.4 The passive auto-move (`passiveMoves`, pure, in the domain)

Defined as "the least consequential **legal** sequence that lets the table move on":

1. Must **roll** (1 die, even under Charity) — rolling is the only way to advance; Payday/Baby/Charity/Downsized resolve automatically as for anyone.
2. Card space → **pass** the card (no buy, no draw-extra, no sell). Deal: pass; Market: no action; open dice decisions: roll them (the server rolls).
3. Doodad → **pay** only if the rule forbids passing (`passDoodads: forbidden`) — via the engine's existing auto-bank-loan if cash is short; otherwise pass.
4. Never take a voluntary loan, never sell, never buy.
5. Out-of-turn windows (a Market offer) simply expire unanswered for an absent player.

### 3.5 Visibility and the wheel

- **Board:** one token per player — colour **and** shape/initial (accessibility), offset ring when several share a cell,
  active player highlighted, sit-out/bankrupt shown. Animation per move, skippable, tokens of other players animate too.
- **Table view:** current card in the centre, whose turn + clock, last roll(s), a live event feed ("Anna rolled 5, passed
  Payday, bought SYM-12 × 10").
- **Player inspector:** click a token or a seat → that player's profession card, income statement, balance sheet, positions,
  asset deals, history log, and what they can currently sell into. Read-only. Compare view: everyone's cashflow / passive income / expenses.

## 4.0 Decisions (JFK, 2026-10-14)

| #     | Decision                                                                                                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Room owns all game state, separate from personal accounts.                                                                                                                                                                                                                                                                                                     |
| 2     | Host-set seats, default 6, UI up to 12, hard server ceiling 24 (config); duplicate professions above the unique pool.                                                                                                                                                                                                                                          |
| 3     | Default end: first to escape wins; options play-on-until-all-done and round/time limit ranked by passive income.                                                                                                                                                                                                                                               |
| 4     | Simultaneous profession pick, duplicates allowed (host can force unique), random button.                                                                                                                                                                                                                                                                       |
| 5a    | **Shares and selling:** no share trading between players; only the player who drew a card can buy it. Selling happens only through a picked card: a Market card that anyone draws makes its offer to every player, and everybody who owns what it buys can sell into it ("everybody can sell IF he can"), on or off their own turn. No selling without a card. |
| 5     | **Peer trades instead of "passed Deals":** the existing "sell to a friend" button becomes an **offer**; another player can buy it **only if both agree on a price** (seller names a price, buyer accepts or counters; nothing moves until both sides accept). See T7. The passed-Deal buy window is dropped.                                                   |
| 6     | Daily/correspondence clock mode is wanted but **later** (model keeps it as a long per-move clock; web push in Phase X).                                                                                                                                                                                                                                        |
| 7     | Multiplayer stays behind the game-account gate.                                                                                                                                                                                                                                                                                                                |
| S1/S2 | `gamerooms` storage schema and the nginx streaming `location` are approved.                                                                                                                                                                                                                                                                                    |
| 8-15  | Not yet answered - recommendations in §4 stand (no undo + host rewind, away after 2 timeouts, nicknames + recent players, no matchmaking queue, emotes + simple chat, <=20 tables, bot harness).                                                                                                                                                               |

## 4.1 Isolation and MCP (JFK, 2026-10-14 - hard requirements)

**Nothing here may touch the normal app or a normal (non-game) account.** Multiplayer is a game-account feature, and MCP support is part of the scope, not a later extra.

Isolation guarantees (each is a test or a review check, not an intention):

1. **Server gate:** every multiplayer endpoint (REST, SSE, MCP tools) sits behind the existing game-account guard (`NOT_A_GAME_ACCOUNT` 403 for any other account, whatever its scopes) and new scopes `game:r`/`game:w` (ADR-0006 addendum). Integration test: a normal account gets 403 on every new route, including the event stream.
2. **Data:** all state lives in the new `gamerooms` database. No change to the user document, `gamesaves`, any existing path or schema, and no migration of existing data. Filing a finished game as a saved game happens only for game accounts and only through the existing saved-games path.
3. **Code:** domain code is **additive** (`cashflow-game/table/`); existing solo functions are not modified for multiplayer - if one must change, it is a separate refactor commit with its characterization tests green first, never bundled. Existing routes, middleware, rate limiters and nginx locations are unchanged apart from the one new streaming location (S2).
4. **Frontend:** routes, components and services are game-only (self-hosted route array, ADR-0004). U0's extraction of presentational pieces must leave the solo game and every normal screen unchanged (tests green, no behaviour change). The normal app's bundle/startup path does not load multiplayer code (lazy route), and the Firebase build contains none of it (`edition-guard`).
5. **Runtime:** the SSE channel and clock timers only exist for open rooms; with no room open nothing runs. Per-account and global limits protect the normal API from game load (own rate-limit bucket, connection cap, room cap).
6. **CI proof:** a "normal account unaffected" test in S6 (a regular account's API behaves identically while a table is running) and `edition-guard` on the Firebase build in every frontend slice.

MCP (the existing game tools `get_cashflow_game` / `play_cashflow_game` stay as they are; multiplayer extends the same pair so an agent can sit at a table):

- **Read** (`get_cashflow_game`): list open tables, a table's state as the viewer sees it (all players' books, current card, clock, legal actions), events since a version, results.
- **Play** (`play_cashflow_game`): create/join/leave/ready/start, pick profession, roll, deal/doodad/market actions, sell into an offer, offer/accept/counter a trade, rewind (host). Destructive or irreversible actions (leave a running game, kick) need `confirm: true`. Responses always return the new `legalActions`, like solo.
- Same server-side authorization and passive-move rules as a human seat: an agent is just another seat (the timeout auto-move applies to it too). Tools are generated from `openapi.yaml`, game-account gated, docs in `docs/api/AGENTS.md` / `MCP.md`, plus an `explain_concept` topic for table play. This promotes "agent seats" from Phase X to a committed slice (S7); a **bot-client harness** (S6) and the MCP stdio test both drive the same API.

## 4. Questions (decisions needed — recommendation first)

_Q1–Q7 are answered in §4.0; the text below is kept for the reasoning._

**Architecture (blocking for slice M0/T1):**

1. **Where does a multiplayer player's money live?** _Recommended:_ in the **room** (plain, server-side, separate from
   everyone's personal account); a finished game can be filed into each player's saved games. The alternative — playing
   inside each own account — is rejected in §2.2(1). _Confirm?_
2. **Player cap.** You see no limit. The engine has none, but there are ~16 professions, 24 spaces, and turn latency grows
   linearly. _Recommended:_ host-set seats, **default 6**, selectable up to **12** in the UI, **hard server ceiling 24**
   (a config value, raised later if friends actually want 20). Duplicates of a profession allowed above the unique pool.
3. **When does it end?** _Recommended:_ default **first to escape wins** (matches the board game); host option "play on until
   everyone is escaped/bankrupt", and a round/time limit ranked by passive income for long groups. Bankrupt = eliminated (spectates).
4. **Profession pick:** simultaneous secret pick + reveal (fast), in turn order (draft), or random? Unique or duplicates?
   _Recommended:_ simultaneous pick, duplicates allowed (host can force unique), "random" button for speed.

**Rules at the table:**

5. **Peer trades (answered):** see §4.0 and T7. The passed-Deal window is dropped.
6. **Clock modes:** `none` / `per-move` / `bank + increment` are in. Do you also want **daily/correspondence** games (hours per
   move, with push notifications so a game lasts days)? _Recommended:_ include the mode in the model from T5 (it is just a long
   per-move clock), but ship **web push only in Phase 4** — with it off, daily games need the tab open.
7. **Market card out-of-turn selling:** _Recommended:_ offers stay open per player for the existing `sellOfferRolls` /
   until-Payday window, and any player may sell **any time while the offer is open**, including during others' turns — no
   stop-the-world "response window", turns are never blocked waiting for others. Stock splits roll once for the table.
8. **Undo:** none by default (table game). _Recommended:_ a **host "rewind last turn"** to fix mishaps (disconnect mid-card),
   logged visibly to everyone, off in ranked-style tables.
9. **Away policy:** after K timeouts in a row (default 2) the player is marked away and auto-played instantly so the table
   isn't stalled; they can click "I'm back". Host can also **kick** and a majority can **vote-skip**. _OK?_

**Community and product:**

10. **Identity:** accounts are emails; the lobby must show a **display name + colour** (never the email). _Recommended:_ a
    per-account table nickname chosen on first join, unique within a table. Friends list in v1 or "recent players" only?
    _Recommended:_ **recent players + invite link/code in v1, real friend requests later.**
11. **Matchmaking:** with a closed friend group, public list + invite codes is enough. _Recommended:_ **no auto-matchmaking
    queue**; a "looking for players" table list with filters (seats open, rules, clock).
12. **Chat, spectators, agents:** _Recommended:_ v1 = preset emotes + a simple text chat limited to table members, spectators
    read-only; **agent seats (an MCP/API client holding a seat — the engine's `legalActions` already supports it)** as a
    Phase 4 differentiator, **bots** = the passive policy as a "fill-in bot".
13. **Who can play?** Today: only game accounts (email with `cashflow` + game password) = you and friends. Does multiplayer
    stay behind that gate (small, trusted, little moderation) or open wider later? _Recommended:_ **stay gated for v1**;
    that removes most abuse/moderation scope.
14. **Capacity expectation:** how many tables/players at once on your server (one backend pod today)? _Recommended:_ plan for
    **≤ 20 concurrent tables / ≤ 100 SSE connections**; the design (CouchDB events + `_changes`) leaves room to scale out.

**Process:**

15. **Playtest path:** multiplayer can't be playtested alone. _Recommended:_ the `mm-local-selfhosted` stack + a scripted
    **bot-client harness** (N scripted API clients, no Playwright, per the dev-cycle rule) for CI; real friend playtests need a
    deploy, which stays your call.

## 5. Slice plan

Sizes as in the solo plan: **S** a few commits, **M** a session, **L** several, **XL** the bulk of a phase. Working rules
(§7) are the same as the solo project's: one concern per commit, tests first for extractions, no behaviour change bundled with
a refactor, `npm run verify` before landing, nothing deployed/pushed without being asked.

### 5.0 M0 results (spikes run 2026-10-14, all throwaway, nothing left in the repo)

**(a) Four players through the engine** (4 `SimGame`s, different professions/policies, round-robin turns, shared nothing):

- The engine plays N players side by side without changes: 4 complete games (186 table rounds) ran in ~0.8 s, outcomes 2 escaped / 2 bankrupt, tokens on different cells. **T-phase risk is lower than feared: `playTurn`, deals, payday, game-end reuse as-is per player.**
- **Shared-deck gap confirmed:** each player's `drawnCardIds` is private, so players draw the same cards: 22 of 34 distinct Small Deals, 10 of 29 Market cards and 7 of 27 Doodads drawn in the game were held by more than one player. T2 (table-level piles) is required, not optional; a table-level draw must replace `drawRandomCard(deck, state.drawnCardIds)` for the active player.
- **Market gap confirmed:** `playMarketAction(books, ...)` takes and returns one `GameBooks`; nothing reaches other players. T4 wraps it: for each qualifying player run the per-player effect on that player's books, with one table roll for splits.
- Also noticed: dice come from one injected `Rng` per game; at a table there must be **one** server RNG stream (per-room secret seed) in command order, so a replay reproduces the game.

**(b) How tangled the solo UI is** (`cashflow-game.component.ts` 2,829 lines + 2,107-line template, `cashflow-game.service.ts` 2,736 lines):

- The component talks to the game through **one service** (`CashflowGameService`, 44 distinct methods, 54 call sites) and reads `appState.cashflowGame` (29x) plus a few lists straight from the global `AppStateService.instance`. It has no `@Input`/`@Output`: it is one big smart component.
- The real coupling is in the **service**: `gameBooks()` assembles `GameBooks` from the singleton (`AppStateService.instance`, 79 reads) and writes go through `PersistenceService.writeAndSync` into the user's account, localStorage and undo chain. Making that service room-aware would touch 79 reads and every write path - **rejected**.
- **Decision for U0:** do **not** abstract the service. The table client never runs the rules (the server does), so it needs no `CashflowGameService`. Instead: (1) extract **presentational, input-only components** from the solo template (card tile/plan view, deal/doodad/market cards, books/finance summary, history list, the existing board) with the solo component consuming them unchanged; (2) build a new `table` component + `TableSessionService` (SSE + commands + signal store) that feeds the same presentational components with server-projected state; (3) previews like "what does buying this do" use the domain's pure `planDeal` on the projected books in the browser (no server round-trip, no service). The solo component and every normal screen stay as they are. The extraction follows the same characterization-tests-first rule; if a piece resists extraction it is duplicated, not entangled.

**(c) 50 live streams** (Node SSE server in a pod behind nginx:alpine, 50 clients, 12 s, one forced reconnect with `Last-Event-ID`):

- Direct and through nginx: p50 delivery 2-3 ms, every client received every event, **reconnect replay was gapless** (0 gaps). SSE with `Last-Event-ID` works as designed.
- Through nginx both the existing `/api` block and a dedicated streaming location delivered promptly in this test (also with the backend not sending `X-Accel-Buffering: no`, so I could not show that buffering bites here). The dedicated location is still **required** for its `proxy_read_timeout 3600s` (the default 60 s would cut idle streams; untested here, known nginx behaviour) and so correctness does not depend on a response header. The backend will also send a heartbeat comment every ~25 s.
- **New finding - rate limits:** `backend/server.js` limits `/api/` to 10,000 requests / 15 min per IP and `apiLimiter` to 1,000 / 15 min per token. A table of friends behind one IP, each sending commands and reconnecting, shares that IP bucket with the normal app. Game routes get **their own limiter/bucket** (S1/S3), keyed per account, so a table can neither exhaust nor be exhausted by normal traffic (isolation requirement §4.1.5).
- Podman note: a host process is not reachable from a container on this Windows machine (firewall); the spike used a pod with both containers. The bot-client harness (S6) should do the same via `docker-compose.test.yml`.

**Consequences for the slices:** T2 and T4 stay as planned (now confirmed gaps, not guesses); U0 is re-scoped from "session port" to "extract presentational components + new table component"; S2 gets heartbeat + the dedicated nginx location; S1/S3 get a dedicated rate-limit bucket.

### Phase M — Decisions & spikes (no product code) — done

| Slice  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Size | Needs |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| **M0** | **ADR-0010** (multiplayer architecture: room-owned state, server-authoritative reducer, SSE+REST, clock) after your answers to §4. **Spikes (throwaway, in the scratchpad):** (a) run 4 players' `GameBooks` through `playTurn` with shared piles in one test, to see what breaks; (b) measure how much of `cashflow-game.component.ts` is separable from account-bound services (decides U0's shape); (c) SSE through nginx + dev server with 50 clients. | M    | §4    |

### Phase T — Table engine (domain package only, fully testable, no I/O)

| Slice           | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Size | Needs  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| **T1** ✅ built | **Table model + lifecycle reducer**: `Table` (settings, seats, order, phase, active player, table round, per-player `GameBooks`, shared decks, clock state, version), commands `join/leave/ready/start/pick_profession`, events, `applyCommand(table, playerId, cmd, rng, now)`. Settings validated and frozen at start; multiplayer-forced rules enforced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | L    | M0     |
| **T2** ✅ built | **Shared decks**: one set of piles + discard + reshuffle at table level (replaces per-player `drawnCardIds` inside the table only; solo untouched); `offered-once` per active player; hidden order/seed; `projectFor(viewer)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | M    | T1     |
| **T3** ✅ built | **Turn rotation**: roll → resolve → decide → end through the existing `playTurn`/`settleDecision` on the active player's books; real Downsized skip, Charity dice counters, bankrupt elimination, escape handling per the end condition; table round counter; out-of-turn command gating by `legalActions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | L    | T1, T2 |
| **T4** ✅ built | **Table-wide cards**: a Market card played by one player produces effects for **all** qualifying players (offers with per-player windows, one table split roll, boosts, property costs); out-of-turn `sell` commands;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | L    | T3     |
| **T7** ✅ built | **Peer trades**: typed commands `offer_trade` (seller, position/asset, price, to one player or the whole table), `counter`, `accept`, `withdraw`, `reject`; the price must be agreed by both sides before anything moves; on accept both players' books change atomically (seller: sale proceeds, liability/mortgage handling as in the existing sell-to-a-friend rules; buyer: the position through the existing typed Grow actions at the agreed price, cash check + the usual auto-loan refusal). Offers expire after N turns / when the asset changes / the seller goes bankrupt; passive auto-move never accepts or offers. **Shares are never traded between players** (JFK, 2026-10-14): a Deal card can only be bought by the player who drew it, and a share card stays with its drawer (the existing rule at `deals.ts:769` stands). Peer trades cover property/asset positions only. **Selling exists only through a picked card:** a Market card drawn by anyone makes its offer to every player, and each player who owns what it buys may sell into it, on or off their own turn; there is no selling without a card. |      | L      | T3  |
| **T5** ✅ built | **Clock + passive policy** (pure): `clockAfter`, `deadlineFor`, per-move/bank/increment/daily; `passiveMoves(table, playerId)` as §3.4; away marking after K timeouts; pause/resume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | M    | T3     |
| **T6** ✅ built | **Table simulation tests**: seeded full games for N = 2, 4, 8, 12; invariants (cash/entity, turn order, no player acts out of turn, deck conservation); determinism and **replay-equals-original**; an all-passive table terminates; golden fixture reused by the server and bot harness.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | M    | T4, T5 |

**Exit:** a seeded 8-player game with timeouts, market sells and a peer trade runs to its end condition in a unit test, reproducibly.

**T1 as built (2026-10-14)** - `packages/domain/src/cashflow-game/table/` (`types.ts`, `settings.ts`, `table-rng.ts`, `reducer.ts`, 37 tests in `table.spec.ts`; additive, nothing existing changed except one export line in `src/index.ts`):

- `createTable(input, ctx)` and `applyCommand(table, playerId, command, ctx)` -> `{ table, events }`, or a `TableCommandError` with a code (`NOT_HOST`, `WRONG_PHASE`, `TABLE_FULL`, ...) and nothing changed. `ctx` = clock + game text (+ optional game sets); **chance is not a parameter**: the table carries its own stream position (`rngState`, mulberry32 whose whole state is one number), so replays and restarts continue exactly. (Changed from the ADR's `applyCommand(table, playerId, command, rng, now)`.)
- Commands: `join`, `leave`, `set_ready`, `kick`, `update_settings` (lobby only, resets everyone else's ready), `start`, `pick_profession`, `close`. Lifecycle `lobby -> picking -> playing` (+ `abandoned`; `finished` comes with T3). Leaving mid-game keeps the seat and books (`status: 'left'`, T3 skips it); host hand-over; picking falls back to the lobby below 2 players or reveals when the last non-picker leaves.
- Settings validated and frozen: seats 2-24 (default 6), unique professions capped at the game set's size (**Classic has 12 professions, +3 in custom-jfk**, not ~16), clock modes validated (T5 gives them meaning), end condition, turn order `random | seat` (host-set reordering dropped for now). **Forced rules** (refused, not silently changed, if the host asks otherwise): offered-once cards, buy with-card, no claimed rolls, no manual transactions, no free amounts, and `sell: 'always'` is **refused** (a seller naming their own price would create money; tables use `with-offer` or `never`).
- Profession picking: simultaneous and secret on a `duplicates` table (the event log carries no profession until `professions_revealed`), visible first-come-first-served on a `unique` one; `random` picks and `random` tables resolve from the table's stream in seat order; at the reveal every player gets **their own** starting books through the existing `startGameAction` (mode `solo`, the table's rules), so `playTurn` runs on them unchanged (checked: `whyCannotRoll` is null for every player).
- Verified: 37 new tests, full domain suite 997 passed, `tsc` build, eslint clean on the new folder. `npm run format` in `packages/domain` already fails on 14 older files (not touched).
- Not yet in T1 (by design): shared decks and `projectFor` (T2), turns (T3), clock (T5).

**T2 as built (2026-10-14)** - `table/deck.ts`, `table/view.ts` (+ `deck.spec.ts`, `view.spec.ts`; 19 new tests, 56 in the folder):

- **One discard pile per deck for the whole table** (`Table.drawnCardIds`). `drawTableCard(table, playerId, { deck }, deps)` does not reimplement drawing: it lends the player's books the table's pile and the table's dice stream, runs the **unchanged solo `drawCardAction`** (right pile for the space, offered-once, dice-first, cost-card payment), applies its effects to that player's books and takes the pile back. Verified by test and by a mutation check (sharing switched off -> the three sharing tests fail): a whole deck is dealt out across 3 players with no card twice, the next draw reshuffles for everyone, decks stay independent, the card lands in the drawer's hand only, a refused draw changes nothing. The version bump is the calling command's job (T3).
- **`projectFor(table, viewerId)`** - the one place that decides visibility. Open information: every player's profession, books and cards. Hidden: the dice stream (`rngState`), pile order (only the discard pile and cards left are shown), other players' secret picks on a duplicates table, and **account ids** (players are seats + name + colour). Books are shown without the static game set and the private pile copy. Spectators (`youSeat: null`) see the same public table. `projectEvents`/`projectEvent` map events to seats; tests assert that no account id, no dice-stream value and no secret pick appear anywhere in a serialized view or event log.

**T3 as built (2026-10-14)** - `table/play.ts`, `table/turns.ts`, the play commands in `reducer.ts` (+ `play.spec.ts`, `testing.ts`; 76 tests in the folder):

- **Moves are the solo game's own, over the player's own books.** New commands: `roll`, `draw_card`, `buy_deal`, `pay_doodad`, `roll_decision`, `pass_card`, `bank_loan`, `sell_position`. `runPlan` lends the player's books the table's pile and dice stream, runs the unchanged solo action (`playTurn`, `drawCardAction`, `buyDealAction`, ...), applies the effects (settling a decided card, `endIfOver`), and hands the pile and stream back; a refused move throws `ILLEGAL_MOVE` carrying the solo rule's own words and changes nothing. `TableContext` now carries the full play deps (clock, text, money, card texts); `testing.ts` has the shared test context.
- **Turns** (`settleTable`, run after every command): notes who escaped/went bankrupt (`Table.finishers`, in order), checks the end condition, and passes the turn on when the active player rolled and their space is settled, or is out. Passing skips players who left or are out, and **for real now, players sitting out Downsized lose one of their `unemployedRoundsLeft` per skipped turn** (`turn_skipped`). Wrapping the order starts a new `tableRound` (`round_started`). Charity's 1-or-2 dice counter is the solo rule, per player.
- **Only the active player moves. Selling exists only through a card:** nobody can sell on their own initiative (a table never allows `sell: 'always'`); a sale is possible only while a Market card that someone picked has made an offer, and then every player who owns what the card buys may sell into it, on or off their own turn (decision 5a). `sell_position` is therefore not gated by whose turn it is, but the solo `with-offer` rule refuses it without an open offer (`ILLEGAL_MOVE`, never `NOT_YOUR_TURN`). T4 (below) makes every Market card, whoever picked it, make offers to all players.
- **End conditions:** `first-escape` (first escape wins at once), `all-done` (escapees are done, play on until nobody is left in the rat race), `round-limit` (ends when the order wraps past the limit), plus `last-standing` (everyone else bankrupt/left, nobody escaped) and `everyone-out`. `Table.result` holds the reason, the winner and a ranking: escapees first (earliest wins), then players still in by passive income / monthly cashflow, then the bankrupt (whoever lasted longest ranks higher), then those who left. A player leaving mid-game keeps their books, and if it was their turn the turn moves on. `projectFor` shows the result by seat.
- **Not in T3 (as planned):** the chess clock and the passive auto-move are T5; the backend's own `playAction` switch (backend/repositories/game-play.js) is untouched, so the move dispatch exists twice (domain `planMove` for tables, the JS switch for the solo API) - to be unified in a later refactor, per the duplicated-logic note in CLAUDE.md.

**T4 as built (2026-10-14)** - `table/market.ts`, one behaviour-preserving extraction in `actions.ts`, the draw hook in `reducer.ts` (+ `market.spec.ts`, 15 tests; 91 in the folder, 1051 in the domain package):

- **A Market card takes effect for everyone the moment it is drawn.** `play_market` is no longer a table command: `draw_card` from the Market pile runs the card over **every player still in the game** (seat order), whoever drew it, and the drawer's space is settled by the card - a player cannot pass on a card that hurts them. Each player's effect is the unchanged solo card rule over their own books (`marketCardPlan`, extracted from `playMarketAction` without changing it; the solo tests, the simulation and the API are untouched and green):
  - **buyer / gold:** an offer for every property (or the gold) _that player_ owns, written to their own `marketOffers` (+ the Grow note);
  - **boost:** every qualifying investment of every player;
  - **cost:** every player owning a property pays through the usual forced-payment path (a short purse takes the Bank loan first);
  - **stock split:** **one** roll of the table's die (1-3 doubles, 4-6 halves) for all holders - the server rolls, nobody reports a roll, no decision is left open;
  - plain text cards do nothing but end the drawer's turn.
- **A stock card (Deal pile) moves the price for every other holder** (`movePriceForHolders`): their Grow project and balance sheet take the new price and they get an offer to sell at it; only the drawer can buy. The drawer's own price update stays part of their `buy_deal`, as in solo play.
- **Selling into an offer is each owner's own `sell_position`, any time the offer is open, on or off their turn** - and never without an offer. **Offer window at a table:** the solo rule closes a one-roll offer (`strict`) the moment the player's own space is settled, which would make it vanish at once for everyone who is waiting for their turn. At a table the offer therefore lasts, per player, until **that player's own next roll** (`strict`), for their next 3 rolls (`guided`), or until their next Payday (0) - `runPlan` shows the solo rule the player as "still deciding" for the duration of a sale and puts their turn state back after (tested: a strict offer is takeable off-turn and gone after the player's own roll).
- **Events:** `card_drawn`, then `market_card_played` (drawer, card id, kind) and one `market_effect` per player the card did something to (kind-specific detail: matched properties, the split roll, boosted investments, cost paid, moved price). Left or out players are skipped. Verified by mutation (offers only for the drawer -> 9 tests fail; offer window not lent -> the strict test fails).
- **Not in T4:** peer trades (T7), the clock (T5). Open item for the UI later: a `legalActions`-style "what can I sell now" list for a viewer (their open offers) - the data is in each player's `marketOffers`.

**T5 as built (2026-10-14)** - `table/clock.ts`, `table/passive.ts`, the clock/timeout/away code in `reducer.ts`, `Table.clock` + `TablePlayer.away` (+ `clock.spec.ts`, 18 tests; 109 in the folder, 1069 in the domain package):

- **Clock modes** (pure, server time in epoch ms; nothing sets a timer): `per-move` (same time each turn), `bank` (a bank that runs down only on your own turn; finishing a turn adds the increment back - a Fischer clock; an empty bank means your turn is due at once), `daily` (hours), `none`. `nextDeadline(table)` is what the server schedules; `applyTimeout(table, ctx)` is what it calls when that passes (`NOT_DUE` otherwise). The clock is part of `projectFor` (`ClockView`: deadline, pause, banks and timeouts by seat; `away` per player).
- **The passive turn** (`nextPassiveCommand`, one command at a time): roll with one die; pass a Deal/Doodad space - unless the rules forbid passing a payment, then draw the Doodad and pay it (the Bank loan covers a short purse). It never buys, sells, borrows, or answers anything. Market spaces need no choice: **a roll that lands on a Market space draws the card at once, for the whole table** (so nobody can dodge a card by passing the space).
- **Fairness:** a move that reaches the server up to 2 s after the deadline still counts (latency); later ones get `TIME_UP` and the server's timeout plays the turn. While the host has the game **paused** every move gets `PAUSED`, there is no deadline, and `resume` gives the active player back the time that went by.
- **Away:** after `awayAfterTimeouts` timeouts in a row (any move of your own resets the count) a player is marked away; when the turn passes to an away player their turn is played **at once, inside the same command** so nobody waits for them; the `back` command (or any move of theirs) brings them back. If everyone left in the game is away the table is closed (`everyone_away`) instead of playing itself out.
- **Not decided / for later:** vote-skip and kick-during-play, "all players agree" pause (today host-only), a pause limit. T7 trade offers will need their own expiry and must be ignored by the passive turn (nothing in T5 touches trades).

**T6 as built (2026-10-15)** - `table/simulate.ts`, `simulate.spec.ts`, `fixtures/golden-4p.json` (25 tests; 134 in the folder, 1094 in the domain package; backend unit tests 855 green against the rebuilt package):

- **`simulateTable(config)`** plays a whole table in memory with the real table rules, driven by the **strategy lab's own policies** (`PRESET_POLICIES`, one per seat in turn): the clock jumps instead of waiting, a **slow seat** never answers so the server's timeout plays its turn, and everyone sells into a Market card's offers the moment it is read out. A run returns the final table, every event, a **script** (the creation input plus every command or timeout with its time) and a list of broken invariants.
- **Invariants checked after every command** (`tableInvariantProblems`, with negative tests proving they bite): one version per accepted command; the table round never goes backwards; a running game always has a living player on the move; a finished game has a result and a 1..N ranking and nobody on the move; every player who is out is recorded as a finisher once; no card twice in a pile and every pile card is in its deck; money is whole minor units; roll counts only go up; at most 3 children. **`leakProblems`** checks, every 40 commands and at the end, that no viewer's `projectFor` contains any account id or the dice stream.
- **Covered:** 2, 4, 8 and 12 players x 3 seeds all finish with no problems (12 players take ~1.5 s); the same config plays the same game and another seed another; a script **replays to the identical table and events**, timeouts included; the strict preset; bank clock with increment; **every one of the nine lab policies** at a table; a table of only passive turns ends under a round limit (and shows no purchase, sale or loan); a table where everyone is away closes. Across the seeds the games between them contained Market cards, off-turn sales, purchases, bankruptcies and dice decisions.
- **The golden game** (4 players, a slow seat, seed 20261015, 805 steps, digest `d807e938`): `golden-4p.json` is the script plus the digest the server's and the bot harness's tests will replay. The test fails if the rules change the game or the file is stale; regenerate on purpose with `UPDATE_GOLDEN=1 npx jest simulate` and update the pinned digest in the spec. The folder is in `.prettierignore` (generated).
- **Two real bugs found by the simulation and fixed in the same slice:** (1) a roll that lands on a Market space while the player has an open dice decision (a kept card's Payday roll) was refused for good, because the new automatic Market draw is blocked by the dice-first rule - the roll now rolls the open dice decisions first (server dice), then draws; (2) the passive turn could not pay a forced Doodad while a dice decision was open - it now rolls the decision first. Both games that exposed it (8 players seed 1, 12 players seed 2) are in the regression set.

**T7 as built (2026-10-15)** - `table/trade.ts`, `Table.trade`, five commands, expiry in `turns.ts` (+ `trade.spec.ts`, 18 tests, and a trading mode in the table simulation; 153 in the folder, 1113 in the domain package):

- **What is traded is the Deal card in the seller's hand** - the solo game's existing "sell to a friend" (`sellCardToFriend`), not a position already owned. Reading the earlier plan text ("position/asset") against that rule: a property or special-asset card (gold, a dice card) can be offered, **a share card never** (it belongs to whoever drew it). If JFK meant trading positions that are already owned, that is a different feature (a Grow sale between players) - not built.
- **Commands:** `offer_trade {priceMinor, to?}` (the player on the move, to one player or the whole table), `counter_trade {priceMinor}` (a buyer proposes another price; one per buyer), `decline_trade`, `withdraw_trade`, `accept_trade` (a buyer takes the asking price; the seller takes a buyer's counter with `{ from }`). Nothing moves until the price is agreed.
- **On agreement everything moves at once, or nothing does:** the seller is paid as a card sale (income `@<card> card sale`) and their space is settled, so their turn moves on; the buyer pays the price (Bank loan first if short) as `@<card> card purchase` from Fire and then **buys the card on its normal terms** as if it were in their hand (deposit, mortgage, Grow project; the Bank loan covers a short purse) - their own turn state is put back afterwards. Any refusal on either side (for example the buyer owes a dice roll first) refuses the whole trade and changes nothing.
- **An offer lives exactly as long as the card is in the seller's hand:** buying it themselves, passing it, a timeout (the passive turn passes the card and never offers or answers), leaving, or the game ending all drop it (`trade_expired`). One offer at a time. Paused games refuse trade commands. Everything about an offer is open to the table (`TableView.trade`, by seat, counters included); events use names, never account ids.
- **Verified** by mutation (no expiry -> 4 tests fail; any buyer for a targeted offer; a declined buyer may still buy; seller paid the wrong amount -> tests fail) and in whole simulated games with `trading: true` (3 to 8 players, all invariants, replay-equal, at least one trade made).
- **Left for the UI phase:** the i18n text for the buyer's transaction comment (`CashflowGame.cardPurchaseComment`, English fallback until then); letting a buyer who owes a dice roll roll it off-turn (today they must wait for their turn).

**Phase T is complete.** The table engine runs a whole multi-player game in memory, deterministically and replayably, under the real rules.

### Phase S — Server

Follows `.claude/skills/mm-add-api-endpoint` for every endpoint (OpenAPI first, domain, repository, route, unit + live-CouchDB
integration tests via podman, docs). Game-account guard on all of it.

| Slice           | What                                                                                                                                                                                                                                                                                                       | Size | Needs      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------- |
| **S1** ✅ built | **Rooms store + lobby API**: `gamerooms` database (**schema = new storage path: ask JFK before this lands**), create/list/get/join/leave/kick/start, invite codes, nicknames + colours, per-account limits (rooms, open tables), TTL cleanup of abandoned rooms, OpenAPI + `DATABASE_STRUCTURE.md`.        | L    | T1         |
| **S2** ✅ built | **Realtime channel**: `GET …/events` (SSE, per-viewer projection, `Last-Event-ID` replay from the event docs, heartbeat), presence, connection limits, nginx `location` (buffering off, long timeout), reconnect semantics documented.                                                                     | L    | S1, T2     |
| **S3** ✅ built | **Command endpoint + executor**: `POST …/commands` with `clientCommandId` idempotency and `expectedVersion` optimistic concurrency, authorization (membership, turn ownership, out-of-turn allow-list), persistence + broadcast; rate limiting.                                                            | L    | S2, T3, T4 |
| **S4** ✅ built | **Clock service**: server timers per room, re-armed from the DB on boot, the passive auto-move executor, away policy, pause/resume, host rewind (Q8) from a per-turn snapshot; clock fairness (stops at receipt + grace).                                                                                  | L    | S3, T5     |
| **S5** ✅ built | **Finish & archive**: results/ranking, each player may file their final books as a saved game (existing snapshot format), room archive/TTL, replay export from seed + commands.                                                                                                                            | M    | S3         |
| **S7**          | **MCP**: extend `get_cashflow_game` / `play_cashflow_game` (and the OpenAPI they are generated from) with table read + play actions, `explain_concept` topic, `docs/api/AGENTS.md` + `MCP.md`, MCP stdio test where an agent plays a seat against scripted clients. Game-account gated, `game:r`/`game:w`. | M    | S3, S4     |
| **S6**          | **Bot-client harness + integration**: scripted N-client games over real HTTP/SSE against CouchDB (the CI proof of the exit criterion minus the browser), disconnect/reconnect, timeout, restart-mid-game.                                                                                                  | M    | S4         |

**Exit:** a scripted 6-client game finishes through the real API, including a server restart mid-game; an agent plays a seat through MCP; a normal account is provably unaffected.

**S1 as built (2026-10-15)** - `backend/repositories/game-room-store.js`, `services/game-rooms.js`, `routes/game-rooms.js`, `middleware/game-account-guard.js`, the `gamerooms` database in `config/db.js` (+ 9 unit tests, 11 + 1 integration tests against a real CouchDB; backend unit 864 and integration 491 green; MCP 104 green):

- **Storage** (`backend/DATABASE_STRUCTURE.md`): a `gamerooms` database, admin-only like `gamesaves`, with three kinds of document - `room:<id>` (the whole table + the fields the lobby list reads + invite code + `eventSeq`), `event:<id>:<seq>` (append-only table events, written after the room is saved) and `seat:<user>:<room>` (one marker per seat at an open table: the per-account limits and "my tables" are a range read, no index). Rooms are saved against their `_rev`; a concurrent change is **retried on the newer table** (commands are pure), so two players pressing at once both land - tested with two simultaneous joins. A room above 6 MiB is refused. No change to any existing database, path or document.
- **API** (11 operations, `docs/api/openapi.yaml`, mounted at `/api/v1/game/rooms`): list (`open` public lobbies with a free seat / `mine`), create, join (public by id, any table by invite code), get, leave, ready, kick (by seat), settings, start, pick profession, close (`?confirm=true`). Every change takes an optional `expectedVersion` (409 `room_conflict`). Refusals are Problem Details: `table_<rule>` for table rules (statuses mapped: 403 host/member, 400 settings/name/profession, 404 unknown player, 409 the rest), `room_limit` 429, `room_not_found` 404, `room_too_large` 413. A private table does not exist (404) for anyone not seated at it unless they came with its code; nothing a table shows contains an account id (tested).
- **Isolation, as tested:** every route sits behind `requireScope('game:r'|'game:w')` and the game-account guard - a normal account gets `403 not_a_game_account` on all 11 routes and no sign-in gets 401 (one test walks every route); a `game:r` token cannot change a table. **The tables have a rate-limit bucket of their own**: `apiLimiter` now skips `/game/rooms` and `routes/game-rooms.js` limits per account (`GAME_ROOMS_RATE_LIMIT`, default 3000 per 15 minutes) - a test shows 4 table requests cost the normal API's budget nothing, and that removing the skip makes it fail. The IP-wide limiter (10000 per 15 minutes) still counts everything.
- **Limits** (environment, read at use): 3 open tables hosted and 5 seats per account, 200 open tables on the server; lobbies idle for a day and running games idle for a week are closed, closed/finished tables are deleted after a week with their events and markers. The sweep runs when tables are listed or created (at most every 5 minutes): **no timer exists when nobody uses tables**.
- **MCP:** the OpenAPI additions raise the generated operation count from 166 to 177 (the pinned count in `generate-operations.test.ts` was updated); the 11 operations are not mapped to a tool yet - that is S7.
- **Not in S1 (as planned):** the event stream (S2), the play command endpoint with idempotency (S3), timers (S4). Language is chosen per table by the creator (`language`, default `en`), not read from an account's encrypted settings.
- Mutation-checked: guard off, private tables visible, and the version guard off each make a test fail.

**S2 as built (2026-10-15)** - `backend/services/game-room-stream.js`, `services/game-room-hub.js`, `services/game-room-errors.js`, the `GET /game/rooms/{id}/events` route, the nginx location (+ 14 unit tests, 12 integration tests over real sockets and CouchDB, a throwaway real-nginx check; backend unit/integration and MCP 105 green):

- **Server-sent events, as planned.** The stream sends, in order: `snapshot` (`id` = log position; `room` = id, invite code for seated players, language; `view` = the whole table as that viewer may see it), `log` lines for what the viewer missed since `Last-Event-ID` (stored events, each with the `seat` it had at the time, at most 200), then live `update`s and `presence`. An `update` is the events of one change by seat plus the table view in which a player entry **without `books` keeps the books the client already has** (`booksChanged` lists the seats that carry them) - the books are the bulk of a table, and a move changes one player's. State never depends on replay: a reconnect always starts with a fresh snapshot. A `: heartbeat` comment every 25 s (`GAME_ROOMS_HEARTBEAT_MS`) keeps proxies from closing an idle stream.
- **No gap, no repeat:** a connection is registered before the table is read; changes that arrive before the snapshot is sent are held and delivered after it, skipping any the snapshot already contains (unit-tested; a connection that never attaches is ended after 500 held updates). Per-viewer projection is the domain's `projectFor`, so a secret profession pick reaches only its owner and no stream ever contains an account id or the dice stream (tested over real sockets).
- **Who may watch:** a seated player; anyone with a game account at a **public** table whose host set `spectators` (403 `room_forbidden` otherwise; a private table is 404 for non-members). A normal account gets 403 `not_a_game_account`. Presence = which seats have a connection (`presence` messages as connections come and go and as seats shift).
- **Limits and isolation:** 5 live connections per account and 500 on the server (`stream_limit` 429); the connections live in the memory of the one backend process and nothing runs - no timer, no poll - when nobody is connected (the heartbeat timer exists per open connection only). The stream is covered by the tables' own rate-limit bucket. Everything persisted goes through the same `persist` that notifies the hub, so S3's commands and S4's timers will publish without further work.
- **nginx (approved):** a regex `location ~ ^/api/v1/game/rooms/[^/]+/events$` before `/api` in both server blocks of `nginx.conf` (buffering off, cache off, gzip off, `proxy_read_timeout 3600s`, empty `Connection` header). Checked with the real file in nginx:alpine: `nginx -t` passes, an idle stream stayed open past the default 60 s and delivered an event at 70 s, while the same event on an ordinary `/api` path never arrived within 80 s. Traefik (the k3s ingress) has no write timeout by default and the heartbeat is far inside its idle timeout, so `k8s/` needed no change.
- **OpenAPI/MCP:** `streamGameRoomEvents` is documented with the message shapes and an example; the MCP generator learned `x-mcp-skip: true` (a stream is not a tool; with a test), so the generated count stays at 177. An agent follows a table by polling `getGameRoom` and comparing `version` (`docs/api/AGENTS.md`).
- **Changed from S1:** the stored events now carry `seat`.

**S3 as built (2026-10-15)** - `POST /game/rooms/{id}/commands`, `services/game-room-commands.js`, `tableLegalActions` in the domain (`table/legal.ts`, 8 tests), `commandLog` in the room document (+ 7 unit tests for the parser, 9 integration tests that play a real table through the API; domain 1121, backend unit and integration and MCP 105 green):

- **The command endpoint.** `{command, clientCommandId?, expectedVersion?}`; the commands are the moves of play (roll, draw_card, buy_deal, pay_doodad, roll_decision, pass_card, bank_loan, sell_position, the five trade commands, pause/resume, back). The request is checked for **shape** here (unknown types and unknown fields are 400 - a typo is an error, never a different move; joining, leaving, readiness, settings and the clock's timeout are not accepted), and **allowed-ness** is the domain's: the wrong player 409 `table_not_your_turn`, a paused game 409 `table_paused`, a late move 409 `table_time_up`, and a move the solo rules refuse 422 `table_illegal_move` with the rule's own words. The API speaks in **seats** (`toSeat`, `fromSeat`), never accounts. A refused move changes nothing.
- **`legalActions` for every viewer** (`tableLegalActions(table, playerId)`, the domain): the commands the table would accept from that player right now - the mover's solo moves, selling for whoever has a buyer's offer open for them (asked as if still deciding, so a one-roll offer is listed for a waiting player), trade offer/answer, the host's pause or resume, `back` for an away player, and nothing for anyone out or outside the game. It is in every room response, the stream's `snapshot` and every `update` (per viewer). The UI enables buttons from it and an agent plays only from it. A consistency test checks that what is listed is accepted and what is not is refused.
- **Idempotency, atomic with the move.** `clientCommandId` is recorded in the room document (`commandLog`, the last 200 per table) **in the same write as the change**, so a retry after a lost response, or two identical requests at once, find it and answer with the table and `replayed: true, appliedVersion` instead of applying twice (tested with `Promise.all`: one applied, one replayed, one event). A refused attempt leaves no trace, so its id can be reused. `expectedVersion` refuses a move on a table that has moved on (409 `room_conflict`).
- **What the response holds:** the table as the caller may see it (with `legalActions`), the move's `events` by seat with their log positions, `replayed`, `appliedVersion`. Lobby routes now also accept `clientCommandId`.
- **Persistence and broadcast** were already one path (S1/S2): the move is saved against the room revision (retried on a newer table), its events and markers written, and everyone watching told - verified with a 3-player table played for many turns through the API and a stream test that checks each viewer's own `legalActions` in the update.
- **OpenAPI/MCP:** `playGameRoomCommand`, `GameRoomCommand` (a flat schema an agent can fill in) and `legalActions` on `GameRoom`; the generated MCP operation count is now 178 (mapped to tools in S7). `docs/api/AGENTS.md` tells an agent to play only from `legalActions`, always send a `clientCommandId`, and how selling, trading and the clock work.
- Mutation-checked: no `commandLog` and no replay lookup each fail two tests; the sell-window question in `legalActions` fails its test.

**S4 as built (2026-10-15)** - `backend/services/game-room-clocks.js`, the timeout/re-arm/rewind code in `services/game-rooms.js`, snapshots in the store, the `rewind` route, `rewindTable` + the `allowRewind` setting in the domain (+ 8 domain tests, 8 timer unit tests, 12 service-level and 3 HTTP integration tests including one with the server's real timer; domain 1129, backend unit/integration and MCP 105 green):

- **Server timers, deciding nothing.** One timer per table being played with a clock, armed after every saved change from the domain's `nextDeadline` (so a move, a pause, a resume, a rewind and a timeout all re-arm it), set a hair after the deadline, `unref`'d, capped at 24 days and re-checked. When it rings `runTimeout` loads the table and the domain's `applyTimeout` says whether the player really is out of time: if so the passive turn is played, saved and told to everyone through the same `persist` as any move (stream update with `turn_timeout`, the new mover's `legalActions`, a fresh deadline); if not (they moved, the game is paused, the timer was early) the table just arms for the deadline it has. A failed attempt (the database was away) tries again in 5 s. A late move and the timeout at the same instant: one wins, the turn is played once (tested with `allSettled`).
- **Restart.** `server.js` calls `startClocks()` after the database is up: every table in the `playing` phase gets its timer from the stored deadline, and a clock that ran out while the server was down rings at once (tested). A failure there is logged and does not stop the server. Nothing runs when no table is being played with a clock; the heartbeat and clock timers exist per open connection / per running table only.
- **Rewind (Q8).** `POST /game/rooms/{id}/rewind?confirm=true` (host only; `allowRewind`, default on, frozen at the start): the table goes back to its state at the **start of the previous turn**, the server keeping the last two turn starts as `snap:<room>:<slot>` documents (written when a turn starts, deleted with the room). The dice stream is **not** put back, so a replayed turn rolls different dice; who is in the game stays as it is now (a leaver stays gone, an away player stays away); the player whose turn it is again gets a fresh turn's time; an open trade offer is dropped; everyone sees `rewound`. One step only. Pure rule in the domain (`rewindTable`), snapshots and the room's `turnSeq` counter in the backend; takes `clientCommandId` and `expectedVersion` like a move (the move path was generalised: `execute` runs any change atomically against the room revision).
- **Real end-to-end:** a 10-second clock, a stream open, the host does nothing: the server's own timer rings, the passive turn is played, Anna's stream receives the update with `turn_timeout` and her new `roll` action, and the host's late move is refused as not their turn.
- **Away policy and pause** needed no backend work: they are the domain's, and every change they make flows through `persist`.
- OpenAPI `rewindGameRoom` + `allowRewind` (generated MCP operations: 179, mapped to tools in S7). Mutation-checked: no arming, no snapshots, no re-arm for a not-due ring each fail tests.

**S5 as built (2026-10-15)** - `fileFinishedGame` in `repositories/game-saves.js`, `fileGame` / `readLog` and closed markers in `services/game-rooms.js`, the `save` and `log` routes, `scope=recent` (+ 1 unit test, 8 integration tests over a real CouchDB; backend and MCP green):

- **The result** was already the domain's (`table.result`: reason, winner, ranking, shown by seat). The lobby summaries of a finished table now carry `result: {reason, winnerName}`.
- **Archive.** A table that is over keeps a **closed** seat marker for everyone who sat at it: `GET /game/rooms?scope=recent` lists them (with the result), `scope=mine` lists only open tables, and closed markers count toward **no** limit (tested: a host limited to one open table can open another once the first has finished). They go with the room when the sweep deletes it a week after it ended (events, snapshots and markers included).
- **Filing a game.** `POST /game/rooms/{id}/save {name?}`: a player files **their own final books** in their own saved games - the same `{schema, payload}` a solo save is, built with the domain's `snapshotFromBooks`, encrypted with the account's key through the existing saved-games store, marked ended, no undo history. It lists in `GET /game/saves`, reads with `GET /game/saves/{id}` and **loads** like any saved game (tested). Only a player with books (403 otherwise), only once the game is over (409 `room_not_over`; a table closed in its lobby has no books), and **once**: a reservation is written on the room document before the save (`filed`), so two simultaneous requests file one game and a repeat answers `alreadyFiled: true`; a failed filing releases its reservation; a reservation older than a minute counts as abandoned. This is the one place a table writes into a personal account, and only on the player's own explicit request, only to that player's saved games. The account's saved-game budget applies.
- **The record.** `GET /game/rooms/{id}/log?after=&limit=`: the table's events by seat, oldest first, with `next`/`end` for paging; same access as the live channel; no account ids.
- **Not built (decision):** a **command-exact replay export**. The event log records _what happened_, but replaying the game from seed and commands needs every command stored too (and rewinds replayed from snapshots); since nothing needs it yet, the plan's "replay export" is reduced to the log. The domain already replays a script of commands deterministically (`replayScript`, the golden game), so storing commands per move can be added when a replay viewer is built (Phase X).
- OpenAPI `fileGameRoomGame`, `getGameRoomLog`, `scope=recent`, `result` on the summary; generated MCP operations: 181 (tools: S7). Mutation-checked: no already-filed check, no reservation and open (not closed) markers each fail tests.

### Phase U — Client (self-hosted routes only, ADR-0004)

| Slice  | What                                                                                                                                                                                                                                                                                                                   | Size | Needs          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| **U0** | **Refactor, no behaviour change:** extract input-only presentational components from the solo template (card views, deal/doodad/market dialogs, books/finance summary, history) - no session port, no change to `CashflowGameService` (M0(b)); characterization tests first; solo screen and normal screens unchanged. | L–XL | M0             |
| **U1** | **Lobby UI**: browse/filter open tables, create-table form (§3.2), join by code/link, recent players, ready check, host controls, nickname/colour.                                                                                                                                                                     | L    | S1             |
| **U2** | **Table shell**: SSE client service (reconnect, replay, version tracking) + signal store, **multi-token board** (colour+shape, offsets, per-player animation), turn banner, **chess-clock display**, roll.                                                                                                             | L    | S2, U0         |
| **U3** | **Card flows at the table**: the active player's Deal/Doodad/dice flows over commands; the card on the table visible to everyone; Market card response UI for **all** (sell dialog for open offers, own-offers list); trade offers inbox/compose/accept-counter UI (T7).                                               | L    | S3, T7, U0, U2 |
| **U4** | **Player inspector**: per-player tabs (profession card, income statement, balance sheet, positions, history), compare/leaderboard, live event feed.                                                                                                                                                                    | L    | U2             |
| **U5** | **Time & presence UX**: clock bars per player, timeout/away indicators, pause, "it's your turn" (title flash, sound, Notification API), reconnect banner, mobile layout (you play on an iPhone).                                                                                                                       | M    | S4, U3         |
| **U6** | **Finish & polish**: results screen, "save to my games", replay viewer (stretch), all UI text in en/de/es/fr/cn/ar (es/fr/cn/ar flagged for native review), `CASHFLOW_GAME_GUIDE.md` multiplayer section, playtest checklist, **your friend playtest**.                                                                | M    | S5, U5         |

**Exit:** the exit criterion in §1, on your self-hosted stack, with friends.

### Phase X — later, not committed

Text chat beyond emotes · spectator mode polish · **web push** for daily games · fill-in AI players (see below) ·
friend requests · replay viewer · statistics/ranking · Fast Track (still its own project) · multi-replica scale-out via `_changes`.

### AI players - planned after the feature ships (JFK, 2026-10-15)

JFK's idea, recorded so it is not lost; **not part of the current slices**: when a table cannot find enough players, the host can fill the empty seats with **AI players** with different characters - from easy through medium to "plays by the statistics, does everything right" - and characters with a style: the pure investor, the lucky one (dice cards, Multi-Level-Marketing), combinations. Beyond that: a **self-learning** strategy that improves with every game played.

- **A head start already exists:** the strategy lab has nine reference policies (`simulation/strategies.ts`: never invests, properties from cash, picky, small-then-big, borrow-when-it-pays, leveraged big deals, marketing first, trade stocks for deposits, all-rounder) and thousands of simulated games per policy; the table simulation (T6) already seats them at a table. A seat of type `bot` = a server-side client that plays a policy through the same commands as a human (the agent-seat route of S7), so no special rules.
- **Difficulty ladder** (to design): handicapped copies of a good policy (noise, missed chances, a reaction delay) up to the best-by-statistics policy; **characters** as parameter sets of the same policy family (`PolicyParams`: minimum monthly return, reserve, loans, Big Deals from, stock thresholds, MLM) plus names and a short personality text.
- **Self-learning, honestly:** yes, it is possible and worth doing, as an **offline loop**: self-play (now with several players at a table) searches the policy parameters, and every played table is already a replayable script that adds data. Limits to design around: dice and cards mean no policy wins always, and the best play depends on the opponents, so "absolute best in every situation" can only mean the best measured win/escape rate with confidence intervals against a benchmark field; an AI whose behaviour changes between or during games cannot be tested or reproduced, so learned policies are **versioned and frozen**, and a new version ships only if it beats the current one in a fixed benchmark; human games are noisy and are better test data than the thing to imitate (and need consent); the card set changing invalidates old results.
- Open for the design phase: how bots are labelled in the lobby and results (always visibly an AI), whether bots count in the ranking, stat storage, who pays for the compute (the learning runs on the dev machine/CI, not the production server).

## 6. Order and dependencies

```
 M0 ─▶ T1 ─▶ T2 ─▶ T3 ─▶ T4 ─▶ T6
        │           └──▶ T5 ──┘
        ├─▶ S1 ─▶ S2 ─▶ S3 ─▶ S4 ─▶ S6
        │                 └▶ S5
        └─▶ U1 (after S1)      M0 ─▶ U0 ─▶ U2 ─▶ U3 ─▶ U5 ─▶ U6
                                       └▶ U4
```

**Recommended sequence: M → T → S → U**, with U0 (the refactor) started in parallel to T/S since it only needs M0. Rationale: the
reducer is where every hard rule question gets answered cheaply (unit tests), the bot harness proves the server before any
screen exists, and the UI is then a client of a frozen, tested contract. **Fastest way to something you can feel:** after T3 +
S1–S3 + U1/U2 minimal you can already play a no-clock, no-market-card game with two browsers (a "walking skeleton" milestone) —
I'd cut it as soon as T3/S3/U2 land.

## 7. Risks

- **U0 coupling** — the solo UI is deeply tied to account-bound services. Mitigation: spike in M0(b); characterization tests; if it
  proves too tangled, build the table UI as a new component reusing only extracted presentational parts.
- **Table-wide Market cards (T4)** — the existing implementation assumes one set of books; every card kind (offers, splits, boosts,
  costs) needs a table-aware path and tests per kind. Mitigation: per-card-kind tests against the real classic deck.
- **Clock correctness (S4)** — timers across restarts, latency fairness, double-firing (auto-move vs. a command arriving at the
  deadline). Mitigation: all deadline/auto-move decisions go through the same versioned reducer, so a late command simply fails the
  version/turn check.
- **Document size and write rate** — N players' books + events in CouchDB; many small writes per turn. Mitigation: per-player books docs
  - append-only event docs (no giant single doc), compaction at finish, size guard like the saved-games guard.
- **Single backend replica** — a restart drops SSE connections and in-memory timers. Mitigation: clients reconnect with
  `Last-Event-ID`; timers re-armed from the DB on boot; S6 tests restart-mid-game.
- **Stalled tables** — absent players blocking friends. Mitigation: timeouts, away policy, host kick, vote-skip, abandoned-room TTL.
- **Cheating / information leaks** — projections must never leak deck order/seed; command authorization is server-side only.
  Mitigation: projection tests, forced strict rule subset, no client-trusted dice or amounts.
- **Crowded board at high N** — tokens overlapping and long waits. Mitigation: ring offsets, default cap 6, soft warning above 12.
- **Scope creep** — chat, push, agents, Fast Track. Mitigation: Phase X is explicitly uncommitted.

## 8. Working rules for every slice

- Conventional Commits, one concern per commit; extraction/refactor never shares a commit with behaviour change.
- Money in new code: integer minor units + ISO-4217 (ADR-0002). No hand-written `Transaction.comment` DSL; table actions are typed commands.
- English in code/docs/API; UI text in all 6 languages in the same commit as the feature.
- Frontend: targeted tests while iterating, `npm run verify` before every commit that lands; backend integration via podman, torn down afterwards;
  Playwright only for deliberate one-off debugging — multi-client coverage comes from the bot harness (S6).
- Test accounts/rooms created during verification are deleted afterwards unless a named fixture.
- New Pro/game code stays out of the Firebase edition (ADR-0004); everything here is self-hosted only.
- **Ask before:** the `gamerooms` storage schema (S1), any nginx/k8s config change (S2), any new dependency (none planned; SSE needs none).
- Nothing is deployed, pushed or merged without being asked. Deploy order is JFK's call.
