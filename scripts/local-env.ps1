# Local self-hosted test stack (CouchDB + backend + frontend + MCP) on Podman - nothing is deployed.
# Usage:
#   .\scripts\local-env.ps1 up              build from the working tree and start everything (http://localhost:8080)
#   .\scripts\local-env.ps1 up -Dev         containers for CouchDB + backend + MCP only; run the UI with `ng serve`
#   .\scripts\local-env.ps1 up -NoBuild     start with the images that already exist
#   .\scripts\local-env.ps1 status          what is running and answering
#   .\scripts\local-env.ps1 logs [service]  recent logs (couchdb | backend | frontend | mcp)
#   .\scripts\local-env.ps1 down            stop, keep the test data
#   .\scripts\local-env.ps1 reset           stop and delete the test data
# Skill: .claude/skills/mm-local-selfhosted

param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'reset', 'status', 'logs')]
    [string]$Action = 'status',
    [Parameter(Position = 1)]
    [string]$Service = '',
    [switch]$Dev,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compose = Join-Path $root 'docker-compose.local.yml'
$couch = 'http://localhost:15984'
$api = 'http://localhost:13000'
$ui = 'http://localhost:8080'

# Podman prints a banner about its compose provider on stderr, which Windows PowerShell 5.1 would turn into an error:
# switch it off, and judge every native call by its exit code instead.
$env:PODMAN_COMPOSE_WARNING_LOGS = 'false'

function Compose {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { podman compose -f $compose @args } finally { $ErrorActionPreference = $previous }
}

function Ensure-Podman {
    $null = Get-Command podman -ErrorAction Stop
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    podman info 2>$null | Out-Null
    $ErrorActionPreference = $previous
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Podman machine is not running - starting it...' -ForegroundColor Yellow
        podman machine start | Out-Null
    }
}

function Wait-For([string]$name, [string]$url, [int]$seconds = 120) {
    Write-Host "Waiting for $name ($url)..." -NoNewline -ForegroundColor Yellow
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($r.StatusCode -lt 500) { Write-Host ' ready' -ForegroundColor Green; return $true }
        } catch { }
        Write-Host '.' -NoNewline
        Start-Sleep -Seconds 2
    }
    Write-Host ' NOT READY' -ForegroundColor Red
    return $false
}

function Set-CouchLimits {
    # Same limits as config/couchdb-local.ini (the real deploy mounts that file): a document is capped at 8 MB, so a
    # test run behaves like production when a stored game gets large.
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('admin:local-test-password'))
    $headers = @{ Authorization = "Basic $auth" }
    foreach ($setting in @(@('couchdb', 'max_document_size', '8388608'), @('chttpd', 'max_connections', '50'))) {
        $uri = "$couch/_node/_local/_config/$($setting[0])/$($setting[1])"
        try { Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body ('"' + $setting[2] + '"') -ContentType 'application/json' | Out-Null } catch { Write-Host "  (could not set $($setting[1]): $($_.Exception.Message))" -ForegroundColor DarkYellow }
    }
}

Ensure-Podman

switch ($Action) {
    'up' {
        [string[]]$services = if ($Dev) { @('couchdb', 'backend', 'mcp') } else { @('couchdb', 'backend', 'certs', 'frontend', 'mcp') }
        [string[]]$flags = if ($NoBuild) { @() } else { @('--build') }
        Write-Host "--- Starting the local stack: $($services -join ', ') ---" -ForegroundColor Cyan
        Compose up -d @flags @services
        if ($LASTEXITCODE -ne 0) { Write-Host 'compose up failed' -ForegroundColor Red; exit 1 }

        $ok = (Wait-For 'CouchDB' "$couch/_up") -and (Wait-For 'backend' "$api/health")
        if ($ok -and -not $Dev) { $ok = Wait-For 'frontend' "$ui/" }
        if (-not $ok) { Write-Host 'Something did not come up - see: .\scripts\local-env.ps1 logs <service>' -ForegroundColor Red; exit 1 }
        Set-CouchLimits

        Write-Host ''
        Write-Host 'Local stack is up.' -ForegroundColor Green
        if ($Dev) {
            Write-Host "  API        $api   (CouchDB $couch, MCP http://localhost:13939)"
            Write-Host '  UI         run:  npm run build:domain; npx ng serve --configuration selfhosted --proxy-config proxy.local.conf.json'
            Write-Host '             then open http://localhost:4200'
        } else {
            Write-Host "  App        $ui"
            Write-Host "  API        $api   (CouchDB $couch/_utils, MCP http://localhost:13939)"
        }
        Write-Host '  Cashflow game account: register an email containing "cashflow"; the game password on this stack is: localtest'
        Write-Host '  Stop: .\scripts\local-env.ps1 down      Wipe data: .\scripts\local-env.ps1 reset'
    }
    'down' {
        Compose down
    }
    'reset' {
        Compose down -v
        Write-Host 'Local stack stopped and its test data deleted.' -ForegroundColor Green
    }
    'status' {
        podman ps -a --filter 'name=mm-local-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
        foreach ($check in @(@('CouchDB', "$couch/_up"), @('backend', "$api/health"), @('app', "$ui/"))) {
            try { $r = Invoke-WebRequest -Uri $check[1] -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; Write-Host ("{0,-8} {1}  {2}" -f $check[0], $r.StatusCode, $check[1]) -ForegroundColor Green }
            catch { Write-Host ("{0,-8} down  {1}" -f $check[0], $check[1]) -ForegroundColor DarkGray }
        }
    }
    'logs' {
        if ($Service) { Compose logs --tail 150 $Service } else { Compose logs --tail 60 }
    }
}
