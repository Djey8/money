## [1.21.0] - 2026-10-07

### Features

- feat(mcp): choose which permissions to grant on the MCP login page
- feat(mcp): the Cashflow game scope is offered on the MCP login page and in the token form

## [1.20.0] - 2026-10-07

### Features

- feat(cashflow-game): repaying the bank can never take the account below zero
- feat: the strategy lab and what it measured, in the Cashflow manual
- feat(api): the game analyst - GET /game/review and /game/saves/{id}/review, and MCP review actions
- feat(domain): a strategy lab, a position evaluator and a game analyst
- feat(api): special-asset cards and selling positions - the whole game is playable
- feat(domain): buy special assets and sell every kind of position as pure rules
- feat(mcp): get_cashflow_game and play_cashflow_game, with the guide's section for agents
- feat(api): saved games - save, list, read, continue, end, rename, delete, prune - with a storage budget
- feat(domain): how many saved games an agent leaves behind
- feat(api): play Market cards and roll waiting dice decisions
- feat(domain): play_market and roll_decision join legalActions
- feat(api): the solo turn and card decisions (turn, draw, buy a Deal, pay a Doodad, pass)
- feat(domain): card text composer and card actions in legalActions
- feat(api): start, undo and reset the Cashflow game, with a history shared with the app
- feat(domain): undo joins legalActions while there is a step to take back
- feat(api): companion game actions (payday, baby, charity, downsized, status clear, bank loan)
- feat(domain): clear_status joins legalActions while a reminder is showing
- feat(api): read surface for the Cashflow game (GET /game, /game/sets) behind a game-account guard
- feat(domain): legalActions - what the game allows right now
- feat(cashflow-game): paired dashboard rows and a ring that shrinks with the window height
- feat: dropdown quick filters on phones, cash on the loan screens, a slimmer wide layout, a fitting Subscriptions table
- feat(cashflow-game): a responsive layout - phone sheet, tablet and wide dashboard
- feat(cashflow-game): open dice decisions wait for the totem; tile symbol on the right of card headings
- feat(cashflow-game): solo feedback round - start look, tile symbols, no landing wait, Charity default, MLM info box
- feat(cashflow-game): a red Reset game button on the dashboard; red delete in the games list
- feat(cashflow-game): loan messages, Payday popup, thrown dice and a bin on every saved game
- feat(cashflow-game): the games played so far sit behind a button below Start
- feat(cashflow-game): solo playtest feedback - reveal order, START label, Payday banner, friend sale
- feat(domain): the first solo roll starts the game and pays the opening Payday
- feat(cashflow-game): play solo in the app - dice, walking token, card turns and the end screen
- feat(cashflow-game): the rat-race ring and token as an SVG component
- feat(cashflow-game): roll a solo turn and settle its card through the service
- feat(domain): the end of a solo game - escaping the rat race or going bankrupt
- feat(cashflow-game): read a solo game's token and turn back from the account
- feat(domain): a solo turn - roll, move, pay Paydays, resolve the landing
- feat(domain): dice, token movement and Payday passing for solo play
- feat(domain): the rat-race board for solo play
- feat(cashflow-game): write the live game's history to the account
- feat(domain): the live game's history as a document the account can hold
- feat(domain): the game's history, undo stack and snapshots as pure functions
- feat(domain): the Doodad and Market-cost payments as pure rules
- feat(domain): special assets, dice cards, coins and the split roll as pure rules
- feat(domain): the deal lifecycle as pure rules
- feat(domain): the full books, and applying effects to them
- feat(domain): the bank loan and the automatic purchase loan as pure rules
- feat(domain): classify a game trade and price its purchase through the typed parser
- feat(domain): the Market cards as pure functions
- feat(domain): Payday, Baby, Charity and Downsized as pure functions
- feat(domain): clock and text ports, and the game's date scheduling
- feat(domain): shared cash on hand and bank-loan arithmetic for the game

### Bug Fixes

