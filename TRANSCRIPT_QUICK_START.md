# 🚀 Быстрый старт: Полный транскрипт видео

## ⚡ Что нужно сделать

### 1. Обновить переменную окружения

Добавьте в `backend/.env`:
```env
BACKEND_URL=http://localhost:3000
```

Для продакшена замените на ваш домен:
```env
BACKEND_URL=https://yourdomain.com
```

### 2. Перезапустить backend

```bash
cd backend
npm run dev
```

При первом запуске автоматически создастся таблица `transcripts`.

### 3. Спарсить видео

**Через UI:**
1. Откройте страницу "Download"
2. Введите Video ID
3. Нажмите "Парсить"
4. Дождитесь статуса "completed"
5. Нажмите кнопку **"Транскрипт"** → скачается `.txt` файл

**Через API:**
```bash
curl -X POST "http://localhost:3000/api/videos/parse" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoId": "dQw4w9WgXcQ"}'
```

### 4. Скачать транскрипт

**Вариант 1: Через UI**
- Кнопка "Транскрипт" в таблице парсинга

**Вариант 2: Прямая ссылка**
```
http://localhost:3000/api/videos/{videoId}/transcript/download
```

**Вариант 3: Через Google Sheets**
- Колонка M содержит кликабельную ссылку

---

## 📊 Где хранится полный текст?

1. **SQLite БД** — `backend/data/trends.db`, таблица `transcripts`
2. **JSON файл** (резервная копия) — `python-workers/{videoId}_parsed.json`
3. **Google Sheets** (превью) — Колонка J (первые 500 символов)

---

## ✅ Проверка работы

### Через Node.js REPL:

```javascript
// Запустить в корне проекта
node

const TranscriptSQLite = (await import('./backend/src/models/TranscriptSQLite.js')).default;

// Получить транскрипт
const transcript = TranscriptSQLite.get('dQw4w9WgXcQ');
console.log(transcript);

// Статистика
const stats = TranscriptSQLite.getStats();
console.log(stats);
```

### Через SQL:

```bash
sqlite3 backend/data/trends.db
```

```sql
-- Список всех транскриптов
SELECT video_id, language, source, text_length FROM transcripts;

-- Подсчет по источникам
SELECT source, COUNT(*) as count FROM transcripts GROUP BY source;

-- Общая статистика
SELECT 
  COUNT(*) as total,
  SUM(text_length) as total_chars,
  AVG(text_length) as avg_chars
FROM transcripts;
```

---

## 🎯 Примеры использования

### 1. Массовое скачивание транскриптов

```bash
#!/bin/bash
# download_all_transcripts.sh

VIDEO_IDS=("abc123" "def456" "ghi789")
TOKEN="your_jwt_token"

for video_id in "${VIDEO_IDS[@]}"; do
  curl -X GET "http://localhost:3000/api/videos/$video_id/transcript/download" \
    -H "Authorization: Bearer $TOKEN" \
    --output "${video_id}_transcript.txt"
  echo "Downloaded: $video_id"
done
```

### 2. Получение JSON с метаданными

```javascript
const response = await fetch('/api/videos/abc123/transcript');
const data = await response.json();

console.log(`Текст: ${data.data.textLength} символов`);
console.log(`Язык: ${data.data.language}`);
console.log(`Источник: ${data.data.source}`);
```

### 3. Проверка наличия транскрипта

```javascript
const TranscriptSQLite = (await import('./backend/src/models/TranscriptSQLite.js')).default;

const hasTranscript = TranscriptSQLite.exists('abc123');
console.log(hasTranscript ? '✅ Есть' : '❌ Нет');
```

---

## 📝 FAQ

**Q: Транскрипт не сохраняется в БД?**  
A: Проверьте логи backend, должна быть строка `💾 Транскрипт сохранен в БД`.

**Q: Ссылка в Google Sheets не работает?**  
A: Убедитесь, что `BACKEND_URL` настроен правильно и backend доступен.

**Q: Кнопка "Транскрипт" не появляется?**  
A: Кнопка отображается только для задач со статусом `completed`.

**Q: Как удалить старые транскрипты?**  
A: 
```javascript
const TranscriptSQLite = (await import('./backend/src/models/TranscriptSQLite.js')).default;
TranscriptSQLite.delete('videoId');
```

**Q: Поддерживаются ли эмодзи и спецсимволы?**  
A: Да, используется UTF-8 encoding для всех текстов.

---

## 🔗 Полная документация

См. [TRANSCRIPT_FULL_TEXT_FEATURE.md](TRANSCRIPT_FULL_TEXT_FEATURE.md)
