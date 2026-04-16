# Deployment Guide

Complete reference for deploying the Money App to Kubernetes. Both scripts deploy the same stack — `deploy.sh` targets Linux/Raspberry Pi directly, `deploy-local.ps1` targets Windows via WSL2 + K3s.

## Quick Start

```bash
# Linux / Raspberry Pi — full deploy, fresh build
./scripts/deploy.sh --no-cache

# Windows / WSL — full deploy, fresh build, opens browser
.\scripts\deploy-local.ps1 -NoCache
```

Both commands deploy **everything**: frontend, backend, CouchDB, Ingress, both backup CronJobs, and the logging stack.

---

## deploy.sh (Linux / Raspberry Pi)

```
Usage: ./scripts/deploy.sh [namespace] [options]
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--no-cache` | off | Force rebuild without Docker cache (pulls latest git, ensures fresh images) |
| `--skip-build` | off | Skip building images entirely (use existing images in K3s/containerd) |
| `--skip-frontend` | off | Skip frontend image build and deployment |
| `--skip-backend` | off | Skip backend image build and deployment |
| `--skip-tls` | off | Skip TLS certificate creation |
| `--no-ingress` | off | Skip Ingress deployment |
| `--no-backup` | off | Skip **all** backup CronJobs (hourly + daily/NAS) |
| `--no-local-backup` | off | Skip hourly local backup CronJob only |
| `--no-nas-backup` | off | Skip daily+NAS backup CronJob only (for setups without NAS) |
| `--no-logging` | off | Skip logging stack (Loki, Grafana, Promtail) |
| `--port-forward` | off | Start port-forward after deployment |
| `--prd` | — | **Preset:** `--no-cache` + `--no-logging` |
| `--dev` | — | **Preset:** `--no-cache` (logging enabled) |

### Examples

```bash
./scripts/deploy.sh                           # Full deployment with cache
./scripts/deploy.sh --no-cache                # Full deployment, force fresh build
./scripts/deploy.sh --skip-build              # Redeploy without rebuilding images
./scripts/deploy.sh --skip-frontend           # Deploy only backend + CouchDB
./scripts/deploy.sh --no-nas-backup           # No NAS? Skip the daily+NAS CronJob
./scripts/deploy.sh --no-local-backup         # Skip hourly, keep daily+NAS
./scripts/deploy.sh --no-backup               # No backups at all
./scripts/deploy.sh --no-ingress --no-backup  # Minimal deployment
./scripts/deploy.sh --prd                     # Production: fresh build, no logging
./scripts/deploy.sh --dev                     # Development: fresh build, with logging
./scripts/deploy.sh --port-forward            # Deploy and auto port-forward
```

---

## deploy-local.ps1 (Windows / WSL)

```
Usage: .\scripts\deploy-local.ps1 [flags]
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-NoCache` | off | Force rebuild without Docker cache (pulls latest git) |
| `-SkipBuild` | off | Skip building images entirely |
| `-SkipFrontend` | off | Skip frontend build and deployment |
| `-SkipBackend` | off | Skip backend build and deployment |
| `-SkipTLS` | off | Skip TLS certificate creation |
| `-NoIngress` | off | Skip Ingress deployment |
| `-NoBackup` | off | Skip **all** backup CronJobs (hourly + daily/NAS) |
| `-NoLocalBackup` | off | Skip hourly local backup CronJob only |
| `-NoNasBackup` | off | Skip daily+NAS backup CronJob only (for setups without NAS) |
| `-NoLogging` | off | Skip logging stack (Loki, Grafana, Promtail) |
| `-NoPortForward` | off | Skip automatic port-forwarding |
| `-NoBrowser` | off | Skip opening browser after deploy |
| `-CleanImages` | off | Clean up old images before building |
| `-Prd` | — | **Preset:** `-NoCache` + `-NoLogging` |
| `-Dev` | — | **Preset:** `-NoCache` (logging enabled) |

### Examples

