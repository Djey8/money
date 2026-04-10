#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start the logging stack (Loki, Grafana, Promtail) on a running deployment

.DESCRIPTION
    Deploys the logging stack to the money-app namespace. Use this when running
    in production mode (no logging) and you need to debug an issue.
    
    Counterpart: logging-down.ps1 to tear down the logging stack.

.EXAMPLE
    .\scripts\logging-up.ps1
    Deploy logging stack to an already running money-app deployment
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$wslProjectDir = $projectDir -replace '\\', '/' -replace 'C:', '/mnt/c'

Write-Host "" 
Write-Host "==> Starting Logging Stack..." -ForegroundColor Cyan
Write-Host ""

# Check namespace exists
$nsExists = wsl -d Ubuntu bash -c "kubectl get namespace money-app 2>/dev/null && echo 'exists'"
if ($nsExists -notmatch 'exists') {
    Write-Host "[ERROR] Namespace money-app not found. Deploy the app first." -ForegroundColor Red
    exit 1
}

# Load logging images if not cached
$loggingImages = @(
    "grafana/loki:2.9.3",
    "grafana/grafana:10.2.0",
    "grafana/promtail:2.9.3"
)

Write-Host "Checking logging images in K3s..." -ForegroundColor White
foreach ($img in $loggingImages) {
    $imageExists = wsl -d Ubuntu bash -c "sudo k3s ctr images ls 2>/dev/null | grep -q '$img' && echo 'exists' || echo 'missing'"
    if ($imageExists -match "missing") {
        Write-Host "Pulling $img..." -ForegroundColor Yellow
        $job = Start-Job -ScriptBlock { param($image) podman pull $image 2>&1 } -ArgumentList "docker.io/$img"
        $completed = Wait-Job -Job $job -Timeout 60
        if ($completed) {
            Receive-Job -Job $job | Out-Null
            Remove-Job -Job $job -Force
            $tempDir = "$env:TEMP\k3s-logging"
            if (!(Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir | Out-Null }
            $imageName = $img -replace '[/:]', '-'
            $tarFile = "$tempDir\$imageName.tar"
            podman save "docker.io/$img" -o $tarFile 2>&1 | Out-Null
            $wslTarPath = $tarFile -replace '\\', '/' -replace 'C:', '/mnt/c'
            wsl -d Ubuntu bash -c "sudo k3s ctr images import '$wslTarPath'" 2>&1 | Out-Null
            Remove-Item -Force $tarFile -ErrorAction SilentlyContinue
            Write-Host "[OK] $img loaded" -ForegroundColor Green
        } else {
            Stop-Job -Job $job; Remove-Job -Job $job -Force
            Write-Host "[WARN] Timeout pulling $img" -ForegroundColor Yellow
        }
        Remove-Item -Recurse -Force "$env:TEMP\k3s-logging" -ErrorAction SilentlyContinue
    } else {
        Write-Host "[OK] $img cached" -ForegroundColor Green
    }
}
Write-Host ""

# Deploy Loki
Write-Host "Deploying Loki..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/loki.yaml"
Write-Host "[OK] Loki deployed" -ForegroundColor Green

# Deploy Grafana Dashboards
Write-Host "Deploying Grafana Dashboards..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/grafana-dashboards.yaml"
Write-Host "[OK] Grafana dashboards deployed" -ForegroundColor Green

# Deploy Frontend Dashboard
$frontendDashPath = "$wslProjectDir/k8s/grafana-frontend-dashboard.yaml"
$frontendDashExists = wsl -d Ubuntu bash -c "test -f $frontendDashPath && echo 'exists'"
if ($frontendDashExists -eq 'exists') {
    Write-Host "Deploying Frontend Activity Dashboard..." -ForegroundColor White
    wsl -d Ubuntu bash -c "kubectl apply -f $frontendDashPath"
    Write-Host "[OK] Frontend Activity dashboard deployed" -ForegroundColor Green
}

# Deploy Promtail
Write-Host "Deploying Promtail..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/promtail.yaml"
Write-Host "[OK] Promtail deployed" -ForegroundColor Green
Write-Host ""

# Wait for pods
Write-Host "Waiting for logging pods to be ready..." -ForegroundColor Yellow
wsl -d Ubuntu bash -c "kubectl wait --for=condition=ready pod -l app=grafana -n money-app --timeout=120s 2>/dev/null || true"
wsl -d Ubuntu bash -c "kubectl wait --for=condition=ready pod -l app=promtail -n money-app --timeout=120s 2>/dev/null || true"
Write-Host ""

# Show status
Write-Host "==> Logging Stack Status:" -ForegroundColor Cyan
wsl -d Ubuntu bash -c "kubectl get pods -n money-app -l 'app in (loki,grafana,promtail)'"
Write-Host ""

Write-Host "================================================" -ForegroundColor Green
Write-Host "  Logging Stack Active" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Grafana: kubectl port-forward -n money-app svc/grafana 3000:3000" -ForegroundColor White
Write-Host "  Tear down: .\scripts\logging-down.ps1" -ForegroundColor White
Write-Host ""
