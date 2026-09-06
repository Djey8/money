# Feature Catalog

This is the contract for "every functionality gets an API" (MASTER_PROMPT.md §2.3). One row per user-facing capability. Built by walking every route, component, dialog, and backend route in the repository.

## Backend reality check (read before the table)

Today's self-hosted backend is **not** a per-entity REST API. `backend/routes/data.js` is a generic per-user JSON-blob store:

- `GET /api/data/read/*` (path-addressed, e.g. `read/transactions`, `read/budget`, `read/info/username`)
- `POST /api/data/write/*` (same path addressing)
- `DELETE /api/data/delete/*`
- `POST /api/data/read/batch`, `POST /api/data/write/batch` (multi-path batch variants)
- `GET /api/data/updatedAt`, `GET /api/data/document`

There is no entity-aware logic here — the frontend owns all schema, validation, and business rules, and just reads/writes nested paths (`transactions`, `budget`, `smile`, `fire`, `info/username`, …) into one JSON document per user.

Only **three** backend route files are genuinely special-cased (real business logic, not generic blob access):

- `backend/routes/auth.js` — registration, login (with account lockout), guest identity, refresh-token rotation, verify-password, update-email, delete-account, encryption-config.
- `backend/routes/community.js` — threads/posts CRUD, reactions, rate limiting, ownership checks, pagination.
- `backend/routes/logs.js` — frontend log ingestion + health check.

Every other entity (transactions, accounts, subscriptions, smile/fire goals, grow/investments, budget) is persisted purely as nested paths in the single generic blob, with **all validation, CRUD semantics, and cross-entity side effects implemented entirely client-side** in Angular services/components. This is the central fact that Phase 2 (§4.2, per-entity REST resources) has to design around — see `RISKS_AND_QUESTIONS.md` R-1.

Selfhosted vs. Firebase is almost entirely a **service-layer** switch on `environment.mode` (`DatabaseService`, `AuthService`, `CrypticService`, `CommunityService`, `GuestIdentityService`, `PersistenceService`, `logging.service.ts`), not separate screens or lazy-loaded modules. The only template-level mode conditional found repo-wide is a cosmetic edition badge in `src/app/panels/settings/settings.component.html`. This matters for §4.4 (edition separation): today nothing is tree-shaken out of the Firebase bundle by route/module — the `edition-guard` mechanism will need a different approach than "Pro modules are lazy-loaded only under selfhosted config," because no such module split exists yet.

## Feature table

