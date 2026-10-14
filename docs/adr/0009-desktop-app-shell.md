# 0009. Desktop app shell (Tauri)

## Status

Proposed — plan in `todo/desktop-app.md`; nothing implemented yet.

## Context

JFK wants a native-feeling installable app for the Pro / self-hosted edition, starting with Windows, later macOS, later Android/iOS. Goals: own window, installer, trust, runs against the same `/api` the web build uses. Initial audience is JFK on his own devices; opening it to other users is possible later but not a goal now.

Writing a separate native UI per OS (WinUI, SwiftUI, Compose) would mean one more copy of every screen and of the allocation / Smile / Fire / Mojo math per platform — see the duplicated-logic note in `CLAUDE.md`. The app is forms, tables and charts over an HTTP API, so native widgets buy little.

## Decision

- **Shell: Tauri 2** wrapping the existing Angular app. Windows target is Windows 10 (1809+) and 11, x64 (ARM64 later), via the WebView2 runtime. The same Tauri project later targets macOS and, through Tauri 2 mobile, Android/iOS.
- **Self-hosted / Pro only.** The Firebase edition is not touched. All desktop code lives in `src-tauri/` (never part of an Angular build) plus, if needed, desktop-only Angular files swapped in via `angular.json` `fileReplacements` per ADR-0004 — no runtime `*ngIf`, no Tauri imports in shared files. `edition-guard` must still pass on the Firebase build.
- **Two stages, decided by a spike:**
  1. *Thin shell* — the window loads the deployed self-hosted site by URL. Same origin, no CORS, no version skew, nothing to update but the shell. Fastest route to "an installed app".
  2. *Bundled build* — a `desktop` Angular configuration shipped inside the installer, with the server URL entered on first run and stored locally. Needed only if offline start, a first-run connect screen, or OS-keychain token storage is wanted. The backend must then allow the webview origin (`http://tauri.localhost` on Windows) in `CORS_ORIGINS` (config only), or requests go through `tauri-plugin-http`.
- **Installer: NSIS, per-user** (`currentUser` install mode, no admin rights). No MSIX / Store.
- **Unsigned for now.** Windows SmartScreen will warn ("Unknown publisher"); acceptable for personal use. Signing is a documented later phase, not built in.
- **Distribution: GitHub Releases**, not binaries committed to the repo (a committed installer stays in git history forever and bloats every clone). Release assets are visible to exactly those who can see the repo, which matches "everyone with repo access can install". Built by a separate `desktop-release.yml` that runs automatically after every merge to `main`, chained behind `auto-release.yml` (`on: workflow_run`, workflows: ["Auto Release"], completed + success), plus `workflow_dispatch` for manual runs. `auto-release.yml` itself is **not modified** (Firebase deploy and version bump stay exactly as they are). The desktop workflow checks out `main`; if its HEAD is the release commit tagged `vX.Y.Z` (i.e. a version bump happened) it builds the installer at that version and attaches it to the existing GitHub Release `vX.Y.Z`; if HEAD is untagged (no releasable commits), it exits without building. `workflow_run` is used instead of a tag trigger because tags pushed with `GITHUB_TOKEN` by `auto-release.yml` do not trigger other workflows. The installer version is the app version (`package.json`).

## Consequences

- Dev machine needs the Rust toolchain (rustup + MSVC Build Tools) and WebView2.
- The desktop app inherits the web app's behaviour exactly; a feature built for the web is in the desktop app for free.
- Stage 1 means the desktop app only works online and always runs the server's current frontend, so no client/API version skew to manage. Stage 2 introduces skew: the installed bundle talks to whatever API version the server runs, so `/api/v1` compatibility becomes a real obligation.
- Unsigned means other users would see SmartScreen warnings and the Tauri updater cannot be trusted by anyone but JFK. Opening it up requires the "if we open up" items in `todo/desktop-app.md`.
- Auto-update against a private repo's release assets needs authentication; until then updating means installing the newer release over the old one (per-user NSIS handles that in place).
- CI build time grows by a Windows runner job; it is isolated from the existing workflows.
