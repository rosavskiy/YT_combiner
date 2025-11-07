import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем/открываем базу данных
const dbPath = path.join(__dirname, '../../data/trends.db');
const db = new Database(dbPath);

// Включаем WAL mode для лучшей производительности
db.pragma('journal_mode = WAL');

// Создаем таблицы
function initDatabase() {
  // helper: ensure column exists
  const ensureColumn = (table, column, ddl) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      const exists = info.some(c => c.name === column);
      if (!exists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    } catch {}
  };
  // Таблица трендов
  db.exec(`
    CREATE TABLE IF NOT EXISTS trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      total_videos INTEGER,
      countries TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица видео
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      channel TEXT,
      channel_id TEXT,
      owner_user_id INTEGER, -- владелец записи (сотрудник)
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      duration TEXT,
      category_id TEXT,
      region TEXT,
      quality TEXT DEFAULT 'highest',
      status TEXT DEFAULT 'pending',
      job_id TEXT,
      data TEXT,
      downloaded BOOLEAN DEFAULT 0,
      download_path TEXT,
      downloaded_at DATETIME,
      processed BOOLEAN DEFAULT 0,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Индексы для быстрого поиска
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
  `);
  // Безопасно добавим колонку owner_user_id если старый инстанс
  ensureColumn('videos', 'owner_user_id', 'INTEGER');
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_videos_owner ON videos(owner_user_id);`); } catch {}
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_region ON videos(region);
    CREATE INDEX IF NOT EXISTS idx_videos_downloaded ON videos(downloaded);
    CREATE INDEX IF NOT EXISTS idx_trends_fetched_at ON trends(fetched_at);
  `);

  // Таблица настроек приложения (key/value)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица отслеживаемых каналов
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT UNIQUE NOT NULL,
      title TEXT,
      url TEXT,
      owner_user_id INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Индексы для каналов
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_channels_channel_id ON channels(channel_id);
  `);
  ensureColumn('channels', 'owner_user_id', 'INTEGER');
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_user_id);`); } catch {}

  // Таблица AI-задач (история генерации видео)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE,
      prompt TEXT,
      provider TEXT,
      options TEXT,
      owner_user_id INTEGER,
      status TEXT DEFAULT 'pending',
      result_path TEXT,
      error TEXT,
      spreadsheet_id TEXT,
      sheet TEXT,
      row_index INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
  `);
  ensureColumn('ai_tasks', 'owner_user_id', 'INTEGER');
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_tasks_owner ON ai_tasks(owner_user_id);`); } catch {}

  // Таблица пользователей (авторизация через Telegram + логин/пароль)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
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
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
  `);

  // Таблица учета рабочих сессий (тайм-трекер)
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_seconds INTEGER, -- рассчитывается при завершении
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_work_sessions_active ON work_sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_work_sessions_started ON work_sessions(started_at);
  `);

  // Материализованная (агрегирующая) таблица метрик пользователя (опционально будет обновляться)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_metrics (
      user_id INTEGER PRIMARY KEY,
      videos_downloaded INTEGER DEFAULT 0,
      videos_parsed INTEGER DEFAULT 0,
      videos_generated INTEGER DEFAULT 0,
      earnings_cents INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  console.log('✅ SQLite база данных инициализирована');
  console.log(`📁 Путь к БД: ${dbPath}`);
}

// Инициализируем при импорте
initDatabase();

export { db, initDatabase };
export default db;
