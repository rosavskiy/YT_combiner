import Bull from 'bull';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import AITaskSQLite from '../models/AITaskSQLite.js';
import googleSheetsService from './googleSheetsService.js';

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
          const filePath = await this._generateStubVideo(job.id, prompt, options);
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

    if (this.inlineMode) {
      const jobId = `ai-${Date.now()}`;
      AITaskSQLite.create({ jobId, prompt, options, provider: options?.provider || 'stub', status: 'active', spreadsheetId: meta?.spreadsheetId || null, sheet: meta?.sheet || null, rowIndex: meta?.rowIndex ?? null });
      const filePath = await this._generateStubVideo(jobId, prompt, options);
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

    const job = await this.aiQueue.add({ prompt, options }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    try { AITaskSQLite.create({ jobId: job.id, prompt, options, provider: options?.provider || 'stub', status: 'pending', spreadsheetId: meta?.spreadsheetId || null, sheet: meta?.sheet || null, rowIndex: meta?.rowIndex ?? null }); } catch {}
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
}

const aiVideoService = new AIVideoService();
export default aiVideoService;
