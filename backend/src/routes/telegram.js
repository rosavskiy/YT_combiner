import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import ChannelModel from '../models/ChannelSQLite.js';
import UserSQLite from '../models/UserSQLite.js';
import { resolveChannel } from '../services/youtubeChannelService.js';

const router = express.Router();

// Telegram Bot API URL
const TELEGRAM_API = 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN;

// Хелпер для проверки подписи Telegram webhook
function verifyTelegramWebhook(body, token) {
  const { update_id, message } = body;
  // Для упрощения используем базовую проверку
  // В продакшене можно добавить проверку IP Telegram серверов
  return message && message.from && message.text;
}

// Получить user_id по telegram_id
function getUserByTelegramId(telegramId) {
  return UserSQLite.findByTelegramId(telegramId);
}

// Форматирование ответа для Telegram
function formatChannelsList(channels) {
  if (!channels.length) {
    return '📋 *Список каналов пуст*\n\nИспользуйте /add\\_channel <ссылка> для добавления';
  }
  
  let text = `📋 *Отслеживаемые каналы* (${channels.length}):\n\n`;
  channels.forEach((ch, idx) => {
    text += `${idx + 1}. *${ch.title || 'Без названия'}*\n`;
    text += `   ID: \`${ch.channel_id}\`\n`;
    text += `   URL: ${ch.url}\n\n`;
  });
  text += '_Используйте /remove\\_channel <ID> для удаления_';
  return text;
}

