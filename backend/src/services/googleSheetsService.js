import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getSheetsClient() {
  // 1) creds JSON inline
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const raw = process.env.GOOGLE_CREDENTIALS_JSON;
      const creds = JSON.parse(raw);
      const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
      const auth = new google.auth.JWT(
        creds.client_email,
        null,
        creds.private_key,
        scopes
      );
      await auth.authorize();
      return google.sheets({ version: 'v4', auth });
    } catch {}
  }

  // 2) file candidates
  const repoRoot = path.resolve(__dirname, '..', '..'); // .../backend
  const candidates = [
    process.env.GOOGLE_CREDENTIALS_PATH,
    path.join(repoRoot, '..', 'python-workers', 'google-credentials.json'),
    path.join(process.cwd(), '..', 'python-workers', 'google-credentials.json'),
    path.join(process.cwd(), 'python-workers', 'google-credentials.json')
  ].filter(Boolean);

  let foundPath = null;
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) { foundPath = p; break; } } catch {}
  }
  if (!foundPath) throw new Error('Google credentials not found');

  const creds = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    scopes
  );
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

function ensureHeadersRow(values) {
  const headers = (values?.[0] || []).map(v => String(v || '').trim());
  return headers;
}

async function ensureAIHeaders({ sheets, spreadsheetId, sheet }) {
  const getResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheet}!1:1` });
  const headers = ensureHeadersRow(getResp.data.values || [[]]);
  const need = ['AI статус', 'AI ссылка', 'Дата AI'];
  const positions = {};
  need.forEach((h) => {
    const idx = headers.indexOf(h);
    if (idx >= 0) positions[h] = idx; // 0-based index
  });
  // Если чего-то не хватает — допишем в конец
  const missing = need.filter(h => positions[h] === undefined);
  if (missing.length) {
    const newHeaders = headers.concat(missing);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheet}!1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [newHeaders] },
    });
    missing.forEach((h, i) => { positions[h] = headers.length + i; });
  }
  return positions; // key->0based column index
}

function colIndexToLetter(idx0) {
  // 0-based index to column letter
  let n = idx0 + 1;
  let s = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function updateAIResult({ spreadsheetId, sheet = 'Videos', rowIndex, status, link }) {
  const sheets = await getSheetsClient();
  const pos = await ensureAIHeaders({ sheets, spreadsheetId, sheet });
  const headers = ['AI статус', 'AI ссылка', 'Дата AI'];
  const now = new Date().toISOString();
  const updates = [
    { h: 'AI статус', val: status || 'completed' },
    { h: 'AI ссылка', val: link || '' },
    { h: 'Дата AI', val: now },
  ];

  // rowIndex — 1-based по всей таблице
  const ranges = updates.map(u => {
    const colIdx = pos[u.h];
    const colLetter = colIndexToLetter(colIdx);
    return `${sheet}!${colLetter}${rowIndex}`;
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates.map((u, i) => ({ range: ranges[i], values: [[u.val]] })),
    },
  });
}

export default { getSheetsClient, updateAIResult };
