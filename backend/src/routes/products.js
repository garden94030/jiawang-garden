const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products?category=slug&featured=1&page=1&limit=12
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
], (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 12;
  const offset = (page - 1) * limit;

  let where = ['p.is_active = 1'];
  const params = [];

  if (req.query.category) {
    where.push('c.slug = ?');
    params.push(req.query.category);
  }
  if (req.query.featured === '1') {
    where.push('p.is_featured = 1');
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug,
      (SELECT filename FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
    FROM products p
    JOIN categories c ON p.category_id = c.id
    ${whereStr}
    ORDER BY p.sort_order ASC, p.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM products p
    JOIN categories c ON p.category_id = c.id
    ${whereStr}
  `).get(...params).count;

  res.json({
    data: products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p JOIN categories c ON p.category_id = c.id
    WHERE p.id = ? AND p.is_active = 1
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: '找不到此產品' });

  const images = db.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC'
  ).all(product.id);

  res.json({ ...product, images });
});

// POST /api/products - 需登入
router.post('/', requireAuth, [
  body('name').trim().notEmpty().withMessage('產品名稱不得為空'),
  body('category_id').isInt({ min: 1 }).withMessage('請選擇分類'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, category_id, description, specs, is_featured, sort_order } = req.body;
  const result = db.prepare(`
    INSERT INTO products (name, category_id, description, specs, is_featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, category_id, description || null, specs || null, is_featured ? 1 : 0, sort_order || 0);

  res.status(201).json({ id: result.lastInsertRowid, name });
});

// PUT /api/products/:id - 需登入
router.put('/:id', requireAuth, (req, res) => {
  const { name, category_id, description, specs, is_featured, is_active, sort_order } = req.body;
  const info = db.prepare(`
    UPDATE products SET name=?, category_id=?, description=?, specs=?,
      is_featured=?, is_active=?, sort_order=?,
      updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(name, category_id, description, specs, is_featured ? 1 : 0, is_active ? 1 : 0, sort_order, req.params.id);

  if (!info.changes) return res.status(404).json({ error: '找不到此產品' });
  res.json({ message: '已更新' });
});

// DELETE /api/products/:id - 需登入
router.delete('/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: '找不到此產品' });
  res.json({ message: '已刪除' });
});

module.exports = router;
