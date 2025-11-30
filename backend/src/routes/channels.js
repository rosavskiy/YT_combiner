import express from 'express';
import ChannelModel from '../models/ChannelSQLite.js';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import { resolveChannel, fetchLatestActivities } from '../services/youtubeChannelService.js';
import UserSettingsSQLite from '../models/UserSettingsSQLite.js';

const router = express.Router();

function getApiKeyForUser(user) {
  const userKey = UserSettingsSQLite.get(user.id, 'youtube_api_key', '');
  if (userKey) return userKey;
  if (user.role === 'admin') return process.env.YOUTUBE_API_KEY;
  return null;
}

// GET /api/channels - list channels
router.get('/', authenticateToken, requireApproved, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const items = ChannelModel.all({ owner_user_id: req.user.id, isAdmin });
  res.json({ success: true, data: items });
});

// POST /api/channels - add by url/input
router.post('/', authenticateToken, requireApproved, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: 'Требуется ссылка или идентификатор канала' });
    const apiKey = getApiKeyForUser(req.user);
    if (!apiKey) return res.status(400).json({ success: false, error: 'Не настроен YouTube API ключ в настройках пользователя' });
    const info = await resolveChannel(url, apiKey);
    ChannelModel.upsert({ channel_id: info.channelId, title: info.title, url, owner_user_id: req.user.id });
    res.json({ success: true, channel: info });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message || 'Не удалось добавить канал' });
  }
});

// DELETE /api/channels/:id - remove channel
router.delete('/:id', authenticateToken, requireApproved, (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'Не указан channelId' });
  ChannelModel.remove(id, { owner_user_id: req.user.id, isAdmin: req.user.role === 'admin' });
  res.json({ success: true });
});

// GET /api/channels/activities?limit=5&channelIds=xxx,yyy - latest activities across channels
router.get('/activities', authenticateToken, requireApproved, async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit || '5', 10));
  const channelIdsParam = req.query.channelIds; // comma-separated string
  
  let items = ChannelModel.all({ owner_user_id: req.user.id, isAdmin: req.user.role === 'admin' });
  
  // Если указаны конкретные каналы, фильтруем
  if (channelIdsParam && channelIdsParam.trim()) {
    const requestedIds = channelIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    if (requestedIds.length > 0) {
      items = items.filter(item => requestedIds.includes(item.channel_id));
    }
  }
  
  if (!items.length) return res.json({ success: true, data: [] });
  
  const apiKey = getApiKeyForUser(req.user);
  if (!apiKey) return res.status(400).json({ success: false, error: 'Не настроен YouTube API ключ в настройках пользователя' });
  
  try {
    const list = await fetchLatestActivities(items.map(i => i.channel_id), apiKey, limit);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Ошибка получения активности каналов' });
  }
});

// POST /api/channels/refresh - alias to activities with body params
router.post('/refresh', authenticateToken, requireApproved, async (req, res) => {
  const limit = Math.min(50, parseInt(req.body?.limit || '5', 10));
  const channelIds = req.body?.channelIds || []; // array of channel IDs
  
  let items = ChannelModel.all({ owner_user_id: req.user.id, isAdmin: req.user.role === 'admin' });
  
  // Если указаны конкретные каналы, фильтруем
  if (Array.isArray(channelIds) && channelIds.length > 0) {
    items = items.filter(item => channelIds.includes(item.channel_id));
  }
  
  if (!items.length) return res.json({ success: true, data: [] });
  
  const apiKey = getApiKeyForUser(req.user);
  if (!apiKey) return res.status(400).json({ success: false, error: 'Не настроен YouTube API ключ в настройках пользователя' });
  
  try {
    const list = await fetchLatestActivities(items.map(i => i.channel_id), apiKey, limit);
    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || 'Ошибка обновления' });
  }
});

export default router;
