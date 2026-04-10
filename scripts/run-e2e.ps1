# Run full E2E test suite: start stack, run Playwright tests, tear down.
# Usage: .\scripts\run-e2e.ps1

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $projectRoot 'docker-compose.e2e.yml'

# Run everything from the project root so Playwright finds its config and tests
Push-Location $projectRoot

# ── 1. Start the E2E stack ──────────────────────────────────────────
Write-Host '--- Starting E2E environment ---' -ForegroundColor Cyan
podman compose -f $composeFile up -d --build

# Wait for backend health endpoint
Write-Host 'Waiting for backend to be ready...' -ForegroundColor Yellow
$maxRetries = 60
$retry = 0
while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri 'http://localhost:3000/health' -TimeoutSec 2 -ErrorAction Stop
        Write-Host 'Backend is ready!' -ForegroundColor Green
        break
    } catch {
        # Not ready yet
    }
    $retry++
    if ($retry -eq $maxRetries) {
        Write-Host 'ERROR: Backend did not become ready in time' -ForegroundColor Red
        podman compose -f $composeFile down -v
        Pop-Location
        exit 1
    }
    Start-Sleep -Seconds 2
}

# ── 2. Run Playwright tests ─────────────────────────────────────────
Write-Host '--- Running E2E tests ---' -ForegroundColor Cyan
$testExitCode = 0
try {
    npx playwright test
    $testExitCode = $LASTEXITCODE
} catch {
    $testExitCode = 1
}

# ── 3. Tear down ────────────────────────────────────────────────────
Write-Host '--- Stopping E2E environment ---' -ForegroundColor Cyan
podman compose -f $composeFile down -v
Write-Host 'E2E environment stopped and volumes removed.' -ForegroundColor Green

Pop-Location
# Exit with the test exit code so CI sees the real result
exit $testExitCode
