# 落地狀態

更新日期：2026-08-05

## 已完成

- 本機 Git／Node 專案初始化、依賴鎖定、Render health check。
- 線上敏感路徑止血：不再公開 `server.js`、`package.json`、runtime JSON 或未授權留言。
- 舊版瀏覽器管理密碼與假登入流程停用；管理 API 預設 fail-closed。
- 聯絡表單在沒有耐久保存時停用；網頁改為使用者提供的 `gardenjiawang@gmail.com` 與 Facebook 數字識別碼 `61592853779683` 聯絡入口。
- 本機媒體 magic-byte、大小與 SHA-256 檢查、去重、manifest lock、原子 JSON 寫入及草稿核准流程。
- Facebook Page 貼文正規化與 S3 相容物件儲存匯入器；缺少耐久儲存時不會保存臨時 CDN URL。
- 靜態更新頁、首頁更新列表、canonical、Open Graph、JSON-LD、robots 與 sitemap。
- 封存或改 slug 後，舊的產生頁會在下次 build 移除。
- Facebook／Instagram／Threads／YouTube adapters 與每平台狀態；不確定結果停止重試。
- GitHub Actions 每週排程與 dry-run／live 雙重開關。
- 現行 HEAD 的 Weekly content sync 已完成一次 GitHub Actions dry-run，未進入 live、未對外發文。
- 正方形品牌標誌已建立並公開，首頁與更新頁已加入 favicon、Apple 圖示及 `Organization.logo` 結構化資料。
- 依實際影像整理並發布 4 篇自然觀察內容，共 20 張照片；未猜測日期、客戶、工程歸屬或未鑑定物種。
- Runtime JSON 對錯誤 schema 同樣 fail-closed；管理上傳與聯絡表單另需 `DURABLE_WRITES_ENABLED=true`，避免在 Render 臨時磁碟誤報成功。

## 需要帳號持有人完成，程式不能代做

- 撤銷／輪替曾出現在公開舊分支的 proxy 與 Gemini API key。
- 不再使用曾寫入公開 Git 歷史的舊網站管理密碼。
- 在 Facebook 內確認數字識別碼 `61592853779683` 是否為公司 Page；若仍是個人檔案，再建立公司 Page，手動挑選既有內容後重新發布，並授予必要 Page access。
- 建立並授權 Meta App、Instagram 專業帳號、Threads 與 YouTube OAuth。
- 建立 S3 相容耐久物件儲存與公開唯讀媒體網域。
- 在 GitHub 設定 `.env.example` 所列 Secrets／Variables；確認無誤後才把 `SOCIAL_PUBLISH_LIVE` 設為 `true`。
- Google Search Console 的所有權驗證與 sitemap 提交；Google 是否收錄及何時出現不能由程式保證。

## 安全狀態界線

- 公開 repo 舊 `master` 分支已刪除，但曾公開的 key 仍必須在原服務端輪替。
- 外部平台沒有憑證，本輪沒有也不能宣稱已完成真實跨平台發文。
- Render 沒有持久磁碟，因此管理上傳與站內表單保持停用；網站內容改走 Git 與物件儲存流程。
- `SOCIAL_PUBLISH_LIVE=false`，目前 GitHub 尚未設定平台 Secrets；跨平台真實發布仍未啟用。
- 無關的遠端 `claude/amazing-newton` 分支仍保留；未取得明確刪除授權前不做破壞性處理。
