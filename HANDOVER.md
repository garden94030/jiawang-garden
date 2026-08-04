# 佳旺景觀園藝接續說明

更新日期：2026-08-05（Asia/Taipei）

## 目前基準

- 專案目錄：`/Users/justin/Documents/佳旺景觀園藝`
- 工作分支：`codex/facebook-seo-pipeline`
- 線上分支：`main`
- 本輪照片上線前基準 commit：`750d200`（`docs: add verified project handover`）
- 公開網站：<https://jiawang-garden.onrender.com/>
- 更新總覽：<https://jiawang-garden.onrender.com/updates/>
- GitHub repository：<https://github.com/garden94030/jiawang-garden>

`IMPLEMENTATION_PLAN.md` 第 2 節是開始落地前的歷史基準，不是目前狀態。續作時先讀本文件與 `IMPLEMENTATION_STATUS.md`。

## 已完成

- 本機、GitHub、Render 初始化與部署。
- 線上伺服器原始碼、套件資訊、runtime JSON 與規劃文件不公開。
- 舊版假登入、瀏覽器密碼、公開管理 API 與無耐久保存的聯絡表單已停用。
- Runtime JSON 語法或 schema 錯誤時 fail-closed。
- `DURABLE_WRITES_ENABLED`、管理 token、聯絡表單三者形成寫入 gate；Render 目前固定關閉。
- 手動媒體匯入具備 magic-byte、大小、SHA-256、來源與內容防重、manifest lock、原子寫入、失敗回滾及草稿核准。
- Facebook Page 官方 API 匯入、S3 相容物件儲存、Facebook／Instagram／Threads／YouTube adapters 已實作；缺少憑證時 fail-closed。
- 跨平台發送前保存 `attempting`，結果不明標為 `uncertain`，不自動重送。
- 首頁及更新頁具備 canonical、Open Graph、JSON-LD、品牌 logo、favicon、robots 與 sitemap。
- 已發布 12 篇有影像證據支持的園藝與自然觀察內容，共 34 張照片；本輪新增 8 篇、15 張，未猜測地點、客戶、工程歸屬或未鑑定物種。
- 本輪明確排除修樹作業、可辨識車牌、疑似聯絡數字紙卡及較近遊客的照片；只移除網站媒體副本，`photos/` 原始檔仍完整保留。
- Google Ads 正方形標誌已保存於 `public/branding/google-ads-logo-square.png`。

## 驗證證據

- 本機 `npm test`：46/46 通過。
- 本機 `npm audit --audit-level=high`：0 vulnerabilities。
- 目前 34 張網站引用媒體已核對檔案存在與 SHA-256；其中 30 張沒有 EXIF segment，4 張只有空白 ImageDescription tag，未含 GPS pointer、相機廠牌或型號。
- GitHub Validate（`main`、commit `0f03796`）：<https://github.com/garden94030/jiawang-garden/actions/runs/30958915690>
- Weekly content sync dry-run（`main`、commit `0f03796`）：<https://github.com/garden94030/jiawang-garden/actions/runs/30958954241>
- dry-run 沒有進入 live；缺少 Meta 憑證時 Facebook 同步結果為 `not_configured`。
- 2026-08-05 線上實測：首頁、`/healthz`、`/updates/`、文章、媒體、logo、robots、sitemap 為 200；`/server.js` 與 `/data/shared-data.json` 為 404；`/api/messages` 為 503。

## 安全開關現況

- GitHub Variable `SOCIAL_PUBLISH_LIVE=false`。
- GitHub Variable `AI_COPY_ENABLED=false`。
- Render `CONTACT_FORM_ENABLED=false`。
- Render `DURABLE_WRITES_ENABLED=false`。
- GitHub 目前沒有平台 Secrets，因此不得宣稱真實跨平台發布已完成。

## 必須由帳號持有人完成

1. 確認 Facebook 數字識別碼 `61592853779683` 是「佳旺景觀園藝」Page，並確認使用者有完整控制權。
2. 建立 Meta Developer App，授權 Facebook Page、Instagram 專業帳號與 Threads，取得官方 token。
3. 建立 YouTube 頻道與 Google Cloud OAuth；首次自動上傳固定為 private。
4. 建立 S3 相容耐久物件儲存（規劃使用 Cloudflare R2），取得 bucket、endpoint 與最小權限金鑰。
5. 在 GitHub Secrets／Variables 填入 `.env.example` 所列值；先保持 `SOCIAL_PUBLISH_LIVE=false` 做測試。
6. 在 Google Search Console 驗證網站並提交 `https://jiawang-garden.onrender.com/sitemap.xml`。
7. 到原服務後台撤銷／輪替曾出現在公開舊分支的 proxy 與 Gemini key；刪除 Git 分支不能證明舊 key 已失效。
8. 如果舊網站密碼曾在其他平台重用，逐一更換。

不需要也不得把 Facebook、Google、GitHub 或其他帳號密碼交給 Codex；本人只需完成登入、兩步驟驗證與平台授權。

## 目前保留、不自動處理

- Repository 目前是 PUBLIC。改 private 前需確認 Render 對私有 repository 的存取安排。
- 遠端 `claude/amazing-newton` 是無關分支；未取得明確刪除授權前保留。
- `photos/` 仍有原始照片與 `exec-*.png` 合成圖。不可使用 `git add .`、不可批次刪除；每次只加入已審核的精確路徑。
- 使用者已於 2026-08-05 明確決定「颱風過後的修樹工程」全組不發布，原因是照片中的作業人員未配戴安全帽；後續不得自動納入網站或跨平台佇列。
- `30米長的植物觀察步道.jpg` 有可辨識車牌、`505238076_...jpg` 邊緣有數字紙卡、`504654955_...jpg` 與 `月眉濕地落羽松5.jpg` 有較近遊客，均未公開。

## 接續命令

```bash
git status --short --branch
npm ci
npm run build
npm test
npm audit --audit-level=high
git diff --check
```

人工照片流程：把一組照片與 `note.txt` 放進 `content/inbox/<主題>/`，先執行 `npm run content:import:dry-run`，確認後才執行 `npm run content:import`；匯入內容預設為 draft，逐篇檢查 JSON 後使用 `npm run content:approve -- --content <內容編號>`。
