#!/bin/bash

# Deploy script for Kubernetes
# Usage: ./deploy.sh [namespace] [options]
#
# This script deploys the Money App to Kubernetes with proper error handling
# and validation. It will fail fast if any component fails to deploy.
#
# Options:
#   --skip-build          Skip building images entirely
#   --no-cache            Force rebuild without Docker cache (ensures latest code)
#   --skip-frontend       Skip frontend build/deploy
#   --skip-backend        Skip backend build/deploy
#   --skip-tls            Skip TLS certificate creation
#   --no-ingress          Skip Ingress deployment
#   --no-backup           Skip ALL backup CronJob deployment (hourly + daily/NAS)
#   --no-local-backup     Skip hourly local backup CronJob only
#   --no-nas-backup       Skip daily+NAS backup CronJob only (for setups without NAS)
#   --no-logging          Skip logging stack (Loki, Grafana w/dashboards, Promtail)
#   --port-forward        Start port-forward after deployment
#   --prd                 Production preset: --no-cache + --no-logging
#   --dev                 Development preset: --no-cache (logging enabled)
#
# Examples:
#   ./deploy.sh                              # Full deployment with cache
#   ./deploy.sh --no-cache                   # Full deployment, force fresh build
#   ./deploy.sh --skip-build                 # Deploy without rebuilding images
#   ./deploy.sh --no-cache --backend-only    # Rebuild only backend (no cache)
#   ./deploy.sh --skip-frontend              # Deploy only backend + CouchDB
#   ./deploy.sh --port-forward               # Deploy and auto port-forward
#   ./deploy.sh --no-ingress --no-backup     # Minimal deployment (no backups at all)
#   ./deploy.sh --no-nas-backup              # Deploy without NAS backup (no NAS required)
#   ./deploy.sh --no-local-backup            # Deploy without hourly local backup
#   ./deploy.sh --no-logging                 # Deploy without logging stack
#   ./deploy.sh --prd                        # Production: fresh build, no logging
#   ./deploy.sh --dev                        # Development: fresh build, with logging

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Parse arguments
NAMESPACE="money-app"
SKIP_BUILD=false
NO_CACHE=false
SKIP_FRONTEND=false
SKIP_BACKEND=false
SKIP_TLS=false
NO_INGRESS=false
NO_BACKUP=false
NO_LOCAL_BACKUP=false
NO_NAS_BACKUP=false
NO_LOGGING=false
PORT_FORWARD=false

for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            shift
            ;;
        --skip-tls)
            SKIP_TLS=true
            shift
            ;;
        --no-ingress)
            NO_INGRESS=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --no-local-backup)
            NO_LOCAL_BACKUP=true
            shift
            ;;
        --no-nas-backup)
            NO_NAS_BACKUP=true
            shift
            ;;
        --no-logging)
            NO_LOGGING=true
            shift
            ;;
        --port-forward)
            PORT_FORWARD=true
            shift
            ;;
        --prd)
            NO_CACHE=true
            NO_LOGGING=true
            shift
            ;;
        --dev)
            NO_CACHE=true
            shift
            ;;
        *)
            # Assume it's the namespace if it doesn't start with --
            if [[ ! $arg =~ ^-- ]]; then
                NAMESPACE=$arg
            fi
            shift
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${PROJECT_DIR}/k8s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_step() {
    echo -e "\n${BLUE}📦${NC} $1"
}

# Cleanup function for failures
cleanup_on_failure() {
    log_error "Deployment failed!"
    
    log_info "Namespace '${NAMESPACE}' was NOT deleted to preserve data"
    log_info "To clean up manually, run: kubectl delete namespace ${NAMESPACE}"
    log_info "To view logs: kubectl logs -n ${NAMESPACE} <pod-name>"
    echo ""
    
    exit 1
}

trap cleanup_on_failure ERR

echo ""
echo "🚀 Deploying Money App to Kubernetes"
echo "======================================"
echo "Namespace: ${NAMESPACE}"
echo ""

# ============================================
# GIT PULL (--prd / --no-cache guarantees latest source)
# ============================================
if [ "${NO_CACHE}" = true ]; then
    log_step "Pulling latest code from git..."
    cd "${PROJECT_DIR}"
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    if git pull origin "${CURRENT_BRANCH}" 2>&1 | sed 's/^/  → /'; then
        log_success "Code updated (branch: ${CURRENT_BRANCH})"
    else
        log_warning "git pull failed — continuing with local code"
    fi
fi

# Generate image tag from git SHA for cache-busting
GIT_SHA=$(cd "${PROJECT_DIR}" && git rev-parse --short HEAD 2>/dev/null || echo "local")
IMAGE_TAG="${GIT_SHA}"
log_info "Image tag: ${IMAGE_TAG}"

# ============================================
# PRE-FLIGHT CHECKS
# ============================================
log_step "Running pre-flight checks..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found. Please install kubectl first."
    exit 1
