# Local Development

Quick reference for running the app locally — dev server, prod build preview, tests.

## Prerequisites

```powershell
npm install
```

Node 20+ recommended.

---

## Dev server (live reload, NO service worker)

Use this for day-to-day development. Hot module reload, source maps, no PWA caching.

```powershell
npm start
# or: ng serve
```

Open <http://localhost:4200>.

> The service worker is disabled in `ng serve`, so offline features won't kick in. Use the prod preview below to test offline behaviour.

---

## Production build + local preview (service worker ON)

Use this to verify the production bundle, PWA caching, and offline behaviour.

### Firebase mode (default)

```powershell
npm run build
npx http-server dist/money -p 4200 -c-1
```

### Self-hosted mode

```powershell
npm run build:selfhosted
npx http-server dist/money -p 4200 -c-1
```

Flags:

- `-p 4200` — port
- `-c-1` — disable HTTP cache so refreshes pick up new builds (the service worker still does its own caching)

Open <http://localhost:4200>.

> **First load registers the service worker.** After a rebuild, hard-refresh (`Ctrl+Shift+R`) and/or DevTools → Application → Service Workers → **Unregister**, or DevTools → Application → Storage → **Clear site data**, otherwise the old cached chunks will be served.

### Output path note

This project's `angular.json` flattens the build output to `dist/money/` (note the empty `browser` sub-path). Modern Angular defaults to `dist/<name>/browser/`; if you ever change the config, update the `http-server` path accordingly.

---

## Testing offline

1. Run the prod preview above (service worker required for offline).
2. Open the app, log in, let the data load.
3. Toggle offline in **DevTools → Network → Offline** (or use a "Work Offline" extension).
4. Refresh — the app should boot from localStorage cache, show the offline badge bottom-left, and queue any writes to the outbox.
5. Toggle back online — the outbox drains automatically.

---

## Tests

```powershell
npm test                  # frontend unit tests (Jest)
npm run test:watch        # watch mode
npm run test:coverage     # with coverage
npm run test:backend      # backend tests
npm run test:backend:unit # backend unit tests only
npm run test:all          # frontend + backend unit
npm run test:e2e          # Playwright E2E (needs the app running)
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:full     # spins up the full env then runs E2E
```

---

## Backend (self-hosted mode only)

```powershell
cd backend
npm install
npm start                 # node server.js
```

Default port is set in `backend/server.js`. The frontend self-hosted config points at it via `src/environments/environment.selfhosted.ts`.

---

## Common gotchas

- **Refreshes show stale UI / "always offline"** → service worker is serving old chunks. Unregister it (DevTools → Application → Service Workers) or **Clear site data**.
- **`ng serve` exits with code 1** → port 4200 is already taken (e.g. by `http-server`). Stop it or pick another: `ng serve --port 4300`.
- **Prod build path mismatch** — this project's `angular.json` outputs to `dist/money/` directly. If you serve the wrong folder you'll get `404 "Not found"` from `http-server`.
- **Offline badge doesn't appear** → the badge is rendered by `OfflineIndicatorComponent`, fixed position bottom-left. Check `connectivity.online$` is firing — see `connectivity.service.ts`.
