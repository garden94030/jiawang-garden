const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginLimiter, [
  body('username').trim().notEmpty().withMessage('請輸入帳號'),
  body('password').notEmpty().withMessage('請輸入密碼'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

  // 固定比對時間，防止 timing attack
  const hash = admin ? admin.password_hash : '$2a$12$invalidhashfortimingatk';
  const match = bcrypt.compareSync(password, hash);

  if (!admin || !match) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  db.prepare('UPDATE admins SET last_login = datetime(\'now\',\'localtime\') WHERE id = ?').run(admin.id);

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token, username: admin.username });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, [
  body('currentPassword').notEmpty().withMessage('請輸入目前密碼'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('新密碼至少8個字元')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('新密碼需包含英文字母及數字'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);

  if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(400).json({ error: '目前密碼不正確' });
  }

  const newHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, admin.id);

  res.json({ message: '密碼已更新' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.admin.id, username: req.admin.username });
});

module.exports = router;
