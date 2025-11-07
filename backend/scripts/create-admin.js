import { fileURLToPath } from 'url';
import path from 'path';
import { initDatabase } from '../src/config/sqlite.js';
import UserSQLite from '../src/models/UserSQLite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Скрипт для создания первого администратора
 * Использование: node scripts/create-admin.js
 */

async function createAdmin() {
  try {
    console.log('🔧 Инициализация базы данных...');
    initDatabase();

    console.log('👤 Создание администратора...');
    
    const admin = await UserSQLite.createWithPassword('rosavsky', 'O7gheo13@!', {
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_approved: 1
    });

    console.log('✅ Администратор успешно создан!');
    console.log('');
    console.log('📋 Данные для входа:');
    console.log('   Логин: rosavsky');
    console.log('   Пароль: O7gheo13@!');
    console.log('');
    console.log('🎉 Теперь вы можете войти в систему!');
    
    process.exit(0);
  } catch (error) {
    if (error.message.includes('уже существует')) {
      console.log('⚠️  Администратор с логином "rosavsky" уже существует');
      console.log('📋 Используйте существующие данные для входа:');
      console.log('   Логин: rosavsky');
      console.log('   Пароль: O7gheo13@!');
      process.exit(0);
    } else {
      console.error('❌ Ошибка создания администратора:', error.message);
      process.exit(1);
    }
  }
}

createAdmin();
