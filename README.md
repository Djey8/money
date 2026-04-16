# Money App

![Tests](https://github.com/nicokluess/money/actions/workflows/test.yml/badge.svg?branch=main)

Personal finance management application built with Angular. Tracks income, expenses, budgets, subscriptions, investments, and financial independence progress. Supports client-side AES encryption and multi-language UI (EN, DE, ES, FR, CN).

Runs in two modes:
- **Firebase** (cloud) — Firebase Realtime Database + Firebase Auth. Default for development and hosted production.
- **Self-hosted** — Node.js/Express backend + CouchDB. Full data ownership on your own hardware.

## Features

- **Accounts** — Daily, Splurge, Smile, Fire, Income, Mojo (based on Barefoot Investor methodology)
- **Automatic allocation** — Income splits across accounts by configurable ratios (default 60/10/10/20)
- **Transactions** — Add, edit, copy, delete with advanced search (AND/OR/NOT, amount, date ranges)
- **Subscriptions** — Track recurring expenses with 5 frequency types (weekly, biweekly, monthly, quarterly, yearly). Auto-generates transactions with color-coded visual indicators and frequency filtering.
- **Smile projects** — Savings goals with category-based tracking
- **Fire emergencies** — Emergency fund management
- **Grow** — Investment tracking (buy/sell, dividends, payback, P&L)
- **Financial statements** — Auto-generated income statement and balance sheet
- **Budget** — Category-based plan vs. actual comparison
- **Statistics** — Pie charts, histograms, KPIs, category breakdowns (D3.js)
- **Backup & restore** — Full JSON backup/restore with encryption key export
- **Client-side encryption** — AES encryption via CryptoJS (data encrypted before it leaves the browser)

## Architecture

```
Angular Frontend
       |
   ┌───┴───┐
   |       |
Firebase  Express API ── CouchDB
(cloud)     (self-hosted)
```

- Per-user document model in CouchDB (one document per user, JWT-isolated)
- Dual-mode `DatabaseService` — same API, switches backend based on `environment.mode`

## Tech Stack

| Layer | Firebase Mode | Self-Hosted Mode |
|-------|--------------|-----------------|
| Frontend | Angular 15, Angular Material, D3.js | Same |
| Auth | Firebase Auth | JWT (Express) |
| Database | Firebase Realtime DB | CouchDB 3.3 |
| Hosting | Firebase Hosting | Nginx (container) |
| Orchestration | GitHub Actions | Docker Compose / K3s |
| Monitoring | — | Grafana + Loki + Promtail |

## Quick Start

### Firebase mode (development)

```bash
npm install
npm start
# http://localhost:4200
```

### Self-hosted mode

See [docs/SELFHOSTED.md](docs/SELFHOSTED.md) for the complete setup guide.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for all deploy script flags and options.

Shortest path with Docker Compose:

```bash
# Edit docker-compose.yml — set COUCHDB_PASSWORD and JWT_SECRET
docker-compose up -d
# http://localhost
```

## Project Structure

```
src/                  Angular frontend source
backend/              Express API + CouchDB integration
k8s/                  Kubernetes manifests (namespace, deployments, ingress, monitoring)
config/               Monitoring configs (Loki, Promtail)
scripts/              Deployment, backup/restore, and utility scripts
docker-compose.yml    One-command self-hosted deployment
```

## Security

- AES client-side encryption (CryptoJS) — data encrypted before storage
- JWT authentication with per-user document isolation (self-hosted)
- Firebase Security Rules (cloud)
- Helmet.js security headers (backend)
- HTTPS/TLS support via Ingress

## License

Private

ng build --configuration firebase
npx http-server dist/money -p 4200