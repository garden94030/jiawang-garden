'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_SITE_URL, normalizeSiteUrl, normalizeUpdate } = require('./lib/html');

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function isoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function generateSitemapXml(updates, siteUrl = DEFAULT_SITE_URL) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  const urls = [
    { loc: `${baseUrl}/` },
    { loc: `${baseUrl}/updates/` },
    ...updates.map(update => ({
      loc: `${baseUrl}/updates/${encodeURIComponent(update.slug)}/`,
      lastmod: isoDate(update.updatedAt || update.publishedAt)
    }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(item => `  <url>\n    <loc>${xmlEscape(item.loc)}</loc>${item.lastmod ? `\n    <lastmod>${item.lastmod}</lastmod>` : ''}\n  </url>`).join('\n')}
</urlset>
`;
}

function readUpdates(rootDir, siteUrl) {
  const contentDir = path.join(rootDir, 'content', 'updates');
  if (!fs.existsSync(contentDir)) return [];
  return fs.readdirSync(contentDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const filePath = path.join(contentDir, entry.name);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const update = normalizeUpdate(raw, siteUrl);
      return update ? [update] : [];
    })
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

function writeAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function generateSitemap({ rootDir = path.resolve(__dirname, '..'), siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL, updates } = {}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const selectedUpdates = updates || readUpdates(rootDir, normalizedSiteUrl);
  const xml = generateSitemapXml(selectedUpdates, normalizedSiteUrl);
  writeAtomic(path.join(rootDir, 'sitemap.xml'), xml);
  return { count: selectedUpdates.length, siteUrl: normalizedSiteUrl, xml };
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
    const result = generateSitemap(readCliArguments(process.argv.slice(2)));
    process.stdout.write(`sitemap.xml 已產生，共 ${result.count} 篇更新。\n`);
  } catch (error) {
    process.stderr.write(`無法產生 sitemap：${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { generateSitemap, generateSitemapXml, readUpdates, xmlEscape };
