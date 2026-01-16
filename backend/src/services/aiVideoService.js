import Bull from 'bull';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import AITaskSQLite from '../models/AITaskSQLite.js';
import googleSheetsService from './googleSheetsService.js';
import ttsService from './ttsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AIVideoService {
  constructor() {
    const disableRedis = String(process.env.REDIS_DISABLE || '').toLowerCase();
    this.inlineMode = disableRedis === '1' || disableRedis === 'true' || disableRedis === 'yes';

    // Папка для результатов
    this.outputsDir = path.resolve(__dirname, '..', '..', 'data', 'ai-outputs');
    try { fs.mkdirSync(this.outputsDir, { recursive: true }); } catch {}

    try {
      if (this.inlineMode) throw new Error('Redis disabled');
      this.aiQueue = new Bull('ai-video', {
        redis: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: process.env.REDIS_PORT || 6379,
        },
      });

      // Обработчик
      this.aiQueue.process(async (job) => {
        const { prompt, options } = job.data;
        try {
          let filePath;
          const provider = options?.provider || 'stub';

          // Выбор провайдера генерации
          if (provider === 'rebuild-basic') {
            filePath = await this._rebuildVideoBasic(job.id, options);
          } else {
            filePath = await this._generateStubVideo(job.id, prompt, options);
          }

          try { AITaskSQLite.updateStatus(job.id, 'completed', { resultPath: filePath }); } catch {}
          try {
            const rec = AITaskSQLite.findByJobId(job.id);
            if (rec?.spreadsheet_id && rec?.row_index) {
              await googleSheetsService.updateAIResult({
                spreadsheetId: rec.spreadsheet_id,
                sheet: rec.sheet || 'Videos',
                rowIndex: rec.row_index,
                status: 'completed',
                link: `/api/generator/ai/download/${job.id}`,
              });
            }
          } catch {}
          return { success: true, filePath, prompt };
        } catch (e) {
          try { AITaskSQLite.updateStatus(job.id, 'failed', { error: e?.message }); } catch {}
          throw e;
        }
      });

      // Готовность redis
      const ready = Promise.all([this.aiQueue.isReady()]);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Redis ready timeout')), 1200));
      Promise.race([ready, timeout]).catch(() => {
        this.inlineMode = true;
        try { this.aiQueue && this.aiQueue.close().catch(() => {}); } catch {}
      });
    } catch {
      this.inlineMode = true;
    }
  }

  async addGenerateJob(prompt, options = {}, meta = {}) {
    if (!prompt || String(prompt).trim().length < 5) {
      throw new Error('Prompt слишком короткий');
    }

    const ownerUserId = meta?.ownerUserId || null;

    if (this.inlineMode) {
      const jobId = `ai-${Date.now()}`;
      const provider = options?.provider || 'stub';
      AITaskSQLite.create({ jobId, prompt, options, provider, status: 'active', spreadsheetId: meta?.spreadsheetId || null, sheet: meta?.sheet || null, rowIndex: meta?.rowIndex ?? null, ownerUserId });
      
      let filePath;
      if (provider === 'rebuild-basic') {
        filePath = await this._rebuildVideoBasic(jobId, options);
      } else {
        filePath = await this._generateStubVideo(jobId, prompt, options);
      }

      try { AITaskSQLite.updateStatus(jobId, 'completed', { resultPath: filePath }); } catch {}
      try {
        if (meta?.spreadsheetId && meta?.rowIndex) {
          await googleSheetsService.updateAIResult({
            spreadsheetId: meta.spreadsheetId,
            sheet: meta.sheet || 'Videos',
            rowIndex: meta.rowIndex,
            status: 'completed',
            link: `/api/generator/ai/download/${jobId}`,
          });
        }
      } catch {}
      return { jobId, status: 'completed', inline: true, result: { filePath } };
    }

    const job = await this.aiQueue.add({ prompt, options, ownerUserId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    try { AITaskSQLite.create({ jobId: job.id, prompt, options, provider: options?.provider || 'stub', status: 'pending', spreadsheetId: meta?.spreadsheetId || null, sheet: meta?.sheet || null, rowIndex: meta?.rowIndex ?? null, ownerUserId }); } catch {}
    return { jobId: job.id, status: 'pending' };
  }

  async getJobStatus(jobId) {
    if (this.inlineMode) {
      // В inline-режиме задача уже завершена сразу
      const filePath = path.join(this.outputsDir, `ai_${jobId}.mp4`);
      const exists = fs.existsSync(filePath);
      const dbRec = AITaskSQLite.findByJobId(jobId);
      return { jobId, status: dbRec?.status || (exists ? 'completed' : 'unknown'), result: exists ? { filePath } : undefined };
    }
    const job = await this.aiQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    const result = job.returnvalue;
    return { jobId: job.id, status: state, result };
  }

  async _generateStubVideo(id, prompt, options) {
    // Генерация простого тестового ролика через ffmpeg (если доступен)
    const outFile = path.join(this.outputsDir, `ai_${id}.mp4`);

    // Если уже есть — не перегенерируем
    if (fs.existsSync(outFile)) return outFile;

    const duration = Math.min(15, Math.max(3, parseInt(options?.duration || '5', 10)));
    const size = String(options?.aspect || '1280x720');

    // Проверка ffmpeg
    const ffmpegOk = await new Promise((resolve) => {
      try {
        const p = spawn('ffmpeg', ['-version']);
        p.on('error', () => resolve(false));
        p.on('close', (code) => resolve(code === 0 || code === null));
      } catch {
        resolve(false);
      }
    });

    if (!ffmpegOk) {
      // Если ffmpeg нет — создаём пустой файл-заглушку (0 байт) и пишем prompt в txt
      fs.writeFileSync(outFile, Buffer.alloc(0));
      fs.writeFileSync(outFile.replace(/\.mp4$/, '.txt'), `Prompt: ${prompt}`);
      return outFile;
    }

    // Простая заливка цветом, чтобы не требовать drawtext
    const args = ['-y', '-f', 'lavfi', '-i', `color=c=black:size=${size}:d=${duration}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile];

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', args);
      ff.on('error', (e) => reject(e));
      ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    });

    // Сохраним подсказку рядом
    try { fs.writeFileSync(outFile.replace(/\.mp4$/, '.txt'), `Prompt: ${prompt}`); } catch {}
    return outFile;
  }

  /**
   * Базовый ребилд видео (Фаза 1 MVP)
   * Озвучка из транскрипта + черный экран
   */
  async _rebuildVideoBasic(id, options) {
    const videoId = options?.videoId;
    if (!videoId) {
      throw new Error('videoId обязателен для rebuild');
    }

    console.log(`[RebuildBasic] Начало ребилда для видео: ${videoId}`);
    
    const outFile = path.join(this.outputsDir, `rebuilt_${id}.mp4`);
    if (fs.existsSync(outFile)) return outFile;

    // 1. Читаем parsed JSON
    const pythonWorkersDir = path.resolve(__dirname, '..', '..', '..', 'python-workers');
    const parsedPath = path.join(pythonWorkersDir, `${videoId}_parsed.json`);
    
    if (!fs.existsSync(parsedPath)) {
      throw new Error(`Parsed data не найден: ${videoId}_parsed.json. Сначала запустите парсинг видео.`);
    }

    const parsedData = JSON.parse(fs.readFileSync(parsedPath, 'utf-8'));
    const fullText = parsedData.full_text || '';
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('Транскрипт пустой. Невозможно создать озвучку.');
    }

    console.log(`[RebuildBasic] Транскрипт загружен: ${fullText.length} символов`);

    // 2. Генерация озвучки через ElevenLabs
    console.log('[RebuildBasic] Генерация озвучки...');
    const voiceResult = await ttsService.textToSpeech(fullText, {
      voiceId: options?.voiceId,
      outputPath: path.join(this.outputsDir, `voice_${id}.mp3`)
    });

    console.log(`[RebuildBasic] Озвучка готова: ${voiceResult.audioPath}, ${voiceResult.duration}сек`);

    // 3. Проверка ffmpeg
    const ffmpegOk = await new Promise((resolve) => {
      try {
        const p = spawn('ffmpeg', ['-version']);
        p.on('error', () => resolve(false));
        p.on('close', (code) => resolve(code === 0 || code === null));
      } catch {
        resolve(false);
      }
    });

    if (!ffmpegOk) {
      throw new Error('ffmpeg не установлен. Установите ffmpeg для монтажа видео.');
    }

    // 4. Создание видео: черный экран + озвучка
    const duration = voiceResult.duration || 60; // Fallback
    const size = options?.resolution || '1280x720';

    console.log(`[RebuildBasic] Создание видео: ${size}, ${duration}сек`);

    const args = [
      '-y',
      '-f', 'lavfi', '-i', `color=c=black:size=${size}:d=${duration}`,
      '-i', voiceResult.audioPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      '-movflags', '+faststart',
      outFile
    ];

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', args);
      
      ff.stderr.on('data', (data) => {
        // ffmpeg выводит прогресс в stderr
        const line = data.toString();
        if (line.includes('time=')) {
          process.stdout.write('.');
        }
      });

      ff.on('error', (e) => reject(e));
      ff.on('close', (code) => {
        if (code === 0) {
          console.log('\n[RebuildBasic] Видео готово!');
          resolve();
        } else {
          reject(new Error(`ffmpeg exited ${code}`));
        }
      });
    });

    // 5. Сохраняем метаданные
    try {
      const metaPath = outFile.replace(/\.mp4$/, '_meta.json');
      fs.writeFileSync(metaPath, JSON.stringify({
        sourceVideoId: videoId,
        createdAt: new Date().toISOString(),
        provider: 'rebuild-basic',
        voiceId: voiceResult.voiceId,
        duration: voiceResult.duration,
        textLength: fullText.length,
        cost: ttsService.estimateCost(fullText)
      }, null, 2));
    } catch {}

    console.log(`[RebuildBasic] Ребилд завершён: ${outFile}`);
    return outFile;
  }
}

const aiVideoService = new AIVideoService();
export default aiVideoService;
