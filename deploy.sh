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
echo -e "${YELLOW}🐍 Setting up Python workers...${NC}"
cd $PYTHON_DIR
pip3 install -r requirements.txt

# 5. Database migration (if needed)
echo -e "${YELLOW}🗄️  Checking database...${NC}"
cd $BACKEND_DIR
if [ -f "scripts/migrate.js" ]; then
    node scripts/migrate.js
fi

# 6. Restart services
echo -e "${YELLOW}♻️  Restarting services...${NC}"
pm2 restart ecosystem.config.js --update-env

# 7. Reload Nginx
echo -e "${YELLOW}🌐 Reloading Nginx...${NC}"
nginx -t && systemctl reload nginx

# 8. Show status
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${YELLOW}Service status:${NC}"
pm2 status

echo -e "${GREEN}🎉 All done!${NC}"
