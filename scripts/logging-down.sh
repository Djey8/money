#!/bin/bash
# Tear down the logging stack (Loki, Grafana, Promtail) without affecting the app
#
# Usage: ./scripts/logging-down.sh
# Counterpart: ./scripts/logging-up.sh

set -euo pipefail

NAMESPACE="money-app"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}==> Stopping Logging Stack...${NC}"
echo ""

# Check namespace exists
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo -e "${RED}[ERROR] Namespace ${NAMESPACE} not found.${NC}"
    exit 1
fi

# Delete Promtail
echo "Removing Promtail..."
kubectl delete daemonset promtail -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete serviceaccount promtail -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete clusterrolebinding promtail 2>/dev/null || true
kubectl delete clusterrole promtail 2>/dev/null || true
kubectl delete configmap promtail-config -n "${NAMESPACE}" 2>/dev/null || true
echo -e "${GREEN}[OK] Promtail removed${NC}"

# Delete Grafana
echo "Removing Grafana..."
kubectl delete deployment grafana -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete service grafana -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete configmap grafana-config grafana-datasources grafana-dashboard-provider grafana-dashboards grafana-frontend-dashboard -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete secret grafana-secret -n "${NAMESPACE}" 2>/dev/null || true
echo -e "${GREEN}[OK] Grafana removed${NC}"

# Delete Loki
echo "Removing Loki..."
kubectl delete statefulset loki -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete service loki -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete configmap loki-config -n "${NAMESPACE}" 2>/dev/null || true
kubectl delete pvc loki-data-loki-0 -n "${NAMESPACE}" 2>/dev/null || true
echo -e "${GREEN}[OK] Loki removed${NC}"
echo ""

# Show remaining pods
echo -e "${BLUE}==> Remaining Pods:${NC}"
kubectl get pods -n "${NAMESPACE}"
echo ""

echo "======================================"
echo -e "${GREEN}  Logging Stack Removed${NC}"
echo "======================================"
echo ""
echo "  To re-enable: ./scripts/logging-up.sh"
echo ""
