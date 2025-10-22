# Скрипт быстрого запуска Backend

Write-Host "==================================="
Write-Host "🚀 YT Combiner Backend Startup"
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

# Переход в папку backend
Set-Location -Path $PSScriptRoot\backend

# Проверка наличия node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "📥 Установка зависимостей..."
    npm install
}

# Проверка .env
if (-not (Test-Path "..\\.env")) {
    Write-Host ""
    Write-Host "⚠️  Файл .env не найден!" -ForegroundColor Yellow
    Write-Host "Скопируйте .env.example в .env и заполните настройки" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Запуск Backend сервера..."
Write-Host "API будет доступен на http://localhost:3000"
Write-Host ""

npm run dev
