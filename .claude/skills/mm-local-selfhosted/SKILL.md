---
name: mm-local-selfhosted
description: Bring up, check, reset and tear down a complete local self-hosted Money Manager stack (CouchDB + backend + the real nginx frontend + MCP) on Podman from the working tree, so JFK can test a change in the browser without deploying anything. Use when JFK says "bring up the local environment / local stack / self-hosted locally", "I want to test it locally", or before handing over UI or API work for a manual test.
---

# Local self-hosted test environment

Nothing here deploys anything and nothing is shared with a real server: its own Compose project (`moneylocal`), container names (`mm-local-*`), volume, ports and throwaway secrets. Podman only (there is no `docker` on this machine; `podman compose` uses the Docker Compose v2 provider).

## When JFK asks for it: do this

1. **Make sure the tree is what he wants to test.** `git status` / `git log -1` - tell him the commit the stack is built from. Uncommitted work is built as it is on disk.
2. **Start it** (builds all four images from the working tree, a few minutes the first time, layers are cached afterwards):
   ```powershell
   .\scripts\local-env.ps1 up
   ```
   It starts the Podman machine if needed, waits for CouchDB, the backend and the frontend, applies the 8 MB document limit the real CouchDB has, and prints the URLs. If it prints `NOT READY`, read `.\scripts\local-env.ps1 logs <service>` and fix the cause before telling JFK it is up.
3. **Verify like a user would, not only "container running":** `.\scripts\local-env.ps1 status` must show CouchDB, backend (`/health`) and the app (`/`) answering, and `GET http://localhost:8080/api/auth/...`-style calls must reach the backend through nginx (the proxy is part of what is being tested). Confirm the served build is the self-hosted edition (the app asks for an email/password login, not Firebase).
4. **Hand over** with: the URL, how to log in or register, what to look at (the checklist for the feature, e.g. `todo/cashflow-solo-playtest.md`), how to stop it. Then **wait for his findings** - do not continue feature work until he reports.

| What                                    | Where                                                    |
| --------------------------------------- | -------------------------------------------------------- |
| The app (nginx, self-hosted edition)    | http://localhost:8080                                    |
| API / health                            | http://localhost:13000 , `/health`                       |
| CouchDB (admin / `local-test-password`) | http://localhost:15984/_utils                            |
| MCP server                              | http://localhost:13939 (also proxied at `/mcp` on :8080) |

## The Cashflow game account

An email containing `cashflow` can only be registered with the **game password**. On this stack it is **`localtest`** (the backend gets `CASHFLOW_GAME_PASSWORD_SHA256` of it from `docker-compose.local.yml`). Register through the app's own registration form (simplest, and it is what is being tested). Suggested: `solo@cashflow.test`, any password. Never put the real game password in a file or a message.

## Variants

- **Fast UI iteration** (hot reload, no frontend image): `.\scripts\local-env.ps1 up -Dev`, then in another shell `npm run build:domain; npx ng serve --configuration selfhosted --proxy-config proxy.local.conf.json` and open http://localhost:4200 (the proxy sends `/api` and `/mcp` to the containers). After a change in `packages/domain`, run `npm run build:domain` again.
- **Re-test after code changes:** `.\scripts\local-env.ps1 up` again (rebuilds, keeps the test data). Backend-only change: `podman compose -f docker-compose.local.yml up -d --build backend`.
- **Start over with empty data:** `.\scripts\local-env.ps1 reset` (deletes the CouchDB volume), then `up`.
- **Stop but keep data:** `.\scripts\local-env.ps1 down`. **Is it up:** `.\scripts\local-env.ps1 status`.
- **Safari / testing from a phone on the LAN:** the backend sets secure cookies in `production` mode, which only works on `localhost` in Chrome/Firefox. Set `$env:MM_LOCAL_NODE_ENV = 'development'` before `up`, and use the machine's LAN IP with port 8080 (add that origin to `CORS_ORIGINS` in `docker-compose.local.yml` for the API calls to pass if you call the API directly).

## Backend integration tests are a different stack

`docker-compose.test.yml` (CouchDB only, tmpfs, port 5986) is for `cd backend && COUCHDB_URL=http://localhost:5986 npx jest --forceExit -- tests/integration`. Do not point those tests at this stack - they create and delete records. (Memory: `reference_podman_integration_tests`.)

## Troubleshooting

| Symptom                                                    | Likely cause / fix                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `podman` cannot connect                                    | The machine is stopped: `podman machine start` (the script does this itself)                                                                |
| Port already allocated (8080, 13000, 15984, 13939)         | Another container/process: `podman ps -a`, `Get-NetTCPConnection -LocalPort 8080`; stop it, do not change ports silently                    |
| Frontend container exits at start with a certificate error | The one-shot `certs` service did not run: use `up` (not a bare `up frontend`); it writes the self-signed cert nginx.conf's 8443 block needs |
| Frontend image build is killed / out of memory             | Angular build needs RAM: raise the machine (`podman machine set --memory 6144`, restart) or use the `-Dev` variant                          |
| App loads but login/register fails                         | `logs backend`; check CORS origin matches the URL in the browser; secure-cookie note above                                                  |
| Register says the game password is wrong                   | The password on this stack is `localtest`; if the backend was started before the compose file had it, `up` again                            |
| "Data gone" after a rebuild                                | A failed auth check, not lost data: log in again (memory: `feedback_dev_server_cache`)                                                      |
| Stale UI after a rebuild                                   | The service worker caches the app: hard reload / clear site data for localhost:8080                                                         |

## After JFK's test

Say what he found and which commit it was, fix, rebuild with `up`, ask him to re-test the failed points. If he is done, offer `down` (data kept) or `reset`. Clean up: leave nothing running that he did not ask for (see memory `feedback_test_cleanup`) - ask before leaving the stack up overnight.
