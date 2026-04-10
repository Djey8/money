#!/bin/bash

# ============================================
# CouchDB Backup Restore Script
# ============================================
# Restores a CouchDB backup from a .tar.gz archive.
# The backup format is _all_docs?include_docs=true output.
# Documents are cleaned (strip _rev) before bulk-inserting.
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
BACKUP_FILE="$1"

# Functions
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Usage ────────────────────────────────────────────
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <backup-file.tar.gz>"
    echo ""
    echo "Available backups:"
    for tier in daily weekly monthly; do
        DIR="${BACKUP_ROOT}/${tier}"
        if ls "${DIR}"/couchdb-backup-*.tar.gz 1>/dev/null 2>&1; then
            echo "  [${tier}]"
            ls -1t "${DIR}"/couchdb-backup-*.tar.gz | sed 's/^/    /'
        fi
    done
    echo ""
    echo "List with details:  ./scripts/list-backups.sh"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

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

echo "==================================="
echo "CouchDB Backup Restore"
echo "==================================="
log_info "Backup file: $BACKUP_FILE"
log_info "Namespace: $NAMESPACE"
log_info "Target pod: $BACKUP_POD"
echo ""

# Warning
log_warning "This will restore the backup and may overwrite existing data!"
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restore cancelled by user"
    exit 0
fi

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

# Create temporary directory
TEMP_DIR="./restore_temp_$$"
mkdir -p "$TEMP_DIR"

# Extract backup
log_info "Extracting backup archive..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

if [ $? -ne 0 ]; then
    log_error "Failed to extract backup archive"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check for metadata
if [ -f "${TEMP_DIR}/backup-metadata.json" ]; then
    log_info "Backup metadata:"
    cat "${TEMP_DIR}/backup-metadata.json" | sed 's/^/  /'
    echo ""
fi

# Get list of database files
DB_FILES=($(ls "${TEMP_DIR}"/*.json 2>/dev/null | grep -v "backup-metadata.json" || echo ""))

if [ ${#DB_FILES[@]} -eq 0 ]; then
    log_error "No database files found in backup"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log_info "Found ${#DB_FILES[@]} database(s) to restore"
echo ""

# Restore each database
for db_file in "${DB_FILES[@]}"; do
    db_name=$(basename "$db_file" .json)
    log_info "Restoring database: $db_name"

    # Check if database exists
    HTTP_CODE=$(kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- \
        curl -s -o /dev/null -w "%{http_code}" \
        -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
        "http://localhost:5984/$db_name")

    if [ "$HTTP_CODE" = "200" ]; then
        log_warning "  → Database exists, deleting and recreating..."
        kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- \
            curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
            -X DELETE "http://localhost:5984/$db_name" > /dev/null
    fi

    # Create database
    log_info "  → Creating database..."
    kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- \
        curl -sf -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
        -X PUT "http://localhost:5984/$db_name" > /dev/null

    if [ $? -ne 0 ]; then
        log_error "  → Failed to create database $db_name"
        continue
    fi

    # The backup is _all_docs output: {"total_rows":N,"offset":0,"rows":[{"id":..,"doc":{...}}]}
    # We need to:
    #   1. Extract the docs from .rows[].doc
    #   2. Strip _rev from each doc (new DB = no revisions)
    #   3. Wrap in {"docs": [...]} for _bulk_docs
    log_info "  → Preparing documents (stripping _rev for clean insert)..."

    # Build a bulk_docs payload: extract docs, remove _rev fields
    # Uses sed/awk since the curl image may not have jq
    # Copy the prepared payload to the pod and POST to _bulk_docs
    python3 -c "
import json, sys
with open('$db_file') as f:
    data = json.load(f)
docs = []
for row in data.get('rows', []):
    doc = row.get('doc', {})
    if doc.get('_id', '').startswith('_design'):
        doc.pop('_rev', None)
        docs.append(doc)
        continue
    doc.pop('_rev', None)
    docs.append(doc)
print(json.dumps({'docs': docs, 'new_edits': True}))
" > "${TEMP_DIR}/${db_name}_bulk.json" 2>/dev/null

    # Fallback if python3 is not available: use sed-based approach
    if [ $? -ne 0 ] || [ ! -s "${TEMP_DIR}/${db_name}_bulk.json" ]; then
        log_warning "  → python3 not available, using sed fallback..."
        # Extract rows array, get docs, strip _rev
        sed 's/,"_rev":"[^"]*"//g' "$db_file" | \
        sed 's/"_rev":"[^"]*",//g' | \
        sed 's/.*"rows":\[//;s/\].*$//' | \
        sed 's/{"id":"[^"]*","key":"[^"]*","value":{"rev":"[^"]*"},"doc"://g' | \
        sed 's/},\?$//' | \
        awk 'BEGIN{printf "{\"docs\":["} {print} END{printf "],\"new_edits\":true}"}' \
        > "${TEMP_DIR}/${db_name}_bulk.json"
    fi

    doc_count=$(grep -o '"_id"' "${TEMP_DIR}/${db_name}_bulk.json" | wc -l)
    log_info "  → Inserting $doc_count documents..."

    # Copy to pod and bulk insert
    kubectl cp "${TEMP_DIR}/${db_name}_bulk.json" "$NAMESPACE/$BACKUP_POD:/tmp/${db_name}_bulk.json"

    RESULT=$(kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- sh -c "
        curl -s -u '${COUCHDB_USER}:${COUCHDB_PASSWORD}' \
             -X POST 'http://localhost:5984/${db_name}/_bulk_docs' \
             -H 'Content-Type: application/json' \
             -d @/tmp/${db_name}_bulk.json
        rm -f /tmp/${db_name}_bulk.json
    ")

    # Count successes/failures
    ok_count=$(echo "$RESULT" | grep -o '"ok":true' | wc -l)
    err_count=$(echo "$RESULT" | grep -o '"error"' | wc -l)

    if [ "$err_count" -gt 0 ]; then
        log_warning "  → $ok_count OK, $err_count errors"
        echo "$RESULT" | grep '"error"' | head -5 | sed 's/^/    /'
    else
        log_success "  → $ok_count documents restored successfully"
    fi
    echo ""
done

# Cleanup
log_info "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo ""

# Verify databases
log_info "Verifying restored databases..."
kubectl exec -n "$NAMESPACE" "$BACKUP_POD" -- \
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
    "http://localhost:5984/_all_dbs" | tr -d '[]"' | tr ',' '\n' | grep -v '^_' | sed 's/^/  /'

echo ""
log_success "Restore completed successfully!"
