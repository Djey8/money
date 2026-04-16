#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Local development deployment to WSL K3s cluster

.DESCRIPTION
    Builds images with Podman, loads them into K3s, deploys the application,
    and automatically sets up port-forwarding for testing from Windows.
    
    Default behavior (no parameters): Deploys and starts port-forward with browser.
    
.PARAMETER SkipBuild
    Skip building images entirely (use existing images)
    
.PARAMETER NoCache
    Force rebuild without Docker cache (ensures latest code changes)
    
.PARAMETER SkipFrontend
    Skip frontend build and deployment
    
.PARAMETER SkipBackend
    Skip backend build and deployment
    
.PARAMETER NoIngress
    Skip Ingress deployment
    
.PARAMETER NoBackup
    Skip ALL backup CronJob deployment (hourly + daily/NAS)

.PARAMETER NoLocalBackup
    Skip hourly local backup CronJob only

.PARAMETER NoNasBackup
    Skip daily+NAS backup CronJob only (for setups without NAS)

.PARAMETER NoLogging
    Skip logging stack (Loki, Grafana w/7 pre-built dashboards, Promtail)

.PARAMETER Prd
    Production preset: -NoCache -NoLogging (fresh build, no logging stack)

.PARAMETER Dev
    Development preset: -NoCache (fresh build, logging enabled)

.PARAMETER SkipTLS
    Skip TLS certificate creation (use if openssl unavailable or certificate exists)
    
.PARAMETER NoPortForward
    Skip automatic port-forwarding
    
.PARAMETER NoBrowser
    Skip opening browser (only if port-forward is active)
    
.PARAMETER CleanImages
    Clean up old images before building

.EXAMPLE
    .\deploy-local.ps1
    Full deployment with cache, port-forward, and browser
    
.EXAMPLE
    .\deploy-local.ps1 -NoCache
    Full deployment with fresh build (no cache)
    
.EXAMPLE
    .\deploy-local.ps1 -SkipBuild
    Quick redeploy without rebuilding images
    
.EXAMPLE
    .\deploy-local.ps1 -NoCache -SkipFrontend
    Rebuild only backend (no cache), skip frontend
    
.EXAMPLE
    .\deploy-local.ps1 -SkipBuild -NoBrowser
    Redeploy with port-forward, no browser
    
.EXAMPLE
    .\deploy-local.ps1 -NoIngress -NoBackup -SkipTLS
    Minimal deployment without Ingress, backup, and TLS certificate

.EXAMPLE
    .\deploy-local.ps1 -NoNasBackup
    Deploy without NAS backup (no NAS mount required)

.EXAMPLE
    .\deploy-local.ps1 -NoLocalBackup
    Deploy without hourly local backup, keep daily+NAS
    
.EXAMPLE
    .\deploy-local.ps1 -NoLogging
    Deploy without logging stack (use when Docker Hub is blocked)
    
.EXAMPLE
    .\deploy-local.ps1 -SkipTLS
    Deploy without TLS certificate (HTTP-only or certificate already exists)

.EXAMPLE
    .\deploy-local.ps1 -Prd
    Production: fresh build, no logging stack

.EXAMPLE
    .\deploy-local.ps1 -Dev
    Development: fresh build, with logging
#>

param(
    [switch]$SkipBuild = $false,
    [switch]$NoCache = $false,
    [switch]$SkipFrontend = $false,
    [switch]$SkipBackend = $false,
    [switch]$SkipTLS = $false,
    [switch]$NoPortForward = $false,
    [switch]$NoBrowser = $false,
    [switch]$CleanImages = $false,
    [switch]$NoIngress = $false,
    [switch]$NoBackup = $false,
    [switch]$NoLocalBackup = $false,
    [switch]$NoNasBackup = $false,
    [switch]$NoLogging = $false,
    [switch]$Prd = $false,
    [switch]$Dev = $false
)

$ErrorActionPreference = "Stop"

# Apply presets
if ($Prd) {
    $NoCache = $true
    $NoLogging = $true
    Write-Host "[INFO] Production preset: -NoCache -NoLogging" -ForegroundColor Cyan
}
if ($Dev) {
    $NoCache = $true
    Write-Host "[INFO] Development preset: -NoCache (logging enabled)" -ForegroundColor Cyan
}

# Get script directory and project root for reliable path resolution
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$wslProjectDir = $projectDir -replace '\\', '/' -replace 'C:', '/mnt/c'

# Cleanup function for failures
function Cleanup-OnFailure {
    Write-Host ""
    Write-Host "[ERROR] Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "[INFO] Namespace 'money-app' was NOT deleted to preserve data" -ForegroundColor Cyan
    Write-Host "[INFO] To clean up manually, run: wsl -d Ubuntu kubectl delete namespace money-app" -ForegroundColor Cyan
    Write-Host "[INFO] To view logs: wsl -d Ubuntu kubectl logs -n money-app <pod-name>" -ForegroundColor Cyan
    Write-Host ""
    
    exit 1
}

# Set up error trap
trap {
    Cleanup-OnFailure
}

