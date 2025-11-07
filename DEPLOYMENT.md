# 🚀 Deployment Guide - YT Combiner

Полная инструкция по развертыванию проекта на VPS.

## 📋 Требования

- **VPS**: Ubuntu 20.04/22.04 или Debian 11/12
- **RAM**: минимум 2GB
- **CPU**: минимум 1 core
- **Disk**: минимум 20GB
- **Домен**: настроенный DNS A-record на IP сервера

## 🔧 Подготовка сервера

### 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка Node.js 18.x

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Проверка: v18.x.x
npm --version   # Проверка: 9.x.x
```

### 3. Установка Python 3 и pip

```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version  # Проверка: 3.8+
```

### 4. Установка Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 5. Установка PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup systemd  # Следуйте инструкциям на экране
```

### 6. Установка Git

```bash
sudo apt install -y git
```

## 📦 Клонирование проекта

### 1. Создание директории

```bash
sudo mkdir -p /var/www
cd /var/www
```

### 2. Клонирование репозитория

```bash
sudo git clone https://github.com/rosavskiy/YT_combiner.git yt-combiner
cd yt-combiner
```

### 3. Установка прав доступа

```bash
sudo chown -R $USER:$USER /var/www/yt-combiner
```

## ⚙️ Конфигурация

### 1. Backend (.env)

```bash
cd /var/www/yt-combiner/backend
cp .env.example .env
nano .env
```

**Обязательно измените:**

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# ВАЖНО: Смените на случайную строку!
JWT_SECRET=ваш-супер-секретный-ключ-минимум-32-символа

# Telegram Bot Token (получите у @BotFather)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# CORS - ваш домен
CORS_ORIGIN=https://yourdomain.com

# YouTube API Key
YOUTUBE_API_KEY=ваш-ключ-из-google-cloud-console

DB_PATH=./database.sqlite
```

### 2. Frontend (.env.production)

```bash
cd /var/www/yt-combiner/frontend
nano .env.production
```

```env
# Backend API URL (ваш домен)
VITE_API_URL=https://yourdomain.com/api

# Telegram Bot Username (без @)
VITE_TELEGRAM_BOT_NAME=your_bot_name
```

### 3. Python Workers

```bash
cd /var/www/yt-combiner/python-workers
cp google-credentials.json.example google-credentials.json
nano google-credentials.json  # Вставьте ваши Google Cloud credentials
```

## 🏗️ Сборка проекта

### 1. Backend dependencies

```bash
cd /var/www/yt-combiner/backend
npm install --production
```

### 2. Frontend build

```bash
cd /var/www/yt-combiner/frontend
npm install
npm run build
```

Результат будет в `frontend/dist/`

### 3. Python dependencies

```bash
cd /var/www/yt-combiner/python-workers
pip3 install -r requirements.txt
```

## 🗄️ Инициализация базы данных

```bash
cd /var/www/yt-combiner/backend

# Создать структуру БД (если еще не создана)
node -e "require('./src/config/sqlite.js')"

# Создать администратора
node scripts/create-admin.js
```

Будет создан пользователь:
- **Логин**: `rosavsky`
- **Пароль**: `O7gheo13@!`

**⚠️ ВАЖНО**: Смените пароль после первого входа!

## 🌐 Настройка Nginx

### 1. Копирование конфигурации

```bash
sudo cp /var/www/yt-combiner/nginx.conf /etc/nginx/sites-available/yt-combiner
```

### 2. Редактирование конфигурации

```bash
sudo nano /etc/nginx/sites-available/yt-combiner
```

Замените `yourdomain.com` на ваш реальный домен:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

### 3. Активация сайта

```bash
sudo ln -s /etc/nginx/sites-available/yt-combiner /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Удалить дефолтный сайт
```

### 4. Проверка конфигурации

```bash
sudo nginx -t
```

Должно быть: `syntax is ok` и `test is successful`

### 5. Перезапуск Nginx

```bash
sudo systemctl restart nginx
```

## 🔒 Установка SSL сертификата (Let's Encrypt)

### 1. Установка Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Получение сертификата

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Следуйте инструкциям:
- Введите email
- Согласитесь с Terms of Service
- Выберите опцию 2 (Redirect HTTP to HTTPS)

### 3. Автопродление сертификата

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

Проверка:

```bash
sudo certbot renew --dry-run
```

## ▶️ Запуск приложения

### 1. Запуск через PM2

```bash
cd /var/www/yt-combiner
pm2 start ecosystem.config.js
```

### 2. Сохранение конфигурации PM2

```bash
pm2 save
```

### 3. Проверка статуса

```bash
pm2 status
```

Должны быть запущены:
- `yt-combiner-backend` (port 3000)
- `yt-combiner-python` (port 5000)

### 4. Просмотр логов

```bash
# Все логи
pm2 logs

