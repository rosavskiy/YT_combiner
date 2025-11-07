import db from '../config/sqlite.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class UserSQLite {
  /**
   * Создать пользователя по логину и паролю
   */
  static async createWithPassword(login, password, options = {}) {
    const { first_name = null, last_name = null, role = 'user', is_approved = 0 } = options;

    // Проверяем, существует ли пользователь с таким логином
    const existing = this.findByLogin(login);
    if (existing) {
      throw new Error('Пользователь с таким логином уже существует');
    }

    // Хешируем пароль
    const password_hash = await bcrypt.hash(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (login, password_hash, first_name, last_name, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(login, password_hash, first_name, last_name, role, is_approved);
    return this.findById(info.lastInsertRowid);
  }

  /**
   * Проверить пароль пользователя
   */
  static async verifyPassword(login, password) {
    const user = this.findByLogin(login);
    if (!user || !user.password_hash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? user : null;
  }

  /**
   * Создать или обновить пользователя по данным Telegram
   */
  static async createOrUpdate(telegramData) {
    const { id: telegramId, username, first_name, last_name, photo_url } = telegramData;

    // Проверяем, существует ли пользователь
    const existing = this.findByTelegramId(telegramId);

    if (existing) {
      // Обновляем данные профиля
      const stmt = db.prepare(`
        UPDATE users 
        SET username = ?, first_name = ?, last_name = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `);
      stmt.run(username || null, first_name || null, last_name || null, photo_url || null, telegramId);
      return this.findByTelegramId(telegramId);
    }

    // Создаем нового пользователя (требует подтверждения администратором)
    // Первый пользователь становится администратором автоматически
    const count = this.count();
    const isFirstUser = count === 0;

    const stmt = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      telegramId,
      username || null,
      first_name || null,
      last_name || null,
      photo_url || null,
      isFirstUser ? 'admin' : 'user',
      isFirstUser ? 1 : 0
    );

    return this.findById(info.lastInsertRowid);
  }

  /**
   * Найти пользователя по ID
   */
  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Найти пользователя по Telegram ID
   */
  static findByTelegramId(telegramId) {
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(telegramId);
  }

  /**
   * Найти пользователя по логину
   */
  static findByLogin(login) {
    const stmt = db.prepare('SELECT * FROM users WHERE login = ?');
    return stmt.get(login);
  }

  /**
   * Получить всех пользователей
   */
  static findAll() {
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all();
  }

  /**
   * Получить пользователей, ожидающих подтверждения
   */
  static findPending() {
    const stmt = db.prepare('SELECT * FROM users WHERE is_approved = 0 ORDER BY created_at DESC');
    return stmt.all();
  }

  /**
   * Подтвердить пользователя
   */
  static approve(id) {
    const stmt = db.prepare('UPDATE users SET is_approved = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  /**
   * Отклонить/удалить пользователя
   */
  static reject(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  /**
   * Изменить роль пользователя
   */
  static changeRole(id, role) {
    if (!['admin', 'user'].includes(role)) {
      throw new Error('Недопустимая роль. Используйте: admin, user');
    }
    const stmt = db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const info = stmt.run(role, id);
    return info.changes > 0;
  }

  /**
   * Количество пользователей
   */
  static count() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    return stmt.get().count;
  }

  /**
   * Проверить, является ли пользователь администратором
   */
  static isAdmin(id) {
    const user = this.findById(id);
    return user && user.role === 'admin';
  }

  /**
   * Проверить, подтвержден ли пользователь
   */
  static isApproved(id) {
    const user = this.findById(id);
    return user && user.is_approved === 1;
  }

  /**
   * Генерировать JWT токен для пользователя
   */
  static generateToken(user) {
    const payload = {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      role: user.role,
      is_approved: user.is_approved
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '30d' // Токен действителен 30 дней
    });
  }

  /**
   * Проверить JWT токен
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return null;
    }
  }

  /**
   * Получить пользователя без чувствительных данных
   */
  static sanitize(user) {
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}

export default UserSQLite;
