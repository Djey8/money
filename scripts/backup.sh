#!/bin/bash

# ============================================
# CouchDB Backup Script with Tiered Retention
# ============================================
# 
# Local Retention Policy (/opt/money-app-backups):
# - Hourly:  Keep last 24
# - Daily:   Keep last 7 days
# - Weekly:  Keep Sunday backups for 3 months (13 weeks)
# - Monthly: Keep 1st-of-month backups forever
#
# NAS Retention Policy (/mnt/nas/backups):
# - Daily:   Keep last 21 days (3 weeks)
# - Weekly:  Keep last 104 weeks (2 years)
# - Monthly: Keep forever
#
# Usage:
#   ./backup.sh              Full backup (local + NAS)
#   ./backup.sh --hourly     Hourly backup only (local only)
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
NAS_BACKUP_ROOT="${NAS_BACKUP_DIR:-/mnt/nas/backups}"
DATE=$(date +%Y-%m-%d)
HOUR=$(date +%H)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)   # 1=Mon … 7=Sun
DAY_OF_MONTH=$(date +%d)
HOURLY_ONLY=false

# Parse arguments
if [ "$1" = "--hourly" ]; then
    HOURLY_ONLY=true
fi

# Local directories
HOURLY_DIR="${BACKUP_ROOT}/hourly"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
MONTHLY_DIR="${BACKUP_ROOT}/monthly"
HOURLY_FILE="${HOURLY_DIR}/couchdb-backup-${DATE}_${HOUR}00.tar.gz"
BACKUP_FILE="${DAILY_DIR}/couchdb-backup-${DATE}.tar.gz"

# NAS directories
NAS_DAILY_DIR="${NAS_BACKUP_ROOT}/daily"
NAS_WEEKLY_DIR="${NAS_BACKUP_ROOT}/weekly"
NAS_MONTHLY_DIR="${NAS_BACKUP_ROOT}/monthly"

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

# Check NAS availability
NAS_AVAILABLE=false
if mountpoint -q "$(dirname "$NAS_BACKUP_ROOT")" 2>/dev/null || [ -d "$NAS_BACKUP_ROOT" ]; then
    NAS_AVAILABLE=true
fi

# Create backup directories
mkdir -p "$HOURLY_DIR" "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"
if [ "$NAS_AVAILABLE" = true ]; then
    mkdir -p "$NAS_DAILY_DIR" "$NAS_WEEKLY_DIR" "$NAS_MONTHLY_DIR"
else
    log_warning "NAS not available at $(dirname "$NAS_BACKUP_ROOT") — NAS backups will be skipped"
fi

echo "==================================="
echo "CouchDB Backup Script"
echo "==================================="
log_info "Date: $(date)"
log_info "Namespace: $NAMESPACE"
log_info "Mode: $([ "$HOURLY_ONLY" = true ] && echo 'Hourly (NAS only)' || echo 'Full (local + NAS)')"
log_info "NAS: $([ "$NAS_AVAILABLE" = true ] && echo 'Available' || echo 'Not available')"
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
    "local": { "hourly": "24", "daily": "7 days", "weekly": "13 weeks", "monthly": "forever" },
    "nas": { "daily": "21 days", "weekly": "104 weeks", "monthly": "forever" }
  }
}
EOF

# Create compressed archive in temp
log_info "Creating compressed backup archive..."
ARCHIVE_FILE="${TEMP_DIR}/couchdb-backup-${DATE}_${HOUR}00.tar.gz"
tar -czf "$ARCHIVE_FILE" -C "$TEMP_DIR" --exclude='*.tar.gz' .
BACKUP_SIZE=$(du -h "$ARCHIVE_FILE" | cut -f1)
log_success "Archive created ($BACKUP_SIZE)"
echo ""

# ── Write to local storage ─────────────────────────
echo "==================================="
echo "Local Storage (${BACKUP_ROOT})"
echo "==================================="

# Always write hourly
cp "$ARCHIVE_FILE" "$HOURLY_FILE"
log_success "Local hourly: $(basename "$HOURLY_FILE")"

if [ "$HOURLY_ONLY" = false ]; then
    # Daily
    cp "$ARCHIVE_FILE" "$BACKUP_FILE"
    log_success "Local daily: $(basename "$BACKUP_FILE")"

    # Sunday → promote to weekly
    if [ "$DAY_OF_WEEK" = "7" ]; then
        cp "$ARCHIVE_FILE" "${WEEKLY_DIR}/couchdb-backup-${DATE}.tar.gz"
        log_success "Local weekly (Sunday)"
    else
        log_info "Not Sunday — skipping weekly promotion"
    fi

    # 1st of month → promote to monthly
    if [ "$DAY_OF_MONTH" = "01" ]; then
        cp "$ARCHIVE_FILE" "${MONTHLY_DIR}/couchdb-backup-${DATE}.tar.gz"
        log_success "Local monthly (1st of month)"
    else
        log_info "Not 1st — skipping monthly promotion"
    fi
