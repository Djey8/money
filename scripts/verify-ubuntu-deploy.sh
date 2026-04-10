#!/bin/bash
# Ubuntu Deployment Verification Script
# This script verifies that all monitoring components will be deployed correctly on Ubuntu

echo "================================================================"
echo "Ubuntu Deployment Verification for Monitoring System"
echo "================================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${PROJECT_DIR}/k8s"
BACKEND_DIR="${PROJECT_DIR}/backend"
ERRORS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking required files for monitoring deployment..."
echo ""

# Check Loki configuration
echo -n "Checking Loki configuration... "
if [ -f "${K8S_DIR}/loki.yaml" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Promtail configuration (K8s)
echo -n "Checking Promtail K8s configuration... "
if [ -f "${K8S_DIR}/promtail.yaml" ]; then
    # Check if it has the enhanced parsing for backend, frontend, and couchdb
    if grep -q "container=\"backend\"" "${K8S_DIR}/promtail.yaml" && \
       grep -q "container=\"frontend\"" "${K8S_DIR}/promtail.yaml" && \
       grep -q "container=\"couchdb\"" "${K8S_DIR}/promtail.yaml"; then
        echo -e "${GREEN}✓ Found with enhanced parsing${NC}"
    else
        echo -e "${YELLOW}⚠ Found but may need updates${NC}"
    fi
else
    echo -e "${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Promtail configuration (Docker Compose)
echo -n "Checking Promtail Docker Compose configuration... "
if [ -f "${PROJECT_DIR}/config/promtail-config.yaml" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${YELLOW}⚠ Missing (optional for docker-compose)${NC}"
fi

# Check Grafana Dashboards v1
echo -n "Checking Grafana dashboards v1... "
if [ -f "${K8S_DIR}/grafana-dashboards.yaml" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${YELLOW}⚠ Missing (optional)${NC}"
fi

# Check Grafana Dashboards v2
echo -n "Checking Grafana dashboards v2... "
if [ -f "${K8S_DIR}/grafana-dashboards-v2.yaml" ]; then
    # Verify it has the expected dashboards
    if grep -q "frontend-monitoring.json" "${K8S_DIR}/grafana-dashboards-v2.yaml" && \
       grep -q "backend-monitoring.json" "${K8S_DIR}/grafana-dashboards-v2.yaml" && \
       grep -q "user-activity.json" "${K8S_DIR}/grafana-dashboards-v2.yaml"; then
        echo -e "${GREEN}✓ Found with all dashboards${NC}"
    else
        echo -e "${YELLOW}⚠ Found but may be incomplete${NC}"
    fi
else
    echo -e "${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check backend logging middleware
echo -n "Checking backend logging middleware... "
if [ -f "${BACKEND_DIR}/middleware/logging.js" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${YELLOW}⚠ Missing (optional enhancement)${NC}"
fi

# Check backend logger configuration
echo -n "Checking backend logger configuration... "
if [ -f "${BACKEND_DIR}/config/logger.js" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${RED}✗ Missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check documentation
echo -n "Checking monitoring documentation... "
DOCS_FOUND=0
[ -f "${PROJECT_DIR}/docs/MONITORING-QUICKSTART.md" ] && DOCS_FOUND=$((DOCS_FOUND + 1))
[ -f "${PROJECT_DIR}/docs/MONITORING-DEBUGGING-GUIDE.md" ] && DOCS_FOUND=$((DOCS_FOUND + 1))

if [ $DOCS_FOUND -eq 2 ]; then
    echo -e "${GREEN}✓ All documentation found${NC}"
elif [ $DOCS_FOUND -eq 1 ]; then
    echo -e "${YELLOW}⚠ Partial documentation found${NC}"
else
    echo -e "${YELLOW}⚠ Documentation missing${NC}"
fi

echo ""
echo "================================================================"
echo "Checking deploy.sh script configuration..."
echo "================================================================"
echo ""

# Check if deploy.sh deploys both dashboard versions
echo -n "Checking deploy.sh deploys dashboards v1... "
if grep -q "grafana-dashboards.yaml" "${SCRIPT_DIR}/deploy.sh"; then
    echo -e "${GREEN}✓ Yes${NC}"
else
    echo -e "${RED}✗ No${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking deploy.sh deploys dashboards v2... "
if grep -q "grafana-dashboards-v2.yaml" "${SCRIPT_DIR}/deploy.sh"; then
    echo -e "${GREEN}✓ Yes${NC}"
else
    echo -e "${RED}✗ No - NEEDS UPDATE${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking deploy.sh deploys Promtail... "
if grep -q "promtail.yaml" "${SCRIPT_DIR}/deploy.sh"; then
    echo -e "${GREEN}✓ Yes${NC}"
else
    echo -e "${RED}✗ No${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo -n "Checking deploy.sh deploys Loki... "
if grep -q "loki.yaml" "${SCRIPT_DIR}/deploy.sh"; then
    echo -e "${GREEN}✓ Yes${NC}"
else
    echo -e "${RED}✗ No${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "================================================================"
echo "Summary"
echo "================================================================"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Deployment should work on Ubuntu.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Copy project to Ubuntu system"
    echo "  2. Run: chmod +x deploy.sh"
    echo "  3. Run: ./deploy.sh"
    echo "  4. Access Grafana: kubectl port-forward -n money-app svc/grafana 3000:80"
    echo "  5. Open http://localhost:3000 (login: admin/admin)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS critical issues that need to be fixed.${NC}"
    echo ""
    echo "Please review the errors above before deploying to Ubuntu."
    echo ""
    exit 1
fi
