# Frontend startup script

Write-Host "==================================="
Write-Host "YT Combiner Frontend Startup"
Write-Host "==================================="
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..."
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Node.js is not installed!" -ForegroundColor Red
    Write-Host "Download from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Node.js $nodeVersion" -ForegroundColor Green

# Navigate to frontend folder
Set-Location -Path $PSScriptRoot\frontend

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "Installing dependencies..."
    npm install
}

Write-Host ""
Write-Host "Starting Frontend server..."
Write-Host "Application available at http://localhost:5173"
Write-Host ""

npm run dev
