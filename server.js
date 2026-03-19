const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname)); // serve index.html, upload.html, admin.html
app.use('/photos', express.static(path.join(__dirname, 'photos')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Data file for shared state (photos metadata, messages, admins)
const DATA_FILE = path.join(__dirname, 'data', 'shared-data.json');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) { console.error('loadData error:', e); }
  return { photos: [], messages: [], admins: [
    { username: 'admin', password: 'jiawang2026', role: 'admin', name: '管理員' },
    { username: 'alai', password: 'butterfly', role: 'editor', name: '劉阿來' },
  ]};
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Initialize data file if missing
if (!fs.existsSync(DATA_FILE)) saveData(loadData());

// --- Photo upload via multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safe = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// === API Routes ===

// Upload photos (multipart form)
app.post('/api/upload', upload.array('photos', 20), (req, res) => {
  try {
    const { name, stage, desc, uploadedBy } = req.body;
    const data = loadData();
    const maxId = data.photos.length > 0 ? Math.max(...data.photos.map(p => p.id)) : 0;
    const now = new Date().toISOString().slice(0, 10);

    const newPhotos = req.files.map((file, i) => ({
      id: maxId + i + 1,
      name: name || '未命名',
      stage: stage || 'adult',
      desc: desc || '',
      filename: file.filename,
      url: '/uploads/' + file.filename,
      date: now,
      uploadedBy: uploadedBy || '劉阿來',
      size: file.size,
    }));

    data.photos = [...newPhotos, ...data.photos];
    saveData(data);

    res.json({ success: true, count: newPhotos.length, photos: newPhotos });
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all photos
app.get('/api/photos', (req, res) => {
  const data = loadData();
  res.json(data.photos);
});

// Delete a photo
app.delete('/api/photos/:id', (req, res) => {
  const data = loadData();
  const id = parseInt(req.params.id);
  const photo = data.photos.find(p => p.id === id);
  if (photo && photo.filename) {
    const filepath = path.join(UPLOADS_DIR, photo.filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
  data.photos = data.photos.filter(p => p.id !== id);
  saveData(data);
  res.json({ success: true });
});

// Get messages
app.get('/api/messages', (req, res) => {
  const data = loadData();
  res.json(data.messages);
});

// Post a message (contact form)
app.post('/api/messages', (req, res) => {
  const { name, phone, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }
  // Basic sanitize
  const sanitize = s => (s || '').replace(/<[^>]*>/g, '').trim();
  const data = loadData();
  data.messages.unshift({
    id: Date.now(),
    name: sanitize(name),
    phone: sanitize(phone),
    email: sanitize(email),
    subject: sanitize(subject),
    message: sanitize(message),
    date: new Date().toISOString(),
    read: false,
  });
  saveData(data);
  res.json({ success: true });
});

// Admin login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const data = loadData();
  const admin = data.admins.find(a => a.username === username && a.password === password);
  if (admin) {
    res.json({ success: true, admin: { username: admin.username, role: admin.role, name: admin.name } });
  } else {
    res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
  }
});

// Get admins (admin only - simplified, no real auth)
app.get('/api/admins', (req, res) => {
  const data = loadData();
  res.json(data.admins.map(a => ({ username: a.username, role: a.role, name: a.name })));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🦋 佳旺景觀園藝伺服器已啟動！');
  console.log('');
  console.log(`   本機瀏覽: http://localhost:${PORT}`);
  console.log(`   上傳頁面: http://localhost:${PORT}/upload.html`);
  console.log(`   管理後台: http://localhost:${PORT}/admin.html`);
  console.log('');
  console.log('   按 Ctrl+C 停止伺服器');
  console.log('');
});