- fix(cashflow-game): a sale price must be a non-negative whole amount; reviews are capped and stopped on time
- fix(cashflow-game): arrows mirror in right-to-left; a normal game is saved in full
- fix(cashflow-game): landing no longer greys the screen; what the player earns is booked as Income
- fix(docs): a wide manual table scrolls inside the page instead of widening it
- fix(cashflow-game): the walking totem has a layer of its own, so the ring is not repainted on every step
- fix(cashflow-game): a solo game ends the moment the books say so
- fix(grow): a market sale of a property no longer pays the deposit twice
- fix(domain): the bonus of a kept MLM card is Income, not Daily
- fix(add): tell the pages underneath when a transaction was saved
- fix(cashflow-game): a solo roll takes effect only once the totem has settled
- fix(cashflow-game): the loan steps field starts at 1 each time and after a settle
- fix(domain): Charity and Downsized take the bank loan first when cash is short
- fix(domain): a share card cannot be sold to a friend
- fix(cashflow-game): write the card-sale comment in the game's language
- fix(mobile): restore the iOS input-zoom and pull-to-refresh protections
- fix(deploy): wait for the rollout, not for pods by label

## [1.19.2] - 2026-10-05

### Performance

- perf(k8s): stop throttling the app, give CouchDB and the backend more memory
- perf(selfhosted): only re-encrypt transactions that changed
- perf(backend): read the user document only when ids need backfilling

## [1.19.1] - 2026-10-05

### Performance

- perf(selfhosted): send a stable id with every transaction
- perf(domain): use native AES-256-CBC and HMAC in EncryptionSession

## [1.19.0] - 2026-10-05

### Features

- feat(auth): require the game password to register a Cashflow game account
- feat(docs): add the Cashflow game manual to the self-hosted docs
- feat(cashflow-game): game panel with Payday, cards, dice, Market, loans and My games
- feat(stats): mark game events in the charts
- feat(cashflow-game): Grow trades, Market offers and gold deals from the dialogs
- feat(cashflow-game): saved games that keep their whole undo history
- feat(cashflow-game): game engine service with a full, reloadable undo history
- feat(cashflow-game): card texts in six languages and a language per game
- feat(domain): add Classic Cashflow card catalogs, saved-game model and content split
- feat(cashflow-game): add all 12 Classic professions + new Custom JFK set
- feat(cashflow-game): translate profession content into all 6 languages
- feat(subscription): add a Category column to the Subscriptions page
- feat(cashflow-game): persist the undo stack to localStorage, clear it on logout
- feat(cashflow-game): general undo for any action; fix missing categories and dates
- feat(cashflow-game): add Passive Income back to the mini cashflow box
- feat(cashflow-game): defer Salary/Expenses to the first Payday, spread its dates across the month
- feat(cashflow-game): profession card becomes an Income Statement/Balance Sheet, live during the game
- feat(cashflow-game): itemize starting cash into real transactions; reload after reset
- feat(cashflow-game): board-space color-coded selector, quiet monthly-cashflow stat, single Menu link
- feat(cashflow-game): hide the placeholder fixture from players, complete the View Card stats, move reset to Settings
- feat(cashflow-game): turn the game into an overlay panel, with profession shuffle and card view
- feat(cashflow-game): categorize expense lines, compute starting cash, add the real Hausmeister profession
- feat(cashflow-game): a reset button — wipe the whole account, start over
- feat(cashflow-game): find or draw a card, from any of the four decks
- feat(cashflow-game): Deal cards as Grow plans, reuse the app's own views
- feat(cashflow-game): companion-mode space resolutions and bank loans
- feat(cashflow-game): MVP of the Cashflow board game companion

### Bug Fixes

