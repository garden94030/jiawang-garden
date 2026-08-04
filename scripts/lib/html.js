'use strict';

const DEFAULT_SITE_URL = 'https://jiawang-garden.onrender.com';
const SITE_NAME = '佳旺景觀園藝';
const ORGANIZATION_NAME = '佳旺景觀園藝工程行';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonLd(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function normalizeSiteUrl(value = DEFAULT_SITE_URL) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_SITE_URL;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function safeWebUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function publicUrl(value, siteUrl) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const candidate = value.trim();
  const absolute = safeWebUrl(candidate);
  if (absolute) return absolute;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  try {
    return new URL(candidate, `${normalizeSiteUrl(siteUrl)}/`).toString();
  } catch {
    return null;
  }
}

function safeSlug(value) {
  const result = String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return result || null;
}

function validDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function displayDate(value) {
  const normalized = validDate(value);
  if (!normalized) return null;
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(normalized));
}

function firstText(...values) {
  return values.find(value => typeof value === 'string' && value.trim() !== '')?.trim() || null;
}

function normalizeMedia(media, title, siteUrl) {
  if (!Array.isArray(media)) return [];
  return media.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const rawType = firstText(item.type, item.media_type, item.kind)?.toLowerCase();
    const type = rawType?.startsWith('video') ? 'video' : rawType?.startsWith('image') || rawType === 'photo' ? 'image' : null;
    if (!type) return [];
    const url = publicUrl(firstText(item.storage_url, item.public_url, item.url, item.path, item.source_url), siteUrl);
    if (!url) return [];
    const width = Number.isInteger(item.width) && item.width > 0 ? item.width : null;
    const height = Number.isInteger(item.height) && item.height > 0 ? item.height : null;
    const alt = firstText(item.alt, item.caption, item.description) || `${title}${type === 'image' ? '照片' : '影片'}`;
    return [{
      id: safeSlug(firstText(item.id, `media-${index + 1}`)) || `media-${index + 1}`,
      type,
      url,
      alt,
      caption: firstText(item.caption, item.alt, item.description) || alt,
      width,
      height,
      thumbnailUrl: publicUrl(firstText(item.thumbnail_url, item.thumbnailUrl, item.poster), siteUrl),
      duration: firstText(item.duration),
      uploadDate: validDate(firstText(item.upload_date, item.uploadDate))
    }];
  });
}

function normalizeUpdate(raw, siteUrl = DEFAULT_SITE_URL) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const content = raw.content && typeof raw.content === 'object' ? raw.content : raw;
  const source = raw.source && typeof raw.source === 'object' ? raw.source : {};
  const originalText = firstText(source.original_text, raw.original_text);
  const fallbackTitle = originalText ? originalText.replace(/\s+/g, ' ').slice(0, 42) : '佳旺景觀園藝更新';
  const title = firstText(content.title, raw.title, fallbackTitle);
  const slug = safeSlug(firstText(content.slug, raw.slug, raw.id));
  if (!slug) return null;

  const websiteStatus = raw.publishing?.website?.status;
  const overallStatus = firstText(raw.status, content.status);
  const importStatus = firstText(raw.import?.status);
  const excluded = ['archived', 'draft', 'held', 'skipped'].includes(String(overallStatus || '').toLowerCase())
    || ['draft', 'held', 'skipped'].includes(String(importStatus || '').toLowerCase())
    || ['held', 'skipped'].includes(String(websiteStatus || '').toLowerCase());
  if (excluded || raw.archived_at) return null;

  const summary = firstText(content.summary, raw.summary, content.description, originalText, title);
  const body = firstText(content.body, content.text, raw.body, originalText, summary);
  const publishedAt = validDate(firstText(source.published_at, raw.published_at, raw.created_at, content.event_date));
  const updatedAt = validDate(firstText(raw.updated_at, raw.created_at, source.published_at)) || publishedAt;
  const media = normalizeMedia(raw.media || content.media, title, siteUrl);

  return {
    id: firstText(raw.id, slug),
    slug,
    title,
    summary,
    body,
    category: firstText(content.category, raw.category),
    species: firstText(content.species, raw.species),
    location: firstText(content.location, raw.location),
    eventDate: validDate(firstText(content.event_date, raw.event_date)),
    publishedAt,
    updatedAt,
    sourcePlatform: firstText(source.platform),
    sourceUrl: safeWebUrl(firstText(source.permalink, raw.source_url)),
    media
  };
}

