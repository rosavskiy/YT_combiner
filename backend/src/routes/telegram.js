import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import ChannelModel from '../models/ChannelSQLite.js';
import UserSQLite from '../models/UserSQLite.js';
import UserSettingsSQLite from '../models/UserSettingsSQLite.js';
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

// Экранирование текста для MarkdownV2
function escapeMarkdownV2(text) {
  if (!text) return '';
  return String(text).replace(/[\\_\*\[\]\(\)~`>#+\-=|{}\.]/g, '\\$&');
}

// Форматирование ответа для Telegram
function formatChannelsList(channels) {
  if (!channels.length) {
    return '📋 *Список каналов пуст*\n\nИспользуйте /add_channel <ссылка> для добавления';
  }
  
  let text = `📋 *Отслеживаемые каналы* (${channels.length}):\n\n`;
  channels.forEach((ch, idx) => {
    const safeTitle = escapeMarkdownV2(ch.title || 'Без названия');
    const safeUrl = escapeMarkdownV2(ch.url || '');
    if (safeUrl) {
      text += `${idx + 1}. [${safeTitle}](${safeUrl})\n`;
    } else {
      text += `${idx + 1}. ${safeTitle}\n`;
    }
  });
  return text;
}

// Определение, похоже ли сообщение на ссылку на YouTube-канал
function extractYoutubeChannelUrl(text) {
  if (!text) return null;

  const trimmed = text.trim();

  // Вариант 1: чистый channelId вида UCxxxx
  if (/^UC[0-9A-Za-z_-]{16,}$/.test(trimmed)) {
    return trimmed;
  }

  // Вариант 2: ссылка содержит @username или /channel/UC...
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) return null;

  const url = urlMatch[0];

  if (/youtube\.com\/(channel\/UC|@)/i.test(url)) {
    return url;
  }

  return null;
}

// Универсальный обработчик добавления канала (по команде и по голой ссылке)
async function handleAddChannel(user, chatId, url) {
  const userYoutubeKey = UserSettingsSQLite.get(user.id, 'youtube_api_key', '');
  const apiKey = userYoutubeKey || (user.role === 'admin' ? process.env.YOUTUBE_API_KEY : '');

  if (!apiKey) {
    await sendTelegramMessage(chatId, 
      `❌ *Ошибка настроек*\n\nYouTube API ключ не настроен в вашем профиле. ` +
      `Зайдите в раздел *Настройки → Ключи* и укажите ключ.`
    );
    return;
  }

  try {
    await sendTelegramMessage(chatId, `⏳ Проверяю канал...`);

    const info = await resolveChannel(url, apiKey);

    // Проверим, был ли канал уже в списке пользователя
    const existing = ChannelModel.all({ owner_user_id: user.id, isAdmin: false })
      .find(ch => ch.channel_id === info.channelId);

    const result = ChannelModel.upsert({
      channel_id: info.channelId,
      title: info.title,
      url,
      owner_user_id: user.id
    });

    const isNew = !existing && result.changes > 0;

    const statusLine = isNew
      ? '✅ *Канал добавлен*'
      : '♻️ *Канал уже был в списке*';

    await sendTelegramMessage(chatId, 
      `${statusLine}\n\n` +
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

    console.log('📨 [Webhook] Входящее сообщение:', {
      telegramId,
      chatId,
      text,
      firstName
    });

    // Проверяем, есть ли пользователь в системе
    const user = getUserByTelegramId(telegramId);
    
    console.log('👤 [Webhook] Найден пользователь:', user ? `${user.login} (id: ${user.id}, role: ${user.role})` : 'НЕТ');
    
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
      await handleAddChannel(user, chatId, url);
    }
    else if (text.startsWith('/list_channels') || text === '/list') {
      console.log('🔍 [/list_channels] Запрос от user:', user.id, user.login, 'isAdmin:', user.role === 'admin', 'chatId:', chatId);
      
      try {
        const channels = ChannelModel.all({ 
          owner_user_id: user.id, 
          isAdmin: user.role === 'admin' 
        });
        
        console.log('📊 [/list_channels] Получено каналов:', channels ? channels.length : 'null');
        console.log('📄 [/list_channels] Данные каналов:', JSON.stringify(channels, null, 2));
        
        const responseText = formatChannelsList(channels);
        console.log('✉️ [/list_channels] Форматированный текст:', responseText.substring(0, 200));
        
        const result = await sendTelegramMessage(chatId, responseText);
        console.log('✅ [/list_channels] Результат отправки:', result);
      } catch (error) {
        console.error('❌ [/list_channels] Ошибка:', error);
        await sendTelegramMessage(chatId, '❌ Произошла ошибка при получении списка каналов.');
      }
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
      // Если это не команда, проверим, не похоже ли сообщение на ссылку на канал
      const channelUrl = extractYoutubeChannelUrl(text);
      if (channelUrl) {
        await handleAddChannel(user, chatId, channelUrl);
      } else {
        await sendTelegramMessage(chatId, 
          `❓ Неизвестная команда\n\nИспользуйте /help для списка команд`
        );
      }
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
async function sendTelegramMessage(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ [sendTelegramMessage] Токен не найден!');
    return;
  }

  const useMarkdown = options.markdown !== false;

  console.log('📤 [sendTelegramMessage] Отправка сообщения в чат:', chatId);
  console.log('📝 [sendTelegramMessage] Текст (первые 100 символов):', text.substring(0, 100));

  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  };

  if (useMarkdown) {
    payload.parse_mode = 'MarkdownV2';
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ [sendTelegramMessage] Сообщение доставлено');
    } else {
      console.error('❌ [sendTelegramMessage] Telegram API ошибка:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ [sendTelegramMessage] Ошибка отправки:', error);
    throw error;
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
