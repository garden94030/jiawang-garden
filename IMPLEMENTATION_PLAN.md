# 佳旺景觀園藝網站與多平台發布系統落地方案

- 文件狀態：可執行規格 v1.0
- 制定日期：2026-08-04
- 專案目錄：`/Users/justin/Documents/佳旺景觀園藝`
- 遠端儲存庫：`https://github.com/garden94030/jiawang-garden.git`
- 現行網站：`https://jiawang-garden.onrender.com`

## 1. 目標

將現有「佳旺景觀園藝工程行」網站改造成一套低維護的內容發布系統：

1. 父親只需要在 Facebook 公司粉絲專頁發布照片、影片與簡單文字。
2. 使用者負責建立帳號、授權、內容校正與所有技術維護。
3. 系統每週讀取新的公司粉絲專頁內容，保存媒體並更新公司網站。
4. 同一份內容可依平台格式發布至 Facebook、Instagram、Threads 與 YouTube。
5. 網站建立可被搜尋引擎與 AI 搜尋理解的獨立內容頁。
6. 品質控制只採防止資料遺失、重複發布與明顯錯誤所需的最小機制，不建立商業級、軍規式或多層審批流程。

## 2. 已確認的現況

### 2.1 本機

- 本機目錄已經是 Git 儲存庫。
- 目前是尚未提交的 `main` 分支。
- 尚未設定遠端。
- 尚未下載網站檔案。

### 2.2 遠端網站

遠端 `main` 目前是單頁 HTML 與 Express 架構，主要檔案包括：

- `index.html`
- `server.js`
- `admin.html`
- `upload.html`
- `package.json`
- `render.yaml`
- `photos/`
- `uploads/`
- `data/`

### 2.3 目前必須先修正的問題

1. 管理帳密直接出現在公開原始碼與瀏覽器程式中。
2. 上傳、刪除與管理資料的 API 沒有真正的伺服器端授權。
3. `admin.html` 的資料主要存放在瀏覽器 `localStorage`，不是可跨裝置使用的正式資料。
4. 聯絡表單目前只顯示成功訊息，沒有真正送出資料。
5. 照片與 JSON 寫入 Render 執行中的本機檔案系統，重新部署或重啟時可能遺失。
6. 首頁的相簿與蝴蝶資料多由 JavaScript 在瀏覽器動態產生，不利於逐頁索引。
7. 缺少 canonical、Open Graph、sitemap、robots 與主要結構化資料。
8. 網站部分公司資訊與經歷敘述尚未由使用者確認，不能直接當成 SEO 事實擴寫。

## 3. 明確的使用者角色

### 3.1 父親

父親只負責：

- 使用原本熟悉的 Facebook App。
- 切換到「佳旺景觀園藝工程行」粉絲專頁。
- 發布照片、影片及簡單說明。

父親不需要：

- 操作網站後台。
- 操作 Instagram、Threads 或 YouTube。
- 設定 API、密碼、排程或 SEO。
- 判斷發布失敗原因。

### 3.2 使用者

使用者負責：

- 持有所有平台的完整控制權。
- 建立與連接 Facebook Page、Instagram、Threads、YouTube。
- 保存與更新平台授權。
- 手動搬移父親個人帳號內的舊照片與影片。
- 校正公司名稱、電話、地址、服務區域、營業時間與公開文案。
- 處理系統標示為失敗或待確認的項目。

### 3.3 系統

系統負責：

- 每週發現新素材。
- 防止重複下載與重複發布。
- 保存媒體與來源資料。
- 產生網站內容頁、摘要、圖片說明與各平台文案。
- 發布至已啟用的平台。
- 留下一份簡短執行結果。

## 4. 帳號與權限配置

### 4.1 Facebook

- 建立「佳旺景觀園藝工程行」粉絲專頁。
- 使用者保留完整控制權。
- 父親取得部分 Facebook 存取權，僅用於發布內容。
- 不給父親完整控制、管理其他人權限或刪除專頁的權限。
- 粉絲專頁作為日後新素材的主要入口。

### 4.2 Instagram

