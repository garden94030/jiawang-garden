# 外部帳號申請清單

更新日期：2026-08-04

不需把任何密碼傳給 Codex。需要登入、兩步驟驗證或同意平台條款時，由帳號持有人親自操作；完成後只把必要 token 放進 GitHub Secrets。

## 第一批：網站聯絡與 Facebook 來源

1. 確認可以登入 `gardenjiawang@gmail.com`，並開啟 Google 帳號兩步驟驗證。
2. 使用你自己的 Facebook 帳號建立「佳旺景觀園藝」Page：<https://www.facebook.com/pages/create>
3. 你保留 Page 完整控制權，父親只取得日常發照片所需的 Page access：<https://www.facebook.com/help/187316341316631>
4. 建立 Meta Developer App，取得公司 Page 的 Page ID 與官方 API token。不可提供個人 Facebook 密碼或瀏覽器 Cookie。

Facebook Page 建立流程本身不要求付款；廣告及貼文加強推廣是另外選購。

## 第二批：耐久照片與影片儲存

1. 建立 Cloudflare 帳號。
2. 在 Cloudflare Dashboard 開啟 R2 subscription 並建立 Standard bucket：<https://developers.cloudflare.com/r2/get-started/>
3. 建立只允許該 bucket 的 S3 API token，準備 endpoint、bucket、access key、secret key 與公開唯讀媒體網址。

Cloudflare 官方目前列出的 R2 Standard free tier 為每月 10 GB-month、100 萬次 Class A、1,000 萬次 Class B，對外傳輸免費；超過額度才依用量計費：<https://developers.cloudflare.com/r2/pricing/>

## 第三批：Instagram 與 Threads

1. 建立或確認公司 Instagram 帳號，切換為專業帳號。
2. 把 Instagram 專業帳號連結至公司的 Facebook Page；需要對該 Page 有 Facebook access：<https://www.facebook.com/help/570895513091465>
3. 建立公司 Threads 帳號，完成 Meta App 對 Instagram／Threads 發布功能所需的授權。
4. 取得 Instagram account ID／token 與 Threads user ID／token，僅保存於 GitHub Secrets。

## 第四批：YouTube

1. 使用公司 Google 帳號建立 YouTube 頻道。
2. 在 Google Cloud Console 建立專案、啟用 YouTube Data API v3，建立 OAuth 2.0 client。
3. 只授權上傳所需 scope，取得 client ID、client secret 與 refresh token。官方上傳流程需要 OAuth 2.0：<https://developers.google.com/youtube/v3/guides/uploading_a_video>
4. 本專案首次自動上傳一律設定為 `private`，確認標題、說明與影片後再由你手動公開。

## 第五批：Google 搜尋收錄

1. 開啟 Google Search Console：<https://search.google.com/search-console>
2. 新增 `https://jiawang-garden.onrender.com/` URL-prefix property 並完成所有權驗證。
3. 在 Sitemaps 報告提交 `https://jiawang-garden.onrender.com/sitemap.xml`。提交 sitemap 需要 property owner 權限：<https://support.google.com/webmasters/answer/7451001>

## 完成帳號後由程式端處理

- 把 `.env.example` 所列平台值加入 GitHub Actions Secrets／Variables。
- 保持 `SOCIAL_PUBLISH_LIVE=false` 完成 dry-run。
- 先測 Facebook 讀取與 R2 保存，再逐一測 IG、Threads、YouTube。
- 每個平台取得真實遠端 ID 並確認無重送後，最後才把 `SOCIAL_PUBLISH_LIVE` 改為 `true`。
