#!/bin/bash

# Fix Python Environment Script
# Использование: bash fix-python.sh

set -e

echo "🐍 Исправление Python окружения..."

PROJECT_DIR="/var/www/yt-combiner"
cd $PROJECT_DIR/python-workers

# Удалить старое venv если есть
if [ -d "venv" ]; then
    rm -rf venv
fi

# Создать новое виртуальное окружение
python3 -m venv venv

# Активировать
source venv/bin/activate

# Обновить pip
pip install --upgrade pip

# Установить зависимости
pip install -r requirements.txt

echo "✅ Python окружение настроено!"
echo ""
echo "Установленные пакеты:"
pip list

deactivate
