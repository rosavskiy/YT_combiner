# 🚀 Быстрый деплой на VPS

## Шаг 1: Подготовка сервера (5 минут)

```bash
# Исправить dpkg
sudo dpkg --configure -a

# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установить зависимости
sudo apt install -y python3 python3-pip nginx git
sudo npm install -g pm2
```

## Шаг 2: Клонирование проекта (1 минута)

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/rosavskiy/YT_combiner.git yt-combiner
cd yt-combiner
sudo chown -R $USER:$USER /var/www/yt-combiner
```

## Шаг 3: Конфигурация Backend (2 минуты)

```bash
cd /var/www/yt-combiner/backend
cp .env.example .env
nano .env
```

**Обязательно измените:**
```env
JWT_SECRET=ваш-случайный-секретный-ключ-минимум-32-символа
TELEGRAM_BOT_TOKEN=ваш-токен-от-BotFather
CORS_ORIGIN=https://ваш-домен.com
YOUTUBE_API_KEY=ваш-youtube-api-ключ
```

## Шаг 4: Конфигурация Frontend (1 минута)

```bash
cd /var/www/yt-combiner/frontend
nano .env.production
```

```env
VITE_API_URL=https://ваш-домен.com/api
VITE_TELEGRAM_BOT_NAME=ваш_бот_без_собаки
```

## Шаг 5: Сборка проекта (5 минут)

```bash
# Backend
cd /var/www/yt-combiner/backend
npm install --production

# Frontend
cd /var/www/yt-combiner/frontend
npm install
npm run build

# Python
cd /var/www/yt-combiner/python-workers
pip3 install -r requirements.txt
```

## Шаг 6: Инициализация БД (1 минута)

```bash
cd /var/www/yt-combiner/backend
node -e "require('./src/config/sqlite.js')"
node scripts/create-admin.js
```

**Создан администратор:**
- Логин: `rosavsky`
- Пароль: `O7gheo13@!`

## Шаг 7: Настройка Nginx (3 минуты)

```bash
# Скопировать конфиг
sudo cp /var/www/yt-combiner/nginx.conf /etc/nginx/sites-available/yt-combiner

# Редактировать - заменить yourdomain.com на ваш домен
sudo nano /etc/nginx/sites-available/yt-combiner

# Активировать
sudo ln -s /etc/nginx/sites-available/yt-combiner /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Проверить
sudo nginx -t

# Перезапустить
sudo systemctl restart nginx
```

## Шаг 8: SSL сертификат (2 минуты)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.com -d www.ваш-домен.com
```

## Шаг 9: Запуск приложения (1 минута)

```bash
cd /var/www/yt-combiner
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## ✅ Проверка

```bash
# Статус
pm2 status

# Логи
pm2 logs

# Проверить API
curl https://ваш-домен.com/api/health

# Открыть в браузере
https://ваш-домен.com
```

## 🔄 Обновление (после изменений в коде)

```bash
cd /var/www/yt-combiner
sudo ./deploy.sh
```

---

**Время развертывания: ~20 минут**

**Важно:** Не забудьте сменить пароль администратора после первого входа!
