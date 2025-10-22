import db from '../config/sqlite.js';

class TrendModel {
  /**
   * Сохранить тренды
   */
  static create({ data, totalVideos, countries }) {
    const stmt = db.prepare(`
      INSERT INTO trends (data, total_videos, countries, fetched_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      JSON.stringify(data),
      totalVideos,
      JSON.stringify(countries)
    );

    return {
      id: result.lastInsertRowid,
      data,
      totalVideos,
      countries,
      fetchedAt: new Date()
    };
  }

  /**
   * Получить последние тренды
   */
  static findLatest() {
    const stmt = db.prepare(`
      SELECT id, data, total_videos, countries, fetched_at, created_at
      FROM trends
      ORDER BY fetched_at DESC
      LIMIT 1
    `);

    const row = stmt.get();
    
    if (!row) return null;

    return {
      _id: row.id,
      data: JSON.parse(row.data),
      totalVideos: row.total_videos,
      countries: JSON.parse(row.countries),
      fetchedAt: row.fetched_at,
      createdAt: row.created_at
    };
  }

  /**
   * Получить историю трендов
   */
  static findHistory(limit = 10, offset = 0) {
    const stmt = db.prepare(`
      SELECT id, total_videos, countries, fetched_at, created_at
      FROM trends
      ORDER BY fetched_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset);

    return rows.map(row => ({
      _id: row.id,
      totalVideos: row.total_videos,
      countries: JSON.parse(row.countries),
      fetchedAt: row.fetched_at,
      createdAt: row.created_at
    }));
  }

  /**
   * Получить количество записей
   */
  static count() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM trends');
    const result = stmt.get();
    return result.count;
  }

  /**
   * Получить тренды по ID
   */
  static findById(id) {
    const stmt = db.prepare(`
      SELECT id, data, total_videos, countries, fetched_at, created_at
      FROM trends
      WHERE id = ?
    `);

    const row = stmt.get(id);
    
    if (!row) return null;

    return {
      _id: row.id,
      data: JSON.parse(row.data),
      totalVideos: row.total_videos,
      countries: JSON.parse(row.countries),
      fetchedAt: row.fetched_at,
      createdAt: row.created_at
    };
  }
}

export default TrendModel;
