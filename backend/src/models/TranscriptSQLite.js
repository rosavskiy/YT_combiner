import db from '../config/sqlite.js';

/**
 * Модель для хранения полных транскриптов видео
 */
class TranscriptSQLite {
  /**
   * Сохранить транскрипт в БД
   * @param {string} videoId - ID видео
   * @param {string} fullText - Полный текст транскрипта
   * @param {string} language - Язык транскрипта
   * @param {string} source - Источник (youtube_subtitles, whisper_api, whisper_local)
   * @returns {boolean}
   */
  static save(videoId, fullText, language = 'unknown', source = 'unknown') {
    try {
      const textLength = fullText ? fullText.length : 0;
      
      db.prepare(`
        INSERT INTO transcripts (video_id, full_text, language, source, text_length, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(video_id) DO UPDATE SET
          full_text = excluded.full_text,
          language = excluded.language,
          source = excluded.source,
          text_length = excluded.text_length,
          updated_at = CURRENT_TIMESTAMP
      `).run(videoId, fullText, language, source, textLength);
      
      console.log(`[TranscriptSQLite] Сохранен транскрипт для ${videoId}: ${textLength} символов`);
      return true;
    } catch (error) {
      console.error('[TranscriptSQLite] Ошибка сохранения:', error);
      return false;
    }
  }

  /**
   * Получить транскрипт из БД
   * @param {string} videoId - ID видео
   * @returns {Object|null}
   */
  static get(videoId) {
    try {
      const row = db.prepare(`
        SELECT video_id, full_text, language, source, text_length, created_at, updated_at
        FROM transcripts
        WHERE video_id = ?
      `).get(videoId);
      
      return row || null;
    } catch (error) {
      console.error('[TranscriptSQLite] Ошибка получения:', error);
      return null;
    }
  }

  /**
   * Проверить наличие транскрипта
   * @param {string} videoId - ID видео
   * @returns {boolean}
   */
  static exists(videoId) {
    try {
      const row = db.prepare('SELECT 1 FROM transcripts WHERE video_id = ? LIMIT 1').get(videoId);
      return !!row;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получить превью транскрипта (первые N символов)
   * @param {string} videoId - ID видео
   * @param {number} maxLength - Максимальная длина превью
   * @returns {string}
   */
  static getPreview(videoId, maxLength = 500) {
    try {
      const row = this.get(videoId);
      if (!row || !row.full_text) return '';
      
      const text = row.full_text;
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    } catch (error) {
      return '';
    }
  }

  /**
   * Удалить транскрипт
   * @param {string} videoId - ID видео
   * @returns {boolean}
   */
  static delete(videoId) {
    try {
      db.prepare('DELETE FROM transcripts WHERE video_id = ?').run(videoId);
      console.log(`[TranscriptSQLite] Удален транскрипт для ${videoId}`);
      return true;
    } catch (error) {
      console.error('[TranscriptSQLite] Ошибка удаления:', error);
      return false;
    }
  }

  /**
   * Получить статистику по всем транскриптам
   * @returns {Object}
   */
  static getStats() {
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(text_length) as total_chars,
          AVG(text_length) as avg_chars,
          COUNT(CASE WHEN source = 'youtube_subtitles' THEN 1 END) as youtube_count,
          COUNT(CASE WHEN source LIKE 'whisper%' THEN 1 END) as whisper_count
        FROM transcripts
      `).get();
      
      return stats || { total: 0, total_chars: 0, avg_chars: 0, youtube_count: 0, whisper_count: 0 };
    } catch (error) {
      console.error('[TranscriptSQLite] Ошибка получения статистики:', error);
      return { total: 0, total_chars: 0, avg_chars: 0, youtube_count: 0, whisper_count: 0 };
    }
  }

  /**
   * Получить список всех транскриптов (без полного текста)
   * @param {number} limit
   * @param {number} offset
   * @returns {Array}
   */
  static list(limit = 100, offset = 0) {
    try {
      const rows = db.prepare(`
        SELECT video_id, language, source, text_length, created_at, updated_at
        FROM transcripts
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);
      
      return rows || [];
    } catch (error) {
      console.error('[TranscriptSQLite] Ошибка получения списка:', error);
      return [];
    }
  }
}

export default TranscriptSQLite;
