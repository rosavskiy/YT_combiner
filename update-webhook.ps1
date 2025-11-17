# Скрипт для обновления Telegram webhook с новым ngrok URL
# Использование: .\update-webhook.ps1

Write-Host "🔄 Обновление Telegram webhook..." -ForegroundColor Cyan

# Проверяем, запущен ли ngrok
$ngrokApi = "http://127.0.0.1:4040/api/tunnels"
try {
    $tunnels = Invoke-RestMethod -Uri $ngrokApi -ErrorAction Stop
    
    if ($tunnels.tunnels.Count -eq 0) {
        Write-Host "❌ ngrok запущен, но туннели не найдены" -ForegroundColor Red
        Write-Host "Запустите: ngrok http 3000" -ForegroundColor Yellow
        exit 1
    }
    
    # Получаем HTTPS URL
    $ngrokUrl = $tunnels.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if (-not $ngrokUrl) {
        Write-Host "❌ HTTPS туннель не найден" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ ngrok URL найден: $ngrokUrl" -ForegroundColor Green
    
    # Формируем webhook URL
    $webhookUrl = "$ngrokUrl/api/telegram/webhook"
    
    # Обновляем .env файл
    $envPath = ".\backend\.env"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath -Raw
        
        # Обновляем или добавляем TELEGRAM_WEBHOOK_URL
        if ($envContent -match "TELEGRAM_WEBHOOK_URL=.*") {
            $envContent = $envContent -replace "TELEGRAM_WEBHOOK_URL=.*", "TELEGRAM_WEBHOOK_URL=$webhookUrl"
            Write-Host "✅ .env обновлён" -ForegroundColor Green
        } else {
            $envContent += "`nTELEGRAM_WEBHOOK_URL=$webhookUrl"
            Write-Host "✅ TELEGRAM_WEBHOOK_URL добавлен в .env" -ForegroundColor Green
        }
        
        Set-Content -Path $envPath -Value $envContent
    } else {
        Write-Host "⚠️  Файл .env не найден, создаю..." -ForegroundColor Yellow
        "TELEGRAM_WEBHOOK_URL=$webhookUrl" | Out-File -FilePath $envPath
    }
    
    # Устанавливаем webhook через наш API
    Write-Host "🔧 Устанавливаем webhook..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/telegram/set-webhook" -ErrorAction Stop
        
        if ($response.success) {
            Write-Host "✅ Webhook успешно установлен!" -ForegroundColor Green
            Write-Host "📍 URL: $webhookUrl" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Ошибка: $($response.error)" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Не удалось установить webhook" -ForegroundColor Red
        Write-Host "Убедитесь, что backend сервер запущен (npm run dev)" -ForegroundColor Yellow
        Write-Host "Ошибка: $_" -ForegroundColor Red
    }
    
    # Проверяем статус
    Write-Host "`n🔍 Проверяю статус webhook..." -ForegroundColor Cyan
    
    try {
        $statusResponse = Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/telegram/webhook-info" -ErrorAction Stop
        
        if ($statusResponse.success) {
            $info = $statusResponse.data
            Write-Host "✅ Статус webhook:" -ForegroundColor Green
            Write-Host "   URL: $($info.url)" -ForegroundColor Cyan
            Write-Host "   Pending updates: $($info.pending_update_count)" -ForegroundColor Cyan
            
            if ($info.last_error_message) {
                Write-Host "   ⚠️  Last error: $($info.last_error_message)" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "⚠️  Не удалось получить статус webhook" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ ngrok не запущен или недоступен" -ForegroundColor Red
    Write-Host "Запустите в отдельном терминале: ngrok http 3000" -ForegroundColor Yellow
    Write-Host "Ошибка: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Готово! Теперь можно тестировать бота в Telegram" -ForegroundColor Green
Write-Host "📱 Откройте бота и отправьте: /start" -ForegroundColor Cyan
Write-Host "🌐 ngrok Web UI: http://127.0.0.1:4040" -ForegroundColor Cyan
