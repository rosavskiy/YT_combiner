# 🤖 Гайд по автоматизации YT Zavod

Полное руководство по настройке автоматизации работы с YouTube каналами и видео через n8n, Telegram бота и Whisper AI.

---

## 📋 Содержание

1. [Обзор возможностей](#обзор-возможностей)
2. [Telegram бот для управления каналами](#telegram-бот)
3. [Автоматическая транскрибация через Whisper](#whisper-транскрибация)
4. [Интеграция с n8n](#интеграция-с-n8n)
5. [API для автоматизации](#api-для-автоматизации)
6. [Примеры сценариев](#примеры-сценариев)

---

## 🎯 Обзор возможностей

### Что автоматизировано:

✅ **Управление каналами через Telegram**
- Добавление/удаление каналов командами бота
- Просмотр списка отслеживаемых каналов
- Без необходимости открывать веб-интерфейс

✅ **Автоматическая транскрибация видео**
- Whisper AI (локально или через OpenAI API)
- Fallback на YouTube субтитры
- Поддержка множества языков

✅ **Автоматический парсинг после скачивания**
- Извлечение таймкодов из chapters
- Получение транскрипта/субтитров
- Сохранение в Google Sheets (опционально)

✅ **Уведомления через n8n webhook**
- Событие при завершении парсинга
- Автоматическая отправка результатов
- Интеграция с другими системами

✅ **Мониторинг новых видео**
- Автоматическая проверка каналов по расписанию
- Скачивание и парсинг новых видео
- Уведомления в Telegram

---

## 🤖 Telegram бот

### Настройка

#### 1. Установка webhook для бота

**Вариант A: Через YT Zavod API (рекомендуется)**

```bash
# Получите JWT токен (войдите в веб-интерфейс и скопируйте из localStorage)
# Или используйте логин/пароль:
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"your_password"}'

# Установите webhook (только для администратора)
curl -X POST http://localhost:3000/api/telegram/set-webhook \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-backend-url.com/api/telegram/webhook"}'
```

**Вариант B: Напрямую через Telegram API**

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://your-backend-url.com/api/telegram/webhook"
```

#### 2. Проверка webhook

```bash
curl -X GET http://localhost:3000/api/telegram/webhook-info \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Ответ:
```json
{
  "success": true,
  "data": {
    "url": "https://your-backend-url.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Использование

#### Команды бота:

**`/start`** - Приветствие и список команд
```
/start
```

**`/add_channel <URL>`** - Добавить канал в отслеживание
```
/add_channel https://youtube.com/@channel
/add_channel https://youtube.com/c/ChannelName
/add_channel UCxxxxxxxxxxxxxxxxxxxxxx
```

**`/list_channels`** - Показать все отслеживаемые каналы
```
/list_channels
```

**`/remove_channel <ID>`** - Удалить канал из отслеживания
```
/remove_channel UCxxxxxxxxxxxxxxxxxxxxxx
```

**`/help`** - Справка по командам
```
/help
```

### Права доступа

- Бот работает только для зарегистрированных пользователей системы
- Новые пользователи требуют подтверждения администратором
- Каждый пользователь видит только свои каналы
- Администраторы видят все каналы

---

## 🎤 Whisper транскрибация

### Настройка

#### Вариант A: OpenAI Whisper API (рекомендуется)

**Преимущества:**
- ✅ Не требует GPU
- ✅ Высокая скорость
- ✅ Отличное качество
- ✅ Поддержка всех языков

**Настройка:**

1. Получите API ключ: https://platform.openai.com/api-keys
2. Добавьте в `.env`:
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
ENABLE_ASR_IF_NO_CAPTIONS=1
```

**Стоимость:**
- ~$0.006 за минуту аудио
- Видео 10 минут ≈ $0.06
- 1000 видео по 10 мин ≈ $60

#### Вариант B: Локальный Whisper

**Преимущества:**
- ✅ Бесплатно
- ✅ Работает офлайн
- ✅ Полный контроль

**Требования:**
- Python 3.8+
- ffmpeg
- PyTorch (с CUDA для GPU или CPU версия)
- ~1-10 GB памяти (зависит от модели)

**Установка:**

```bash
cd python-workers

# Установите ffmpeg
# Windows: choco install ffmpeg
# Linux: sudo apt install ffmpeg
# macOS: brew install ffmpeg

# Установите Whisper
pip install openai-whisper

# GPU версия (если есть NVIDIA GPU)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# CPU версия (медленнее)
pip install torch torchvision torchaudio
```

**Настройка в `.env`:**
```bash
# Отключите OpenAI API (закомментируйте или удалите OPENAI_API_KEY)
# OPENAI_API_KEY=

# Включите локальный Whisper
ENABLE_ASR_IF_NO_CAPTIONS=1
```

**Модели Whisper:**

| Модель | Размер | Скорость | Качество | Память |
|--------|--------|----------|----------|--------|
| tiny   | 39 MB  | 32x      | ⭐⭐     | ~1 GB  |
| base   | 74 MB  | 16x      | ⭐⭐⭐   | ~1 GB  |
| small  | 244 MB | 6x       | ⭐⭐⭐⭐ | ~2 GB  |
| medium | 769 MB | 2x       | ⭐⭐⭐⭐ | ~5 GB  |
| large  | 1550 MB| 1x       | ⭐⭐⭐⭐⭐| ~10 GB |

### Использование

#### Автоматическая транскрибация

При парсинге видео система автоматически:

1. Пытается получить YouTube субтитры
2. Если субтитров нет и `ENABLE_ASR_IF_NO_CAPTIONS=1`:
   - Использует OpenAI API (если есть `OPENAI_API_KEY`)
   - Или локальный Whisper (если установлен)
3. Сохраняет результат в JSON файл

#### Ручная транскрибация

```bash
cd python-workers

# Через OpenAI API
OPENAI_API_KEY=sk-xxx python video_parser.py VIDEO_ID --languages en ru

# Локальный Whisper (модель base)
python video_parser.py VIDEO_ID --whisper-model base --languages en

# Локальный Whisper (модель medium, лучшее качество)
python video_parser.py VIDEO_ID --whisper-model medium
```

### Результат транскрибации

```json
{
  "transcript": {
    "language": "en",
    "type": "whisper_api",
    "source": "openai_whisper_api",
    "segments": [
      {
        "start": 0.0,
        "duration": 5.2,
        "text": "Welcome to this tutorial on YouTube automation"
      },
      {
        "start": 5.2,
        "duration": 4.8,
        "text": "Today we'll learn how to parse videos"
      }
    ]
  },
  "full_text": "Welcome to this tutorial on YouTube automation. Today we'll learn how to parse videos..."
}
```

---

## 🔄 Интеграция с n8n

### Установка n8n

**Docker (рекомендуется):**

```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=your_password \
  -e WEBHOOK_URL=https://your-n8n-domain.com/ \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

**npm:**

```bash
npm install -g n8n
n8n start
```

### Импорт workflows

1. Откройте n8n: `http://localhost:5678`
2. Войдите (admin / your_password)
3. Импортируйте workflows из `n8n-workflows/`:
   - `telegram-add-channel.json`
   - `video-auto-parse.json`
   - `monitor-channels.json`

Подробная инструкция: [`n8n-workflows/README.md`](./n8n-workflows/README.md)

### Настройка переменных

В n8n добавьте Environment Variables:

```bash
BACKEND_URL=https://your-backend-url.com
TELEGRAM_ADMIN_CHAT_ID=123456789
```

### Настройка Credentials

#### 1. YT Zavod API Token

**Settings → Credentials → New → HTTP Header Auth**

- Name: `YT Zavod API Token`
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_JWT_TOKEN`

**Получение JWT токена:**

```bash
# Через API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"your_password"}'

# Ответ:
# {"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

Или скопируйте из localStorage в браузере после авторизации.

#### 2. Telegram Bot

**Settings → Credentials → New → Telegram**

- Name: `Telegram Bot`
- Access Token: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

---

## 🔌 API для автоматизации

### Telegram Webhook

#### POST `/api/telegram/webhook`

Прием сообщений от Telegram бота.

**Request:**
```json
{
  "update_id": 123456,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "first_name": "John"
    },
    "chat": {
      "id": 123456789
    },
    "text": "/add_channel https://youtube.com/@channel"
  }
}
```

**Response:**
```json
{
  "ok": true
}
```

#### POST `/api/telegram/set-webhook`

Установить webhook URL для бота (только администратор).

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request:**
```json
{
  "url": "https://your-backend-url.com/api/telegram/webhook"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook установлен",
  "data": {
    "ok": true,
    "result": true,
    "description": "Webhook was set"
  }
}
```

### Video Transcript

#### GET `/api/videos/:videoId/transcript`

Получить транскрипт видео.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "title": "Video Title",
    "fullText": "Full transcript text...",
    "transcript": {
      "language": "en",
      "type": "whisper_api",
      "segments": [...]
    },
    "chapters": [
      {
        "start_time": 0,
        "title": "Introduction"
      }
    ],
    "parsed": true
  }
}
```

### n8n Webhook

#### POST `/api/videos/webhook/n8n`

Прием уведомлений от системы о завершении парсинга.

**Request:**
```json
{
  "event": "video-parsed",
  "videoId": "dQw4w9WgXcQ",
  "status": "completed",
  "result": {
    "transcript": {...},
    "chapters": [...],
    "full_text": "..."
  },
  "timestamp": "2025-11-17T12:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "received": true
}
```

### Channels API

#### GET `/api/channels/activities`

Получить последние видео с отслеживаемых каналов.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `limit` - количество видео (по умолчанию 10, макс 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "videoId": "abc123",
      "title": "New Video",
      "channelTitle": "Channel Name",
      "channelId": "UCxxxx",
      "publishedAt": "2025-11-17T10:00:00Z",
      "views": 12345,
      "likes": 567
    }
  ]
}
```

---

## 💡 Примеры сценариев

### Сценарий 1: Полная автоматизация

**Цель:** Автоматически отслеживать конкурентов, скачивать и анализировать их видео.

**Шаги:**

1. **Добавьте каналы через Telegram:**
   ```
   /add_channel https://youtube.com/@competitor1
   /add_channel https://youtube.com/@competitor2
   /add_channel https://youtube.com/@competitor3
   ```

2. **Активируйте workflow "Monitor Channels"** в n8n:
   - Проверка каждые 6 часов
   - Автоматическое скачивание новых видео
   - Автоматический парсинг

3. **Активируйте workflow "Video Auto Parse"**:
   - Получение уведомлений о готовности
   - Отправка в Telegram
   - Сохранение в Google Sheets (опционально)

4. **Настройте переменные:**
```bash
AUTO_PARSE_AFTER_DOWNLOAD=true
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/video-parsed
OPENAI_API_KEY=sk-xxx
ENABLE_ASR_IF_NO_CAPTIONS=1
```

**Результат:** Полностью автоматическая система мониторинга и анализа.

---

### Сценарий 2: Еженедельный отчет

**Цель:** Получать еженедельный отчет по всем новым видео.

**n8n Workflow:**

```
Schedule (каждый понедельник 9:00)
  ↓
Get Activities (за последние 7 дней)
  ↓
Filter Videos (только с >1000 просмотров)
  ↓
Create Report (список + статистика)
  ↓
Send to Email/Telegram
```

**Код фильтра:**
```javascript
const activities = $input.item.json.data || [];
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

return activities
  .filter(v => {
    const publishedDate = new Date(v.publishedAt);
    const views = v.views || 0;
    return publishedDate > weekAgo && views > 1000;
  })
  .map(v => ({ json: v }));
```

---

### Сценарий 3: AI анализ контента

**Цель:** Автоматически анализировать транскрипты через ChatGPT.

**n8n Workflow:**

```
Webhook (video-parsed)
  ↓
Get Transcript
  ↓
OpenAI (ChatGPT): "Проанализируй этот транскрипт и выдели ключевые темы"
  ↓
Save to Notion/Airtable
  ↓
Notify Telegram
```

**Пример промпта для ChatGPT:**
```
Проанализируй следующий транскрипт YouTube видео и выдели:
1. 5 ключевых тем
2. Основные идеи
3. Цитаты для публикации в соцсетях

Транскрипт:
{{$json.fullText}}
```

---

### Сценарий 4: Автоматическая публикация

**Цель:** Публиковать лучшие цитаты из видео в Twitter/VK.

**n8n Workflow:**

```
Schedule (каждые 4 часа)
  ↓
Get Random Transcript (с транскриптом)
  ↓
OpenAI: "Выбери лучшую цитату из видео"
  ↓
Post to Twitter/VK
  ↓
Log to Database
```

---

## 🔧 Переменные окружения

### Backend (.env)

```bash
# API
YOUTUBE_API_KEY=xxx
OPENAI_API_KEY=xxx

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_BOT_USERNAME=xxx

# Автоматизация
AUTO_PARSE_AFTER_DOWNLOAD=true
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/video-parsed
ENABLE_ASR_IF_NO_CAPTIONS=1

# Redis (для очередей)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### n8n Environment

```bash
BACKEND_URL=https://your-backend.com
TELEGRAM_ADMIN_CHAT_ID=123456789
```

---

## 🐛 Troubleshooting

### Telegram бот не отвечает

**Проблема:** Бот не реагирует на команды

**Решения:**
1. Проверьте webhook: `GET /api/telegram/webhook-info`
2. Проверьте, что webhook URL доступен извне
3. Убедитесь, что пользователь зарегистрирован и подтвержден
4. Проверьте логи backend: `npm run dev`

### Whisper ошибка

**Проблема:** `[WARN] Библиотека openai-whisper не установлена`

**Решения:**
1. Установите OpenAI API ключ (быстрое решение)
2. Или установите локальный Whisper:
   ```bash
   pip install openai-whisper torch
   ```

### n8n webhook не срабатывает

**Проблема:** Backend не получает уведомления

**Решения:**
1. Проверьте `N8N_WEBHOOK_URL` в `.env`
2. Используйте Production URL, не Test URL
3. Проверьте, что n8n доступен извне
4. Проверьте логи n8n: Executions

### Автопарсинг не запускается

**Проблема:** Видео скачивается, но не парсится

**Решения:**
1. Проверьте `AUTO_PARSE_AFTER_DOWNLOAD=true` в `.env`
2. Проверьте, что Redis работает
3. Проверьте очереди: `GET /api/videos/queue?queueType=parse`
4. Проверьте логи backend

---

## 📚 Дополнительные ресурсы

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community](https://community.n8n.io/)
- [OpenAI Whisper](https://platform.openai.com/docs/guides/speech-to-text)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [YT Zavod n8n Workflows](./n8n-workflows/README.md)

---

**Успешной автоматизации! 🚀**
