# 赫采國際衛浴 網站啟動指南

## 快速啟動

### 1. 安裝所有依賴套件
```bash
npm run install:all
```

### 2. 設定環境變數
```bash
cp .env.example backend/.env
# 用記事本開啟 backend/.env，修改 JWT_SECRET 和管理員密碼
```

### 3. 開發模式（前後端同時啟動）
```bash
npm run dev
```
- 前端：http://localhost:5173
- 後端 API：http://localhost:3001

---

## 目錄結構

```
赫采國際衛浴/
├── frontend/               # React 前端（Vite + Tailwind）
│   ├── src/
│   │   ├── pages/          # 各頁面元件
│   │   │   ├── Home.jsx        首頁（英雄圖 + 產品系列 + 品牌故事）
│   │   │   ├── Products.jsx    產品列表（分類篩選 + 分頁）
│   │   │   ├── ProductDetail.jsx  產品詳情（圖片輪播 + 規格）
│   │   │   ├── About.jsx       關於我們（品牌故事 + 地圖）
│   │   │   ├── Contact.jsx     預約洽詢（表單 + 聯絡資訊）
│   │   │   └── Admin/          管理後台（需登入）
│   │   ├── components/     # 共用元件（Navbar, Footer, ProductCard）
│   │   ├── contexts/       # AuthContext（JWT 登入狀態）
│   │   └── services/       # API 封裝（axios）
│   └── public/
│       ├── hero-bg.jpg     ← ★ 請替換為實際高畫質浴室情境大圖
│       └── placeholder.jpg ← 產品無圖時的備用圖
│
├── backend/                # Node.js + Express 後端
│   ├── server.js           入口點（helmet, cors, rate-limit）
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js SQLite 初始化（分類、管理員帳號）
│   │   ├── middleware/
│   │   │   ├── auth.js     JWT 驗證中介層
│   │   │   └── rateLimiter.js  速率限制（防暴力破解）
│   │   └── routes/
│   │       ├── auth.js     登入 / 改密碼
│   │       ├── products.js 產品 CRUD
│   │       ├── categories.js   分類管理
│   │       ├── contacts.js 聯絡表單
│   │       └── uploads.js  圖片上傳（sharp 壓縮 → WebP）
│   ├── data/               SQLite 資料庫（自動建立）
│   └── uploads/products/   上傳的產品圖片
│
├── .env.example            環境變數範本
└── package.json            根 package（concurrently 同時啟動）
```

---

## 重要設定

### Hero 首頁大圖
請將高畫質的浴室情境照（建議 1920×1080 以上）放到：
```
frontend/public/hero-bg.jpg
```

### 管理後台
- 網址：http://localhost:5173/admin/login
- 預設帳號：`admin`
- 預設密碼：`ChangeMe@2024!`（**首次登入後請立即修改**）

### 上傳產品圖片
1. 登入後台 → 產品管理
2. 點擊產品右側的上傳圖示
3. 支援 JPG / PNG / WebP，自動壓縮轉換為 WebP

---

## 安全設計重點

| 層面 | 實作 |
|------|------|
| HTTP 標頭 | Helmet.js（XSS、CSRF、Clickjacking 防護） |
| CORS | 白名單限制來源網域 |
| 速率限制 | 登入 10次/15分、表單 5次/小時 |
| 身份驗證 | JWT（HS256）+ bcrypt 密碼雜湊 |
| SQL 注入 | better-sqlite3 參數化查詢 |
| 圖片安全 | 型別驗證 + sharp 重新處理，避免惡意檔案 |
| 輸入驗證 | express-validator 雙層驗證 |

---

## 正式部署建議

1. 將 `backend/.env` 的 `NODE_ENV` 改為 `production`
2. 設定 HTTPS（Let's Encrypt）
3. 更新 `CORS_ORIGIN` 為實際網域
4. 使用 `npm run build` 打包前端，由 Express 靜態服務
5. 使用 PM2 管理 Node.js 程序