- fix(docker): patch pcre2 in the frontend image
- fix(cashflow-game): Live scenario Salary always showing 0; lowercase reset button
- fix(i18n): translate Smile/Fire bucket names in the Chinese locale
- fix(cashflow-game): correct stat row order, add space-button effect hints
- fix(cashflow-game): bank loan borrow/repay now actually moves cash
- fix(cashflow-game): dashboard spacing, redesigned loan/menu buttons, hide History
- fix(cashflow-game): date Payday transactions from each Subscription's own date
- fix(cashflow-game): remove the rat-race bars, size the mini cashflow box to its amount pills
- fix(cashflow-game): reliably detect an active game, disable subscription auto-add everywhere
- fix(cashflow-game): notify pages instead of reloading the page after every action
- fix(cashflow-game): categories on Payday/Downsized, itemize Downsized, step-by-step dashboard, reload after start
- fix(cashflow-game): stop Start Game from silently no-opping at app bootstrap
- fix(cashflow-game): add the missing menu entry to reach the page
- fix(cashflow-game): remove a sold property's cashflow Subscription
- fix(cashflow-game): Payday is unconditional; Deal cards are just Grow

### Performance

- perf(backend): cache encryption sessions and use native PBKDF2

## [1.18.0] - 2026-09-24

### Features

- feat(mcp): point agents at the app overview and advisor playbook
- feat(ui): settle smile/fire buckets and show completed payment plans
- feat(api): keep smile/fire payment plans in line with their subscriptions
- feat(api): settle and unsettle smile/fire buckets
- feat(domain): settle a smile/fire bucket with its actual cost
- feat(api): manage smile/fire payment plans after creation
- feat(api): edit single smile/fire buckets and list items, and guard saved money
- feat(api): carry smile/fire project and bucket renames over to their money
- feat(api): contribute to smile, fire and mojo through a typed action
- feat(reports): add cost basis and realized/unrealized gain to the grow P&L
- feat(api): edit single grow action items, notes and links
- feat(api): keep balance-sheet edits in sync with linked grow projects
- feat(api): keep grow trades consistent on every transaction write and report effects
- feat(domain): undo a recorded grow trade exactly
- feat(api): carry a grow project rename over to everything linked by its title
- feat(api): buy or sell a grow asset by quantity x unit price
- feat(api): set and edit a grow project's kind and plan via create/PATCH

### Bug Fixes

- fix(ui): rebuild smile/fire buckets and mojo with the shared fund engine
- fix(domain): stop funded fire plans from generating zero-amount transactions
- fix(api): rebuild smile/fire buckets and mojo on every write, never store amounts
- fix(api): reject a grow riskScore outside 0-5
- fix(grow): pre-fill Buy/Sell from the loaded balance sheet, never 0 x 0
- fix(ui): keep a grow project's id through load and save
- fix(ui): refuse to save over newer data, and stop sending every save twice
- fix(backend): stop legacy app saves from clobbering newer data and re-keying ids
- fix(mcp): accept every action's shape for a shared tool argument
- fix(api): allow cash-only grow investments without a mortgage
- fix(domain): round fractional share amounts to whole minor units

## [1.17.3] - 2026-09-14

### Bug Fixes

- fix(settings): close profile and settings overlays when opening PAT page
- fix(mcp): merge path-item-level OpenAPI parameters into each operation

## [1.17.2] - 2026-09-14

### Bug Fixes

- fix(api): make legacy collection writes self-healing for stable ids
- fix(reports): round fractional share cents, fix balance data displaying 100x too small

## [1.17.1] - 2026-09-14

### Bug Fixes

- fix(k8s): raise backend CPU/memory limits and health-check tolerance

## [1.17.0] - 2026-09-14

### Features

- feat(settings): split token creation into its own toggleable panel, add delete
- feat(api): add endpoint to permanently delete a revoked personal access token

### Bug Fixes

- fix(ci): update stale MCP operation count, fix unbounded PAT list query
- fix(api): stop legacy empty-time transactions from 500ing GET /transactions

## [1.16.0] - 2026-09-13

### Features

- feat(settings): add Personal Access Tokens page (Pro, self-hosted only)

### Bug Fixes

- fix(oauth): replace the final cross-origin redirect with a meta-refresh page

## [1.15.2] - 2026-09-13

### Bug Fixes

- fix(docs): correct prettier formatting in the Treasury plan doc
- fix(docs): match Pro API page header and layout to the rest of the site
- fix(oauth): redesign the login page to match the app's Sign In screen
- fix(oauth): allow the login form's own same-origin POST under CSP

