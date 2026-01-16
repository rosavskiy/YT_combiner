import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ElevenLabs Text-to-Speech Service
 * Документация: https://elevenlabs.io/docs/
 */
class TTSService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseURL = 'https://api.elevenlabs.io/v1';
    this.defaultVoice = process.env.ELEVENLABS_DEFAULT_VOICE || '21m00Tcm4TlvDq8ikWAM'; // Rachel
    this.defaultModel = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
    
    // Папка для хранения озвучки
    this.outputDir = path.resolve(__dirname, '..', '..', 'data', 'ai-outputs', 'voice');
    try { fs.mkdirSync(this.outputDir, { recursive: true }); } catch {}
  }

  /**
   * Проверка доступности API
   */
  async healthCheck() {
    if (!this.apiKey) {
      return { available: false, error: 'ELEVENLABS_API_KEY не установлен' };
    }
    
    try {
      const res = await axios.get(`${this.baseURL}/voices`, {
        headers: { 'xi-api-key': this.apiKey }
      });
      return { available: true, voices: res.data.voices.length };
    } catch (e) {
      return { available: false, error: e.message };
    }
  }

  /**
   * Получить список доступных голосов
   */
  async getVoices() {
    if (!this.apiKey) throw new Error('ELEVENLABS_API_KEY не установлен');
    
    const res = await axios.get(`${this.baseURL}/voices`, {
      headers: { 'xi-api-key': this.apiKey }
    });
    
    return res.data.voices.map(v => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender || 'unknown',
      age: v.labels?.age || 'unknown',
      accent: v.labels?.accent || 'unknown',
      description: v.labels?.description || '',
      preview_url: v.preview_url
    }));
  }

  /**
   * Генерация речи из текста
   * 
   * @param {string} text - Текст для озвучки (макс ~5000 символов за раз)
   * @param {Object} options - Настройки
   * @param {string} options.voiceId - ID голоса (по умолчанию Rachel)
   * @param {string} options.modelId - Модель (eleven_multilingual_v2 | eleven_monolingual_v1)
   * @param {number} options.stability - Стабильность голоса (0-1, по умолчанию 0.5)
   * @param {number} options.similarityBoost - Усиление схожести (0-1, по умолчанию 0.75)
   * @param {string} options.outputPath - Путь для сохранения (опционально)
   * @returns {Promise<{audioPath: string, duration: number, size: number}>}
   */
  async textToSpeech(text, options = {}) {
    if (!this.apiKey) throw new Error('ELEVENLABS_API_KEY не установлен');
    if (!text || String(text).trim().length === 0) {
      throw new Error('Текст для озвучки пустой');
    }

    const voiceId = options.voiceId || this.defaultVoice;
    const modelId = options.modelId || this.defaultModel;
    const stability = options.stability ?? 0.5;
    const similarityBoost = options.similarityBoost ?? 0.75;

    // Ограничение по длине текста (API лимит ~5000 символов)
    const maxChars = 5000;
    let processedText = String(text).trim();
    if (processedText.length > maxChars) {
      console.warn(`[TTS] Текст обрезан с ${processedText.length} до ${maxChars} символов`);
      processedText = processedText.substring(0, maxChars);
    }

    console.log(`[TTS] Генерация озвучки: ${processedText.length} символов, голос: ${voiceId}`);

    try {
      const response = await axios.post(
        `${this.baseURL}/text-to-speech/${voiceId}`,
        {
          text: processedText,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost
          }
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );

      // Сохранение аудио
      const audioBuffer = Buffer.from(response.data);
      const outputPath = options.outputPath || path.join(
        this.outputDir,
        `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`
      );

      fs.writeFileSync(outputPath, audioBuffer);

      // Получение длительности через ffprobe (если доступен)
      let duration = null;
      try {
        const { spawn } = await import('child_process');
        const ffprobe = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          outputPath
        ]);

        let output = '';
        ffprobe.stdout.on('data', (data) => { output += data.toString(); });
        
        await new Promise((resolve, reject) => {
          ffprobe.on('close', (code) => code === 0 ? resolve() : reject());
          ffprobe.on('error', reject);
        });

        duration = parseFloat(output.trim()) || null;
      } catch (e) {
        console.warn('[TTS] ffprobe недоступен, длительность не определена');
      }

      console.log(`[TTS] Озвучка сохранена: ${outputPath} (${(audioBuffer.length / 1024).toFixed(2)} KB)`);

      return {
        audioPath: outputPath,
        duration,
        size: audioBuffer.length,
        voiceId,
        charactersUsed: processedText.length
      };
    } catch (error) {
      if (error.response) {
        const msg = error.response.data?.detail?.message || error.response.data?.message || 'Неизвестная ошибка API';
        throw new Error(`ElevenLabs API error: ${msg}`);
      }
      throw error;
    }
  }

  /**
   * Генерация озвучки для длинного текста (разбивает на чанки)
   * 
   * @param {string} text - Длинный текст
   * @param {Object} options - Настройки (как в textToSpeech)
   * @returns {Promise<{audioPaths: string[], totalDuration: number, totalSize: number}>}
   */
  async textToSpeechLong(text, options = {}) {
    const maxChars = 4500; // Безопасный лимит с запасом
    const chunks = this._splitTextIntoChunks(text, maxChars);
    
    console.log(`[TTS] Длинный текст разбит на ${chunks.length} частей`);

    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[TTS] Обработка части ${i + 1}/${chunks.length}...`);
      const result = await this.textToSpeech(chunks[i], {
        ...options,
        outputPath: options.outputPath 
          ? options.outputPath.replace(/\.mp3$/, `_part${i + 1}.mp3`)
          : undefined
      });
      results.push(result);
      
      // Пауза между запросами (rate limiting)
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      audioPaths: results.map(r => r.audioPath),
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
      totalSize: results.reduce((sum, r) => sum + r.size, 0),
      chunks: results.length
    };
  }

  /**
   * Разбивка текста на чанки по границам предложений
   */
  _splitTextIntoChunks(text, maxChars) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChars) {
        currentChunk += sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    
    return chunks;
  }

  /**
   * Оценка стоимости озвучки
   * ElevenLabs: $0.30 за 1000 символов (план Creator)
   */
  estimateCost(text) {
    const chars = String(text).length;
    const cost = (chars / 1000) * 0.30;
    return {
      characters: chars,
      estimatedCost: cost.toFixed(4),
      currency: 'USD'
    };
  }
}

const ttsService = new TTSService();
export default ttsService;
