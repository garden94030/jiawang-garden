const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 確保上傳目錄存在
const UPLOAD_DIR = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer 設定（記憶體存儲，由 sharp 處理後再寫入）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 10) * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('僅允許上傳 JPG、PNG、WebP 格式'));
    }
    cb(null, true);
  },
});

// POST /api/uploads/product/:productId - 上傳產品圖片
router.post('/product/:productId', requireAuth, upload.array('images', 5), async (req, res) => {
  const { productId } = req.params;
  const product = db.prepare('SELECT id FROM products WHERE id=?').get(productId);
  if (!product) return res.status(404).json({ error: '找不到此產品' });

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '請選擇圖片檔案' });
  }

  const saved = [];
  for (const file of req.files) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    const outputPath = path.join(UPLOAD_DIR, filename);

    // 使用 sharp 壓縮轉換為 WebP
    await sharp(file.buffer)
      .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);

    // 判斷是否為第一張圖（設為主圖）
    const existingImages = db.prepare('SELECT COUNT(*) as c FROM product_images WHERE product_id=?').get(productId).c;
    const isPrimary = existingImages === 0 && saved.length === 0 ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO product_images (product_id, filename, alt_text, is_primary)
      VALUES (?, ?, ?, ?)
    `).run(productId, filename, req.body.alt_text || null, isPrimary);

    saved.push({ id: result.lastInsertRowid, filename, url: `/uploads/products/${filename}` });
  }

  res.status(201).json({ message: `已上傳 ${saved.length} 張圖片`, images: saved });
});

// DELETE /api/uploads/image/:imageId - 刪除圖片
router.delete('/image/:imageId', requireAuth, (req, res) => {
  const image = db.prepare('SELECT * FROM product_images WHERE id=?').get(req.params.imageId);
  if (!image) return res.status(404).json({ error: '找不到此圖片' });

  const filePath = path.join(UPLOAD_DIR, image.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM product_images WHERE id=?').run(image.id);

  res.json({ message: '已刪除圖片' });
});

// PATCH /api/uploads/image/:imageId/primary - 設為主圖
router.patch('/image/:imageId/primary', requireAuth, (req, res) => {
  const image = db.prepare('SELECT * FROM product_images WHERE id=?').get(req.params.imageId);
  if (!image) return res.status(404).json({ error: '找不到此圖片' });

  db.prepare('UPDATE product_images SET is_primary=0 WHERE product_id=?').run(image.product_id);
  db.prepare('UPDATE product_images SET is_primary=1 WHERE id=?').run(image.id);

  res.json({ message: '已設為主圖' });
});

module.exports = router;
