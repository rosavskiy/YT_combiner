import api from './api';

export const trendsService = {
  // Получить список стран
  getCountries: () => api.get('/trends/countries'),
  
  // Получить тренды для всех регионов
  fetchAllTrends: (apiKey) => api.post('/trends/fetch-all', { apiKey }),
  
  // Получить тренды для региона
  fetchRegionTrends: (apiKey, region, maxResults = 50) => 
    api.post('/trends/fetch-region', { apiKey, region, maxResults }),
  
  // Получить последние тренды
  getLatestTrends: () => api.get('/trends/latest'),
  
  // Получить историю трендов
  getTrendsHistory: (limit = 10, page = 1) => 
    api.get('/trends/history', { params: { limit, page } }),
  
  // Получить конкретный набор трендов
  getTrendsById: (id) => api.get(`/trends/${id}`),
};

export const videosService = {
  // Скачать видео
  downloadVideo: (videoId, quality = 'highest') => 
    api.post('/videos/download', { videoId, quality }),
  
  // Получить информацию о видео
  getVideoInfo: (videoId) => api.get(`/videos/info/${videoId}`),
  
  // Получить статус скачивания
  getDownloadStatus: (jobId) => api.get(`/videos/status/${jobId}`),
  
  // Получить список скачанных видео
  getDownloadedVideos: () => api.get('/videos/downloaded'),
  // Парсить видео
  parseVideo: (videoId, { languages = ['en','ru'], spreadsheetId } = {}) =>
    api.post('/videos/parse', { videoId, languages, spreadsheetId }),
  // Статус задачи (универсальный)
  jobStatus: (jobId, queueType = 'download') => api.get(`/videos/status/${jobId}`, { params: { queueType } }),
};

export const generatorService = {
  // Запустить генерацию с переводом
  translateVideo: (videoId, targetLanguages) => 
    api.post('/generator/translate', { videoId, targetLanguages }),
  
  // Получить статус генерации
  getGenerationStatus: (taskId) => api.get(`/generator/status/${taskId}`),
  
  // Получить поддерживаемые языки
  getSupportedLanguages: () => api.get('/generator/languages'),

  // Прочитать строки из Google Sheets (таблица спарсенных данных)
  getSheetRows: ({ spreadsheetId, sheet = 'Videos', page = 1, pageSize = 10 }) =>
    api.get('/generator/sheets', {
      params: { spreadsheetId, sheet, page, pageSize }
    }),

  // AI генерация видео на сервере
  aiGenerate: (payload) =>
    api.post('/generator/ai/generate', payload),
  aiStatus: (jobId) => api.get(`/generator/ai/status/${jobId}`),
  aiDownloadUrl: (jobId) => `/api/generator/ai/download/${jobId}`,
  aiTasks: ({ q = '', status = '', provider = '', limit = 50, page = 1 } = {}) =>
    api.get('/generator/ai/tasks', { params: { q, status, provider, limit, page } }),
  aiRetry: (jobId) => api.post(`/generator/ai/retry/${jobId}`),
};

export const configService = {
  // Получить API ключ с сервера (только для development)
  getApiKey: () => api.get('/config/api-key'),
  
  // Получить настройки сервера
  getSettings: () => api.get('/config/settings'),

  // Настройки отслеживаемых стран
  getTrackedCountries: () => api.get('/config/tracked-countries'),
  saveTrackedCountries: (payload) => api.put('/config/tracked-countries', payload),
  // Админ: обзор пользовательских настроек
  listUsersSettings: () => api.get('/config/users/settings'),
};

export const worktimeService = {
  start: () => api.post('/worktime/start'),
  stop: () => api.post('/worktime/stop'),
  active: () => api.get('/worktime/active'),
  summary: (params = {}) => api.get('/worktime/summary', { params }),
};

export const topicsService = {
  // Получить все категории тем
  getTopics: () => api.get('/topics'),
  
  // Получить все темы плоским списком
  getAllTopics: () => api.get('/topics/all'),
  
  // Получить статистику по темам
  getStats: () => api.get('/topics/stats'),
  
  // Получить темы конкретной категории
  getTopicsByCategory: (categoryId) => api.get(`/topics/category/${categoryId}`),
  
  // Получить конкретную тему
  getTopicById: (topicId) => api.get(`/topics/${topicId}`),
  
  // Поиск видео по теме
  searchTopic: (apiKey, topicId, region = 'US', maxResults = 10) =>
    api.post('/topics/search', { apiKey, topicId, region, maxResults }),
  
  // Поиск видео по всем темам категории
  searchCategory: (apiKey, categoryId, region = 'US', maxResults = 5) =>
    api.post('/topics/search-all', { apiKey, categoryId, region, maxResults }),
};

export default {
  trends: trendsService,
  videos: videosService,
  generator: generatorService,
  config: configService,
  topics: topicsService,
  worktime: worktimeService,
};
