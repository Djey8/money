# Versioning & Release Guide

This project uses **semantic versioning** (`MAJOR.MINOR.PATCH`) with **conventional commits** enforced by a git hook.

---

## Commit Message Format

Every commit must follow this pattern:

```
<type>(<scope>): <subject>
```

| Type       | Version Impact | When to use                              |
|------------|---------------|------------------------------------------|
| `feat`     | MINOR bump    | New feature                              |
| `fix`      | PATCH bump    | Bug fix                                  |
| `perf`     | PATCH bump    | Performance improvement                  |
| `docs`     | No bump       | Documentation only                       |
| `chore`    | No bump       | Maintenance (deps, configs, tooling)     |
| `refactor` | No bump       | Code change that doesn't fix or add      |
| `test`     | No bump       | Adding or updating tests                 |
| `ci`       | No bump       | CI/CD workflow changes                   |
| `style`    | No bump       | Formatting, whitespace, semicolons       |

### Breaking changes → MAJOR bump

Use `!` after the type or add `BREAKING CHANGE:` in the footer:

```
feat!: redesign transaction data model
```
```
feat(auth): switch to OAuth2

BREAKING CHANGE: removes legacy token-based auth
```

### Scope (optional)

Common scopes: `auth`, `budget`, `cashflow`, `transactions`, `settings`, `grow`, `fire`, `backend`, `e2e`, `pwa`

### Examples

```
feat(budget): add monthly budget overview chart
fix(auth): handle expired token on app resume
chore: update Angular to v19.1
docs: update deployment guide
test(cashflow): add income calculation tests
ci: enable e2e tests in pipeline
perf(transactions): optimize list rendering with virtual scroll
feat!: redesign data storage format
```

The commit-msg hook (`.husky/commit-msg`) will **reject** any commit that doesn't match this format.

---

## How to Release

### Quick release (recommended)

From the `main` branch:

```powershell
.\scripts\auto-bump.ps1
```

This will:
1. Read all commits since the last tag
2. Auto-detect the bump type (`patch`, `minor`, or `major`) based on commit types
3. Ask for confirmation
4. Update `package.json` and `backend/package.json`
5. Generate `CHANGELOG.md` entries
6. Create a commit: `chore(release): vX.Y.Z`
7. Create an annotated tag: `vX.Y.Z`

Then push:

```powershell
git push origin main --tags
```

### Manual release (if you want to override the bump type)

```powershell
# Dry run to see what would happen
.\scripts\version-bump.ps1 -Type minor -DryRun

# Execute
.\scripts\version-bump.ps1 -Type minor

# Push
git push origin main --tags
```

---

## What Happens After Push

When you push a tag (`v*`), three things happen automatically:

| Trigger                | Workflow                          | What it does                                   |
|------------------------|-----------------------------------|------------------------------------------------|
| Push tag `v*`          | `release.yml`                     | Runs tests, builds, creates GitHub Release with auto-generated release notes |
| Push to `main`         | `firebase-hosting-merge.yml`      | Builds and deploys to Firebase Hosting         |
| PR to `main`           | `test.yml`                        | Runs frontend + backend unit and integration tests |

### GitHub Release Notes

The `release.yml` workflow uses `generate_release_notes: true`, which means GitHub auto-generates release notes from:
- Commit messages between the previous tag and the new tag
- Merged pull requests

You do **not** need to write release notes manually.

### CHANGELOG.md

The `CHANGELOG.md` file is updated locally by the `changelog.ps1` script (called automatically during version bump). It extracts `feat`, `fix`, and `perf` commits and formats them under the version heading.

---

## Version Location

The version `"X.Y.Z"` is stored in two places and must stay in sync:

- `package.json` → `"version": "X.Y.Z"`
- `backend/package.json` → `"version": "X.Y.Z"`

The `version-bump.ps1` script updates both automatically.

---

## Scripts Reference

| Script                          | Purpose                                           |
|---------------------------------|---------------------------------------------------|
| `scripts/auto-bump.ps1`        | Auto-detect bump type from commits, bump + tag    |
| `scripts/version-bump.ps1`     | Manual bump: `-Type patch\|minor\|major` `-DryRun`|
| `scripts/changelog.ps1`        | Regenerate CHANGELOG.md from commits              |

---

## Daily Workflow

```
# 1. Create a feature branch
git checkout -b feat/budget-charts

# 2. Work and commit using conventional format
git commit -m "feat(budget): add monthly budget chart"
git commit -m "fix(budget): correct percentage calculation"

# 3. Push and open PR → tests run automatically
git push origin feat/budget-charts

# 4. After PR is reviewed and merged to main:
git checkout main
git pull

# 5. Release
.\scripts\auto-bump.ps1
# → detects: minor bump (because of feat commit)
# → bumps 1.0.0 → 1.1.0
# → updates CHANGELOG.md
# → commits and tags

# 6. Push
git push origin main --tags
# → GitHub Release created automatically
# → Firebase deploy triggered automatically
```

---

## Telling Copilot / AI to Release

Use this prompt:

> Run `.\scripts\auto-bump.ps1` from the repo root to detect the version bump type from recent commits. Confirm the bump, then push with `git push origin main --tags`.

Or for a specific bump:

> Run `.\scripts\version-bump.ps1 -Type minor` then `git push origin main --tags`.
