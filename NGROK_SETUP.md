# 🌐 Настройка ngrok для локальной разработки

## Что такое ngrok?

**ngrok** создаёт публичный HTTPS туннель к вашему локальному серверу. Это необходимо для:
- ✅ Telegram webhook (требует HTTPS)
- ✅ Тестирования бота на локальной машине
- ✅ Демонстрации проекта без деплоя

---

## 📥 Установка ngrok на Windows

### Вариант 1: Через Chocolatey (рекомендуется)

Если у вас установлен Chocolatey:

```powershell
choco install ngrok
```

### Вариант 2: Скачать вручную

1. Скачайте ngrok: https://ngrok.com/download
2. Распакуйте `ngrok.exe` в удобную папку, например:
   ```
   C:\Tools\ngrok\ngrok.exe
   ```
3. Добавьте путь в PATH (опционально):
   - Win + X → Система → Дополнительные параметры системы
   - Переменные среды → Path → Изменить → Добавить: `C:\Tools\ngrok`

### Вариант 3: Через npm (если не нужен в PATH)

```powershell
npm install -g ngrok
```

---

## 🔑 Настройка authtoken

После регистрации на ngrok.com у вас есть authtoken.

### Найти токен:

1. Откройте: https://dashboard.ngrok.com/get-started/your-authtoken
2. Скопируйте **полный токен** (длинная строка, примерно 50+ символов)

⚠️ **Важно:** Токен должен выглядеть примерно так:
```
2abcdefGHIJKLmnopQRSTuvwXYZ1234567890_ABCDEFGHijklmnopQRSTUVwxyz123456
```

**НЕ копируйте** короткие строки типа `35bhpfhg8o1pk8bjvr_5zsttm1xwnafah` — это не authtoken!

### Добавить токен:

```powershell
ngrok config add-authtoken ВАШ_ПОЛНЫЙ_ТОКЕН
```

Например:
```powershell
ngrok config add-authtoken 2abcdefGHIJKLmnopQRSTuvwXYZ1234567890_ABCDEFGHijklmnopQRSTUVwxyz123456
```

Токен сохранится в файл `%USERPROFILE%\.ngrok2\ngrok.yml`

---

## 🚀 Запуск ngrok

### 1. Запустите ваш backend сервер

В первом терминале:

```powershell
cd D:\Projects\YT_combiner\backend
npm run dev
```

Убедитесь, что сервер запущен на порту **3000** (по умолчанию).

### 2. Запустите ngrok

Во втором терминале (PowerShell):

```powershell
ngrok http 3000
```

Или с кастомным доменом (если есть платная подписка):

```powershell
ngrok http 3000 --domain=ваш-домен.ngrok-free.app
```

### 3. Вы увидите:

```
ngrok                                                                  
                                                                       
Session Status                online                                   
Account                       ваш_email@example.com (Plan: Free)      
Version                       3.5.0                                    
Region                        United States (us)                       
Latency                       45ms                                     
Web Interface                 http://127.0.0.1:4040                   
Forwarding                    https://abc123def456.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Запомните URL:** `https://abc123def456.ngrok-free.app`

---

## ⚙️ Настройка проекта

### 1. Добавьте ngrok URL в backend/.env

```env
# Замените на ваш ngrok URL
TELEGRAM_WEBHOOK_URL=https://abc123def456.ngrok-free.app/api/telegram/webhook

# Остальные настройки
TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather
PORT=3000
```

### 2. Установите webhook

В третьем терминале:

```powershell
curl -X POST http://localhost:3000/api/telegram/set-webhook
```

Или проверьте вручную:

```powershell
$token = "ваш_токен_от_botfather"
$url = "https://abc123def456.ngrok-free.app/api/telegram/webhook"

Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -Body @{url=$url} -ContentType "application/json"
```

### 3. Проверьте webhook

```powershell
curl http://localhost:3000/api/telegram/webhook-info
```

Должен вернуть:

```json
{
  "success": true,
  "data": {
    "url": "https://abc123def456.ngrok-free.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0
  }
}
```

---

## 🧪 Тестирование

### 1. Откройте Telegram

Найдите вашего бота: `@yt_zavod_auth_bot`

### 2. Отправьте команды

```
/start
/help
/add_channel https://www.youtube.com/@channel
/list_channels
```

### 3. Смотрите логи в реальном времени

**Backend логи** (терминал 1):
```
Backend сервер запущен и ждёт запросов...
```

**ngrok Web Interface** (браузер):
- Откройте: http://127.0.0.1:4040
- Здесь видны все HTTP запросы в реальном времени
- Можно посмотреть тело запроса, заголовки, ответы

---

## 🔧 Полезные команды ngrok

### Базовые

```powershell
# Запустить туннель на порт 3000
ngrok http 3000

# Запустить с кастомным поддоменом (требуется аккаунт)
ngrok http 3000 --subdomain=myapp

# Запустить с базовой аутентификацией
ngrok http 3000 --auth="username:password"

# Запустить несколько туннелей
ngrok http 3000 --region=eu
```

### Просмотр статуса

```powershell
# Веб-интерфейс (открывается автоматически)
# http://127.0.0.1:4040

# Проверить статус через API
Invoke-RestMethod http://127.0.0.1:4040/api/tunnels
```

