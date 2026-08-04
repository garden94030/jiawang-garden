# 落地狀態

更新日期：2026-08-04

## 已完成

- 本機 Git／Node 專案初始化、依賴鎖定、Render health check。
- 線上敏感路徑止血：不再公開 `server.js`、`package.json`、runtime JSON 或未授權留言。
- 舊版瀏覽器管理密碼與假登入流程停用；管理 API 預設 fail-closed。
- 聯絡表單在沒有耐久保存時停用；網頁改為使用者提供的 `gardenjiawang@gmail.com` 與 Facebook 聯絡入口。
- 本機媒體 magic-byte、大小與 SHA-256 檢查、去重、manifest lock、原子 JSON 寫入及草稿核准流程。
- Facebook Page 貼文正規化與 S3 相容物件儲存匯入器；缺少耐久儲存時不會保存臨時 CDN URL。
- 靜態更新頁、首頁更新列表、canonical、Open Graph、JSON-LD、robots 與 sitemap。
- 封存或改 slug 後，舊的產生頁會在下次 build 移除。
- Facebook／Instagram／Threads／YouTube adapters 與每平台狀態；不確定結果停止重試。
- GitHub Actions 每週排程與 dry-run／live 雙重開關。

## 需要帳號持有人完成，程式不能代做

- 撤銷／輪替曾出現在公開舊分支的 proxy 與 Gemini API key。
- 不再使用曾寫入公開 Git 歷史的舊網站管理密碼。
- 建立公司 Facebook Page，將既有個人帳號內容手動挑選後重新發布，並授予必要 Page access。
- 建立並授權 Meta App、Instagram 專業帳號、Threads 與 YouTube OAuth。
- 建立 S3 相容耐久物件儲存與公開唯讀媒體網域。
- 在 GitHub 設定 `.env.example` 所列 Secrets／Variables；確認無誤後才把 `SOCIAL_PUBLISH_LIVE` 設為 `true`。
- Google Search Console 的所有權驗證與 sitemap 提交；Google 是否收錄及何時出現不能由程式保證。

## 安全狀態界線

- 公開 repo 舊 `master` 分支已刪除，但曾公開的 key 仍必須在原服務端輪替。
- 外部平台沒有憑證，本輪沒有也不能宣稱已完成真實跨平台發文。
- Render 沒有持久磁碟，因此管理上傳與站內表單保持停用；網站內容改走 Git 與物件儲存流程。
