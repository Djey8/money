# Desktop app (Windows)

A small Windows app that opens your self-hosted Money Manager in its own window. It is for the self-hosted (Pro) edition only; the Firebase edition has no desktop app. Design and plan: `docs/adr/0009-desktop-app-shell.md`, `todo/desktop-app.md`.

The app is a thin shell: it loads the web app from your server, so a server update is picked up the next time you open or reload the window. The installer only changes when the shell itself changes.

## Install

1. Open the repository's **Releases** page and download `Money Manager_<version>_x64-setup.exe` from the newest release (only people with access to the repository can see it).
2. Optional: check the download against the attached `.sha256` file with `Get-FileHash "Money Manager_<version>_x64-setup.exe" -Algorithm SHA256`.
3. Run the installer. It installs for your user only and needs no administrator rights.
4. Windows shows a blue **"Windows protected your PC"** screen because the installer is not code-signed. Click **More info**, then **Run anyway**.
5. On first start enter your server address (for example `https://money.example.com`, or `http://localhost:8080` for the local stack). It is remembered.

Requires Windows 10 (1809 or newer) or Windows 11 with the WebView2 runtime (included in Windows 11 and current Windows 10).

## Use

- **Change server:** App menu → _Change server…_ (`Ctrl+Shift+S`).
- **Reload:** App menu → _Reload_ (`Ctrl+R`).
- Your login is kept between starts.

## Update

Download the newer installer from the Releases page and run it; it replaces the installed version in place and keeps your server address and login. There is no auto-update yet.

## Uninstall

Windows Settings → Apps → Money Manager → Uninstall.

## For developers

Needs the Rust toolchain (rustup, MSVC target) and the Visual Studio C++ Build Tools.

| Task                      | Command                                 |
| ------------------------- | --------------------------------------- |
| Run the shell in dev mode | `npm run desktop:dev`                   |
| Build the installer       | `npm run desktop:build`                 |
| Installer output          | `src-tauri/target/release/bundle/nsis/` |

The installer version is the `version` in `package.json`.

**Release automation:** `.github/workflows/desktop-release.yml` runs after the _Auto Release_ workflow. When that run produced a new version, it builds the installer on a Windows runner and attaches it, with a SHA-256 file, to the `vX.Y.Z` GitHub Release. It does not touch `auto-release.yml`. Pushes to `develop` that change `src-tauri/` and manual runs build the installer as a workflow artifact only (kept 14 days).
