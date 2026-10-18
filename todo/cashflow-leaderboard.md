# Cashflow leaderboard, player profiles, bot personas and scoring — plan

Status: **L0-L5 built 2026-10-17 (uncommitted on `develop`, not deployed); L6 (tuning after real games) open.** Decisions of JFK 2026-10-17; concrete design 2026-10-17 (this file).
Built: `ranked` setting + one bot per persona/level + nickname from the account (L0); `table/rating.ts` + `bot-ratings.ts` (calibrated from 150 tables per bot, rerun `node scripts/calibrate-bot-ratings.js --tables 400 --write` for less noise) (L1); `gamestats` DB, recorder, repair, rebuild, seeding of 76 bot profiles at startup (L2); `GET /game/leaderboard`, `/game/players/me`, `/game/players/{id}`, `rating` on a finished room, MCP actions (L3); lobby leaderboard card, ranked checkbox/badge, rating line in the game-over panel (L4); nickname rename pass (profile + table seats) and account-deletion handling (L5). Not built: the rename script for old data (not needed yet), a ranked badge inside the table room, seasons, uncertainty-based rating. Self-hosted Pro only: nothing of this
enters the Firebase build (ADR-0004: conditional route array on `environment.edition`, never a runtime `*ngIf`). It touches only game accounts
and the `gamerooms`/`gamesaves` world; a normal account is unaffected (same hard rule as multiplayer, ADR-0010).

## 1. Decisions already made

1. One bot profile per **persona plus level** ("Allie All-Round · master" and "· beginner" are two profiles on the board).
2. A persona+level sits at a table **once**.
3. Scoring depends on the field (humans vs bots, bot strength, table size); farming against easy bots earns almost nothing; a strong
   bot earns less than a weak one when it wins. A **ranked flag** per table; unranked games keep their statistics.
4. Raw result records, derived counters; re-scoring possible later.
5. Counters per profile: played, won, lost, gave up, bankruptcies, escaped, best/average place.
6. One name per account = the **nickname**, used at every table (no per-table name). Changing it changes it everywhere. Duplicates allowed.
   Identity is an id, never the name.
7. Self-hosted only.

## 2. Identity

- Accounts have ids `user_<timestamp>_<random>` — unique, but not UUIDs, and the API never shows them. The board gets its own public
  **`playerId` (UUIDv4)** per profile.
- **Humans:** profile created lazily on a first ranked/unranked finished game (or first join); `accountId` stored privately on the profile
  (Mango index), never returned by any endpoint.
- **Bots:** `playerId = uuidv5(NAMESPACE, "bot:<policyId>:<level>")` — deterministic, so seeding is idempotent and identical on every
  environment, and the recorder maps a bot seat to its profile without a lookup.
- **Bots are profiles, not login accounts** (recommended, confirm): no password, no PAT, not in user counts/admin lists/quotas/login flows. To the
  board they look exactly like users (name, rating, record, place). If a real account per bot is wanted later, a profile can be pointed at one.
- `displayName`: humans = the account nickname (`username`, see §8); bots = persona name + level, e.g. "Allie All-Round (master)".

## 3. Data model — new CouchDB database `gamestats` (ASK JFK before creating: storage schema)

Documents (all additive; no existing path changes):

```
profile:<playerId>   { kind:'profile', playerId, type:'human'|'bot', accountId?, botKey?: 'policyId:level',
                       displayName, visible (humans opt in; bots always), createdAt,
                       rating, ratingGames, peakRating,
                       counters:{ played, rankedPlayed, wins, losses, gaveUp, bankruptcies, escaped, rankSum, bestRank },
                       lastResultAt, updatedAt }
result:<tableId>     { kind:'result', tableId, endedAt, reason, rounds, ranked, rankedWhy,        // immutable, written once
                       settings:{ rulesBase, endCondition, clockMode, pace, seats, humans, bots },
                       participants:[{ playerId, type, level?, seat, rank, outcome, professionId,
                                       passiveIncomeMinor, monthlyCashflowMinor,
                                       ratingBefore, ratingAfter, delta, weight }],
                       scoringVersion, applied:boolean }
```