## [1.15.1] - 2026-09-13

### Bug Fixes

- fix(pwa): exclude OAuth/MCP server routes from service worker navigation interception
- fix(docs): match the Pro API docs page header to every other public page
- fix(ci): make auto-release's changelog generator emit blank lines after headers

## [1.15.0] - 2026-09-13

### Features

- feat(deploy): wire the MCP server into docker-compose and k8s
- feat(mcp): add OAuth 2.1 authorization server for the HTTP transport
- feat(mcp): add Streamable HTTP transport for remote MCP clients
- feat(docs): add Pro API & AI assistant connection guide (selfhosted only)
- feat(routing): gate Pro routes via fileReplacements, not a runtime ternary
- feat: add environment.edition build-time constant

### Bug Fixes

- fix(changelog): add missing blank lines after v1.14.0 section headers

## [1.14.0] - 2026-09-13

### Features

- feat(frontend): scale money fields to minor units on write for schemaVersion-2 accounts
- feat(domain): add convertDocumentFromMinorUnits

### Bug Fixes

- fix(frontend): make CrypticService.decrypt tolerant of non-string input

## [1.13.0] - 2026-09-09

### Features

- feat(mcp): add MCP server exposing the Pro API as agent tools
- feat(api): add GET/PATCH/DELETE /account, POST /account/verify-password
- feat(api): add POST /data/import
- feat(api): add GET /data/export
- feat(api): add POST /data/recalculate
- feat(cli): add mm-admin rotate-encryption-key
- feat(api): add GET/PUT /encryption-config
- feat(api): add GET/PATCH /settings, starting Slice 6
- feat(api): add POST /budget/from-subscriptions, completing Slice 5
- feat(api): add POST /budget/{fill-forward,copy} and DELETE /budget?month=
- feat(api): add GET/POST /budget and GET/PATCH/DELETE /budget/{id}
- feat(api): add POST /subscriptions/batch, GET /subscriptions/export, POST /subscriptions/import
- feat(api): add POST /subscriptions/refresh
- feat(api): add GET/POST /subscriptions and GET/PATCH/DELETE /subscriptions/{id}
- feat(api): add subscription repository CRUD
- feat(domain): add subscription due-transaction generation engine
- feat(domain): add subscription frequency-occurrence calculators
- feat(api): add GET /reports/grow/{id}/pnl, closing out Slice 4
- feat(api): add Grow CRUD and typed actions, completing Slice 4
- feat(domain): add pure calculators for Grow's typed actions
- feat(domain): add regex-based Grow comment-DSL parser/generator
- feat(api): add read-only GET /income/{revenues,interests,properties}
- feat(api): add GET/POST /balance/shares and GET/PATCH/DELETE /balance/shares/{id}, completing Slice 4
- feat(api): add GET/POST /balance/investments and GET/PATCH/DELETE /balance/investments/{id}
- feat(api): add GET/POST /balance/liabilities and GET/PATCH/DELETE /balance/liabilities/{id}
- feat(api): add GET/POST /balance/assets and GET/PATCH/DELETE /balance/assets/{id}, starting Slice 4
- feat(api): add POST /{smile,fire}/{id}/payment-plan, completing Slice 3
- feat(api): add GET /reports/fire-coverage, completing Slice 3's Smile/Fire/Mojo work
- feat(api): add GET/POST /fire and GET/PATCH/DELETE /fire/{id}
- feat(api): add GET/PATCH/DELETE /smile/{id}
- feat(api): add GET/POST /smile
- feat(domain): add fund project totals aggregate
- feat(cli): add mm-admin migrate-fund-project-ids
- feat(api): add GET/PUT /mojo, starting Slice 3
- feat(api): add GET /reports/kpis, completing Slice 2
- feat(api): add GET /reports/balance-sheet
- feat(api): add GET /reports/cashflow
- feat(api): add GET /reports/income-statement
- feat(api): add transactions export/import, complete Slice 1
- feat(api): add POST /transactions/batch
- feat(api): add POST /transactions/{id}/copy
- feat(api): add PATCH/DELETE for transactions
- feat(backend): create transactions and persist derived fund state
- feat(backend): map transaction derived state
- feat(domain): rebuild transaction derived state
- feat(domain): classify transaction income
- feat(domain): rebuild transaction fund state
- feat(domain): apply transaction fund allocations
- feat(domain): summarize transaction accounting
- feat(api): filter transaction reads
- feat(api): add transaction detail reads
- feat(api): add paginated transaction reads
- feat(backend): add transaction ID backfill command
- feat(domain): map transactions to API money format
- feat(domain): add transaction identity normalization
- feat(api): add v1 identity and token foundation
- feat(backend): add mm-admin user/token commands (slice 1 groundwork)
- feat(backend): add the audit log database and write/query helpers
- feat(frontend): refuse a write when the server data changed underneath it
- feat(backend): add mm-admin migrate CLI for the money minor-units migration
- feat(domain): add money minor-units conversion for the migration tool
- feat(backend): link @money/domain via workspace file dependency
- feat(domain): scaffold packages/domain workspace and port CrypticService crypto

