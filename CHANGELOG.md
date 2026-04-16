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