fi
log_success "kubectl found"

# Check kubectl connectivity to cluster
if ! kubectl cluster-info &> /dev/null; then
    log_error "Cannot connect to Kubernetes cluster. Check your KUBECONFIG."
    exit 1
fi
log_success "Connected to Kubernetes cluster"

# Check if required manifest files exist
REQUIRED_FILES=("namespace.yaml" "couchdb.yaml" "backend.yaml" "frontend.yaml" "ingress.yaml")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "${K8S_DIR}/${file}" ]; then
        log_error "Required manifest file not found: ${K8S_DIR}/${file}"
        exit 1
    fi
done
log_success "All required manifest files found"

# Check if namespace already exists
if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    log_warning "Namespace '${NAMESPACE}' already exists. Will update existing resources."
else
    log_info "Namespace '${NAMESPACE}' will be created"
fi

log_success "Pre-flight checks passed"

# ============================================
# CLEANUP DANGLING IMAGES
# ============================================
log_step "Cleaning up dangling images..."

# Check if containerd/crictl is available (K3s)
if command -v k3s &> /dev/null; then
    # Prune unused images in K3s
    PRUNED=$(sudo k3s crictl rmi --prune 2>&1 | grep "Deleted" | wc -l || true)
    if [ "${PRUNED}" -gt 0 ]; then
        log_success "Removed ${PRUNED} dangling image(s) from K3s"
    else
        log_success "No dangling images in K3s"
    fi
fi

# Check if podman is available
if command -v podman &> /dev/null; then
    DANGLING_COUNT=$(podman images -f "dangling=true" -q | wc -l)
    if [ "${DANGLING_COUNT}" -gt 0 ]; then
        podman image prune -f &> /dev/null
        log_success "Removed ${DANGLING_COUNT} dangling Podman image(s)"
    else
        log_success "No dangling Podman images"
    fi
fi

# Check if docker is available
if command -v docker &> /dev/null; then
    DANGLING_COUNT=$(docker images -f "dangling=true" -q | wc -l)
    if [ "${DANGLING_COUNT}" -gt 0 ]; then
        docker image prune -f &> /dev/null
        log_success "Removed ${DANGLING_COUNT} dangling Docker image(s)"
    else
        log_success "No dangling Docker images"
    fi
fi

