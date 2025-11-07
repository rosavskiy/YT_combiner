#!/bin/bash

# Deployment скрипт для YT Combiner
# Использование: ./deploy.sh

set -e

echo "🚀 Starting deployment..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/yt-combiner"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PYTHON_DIR="$PROJECT_DIR/python-workers"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (sudo ./deploy.sh)${NC}"
    exit 1
fi

# 1. Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes from Git...${NC}"
cd $PROJECT_DIR
git pull origin main

# 2. Backend deployment
echo -e "${YELLOW}🔧 Installing backend dependencies...${NC}"
cd $BACKEND_DIR
npm install --production

# 3. Frontend build
echo -e "${YELLOW}🏗️  Building frontend...${NC}"
cd $FRONTEND_DIR
npm install
npm run build

# 4. Python workers
echo -e "${YELLOW}🐍 Setting up Python workers (venv)...${NC}"
cd $PYTHON_DIR
# Create venv if missing
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
# Install deps into venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 5. Database migration (if needed)
echo -e "${YELLOW}🗄️  Checking database...${NC}"
cd $BACKEND_DIR
# Выполним миграции схемы владения и присвоения владельцев
if [ -f "scripts/migrate-add-ownership.js" ]; then
    echo -e "${YELLOW}➡️  Running migrate-add-ownership.js${NC}"
    node scripts/migrate-add-ownership.js || true
fi
if [ -f "scripts/migrate-assign-owners.js" ]; then
    echo -e "${YELLOW}➡️  Running migrate-assign-owners.js${NC}"
    node scripts/migrate-assign-owners.js || true
fi

# 6. Restart services
echo -e "${YELLOW}♻️  Restarting services...${NC}"
# Перезапуск выполняем из корня проекта, где лежит ecosystem.config.js
cd $PROJECT_DIR
# Если процессы ещё не запущены, стартуем их; иначе — перезапускаем с обновлением env
PM2_CONFIG="$PROJECT_DIR/ecosystem.config.js"
if pm2 describe yt-combiner-backend > /dev/null 2>&1; then
    # Перезапускаем по именам, чтобы не зависеть от поиска файла конфигурации
    pm2 restart yt-combiner-backend || { echo -e "${RED}Не удалось перезапустить yt-combiner-backend${NC}"; exit 1; }
    pm2 restart yt-combiner-python || { echo -e "${RED}Не удалось перезапустить yt-combiner-python${NC}"; exit 1; }
else
    # Процессы ещё не существуют — стартуем из абсолютного пути
    if [ -f "$PM2_CONFIG" ]; then
        pm2 start "$PM2_CONFIG" || { echo -e "${RED}Не удалось стартовать через $PM2_CONFIG${NC}"; exit 1; }
    else
        echo -e "${RED}Файл конфигурации PM2 не найден: $PM2_CONFIG${NC}"; exit 1;
    fi
fi
pm2 save

# 7. Reload Nginx
echo -e "${YELLOW}🌐 Reloading Nginx...${NC}"
nginx -t && systemctl reload nginx

# 8. Show status
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${YELLOW}Service status:${NC}"
pm2 status

echo -e "${GREEN}🎉 All done!${NC}"
