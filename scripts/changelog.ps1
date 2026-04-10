# Auto-generates CHANGELOG.md from git tags and conventional commits
$tags = git tag --sort=-version:refname | Select-Object -First 2
$range = if ($tags.Count -ge 2) { "$($tags[1])..HEAD" } else { "HEAD" }

$commits = git log $range --pretty=format:"%s" |
    Where-Object { $_ -match "^(feat|fix|perf)" }

$date = Get-Date -Format "yyyy-MM-dd"
$version = (Get-Content package.json | ConvertFrom-Json).version

$features = $commits | Where-Object { $_ -match "^feat" } | ForEach-Object { "- $_" }
$fixes    = $commits | Where-Object { $_ -match "^fix" }  | ForEach-Object { "- $_" }
$perfs    = $commits | Where-Object { $_ -match "^perf" } | ForEach-Object { "- $_" }

$entry = "## [$version] - $date`n"
if ($features) { $entry += "`n### Features`n$($features -join "`n")`n" }
if ($fixes)    { $entry += "`n### Bug Fixes`n$($fixes -join "`n")`n" }
if ($perfs)    { $entry += "`n### Performance`n$($perfs -join "`n")`n" }

if (Test-Path CHANGELOG.md) {
    $existing = Get-Content CHANGELOG.md -Raw
    $entry + "`n" + $existing | Set-Content CHANGELOG.md
} else {
    "# Changelog`n`n" + $entry | Set-Content CHANGELOG.md
}

Write-Host "CHANGELOG.md updated for v$version"