### Bug Fixes

- fix(docker): eliminate container-scan HIGH-severity findings
- fix(migrate): compare rounded, not raw, sums in migration verification
- fix(deps): declare @types/crypto-js at root so a clean npm ci installs it
- fix(deploy): build packages/domain into the backend image instead of a dangling symlink
- fix(backend): add subscriptions/budget to migrate-balance-entity-ids
- fix(domain): use non-empty time for generated subscription transactions
- fix(domain): reuse EncryptionSession's salt by default
- fix(domain): allow empty transaction comments
- fix(landing): repair malformed opacity declaration
- fix(splurge): use splurge ratio instead of daily ratio on refresh

## [1.12.0] - 2026-08-03

### Features

- feat(community): add public Community section with guest/admin support

### Bug Fixes

- fix(backend): bump brace-expansion to 2.1.4 (CVE-2026-69152 bypass)
- fix(backend): resolve 7 container CVEs (axios, form-data, brace-expansion, tar, sigstore)
- fix(docker): patch c-ares, curl, libcurl and libexpat CVEs in frontend image
- fix(ci): resolve fast-uri audit finding, grant gitleaks PR read access

## [1.11.3] - 2026-06-07

### Bug Fixes

- fix(add): update amount input to use text inputmode with autocorrect disabled

## [1.11.2] - 2026-06-01

### Bug Fixes

- fix(backup): recreate daily, weekly and monthly backup

## [1.11.1] - 2026-06-01

### Bug Fixes

- fix(frontend): patch libxml2 CVE-2026-6732
- fix(backup): patch libxml2 CVE-2026-6732
- fix(backup): rerun daily, weekly or monthly when missing
- fix(add): remove placeholder for amount
- fix(input): allow negative decimals for amount input (iOS-friendly, comma→dot)

## [1.11.0] - 2026-05-31

### Features

- feat(backup): add hash comparison to skip redundant backups for daily and hourly jobs
- feat(scripts): add weekly and monthly backup promotions

### Bug Fixes

- fix(ui): adjust font size for input and textarea to prevent iOS zoom on focus

## [1.10.0] - 2026-05-10

### Features

- feat(auth): extend session lifetime to prioritize UX (24h access, 1y sliding refresh)

### Bug Fixes

- fix(release): base bumps on highest existing tag
- fix(docker): upgrade nghttp2-libs in frontend runtime image
- fix(deps): resolve backend axios high severity vulnerability
- fix(deps): resolve fast-uri high severity vulnerability
- fix(backup): use configurable European timezone for backup age display
- fix(backup): harden restore flow and add freshness checks
- fix(auth): keep session alive across cold starts and transient errors

## [1.7.0] - 2026-04-27

### Features

- feat(auth): show spinner and disable buttons while login/register is in flight
- feat(stats): redesign financial statement with period selector and key ratios
- feat(docs): add in-app documentation hub with self-hosted setup guide

### Bug Fixes

