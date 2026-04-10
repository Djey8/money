# Stop and clean up the test environment
# Usage: .\scripts\test-env-down.ps1

$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot '..\docker-compose.test.yml'

Write-Host '--- Stopping test environment ---' -ForegroundColor Cyan
podman compose -f $composeFile down -v
Write-Host 'Test environment stopped and volumes removed.' -ForegroundColor Green
