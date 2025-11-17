# ⚡ ngrok - Быстрая настройка (Windows PowerShell)

## 1. Установка (выберите один вариант)

### Через Chocolatey (рекомендуется)
```powershell
choco install ngrok
```

### Через npm
```powershell
npm install -g ngrok
```

### Вручную
1. Скачать: https://ngrok.com/download
2. Распаковать в `C:\Tools\ngrok\`
3. Добавить в PATH

---

## 2. Добавить authtoken

Возьмите токен здесь: https://dashboard.ngrok.com/get-started/your-authtoken

```powershell
ngrok config add-authtoken ВАШ_ТОКЕН_СЮДА
```

---

## 3. Запустить всё

### Терминал 1: Backend
```powershell
cd D:\Projects\YT_combiner\backend
npm run dev
```

### Терминал 2: ngrok
```powershell
ngrok http 3000
```

**Скопируйте URL** (например: `https://abc123.ngrok-free.app`)

### Терминал 3: Обновить webhook

```powershell
# Отредактируйте backend/.env
# TELEGRAM_WEBHOOK_URL=https://abc123.ngrok-free.app/api/telegram/webhook

# Установите webhook
curl -X POST http://localhost:3000/api/telegram/set-webhook

# Проверьте
curl http://localhost:3000/api/telegram/webhook-info
```

---

## 4. Тестировать

Откройте Telegram → найдите бота → отправьте:
```
/start
/add_channel https://youtube.com/@channel
```

---

## Полезные команды

```powershell
# Запустить ngrok
ngrok http 3000

# Остановить (в терминале ngrok)
Ctrl + C

# Посмотреть запросы
# Откройте браузер: http://127.0.0.1:4040

# Проверить установку
ngrok version

# Проверить конфиг
notepad $env:USERPROFILE\.ngrok2\ngrok.yml
```

---

## При каждом перезапуске ngrok

1. **Запустить ngrok** → получить новый URL
2. **Обновить `.env`** → `TELEGRAM_WEBHOOK_URL=новый_url`
3. **Установить webhook** → `curl -X POST localhost:3000/api/telegram/set-webhook`

---

📖 **Подробная инструкция:** [`NGROK_SETUP.md`](./NGROK_SETUP.md)
