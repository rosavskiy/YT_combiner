import express from 'express';

const router = express.Router();

/**
 * GET /api/system/health
 * Проверка наличия ffmpeg, версии yt-dlp и cookies.txt
 */
router.get('/health', async (req, res) => {
  try {
    const { default: videoDownloadService } = await import('../services/videoDownloadService.js');
    const health = await videoDownloadService.getSystemHealth();
    res.json({ success: true, data: health });
  } catch (error) {
    console.error('❌ Ошибка system health:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
