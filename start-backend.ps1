# Backend startup script

Write-Host "==================================="
Write-Host "YT Combiner Backend Startup"
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

# Navigate to backend folder
Set-Location -Path $PSScriptRoot\backend

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "Installing dependencies..."
    npm install
}

# Check .env
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Copy .env.example to .env and fill in settings" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Backend server..."
Write-Host "API available at http://localhost:3000"
Write-Host ""

npm run dev
