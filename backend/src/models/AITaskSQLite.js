import db from '../config/sqlite.js';

class AITaskSQLite {
  static create({ jobId, prompt, provider = 'stub', options = {}, spreadsheetId = null, sheet = null, rowIndex = null, status = 'pending', ownerUserId = null }) {
    const stmt = db.prepare(`
      INSERT INTO ai_tasks (job_id, prompt, provider, options, owner_user_id, status, spreadsheet_id, sheet, row_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        prompt = excluded.prompt,
        provider = excluded.provider,
        options = excluded.options,
        status = excluded.status,
        spreadsheet_id = excluded.spreadsheet_id,
        sheet = excluded.sheet,
        row_index = excluded.row_index
    `);
    stmt.run(jobId, String(prompt || ''), String(provider || 'stub'), JSON.stringify(options || {}), ownerUserId || null, String(status || 'pending'), spreadsheetId || null, sheet || null, rowIndex);
    return { jobId, prompt, provider, options, spreadsheetId, sheet, rowIndex, status, owner_user_id: ownerUserId || null };
  }

  static updateStatus(jobId, status, { resultPath = null, error = null } = {}) {
    const stmt = db.prepare(`
      UPDATE ai_tasks
      SET status = ?, result_path = COALESCE(?, result_path), error = COALESCE(?, error),
          finished_at = CASE WHEN ? IN ('completed','failed') THEN datetime('now') ELSE finished_at END
      WHERE job_id = ?
    `);
    stmt.run(String(status), resultPath, error, String(status), jobId);
  }

  static findByJobId(jobId) {
    const stmt = db.prepare('SELECT * FROM ai_tasks WHERE job_id = ?');
    return stmt.get(jobId) || null;
  }

  static latest(limit = 50, offset = 0, { owner_user_id = null, isAdmin = false } = {}) {
    const sql = isAdmin
      ? 'SELECT * FROM ai_tasks ORDER BY created_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM ai_tasks WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const stmt = db.prepare(sql);
    return isAdmin ? stmt.all(limit, offset) : stmt.all(owner_user_id, limit, offset);
  }

  static search({ q = '', status = null, provider = null, limit = 50, offset = 0, owner_user_id = null, isAdmin = false } = {}) {
    let sql = 'SELECT * FROM ai_tasks WHERE 1=1';
    const params = [];
    if (!isAdmin) { sql += ' AND owner_user_id = ?'; params.push(owner_user_id); }
    if (q) { sql += ' AND prompt LIKE ?'; params.push(`%${q}%`); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (provider) { sql += ' AND provider = ?'; params.push(provider); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }
}

export default AITaskSQLite;
