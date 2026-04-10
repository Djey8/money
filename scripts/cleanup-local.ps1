#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Clean up Money App deployment from K3s

.DESCRIPTION
    Removes all Money App resources from the K3s cluster and optionally cleans up Docker images
    
.PARAMETER CleanImages
    Also remove dangling and unused Docker images from Podman and K3s
    
.EXAMPLE
    .\cleanup-local.ps1
    Remove kubernetes resources only
    
.EXAMPLE
    .\cleanup-local.ps1 -CleanImages
    Remove kubernetes resources and clean up Docker images
#>

param(
    [switch]$CleanImages = $false
)

Write-Host ""
Write-Host "==> Cleaning up Money App deployment..." -ForegroundColor Yellow

# Stop port-forwarding jobs and processes
Write-Host "Stopping port-forwarding..." -ForegroundColor White
Get-Job | Where-Object { $_.Name -like '*grafana*' -or $_.Command -like '*port-forward*' } | Stop-Job -PassThru | Remove-Job -Force -ErrorAction SilentlyContinue

# Free ports 3000 and 8080
foreach ($port in @(3000, 8080)) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        $connections | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "[OK] Port-forwarding stopped" -ForegroundColor Green

# Delete all resources in the money-app namespace
wsl -d Ubuntu bash -c "kubectl delete namespace money-app --ignore-not-found=true"

Write-Host "[OK] Kubernetes resources cleaned up" -ForegroundColor Green

# Clean up Docker images if requested
if ($CleanImages) {
    Write-Host ""
    Write-Host "==> Cleaning up Docker images..." -ForegroundColor Yellow
    
    # Clean up dangling images in Podman
    Write-Host "Cleaning Podman dangling images..." -ForegroundColor White
    $danglingImages = podman images -f "dangling=true" -q
    if ($danglingImages) {
        podman rmi $danglingImages 2>$null
        Write-Host "[OK] Removed dangling Podman images" -ForegroundColor Green
    } else {
        Write-Host "[OK] No dangling Podman images found" -ForegroundColor Green
    }
    
    # Clean up unused images in K3s/containerd
    Write-Host "Cleaning K3s unused images..." -ForegroundColor White
    wsl -d Ubuntu bash -c "sudo k3s crictl rmi --prune 2>/dev/null || true"
    Write-Host "[OK] K3s image cleanup complete" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "==> Image cleanup statistics:" -ForegroundColor Cyan
    Write-Host "Podman images:" -ForegroundColor White
    podman images | Select-Object -First 10
    Write-Host ""
    Write-Host "K3s images (money-related):" -ForegroundColor White
    wsl -d Ubuntu bash -c "sudo k3s crictl images | grep -E 'money|IMAGE'" 2>$null
}

Write-Host ""
Write-Host "[OK] Cleanup complete" -ForegroundColor Green
Write-Host ""
Write-Host "To redeploy, run:" -ForegroundColor Cyan
Write-Host "  .\deploy-local.ps1" -ForegroundColor White
Write-Host ""
