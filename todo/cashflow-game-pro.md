# Cashflow game — solo mode in the app + Pro API/MCP (an agent plays full games)

**Status:** inputs received (board picture, rule answers, schema approval — 2026-10-05); **slice A0 in progress.** Master roadmap for Phase 3 (solo board simulation) and Phase 5 (Pro
API + MCP) of [`cashflow-game.md`](cashflow-game.md), merged because both need the same thing: **one rules engine
that can play a whole game by itself**. Read that file's decisions 1–12 first; this one only adds to them.

## 1. Goal

Two deliverables, one engine:

1. **Solo mode in the app** — play with no physical board and no second person. The app shows the rat-race board,
   you roll a die, a **totem walks around the circle**, and whatever it lands on resolves (Payday when passed or
   landed on, Baby, Charity, Downsized automatically; Deals/Market/Doodad hand over to the existing card flows).
2. **Pro API + MCP** — an **agent plays a complete game by itself** (start → turns → escape/bankrupt), plus saved
   games, through game-only endpoints and two MCP tools.

**Exit criteria**: (a) JFK plays a full solo game in the app from profession pick to escaping the rat race (or
bankruptcy) without touching the physical board; (b) a scripted agent plays a full game through the public
API/MCP with a seeded RNG, reproducibly, and the account ends up exactly as if a human had played the same
moves in the UI.

## 2. Locked decisions

From JFK, 2026-10-05 (earlier in this thread):

1. **One source of truth for the rules.** Rules living only in the Angular service
   (`src/app/shared/services/cashflow-game.service.ts`, 3,026 lines) move into `packages/domain`, with
   characterization tests written against the _current_ behaviour first; **the UI is migrated onto the shared
   code**, slice by slice, so UI and API cannot play different games (ADR-0003). Same pattern as Grow (D-9/D-16).
2. **Full scope including saved games.** Slices are an _order_, not a cut line.
3. **Game accounts only.** Game endpoints return 403 `NOT_A_GAME_ACCOUNT` unless the email contains `cashflow`
   (`backend/services/game-account.js`); own scopes `game:r` / `game:w`; generic tools untouched.
4. **Single player.** An agent/solo player plays alone (multiplayer = `cashflow-game.md` Phase 6).

New, 2026-10-05:

5. **Solo mode is built in the app first-class** (board, dice, totem), not just exposed through the API. JFK will
   supply a **picture of the rat-race board**; the board data (space order, kinds, layout) is transcribed from it
   — nothing about the board is invented (decision 6 of `cashflow-game.md`).
6. **Deploy order:** the performance changes are deployed first, independently of all this.

## 3. Inputs from JFK (received 2026-10-05)

- **The board picture** — received and transcribed below. It is the German "Cashflow — Verlasse das Hamsterrad!"
  board; the rat race is the inner ring. The outer track (professions, numbered ① ② ④ ⑤ markers, the large deck
  cards) is the Fast Track / deck areas and is out of scope.
- **Rule answers** — in §7. JFK also approved **adding the schema fields solo mode needs** (§4).
- **Visual brief**: _"you don't have to visualize it nicely — just a circle with the different fields, and we
  simulate your token going along it."_ C2/C4 are deliberately simple: a ring of 24 labelled, colored cells and a
  token, no board art.
- **Still to come**: JFK's playtest after C7 and after D3.

### 3.1 The rat-race board (24 spaces, clockwise from START)

Transcribed from the picture; `index` 0 is the space the START marker sits next to, and the token moves clockwise
(the printed arrows). Cells 12 Deals + 3 Doodad + 3 Payday + 3 Market + Charity + Downsized + Baby. The pattern
repeats every 8 spaces (Doodad, Charity|Downsized|Baby, Payday, Market on the odd positions), which is a good
check that the transcription is right.

