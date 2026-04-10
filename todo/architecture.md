# Self-Hosted Performance Redesign — Architecture Strategy

**Date:** 2026-03-29  
**Meeting:** CEO, Architect, Lead Engineer, QA  
**Problem:** Self-hosted mode on Raspberry Pi has 2-3+ second load delays on page reload. Customers reverting to Firebase mode.  
**Scope:** Self-hosted (CouchDB/backend) only. Firebase mode is performant — no changes unless a shared refactor makes sense to do in one go.

---

## 1. Current State Analysis

### 1.1 The Core Problem: 19 Individual HTTP Requests on Every Page Load

When the app loads (or user tabs back), `AppDataService.loadFromDB()` fires **19 parallel HTTP requests** to the backend:

| # | Endpoint | Data | Used By |
|---|----------|------|---------|
| 1 | `/api/data/read/transactions` | All transactions | Home, Accounting, Cashflow, Stats, all Panels |
| 2 | `/api/data/read/subscriptions` | All subscriptions | Subscription page, auto-processing |
| 3 | `/api/data/read/income/revenue/revenues` | Revenue items | Income, Cashflow |
| 4 | `/api/data/read/income/revenue/interests` | Interest items | Income, Cashflow |
| 5 | `/api/data/read/income/revenue/properties` | Property items | Income, Cashflow |
| 6 | `/api/data/read/income/expenses/daily` | Daily expenses | Daily, Cashflow |
| 7 | `/api/data/read/income/expenses/splurge` | Splurge expenses | Splurge, Cashflow |
| 8 | `/api/data/read/income/expenses/smile` | Smile expenses | Smile, Cashflow |
| 9 | `/api/data/read/income/expenses/fire` | Fire expenses | Fire, Cashflow |
| 10 | `/api/data/read/income/expenses/mojo` | Mojo expenses | Fire component |
| 11 | `/api/data/read/balance/asset/assets` | Assets | Balance |
| 12 | `/api/data/read/balance/asset/shares` | Shares | Balance |
| 13 | `/api/data/read/balance/asset/investments` | Investments | Balance |
| 14 | `/api/data/read/balance/liabilities` | Liabilities | Balance, Grow |
| 15 | `/api/data/read/smile` | Smile projects | Smile projects page |
| 16 | `/api/data/read/fire` | Fire emergencies | Fire emergencies page |
| 17 | `/api/data/read/mojo` | Mojo target/amount | Fire component |
| 18 | `/api/data/read/budget` | Budget entries | Budget, Plan |
| 19 | `/api/data/read/grow` | Grow projects | Grow page |

**Each request goes through:** TCP handshake → JWT verification → CouchDB document read → JSON serialization → response. On a Raspberry Pi, that's **19× the overhead** of a single read.

**Critical fact:** All 19 paths read from the **same single CouchDB document** (`users/{userId}`). We're making 19 HTTP calls to read different nested properties of one document. The backend reads the full document every time and extracts the requested path.

### 1.2 Deployment Stack Overhead

The current Docker/K8s stack runs **6 containers** on the Raspberry Pi:

| Container | Memory (K8s limit) | CPU (K8s limit) | Always needed? |
|-----------|-------------------|-----------------|----------------|
| **CouchDB** | 512Mi | 500m | YES |
| **Backend (Node.js)** | 256Mi × 2 replicas | 200m × 2 | YES (but 1 replica) |
| **Frontend (Nginx)** | 128Mi × 2 replicas | 100m × 2 | YES (but 1 replica) |
| **Loki** | unlimited | unlimited | NO — debugging only |
| **Promtail** | unlimited | unlimited | NO — debugging only |
| **Grafana** | unlimited | unlimited | NO — debugging only |

**Total baseline:** ~1.5GB+ memory consumed. The Pi 4 has **4GB RAM with no swap**.  
**With logging disabled:** ~638MB — nearly halving resource usage and leaving 1.7GB headroom.

### 1.3 Additional Performance Issues

