# Semantic Versioning & Repository Migration Plan

## Current State

- **Repository:** `https://github.com/Djey8/money-temp.git`
- **Commits:** 716 (no versioning, no tags, messy history)
- **Branches:** `main`, `develop`, `feature2025-05-01`, `migration/angular-19`, `resberrypi`
- **CI/CD:** Two GitHub Actions workflows:
  - `test.yml` — runs frontend unit, backend unit, backend integration, e2e (disabled) on PRs to `main`
  - `firebase-hosting-merge.yml` — deploys to Firebase on push to `main`
- **Firebase project:** `money98-b2242`
- **Firebase secret:** `FIREBASE_SERVICE_ACCOUNT_MONEY98_B2242`
- **No version in settings UI**, no CHANGELOG, no tags

---

## Target State

- **New repository:** `https://github.com/Djey8/money.git` (clean, single squashed commit)
- **Version:** `1.0.0` — first tagged release
- **Semantic versioning** with automated version bumps based on commit messages
- **Conventional Commits** enforced via commit template + git hooks
- **CHANGELOG.md** auto-generated from commits
- **Settings UI** shows current app version
- **Scripts** to bump version, tag, and generate changelog with one command
- **Same CI/CD** — test + Firebase deploy, plus a new release workflow

---

## Phase 1: Create New Repository

### Step 1.1 — Create the repo on GitHub

1. Go to https://github.com/new
2. Name: `money` (or your preferred name)
3. Private, no README, no .gitignore, no license (we bring our own)

### Step 1.2 — Squash-migrate the code

```powershell
# Clone old repo fresh
git clone https://github.com/Djey8/money-temp.git money-migration
cd money-migration

# Ensure you're on develop (latest code)
git checkout develop

# Create an orphan branch (no history)
git checkout --orphan clean-main

# Stage everything
git add -A

# Single initial commit
git commit -m "feat: initial release

Squashed migration from money-temp repository.
Includes: Angular 19 frontend, Node.js backend, Firebase + selfhosted deployments,
PWA support, Playwright E2E tests, Kubernetes manifests, Docker setup."

# Rename branch to main
git branch -M main

# Set new remote
git remote set-url origin https://github.com/Djey8/money.git

# Push
git push -u origin main
```

### Step 1.3 — Verify file integrity

```powershell
# From old repo develop branch, count files
git ls-files | Measure-Object  # should match new repo
```

---

## Phase 2: Migrate GitHub Actions & Firebase Credentials

### Step 2.1 — Copy the Firebase service account secret