Write-Host ""
Write-Host "==============================================  " -ForegroundColor Cyan
Write-Host "  Money App - Local K3s Deployment            " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "==> Checking prerequisites..." -ForegroundColor Yellow
if (!(Get-Command podman -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Podman not found" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Podman found" -ForegroundColor Green

if (!(Get-Command wsl -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] WSL not found" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] WSL found" -ForegroundColor Green

# Check WSL connectivity
Write-Host "Checking WSL connectivity..." -ForegroundColor White
$wslTest = wsl -d Ubuntu echo "OK" 2>&1
if ($LASTEXITCODE -ne 0 -or $wslTest -notmatch "OK") {
    Write-Host "[ERROR] WSL is not responding properly" -ForegroundColor Red
    Write-Host "[INFO] Try: wsl --shutdown" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] WSL responsive" -ForegroundColor Green

# Test kubectl via WSL
try {
    wsl -d Ubuntu bash -c "kubectl version --client --output=json" 2>&1 | Out-Null
    Write-Host "[OK] kubectl accessible in WSL" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] kubectl not accessible in WSL" -ForegroundColor Red
    exit 1
}

# Check K3s status
Write-Host "Checking K3s cluster..." -ForegroundColor White
$k3sStatus = wsl -d Ubuntu bash -c "systemctl is-active k3s 2>/dev/null" 2>&1
if ($k3sStatus -ne "active") {
    Write-Host "[WARN] K3s is not running (status: $k3sStatus)" -ForegroundColor Yellow
    Write-Host "[INFO] Attempting to start K3s..." -ForegroundColor Cyan
    wsl -d Ubuntu bash -c "sudo systemctl start k3s"
    Start-Sleep -Seconds 5
    
    $k3sStatus = wsl -d Ubuntu bash -c "systemctl is-active k3s 2>/dev/null" 2>&1
    if ($k3sStatus -ne "active") {
        Write-Host "[ERROR] Failed to start K3s" -ForegroundColor Red
        Write-Host "[INFO] Try manually: wsl -d Ubuntu sudo systemctl start k3s" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host "[OK] K3s is running" -ForegroundColor Green

# Wait for K3s API to be ready
Write-Host "Waiting for K3s API..." -ForegroundColor White
$apiReady = $false
for ($i = 0; $i -lt 30; $i++) {
    $nodes = wsl -d Ubuntu bash -c "kubectl get nodes --no-headers 2>/dev/null" 2>&1
    if ($LASTEXITCODE -eq 0 -and $nodes -match "Ready") {
        $apiReady = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $apiReady) {
    Write-Host "[ERROR] K3s API not ready" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] K3s API ready" -ForegroundColor Green

# Git pull and SHA tagging (when NoCache is set, ensure we build from latest code)
$imageTag = "latest"
if ($NoCache) {
    Write-Host "==> Pulling latest code..." -ForegroundColor Yellow
    try {
        $branch = git -C $projectDir rev-parse --abbrev-ref HEAD 2>$null
        git -C $projectDir pull origin $branch 2>&1 | ForEach-Object { Write-Host "  $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Git pull failed - building from current working tree" -ForegroundColor Yellow
        } else {
            Write-Host "[OK] Pulled latest from $branch" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARN] Git pull failed - building from current working tree" -ForegroundColor Yellow
    }
}
$gitSha = git -C $projectDir rev-parse --short HEAD 2>$null
if ($gitSha) {
    $imageTag = $gitSha
    Write-Host "[INFO] Image tag: $imageTag" -ForegroundColor Cyan
} else {
    Write-Host "[WARN] Could not determine git SHA, using 'latest'" -ForegroundColor Yellow
}

Write-Host ""

# Always clean up dangling images to prevent system clutter
Write-Host "==> Cleaning up dangling images..." -ForegroundColor Yellow
$danglingCount = (podman images -f "dangling=true" -q).Count
if ($danglingCount -gt 0) {
    Write-Host "Removing $danglingCount dangling image(s)..." -ForegroundColor White
    podman image prune -f 2>$null | Out-Null
    Write-Host "[OK] Removed dangling images" -ForegroundColor Green
} else {
    Write-Host "[OK] No dangling images" -ForegroundColor Green
}
Write-Host ""

# Build images
if (-not $SkipBuild) {
    Write-Host "==> Building images..." -ForegroundColor Yellow
    
    # Determine cache flag
    $cacheFlag = ""
    if ($NoCache) {
        $cacheFlag = "--no-cache"
        Write-Host "[INFO] Building without cache (ensures latest code)" -ForegroundColor Cyan
    }
    
    if (-not $SkipFrontend) {
        Write-Host "Building Frontend (tag: $imageTag)..." -ForegroundColor White
        $buildCmd = "podman build $cacheFlag --pull=missing -t localhost/money-frontend:$imageTag -t localhost/money-frontend:latest $projectDir"
        Invoke-Expression $buildCmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Frontend build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Frontend built" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Skipping frontend build" -ForegroundColor Cyan
    }
    
    if (-not $SkipBackend) {
        Write-Host "Building Backend (tag: $imageTag)..." -ForegroundColor White
        $buildCmd = "podman build $cacheFlag --pull=missing -t localhost/money-backend:$imageTag -t localhost/money-backend:latest $projectDir/backend"
        Invoke-Expression $buildCmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Backend build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Backend built" -ForegroundColor Green
    } else {
        Write-Host "[INFO] Skipping backend build" -ForegroundColor Cyan
    }
    Write-Host ""
} else {
    Write-Host "[INFO] Skipping image build" -ForegroundColor Cyan
    Write-Host ""
}

# Export images and load into K3s
if (-not $SkipBuild) {
    Write-Host "==> Loading images into K3s..." -ForegroundColor Yellow

    # Create temp directory for image exports
    $tempDir = "$env:TEMP\k3s-images"
    if (!(Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }

    if (-not $SkipFrontend) {
        Write-Host "Exporting frontend image..." -ForegroundColor White
        podman save localhost/money-frontend:latest -o "$tempDir\frontend.tar"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to export frontend image" -ForegroundColor Red
            exit 1
        }
    }

    if (-not $SkipBackend) {
        Write-Host "Exporting backend image..." -ForegroundColor White
        podman save localhost/money-backend:latest -o "$tempDir\backend.tar"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to export backend image" -ForegroundColor Red
            exit 1
        }
    }

    # Convert Windows path to WSL path for temp directory
    $wslTempDir = "/mnt/c/Users/$env:USERNAME/AppData/Local/Temp/k3s-images"

    if (-not $SkipFrontend) {
        Write-Host "Removing ALL old frontend images from K3s..." -ForegroundColor White
        wsl -d Ubuntu bash -c "sudo k3s ctr images ls -q 2>/dev/null | grep money-frontend | xargs -r sudo k3s ctr images delete 2>/dev/null || true"
        Write-Host "Importing frontend into K3s..." -ForegroundColor White
        wsl -d Ubuntu bash -c "sudo k3s ctr images import $wslTempDir/frontend.tar"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to import frontend image" -ForegroundColor Red
            exit 1
        }
        # Clean up old Podman frontend images (keep only current SHA)
        $oldFe = podman images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | Select-String 'money-frontend' | Select-String -NotMatch $imageTag | Select-String -NotMatch '<none>' | ForEach-Object { ($_ -split ' ')[0] } | Sort-Object -Unique
        if ($oldFe) { $oldFe | ForEach-Object { podman rmi -f $_ 2>$null } }
    }

    if (-not $SkipBackend) {
        Write-Host "Removing ALL old backend images from K3s..." -ForegroundColor White
        wsl -d Ubuntu bash -c "sudo k3s ctr images ls -q 2>/dev/null | grep money-backend | xargs -r sudo k3s ctr images delete 2>/dev/null || true"
        Write-Host "Importing backend into K3s..." -ForegroundColor White
        wsl -d Ubuntu bash -c "sudo k3s ctr images import $wslTempDir/backend.tar"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to import backend image" -ForegroundColor Red
            exit 1
        }
        # Clean up old Podman backend images (keep only current SHA)
        $oldBe = podman images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | Select-String 'money-backend' | Select-String -NotMatch $imageTag | Select-String -NotMatch '<none>' | ForEach-Object { ($_ -split ' ')[0] } | Sort-Object -Unique
        if ($oldBe) { $oldBe | ForEach-Object { podman rmi -f $_ 2>$null } }
    }

    # Cleanup temp files
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

    # Final Podman cleanup: remove dangling/intermediate build layers
    $dangling = (podman images -f "dangling=true" -q).Count
    if ($dangling -gt 0) {
        podman image prune -f 2>$null | Out-Null
        Write-Host "[OK] Cleaned up $dangling dangling build layer(s)" -ForegroundColor Green
    }

    # Build verification summary
    Write-Host ""
    Write-Host "[INFO] Build Summary:" -ForegroundColor Cyan
    Write-Host "  Git SHA:   $imageTag"
    Write-Host "  Branch:    $(git -C $projectDir rev-parse --abbrev-ref HEAD 2>$null)"
    $feInK3s = wsl -d Ubuntu bash -c "sudo k3s ctr images ls 2>/dev/null | grep money-frontend | head -1" 2>$null
    if ($feInK3s) { Write-Host "  Frontend:  loaded" -ForegroundColor Green }
    $beInK3s = wsl -d Ubuntu bash -c "sudo k3s ctr images ls 2>/dev/null | grep money-backend | head -1" 2>$null
    if ($beInK3s) { Write-Host "  Backend:   loaded" -ForegroundColor Green }
    $podmanDf = podman system df --format '{{.Size}}' 2>$null | Select-Object -First 1
    if ($podmanDf) { Write-Host "  Podman:    $podmanDf total storage" }

    Write-Host "[OK] Images loaded into K3s" -ForegroundColor Green
    Write-Host ""
}

# Pull and load logging stack images (Loki, Grafana, Promtail)
# Pull with Podman in Windows, then import into K3s to avoid WSL network issues
if (-not $NoLogging) {
    Write-Host "==> Loading logging stack images (optional)..." -ForegroundColor Yellow

try {
    # Temporarily disable error handling for optional logging stack
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    
    $loggingImages = @(
        "grafana/loki:2.9.3",
        "grafana/grafana:10.2.0",
        "grafana/promtail:2.9.3",
        "curlimages/curl:latest"
    )

    # Create temp directory for image exports
    $tempDir = "$env:TEMP\k3s-images"
    if (!(Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }

    $successCount = 0
    foreach ($img in $loggingImages) {
        Write-Host "Processing $img..." -ForegroundColor White
        
        # Check if image already exists in K3s
        $imageExists = wsl -d Ubuntu bash -c "sudo k3s ctr images ls | grep -q '$img' && echo 'exists' || echo 'missing'"
        
        if ($imageExists -match "exists") {
            Write-Host "[OK] $img already cached in K3s" -ForegroundColor Green
            $successCount++
            continue
        }
        
        # Pull with Podman (with timeout) 
        Write-Host "Pulling $img with Podman (30s timeout)..." -ForegroundColor White
        
        # Start podman pull as a job with timeout
        $job = Start-Job -ScriptBlock { param($image) podman pull $image 2>&1 } -ArgumentList "docker.io/$img"
        $completed = Wait-Job -Job $job -Timeout 30
        
        if ($completed) {
            $pullResult = Receive-Job -Job $job
            Remove-Job -Job $job -Force
            
            if ($pullResult -match "error|Error|ERROR") {
                Write-Host "[WARN] Failed to pull $img - skipping (network issue)" -ForegroundColor Yellow
                continue
            }
        } else {
            Write-Host "[WARN] Timeout pulling $img - skipping (slow/blocked network)" -ForegroundColor Yellow
            Stop-Job -Job $job
            Remove-Job -Job $job -Force
            continue
        }
        
        # Export image
        $imageName = $img -replace '[/:]', '-'
        $tarFile = "$tempDir\$imageName.tar"
        Write-Host "Exporting $img..." -ForegroundColor White
        podman save "docker.io/$img" -o $tarFile 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Failed to export $img - skipping" -ForegroundColor Yellow
            continue
        }
        
        # Import into K3s
        $wslTarPath = $tarFile -replace '\\', '/' -replace 'C:', '/mnt/c'
        Write-Host "Importing $img into K3s..." -ForegroundColor White
        wsl -d Ubuntu bash -c "sudo k3s ctr images import '$wslTarPath'" 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] $img loaded" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[WARN] Failed to import $img - skipping" -ForegroundColor Yellow
        }
        
        # Cleanup tar file
        Remove-Item -Force $tarFile -ErrorAction SilentlyContinue
    }

    # Cleanup temp directory
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

    if ($successCount -eq $loggingImages.Count) {
        Write-Host "[OK] All logging stack images loaded successfully" -ForegroundColor Green
    } elseif ($successCount -gt 0) {
        Write-Host "[WARN] Only $successCount/$($loggingImages.Count) logging images loaded" -ForegroundColor Yellow
        Write-Host "[INFO] Logging stack may not work correctly" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] No logging images loaded - logging stack will not be available" -ForegroundColor Yellow
        Write-Host "[INFO] This is optional - deployment will continue normally" -ForegroundColor Cyan
        Write-Host "[INFO] If you need logging, check Docker Hub connectivity or use a VPN/proxy" -ForegroundColor Cyan
    }
    
    # Restore error handling
    $ErrorActionPreference = $previousErrorAction
} catch {
    Write-Host "[WARN] Logging stack image loading failed - continuing deployment" -ForegroundColor Yellow
    $ErrorActionPreference = $previousErrorAction
}
} else {
    Write-Host "==> Skipping logging stack images (--NoLogging specified)" -ForegroundColor Cyan
}
Write-Host ""

