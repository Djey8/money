#!/bin/bash

# ============================================
# CouchDB Backup Listing Script
# ============================================
# Lists all available backups with restore commands
# Local:  /opt/money-app-backups/{hourly,daily,weekly,monthly}
# NAS:    /mnt/nas/backups/{daily,weekly,monthly}
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="${BACKUP_DIR:-/opt/money-app-backups}"
NAS_BACKUP_ROOT="${NAS_BACKUP_DIR:-/mnt/nas/backups}"

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Function to get age of backup
get_backup_age() {
    local backup_date=$1
    local current_date=$(date +%s)
    local backup_timestamp=$(date -d "$backup_date" +%s 2>/dev/null || echo "0")

    if [ "$backup_timestamp" = "0" ]; then
        echo "Unknown"
        return
    fi

    local diff=$((current_date - backup_timestamp))
    local days=$((diff / 86400))
    local hours=$(( (diff % 86400) / 3600 ))

    if [ $days -eq 0 ]; then
        if [ $hours -eq 0 ]; then
            echo "Just now"
        elif [ $hours -eq 1 ]; then
            echo "1 hour ago"
        else
            echo "${hours} hours ago"
        fi
    elif [ $days -eq 1 ]; then
        echo "1 day ago"
    else
        echo "$days days ago"
    fi
}