| #   | Printed (DE)   | Kind (`CashflowSpaceKind`) | #   | Printed (DE)   | Kind        | #   | Printed (DE)   | Kind     |
| --- | -------------- | -------------------------- | --- | -------------- | ----------- | --- | -------------- | -------- |
| 0   | Deals          | `deal` (pile chosen)       | 8   | Deals          | `deal`      | 16  | Deals          | `deal`   |
| 1   | Schnickschnack | `doodad`                   | 9   | Schnickschnack | `doodad`    | 17  | Schnickschnack | `doodad` |
| 2   | Deals          | `deal`                     | 10  | Deals          | `deal`      | 18  | Deals          | `deal`   |
| 3   | Wohltätigkeit  | `charity`                  | 11  | Arbeitslos     | `downsized` | 19  | Baby           | `baby`   |
| 4   | Deals          | `deal`                     | 12  | Deals          | `deal`      | 20  | Deals          | `deal`   |
| 5   | Zahltag        | `payday`                   | 13  | Zahltag        | `payday`    | 21  | Zahltag        | `payday` |
| 6   | Deals          | `deal`                     | 14  | Deals          | `deal`      | 22  | Deals          | `deal`   |
| 7   | Der Markt      | `market`                   | 15  | Der Markt      | `market`    | 23  | Der Markt      | `market` |

A Deals space does **not** fix Small vs Big: the player picks the pile when landing (§7). The existing
`CashflowSpaceKind` has `dealSmall`/`dealBig`; the board stores a single `deal` marker per Deals space and the
choice is part of the pending decision (B1 decides the exact type — likely a new `deal` kind on the board only,
leaving `CashflowSpaceKind` as the companion UI uses it).

The printed card texts on the board confirm the existing rules: Charity — _"donate 10% of your total income and
use 1 or 2 dice for the next 3 turns"_; Baby — _"you get a child, add it to your expenses (maximum 3 children per
player)"_; Downsized — _"pay the bank the amount of your total expenses and sit out 2 rounds"_.

## 4. Architecture

```
packages/domain/src/cashflow-game/     ← the engine: pure functions, plain data in/effects out, injectable RNG + clock
        ▲                          ▲
 Angular UI (companion + solo)   backend/repositories/cashflow-game-repository.js  → /api/v1/game/*  → MCP tools
```

- **Engine contract** (`engine.ts` already does this for payday/baby/charity/downsized/bank loan): takes the game
  state, subscriptions and the real entities as plain data, returns the effects (new state, transactions,
  subscriptions, Grow/balance patches, log lines). No Angular, no I/O, no `Math.random()` — dice and card draws
  take an `Rng`; production passes a real one, tests pass a seeded one.
- **Existing state already carries the hooks** (`CashflowGameState`): `mode: 'companion' | 'solo'` and
  `boardPosition: number | null`. Solo needs only a few more **optional** fields (`turn` phase, `lastRoll`,
  `diceCount`, `skipTurnsLeft`, `pending` decision) — additive, optional, so older saved games and the undo chain
  still load. **Per CLAUDE.md ("ask before changing the storage schema") this is flagged for JFK's explicit OK
  before slice B2 lands.**
- **Turn state machine** (one turn = one roll):

```
 idle ──roll──▶ rolled ──move──▶ moving(passes Payday?) ──land──▶ resolving
   ▲                                                             │
   │             auto spaces (payday/baby/charity/downsized) ◀───┤
   └──── endTurn ◀── decided ◀── pending decision (deal / market / doodad / dice card) ◀─┘
```

Every transition is **one atomic, undoable step** (the existing snapshot/undo unit), so Undo works across turns
and a reloaded page resumes in the same phase.

- **Companion mode is unchanged.** Solo is an extra layer on top: the same per-space resolution functions, driven
  by the roll instead of by the player's button.

## 5. Phases and slices

Sizes are relative: **S** ≈ a few commits, **M** ≈ a session, **L** ≈ several, **XL** ≈ the bulk of the project.
Every slice follows the working rules in §9 (one concern per commit, tests first for extractions, full verify
green, no behaviour change bundled with an extraction).

