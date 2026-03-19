const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories - 公開
router.get('/', (req, res) => {
  const categories = db.prepare(
    'SELECT * FROM categories ORDER BY sort_order ASC'
  ).all();
  res.json(categories);
});

// POST /api/categories - 需登入
router.post('/', requireAuth, [
  body('name').trim().notEmpty().withMessage('分類名稱不得為空'),
  body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('slug 只能包含小寫英文、數字及連字號'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, slug, description, sort_order } = req.body;
  try {
    const result = db.prepare(
      'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)'
    ).run(name, slug, description || null, sort_order || 0);
    res.status(201).json({ id: result.lastInsertRowid, name, slug });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: '分類名稱或 slug 已存在' });
    }
    throw err;
  }
});

// PUT /api/categories/:id - 需登入
router.put('/:id', requireAuth, (req, res) => {
  const { name, slug, description, sort_order } = req.body;
  const info = db.prepare(
    'UPDATE categories SET name=?, slug=?, description=?, sort_order=? WHERE id=?'
  ).run(name, slug, description, sort_order, req.params.id);
  if (!info.changes) return res.status(404).json({ error: '找不到此分類' });
  res.json({ message: '已更新' });
});

// DELETE /api/categories/:id - 需登入
router.delete('/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: '找不到此分類' });
  res.json({ message: '已刪除' });
});

module.exports = router;