# Get age for hourly backups (includes time in filename)
get_hourly_age() {
    local backup_name=$1
    local backup_datetime=$(echo "$backup_name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}')
    if [ -z "$backup_datetime" ]; then
        get_backup_age "$(echo "$backup_name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')"
        return
    fi
    local d=$(echo "$backup_datetime" | sed 's/_/ /' | sed 's/\([0-9][0-9]\)\([0-9][0-9]\)$/\1:\2/')
    local current_date=$(date +%s)
    local backup_timestamp=$(date -d "$d" +%s 2>/dev/null || echo "0")
    if [ "$backup_timestamp" = "0" ]; then
        echo "Unknown"
        return
    fi
    local diff=$((current_date - backup_timestamp))
    local hours=$((diff / 3600))
    if [ $hours -eq 0 ]; then
        echo "Just now"
    elif [ $hours -eq 1 ]; then
        echo "1 hour ago"
    else
        echo "${hours} hours ago"
    fi
}

# Function to list a tier
list_tier() {
    local dir=$1 label=$2 color=$3 age_func=${4:-date}

    echo -e "${color}═══ ${label} ═══${NC}"

    if ! ls "${dir}"/couchdb-backup-*.tar.gz* 1>/dev/null 2>&1; then
        echo "  (none)"
        echo ""
        return
    fi

    printf "  ${CYAN}%-50s %-8s %-15s${NC}\n" "Filename" "Size" "Age"
    printf "  %-50s %-8s %-15s\n" "────────" "────" "───"

    for backup in $(ls -1t "${dir}"/couchdb-backup-*.tar.gz* 2>/dev/null); do
        backup_name=$(basename "$backup")
        backup_size=$(du -h "$backup" | cut -f1)
        if [ "$age_func" = "hourly" ]; then
            backup_age=$(get_hourly_age "$backup_name")
        else
            backup_date=$(echo "$backup_name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
            backup_age=$(get_backup_age "$backup_date")
        fi
        printf "  %-50s %-8s %-15s\n" "$backup_name" "$backup_size" "$backup_age"
    done
    echo ""
}

echo "==================================="
echo "CouchDB Backup Inventory"
echo "==================================="
echo ""

# ── LOCAL ────────────────────────────────────────────
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         LOCAL BACKUPS                ║${NC}"
echo -e "${BLUE}║  ${NC}${BACKUP_ROOT}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

if [ ! -d "$BACKUP_ROOT" ]; then
    log_warning "Local backup directory does not exist: $BACKUP_ROOT"
else
    list_tier "${BACKUP_ROOT}/hourly"  "HOURLY  (last 24)"                  "$CYAN"   "hourly"
    list_tier "${BACKUP_ROOT}/daily"   "DAILY   (last 7 days)"              "$NC"      "date"
    list_tier "${BACKUP_ROOT}/weekly"  "WEEKLY  (last 13 weeks, Sundays)"   "$YELLOW"  "date"
    list_tier "${BACKUP_ROOT}/monthly" "MONTHLY (forever, 1st of month)"    "$GREEN"   "date"

    total_local=$(du -sh "${BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "0")
    log_info "Local storage: $total_local"
fi
echo ""

# ── NAS ──────────────────────────────────────────────
NAS_AVAILABLE=false
if timeout 5 stat "$NAS_BACKUP_ROOT" >/dev/null 2>&1; then
    NAS_AVAILABLE=true
fi

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         NAS BACKUPS                  ║${NC}"
echo -e "${GREEN}║  ${NC}${NAS_BACKUP_ROOT}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

if [ "$NAS_AVAILABLE" = false ]; then
    log_warning "NAS not reachable or backup directory does not exist: $NAS_BACKUP_ROOT"
else
    list_tier "${NAS_BACKUP_ROOT}/daily"   "DAILY   (last 21 days / 3 weeks)"    "$NC"      "date"
    list_tier "${NAS_BACKUP_ROOT}/weekly"  "WEEKLY  (last 104 weeks / 2 years)"  "$YELLOW"  "date"
    list_tier "${NAS_BACKUP_ROOT}/monthly" "MONTHLY (forever, 1st of month)"     "$GREEN"   "date"

    total_nas=$(du -sh "${NAS_BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "0")
    log_info "NAS storage: $total_nas"
fi
echo ""

# ── Retention policy ─────────────────────────────────
echo "==================================="
echo "Retention Policy"
echo "==================================="
echo "  LOCAL:"
echo "    Hourly:   24"
echo "    Daily:    7 days"
echo "    Weekly:   13 weeks (3 months)"
echo "    Monthly:  forever"
echo "  NAS:"
echo "    Daily:    21 days (3 weeks)"
echo "    Weekly:   104 weeks (2 years)"
echo "    Monthly:  forever"
echo ""

# ── Quick restore commands ───────────────────────────
echo "==================================="
echo "Quick Restore Commands"
echo "==================================="
echo ""

echo "Restore latest local hourly:"
LATEST=$(ls -1t "${BACKUP_ROOT}/hourly"/couchdb-backup-*.tar.gz* 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
    echo -e "  ${CYAN}./scripts/restore-backup.sh ${LATEST}${NC}"
else
    echo "  (none available)"
fi
echo ""

echo "Restore latest local daily:"
LATEST=$(ls -1t "${BACKUP_ROOT}/daily"/couchdb-backup-*.tar.gz* 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
    echo -e "  ${CYAN}./scripts/restore-backup.sh ${LATEST}${NC}"
else
    echo "  (none available)"
fi
echo ""

echo "Restore latest NAS daily:"
if [ "$NAS_AVAILABLE" = true ]; then
    LATEST=$(timeout 5 ls -1t "${NAS_BACKUP_ROOT}/daily"/couchdb-backup-*.tar.gz* 2>/dev/null | head -1)
    if [ -n "$LATEST" ]; then
        echo -e "  ${CYAN}./scripts/restore-backup.sh ${LATEST}${NC}"
    else
        echo "  (none available)"
    fi
else
    echo "  (NAS not reachable)"
fi
echo ""

echo "Restore a specific backup:"
echo -e "  ${CYAN}./scripts/restore-backup.sh <path-to-backup.tar.gz[.gpg]>${NC}"
echo ""

echo "Manual backup now:"
echo -e "  ${CYAN}./scripts/backup.sh${NC}"
echo -e "  ${CYAN}./scripts/backup.sh --hourly${NC}  (hourly only, local)"
echo ""
