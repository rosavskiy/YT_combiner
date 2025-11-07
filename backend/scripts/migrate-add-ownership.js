import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureColumn(db, table, column, ddl) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = info.some(c => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    console.log(`✅ Добавлена колонка ${column} в ${table}`);
  } else {
    console.log(`ℹ️  Колонка ${column} уже существует в ${table}`);
  }
}

function ensureIndex(db, name, ddl) {
  try {
    db.exec(ddl);
    console.log(`✅ Индекс ${name} проверен/создан`);
  } catch (e) {
    console.log(`⚠️  Не удалось создать индекс ${name}: ${e.message}`);
  }
}

function migrate() {
  const dbPath = path.join(__dirname, '../data/trends.db');
  const db = new Database(dbPath);
  console.log('🔧 Миграция: добавление owner_user_id в ключевые таблицы');

  ensureColumn(db, 'videos', 'owner_user_id', 'INTEGER');
  ensureColumn(db, 'channels', 'owner_user_id', 'INTEGER');
  ensureColumn(db, 'ai_tasks', 'owner_user_id', 'INTEGER');

  try { db.exec('CREATE INDEX IF NOT EXISTS idx_videos_owner ON videos(owner_user_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_user_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_ai_tasks_owner ON ai_tasks(owner_user_id)'); } catch {}

  console.log('✅ Миграция завершена. Новые записи будут маркироваться владельцем.');
  db.close();
}

migrate();
