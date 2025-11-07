import express from 'express';
import { authenticateToken, requireAdmin, requireApproved, verifyTelegramAuth } from '../middleware/auth.js';
import UserSQLite from '../models/UserSQLite.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting для авторизации
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 попыток
  message: { success: false, error: 'Слишком много попыток авторизации' }
});

/**
 * POST /api/auth/login
 * Авторизация по логину и паролю
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Логин и пароль обязательны'
      });
    }

    // Проверяем логин и пароль
    const user = await UserSQLite.verifyPassword(login, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Неверный логин или пароль'
      });
    }

    // Генерируем токен
    const token = UserSQLite.generateToken(user);

    res.json({
      success: true,
      data: {
        user: UserSQLite.sanitize(user),
        token,
        requiresApproval: user.is_approved === 0
      }
    });
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка авторизации'
    });
  }
});

/**
 * POST /api/auth/telegram
 * Авторизация через Telegram Login Widget
 */
router.post('/telegram', authLimiter, async (req, res) => {
  try {
    const telegramData = req.body;

    // Проверяем подпись от Telegram
    try {
      verifyTelegramAuth(telegramData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Неверные данные авторизации',
        details: error.message
      });
    }

    // Создаем или обновляем пользователя
    const user = await UserSQLite.createOrUpdate({
      id: telegramData.id,
      username: telegramData.username,
      first_name: telegramData.first_name,
      last_name: telegramData.last_name,
      photo_url: telegramData.photo_url
    });

    // Генерируем токен
    const token = UserSQLite.generateToken(user);

    res.json({
      success: true,
      data: {
        user: UserSQLite.sanitize(user),
        token,
        requiresApproval: user.is_approved === 0
      }
    });
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка авторизации'
    });
  }
});

/**
 * GET /api/auth/me
 * Получить информацию о текущем пользователе
 */
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

/**
 * POST /api/auth/logout
 * Выход (на клиенте удаляется токен)
 */
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Успешный выход'
  });
});

/**
 * GET /api/auth/pending-users
 * Получить список пользователей, ожидающих подтверждения (только админ)
 */
router.get('/pending-users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const pendingUsers = UserSQLite.findPending();
    res.json({
      success: true,
      data: pendingUsers.map(user => UserSQLite.sanitize(user))
    });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения пользователей'
    });
  }
});

/**
 * GET /api/auth/users
 * Получить список всех пользователей (только админ)
 */
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = UserSQLite.findAll();
    res.json({
      success: true,
      data: users.map(user => UserSQLite.sanitize(user))
    });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения пользователей'
    });
  }
});

/**
 * POST /api/auth/approve/:id
 * Подтвердить пользователя (только админ)
 */
router.post('/approve/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID пользователя'
      });
    }

    const success = UserSQLite.approve(userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    const user = UserSQLite.findById(userId);

    // Уведомление через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('user-approved', { userId, user: UserSQLite.sanitize(user) });
    }

    res.json({
      success: true,
      message: 'Пользователь подтвержден',
      data: UserSQLite.sanitize(user)
    });
  } catch (error) {
    console.error('Ошибка подтверждения пользователя:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка подтверждения пользователя'
    });
  }
});

/**
 * POST /api/auth/reject/:id
 * Отклонить пользователя (только админ)
 */
router.post('/reject/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID пользователя'
      });
    }

    const success = UserSQLite.reject(userId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    // Уведомление через WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('user-rejected', { userId });
    }

    res.json({
      success: true,
      message: 'Пользователь отклонен'
    });
  } catch (error) {
    console.error('Ошибка отклонения пользователя:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка отклонения пользователя'
    });
  }
});

/**
 * POST /api/auth/change-role/:id
 * Изменить роль пользователя (только админ)
 */
router.post('/change-role/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный ID пользователя'
      });
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Неверная роль. Используйте: admin, user'
      });
    }

    // Нельзя изменить роль самому себе
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Нельзя изменить роль самому себе'
      });
    }

    const success = UserSQLite.changeRole(userId, role);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    const user = UserSQLite.findById(userId);

    res.json({
      success: true,
      message: 'Роль пользователя изменена',
      data: UserSQLite.sanitize(user)
    });
  } catch (error) {
    console.error('Ошибка изменения роли:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка изменения роли'
    });
  }
});

/**
 * GET /api/auth/stats
 * Статистика пользователей (только админ)
 */
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const allUsers = UserSQLite.findAll();
    const pendingUsers = UserSQLite.findPending();
    
    const stats = {
      total: allUsers.length,
      approved: allUsers.filter(u => u.is_approved === 1).length,
      pending: pendingUsers.length,
      admins: allUsers.filter(u => u.role === 'admin').length,
      users: allUsers.filter(u => u.role === 'user').length
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статистики'
    });
  }
});

export default router;
/**
 * Имперсонация: админ получает токен, действующий как другой пользователь
 * POST /api/auth/impersonate/:id
 */
router.post('/impersonate/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId)) return res.status(400).json({ success:false, error:'Неверный ID пользователя'});
    const target = UserSQLite.findById(targetId);
    if (!target) return res.status(404).json({ success:false, error:'Пользователь не найден'});
    // Генерируем токен с меткой impersonated_by
    const token = UserSQLite.generateToken(target, { impersonated_by: req.user.id });
    res.json({ success:true, data:{ token, user: UserSQLite.sanitize(target), impersonated:true } });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});

/**
 * Revert impersonation: просто выдаем новый токен админа без impersonated_by
 * POST /api/auth/revert-impersonation
 */
router.post('/revert-impersonation', authenticateToken, (req, res) => {
  try {
    // Если не имперсонация — для админа вернуть текущий токен, остальным запретить
    if (!req.user._impersonated) {
      if (req.user.role === 'admin') {
        return res.json({ success:true, data:{ token: req.headers['authorization']?.split(' ')[1], user: req.user, impersonated:false } });
      }
      return res.status(403).json({ success:false, error:'Недостаточно прав' });
    }
    const adminUser = UserSQLite.findById(req.user._impersonated_by);
    if (!adminUser) return res.status(404).json({ success:false, error:'Исходный админ не найден' });
    const token = UserSQLite.generateToken(adminUser);
    res.json({ success:true, data:{ token, user: UserSQLite.sanitize(adminUser), impersonated:false } });
  } catch (e) {
    res.status(500).json({ success:false, error:e.message });
  }
});
