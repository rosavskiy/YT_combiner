import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import aiVideoService from '../services/aiVideoService.js';

const router = express.Router();

/**
 * POST /api/generator/translate
 * Запустить процесс генерации видео с переводом
 */
router.post('/translate', async (req, res) => {
  try {
    const { videoId, targetLanguages } = req.body;
    
    if (!videoId || !targetLanguages || !Array.isArray(targetLanguages)) {
      return res.status(400).json({
        success: false,
        error: 'videoId и targetLanguages (массив) обязательны'
      });
    }

    // TODO: Интеграция с Python worker
    // const pythonWorkerUrl = process.env.PYTHON_WORKER_URL || 'http://localhost:5000';
    // const response = await axios.post(`${pythonWorkerUrl}/generate`, {
    //   videoId,
    //   targetLanguages
    // });

    res.json({
      success: true,
      message: 'Генерация запущена (TODO: интеграция с Python worker)',
      videoId,
      targetLanguages
    });
  } catch (error) {
    console.error('❌ Ошибка при запуске генерации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/generator/status/:taskId
 * Получить статус генерации
 */
router.get('/status/:taskId', async (req, res) => {
  try {
    // TODO: Получить статус из Python worker
    res.json({
      success: true,
      taskId: req.params.taskId,
      status: 'pending',
      message: 'TODO: интеграция с Python worker'
    });
  } catch (error) {
    console.error('❌ Ошибка при получении статуса генерации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/generator/languages
 * Получить список поддерживаемых языков для перевода
 */
router.get('/languages', (req, res) => {
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
    { code: 'no', name: 'Norsk', flag: '🇳🇴' },
    { code: 'da', name: 'Dansk', flag: '🇩🇰' },
    { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'he', name: 'עברית', flag: '🇮🇱' }
  ];

  res.json({
    success: true,
    count: languages.length,
    languages
  });
});

export default router;

// ===== Sheets helpers and endpoint =====

async function getSheetsClient() {
  // 1) Прямые креды из переменной окружения
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const raw = process.env.GOOGLE_CREDENTIALS_JSON;
      const creds = JSON.parse(raw);
      const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
      const auth = new google.auth.JWT(
        creds.client_email,
        null,
        creds.private_key,
        scopes
      );
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    } catch (e) {
      console.warn('GOOGLE_CREDENTIALS_JSON задан, но не получилось распарсить:', e?.message);
    }
  }

  // 2) Поиск файла с кредами по нескольким путям
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '../../..'); // .../YT_combiner
  const candidates = [
    process.env.GOOGLE_CREDENTIALS_PATH,
    path.join(repoRoot, 'python-workers', 'google-credentials.json'),
    path.join(process.cwd(), '..', 'python-workers', 'google-credentials.json'),
    path.join(process.cwd(), 'python-workers', 'google-credentials.json'),
  ].filter(Boolean);

  let foundPath = null;
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) { foundPath = p; break; }
    } catch {}
  }

  if (!foundPath) {
    throw new Error(`Не найден файл учетных данных Google. Укажите GOOGLE_CREDENTIALS_PATH или GOOGLE_CREDENTIALS_JSON. Искомые пути: ${candidates.join(' | ')}`);
  }

  const creds = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    scopes
  );
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

function mapRowsToObjects(values) {
  if (!values || values.length === 0) return { headers: [], rows: [] };
  const headers = values[0].map((h) => String(h || '').trim());
  const rows = values.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h || `col_${i+1}`] = r[i]; });
    return obj;
  });
  return { headers, rows };
}

router.get('/sheets', async (req, res) => {
  try {
    const spreadsheetId = String(req.query.spreadsheetId || '').trim();
    const sheet = String(req.query.sheet || 'Videos');
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '10'), 10)));
    if (!spreadsheetId) {
      return res.status(400).json({ success: false, error: 'spreadsheetId обязателен' });
    }

    const sheets = await getSheetsClient();
    // Определим существующее имя листа: если запрошенный отсутствует — возьмём первый доступный
    let targetSheet = sheet;
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const titles = (meta?.data?.sheets || []).map(s => s?.properties?.title).filter(Boolean);
      if (titles.length > 0 && !titles.includes(sheet)) {
        targetSheet = titles[0];
      }
    } catch (e) {
      // если не удалось получить список листов — попробуем сразу values.get ниже
    }

    const range = `${targetSheet}`; // вся страница; пагинация на сервере после чтения
    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const { headers, rows } = mapRowsToObjects(data.values || []);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageRows = rows.slice(start, end);

    res.json({ success: true, headers, rows: pageRows, total, page, pageSize, sheet: targetSheet });
  } catch (error) {
    console.error('❌ Ошибка чтения Google Sheets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== AI video generation endpoints =====

/**
 * POST /api/generator/ai/generate
 * Body: { prompt: string, options?: { duration?: number, aspect?: string, provider?: string } }
 */
router.post('/ai/generate', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    const options = req.body?.options || {};
    const meta = {
      spreadsheetId: req.body?.spreadsheetId || null,
      sheet: req.body?.sheet || null,
      rowIndex: req.body?.rowIndex || null,
    };
    if (!prompt || prompt.length < 5) {
      return res.status(400).json({ success: false, error: 'prompt обязателен' });
    }
    const job = await aiVideoService.addGenerateJob(prompt, options, meta);
    res.json({ success: true, ...job });
  } catch (error) {
    console.error('❌ Ошибка запуска AI генерации:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/generator/ai/status/:jobId
 */
router.get('/ai/status/:jobId', async (req, res) => {
  try {
    const s = await aiVideoService.getJobStatus(req.params.jobId);
    if (!s) return res.status(404).json({ success: false, error: 'job not found' });
    res.json({ success: true, data: s });
  } catch (error) {
    console.error('❌ Ошибка статуса AI генерации:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// История/поиск задач AI
import AITaskSQLite from '../models/AITaskSQLite.js';
router.get('/ai/tasks', (req, res) => {
  try {
    const { q = '', status = '', provider = '', limit = '50', page = '1' } = req.query;
    const lim = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const pg = Math.max(1, parseInt(String(page), 10));
    const offset = (pg - 1) * lim;
    const list = AITaskSQLite.search({ q: String(q), status: status || null, provider: provider || null, limit: lim, offset });
    res.json({ success: true, data: list, page: pg, limit: lim });
  } catch (error) {
    console.error('❌ Ошибка списка AI задач:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Повтор задачи по jobId
router.post('/ai/retry/:jobId', async (req, res) => {
  try {
    const jobId = String(req.params.jobId);
    const rec = AITaskSQLite.findByJobId(jobId);
    if (!rec) return res.status(404).json({ success: false, error: 'task not found' });
    const options = rec.options ? JSON.parse(rec.options) : {};
    const resp = await aiVideoService.addGenerateJob(rec.prompt, options);
    res.json({ success: true, ...resp });
  } catch (error) {
    console.error('❌ Ошибка повтора AI задачи:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/generator/ai/download/:jobId
 */
router.get('/ai/download/:jobId', async (req, res) => {
  try {
    const s = await aiVideoService.getJobStatus(req.params.jobId);
    if (!s || s.status !== 'completed' || !s.result?.filePath) {
      return res.status(404).json({ success: false, error: 'Файл ещё не готов' });
    }
    const filePath = s.result.filePath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Файл отсутствует на диске' });
    }
    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Ошибка отдачи AI-файла:', err);
        if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
      }
    });
  } catch (error) {
    console.error('❌ Ошибка скачивания AI-файла:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
