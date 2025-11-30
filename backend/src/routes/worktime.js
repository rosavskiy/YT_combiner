import express from 'express';
import { authenticateToken, requireApproved } from '../middleware/auth.js';
import WorkSessionSQLite from '../models/WorkSessionSQLite.js';

const router = express.Router();

// Начало рабочей сессии
router.post('/start', authenticateToken, requireApproved, (req, res) => {
  try {
    console.log('[WORKTIME] Start request from user:', req.user?.id, req.user?.username);
    const session = WorkSessionSQLite.start(req.user.id);
    console.log('[WORKTIME] Session started:', session);
    res.json({ success: true, data: session, message: 'Рабочая сессия начата' });
  } catch (e) {
    console.error('[WORKTIME] Start error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Завершение рабочей сессии
router.post('/stop', authenticateToken, requireApproved, (req, res) => {
  try {
    console.log('[WORKTIME] Stop request from user:', req.user?.id, req.user?.username);
    const session = WorkSessionSQLite.stop(req.user.id);
    console.log('[WORKTIME] Session stopped:', session);
    if (!session) {
      console.log('[WORKTIME] No active session found');
      return res.status(400).json({ success: false, error: 'Нет активной сессии' });
    }
    res.json({ success: true, data: session, message: 'Рабочая сессия завершена' });
  } catch (e) {
    console.error('[WORKTIME] Stop error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Текущая активная сессия
router.get('/active', authenticateToken, requireApproved, (req, res) => {
  try {
    const active = WorkSessionSQLite.getActive(req.user.id);
    res.json({ success: true, data: active });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Сводка за период (?from=YYYY-MM-DD&to=YYYY-MM-DD)
router.get('/summary', authenticateToken, requireApproved, (req, res) => {
  try {
    const { from, to } = req.query;
    const summary = WorkSessionSQLite.summary(req.user.id, { from, to });
    res.json({ success: true, data: summary });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
