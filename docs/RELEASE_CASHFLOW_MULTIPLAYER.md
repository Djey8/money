# Release: Cashflow multiplayer, the leaderboard and profile pictures

For the self-hosted Raspberry Pi stack. The Firebase edition is not touched by any of this (checked: its build contains none of it).
Nothing below is run for you: it is the order of things to do, with the commands.

## What ships

- Online Cashflow tables for game accounts: lobby, add-table panel, bots at four skill levels (with their rating), a clock, the game
  played in the solo game's own screen, undo vote, resign, rejoin, autoplay while away, saved games.
- The leaderboard: pairwise rating per finished table that counts, bot start ratings, player cards with a rating chart, a chapter
  "Scoring and the leaderboard" in the in-app manual (six languages).
- Choosable token initials; a profile picture (any self-hosted account) in Settings > Edit profile, on the toolbar and the leaderboard.
- The Cashflow entry of the menu says **Solo** or **Cashflow Game** by what is loaded.
- Pro API / MCP: tables, bots with ratings, the leaderboard, `pay_market`, `away`, `initials`.

A normal account sees none of the game: the table routes answer 403 for it, the menu entry is for game accounts only, and the normal
pages read and write their own account exactly as before.

## Storage and capacity (Raspberry Pi 4, 4 GB, SSD)

| What                        | Size                                                                           | Notes                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| A table in play             | 0.5 - 1.2 MB live                                                              | room document 145 KB (550 KB for a late 5-player game) + 2 snapshots of 160 KB + about 440 bytes per event     |
| Revisions before compaction | up to 10 - 30 MB per long game, written to disk move by move                   | CouchDB compacts by itself (smoosh, on by default); measured 14 MB file for 9 MB live                          |
| A finished table            | deleted after 7 days unless someone saved it to their games                    | `GAME_ROOMS_RETENTION_MS`; idle lobby 1 day, idle game 7 days                                                  |
| Limits that bound the total | 3 hosted + 5 seated tables per account, 200 open tables, 5 streams per account | at the limits: 200 x 1.2 MB = about 240 MB live. The data volume is 5 Gi (`k8s/couchdb.yaml`)                  |
| Leaderboard                 | profile 1 KB, result 2 KB per counted table, kept for good                     | 77 bot profiles; 1,000 counted games = about 2 MB                                                              |
| A profile picture           | 10 - 25 KB (limit 150 KB) in the account's document                            | only for accounts that set one; its document is read with every data read of that account                      |
| Memory                      | backend limit 768 Mi, CouchDB 1 Gi (unchanged)                                 | table clocks, the bot timer and the live streams are in the backend's memory, one timer per table being played |

Backups need no change: the CronJobs back up `_all_dbs`, so `gamerooms`, `gamesaves` and `gamestats` are in them automatically. An
open table is a lot of churn for the hourly backup (the room document changes every move); the daily job skips when nothing changed.

Watch after the first week: `kubectl exec -n money-app couchdb-0 -- df -h /opt/couchdb/data` and the per-database sizes (command below).
If `gamerooms` stays far above its live size, run a compaction by hand (command below).

## Before deploying

1. The checks (all green on 2026-10-18, see the end of this file): `npm run verify`, the backend integration suites against a real
   CouchDB, the MCP integration suite, the self-hosted and the Firebase builds, the edition guard.
2. A backup you can restore: `./scripts/backup.sh` on the Pi (or let the hourly one run), and look at `./scripts/list-backups.sh`.
3. `ADMIN_EMAILS` is already in `backend-secret`; nothing new has to be set. Optional overrides (all have defaults):
   `GAME_ROOMS_MAX_HOSTED`, `GAME_ROOMS_MAX_SEATED`, `GAME_ROOMS_MAX_OPEN`, `GAME_ROOMS_RETENTION_MS`, `CASHFLOW_GAME_PASSWORD_SHA256`.
4. The branch to deploy is `develop` as it is committed. Pushing to `main` starts the Firebase auto-release (a `feat` or `fix` commit
   deploys it live): do that only when you mean to. The Pi is deployed from the checkout on the Pi, not from GitHub Actions.

## Deploying on the Pi

```bash
cd ~/money            # the checkout on the Pi
git pull              # the branch you are releasing
./scripts/deploy.sh --prd            # fresh build, no logging stack (see docs/DEPLOYMENT.md for the flags)
```

The new databases (`gamerooms`, `gamesaves`, `gamestats`) are created by the backend when it starts; nothing is migrated in place.
Rebuild the **MCP** image too (it gained tools): the same script does.