function paragraphs(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => `<p>${escapeHtml(item).replaceAll('\n', '<br>')}</p>`)
    .join('\n');
}

function renderMedia(update) {
  if (update.media.length === 0) return '';
  return `<section class="media-gallery" aria-label="內容媒體">
${update.media.map(media => {
    const size = `${media.width ? ` width="${media.width}"` : ''}${media.height ? ` height="${media.height}"` : ''}`;
    if (media.type === 'image') {
      return `  <figure><img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt)}" loading="lazy" decoding="async"${size}><figcaption>${escapeHtml(media.caption)}</figcaption></figure>`;
    }
    return `  <figure><video src="${escapeHtml(media.url)}"${media.thumbnailUrl ? ` poster="${escapeHtml(media.thumbnailUrl)}"` : ''} controls preload="metadata"${size}>您的瀏覽器不支援影片播放。</video><figcaption>${escapeHtml(media.caption)}</figcaption></figure>`;
  }).join('\n')}
</section>`;
}

function updateSchemas(update, siteUrl) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  const pageUrl = `${baseUrl}/updates/${encodeURIComponent(update.slug)}/`;
  const logoUrl = `${baseUrl}/branding/google-ads-logo-square.png`;
  const articleId = `${pageUrl}#article`;
  const graph = [{
    '@type': 'Article',
    '@id': articleId,
    mainEntityOfPage: pageUrl,
    headline: update.title,
    description: update.summary,
    ...(update.publishedAt ? { datePublished: update.publishedAt } : {}),
    ...(update.updatedAt ? { dateModified: update.updatedAt } : {}),
    author: { '@type': 'Organization', name: ORGANIZATION_NAME, url: `${baseUrl}/` },
    publisher: {
      '@type': 'Organization',
      name: ORGANIZATION_NAME,
      url: `${baseUrl}/`,
      logo: { '@type': 'ImageObject', url: logoUrl }
    }
  }];

  const images = update.media.filter(item => item.type === 'image');
  // Google 的 VideoObject 至少需要真實縮圖與上傳日期；資料不足時仍顯示影片，
  // 但不輸出可能造成重大驗證錯誤的影片結構化資料。
  const videos = update.media.filter(item => item.type === 'video' && item.thumbnailUrl && (item.uploadDate || update.publishedAt));
  if (images.length > 0) graph[0].image = images.map(item => ({ '@id': `${pageUrl}#${item.id}` }));
  if (videos.length > 0) graph[0].video = videos.map(item => ({ '@id': `${pageUrl}#${item.id}` }));

  images.forEach(item => graph.push({
    '@type': 'ImageObject',
    '@id': `${pageUrl}#${item.id}`,
    contentUrl: item.url,
    caption: item.caption,
    ...(item.width ? { width: item.width } : {}),
    ...(item.height ? { height: item.height } : {})
  }));
  videos.forEach(item => graph.push({
    '@type': 'VideoObject',
    '@id': `${pageUrl}#${item.id}`,
    name: item.alt,
    description: item.caption,
    contentUrl: item.url,
    ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
    ...(item.uploadDate || update.publishedAt ? { uploadDate: item.uploadDate || update.publishedAt } : {}),
    ...(item.duration ? { duration: item.duration } : {})
  }));

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: '最新消息', item: `${baseUrl}/updates/` },
      { '@type': 'ListItem', position: 3, name: update.title, item: pageUrl }
    ]
  });

  return { '@context': 'https://schema.org', '@graph': graph };
}