- 建立公司 Instagram 帳號，或將既有公司帳號轉為專業帳號。
- 建議採 Business 帳號。
- 連接 Facebook 公司粉絲專頁。
- 使用者持有登入與復原方式。
- 父親不需要登入 Instagram。

### 4.3 Threads

- 使用公司 Instagram 帳號建立對應 Threads 帳號。
- 顯示名稱、頭像與公司介紹和 Facebook Page 保持一致。
- 使用者持有帳號與 API 授權。

### 4.4 YouTube

- 使用使用者控制的 Google 帳號建立公司 YouTube 頻道。
- 使用者是頻道擁有者。
- 初期自動上傳一律設為私人影片。
- 使用者確認標題、封面與內容後，再手動設為公開。
- 完成 API 稽核前，不宣稱能全自動公開影片。

### 4.5 權杖與密鑰

下列資料只能放在部署環境或 GitHub Actions Secrets，不得提交至 Git：

- Meta App ID 與 App Secret
- Facebook Page ID 與 Page access token
- Instagram Account ID
- Threads User ID 與 access token
- Google OAuth client ID、client secret 與 refresh token
- 物件儲存空間存取金鑰
- AI 服務金鑰（若啟用）

## 5. 系統架構

```text
父親的 Facebook Page 貼文
        │
        ▼
每週同步工作（GitHub Actions）
        │
        ├── 讀取來源貼文與媒體
        ├── 驗證來源、格式與重複狀況
        ├── 保存原始媒體／網站版媒體
        ├── 建立內容紀錄與網站文章
        ├── 產生平台別文字
        └── 發布／重試尚未成功的平台
                │
                ├── 公司網站
                ├── Instagram
                ├── Threads
                └── YouTube（有影片時，初期私人）
```

### 5.1 保留既有技術棧

第一版不重寫成大型 CMS 或全新框架，保留：

- Node.js
- Express
- 現有 HTML/CSS 視覺基礎
- Render 部署

新增內容產生腳本與平台發布模組。等現有流程穩定後，才評估是否需要更換框架。

### 5.2 資料保存選擇

採用：

- 媒體檔：S3 相容的耐久物件儲存空間，預設建議 Cloudflare R2。
- 內容、來源與發布狀態：JSON 檔案納入 Git 版本管理。
- 網站更新頁：產生靜態 HTML，隨 Git 推送由 Render 部署。

第一版不導入資料庫，原因是：

- 每週內容量低。
- 沒有多人同時編輯需求。
- JSON 加 Git 已足以提供版本、回復與防重。
- 避免增加不必要的維運服務。

若未來內容量或管理需求明顯增加，再遷移到 SQLite/Postgres；不在第一版預先建置。

## 6. 內容來源模式

### 6.1 新內容：Facebook Page

預設處理條件：

- 由公司 Facebook Page 發布。
- 含至少一張照片或一段影片。
- 屬於公司自己發布的內容。
- 排除分享他人貼文、廣告、留言與個人動態。

公司專頁本身即視為父親對外公開內容的確認，不再增加第二層審批。

### 6.2 舊內容：使用者手動匯入

建立本機素材匣：

```text
content/inbox/
  2026-08-04-example/
    original-01.jpg
    original-02.jpg
    note.txt
```

使用者將舊照片、影片與說明放入同一資料夾，再執行匯入命令。系統先建立草稿；只有明確執行發布命令時才發布。

### 6.3 網站手動補件

若 Facebook 貼文缺少必要說明，允許在內容 JSON 補上：

- 正確活動名稱
- 日期
- 地點
- 蝴蝶種類
- 教學或工程說明

補寫內容必須由使用者確認，不由 AI 猜測。

## 7. 內容資料格式

每一筆內容使用一個永久內部 ID，建議格式：