### Phase A — Foundations (no visible change)

| Slice  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Size | Needs |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| **A0** | **Characterization tests** over the current Angular service for every rule that is about to move, written first and kept as the safety net. Inventory in `todo/cashflow-game-pro-inventory.md` (each rule → current location → target module).                                                                                                                                                                                                                  | M    | —     |
| **A1** | **Extract, group by group** (each group: move → point the service at it → tests green → commit): (a) bank loan / payday / status — mostly in the domain already, make the UI use it everywhere; (b) deals + Grow-backed trades (`planDeal`, `executeDeal`); (c) recurring paydays and dice cards (`paydayRollCount`, `resolveGamble`); (d) market sales and coins (`marketSaleFor`, `sellCoins`); (e) doodads + loan note; (f) live profession/finance summary. | XL   | A0    |
| **A2** | **Undo, snapshots, reset, saved-game snapshot** into the domain (`captureGameSnapshot`/`restoreGameSnapshot`, the undo-chain codec, `resetGame`). The browser-only pieces (gzip via `CompressionStream`) stay behind a small interface so the server can supply its own.                                                                                                                                                                                        | L    | A1    |
| **A3** | **`Rng` + clock injection** across the engine (`rollDie` and card draws today call `Math.random()` / `Date`), plus a **seeded RNG** for tests.                                                                                                                                                                                                                                                                                                                  | S    | A1    |

**Exit**: UI behaves identically (all 1,300+ frontend tests + the new characterization tests green); the service
is a thin adapter over the domain package.

### Phase B — Solo-mode engine (domain only, no UI)

| Slice  | What                                                                                                                                                                                                                                                                                                                                                        | Size | Needs             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------- |
| **B1** | **Board data model + the Classic rat-race board**, transcribed from JFK's picture, validated (every kind present, a Payday exists, ring closes) with a golden test that pins it to the transcription. Placeholder board until the picture arrives. Optional layout hints (x/y or arc position) so the UI draws what the picture shows.                      | S    | **picture**       |
| **B2** | **Dice, movement and landing**: roll 1 die (2 under Charity), advance with wrap-around, detect **passing** vs **landing** on Payday, land → space kind. State additions (§4), **schema OK from JFK first**.                                                                                                                                                 | M    | B1, A3, schema OK |
| **B3** | **Turn state machine**: auto-resolve payday/baby/charity/downsized through the existing engine functions, hand card spaces over as a `pending` decision (which deck, which pile for Deals), `endTurn`; Charity's "1 or 2 dice for 3 turns" as a real turn effect and Downsized's spanner shown until the next roll (§7 — nothing is skipped playing alone). | L    | B2, A1            |
| **B4** | **Game end**: escape the rat race (passive income ≥ expenses, already `summarizeGameFinances`) and bankruptcy as terminal states with their own phase; a final summary object.                                                                                                                                                                              | S    | B3                |
| **B5** | **Simulation tests**: seeded full games with a simple policy (always buy affordable deals / never buy); property tests that no game throws, cash/entity invariants hold, undo returns to the exact prior state at every step, and the same seed replays identically. Also produces the golden "agent plays a game" fixture reused in D5.                    | M    | B4                |

**Exit**: a seeded full game runs from start to a terminal state in a unit test, deterministically.

### Phase C — Solo mode in the app

