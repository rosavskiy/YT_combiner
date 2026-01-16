# 🎬 Video Rebuild - Быстрый старт

**Статус:** ✅ Фаза 1 MVP готова  
**Дата:** 14 декабря 2025

---

## 🚀 Что уже работает (Фаза 1)

✅ Озвучка видео через ElevenLabs API  
✅ Создание простого видео (озвучка + черный экран)  
✅ Интеграция с AI Tasks системой  
✅ API endpoint для запуска ребилда  

---

## 📋 Предварительные требования

### 1. Установка зависимостей

```bash
cd backend
npm install axios
```

### 2. Получение ElevenLabs API ключа

1. Зарегистрироваться на https://elevenlabs.io/
2. Перейти в Profile → API Keys
3. Создать новый ключ
4. Скопировать

### 3. Конфигурация (.env)

Добавить в `backend/.env`:

```bash
# ElevenLabs TTS
ELEVENLABS_API_KEY=sk_your_api_key_here

# Опционально (если хотите изменить голос по умолчанию)
ELEVENLABS_DEFAULT_VOICE=21m00Tcm4TlvDq8ikWAM  # Rachel (женский)
# Другие популярные голоса:
# - Antoni (мужской): ErXwobaYiN019PkySvjV
# - Elli (женский): MF3mGyEYCl7XYWbV9V6O  
# - Josh (мужской): TxGEqnHWrfWFTfGW9XjX
# - Arnold (мужской): VR6AewLTigWG4xSOukaG

ELEVENLABS_MODEL=eleven_multilingual_v2  # Поддержка 29 языков
```

### 4. Проверка ffmpeg

```bash
ffmpeg -version
```

Если не установлен:
- **Windows:** Скачать с https://ffmpeg.org/download.html
- **Linux:** `sudo apt install ffmpeg`
- **macOS:** `brew install ffmpeg`

---

## 🎯 Как использовать

### Шаг 1: Парсинг видео

Сначала нужно спарсить оригинальное видео чтобы получить транскрипт:

```bash
# Через API
POST /api/videos/parse
{
  "videoId": "dQw4w9WgXcQ"
}
```

Или через UI: Download → вставить ссылку → Парсить

**Результат:** `python-workers/dQw4w9WgXcQ_parsed.json` с полем `full_text`

---

### Шаг 2: Запуск ребилда

```bash
POST /api/generator/ai/generate
{
  "prompt": "rebuild video with voiceover",
  "options": {
    "provider": "rebuild-basic",
    "videoId": "dQw4w9WgXcQ",
    "voiceId": "21m00Tcm4TlvDq8ikWAM",  // Опционально
    "resolution": "1920x1080"           // Опционально
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "ai-1734192000000",
  "status": "pending"  // или "completed" если REDIS_DISABLE=1
}
```

---

### Шаг 3: Проверка статуса

```bash
GET /api/generator/ai/status/:jobId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "ai-1734192000000",
    "status": "completed",
    "result": {
      "filePath": "/path/to/backend/data/ai-outputs/rebuilt_ai-1734192000000.mp4"
    }
  }
}
```

---

### Шаг 4: Скачивание готового видео

```bash
GET /api/generator/ai/download/:jobId
```

Или в браузере: `http://localhost:3000/api/generator/ai/download/ai-1734192000000`

---

## 📊 Пример использования

### 1. Через curl:

```bash
# Запуск ребилда
curl -X POST http://localhost:3000/api/generator/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "rebuild",
    "options": {
      "provider": "rebuild-basic",
      "videoId": "dQw4w9WgXcQ"
    }
  }'

# Проверка статуса
curl http://localhost:3000/api/generator/ai/status/ai-1734192000000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Скачивание
curl http://localhost:3000/api/generator/ai/download/ai-1734192000000 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o rebuilt.mp4
```

---

### 2. Через JavaScript/Axios:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { Authorization: `Bearer ${yourToken}` }
});

// Запуск
const { data } = await api.post('/generator/ai/generate', {
  prompt: 'rebuild',
  options: {
    provider: 'rebuild-basic',
    videoId: 'dQw4w9WgXcQ'
  }
});

console.log('Job ID:', data.jobId);

// Проверка статуса
const status = await api.get(`/generator/ai/status/${data.jobId}`);
console.log('Status:', status.data.data.status);

