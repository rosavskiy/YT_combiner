import db from '../config/sqlite.js';

class ChannelModel {
  static add({ channel_id, title, url, owner_user_id = null }) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO channels (channel_id, title, url, owner_user_id) VALUES (?, ?, ?, ?)`);
    return stmt.run(channel_id, title || null, url || null, owner_user_id || null);
  }

  static upsert({ channel_id, title, url, owner_user_id = null }) {
    const stmt = db.prepare(`
      INSERT INTO channels (channel_id, title, url, owner_user_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET title=excluded.title, url=excluded.url
    `);
    return stmt.run(channel_id, title || null, url || null, owner_user_id || null);
  }

  static all({ owner_user_id = null, isAdmin = false } = {}) {
    if (isAdmin) {
      return db.prepare(`SELECT id, channel_id, title, url, owner_user_id, added_at FROM channels ORDER BY added_at DESC`).all();
    }
    return db.prepare(`SELECT id, channel_id, title, url, owner_user_id, added_at FROM channels WHERE owner_user_id = ? ORDER BY added_at DESC`).all(owner_user_id);
  }

  static remove(channel_id, { owner_user_id = null, isAdmin = false } = {}) {
    if (isAdmin) {
      return db.prepare(`DELETE FROM channels WHERE channel_id = ?`).run(channel_id);
    }
    return db.prepare(`DELETE FROM channels WHERE channel_id = ? AND owner_user_id = ?`).run(channel_id, owner_user_id);
  }
}

export default ChannelModel;
