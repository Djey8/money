# Start the test environment (CouchDB) using Podman Compose
# Usage: .\scripts\test-env-up.ps1

$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot '..\docker-compose.test.yml'

Write-Host '--- Starting test environment ---' -ForegroundColor Cyan
podman compose -f $composeFile up -d

# Wait for CouchDB to be healthy
Write-Host 'Waiting for CouchDB to be ready...' -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri 'http://localhost:5986/_up' -TimeoutSec 2 -ErrorAction Stop
        if ($response.status -eq 'ok') {
            Write-Host 'CouchDB is ready!' -ForegroundColor Green
            exit 0
        }
    } catch {
        # Not ready yet
    }
    $retry++
    Start-Sleep -Seconds 1
}

Write-Host 'ERROR: CouchDB did not become ready in time' -ForegroundColor Red
exit 1
