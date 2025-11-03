/**
 * Сервис для работы с видео
 */

import api from './api';

const videosService = {
  /**
   * Скачать видео
   */
  downloadVideo: async (videoId, quality = 'highest', metadata = {}) => {
    const response = await api.post('/videos/download', {
      videoId,
      quality,
      title: metadata.title,
      channel: metadata.channel,
    });
    return response;
  },

  /**
   * Запарсить видео (таймкоды, транскрипт, субтитры)
   */
  parseVideo: async (videoId, options = {}) => {
    const response = await api.post('/videos/parse', {
      videoId,
      languages: options.languages || ['en', 'ru'],
      spreadsheetId: options.spreadsheetId,
    });
    return response;
  },

  /**
   * Получить статус задачи
   */
  getJobStatus: async (jobId, queueType = 'download') => {
    const response = await api.get(`/videos/status/${jobId}`, {
      params: { queueType },
    });
    return response;
  },

  /**
   * Получить очередь загрузок/парсинга
   */
  getQueue: async (queueType = 'download') => {
    const response = await api.get('/videos/queue', {
      params: { queueType },
    });
    return response;
  },

  /**
   * Повторить неудачную задачу
   */
  retryJob: async (jobId, queueType = 'download') => {
    const response = await api.post(`/videos/retry/${jobId}`, {
      queueType,
    });
    return response;
  },

  /**
   * Удалить задачу
   */
  deleteJob: async (jobId, queueType = 'download') => {
    const response = await api.delete(`/videos/${jobId}`, {
      params: { queueType },
    });
    return response;
  },

  /**
   * Получить список скачанных видео
   */
  getDownloadedVideos: async () => {
    const response = await api.get('/videos/downloaded');
    return response;
  },

  /**
   * Получить статистику очереди
   */
  getQueueStats: async (queueType = 'download') => {
    const response = await api.get('/videos/stats', {
      params: { queueType },
    });
    return response;
  },

  /**
   * Обновить заголовки Google Sheets под новую схему
   */
  initSheetsTemplate: async (spreadsheetId, sheetName = 'Videos') => {
    const response = await api.post('/videos/sheets/template', {
      spreadsheetId,
      sheetName,
    });
    return response;
  },

  /**
   * Диагностика форматов для видео
   */
  getFormatsDebug: async (videoId) => {
    const response = await api.get('/videos/debug/formats', { params: { videoId } });
    return response;
  },

  /**
   * Состояние окружения сервера для загрузки
   */
  getSystemHealth: async () => {
    const response = await api.get('/system/health');
    return response;
  },
};

export default videosService;
