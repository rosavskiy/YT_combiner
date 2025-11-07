import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Миграция: добавление поддержки логин/пароль авторизации
 */

async function migrate() {
  try {
    const dbPath = path.join(__dirname, '../data/trends.db');
    const db = new Database(dbPath);

    console.log('🔧 Начало миграции базы данных...');

    // Проверяем, существует ли колонка login
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasLogin = tableInfo.some(col => col.name === 'login');

    if (hasLogin) {
      console.log('✅ Колонки login и password_hash уже существуют');
      db.close();
      return;
    }

    console.log('📝 Обновление структуры таблицы users...');

    // SQLite не поддерживает изменение структуры колонок напрямую
    // Поэтому пересоздаем таблицу полностью
    db.exec(`
      BEGIN TRANSACTION;

      -- Создаем временную таблицу с новой структурой
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE,
        login TEXT UNIQUE,
        password_hash TEXT,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        photo_url TEXT,
        role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
        is_approved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Копируем данные из старой таблицы
      INSERT INTO users_new (id, telegram_id, username, first_name, last_name, photo_url, role, is_approved, created_at, updated_at)
      SELECT id, telegram_id, username, first_name, last_name, photo_url, role, is_approved, created_at, updated_at
      FROM users;

      -- Удаляем старую таблицу
      DROP TABLE users;

      -- Переименовываем новую таблицу
      ALTER TABLE users_new RENAME TO users;

      -- Создаем индексы
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);

      COMMIT;
    `);

    console.log('✅ Миграция успешно выполнена!');
    console.log('');
    console.log('📊 Новая структура таблицы users:');
    console.log('   - telegram_id (nullable) - для Telegram авторизации');
    console.log('   - login (nullable) - для логин/пароль авторизации');
    console.log('   - password_hash - хеш пароля');
    console.log('');
    console.log('✅ Теперь можно создать администратора:');
    console.log('   node scripts/create-admin.js');

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
