$token = "8264375765:AAGQdX_UPuHF7_76N_8ZGQZ_upd1Vea2adM"
$webhookUrl = "https://acrogynous-vennie-gossipingly.ngrok-free.dev/api/telegram/webhook"
$result = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -Body (@{url=$webhookUrl} | ConvertTo-Json) -ContentType "application/json"
Write-Host "Webhook установлен!" -ForegroundColor Green
$result
$info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
$info.result