```json
{
  "id": "jw-20260804-facebook-123456",
  "source": {
    "platform": "facebook",
    "post_id": "123456",
    "permalink": "https://www.facebook.com/...",
    "published_at": "2026-08-04T09:00:00+08:00",
    "original_text": "父親原始貼文文字"
  },
  "content": {
    "title": "校園蝴蝶園生態紀錄",
    "summary": "經確認後的簡短摘要",
    "category": "butterfly-garden",
    "species": null,
    "location": null,
    "event_date": null,
    "slug": "2026-08-04-butterfly-garden"
  },
  "media": [
    {
      "id": "media-01",
      "type": "image",
      "source_url": "https://...",
      "storage_url": "https://media.example/...",
      "sha256": "...",
      "alt": "蝴蝶園植栽與生態環境",
      "width": 1600,
      "height": 1200
    }
  ],
  "publishing": {
    "website": { "status": "published", "url": "/updates/..." },
    "facebook": { "status": "source", "post_id": "123456" },
    "instagram": { "status": "pending", "post_id": null },
    "threads": { "status": "pending", "post_id": null },
    "youtube": { "status": "skipped", "reason": "no_video" }
  },
  "created_at": "2026-08-04T09:10:00+08:00",
  "updated_at": "2026-08-04T09:10:00+08:00"
}
```

### 7.1 允許的狀態

- `pending`：尚未處理。
- `published`：已成功發布並保存平台 ID。
- `source`：原始內容已存在於該平台，不需重發。
- `skipped`：平台不支援或不適用。
- `failed`：執行失敗，可安全重試。
- `held`：資料明顯不足或格式異常，暫不發布。

不建立更多審批或證據層級。

## 8. 各平台發布規則

### 8.1 公司網站

所有合格內容都建立網站更新頁：

```text
/updates/YYYY-MM-DD-slug/
```

頁面包括：

- 標題
- 發布日期／活動日期（若已確認）
- 簡短摘要
- 照片或影片
- 可見的圖片說明
- 原始 Facebook 貼文連結
- 相關服務連結
- 公司聯絡方式

### 8.2 Facebook

- 來源本來就是 Facebook Page 時，標記為 `source`，不重複發文。
- 使用者手動匯入的內容才由發布模組建立 Facebook 貼文。
- 成功後保存 Page post ID 與永久連結。

### 8.3 Instagram

- 單圖：建立一般圖片貼文。
- 多圖：建立輪播貼文；超過平台限制時只取前段代表圖片，完整內容連回網站。
- 短直式影片：優先建立 Reel。
- 不支援的檔案先轉成支援格式；轉檔失敗只略過 Instagram，不阻擋其他平台。
- 文字以原始內容為基礎，加入適量主題標籤，不堆砌無關關鍵字。

### 8.4 Threads

- 使用較短的敘事文字。
- 選擇一張代表照片或一段影片。
- 加入完整網站文章連結。
- 不自動發布長串回覆；第一版只建立單則貼文。

### 8.5 YouTube

- 只有含影片的內容才處理。
- 照片不自動拼成影片，以避免產生低品質內容。
- 上傳時設定正確標題、說明、拍攝日期（已確認時）與網站連結。
- 初期隱私設定為 `private`。
- 保存 YouTube video ID 與處理狀態。
- YouTube 完成影片處理後才標記上傳成功。
- 是否適合作為 Short 由影片尺寸與平台當時規則判斷，不在程式中永久寫死舊規則。

## 9. AI 使用規格

### 9.1 AI 可以做的事

- 將父親的原始文字整理成通順繁體中文。
- 產生網站標題與摘要。
- 產生不涉及物種判定的圖片替代文字。
- 產生 Facebook、Instagram、Threads、YouTube 的平台別文字草稿。
- 建議內容分類，例如：
  - 蝴蝶生態
  - 園藝工程
  - 校園教學
  - 戶外導覽
  - 植栽與棲地

### 9.2 AI 不可以做的事

- 根據模糊照片自行斷定蝴蝶物種。
- 自行添加學校、客戶、地址、活動名稱或日期。
- 自行添加工程規模、價格、年資或合作數量。
- 編造父親沒有說過的故事與客戶評價。
- 宣稱不存在的證照、獎項或專業資格。

### 9.3 AI 失敗時

- AI 不是發布必要條件。
- AI 呼叫失敗時，使用原始貼文文字與通用圖片說明。
- 不因 AI 服務暫停而漏掉素材或重複發布。
- 所有 AI 輸出都保存產生時間與模型名稱，但不保存密鑰。

