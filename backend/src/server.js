import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Routes
import trendsRouter from './routes/trends.js';
import videosRouter from './routes/videos.js';
import generatorRouter from './routes/generator.js';
import configRouter from './routes/config.js';
import topicsRouter from './routes/topics.js';
import systemRouter from './routes/system.js';
import channelsRouter from './routes/channels.js';
import authRouter from './routes/auth.js';
import worktimeRouter from './routes/worktime.js';
import userRouter from './routes/user.js';
import telegramRouter from './routes/telegram.js';

// Config
// MongoDB отключен по умолчанию (используем SQLite)
// import { connectDB } from './config/database.js';
import { initDatabase } from './config/sqlite.js';
import { COUNTRIES } from './config/countries.js';

// Load environment variables (.env from repo root or backend folder)
(() => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidates = [
      // repo root: backend/src -> ../../.env
      path.resolve(__dirname, '../../.env'),
      // backend folder
      path.resolve(__dirname, '../.env'),
      // cwd fallback
      path.resolve(process.cwd(), '.env'),
    ];
    let loaded = false;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          dotenv.config({ path: p });
          loaded = true;
          break;
        }
      } catch {}
    }
    if (!loaded) {
      // as last resort try default lookup
      dotenv.config();
    }
  } catch {
    dotenv.config();
  }
})();

const app = express();
const httpServer = createServer(app);

// Socket.IO для real-time обновлений
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(morgan('dev')); // Logging
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// WebSocket для real-time обновлений
io.on('connection', (socket) => {
  console.log('✅ Клиент подключен:', socket.id);
  
  // Отправляем информацию о подключении
  socket.emit('connected', {
    message: 'Успешное подключение к серверу',
    socketId: socket.id,
    countries: COUNTRIES.length
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Клиент отключен:', socket.id);
  });
});

// Передаем io в app для использования в роутах
app.set('io', io);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/worktime', worktimeRouter);
app.use('/api/user', userRouter);
app.use('/api/trends', trendsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/generator', generatorRouter);
app.use('/api/config', configRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/system', systemRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/telegram', telegramRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'YT Zavod API',
    version: '1.0.0',
    description: 'Backend для генератора видеоконтента',
    countries: COUNTRIES.length,
    endpoints: {
      trends: '/api/trends',
      videos: '/api/videos',
      generator: '/api/generator'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Эндпоинт не найден',
    path: req.path
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Ошибка сервера:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Внутренняя ошибка сервера',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// MongoDB не используется (для включения раскомментируйте и задайте MONGODB_URI)
// connectDB();

// Инициализация SQLite
try {
  initDatabase();
  console.log('✅ SQLite база данных инициализирована');
} catch (error) {
  console.error('❌ Ошибка инициализации SQLite:', error.message);
}

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 YT Zavod Backend');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📡 Сервер запущен: http://localhost:${PORT}`);
  console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎯 Отслеживание трендов: ${COUNTRIES.length} стран`);
  console.log(`🔌 WebSocket: активен`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM получен, завершение работы...');
  httpServer.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});

export default app;
 
