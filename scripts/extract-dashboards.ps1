# Extract Grafana dashboards from Kubernetes ConfigMap to local files
# This script converts the k8s dashboard ConfigMap to individual JSON files for docker-compose

Write-Host "Extracting Grafana dashboards from k8s ConfigMap..." -ForegroundColor Cyan

$configMapPath = "k8s\grafana-dashboards.yaml"
$outputDir = "grafana\dashboards"

# Ensure output directory exists
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

# Read the ConfigMap file
$content = Get-Content $configMapPath -Raw

# Extract each dashboard JSON
$dashboards = @{
    "backend-api-performance.json" = "Backend API Performance"
    "user-activity.json" = "User Activity"
    "error-tracking.json" = "Error Tracking"
    "frontend-logs.json" = "Frontend Logs"
    "system-overview.json" = "System Overview"
    "security-monitoring.json" = "Security Monitoring"
    "data-operations.json" = "Data Operations"
}

foreach ($filename in $dashboards.Keys) {
    $title = $dashboards[$filename]
    
    # Find the dashboard JSON in the ConfigMap
    $pattern = "(?s)$filename\s*:\s*\|(.+?)(?=\n  #|\n\n|\Z)"
    if ($content -match $pattern) {
        $dashboardJson = $Matches[1].Trim()
        
        # Remove leading pipe and spaces from YAML multiline string
        $dashboardJson = $dashboardJson -replace '(?m)^\s+', ''
        
        # Save to file
        $outputPath = Join-Path $outputDir $filename
        $dashboardJson | Set-Content -Path $outputPath -Encoding UTF8
        
        Write-Host "Extracted: $filename" -ForegroundColor Green
    } else {
        Write-Host "Could not find: $filename" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Dashboard extraction complete!" -ForegroundColor Cyan
Write-Host "Dashboards are ready in: $outputDir" -ForegroundColor Yellow
