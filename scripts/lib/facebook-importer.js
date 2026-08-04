'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const {
  acquireManifestLock,
  appendImport,
  atomicWriteJson,
  checkDuplicate,
  readManifest,
  validateContentRecord,
} = require('./manifest');
const { DEFAULT_MAX_BYTES, inspectMedia } = require('./media');
const {
  createObjectStorageClient,
  objectStorageConfig,
  uploadMediaObject,
} = require('./object-storage');
const { safeError } = require('./publishers/base');

function isAllowedFacebookMediaUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (
      host === 'facebook.com'
      || host.endsWith('.facebook.com')
      || host === 'fbcdn.net'
      || host.endsWith('.fbcdn.net')
      || host === 'fbsbx.com'
      || host.endsWith('.fbsbx.com')
    );
  } catch {
    return false;
  }
}

async function downloadMedia(sourceUrl, targetPath, options = {}) {
  if (!isAllowedFacebookMediaUrl(sourceUrl)) throw new Error('facebook_media_url_not_allowed');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maximumBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const response = await fetchImpl(sourceUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`facebook_media_download_failed: ${response.status}`);
  if (response.url && !isAllowedFacebookMediaUrl(response.url)) {
    throw new Error('facebook_media_redirect_not_allowed');
  }
  const declaredLength = Number(response.headers?.get?.('content-length') || 0);
  if (declaredLength > maximumBytes) throw new Error('facebook_media_too_large');

  let seen = 0;
  const guard = new Transform({
    transform(chunk, encoding, callback) {
      seen += chunk.length;
      if (seen > maximumBytes) return callback(new Error('facebook_media_too_large'));
      return callback(null, chunk);
    },
  });
  const source = response.body && typeof response.body.getReader === 'function'
    ? Readable.fromWeb(response.body)
    : Readable.from(Buffer.from(await response.arrayBuffer()));
  try {
    await pipeline(source, guard, fs.createWriteStream(targetPath, { flags: 'wx', mode: 0o600 }));
  } catch (error) {
    try { fs.unlinkSync(targetPath); } catch {}
    throw error;
  }
  return targetPath;
}

function recordIdentity(postId) {
  const digest = crypto.createHash('sha256').update(`facebook:${postId}`).digest('hex').slice(0, 16);
  return { id: `jw-facebook-${digest}`, slug: `facebook-${digest}` };
}

function facebookTitle(record) {
  const firstLine = String(record?.source?.original_text || '').split(/\r?\n/).map(line => line.trim()).find(Boolean);
  if (firstLine) return firstLine.slice(0, 80);
  const date = String(record?.source?.published_at || '').slice(0, 10);
  return date ? `${date} 佳旺景觀園藝紀錄` : '佳旺景觀園藝 Facebook 紀錄';
}

