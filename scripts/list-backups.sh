#!/bin/bash

# ============================================
# CouchDB Backup Listing Script
# ============================================
# Lists all available backups with restore commands
# Storage: /opt/money-app-backups/{daily,weekly,monthly}
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

    if [ $days -eq 0 ]; then
        echo "Today"
    elif [ $days -eq 1 ]; then
        echo "1 day ago"
    else
        echo "$days days ago"
    fi
}

echo "==================================="
echo "CouchDB Backup Inventory"
echo "==================================="
echo "Location: $BACKUP_ROOT"
echo ""

if [ ! -d "$BACKUP_ROOT" ]; then
    log_warning "Backup directory does not exist: $BACKUP_ROOT"
    echo "Run: sudo mkdir -p $BACKUP_ROOT"
    exit 0
fi

# Count totals
total=0
for tier in daily weekly monthly; do
    DIR="${BACKUP_ROOT}/${tier}"
    count=$(ls -1 "${DIR}"/couchdb-backup-*.tar.gz 2>/dev/null | wc -l)
    total=$((total + count))
done

if [ "$total" -eq 0 ]; then
    log_warning "No backup files found"
    exit 0
fi

# Display each tier
for tier in daily weekly monthly; do
    DIR="${BACKUP_ROOT}/${tier}"

    case $tier in
        daily)   COLOR=$NC;     LABEL="DAILY  (last 7 days)" ;;
        weekly)  COLOR=$YELLOW; LABEL="WEEKLY (last 3 months, Sundays)" ;;
        monthly) COLOR=$GREEN;  LABEL="MONTHLY (forever, 1st of month)" ;;
    esac

    echo -e "${COLOR}═══ ${LABEL} ═══${NC}"

    if ! ls "${DIR}"/couchdb-backup-*.tar.gz 1>/dev/null 2>&1; then
        echo "  (none)"
        echo ""
        continue
    fi

    printf "  ${CYAN}%-38s %-8s %-15s${NC}\n" "Filename" "Size" "Age"
    printf "  %-38s %-8s %-15s\n" "────────" "────" "───"

    for backup in $(ls -1t "${DIR}"/couchdb-backup-*.tar.gz 2>/dev/null); do
        backup_name=$(basename "$backup")
        backup_size=$(du -h "$backup" | cut -f1)
        backup_date=$(echo "$backup_name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
        backup_age=$(get_backup_age "$backup_date")
        printf "  %-38s %-8s %-15s\n" "$backup_name" "$backup_size" "$backup_age"
    done
    echo ""
done

# Storage summary
total_size=$(du -sh "${BACKUP_ROOT}" 2>/dev/null | cut -f1 || echo "0")
log_info "Total backup storage: $total_size"
echo ""

# Retention policy
echo "==================================="
echo "Retention Policy"
echo "==================================="
echo "  Daily:   7 days"
echo "  Weekly:  13 weeks (3 months)"
echo "  Monthly: forever"
echo ""

# Restore commands
echo "==================================="
echo "Quick Restore Commands"
echo "==================================="
echo ""
echo "Restore the latest daily backup:"
LATEST_DAILY=$(ls -1t "${BACKUP_ROOT}/daily"/couchdb-backup-*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST_DAILY" ]; then
    echo -e "  ${CYAN}./scripts/restore-backup.sh ${LATEST_DAILY}${NC}"
else
    echo "  (no daily backups available)"
fi
echo ""

echo "Restore the latest weekly backup:"
LATEST_WEEKLY=$(ls -1t "${BACKUP_ROOT}/weekly"/couchdb-backup-*.tar.gz 2>/dev/null | head -1)
if [ -n "$LATEST_WEEKLY" ]; then
    echo -e "  ${CYAN}./scripts/restore-backup.sh ${LATEST_WEEKLY}${NC}"
else
    echo "  (no weekly backups available)"
fi
echo ""

echo "Restore a specific backup:"
echo -e "  ${CYAN}./scripts/restore-backup.sh /opt/money-app-backups/<tier>/couchdb-backup-YYYY-MM-DD.tar.gz${NC}"
echo ""

echo "Manual backup now:"
echo -e "  ${CYAN}./scripts/backup.sh${NC}"
echo ""