# Backend
pm2 logs yt-combiner-backend

# Python
pm2 logs yt-combiner-python
```

## ✅ Проверка работоспособности

### 1. Backend API

```bash
curl https://yourdomain.com/api/health
```

Ответ: `{"status":"ok"}`

### 2. Frontend

Откройте в браузере: `https://yourdomain.com`

Должна загрузиться страница логина.

### 3. Telegram авторизация

1. Настройте webhook для Telegram бота:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://yourdomain.com/api/auth/telegram/webhook"
```

2. Откройте `/login` и проверьте кнопку "Войти через Telegram"

## 🔄 Автоматический деплой

### 1. Сделать скрипт исполняемым

```bash
chmod +x /var/www/yt-combiner/deploy.sh
```

### 2. Использование

```bash
cd /var/www/yt-combiner
sudo ./deploy.sh
```

Скрипт автоматически:
- Подтянет последние изменения из Git
- Установит зависимости
- Соберет frontend
- Перезапустит сервисы
- Перезагрузит Nginx

## 🐛 Устранение проблем

### Backend не запускается

```bash
# Проверить логи
pm2 logs yt-combiner-backend --lines 100

# Проверить порт
sudo netstat -tulpn | grep 3000

# Перезапустить
pm2 restart yt-combiner-backend
```

### Frontend показывает 502 Bad Gateway

```bash
# Проверить, что backend запущен
pm2 status

# Проверить Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверить логи Nginx
sudo tail -f /var/log/nginx/yt-combiner-error.log
```

### Ошибки авторизации

```bash
# Проверить .env
cat /var/www/yt-combiner/backend/.env | grep JWT_SECRET

# Проверить базу данных
sqlite3 /var/www/yt-combiner/backend/database.sqlite "SELECT * FROM users;"

# Пересоздать администратора
cd /var/www/yt-combiner/backend
node scripts/create-admin.js
```

### Python worker не работает

```bash
# Проверить логи
pm2 logs yt-combiner-python

# Проверить зависимости
cd /var/www/yt-combiner/python-workers
pip3 list

# Переустановить
pip3 install -r requirements.txt --force-reinstall
pm2 restart yt-combiner-python
```

## 📊 Мониторинг

### PM2 Dashboard

```bash
pm2 monit
```

### Системные ресурсы

```bash
# CPU и RAM
htop

# Диск
df -h

# Логи в реальном времени
pm2 logs --lines 50
```

## 🔐 Безопасность

### 1. Firewall (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### 2. Fail2Ban (защита от брутфорса)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Регулярные обновления

```bash
# Обновления системы
sudo apt update && sudo apt upgrade -y

# Обновления npm пакетов
cd /var/www/yt-combiner/backend
npm audit fix

cd /var/www/yt-combiner/frontend
npm audit fix
```

## 🔄 Backup базы данных

### Автоматический backup

```bash
# Создать скрипт
sudo nano /usr/local/bin/backup-yt-combiner.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/yt-combiner"
mkdir -p $BACKUP_DIR

# Backup БД
cp /var/www/yt-combiner/backend/database.sqlite $BACKUP_DIR/database_$DATE.sqlite

# Удалить старые (>7 дней)
find $BACKUP_DIR -name "database_*.sqlite" -mtime +7 -delete

echo "Backup completed: database_$DATE.sqlite"
```

```bash
# Сделать исполняемым
sudo chmod +x /usr/local/bin/backup-yt-combiner.sh

# Добавить в crontab (каждый день в 3:00)
sudo crontab -e
```

Добавить строку:

```
0 3 * * * /usr/local/bin/backup-yt-combiner.sh >> /var/log/yt-combiner-backup.log 2>&1
```

## 📚 Дополнительные ресурсы

- **PM2 документация**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Nginx документация**: https://nginx.org/ru/docs/
- **Let's Encrypt**: https://letsencrypt.org/getting-started/
- **Node.js best practices**: https://github.com/goldbergyoni/nodebestpractices

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи: `pm2 logs`
2. Проверьте статус: `pm2 status`
3. Проверьте Nginx: `sudo nginx -t`
4. Проверьте системные ресурсы: `htop`

---

**Готово! Ваше приложение развернуто на production! 🎉**