## 10. AI SEO 與搜尋架構

### 10.1 基本技術 SEO

- 每頁唯一 `<title>`。
- 每頁唯一 meta description。
- canonical URL。
- Open Graph 與社群預覽圖片。
- `robots.txt`。
- 自動更新的 `sitemap.xml`。
- 正確的繁體中文語言標記。
- 可被爬蟲直接讀取的 HTML 文字，不把主要內容只放在瀏覽器 JavaScript。
- 圖片寬高、懶載入與適當壓縮。
- 手機版可讀性與基本無障礙。

### 10.2 結構化資料

確認真實公司資訊後加入：

- `Organization`
- 有可公開實體地址時才加入 `LocalBusiness`
- 更新頁加入 `Article`
- 圖片加入 `ImageObject`
- 影片加入 `VideoObject`
- 頁面階層加入 `BreadcrumbList`

結構化資料必須和頁面可見內容一致，不加入隱藏或未證實資訊。

### 10.3 在地與品牌一致性

Facebook、Instagram、Threads、YouTube、網站與 Google Business Profile 統一：

- 公司正式名稱
- 公司簡介
- 電話
- 服務區域
- 營業時間
- 頭像與封面風格
- 網站網址

地址未確認或不打算公開時，不虛構實體地址。

### 10.4 AI 搜尋可理解性

- 每篇更新頁清楚回答「做了什麼、何時、在哪裡、與哪項服務有關」。
- 只有已確認的時間、地點與物種才寫入答案。
- 建立清楚的服務頁：景觀園藝、蝴蝶園規劃、生態教學、校園綠美化。
- 建立真實案例與活動紀錄，避免大量低價值 AI 文章。
- 可新增 `llms.txt` 作為補充索引說明，但不把它當成排名保證或主要 SEO 方法。

## 11. 預定檔案結構

```text
.
├── index.html
├── server.js
├── package.json
├── render.yaml
├── IMPLEMENTATION_PLAN.md
├── content/
│   ├── business.json
│   ├── social-imports.json
│   ├── updates/
│   │   └── jw-YYYYMMDD-source-id.json
│   └── inbox/
├── updates/
│   └── YYYY-MM-DD-slug/
│       └── index.html
├── scripts/
│   ├── init-content.js
│   ├── import-local-media.js
│   ├── sync-facebook.js
│   ├── build-site.js
│   ├── publish-content.js
│   ├── generate-sitemap.js
│   └── lib/
│       ├── manifest.js
│       ├── media.js
│       ├── ai-copy.js
│       ├── content-policy.js
│       ├── storage.js
│       └── publishers/
│           ├── website.js
│           ├── facebook.js
│           ├── instagram.js
│           ├── threads.js
│           └── youtube.js
├── tests/
│   ├── manifest.test.js
│   ├── dedupe.test.js
│   ├── retry.test.js
│   ├── content-policy.test.js
│   ├── build-site.test.js
│   └── fixtures/
├── .github/
│   └── workflows/
│       ├── validate.yml
│       └── weekly-content-sync.yml
├── .env.example
├── robots.txt
└── sitemap.xml
```

## 12. 每週排程流程

預設時間：每週一 09:00，時區 `Asia/Taipei`。

執行順序：

1. 讀取上次成功同步游標。
2. 取得 Facebook Page 新貼文。
3. 只保留含自有照片或影片的公司貼文。
4. 以來源 post ID 檢查是否已匯入。
5. 下載媒體到暫存區。
6. 檢查檔案類型、大小與 checksum。
7. 上傳媒體到耐久物件儲存空間。
8. 建立內容 JSON。
9. 產生網站頁面與 sitemap。
10. 執行本機測試與連結檢查。
11. 發布至尚未成功的平台。
12. 更新各平台 post ID 與狀態。
13. 只有全部檔案正確寫入後才更新同步游標。
14. 提交內容與網站變更到 Git。
15. Render 依 Git 更新網站。
16. 產生簡短結果摘要。

若網站建置失敗，不推送變更，也不移動同步游標。

## 13. 最低限度品質控制

