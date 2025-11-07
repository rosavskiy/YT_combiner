import express from 'express';
import YouTubeTrendsService from '../services/youtubeTrendsService.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { TOPICS, getAllTopics, getTopicById, getTopicsByCategory, getTopicsStats } from '../config/topics.js';

const router = express.Router();

/**
 * GET /api/topics
 * Получить все категории тем
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: TOPICS,
    stats: getTopicsStats()
  });
});

/**
 * GET /api/topics/all
 * Получить все темы плоским списком
 */
router.get('/all', (req, res) => {
  res.json({
    success: true,
    data: getAllTopics()
  });
});

/**
 * GET /api/topics/stats
 * Получить статистику по темам
 */
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    data: getTopicsStats()
  });
});

/**
 * GET /api/topics/category/:categoryId
 * Получить темы конкретной категории
 */
router.get('/category/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  const topics = getTopicsByCategory(categoryId);
  
  if (topics.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Категория не найдена'
    });
  }

  res.json({
    success: true,
    data: topics
  });
});

/**
 * GET /api/topics/:topicId
 * Получить конкретную тему
 */
router.get('/:topicId', (req, res) => {
  const { topicId } = req.params;
  const topic = getTopicById(topicId);
  
  if (!topic) {
    return res.status(404).json({
      success: false,
      error: 'Тема не найдена'
    });
  }

  res.json({
    success: true,
    data: topic
  });
});

/**
 * POST /api/topics/search
 * Поиск видео по конкретной теме
 */
router.post('/search', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { apiKey, topicId, region = 'US', maxResults = 10 } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API ключ обязателен'
      });
    }

    if (!topicId) {
      return res.status(400).json({
        success: false,
        error: 'ID темы обязателен'
      });
    }

    const topic = getTopicById(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Тема не найдена'
      });
    }

    console.log(`🔍 Поиск видео по теме: "${topic.title}" в регионе ${region}`);

    const trendsService = new YouTubeTrendsService(apiKey);
    const results = [];

    // Поиск по каждому поисковому запросу темы
    for (const query of topic.searchQueries) {
      console.log(`  📝 Запрос: "${query}"`);
      
      try {
        const videos = await trendsService.searchVideos(query, region, maxResults);
        results.push({
          query,
          count: videos.length,
          videos: videos.map(video => ({
            ...video,
            searchQuery: query
          }))
        });
      } catch (error) {
        console.error(`  ❌ Ошибка при поиске "${query}":`, error.message);
        results.push({
          query,
          error: error.message,
          videos: []
        });
      }
    }

    // Собираем все уникальные видео
    const allVideos = [];
    const videoIds = new Set();

    results.forEach(result => {
      if (result.videos) {
        result.videos.forEach(video => {
          if (!videoIds.has(video.videoId)) {
            videoIds.add(video.videoId);
            allVideos.push(video);
          }
        });
      }
    });

    console.log(`✅ Найдено ${allVideos.length} уникальных видео`);

    res.json({
      success: true,
      topic: {
        id: topic.id,
        title: topic.title,
        category: topic.categoryName
      },
      region,
      totalVideos: allVideos.length,
      searchResults: results,
      videos: allVideos.slice(0, maxResults) // Ограничиваем итоговый список
    });

  } catch (error) {
    console.error('❌ Ошибка при поиске по теме:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/topics/search-all
 * Поиск видео по всем темам категории
 */
router.post('/search-all', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { apiKey, categoryId, region = 'US', maxResults = 5 } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API ключ обязателен'
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        error: 'ID категории обязателен'
      });
    }

    const topics = getTopicsByCategory(categoryId);
    if (topics.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Категория не найдена'
      });
    }

    console.log(`🔍 Поиск видео по категории "${categoryId}" (${topics.length} тем)`);

    const trendsService = new YouTubeTrendsService(apiKey);
    const io = req.app.get('io');
    const categoryResults = [];
    let processedTopics = 0;

    for (const topic of topics) {
      console.log(`  📝 Тема: "${topic.title}"`);
      
      const topicResults = {
        topicId: topic.id,
        title: topic.title,
        videos: []
      };

      // Берем только первый поисковый запрос для быстроты
      const query = topic.searchQueries[0];
      
      try {
        const videos = await trendsService.searchVideos(query, region, maxResults);
        topicResults.videos = videos;
        topicResults.count = videos.length;
      } catch (error) {
        console.error(`  ❌ Ошибка: ${error.message}`);
        topicResults.error = error.message;
        topicResults.count = 0;
      }

      categoryResults.push(topicResults);
      processedTopics++;

      // Отправляем прогресс
      const progress = Math.round((processedTopics / topics.length) * 100);
      io.emit('topics-search-progress', {
        categoryId,
        progress,
        processed: processedTopics,
        total: topics.length,
        currentTopic: topic.title
      });
    }

    const totalVideos = categoryResults.reduce((sum, r) => sum + (r.count || 0), 0);
    console.log(`✅ Найдено ${totalVideos} видео по ${topics.length} темам`);

    res.json({
      success: true,
      categoryId,
      region,
      totalTopics: topics.length,
      totalVideos,
      results: categoryResults
    });

  } catch (error) {
    console.error('❌ Ошибка при поиске по категории:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