| ID | Feature / UI action | Route/component | Entity | Operation | Backend today? | Business rules involved | Notes |
|---|---|---|---|---|---|---|---|
| AUTH-1 | Register (email/password/username) | `src/app/registration/registration.component.ts` (`SignUp`) | User account | C | yes (`auth.js /register`, special-cased) | Password ≥8 chars, upper+lower+digit; email regex; duplicate email → 409 | Firebase mode uses `afAuth.createUserWithEmailAndPassword` instead |
| AUTH-2 | Login | `src/app/registration/registration.component.ts` (`SignIn`) | User account | R | yes (`auth.js /login`, special-cased) | Account lockout: 10 failed attempts → 15 min lock, 30 min sliding-window reset | |
| AUTH-3 | Guest / anonymous session | `src/app/shared/services/guest-identity.service.ts` | Guest identity | C | yes (`auth.js /guest`, special-cased) | Idempotent if valid cookie exists; 180-day guest JWT | Used only to post in Community anonymously |
| AUTH-4 | Logout | `src/app/panels/profile/profile.component.ts` (`logOut`, `logoutFirebase`) | Session | D | yes (`auth.js /logout`) | Clears cookies / Firebase signOut | |
| AUTH-5 | Password reset email | `src/app/panels/settings/settings.component.ts` (`sendPasswordResetEmail`, `changePassword`) | User account | U | **no backend route at all** | Unconditionally calls `afAuth.sendPasswordResetEmail` | Firebase-only in practice — selfhosted has no reset-password endpoint |
| AUTH-6 | Update email | `src/app/panels/settings/settings.component.ts` (`updateEmail`) | User account | U | yes (`auth.js /update-email`, Firebase path only) | Code explicitly throws "not supported in selfhosted mode" | Firebase-only |
| AUTH-7 | Verify password (reauth gate) | `src/app/panels/settings/settings.component.ts` (`authenticate`) | User account | R | yes (`auth.js /verify-password`) | Required before viewing/changing encryption settings | Firebase path uses `reauthenticateWithCredential` |
| AUTH-8 | Delete account | `src/app/panels/settings/settings.component.ts` (`deleteUser`/`deleteAccount`) | User account + all data | D | yes (`auth.js /delete-account`, special-cased) | Wipes CouchDB auth+data docs (selfhosted) or Firebase RTDB node + auth user; clears all local storage keys | |
| AUTH-9 | Encryption key upload (pre-login) | `src/app/registration/registration.component.ts` (`upload`, `default`) | Encryption config | C/U | no (config lives in blob / localStorage) | Validates JSON has key/local/database fields | |
| NAV-1 | Home dashboard tiles | `src/app/main/home/home.component.ts` | n/a | R (nav) | n/a | | |
| TXN-1 | Add transaction (manual) | `src/app/panels/add/add.component.ts` (`addTransaction`) | Transaction | C | no (generic blob only) | Auto-tags category into Daily/Splurge/Smile/Fire/Mojo bucket allocation; supports manual bucket allocation via comment syntax | |
| TXN-2 | Receipt scan / OCR autofill | `src/app/panels/add/add.component.ts` (`recognizeImage`, `captureImage`, `pickImage`, via `ReceiptParserService`) | Transaction (draft) | C (assist) | no — calls external OCR API (`ocr.asprise.com`) | Store-specific parsers (Paradise, Go Asia, REWE, EDEKA) + generic fallback; cross-validates OCR total vs. raw text | Third-party OCR, not part of money backend |
| TXN-3 | Edit transaction | `src/app/panels/info/info.component.ts` (`editTransaction`, `updateTransaction`) | Transaction | U | no | Re-runs bucket-allocation tag logic on category change | |
| TXN-4 | Delete transaction | `src/app/panels/info/info.component.ts` (`deleteTransaction`) | Transaction | D | no | Confirm dialog; reverses smile/fire/mojo allocations | |
| TXN-5 | Copy transaction | `src/app/panels/info/info.component.ts` (`copyTransaction`) | Transaction | C | no | Duplicates existing transaction as new entry | |
| TXN-6 | Transaction table filter/search/sort | `src/app/main/accounting/accounting.component.ts` | Transaction | R/calc | no | Advanced filters (tags, accounts, date ranges, AND/OR/NOT) | |
| TXN-7 | Export transactions to CSV | `src/app/main/accounting/accounting.component.ts` (`downloadTransactions`, via `CsvService`) | Transaction | export | no | Client-side CSV generation | |
| DAILY-1 | Add daily expense | `src/app/main/daily/daily.component.ts` (`addTransaction`) | Transaction (Daily) | C | no | Pre-fills "Daily" category | |
| DAILY-2 | View daily list + stats | `src/app/main/daily/daily.component.ts` | Transaction | R | no | | |
| SPLURGE-1 | Add splurge expense | `src/app/main/splurge/splurge.component.ts` (`addTransaction`) | Transaction (Splurge) | C | no | | |
| SPLURGE-2 | View splurge list + stats | `src/app/main/splurge/splurge.component.ts` | Transaction | R | no | | |
| SMILE-1 | Add smile transaction | `src/app/main/smile/smile.component.ts` (`addTransaction`) | Transaction (Smile) | C | no | | |
| SMILE-2 | Mojo quick add | `src/app/main/fire/fire.component.ts` (`addToMojo`) / info-mojo | Mojo | C/U | no | Shared "Mojo" reserve target between Smile/Fire | |
| SMILE-3 | Create Smile project | `src/app/panels/add/add-smile/add-smile.component.ts` (`addSmileProject`) | Smile | C | no | Multi-bucket structure (title, target, notes, links, action items) | |
| SMILE-4 | Edit Smile project | `src/app/panels/info/info-smile/info-smile.component.ts` | Smile | U | no | Bucket/link/action-item edit, note add | |
| SMILE-5 | Delete Smile project | `src/app/panels/info/info-smile/info-smile.component.ts` | Smile | D | no | Confirm dialog | |
| SMILE-6 | Smile projects list/search/phase filter/allocate | `src/app/main/smile/smile-projects/smile-projects.component.ts` | Smile | R/U | no | Progress % per bucket | |
| SMILE-7 | Payment planner for buckets | `src/app/shared/components/payment-planner-dialog/` (`savePlan`) | Smile/Fire bucket plan | C/calc | no | Computes required contribution per period | Shared by Smile and Fire |
| SMILE-8 | AI Assistant — prompt + import (Smile) | `src/app/panels/ai-assistant/ai-assistant.component.ts` (`parseSmileUpdates`, `importProjects`) | Smile | C/U (bulk) | no; **no HTTP call to any AI API** | Generates a copy-paste prompt for an external LLM, manually parses pasted JSON back in | See `RISKS_AND_QUESTIONS.md` R-4 — pre-existing client-side AI strategy in tension with the Pro API/MCP approach |
| FIRE-1 | Add fire transaction | `src/app/main/fire/fire.component.ts` (`addTransaction`) | Transaction (Fire) | C | no | | |
| FIRE-2 | Emergency fund coverage gauge | `src/app/main/fire/fire.component.ts` (`getEmergencyCoverage`) | calc | R/calc | no | Coverage ratio = fund / avg monthly expenses (prior month) | |
| FIRE-3 | Create Fire emergency project | `src/app/panels/add/add-fire/add-fire.component.ts` | Fire | C | no | Multi-bucket, links, action items, notes | |
| FIRE-4 | Edit Fire emergency | `src/app/panels/info/info-fire/info-fire.component.ts` | Fire | U | no | | |
| FIRE-5 | Delete Fire emergency | `src/app/panels/info/info-fire/info-fire.component.ts` | Fire | D | no | Confirm dialog | |
| FIRE-6 | Fire emergencies list/search/filter/allocate | `src/app/main/fire/fire-emergencies/fire-emergencies.component.ts` | Fire | R/U | no | | |
| FIRE-7 | AI Assistant — Fire suggestions | `ai-assistant.component.ts` (`parseFireUpdates`) | Fire | C/U (bulk) | no | Same client-side prompt/import pattern | |
| MOJO-1 | Edit Mojo target | `src/app/panels/info/info-mojo/info-mojo.component.ts` | Mojo | U | no | | |
| CASH-1 | Cashflow overview + date filter | `src/app/main/cashflow/cashflow.component.ts` | Transaction (aggregated) | R/calc | no | | |
| CASH-2 | Income statement | `src/app/main/cashflow/income/income.component.ts` | Revenue/Interest/Property/Expenses | R/calc | no | Sortable/filterable multi-table; row click opens info dialogs | |
| CASH-3 | Balance sheet | `src/app/main/cashflow/balance/balance.component.ts` | Asset/Share/Investment/Liability | R/calc | no | Toggle sections; add-shortcuts | |
| ASSET-1 | Add asset | `src/app/panels/add/add-asset/add-asset.component.ts` | Asset | C | no | | |
| ASSET-2 | Edit asset value | `src/app/panels/info/info-asset/info-asset.component.ts` | Asset | U | no | | |
| ASSET-3 | Delete asset | `src/app/panels/info/info-asset/info-asset.component.ts` | Asset | D | no | Confirm dialog | |
| SHARE-1 | Add share holding | `src/app/panels/add/add-share/add-share.component.ts` | Share | C | no | | |
| SHARE-2 | Edit share | `src/app/panels/info/info-share/info-share.component.ts` | Share | U | no | Also updates linked Grow project & interests | |
| SHARE-3 | Delete share | `src/app/panels/info/info-share/info-share.component.ts` | Share | D | no | | |
| INV-1 | Add investment (real estate/property) | `src/app/panels/add/add-investment/add-investment.component.ts` | Investment | C | no | | |
| INV-2 | Edit investment | `src/app/panels/info/info-investment/info-investment.component.ts` | Investment | U | no | Also updates linked Property income | |
| INV-3 | Delete investment | `src/app/panels/info/info-investment/info-investment.component.ts` | Investment | D | no | | |
| LIAB-1 | Add liability | `src/app/panels/add/add-liabilitie/add-liabilitie.component.ts` | Liability | C | no | | |
| LIAB-2 | Edit liability / payback | `src/app/panels/info/info-liabilitie/info-liabilitie.component.ts` | Liability | U | no | "Payback" pre-fills a transaction against the linked Grow project | |
| LIAB-3 | Delete liability | `src/app/panels/info/info-liabilitie/info-liabilitie.component.ts` | Liability | D | no | | |
| REV-1 | Update / delete revenue source | `src/app/panels/info.component.ts` (`updateRevenues`, `removeFromReveneus`) | Revenue | U/D | no | | |
| INT-1 | Add/edit/delete interest income | `src/app/panels/info/info-interests/info-interests.component.ts` | Interest | C/U/D | no | | |
| PROP-1 | Add/edit/delete rental property income | `src/app/panels/info/info-properties/info-properties.component.ts` | Property | C/U/D | no | | |
| GROW-1 | Create Grow project | `src/app/panels/add/add-grow/add-grow.component.ts` | Grow | C | no | Wraps underlying Asset/Share/Investment/Liability creation; links, notes, action items, category | |
| GROW-2 | Edit Grow project | `src/app/panels/info/info-grow/info-grow.component.ts` | Grow | U | no | | |
| GROW-3 | Buy into project | `src/app/main/grow/grow.component.ts` (`buyProject`) | Grow + Transaction | C (transaction) | no | Prefills negative transaction, sets liability if financed | |
| GROW-4 | Sell project | `src/app/main/grow/grow.component.ts` (`sellProject`) | Grow + Transaction | C (transaction) | no | | |
| GROW-5 | Cashflow/deposit/dividend/payback actions | `grow.component.ts` (`cashflowProject`, `depositProject`, `dividende`, `paybackProject`) | Grow + Transaction | C (transaction), calc | no | Each computes and prefills a transaction | |
| GROW-6 | Update project value | `grow.component.ts` (`updateValueProject`) | Asset/Share/Investment | U | no | Opens matching info-* dialog based on underlying type | |
| GROW-7 | Grow projects list/search/phase/type filters | `src/app/main/grow/grow.component.ts` | Grow | R | no | | |
| GROW-8 | AI Assistant — Grow strategy prompt/import | `ai-assistant.component.ts` (context `grow`) | Grow | C/U (bulk) | no; no external AI API call | Same manual prompt/paste-JSON pattern | |
| SUB-1 | Add subscription | `src/app/panels/add/add-subscription/add-subscription.component.ts` | Subscription | C | no | Recurring frequency strategies (weekly/biweekly/monthly/quarterly/yearly) | |
| SUB-2 | Edit subscription | `src/app/panels/info/info-subscription/info-subscription.component.ts` | Subscription | U | no | Deletes/regenerates related transactions on change | |
| SUB-3 | Delete subscription | `src/app/panels/info/info-subscription/info-subscription.component.ts` | Subscription | D | no | | |
| SUB-4 | Subscription list/filter/refresh | `src/app/main/subscription/subscription.component.ts` | Subscription | R/calc | no | "Refresh" generates due transactions | |
| BUD-1 | Add budget category | `src/app/panels/add/add-budget/add-budget.component.ts` | Budget | C | no | | |
| BUD-2 | Edit/delete budget category | `src/app/panels/info/info-budget/info-budget.component.ts` | Budget | U/D | no | | |
| BUD-3 | Budget dashboard + charts | `src/app/main/budget/budget.component.ts` | Budget vs. actuals | R/calc | no | Account/category filter, custom date range | |
| BUD-4 | Monthly plan — fill forward | `src/app/main/budget/plan/plan.component.ts` (`fill`) | Budget | C (bulk) | no | Copies most recent prior month's rows forward | |
| BUD-5 | Monthly plan — copy from another month | `plan.component.ts` (`copy`) | Budget | C (bulk) | no | | |
| BUD-6 | Monthly plan — import from subscriptions | `plan.component.ts` (`subscriptions`) | Budget | C (calc/bulk) | no | Sums active subscriptions per category/month into budget rows | |
| BUD-7 | Monthly plan — delete month's budget | `plan.component.ts` (`delete`) | Budget | D (bulk) | no | | |
| STATS-1 | KPI cards (savings rate, burn rate, ratios, net worth trend, top categories, heatmap) | `src/app/stats/stats.component.ts` + `charts/kpi-charts.ts` | Transaction/derived | calc | no | Formula-based, all client-side | |
| STATS-2 | Core charts (zoomable, histogram, cashflow bar, category bubble, pie, sankey) | `stats.component.ts` + `charts/core-charts.ts` | Transaction | calc | no | D3-based | |
| STATS-3 | BI Dashboard | `src/app/stats/bi/bi-dashboard.ts` | Transaction | calc | no | Outlier detection, detail table, time filters | |
| STATS-4 | Explorative analytics | `src/app/stats/analytics/explorative.ts` | Transaction | calc | no | Breadcrumb drill-down, search | |
| STATS-5 | Predictive analytics | `src/app/stats/analytics/predictive.ts` | Transaction | calc | no | ARIMA-based forecasting | |
| STATS-6 | Prescriptive analytics / scenario planning | `src/app/stats/analytics/prescriptive.ts` | Transaction | calc | no | "What-if" scenario refresh | |
| STATS-7 | Financial statement + print | `src/app/stats/statement/` | Aggregated | calc/export | no | Period selector, trend arrows, ratio-health coloring; browser print | |
| STATS-8 | Chart search/filter helpers | `stats.component.ts` | Transaction | R/calc | no | | |
| SET-1 | Language switch (en/es/fr/de/cn/ar) | `src/app/panels/settings/settings.component.ts` | User pref | U | no | | Also on landing page |
| SET-2 | Theme switch (light/dark) | `settings.component.ts` | User pref | U | no | | |
| SET-3 | Currency selection | `settings.component.ts` | User pref | U | no | | |
| SET-4 | Date/number format (EU vs. US) | `settings.component.ts` | User pref | U | no | | |
| SET-5 | Daily/Splurge/Smile/Fire allocation % ("60/10/10/20") | `settings.component.ts` (`changeAllocation`, `resetAllocation`) | User pref | U | no | Must sum to 100% (validated in template) | Core budgeting-method business rule |
| SET-6 | Encryption settings (local/database toggle) | `settings.component.ts` (`changeEncryption`), `cryptic.service.ts` | Encryption config | U | yes (`auth.js /encryption-config`) | AES-256-CBC + PBKDF2-SHA256 + HMAC (v2 format), legacy CryptoJS fallback | Selfhosted: key server-stored + sessionStorage cache; Firebase: key in localStorage |
| SET-7 | Backup — CSV export | `settings.component.ts` (`exportTransactionsAsCSV`, etc.) | multiple | export | no | Client-side CSV generation | |
| SET-8 | Full migration export (JSON, all entities + settings + key) | `settings.component.ts` (`exportMigrationData`) | all entities | export | no | Bundles every collection + prefs + encryption key | |
| SET-9 | Migration import (restore from JSON) | `settings.component.ts` (`onImportMigration`) | all entities | import | no | Parses uploaded JSON, restores collections/settings | |
| SET-10 | Personal profile edit | `settings.component.ts` (`editPersonalSettings`) | User profile | U | no (writes to blob at `info/username`, `info/email`) | | |
| SET-11 | Fix / recompute from transactions | `settings.component.ts` (`changeFix`) | derived | calc | no | Recalculates bucket balances from transaction history | |
| SET-12 | Clear local cache | `src/app/panels/profile/profile.component.ts` (`clearStorage`) | local cache | D (local) | no | | |
| PROF-1 | Navigate to Community/About/Auth from profile menu | `profile.component.ts` | n/a | nav | n/a | | |
| MENU-1 | App navigation drawer | `src/app/panels/menu/menu.component.ts`, `choose/choose.component.ts` | n/a | nav | n/a | | |
| COM-1 | Browse community threads | `src/app/community/community.component.ts` | CommunityThread | R | yes (`community.js /threads`) | | |
| COM-2 | Create thread | `community.component.ts` (`submitThread`) | CommunityThread | C | yes (`POST /threads`) | Title ≤120 chars, body ≤5000; rate-limited 20/5min/IP; guests allowed with sanitized display name | |
| COM-3 | View thread + replies | `src/app/community/thread/thread.component.ts` | CommunityThread/Post | R | yes (`/threads/:id`) | | |
| COM-4 | Reply to thread | `thread.component.ts` (`submitReply`) | CommunityPost | C | yes (`POST /threads/:id/posts`) | Same limits as thread creation | |
| COM-5 | React to post (emoji) | `thread.component.ts` (`reactWith`) | CommunityPost | U | yes (`POST /posts/:id/react`) | Fixed emoji set; one reaction per user, replaces previous | |
| COM-6 | Edit thread/reply | `thread.component.ts` | CommunityThread/Post | U | yes (`PUT /threads/:id`, `PUT /posts/:id`) | Author-only | |
| COM-7 | Delete thread/reply | `thread.component.ts` | CommunityThread/Post | D | yes (`DELETE /threads/:id`, `DELETE /posts/:id`) | Author-only, confirm dialog | |
| DOC-1 | Docs / self-hosted docs browsing + copy snippets | `src/app/docs/docs.component.ts`, `docs/selfhosted/` | n/a | R | n/a | | Content is edition-specific but viewable in either build |
| CHANGE-1 | Changelog browsing | `src/app/changelog/changelog.component.ts` | n/a | R | n/a | | |
| LAND-1 | Landing page interactive budget-allocation demo | `src/app/landing/landing-page.component.ts` | n/a (demo) | calc (client-only) | n/a | | Not connected to real account data |
| ONBOARD-1 | Onboarding tour | `src/app/shared/components/onboarding/` | n/a | n/a | n/a | Step-based walkthrough | |
| PWA-1 | Service-worker update prompt | `src/app/shared/components/sw-update/` | n/a | n/a | n/a | | |

## Edition-specific findings

- **Firebase-only:** password-reset email (AUTH-5, no selfhosted route exists), update email (AUTH-6, explicitly rejected in selfhosted mode), Firebase Realtime Database storage path in `database.service.ts`.
- **Selfhosted-only:** guest JWT identity flow for Community (selfhosted has no Firebase anonymous auth); encryption key fetched from/persisted to the backend and cached only in `sessionStorage` (vs. permanent `localStorage` on Firebase); `SelfhostedService.deleteAccount()`/`verifyPassword()` paths.
- No route or component is entirely absent from one build via `angular.json` file-replacement — only `src/environments/environment*.ts` is replaced per configuration, not components. This confirms the ARCHITECTURE.md finding that today's edition separation is a **service-layer runtime switch**, not a build-time tree-shake — directly relevant to designing the Phase 2 `edition-guard` mechanism from scratch rather than extending an existing pattern.