### 13.1 防止重複

- 來源層：Facebook post ID 唯一。
- 媒體層：SHA-256 checksum 唯一。
- 平台層：保存每個平台的 post ID。
- 重新執行時只處理 `pending` 或 `failed` 平台。

### 13.2 防止資料遺失

- 原始媒體保存到耐久物件儲存空間。
- 內容 JSON 納入 Git 版本管理。
- 網站發布失敗時保留上一版網站。
- 不因 Facebook 原貼文消失而自動刪除已保存內容。
- 刪除先改為封存；第一版不自動實體刪除媒體。
- 同步游標只在完整成功後更新。

### 13.3 防止明顯錯誤

- 非圖片、非影片檔案不進入媒體發布。
- 損壞、空白或超過設定上限的檔案標記 `held`。
- 不把分享他人的 Facebook 貼文當成公司原創案例。
- 物種、客戶、學校、地點不明時保持空白或採一般性描述。
- 照片內容與父親原文明顯不一致時不使用 AI 擴寫。
- YouTube 初期只建立私人影片。

### 13.4 部分失敗

範例：

- 網站成功
- Instagram 成功
- Threads 失敗
- YouTube 不適用

下一次執行只重試 Threads，不重建 Instagram 貼文，也不重複網站內容。

## 14. 安全修正方案

第一個實作階段必須完成：

1. 移除公開原始碼中的固定帳密。
2. 立即更換已公開過的管理密碼。
3. 暫停現有未授權上傳與刪除端點。
4. 管理操作全部在伺服器端驗證，不信任瀏覽器角色欄位。
5. 停止將管理員、訊息與照片主資料存放在 `localStorage`。
6. 上傳檔案同時檢查副檔名、MIME、實際內容與大小。
7. 檔名由系統產生，不使用使用者輸入路徑。
8. 平台權杖與金鑰只放 Secrets。
9. 執行紀錄不得輸出 access token、Cookie 或完整個資。
10. 聯絡表單未真正送達前，不顯示成功訊息。

第一版可先移除公開後台與上傳入口；父親已使用 Facebook Page，因此沒有必要保留不安全的網站上傳頁。

## 15. 分階段落地工作

### 階段 0：帳號與真實資料確認

工作：

- 建立 Facebook 公司粉絲專頁。
- 設定使用者完整控制、父親部分內容權限。
- 建立 Instagram 專業帳號並連接 Page。
- 建立 Threads 帳號。
- 建立 YouTube 公司頻道。
- 確認公司名稱、電話、公開地址、服務區域、營業時間、電子郵件。
- 確認哪些現有照片與人物可公開。

完成條件：

- 使用者能管理四個平台。
- 父親能用手機在 Facebook Page 發布一則測試照片。
- 所有公司基本資料有明確的「確認／不公開」結果。

### 階段 1：本機初始化與安全止血

工作：

- 將本機空 Git 儲存庫連接 `origin`。
- 抓取並追蹤遠端 `main`。
- 建立 `codex/facebook-seo-pipeline` 分支。
- 執行 `npm ci`。
- 啟動網站並記錄基準行為。
- 移除固定帳密。
- 停用未授權的上傳、刪除與管理清單 API。
- 修正假的聯絡表單成功狀態。
- 新增 `.env.example`。

完成條件：

- 本機首頁正常開啟。
- 公開程式碼不再含固定管理密碼。
- 未授權者不能上傳或刪除照片。
- 現有首頁與照片沒有因初始化遺失。

### 階段 2：內容模型與耐久媒體儲存

工作：

- 建立 `content/business.json`。
- 建立 `content/social-imports.json`。
- 建立內容 schema 驗證。
- 建立物件儲存空間與最小權限金鑰。
- 實作媒體下載、checksum、上傳及轉檔。
- 實作手動素材匣匯入。
- 實作防重與安全重跑測試。

完成條件：

- 同一素材匯入兩次只產生一筆內容。
- 中途失敗不會留下已發布但沒有媒體的紀錄。
- 重新部署 Render 後媒體仍可開啟。
- 手動匯入不需要直接編輯程式碼。

### 階段 3：網站內容中心與 SEO

