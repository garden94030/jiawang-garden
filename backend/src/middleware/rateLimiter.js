const rateLimit = require('express-rate-limit');

// 一般 API 限制：每15分鐘最多200次
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
});

// 登入限制：每15分鐘最多10次（防暴力破解）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登入嘗試次數過多，請15分鐘後再試' },
});

// 聯絡表單限制：每小時最多5次
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '提交次數過多，請一小時後再試' },
});

module.exports = { generalLimiter, loginLimiter, contactLimiter };