1. Go to **old repo** → Settings → Secrets and variables → Actions
2. The secret `FIREBASE_SERVICE_ACCOUNT_MONEY98_B2242` cannot be viewed, so either:
   - **Option A (recommended):** Generate a new service account key:
     1. Go to [Firebase Console](https://console.firebase.google.com) → Project `money98-b2242`
     2. Project Settings → Service Accounts → Generate new private key
     3. Copy the JSON content
   - **Option B:** Go to [Google Cloud Console](https://console.cloud.google.com) → IAM → Service Accounts → find the Firebase one → Keys → Create new key
3. In **new repo** → Settings → Secrets → New repository secret:
   - Name: `FIREBASE_SERVICE_ACCOUNT_MONEY98_B2242`
   - Value: paste the service account JSON

### Step 2.2 — Update firebase.json

Change the `github` field to point to the new repo:

```json
{
  "hosting": {
    "github": "github.com/Djey8/money",
    "branch": "main"
  }
}
```

### Step 2.3 — Update workflow files

Update `.github/workflows/firebase-hosting-merge.yml`:
- No changes needed — it references secrets by name, which you've migrated

Update `.github/workflows/test.yml`:
- Add `--legacy-peer-deps` to `npm ci`:
  ```yaml
  - run: npm ci --legacy-peer-deps
  ```

### Step 2.4 — Verify deployment

```powershell
# Push a small change to main and verify:
# 1. Test workflow runs on PR
# 2. Firebase deploy workflow runs on merge to main
# 3. Site is live at your Firebase URL
```

---

## Phase 3: Semantic Versioning Setup

### 3.1 — Version source of truth

The version lives in **`package.json`** (`"version": "1.0.0"`). At build time, it's injected into the Angular app via the `environment.ts` file.

### 3.2 — Conventional Commits format

All commits must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type       | Version Bump | Example                                      |
|------------|-------------|----------------------------------------------|
| `fix`      | PATCH       | `fix(auth): handle expired tokens gracefully` |
| `feat`     | MINOR       | `feat(budget): add monthly budget charts`     |
| `feat!`    | MAJOR       | `feat!: redesign data model (breaking)`       |
| `docs`     | none        | `docs: update README`                         |
| `chore`    | none        | `chore: update dependencies`                  |
| `refactor` | none        | `refactor(settings): simplify theme logic`    |
| `test`     | none        | `test(cashflow): add income calculations`     |
| `ci`       | none        | `ci: add e2e to test pipeline`                |
| `style`    | none        | `style: fix indentation in settings`          |
| `perf`     | PATCH       | `perf(transactions): optimize list rendering` |

Footer `BREAKING CHANGE:` also triggers MAJOR bump.

### 3.3 — Git commit template

Create `.gitmessage` in repo root:

```
# <type>(<scope>): <subject>
#
# Types: feat|fix|docs|chore|refactor|test|ci|style|perf
# Scope: optional, e.g. auth, budget, cashflow, settings, backend, e2e
# Subject: imperative, lowercase, no period
#
# Examples:
#   feat(budget): add monthly budget overview
#   fix(auth): handle expired token on app resume
#   feat!: redesign transaction data model
#
# Body (optional): explain WHY, not WHAT
#
# Footer (optional):
#   BREAKING CHANGE: <description>
#   Closes #123

```

Configure locally:
```powershell
git config commit.template .gitmessage
```

### 3.4 — Commit message validation (git hook)

Using Husky (already installed) + a lightweight commit-msg hook:

**`.husky/commit-msg`:**
```sh
#!/bin/sh
commit_msg=$(cat "$1")
pattern="^(feat|fix|docs|chore|refactor|test|ci|style|perf)(\(.+\))?(!)?: .{1,100}"

if ! echo "$commit_msg" | head -1 | grep -qE "$pattern"; then
  echo ""
  echo "ERROR: Commit message does not follow Conventional Commits format."
  echo ""
  echo "  Required: <type>(<scope>): <subject>"
  echo "  Types:    feat|fix|docs|chore|refactor|test|ci|style|perf"
  echo ""
  echo "  Examples:"
  echo "    feat(budget): add monthly overview chart"
  echo "    fix(auth): handle expired token"
  echo "    chore: update dependencies"
  echo ""
  echo "  Your message: $commit_msg"
  echo ""
  exit 1
fi
```

### 3.5 — Version bump scripts

Create **`scripts/version-bump.ps1`**:

```powershell
# Usage: .\scripts\version-bump.ps1 [-Type patch|minor|major] [-DryRun]
param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Type = "patch",
    [switch]$DryRun
)

$pkg = Get-Content package.json | ConvertFrom-Json
$current = $pkg.version
$parts = $current.Split(".")

switch ($Type) {
    "major" { $parts[0] = [int]$parts[0] + 1; $parts[1] = 0; $parts[2] = 0 }
    "minor" { $parts[1] = [int]$parts[1] + 1; $parts[2] = 0 }
    "patch" { $parts[2] = [int]$parts[2] + 1 }
}

$newVersion = $parts -join "."

if ($DryRun) {
    Write-Host "Would bump: $current -> $newVersion" -ForegroundColor Yellow
    exit 0
}

# Update package.json
npm version $newVersion --no-git-tag-version

# Update backend/package.json to keep in sync
$backendPkg = Get-Content backend/package.json | ConvertFrom-Json
$backendPkg.version = $newVersion
$backendPkg | ConvertTo-Json -Depth 10 | Set-Content backend/package.json

# Generate/update CHANGELOG
& "$PSScriptRoot/changelog.ps1"

# Commit and tag
git add package.json package-lock.json backend/package.json CHANGELOG.md
git commit -m "chore(release): v$newVersion"
git tag -a "v$newVersion" -m "Release v$newVersion"

Write-Host ""
Write-Host "Released v$newVersion" -ForegroundColor Green
Write-Host "Run 'git push origin main --tags' to publish." -ForegroundColor Cyan
```

Create **`scripts/changelog.ps1`**:

```powershell
# Auto-generates CHANGELOG.md from git tags and conventional commits
$tags = git tag --sort=-version:refname | Select-Object -First 2
$range = if ($tags.Count -ge 2) { "$($tags[1])..HEAD" } else { "HEAD" }

$commits = git log $range --pretty=format:"%s" |
    Where-Object { $_ -match "^(feat|fix|perf)" }

$date = Get-Date -Format "yyyy-MM-dd"
$version = (Get-Content package.json | ConvertFrom-Json).version

$features = $commits | Where-Object { $_ -match "^feat" } | ForEach-Object { "- $_" }
$fixes    = $commits | Where-Object { $_ -match "^fix" }  | ForEach-Object { "- $_" }
$perfs    = $commits | Where-Object { $_ -match "^perf" } | ForEach-Object { "- $_" }

$entry = "## [$version] - $date`n"
if ($features) { $entry += "`n### Features`n$($features -join "`n")`n" }
if ($fixes)    { $entry += "`n### Bug Fixes`n$($fixes -join "`n")`n" }
if ($perfs)    { $entry += "`n### Performance`n$($perfs -join "`n")`n" }

if (Test-Path CHANGELOG.md) {
    $existing = Get-Content CHANGELOG.md -Raw
    $entry + "`n" + $existing | Set-Content CHANGELOG.md
} else {
    "# Changelog`n`n" + $entry | Set-Content CHANGELOG.md
}

Write-Host "CHANGELOG.md updated for v$version"
```

### 3.6 — Auto-detect bump type from commits

Create **`scripts/auto-bump.ps1`** — reads commits since last tag and determines the bump type:

```powershell
# Reads commits since last tag and auto-determines bump type
$lastTag = git describe --tags --abbrev=0 2>$null
$range = if ($lastTag) { "$lastTag..HEAD" } else { "HEAD" }
$commits = git log $range --pretty=format:"%s"

$bump = "patch"

foreach ($msg in $commits) {
    if ($msg -match "BREAKING CHANGE" -or $msg -match "^[a-z]+(\(.+\))?!:") {
        $bump = "major"
        break
    }
    if ($msg -match "^feat") {
        $bump = "minor"
    }
}

Write-Host "Auto-detected bump type: $bump" -ForegroundColor Cyan
Write-Host "Commits since ${lastTag}:" -ForegroundColor Gray
$commits | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
Write-Host ""

$confirm = Read-Host "Proceed with $bump bump? (y/n)"
if ($confirm -eq "y") {
    & "$PSScriptRoot/version-bump.ps1" -Type $bump
}
```

---

## Phase 4: Display Version in Settings UI

### 4.1 — Inject version at build time

Add to **`src/environments/environment.ts`** (and all variants):

```typescript
import packageJson from '../../package.json';
export const environment = {
  // ... existing fields ...
  appVersion: packageJson.version
};
```

Enable JSON imports in **`tsconfig.app.json`**:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  }
}
```

### 4.2 — Show in settings component

Add an "About" section at the bottom of the settings menu in the template:

```html
<!-- About -->
<div class="settings-category" *ngIf="classReference.isSettings">
    <h5 class="category-title">{{'Settings.category.about' | translate}}</h5>
    <div class="version-info">
        <span class="info-label">Version</span>
        <span class="info-value">v{{appVersion}}</span>
    </div>
</div>
```

In the component class:

```typescript
import { environment } from 'src/environments/environment';

export class SettingsComponent {
  appVersion = environment.appVersion;
  // ...
}
```

---

## Phase 5: CI/CD for Releases

### 5.1 — Add release workflow

Create **`.github/workflows/release.yml`**:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - run: npm ci --legacy-peer-deps
      - run: npx jest --config jest.config.js --ci

      - name: Build
        run: npm run build

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

This triggers on any `v*` tag push — runs tests, builds, and creates a GitHub Release with auto-generated notes.

---

## Migration Checklist

### Phase 1: New Repository
- [ ] Create `money` repo on GitHub
- [ ] Orphan-branch squash migration from `develop`
- [ ] Push to new repo
- [ ] Verify all files are present

### Phase 2: CI/CD Migration
- [ ] Generate new Firebase service account key
- [ ] Add `FIREBASE_SERVICE_ACCOUNT_MONEY98_B2242` secret to new repo
- [ ] Update `firebase.json` github field
- [ ] Add `--legacy-peer-deps` to test workflow
- [ ] Push and verify test workflow runs
- [ ] Merge to main and verify Firebase deploy works
- [ ] Verify live site is unchanged

### Phase 3: Semantic Versioning
- [ ] Set `"version": "1.0.0"` in `package.json` and `backend/package.json`
- [ ] Add `.gitmessage` commit template
- [ ] Add `.husky/commit-msg` hook
- [ ] Add `scripts/version-bump.ps1`
- [ ] Add `scripts/changelog.ps1`
- [ ] Add `scripts/auto-bump.ps1`
- [ ] Create initial `CHANGELOG.md`
- [ ] Tag `v1.0.0`

### Phase 4: Version in Settings UI
- [ ] Enable `resolveJsonModule` in tsconfig
- [ ] Add `appVersion` to all environment files
- [ ] Add version display in settings template
- [ ] Verify version shows in app

### Phase 5: Release CI/CD
- [ ] Add `.github/workflows/release.yml`
- [ ] Push `v1.0.0` tag
- [ ] Verify GitHub Release is created

### Post-Migration
- [ ] Archive old `money-temp` repo (Settings → Archive)
- [ ] Update any bookmarks, deployment references
- [ ] Inform collaborators of new repo URL

---

## Daily Workflow After Migration

```
# 1. Work on a feature branch
git checkout -b feat/budget-charts

# 2. Make commits using conventional format
git commit -m "feat(budget): add monthly budget chart"
git commit -m "fix(budget): correct percentage calculation"

# 3. Open PR to main, tests run automatically

# 4. After merge, decide on release:
.\scripts\auto-bump.ps1          # auto-detects: minor (because of feat)
# → bumps 1.0.0 → 1.1.0, updates CHANGELOG, creates tag

# 5. Push with tags
git push origin main --tags
# → triggers release workflow → GitHub Release created
# → triggers Firebase deploy → live site updated
```
