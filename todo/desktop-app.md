# Desktop app (Windows first)

Decision record: `docs/adr/0009-desktop-app-shell.md`. Self-hosted / Pro only. Unsigned, per-user NSIS installer, no MSIX. Audience for now: JFK on his own devices.

## Decisions taken

| #   | Decision                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tauri 2 shell around the existing Angular app, not native UIs per OS                                                                                                      |
| 2   | Windows 10 (1809+) and 11, x64 first                                                                                                                                      |
| 3   | Per-user NSIS installer, no admin rights                                                                                                                                  |
| 4   | No MSIX / Microsoft Store                                                                                                                                                 |
| 5   | Unsigned until the app is opened to others                                                                                                                                |
| 6   | Installers published as GitHub Release assets, not committed into git                                                                                                     |
| 7   | Firebase edition untouched; desktop code never in the Firebase build (ADR-0004)                                                                                           |
| 8   | Order: Stage 1 (thin shell) first, then Stage 2 (bundled build)                                                                                                           |
| 9   | Desktop installer is built automatically on every merge to `main` that produces a release, as a second workflow chained behind `auto-release.yml` (which is not modified) |

## Phase 0 — prerequisites (JFK's machine)

- [ ] Install Rust (rustup, MSVC toolchain) and Visual Studio Build Tools (C++ workload)
- [ ] Confirm WebView2 runtime present (it is on Windows 11)
- [ ] Local self-hosted stack running (`mm-local-selfhosted` skill) to point the app at

## Phase 1 — thin-shell spike (stage 1)

- [ ] `src-tauri/` scaffold (Tauri 2), app id, name, icon from existing app icon
- [ ] Window loads a configurable server URL (default the local stack on :8080)
- [ ] Build an unsigned per-user NSIS installer: `npm run desktop:build`
- [ ] Manual test on Windows 11: install, login, add a transaction, close/reopen, uninstall
- [ ] Decision point: is thin shell enough, or do we need stage 2?

## Phase 2 — bundled build (stage 2, only if needed)

> **Blocker found 2026-10-14:** the backend sets the login cookies `httpOnly` + `SameSite=Strict` (`backend/routes/auth.js` COOKIE_OPTIONS) and the web app relies on them (`withCredentials` in `auth.interceptor.ts`). A bundled app is served from `http://tauri.localhost`, a different site from the server, so the browser engine would neither store nor send those cookies. Fixing it means one of: (a) loosening cookies to `SameSite=None; Secure` (weakens the web edition's CSRF posture, needs HTTPS), (b) routing all API calls through Tauri's native HTTP client with its own cookie jar (new HTTP layer in the Angular app), or (c) a token-based login path for the desktop (new backend auth flow). Each is a security-relevant change. Stage 1 avoids all of it because it runs on the server's own origin. Decide whether Stage 2 is worth it before starting.

- [ ] `desktop` Angular configuration reusing the self-hosted routes and environment, with `apiUrl` taken at runtime from stored server URL
- [ ] First-run "connect to your server" screen (URL + health check against the backend)
- [ ] Backend: add `http://tauri.localhost` to `CORS_ORIGINS` in the self-hosted compose/k8s config (or use `tauri-plugin-http`)
- [ ] `edition-guard` run on the Firebase build to prove no desktop/Tauri code leaked
- [ ] Token / session storage in Windows Credential Manager instead of webview storage
- [ ] API version compatibility check on connect (`/api/v1` version vs. app version)

## Phase 3 — release pipeline

- [x] `.github/workflows/desktop-release.yml`: `on: workflow_run` (workflows: ["Auto Release"], types: completed, only if conclusion is success) plus `workflow_dispatch`; Windows runner
- [x] Gate step: checkout `main`, run only if HEAD is tagged `vX.Y.Z` (a release happened); otherwise exit. Do not build on the skipped `chore(release)` re-run
- [x] Build the installer at the release version and attach it to the existing GitHub Release `vX.Y.Z` (`softprops/action-gh-release`, `tag_name: vX.Y.Z`)
- [x] `auto-release.yml` stays untouched (CLAUDE.md "ask before" file); the Firebase deploy and version bump are unchanged
- [x] Windows build verified on a GitHub runner (develop push, 2026-10-14): installer artifact produced
- [ ] The workflow runs only as part of the merge to `main` (no `develop` trigger, by decision): the first real release is the first test of the macOS build and of the release attach. If a job fails, fix it and re-run it from the Actions tab (manual run works once the file is on `main`)
- [x] Failure of the desktop job must not affect the Firebase deploy (separate workflow, so it can't)
- [x] `docs/DESKTOP.md`: how to install, SmartScreen "More info → Run anyway", how to update (install over the old version)
- [x] CLAUDE.md pointer + repo map entry for `src-tauri/`

## Phase 4 — macOS

- [x] Same Tauri project, macOS runner in the workflow, universal DMG (`npm run desktop:build:mac`), ad-hoc signed, ATS allows plain-http servers, Edit menu for copy/paste
- [ ] Verify on a real Mac: DMG installs, first-run connect page, login persists, Change server (Cmd+Shift+S)
- [ ] Unsigned macOS apps are blocked by Gatekeeper (right-click → Open); document it. Needs an Apple Developer account ($99/yr) to avoid that

## Later — Android / iOS

Tauri 2 mobile or Capacitor; decide when Windows and macOS are stable.

## If we open it up to other users — must deliver

- [ ] Code signing. As an individual in Germany, Azure Artifact Signing is not available (individuals: US/Canada only); use an OV certificate with cloud signing (Certum / SSL.com, roughly $115–290/yr), or a business entity for Artifact Signing (~$10/mo). Renew about yearly; SmartScreen reputation still builds over time
- [ ] macOS: Apple Developer account + notarization
- [ ] Auto-update (Tauri updater with signed update manifest) — needs a public or authenticated release endpoint
- [ ] Public download page or release channel if the repo is private
- [ ] Support policy: which app versions are supported against which server versions
- [ ] Privacy / crash-report stance (none today)
