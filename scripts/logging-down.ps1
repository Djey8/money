#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Tear down the logging stack (Loki, Grafana, Promtail) without affecting the app

.DESCRIPTION
    Removes the logging stack from the money-app namespace, freeing ~800MB+ RAM.
    The app (CouchDB, Backend, Frontend) continues running unaffected.
    
    Counterpart: logging-up.ps1 to bring the logging stack back up.

.EXAMPLE
    .\scripts\logging-down.ps1
    Remove logging stack from a running money-app deployment
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==> Stopping Logging Stack..." -ForegroundColor Cyan
Write-Host ""

# Check namespace exists
$nsExists = wsl -d Ubuntu bash -c "kubectl get namespace money-app 2>/dev/null && echo 'exists'"
if ($nsExists -notmatch 'exists') {
    Write-Host "[ERROR] Namespace money-app not found." -ForegroundColor Red
    exit 1
}

# Delete Promtail (DaemonSet + ServiceAccount + ClusterRole + ClusterRoleBinding + ConfigMap)
Write-Host "Removing Promtail..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl delete daemonset promtail -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete serviceaccount promtail -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete clusterrolebinding promtail 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete clusterrole promtail 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete configmap promtail-config -n money-app 2>/dev/null || true"
Write-Host "[OK] Promtail removed" -ForegroundColor Green

# Delete Grafana (Deployment + Service + ConfigMap + Secret + dashboards)
Write-Host "Removing Grafana..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl delete deployment grafana -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete service grafana -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete configmap grafana-config grafana-datasources grafana-dashboard-provider grafana-dashboards grafana-frontend-dashboard -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete secret grafana-secret -n money-app 2>/dev/null || true"
Write-Host "[OK] Grafana removed" -ForegroundColor Green

# Delete Loki (StatefulSet + Service + ConfigMap + PVC)
Write-Host "Removing Loki..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl delete statefulset loki -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete service loki -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete configmap loki-config -n money-app 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl delete pvc loki-data-loki-0 -n money-app 2>/dev/null || true"
Write-Host "[OK] Loki removed" -ForegroundColor Green
Write-Host ""

# Show remaining pods
Write-Host "==> Remaining Pods:" -ForegroundColor Cyan
wsl -d Ubuntu bash -c "kubectl get pods -n money-app"
Write-Host ""

Write-Host "================================================" -ForegroundColor Green
Write-Host "  Logging Stack Removed" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To re-enable: .\scripts\logging-up.ps1" -ForegroundColor White
Write-Host ""
