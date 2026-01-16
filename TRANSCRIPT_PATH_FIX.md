# 🔧 Исправление: неправильный путь к JSON файлам

## Проблема

```json
{"success":false,"error":"Транскрипт не найден. Сначала запустите парсинг видео."}
```

## Причина

Использовался неправильный путь к JSON файлам:
```javascript
// ❌ НЕПРАВИЛЬНО
const parseDataPath = path.join(process.cwd(), 'python-workers', `${videoId}_parsed.json`);
// process.cwd() возвращает текущую рабочую директорию процесса
// На сервере это может быть /home/user или /
```

## Решение

Использовать абсолютный путь относительно файла роутера:
```javascript
// ✅ ПРАВИЛЬНО
const workersDir = path.resolve(__dirname, '..', '..', '..', 'python-workers');
const parseDataPath = path.join(workersDir, `${videoId}_parsed.json`);
// backend/src/routes -> backend -> root -> python-workers
```

---

## Что исправлено

1. ✅ Добавлен `fileURLToPath` и `__dirname` в routes/videos.js
2. ✅ Исправлен путь в `/transcript/download`
3. ✅ Исправлен путь в `/transcript`
4. ✅ Добавлено логирование пути для отладки

---

## Деплой

```bash
cd backend
git pull
pm2 restart all
pm2 logs yt-zavod-backend --lines 50
```

Ищите в логах:
```
[Transcript Download] Запрос для videoId: NiSuZilaClQ
[Transcript Download] Проверка JSON: /path/to/python-workers/NiSuZilaClQ_parsed.json
[Transcript Download] Файл существует: true
[Transcript Download] Отправка из JSON для NiSuZilaClQ: 12345 символов
```

---

## Проверка

```bash
# 1. Проверить логи при скачивании
pm2 logs yt-zavod-backend --lines 20

# 2. Проверить наличие JSON файла на сервере
ls -la /path/to/YT_combiner/python-workers/*.json

# 3. Тест API
curl "https://elitesphere.ru/api/videos/NiSuZilaClQ/transcript/download"
```

---

**Статус:** ✅ Исправлено
