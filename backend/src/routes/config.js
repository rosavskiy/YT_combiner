import express from 'express';
import SettingsModel from '../models/SettingsSQLite.js';
import UserSettingsSQLite from '../models/UserSettingsSQLite.js';
import { authenticateToken, requireApproved, requireAdmin } from '../middleware/auth.js';
import { getAllCountryCodes } from '../config/countries.js';

const router = express.Router();

/**
 * GET /api/config/api-key
 * Получить YouTube API ключ из конфигурации сервера
 * (Только для development режима!)
 */
router.get('/api-key', (req, res) => {
  // В production режиме не отдаем ключ
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'API ключ доступен только в development режиме'
    });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    return res.status(404).json({
      success: false,
      error: 'API ключ не настроен на сервере'
    });
  }

  res.json({
    success: true,
    apiKey: apiKey,
    message: 'API ключ загружен из конфигурации сервера'
  });
});

/**
 * GET /api/config/settings
 * Получить все публичные настройки
 */
router.get('/settings', authenticateToken, requireApproved, (req, res) => {
  res.json({
    success: true,
    settings: {
      nodeEnv: process.env.NODE_ENV || 'development',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      port: process.env.PORT || 3000,
      hasApiKey: !!process.env.YOUTUBE_API_KEY,
      hasMongoDB: !!process.env.MONGODB_URI,
      hasRedis: !!process.env.REDIS_HOST
    }
  });
});

/**
 * GET /api/config/tracked-countries
 * Получить списки отслеживаемых стран для трендов и тем
 */
router.get('/tracked-countries', authenticateToken, requireApproved, (req, res) => {
  // читаем пользовательские списки; если не заданы — дефолтные из SettingsModel
  const defaults = SettingsModel.getTrackedCountries();
  const trends = UserSettingsSQLite.get(req.user.id, 'tracked_countries_trends', defaults.trends) || defaults.trends;
  const topics = UserSettingsSQLite.get(req.user.id, 'tracked_countries_topics', defaults.topics) || defaults.topics;
  res.json({ success: true, trends, topics });
});

/**
 * PUT /api/config/tracked-countries
 * Сохранить списки отслеживаемых стран
 * body: { trends?: string[], topics?: string[] }
 */
router.put('/tracked-countries', authenticateToken, requireApproved, (req, res) => {
  const { trends, topics } = req.body || {};
  const allowed = new Set(getAllCountryCodes());

  const validate = (arr) => Array.isArray(arr) && arr.every((c) => allowed.has(c));

  if (trends && !validate(trends)) {
    return res.status(400).json({ success: false, error: 'Некорректные коды стран для трендов' });
  }
  if (topics && !validate(topics)) {
    return res.status(400).json({ success: false, error: 'Некорректные коды стран для тем' });
  }

  if (Array.isArray(trends)) UserSettingsSQLite.set(req.user.id, 'tracked_countries_trends', trends);
  if (Array.isArray(topics)) UserSettingsSQLite.set(req.user.id, 'tracked_countries_topics', topics);
  const data = {
    trends: UserSettingsSQLite.get(req.user.id, 'tracked_countries_trends', []),
    topics: UserSettingsSQLite.get(req.user.id, 'tracked_countries_topics', []),
  };
  res.json({ success: true, ...data });
});

/**
 * GET /api/config/user-keys
 * Персональные секреты пользователя: YouTube API Key и Google Sheets Spreadsheet ID
 * Хранятся в user_settings и недоступны другим пользователям (кроме имперсонации админом)
 */
router.get('/user-keys', authenticateToken, requireApproved, (req, res) => {
  const youtubeApiKey = UserSettingsSQLite.get(req.user.id, 'youtube_api_key', '');
  const spreadsheetId = UserSettingsSQLite.get(req.user.id, 'sheets_spreadsheet_id', '');
  res.json({ success: true, data: { youtubeApiKey, spreadsheetId } });
});

/**
 * PUT /api/config/user-keys
 * Сохранить персональные секреты
 * body: { youtubeApiKey?: string, spreadsheetId?: string }
 */
