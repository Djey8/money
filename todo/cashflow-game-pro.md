# Cashflow game — self-hosted Pro API + MCP (an agent plays full games itself)

**Status:** planned, not started (2026-10-05). This is Phase 5 of [`cashflow-game.md`](cashflow-game.md),
promoted to a project of its own. Read that file's decisions 1–12 first; this one only adds to them.

## 1. Goal

An agent (Claude via the MCP tools, or any client of the REST API) plays a **complete Cashflow game by
itself**: starts a game, rolls the die, moves around the board, resolves every space, draws and decides on
cards, trades, borrows, undoes, escapes the rat race or goes bankrupt, and saves/loads games — everything the
UI can do, without a human telling it which space it landed on.

**Exit criteria**: a scripted agent plays a game from `start` to `escaped`/`bankrupt` using only the public
API/MCP, with a seeded RNG so the run is reproducible, and the resulting account looks exactly as if a human
had played the same moves in the UI.

## 2. Locked decisions (JFK, 2026-10-05)

1. **One source of truth for the rules.** The rules that live only in the Angular service today
   (`src/app/shared/services/cashflow-game.service.ts`, 3,026 lines) move into `packages/domain`, with
   characterization tests written against the _current_ behaviour first. **The UI is migrated onto the shared
   code**, slice by slice, so the API and the UI cannot play different games (ADR-0003). Same pattern as the
   Grow project (D-9/D-16).
2. **Full scope, including saved games** (save, load, list, end, delete) — not a "play loop first, saves later"
   split. Slices below are an _order_, not a cut line.
