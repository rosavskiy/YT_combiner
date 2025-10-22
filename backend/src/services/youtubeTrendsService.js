import { google } from 'googleapis';
import { COUNTRIES, getAllCountryCodes } from '../config/countries.js';

class YouTubeTrendsService {
  constructor(apiKey) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    });
    
    this.regions = getAllCountryCodes();
  }

  /**
   * Получить трендовые видео для региона
   */
  async getTrendingVideos(regionCode, maxResults = 50) {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        chart: 'mostPopular',
        regionCode: regionCode,
        maxResults: maxResults
      });

      return this.parseVideos(response.data.items, regionCode);
    } catch (error) {
      console.error(`❌ Ошибка получения трендов для ${regionCode}:`, error.message);
      throw error;
    }
  }

  /**
   * Парсинг данных видео
   */
  parseVideos(items, region) {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    return items.map(item => ({
      videoId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      channel: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails,
      views: parseInt(item.statistics?.viewCount || 0),
      likes: parseInt(item.statistics?.likeCount || 0),
      comments: parseInt(item.statistics?.commentCount || 0),
      duration: item.contentDetails.duration,
      tags: item.snippet.tags || [],
      categoryId: item.snippet.categoryId,
      region: region,
      fetchedAt: new Date().toISOString()
    }));
  }

  /**
   * Получить тренды для всех регионов
   */
  async getAllRegionsTrends(progressCallback) {
    const allTrends = {};
    const errors = {};
    let completed = 0;
    
    console.log(`🌍 Начало получения трендов для ${this.regions.length} стран...`);
    
    for (const region of this.regions) {
      try {
        console.log(`📊 Обработка: ${region}...`);
        allTrends[region] = await this.getTrendingVideos(region);
        completed++;
        
        if (progressCallback) {
          progressCallback({
            region,
            completed,
            total: this.regions.length,
            percentage: Math.round((completed / this.regions.length) * 100),
            success: true
          });
        }
        
        // Небольшая задержка для соблюдения rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Ошибка для ${region}:`, error.message);
        errors[region] = error.message;
        allTrends[region] = [];
        
        if (progressCallback) {
          progressCallback({
            region,
            completed: ++completed,
            total: this.regions.length,
            percentage: Math.round((completed / this.regions.length) * 100),
            success: false,
            error: error.message
          });
        }
      }
    }
    
    console.log(`✅ Завершено! Успешно: ${Object.keys(allTrends).length - Object.keys(errors).length}/${this.regions.length}`);
    
    return {
      trends: allTrends,
      errors: Object.keys(errors).length > 0 ? errors : null,
      totalVideos: Object.values(allTrends).reduce((sum, videos) => sum + videos.length, 0),
      countries: this.regions
    };
  }

  /**
   * Получить детальную информацию о видео
   */
  async getVideoDetails(videoId) {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: [videoId]
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Ошибка получения информации о видео ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Получить информацию о канале
   */
  async getChannelInfo(channelId) {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: [channelId]
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Ошибка получения информации о канале ${channelId}:`, error.message);
      throw error;
    }
  }

  /**
   * Поиск видео по ключевым словам
   */
  async searchVideos(query, regionCode = 'US', maxResults = 10) {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        regionCode: regionCode,
        maxResults: maxResults,
        order: 'viewCount', // Сортировка по просмотрам
        relevanceLanguage: 'en' // Предпочтение английскому
      });

      // Получаем ID видео из результатов поиска
      const videoIds = response.data.items
        .filter(item => item.id.videoId)
        .map(item => item.id.videoId);

      if (videoIds.length === 0) {
        return [];
      }

      // Получаем полную информацию о видео (статистику)
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: videoIds
      });

      return this.parseVideos(videosResponse.data.items, regionCode);
    } catch (error) {
      console.error(`❌ Ошибка поиска видео по запросу "${query}":`, error.message);
      throw error;
    }
  }
}

export default YouTubeTrendsService;
