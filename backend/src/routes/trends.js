import express from 'express';
import YouTubeTrendsService from '../services/youtubeTrendsService.js';
import TrendModel from '../models/TrendSQLite.js';
import { COUNTRIES } from '../config/countries.js';
import SettingsModel from '../models/SettingsSQLite.js';
import UserSettingsSQLite from '../models/UserSettingsSQLite.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/trends/countries
 * Получить список поддерживаемых стран
 */
router.get('/countries', (req, res) => {
  res.json({
    success: true,
    count: COUNTRIES.length,
    countries: COUNTRIES
  });
});

/**
 * POST /api/trends/fetch-all
 * Получить тренды для всех регионов
 */
router.post('/fetch-all', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false,
        error: 'API ключ обязателен' 
      });
    }

  // Получаем список отслеживаемых стран (если не настроен — все доступные)
  const defaults = SettingsModel.getTrackedCountries();
  const tracked = UserSettingsSQLite.get(req.user.id, 'tracked_countries_trends', defaults.trends) || defaults.trends;
  console.log(`🌍 Начало загрузки трендов из ${tracked.length} стран...`);
    
  const trendsService = new YouTubeTrendsService(apiKey, tracked);
    const io = req.app.get('io');
    
    // Отправляем прогресс через WebSocket
    const result = await trendsService.getAllRegionsTrends((progress) => {
      io.emit('trends-progress', progress);
    });

  console.log(`✅ Загрузка завершена! Получено ${result.totalVideos} видео`);
    
    // Сохраняем в SQLite (всегда успешно)
    const savedTrends = TrendModel.create({
      data: result.trends,
      totalVideos: result.totalVideos,
      countries: result.countries
    });
    
    console.log('💾 Данные сохранены в SQLite');

    res.json({
      success: true,
      data: result.trends,
      totalVideos: result.totalVideos,
  countries: result.countries,
      errors: result.errors,
      id: savedTrends.id,
      saved: true
    });
  } catch (error) {
    console.error('❌ Ошибка при получении трендов:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/trends/fetch-region
 * Получить тренды для конкретного региона
 */
router.post('/fetch-region', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { apiKey, region, maxResults } = req.body;
    
    if (!apiKey || !region) {
      return res.status(400).json({ 
        success: false,
        error: 'API ключ и код региона обязательны' 
      });
    }
    
    const trendsService = new YouTubeTrendsService(apiKey);
    const trends = await trendsService.getTrendingVideos(region, maxResults || 50);

    res.json({
      success: true,
      region,
      count: trends.length,
      data: trends
    });
  } catch (error) {
    console.error('❌ Ошибка при получении трендов региона:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/trends/latest
 * Получить последние сохраненные тренды
 */
router.get('/latest', async (req, res) => {
  try {
    const latest = TrendModel.findLatest();
    
    if (!latest) {
      return res.json({
        success: true,
        data: null,
        message: 'Нет сохраненных трендов'
      });
    }

    res.json({
      success: true,
      data: latest
    });
  } catch (error) {
    console.error('❌ Ошибка при получении последних трендов:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/trends/history
 * Получить историю трендов
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const history = TrendModel.findHistory(parseInt(limit), skip);
    const total = TrendModel.count();
    
    res.json({
      success: true,
      data: history,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при получении истории трендов:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/trends/:id
 * Получить конкретный набор трендов по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const trend = TrendModel.findById(req.params.id);
    
    if (!trend) {
      return res.status(404).json({
        success: false,
        error: 'Тренды не найдены'
      });
    }

    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    console.error('❌ Ошибка при получении трендов:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