### Остановить ngrok

Просто нажмите **Ctrl+C** в терминале с ngrok.

---

## 🎯 Рабочий процесс разработки

### Запуск всего проекта с ngrok:

1. **Терминал 1 (Backend):**
   ```powershell
   cd D:\Projects\YT_combiner\backend
   npm run dev
   ```

2. **Терминал 2 (Frontend):**
   ```powershell
   cd D:\Projects\YT_combiner\frontend
   npm run dev
   ```

3. **Терминал 3 (ngrok):**
   ```powershell
   ngrok http 3000
   ```

4. **Обновить .env с новым URL:**
   ```env
   TELEGRAM_WEBHOOK_URL=https://новый-url.ngrok-free.app/api/telegram/webhook
   ```

5. **Установить webhook:**
   ```powershell
   curl -X POST http://localhost:3000/api/telegram/set-webhook
   ```

6. **Тестировать в Telegram!**

---

## 🔒 Безопасность

### ⚠️ Важно:

1. **Не коммитьте ngrok URL в git** — он меняется при каждом запуске (на бесплатном плане)
2. **Не делитесь ngrok URL публично** — это прямой доступ к вашему локальному серверу
3. **Закрывайте ngrok после тестирования** — не оставляйте туннель открытым

### Проверка IP Telegram

Для дополнительной безопасности можно проверять IP Telegram серверов:

```javascript
// backend/src/routes/telegram.js
const TELEGRAM_IPS = [
  '149.154.160.0/20',
  '91.108.4.0/22'
];

function isFromTelegram(ip) {
  // Проверка IP (опционально)
  return true;
}
```

---

## 📊 ngrok Web Interface (http://127.0.0.1:4040)

### Возможности:

1. **Inspect** — Просмотр всех HTTP запросов
   - Request headers
   - Request body
   - Response
   - Timing

2. **Replay** — Повторить любой запрос
   - Удобно для отладки
   - Можно изменить данные перед отправкой

3. **Status** — Информация о туннеле
   - URL
   - Статистика
   - Региональность

---

## ❓ Troubleshooting

### Проблема: "command not found: ngrok"

**Решение:**
```powershell
# Проверьте установку
where.exe ngrok

# Переустановите через Chocolatey
choco install ngrok

# Или используйте полный путь
C:\Tools\ngrok\ngrok.exe http 3000
```

### Проблема: "ERR_NGROK_108 - Invalid credentials"

**Решение:**
```powershell
# Добавьте authtoken заново
ngrok config add-authtoken ВАШ_ТОКЕН

# Проверьте конфиг
notepad %USERPROFILE%\.ngrok2\ngrok.yml
```

### Проблема: "Failed to connect to ngrok"

**Решение:**
```powershell
# Проверьте, запущен ли backend
curl http://localhost:3000/api/health

# Перезапустите ngrok
# Ctrl+C → ngrok http 3000
```

### Проблема: Webhook не работает

**Решение:**
```powershell
# 1. Проверьте ngrok URL
curl http://127.0.0.1:4040/api/tunnels

# 2. Обновите webhook
curl -X POST http://localhost:3000/api/telegram/set-webhook

# 3. Проверьте статус
curl http://localhost:3000/api/telegram/webhook-info

# 4. Проверьте логи backend
# Смотрите терминал с backend
```

### Проблема: ngrok URL меняется каждый раз

**Решение:**
- Бесплатный план: URL всегда новый при перезапуске
- Платный план ($8/месяц): можно зарезервировать статический домен
- Альтернатива: локальная разработка без webhook (polling)

---

## 💡 Альтернативы ngrok

Если ngrok не подходит:

### 1. localtunnel
```powershell
npm install -g localtunnel
lt --port 3000
```

### 2. serveo (через SSH)
```powershell
ssh -R 80:localhost:3000 serveo.net
```

### 3. cloudflared (Cloudflare Tunnel)
```powershell
cloudflared tunnel --url http://localhost:3000
```

---

## 🎓 Полезные ресурсы

- **ngrok Dashboard:** https://dashboard.ngrok.com/
- **ngrok Documentation:** https://ngrok.com/docs
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Webhook Guide:** https://core.telegram.org/bots/webhooks

---

## ✅ Чек-лист готовности

- [ ] ngrok установлен
- [ ] authtoken добавлен
- [ ] Backend запущен (порт 3000)
- [ ] ngrok запущен: `ngrok http 3000`
- [ ] ngrok URL скопирован
- [ ] `TELEGRAM_WEBHOOK_URL` обновлен в `.env`
- [ ] Webhook установлен: `curl -X POST localhost:3000/api/telegram/set-webhook`
- [ ] Webhook проверен: `curl localhost:3000/api/telegram/webhook-info`
- [ ] Бот отвечает на `/start` в Telegram
- [ ] ngrok Web Interface открыт: http://127.0.0.1:4040

---

## 🎉 Готово!

Теперь вы можете:
- ✅ Разрабатывать локально
- ✅ Тестировать Telegram webhook
- ✅ Отлаживать запросы в ngrok UI
- ✅ Демонстрировать проект коллегам

**Happy coding!** 🚀
