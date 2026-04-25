# Self-Hosted Setup Guide

Run the Money App on your own server with full data ownership. The self-hosted stack is: **Angular frontend (Nginx) + Node.js/Express API + CouchDB**.

Two deployment options: Docker Compose (simplest) or Kubernetes via K3s.

---

## Prerequisites

- Linux server (Raspberry Pi 4+ / Ubuntu VM / any amd64 or arm64 host)
- Docker + Docker Compose **or** K3s
- Git

## Option A: Docker Compose

This is the fastest path. One command, three containers.

### 1. Clone and configure

```bash
git clone <repo-url> && cd money
```

Copy `.env.example` to `.env` and fill in real values — `docker-compose.yml` reads them via `${VAR:?...}` (it fails fast if anything is missing, so you do **not** edit the compose file itself):

```bash
cp .env.example .env
```

Minimum required:

```bash
JWT_SECRET=<random ≥32 chars>            # openssl rand -base64 64
COUCHDB_PASSWORD=<strong password>       # openssl rand -base64 30 | tr -d '/+='
GRAFANA_ADMIN_PASSWORD=<strong password> # only required when running the logging overlay
```

### 2. Start (minimal stack — recommended)

The default `docker-compose.yml` runs only the 3 essential services (~640 MB RAM):

```bash
docker-compose up -d          # CouchDB + Backend + Frontend only
```

| Service | URL |
|---------|-----|
| Frontend | http://\<server-ip\> |
| Backend API | http://\<server-ip\>:3000 |
| CouchDB Admin | http://\<server-ip\>:5984/_utils |

### 3. Enable debug/logging stack (optional)

When you need to investigate issues, add the logging overlay (Loki + Promtail + Grafana, ~800 MB extra RAM):

```bash
# Start with logging
docker-compose -f docker-compose.yml -f docker-compose.logging.yml up -d

# When done debugging — tear down logging and restart minimal
docker-compose -f docker-compose.yml -f docker-compose.logging.yml down
docker-compose up -d
```

The logging overlay also sets the backend `LOG_LEVEL` to `info` (default is `warn` for minimal overhead).

> **Raspberry Pi users:** Only enable the debug stack when actively investigating. It nearly doubles memory usage.

### 4. Stop / rebuild

```bash
docker-compose down          # stop
docker-compose up -d --build # rebuild after code changes
```

### Memory budget (Raspberry Pi 4, 4 GB)

| Mode | Containers | Approx. RAM |
|------|-----------|-------------|
| Minimal (default) | CouchDB + Backend + Frontend | ~640 MB |
| Debug | + Loki + Promtail + Grafana | ~1.5 GB |
| OS baseline | — | ~1.4 GB |

With the minimal stack you get ~1.7 GB headroom. A 1 GB swap file is recommended as a safety net (see Raspberry Pi section below).

---

## Option B: Kubernetes (K3s)

Better for production: rolling updates, health checks, persistent volumes, monitoring stack.

### 1. Install K3s

```bash
curl -sfL https://get.k3s.io | sh -
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
echo "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml" >> ~/.bashrc
source ~/.bashrc
```

### 2. Build container images

On the server (or build elsewhere and transfer):

```bash
docker build -t money-frontend:latest .
docker build -t money-backend:latest ./backend
```

If building on a separate machine, save and load:

```bash
# On build machine
docker save money-frontend:latest | gzip > money-frontend.tar.gz
docker save money-backend:latest | gzip > money-backend.tar.gz

# On server
docker load < money-frontend.tar.gz
docker load < money-backend.tar.gz
```

### 3. Configure secrets

All secrets live in `k8s/secrets.yaml` (gitignored). Copy the template and fill in real values — the manifests `couchdb.yaml` and `backend.yaml` already consume them via `secretKeyRef`, so you do **not** edit those files.

```bash
cp k8s/secrets.yaml.example k8s/secrets.yaml
vi k8s/secrets.yaml    # JWT_SECRET, COUCHDB_PASSWORD, Grafana password
```

Generate strong values:

