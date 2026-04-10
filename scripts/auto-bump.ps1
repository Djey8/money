# Reads commits since last tag and auto-determines bump type
$lastTag = git describe --tags --abbrev=0 2>$null
$range = if ($lastTag) { "$lastTag..HEAD" } else { "HEAD" }
$commits = git log $range --pretty=format:"%s"

$bump = "patch"

foreach ($msg in $commits) {
    if ($msg -match "BREAKING CHANGE" -or $msg -match "^[a-z]+(\(.+\))?!:") {
        $bump = "major"
        break
    }
    if ($msg -match "^feat") {
        $bump = "minor"
    }
}

Write-Host "Auto-detected bump type: $bump" -ForegroundColor Cyan
Write-Host "Commits since ${lastTag}:" -ForegroundColor Gray
$commits | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
Write-Host ""

$confirm = Read-Host "Proceed with $bump bump? (y/n)"
if ($confirm -eq "y") {
    & "$PSScriptRoot/version-bump.ps1" -Type $bump
}