- fix(backup): prevent CronJob pile-up with concurrency and deadline guards
- fix(home): refresh home amounts when transactions are added (e.g. subscription auto-load after login)
- fix(stats): derive page title from active view so it updates on switch
- fix(selfhosted): add GitHub API and avatar CDN to CSP whitelist

## [1.6.7] - 2026-04-20

### Bug Fixes

- fix(selfhosted): add OCR API to CSP connect-src for receipt scanning

## [1.6.6] - 2026-04-20

### Bug Fixes

- fix(backend): increase body size to 100mb and rate limit to 10000/15min for normal use

## [1.6.5] - 2026-04-20

### Bug Fixes

- fix(selfhosted): disable beasties CSS inlining to avoid CSP-blocked onload handler
- fix(nginx): add unsafe-inline to CSP script-src for Firebase Auth handlers
- fix(encryption): return empty string for encrypted data when key unavailable

### Performance

- perf(encryption): cache key in sessionStorage for instant decrypt on refresh

## [1.6.4] - 2026-04-20

### Bug Fixes

- fix(selfhosted): fix CSP connect-src and skip localStorage parse before encryption key loaded

## [1.6.3] - 2026-04-20

### Bug Fixes

- fix(nginx): increase client_max_body_size to 5m for encrypted batch writes

## [1.6.2] - 2026-04-20

### Bug Fixes

- fix(k8s): remove capabilities drop that blocks curl in backup cronjobs

## [1.6.1] - 2026-04-20

### Bug Fixes

- fix(k8s): switch backup cronjobs to alpine with curl+gnupg for encryption support
- fix(profile): fetch email from database to avoid encrypted display

## [1.6.0] - 2026-04-20

### Features

- feat(registration): add live password rules with i18n support (6 languages)

### Bug Fixes

- fix(auth): restore uploaded encryption config after selfhosted login
- fix(security): preserve encryption flags during localStorage-to-server migration
- fix(security): add Firebase Auth and Google domains to CSP headers

## [1.5.2] - 2026-04-20

### Bug Fixes

- fix(security): add migration path for encryption key from localStorage to server-side storage

## [1.5.1] - 2026-04-20

### Bug Fixes

- fix(docker): pin multi-arch manifest digests for arm64 CI compatibility

## [1.5.0] - 2026-04-20

### Features

- feat(receipt): add structured receipt parser with store-specific readers
- feat(ci): add SBOM generation job for frontend and backend
- feat(security): add webhook-based security alerting for high-severity events (M8)

### Bug Fixes

- fix(ci): use POSIX-compatible redirect in pre-commit gitleaks check
- fix(security): patch Alpine CVEs and picomatch ReDoS in backend Docker image
- fix(security): patch Alpine CVEs in frontend Docker image (libcrypto3, libpng, musl, zlib)
- fix(auth): center password toggle eye icon in registration input field
- fix(security): move encryption key to server-side storage with mode-aware config and clean logout
- fix(security): add Google Fonts origins to CSP header (M10)
- fix(security): pin Docker image digests for reproducible builds (M7)
- fix(security): upgrade cryptic service to PBKDF2-SHA256 key derivation with HMAC auth (M5)
- fix(backup): add encryption support to restore, fix .gpg extension in promotions, add NAS timeout
- fix(auth): move inject() calls to synchronous interceptor context (NG0203)
- fix(security): move encryption key from localStorage to sessionStorage (M4)
- fix(security): add gitleaks secret scanning to pre-commit hook
- fix(security): add npm audit, container scanning, and secret scanning to CI
- fix(security): add Content-Security-Policy header to nginx (M10)
- fix(security): fix vulnerable dependencies via npm audit fix (M9)

## [1.4.1] - 2026-04-19

### Bug Fixes

- fix(settings): align auth button colors with login button style
- fix(auth): replace PNG eye icons with inline SVG and fix password toggle layout
- fix(balance): refine section add button size and border thickness
- fix(grow): center empty state button
- fix(income-statement): remove duplicate fire expense entries in recalculate
- fix(filters): add missing idea phase to smile and fire filter tabs
- fix(ux): add spinner and toast feedback to all write operations
- fix(add-fire): navigate to fireemergencies after successful add