```bash
openssl rand -base64 64                 # JWT_SECRET
openssl rand -base64 30 | tr -d '/+='   # COUCHDB_PASSWORD
openssl rand -base64 40                 # Grafana admin password
```

> The same values are used locally via `.env` (copied from `.env.example`) for Docker Compose runs. Keep the two in sync only if you share data between local and cluster.

### 4. Deploy

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/couchdb.yaml
kubectl wait --for=condition=ready pod -l app=couchdb -n money-app --timeout=120s
kubectl apply -f k8s/backend.yaml
kubectl wait --for=condition=ready pod -l app=backend -n money-app --timeout=120s
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml       # optional: nginx ingress
```

Or use the deploy script:

```bash
# Linux / Raspberry Pi
./scripts/deploy.sh
```

### 5. Verify

```bash
kubectl get pods -n money-app
# All pods should show Running / 1/1
```

Access via `http://<server-ip>` (port 80 through Ingress or NodePort).

---

## Windows / WSL (Local Development)

For developing and testing self-hosted mode on Windows with WSL2 + K3s:

```powershell
.\scripts\deploy-local.ps1              # full build + deploy + port-forward + browser
.\scripts\deploy-local.ps1 -SkipBuild   # redeploy without rebuilding images
.\scripts\deploy-local.ps1 -NoCache     # rebuild from scratch

.\scripts\cleanup-local.ps1             # tear down
```

Access at `http://localhost:8080`. Port-forward is automatic (WSL2 does not expose NodePorts to Windows).

---

## Monitoring (Optional)

The K3s deployment includes Grafana + Loki + Promtail for log aggregation. These are **disabled by default** to save resources — deploy them only when debugging:

```bash
kubectl apply -f k8s/loki.yaml
kubectl apply -f k8s/promtail.yaml
```

To remove them when done:

```bash
kubectl delete -f k8s/promtail.yaml
kubectl delete -f k8s/loki.yaml
```

Grafana is available on port 30300. Pre-built dashboards ship as `ConfigMap`s in `k8s/grafana-dashboards.yaml` and `k8s/grafana-frontend-dashboard.yaml`:

- System overview
- Backend API performance
- Data operations
- Error tracking
- Frontend logs
- User activity
- Security monitoring

Grafana admin credentials are read from the `GRAFANA_ADMIN_PASSWORD` value in `k8s/secrets.yaml` (or `.env` for Docker Compose). Login as `admin` with that password.

---

## Backups

Two Kubernetes CronJobs handle automated backups:

1. **Hourly** — local only, every hour, keeps last 24
2. **Daily** — local + NAS (if available), runs at 2:00 AM with tier promotion

Both are deployed by default with `deploy.sh` / `deploy-local.ps1`. They can be individually skipped — see [DEPLOYMENT.md](DEPLOYMENT.md) for all flags.

```bash
# Deploy manually (if needed)
kubectl apply -f k8s/backup-cronjob-hourly.yaml   # hourly local
kubectl apply -f k8s/backup-cronjob-daily.yaml     # daily local + NAS
```

### Storage structure

```
/opt/money-app-backups/          (local)
  hourly/   ← last 24 hours
  daily/    ← last 7 days
  weekly/   ← last 13 Sundays (~3 months)
  monthly/  ← 1st of each month (kept forever)

/mnt/nas/backups/                (NAS — optional, gracefully skipped if unavailable)
  daily/    ← last 21 days (3 weeks)
  weekly/   ← last 104 Sundays (2 years)
  monthly/  ← 1st of each month (kept forever)
```

### Retention policy

| Location | Tier | Kept | Promoted when |
|----------|------|------|---------------|
| Local | Hourly | 24 hours | Every hour |
| Local | Daily | 7 days | Every day (2 AM) |
| Local | Weekly | 3 months (13 weeks) | Sundays |
| Local | Monthly | Forever | 1st of month |
| NAS | Daily | 3 weeks (21 days) | Every day (2 AM) |
| NAS | Weekly | 2 years (104 weeks) | Sundays |
| NAS | Monthly | Forever | 1st of month |

