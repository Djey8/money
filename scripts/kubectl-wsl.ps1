#!/usr/bin/env pwsh
# kubectl-wsl.ps1 - Wrapper to run kubectl from Windows PowerShell against K3s in WSL

$command = "kubectl"
if ($args.Count -gt 0) {
    $command += " " + ($args -join " ")
}

wsl -d Ubuntu bash -c $command