router.put('/user-keys', authenticateToken, requireApproved, (req, res) => {
  const { youtubeApiKey, spreadsheetId } = req.body || {};

  const resBody = { saved: [] };

  // Валидация и сохранение
  if (typeof youtubeApiKey !== 'undefined') {
    if (youtubeApiKey !== '' && typeof youtubeApiKey !== 'string') {
      return res.status(400).json({ success: false, error: 'youtubeApiKey должен быть строкой или пустым' });
    }
    if (typeof youtubeApiKey === 'string' && youtubeApiKey !== '' && youtubeApiKey.length < 20) {
      return res.status(400).json({ success: false, error: 'youtubeApiKey слишком короткий' });
    }
    if (!youtubeApiKey) {
      UserSettingsSQLite.delete(req.user.id, 'youtube_api_key');
    } else {
      UserSettingsSQLite.set(req.user.id, 'youtube_api_key', youtubeApiKey);
    }
    resBody.saved.push('youtubeApiKey');
  }

  if (typeof spreadsheetId !== 'undefined') {
    if (spreadsheetId !== '' && typeof spreadsheetId !== 'string') {
      return res.status(400).json({ success: false, error: 'spreadsheetId должен быть строкой или пустым' });
    }
    // Spreadsheet ID обычно 40-60 символов, но оставим мягкую проверку длины
    if (typeof spreadsheetId === 'string' && spreadsheetId !== '' && spreadsheetId.length < 10) {
      return res.status(400).json({ success: false, error: 'spreadsheetId выглядит некорректным' });
    }
    if (!spreadsheetId) {
      UserSettingsSQLite.delete(req.user.id, 'sheets_spreadsheet_id');
    } else {
      UserSettingsSQLite.set(req.user.id, 'sheets_spreadsheet_id', spreadsheetId);
    }
    resBody.saved.push('spreadsheetId');
  }

  const data = {
    youtubeApiKey: UserSettingsSQLite.get(req.user.id, 'youtube_api_key', ''),
    spreadsheetId: UserSettingsSQLite.get(req.user.id, 'sheets_spreadsheet_id', ''),
  };
  res.json({ success: true, ...resBody, data });
});

/**
 * ADMIN: Получить список пользователей + наличие ключей
 * GET /api/config/admin/user-keys
 */
router.get('/admin/user-keys', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = UserSQLite.findAll();
    const data = users.map(u => {
      const hasYoutubeKey = !!UserSettingsSQLite.get(u.id, 'youtube_api_key', '');
      const hasSpreadsheetId = !!UserSettingsSQLite.get(u.id, 'sheets_spreadsheet_id', '');
      return {
        id: u.id,
        login: u.login,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        hasYoutubeKey,
        hasSpreadsheetId,
      };
    });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * ADMIN: Получить ключи конкретного пользователя
 * GET /api/config/admin/user-keys/:id
 */
router.get('/admin/user-keys/:id', authenticateToken, requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (Number.isNaN(targetId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
  const youtubeApiKey = UserSettingsSQLite.get(targetId, 'youtube_api_key', '');
  const spreadsheetId = UserSettingsSQLite.get(targetId, 'sheets_spreadsheet_id', '');
  res.json({ success: true, data: { youtubeApiKey, spreadsheetId } });
});

/**
 * ADMIN: Сохранить ключи для конкретного пользователя
 * PUT /api/config/admin/user-keys/:id
 * body: { youtubeApiKey?: string, spreadsheetId?: string }
 */
router.put('/admin/user-keys/:id', authenticateToken, requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (Number.isNaN(targetId)) return res.status(400).json({ success: false, error: 'Некорректный ID' });
  const { youtubeApiKey, spreadsheetId } = req.body || {};
  const saved = [];
  if (typeof youtubeApiKey !== 'undefined') {
    if (!youtubeApiKey) {
      UserSettingsSQLite.delete(targetId, 'youtube_api_key');
    } else {
      if (youtubeApiKey.length < 20) return res.status(400).json({ success: false, error: 'youtubeApiKey слишком короткий' });
      UserSettingsSQLite.set(targetId, 'youtube_api_key', youtubeApiKey);
    }
    saved.push('youtubeApiKey');
  }
  if (typeof spreadsheetId !== 'undefined') {
    if (!spreadsheetId) {
      UserSettingsSQLite.delete(targetId, 'sheets_spreadsheet_id');
    } else {
      if (spreadsheetId.length < 10) return res.status(400).json({ success: false, error: 'spreadsheetId выглядит некорректным' });
      UserSettingsSQLite.set(targetId, 'sheets_spreadsheet_id', spreadsheetId);
    }
    saved.push('spreadsheetId');
  }
  const data = {
    youtubeApiKey: UserSettingsSQLite.get(targetId, 'youtube_api_key', ''),
    spreadsheetId: UserSettingsSQLite.get(targetId, 'sheets_spreadsheet_id', ''),
  };
  res.json({ success: true, saved, data });
});

// Админ: обзор пользовательских настроек (без секретов)
import UserSQLite from '../models/UserSQLite.js';
router.get('/users/settings', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = UserSQLite.findAll();
    const data = users.map(u => ({
      user: { id: u.id, login: u.login, username: u.username, first_name: u.first_name, last_name: u.last_name },
      settings: {
        tracked_countries_trends: UserSettingsSQLite.get(u.id, 'tracked_countries_trends', null),
        tracked_countries_topics: UserSettingsSQLite.get(u.id, 'tracked_countries_topics', null),
        // Секреты умышленно не возвращаем в админский обзор
      }
    }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