- **Idempotent by id:** `result:<tableId>` is created with a conflict check; a second record of the same table is a no-op.
- **Order of writes (no multi-doc transactions in CouchDB):** (1) compute from the table + current profiles, (2) create the result
  (`applied:false`), (3) update each profile with revision retry, (4) mark the result `applied:true`. A repair pass on startup
  re-applies results with `applied:false`. A `rebuild` command recomputes every profile from the result records (the records are the truth).
- One backend replica today: an in-process queue serialises recording; the repair pass makes a crash harmless.
- Profile docs stay small (~1 KB); results ~2 KB. The rating history of a player is derived from results (`participants` by `playerId`),
  not stored on the profile.

## 4. Recording

Hook: where a table becomes `finished`/`abandoned` in `services/game-rooms.js` (the same place `persist` publishes the final events) — call
`stats.record(doc)` after the room is saved, never blocking or failing the game. Input: `table.result.ranking` (rank, outcome, passive
income, cashflow), players (human/bot, policy, level), settings, round count.

Counters per participant: played; win = rank 1 at a finished table; loss = anything else; gaveUp = outcome `left` (resigned/left after
the game started); bankruptcies = outcome `bankrupt`; escaped = outcome `escaped`. `rankSum/played` gives the average place.

Rooms stay as they are (finished tables somebody saved are already kept, 2026-10-17); the result record is independent of the room.

## 5. Ranked games

- Table setting `ranked: boolean`, default **true**, fixed once the table starts, shown in the lobby and on the table.
- A game **counts for rating** only if all hold (`rankedWhy` records the first that fails, so a player can see why):
  1. the host left `ranked` on;
  2. the game **finished** (not `abandoned`/closed by the host or idle);
  3. at least **one human** and at least **two seats**; a table with no human gives statistics only (bot-vs-bot never moves the board);
  4. the table reached a **minimum length**: at least 8 table rounds, or someone escaped;
  5. rules are not custom-weakened: `rulesBase: strict` or guided, forced rules in force (the table engine already forces them).
- Unranked or ineligible games still write a result record and update the **statistics counters** (marked `rankedPlayed` only when ranked),
  just not the rating.

## 6. Scoring — pairwise Elo, one table = n·(n−1)/2 duels

Starting point (v1); fully re-scorable from result records, `scoringVersion` is stored.

- Each participant has a rating `R` (start 1500 for humans; bots start from calibration, §7).
- For every pair (i, j) at the table: `S_ij` = 1 if i placed better, 0 if worse, 0.5 if tied (e.g. both bankrupt);
  `E_ij = 1 / (1 + 10^((R_j − R_i)/400))`.
- Change for i: `Δ_i = K_i · F · (Σ_j w_j · (S_ij − E_ij)) / (n − 1)`.
  - **Field strength is automatic:** beating a 1300 beginner when you are 1700 gives `E≈0.85`, so almost nothing; beating a 1900
    champion gives a lot. That is the rule "a strong bot gives less than a weak bot on winning", from the maths, not a table of special cases.
  - `K_i`: **40** for a human's first 20 rated games (provisional), then **24**; bots **8** (a bot plays thousands of games; a slow K keeps
    the board stable).
  - **Human share factor** `F = 0.4 + 0.6 · (humans − 1)/(n − 1)` (clamped, one human among bots 0.4, an all-human table 1.0): the
    "a lobby of six real players is worth more than bots" rule. Applied to gains and losses alike.
  - `w_j`: the weight of opponent j — 1 normally; **0.5** when j left/was bankrupted early and so was "beaten" without a contest;
    diminishing for **repeated lineups** (the same set of humans meeting again within 24 h: `1/(1+k)` for the k-th game) — the anti-collusion
    rule; **0.25** for a beginner-level bot opponent (the explicit farming cap on top of the maths).
  - A player who **gives up** is ranked last at the table for the duels they take part in (a loss), but only if they leave after round 3,
    so leaving a lobby or a doomed start costs nothing and nobody is punished by a host closing the table.
