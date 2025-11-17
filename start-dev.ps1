# Скрипт для запуска всего проекта в режиме разработки
# Использование: .\start-dev.ps1

Write-Host "🚀 Запуск YT Zavod в режиме разработки..." -ForegroundColor Cyan
Write-Host ""

# Проверяем, установлен ли ngrok
try {
    $ngrokVersion = & ngrok version 2>&1
    Write-Host "✅ ngrok установлен: $ngrokVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ngrok не установлен" -ForegroundColor Red
    Write-Host "Установите: choco install ngrok" -ForegroundColor Yellow
    Write-Host "Или скачайте с: https://ngrok.com/download" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📋 Будут запущены 3 процесса:" -ForegroundColor Cyan
Write-Host "   1. Backend (порт 3000)" -ForegroundColor White
Write-Host "   2. Frontend (порт 5173)" -ForegroundColor White
Write-Host "   3. ngrok (туннель для webhook)" -ForegroundColor White
Write-Host ""

# Спрашиваем подтверждение
$confirm = Read-Host "Продолжить? (Y/n)"
if ($confirm -eq "n" -or $confirm -eq "N") {
    Write-Host "❌ Отменено" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔧 Запускаю процессы..." -ForegroundColor Cyan
Write-Host ""

# Проверяем наличие node_modules
if (-not (Test-Path ".\backend\node_modules")) {
    Write-Host "📦 Устанавливаю зависимости backend..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not (Test-Path ".\frontend\node_modules")) {
    Write-Host "📦 Устанавливаю зависимости frontend..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

# Создаём новое окно PowerShell для backend
Write-Host "1️⃣  Запускаю Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; Write-Host '🔧 Backend Server' -ForegroundColor Green; npm run dev"

# Ждём 3 секунды, чтобы backend успел запуститься
Start-Sleep -Seconds 3

# Создаём новое окно PowerShell для frontend
Write-Host "2️⃣  Запускаю Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; Write-Host '⚛️  Frontend (Vite)' -ForegroundColor Blue; npm run dev"

# Ждём 2 секунды
Start-Sleep -Seconds 2

# Создаём новое окно PowerShell для ngrok
Write-Host "3️⃣  Запускаю ngrok..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '🌐 ngrok Tunnel' -ForegroundColor Magenta; Write-Host 'Скопируйте HTTPS URL после запуска' -ForegroundColor Yellow; Write-Host ''; ngrok http 3000"

# Ждём 5 секунд, чтобы ngrok успел запуститься
Write-Host ""
Write-Host "⏳ Ожидание запуска ngrok (5 сек)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "🔄 Обновляю webhook..." -ForegroundColor Cyan

# Запускаем скрипт обновления webhook
& .\update-webhook.ps1

Write-Host ""
Write-Host "✅ Всё запущено!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Открытые окна:" -ForegroundColor Cyan
Write-Host "   • Backend: http://localhost:3000" -ForegroundColor White
Write-Host "   • Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   • ngrok UI: http://127.0.0.1:4040" -ForegroundColor White
Write-Host ""
Write-Host "🤖 Telegram бот готов к работе!" -ForegroundColor Green
Write-Host "   Найдите бота в Telegram и отправьте: /start" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Чтобы остановить всё, закройте окна PowerShell" -ForegroundColor Yellow
Write-Host ""
Write-Host "Нажмите любую клавишу для выхода..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
