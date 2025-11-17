# YT Zavod - Генератор видеоконтента

Система для отслеживания трендовых видео в 19 странах, автоматического скачивания, парсинга и генерации похожего контента. Включает Telegram бота для управления каналами и Whisper AI для транскрибации.

## 📚 Документация

**🚨 НАЧНИТЕ ОТСЮДА:**
- ✨ [`AUTOMATION_COMPLETE.md`](./AUTOMATION_COMPLETE.md) - ⭐ **ВСЁ, ЧТО РЕАЛИЗОВАНО**
- 🚀 [`START_HERE.md`](./START_HERE.md) - Первые шаги
- 📖 [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) - Полное описание системы

**Автоматизация (новое!):**
- 🔄 [`TELEGRAM_EXISTING_BOT.md`](./TELEGRAM_EXISTING_BOT.md) - ⭐ **Используйте существующий бот!**
- ⚡ [`TELEGRAM_QUICK_START.md`](./TELEGRAM_QUICK_START.md) - Telegram бот за 5 минут
- 🤖 [`TELEGRAM_BOT_SETUP.md`](./TELEGRAM_BOT_SETUP.md) - Полная настройка бота
- 🌐 [`NGROK_SETUP.md`](./NGROK_SETUP.md) - Настройка ngrok для локальной разработки
- 🔄 [`AUTOMATION_GUIDE.md`](./AUTOMATION_GUIDE.md) - Гайд по автоматизации
- ✅ [`AUTOMATION_CHECKLIST.md`](./AUTOMATION_CHECKLIST.md) - Чек-лист настройки

**Развертывание:**
- 🚀 [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Полный гайд по деплою
- ⚡ [`DEPLOYMENT_QUICK.md`](./DEPLOYMENT_QUICK.md) - Быстрый деплой

**Дополнительно:**
- 🔑 [`AUTH_README.md`](./AUTH_README.md) - Система авторизации
- 🗄️ [`SQLITE_MIGRATION.md`](./SQLITE_MIGRATION.md) - Миграция на SQLite
- 🎯 [`TOPICS_FEATURE.md`](./TOPICS_FEATURE.md) - Работа с темами

## Технологический стек

### Backend
- Node.js + Express
- Bull (очереди задач)
- Socket.IO (real-time обновления)
- **SQLite** (хранение данных) 📦
  - Нулевая конфигурация
  - Файловая база данных
  - Не требует установки сервера

### Frontend
- React 18
- Vite
- Ant Design
- React Query
- Zustand (state management)
- Socket.IO Client

### Python Workers
- yt-dlp (скачивание видео)
- Whisper (распознавание речи)
- MoviePy (обработка видео)
- gTTS (генерация голоса)

## Структура проекта

```
YT_combiner/
├── backend/              # Node.js сервер
├── frontend/             # React приложение
└── python-workers/       # Python микросервисы
```

## Установка

### 1. Backend
```bash
cd backend
npm install
```

### 2. Frontend
```bash
cd frontend
npm install
```

### 3. Python Workers
```bash
cd python-workers
pip install -r requirements.txt
```

## Настройка

1. Создайте файл `.env` в корне проекта (используйте `.env.example` как шаблон)
2. Получите YouTube API ключ в [Google Cloud Console](https://console.cloud.google.com/)
3. Установите и запустите Redis
4. Установите и запустите MongoDB

## Запуск

### Development режим

```bash
# Backend (терминал 1)
cd backend
npm run dev

# Frontend (терминал 2)
cd frontend
npm run dev

# Redis (терминал 3)
redis-server
```

Откройте http://localhost:5173

## Поддерживаемые страны

🇺🇸 США • 🇨🇦 Канада • 🇫🇮 Финляндия • 🇸🇪 Швеция • 🇨🇭 Швейцария • 🇳🇴 Норвегия • 🇩🇪 Германия • 🇬🇧 Англия • 🇫🇷 Франция • 🇧🇪 Бельгия • 🇳🇱 Нидерланды • 🇮🇪 Ирландия • 🇩🇰 Дания • 🇦🇹 Австрия • 🇦🇺 Австралия • 🇳🇿 Новая Зеландия • 🇮🇱 Израиль • 🇸🇬 Сингапур • 🇮🇸 Исландия

## Функционал

- ✅ Мониторинг трендов YouTube в 19 странах
- ✅ Скачивание видео
- ✅ Анализ контента
- ✅ Генерация видео с переводом
- ✅ Real-time обновления прогресса
- ✅ Управление из единого интерфейса

## Лицензия

MIT
