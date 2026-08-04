const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'));
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads'));
const DATA_FILE = path.join(DATA_DIR, 'shared-data.json');
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const CONTACT_FORM_ENABLED = process.env.CONTACT_FORM_ENABLED === 'true';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function emptyData() {
  return { photos: [], messages: [] };
}

function normalizeData(value) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    photos: Array.isArray(data.photos) ? data.photos : [],
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return emptyData();
  try {
    return normalizeData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (error) {
    throw new Error(`資料檔無法讀取，已停止寫入以避免覆蓋：${error.message}`);
  }
}

function saveData(value) {
  const data = normalizeData(value);
  const temporaryFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryFile, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryFile, DATA_FILE);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporaryFile); } catch {}
    throw error;
  }
}

if (!fs.existsSync(DATA_FILE)) saveData(emptyData());

function safeTokenEquals(received, expected) {
  if (!received || !expected) return false;
  const receivedDigest = crypto.createHash('sha256').update(received).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(receivedDigest, expectedDigest);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_API_TOKEN) {
    return res.status(503).json({ success: false, error: '管理功能尚未啟用' });
  }
  const authorization = req.get('authorization') || '';
  const received = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!safeTokenEquals(received, ADMIN_API_TOKEN)) {
    return res.status(401).json({ success: false, error: '未授權' });
  }
  return next();
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

const mimeExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, UPLOADS_DIR),
  filename: (req, file, callback) => {
    const extension = mimeExtensions[file.mimetype] || '';
    callback(null, `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, callback) => {
    if (mimeExtensions[file.mimetype]) return callback(null, true);
    return callback(new Error('僅接受 JPG、PNG 或 WebP 圖片'));
  },
});

function createApp() {
  const app = express();
  const recentContacts = new Map();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });

  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(ROOT_DIR, 'public'), { fallthrough: true }));
  app.use('/photos', express.static(path.join(ROOT_DIR, 'photos'), { fallthrough: false }));
  app.use('/media', express.static(path.join(ROOT_DIR, 'content', 'media'), { fallthrough: false }));
  app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: false }));

  app.get('/api/photos', (req, res) => res.json(loadData().photos));

  app.post('/api/upload', requireAdmin, upload.array('photos', 10), (req, res) => {
    const data = loadData();
    const maxId = data.photos.reduce((max, photo) => Math.max(max, Number(photo.id) || 0), 0);
    const now = new Date().toISOString().slice(0, 10);
    const name = cleanText(req.body.name, 80) || '未命名';
    const stage = cleanText(req.body.stage, 30) || 'adult';
    const desc = cleanText(req.body.desc, 300);

    const newPhotos = (req.files || []).map((file, index) => ({
      id: maxId + index + 1,
      name,
      stage,
      desc,
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      date: now,
      uploadedBy: '管理者',
      size: file.size,
    }));

    data.photos = [...newPhotos, ...data.photos];
    try {
      saveData(data);
    } catch (error) {
      for (const file of req.files || []) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw error;
    }
    res.json({ success: true, count: newPhotos.length, photos: newPhotos });
  });

  app.delete('/api/photos/:id', requireAdmin, (req, res) => {
    const data = loadData();
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id)) {
      return res.status(400).json({ success: false, error: '無效的照片編號' });
    }

    const photo = data.photos.find(item => Number(item.id) === id);
    if (!photo) return res.status(404).json({ success: false, error: '找不到照片' });

    let originalPath = null;
    let trashPath = null;
    if (photo.filename) {
      const filePath = path.resolve(UPLOADS_DIR, path.basename(photo.filename));
      if (filePath.startsWith(`${UPLOADS_DIR}${path.sep}`) && fs.existsSync(filePath)) {
        originalPath = filePath;
        trashPath = `${filePath}.${crypto.randomBytes(8).toString('hex')}.trash`;
        fs.renameSync(originalPath, trashPath);
      }
    }
    data.photos = data.photos.filter(item => Number(item.id) !== id);
    try {
      saveData(data);
    } catch (error) {
      if (trashPath && originalPath && fs.existsSync(trashPath)) {
        try { fs.renameSync(trashPath, originalPath); } catch (restoreError) {
          console.error('photo restore error:', restoreError.message);
        }
      }
      throw error;
    }
    if (trashPath) {
      try { fs.unlinkSync(trashPath); } catch (error) {
        console.error('photo cleanup error:', error.message);
      }
    }
    return res.json({ success: true });
  });

  app.get('/api/messages', requireAdmin, (req, res) => res.json(loadData().messages));

  app.post('/api/messages', (req, res) => {
    if (!CONTACT_FORM_ENABLED) {
      return res.status(503).json({ success: false, error: '線上表單尚未啟用，請改用電話聯絡' });
    }

    const now = Date.now();
    const clientKey = req.ip || 'unknown';
    const lastRequest = recentContacts.get(clientKey) || 0;
    if (now - lastRequest < 60_000) {
      return res.status(429).json({ success: false, error: '請稍候一分鐘再送出' });
    }

    const name = cleanText(req.body.name, 80);
    const phone = cleanText(req.body.phone, 40);
    const email = cleanText(req.body.email, 160);
    const subject = cleanText(req.body.subject, 100);
    const message = cleanText(req.body.message, 2000);
    if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, error: '請填寫有效的姓名、Email 與訊息' });
    }

    const data = loadData();
    data.messages.unshift({
      id: now,
      name,
      phone,
      email,
      subject,
      message,
      date: new Date(now).toISOString(),
      read: false,
    });
    saveData(data);
    recentContacts.set(clientKey, now);
    return res.json({ success: true });
  });

  app.all(['/api/login', '/api/admins'], (req, res) => {
    res.status(410).json({ success: false, error: '舊版管理功能已停用' });
  });

  app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
  app.get('/admin.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'admin.html')));
  app.get('/upload.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'upload.html')));
  app.get('/robots.txt', (req, res, next) => {
    const filePath = path.join(ROOT_DIR, 'robots.txt');
    if (!fs.existsSync(filePath)) return next();
    return res.type('text/plain').sendFile(filePath);
  });
  app.get('/sitemap.xml', (req, res, next) => {
    const filePath = path.join(ROOT_DIR, 'sitemap.xml');
    if (!fs.existsSync(filePath)) return next();
    return res.type('application/xml').sendFile(filePath);
  });
  app.use('/updates', express.static(path.join(ROOT_DIR, 'updates'), {
    extensions: ['html'],
    index: 'index.html',
    fallthrough: false,
  }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const message = String(error && error.message || '');
    const status = error instanceof multer.MulterError || message.startsWith('僅接受')
      ? 400
      : (error.statusCode === 404 || error.status === 404 ? 404 : 500);
    if (status === 500) console.error('request error:', error.message);
    if (status === 404) return res.status(404).type('text/plain').send('找不到頁面');
    return res.status(status).json({ success: false, error: status === 400 ? message : '伺服器暫時無法處理請求' });
  });

  app.use((req, res) => res.status(404).type('text/plain').send('找不到頁面'));

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, '0.0.0.0', () => {
    console.log(`佳旺景觀園藝網站已啟動：http://localhost:${PORT}`);
    if (!ADMIN_API_TOKEN) console.log('管理寫入功能未啟用（尚未設定 ADMIN_API_TOKEN）');
    if (!CONTACT_FORM_ENABLED) console.log('線上聯絡表單未啟用（CONTACT_FORM_ENABLED=false）');
  });
}

module.exports = { createApp, loadData, saveData, safeTokenEquals };