工作：

- 將首頁相簿改為由內容資料產生。
- 建立 `/updates/` 列表頁。
- 建立每筆內容的靜態頁。
- 建立 sitemap、robots、canonical、Open Graph。
- 加入經確認的 Organization／LocalBusiness 資料。
- 加入 Article、ImageObject、VideoObject、BreadcrumbList。
- 加入正確圖片尺寸、壓縮、alt 與可見說明。
- 補上服務頁或可索引的服務區段。

完成條件：

- 新內容有獨立網址。
- 關閉 JavaScript 仍能讀到文章核心文字。
- sitemap 包含更新頁。
- 結構化資料通過對應驗證工具的重大錯誤檢查。
- 未確認的公司資訊不出現在結構化資料。

### 階段 4：Facebook Page 同步

工作：

- 建立 Meta Developer App。
- 取得所需 Page 權限與 access token。
- 實作分頁讀取與同步游標。
- 排除分享貼文、留言與不含媒體內容。
- 實作來源貼文 ID 防重。
- 將素材保存到物件儲存空間並建立網站內容。

完成條件：

- 測試貼文可以匯入網站。
- 第二次執行不重複。
- 舊貼文不會因游標錯誤大量重送。
- token 失效時只報錯，不破壞網站現有內容。

### 階段 5：Instagram 與 Threads 發布

工作：

- 實作 Instagram 單圖、輪播與影片發布器。
- 實作 Threads 文字加代表媒體發布器。
- 產生平台別文字。
- 保存平台 post ID 與永久連結。
- 實作單平台重試。

完成條件：

- 同一內容可在 Instagram 與 Threads 各發布一次。
- 任一平台失敗不影響網站與另一平台。
- 重跑不會重複貼文。
- 平台文案不含未證實物種、客戶或地點。

### 階段 6：YouTube 私人上傳

工作：

- 建立 Google Cloud OAuth 專案。
- 取得 `youtube.upload` 權限。
- 實作可續傳影片上傳。
- 設定私人狀態、標題、說明與網站連結。
- 儲存 video ID 並查詢處理狀態。
- 規劃日後 API 專案稽核，但不作為第一版完成前提。

完成條件：

- 有影片的內容可上傳成私人影片。
- 純照片內容正確標記 `skipped`。
- 上傳中斷可重試且不產生多份影片。
- 未經使用者確認不自動公開。

### 階段 7：每週自動排程與交付

工作：

- 建立 GitHub Actions 排程。
- 加入同一時間只允許一個同步工作的 concurrency 設定。
- 加入手動重跑入口。
- 加入失敗平台安全重試。
- 產生簡短週報。
- 確認 Git 推送後 Render 正常更新。

完成條件：

- 每週排程能自行執行。
- 無新內容時不產生空提交。
- 有新內容時只發布一次。
- 失敗時前一版網站保持可用。
- 使用者可從一次摘要看懂新增、略過與失敗項目。

## 16. 測試清單

### 16.1 初始化

- 空本機儲存庫可安全接上遠端 `main`。
- 不覆蓋非專案檔案。
- 依賴可用 lockfile 重現安裝。

### 16.2 防重

- 同一 Facebook post ID 執行兩次。
- 相同媒體換檔名再次匯入。
- Instagram 成功後重跑整個內容。
- 執行中斷後重新開始。

### 16.3 資料遺失

- 媒體上傳完成、JSON 寫入前模擬失敗。
- JSON 完成、網站建置前模擬失敗。
- 平台發布部分成功後模擬失敗。
- Render 重新部署後驗證舊媒體。

### 16.4 明顯錯誤

- 非媒體附件。
- 損壞圖片。
- 不支援影片格式。
- 空白貼文文字。
- 不明蝴蝶種類。
- 分享他人貼文。
- AI 回傳空值或格式錯誤。

### 16.5 網站與 SEO

- 首頁、更新列表及內容頁回傳成功。
- 所有內部連結存在。
- sitemap URL 可開啟。
- canonical 指向正式網址。
- JSON-LD 可解析。
- 圖片均有合理 alt；裝飾圖可使用空 alt。
- 手機寬度內容不溢出。

