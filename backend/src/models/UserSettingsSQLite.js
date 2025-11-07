import db from '../config/sqlite.js';

class UserSettingsSQLite {
  static get(userId, key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(userId, key);
    if (!row) return defaultValue;
    try { return JSON.parse(row.value); } catch { return row.value ?? defaultValue; }
  }
  static set(userId, key, value) {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare(`INSERT INTO user_settings(user_id, key, value, updated_at) VALUES(?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
      .run(userId, key, json);
    return true;
  }
  static list(userId) {
    const rows = db.prepare('SELECT key, value, updated_at FROM user_settings WHERE user_id = ?').all(userId);
    return rows.map(r => {
      let v = r.value; try { v = JSON.parse(r.value); } catch {}
      return { key: r.key, value: v, updated_at: r.updated_at };
    });
  }
  static delete(userId, key) {
    db.prepare('DELETE FROM user_settings WHERE user_id = ? AND key = ?').run(userId, key);
    return true;
  }
}

export default UserSettingsSQLite;