# ============================================
# BUILD/CHECK IMAGES
# ============================================
if [ "${SKIP_BUILD}" = false ]; then
    log_step "Checking application images..."

    # Check if images exist in K3s (grep returns 1 if no match, so we use || true)
    FRONTEND_EXISTS=$(sudo k3s crictl images 2>/dev/null | grep "money-frontend" | wc -l || true)
    BACKEND_EXISTS=$(sudo k3s crictl images 2>/dev/null | grep "money-backend" | wc -l || true)

    BUILD_FRONTEND=false
    BUILD_BACKEND=false

    # Force rebuild when --no-cache is specified
    if [ "${NO_CACHE}" = true ]; then
        log_info "--no-cache specified, forcing rebuild of all images"
        BUILD_FRONTEND=true
        BUILD_BACKEND=true
    fi

    # Check if images are missing
    if [ "${FRONTEND_EXISTS}" -eq 0 ] && [ "${BUILD_FRONTEND}" = false ]; then
        log_warning "Frontend image not found in K3s"
        BUILD_FRONTEND=true
    fi

    if [ "${BACKEND_EXISTS}" -eq 0 ] && [ "${BUILD_BACKEND}" = false ]; then
        log_warning "Backend image not found in K3s"
        BUILD_BACKEND=true
    fi

    # If any images need building (missing or --no-cache forced)
    if [ "${BUILD_FRONTEND}" = true ] || [ "${BUILD_BACKEND}" = true ]; then
        log_info "Building images..."
        echo ""
        
        # Check for build script
        if [ -f "${PROJECT_DIR}/scripts/build-k8s.sh" ]; then
            bash "${PROJECT_DIR}/scripts/build-k8s.sh" all || {
                log_error "Image build failed"
                exit 1
            }
        # Fallback: Try building with Podman if available
        elif command -v podman &> /dev/null; then
            log_info "Using Podman to build images..."
            
            # Determine cache flag
            CACHE_FLAG=""
            if [ "${NO_CACHE}" = true ]; then
                CACHE_FLAG="--no-cache"
                log_info "Building without cache (ensures latest code)"
            fi
            
            if [ "${SKIP_FRONTEND}" = false ] && ([ "${BUILD_FRONTEND}" = true ] || [ "${FRONTEND_EXISTS}" -eq 0 ]); then
                log_info "Building frontend (tag: ${IMAGE_TAG})..."
                podman build ${CACHE_FLAG} -t localhost/money-frontend:${IMAGE_TAG} -t localhost/money-frontend:latest "${PROJECT_DIR}" || {
                    log_error "Frontend build failed"
                    exit 1
                }
                # Remove ALL old frontend images from K3s before importing
                log_info "Removing old frontend images from K3s..."
                sudo k3s ctr images ls -q 2>/dev/null | grep "money-frontend" | xargs -r sudo k3s ctr images delete 2>/dev/null || true
                log_info "Loading frontend into K3s..."
                podman save localhost/money-frontend:latest | sudo k3s ctr images import - || {
                    log_error "Failed to load frontend into K3s"
                    exit 1
                }
                # Clean up Podman — remove all old frontend images except the one we just built
                podman images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | grep "money-frontend" | grep -v "${IMAGE_TAG}" | grep -v "<none>" | awk '{print $1}' | sort -u | xargs -r podman rmi -f 2>/dev/null || true
            elif [ "${SKIP_FRONTEND}" = true ]; then
                log_info "Skipping frontend build (--skip-frontend specified)"
            fi
            
            if [ "${SKIP_BACKEND}" = false ] && ([ "${BUILD_BACKEND}" = true ] || [ "${BACKEND_EXISTS}" -eq 0 ]); then
                log_info "Building backend (tag: ${IMAGE_TAG})..."
                podman build ${CACHE_FLAG} -t localhost/money-backend:${IMAGE_TAG} -t localhost/money-backend:latest "${PROJECT_DIR}/backend" || {
                    log_error "Backend build failed"
                    exit 1
                }
                # Remove ALL old backend images from K3s before importing
                log_info "Removing old backend images from K3s..."
                sudo k3s ctr images ls -q 2>/dev/null | grep "money-backend" | xargs -r sudo k3s ctr images delete 2>/dev/null || true
                log_info "Loading backend into K3s..."
                podman save localhost/money-backend:latest | sudo k3s ctr images import - || {
                    log_error "Failed to load backend into K3s"
                    exit 1
                }
                # Clean up Podman — remove all old backend images except the one we just built
                podman images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | grep "money-backend" | grep -v "${IMAGE_TAG}" | grep -v "<none>" | awk '{print $1}' | sort -u | xargs -r podman rmi -f 2>/dev/null || true
            elif [ "${SKIP_BACKEND}" = true ]; then
                log_info "Skipping backend build (--skip-backend specified)"
            fi

            # Final Podman cleanup: remove dangling/intermediate build layers
            DANGLING=$(podman images -f "dangling=true" -q | wc -l)
            if [ "${DANGLING}" -gt 0 ]; then
                podman image prune -f &> /dev/null
                log_success "Cleaned up ${DANGLING} dangling build layer(s)"
            fi
        else
            log_error "Build script not found and Podman not available"
            log_info "Please install Podman or create: ${PROJECT_DIR}/scripts/build-k8s.sh"
            exit 1
        fi

        # Build verification summary
        echo ""
        log_info "Build Summary:"
        echo "  Git SHA:   ${IMAGE_TAG}"
        echo "  Branch:    $(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
        if sudo k3s ctr images ls -q 2>/dev/null | grep -q "money-frontend"; then
            FE_SIZE=$(sudo k3s ctr images ls 2>/dev/null | grep "money-frontend" | head -1 | awk '{print $4}' || echo "?")
            echo "  Frontend:  loaded (${FE_SIZE})"
        fi
        if sudo k3s ctr images ls -q 2>/dev/null | grep -q "money-backend"; then
            BE_SIZE=$(sudo k3s ctr images ls 2>/dev/null | grep "money-backend" | head -1 | awk '{print $4}' || echo "?")
            echo "  Backend:   loaded (${BE_SIZE})"
        fi
        PODMAN_TOTAL=$(podman system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "?")
        echo "  Podman:    ${PODMAN_TOTAL} total storage"
        echo ""
    else
        log_success "Application images found in K3s"
        if [ "${FRONTEND_EXISTS}" -gt 0 ]; then
            log_info "Frontend: $(sudo k3s crictl images 2>/dev/null | grep money-frontend | head -1 | awk '{print $1":"$2}' || true)"
        fi
        if [ "${BACKEND_EXISTS}" -gt 0 ]; then
            log_info "Backend: $(sudo k3s crictl images 2>/dev/null | grep money-backend | head -1 | awk '{print $1":"$2}' || true)"
        fi
        
        # Ask separately for each image if running interactively
        if [ -t 0 ] && [ -f "${PROJECT_DIR}/scripts/build-k8s.sh" ]; then  # Check if running interactively
            echo ""
            read -p "$(echo -e ${BLUE}?${NC}) Rebuild frontend image? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                BUILD_FRONTEND=true
            fi
            
            read -p "$(echo -e ${BLUE}?${NC}) Rebuild backend image? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                BUILD_BACKEND=true
            fi
            
            # Build selected images
            if [ "${BUILD_FRONTEND}" = true ] && [ "${BUILD_BACKEND}" = true ]; then
                log_info "Rebuilding both images..."
                echo ""
                bash "${PROJECT_DIR}/scripts/build-k8s.sh" all || {
                    log_error "Image build failed"
                    exit 1
                }
                echo ""
            elif [ "${BUILD_FRONTEND}" = true ]; then
                log_info "Rebuilding frontend image..."
                echo ""
                bash "${PROJECT_DIR}/scripts/build-k8s.sh" frontend || {
                    log_error "Frontend build failed"
                    exit 1
                }
                echo ""
            elif [ "${BUILD_BACKEND}" = true ]; then
                log_info "Rebuilding backend image..."
                echo ""
                bash "${PROJECT_DIR}/scripts/build-k8s.sh" backend || {
                    log_error "Backend build failed"
                    exit 1
                }
                echo ""
            fi
        fi
    fi