> **No NAS?** Use `--no-nas-backup` (or `-NoNasBackup` on Windows) and only the hourly local CronJob deploys. The daily CronJob also gracefully skips NAS writes if the mount is unavailable at runtime.

### Manual backup / restore

```bash
./scripts/backup.sh                                          # backup now (local + NAS)
./scripts/backup.sh --hourly                                 # hourly backup (local only)
./scripts/list-backups.sh                                    # show all backups + restore commands
./scripts/restore-backup.sh /opt/money-app-backups/daily/couchdb-backup-2026-03-29.tar.gz   # restore
```

### Browse backups directly on the Pi

```bash
ls -lh /opt/money-app-backups/hourly/
ls -lh /opt/money-app-backups/daily/
ls -lh /opt/money-app-backups/weekly/
ls -lh /opt/money-app-backups/monthly/

# NAS (if mounted)
ls -lh /mnt/nas/backups/daily/
ls -lh /mnt/nas/backups/weekly/
ls -lh /mnt/nas/backups/monthly/
```

---

## Raspberry Pi Specifics

Recommended hardware: Raspberry Pi 4, 4GB+ RAM, SSD (not SD card — significantly faster and more durable).

### Swap file (strongly recommended)

With no swap, a memory spike can OOM-kill your containers. Add a 1 GB swap file as a safety net:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Performance tuning

The deployment is pre-tuned for constrained hardware:

- **1 replica** for frontend + backend (K8s defaults). No need for multiple replicas on a personal device.
- **Gzip compression** enabled in Nginx for API responses (80-90% smaller JSON payloads).
- **Batch-read API** — the frontend loads all data in 1-2 HTTP requests instead of 19, cutting load time significantly.
- **ETag caching** — backend returns `304 Not Modified` when data hasn't changed, avoiding redundant transfers.
- **CouchDB auto-compaction** — `config/couchdb-local.ini` enables automatic compaction at 30% fragmentation.
- **LOG_LEVEL=warn** — minimal logging overhead in production. Use the debug stack when verbose logs are needed.
- **Body-parser limit** reduced to 2 MB (more than sufficient for personal finance data).

### Reduce SD card wear (if not using SSD)

```bash
sudo swapoff -a                       # disable swap
# Add to /etc/fstab:
tmpfs /tmp tmpfs defaults,noatime,nosuid,size=100m 0 0
```

Static IP (Ubuntu/Netplan — edit `/etc/netplan/50-cloud-init.yaml`):

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses: [192.168.0.100/24]
      routes:
        - to: default
          via: 192.168.0.1
      nameservers:
        addresses: [192.168.0.1, 8.8.8.8]
```

```bash
sudo netplan apply
```

---

## Configuration Reference

The frontend build mode is controlled by Angular environment files:

| File | Mode | Usage |
|------|------|-------|
| `environment.ts` | firebase | `npm start` (dev) |
| `environment.production.ts` | firebase | `npm run build` |
| `environment.selfhosted.ts` | selfhosted | `npm run build:selfhosted` |

The Dockerfile builds with `build:selfhosted` by default.

Backend environment variables (`docker-compose.yml` or `k8s/backend.yaml`):

| Variable | Description |
|----------|-------------|
| `COUCHDB_URL` | CouchDB connection URL |
| `COUCHDB_USER` | CouchDB admin username |
| `COUCHDB_PASSWORD` | CouchDB admin password |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `PORT` | Backend listen port (default: 3000) |
| `CORS_ORIGINS` | Allowed CORS origins |
| `LOG_LEVEL` | Logging verbosity: `error`, `warn` (default), `info`, `debug` |
| `SKIP_RATE_LIMIT` | Set `true` to disable IP-based rate limiting (recommended for single-user Pi) |

## Migrating from Firebase

1. Log into the Firebase-hosted app
2. Go to Profile > Export > Full Backup (JSON)
3. If encryption is enabled, a key file is also downloaded
4. Log into the self-hosted instance
5. Go to Profile > Restore > select backup file + key file > Start Restore

All data, settings, and encryption configuration are included in the backup.
