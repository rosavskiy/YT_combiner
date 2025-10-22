import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  channel: String,
  channelId: String,
  
  // Статистика
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  
  // Медиа
  thumbnails: mongoose.Schema.Types.Mixed,
  duration: String,
  
  // Категоризация
  tags: [String],
  categoryId: String,
  language: String,
  
  // Загрузка
  downloaded: { type: Boolean, default: false },
  downloadPath: String,
  downloadedAt: Date,
  
  // Обработка
  processed: { type: Boolean, default: false },
  processedAt: Date,
  
  // Генерация
  generated: { type: Boolean, default: false },
  generatedVersions: [{
    language: String,
    path: String,
    createdAt: Date
  }],
  
  // Метаданные
  sourceRegion: String,
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Индексы
videoSchema.index({ categoryId: 1 });
videoSchema.index({ sourceRegion: 1 });
videoSchema.index({ downloaded: 1 });
videoSchema.index({ processed: 1 });

const Video = mongoose.model('Video', videoSchema);

export default Video;
