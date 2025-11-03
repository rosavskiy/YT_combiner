import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

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
    const range = `${sheet}`; // вся страница; пагинация на сервере после чтения
    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const { headers, rows } = mapRowsToObjects(data.values || []);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageRows = rows.slice(start, end);

    res.json({ success: true, headers, rows: pageRows, total, page, pageSize });
  } catch (error) {
    console.error('❌ Ошибка чтения Google Sheets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
