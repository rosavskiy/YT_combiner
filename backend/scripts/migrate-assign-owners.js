import { fileURLToPath } from 'url';
import path from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const dbPath = path.join(__dirname, '../data/trends.db');
  const db = new Database(dbPath);
  console.log('🔧 Миграция присвоения владельцев для старых записей');

  const admin = db.prepare(`SELECT id FROM users WHERE role='admin' ORDER BY id ASC LIMIT 1`).get();
  if (!admin) {
    console.log('⚠️ Администратор не найден. Создайте админа сначала (scripts/create-admin.js).');
    db.close();
    process.exit(1);
  }
  const adminId = admin.id;
  console.log(`➡️ Используем admin_id=${adminId} как владельца по умолчанию.`);

  const assign = (table) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      if (!info.some(c => c.name === 'owner_user_id')) {
        console.log(`⏭ Таблица ${table} не имеет owner_user_id, пропуск.`);
        return;
      }
      const res = db.prepare(`UPDATE ${table} SET owner_user_id = ? WHERE owner_user_id IS NULL`).run(adminId);
      console.log(`✅ ${table}: обновлено ${res.changes} строк без владельца.`);
    } catch (e) {
      console.log(`❌ Ошибка обновления ${table}: ${e.message}`);
    }
  };

  assign('videos');
  assign('channels');
  assign('ai_tasks');

  db.close();
  console.log('🎉 Готово. Все старые записи теперь принадлежат администратору.');
}

main();