| Slice  | What                                                                                                                                                                                                                                                                                                                                                                           | Size | Needs      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------- |
| **C1** | **Start-game mode choice**: Companion vs Solo, only offered for game sets that ship a `board`; stored in `mode`; Companion untouched.                                                                                                                                                                                                                                          | S    | B1         |
| **C2** | **Board component**: the rat race drawn from the board data (SVG), space colors from the existing tokens (green Deals, red Doodad, purple Charity/Baby/Downsized, orange Payday, blue Market), the totem at `boardPosition`. Responsive for phone width (you play on an iPhone), dark/light, accessible names. No animation yet.                                               | M    | B1         |
| **C3** | **Dice component + roll flow**: tap to roll; the animation **reveals the engine's result** (it never rolls on its own); 1 or 2 dice; honours `prefers-reduced-motion`.                                                                                                                                                                                                         | M    | B2         |
| **C4** | **Totem animation**: walks space by space along the circle to the landing space, with a "skip animation" option; visually marks the Payday it passes.                                                                                                                                                                                                                          | M    | C2, C3     |
| **C5** | **Turn flow wiring**: landing opens the existing resolution UIs (Deal pile choice, find-or-draw, doodad pay, market offers, dice cards) as the pending decision; End turn; the Downsized spanner is shown and removed by the next roll; Undo rewinds a whole turn; history log gets roll/move lines. The turn logic is the domain's — the component only renders and forwards. | L    | B3, C3, C4 |
| **C6** | **HUD and end of game**: position, distance to the next Payday, last roll, Charity/Downsized status as turn counters (replacing the manual reminders in solo mode); escape / bankrupt screens with a save-game prompt.                                                                                                                                                         | M    | B4, C5     |
| **C7** | **Polish and acceptance**: all UI text in the 6 languages (en/de/es/fr/cn/ar), a short "Solo mode" section in `CASHFLOW_GAME_GUIDE.md`, a manual playtest checklist (no Playwright — per the dev-cycle rule it is reserved for deliberate one-off debugging), then **JFK's full playtest**.                                                                                    | M    | C6         |

**Exit**: a full solo game is playable end to end in the app; JFK's playtest findings fixed.

### Phase D — Pro API + MCP (consumes the same engine)

Each endpoint follows `.claude/skills/mm-add-api-endpoint`: OpenAPI first, domain, repository, route, unit +
live-CouchDB integration tests, docs, MCP mapping. **D1 and D2 only need Phase A and can start in parallel with
B/C**; D3 needs B.