## Getting the bots into the app

There is no script to run: the backend makes every bot's profile when it starts (`seedBots`, safe to repeat) at its measured start
rating, and finishes anything a crash left half recorded (`repair`). Check it:

```bash
kubectl logs -n money-app deploy/backend | grep "Leaderboard ready"
#  ... Leaderboard ready {"botsMade":77,"repaired":0}      (0 on every later start)

# the bots a host can seat, with their ratings (as a game account):
curl -s -b cookies.txt https://<your-host>/api/v1/game/rooms/bots | head -c 400

# how many bot profiles exist
kubectl exec -n money-app couchdb-0 -- sh -c 'curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" -X POST localhost:5984/gamestats/_find -H "content-type: application/json" -d "{\"selector\":{\"kind\":\"profile\",\"type\":\"bot\"},\"fields\":[\"_id\"],\"limit\":500}"' | grep -o '"_id"' | wc -l
```

A bot shows on the leaderboard only after its first rated game; before that its rating is visible in the _Add a bot_ menu.

Optional, once, after the backup (moves saved games from before 2026-10-10 out of the account document; the app does it for an
account on its first saved-games request anyway):

```bash
kubectl exec -n money-app deploy/backend -- node cli/mm-admin.js migrate-game-saves --all
```

If you want the bot start ratings measured again (after a change of the rules or the bots; not needed for this release, the new
ranking only changes the order of the players who did not escape): `node scripts/calibrate-bot-ratings.js --tables 400 --write` on
a development machine, commit `bot-ratings.ts`, deploy again.

## After deploying: the smoke test (15 minutes)

1. `curl https://<host>/health` answers `ok`; the backend log has no errors.
2. A normal account: log in, the app is as before, `/#/tables` says game accounts only.
3. Your game account: Multiplayer opens; **+** opens New table; open one with 3 seats, add two bots, start, play a few turns.
4. Open the same table in a second browser (another game account): it sees your moves live. Reload the page mid-game: it comes back.
5. Leave the stream open for ten minutes with no move: it stays connected (checks Traefik / Cloudflare timeouts; the server sends a
   ping every 25 s).
6. `todo/cashflow-multiplayer-playtest.md`, section "Since 2026-10-18".
7. Storage after your test games:

```bash
kubectl exec -n money-app couchdb-0 -- sh -c 'for d in gamerooms gamesaves gamestats users; do echo $d; curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" localhost:5984/$d | grep -o "\"sizes\":{[^}]*}"; done'
# compact one by hand if its file is much bigger than its active size:
kubectl exec -n money-app couchdb-0 -- sh -c 'curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" -X POST localhost:5984/gamerooms/_compact -H "content-type: application/json"'
```

## Rolling back

The release adds databases and one optional field (`picture`) and changes no existing document or path, so the previous version
runs on the same data: `git checkout <previous tag>` and `./scripts/deploy.sh --prd`. The new databases are simply not used. To go
back to the data from before, restore the backup with `./scripts/restore-backup.sh`.

## Known gaps, on purpose

- The old table page (spectators) still contains the earlier play screen: clean-up is R4 in `todo/cashflow-multiplayer-solo-ui.md`.
- Edits to a game's transactions in strict rules have no table command yet (they are refused).
- es / fr / cn / ar wording (the table texts and the scoring chapter) is waiting for a native review.
- The rating is not yet tuned on real games (L6 in `todo/cashflow-leaderboard.md`).
- No admin screen: cleaning tables and data is a CouchDB / CLI job until `todo/admin-console.md` is built.

## What was checked (2026-10-18)

- `npm run verify` (domain 1219, MCP unit 115, lint, format, typecheck, frontend 1757, backend lint + format + unit 901): green.
- Backend integration suites against a real CouchDB (24 suites, 566 tests) and the MCP integration suite (4): green.
- Self-hosted and Firebase builds: both compile.
- **Edition guard** found the Cashflow card catalog inside the Firebase bundle (it came in with the table engine on 2026-10-15, through
  the CommonJS domain package). Fixed in this release (ADR-0004, last paragraph); the rebuilt Firebase bundle has none of
  `classic-small-`, `OK4U`, the table routes, the leaderboard or the profile picture. Two harmless strings remain, both older than
  this work: the OCR URL `ocr.asprise.com/api/v1/receipt` (excluded by the guard) and the path `assets/i18n/cashflow-cards/` in the card
  text service (the folder itself is not in that build).
