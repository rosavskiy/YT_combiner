import express from 'express';
import axios from 'axios';

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