## [1.4.0] - 2026-04-19

### Features

- feat(info-mojo): add mojo info panel component with responsive design
- feat(app): add global saving spinner overlay with isSaving state

### Bug Fixes

- fix(fire): responsive mojo display with container query font sizes
- fix(ui): center textarea and responsive font sizes for info panels
- fix(info-fire): add editable completionDate and spinner on update/delete
- fix(info): show spinner on update/delete with toast error handling
- fix(add): close panel and show spinner on write operations
- fix(add-smile): collapse sections by default and support tour expansion

## [1.3.3] - 2026-04-19

### Bug Fixes

- fix(security): increase global rate limit to 500/15min, add strict 10/15min auth limiter
- fix(security): sanitize D3 innerHTML with escapeHtml for user data (M1)
- fix(security): implement refresh tokens and httpOnly cookie auth (H3, H4)
- fix(security): add NetworkPolicy, pod security contexts, non-root backups (L5, L6, L7)
- fix(security): enable TLS with cert-manager, HSTS, and HTTP-to-HTTPS redirect (H6)
- fix(security): add account lockout after 10 failed login attempts (H5)

## [1.3.2] - 2026-04-19

### Bug Fixes

- fix(deploy): correct backup cronjob name and add graceful fallback in migration script

## [1.3.1] - 2026-04-19

### Bug Fixes

- fix(security): move Grafana admin password to env template and secrets.yaml
- fix(deploy): apply secrets.yaml in deploy script and add one-time migration helper
- fix(security): restrict trust proxy to 1 hop and remove CORS wildcard fallback
- fix(auth): add password policy, email validation, generic errors, and crypto UUIDs (C4, L1, L2, M2)
- fix(security): remove CouchDB proxy, CORS wildcard headers, and add security headers to nginx (C3, L4)
- fix(security): remove hardcoded default encryption key from cryptic service (C2)
- fix(security): move secrets to gitignored templates and harden k8s config (C1, H1, H2, M5)

## [1.3.0] - 2026-04-18

### Features

- feat(changelog): add GitHub API enrichment with per-version PR links, author avatars, and view toggle
- feat(tour): add interactive guided tour with spotlight overlay and i18n

### Bug Fixes

- fix(i18n): update ar, cn, de, es, and fr translations
- fix(landing): remove lock emoji from AI showcase heading
- fix(settings): use translate service as source of truth for language selection
- fix(data): add tier guards to all write paths preventing data loss

## [1.2.0] - 2026-04-16

### Features

- feat(backup): add NAS catch-up sync and shift daily schedule to 8:30AM
- feat(backup): add NAS redundancy, hourly local backups, and granular deploy flags
- feat(profile): add about page route with nav menu toggle and i18n support
- feat(landing): interactive income allocation with click-to-animate, editable amounts, flow lines and i18n
- feat(settings): add allocation editor with reset to default percentages

### Bug Fixes

- fix(auth): skip landing page flash on login and recalculate home amounts after data load

## [1.1.1] - 2026-04-16

### Bug Fixes

- fix(auth): block login on wrong decryption settings and show error
- fix(changelog): add bottom padding for bottom nav bar visibility
- fix(auth): block login on wrong decryption settings and show error
- fix(auth): clear all caches on logout to prevent stale data on re-login

## [1.1.0] - 2026-04-16

### Features

- feat(changelog): add changelog page with GitHub API integration
- feat(landing): add public landing page with demo mode and bucket showcase

### Bug Fixes

- fix(landing): use dynamic currency, translate bucket names, scroll to smile panels, preserve settings on logout
- fix(ui): detect system theme preference and fix profile z-index

## [1.0.1] - 2026-04-13

### Bug Fixes

- fix(build): update budgets and upgrade jest-preset-angular for Angular 19

# Changelog

## [1.0.0] - 2026-04-10

### Features

- feat: initial release — Angular 19 PWA, Node.js backend, Firebase + selfhosted deployments
