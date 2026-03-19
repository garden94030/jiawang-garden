require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { generalLimiter } = require('./src/middleware/rateLimiter');
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const categoryRoutes = require('./src/routes/categories');
const contactRoutes = require('./src/routes/contacts');
const uploadRoutes = require('./src/routes/uploads');
const { initDatabase } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// ── 安全標頭 ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// ── CORS ──────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允許的來源'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── 基本中介層 ────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(generalLimiter);

// ── 靜態檔案 (上傳圖片) ───────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API 路由 ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/uploads', uploadRoutes);

// ── 健康檢查 ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 處理 ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: '找不到此路由' });
});

// ── 全域錯誤處理 ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '檔案大小超過限制' });
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? '伺服器錯誤' : err.message,
  });
});

// ── 啟動（async，因 sql.js 需要非同步初始化）──────────────
(async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`赫采國際衛浴 API 伺服器已啟動：http://localhost:${PORT}`);
  });
})();
