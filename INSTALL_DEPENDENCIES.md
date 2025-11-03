# Установка зависимостей для скачивания и парсинга видео

## 📦 Что нужно установить

1. **Redis** - для очередей Bull (управление задачами скачивания)
2. **Python 3.9+** - для работы yt-dlp и парсинга
3. **Python пакеты** - yt-dlp, youtube-transcript-api, Google Sheets API

---

## 🪟 Windows

### Установка Redis

**Вариант 1: С помощью Memurai (рекомендуется для Windows)**

1. Скачайте [Memurai](https://www.memurai.com/get-memurai) (бесплатная версия Redis для Windows)
2. Установите, следуя инструкциям
3. Redis будет автоматически запускаться как служба Windows

**Вариант 2: Redis через WSL2**

```powershell
# Установить WSL2
wsl --install

# Открыть Ubuntu
wsl

# В WSL установить Redis
sudo apt update
sudo apt install redis-server

# Запустить Redis
sudo service redis-server start

# Проверить
redis-cli ping
# Должно вывести: PONG
```

**Вариант 3: Docker**

```powershell
# Установить Docker Desktop for Windows
# Скачать с https://www.docker.com/products/docker-desktop

# Запустить Redis контейнер
docker run -d -p 6379:6379 --name redis redis:alpine

# Проверить
docker exec -it redis redis-cli ping
```

### Установка Python 3.9+

1. Скачайте [Python 3.11](https://www.python.org/downloads/) (или новее)
2. **ВАЖНО**: При установке поставьте галочку "Add Python to PATH"
3. Проверьте установку:

```powershell
python --version
# Должно вывести: Python 3.11.x
```

### Установка Python пакетов

```powershell
cd D:\Projects\YT_combiner\python-workers
pip install -r requirements.txt
```

Если установка долгая, можно установить по отдельности:

```powershell
pip install yt-dlp
pip install youtube-transcript-api
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
pip install flask flask-cors python-dotenv redis
```

---

## 🐧 Linux (Ubuntu/Debian)

### Установка Redis

```bash
sudo apt update
sudo apt install redis-server

# Запустить как службу
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Проверить
redis-cli ping
# Должно вывести: PONG
```

### Установка Python 3.9+

```bash
# Python обычно уже установлен
python3 --version

# Если нужно установить
sudo apt install python3 python3-pip

# Создать виртуальное окружение (опционально)
python3 -m venv venv
source venv/bin/activate
```

### Установка Python пакетов

```bash
cd /path/to/YT_combiner/python-workers
pip3 install -r requirements.txt
```

---

## 🍎 macOS

### Установка Redis

```bash
# С помощью Homebrew
brew install redis

# Запустить
brew services start redis

# Проверить
redis-cli ping
# Должно вывести: PONG
```

### Установка Python 3.9+

```bash
# С помощью Homebrew
brew install python@3.11

# Проверить
python3 --version
```

### Установка Python пакетов

```bash
cd /path/to/YT_combiner/python-workers
pip3 install -r requirements.txt
```

---

## ✅ Проверка установки

### Проверить Redis

```powershell
# Windows (PowerShell)
redis-cli ping
```

```bash
# Linux/macOS
redis-cli ping
```

Должно вывести: `PONG`

### Проверить Python

```powershell
python --version
# Должно быть 3.9 или выше
```

### Проверить Python пакеты

```powershell
cd python-workers
python -c "import yt_dlp; print('yt-dlp OK')"
python -c "from youtube_transcript_api import YouTubeTranscriptApi; print('youtube-transcript-api OK')"
python -c "from googleapiclient.discovery import build; print('Google API OK')"
```

Все должно вывести "OK".

---

## 🚀 Запуск системы

### 1. Запустить Redis (если не запущен автоматически)

```powershell
# Windows с Memurai - автоматически запускается

# WSL2
wsl
sudo service redis-server start

# Docker
docker start redis
```

### 2. Запустить Backend

```powershell
cd D:\Projects\YT_combiner\backend
npm start
```

Backend теперь будет:
- Подключаться к Redis
- Обрабатывать очереди скачивания и парсинга
- Запускать Python скрипты для работы с видео

### 3. Запустить Frontend

```powershell
cd D:\Projects\YT_combiner\frontend
npm run dev
```

### 4. Открыть приложение

Перейдите на [http://localhost:5173](http://localhost:5173)

---

## 🛠️ Troubleshooting

### Redis connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Решение**: Redis не запущен. Запустите его (см. выше).

### Python not found

```
'python' is not recognized as an internal or external command
```

**Решение**: 
1. Переустановите Python с галочкой "Add to PATH"
2. Или используйте полный путь в `.env`:
   ```
   PYTHON_PATH=C:\Users\YourName\AppData\Local\Programs\Python\Python311\python.exe
   ```

### pip install fails

```
ERROR: Could not build wheels for ...
```

**Решение**:
```powershell
# Обновить pip
python -m pip install --upgrade pip setuptools wheel

# Повторить установку
pip install -r requirements.txt
```

### yt-dlp скачивает очень медленно

**Решение**: Это нормально для YouTube. Используйте качество 720p или 480p вместо "highest".

---

## 🔧 Конфигурация (.env файл)

Создайте `.env` в папке `backend/`:

```env
# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Python
PYTHON_PATH=python
# Для Windows можно указать полный путь:
# PYTHON_PATH=C:\Users\YourName\AppData\Local\Programs\Python\Python311\python.exe

# YouTube API
YOUTUBE_API_KEY=AIzaSyCjrigw7ABxzF5SUODpovEHVCtjBWyD_nw
```

---

## 📚 Дополнительные ресурсы

- **Redis**: https://redis.io/docs/getting-started/
- **yt-dlp**: https://github.com/yt-dlp/yt-dlp
- **Bull Queue**: https://github.com/OptimalBits/bull
- **Python для Windows**: https://docs.python.org/3/using/windows.html
