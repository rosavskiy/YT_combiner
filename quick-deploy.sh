#!/bin/bash

# Quick Deploy Script for EliteSphere YT Combiner
# Использование: bash quick-deploy.sh

set -e

echo "🚀 EliteSphere YT Combiner - Quick Deploy"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/var/www/yt-combiner"

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Пожалуйста, запустите с sudo: sudo bash quick-deploy.sh${NC}"
    exit 1
fi

# Шаг 1: Клонирование (если еще не клонировано)
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}📥 Клонирование репозитория...${NC}"
    mkdir -p /var/www
    cd /var/www
    git clone https://github.com/rosavskiy/YT_combiner.git yt-combiner
    chown -R www-data:www-data $PROJECT_DIR
else
    echo -e "${GREEN}✓ Проект уже клонирован${NC}"
fi

cd $PROJECT_DIR

# Шаг 2: Backend конфигурация
echo -e "${YELLOW}⚙️  Настройка Backend...${NC}"
cd $PROJECT_DIR/backend
if [ ! -f ".env" ]; then
    cp .env.production .env
    echo -e "${GREEN}✓ Backend .env создан${NC}"
else
    echo -e "${BLUE}ℹ Backend .env уже существует${NC}"
fi

# Шаг 3: Frontend конфигурация
echo -e "${YELLOW}⚙️  Настройка Frontend...${NC}"
cd $PROJECT_DIR/frontend
echo -e "${GREEN}✓ Frontend .env.production готов${NC}"

# Шаг 4: Установка зависимостей Backend
echo -e "${YELLOW}📦 Установка Backend зависимостей...${NC}"
cd $PROJECT_DIR/backend
npm install --production
echo -e "${GREEN}✓ Backend зависимости установлены${NC}"

# Шаг 5: Сборка Frontend
echo -e "${YELLOW}🏗️  Сборка Frontend...${NC}"
cd $PROJECT_DIR/frontend
npm install
npm run build
echo -e "${GREEN}✓ Frontend собран${NC}"

# Шаг 6: Python Workers
echo -e "${YELLOW}🐍 Настройка Python Workers...${NC}"
cd $PROJECT_DIR/python-workers

# Создать виртуальное окружение если его нет
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Python venv создан${NC}"
fi

# Активировать и установить зависимости
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
echo -e "${GREEN}✓ Python зависимости установлены${NC}"

# Шаг 7: Инициализация БД
echo -e "${YELLOW}🗄️  Инициализация базы данных...${NC}"
cd $PROJECT_DIR/backend
node -e "require('./src/config/sqlite.js')"
echo -e "${GREEN}✓ База данных инициализирована${NC}"

# Создание администратора
if [ -f "scripts/create-admin.js" ]; then
    node scripts/create-admin.js
    echo -e "${GREEN}✓ Администратор создан (rosavsky / O7gheo13@!)${NC}"
fi

# Шаг 8: Настройка Nginx
echo -e "${YELLOW}🌐 Настройка Nginx...${NC}"
if [ ! -f "/etc/nginx/sites-available/yt-combiner" ]; then
    cp $PROJECT_DIR/nginx.conf /etc/nginx/sites-available/yt-combiner
    ln -sf /etc/nginx/sites-available/yt-combiner /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    echo -e "${GREEN}✓ Nginx настроен${NC}"
else
    echo -e "${BLUE}ℹ Nginx уже настроен${NC}"
fi

# Шаг 9: SSL сертификат
echo -e "${YELLOW}🔒 Установка SSL сертификата...${NC}"
if [ ! -d "/etc/letsencrypt/live/elitesphere.ru" ]; then
    certbot --nginx -d elitesphere.ru -d www.elitesphere.ru --non-interactive --agree-tos --email admin@elitesphere.ru
    echo -e "${GREEN}✓ SSL сертификат установлен${NC}"
else
    echo -e "${BLUE}ℹ SSL сертификат уже установлен${NC}"
fi

# Шаг 10: Создание директории для логов
mkdir -p $PROJECT_DIR/logs
chown -R www-data:www-data $PROJECT_DIR/logs

# Шаг 11: Запуск через PM2
echo -e "${YELLOW}▶️  Запуск приложения через PM2...${NC}"
cd $PROJECT_DIR

# Остановить если запущено
pm2 delete all 2>/dev/null || true

# Запустить
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo -e "${GREEN}✓ Приложение запущено${NC}"

# Финальная проверка
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment завершен успешно!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📊 Статус сервисов:${NC}"
pm2 status
echo ""
echo -e "${BLUE}🌐 Приложение доступно:${NC}"
echo -e "   https://elitesphere.ru"
echo ""
echo -e "${BLUE}👤 Данные администратора:${NC}"
echo -e "   Логин: ${GREEN}rosavsky${NC}"
echo -e "   Пароль: ${GREEN}O7gheo13@!${NC}"
echo ""
echo -e "${YELLOW}⚠️  Не забудьте сменить пароль после первого входа!${NC}"
echo ""
echo -e "${BLUE}📝 Полезные команды:${NC}"
echo -e "   pm2 logs        - Просмотр логов"
echo -e "   pm2 restart all - Перезапуск всех сервисов"
echo -e "   pm2 monit       - Мониторинг"
echo ""
