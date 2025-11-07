import db from '../config/sqlite.js';

class WorkSessionSQLite {
  static start(userId) {
    // Завершаем активные сессии, если они зависли
    db.prepare(`
      UPDATE work_sessions 
      SET is_active = 0, ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
          duration_seconds = COALESCE(duration_seconds, CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400 AS INTEGER)),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `).run(userId);

    const stmt = db.prepare(`
      INSERT INTO work_sessions (user_id, started_at, is_active)
      VALUES (?, CURRENT_TIMESTAMP, 1)
    `);
    const info = stmt.run(userId);
    return this.findById(info.lastInsertRowid);
  }

  static stop(userId) {
    const active = this.getActive(userId);
    if (!active) return null;
    const stmt = db.prepare(`
      UPDATE work_sessions
      SET ended_at = CURRENT_TIMESTAMP,
          is_active = 0,
          duration_seconds = CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400 AS INTEGER),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(active.id);
    return this.findById(active.id);
  }

  static getActive(userId) {
    const stmt = db.prepare(`SELECT * FROM work_sessions WHERE user_id = ? AND is_active = 1 ORDER BY started_at DESC LIMIT 1`);
    return stmt.get(userId);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM work_sessions WHERE id = ?');
    return stmt.get(id);
  }

  static summary(userId, { from, to } = {}) {
    let where = 'user_id = ?';
    const params = [userId];
    if (from) { where += ' AND started_at >= ?'; params.push(from); }
    if (to) { where += ' AND started_at <= ?'; params.push(to); }

    const total = db.prepare(`
      SELECT 
        COUNT(*) as sessions,
        COALESCE(SUM(duration_seconds), 0) as duration_seconds
      FROM work_sessions
      WHERE ${where} AND is_active = 0
    `).get(...params);

    const active = this.getActive(userId);

    return { ...total, active };
  }
}

export default WorkSessionSQLite;
