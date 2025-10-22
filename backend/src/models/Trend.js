import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  channel: String,
  channelId: String,
  publishedAt: Date,
  thumbnails: mongoose.Schema.Types.Mixed,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  duration: String,
  tags: [String],
  categoryId: String,
  region: String
});

const trendSchema = new mongoose.Schema({
  data: {
    type: Map,
    of: [videoSchema]
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  },
  totalVideos: Number,
  countries: [String]
}, {
  timestamps: true
});

// Индексы для быстрого поиска
trendSchema.index({ fetchedAt: -1 });
trendSchema.index({ 'data.videoId': 1 });

const Trend = mongoose.model('Trend', trendSchema);

export default Trend;