fi
echo ""

# ── Write to NAS storage ───────────────────────────
if [ "$NAS_AVAILABLE" = true ]; then
    echo "==================================="
    echo "NAS Storage (${NAS_BACKUP_ROOT})"
    echo "==================================="

    if [ "$HOURLY_ONLY" = false ]; then
        # Daily
        cp "$ARCHIVE_FILE" "${NAS_DAILY_DIR}/couchdb-backup-${DATE}.tar.gz"
        log_success "NAS daily: couchdb-backup-${DATE}.tar.gz"

        # Sunday → weekly
        if [ "$DAY_OF_WEEK" = "7" ]; then
            cp "$ARCHIVE_FILE" "${NAS_WEEKLY_DIR}/couchdb-backup-${DATE}.tar.gz"
            log_success "NAS weekly (Sunday)"
        fi

        # 1st of month → monthly
        if [ "$DAY_OF_MONTH" = "01" ]; then
            cp "$ARCHIVE_FILE" "${NAS_MONTHLY_DIR}/couchdb-backup-${DATE}.tar.gz"
            log_success "NAS monthly (1st of month)"
        fi
    else
        log_info "Hourly mode — NAS skipped (no NAS hourly tier)"
    fi
    echo ""
fi

# Cleanup temp directory
rm -rf "$TEMP_DIR"

# ── Retention cleanup ──────────────────────────────
echo "==================================="
echo "Applying Retention Policy"
echo "==================================="

cleanup_tier() {
    local dir=$1 keep=$2 label=$3
    local count
    count=$(ls -1 "${dir}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l)
    if [ "$count" -gt "$keep" ]; then
        log_info "Cleaning ${label} (keeping last ${keep})..."
        ls -1t "${dir}"/couchdb-backup-*.tar.gz | tail -n +$((keep + 1)) | while read f; do
            log_warning "  → Removing: $(basename "$f")"
            rm -f "$f"
        done
    else
        log_info "${label}: ${count} (limit ${keep})"
    fi
}

echo "── Local ──"
cleanup_tier "$HOURLY_DIR"  24 "Local hourly"
cleanup_tier "$DAILY_DIR"   7  "Local daily"
cleanup_tier "$WEEKLY_DIR"  13 "Local weekly"
log_info "Local monthly: $(ls -1 "${MONTHLY_DIR}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l) (kept forever)"

if [ "$NAS_AVAILABLE" = true ]; then
    echo "── NAS ──"
    cleanup_tier "$NAS_DAILY_DIR"   21  "NAS daily"
    cleanup_tier "$NAS_WEEKLY_DIR"  104 "NAS weekly"
    log_info "NAS monthly: $(ls -1 "${NAS_MONTHLY_DIR}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l) (kept forever)"
fi
echo ""

# ── Summary ────────────────────────────────────────
echo "==================================="
echo "Current Backups Summary"
echo "==================================="

print_tier_summary() {
    local dir=$1 label=$2
    echo "── ${label} ──"
    if ls "${dir}"/couchdb-backup-*.tar.gz 1>/dev/null 2>&1; then
        for backup in $(ls -1t "${dir}"/couchdb-backup-*.tar.gz); do
            printf "  %-50s %s\n" "$(basename "$backup")" "$(du -h "$backup" | cut -f1)"
        done
    else
        echo "  (none)"
    fi
}

echo ""
echo "=== LOCAL ==="
for tier in hourly daily weekly monthly; do
    print_tier_summary "${BACKUP_ROOT}/${tier}" "${tier}"
done

total_local=$(du -sh "${BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "0")
log_info "Local storage: $total_local"
echo ""

if [ "$NAS_AVAILABLE" = true ]; then
    echo "=== NAS ==="
    for tier in daily weekly monthly; do
        print_tier_summary "${NAS_BACKUP_ROOT}/${tier}" "${tier}"
    done

    total_nas=$(du -sh "${NAS_BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "0")
    log_info "NAS storage: $total_nas"
    echo ""
fi

# Restore hint
echo "==================================="
echo "Restore Commands"
echo "==================================="
echo "List all backups:    ./scripts/list-backups.sh"
echo "Restore a backup:    ./scripts/restore-backup.sh <path-to-backup.tar.gz>"
echo ""

log_success "Backup process completed successfully!"
