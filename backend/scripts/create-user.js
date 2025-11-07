import { fileURLToPath } from 'url';
import path from 'path';
import { initDatabase } from '../src/config/sqlite.js';
import UserSQLite from '../src/models/UserSQLite.js';

// Использование:
//   node scripts/create-user.js --login=testuser --password=Pass123! [--first="Имя"] [--last="Фамилия"] [--approved] [--admin]
// Примеры:
//   node scripts/create-user.js --login=worker1 --password=Worker123! --first=Ivan --approved
//   node scripts/create-user.js --login=manager --password=Secret123! --admin --approved

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const [key, val] = a.split('=');
      const k = key.replace(/^--/, '');
      if (val !== undefined) out[k] = val; else out[k] = true;
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  const login = opts.login;
  const password = opts.password;
  const first = opts.first || opts.first_name || null;
  const last = opts.last || opts.last_name || null;
  const approved = Boolean(opts.approved);
  const admin = Boolean(opts.admin);

  if (!login || !password) {
    console.log('❌ Требуются параметры --login=... --password=...');
    process.exit(1);
  }

  try {
    console.log('🔧 Инициализация базы...');
    initDatabase();
    console.log(`👤 Создание пользователя (${admin ? 'admin' : 'user'}) login="${login}" ...`);
    const user = await UserSQLite.createWithPassword(login, password, {
      first_name: first,
      last_name: last,
      role: admin ? 'admin' : 'user',
      is_approved: approved ? 1 : 0,
    });
    console.log('✅ Пользователь создан.');
    console.log('');
    console.log('📋 Данные для входа:');
    console.log(`   Логин: ${login}`);
    console.log(`   Пароль: ${password}`);
    console.log(`   Роль: ${user.role}`);
    console.log(`   Подтвержден: ${user.is_approved === 1 ? 'да' : 'нет'}`);
    console.log('');
    console.log('➡️  Теперь можно авторизоваться через /api/auth/login');
    if (user.is_approved === 0) {
      console.log('⚠️  Аккаунт не подтвержден. Подтвердите через /api/auth/approve/:id под админом.');
    }
    process.exit(0);
  } catch (e) {
    if (e.message.includes('уже существует')) {
      console.log(`⚠️  Пользователь с логином "${login}" уже существует.`);
      console.log('Используйте существующие данные для входа.');
      process.exit(0);
    }
    console.error('❌ Ошибка создания пользователя:', e.message);
    process.exit(1);
  }
}

main();
