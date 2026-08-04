# 佳旺景觀園藝操作手冊

## 目前網站

- 公開網址：<https://jiawang-garden.onrender.com/>
- 健康檢查：<https://jiawang-garden.onrender.com/healthz>
- Sitemap：<https://jiawang-garden.onrender.com/sitemap.xml>
- 電子信箱：<mailto:gardenjiawang@gmail.com>

## 最簡單的人工照片流程

1. 在 `content/inbox/` 建立一個資料夾，名稱使用 `YYYY-MM-DD-主題`，例如 `2026-08-04-蝴蝶園整理`。
2. 把這次的照片或影片放入資料夾。
3. 可另放一個 UTF-8 的 `note.txt`；第一行會成為標題，其餘文字成為說明。
4. 先檢查，不寫入：

   ```bash
   npm run content:import:dry-run
   ```

5. 確認沒有明顯錯誤後匯入：

   ```bash
   npm run content:import
   ```

6. 匯入內容一律先是草稿，不會自動上網。核准單篇：

   ```bash
   npm run content:approve -- --content 內容編號
   npm run build
   npm test
   ```

`content/inbox/` 的原始檔不會提交到 Git；匯入器會檢查檔案內容、大小及 SHA-256，並防止同一來源或相同媒體重複匯入。

## 父親的使用方式

日常聯絡可使用 `gardenjiawang@gmail.com`。最省事的內容發布方式是建立「佳旺景觀園藝」Facebook Page，父親只需要在 Page 發照片與文字。由你保留 Page 完整控制權，再授予父親發文所需的 Page access。Meta 的官方建立流程本身沒有付款步驟；廣告或加強推廣才是另外選購。

目前提供的 `alia.liu.60365` 是個人 Facebook 帳號，網站可以連結，但正式每週自動同步只使用 Facebook Page 與官方 API，不抓個人密碼、Cookie，也不以爬蟲繞過登入限制。

官方操作入口：

- 建立 Page：<https://www.facebook.com/pages/create>
- Page access 說明：<https://www.facebook.com/help/187316341316631>

## 每週自動流程

GitHub Actions 設定為每週一 09:00（Asia/Taipei）執行：

1. 測試與建置。
2. 從公司 Facebook Page 讀取自己發布且含照片／影片的貼文。
3. 先把媒體保存至 S3 相容的耐久物件儲存，再建立網站內容；保存失敗就停住。
4. 重新產生網站更新頁、首頁列表、robots 與 sitemap。
5. 依序處理 Facebook、Instagram、Threads、YouTube；Facebook 來源不會再貼回 Facebook，純照片不送 YouTube，YouTube 初次上傳固定為 private。
6. 每個平台送出前先保存 attempt 狀態；結果不確定時標記 uncertain 並停止自動重試，避免重複發文。

只有同時設定 `SOCIAL_PUBLISH_LIVE=true`、執行 `--live`，且平台憑證完整時才會真的呼叫發布 API；其餘情況安全結束為 dry-run、not_configured 或 held。

## 外部設定項目

所有真實值只放 GitHub Actions Secrets／Variables，不放進 Git。名稱完整列在 `.env.example`：

- Meta：Graph API version、Facebook Page ID／token、Instagram account／token、Threads user／token。
- YouTube：OAuth client ID、client secret、refresh token。
- 物件儲存：endpoint、bucket、access key、secret key、公開媒體網址。
- AI 文案為選配；未啟用時使用只根據已確認文字產生的固定繁中模板。

設定完成前可執行：

```bash
npm run social:sync:dry-run
npm run social:publish:dry-run
```

## 發布前最小檢查

```bash
npm ci
npm test
npm run build
npm audit --audit-level=high
git diff --check
```

不需要商業級審批表、軍規證據層級或繁複 gate；只保留防止資料損失、明顯錯誤與重送所需的檢查。