function buildFacebookRecord(record, storedMedia, now = new Date()) {
  const postId = String(record.source.post_id);
  const identity = recordIdentity(postId);
  const timestamp = now.toISOString();
  const originalText = String(record.source.original_text || '').trim();
  return {
    schema_version: 1,
    id: identity.id,
    source: {
      platform: 'facebook',
      item_id: postId,
      source_id: `facebook:${postId}`,
      post_id: postId,
      permalink: record.source.permalink || null,
      published_at: record.source.published_at || null,
      original_text: originalText,
      is_own_post: true,
      status_type: record.source.status_type || null,
    },
    content: {
      title: facebookTitle(record),
      summary: originalText || '佳旺景觀園藝的園藝與蝴蝶生態紀錄。',
      category: 'garden',
      species: null,
      location: null,
      event_date: String(record.source.published_at || '').slice(0, 10) || null,
      slug: identity.slug,
    },
    media: storedMedia.map((item, index) => ({
      id: `media-${String(index + 1).padStart(2, '0')}`,
      type: item.inspection.type,
      storage_path: item.storage.key,
      storage_url: item.storage.url,
      sha256: item.inspection.sha256,
      mime_type: item.inspection.mime_type,
      size_bytes: item.inspection.size_bytes,
      alt: item.inspection.type === 'image' ? '佳旺景觀園藝 Facebook 現場照片' : '佳旺景觀園藝 Facebook 現場影片',
      width: null,
      height: null,
    })),
    publishing: {
      website: { status: 'pending', url: null },
      facebook: { status: 'source', post_id: postId, url: record.source.permalink || null },
      instagram: { status: 'pending', post_id: null },
      threads: { status: 'pending', post_id: null },
      youtube: storedMedia.some(item => item.inspection.type === 'video')
        ? { status: 'pending', post_id: null }
        : { status: 'skipped', post_id: null, reason: 'no_video' },
    },
    import: { status: 'published', imported_at: timestamp, dry_run: false },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function createFacebookImporter(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..', '..');
  const contentDirectory = path.join(rootDir, 'content');
  const manifestPath = path.join(contentDirectory, 'social-imports.json');
  const updatesDirectory = path.join(contentDirectory, 'updates');
  const storageConfig = options.storageConfig || objectStorageConfig(options.env || process.env);
  const client = storageConfig.configured
    ? (options.storageClient || createObjectStorageClient(storageConfig))
    : null;
  const maximumBytes = Number(options.maxBytes || process.env.FACEBOOK_MEDIA_MAX_BYTES || DEFAULT_MAX_BYTES);

  return async function importFacebookPost(record) {
    if (!storageConfig.configured) {
      return {
        post_id: record?.source?.post_id || null,
        status: 'held',
        reason: 'object_storage_not_configured',
        missing: storageConfig.missing,
      };
    }
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
      return { post_id: record?.source?.post_id || null, status: 'held', reason: 'invalid_media_limit' };
    }

    const now = options.now instanceof Date ? options.now : new Date();
    const postId = String(record.source.post_id);
    const identity = recordIdentity(postId);
    const entryBase = {
      content_id: identity.id,
      source: { platform: 'facebook', item_id: postId, source_id: `facebook:${postId}` },
      media_sha256: [],
      record_path: `content/updates/${identity.id}.json`,
      imported_at: now.toISOString(),
    };
    const release = acquireManifestLock(manifestPath, now);
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-facebook-'));
    let recordPath = null;
    try {
      const sourceDuplicate = checkDuplicate(readManifest(manifestPath), {
        ...entryBase,
        media_sha256: ['0'.repeat(64)],
      });
      if (sourceDuplicate.duplicate && sourceDuplicate.reason === 'source') {
        return { post_id: postId, status: 'skipped', reason: 'duplicate_source' };
      }

      const storedMedia = [];
      for (let index = 0; index < record.media.length; index += 1) {
        const temporaryPath = path.join(tempDirectory, `media-${index + 1}`);
        await downloadMedia(record.media[index].source_url, temporaryPath, {
          fetchImpl: options.fetchImpl,
          maxBytes: maximumBytes,
        });
        const inspection = inspectMedia(temporaryPath, { maxBytes: maximumBytes });
        if (inspection.type !== record.media[index].type) throw new Error('facebook_media_type_mismatch');
        const storage = await uploadMediaObject(temporaryPath, inspection, {
          config: storageConfig,
          client,
        });
        storedMedia.push({ inspection, storage });
      }

      const entry = { ...entryBase, media_sha256: storedMedia.map(item => item.inspection.sha256) };
      const duplicate = checkDuplicate(readManifest(manifestPath), entry);
      if (duplicate.duplicate) {
        return { post_id: postId, status: 'skipped', reason: `duplicate_${duplicate.reason}` };
      }
      const contentRecord = buildFacebookRecord(record, storedMedia, now);
      validateContentRecord(contentRecord);
      recordPath = path.join(updatesDirectory, `${identity.id}.json`);
      atomicWriteJson(recordPath, contentRecord);
      const committed = appendImport(manifestPath, entry, now, { lockHeld: true });
      if (!committed.added) {
        try { fs.unlinkSync(recordPath); } catch {}
        return { post_id: postId, status: 'skipped', reason: `duplicate_${committed.reason}` };
      }
      return { post_id: postId, status: 'imported', content_id: identity.id, media_count: storedMedia.length };
    } catch (error) {
      if (recordPath) {
        try { fs.unlinkSync(recordPath); } catch {}
      }
      return { post_id: postId, status: 'held', reason: 'durable_import_failed', error: safeError(error) };
    } finally {
      try { fs.rmSync(tempDirectory, { recursive: true, force: true }); } catch {}
      release();
    }
  };
}

module.exports = {
  buildFacebookRecord,
  createFacebookImporter,
  downloadMedia,
  facebookTitle,
  isAllowedFacebookMediaUrl,
  recordIdentity,
};
