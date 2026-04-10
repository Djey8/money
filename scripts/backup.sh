#!/bin/bash

# ============================================
# CouchDB Backup Script with Tiered Retention
# ============================================
# 
# Retention Policy:
# - Daily: Keep last 7 days
# - Weekly: Keep Sunday backups for 3 months (13 weeks)
# - Monthly: Keep 1st-of-month backups forever
#
# Storage: /opt/money-app-backups on the host
#   daily/   — last 7 days
#   weekly/  — last 13 Sundays
#   monthly/ — forever
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-money-app}"
BACKUP_POD="${BACKUP_POD:-couchdb-0}"
BACKUP_ROOT="${BACKUP_DIR:-/opt/money-app-backups}"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)   # 1=Mon … 7=Sun
DAY_OF_MONTH=$(date +%d)

DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
MONTHLY_DIR="${BACKUP_ROOT}/monthly"
BACKUP_FILE="${DAILY_DIR}/couchdb-backup-${DATE}.tar.gz"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    log_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    log_error "Namespace '$NAMESPACE' does not exist"
    exit 1
fi

# Create backup directories
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

echo "==================================="
echo "CouchDB Backup Script"
echo "==================================="
log_info "Date: $(date)"
log_info "Namespace: $NAMESPACE"
log_info "Backup file: $BACKUP_FILE"
echo ""

# Check if CouchDB pod is running
if ! kubectl get pod -n "$NAMESPACE" "$BACKUP_POD" &> /dev/null; then
    log_error "CouchDB pod '$BACKUP_POD' not found in namespace '$NAMESPACE'"
    exit 1
fi

# Get CouchDB credentials from secret
log_info "Retrieving CouchDB credentials..."
COUCHDB_USER=$(kubectl get secret -n "$NAMESPACE" couchdb-secret -o jsonpath='{.data.username}' | base64 -d 2>/dev/null || echo "admin")
COUCHDB_PASSWORD=$(kubectl get secret -n "$NAMESPACE" couchdb-secret -o jsonpath='{.data.password}' | base64 -d 2>/dev/null)

if [ -z "$COUCHDB_PASSWORD" ]; then
    log_error "Failed to retrieve CouchDB password from secret"
    exit 1
fi

# Fetch database list
log_info "Fetching database list..."
DATABASES=$(kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
    "http://localhost:5984/_all_dbs" | grep -v '^_' || echo "[]")

if [ "$DATABASES" = "[]" ] || [ -z "$DATABASES" ]; then
    log_warning "No user databases found to backup"
    exit 0
fi

log_success "Found databases: $DATABASES"
echo ""

# Create temporary directory for backup
TEMP_DIR="${BACKUP_DIR}/temp_${TIMESTAMP}"
mkdir -p "$TEMP_DIR"

# Backup each database
log_info "Starting database backup..."
for db in $DATABASES; do
    if [ -z "$db" ]; then
        continue
    fi
    
    log_info "Backing up database: $db"
    kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
        -X GET "http://localhost:5984/${db}/_all_docs?include_docs=true" \
        > "${TEMP_DIR}/${db}.json"
    
    if [ $? -eq 0 ] && [ -s "${TEMP_DIR}/${db}.json" ]; then
        log_success "  → Successfully backed up $db ($(du -h ${TEMP_DIR}/${db}.json | cut -f1))"
    else
        log_error "  → Failed to backup $db"
        rm -f "${TEMP_DIR}/${db}.json"
    fi
done

echo ""

# Create metadata file
log_info "Creating backup metadata..."
cat > "${TEMP_DIR}/backup-metadata.json" <<EOF
{
  "backup_date": "$(date -Iseconds)",
  "backup_timestamp": "${TIMESTAMP}",
  "namespace": "${NAMESPACE}",
  "databases": "$(echo $DATABASES | tr '\n' ' ')",
  "retention_policy": {
    "daily": "7 days",
    "weekly": "13 weeks (3 months, Sundays)",
    "monthly": "forever (1st of month)"
  }
}
EOF

# Create compressed archive
log_info "Creating compressed backup archive..."
tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" .
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

# Cleanup temp directory
rm -rf "$TEMP_DIR"

log_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
echo ""

# ── Tier promotion ─────────────────────────────────
echo "==================================="
echo "Tier Promotion"
echo "==================================="

# Sunday → promote to weekly
if [ "$DAY_OF_WEEK" = "7" ]; then
    cp "$BACKUP_FILE" "${WEEKLY_DIR}/couchdb-backup-${DATE}.tar.gz"
    log_success "Promoted to weekly (Sunday)"
else
    log_info "Not Sunday — skipping weekly promotion"
fi

# 1st of month → promote to monthly (kept forever)
if [ "$DAY_OF_MONTH" = "01" ]; then
    cp "$BACKUP_FILE" "${MONTHLY_DIR}/couchdb-backup-${DATE}.tar.gz"
    log_success "Promoted to monthly (1st of month)"
else
    log_info "Not 1st — skipping monthly promotion"
fi

echo ""

# ── Retention cleanup ──────────────────────────────
echo "==================================="
echo "Applying Retention Policy"
echo "==================================="

# Daily: keep last 7
DAILY_COUNT=$(ls -1 "${DAILY_DIR}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l)
if [ "$DAILY_COUNT" -gt 7 ]; then
    log_info "Cleaning up old daily backups (keeping last 7)..."
    ls -1t "${DAILY_DIR}"/couchdb-backup-*.tar.gz | tail -n +8 | while read f; do
        log_warning "  → Removing: $(basename "$f")"
        rm -f "$f"
    done
else
    log_info "Daily backups: ${DAILY_COUNT} (within limit of 7)"
fi

# Weekly: keep last 13 (~3 months)
WEEKLY_COUNT=$(ls -1 "${WEEKLY_DIR}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l)
if [ "$WEEKLY_COUNT" -gt 13 ]; then
    log_info "Cleaning up old weekly backups (keeping last 13)..."
    ls -1t "${WEEKLY_DIR}"/couchdb-backup-*.tar.gz | tail -n +14 | while read f; do
        log_warning "  → Removing: $(basename "$f")"
        rm -f "$f"
    done
else
    log_info "Weekly backups: ${WEEKLY_COUNT} (within limit of 13)"
fi

# Monthly: never deleted
MONTHLY_COUNT=$(ls -1 "${MONTHLY_DIR}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l)
log_info "Monthly backups: ${MONTHLY_COUNT} (kept forever)"

echo ""

# ── Summary ────────────────────────────────────────
echo "==================================="
echo "Current Backups Summary"
echo "==================================="
echo ""

for tier in daily weekly monthly; do
    DIR="${BACKUP_ROOT}/${tier}"
    echo "── ${tier} ──"
    if ls "${DIR}"/couchdb-backup-*.tar.gz 1>/dev/null 2>&1; then
        for backup in $(ls -1t "${DIR}"/couchdb-backup-*.tar.gz); do
            printf "  %-40s %s\n" "$(basename "$backup")" "$(du -h "$backup" | cut -f1)"
        done
    else
        echo "  (none)"
    fi
    echo ""
done

total_size=$(du -sh "${BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "0")
log_info "Total backup storage: $total_size"
echo ""

# Restore hint
echo "==================================="
echo "Restore Commands"
echo "==================================="
echo "List all backups:    ./scripts/list-backups.sh"
echo "Restore a backup:    ./scripts/restore-backup.sh /opt/money-app-backups/<tier>/couchdb-backup-YYYY-MM-DD.tar.gz"
echo ""

log_success "Backup process completed successfully!"
