import express from 'express';
import SettingsModel from '../models/SettingsSQLite.js';
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
router.get('/settings', (req, res) => {
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
router.get('/tracked-countries', (req, res) => {
  const data = SettingsModel.getTrackedCountries();
  res.json({ success: true, ...data });
});

/**
 * PUT /api/config/tracked-countries
 * Сохранить списки отслеживаемых стран
 * body: { trends?: string[], topics?: string[] }
 */
router.put('/tracked-countries', (req, res) => {
  const { trends, topics } = req.body || {};
  const allowed = new Set(getAllCountryCodes());

  const validate = (arr) => Array.isArray(arr) && arr.every((c) => allowed.has(c));

  if (trends && !validate(trends)) {
    return res.status(400).json({ success: false, error: 'Некорректные коды стран для трендов' });
  }
  if (topics && !validate(topics)) {
    return res.status(400).json({ success: false, error: 'Некорректные коды стран для тем' });
  }

  const saved = SettingsModel.setTrackedCountries({ trends, topics });
  res.json({ success: true, ...saved });
});

export default router;