else
    log_step "Skipping image build (--skip-build specified)"
fi

# ============================================
# LOAD LOGGING STACK IMAGES (OPTIONAL)
# ============================================
if [ "${NO_LOGGING}" = false ]; then
    log_step "Loading logging stack images (optional)..."

# Temporarily disable exit-on-error and pipefail for optional logging stack
set +e
set +o pipefail

# Images to load
LOGGING_IMAGES=(
    "grafana/loki:2.9.3"
    "grafana/grafana:10.2.0"
    "grafana/promtail:2.9.3"
    "curlimages/curl:latest"
)

SUCCESS_COUNT=0
TOTAL_IMAGES=${#LOGGING_IMAGES[@]}

# Pull images directly into K3s (native method for Linux)
for IMAGE in "${LOGGING_IMAGES[@]}"; do
    log_info "Processing ${IMAGE}..."
    
    # Check if image already exists in K3s
    if sudo k3s ctr images ls 2>/dev/null | grep -q "${IMAGE}" 2>/dev/null; then
        log_success "${IMAGE} already cached"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        continue
    fi
    
    # Pull directly into K3s using ctr (native containerd method)
    log_info "Pulling ${IMAGE} into K3s..."
    if sudo k3s ctr images pull "docker.io/${IMAGE}" 2>&1 | grep -q "unpacking" 2>/dev/null || sudo k3s ctr images ls 2>/dev/null | grep -q "${IMAGE}" 2>/dev/null; then
        log_success "${IMAGE} loaded"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        log_warning "Failed to pull ${IMAGE} - skipping"
    fi
done

# Report results
if [ ${SUCCESS_COUNT} -eq ${TOTAL_IMAGES} ]; then
    log_success "All logging stack images loaded successfully"
elif [ ${SUCCESS_COUNT} -gt 0 ]; then
    log_warning "Only ${SUCCESS_COUNT}/${TOTAL_IMAGES} logging images loaded"
    log_info "Logging stack may not work correctly"
else
    log_warning "No logging images loaded - logging stack will not be available"
    log_info "This is optional - deployment will continue normally"
    log_info "If you need logging, check Docker Hub connectivity or use a VPN/proxy"
fi

# Re-enable exit-on-error and pipefail
set -e
set -o pipefail
else
    log_step "Skipping logging stack images (--no-logging specified)"
fi

# ============================================
# DEPLOY NAMESPACE
# ============================================
log_step "Creating namespace..."
set +e  # Temporarily disable to capture output
NAMESPACE_OUTPUT=$(kubectl apply -f "${K8S_DIR}/namespace.yaml" 2>&1)
NAMESPACE_EXIT=$?
set -e

echo "  → Debug: kubectl exit code = ${NAMESPACE_EXIT}"

if [ ${NAMESPACE_EXIT} -eq 0 ]; then
    if [ -n "${NAMESPACE_OUTPUT}" ]; then
        echo "${NAMESPACE_OUTPUT}" | sed 's/^/  → /'
    fi
    log_success "Namespace created/updated"
else
    log_error "Failed to create namespace"
    echo "  → Error output:"
    echo "${NAMESPACE_OUTPUT}" | sed 's/^/     /'
    exit 1
fi

# ============================================
# CREATE TLS CERTIFICATE (after namespace exists)
# ============================================
if [ "${SKIP_TLS}" = false ]; then
    log_step "Creating TLS certificate..."
    
    # Check if secret already exists
    if kubectl get secret money-tls -n "${NAMESPACE}" &> /dev/null; then
        log_success "TLS certificate already exists"
    else
        log_info "Generating self-signed certificate..."
        # Generate certificate
        if openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /tmp/tls.key -out /tmp/tls.crt \
            -subj "/CN=localhost/O=Money App" &> /dev/null; then
            
            # Create secret if files were generated
            if [ -f /tmp/tls.key ] && [ -f /tmp/tls.crt ]; then
                if kubectl create secret tls money-tls \
                    --cert=/tmp/tls.crt --key=/tmp/tls.key \
                    -n "${NAMESPACE}" &> /dev/null; then
                    log_success "TLS certificate created"
                else
                    log_warning "Failed to create TLS secret in Kubernetes"
                fi
                
                # Cleanup
                rm -f /tmp/tls.key /tmp/tls.crt
            fi
        else
            log_warning "Failed to generate TLS certificate (openssl not available)"
            log_info "Use --skip-tls to skip certificate creation"
        fi
    fi
else
    log_step "Skipping TLS certificate creation (--skip-tls specified)"
fi

# ============================================
# DEPLOY COUCHDB
# ============================================
log_step "Deploying CouchDB..."
set +e
COUCHDB_OUTPUT=$(kubectl apply -f "${K8S_DIR}/couchdb.yaml" 2>&1)
COUCHDB_EXIT=$?
set -e

if [ ${COUCHDB_EXIT} -eq 0 ]; then
    echo "${COUCHDB_OUTPUT}" | sed 's/^/  → /'
    log_success "CouchDB manifests applied"
else
    log_error "Failed to apply CouchDB manifests"
    echo "${COUCHDB_OUTPUT}"
    exit 1
fi

log_info "Waiting for CouchDB StatefulSet to be created..."
for i in {1..30}; do
    if kubectl get statefulset couchdb -n "${NAMESPACE}" &> /dev/null; then
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "CouchDB StatefulSet was not created after 60 seconds"
        kubectl get all -n "${NAMESPACE}"
        exit 1
    fi
    sleep 2
done

log_info "Waiting for CouchDB pod to be created..."
for i in {1..30}; do
    POD_COUNT=$(kubectl get pod -l app=couchdb -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l)
    if [ "${POD_COUNT}" -gt 0 ]; then
        POD_NAME=$(kubectl get pod -l app=couchdb -n "${NAMESPACE}" -o jsonpath='{.items[0].metadata.name}')
        log_info "CouchDB pod created: ${POD_NAME}"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "CouchDB pod was not created after 60 seconds"
        kubectl describe statefulset couchdb -n "${NAMESPACE}"
        exit 1
    fi
    sleep 2
done

log_info "Waiting for CouchDB to be ready (timeout: 5 minutes)..."
echo "  → Status: Waiting for pod to enter Ready state..."
if ! kubectl wait --for=condition=ready pod -l app=couchdb -n "${NAMESPACE}" --timeout=300s 2>&1 | grep -v "error: no matching resources found" | sed 's/^/     /'; then
    log_error "CouchDB failed to become ready"
    echo ""
    log_info "Pod status:"
    kubectl get pods -n "${NAMESPACE}" -l app=couchdb
    echo ""
    log_info "Recent events:"
    kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' | tail -10
    echo ""
    log_info "Pod details:"
    kubectl describe pod -l app=couchdb -n "${NAMESPACE}" | tail -30
    exit 1
fi
log_success "CouchDB is ready"

# ============================================
# DEPLOY BACKEND
# ============================================
if [ "${SKIP_BACKEND}" = false ]; then
    log_step "Deploying Backend..."
    set +e
    BACKEND_OUTPUT=$(kubectl apply -f "${K8S_DIR}/backend.yaml" 2>&1)
    BACKEND_EXIT=$?
    set -e
    
    if [ ${BACKEND_EXIT} -eq 0 ]; then
        echo "${BACKEND_OUTPUT}" | sed 's/^/  → /'
        log_success "Backend manifests applied"
    else
        log_error "Failed to apply backend manifests"
        echo "${BACKEND_OUTPUT}"
        exit 1
    fi
else
    log_step "Skipping Backend deployment (--skip-backend specified)"
fi

log_info "Waiting for Backend Deployment to be created..."
for i in {1..30}; do
    if kubectl get deployment backend -n "${NAMESPACE}" &> /dev/null; then
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Backend Deployment was not created after 60 seconds"
        kubectl get all -n "${NAMESPACE}"
        exit 1
    fi
    sleep 2
done

log_info "Waiting for Backend pods to be created..."
for i in {1..30}; do
    POD_COUNT=$(kubectl get pod -l app=backend -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l)
    if [ "${POD_COUNT}" -gt 0 ]; then
        log_info "Backend pods created: ${POD_COUNT}"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Backend pods were not created after 60 seconds"
        kubectl describe deployment backend -n "${NAMESPACE}"
        exit 1
    fi
    sleep 2
done

log_info "Waiting for Backend to be ready (timeout: 5 minutes)..."
echo "  → Status: Waiting for pods to enter Ready state..."
if ! kubectl wait --for=condition=ready pod -l app=backend -n "${NAMESPACE}" --timeout=300s 2>&1 | grep -v "error: no matching resources found" | sed 's/^/     /'; then
    log_error "Backend failed to become ready"
    echo ""
    log_info "Pod status:"
    kubectl get pods -n "${NAMESPACE}" -l app=backend
    echo ""
    log_info "Recent events:"
    kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' | tail -10
    echo ""
    log_info "Pod logs (if available):"
    kubectl logs -n "${NAMESPACE}" -l app=backend --tail=20 2>/dev/null || log_warning "No logs available yet"
    exit 1
fi
log_success "Backend is ready"

# ============================================
# DEPLOY FRONTEND
# ============================================
if [ "${SKIP_FRONTEND}" = false ]; then
    log_step "Deploying Frontend..."
    set +e
    FRONTEND_OUTPUT=$(kubectl apply -f "${K8S_DIR}/frontend.yaml" 2>&1)
    FRONTEND_EXIT=$?
    set -e
    
    if [ ${FRONTEND_EXIT} -eq 0 ]; then
        echo "${FRONTEND_OUTPUT}" | sed 's/^/  → /'
        log_success "Frontend manifests applied"
    else
        log_error "Failed to apply frontend manifests"
        echo "${FRONTEND_OUTPUT}"
        exit 1
    fi
else
    log_step "Skipping Frontend deployment (--skip-frontend specified)"
fi

# ============================================
# FORCE ROLLOUT RESTART TO USE NEW IMAGES
# ============================================
log_step "Restarting deployments to use new images..."
if [ "${SKIP_BACKEND}" = false ]; then
    kubectl rollout restart deployment/backend -n "${NAMESPACE}" 2>&1 | sed 's/^/  → /'
fi
if [ "${SKIP_FRONTEND}" = false ]; then
    kubectl rollout restart deployment/frontend -n "${NAMESPACE}" 2>&1 | sed 's/^/  → /'
fi

# Restart logging stack to pick up ConfigMap changes
if [ "${NO_LOGGING}" = false ]; then
    log_info "Restarting Grafana to load new dashboards..."
    kubectl rollout restart deployment/grafana -n "${NAMESPACE}" 2>&1 | sed 's/^/  → /' || log_warning "Grafana deployment not found"
    
    log_info "Restarting Promtail to load new config..."
    kubectl delete pod -l app=promtail -n "${NAMESPACE}" 2>&1 | sed 's/^/  → /' || log_warning "Promtail pods not found"
fi
log_success "Deployments restarted"

log_info "Waiting for Frontend Deployment to be created..."
for i in {1..30}; do
    if kubectl get deployment frontend -n "${NAMESPACE}" &> /dev/null; then
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Frontend Deployment was not created after 60 seconds"
        kubectl get all -n "${NAMESPACE}"
        exit 1
    fi
    sleep 2
done

log_info "Waiting for Frontend pods to be created..."
for i in {1..30}; do
    POD_COUNT=$(kubectl get pod -l app=frontend -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l)
    if [ "${POD_COUNT}" -gt 0 ]; then
        log_info "Frontend pods created: ${POD_COUNT}"
        break
    fi
    if [ $i -eq 30 ]; then
        log_error "Frontend pods were not created after 60 seconds"
        kubectl describe deployment frontend -n "${NAMESPACE}"
        exit 1
    fi
    sleep 2
done

log_info "Waiting for Frontend to be ready (timeout: 5 minutes)..."
echo "  → Status: Waiting for pods to enter Ready state..."
if ! kubectl wait --for=condition=ready pod -l app=frontend -n "${NAMESPACE}" --timeout=300s 2>&1 | grep -v "error: no matching resources found" | sed 's/^/     /'; then
    log_error "Frontend failed to become ready"
    echo ""
    log_info "Pod status:"
    kubectl get pods -n "${NAMESPACE}" -l app=frontend
    echo ""
    log_info "Recent events:"
    kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' | tail -10
    echo ""
    log_info "Pod logs (if available):"
    kubectl logs -n "${NAMESPACE}" -l app=frontend --tail=20 2>/dev/null || log_warning "No logs available yet"
    exit 1
fi
log_success "Frontend is ready"

# ============================================
# DEPLOY INGRESS
# ============================================
if [ "${NO_INGRESS}" = false ]; then
    log_step "Deploying Ingress..."
    if [ -f "${K8S_DIR}/ingress.yaml" ]; then
        if kubectl apply -f "${K8S_DIR}/ingress.yaml" 2>&1 | sed 's/^/  → /'; then
            log_success "Ingress deployed"
        else
            log_warning "Failed to apply Ingress (this is optional)"
        fi
    else
        log_warning "Ingress file not found: ${K8S_DIR}/ingress.yaml"
    fi
else
    log_step "Skipping Ingress deployment (--no-ingress specified)"
fi

# ============================================
# DEPLOY BACKUP CRONJOBS
# ============================================
# Flags:
#   --no-backup         Skip ALL backup CronJobs
#   --no-local-backup   Skip hourly local backup CronJob
#   --no-nas-backup     Skip daily+NAS backup CronJob (for setups without NAS)
if [ "${NO_BACKUP}" = false ]; then

    # ── Hourly local backup ──────────────────────────
    if [ "${NO_LOCAL_BACKUP}" = false ]; then
        log_step "Deploying Hourly Backup CronJob (local)..."
        if [ -f "${K8S_DIR}/backup-cronjob-hourly.yaml" ]; then
            if kubectl apply -f "${K8S_DIR}/backup-cronjob-hourly.yaml" 2>&1 | sed 's/^/  → /'; then
                log_success "Hourly Backup CronJob deployed (every hour, local storage)"
            else
                log_warning "Failed to deploy hourly backup CronJob (optional)"
            fi
        else
            log_warning "Hourly backup CronJob file not found: backup-cronjob-hourly.yaml"
        fi
    else
        log_step "Skipping Hourly Backup CronJob (--no-local-backup)"
    fi

    # ── Daily backup with NAS ────────────────────────
    if [ "${NO_NAS_BACKUP}" = false ]; then
        log_step "Deploying Daily Backup CronJob (local + NAS)..."
        if [ -f "${K8S_DIR}/backup-cronjob-daily.yaml" ]; then
            if kubectl apply -f "${K8S_DIR}/backup-cronjob-daily.yaml" 2>&1 | sed 's/^/  → /'; then
                log_success "Daily Backup CronJob deployed (2:00 AM, local + NAS)"
            else
                log_warning "Failed to deploy daily backup CronJob (optional)"
            fi
        else
            log_warning "Daily backup CronJob file not found: backup-cronjob-daily.yaml"
        fi
    else
        log_step "Skipping Daily/NAS Backup CronJob (--no-nas-backup)"
    fi

else
    log_step "Skipping ALL Backup CronJobs (--no-backup)"
fi

# ============================================
# DEPLOY LOGGING STACK (Grafana Loki + Promtail)
# ============================================
if [ "${NO_LOGGING}" = false ]; then
    log_step "Deploying Grafana Loki (Log Aggregation)..."
    if [ -f "${K8S_DIR}/loki.yaml" ]; then
        if kubectl apply -f "${K8S_DIR}/loki.yaml" 2>&1 | sed 's/^/  → /'; then
            log_success "Loki deployed (7-day retention, 2GB storage)"
        else
            log_warning "Failed to deploy Loki (optional)"
        fi
    else
        log_warning "Loki file not found (optional)"
    fi

    log_step "Deploying Grafana Dashboards..."
    if [ -f "${K8S_DIR}/grafana-dashboards.yaml" ]; then
        if kubectl apply -f "${K8S_DIR}/grafana-dashboards.yaml" 2>&1 | sed 's/^/  → /'; then
            log_success "Grafana dashboards deployed (System Overview, Backend API, Frontend, Error Tracking)"
            log_info "Access Grafana: kubectl port-forward -n ${NAMESPACE} svc/grafana 3000:80"
            log_info "Documentation: docs/MONITORING-QUICKSTART.md"
        else
            log_warning "Failed to deploy Grafana dashboards (optional)"
        fi
    else
        log_warning "Grafana dashboards file not found (optional)"
    fi

    log_step "Deploying Frontend Activity Dashboard..."
    if [ -f "${K8S_DIR}/grafana-frontend-dashboard.yaml" ]; then
        if kubectl apply -f "${K8S_DIR}/grafana-frontend-dashboard.yaml" 2>&1 | sed 's/^/  → /'; then
            log_success "Frontend Activity dashboard deployed (User behavior, Auth events, Transactions)"
        else
            log_warning "Failed to deploy Frontend Activity dashboard (optional)"
        fi
    else
        log_warning "Frontend Activity dashboard file not found (optional)"
    fi

    log_step "Deploying Promtail (Log Collector)..."
    if [ -f "${K8S_DIR}/promtail.yaml" ]; then
        if kubectl apply -f "${K8S_DIR}/promtail.yaml" 2>&1 | sed 's/^/  → /'; then
            log_success "Promtail deployed (DaemonSet for log collection)"
        else
            log_warning "Failed to deploy Promtail (optional)"
        fi
    else
        log_warning "Promtail file not found (optional)"
    fi
else
    log_step "Skipping logging stack deployment (--no-logging specified)"
fi

# ============================================
# FORCE RESTART TO USE NEW IMAGES
# ============================================
log_step "Restarting deployments to use new images..."
if kubectl rollout restart deployment/backend -n "${NAMESPACE}" 2>&1 | sed 's/^/  → /'; then
    log_success "Backend deployment restarted"
else
    log_warning "Failed to restart backend deployment"
fi

if kubectl rollout restart deployment/frontend -n "${NAMESPACE}" 2>&1 | sed 's/^/  → /'; then
    log_success "Frontend deployment restarted"
else
    log_warning "Failed to restart frontend deployment"
fi

log_info "Waiting for rollout to complete..."
kubectl rollout status deployment/backend -n "${NAMESPACE}" --timeout=120s 2>&1 | sed 's/^/  → /' || log_warning "Backend rollout timeout (may still be starting)"
kubectl rollout status deployment/frontend -n "${NAMESPACE}" --timeout=120s 2>&1 | sed 's/^/  → /' || log_warning "Frontend rollout timeout (may still be starting)"

# ============================================
# VERIFY DEPLOYMENT
# ============================================
log_step "Verifying deployment..."

# Check all pods are running
TOTAL_PODS=$(kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l)
RUNNING_PODS=$(kubectl get pods -n "${NAMESPACE}" --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

if [ "${RUNNING_PODS}" -eq "${TOTAL_PODS}" ]; then
    log_success "All ${TOTAL_PODS} pods are running"
else
    log_warning "${RUNNING_PODS}/${TOTAL_PODS} pods are running"
fi

# Check PVC is bound
PVC_STATUS=$(kubectl get pvc -n "${NAMESPACE}" -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Unknown")
if [ "${PVC_STATUS}" = "Bound" ]; then
    log_success "Persistent volume is bound"
else
    log_warning "Persistent volume status: ${PVC_STATUS}"
fi

# ============================================
# DEPLOYMENT SUMMARY
# ============================================
echo ""
echo "======================================"
echo "🎉 Deployment Complete!"
echo "======================================"
echo ""

log_info "Deployment Summary:"
echo ""
kubectl get all -n "${NAMESPACE}" -o wide

echo ""
log_info "Persistent Storage:"
kubectl get pvc -n "${NAMESPACE}"

echo ""
log_info "Access Information:"
echo ""

# Get service details
FRONTEND_PORT=$(kubectl get service frontend -n "${NAMESPACE}" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")
BACKEND_PORT=$(kubectl get service backend -n "${NAMESPACE}" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "N/A")
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "<node-ip>")

echo "  Frontend: http://${NODE_IP}:${FRONTEND_PORT}"
echo "  Backend:  http://${NODE_IP}:${BACKEND_PORT}"
echo ""

log_info "Useful Commands:"
echo "  View all resources:    kubectl get all -n ${NAMESPACE}"
echo "  View logs (CouchDB):   kubectl logs -n ${NAMESPACE} -l app=couchdb"
echo "  View logs (Backend):   kubectl logs -n ${NAMESPACE} -l app=backend"
echo "  View logs (Frontend):  kubectl logs -n ${NAMESPACE} -l app=frontend"
echo "  Delete deployment:     kubectl delete namespace ${NAMESPACE}"
echo ""
if [ "${NO_BACKUP}" = false ]; then
    echo "  Backup Commands:"
    echo "  List backups:          ./scripts/list-backups.sh"
    if [ "${NO_NAS_BACKUP}" = false ]; then
        echo "  Manual daily backup:   kubectl create job -n ${NAMESPACE} --from=cronjob/couchdb-backup manual-backup-\$(date +%s)"
    fi
    if [ "${NO_LOCAL_BACKUP}" = false ]; then
        echo "  Manual hourly backup:  kubectl create job -n ${NAMESPACE} --from=cronjob/couchdb-backup-hourly manual-hourly-\$(date +%s)"
    fi
    echo "  Restore backup:        ./scripts/restore-backup.sh <backup-file.tar.gz>"
    echo ""
fi

log_success "Money App is now running on Kubernetes!"
echo ""

# ============================================
# PORT-FORWARD (OPTIONAL)
# ============================================
if [ "${PORT_FORWARD}" = true ]; then
    log_step "Starting port-forward on localhost:8080..."
    echo ""
    log_info "Access: http://localhost:8080"
    log_info "Press Ctrl+C to stop"
    echo ""
    
    # Port-forward with auto-reconnect
    RECONNECT_COUNT=0
    while true; do
        if [ $RECONNECT_COUNT -gt 0 ]; then
            log_warning "Reconnecting (attempt #${RECONNECT_COUNT})..."
            sleep 3
        fi
        
        kubectl port-forward -n "${NAMESPACE}" svc/frontend 8080:80 2>&1 | while read line; do
            if [[ $line == *"Forwarding"* ]]; then
                log_success "Port-forward active"
            fi
        done
        
        RECONNECT_COUNT=$((RECONNECT_COUNT + 1))
        
        # Check if K3s is still alive
        if ! kubectl get pods -n "${NAMESPACE}" &> /dev/null; then
            log_error "K3s cluster is down!"
            sleep 10
        fi
    done
fi

# Disable error trap on success
trap - ERR
exit 0
