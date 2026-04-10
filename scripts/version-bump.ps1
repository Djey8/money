# Usage: .\scripts\version-bump.ps1 [-Type patch|minor|major] [-DryRun]
param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Type = "patch",
    [switch]$DryRun
)

$pkg = Get-Content package.json | ConvertFrom-Json
$current = $pkg.version
$parts = $current.Split(".")

switch ($Type) {
    "major" { $parts[0] = [int]$parts[0] + 1; $parts[1] = 0; $parts[2] = 0 }
    "minor" { $parts[1] = [int]$parts[1] + 1; $parts[2] = 0 }
    "patch" { $parts[2] = [int]$parts[2] + 1 }
}

$newVersion = $parts -join "."

if ($DryRun) {
    Write-Host "Would bump: $current -> $newVersion" -ForegroundColor Yellow
    exit 0
}

# Update package.json
npm version $newVersion --no-git-tag-version

# Update backend/package.json to keep in sync
$backendPkg = Get-Content backend/package.json | ConvertFrom-Json
$backendPkg.version = $newVersion
$backendPkg | ConvertTo-Json -Depth 10 | Set-Content backend/package.json

# Generate/update CHANGELOG
& "$PSScriptRoot/changelog.ps1"

# Commit and tag
git add package.json package-lock.json backend/package.json CHANGELOG.md
git commit -m "chore(release): v$newVersion"
git tag -a "v$newVersion" -m "Release v$newVersion"

Write-Host ""
Write-Host "Released v$newVersion" -ForegroundColor Green
Write-Host "Run 'git push origin main --tags' to publish." -ForegroundColor Cyan
