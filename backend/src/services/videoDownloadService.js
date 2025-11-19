/**
 * Сервис скачивания и парсинга видео
 * Управляет очередью загрузок через Bull Queue
 */

import Bull from 'bull';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import VideoSQLite from '../models/VideoSQLite.js';
import UserSQLite from '../models/UserSQLite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VideoDownloadService {
  constructor() {
    // Пытаемся создать очереди (Redis). Если Redis недоступен — переходим в inline-режим
    const disableRedis = String(process.env.REDIS_DISABLE || '').toLowerCase();
    this.inlineMode = disableRedis === '1' || disableRedis === 'true' || disableRedis === 'yes';
    try {
      if (this.inlineMode) throw new Error('Redis принудительно отключён через REDIS_DISABLE');
      // Создать очередь для скачивания
      this.downloadQueue = new Bull('video-downloads', {
        redis: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: process.env.REDIS_PORT || 6379,
        },
        settings: {
          // чаще проверяем подвисшие задачи
          stalledInterval: 30000, // 30s
          maxStalledCount: 2,
        },
      });

      // Создать очередь для парсинга
      this.parseQueue = new Bull('video-parsing', {
        redis: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: process.env.REDIS_PORT || 6379,
        },
        settings: {
          stalledInterval: 30000, // 30s
          maxStalledCount: 3,
        },
      });
      // Если Redis недоступен, Bull обычно не бросает в конструкторе. Добавим быструю проверку готовности с таймаутом.
      const ready = Promise.all([
        this.downloadQueue.isReady(),
        this.parseQueue.isReady(),
      ]);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Redis ready timeout')), 1200));
      ready.catch(() => { /* ignore */ });
      timeout.catch(() => { /* ignore */ });
      Promise.race([ready, timeout]).catch(() => {
        this.inlineMode = true;
        try { this.downloadQueue && this.downloadQueue.close().catch(() => {}); } catch {}
        try { this.parseQueue && this.parseQueue.close().catch(() => {}); } catch {}
        console.warn('⚠️ Redis не готов — включён inline-режим очередей');
      });
    } catch (e) {
      console.warn('⚠️ Redis недоступен, включен inline-режим очередей (без прогресса).', e?.message);
      this.inlineMode = true;
    }

  this.pythonPath = process.env.PYTHON_PATH || 'python';
  // Путь к директории с Python-воркерами (расположена в корне репозитория)
  // __dirname = <repo>/backend/src/services, поднимаемся на 3 уровня к корню
  this.workersDir = path.resolve(__dirname, '..', '..', '..', 'python-workers');
    this.downloadsDir = path.join(this.workersDir, 'downloads');

    if (!this.inlineMode) {
      this._setupProcessors();
    }
  }

  /**
   * Настроить обработчики очередей
   */
  _setupProcessors() {
    // Обработка скачивания
    this.downloadQueue.process(async (job) => {
      const { videoId, quality } = job.data;

      try {
        // Начальный прогресс
        await job.progress(1);

        let lastPercent = 1;
        let lastSpeed = null;
        let lastEta = null;

        // Запустить Python downloader с парсингом прогресса
        const result = await this._runPythonScript('video_downloader.py', [
          videoId,
          '--quality',
          quality,
          '--output-dir',
          this.downloadsDir,
        ], {
          onStdout: async (text) => {
            // Ищем строки вида: "  [DL] 12.3% | Speed: 1.2MiB/s | ETA: 00:12"
            try {
              const m = text.match(/\[DL\]\s*(\d+(?:\.\d+)?)%\s*\|\s*Speed:\s*([^|]+)\|\s*ETA:\s*(\S+)/);
              if (m) {
                lastPercent = Math.max(1, Math.min(99, Math.round(parseFloat(m[1]))));
                lastSpeed = (m[2] || '').trim();
                lastEta = (m[3] || '').trim();
                await job.progress(lastPercent).catch(() => {});
                try { await job.update({ ...job.data, speed: lastSpeed, eta: lastEta }); } catch {}
              }
            } catch {}
          }
        });

        await job.progress(100).catch(() => {});
        // Опциональная авто-очистка: если пришло имя файла и KEEP_DOWNLOADS=false — удалим файл после скачивания
        try {
          const keep = String(process.env.KEEP_DOWNLOADS || 'true').toLowerCase();
          const filename = result?.filename || result?.data?.filename;
          if (filename && (keep === 'false' || keep === '0' || keep === 'no')) {
            await fs.unlink(filename).catch(() => {});
          }
        } catch {}

        return {
          success: true,
          videoId,
          ...result,
          speed: lastSpeed,
          eta: lastEta,
        };
      } catch (error) {
        throw new Error(`Download failed: ${error.message}`);
      }
    });

    // Обработка парсинга
    this.parseQueue.process(async (job) => {
  const { videoId, languages, spreadsheetId, translateTo, sheetName } = job.data;

      try {
        await job.progress(10);

        // Запустить Python parser
        const args = [videoId];
        if (spreadsheetId) {
          args.push('--spreadsheet', spreadsheetId);
        }
        if (languages) {
          args.push('--languages', ...languages);
        }
        if (translateTo) {
          args.push('--translate-to', translateTo);
        }
        if (sheetName) {
          args.push('--sheet-name', sheetName);
        }

        const credentialsPath = path.join(this.workersDir, 'google-credentials.json');
        if (await this._fileExists(credentialsPath)) {
          args.push('--credentials', credentialsPath);
        }

        const result = await this._runPythonScript('video_parser.py', args, {
          onStdout: async (text) => {
            // Прогресс: PROGRESS: <number>
            const prog = text.match(/PROGRESS:\s*(\d{1,3})/);
            if (prog) {
              const val = Math.max(0, Math.min(100, parseInt(prog[1], 10)));
              job.progress(val).catch(() => {});
            }
            // Этап: STEP: <name>
            const step = text.match(/STEP:\s*([a-zA-Z_]+)/);
            if (step) {
              const currentStep = step[1];
              try {
                await job.update({ ...job.data, currentStep });
              } catch {}
            }
          }
        });

        await job.progress(90);
        await job.progress(100).catch(() => {});

        return {
          success: true,
          videoId,
          ...result,
        };
      } catch (error) {
        throw new Error(`Parsing failed: ${error.message}`);
      }
    });

    // Логирование событий
    this.downloadQueue.on('completed', async (job, result) => {
      try {
        const filename = result?.filename || result?.data?.filename;
        if (filename) {
          VideoSQLite.markAsDownloaded(job.data.videoId, filename);
        } else {
          VideoSQLite.updateStatus(job.data.videoId, 'completed', job.id);
        }
        
        // Автоматический парсинг после скачивания
        const autoParse = process.env.AUTO_PARSE_AFTER_DOWNLOAD !== 'false';
        if (autoParse && job.data.videoId) {
          console.log(`🔄 Автоматический запуск парсинга для: ${job.data.videoId}`);
          try {
            await this.addParseJob(job.data.videoId, {
              languages: ['en', 'ru'],
              autoTriggered: true,
              userId: job.data.userId || null,
            });
          } catch (parseError) {
            console.warn(`⚠️ Не удалось запустить автопарсинг: ${parseError.message}`);
          }
        }
      } catch (e) {
        console.warn('⚠️ Failed to mark downloaded:', e?.message);
      }
      console.log(`✅ Download completed: ${job.data.videoId}`);
    });

    this.downloadQueue.on('failed', (job, err) => {
      console.log(`❌ Download failed: ${job.data.videoId} - ${err.message}`);
    });

    this.parseQueue.on('completed', async (job, result) => {
      console.log(`✅ Parsing completed: ${job.data.videoId}`);
      
      // Отправка webhook на n8n
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (webhookUrl && job.data.videoId) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'video-parsed',
              videoId: job.data.videoId,
              status: 'completed',
              result: result,
              timestamp: new Date().toISOString()
            })
          });
          
          if (response.ok) {
            console.log(`📤 N8N webhook отправлен для: ${job.data.videoId}`);
          } else {
            console.warn(`⚠️ N8N webhook ответил с кодом: ${response.status}`);
          }
        } catch (webhookError) {
          console.warn(`⚠️ Ошибка отправки webhook: ${webhookError.message}`);
        }
      }
    });

    this.parseQueue.on('failed', (job, err) => {
      console.log(`❌ Parsing failed: ${job?.data?.videoId || job?.id} - ${err?.message}`);
      
      // Отправка webhook об ошибке
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      if (webhookUrl && job?.data?.videoId) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'video-parse-failed',
            videoId: job.data.videoId,
            status: 'failed',
            error: err?.message,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {});
      }
    });
    this.parseQueue.on('stalled', (job) => {
      console.log(`⚠️ Parsing job stalled, will retry: ${job.id}`);
    });
  }

  _generateSheetNameForUser(user) {
    if (!user) {
      return null;
    }

    const pieces = [];
    if (user.first_name) pieces.push(String(user.first_name));
    if (user.last_name) pieces.push(String(user.last_name));
    let base = pieces.join(' ').trim();
    if (!base && user.username) base = String(user.username);
    if (!base && user.login) base = String(user.login);
    if (!base && user.telegram_id) base = `tg-${user.telegram_id}`;

    let title = base ? this._sanitizeSheetTitle(base) : '';
    const suffixSource = user.id || user.telegram_id || null;
    if (suffixSource) {
      const suffix = this._sanitizeSheetTitle(`_${suffixSource}`);
      title = title ? `${title}${suffix}` : `User${suffix}`;
    }

    title = this._sanitizeSheetTitle(title || 'User');
    if (!title) {
      title = this._sanitizeSheetTitle(`User_${Date.now()}`);
    }

    return title || 'User';
  }

  _sanitizeSheetTitle(value) {
    if (!value) {
      return '';
    }
    return String(value)
      .replace(/[:\\/?*\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  /**
   * Проверить существование файла
   */
  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Запустить Python скрипт
   */
  _runPythonScript(scriptName, args = [], { onStdout, onStderr } = {}) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.workersDir, scriptName);
      const python = spawn(this.pythonPath, [scriptPath, ...args], {
        cwd: this.workersDir, // чтобы все относительные файлы писались в python-workers, а не в backend
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (typeof onStdout === 'function') {
          try { onStdout(text); } catch {}
        }
        console.log(`[Python] ${text.trim()}`);
      });

      python.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (typeof onStderr === 'function') {
          try { onStderr(text); } catch {}
        }
        console.error(`[Python Error] ${text.trim()}`);
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            // Попытаться извлечь JSON из вывода
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve({ output: stdout, code });
            }
          } catch {
            resolve({ output: stdout, code });
          }
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      python.on('error', (err) => {
        reject(new Error(`Failed to start Python: ${err.message}`));
      });
    });
  }

  /**
   * Добавить видео в очередь скачивания
   */
  async addDownloadJob(videoId, quality = 'highest', userId = null) {
    // Если Redis отсутствует — выполняем загрузку синхронно (inline)
    if (this.inlineMode) {
      const inlineJobId = `direct-${Date.now()}`;
      try {
        const result = await this._runPythonScript('video_downloader.py', [
          videoId,
          '--quality',
          quality,
          '--output-dir',
          this.downloadsDir,
        ]);
        const filename = result?.filename || result?.data?.filename;
        if (filename) {
          try { VideoSQLite.markAsDownloaded(videoId, filename); } catch {}
        } else {
          try { VideoSQLite.updateStatus(videoId, 'completed', inlineJobId); } catch {}
        }
        return {
          jobId: inlineJobId,
          videoId,
          quality,
          status: 'completed',
          result,
          inline: true,
          message: 'Redis недоступен — загрузка выполнена сразу на сервере',
        };
      } catch (error) {
        throw new Error(`Inline download failed: ${error.message}`);
      }
    }

    // Обычный путь через Bull/Redis
    try {
      const job = await this.downloadQueue.add(
        {
          videoId,
          quality,
          userId,
          createdAt: new Date(),
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        }
      );
      return { jobId: job.id, videoId, quality, status: 'pending' };
    } catch (e) {
      // Фолбэк, если Redis упал после запуска
      this.inlineMode = true;
      return this.addDownloadJob(videoId, quality, userId);
    }
  }

  /**
   * Добавить видео в очередь парсинга
   */
  async addParseJob(videoId, options = {}) {
    const { languages = ['en', 'ru', 'uk', 'de', 'fr', 'es'], spreadsheetId = null, userId = null, translateTo = 'ru' } = options;

    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const videoRecord = VideoSQLite.findByVideoId(videoId);
        if (videoRecord?.owner_user_id) {
          resolvedUserId = videoRecord.owner_user_id;
        }
      } catch {}
    }

    let sheetName = null;
    if (spreadsheetId && resolvedUserId) {
      try {
        const user = UserSQLite.findById(resolvedUserId);
        sheetName = this._generateSheetNameForUser(user);
      } catch (err) {
        console.warn('⚠️ Не удалось получить данные пользователя для названия листа:', err?.message);
      }
    }

    if (this.inlineMode) {
      // В inline-режиме парсинг тоже запускаем сразу
      const inlineJobId = `direct-parse-${Date.now()}`;
      try {
        const args = [videoId];
        if (spreadsheetId) args.push('--spreadsheet', spreadsheetId);
        if (languages) args.push('--languages', ...languages);
        if (translateTo) args.push('--translate-to', translateTo);
        if (sheetName) args.push('--sheet-name', sheetName);
        const credentialsPath = path.join(this.workersDir, 'google-credentials.json');
        try { if (await this._fileExists(credentialsPath)) args.push('--credentials', credentialsPath); } catch {}
        const result = await this._runPythonScript('video_parser.py', args);
        try { VideoSQLite.updateStatus(videoId, 'completed', inlineJobId); } catch {}
        return { jobId: inlineJobId, videoId, status: 'completed', result, inline: true };
      } catch (error) {
        throw new Error(`Inline parse failed: ${error.message}`);
      }
    }

    try {
      const job = await this.parseQueue.add(
        {
          videoId,
          languages,
          spreadsheetId,
          translateTo,
          userId: resolvedUserId,
          sheetName,
          createdAt: new Date(),
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        }
      );
      return { jobId: job.id, videoId, status: 'pending' };
    } catch (e) {
      // Фолбэк, если Redis недоступен
      this.inlineMode = true;
      return this.addParseJob(videoId, options);
    }
  }

  /**
   * Получить статус задачи
   */
  async getJobStatus(jobId, queueType = 'download') {
    if (this.inlineMode) {
      // Нет очереди — возвращать минимум информации
      return {
        jobId,
        status: 'unknown',
        progress: 100,
      };
    }
    const queue = queueType === 'download' ? this.downloadQueue : this.parseQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      jobId: job.id,
      videoId: job.data.videoId,
      status: state,
      progress,
      currentStep: job.data.currentStep,
      result,
      error: failedReason,
      createdAt: job.data.createdAt,
      finishedAt: job.finishedOn,
    };
  }

  /**
   * Получить все активные задачи
   */
  async getActiveJobs(queueType = 'download') {
    if (this.inlineMode) {
      return { waiting: [], active: [], completed: [], failed: [] };
    }
    const queue = queueType === 'download' ? this.downloadQueue : this.parseQueue;
    let waiting = [], active = [], completed = [], failed = [];
    try {
      [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
      ]);
    } catch (e) {
      // Фолбэк без Redis
      this.inlineMode = true;
      return { waiting: [], active: [], completed: [], failed: [] };
    }

    const formatJob = async (job) => {
      const state = await job.getState();
      return {
        jobId: job.id,
        videoId: job.data.videoId,
        quality: job.data.quality,
        spreadsheetId: job.data.spreadsheetId,
        currentStep: job.data.currentStep,
        status: state,
        progress: job.progress(),
        createdAt: job.data.createdAt,
        finishedAt: job.finishedOn,
      };
    };

    return {
      waiting: await Promise.all(waiting.map(formatJob)),
      active: await Promise.all(active.map(formatJob)),
      completed: await Promise.all(completed.slice(-20).map(formatJob)), // Последние 20
      failed: await Promise.all(failed.slice(-20).map(formatJob)),
    };
  }

  /**
   * Повторить неудачную задачу
   */
  async retryJob(jobId, queueType = 'download') {
    if (this.inlineMode) {
      throw new Error('Retry недоступен в inline-режиме');
    }
    const queue = queueType === 'download' ? this.downloadQueue : this.parseQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    await job.retry();
    return { success: true, jobId };
  }

  /**
   * Удалить задачу
   */
  async removeJob(jobId, queueType = 'download') {
    if (this.inlineMode) {
      return { success: true, jobId };
    }
    const queue = queueType === 'download' ? this.downloadQueue : this.parseQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    return { success: true, jobId };
  }

  /**
   * Очистить все завершенные задачи
   */
  async cleanCompleted(queueType = 'download') {
    if (this.inlineMode) {
      return { success: true };
    }
    const queue = queueType === 'download' ? this.downloadQueue : this.parseQueue;
    await queue.clean(1000, 'completed');
    return { success: true };
  }

  /**
   * Получить статистику очереди
   */
  async getQueueStats(queueType = 'download') {
    if (this.inlineMode) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 };
    }
    const queue = queueType === 'download' ? this.downloadQueue : this.parseQueue;
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (e) {
      this.inlineMode = true;
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 };
    }
  }

  /**
   * Инициализировать/обновить заголовки Google Sheets под актуальную схему
   */
  async initSheetsTemplate(spreadsheetId, sheetName = 'Videos') {
    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }
    const args = ['--init-template', '--spreadsheet', spreadsheetId, '--sheet-name', sheetName];
    const credentialsPath = path.join(this.workersDir, 'google-credentials.json');
    try {
      if (await this._fileExists(credentialsPath)) {
        args.push('--credentials', credentialsPath);
      }
    } catch {}

    const result = await this._runPythonScript('video_parser.py', args);
    return { success: true, result };
  }

  /**
   * Получить прямой URL прогрессивного формата для скачивания пользователем
   */
  async getDirectVideoUrl(videoId, quality = 'highest') {
    const args = [videoId, '--quality', String(quality), '--direct-url'];
    const result = await this._runPythonScript('video_downloader.py', args);
    return result;
  }

  async getBestAVUrls(videoId, quality = 'highest') {
    const args = [videoId, '--quality', String(quality), '--best-av-urls'];
    const result = await this._runPythonScript('video_downloader.py', args);
    return result;
  }

  /**
   * Получить подробную диагностику форматов (JSON)
   */
  async getFormatsDebug(videoId) {
    const args = [videoId, '--formats-json'];
    const result = await this._runPythonScript('video_downloader.py', args);
    return result;
  }

  /**
   * Получить версию yt-dlp через Python и наличие cookies.txt; а также проверить ffmpeg
   */
  async getSystemHealth() {
    const health = { ffmpeg: false, ffmpegVersion: null, ytDlpVersion: null, hasCookies: false, pythonExecutable: null, ytDlpPath: null };
    // ffmpeg
    try {
      const { spawn } = await import('child_process');
      const p = spawn('ffmpeg', ['-version']);
      let out = '';
      p.stdout.on('data', d => { out += d.toString(); });
      await new Promise((resolve) => {
        p.on('close', () => resolve());
        p.on('error', () => resolve());
      });
      if (out) {
        health.ffmpeg = true;
        const first = out.split(/\r?\n/)[0] || '';
        health.ffmpegVersion = first.trim();
      }
    } catch {}

    // yt-dlp version via python (env dump)
    try {
      const result = await this._runPythonScript('video_downloader.py', ['dummy', '--env-dump']);
      health.ytDlpVersion = result?.yt_dlp_version || null;
      health.hasCookies = !!result?.has_cookies;
      health.pythonExecutable = result?.python_executable || null;
      health.ytDlpPath = result?.yt_dlp_file || null;
    } catch {}

    // cookies.txt existence
    try {
      const cookiesPath = path.join(this.workersDir, 'cookies.txt');
      // if env-dump already set it, keep it; else check fs
      if (typeof health.hasCookies !== 'boolean') {
        health.hasCookies = await this._fileExists(cookiesPath);
      }
    } catch {}

    return health;
  }
}

const videoDownloadService = new VideoDownloadService();
export default videoDownloadService;
