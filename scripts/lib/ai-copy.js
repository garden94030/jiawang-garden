'use strict';

const { sourcePlatform } = require('./content-policy');

const CATEGORY_LABELS = Object.freeze({
  'butterfly-ecology': '蝴蝶生態',
  'butterfly-garden': '蝴蝶園藝',
  landscaping: '景觀園藝',
  'garden-project': '園藝工程',
  'school-education': '校園生態教學',
  'outdoor-guide': '戶外導覽',
  planting: '植栽與棲地',
});

function cleanText(value) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, maximum) {
  const text = cleanText(value);
  if (text.length <= maximum) return text;
  return `${text.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

function originalText(record) {
  return cleanText(record?.source?.original_text || record?.content?.summary || '');
}

function fallbackTitle(record) {
  const explicit = cleanText(record?.content?.title);
  if (explicit) return truncate(explicit, 70);

  const original = originalText(record);
  if (original) {
    const firstLine = original.split(/[。！？!?\n]/, 1)[0];
    if (firstLine) return truncate(firstLine, 40);
  }

  const category = cleanText(record?.content?.category);
  return CATEGORY_LABELS[category] || '佳旺景觀園藝工作紀錄';
}

function fallbackSummary(record) {
  const explicit = cleanText(record?.content?.summary);
  if (explicit) return truncate(explicit, 180);
  const original = originalText(record);
  if (original) return truncate(original, 180);
  return '佳旺景觀園藝的照片或影片工作紀錄。';
}

function canonicalUrl(record, siteUrl) {
  const existing = cleanText(record?.publishing?.website?.url);
  if (/^https:\/\//i.test(existing)) return existing;
  const base = cleanText(siteUrl).replace(/\/$/, '');
  if (!base || !existing) return '';
  return `${base}/${existing.replace(/^\//, '')}`;
}

function hashtags(record) {
  const category = cleanText(record?.content?.category);
  const tags = ['#佳旺景觀園藝'];
  if (CATEGORY_LABELS[category]) tags.push(`#${CATEGORY_LABELS[category].replace(/\s/g, '')}`);
  return tags.join(' ');
}

function buildFallbackCopy(record, options = {}) {
  const title = fallbackTitle(record);
  const summary = fallbackSummary(record);
  const url = canonicalUrl(record, options.siteUrl || process.env.SITE_URL || '');
  const tags = hashtags(record);
  const linkSuffix = url ? `\n\n完整紀錄：${url}` : '';

  return {
    title,
    summary,
    alt: '佳旺景觀園藝公開工作紀錄',
    facebook: truncate(`${summary}\n\n${tags}${linkSuffix}`, 1800),
    instagram: truncate(`${summary}\n\n${tags}`, 1800),
    threads: truncate(`${summary}${linkSuffix}`, 450),
    youtube: {
      title: truncate(title, 95),
      description: truncate(`${summary}${linkSuffix}`, 4500),
    },
    metadata: {
      generator: 'deterministic-fallback',
      source_platform: sourcePlatform(record) || null,
      model: null,
    },
  };
}

async function createCopy(record, options = {}) {
  const fallback = buildFallbackCopy(record, options);
  if (options.enabled !== true || typeof options.generate !== 'function') return fallback;

  try {
    const generated = await options.generate({
      original_text: originalText(record),
      confirmed_title: cleanText(record?.content?.title),
      confirmed_summary: cleanText(record?.content?.summary),
      category: cleanText(record?.content?.category),
      restrictions: [
        '不得新增原始資料沒有的物種、人物、學校、客戶、地點、日期、規模、價格、證照或評價',
        '不確定時保留一般描述',
        '使用繁體中文',
      ],
    });

    if (!generated || typeof generated !== 'object') return fallback;
    return {
      ...fallback,
      title: cleanText(generated.title) || fallback.title,
      summary: cleanText(generated.summary) || fallback.summary,
      metadata: {
        generator: 'configured-ai',
        source_platform: sourcePlatform(record) || null,
        model: cleanText(options.model) || null,
      },
    };
  } catch {
    return fallback;
  }
}

module.exports = {
  buildFallbackCopy,
  canonicalUrl,
  cleanText,
  createCopy,
  fallbackSummary,
  fallbackTitle,
  truncate,
};
