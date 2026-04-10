# Run the full test pipeline locally (mirrors the CI workflow).
# Usage: .\scripts\test-all.ps1
#
# Steps:
#   1. Frontend unit tests (Jest)
#   2. Backend unit tests (Jest)
#   3. Backend integration tests (CouchDB via Podman)
#   4. E2E tests (Playwright + Podman stack)
#
# Exits with code 1 on first failure.

param(
    [switch]$SkipE2E,
    [switch]$SkipIntegration
)

$rootDir = Split-Path $PSScriptRoot -Parent
$failed = $false
$results = @()

function Write-Step($msg) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host " $msg" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Record-Result($name, $exitCode) {
    $status = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }
    $color = if ($exitCode -eq 0) { 'Green' } else { 'Red' }
    $script:results += [PSCustomObject]@{ Test = $name; Status = $status }
    Write-Host "$name : $status" -ForegroundColor $color
    if ($exitCode -ne 0) { $script:failed = $true }
    return $exitCode
}

# -- 1. Frontend Unit Tests --
Write-Step 'Frontend Unit Tests'
Push-Location $rootDir
npx jest --config jest.config.js --ci
Record-Result 'Frontend Unit' $LASTEXITCODE | Out-Null
Pop-Location

if ($failed) {
    Write-Host "`nFrontend unit tests failed - aborting.`n" -ForegroundColor Red
    exit 1
}

# -- 2. Backend Unit Tests --
Write-Step 'Backend Unit Tests'
Push-Location (Join-Path $rootDir 'backend')
npx jest --ci --forceExit -- tests/unit
Record-Result 'Backend Unit' $LASTEXITCODE | Out-Null
Pop-Location

if ($failed) {
    Write-Host "`nBackend unit tests failed - aborting.`n" -ForegroundColor Red
    exit 1
}

# -- 3. Backend Integration Tests --
if (-not $SkipIntegration) {
    Write-Step 'Backend Integration Tests'
    $testComposeFile = Join-Path $rootDir 'docker-compose.test.yml'

    # Start test CouchDB
    Write-Host 'Starting test CouchDB...' -ForegroundColor Yellow
    podman compose -f $testComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'ERROR: Failed to start test CouchDB (is Podman running?)' -ForegroundColor Red
        Record-Result 'Backend Integration' 1 | Out-Null
        exit 1
    }

    $maxRetries = 30
    $retry = 0
    while ($retry -lt $maxRetries) {
        try {
            $response = Invoke-RestMethod -Uri 'http://localhost:5986/_up' -TimeoutSec 2 -ErrorAction Stop
            if ($response.status -eq 'ok') {
                Write-Host 'CouchDB is ready!' -ForegroundColor Green
                break
            }
        } catch { }
        $retry++
        if ($retry -eq $maxRetries) {
            Write-Host 'ERROR: CouchDB did not become ready' -ForegroundColor Red
            podman compose -f $testComposeFile down -v
            Record-Result 'Backend Integration' 1 | Out-Null
            exit 1
        }
        Start-Sleep -Seconds 1
    }

    Push-Location (Join-Path $rootDir 'backend')
    $env:COUCHDB_URL = 'http://admin:password@localhost:5986'
    $env:JWT_SECRET = 'test-secret-local'
    $env:NODE_ENV = 'test'
    npx jest --ci --forceExit --detectOpenHandles -- tests/integration
    $integrationExit = $LASTEXITCODE
    Remove-Item Env:\COUCHDB_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\JWT_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:\NODE_ENV -ErrorAction SilentlyContinue
    Pop-Location

    Record-Result 'Backend Integration' $integrationExit | Out-Null

    # Tear down test CouchDB
    Write-Host 'Stopping test CouchDB...' -ForegroundColor Yellow
    podman compose -f $testComposeFile down -v

    if ($failed) {
        Write-Host "`nBackend integration tests failed - aborting.`n" -ForegroundColor Red
        exit 1
    }
} else {
    $results += [PSCustomObject]@{ Test = 'Backend Integration'; Status = 'SKIP' }
}

# -- 4. E2E Tests --
if (-not $SkipE2E) {
    Write-Step 'E2E Tests (Playwright)'
    $e2eComposeFile = Join-Path $rootDir 'docker-compose.e2e.yml'

    Write-Host 'Starting E2E stack...' -ForegroundColor Yellow
    podman compose -f $e2eComposeFile up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'ERROR: Failed to start E2E stack (is Podman running?)' -ForegroundColor Red
        Record-Result 'E2E' 1 | Out-Null
        exit 1
    }

    $maxRetries = 60
    $retry = 0
    while ($retry -lt $maxRetries) {
        try {
            Invoke-RestMethod -Uri 'http://localhost:3000/health' -TimeoutSec 2 -ErrorAction Stop
            Write-Host 'Backend is ready!' -ForegroundColor Green
            break
        } catch { }
        $retry++
        if ($retry -eq $maxRetries) {
            Write-Host 'ERROR: Backend did not become ready' -ForegroundColor Red
            podman compose -f $e2eComposeFile down -v
            Record-Result 'E2E' 1 | Out-Null
            exit 1
        }
        Start-Sleep -Seconds 2
    }

    Push-Location $rootDir
    npx playwright test
    $e2eExit = $LASTEXITCODE
    Pop-Location

    Record-Result 'E2E' $e2eExit | Out-Null

    Write-Host 'Stopping E2E stack...' -ForegroundColor Yellow
    podman compose -f $e2eComposeFile down -v
} else {
    $results += [PSCustomObject]@{ Test = 'E2E'; Status = 'SKIP' }
}

# -- Summary --
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host ' TEST SUMMARY' -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$results | ForEach-Object {
    $color = switch ($_.Status) { 'PASS' { 'Green' } 'FAIL' { 'Red' } 'SKIP' { 'Yellow' } }
    Write-Host ("  {0,-25} {1}" -f $_.Test, $_.Status) -ForegroundColor $color
}
Write-Host "========================================`n" -ForegroundColor Cyan

if ($failed) {
    Write-Host 'PIPELINE FAILED' -ForegroundColor Red
    exit 1
} else {
    Write-Host 'ALL TESTS PASSED' -ForegroundColor Green
    exit 0
}
