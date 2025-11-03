import express from 'express';
import ChannelModel from '../models/ChannelSQLite.js';
import { resolveChannel, fetchLatestActivities } from '../services/youtubeChannelService.js';

const router = express.Router();

function getApiKey() {
  return process.env.YOUTUBE_API_KEY;
}

// GET /api/channels - list channels
router.get('/', (req, res) => {
  const items = ChannelModel.all();
  res.json({ success: true, data: items });
});

// POST /api/channels - add by url/input
router.post('/', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: 'Требуется ссылка или идентификатор канала' });
    const apiKey = getApiKey();
    if (!apiKey) return res.status(400).json({ success: false, error: 'На сервере не настроен YOUTUBE_API_KEY' });
    const info = await resolveChannel(url, apiKey);
    ChannelModel.upsert({ channel_id: info.channelId, title: info.title, url });
    res.json({ success: true, channel: info });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message || 'Не удалось добавить канал' });
  }
});

// DELETE /api/channels/:id - remove channel
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'Не указан channelId' });
  ChannelModel.remove(id);
  res.json({ success: true });
});

// GET /api/channels/activities?limit=10 - latest activities across channels
router.get('/activities', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '10', 10));
  const items = ChannelModel.all();
  if (!items.length) return res.json({ success: true, data: [] });
  const apiKey = getApiKey();
  if (!apiKey) return res.status(400).json({ success: false, error: 'На сервере не настроен YOUTUBE_API_KEY' });
  try {
    const list = await fetchLatestActivities(items.map(i => i.channel_id), apiKey, limit);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Ошибка получения активности каналов' });
  }
});

// POST /api/channels/refresh - alias to activities
router.post('/refresh', async (req, res) => {
  const limit = Math.min(50, parseInt(req.body?.limit || '10', 10));
  const items = ChannelModel.all();
  const apiKey = getApiKey();
  if (!apiKey) return res.status(400).json({ success: false, error: 'На сервере не настроен YOUTUBE_API_KEY' });
  try {
    const list = await fetchLatestActivities(items.map(i => i.channel_id), apiKey, limit);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Ошибка обновления' });
  }
});

export default router;
