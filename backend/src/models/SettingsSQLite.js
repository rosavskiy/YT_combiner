import db from '../config/sqlite.js';
import { getAllCountryCodes } from '../config/countries.js';

/**
 * Простая модель настроек (key/value) на SQLite
 */
class SettingsModel {
  static get(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value ?? defaultValue;
    }
  }

  static set(key, value) {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    db.prepare(`INSERT INTO settings(key, value, updated_at) VALUES(?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(key, json);
    return true;
  }

  static getTrackedCountries() {
    const defaults = getAllCountryCodes();
    const trends = this.get('tracked_countries_trends', defaults);
    const topics = this.get('tracked_countries_topics', defaults);
    return { trends, topics };
  }

  static setTrackedCountries({ trends, topics }) {
    if (Array.isArray(trends)) this.set('tracked_countries_trends', trends);
    if (Array.isArray(topics)) this.set('tracked_countries_topics', topics);
    return this.getTrackedCountries();
  }
}

export default SettingsModel;