3. **Game accounts only.** The game endpoints return 403 (`NOT_A_GAME_ACCOUNT`) unless the account email
   contains `cashflow` (`backend/services/game-account.js`'s `isGameAccountEmail`). They have their own scopes,
   `game:r` / `game:w`. The existing generic tools stay exactly as they are today (not blocked, not designed
   around the game) — decision 2 of `cashflow-game.md` stands.
4. **Single player.** An agent plays alone (multiplayer is `cashflow-game.md` Phase 6). Baby/Charity/Downsized's
   "N turns" are the physical board's turn order; with no opponents the engine tracks them as the same
   reminders the UI shows (`charityRoundsLeft`/`unemployedRoundsLeft`), cleared on the agent's own turns.

## 3. Blocker: the board

The UI is a **companion**: the human says which space they landed on. An agent playing alone needs **solo mode**
(`cashflow-game.md` decision 8, "not yet built"): a die, a token position, and a `board` — the ordered space
sequence in `CashflowGameSet.board`. **No game set defines one today**, and `docs/domain/CASHFLOW_GAME_GUIDE.md`
says the real sequence is still needed from JFK. Nothing in this repo may be invented (decision 6).

**Needed from JFK:** the rat-race board's space sequence, in order, as `CashflowSpaceKind` values
(`payday | dealBig | dealSmall | market | doodad | baby | charity | downsized`), for each game set that should be
playable by an agent. Slices 0–2 and the saved-game work do not depend on it; slice 3 (the turn loop) does. Until
it arrives, a clearly-fake placeholder board ships behind the same flag as the placeholder game set, so the loop
is testable.

## 4. Design principles for an agent

- **The state read tells the agent what it may do.** `GET /game` returns the state, the finances summary
  (`summarizeGameFinances`, already in the domain package), the rat-race/bankrupt status, **any pending
  decision** (a drawn card awaiting buy/pass, an asset deal waiting for its dice roll, a recurring payday roll
  due, an unresolved space) and a `legalActions` list. An agent should never have to infer the rules to know
  what comes next.
- **Every write is one atomic, undoable step**, built on the existing `withTransactionsWrite`-style helpers and
  the same `applyDerivedState` recompute every other transaction write uses (Smile/Fire/Income stay correct).
  Money is integer minor units + ISO-4217 (ADR-0002); no new float handling.
- **No comment-DSL by hand** (CLAUDE.md, D-16): deal purchases/sales go through the existing typed Grow actions
  (`buy`/`sell`/`deposit`/`cashflow`/`payback`) — decision 10 of `cashflow-game.md` — never a hand-written
  `"Buy Share X 10 x 25;"` comment.
- **Randomness is injectable.** Dice and card draws take an RNG; production uses the server's, tests seed it.
  The response always reports what was rolled/drawn.
- **Translations stay out of the API.** The API speaks stable keys and English; the UI keeps translating
  (`src/app/shared/cashflow-content.ts`). `key` fields on professions/expenses (already present) are the contract.

## 5. Slices

Each slice follows `.claude/skills/mm-add-api-endpoint` per endpoint: OpenAPI first, domain, repository, route,
unit + live-CouchDB integration tests, docs, MCP mapping. One concern per commit. No UI behaviour change in a
slice that only extracts; the extraction commit and any behaviour change are never bundled.

**Slice 0 — extract the rules (no API yet).** Characterization tests over the current Angular service for every
rule below, then move the pure logic to `packages/domain/src/cashflow-game/` and point the service at it:
deal planning/execution, Grow-backed trades, recurring paydays and dice cards (`paydayRollCount`,
`resolveGamble`), market sales and coins (`marketSaleFor`, `sellCoins`), doodads and the doodad loan note, bank
loan cash movement, the `#cashflow` subscription bookkeeping and non-overlapping default dates, live profession
card, `resetGame`, undo/redo snapshots (`captureGameSnapshot`/`restoreGameSnapshot`, the undo-chain codec), and
saved-game snapshots. The engine takes its inputs (state, subscriptions, entities, RNG, clock) as plain data and
returns the effects, like `engine.ts` already does for payday/baby/charity/downsized. **Largest slice; the risk
is regressing a game being playtested, so the existing 1,300+ frontend tests plus new characterization tests must
stay green at every step.**

**Slice 1 — read surface.** `GET /game`, `GET /game/sets`, `GET /game/sets/{id}` (professions, loan rule, board
if any), `GET /game/cards?deck=&…` (browse), `GET /game/history`, `GET /game/saves`. Scope `game:r`. Game-account
guard + `NOT_A_GAME_ACCOUNT`.

**Slice 2 — the play loop, companion style.** `POST /game/start` (set + profession), `/game/payday`,
`/game/baby`, `/game/charity`, `/game/downsized`, `/game/bank-loan` (`{deltaMinor}`), `/game/status/clear`,
`/game/undo` (`{steps}`), `/game/reset` (destructive, needs the `:bulk`-style confirm like other destructive
ops). Scope `game:w`. After this an agent can play if _it_ tells the engine which space it landed on.

**Slice 3 — solo mode (needs the board, §3).** `POST /game/turn` rolls the die, moves the token, lands, and
resolves the space (or leaves a pending decision for a card space); `POST /game/cards/draw`; the pending-decision
endpoints (`/game/deals/{id}/{buy|pass|sell|…}`, dice-card resolution, market sale, coin sale, doodad pay);
turn-order reminders; end detection (`escaped` when passive income covers expenses, `bankrupt` when monthly
cashflow is negative). Fast Track stays out of scope (Phase 6).

**Slice 4 — saved games.** `GET /game/saves` (slice 1), `POST /game/saves` (save the live game),
`POST /game/saves/{id}/load`, `POST /game/saves/{id}/end`, `DELETE /game/saves/{id}`. Needs a **server-side copy of
the snapshot codec** (gzip → base64 → encrypt, `gz:` prefix, schema 1 — `backend/DATABASE_STRUCTURE.md`,
`src/app/shared/undo-chain-codec.ts`) that is byte-compatible with the browser's, so a game saved by the UI loads
through the API and vice versa. The ≈30-game soft limit and the per-document size ceiling apply to the API too.

**Slice 5 — MCP + docs.** Two tools, in keeping with ADR-0008's one-tool-per-operation-group: `get_cashflow_game`
(read) and `play_cashflow_game` (`action` + args, destructive actions need `confirm: true`), generated from
`openapi.yaml`. An `explain_concept` topic for the game guide, `docs/api/AGENTS.md` and `docs/api/MCP.md`
sections, a "playing as an agent" section in `docs/domain/CASHFLOW_GAME_GUIDE.md`, a `backend/DATABASE_STRUCTURE.md`
note, and the scripted full-game integration test from §1.

## 6. Risks and open questions

- **UI regression while migrating the service** (slice 0). Mitigation: characterization tests first; migrate one
  rule at a time; never combine an extraction with a behaviour change.
- **Snapshot compatibility** (slice 4): UI-saved games must round-trip through the API. A golden snapshot fixture
  produced by the browser codec pins this, like the golden vectors for the encryption format.
- **Document size**: every saved game and its undo history lives inside the user's one CouchDB document, which
  already measures ≈2 MB for a long-lived personal account. An agent can play far more games than a human; the soft
  limit and a hard guard need a decision before slice 4 ships.
- **Board and card content** must come from JFK (decision 6): the board sequence (§3), and any deck still missing
  real card data (`classic-*.ts` already hold the Classic decks).
- **Fast Track and multiplayer** are out of scope (Phase 6).
- Whether the game tools should also let an agent read the game's raw transactions/subscriptions: no — it uses the
  existing generic tools for that, which stay available (decision 3 above).

## 7. Order of work

0 → 1 → 2 can start now. 3 starts when the board arrives (or against the placeholder board). 4 and 5 follow 2/3.
