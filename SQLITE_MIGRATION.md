# 🗄️ Миграция на SQLite

## ✅ Что изменилось

Система перешла с **MongoDB** на **SQLite** для упрощения развертывания и использования.

## 🎯 Преимущества SQLite

### 1. **Нулевая конфигурация**
- ❌ MongoDB: требует установки сервера, настройки, запуска демона
- ✅ SQLite: одна библиотека npm, файл базы данных создается автоматически

### 2. **Файловая база данных**
- База данных хранится в одном файле: `backend/data/trends.db`
- Легко копировать, резервировать, переносить
- Нет сетевых подключений, портов, аутентификации

### 3. **Производительность**
- Для локальной разработки и MVP — быстрее MongoDB
- Нет overhead на сетевые вызовы
- Встроенная поддержка JSON
- WAL режим для конкурентного доступа

### 4. **Простота**
- Не нужен отдельный процесс базы данных
- Не требует Docker или установки ПО
- Работает из коробки на Windows/Mac/Linux

## 📁 Структура базы данных

### Таблица `trends`
```sql
CREATE TABLE trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,              -- JSON массив трендов
  total_videos INTEGER,
  countries TEXT,                   -- JSON массив стран
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Таблица `videos`
```sql
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  channel_title TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  region TEXT,
  language TEXT,
  downloaded BOOLEAN DEFAULT 0,
  download_path TEXT,
  transcript_available BOOLEAN DEFAULT 0,
  data TEXT,                        -- Полные данные в JSON
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  downloaded_at DATETIME
);
```

## 🔄 Изменения в коде

### 1. Установка пакета
```bash
npm install better-sqlite3
```

### 2. Конфигурация
**Файл:** `backend/src/config/sqlite.js`
- Инициализация базы данных
- Создание таблиц
- Включение WAL режима (Write-Ahead Logging)
- Индексы для быстрого поиска

### 3. Модели
**TrendSQLite** (`backend/src/models/TrendSQLite.js`):
- `create(data)` - сохранить тренды
- `findLatest()` - получить последние
- `findHistory(limit, offset)` - история с пагинацией
- `count()` - количество записей
- `findById(id)` - поиск по ID

**VideoSQLite** (`backend/src/models/VideoSQLite.js`):
- `upsert(videoData)` - добавить/обновить видео
- `findByVideoId(videoId)` - найти по ID YouTube
- `findDownloaded()` - список скачанных
- `markAsDownloaded(videoId, path)` - отметить как скачанное
- `getStats()` - статистика

### 4. Роуты обновлены
**Файл:** `backend/src/routes/trends.js`
- Убраны все `await` для MongoDB
- Заменены вызовы Mongoose на TrendSQLite
- Синхронные операции (SQLite быстрее)

### 5. Подключение в server.js
```javascript
import { initDatabase } from './config/sqlite.js';

// Инициализация SQLite
initDatabase();
```

## 🚀 Как использовать

### Запуск
```bash
cd backend
npm run dev
```

База данных создается автоматически при первом запуске!

### Проверка
```bash
# Посмотреть созданный файл
ls backend/data/trends.db

# SQLite CLI (если установлен)
sqlite3 backend/data/trends.db
> .tables
> SELECT COUNT(*) FROM trends;
```

## 📊 API остался прежним

Все эндпоинты работают как раньше:

```javascript
// Получить последние тренды
GET /api/trends/latest

// История
GET /api/trends/history?page=1&limit=10

// По ID
GET /api/trends/:id

// Загрузить новые
POST /api/trends/fetch-all
```

## 🔧 Отладка

### Посмотреть структуру БД
```javascript
import Database from 'better-sqlite3';
const db = new Database('./backend/data/trends.db');
console.log(db.prepare('PRAGMA table_info(trends)').all());
```

### Ручной SQL запрос
```javascript
const stmt = db.prepare('SELECT * FROM trends ORDER BY created_at DESC LIMIT 1');
console.log(stmt.get());
```

## 🎁 Бонусы

### 1. JSON поддержка
SQLite хранит сложные объекты как JSON:
```javascript
const trend = {
  data: [/* массив видео */],
  countries: ['US', 'CA', 'DE'],
  totalVideos: 950
};
TrendModel.create(trend); // Автоматически сериализует JSON
```

### 2. Транзакции
```javascript
const db = getDatabase();
const insert = db.transaction((videos) => {
  for (const video of videos) {
    VideoSQLite.upsert(video);
  }
});
insert(arrayOfVideos); // Атомарная операция
```

### 3. Резервное копирование
```bash
# Простое копирование файла
cp backend/data/trends.db backend/data/trends.backup.db
```

## ⚠️ Ограничения SQLite

1. **Нет репликации** (не проблема для локального MVP)
2. **Один писатель** (WAL решает проблему чтения)
3. **Размер БД** до ~281TB (более чем достаточно)

## 🔮 Будущие улучшения

Если проект масштабируется:
- Миграция на PostgreSQL для мультипользовательского доступа
- Добавление Redis для кэширования
- Sharding по регионам

Но для текущего прототипа **SQLite идеален**! 🎯

## 📖 Полезные ссылки

- [SQLite документация](https://www.sqlite.org/docs.html)
- [better-sqlite3 на npm](https://github.com/WiseLibs/better-sqlite3)
- [SQLite JSON функции](https://www.sqlite.org/json1.html)