1. **No response compression** — Nginx config has `sendfile on` but no `gzip` directives for API proxy responses. Large transaction arrays sent uncompressed.
2. **Client-side per-field decryption** — Every field of every record decrypted individually in a `for` loop. 500 transactions = 3000 `decrypt()` calls.
3. **`visibilitychange` triggers full reload** — Every time user tabs back, all 19 requests fire again.
4. **Rate limiter overhead** — 100 req/15min rate limiter runs even when `SKIP_RATE_LIMIT` not set in Docker, adding middleware processing.
5. **CacheService has 5-min TTL but cache is cleared on every `loadFromDB()`** — `database.clearReadCache()` is called first, defeating the cache purpose on reload.
6. **No batch-read endpoint** — A `/api/data/write/batch` exists for writes, but there's no batch-read equivalent. The `GET /api/data/document` endpoint exists and returns the entire document but is unused by the frontend.
7. **2 replicas of frontend + backend** in K8s — unnecessary for a single-user Raspberry Pi. Doubles memory usage.
8. **Helmet, CORS, body-parser (10MB), Winston logging middleware** all run on every request — adds CPU overhead on a constrained device.

---

## 2. Architecture Redesign Strategy

### 2.1 Tiered Data Loading (The Big Win)

Replace the 19-request eager-load with a **3-tier loading strategy**:

#### Tier 1 — Critical Path (blocks UI, loaded on startup)
Loaded immediately on auth. User sees the app **only after these resolve**.

| Data | Reason |
|------|--------|
| `transactions` | Powers Home, Accounting, all expense views, statistics |
| `subscriptions` | Needed for subscription processing before UI renders |
| `income/revenue/*` (revenues, interests, properties) | Powers income statement recalculation |
| `income/expenses/*` (daily, splurge, smile, fire, mojo) | Powers Home page percentage display |

**Implementation:** Single new backend endpoint `GET /api/data/read/batch` that accepts a list of paths and returns all in ONE CouchDB document read + ONE HTTP response.

#### Tier 2 — Deferred (loaded async after UI renders, non-blocking)
Loaded after UI is visible. Data appears as it arrives. User can interact immediately.

| Data | Reason |
|------|--------|
| `smile` (projects) | Only needed on Smile Projects page |
| `fire` (emergencies) | Only needed on Fire Emergencies page |
| `mojo` | Only needed on Fire component |
| `budget` | Only needed on Budget/Plan page |

**Implementation:** Loaded via a second batch-read call after Tier 1 resolves. Components show a skeleton/spinner until data arrives.

#### Tier 3 — On-Demand (loaded when user navigates to the page)
Only fetched when the user actually opens the relevant page.

| Data | Reason |
|------|--------|
| `grow` (projects) | Complex object, only on Grow page, rarely visited |
| `balance/asset/assets` | Only on Balance page |
| `balance/asset/shares` | Only on Balance page |
| `balance/asset/investments` | Only on Balance page |
| `balance/liabilities` | Only on Balance + Grow page |

**Implementation:** Components trigger a load on `ngOnInit()` if data isn't already in AppState. New `AppDataService.loadOnDemand(paths[])` method.

#### Expected Impact

| Scenario | Before | After (estimate) |
|----------|--------|-------------------|
| Initial page load (HTTP calls) | 19 requests | 1 request (Tier 1 batch) |
| Time to interactive | 2-3+ seconds | < 1 second target |
| Subsequent page loads | 19 requests (cache cleared) | 0 (use cached AppState + localStorage) |
| Tab-back reload | 19 requests | 1 request (Tier 1 only, Tier 2/3 cached) |

### 2.2 New Backend Endpoint: Batch Read

```
POST /api/data/read/batch
Authorization: Bearer {token}
Body: { "paths": ["transactions", "subscriptions", "income/revenue/revenues", ...] }
Response: { "transactions": [...], "subscriptions": [...], ... }
```

**Implementation detail:** Backend reads the user's CouchDB document ONCE, extracts requested paths, returns them all in one response. This turns 19 CouchDB reads into 1.

### 2.3 Smarter Reload on Visibility Change