```powershell
.\scripts\deploy-local.ps1                        # Full deploy + port-forward + browser
.\scripts\deploy-local.ps1 -NoCache               # Full deploy, force fresh build
.\scripts\deploy-local.ps1 -SkipBuild             # Quick redeploy without rebuilding
.\scripts\deploy-local.ps1 -NoNasBackup           # No NAS mount? Skip NAS CronJob
.\scripts\deploy-local.ps1 -NoLocalBackup         # Skip hourly, keep daily+NAS
.\scripts\deploy-local.ps1 -NoBackup              # No backups at all
.\scripts\deploy-local.ps1 -NoIngress -NoBackup   # Minimal deployment
.\scripts\deploy-local.ps1 -Prd                   # Production: fresh build, no logging
.\scripts\deploy-local.ps1 -SkipBuild -NoBrowser  # Redeploy, no browser
```

---

## Backup CronJobs

Two separate Kubernetes CronJobs, each in their own YAML file:

| CronJob | File | Schedule | Storage | Deployed by default |
|---------|------|----------|---------|---------------------|
| `couchdb-backup-hourly` | `k8s/backup-cronjob-hourly.yaml` | Every hour | Local only | Yes |
| `couchdb-backup` | `k8s/backup-cronjob-daily.yaml` | 2:00 AM daily | Local + NAS | Yes |

### Skipping backup CronJobs

| Scenario | deploy.sh | deploy-local.ps1 |
|----------|-----------|-------------------|
| No NAS mounted | `--no-nas-backup` | `-NoNasBackup` |
| No hourly backups needed | `--no-local-backup` | `-NoLocalBackup` |
| No backups at all | `--no-backup` | `-NoBackup` |

> **Note:** The daily CronJob checks NAS availability at runtime. If the NAS is offline when the job runs, it gracefully skips NAS writes and logs a warning. So `--no-nas-backup` is only needed to avoid deploying the CronJob entirely (e.g., you will never have a NAS).

### Manual deploy (without deploy scripts)

```bash
kubectl apply -f k8s/backup-cronjob-hourly.yaml   # hourly local
kubectl apply -f k8s/backup-cronjob-daily.yaml     # daily local + NAS
```

### Retention policy

| Location | Tier | Kept | Promoted when |
|----------|------|------|---------------|
| Local | Hourly | 24 hours | Every hour |
| Local | Daily | 7 days | 2 AM daily |
| Local | Weekly | 3 months (13 weeks) | Sundays |
| Local | Monthly | Forever | 1st of month |
| NAS | Daily | 3 weeks (21 days) | 2 AM daily |
| NAS | Weekly | 2 years (104 weeks) | Sundays |
| NAS | Monthly | Forever | 1st of month |

### Backup scripts

```bash
./scripts/backup.sh              # Run a backup now (local + NAS)
./scripts/backup.sh --hourly     # Run an hourly backup (local only)
./scripts/list-backups.sh        # Show all backups with ages and restore commands
./scripts/restore-backup.sh <file.tar.gz>   # Restore from any backup archive
```

---

## What gets deployed

Full deployment order (no skip flags):

1. **Namespace** — `money-app`
2. **TLS certificate** — self-signed cert for HTTPS
3. **CouchDB** — database (StatefulSet with PVC)
4. **Backend** — Node.js API server
5. **Frontend** — Angular PWA (Nginx)
6. **Ingress** — Nginx ingress controller
7. **Backup CronJobs** — hourly local + daily local/NAS
8. **Logging stack** — Loki + Grafana + Promtail

Each component can be individually skipped with the flags above.

---

## Presets

| Preset | Equivalent to | Use case |
|--------|---------------|----------|
| `--prd` | `--no-cache --no-logging` | Production deploy: fresh build, no logging overhead |
| `--dev` | `--no-cache` | Development: fresh build, logging enabled for debugging |

No preset skips backups — both CronJobs always deploy unless explicitly excluded.
