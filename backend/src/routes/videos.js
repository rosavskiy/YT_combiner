import express from 'express';
import Queue from 'bull';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import Video from '../models/Video.js';

const router = express.Router();

// Создаем очередь для скачивания видео
const downloadQueue = new Queue('video-download', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

// Обработчик очереди
downloadQueue.process(async (job) => {
  const { videoId, quality, io } = job.data;
  
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const downloadPath = process.env.DOWNLOAD_PATH || './downloads';
  const outputPath = path.join(downloadPath, `${videoId}.mp4`);
  
  // Создаем папку если не существует
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const video = ytdl(videoUrl, { 
      quality: quality || 'highest',
      filter: 'audioandvideo'
    });
    
    const writeStream = fs.createWriteStream(outputPath);
    video.pipe(writeStream);
    
    let downloadedBytes = 0;
    
    video.on('progress', (chunkLength, downloaded, total) => {
      downloadedBytes = downloaded;
      const percent = (downloaded / total) * 100;
      job.progress(percent);
      
      if (io) {
        io.emit('download-progress', {
          videoId,
          percent: percent.toFixed(2),
          downloaded,
          total,
          speed: chunkLength
        });
      }
    });
    
    writeStream.on('finish', async () => {
      // Обновляем запись в БД
      await Video.findOneAndUpdate(
        { videoId },
        {
          downloaded: true,
          downloadPath: outputPath,
          downloadedAt: new Date()
        },
        { upsert: true }
      );
      
      resolve({ 
        videoId, 
        path: outputPath,
        size: fs.statSync(outputPath).size
      });
    });
    
    video.on('error', (error) => {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(error);
    });
  });
});

/**
 * POST /api/videos/download
 * Скачать видео
 */
router.post('/download', async (req, res) => {
  try {
    const { videoId, quality } = req.body;
    const io = req.app.get('io');
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        error: 'Video ID обязателен' 
      });
    }

    // Проверяем, не скачано ли уже
    const existingVideo = await Video.findOne({ videoId });
    if (existingVideo?.downloaded) {
      return res.json({
        success: true,
        message: 'Видео уже скачано',
        data: existingVideo
      });
    }

    const job = await downloadQueue.add({
      videoId,
      quality,
      io
    });

    res.json({
      success: true,
      jobId: job.id,
      message: 'Скачивание начато'
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
 * GET /api/videos/info/:videoId
 * Получить информацию о видео
 */
router.get('/info/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const info = await ytdl.getInfo(videoUrl);
    
    res.json({
      success: true,
      data: {
        videoId: info.videoDetails.videoId,
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        lengthSeconds: info.videoDetails.lengthSeconds,
        viewCount: info.videoDetails.viewCount,
        thumbnails: info.videoDetails.thumbnails,
        description: info.videoDetails.description,
        formats: info.formats
          .filter(f => f.hasVideo && f.hasAudio)
          .map(f => ({
            quality: f.qualityLabel,
            container: f.container,
            contentLength: f.contentLength
          }))
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при получении информации о видео:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/videos/status/:jobId
 * Получить статус скачивания
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const job = await downloadQueue.getJob(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Задача не найдена' 
      });
    }

    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;

    res.json({
      success: true,
      state,
      progress,
      data: job.data,
      result
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
 * GET /api/videos/downloaded
 * Получить список скачанных видео
 */
router.get('/downloaded', async (req, res) => {
  try {
    const videos = await Video.find({ downloaded: true })
      .sort({ downloadedAt: -1 })
      .select('videoId title channel downloadPath downloadedAt views');
    
    res.json({
      success: true,
      count: videos.length,
      data: videos
    });
  } catch (error) {
    console.error('❌ Ошибка при получении списка видео:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