const PAGE_STYLE = `
  :root{--green:#1b4332;--leaf:#2d6a4f;--mint:#d8f3dc;--cream:#fefae0;--warm:#f4a261;--text:#34423b}
  *{box-sizing:border-box}body{margin:0;color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft JhengHei",sans-serif;line-height:1.75;background:#fff}
  a{color:var(--leaf)}.site-header{background:linear-gradient(135deg,var(--green),#40916c);color:#fff;padding:18px 20px}.site-header-inner{max-width:960px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{color:#fff;text-decoration:none;font-weight:800}.site-header nav{display:flex;gap:16px}.site-header nav a{color:#fff;text-decoration:none}
  main{max-width:960px;margin:auto;padding:44px 20px 72px}.breadcrumbs{font-size:.9rem;color:#65766c;margin-bottom:22px}.breadcrumbs a{color:#476d58}.eyebrow{color:#8b6f47;font-weight:700}.page-title{color:var(--green);font-size:clamp(2rem,6vw,3.5rem);line-height:1.2;margin:.25em 0}.lead{font-size:1.15rem;color:#52665a;max-width:760px}.meta{color:#6e7c74;font-size:.9rem}.article-body{font-size:1.05rem;margin:32px 0}.article-body p{margin:0 0 1.25em}.facts{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0}.fact{background:var(--mint);border-radius:999px;padding:6px 13px;font-size:.9rem}.media-gallery{display:grid;gap:22px;margin:36px 0}.media-gallery figure{margin:0;background:var(--cream);border-radius:18px;overflow:hidden}.media-gallery img,.media-gallery video{display:block;width:100%;height:auto;max-height:680px;object-fit:contain;background:#101a14}.media-gallery figcaption{padding:10px 14px;color:#56685d;font-size:.92rem}.source{padding:18px;border-left:4px solid var(--warm);background:#fff9ed}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:36px}.button{display:inline-block;text-decoration:none;background:var(--leaf);color:#fff;padding:10px 18px;border-radius:999px;font-weight:700}.button.secondary{background:var(--cream);color:var(--green)}
  .updates-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-top:32px}.update-card{border:1px solid #dfe9e2;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 3px 16px rgba(27,67,50,.06)}.update-card img,.update-card .placeholder{width:100%;height:180px;object-fit:cover}.update-card .placeholder{display:grid;place-items:center;background:var(--mint);font-size:3rem}.update-card-body{padding:18px}.update-card h2{font-size:1.25rem;line-height:1.4;margin:0 0 8px;color:var(--green)}.update-card p{margin:0 0 12px}.empty-state{margin-top:32px;padding:30px;background:var(--cream);border-radius:18px;text-align:center}.site-footer{background:var(--green);color:#d8f3dc;padding:28px 20px;text-align:center}
  @media(max-width:600px){.site-header-inner{align-items:flex-start;flex-direction:column}.site-header nav{font-size:.9rem}main{padding-top:32px}}
`;

function documentTemplate({ title, description, canonical, image, type = 'website', schema, body }) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="icon" type="image/png" href="/branding/google-ads-logo-square.png">
  <link rel="apple-touch-icon" href="/branding/google-ads-logo-square.png">
  <meta name="theme-color" content="#1b4332">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
${image ? `  <meta property="og:image" content="${escapeHtml(image)}">\n` : ''}  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
${schema ? `  <script type="application/ld+json">\n${jsonLd(schema)}\n  </script>\n` : ''}  <style>${PAGE_STYLE}</style>
</head>
<body>
  <header class="site-header"><div class="site-header-inner"><a class="brand" href="/">🦋 佳旺景觀園藝</a><nav aria-label="主要導覽"><a href="/">首頁</a><a href="/updates/">最新消息</a><a href="/#contact">聯絡我們</a></nav></div></header>
${body}
  <footer class="site-footer">&copy; 2026 佳旺景觀園藝 JIAWANG LANDSCAPE</footer>
</body>
</html>\n`;
}

function renderUpdatePage(update, siteUrl = DEFAULT_SITE_URL) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  const canonical = `${baseUrl}/updates/${encodeURIComponent(update.slug)}/`;
  const firstImage = update.media.find(item => item.type === 'image')?.url || update.media.find(item => item.thumbnailUrl)?.thumbnailUrl;
  const facts = [
    update.category && ['主題', update.category],
    update.eventDate && ['活動日期', displayDate(update.eventDate)],
    update.location && ['地點', update.location],
    update.species && ['蝴蝶種類', update.species]
  ].filter(Boolean);
  const sourceLabel = update.sourcePlatform ? `${update.sourcePlatform} 原始貼文` : '原始貼文';
  const body = `<main>
  <nav class="breadcrumbs" aria-label="麵包屑"><a href="/">首頁</a> ／ <a href="/updates/">最新消息</a> ／ <span aria-current="page">${escapeHtml(update.title)}</span></nav>
  <article>
    <header>
      <div class="eyebrow">最新消息</div>
      <h1 class="page-title">${escapeHtml(update.title)}</h1>
      ${update.publishedAt ? `<p class="meta"><time datetime="${escapeHtml(update.publishedAt)}">${escapeHtml(displayDate(update.publishedAt))}</time></p>` : ''}
      <p class="lead">${escapeHtml(update.summary)}</p>
      ${facts.length ? `<div class="facts">${facts.map(([label, value]) => `<span class="fact">${escapeHtml(label)}：${escapeHtml(value)}</span>`).join('')}</div>` : ''}
    </header>
    ${renderMedia(update)}
    <div class="article-body">${paragraphs(update.body)}</div>