Replace the full 19-request reload with:
1. Check a lightweight `GET /api/data/read/updatedAt` timestamp
2. If `updatedAt > local timestamp` → reload Tier 1 only
3. If unchanged → skip reload entirely (data is already fresh)

### 2.4 Response Compression

Add gzip compression to Nginx for API proxy responses:
```nginx
gzip on;
gzip_types application/json text/plain;
gzip_min_length 1024;
gzip_proxied any;
```

Transaction arrays can be 50-200KB+ — gzip typically achieves 80-90% compression on JSON.

### 2.5 Bulk Decryption Optimization

Current: Per-field `decrypt()` in a loop (N records × M fields = N×M calls).  
Proposed: Batch decrypt function that processes the entire array server-side or in a single optimized pass. Consider moving decryption to the backend (return decrypted data over HTTPS) to offload the browser.

---

## 3. Deployment Stack Optimization

### 3.1 Minimal Stack (Default)

The default self-hosted deployment should only run **3 containers**:

| Container | Purpose | Required |
|-----------|---------|----------|
| CouchDB | Database | YES |
| Backend | API | YES |
| Frontend | Nginx + SPA | YES |

### 3.2 Debug Stack (On-Demand)

Loki, Promtail, and Grafana should be in a **separate docker-compose override** or behind a flag:

```bash
# Normal operation (minimal resources)
docker-compose up -d

# When debugging is needed
docker-compose -f docker-compose.yml -f docker-compose.logging.yml up -d

# Done debugging, free resources
docker-compose -f docker-compose.yml -f docker-compose.logging.yml down
# Then: docker-compose up -d
```

### 3.3 K8s Resource Right-Sizing

| Container | Current | Proposed |
|-----------|---------|----------|
| Backend | 2 replicas, 256Mi each | **1 replica**, 192Mi |
| Frontend | 2 replicas, 128Mi each | **1 replica**, 96Mi |
| CouchDB | 1 replica, 512Mi | 1 replica, **384Mi** |
| Loki/Promtail/Grafana | Always on | **Disabled by default** |

**Estimated total memory:** ~672Mi down from ~1.5GB+ (55% reduction)

### 3.4 Backend Middleware Optimization

