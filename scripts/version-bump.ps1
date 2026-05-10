# Usage: .\scripts\version-bump.ps1 [-Type patch|minor|major] [-DryRun]
param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Type = "patch",
    [switch]$DryRun
)

$pkg = Get-Content package.json | ConvertFrom-Json
$current = $pkg.version

# Use the highest existing semantic version tag as baseline to avoid
# collisions after history rewrites/resets (e.g. v1.8.0 already exists).
$latestTag = git tag --list "v*" --sort=-version:refname | Select-Object -First 1
$tagVersion = $null
if ($latestTag -and $latestTag -match '^v(\d+)\.(\d+)\.(\d+)$') {
    $tagVersion = $Matches[1..3] -join "."
}

$baseVersion = $current
if ($tagVersion) {
    $currentObj = [version]$current
    $tagObj = [version]$tagVersion
    if ($tagObj -gt $currentObj) {
        $baseVersion = $tagVersion
    }
}

$parts = $baseVersion.Split(".")

switch ($Type) {
    "major" { $parts[0] = [int]$parts[0] + 1; $parts[1] = 0; $parts[2] = 0 }
    "minor" { $parts[1] = [int]$parts[1] + 1; $parts[2] = 0 }
    "patch" { $parts[2] = [int]$parts[2] + 1 }
}

$newVersion = $parts -join "."

# If the computed tag still exists (e.g. mixed history), keep bumping patch
# until we get a free version.
while ((git tag --list "v$newVersion" | Measure-Object).Count -gt 0) {
    $parts = $newVersion.Split(".")
    $parts[2] = [int]$parts[2] + 1
    $newVersion = $parts -join "."
}

if ($DryRun) {
    Write-Host "Would bump: $baseVersion -> $newVersion (package.json currently $current)" -ForegroundColor Yellow
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
