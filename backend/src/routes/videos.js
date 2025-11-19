import express from 'express';
import VideoSQLite from '../models/VideoSQLite.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import UserMetricsSQLite from '../models/UserMetricsSQLite.js';

const router = express.Router();

/**
 * POST /api/videos/download
 * Добавить видео в очередь скачивания
 */
router.post('/download', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { videoId, quality = 'highest' } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        error: 'Video ID обязателен' 
      });
    }

    // Проверить, не скачано ли уже
    const existingVideo = VideoSQLite.findByVideoId(videoId);
    if (existingVideo?.downloaded) {
      return res.json({
        success: true,
        message: 'Видео уже скачано',
        data: existingVideo
      });
    }

    // Добавить в очередь
  // Динамический импорт сервиса, чтобы не падать без Redis
  const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
  const job = await videoDownloadService.addDownloadJob(videoId, quality, req.user.id);

    // Создать/обновить запись в БД
    VideoSQLite.upsert({
      videoId,
      title: req.body.title || 'Loading...',
      channel: req.body.channel || '',
      quality,
      status: 'pending',
      jobId: job.jobId,
      ownerUserId: req.user.id
    });

    // инкремент метрики пользователю
    try { if (req.user?.id) UserMetricsSQLite.inc(req.user.id, 'videos_downloaded', 1); } catch {}

    res.json({
      success: true,
      ...job,
      message: 'Видео добавлено в очередь скачивания'
    });
  } catch (error) {
    console.error('❌ Ошибка при запуске скачивания:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/videos/parse
 * Добавить видео в очередь парсинга
 */
router.post('/parse', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { videoId, languages, spreadsheetId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        error: 'Video ID обязателен' 
      });
    }

    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const job = await videoDownloadService.addParseJob(videoId, {
      languages: languages || ['en', 'ru'],
      spreadsheetId,
      userId: req.user.id,
    });

    try { if (req.user?.id) UserMetricsSQLite.inc(req.user.id, 'videos_parsed', 1); } catch {}

    res.json({
      success: true,
      ...job,
      message: 'Видео добавлено в очередь парсинга'
    });
  } catch (error) {
    console.error('❌ Ошибка при запуске парсинга:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/videos/status/:jobId
 * Получить статус задачи
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { queueType = 'download' } = req.query;
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const status = await videoDownloadService.getJobStatus(req.params.jobId, queueType);
    
    if (!status) {
      return res.status(404).json({ 
        success: false,
        error: 'Задача не найдена' 
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Ошибка при получении статуса:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/videos/queue
 * Получить все активные задачи
 */
router.get('/queue', async (req, res) => {
  try {
    const { queueType = 'download' } = req.query;
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const jobs = await videoDownloadService.getActiveJobs(queueType);

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('❌ Ошибка при получении очереди:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/videos/retry/:jobId
 * Повторить неудачную задачу
 */
router.post('/retry/:jobId', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { queueType = 'download' } = req.body;
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const result = await videoDownloadService.retryJob(req.params.jobId, queueType);

    res.json({
      success: true,
      ...result,
      message: 'Задача перезапущена'
    });
  } catch (error) {
    console.error('❌ Ошибка при повторе задачи:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * DELETE /api/videos/:jobId
 * Удалить задачу
 */
router.delete('/:jobId', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { queueType = 'download' } = req.query;
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const result = await videoDownloadService.removeJob(req.params.jobId, queueType);

    res.json({
      success: true,
      ...result,
      message: 'Задача удалена'
    });
  } catch (error) {
    console.error('❌ Ошибка при удалении задачи:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/videos/downloaded
 * Получить список скачанных видео из БД
 */
router.get('/downloaded', authenticateToken, requireApproved, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const downloaded = VideoSQLite.findDownloaded({ owner_user_id: req.user.id, isAdmin });
    res.json({ success: true, count: downloaded.length, data: downloaded });
  } catch (error) {
    console.error('❌ Ошибка при получении списка видео:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/videos/download/file
 * Скачать уже сохранённый на сервере файл пользователю
 * Query: videoId
 */
router.get('/download/file', async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId обязателен' });
    }
    const rec = VideoSQLite.findByVideoId(String(videoId));
    if (!rec || !rec.downloaded || !rec.download_path) {
      return res.status(404).json({ success: false, error: 'Файл не найден. Видео ещё не скачано на сервер.' });
    }
    const filePath = rec.download_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Файл отсутствует на диске сервера' });
    }
    const safe = (s) => String(s || '').replace(/[^\w\-\.\s\u0400-\u04FF]/g, '').trim() || String(videoId);
    const ext = path.extname(filePath) || '.mp4';
    const filename = `${safe(rec.title || rec.video_id)}_${rec.video_id}${ext}`.replace(/\s+/g, ' ').trim();
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Ошибка отправки файла:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: err.message });
        }
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при отдаче файла:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/videos/stats
 * Получить статистику очереди
 */
router.get('/stats', authenticateToken, requireApproved, async (req, res) => {
  try {
    // очередь статусов оставляем глобальной, но добавим пользовательскую статистику
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const queueStats = await videoDownloadService.getQueueStats('download');
    const isAdmin = req.user.role === 'admin';
    const videoStats = VideoSQLite.getStats({ owner_user_id: req.user.id, isAdmin });
    res.json({ success: true, data: { queue: queueStats, videos: videoStats } });
  } catch (error) {
    console.error('❌ Ошибка при получении статистики:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/videos/download/stream
 * Проксировать прямую загрузку прогрессивного формата пользователю
 * Query: videoId, quality=highest|1080|720|480|360
 */
router.get('/download/stream', async (req, res) => {
  try {
    const { videoId, quality = 'highest' } = req.query;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId обязателен' });
    }
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const desired = String(quality);
    const tryQualities = desired === 'highest' ? ['highest', '1080', '720', '480', '360'] : [desired, '720', '480', '360'];
    let info = null;
    for (const q of tryQualities) {
      try {
        const r = await videoDownloadService.getDirectVideoUrl(String(videoId), q);
        if (r && r.url) { info = r; break; }
      } catch {}
    }
    if (info && info.url) {
      // Прямой прогрессивный поток — проксируем как есть
      const safe = (s) => String(s || '').replace(/[^\w\-\.\s\u0400-\u04FF]/g, '').trim() || String(videoId);
      const filename = `${safe(info.title)}_${videoId}_${info.height || ''}p.${info.ext || 'mp4'}`.replace(/\s+/g, ' ').trim();

      const targetUrl = new URL(info.url);
      const client = targetUrl.protocol === 'https:' ? https : http;
      const upstreamHeaders = {};
      if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;
      if (req.headers['user-agent']) upstreamHeaders['User-Agent'] = req.headers['user-agent'];
      const upstreamReq = client.request(targetUrl, { headers: upstreamHeaders }, (upstreamRes) => {
        const contentType = upstreamRes.headers['content-type'] || 'video/mp4';
        const statusCode = upstreamRes.statusCode || 200;
        res.status(statusCode);
        res.setHeader('Content-Type', contentType);
        if (upstreamRes.headers['content-length']) res.setHeader('Content-Length', upstreamRes.headers['content-length']);
        res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges'] || 'bytes');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        upstreamRes.pipe(res);
      });
      upstreamReq.on('error', (err) => {
        console.error('❌ Ошибка проксирования загрузки:', err);
        if (!res.headersSent) res.status(502).json({ success: false, error: err.message }); else res.end();
      });
      upstreamReq.end();
      return;
    }

    // Fallback: раздельные A/V + ffmpeg mux и стрим
    let av = null;
    for (const q of tryQualities) {
      try {
        const r = await videoDownloadService.getBestAVUrls(String(videoId), q);
        if (r && r.success && r.video?.url && r.audio?.url) { av = r; break; }
      } catch {}
    }
    if (!av || av.success === false || !av.video?.url || !av.audio?.url) {
      return res.status(502).json({ success: false, error: av?.error || info?.error || 'Не удалось получить форматы' });
    }

    // Проверить доступность ffmpeg
    const { spawn } = await import('child_process');
    let ffmpegOk = true;
    try {
      const test = spawn('ffmpeg', ['-version']);
      test.on('error', () => { ffmpegOk = false; });
      // маленькое ожидание
      await new Promise(r => setTimeout(r, 150));
      try { test.kill(); } catch {}
    } catch { ffmpegOk = false; }

    if (!ffmpegOk) {
      return res.status(501).json({ success: false, error: 'FFmpeg недоступен на сервере. Установите ffmpeg или выберите более низкое качество (прогрессивное).'});
    }

    // Выбор контейнера
    const vcodec = String(av.video.vcodec || '').toLowerCase();
    const acodec = String(av.audio.acodec || '').toLowerCase();
    const isMp4 = (vcodec.includes('avc') || vcodec.includes('h264')) && (acodec.includes('aac') || acodec.includes('mp4a'));
    const container = isMp4 ? 'mp4' : 'webm';

    const safe = (s) => String(s || '').replace(/[^\w\-\.\s\u0400-\u04FF]/g, '').trim() || String(videoId);
    const filename = `${safe(av.title)}_${videoId}_${av.video.height || ''}p.${container}`.replace(/\s+/g, ' ').trim();

    res.setHeader('Content-Type', container === 'mp4' ? 'video/mp4' : 'video/webm');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    const args = [
      '-loglevel', 'error',
      '-i', av.video.url,
      '-i', av.audio.url,
      '-c', 'copy',
      ...(container === 'mp4' ? ['-movflags', '+frag_keyframe+empty_moov'] : []),
      '-f', container,
      'pipe:1'
    ];
    const ff = spawn('ffmpeg', args);
    ff.stdout.pipe(res);
    ff.stderr.on('data', (d) => { /* optional log */ });
    ff.on('error', (err) => {
      console.error('❌ FFmpeg error:', err);
      if (!res.headersSent) res.status(502).json({ success: false, error: err.message }); else res.end();
    });
    ff.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ FFmpeg exited with code', code);
        if (!res.headersSent) res.status(502).json({ success: false, error: `ffmpeg exited ${code}` }); else res.end();
      } else {
        res.end();
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при прямой загрузке:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/videos/debug/formats
 * Диагностика форматов для videoId
 */
router.get('/debug/formats', async (req, res) => {
  try {
    const { videoId } = req.query;
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'videoId обязателен' });
    }
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const result = await videoDownloadService.getFormatsDebug(String(videoId));
    if (!result || result.success === false) {
      return res.status(502).json({ success: false, error: result?.error || 'Не удалось получить форматы' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Ошибка диагностики форматов:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/videos/sheets/template
 * Обновить заголовки Google Sheets под новую схему
 */
router.post('/sheets/template', async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body || {};
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'spreadsheetId обязателен' });
    }
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const result = await videoDownloadService.initSheetsTemplate(spreadsheetId, sheetName || 'Videos');
    res.json({ success: true, data: result, message: 'Заголовки обновлены' });
  } catch (error) {
    console.error('❌ Ошибка при обновлении заголовков Sheets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/videos/:videoId/transcript
 * Получить транскрипт (текст) видео
 */
router.get('/:videoId/transcript', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // Проверяем, есть ли видео в БД
    const video = VideoSQLite.findByVideoId(videoId);
    
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Видео не найдено в базе'
      });
    }
    
    // Проверяем, есть ли сохраненный парсинг
    const parseDataPath = path.join(process.cwd(), 'python-workers', `${videoId}_parsed.json`);
    
    if (fs.existsSync(parseDataPath)) {
      const parseData = JSON.parse(fs.readFileSync(parseDataPath, 'utf-8'));
      
      return res.json({
        success: true,
        data: {
          videoId,
          title: parseData.info?.title || video.title,
          fullText: parseData.full_text || '',
          transcript: parseData.transcript || null,
          chapters: parseData.chapters || [],
          parsed: true
        }
      });
    }
    
    // Если парсинга нет, предлагаем запустить
    res.json({
      success: true,
      data: {
        videoId,
        title: video.title,
        fullText: null,
        transcript: null,
        chapters: [],
        parsed: false,
        message: 'Видео не распарсено. Используйте POST /api/videos/parse'
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения транскрипта:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/videos/webhook/n8n
 * Webhook для уведомлений n8n о завершении парсинга
 */
router.post('/webhook/n8n', async (req, res) => {
  try {
    const { videoId, status, data } = req.body;
    
    // Логируем для отладки
    console.log('[N8N Webhook] Получено уведомление:', { videoId, status });
    
    // Отправляем уведомление через Socket.IO если есть
    const io = req.app.get('io');
    if (io) {
      io.emit('video-parsed', { videoId, status, data });
    }
    
    // Обновляем статус в БД
    if (videoId) {
      VideoSQLite.updateStatus(videoId, status === 'completed' ? 'parsed' : 'error');
    }
    
    res.json({ success: true, received: true });
  } catch (error) {
    console.error('❌ Ошибка N8N webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