- **Display:** the rating shows after 5 rated games (before: "provisional"); the board sorts by rating, ties by games.
- Zero-sum is not required (bots K=8 drift slowly); property tests keep it bounded: total Δ at a table is small, a win never lowers the rating,
  a loss never raises it, a tie between equals changes nothing.

**Scoring v2 (JFK, 2026-10-18, before the first production release):** those still playing when a game ends are placed by their
**escape progress** - passive income over all monthly expenses (loan payments included) - and only then by passive income and
monthly cashflow (`rankPlayers`, `closerToEscape`; `RATING_VERSION` 2; `expensesMinor` is kept on the standing and in the result
record). That is what makes a profession with big expenses and a player who borrowed comparable; no separate profession weight is
needed. Deliberately not scored: the number of rounds a win took (an earlier escape already places higher), cash on hand (the goal
is income). The exact rules are documented for players in the in-app Cashflow manual, section "Scoring and the leaderboard".

Later versions (not v1): margin of victory (passive-income gap), per-profession difficulty, seasons with soft reset, rating uncertainty
(Glicko/TrueSkill σ), separate boards per table size or clock mode.

## 7. Bot personas — calibration and seeding

- Catalog today: 18 personas × 4 levels (`master|strong|casual|beginner`; the level is the share of deliberate mistakes). Profile per
  persona+level, created at startup if missing (idempotent upsert by deterministic `playerId`).
- **Initial ratings come from measurement, not guesses:** a calibration script (`scripts/calibrate-bot-ratings`) plays each persona+level in
  2,000 simulated 4-seat tables (`simulateTable`, as in the tournament) against a reference field and converts the win share `p` to a rating:
  `R = 1500 + 400·log10( (p/(1−p)) / (1/3) )` (25% is par at four seats), floored at 1000, capped at 2200. Results go in
  `packages/domain/src/cashflow-game/table/bot-ratings.ts` (versioned, with the measuring commit) and in `docs/domain/CASHFLOW_BOT_RATINGS.md`.
  From the tournament the order is already clear: champions/characters ≈ 43–49% (≈ 1650–1700), Prudent Paula 32%, the old all-rounder 27%,
  a bot that never invests 0% (floor).
- Profiles are shown on the board once they have a **rated game**, so the 72 combinations don't clutter an empty board.
- **One persona+level per table:** the domain `add_bot` rejects a second identical `policyId+level` at the same table (`bot_duplicate`), the
  lobby hides what is already seated, the MCP `table_add_bot` surfaces the error. (Today the host can seat the same bot twice.)

## 8. Nickname = the one name

- Join and create take the name from the account (`username` in the users database; `hasCustomUsername` already exists). The client
  `nickname` parameter becomes optional and **ignored**, kept in the API and MCP for compatibility; the lobby's name field is removed.
