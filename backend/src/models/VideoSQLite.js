import db from '../config/sqlite.js';

class VideoModel {
  /**
   * Создать или обновить видео
   */
  static upsert(videoData) {
    const stmt = db.prepare(`
      INSERT INTO videos (
        video_id, title, description, channel, channel_id,
        views, likes, comments, duration, category_id, region, data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        title = excluded.title,
        views = excluded.views,
        likes = excluded.likes,
        comments = excluded.comments
    `);

    stmt.run(
      videoData.videoId,
      videoData.title,
      videoData.description,
      videoData.channel,
      videoData.channelId,
      videoData.views || 0,
      videoData.likes || 0,
      videoData.comments || 0,
      videoData.duration,
      videoData.categoryId,
      videoData.region,
      JSON.stringify(videoData)
    );

    return videoData;
  }

  /**
   * Найти по video_id
   */
  static findByVideoId(videoId) {
    const stmt = db.prepare('SELECT * FROM videos WHERE video_id = ?');
    const row = stmt.get(videoId);
    
    if (!row) return null;
    
    return {
      ...row,
      data: JSON.parse(row.data),
      downloaded: Boolean(row.downloaded),
      processed: Boolean(row.processed)
    };
  }

  /**
   * Получить все скачанные видео
   */
  static findDownloaded() {
    const stmt = db.prepare(`
      SELECT video_id, title, channel, download_path, downloaded_at, views
      FROM videos
      WHERE downloaded = 1
      ORDER BY downloaded_at DESC
    `);

    return stmt.all();
  }

  /**
   * Обновить статус скачивания
   */
  static markAsDownloaded(videoId, downloadPath) {
    const stmt = db.prepare(`
      UPDATE videos
      SET downloaded = 1, download_path = ?, downloaded_at = datetime('now')
      WHERE video_id = ?
    `);

    stmt.run(downloadPath, videoId);
  }

  /**
   * Получить статистику
   */
  static getStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN downloaded = 1 THEN 1 ELSE 0 END) as downloaded,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed
      FROM videos
    `);

    return stmt.get();
  }
}

export default VideoModel;
