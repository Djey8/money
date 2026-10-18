# Admin console — plan for the next release

Status: **planned, not started** (JFK, 2026-10-18: "I want to be able to clean with my UI lobbies and data that is maybe not needed ... manage stuff that I did not manage and other users can't").
Self-hosted only, like the Cashflow multiplayer it manages: it ships as its own route file swapped in by `fileReplacements`
(`docs/adr/0004`), never a runtime `*ngIf`, and nothing of it is in the Firebase build. The backend side is a new route file mounted
in `server.js` and tested against a real CouchDB (`mm-add-api-endpoint` skill: OpenAPI first, validation, repository, tests, docs).

## 1. Who is an admin

Today: `ADMIN_EMAILS` (comma separated, in `backend-secret`) is read by `authenticateToken` into `req.isAdmin`; only the community
moderation uses it. The `/api/v1` auth path (`middleware/api-auth.js`) gives a session every scope and does **not** set `isAdmin`.

Decisions to take (recommended first):

1. **Admin = the allowlist, session only.** Admin routes live under `/api/admin/*`, accept the cookie session of an account in
   `ADMIN_EMAILS` and nothing else - never a personal access token or an MCP token, whatever its scopes (same rule as the account
   routes, ADR-0006). Recommended.
2. Re-enter the password before a destructive action (delete user, wipe a database): one short-lived "sudo" token, 5 minutes.
3. Every admin write is an entry in the audit database (who, what, the ids touched, `byAdmin: true`) - the `audit` DB and
   `recordAuditEntry` exist already.

The UI shows the admin entry in the menu only when `GET /api/auth/verify` says `isAdmin` (it does already); the server decides, the
menu is a convenience.

## 2. What it manages (by phase, each one small and shippable)

**A0 - Overview and storage** (read only, the safest first release)

- Counts: accounts (normal / game), open / playing / finished / closed tables, profiles on the leaderboard (human / bot), saved games.
- **Storage per database** (`GET /{db}` of CouchDB: file size, active size, fragmentation, doc count) and the free space of the data
  volume - the Raspberry Pi's real limit. A "compact now" button per database (CouchDB `_compact`), with the size before and after.
- Biggest accounts by stored data, biggest tables by size.

**A1 - Tables and lobbies** (the first thing JFK wants to clean)

- List **every** table, public and private, with host, seats, humans, phase, last activity, size on disk, invite code.
- Close a table (`abandoned`, everyone is told), delete one (room, seats markers, snapshots, events), delete in bulk by a filter
  ("lobby and idle for more than N days", "finished and not saved", "no human"). A dry run first that says what would go.
- Kick a seat, take over the host of a stuck table, force-finish a game that cannot end.
- The sweep that exists (`sweep()`, idle lobby 1 day, idle game 7 days, finished 7 days unless somebody saved it) gets its limits shown
  and an admin "run sweep now".

**A2 - Players and the leaderboard**

- List profiles (human and bot): rating, games, visible, picture, account (admin only - the API never shows an account id to others).
- Hide or reset a profile, remove a profile picture (moderation), rename, delete a profile.
- Re-run `repair` / `rebuild` (recompute every rating from the result records), re-seed the bots, see the bot calibration version
  and trigger a re-calibration (a long job: runs as a CLI on the server, the UI only starts and watches it).
- Remove one result record (a game played with a cheating pair) and rebuild - ratings follow because the records are the truth.

**A3 - Accounts**

- List accounts (email, role, game account, created, last login, stored size, tables, saved games, picture yes/no). No financial data:
  the books are encrypted for the user and stay that way.
- Disable / enable an account (login refused, seats left), delete an account (the same path as the user's own delete: rooms, stats
  profile -> "Deleted player", saved games, tokens), delete test accounts in bulk by pattern (the `lobby…@cashflow.test` kind).
- Reset a game-account's password / send nothing: there is no mail server, so only a one-time reset link shown to the admin.
- Personal access tokens of a user: list and revoke (ADR-0006).

**A4 - Saved games and orphans**

- Saved games per account with size; delete one; find **orphans**: snapshot / event / seat-marker documents whose table is gone,
  profile pictures of deleted accounts, result records with no profile. One "clean orphans" button with a dry run.
- Old `data.cashflowGames` embedded in a user document (before the 2026-10-10 move): list and run `migrate-game-saves` for one or all.

**A5 - Operations** (nice to have)

- Backups: list the files the CronJobs wrote (name, size, age), start one now. Restoring stays a shell action on the server
  (`scripts/restore-backup.sh`) - too dangerous for a button.
- Server settings read-only: the `GAME_ROOMS_*` limits, retention, rate limits, the bot-ratings version. Changing them stays an
  environment change.
- A switch "no new tables" for maintenance (existing tables go on), and a banner text for all users.
- Live view: connected streams, tables with a running clock, the bot driver's timers.

## 3. API shape (OpenAPI first, `x-mcp-skip: true` - an admin console is not an agent tool)

`/api/admin/overview`, `/storage` (+ `POST /storage/{db}/compact`), `/tables` (filter, cursor) with `DELETE`, `POST …/close`,
`POST …/take-over`, `POST /tables/clean` (`dryRun`), `/players`, `/accounts`, `/orphans` (+ `POST /orphans/clean`), `/audit`.
Every destructive route takes `confirm: true`, an optional `dryRun: true`, and answers with what it touched (ids and counts).

## 4. UI

One route `/admin` (self-hosted route file only), tabs Overview · Tables · Players · Accounts · Storage · Audit. Lists that never
scroll sideways (standing rule), the app's own confirm dialog for every destructive action (never the browser's), bulk actions with a
preview of what is selected. English first; the six-language texts follow the lobby's pattern (a `*.texts.ts` in the lazy chunk,
not the shared i18n files).

## 5. Risks and rules

- Deleting is permanent: dry run by default in the UI, an audit entry for every delete, and the hourly backup is the safety net - say
  so in the confirm text.
- Never show or log another user's encrypted data, tokens, password hashes or invite codes of tables the admin does not need to
  see; the account id appears only on admin screens.
- An admin must not be able to lock the last admin out (the allowlist itself stays an environment value, not editable in the UI).
- Tests: backend unit + integration per route (non-admin 403, PAT of an admin 403, dry run changes nothing, delete cascades, audit
  entry written), a frontend spec per tab, and the edition guard run.

## 6. Order and size

A0 + A1 are one release (JFK's immediate need: look at everything, clean tables and lobbies). A2 + A3 the next. A4 + A5 after real
use shows what piles up. Rough size: A0 1 day, A1 2 days, A2 1.5, A3 2, A4 1.5, A5 1.5.