- Changing the nickname (the existing profile update) triggers a **rename pass**: the human profile's `displayName`; seat names in open
  tables and in kept finished tables (the table's `players[].name`); nothing in result records or saved-game summaries needs rewriting —
  they hold `playerId`s, not names. A one-off `scripts/rename-references.js <accountId>` (dry run first) fixes older data.
- Nickname rules: 1–24 characters, trimmed, no control characters; duplicates allowed (disambiguation on the board by a short id suffix only
  if two visible rows share a name).
- Account deletion: the profile keeps its counters but loses `accountId`, `displayName` becomes "Deleted player"; result records stay
  (other players' ratings depend on them).

## 9. API and MCP (game accounts only, scopes `game:r`/`game:w`)

- `GET /api/v1/game/leaderboard?type=all|human|bot&ranked=true&minGames=5&limit=50&after=…` → items `{place, playerId, name, type,
level?, rating, provisional, games, wins, winRate, avgPlace}`.
- `GET /api/v1/game/players/{playerId}` → profile counters + last 20 results (table name, date, place, ranked, delta).
- `GET /api/v1/game/players/me` and `PUT /api/v1/game/players/me {visible}` (humans opt in to being listed; default **off**, so a profile
  exists but is not shown until the player says yes; bots always visible).
- `GET /api/v1/game/rooms/{id}` already carries the table result; add `rating: { ranked, rankedWhy, changes:[{seat, before, after}] }` once
  recorded (so the finished panel can say "ranked: 1520 → 1534 (+14)" or "not ranked: only one human").
- OpenAPI first (mm-add-api-endpoint skill), then MCP `get_cashflow_game` actions `leaderboard` and `player`; AGENTS.md section.
- Pagination: cursor on `(rating desc, playerId)`; a CouchDB Mango index on `kind, type, visible, rating`.

## 10. UI (self-hosted game route only)

- Lobby gets a "Leaderboard" tab: filters (all/human/bot, ranked), a player row opens the profile (counters, recent results, a small
  rating line from results). Tables shown in the lobby carry a "Ranked" badge; the create form gets the ranked checkbox (default on, with the
  one-line explanation of when it counts).
- Game-over panel (already in the dashboard): add the rating line from §9; bot rows link to their profile.
- Settings: "Show me on the leaderboard" switch; the nickname lives in the account profile (the lobby no longer asks).
- All new strings in the six languages; tables never scroll sideways (standing rule).

## 11. Phases (each one small, one concern per commit, tests with it)

| Phase | What                                                                                                                                                  | Needs JFK's OK first                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| L0    | ADR-0011 (this design condensed), `ranked` table setting, `bot_duplicate` rule, nickname-from-account for join/create (field removed from lobby)      | the `ranked` default; ignoring `nickname`  |
| L1    | Scoring module in `packages/domain` (pure, property-tested), `bot-ratings.ts`, calibration script, doc                                                | —                                          |
| L2    | `gamestats` DB, repository, recorder with hook, repair pass, `rebuild`, profiles for humans/bots, seeding                                             | **new database / schema**; production seed |
| L3    | API + OpenAPI + MCP + AGENTS.md + integration tests (idempotency, crash repair, cross-user isolation, normal account untouched, Firebase build guard) | —                                          |
| L4    | UI: leaderboard, profile, ranked badge, rating line, opt-in switch                                                                                    | —                                          |
| L5    | Rename pass + script, account-deletion handling (no backfill: decision 8)                                                                             | running the script against production data |
| L6    | Tuning after real games: K values, factors, minimum length; seasons; anti-collusion review                                                            | —                                          |

Verification for every phase: targeted tests while iterating; before shipping `npm run verify`, `edition-guard` (no leaderboard code in the
Firebase build), the integration suites (real CouchDB via podman), and a local-stack playthrough with bots and a human.

## 12. Final decisions (JFK, 2026-10-17)

| #   | Question                          | Decision                                                                                                 |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `ranked` default for a new table  | **On**; the eligibility rules of §5 decide what really counts                                            |
| 2   | Humans on the public board        | **Opt-in, default off**; bots always listed                                                              |
| 3   | Bot ratings                       | **Move slowly (K=8)** from a measured start                                                              |
| 4   | Bot identity                      | **Profile only**, no login account (revisit later if bots need account features)                         |
| 5   | Provisional threshold             | **5 rated games** (K=40 for the first 20, then 24)                                                       |
| 6   | Farming rule against easy bots    | **Maths plus cap**: Elo expectation, x0.25 weight on beginner bots, x0.4 factor for one human among bots |
| 7   | Minimum length / leaving          | **8 rounds** (or an escape); leaving after round 3 is a loss, earlier costs nothing                      |
| 8   | Games finished before the feature | **Start fresh**: no backfill, only games finished after it ships count                                   |

Also settled earlier: one persona+level per bot profile, one seat per persona+level per table, one name per account (the nickname,
renamed everywhere), duplicates allowed, self-hosted only, bots visible once they have a rated game, new humans start at 1500.
Phase L5 therefore has no backfill (rename pass and account-deletion handling only).