// Скачивание
const videoUrl = `/generator/ai/download/${data.jobId}`;
window.open(videoUrl, '_blank');
```

---

## 🎨 Доступные голоса

Получить список всех голосов:

```javascript
import ttsService from './backend/src/services/ttsService.js';

const voices = await ttsService.getVoices();
console.log(voices);
```

**Популярные голоса:**

| ID | Имя | Пол | Акцент | Описание |
|----|-----|-----|--------|----------|
| 21m00Tcm4TlvDq8ikWAM | Rachel | Женский | American | Спокойный, новостной |
| ErXwobaYiN019PkySvjV | Antoni | Мужской | American | Глубокий, авторитетный |
| MF3mGyEYCl7XYWbV9V6O | Elli | Женский | American | Дружелюбный, энергичный |
| TxGEqnHWrfWFTfGW9XjX | Josh | Мужской | American | Профессиональный |
| VR6AewLTigWG4xSOukaG | Arnold | Мужской | American | Кинематографичный |

---

## 💰 Стоимость

### ElevenLabs тарифы:

| План | Цена | Символы/месяц | Стоимость за 1000 символов |
|------|------|----------------|----------------------------|
| Free | $0 | 10,000 | $0 |
| Creator | $11 | 100,000 | $0.11 |
| Pro | $99 | 500,000 | $0.198 |
| Scale | $330 | 2,000,000 | $0.165 |

### Расчёт для видео:

- **5-минутное видео:** ~750 слов = ~3,750 символов = **$0.41**
- **10-минутное видео:** ~1,500 слов = ~7,500 символов = **$0.82**
- **30-минутное видео:** ~4,500 слов = ~22,500 символов = **$2.47**

**Free план:** До 10,000 символов/мес (2-3 видео по 10 мин)

---

## 🔍 Troubleshooting

### Ошибка: "ELEVENLABS_API_KEY не установлен"

**Решение:** Добавить ключ в `.env` файл и перезапустить backend

```bash
# В backend/.env
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxx
```

---

### Ошибка: "Parsed data не найден"

**Решение:** Сначала спарсить видео

```bash
POST /api/videos/parse
{ "videoId": "YOUR_VIDEO_ID" }
```

---

### Ошибка: "ffmpeg не установлен"

**Решение:** Установить ffmpeg

```bash
# Windows (через Chocolatey)
choco install ffmpeg

# Linux
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

---

### Ошибка: "ElevenLabs API error: quota_exceeded"

**Решение:** Превышен лимит Free плана (10,000 символов/мес)

Варианты:
1. Подождать до следующего месяца
2. Апгрейд на платный план ($11/мес)
3. Использовать другой аккаунт

---

### Видео создаётся слишком долго

**Причина:** ffmpeg рендерит в реальном времени

**Оптимизация:** Изменить preset в `.env`

```bash
FFMPEG_PRESET=ultrafast  # Быстро, но больше размер файла
# Или
FFMPEG_PRESET=fast       # Баланс
# По умолчанию: medium
```

---

## 📈 Что дальше? (Roadmap)

### Фаза 2: Подбор B-roll (планируется)
- ✅ Интеграция Pexels API (бесплатные видео)
- ✅ Извлечение ключевых слов из текста (NLP)
- ✅ Автоматический подбор релевантных клипов
- ✅ Склейка клипов вместо черного экрана

### Фаза 3: Субтитры (планируется)
- ✅ Генерация SRT из segments
- ✅ Вжигание субтитров в видео
- ✅ Стили субтитров (классические, современные)

### Фаза 4: UI (планируется)
- ✅ Страница Rebuild в фронтенде
- ✅ Выбор видео из списка
- ✅ Настройки голоса, стиля
- ✅ Мониторинг прогресса в реальном времени

---

## 📞 Поддержка

**Вопросы/Баги:** Создать issue в репозитории  
**Документация API:** [VIDEO_REBUILD_PLAN.md](./VIDEO_REBUILD_PLAN.md)  
**Исследование рынка:** [VIDEO_REBUILD_RESEARCH.md](./VIDEO_REBUILD_RESEARCH.md)

---

**Готово к использованию! 🚀**

Следующий шаг: Протестировать на реальном видео.