For Raspberry Pi, strip unnecessary middleware:
- **Remove Helmet** in production behind reverse proxy (Nginx/Traefik already sets headers)
- **Remove rate limiter** when `SKIP_RATE_LIMIT=true` (already supported, ensure it's default in Pi config)
- **Reduce body-parser limit** from 10MB to 2MB (realistic for personal finance data)
- **Conditional logging** — reduce Winston log level to `warn` in production; verbose logging only in debug mode

---

## 4. Firebase Considerations

Firebase mode is performant — **no changes needed now**. However, the Tier 1/2/3 refactor in `AppDataService.loadFromDB()` should be done with **both modes in mind**:

- The `DatabaseService` abstraction already branches on `environment.mode`
- The batch-read endpoint is selfhosted-only; Firebase uses its native batching
- For Firebase: the same tiered `Promise` grouping can be applied (Tier 1 first, Tier 2 after, Tier 3 on-demand) — this won't hurt Firebase performance but keeps the code unified
- **Recommendation:** Implement the tiered loading in a mode-agnostic way. If Firebase performance ever degrades, the architecture is already in place.

---

## 5. Server Diagnostics Needed

To properly size the optimizations, we need the following from the Raspberry Pi:

### Collected Diagnostics (2026-03-29)

| Metric | Value | Assessment |
|--------|-------|------------|
| **Pi model** | Raspberry Pi 4, 4GB RAM | Mid-range — workable |
| **Memory** | 3.7Gi total, 1.4Gi used (OS only), 2.3Gi available | Tight when 6 containers run (~1.5GB+) |
| **Disk** | 117GB SSD, 11% used (101GB free) | **SSD — not the bottleneck** |
| **Temperature** | 38.9°C | Cool, no thermal throttling |
| **Containers** | None running at time of check (Podman) | Need to measure under load |
| **Swap** | **NONE configured** | **RISK: OOM kill if memory exceeds 3.7GB** |
| **Container runtime** | **Podman** (not Docker) | Deployment scripts need `podman-compose` |

**Critical insight:** With no swap and only 2.3GB free (OS idle), running 6 containers (CouchDB 512Mi + Backend 256Mi×2 + Frontend 128Mi×2 + Loki + Promtail + Grafana) will push memory to the limit. This confirms the logging stack MUST be disabled by default.

**Revised memory budget (with logging disabled, 1 replica each):**
| Container | Budget |
|-----------|--------|
| CouchDB | ~350Mi |
| Backend | ~192Mi |
| Frontend (Nginx) | ~96Mi |
| **Total app** | **~638Mi** |
| OS baseline | ~1.4Gi |
| **Grand total** | **~2.0Gi** |
| **Headroom** | **~1.7Gi free** |

With logging enabled it would be ~2.5Gi+ leaving <1.2Gi free — risky for spikes.

### Still Needed (measure when containers are running)
- [ ] **CouchDB document size:** `curl http://localhost:5984/users` (the `disk_size` field)
- [ ] **Number of transactions** for a typical user (rough count)
- [ ] **Backend response time** under load: `curl -w "%{time_total}" http://localhost:3000/api/data/read/transactions -H "Authorization: Bearer ..."`
- [ ] **Podman stats under load:** `podman stats --no-stream` while app is running
- [ ] Consider adding 1GB swap file as safety net: `sudo fallocate -l 1G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`

---

## 6. Testing Strategy Adaptation (QA)

### 6.1 New Tests Required

#### Backend Unit Tests
- [x] Test new `POST /api/data/read/batch` endpoint — returns correct paths
- [x] Test batch-read with missing paths (graceful null)
- [x] Test batch-read with unauthorized access
- [x] Test batch-read performance with large datasets (compare to N individual reads)

#### Backend Integration Tests
- [x] Integration test: batch-read returns same data as individual reads
- [x] Integration test: `updatedAt` timestamp updates on write, not on read

#### Frontend Unit Tests
- [x] Test `AppDataService.loadFromDB()` with tiered loading (Tier 1 resolves first)
- [x] Test Tier 3 on-demand loading triggers on component init
- [x] Test visibility-change handler checks `updatedAt` before reloading
- [x] Test components handle skeleton/loading state when Tier 2/3 data hasn't arrived

#### E2E Tests (Playwright)
- [x] Verify app loads and is interactive within target time
- [ ] Verify Tier 3 pages (Grow, Balance) show loading state then data
- [x] Verify tab-out and tab-back doesn't cause full reload when data unchanged
- [x] Add performance timing assertions for selfhosted mode

### 6.2 Existing Test Modifications

- [x] Update `app-data.service.spec.ts` — `loadFromDB()` signature changes
- [x] Update `database.service.spec.ts` — add batch-read mock
- [x] Update E2E data fixtures if loading behavior changes
- [x] Update `persistence.spec.ts` if the visibility-change handler changes

### 6.3 Performance Regression Tests (New)

- [x] Add Playwright test that measures time-to-interactive on reload
- [x] Backend benchmark test: batch-read vs 19 individual reads (assert batch < 200ms)
- [ ] Log total load time in frontend logger for ongoing monitoring

---

## 7. Action Items — Prioritized Execution Plan

### Phase 1: Quick Wins (No Architecture Change) — Est. Low Risk
- [x] **1.0** Add 1GB swap file on the Pi as OOM safety net (`fallocate + mkswap + swapon + fstab`)
  - Run on Pi: `sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
  - Persist: `echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`
- [x] **1.1** Split `docker-compose.yml` into base + logging overlay → immediately free ~800MB RAM
  - Created `docker-compose.logging.yml` overlay
  - Base `docker-compose.yml` now runs only CouchDB + Backend + Frontend
- [x] **1.2** Reduce K8s replicas to 1 for frontend + backend
  - `k8s/backend.yaml`: 2 → 1 replica, memory limit 256Mi → 192Mi
  - `k8s/frontend.yaml`: 2 → 1 replica, memory limit 128Mi → 96Mi
- [x] **1.3** Add gzip compression to `nginx.conf` for API responses
  - Added `gzip on` with `application/json`, `text/plain`, `application/javascript`, `text/css`
- [x] **1.4** Set backend `LOG_LEVEL=warn` in production config
  - `docker-compose.yml`: added `LOG_LEVEL=warn` + `SKIP_RATE_LIMIT=true`
  - `k8s/backend.yaml`: added `LOG_LEVEL: "warn"` to ConfigMap + env mapping
  - Logging overlay overrides to `LOG_LEVEL=info` when debugging
- [x] **1.5** Reduce body-parser limit from 10MB to 2MB
  - `backend/server.js`: `express.json` and `express.text` limits 10mb → 2mb
- [x] **1.6** Verify Podman compatibility — deploy scripts already use Podman + K8s
  - `deploy-local.ps1` and `deploy.sh` already use `podman` for builds
  - `docker-compose.yml` format is Podman-compatible (`podman-compose` reads it natively)
- [ ] **1.7** Collect remaining diagnostics (CouchDB doc size, response times) once containers are running

### Phase 2: Backend Batch Read — The Big Win
- [x] **2.1** Implement `POST /api/data/read/batch` endpoint in `backend/routes/data.js`
  - Reads CouchDB doc ONCE, extracts all requested paths, returns in single response
  - Validates: array required, non-empty, max 50 paths, skips non-strings
  - Returns `{ data: { path: value, ... }, updatedAt: "..." }`
  - Graceful 404 handling (returns nulls for all paths if user doc missing)
- [x] **2.2** Write backend unit + integration tests for batch-read
  - 14 unit tests (mocked DB): `backend/tests/unit/batch-read.test.js`
  - 10 integration tests (real CouchDB): `backend/tests/integration/batch-read.test.js`
  - Covers: happy path, nested paths, missing paths, auth, validation, tier-1 all-at-once, consistency with individual reads, updatedAt behavior
- [x] **2.3** Add `GET /api/data/updatedAt` lightweight endpoint + `updatedAt` in batch response
  - `GET /api/data/updatedAt` — returns only `{ updatedAt }`, no data payload
  - Batch-read response includes `updatedAt` in every response
  - Tests verify: timestamp updates on write, NOT on read

### Phase 3: Frontend Tiered Loading — Architecture Change
- [x] **3.1** Refactor `AppDataService.loadFromDB()` into `loadTier1()`, `loadTier2()`, `loadTier3OnDemand(paths[])`
- [x] **3.2** `loadTier1()` calls batch-read with critical paths → blocks UI
- [x] **3.3** `loadTier2()` called after Tier 1 resolves → non-blocking, updates components
- [x] **3.4** Add `loadOnDemand()` to `AppDataService` → called by Grow, Balance components on `ngOnInit()`
- [x] **3.5** Add loading/skeleton state to Tier 2 and Tier 3 components
- [x] **3.6** Refactor `visibilitychange` handler: check `updatedAt` → only reload Tier 1 if changed
- [x] **3.7** Update all frontend unit tests for new loading behavior
- [x] **3.8** Keep Firebase mode working — test both modes

### Phase 4: Additional Optimizations
- [x] **4.1** ~~Evaluate moving decryption to backend~~ — **Skipped:** keeping client-side encryption preserves zero-knowledge architecture (server never sees plaintext)
- [x] **4.2** Add ETags or `If-None-Match` support on backend reads for caching
- [x] **4.3** ~~Consider backend-side income statement recalculation~~ — **Skipped:** requires server-side decryption, conflicts with zero-knowledge model
- [x] **4.4** Optimize CouchDB: auto-compaction config, connection limits, max doc size

### Phase 5: QA Validation & Testing
- [x] **5.1** Write all new tests from Section 6.1
- [x] **5.2** Update existing tests from Section 6.2
- [x] **5.3** Implement performance regression tests from Section 6.3
- [ ] **5.4** Full E2E test run in selfhosted mode on actual Raspberry Pi hardware
- [ ] **5.5** Compare before/after metrics: load time, memory usage, request count

### Phase 6: Documentation & Deployment
- [x] **6.1** Update `docs/SELFHOSTED.md` with minimal vs debug stack instructions
- [x] **6.2** Update `docker-compose.yml` and K8s manifests
- [x] **6.3** Add performance section to `TESTING.md` covering new perf tests
- [ ] **6.4** Deploy to Pi, validate with real user data, measure improvements

---

## 8. Architecture Diagram — Target State

```
                        PAGE LOAD
                            │
                    ┌───────▼────────┐
                    │  Auth Check    │
                    └───────┬────────┘
                            │ authenticated
                    ┌───────▼────────┐
                    │  localStorage  │──► Instant UI render (stale-while-revalidate)
                    │  → AppState    │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐         ┌─────────────────────┐
                    │  TIER 1 LOAD   │────────►│  POST /batch-read   │
                    │  (1 request)   │         │  1 CouchDB read     │
                    │                │◄────────│  1 HTTP response    │
                    │ transactions   │         └─────────────────────┘
                    │ subscriptions  │
                    │ income/*       │
                    │ expenses/*     │
                    └───────┬────────┘
                            │ UI unblocked
                    ┌───────▼────────┐         ┌─────────────────────┐
                    │  TIER 2 LOAD   │────────►│  POST /batch-read   │
                    │  (background)  │         │  reuses doc cache   │
                    │                │◄────────│  1 HTTP response    │
                    │ smile, fire    │         └─────────────────────┘
                    │ mojo, budget   │
                    └───────┬────────┘
                            │
                            ▼ user navigates to Grow/Balance
                    ┌────────────────┐         ┌─────────────────────┐
                    │  TIER 3 LOAD   │────────►│  POST /batch-read   │
                    │  (on-demand)   │         │  or single GET      │
                    │                │◄────────│  1 HTTP response    │
                    │ grow, assets   │         └─────────────────────┘
                    │ shares, invest │
                    │ liabilities    │
                    └────────────────┘


TARGET DEPLOYMENT STACK (Raspberry Pi):

    ┌─────────────────────────────────────────┐
    │           Raspberry Pi                   │
    │                                          │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
    │  │ Frontend  │ │ Backend  │ │ CouchDB  │ │
    │  │ (Nginx)   │ │ (Node)   │ │          │ │
    │  │ ~96Mi     │ │ ~192Mi   │ │ ~384Mi   │ │
    │  └──────────┘ └──────────┘ └──────────┘ │
    │                                          │
    │  Total: ~672Mi (default)                 │
    │                                          │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
    │  │ Loki     │ │ Promtail │ │ Grafana  │ │  ← Optional debug
    │  │ (opt)    │ │ (opt)    │ │ (opt)    │ │    overlay only
    │  └──────────┘ └──────────┘ └──────────┘ │
    └─────────────────────────────────────────┘
```

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Batch-read endpoint returns too much data | Slow response | Paths are explicit — only requested data returned |
| Tier 3 components show empty state before navigation | Minor UX issue | Skeleton loading states with smooth transition |
| Firebase mode breaks during refactor | Users lose access | Test both modes at every step; Firebase paths kept separate |
| CouchDB runs out of memory on Pi | App crashes | Reduced to 350Mi; **add 1GB swap file as safety net** |
| No swap configured | OOM kill on memory spike | Add swap file before deploying (Phase 1) |
| localStorage grows too large | Browser quota hit | Already encrypted; consider TTL cleanup for old data |
| Decryption move to backend exposes plaintext in transit | Security | Only over HTTPS; encryption at rest in CouchDB preserved |

---

## 10. Success Criteria

- [ ] Page load from cold reload < **1 second** to interactive (Tier 1 data visible)
- [ ] Total memory usage < **700MB** in default deployment
- [ ] Only **3 containers** running in default mode
- [ ] No regression in Firebase mode performance
- [ ] All existing E2E tests pass
- [ ] New performance regression test in CI pipeline
- [ ] `visibilitychange` triggers ≤ 1 HTTP request (vs 19 today)
