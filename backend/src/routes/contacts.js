const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { contactLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/contacts - 公開（有速率限制）
router.post('/', contactLimiter, [
  body('name').trim().notEmpty().isLength({ max: 50 }).withMessage('姓名不得為空且不超過50字'),
  body('phone').trim().matches(/^[\d\-\+\(\)\s]{7,20}$/).withMessage('請輸入有效電話號碼'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email 格式不正確'),
  body('subject').trim().notEmpty().isLength({ max: 100 }).withMessage('主旨不得為空'),
  body('message').trim().notEmpty().isLength({ min: 10, max: 1000 }).withMessage('訊息至少10字，不超過1000字'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, phone, email, subject, message } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  db.prepare(`
    INSERT INTO contacts (name, phone, email, subject, message, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, phone, email || null, subject, message, ip);

  res.status(201).json({ message: '感謝您的詢問，我們將盡快與您聯絡！' });
});

// GET /api/contacts - 需登入
router.get('/', requireAuth, (req, res) => {
  const status = req.query.status;
  let sql = 'SELECT * FROM contacts';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

// PATCH /api/contacts/:id/status - 需登入
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'processing', 'done'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: '無效的狀態值' });
  }
  const info = db.prepare('UPDATE contacts SET status=? WHERE id=?').run(status, req.params.id);
  if (!info.changes) return res.status(404).json({ error: '找不到此聯絡單' });
  res.json({ message: '已更新狀態' });
});

module.exports = router;