### 16.6 平台發布

- Facebook 來源不重發 Facebook。
- Instagram 單圖與多圖。
- Threads 圖片與網站連結。
- YouTube 影片私人上傳。
- 個別平台 token 失效。
- 個別平台服務暫時失敗後重試。

## 17. 每週操作方式

### 父親

1. 打開 Facebook。
2. 切換到佳旺景觀園藝粉絲專頁。
3. 選照片或影片。
4. 輸入簡單說明。
5. 發布。

### 使用者

平常不需要操作。每週只查看摘要：

```text
本週找到 3 則新貼文
網站：3 成功
Instagram：3 成功
Threads：2 成功、1 失敗待重試
YouTube：1 個私人影片、2 個無影片略過
```

需要處理時只有：

- 修正錯誤公司資訊。
- 確認 YouTube 私人影片並設為公開。
- 更新失效的授權。
- 對 `held` 內容補充正確說明或選擇略過。

## 18. 不納入第一版

- 付費廣告投放。
- 自動回覆留言或私訊。
- 自動辨識並公開蝴蝶物種。
- 多層審批流程。
- 內容績效 KPI 儀表板。
- 商業級 CRM。
- 自動刪除跨平台內容。
- 自動把照片製成 YouTube 影片。
- 大型 CMS 或微服務重寫。
- 對父親個人 Facebook 帳號進行登入模擬抓取。

## 19. 正式啟用順序

平台不可一次全部打開。啟用順序固定為：

1. 本機與網站安全修正。
2. 手動匯入與網站更新頁。
3. Facebook Page 讀取。
4. Instagram。
5. Threads。
6. YouTube 私人上傳。
7. 每週自動排程。

每一階段只需完成本文件列出的完成條件，不增加額外 gate。

## 20. 最終完成定義

只有同時符合下列條件，才可宣稱第一版完成：

1. 本機與遠端 Git 正常連接，網站可重現啟動。
2. 公開原始碼不含固定帳密或平台密鑰。
3. 新媒體不依賴 Render 暫時性檔案系統。
4. 父親只操作 Facebook Page 即可提供新素材。
5. 同一素材重跑不會重複建立網站內容或社群貼文。
6. 網站、Instagram、Threads 能各自保存成功的發布 ID。
7. 有影片時可建立 YouTube 私人影片；純照片會正確略過。
8. 部分平台失敗時不影響其他成功平台，且能安全重試。
9. 每篇網站更新都有獨立網址、基本 SEO 與準確來源。
10. 排程失敗時不覆蓋上一版網站、不移動成功游標。
11. 使用者能從簡短摘要判斷是否需要處理。
12. 文件中所有尚待確認的公司事實均已確認或明確不公開。

## 21. 實作前需要使用者提供的資料

開始階段 0 與階段 1 時再逐項取得，不需要現在一次準備完：

- 公司正式登記名稱。
- 可公開的電話。
- 可公開地址或僅服務區域。
- 實際營業時間。
- 公司電子郵件。
- 預計使用的正式網域。
- Facebook Page 建立結果。
- Instagram、Threads、YouTube 帳號建立結果。
- 是否同意使用 Cloudflare R2，或指定其他耐久媒體儲存空間。
- AI 服務是否啟用；若不啟用，系統使用確定性文字模板。

## 22. 參考官方文件

- Facebook Page 建立：<https://www.facebook.com/help/104002523024878>
- Facebook Page 存取權：<https://www.facebook.com/help/289207354498410>
- Facebook Page 排程：<https://www.facebook.com/help/389849807718635>
- Instagram 專業帳號 API：<https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api>
- Threads API：<https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api>
- YouTube 影片上傳 API：<https://developers.google.com/youtube/v3/docs/videos/insert>
- GitHub Actions 排程：<https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>
- Render 持久化磁碟：<https://render.com/docs/disks>
- Google LocalBusiness 結構化資料：<https://developers.google.com/search/docs/appearance/structured-data/local-business>
- Google 結構化資料一般規範：<https://developers.google.com/search/docs/appearance/structured-data/sd-policies>