${update.sourceUrl ? `    <p class="source">資料來源：<a href="${escapeHtml(update.sourceUrl)}" rel="noopener noreferrer">${escapeHtml(sourceLabel)}</a></p>\n` : ''}    <div class="actions"><a class="button" href="/#contact">聯絡佳旺景觀園藝</a><a class="button secondary" href="/updates/">查看所有更新</a></div>
  </article>
</main>`;
  return documentTemplate({
    title: `${update.title}｜${SITE_NAME}`,
    description: update.summary,
    canonical,
    image: firstImage,
    type: 'article',
    schema: updateSchemas(update, baseUrl),
    body
  });
}

function updateCard(update, { headingLevel = 2, relative = false } = {}) {
  const image = update.media.find(item => item.type === 'image');
  const href = `${relative ? '' : '/'}updates/${encodeURIComponent(update.slug)}/`;
  const date = displayDate(update.publishedAt || update.eventDate);
  const heading = `h${headingLevel}`;
  return `<article class="update-card">
  <a href="${href}" aria-label="閱讀：${escapeHtml(update.title)}">${image ? `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"${image.width ? ` width="${image.width}"` : ''}${image.height ? ` height="${image.height}"` : ''}>` : '<div class="placeholder" aria-hidden="true">🌿</div>'}</a>
  <div class="update-card-body">
    ${date ? `<p class="meta"><time datetime="${escapeHtml(update.publishedAt || update.eventDate)}">${escapeHtml(date)}</time></p>` : ''}
    <${heading}><a href="${href}">${escapeHtml(update.title)}</a></${heading}>
    <p>${escapeHtml(update.summary)}</p>
    <a href="${href}">閱讀完整內容 →</a>
  </div>
</article>`;
}

function renderUpdatesIndex(updates, siteUrl = DEFAULT_SITE_URL) {
  const baseUrl = normalizeSiteUrl(siteUrl);
  const canonical = `${baseUrl}/updates/`;
  const body = `<main>
  <nav class="breadcrumbs" aria-label="麵包屑"><a href="/">首頁</a> ／ <span aria-current="page">最新消息</span></nav>
  <header><div class="eyebrow">佳旺景觀園藝</div><h1 class="page-title">最新消息與更新紀錄</h1><p class="lead">園藝工程、蝴蝶生態、自然教育及活動紀錄。</p></header>
  ${updates.length ? `<section class="updates-grid" aria-label="更新列表">${updates.map(update => updateCard(update)).join('\n')}</section>` : '<div class="empty-state"><h2>更新內容準備中</h2><p>目前尚無公開更新，之後會在這裡整理園藝與蝴蝶生態紀錄。</p></div>'}
</main>`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: '最新消息', item: canonical }
    ]
  };
  return documentTemplate({
    title: `最新消息與更新紀錄｜${SITE_NAME}`,
    description: '佳旺景觀園藝的園藝工程、蝴蝶生態、自然教育及活動更新紀錄。',
    canonical,
    image: updates.flatMap(update => update.media).find(item => item.type === 'image')?.url,
    schema,
    body
  });
}

function renderHomeUpdates(updates) {
  if (updates.length === 0) {
    return '        <div class="updates-empty"><p>目前尚無公開更新，之後會在這裡整理園藝與蝴蝶生態紀錄。</p><a href="/updates/">查看更新頁</a></div>';
  }
  return `        <div class="updates-home-grid">\n${updates.slice(0, 3).map(update => updateCard(update, { headingLevel: 3 })).join('\n')}\n        </div>\n        <p class="updates-more"><a href="/updates/">查看所有更新紀錄 →</a></p>`;
}

module.exports = {
  DEFAULT_SITE_URL,
  displayDate,
  documentTemplate,
  escapeHtml,
  jsonLd,
  normalizeSiteUrl,
  normalizeUpdate,
  renderHomeUpdates,
  renderUpdatePage,
  renderUpdatesIndex,
  safeSlug,
  safeWebUrl,
  updateSchemas
};
