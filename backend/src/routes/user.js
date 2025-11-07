import express from 'express';
import { authenticateToken, requireApproved, requireAdmin } from '../middleware/auth.js';
import UserMetricsSQLite from '../models/UserMetricsSQLite.js';
import UserSQLite from '../models/UserSQLite.js';

const router = express.Router();

// Мои метрики и время
router.get('/me/metrics', authenticateToken, requireApproved, (req, res) => {
  try {
    const metrics = UserMetricsSQLite.get(req.user.id);
    res.json({ success: true, data: metrics });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
// Админ: агрегированная статистика по всем пользователям
router.get('/metrics', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = UserSQLite.findAll();
    const data = users.map(u => ({
      user: UserSQLite.sanitize(u),
      metrics: UserMetricsSQLite.get(u.id),
    }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
