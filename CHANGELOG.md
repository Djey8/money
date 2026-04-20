## [1.5.2] - 2026-04-20

### Bug Fixes
- fix(security): add migration path for encryption key from localStorage to server-side storage

## [1.5.1] - 2026-04-20

### Bug Fixes
- fix(docker): pin multi-arch manifest digests for arm64 CI compatibility

## [1.5.0] - 2026-04-20

### Features
- feat(receipt): add structured receipt parser with store-specific readers
- feat(ci): add SBOM generation job for frontend and backend
- feat(security): add webhook-based security alerting for high-severity events (M8)

### Bug Fixes
- fix(ci): use POSIX-compatible redirect in pre-commit gitleaks check
- fix(security): patch Alpine CVEs and picomatch ReDoS in backend Docker image
- fix(security): patch Alpine CVEs in frontend Docker image (libcrypto3, libpng, musl, zlib)
- fix(auth): center password toggle eye icon in registration input field
- fix(security): move encryption key to server-side storage with mode-aware config and clean logout
- fix(security): add Google Fonts origins to CSP header (M10)
- fix(security): pin Docker image digests for reproducible builds (M7)
- fix(security): upgrade cryptic service to PBKDF2-SHA256 key derivation with HMAC auth (M5)
- fix(backup): add encryption support to restore, fix .gpg extension in promotions, add NAS timeout
- fix(auth): move inject() calls to synchronous interceptor context (NG0203)
- fix(security): move encryption key from localStorage to sessionStorage (M4)
- fix(security): add gitleaks secret scanning to pre-commit hook
- fix(security): add npm audit, container scanning, and secret scanning to CI
- fix(security): add Content-Security-Policy header to nginx (M10)
- fix(security): fix vulnerable dependencies via npm audit fix (M9)

## [1.4.1] - 2026-04-19

### Bug Fixes
- fix(settings): align auth button colors with login button style
- fix(auth): replace PNG eye icons with inline SVG and fix password toggle layout
- fix(balance): refine section add button size and border thickness
- fix(grow): center empty state button
- fix(income-statement): remove duplicate fire expense entries in recalculate
- fix(filters): add missing idea phase to smile and fire filter tabs
- fix(ux): add spinner and toast feedback to all write operations
- fix(add-fire): navigate to fireemergencies after successful add

## [1.4.0] - 2026-04-19

### Features
- feat(info-mojo): add mojo info panel component with responsive design
- feat(app): add global saving spinner overlay with isSaving state

### Bug Fixes
- fix(fire): responsive mojo display with container query font sizes
- fix(ui): center textarea and responsive font sizes for info panels
- fix(info-fire): add editable completionDate and spinner on update/delete
- fix(info): show spinner on update/delete with toast error handling
- fix(add): close panel and show spinner on write operations
- fix(add-smile): collapse sections by default and support tour expansion

## [1.3.3] - 2026-04-19

### Bug Fixes
- fix(security): increase global rate limit to 500/15min, add strict 10/15min auth limiter
- fix(security): sanitize D3 innerHTML with escapeHtml for user data (M1)
- fix(security): implement refresh tokens and httpOnly cookie auth (H3, H4)
- fix(security): add NetworkPolicy, pod security contexts, non-root backups (L5, L6, L7)
- fix(security): enable TLS with cert-manager, HSTS, and HTTP-to-HTTPS redirect (H6)
- fix(security): add account lockout after 10 failed login attempts (H5)

## [1.3.2] - 2026-04-19

### Bug Fixes
- fix(deploy): correct backup cronjob name and add graceful fallback in migration script

## [1.3.1] - 2026-04-19

### Bug Fixes
- fix(security): move Grafana admin password to env template and secrets.yaml
- fix(deploy): apply secrets.yaml in deploy script and add one-time migration helper
- fix(security): restrict trust proxy to 1 hop and remove CORS wildcard fallback
- fix(auth): add password policy, email validation, generic errors, and crypto UUIDs (C4, L1, L2, M2)
- fix(security): remove CouchDB proxy, CORS wildcard headers, and add security headers to nginx (C3, L4)
- fix(security): remove hardcoded default encryption key from cryptic service (C2)
- fix(security): move secrets to gitignored templates and harden k8s config (C1, H1, H2, M5)

## [1.3.0] - 2026-04-18

### Features
- feat(changelog): add GitHub API enrichment with per-version PR links, author avatars, and view toggle
- feat(tour): add interactive guided tour with spotlight overlay and i18n

### Bug Fixes
- fix(i18n): update ar, cn, de, es, and fr translations
- fix(landing): remove lock emoji from AI showcase heading
- fix(settings): use translate service as source of truth for language selection
- fix(data): add tier guards to all write paths preventing data loss

## [1.2.0] - 2026-04-16

### Features
- feat(backup): add NAS catch-up sync and shift daily schedule to 8:30AM
- feat(backup): add NAS redundancy, hourly local backups, and granular deploy flags
- feat(profile): add about page route with nav menu toggle and i18n support
- feat(landing): interactive income allocation with click-to-animate, editable amounts, flow lines and i18n
- feat(settings): add allocation editor with reset to default percentages

### Bug Fixes
- fix(auth): skip landing page flash on login and recalculate home amounts after data load

## [1.1.1] - 2026-04-16

### Bug Fixes
- fix(auth): block login on wrong decryption settings and show error
- fix(changelog): add bottom padding for bottom nav bar visibility
- fix(auth): block login on wrong decryption settings and show error
- fix(auth): clear all caches on logout to prevent stale data on re-login

## [1.1.0] - 2026-04-16

### Features
- feat(changelog): add changelog page with GitHub API integration
- feat(landing): add public landing page with demo mode and bucket showcase

### Bug Fixes
- fix(landing): use dynamic currency, translate bucket names, scroll to smile panels, preserve settings on logout
- fix(ui): detect system theme preference and fix profile z-index

## [1.0.1] - 2026-04-13

### Bug Fixes
- fix(build): update budgets and upgrade jest-preset-angular for Angular 19

# Changelog

## [1.0.0] - 2026-04-10

### Features
- feat: initial release — Angular 19 PWA, Node.js backend, Firebase + selfhosted deployments
