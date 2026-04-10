# Testing Guide

How to run, write, and debug tests in the Money App.

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm test` | Frontend unit tests (Jest) |
| `npm run test:watch` | Frontend tests in watch mode |
| `npm run test:coverage` | Frontend tests + coverage report |
| `npm run test:backend:unit` | Backend unit tests (no DB needed) |
| `npm run test:backend:watch` | Backend unit tests in watch mode |
| `npm run test:backend` | All backend tests (unit + integration, needs CouchDB) |
| `npm run test:all` | Frontend + backend unit tests |
| `npm run test:pipeline` | Full CI-equivalent pipeline (unit + integration + E2E) |
| `npm run test:e2e` | Playwright E2E (needs E2E stack running) |
| `npm run test:e2e:headed` | E2E with visible browser |
| `npm run test:e2e:ui` | Playwright interactive UI mode |
| `npm run test:e2e:full` | Start E2E stack, run tests, tear down |

## Running Tests Locally

### Frontend unit tests

```bash
npm test                                    # run all
npm test -- --testPathPattern="home"        # run tests matching "home"
npm run test:watch                          # re-run on file changes
```

### Backend unit tests

```bash
npm run test:backend:unit                   # run all (no DB needed)
npm run test:backend:watch                  # watch mode
```

### Backend integration tests (needs CouchDB)

```powershell
.\scripts\test-env-up.ps1                   # start test CouchDB on port 5986
npm run test:backend                        # run unit + integration
.\scripts\test-env-down.ps1                 # tear down
```

### E2E tests (needs full stack)

```powershell
npm run test:e2e:full                       # one-command: start stack → test → tear down
# OR manually:
.\scripts\test-env-up.ps1                   # if not already running
podman compose -f docker-compose.e2e.yml up -d --build
npm run test:e2e                            # run Playwright
podman compose -f docker-compose.e2e.yml down -v
```

### Full pipeline (mirrors CI)

```powershell
.\scripts\test-all.ps1                      # runs all 4 stages sequentially
.\scripts\test-all.ps1 -SkipE2E             # skip E2E (faster iteration)
.\scripts\test-all.ps1 -SkipIntegration     # skip integration (no Podman needed)
```

## Writing a New Test

### Frontend component test

1. Copy `templates/component.spec.template.ts` to your component directory
2. Rename to `<component-name>.component.spec.ts`
3. Replace all `TODO` placeholders
4. Run: `npm test -- --testPathPattern="<component-name>"`

### Frontend service test

1. Copy `templates/service.spec.template.ts` next to the service file
2. Rename to `<service-name>.service.spec.ts`
3. Replace all `TODO` placeholders
4. Run: `npm test -- --testPathPattern="<service-name>"`

### Backend route / unit test

1. Copy `templates/backend-route.test.template.js` to `backend/tests/unit/` or `backend/tests/integration/`
2. Rename to `<feature>.test.js`
3. Replace all `TODO` placeholders
4. Run: `npm run test:backend:unit`

### E2E test

1. Create `e2e/<feature>.spec.ts`
2. Use helpers from `e2e/helpers/auth.helper.ts` (register, login, navigate, openMenu, openAddPanel)
3. Use test data from `e2e/fixtures/test-data.ts`
4. Run: `npm run test:e2e -- --grep "<test name>"`

## Test File Locations

```
src/app/**/<name>.spec.ts              Frontend unit tests (Angular convention)
backend/tests/unit/<module>.test.js    Backend unit tests (pure, no DB)
backend/tests/integration/<feat>.test.js  Backend integration tests (needs CouchDB)
e2e/<feature>.spec.ts                  E2E tests (Playwright)
templates/                             Copy-paste starter templates
```

## Naming Conventions

- **describe** blocks: component/service/function name → `describe('MyComponent', ...)`
- **nested describe**: method or scenario → `describe('myMethod()', ...)`
- **it** blocks: behavior statement → `it('should return 0 for empty input', ...)`
- Test files mirror source files: `my.component.ts` → `my.component.spec.ts`

## When to Mock vs. Real Dependencies

| Use mock when... | Use real when... |
|-----------------|-----------------|
| Testing component logic in isolation | Testing service integration |
| External API calls (HTTP, DB) | Pure utility functions |
| Slow or nondeterministic operations | Simple data transformations |
| Cross-cutting concerns (auth, logging) | In E2E tests (always real) |

### Common mocks in this project

- `DatabaseService` → `{ useValue: {} }` (components don't call DB directly)
- `PersistenceService` → `jest.Mocked<Partial<PersistenceService>>` with `writeAndSync: jest.fn()`
- `FIREBASE_OPTIONS` → `{ projectId: 'test', appId: 'test', apiKey: 'test' }`
- `AppStateService` → reset via `(AppStateService as any)._instance = undefined` in `beforeEach`

## Pre-commit Hooks

Husky runs `lint-staged` on every commit:
- **`src/**/*.ts`** changes → runs related frontend Jest tests
- **`backend/**/*.js`** changes → runs backend unit tests

To bypass in emergencies: `git commit --no-verify -m "message"`

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on every PR to `main`:
1. Frontend Unit Tests
2. Backend Unit Tests
3. Backend Integration Tests (with CouchDB service container)
4. E2E Tests (Docker Compose stack + Playwright) — only runs after steps 1-3 pass

All 4 jobs must pass before a PR can be merged.

---

## Performance Tests

Performance regression tests verify that the selfhosted optimizations (batch-read, ETag caching, tiered loading) stay fast.

### Backend performance benchmark

Located in `backend/tests/unit/batch-read.test.js` under the `Performance: batch-read vs individual reads` describe block.

```bash
npm run test:backend:unit    # runs with the rest of the backend unit tests
```

What it tests:
- **Batch-read is faster than 19 individual reads** — a single `POST /api/data/read/batch` with all 19 paths must complete faster than 19 sequential `GET` requests, and under 200ms (mocked DB).
- **Data equivalence** — batch-read returns the same data as 19 individual reads combined.

### E2E performance tests (Playwright)

Located in `e2e/performance.spec.ts`. Requires the full E2E stack.

```bash
npm run test:e2e -- --grep "Performance"
```

What it tests:
- **Time-to-interactive after login** — app shell (`#heading`) must appear within 10 seconds (generous for CI; target is <3s on Pi).
- **Reload time** — page reload must be interactive within 10 seconds.
- **HTTP request count** — initial load must use at most 2 batch-read requests and 0 individual `/api/data/read/*` requests (verifies that the 19-request pattern does not regress).

### Visibility-change test

Located in `e2e/persistence.spec.ts` (the `tab-back (visibilitychange)` test).

What it tests:
- Dispatching a `visibilitychange` event (simulating tab-back) triggers at most 1 batch-read request, not 19 individual reads.

### Key metrics to track on real hardware

When deploying to a Raspberry Pi, measure these before and after:

| Metric | How to measure | Target |
|--------|---------------|--------|
| Time to interactive | Browser DevTools → Performance tab | < 1s (Tier 1) |
| Total HTTP requests on load | Browser DevTools → Network tab | 1-2 (batch-read) |
| HTTP requests on tab-back | Network tab after tab-out/tab-back | 0-1 |
| Container memory usage | `podman stats --no-stream` | < 700 MB total |
| Backend response time | `curl -w "%{time_total}" -X POST .../api/data/read/batch` | < 200ms |
