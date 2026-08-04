# 佳旺景觀園藝

佳旺景觀園藝工程行的網站與多平台內容發布專案。

## 本機啟動

```bash
npm ci
npm test
npm run build
npm start
```

預設網址為 <http://localhost:3000>，健康檢查為 <http://localhost:3000/healthz>。

## 安全預設

- 舊版管理與公開上傳頁已停用。
- 未設定 `ADMIN_API_TOKEN` 時，所有管理寫入 API 都會拒絕請求。
- 未設定耐久的聯絡資料保存方式前，`CONTACT_FORM_ENABLED` 維持 `false`，網站不會顯示假的送出成功。
- 真實密鑰只放 Render 或 GitHub Secrets，不得寫入 Git。
- `server.js`、`package.json`、環境設定範本與規劃文件不會由網站公開提供。

環境變數請參考 `.env.example`。不要把填入真實密鑰的 `.env` 提交到 Git。

## 實作與操作文件

- 詳細落地方案：`IMPLEMENTATION_PLAN.md`
- 實際操作手冊：`OPERATIONS.md`
- 完成狀態與外部待辦：`IMPLEMENTATION_STATUS.md`
- 帳號申請順序：`ACCOUNT_SETUP_CHECKLIST.md`
- 每週內容來源：公司 Facebook 粉絲專頁
- 發布目標：公司網站、Facebook、Instagram、Threads、YouTube

平台帳號尚未授權時，同步與發布流程必須以 `dry-run` 或 `not_configured` 結束，不得嘗試使用個人 Facebook 密碼或瀏覽器 Cookie。
