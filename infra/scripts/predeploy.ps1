#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

# Write backend URL for production builds so the frontend calls the real API.
$scriptDir = Split-Path -Parent $PSCommandPath
$infraDir = Split-Path -Parent $scriptDir
$rootDir = Split-Path -Parent $infraDir
$webDir = Join-Path $rootDir "src" "web"
$envFile = Join-Path $webDir ".env.production"

Write-Host "Root: $rootDir"
Write-Host "Web: $webDir"
Write-Host "Env file: $envFile"

# Try API_BASE_URL first (new infra), fall back to API_URL (legacy)
$apiUrl = azd env get-value API_BASE_URL 2>$null
if (-not $apiUrl) {
    $apiUrl = azd env get-value API_URL 2>$null
}
if (-not $apiUrl) {
    Write-Error "Neither API_BASE_URL nor API_URL is set in the azd environment; cannot configure frontend API base"
    exit 1
}

Set-Content -Path $envFile -Value "NEXT_PUBLIC_API_URL=$apiUrl" -NoNewline -Force
Write-Host "Wrote API URL to $envFile"
