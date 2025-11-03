import db from '../config/sqlite.js';

class ChannelModel {
  static add({ channel_id, title, url }) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO channels (channel_id, title, url) VALUES (?, ?, ?)`);
    const res = stmt.run(channel_id, title || null, url || null);
    return res;
  }

  static upsert({ channel_id, title, url }) {
    const stmt = db.prepare(`
      INSERT INTO channels (channel_id, title, url) VALUES (?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET title=excluded.title, url=excluded.url
    `);
    const res = stmt.run(channel_id, title || null, url || null);
    return res;
  }

  static all() {
    return db.prepare(`SELECT id, channel_id, title, url, added_at FROM channels ORDER BY added_at DESC`).all();
  }

  static remove(channel_id) {
    return db.prepare(`DELETE FROM channels WHERE channel_id = ?`).run(channel_id);
  }
}

export default ChannelModel;
