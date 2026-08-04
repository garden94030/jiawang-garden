#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { graphVersion, safeError } = require('./lib/publishers/base');

const REQUIRED = ['META_GRAPH_API_VERSION', 'FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'];

function facebookConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !String(env[name] || '').trim());
  const version = graphVersion(env);
  if (!version && !missing.includes('META_GRAPH_API_VERSION')) missing.push('META_GRAPH_API_VERSION');
  return {
    configured: missing.length === 0,
    missing,
    pageId: String(env.FACEBOOK_PAGE_ID || '').trim(),
    token: String(env.FACEBOOK_PAGE_ACCESS_TOKEN || '').trim(),
    version,
    maximumPages: Math.min(25, Math.max(1, Number(env.FACEBOOK_SYNC_MAX_PAGES || 5))),
  };
}

function attachmentMedia(attachments) {
  const output = [];
  for (const attachment of attachments || []) {
    const children = attachment?.subattachments?.data;
    if (Array.isArray(children) && children.length) {
      output.push(...attachmentMedia(children));
      continue;
    }
    const rawType = String(attachment?.media_type || attachment?.type || '').toLowerCase();
    const type = rawType.includes('video') ? 'video' : rawType.includes('photo') || rawType.includes('image') ? 'image' : null;
    const sourceUrl = attachment?.media?.source || attachment?.media?.image?.src || attachment?.url;
    if (type && sourceUrl) output.push({ type, source_url: sourceUrl });
  }
  return output;
}

function normalizeFacebookPost(post, pageId) {
  if (!post || typeof post !== 'object') return null;
  if (!String(post.id || '').startsWith(`${pageId}_`)) return null;
  if (post.is_published === false || post.status_type === 'shared_story') return null;
  const media = attachmentMedia(post?.attachments?.data);
  if (!media.length) return null;
  return {
    source: {
      platform: 'facebook',
      post_id: String(post.id),
      permalink: post.permalink_url || null,
      published_at: post.created_time || null,
      original_text: String(post.message || '').trim(),
      is_own_post: true,
      status_type: post.status_type || null,
    },
    media,
  };
}

async function fetchFacebookPosts(options = {}) {
  const config = options.config || facebookConfig(options.env);
  if (!config.configured) return { status: 'not_configured', posts: [], missing: config.missing };
  if (options.dryRun !== false || options.allowLive !== true) return { status: 'dry_run', posts: [] };

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const fields = 'id,message,created_time,permalink_url,is_published,status_type,attachments{media_type,type,url,media,subattachments{media_type,type,url,media}}';
  let next = `https://graph.facebook.com/${config.version}/${encodeURIComponent(config.pageId)}/posts?fields=${encodeURIComponent(fields)}&limit=25`;
  const posts = [];
  for (let page = 0; next && page < config.maximumPages; page += 1) {
    const response = await fetchImpl(next, {
      headers: { authorization: `Bearer ${config.token}` },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) throw new Error(`facebook_sync_failed: ${body?.error?.message || response.status}`);
    posts.push(...(Array.isArray(body?.data) ? body.data : []));
    next = typeof body?.paging?.next === 'string' ? body.paging.next : null;
  }
  return { status: 'ok', posts };
}

function importedPostIds(rootDir) {
  const directory = path.join(rootDir, 'content', 'updates');
  const ids = new Set();
  if (!fs.existsSync(directory)) return ids;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const value = JSON.parse(fs.readFileSync(path.join(directory, entry.name), 'utf8'));
      if (value?.source?.platform === 'facebook' && value?.source?.post_id) ids.add(String(value.source.post_id));
    } catch {
      // Invalid content is left to the build/validation step; sync must not overwrite it.
    }
  }
  return ids;
}

async function syncFacebook(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const config = facebookConfig(options.env || process.env);
  if (!config.configured) {
    return { status: 'not_configured', found: 0, imported: 0, skipped: 0, missing: config.missing };
  }
  if (options.dryRun !== false || options.allowLive !== true) {
    return { status: 'dry_run', found: 0, imported: 0, skipped: 0 };
  }

  const fetched = await fetchFacebookPosts({ ...options, config, dryRun: false, allowLive: true });
  const known = importedPostIds(rootDir);
  const normalized = fetched.posts
    .map((post) => normalizeFacebookPost(post, config.pageId))
    .filter(Boolean);
  const fresh = normalized.filter((record) => !known.has(record.source.post_id));
  const results = [];
  for (const record of fresh) {
    if (typeof options.importPost !== 'function') {
      results.push({ post_id: record.source.post_id, status: 'held', reason: 'durable_media_import_not_configured' });
      continue;
    }
    results.push(await options.importPost(record));
  }
  return {
    status: 'ok',
    found: normalized.length,
    imported: results.filter((result) => result?.status === 'imported').length,
    skipped: normalized.length - fresh.length,
    held: results.filter((result) => result?.status === 'held').length,
    results,
  };
}

function parseArgs(argv, env = process.env) {
  const options = { dryRun: true };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--live') options.dryRun = false;
    else if (value === '--dry-run') options.dryRun = true;
    else if (value === '--root' && argv[index + 1]) options.rootDir = path.resolve(argv[++index]);
    else throw new Error(`不支援的參數：${value}`);
  }
  options.allowLive = options.dryRun === false && env.SOCIAL_PUBLISH_LIVE === 'true';
  if (!options.allowLive) options.dryRun = true;
  return options;
}

if (require.main === module) {
  syncFacebook(parseArgs(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`Facebook 同步失敗：${safeError(error)}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  attachmentMedia,
  facebookConfig,
  fetchFacebookPosts,
  importedPostIds,
  normalizeFacebookPost,
  parseArgs,
  syncFacebook,
};
