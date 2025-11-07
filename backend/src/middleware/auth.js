import jwt from 'jsonwebtoken';
import UserSQLite from '../models/UserSQLite.js';
import crypto from 'crypto';

/**
 * Проверка JWT токена
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Требуется авторизация' 
    });
  }

  try {
    const decoded = UserSQLite.verifyToken(token);
    if (!decoded) {
      return res.status(403).json({ 
        success: false, 
        error: 'Недействительный токен' 
      });
    }

    // Проверяем, существует ли пользователь
    const user = UserSQLite.findById(decoded.id);
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        error: 'Пользователь не найден' 
      });
    }

    // Имперсонация: если токен содержит impersonated_by -> добавляем метаданные
    const sanitized = UserSQLite.sanitize(user);
    if (decoded.impersonated_by) {
      sanitized._impersonated = true;
      sanitized._impersonated_by = decoded.impersonated_by;
    }
    req.user = sanitized;
    req.authPayload = decoded; // сохраняем исходный payload для revert
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      error: 'Ошибка проверки токена' 
    });
  }
};

/**
 * Проверка, что пользователь подтвержден администратором
 */
export const requireApproved = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Требуется авторизация' 
    });
  }

  if (!req.user.is_approved) {
    return res.status(403).json({ 
      success: false, 
      error: 'Ваш аккаунт ожидает подтверждения администратором',
      code: 'PENDING_APPROVAL'
    });
  }

  next();
};

/**
 * Проверка роли администратора
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Требуется авторизация' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Требуются права администратора' 
    });
  }

  next();
};

/**
 * Проверка данных от Telegram Login Widget
 * https://core.telegram.org/widgets/login
 */
export const verifyTelegramAuth = (data) => {
  const { hash, ...restData } = data;
  
  if (!hash) {
    throw new Error('Отсутствует hash');
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN не настроен');
  }

  // Создаем строку для проверки
  const dataCheckString = Object.keys(restData)
    .sort()
    .map(key => `${key}=${restData[key]}`)
    .join('\n');

  // Вычисляем secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();

  // Вычисляем hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // Проверяем, совпадают ли хеши
  if (calculatedHash !== hash) {
    throw new Error('Данные не прошли проверку');
  }

  // Проверяем время (не старше 24 часов)
  const authDate = parseInt(restData.auth_date, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = currentTime - authDate;

  if (timeDiff > 86400) { // 24 часа
    throw new Error('Данные авторизации устарели');
  }

  return true;
};

/**
 * Опциональная авторизация - если токен есть, проверяем, но не требуем
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = UserSQLite.verifyToken(token);
      if (decoded) {
        const user = UserSQLite.findById(decoded.id);
        if (user) {
          req.user = UserSQLite.sanitize(user);
        }
      }
    } catch (error) {
      // Игнорируем ошибки при опциональной авторизации
    }
  }

  next();
};
