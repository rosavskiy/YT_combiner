# Скрипт быстрого запуска Frontend

Write-Host "==================================="
Write-Host "🎨 YT Combiner Frontend Startup"
Write-Host "==================================="
Write-Host ""

# Проверка Node.js
Write-Host "📦 Проверка Node.js..."
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js не установлен!" -ForegroundColor Red
    Write-Host "Скачайте с https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green

# Переход в папку frontend
Set-Location -Path $PSScriptRoot\frontend

# Проверка наличия node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "📥 Установка зависимостей..."
    npm install
}

Write-Host ""
Write-Host "🎯 Запуск Frontend сервера..."
Write-Host "Приложение будет доступно на http://localhost:5173"
Write-Host ""

npm run dev
