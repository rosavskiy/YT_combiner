import db from '../config/sqlite.js';

class UserMetricsSQLite {
  static ensure(userId) {
    const existing = db.prepare('SELECT user_id FROM user_metrics WHERE user_id = ?').get(userId);
    if (!existing) {
      db.prepare('INSERT INTO user_metrics (user_id) VALUES (?)').run(userId);
    }
  }

  static inc(userId, field, by = 1) {
    this.ensure(userId);
    const allowed = ['videos_downloaded', 'videos_parsed', 'videos_generated', 'earnings_cents'];
    if (!allowed.includes(field)) throw new Error('Invalid metrics field');
    db.prepare(`UPDATE user_metrics SET ${field} = COALESCE(${field},0) + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(by, userId);
    return this.get(userId);
  }

  static get(userId) {
    this.ensure(userId);
    const metrics = db.prepare('SELECT * FROM user_metrics WHERE user_id = ?').get(userId);
    // Добавим фактическое отработанное время из work_sessions
    const total = db.prepare('SELECT COALESCE(SUM(duration_seconds),0) as seconds FROM work_sessions WHERE user_id = ? AND is_active = 0').get(userId);
    const active = db.prepare('SELECT id, started_at FROM work_sessions WHERE user_id = ? AND is_active = 1 ORDER BY started_at DESC LIMIT 1').get(userId);
    return { ...metrics, worked_seconds: total.seconds, active_session: active || null };
  }
}

export default UserMetricsSQLite;
