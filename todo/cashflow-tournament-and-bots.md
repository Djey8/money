# Cashflow tournament, champions and bot seats

**Status: planned 2026-10-15 (JFK). Slice A1 is the first to be built.** Builds on the multiplayer feature
(`todo/cashflow-multiplayer.md`) and the solo strategy lab (`docs/domain/CASHFLOW_STRATEGY_LAB.md`, `scripts/strategy-lab.js`).
Replaces the parked "AI players" note in the multiplayer plan (Phase X).

## 1. Goal

1. **Find the best way to play**, for every profession, under every rule option a table can use, by a tournament of strategies
   (policies) played as whole multiplayer tables in memory - not just solo escape rates, but **who escapes first** when players
   share the piles and Market cards.
2. **Keep the winners** as versioned, frozen **champions** (a champion book: which policy for which profession / rules / table
   size), documented and pinned by a test so a rules change that breaks them is noticed.
3. **Seat them**: a host can put a champion (or any policy) at an empty seat of a table; an external agent (MCP) can sit at the
   same table next to them and try to beat them. Humans, agents and bots mix freely.
4. **Document the multiplayer side** on its own page next to the game manual: how a table works, how to hook up an agent, how to
   seat a bot, what the champions are and how they were found.

## 2. What exists (so we build on it, not beside it)

- **Solo strategy lab** (`packages/domain/src/cashflow-game/simulation/`, `scripts/strategy-lab.js`, results in
  `docs/domain/strategy/data/results.json`, report `CASHFLOW_STRATEGY_LAB.md`): 9 preset policies + a knob search ("best-found",
  90% solo escape), 15 professions, 300 seeded games per cell. Policies decide only what is free in the game: which pile, buy or
  pass (and how many shares), selling into offers, repaying the bank, one or two dice. Everything else is forced.
- **`simulateTable`** (`table/simulate.ts`): a whole table in memory under the real table rules, one policy per seat, a clock that
  jumps, invariant and leak checks, script + digest. Seeded and reproducible.
- **Agent seats** (MCP `table_*`, slice S7) and the **bot harness** (`backend/tests/helpers/table-bots.js`, test-only scripted
  clients).

## 3. What is missing

| Gap                                | Consequence                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Policies see only their own books. | They cannot react to the race (behind: take risk; ahead: protect) - the main way a bot could "think".      |
| The lab ran under the solo rules.  | Tables force `offered-once`, buy `with-card`, no reported rolls, no sell `always`: the ranking may differ. |
| No head-to-head result.            | Solo escape rate does not say who wins a table; shared piles and seat order matter.                        |
| No champion data in the product.   | Findings live in a report only.                                                                            |
| No bot seat in the server.         | Only a person or an external agent can sit.                                                                |

## 4. The tournament (slice A1-A3)