# Deploy to K3s
Write-Host "==> Deploying to K3s..." -ForegroundColor Yellow

Write-Host "Creating namespace..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/namespace.yaml"

# Create self-signed certificate for local development (after namespace exists)
if (-not $SkipTLS) {
    Write-Host "Creating TLS certificate..." -ForegroundColor White
    
    # Check if secret already exists
    $secretExists = wsl -d Ubuntu bash -c "kubectl get secret money-tls -n money-app 2>/dev/null"
    if (-not $secretExists) {
        # Generate certificate
        $certCreated = wsl -d Ubuntu bash -c "openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /tmp/tls.key -out /tmp/tls.crt -subj '/CN=localhost/O=Money App' 2>/dev/null && echo 'success'"
        
        if ($certCreated -match "success") {
            # Create secret
            $secretCreated = wsl -d Ubuntu bash -c "kubectl create secret tls money-tls --cert=/tmp/tls.crt --key=/tmp/tls.key -n money-app 2>&1"
            
            # Cleanup temp files
            wsl -d Ubuntu bash -c "rm -f /tmp/tls.key /tmp/tls.crt" 2>&1 | Out-Null
            
            if ($secretCreated -notmatch "error") {
                Write-Host "[OK] TLS certificate created" -ForegroundColor Green
            } else {
                Write-Host "[WARN] Failed to create TLS secret in Kubernetes" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARN] Failed to generate TLS certificate (openssl may not be available)" -ForegroundColor Yellow
            Write-Host "[INFO] Use -SkipTLS to skip certificate creation" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[OK] TLS certificate already exists" -ForegroundColor Green
    }
}

Write-Host "Deploying CouchDB..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/couchdb.yaml"

Write-Host "Waiting for CouchDB to be ready..." -ForegroundColor White
wsl -d Ubuntu bash -c "kubectl wait --for=condition=ready pod -l app=couchdb -n money-app --timeout=120s"

if (-not $SkipBackend) {
    Write-Host "Deploying Backend..." -ForegroundColor White
    wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/backend.yaml"
} else {
    Write-Host "[INFO] Skipping backend deployment" -ForegroundColor Cyan
}

if (-not $SkipFrontend) {
    Write-Host "Deploying Frontend..." -ForegroundColor White
    wsl -d Ubuntu bash -c "kubectl apply -f $wslProjectDir/k8s/frontend.yaml"
} else {
    Write-Host "[INFO] Skipping frontend deployment" -ForegroundColor Cyan
}

Write-Host "[OK] Deployed" -ForegroundColor Green
Write-Host ""

# Deploy Ingress (optional)
if (-not $NoIngress) {
    Write-Host "Deploying Ingress..." -ForegroundColor White
    $ingressPath = "$wslProjectDir/k8s/ingress.yaml"
    $ingressExists = wsl -d Ubuntu bash -c "test -f $ingressPath && echo 'exists'"
    if ($ingressExists -eq 'exists') {
        wsl -d Ubuntu bash -c "kubectl apply -f $ingressPath"
        Write-Host "[OK] Ingress deployed" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Ingress file not found" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Deploy Backup CronJobs (optional)
# Flags: -NoBackup (skip all), -NoLocalBackup (skip hourly), -NoNasBackup (skip daily+NAS)
if (-not $NoBackup) {

    # Hourly local backup
    if (-not $NoLocalBackup) {
        Write-Host "Deploying Hourly Backup CronJob (local)..." -ForegroundColor White
        $hourlyPath = "$wslProjectDir/k8s/backup-cronjob-hourly.yaml"
        $hourlyExists = wsl -d Ubuntu bash -c "test -f $hourlyPath && echo 'exists'"
        if ($hourlyExists -eq 'exists') {
            wsl -d Ubuntu bash -c "kubectl apply -f $hourlyPath"
            Write-Host "[OK] Hourly Backup CronJob deployed (every hour, local storage)" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Hourly backup file not found: backup-cronjob-hourly.yaml" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] Skipping Hourly Backup CronJob (-NoLocalBackup)" -ForegroundColor Cyan
    }

    # Daily backup with NAS
    if (-not $NoNasBackup) {
        Write-Host "Deploying Daily Backup CronJob (local + NAS)..." -ForegroundColor White
        $dailyPath = "$wslProjectDir/k8s/backup-cronjob-daily.yaml"
        $dailyExists = wsl -d Ubuntu bash -c "test -f $dailyPath && echo 'exists'"
        if ($dailyExists -eq 'exists') {
            wsl -d Ubuntu bash -c "kubectl apply -f $dailyPath"
            Write-Host "[OK] Daily Backup CronJob deployed (2:00 AM, local + NAS)" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Daily backup file not found: backup-cronjob-daily.yaml" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[INFO] Skipping Daily/NAS Backup CronJob (-NoNasBackup)" -ForegroundColor Cyan
    }

    Write-Host ""
} else {
    Write-Host "[INFO] Skipping ALL Backup CronJobs (-NoBackup)" -ForegroundColor Cyan
    Write-Host ""
}

# Deploy Grafana Loki (Logging Stack)
if (-not $NoLogging) {
    Write-Host "Deploying Grafana Loki (Log Aggregation)..." -ForegroundColor White
    $lokiPath = "$wslProjectDir/k8s/loki.yaml"
    $lokiExists = wsl -d Ubuntu bash -c "test -f $lokiPath && echo 'exists'"
    if ($lokiExists -eq 'exists') {
        wsl -d Ubuntu bash -c "kubectl apply -f $lokiPath"
        Write-Host "[OK] Loki deployed (7-day retention, 2GB storage)" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Loki file not found" -ForegroundColor Yellow
    }
    Write-Host ""

    # Deploy Grafana Dashboards
    Write-Host "Deploying Grafana Dashboards..." -ForegroundColor White
    $dashboardsPath = "$wslProjectDir/k8s/grafana-dashboards.yaml"
    
    $dashboardsExist = wsl -d Ubuntu bash -c "test -f $dashboardsPath && echo 'exists'"
    if ($dashboardsExist -eq 'exists') {
        wsl -d Ubuntu bash -c "kubectl apply -f $dashboardsPath"
        Write-Host "[OK] Grafana dashboards deployed (System Overview, Backend API, Frontend, Error Tracking)" -ForegroundColor Green
        Write-Host "[INFO] Access Grafana: kubectl port-forward -n money-app svc/grafana 3000:80" -ForegroundColor Cyan
        Write-Host "[INFO] Documentation: docs/MONITORING-QUICKSTART.md" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] Grafana dashboards file not found" -ForegroundColor Yellow
    }
    Write-Host ""

    # Deploy Frontend Activity Dashboard
    Write-Host "Deploying Frontend Activity Dashboard..." -ForegroundColor White
    $frontendDashboardPath = "$wslProjectDir/k8s/grafana-frontend-dashboard.yaml"
    
    $frontendDashboardExist = wsl -d Ubuntu bash -c "test -f $frontendDashboardPath && echo 'exists'"
    if ($frontendDashboardExist -eq 'exists') {
        wsl -d Ubuntu bash -c "kubectl apply -f $frontendDashboardPath"
        Write-Host "[OK] Frontend Activity dashboard deployed (User behavior, Auth events, Transactions)" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Frontend Activity dashboard file not found" -ForegroundColor Yellow
    }
    Write-Host ""

    # Deploy Promtail (Log Collector)
    Write-Host "Deploying Promtail (Log Collector)..." -ForegroundColor White
    $promtailPath = "$wslProjectDir/k8s/promtail.yaml"
    $promtailExists = wsl -d Ubuntu bash -c "test -f $promtailPath && echo 'exists'"
    if ($promtailExists -eq 'exists') {
        wsl -d Ubuntu bash -c "kubectl apply -f $promtailPath"
        Write-Host "[OK] Promtail deployed (DaemonSet for log collection)" -ForegroundColor Green
        Write-Host "[INFO] Access Grafana UI: kubectl port-forward svc/grafana -n money-app 3000:3000" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] Promtail file not found" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "[INFO] Skipping logging stack deployment (--NoLogging specified)" -ForegroundColor Cyan
    Write-Host ""
}

# Force rollout restart to use newly imported images (required for :latest tag)
Write-Host "==> Restarting deployments to use new images..." -ForegroundColor Yellow
if (-not $SkipBackend) {
    wsl -d Ubuntu bash -c "kubectl rollout restart deployment/backend -n money-app"
}
if (-not $SkipFrontend) {
    wsl -d Ubuntu bash -c "kubectl rollout restart deployment/frontend -n money-app"
}

# Restart logging stack to pick up ConfigMap changes
if (-not $NoLogging) {
    Write-Host "==> Restarting Grafana to load new dashboards..." -ForegroundColor Yellow
    wsl -d Ubuntu bash -c "kubectl rollout restart deployment/grafana -n money-app 2>/dev/null || echo 'Grafana deployment not found'"
    
    Write-Host "==> Restarting Promtail to load new config..." -ForegroundColor Yellow
    wsl -d Ubuntu bash -c "kubectl delete pod -l app=promtail -n money-app 2>/dev/null || echo 'Promtail pods not found'"
}
Write-Host ""

# Wait for pods to be ready
Write-Host "==> Waiting for pods to be ready..." -ForegroundColor Yellow
if (-not $SkipBackend) {
    wsl -d Ubuntu bash -c "kubectl wait --for=condition=ready pod -l app=backend -n money-app --timeout=120s"
}
if (-not $SkipFrontend) {
    wsl -d Ubuntu bash -c "kubectl wait --for=condition=ready pod -l app=frontend -n money-app --timeout=120s"
}
Write-Host ""

# ============================================
# VERIFY DEPLOYMENT
# ============================================
Write-Host "==> Verifying deployment..." -ForegroundColor Yellow

# Check all pods are running
$allPods = wsl -d Ubuntu bash -c "kubectl get pods -n money-app --no-headers 2>/dev/null | wc -l"
$runningPods = wsl -d Ubuntu bash -c "kubectl get pods -n money-app --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l"

if ($runningPods -eq $allPods) {
    Write-Host "[OK] All $runningPods pods are running" -ForegroundColor Green
} else {
    Write-Host "[WARN] $runningPods/$allPods pods are running" -ForegroundColor Yellow
}

# Check PVC is bound
$pvcStatus = wsl -d Ubuntu bash -c "kubectl get pvc -n money-app -o jsonpath='{.items[0].status.phase}' 2>/dev/null"
if ($pvcStatus -eq "Bound") {
    Write-Host "[OK] Persistent volume is bound" -ForegroundColor Green
} else {
    Write-Host "[WARN] Persistent volume status: $pvcStatus" -ForegroundColor Yellow
}
Write-Host ""

# Show deployment status
Write-Host "==> Deployment Status:" -ForegroundColor Cyan
Write-Host ""
wsl -d Ubuntu bash -c "kubectl get pods -n money-app"
Write-Host ""
wsl -d Ubuntu bash -c "kubectl get services -n money-app"
Write-Host ""

# Show persistent storage
Write-Host "==> Persistent Storage:" -ForegroundColor Cyan
wsl -d Ubuntu bash -c "kubectl get pvc -n money-app"
Write-Host ""

# Get NodePort
$nodePort = wsl -d Ubuntu bash -c "kubectl get service frontend -n money-app -o jsonpath='{.spec.ports[0].nodePort}'"

# Get WSL IP for NodePort access
$wslIP = (wsl -d Ubuntu hostname -I 2>$null).Trim().Split()[0]

Write-Host '================================================' -ForegroundColor Green
Write-Host '  Deployment Complete!                         ' -ForegroundColor Green
Write-Host '================================================' -ForegroundColor Green
Write-Host ''

Write-Host "==> Access Information:" -ForegroundColor Cyan
Write-Host "  Frontend (Port-forward): http://localhost:8080" -ForegroundColor White
Write-Host "  Frontend (NodePort):     http://${wslIP}:$nodePort" -ForegroundColor White
if (-not $NoLogging) {
    Write-Host "  Grafana (Port-forward):  http://localhost:3000 (admin/admin)" -ForegroundColor White
    Write-Host "  Grafana (NodePort):      http://${wslIP}:30300" -ForegroundColor White
}
Write-Host "  Note: NodePort access from Windows requires WSL IP" -ForegroundColor Gray
Write-Host ''

Write-Host "==> Useful Commands:" -ForegroundColor Cyan
Write-Host "  View all resources:    wsl kubectl get all -n money-app" -ForegroundColor White
Write-Host "  View logs (CouchDB):   wsl kubectl logs -n money-app -l app=couchdb" -ForegroundColor White
Write-Host "  View logs (Backend):   wsl kubectl logs -n money-app -l app=backend" -ForegroundColor White
Write-Host "  View logs (Frontend):  wsl kubectl logs -n money-app -l app=frontend" -ForegroundColor White
Write-Host "  Delete deployment:     wsl kubectl delete namespace money-app" -ForegroundColor White
Write-Host ''

if (-not $NoBackup) {
    Write-Host "  Backup Commands:" -ForegroundColor Cyan
    Write-Host "  List backups:          bash ./scripts/list-backups.sh" -ForegroundColor White
    if (-not $NoNasBackup) {
        Write-Host "  Manual daily backup:   wsl kubectl create job -n money-app --from=cronjob/couchdb-backup manual-backup-`$(date +%s)" -ForegroundColor White
    }
    if (-not $NoLocalBackup) {
        Write-Host "  Manual hourly backup:  wsl kubectl create job -n money-app --from=cronjob/couchdb-backup-hourly manual-hourly-`$(date +%s)" -ForegroundColor White
    }
    Write-Host "  Restore backup:        bash ./scripts/restore-backup.sh <backup-file.tar.gz>" -ForegroundColor White
    Write-Host ''
}

# Handle port forwarding
# Port-forwarding setup
$kubectlWrapper = Join-Path $scriptDir 'kubectl-wsl.ps1'

if (-not $NoPortForward) {
    Write-Host '==> Preparing port-forward...' -ForegroundColor Cyan
    Write-Host ''
    
    # Wait for pods to be ready before starting port-forward
    Write-Host "Waiting for pods to be ready..." -ForegroundColor White
    $maxWait = 120 # seconds
    $waited = 0
    $allReady = $false
    
    while ($waited -lt $maxWait) {
        $podStatus = wsl -d Ubuntu bash -c "kubectl get pods -n money-app --no-headers 2>/dev/null" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $notReady = $podStatus | Where-Object { $_ -notmatch "Running|Completed" -or $_ -match "0/" }
            
            if (-not $notReady) {
                $allReady = $true
                break
            }
            
            Write-Host "  [$(($waited))s] Waiting for pods..." -ForegroundColor Gray
        }
        
        Start-Sleep -Seconds 5
        $waited += 5
    }
    
    if (-not $allReady) {
        Write-Host "[WARN] Some pods may not be ready yet" -ForegroundColor Yellow
        Write-Host "[INFO] Port-forward may be unstable" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "[OK] All pods are ready" -ForegroundColor Green
        Write-Host ""
    }
    
    if (-not $NoBrowser) {
        Write-Host "Opening browser in 3 seconds..." -ForegroundColor Cyan
        Start-Sleep -Seconds 3
        Start-Process 'http://localhost:8080'
    }
    
    Write-Host '================================================' -ForegroundColor Cyan
    Write-Host '  Port-Forward Active                          ' -ForegroundColor Cyan
    Write-Host '================================================' -ForegroundColor Cyan
    Write-Host ''
    
    # Start Grafana port-forward in background (if logging enabled)
    if (-not $NoLogging) {
        Write-Host '[INFO] Starting Grafana port-forward (localhost:3000)...' -ForegroundColor Cyan
        
        # Kill any existing port-forward on 3000
        Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | 
            Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        
        # Start Grafana port-forward in background using PowerShell job
        $grafanaJob = Start-Job -ScriptBlock {
            param($wslDistro)
            while ($true) {
                try {
                    & wsl -d $wslDistro bash -c "kubectl port-forward -n money-app svc/grafana 3000:3000 2>&1" | Out-Null
                } catch {
                    Start-Sleep -Seconds 3
                }
            }
        } -ArgumentList 'Ubuntu'
        
        Start-Sleep -Seconds 3
        
        # Verify Grafana port-forward is working
        $grafanaReady = $false
        for ($i = 0; $i -lt 10; $i++) {
            try {
                $response = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
                $grafanaReady = $true
                break
            } catch {
                Start-Sleep -Seconds 1
            }
        }
        
        if ($grafanaReady) {
            Write-Host '[OK] Grafana accessible at http://localhost:3000' -ForegroundColor Green
            Write-Host '      Username: admin | Password: admin' -ForegroundColor Gray
        } else {
            Write-Host '[WARN] Grafana port-forward may not be ready yet' -ForegroundColor Yellow
        }
        Write-Host ''
    }
    
    # Check if port 8080 is already in use
    $portInUse = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host "[WARN] Port 8080 is already in use" -ForegroundColor Yellow
        Write-Host "[INFO] Attempting to free port 8080..." -ForegroundColor Cyan
        
        # Kill Windows processes using port 8080
        $portInUse | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object {
            $procInfo = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($procInfo) {
                Write-Host "  Killing Windows process: $($procInfo.ProcessName) (PID: $_)" -ForegroundColor White
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        }
        
        # Kill WSL processes using port 8080
        Write-Host "  Checking WSL for port conflicts..." -ForegroundColor White
        wsl -d Ubuntu bash -c "pids=\$(sudo lsof -ti:8080 2>/dev/null); if [ -n \"\$pids\" ]; then echo \"  Killing WSL processes: \$pids\"; echo \$pids | xargs sudo kill -9 2>/dev/null; fi" 2>&1 | ForEach-Object { 
            if ($_ -ne "") { Write-Host $_ -ForegroundColor White }
        }
        
        Start-Sleep -Seconds 2
        
        $stillInUse = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
        if ($stillInUse) {
            Write-Host "[ERROR] Failed to free port 8080" -ForegroundColor Red
            Write-Host "[INFO] Please manually close the application using port 8080" -ForegroundColor Yellow
            Write-Host "[INFO] Or run: wsl -d Ubuntu sudo lsof -ti:8080 | xargs sudo kill -9" -ForegroundColor Yellow
            Write-Host "[INFO] Or use NodePort access: http://${wslIP}:$nodePort" -ForegroundColor Cyan
            exit 1
        }
        
        Write-Host "[OK] Port 8080 is now available" -ForegroundColor Green
        Write-Host ""
    }
    
    Write-Host 'Access: http://localhost:8080' -ForegroundColor Green
    Write-Host 'Press Ctrl+C to stop' -ForegroundColor Yellow
    Write-Host ''
    
    try {
        # Port-forward with intelligent auto-reconnect
        $reconnectCount = 0
        $maxConsecutiveFailures = 10
        $consecutiveFailures = 0
        $lastSuccessTime = Get-Date
    
    while ($true) {
        if ($reconnectCount -gt 0) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Reconnecting (attempt #$reconnectCount)..." -ForegroundColor Yellow
            
            # Check cluster health before reconnecting
            $clusterHealthy = wsl -d Ubuntu bash -c "kubectl get pods -n money-app --no-headers 2>/dev/null | grep -c Running" 2>&1
            if ($LASTEXITCODE -ne 0 -or [int]$clusterHealthy -eq 0) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Cluster unhealthy - checking K3s..." -ForegroundColor Yellow
                
                $k3sActive = wsl -d Ubuntu bash -c "systemctl is-active k3s 2>/dev/null" 2>&1
                if ($k3sActive -ne "active") {
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] K3s is down! Attempting restart..." -ForegroundColor Red
                    wsl -d Ubuntu bash -c "sudo systemctl start k3s" 2>&1 | Out-Null
                    Start-Sleep -Seconds 10
                }
            }
            
            Start-Sleep -Seconds 3
        }
        
        $connectionEstablished = $false
        $portConflict = $false
        try {
            & $kubectlWrapper port-forward -n money-app svc/frontend 8080:80 2>&1 | ForEach-Object {
                if ($_ -match 'Forwarding from') {
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Port-forward established" -ForegroundColor Green
                    $connectionEstablished = $true
                    $consecutiveFailures = 0
                    $lastSuccessTime = Get-Date
                }
                if ($_ -match 'bind: address already in use') {
                    $portConflict = $true
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Port 8080 is in use!" -ForegroundColor Red
                }
                if ($_ -match 'error|EOF|connection' -and $_ -notmatch 'address already in use') {
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $_" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connection error: $_" -ForegroundColor Red
            if ($_ -match 'address already in use') {
                $portConflict = $true
            }
        }
        
        # Handle port conflicts immediately
        if ($portConflict) {
            Write-Host ""
            Write-Host "[ERROR] Port 8080 is being used by another process" -ForegroundColor Red
            Write-Host "[INFO] Killing processes on port 8080..." -ForegroundColor Cyan
            
            # Kill Windows processes
            Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | 
                Select-Object -ExpandProperty OwningProcess | 
                Sort-Object -Unique | 
                ForEach-Object { 
                    Write-Host "  Killing Windows PID: $_" -ForegroundColor White
                    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue 
                }
            
            # Kill WSL processes
            Write-Host "  Checking WSL..." -ForegroundColor White
            wsl -d Ubuntu bash -c "pids=\$(sudo lsof -ti:8080 2>/dev/null); if [ -n \"\$pids\" ]; then echo \"  Killing WSL PIDs: \$pids\"; echo \$pids | xargs sudo kill -9 2>/dev/null; fi" 2>&1 | ForEach-Object { 
                if ($_ -ne "") { Write-Host $_ -ForegroundColor White }
            }
            
            Start-Sleep -Seconds 3
            $consecutiveFailures = 0  # Reset after attempting to fix
            $reconnectCount++
            continue
        }
        
        if (-not $connectionEstablished) {
            $consecutiveFailures++
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connection failed ($consecutiveFailures/$maxConsecutiveFailures)" -ForegroundColor Red
            
            if ($consecutiveFailures -ge $maxConsecutiveFailures) {
                Write-Host ""
                Write-Host "[ERROR] Too many consecutive connection failures" -ForegroundColor Red
                Write-Host "[INFO] Your cluster may be experiencing issues" -ForegroundColor Yellow
                Write-Host "[INFO] Check logs: wsl kubectl logs -n money-app -l app=frontend" -ForegroundColor Yellow
                Write-Host "[INFO] Check pods: wsl kubectl get pods -n money-app" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "Exiting port-forward. Access via NodePort: http://${wslIP}:$nodePort" -ForegroundColor Cyan
                exit 1
            }
        }
        
        $reconnectCount++
        
        # Periodic health summary (every 5 minutes)
        $timeSinceSuccess = (Get-Date) - $lastSuccessTime
        if ($timeSinceSuccess.TotalMinutes -gt 5 -and $reconnectCount % 10 -eq 0) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] No stable connection for $($timeSinceSuccess.TotalMinutes.ToString('F0')) minutes" -ForegroundColor Yellow
        }
    }
    } finally {
        # Cleanup: Stop Grafana port-forward job
        Write-Host ""
        Write-Host "[INFO] Stopping background port-forwards..." -ForegroundColor Cyan
        Get-Job | Where-Object { $_.Command -like '*grafana*' -or $_.Command -like '*port-forward*' } | Stop-Job -PassThru | Remove-Job -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] Cleanup complete" -ForegroundColor Green
    }
} else {
    Write-Host 'To access your app:' -ForegroundColor Cyan
    Write-Host '  .\deploy-local.ps1' -ForegroundColor White
    Write-Host ''
    Write-Host 'Or via WSL IP:' -ForegroundColor Cyan
    Write-Host "  http://${wslIP}:$nodePort" -ForegroundColor White
    Write-Host ''
}
