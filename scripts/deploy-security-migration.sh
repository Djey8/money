#!/bin/bash
# =============================================================
# SECURITY MIGRATION DEPLOY SCRIPT
# =============================================================
# This script safely deploys the security fixes to the k3s cluster.
# 
# Prerequisites:
#   1. kubectl configured for your k3s cluster
#   2. k8s/secrets.yaml populated with REAL secrets (not placeholders)
#   3. Manual backup verified: kubectl get jobs -n money-app
#
# What this does:
#   1. Triggers a backup before any changes
#   2. Applies new secrets to the cluster
#   3. Rebuilds and deploys backend (new password policy, CORS, rate limiting)
#   4. Rebuilds and deploys frontend (nginx hardened, no CouchDB proxy)
#   5. Restarts CouchDB with new password (brief downtime)
#   6. Restarts backend to pick up new secrets
#
# ⚠️  IMPORTANT: Changing CouchDB password requires updating the
#     password inside CouchDB itself. See Step 5 below.
# =============================================================

set -euo pipefail

NAMESPACE="money-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "  Money App - Security Migration Deploy"
echo "============================================="
echo ""

# Pre-flight checks
echo "[1/7] Pre-flight checks..."
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
  echo "ERROR: Namespace '$NAMESPACE' not found. Is kubectl configured?"
  exit 1
fi

if grep -q "REPLACE_WITH_REAL" "$PROJECT_DIR/k8s/secrets.yaml"; then
  echo "ERROR: k8s/secrets.yaml still has placeholder values!"
  echo "       Edit the file and replace REPLACE_WITH_REAL_* with actual secrets."
  exit 1
fi

echo "  ✓ Namespace exists"
echo "  ✓ Secrets file populated"
echo ""

# Step 1: Trigger backup
echo "[2/7] Triggering backup before migration..."
if kubectl get cronjob couchdb-backup -n "$NAMESPACE" &>/dev/null; then
  kubectl create job --from=cronjob/couchdb-backup "pre-migration-backup-$(date +%s)" -n "$NAMESPACE"
  echo "  ✓ Backup job created. Waiting 30s for completion..."
  sleep 30
else
  echo "  ⚠ No couchdb-backup cronjob found, skipping automatic backup."
  echo "    Consider taking a manual backup before proceeding."
fi
echo ""

# Step 2: Apply new k8s configs (ConfigMap changes: CORS, rate limiting, debug off)
echo "[3/7] Applying updated ConfigMap..."
kubectl apply -f "$PROJECT_DIR/k8s/backend.yaml" -n "$NAMESPACE"
echo "  ✓ Backend ConfigMap updated (CORS restricted, rate limiting ON, debug OFF)"
echo ""

# Step 3: Apply new secrets
echo "[4/7] Applying new secrets..."
kubectl apply -f "$PROJECT_DIR/k8s/secrets.yaml"
echo "  ✓ New secrets applied to cluster"
echo ""

# Step 4: Rebuild and deploy backend
echo "[5/7] Rebuilding backend image..."
cd "$PROJECT_DIR"
docker build -t localhost/money-backend:latest ./backend
echo "  ✓ Backend image rebuilt"
echo ""

# Step 5: Rebuild and deploy frontend (nginx hardened)
echo "[6/7] Rebuilding frontend image..."
docker build -t localhost/money-frontend:latest .
echo "  ✓ Frontend image rebuilt (CouchDB proxy removed, security headers added)"
echo ""

# Step 6: Rolling restart
echo "[7/7] Rolling restart of all pods..."
kubectl rollout restart deployment/backend -n "$NAMESPACE"
kubectl rollout restart deployment/frontend -n "$NAMESPACE"
kubectl rollout restart statefulset/couchdb -n "$NAMESPACE"

echo ""
echo "  Waiting for rollout..."
kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=120s
kubectl rollout status deployment/frontend -n "$NAMESPACE" --timeout=120s
kubectl rollout status statefulset/couchdb -n "$NAMESPACE" --timeout=120s

echo ""
echo "============================================="
echo "  ✓ Migration complete!"
echo "============================================="
echo ""
echo "Post-migration checklist:"
echo "  □ Test login at https://cashflowhero.uk (existing sessions invalidated - re-login needed)"
echo "  □ Verify /_utils is no longer accessible from browser"
echo "  □ Verify rate limiting: curl -v https://cashflowhero.uk/api/auth/login"
echo "  □ Check backend logs: kubectl logs -l app=backend -n $NAMESPACE --tail=50"
echo ""
echo "If CouchDB password was changed, you also need to update it inside CouchDB:"
echo "  kubectl port-forward svc/couchdb 5984:5984 -n $NAMESPACE"
echo "  curl -X PUT http://admin:OLD_PASSWORD@localhost:5984/_node/_local/_config/admins/admin -d '\"NEW_PASSWORD\"'"
echo ""
