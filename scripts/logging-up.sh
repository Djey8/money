#!/bin/bash
# Start the logging stack (Loki, Grafana, Promtail) on a running deployment
#
# Usage: ./scripts/logging-up.sh
# Counterpart: ./scripts/logging-down.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${PROJECT_DIR}/k8s"
NAMESPACE="money-app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}==> Starting Logging Stack...${NC}"
echo ""

# Check namespace exists
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    echo -e "${RED}[ERROR] Namespace ${NAMESPACE} not found. Deploy the app first.${NC}"
    exit 1
fi

# Pull logging images if needed
LOGGING_IMAGES=(
    "grafana/loki:2.9.3"
    "grafana/grafana:10.2.0"
    "grafana/promtail:2.9.3"
)

echo "Checking logging images..."
for IMAGE in "${LOGGING_IMAGES[@]}"; do
    if sudo k3s ctr images ls 2>/dev/null | grep -q "${IMAGE}" 2>/dev/null; then
        echo -e "${GREEN}[OK] ${IMAGE} cached${NC}"
    else
        echo -e "${YELLOW}Pulling ${IMAGE}...${NC}"
        if command -v podman &> /dev/null; then
            podman pull "docker.io/${IMAGE}" &> /dev/null && \
            podman save "docker.io/${IMAGE}" | sudo k3s ctr images import - &> /dev/null && \
            echo -e "${GREEN}[OK] ${IMAGE} loaded${NC}" || \
            echo -e "${YELLOW}[WARN] Failed to pull ${IMAGE}${NC}"
        else
            sudo k3s ctr images pull "docker.io/${IMAGE}" &> /dev/null && \
            echo -e "${GREEN}[OK] ${IMAGE} loaded${NC}" || \
            echo -e "${YELLOW}[WARN] Failed to pull ${IMAGE}${NC}"
        fi
    fi
done
echo ""

# Deploy Loki
echo "Deploying Loki..."
kubectl apply -f "${K8S_DIR}/loki.yaml" 2>&1 | sed 's/^/  → /'
echo -e "${GREEN}[OK] Loki deployed${NC}"

# Deploy Grafana Dashboards
echo "Deploying Grafana Dashboards..."
kubectl apply -f "${K8S_DIR}/grafana-dashboards.yaml" 2>&1 | sed 's/^/  → /'
echo -e "${GREEN}[OK] Grafana dashboards deployed${NC}"

# Deploy Frontend Dashboard
if [ -f "${K8S_DIR}/grafana-frontend-dashboard.yaml" ]; then
    echo "Deploying Frontend Activity Dashboard..."
    kubectl apply -f "${K8S_DIR}/grafana-frontend-dashboard.yaml" 2>&1 | sed 's/^/  → /'
    echo -e "${GREEN}[OK] Frontend Activity dashboard deployed${NC}"
fi

# Deploy Promtail
echo "Deploying Promtail..."
kubectl apply -f "${K8S_DIR}/promtail.yaml" 2>&1 | sed 's/^/  → /'
echo -e "${GREEN}[OK] Promtail deployed${NC}"
echo ""

# Wait for pods
echo "Waiting for logging pods to be ready..."
kubectl wait --for=condition=ready pod -l app=grafana -n "${NAMESPACE}" --timeout=120s 2>/dev/null || true
kubectl wait --for=condition=ready pod -l app=promtail -n "${NAMESPACE}" --timeout=120s 2>/dev/null || true
echo ""

# Show status
echo -e "${BLUE}==> Logging Stack Status:${NC}"
kubectl get pods -n "${NAMESPACE}" -l 'app in (loki,grafana,promtail)'
echo ""

echo "======================================"
echo -e "${GREEN}  Logging Stack Active${NC}"
echo "======================================"
echo ""
echo "  Grafana: kubectl port-forward -n ${NAMESPACE} svc/grafana 3000:3000"
echo "  Tear down: ./scripts/logging-down.sh"
echo ""