| Slice  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Size | Needs  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| **D1** | **Read surface + guard**: `GET /game` (state, finances, status, **pending decision, `legalActions`**), `/game/sets` (+ `/{id}` incl. board), `/game/cards`, `/game/history`, `/game/saves`; scopes `game:r`/`game:w`; `NOT_A_GAME_ACCOUNT` guard; OpenAPI + docs.                                                                                                                                                                                     | M    | A1     |
| **D2** | **Companion-style writes**: `POST /game/start`, `/payday`, `/baby`, `/charity`, `/downsized`, `/bank-loan`, `/status/clear`, `/undo`, `/reset` (destructive → explicit confirm).                                                                                                                                                                                                                                                                      | L    | A1, D1 |
| **D3** | **Solo turn + decisions**: `POST /game/turn` (roll + move + land + auto-resolve), `/cards/draw`, decision endpoints (`/deals/{id}/{buy\|pass\|sell}`, dice-card resolution, market sale, coin sale, doodad pay) built on the typed Grow actions — never a hand-written comment DSL. The response always reports what was rolled/drawn and the new `legalActions`.                                                                                     | L    | B3, D2 |
| **D4** | **Saved games**: `POST /game/saves`, `/{id}/load`, `/{id}/end`, `DELETE /{id}`; a **server-side snapshot codec** (gzip → base64 → encrypt, `gz:` prefix, schema 1) byte-compatible with the browser's, pinned by a golden snapshot fixture so a UI-saved game loads through the API and vice versa; the ≈30-game soft limit plus a hard document-size guard (an agent can play far more games than a human — needs a decision before this ships).     | L    | A2, D1 |
| **D5** | **MCP + docs + the agent test**: `get_cashflow_game` and `play_cashflow_game` (`action` + args; destructive actions need `confirm: true`) generated from `openapi.yaml`; an `explain_concept` topic; `docs/api/AGENTS.md` and `MCP.md` sections; "playing as an agent" in the guide; `backend/DATABASE_STRUCTURE.md`; and the **scripted full-game integration test** (seeded RNG, from B5's fixture) through the real API and the MCP stdio harness. | M    | D3, D4 |

**Exit**: the exit criterion (b) in §1, in CI.

## 6. Order and dependencies

```
        A0 ─▶ A1 ─▶ A2
              │  └▶ A3 ─▶ B2 ─▶ B3 ─▶ B4 ─▶ B5
   picture ─▶ B1 ──┘            │
                                ├──▶ C1…C7  (UI)     ─▶ JFK playtest
        A1 ─▶ D1 ─▶ D2 ─────────┴──▶ D3 ─▶ D5
                  A2 ─▶ D4 ──────────────▶ D5
```

**Recommended sequence: A → B → C → D.** The solo turn loop is what JFK can actually try in the app, and it forces
the turn model that the API then exposes — freezing API contracts _after_ the UI has proven them is cheaper than
changing a published OpenAPI later. D1/D2 can be pulled forward whenever agent read-access is wanted sooner.

## 7. Rules (answered by JFK, 2026-10-05)

1. **Payday** — you are paid whenever you **land on or pass** a Payday space. Each pass/landing runs the existing
   Payday (which also advances the game's calendar one month).
2. **Downsized** — pay your total expenses (existing resolution) and the **spanner** shows that you are sitting
   out 2 rounds. Playing alone nobody else takes a turn in between, so **nothing is actually skipped**: the
   spanner is only the visual reminder, and it is **removed when the player rolls again to continue**
   (`clearCashflowStatus('unemployed')`, driven by the roll instead of a button). Today's companion-mode spanner
   and its manual dismiss stay as they are.
3. **Charity** — after the donation, for the next **3** turns (the board's wording; JFK said "two" in passing —
   confirm if 2 is intended) the player may choose **1 or 2 dice** before each roll; the move then continues
   automatically with the sum.
4. **Baby, Market, Deals, Schnickschnack** — as in companion mode. Deals: the player chooses **Small or Big**
   pile; for every card space the player either **draws a random card or looks for a specific one** (the existing
   find-or-draw flow, unchanged). The turn cannot end until the card decision is made or explicitly passed.
5. **Insufficient cash** on a doodad/deal: the existing auto-bank-loan behaviour (`autoLoanMessage`).
6. **Fast Track**: out of scope — escaping the rat race ends the game.
7. **Start**: the token starts at **START**, just before space 0, and the first roll of _n_ lands on space _n − 1_
   (so a roll of 1 lands on the Deals space next to START). **Open — please confirm with the first playtest;** if
   the real game starts the token _on_ space 0, it is a one-line change in B2.

## 8. Risks

- **UI regression while migrating the service (A1/A2)** — mitigation: characterization tests first, one rule at a
  time, never combine an extraction with a behaviour change, and keep JFK's playtest account safe (work on
  `develop`, deploy only on request).
- **Snapshot compatibility (D4)** — golden fixture from the browser codec, like the encryption golden vectors.
- **Document size** — every saved game + its undo history sits inside the user's single CouchDB document (≈2 MB
  already on a long-lived personal account); needs a guard before D4.
- **Animation on a phone (C4)** — keep the SVG light; step animation must be skippable and never block play.
- **Board and card content** come from JFK; the placeholder board must be impossible to mistake for the real one.
- **Scope creep into Fast Track / multiplayer** — explicitly out (Phase 6).

## 9. Working rules for every slice

- Conventional Commits, one concern per commit; extraction and behaviour change never share a commit.
- Money in new code: integer minor units + ISO-4217 (ADR-0002). No hand-written `Transaction.comment` DSL.
- English in code/docs/API; UI text in all 6 languages in the same commit as the feature.
- Frontend: targeted tests while iterating, `npm run verify` before every commit that lands; backend integration
  tests via podman (`docker-compose.test.yml`), torn down afterwards.
- New Pro code stays out of the Firebase edition (ADR-0004); game endpoints are self-hosted only.
- Nothing is deployed, pushed or merged without being asked. Deploy order is JFK's call.
