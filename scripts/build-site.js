'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_SITE_URL,
  normalizeSiteUrl,
  normalizeUpdate,
  renderHomeUpdates,
  renderUpdatePage,
  renderUpdatesIndex
} = require('./lib/html');
const { generateSitemap } = require('./generate-sitemap');

const HOME_LIST_START = '<!-- UPDATES_LIST_START -->';
const HOME_LIST_END = '<!-- UPDATES_LIST_END -->';

function writeAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function replaceGeneratedUpdates(rootDir, generatedPages, updatesIndex) {
  const target = path.join(rootDir, 'updates');
  const staging = fs.mkdtempSync(path.join(rootDir, '.updates-build-'));
  const backup = path.join(rootDir, `.updates-backup-${process.pid}-${Date.now()}`);
  let movedCurrent = false;
  try {
    for (const page of generatedPages) {
      const relative = path.relative(target, page.filePath);
      writeAtomic(path.join(staging, relative), page.html);
    }
    writeAtomic(path.join(staging, 'index.html'), updatesIndex);
    if (fs.existsSync(target)) {
      fs.renameSync(target, backup);
      movedCurrent = true;
    }
    fs.renameSync(staging, target);
    if (movedCurrent) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(target) && movedCurrent && fs.existsSync(backup)) {
      try { fs.renameSync(backup, target); } catch {}
    }
    try { fs.rmSync(staging, { recursive: true, force: true }); } catch {}
    throw error;
  }
}

function rawIsExcluded(raw) {
  const content = raw?.content && typeof raw.content === 'object' ? raw.content : {};
  const status = String(raw?.status || content.status || '').toLowerCase();
  const importStatus = String(raw?.import?.status || '').toLowerCase();
  const websiteStatus = String(raw?.publishing?.website?.status || '').toLowerCase();
  return Boolean(raw?.archived_at)
    || ['archived', 'draft', 'held', 'skipped'].includes(status)
    || ['draft', 'held', 'skipped'].includes(importStatus)
    || ['held', 'skipped'].includes(websiteStatus);
}

function loadUpdates(rootDir, siteUrl) {
  const contentDir = path.join(rootDir, 'content', 'updates');
  if (!fs.existsSync(contentDir)) return [];
  const entries = fs.readdirSync(contentDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const updates = [];
  const usedSlugs = new Map();
  for (const entry of entries) {
    const filePath = path.join(contentDir, entry.name);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`${path.relative(rootDir, filePath)} 不是有效 JSON：${error.message}`);
    }
    const update = normalizeUpdate(raw, siteUrl);
    if (!update) {
      if (rawIsExcluded(raw)) continue;
      throw new Error(`${path.relative(rootDir, filePath)} 缺少可用的 id 或 slug`);
    }
    if (usedSlugs.has(update.slug)) {
      throw new Error(`重複的更新 slug「${update.slug}」：${usedSlugs.get(update.slug)} 與 ${entry.name}`);
    }
    usedSlugs.set(update.slug, entry.name);
    updates.push(update);
  }
  return updates.sort((a, b) => {
    const dateOrder = String(b.publishedAt || b.eventDate || '').localeCompare(String(a.publishedAt || a.eventDate || ''));
    return dateOrder || a.slug.localeCompare(b.slug);
  });
}

function updateHomepage(homeHtml, updates) {
  const startIndex = homeHtml.indexOf(HOME_LIST_START);
  const endIndex = homeHtml.indexOf(HOME_LIST_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('index.html 缺少最新消息靜態列表標記');
  }
  const before = homeHtml.slice(0, startIndex + HOME_LIST_START.length);
  const after = homeHtml.slice(endIndex);
  return `${before}\n${renderHomeUpdates(updates)}\n        ${after}`;
}

function buildRobots(siteUrl) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  return `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
}

function buildSite({ rootDir = path.resolve(__dirname, '..'), siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL } = {}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const homePath = path.join(rootDir, 'index.html');
  if (!fs.existsSync(homePath)) throw new Error('找不到 index.html');

  const updates = loadUpdates(rootDir, normalizedSiteUrl);
  const homeHtml = updateHomepage(fs.readFileSync(homePath, 'utf8'), updates);
  const generatedPages = updates.map(update => ({
    filePath: path.join(rootDir, 'updates', update.slug, 'index.html'),
    html: renderUpdatePage(update, normalizedSiteUrl)
  }));
  const updatesIndex = renderUpdatesIndex(updates, normalizedSiteUrl);

  // 所有資料完成讀取、正規化及 HTML 產生後才開始覆寫正式檔案。
  replaceGeneratedUpdates(rootDir, generatedPages, updatesIndex);
  writeAtomic(homePath, homeHtml);
  writeAtomic(path.join(rootDir, 'robots.txt'), buildRobots(normalizedSiteUrl));
  generateSitemap({ rootDir, siteUrl: normalizedSiteUrl, updates });

  return {
    count: updates.length,
    pages: generatedPages.map(page => path.relative(rootDir, page.filePath)),
    siteUrl: normalizedSiteUrl
  };
}

function readCliArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root' && argv[index + 1]) options.rootDir = path.resolve(argv[++index]);
    else if (argv[index] === '--site-url' && argv[index + 1]) options.siteUrl = argv[++index];
  }
  return options;
}

if (require.main === module) {
  try {
    const result = buildSite(readCliArguments(process.argv.slice(2)));
    process.stdout.write(`網站內容已產生，共 ${result.count} 篇更新。\n`);
  } catch (error) {
    process.stderr.write(`網站內容建置失敗：${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  HOME_LIST_END,
  HOME_LIST_START,
  buildRobots,
  buildSite,
  loadUpdates,
  replaceGeneratedUpdates,
  updateHomepage
};