// POST /api/telegram/webhook - прием сообщений от бота
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // Проверка валидности запроса
    if (!body.message || !body.message.from) {
      return res.status(400).json({ ok: false, error: 'Invalid request' });
    }

    const message = body.message;
    const telegramId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text || '';
    const firstName = message.from.first_name || 'User';

    // Проверяем, есть ли пользователь в системе
    const user = getUserByTelegramId(telegramId);
    
    if (!user) {
      await sendTelegramMessage(chatId, 
        `❌ *Доступ запрещен*\n\nВаш Telegram аккаунт не зарегистрирован в системе.\n` +
        `Пожалуйста, войдите через веб-интерфейс: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`
      );
      return res.json({ ok: true });
    }

    if (!user.is_approved) {
      await sendTelegramMessage(chatId, 
        `⏳ *Ожидание подтверждения*\n\nВаш аккаунт ожидает подтверждения администратором.\n` +
        `После одобрения вы сможете использовать бота.`
      );
      return res.json({ ok: true });
    }

    // Обработка команд
    if (text.startsWith('/start')) {
      const welcomeText = 
        `👋 Привет, *${firstName}*!\n\n` +
        `🤖 *YT Zavod Bot* - управление каналами\n\n` +
        `*Доступные команды:*\n` +
        `/add\\_channel <URL> - добавить канал\n` +
        `/list\\_channels - список каналов\n` +
        `/remove\\_channel <ID> - удалить канал\n` +
        `/help - помощь`;
      
      await sendTelegramMessage(chatId, welcomeText);
    }
    else if (text.startsWith('/help')) {
      const helpText = 
        `📖 *Помощь по командам*\n\n` +
        `*Добавление канала:*\n` +
        `/add\\_channel https://youtube.com/@channel\n` +
        `/add\\_channel UCxxxxxx\n\n` +
        `*Просмотр каналов:*\n` +
        `/list\\_channels\n\n` +
        `*Удаление канала:*\n` +
        `/remove\\_channel UCxxxxxx\n\n` +
        `_Все каналы привязаны к вашему аккаунту_`;
      
      await sendTelegramMessage(chatId, helpText);
    }
    else if (text.startsWith('/add_channel')) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendTelegramMessage(chatId, 
          `❌ *Ошибка*\n\nУкажите ссылку на канал:\n` +
          `/add\\_channel https://youtube.com/@channel`
        );
        return res.json({ ok: true });
      }

      const url = parts[1];
      const apiKey = process.env.YOUTUBE_API_KEY;
      
      if (!apiKey) {
        await sendTelegramMessage(chatId, 
          `❌ *Ошибка сервера*\n\nYouTube API ключ не настроен`
        );
        return res.json({ ok: true });
      }

      try {
        // Отправляем статус
        await sendTelegramMessage(chatId, `⏳ Проверяю канал...`);
        
        const info = await resolveChannel(url, apiKey);
        
        // Добавляем канал
        ChannelModel.upsert({
          channel_id: info.channelId,
          title: info.title,
          url,
          owner_user_id: user.id
        });

        await sendTelegramMessage(chatId, 
          `✅ *Канал добавлен*\n\n` +
          `📺 *${info.title}*\n` +
          `ID: \`${info.channelId}\`\n` +
          `URL: ${url}`
        );
      } catch (error) {
        await sendTelegramMessage(chatId, 
          `❌ *Ошибка добавления*\n\n${error.message || 'Не удалось добавить канал'}`
        );
      }
    }
    else if (text.startsWith('/list_channels') || text === '/list') {
      const channels = ChannelModel.all({ 
        owner_user_id: user.id, 
        isAdmin: user.role === 'admin' 
      });
      
      const responseText = formatChannelsList(channels);
      await sendTelegramMessage(chatId, responseText);
    }
    else if (text.startsWith('/remove_channel')) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendTelegramMessage(chatId, 
          `❌ *Ошибка*\n\nУкажите ID канала:\n` +
          `/remove\\_channel UCxxxxxx`
        );
        return res.json({ ok: true });
      }

      const channelId = parts[1];
      
      try {
        ChannelModel.remove(channelId, { 
          owner_user_id: user.id, 
          isAdmin: user.role === 'admin' 
        });
        
        await sendTelegramMessage(chatId, 
          `✅ *Канал удален*\n\nID: \`${channelId}\``
        );
      } catch (error) {
        await sendTelegramMessage(chatId, 
          `❌ *Ошибка удаления*\n\n${error.message || 'Канал не найден'}`
        );
      }
    }
    else {
      await sendTelegramMessage(chatId, 
        `❓ Неизвестная команда\n\nИспользуйте /help для списка команд`
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Ошибка Telegram webhook:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/telegram/set-webhook - установить webhook URL для бота
router.post('/set-webhook', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Только для администратора' });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL обязателен' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN не настроен' });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }
    );

    const data = await response.json();
    
    if (data.ok) {
      res.json({ success: true, message: 'Webhook установлен', data });
    } else {
      res.status(400).json({ success: false, error: data.description || 'Ошибка Telegram API' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/telegram/webhook-info - информация о текущем webhook
router.get('/webhook-info', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Только для администратора' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN не настроен' });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    );

    const data = await response.json();
    res.json({ success: true, data: data.result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/telegram/webhook - удалить webhook
router.delete('/webhook', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Только для администратора' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN не настроен' });
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/deleteWebhook`
    );

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Хелпер для отправки сообщений в Telegram
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.error('Ошибка отправки Telegram сообщения:', error);
  }
}

// POST /api/telegram/set-webhook - установить webhook для бота
router.post('/set-webhook', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

    if (!token) {
      return res.status(500).json({ 
        success: false, 
        error: 'TELEGRAM_BOT_TOKEN не установлен в .env' 
      });
    }

    if (!webhookUrl) {
      return res.status(500).json({ 
        success: false, 
        error: 'TELEGRAM_WEBHOOK_URL не установлен в .env' 
      });
    }

    // Устанавливаем webhook
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        url: webhookUrl,
        allowed_updates: ['message']
      }
    );

    if (response.data.ok) {
      res.json({
        success: true,
        message: 'Webhook успешно установлен',
        data: response.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Ошибка установки webhook',
        details: response.data
      });
    }
  } catch (error) {
    console.error('Ошибка установки webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/telegram/webhook-info - получить информацию о webhook
router.get('/webhook-info', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return res.status(500).json({ 
        success: false, 
        error: 'TELEGRAM_BOT_TOKEN не установлен в .env' 
      });
    }

    const response = await axios.get(
      `https://api.telegram.org/bot${token}/getWebhookInfo`
    );

    res.json({
      success: true,
      data: response.data.result
    });
  } catch (error) {
    console.error('Ошибка получения информации о webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/telegram/webhook - удалить webhook
router.delete('/webhook', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return res.status(500).json({ 
        success: false, 
        error: 'TELEGRAM_BOT_TOKEN не установлен в .env' 
      });
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${token}/deleteWebhook`
    );

    res.json({
      success: true,
      message: 'Webhook удален',
      data: response.data
    });
  } catch (error) {
    console.error('Ошибка удаления webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