**Unit of play:** one whole table (`simulateTable`), 2-6 seats, a fixed profession per seat, one policy per seat, a seed. Winner =
first to escape the rat race (the table's default end condition); the rest are ranked by the table's own result.

**Grid (staged - start narrow, widen where it matters):**

| Axis                    | Values                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Profession              | all 15 of the Classic set, as a **mirror** (everyone the same profession) and as a **mix** (each seat a different one) |
| Rules base              | `guided`, `strict` (and `sellOfferRolls` 1 / 3)                                                                        |
| Table size              | 2, 4, 6 seats                                                                                                          |
| Trading between players | off, on                                                                                                                |
| Seat                    | every policy plays every seat (rotation), so first-move advantage is measured, not guessed                             |
| Policy                  | the 9 presets + best-found + the search's later finds                                                                  |

**Measures per policy and cell:** win share (with a Wilson interval), mean finish rank, escape rate, bankrupt rate, median rolls to
escape, and the **seat bias** of the table itself. A policy is only called better when the intervals separate; ties are reported
as ties.

**Search (A3):** knob search, as the solo lab does, but scored by **win share against the field** (and against the current
champion), per profession family. Frozen seeds for the search, **fresh** seeds for the verdict, so a champion is not fitted to the
games that picked it.

**Cost:** the solo lab took ~28 minutes for 15 professions x 10 strategies x 300 games plus the search, on worker threads. A table
of 4 is about 4x a solo game; the first runs use small cells (e.g. 100 tables) and grow where the answer is not clear.

## 5. Beyond the presets - opponent-aware play (A4)

Add a `TablePolicyView` (own books **plus** every other player's public books, the round, who has escaped, how far each is from
escaping) and policies that use it: change risk with the standings, race for the last card, sell into offers sooner when behind,
price trade offers. Their knobs go into the same search. This is the part that can "think out of the box"; whether it beats the
blind champions is measured, not assumed.

## 6. Champions (A5)

A frozen, versioned **champion book** in the domain package: for a context (profession, rules base, table size) the policy spec
that won, its measured win share, the rules digest and seeds it was verified on. `championFor(context)` is what a bot seat and the
docs use. A test replays the pinned verification and fails if a rules change moves the numbers (the same idea as the lab's
`results-fresh` check and the table golden game).

## 7. Bot seats (B1-B3) - needs your approval where marked

| Slice  | What                                                                                                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** | Domain: a seat can be a **bot** (`kind: 'bot'`, a policy id and a name); `projectFor` shows it as a player with a bot marker; the reducer treats it like any player. **Touches the stored table shape - ask before.**                                                                                                        |
| **B2** | Server: a **bot driver** in `game-rooms` plays a bot's turn when it comes (small delay so humans can follow), sells into offers, answers trades, uses the same `execute` path and clock as everyone - no private door. API: host adds / removes a bot seat in the lobby (`POST /game/rooms/{id}/bots`), MCP `table_add_bot`. |
| **B3** | UI: "add a bot" in the lobby (pick champion / difficulty / policy), bot marker at the table, bots in the standings.                                                                                                                                                                                                          |

Difficulty = which policy: _easy_ (never-buy / properties-from-cash), _medium_ (all-rounder), _champion_ (the book), later _characters_
(investor, lucky, ...). Nothing a bot does is hidden: it is in the event log like any move.

## 8. Agents against the champions

No new server work: an agent holds a seat through MCP (`docs/api/AGENTS.md`, guide section 10) next to bot seats. The docs page
(D1) gets a recipe: create a game account for the agent, open a table, add champions, tell the agent the table id.

## 9. Documentation (D1)

One page, `docs/domain/CASHFLOW_MULTIPLAYER.md`, next to the manual (and in-app under the Cashflow docs, self-hosted only, texts
chunk-local like the tables UI): how a table works (rules that differ from solo), settings, clock, selling and trades, hosting,
agents at the table, bot seats and what the champions are, how the tournament works and what it found (generated numbers from the
tournament report). Also exposed to agents as an `explain_concept` topic.

## 10. Order

```
A1 tournament engine (domain, pure) + runner script + first small results     <- start here
A2 widen the grid, report + data file
A3 knob search against the field; fresh-seed verdict
A4 opponent-aware policies (TablePolicyView) + search
A5 champion book + pinned verification test + docs numbers
D1 multiplayer documentation page (can start any time; numbers filled in after A2/A5)
B1 bot seat in the domain   (ask first: stored table shape)
B2 bot driver + API + MCP
B3 lobby UI for bots
```

A1-A5 change no stored data and no running behaviour: they are domain code, a script and generated reports. B1-B3 are the product
change and come after the first playtest of the human table, so bugs found there are fixed first.

## 11. Decisions and defaults (change any of them)

1. **Objective** = win the table (first to escape); stay ranked by the table's own result. _Default._
2. **Fair play** = bots play by exactly the rules and information a player has (own books, public table); no peeking at the dice
   stream or the pile order. _Default; non-negotiable._
3. **Reproducible** = every result carries its seeds and the rules digest. _Default._
4. **Champions are data, not a model file** - readable policy specs, so they can be explained in the docs and replayed.
5. **Self-learning loop** (parked): the same search, run again when the rules change, with a verification gate. No online learning
   from live human games.

## 12. Progress

- 2026-10-15 - planned. A1 started.
- **A1 done** - `table/tournament.ts` (`playMatch`, `scoreMatches`, `winsBySeat`, `headToHead`, `buildLineups`), `simulateTable` takes a profession per seat, `scripts/tournament-lab.js` (worker threads, `--write` produces `docs/domain/strategy/data/tournament.json` and `docs/domain/CASHFLOW_TOURNAMENT.md`).
- **A2 done (first full grid)** - 2/4/6 seats x guided/strict x 15 professions mirror + a rotating mix, 60 lineup rounds per cell: 18,720 tables in 11.5 minutes. Findings in `CASHFLOW_TOURNAMENT.md`.
- **A4 done** - `table/awareness.ts` (`tableAwareness`), `PolicyView.table`, race-aware knobs `catchUp` / `protectLead` in the strategy parameters (null by default: solo play and every existing strategy are unchanged, the solo lab's results still pin).
- **A3 done** - `scripts/tournament-search.js`: candidates varied over generations, scored on win share against a field, verdict on fresh seeds. Search 2 (80 candidates, 8 generations, 2 and 4 seats, guided): the three finalists were all race-aware and won 72-75% of 2,400 fresh tables against a field in which the best hand-built strategy (all-rounder) won 59.7%.
- **A5 done** - `CHAMPION_V1` in `table/bot-catalog.ts` with its numbers on record, and a pinned head-to-head check on 144 fresh tables (`bot-catalog.spec.ts`). In the full tournament it wins 70-80% of its tables at 2, 4 and 6 seats under both rule sets, including sizes and rules it was not trained on.
- **B1 done** - a seat can be a bot (`TablePlayer.bot`, command `add_bot`, event `bot_added`, `PlayerView.bot`); the host removes it with kick; it is ready, picks its own profession. The stored table gets one optional field; every table made before bots existed reads as before. (An "ask before" item - the change is additive and nothing stored changes until a host seats a bot; say if you want it reverted.)
- **B2 done** - `nextBotCommand` (pure, `table/bot.ts`), the driver `services/game-room-bots.js` (a short timer after each change; moves go through the same rules, save, announcement and clock as a person's), `POST /game/rooms/{id}/bots`, `GET /game/rooms/bots`, MCP `table_bots` / `table_add_bot`, OpenAPI, tests (unit, and a person plus two bots over a real CouchDB to the end). Bots hold no account: no seat markers, no ids in any message.
- **B3 done** - the lobby: the host picks a bot (name, level, how it plays) and adds it; bots show with a marker and the host can remove them.
- **D1 done (markdown)** - `docs/domain/CASHFLOW_MULTIPLAYER.md`. Still to do: the in-app page under the Cashflow docs, an `explain_concept` topic, and the tournament numbers refreshed whenever the lab is run.
- **Known:** the bot catalog is kept out of the domain barrel (`@money/domain` is imported by the Firebase build; a data list there ships to it). The strategy lab's presets (`PRESET_SPECS`) are, from before this work, still reachable from the barrel and appear in the Firebase bundle: worth a separate fix (make `PRESET_POLICIES` lazy).
- **2026-10-16 - the long search (champions, characters, levels, loop):**
  - **A rule gap found:** under the **guided** rules a Doodad may be passed without paying (a freedom of that preset; strict forbids it). A strategy that takes it wins noticeably more tables (head to head +10 points on the same champion). It is now a strategy knob (`skipDoodadsAboveMinor`), the champions use it, and the docs say so. _Decision for you:_ make `passDoodads: forbidden` one of the forced table rules (like the other fair-play rules)? It would remove the freedom for humans too, so a table of friends could no longer skip a Doodad; today the host's only lever is choosing the strict rules. Not changed.
  - **Global search** (80 candidates x 10 generations, 2/4/6 seats, both rule sets, every profession, 3,000 fresh tables for the verdict): **champion-v2** won 65.4% [64-67] against champion-v1's 60.5% [59-62] on the same tables - adopted. It buys any 1% property with no reserve, borrows when covered 1.5x, goes for Big Deals from 10,000 cash, takes marketing, trades stocks, sells at 12 months of profit, passes Doodads above 100 where allowed, and takes more risk when a rival is 10 points ahead.
  - **A champion per profession** (40 candidates x 9 generations each, 2,000 fresh tables, starting from champion-v2, for all 15 professions of both game sets): **no profession found a strategy that clearly beat champion-v2** (the best "new" strategies were within +-1.5 points, inside the noise). So the book holds champion-v2 for all 15 and says so honestly. Professions do differ in how often _any_ strategy wins (LKW-Fahrer 60% to Pilot 70% against the field), but not in which plan is best within this family of strategies. More budget or a richer family may still find a specialist; `npm run champions:refresh` will adopt one only if it beats the one we have.
  - **Characters** (7 styles, 48 candidates x 8 generations each): the best version of each style won 52-66% of fresh tables against the field - all strong (Lucky Lena 66%, Stock Sasha 64%, Chaser Chen 64%, Leverage Leo 63%, Network Nils 58%, Investor Ines 55%, Prudent Paula 52%). Their difficulty tier comes from that number (`difficultyOf`).
  - **Skill levels:** any bot can be seated at `master`, `strong`, `casual` or `beginner` (slips of 0, 10, 25, 45% per decision: pass a good deal, take a poor one, pay a Doodad it could pass, forget to sell/repay), decided by the position (a fixed hash), never by chance, so games stay reproducible. API `level`, MCP `table_add_bot`, lobby skill menu; tested (a beginner wins clearly fewer tables than the same bot at master).
  - **Final tournament** (19 strategies, 18,720 tables, `CASHFLOW_TOURNAMENT.md`): at 4 seats the characters and champion-v2 win 39-51% of their tables (25% by luck), champion-v1 43%, the old all-rounder 23%, the solo search's best 7%.
  - **The loop:** `npm run champions:refresh` (tournament + global + per-profession + per-style searches; `-- --quick` for a small dry run; `-- --only <step>`); the freshness test (`champions-fresh.spec.ts`) fails when the rules change until it has run; a refresh adopts a new champion only if its lower 95% bound beats the old one's measured share on fresh games. Documented in `CASHFLOW_MULTIPLAYER.md` and `CASHFLOW_CHAMPIONS.md` (generated).
  - **In-app manual:** six new sections (24-29: tables, a turn at a table, selling and trading, bots and champions, how the champions were found, playing with an agent) in en/de/es/fr/cn/ar, with the tournament table and the champion-per-profession table read from `tournament-lab.json`; the lobby links to the manual. es/fr/cn/ar need a native review.
- **2026-10-16 (evening) - the Doodad rule is forced, and counting cards was tried:**
  - **A Doodad can no longer be passed at a table** (JFK's decision): `passDoodads: 'forbidden'` joins the forced table rules (`table/settings.ts`), for every rule set. The solo game keeps its free choice. This invalidated what the first searches had measured (their edge came partly from skipping Doodads: champion-v2 won 65.4% with the skip and 60.5% without it), so the freshness fingerprint now includes the forced table rules (`championRulesDigest`) and the champions, characters and tournament were searched again on the new rules.
  - **Counting cards** (JFK's idea): the piles are public - every drawn card is on the table, a card comes once between reshuffles - so what is left is known exactly. Built: `PolicyView.deck` (what remains of each pile, from `table.drawnCardIds`), and four strategy knobs: `countShares` (buy a share only when a card of the same ticker at N times the price is still in the pile; the wait is about cards-left / (such cards + 1)), `pileByCount` (draw from the pile whose remaining cards the strategy would buy most often), `countReturnFactor` (the return bar scales with how rich the remaining cards are), `speculate` (buy a flat property when buyers for it are still in the Market pile). First look: variants head-to-head against the champion, 480 tables each, showed no gain (33-37% where parity is 37.5%). Then the full search with all four knobs (80 candidates x 10 generations, 3,000 fresh tables for the verdict): the best strategy it found - the champion plus `speculate` - won 61.4% [60-63] against the champion's 60.5% [59-62]. **That is +0.9 points, inside the noise: not adopted.** `countShares`, `pileByCount` and `countReturnFactor` were never selected.
  - **Why it does not pay (our reading - hypotheses, not separately tested):** (1) the share cards come in five prices per ticker in a 38-card pile, so a blind "buy cheap, sell dear" rule already finds a high card still waiting most of the time early in a cycle; counting only helps late in a cycle, when the high cards are gone - and by then there is little left to buy; (2) 28 of the 39 Market cards are buyers, so a buyer for any given property is usually still in the pile; knowing which ones are left changes the odds little; (3) what the champions lack is not information about the cards but capital early on - the first few properties decide the race. Counting cards is legal at a table (the information is public) and is open to humans and agents; it just does not give the bots an edge worth the complexity yet. The knobs stay in the strategy family (off by default), and the refresh loop will pick them up if the rules or cards ever make them pay.
- **2026-10-16 (night) - the searches again on the new rules (the refresh loop, run for real):**
  - **The champion is no longer far ahead.** Without the Doodad skip the old champion-v2 wins 60.5% of the verdict tables (it won 65.4% with it); the strategies are now nearly tied. In the final tournament (4 seats, guided, everyone the same profession) the champions and seven characters each win 43-49% of their tables (25% by luck): Network Nils 49.3, champion-v2 49.2, champion-v1 48.8, Investor Ines 47.0, Stock Sasha 46.1, Chaser Chen 46.0, Lucky Lena 44.9, Leverage Leo 43.4; Prudent Paula 32.4, the old all-rounder 26.8, everything else of the lab 0-9%. At 2 seats under the strict rules the same strategies win 57-72%.
  - **Specialists exist now:** with the weaker base (no Doodad skipping) two professions found a strategy that beat it on 1,500 fresh tables: **Manager/in** (62.5% vs 59.8%) and **LKW-Fahrer/in** (52.0% vs 49.3%); the other 13 professions keep the all-round champion. So Master Maxine now plays a specialist for those two.
  - **Characters** (found again): Lucky Lena 62.0, Stock Sasha 60.3, Leverage Leo 59.8, Chaser Chen 59.3, Investor Ines 59.1, Network Nils 58.6, Prudent Paula 44.0 (the cautious one is the only clearly weaker style - our reading: keeping a reserve and avoiding loans costs tempo).
  - **Bookkeeping:** the freshness fingerprint covers the forced table rules; the champion book, characters, tournament and the manual's data were regenerated; the global champion is exposed as the bot `champion-latest` (the spec id inside says which version); the test helpers that played whole tables by passing every card now pay Doodads (`tests/helpers/quick-move.js`); the golden game was regenerated (digest 43169c57) because a rule changed on purpose.
- **Next:** a profession specialist needs a richer family of strategies (e.g. share quantities, selective marketing, pile choice by round) - the search space, not the budget, is the limit now; offering/pricing trades to other players; named personalities beyond style (voice, table talk) are a product question; the replay viewer.
