'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 1;
const PUBLISHING_STATUSES = new Set(['pending', 'published', 'source', 'skipped', 'failed', 'held']);

function emptyManifest() {
  return {
    schema_version: SCHEMA_VERSION,
    updated_at: null,
    imports: [],
  };
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function validateImportEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('manifest import entry must be an object');
  }
  assertNonEmptyString(entry.content_id, 'content_id');
  if (!entry.source || typeof entry.source !== 'object') {
    throw new Error('source must be an object');
  }
  assertNonEmptyString(entry.source.platform, 'source.platform');
  assertNonEmptyString(entry.source.item_id, 'source.item_id');
  assertNonEmptyString(entry.source.source_id, 'source.source_id');
  if (!Array.isArray(entry.media_sha256) || entry.media_sha256.length === 0) {
    throw new Error('media_sha256 must contain at least one checksum');
  }
  for (const checksum of entry.media_sha256) {
    if (typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)) {
      throw new Error('media_sha256 contains an invalid SHA-256 checksum');
    }
  }
  assertNonEmptyString(entry.record_path, 'record_path');
  assertNonEmptyString(entry.imported_at, 'imported_at');
  return entry;
}

function validateContentRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('content record must be an object');
  }
  if (record.schema_version !== SCHEMA_VERSION) {
    throw new Error(`unsupported content schema_version: ${record.schema_version}`);
  }
  assertNonEmptyString(record.id, 'id');
  if (!record.source || typeof record.source !== 'object') throw new Error('source must be an object');
  assertNonEmptyString(record.source.platform, 'source.platform');
  assertNonEmptyString(record.source.item_id, 'source.item_id');
  assertNonEmptyString(record.source.source_id, 'source.source_id');
  if (typeof record.source.original_text !== 'string') throw new Error('source.original_text must be a string');

  if (!record.content || typeof record.content !== 'object') throw new Error('content must be an object');
  assertNonEmptyString(record.content.title, 'content.title');
  assertNonEmptyString(record.content.summary, 'content.summary');
  assertNonEmptyString(record.content.category, 'content.category');
  assertNonEmptyString(record.content.slug, 'content.slug');

  if (!Array.isArray(record.media) || record.media.length === 0) {
    throw new Error('media must contain at least one item');
  }
  const mediaIds = new Set();
  for (const item of record.media) {
    assertNonEmptyString(item.id, 'media.id');
    if (mediaIds.has(item.id)) throw new Error(`duplicate media.id: ${item.id}`);
    mediaIds.add(item.id);
    if (!['image', 'video'].includes(item.type)) throw new Error(`unsupported media.type: ${item.type}`);
    assertNonEmptyString(item.storage_path, 'media.storage_path');
    if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new Error('media.sha256 must be a valid SHA-256 checksum');
    }
    if (!Number.isSafeInteger(item.size_bytes) || item.size_bytes <= 0) {
      throw new Error('media.size_bytes must be a positive integer');
    }
    assertNonEmptyString(item.mime_type, 'media.mime_type');
    if (typeof item.alt !== 'string') throw new Error('media.alt must be a string');
  }

  if (!record.publishing || typeof record.publishing !== 'object') {
    throw new Error('publishing must be an object');
  }
  for (const [platform, state] of Object.entries(record.publishing)) {
    if (!state || typeof state !== 'object' || !PUBLISHING_STATUSES.has(state.status)) {
      throw new Error(`invalid publishing status for ${platform}`);
    }
  }
  assertNonEmptyString(record.created_at, 'created_at');
  assertNonEmptyString(record.updated_at, 'updated_at');
  return record;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('manifest must be an object');
  }
  if (manifest.schema_version !== SCHEMA_VERSION) {
    throw new Error(`unsupported manifest schema_version: ${manifest.schema_version}`);
  }
  if (!Array.isArray(manifest.imports)) {
    throw new Error('manifest imports must be an array');
  }

  const sourceIds = new Set();
  const contentIds = new Set();
  for (const entry of manifest.imports) {
    validateImportEntry(entry);
    if (sourceIds.has(entry.source.source_id)) {
      throw new Error(`duplicate source_id in manifest: ${entry.source.source_id}`);
    }
    if (contentIds.has(entry.content_id)) {
      throw new Error(`duplicate content_id in manifest: ${entry.content_id}`);
    }
    sourceIds.add(entry.source.source_id);
    contentIds.add(entry.content_id);
  }
  return manifest;
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return emptyManifest();
  const text = fs.readFileSync(manifestPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`cannot parse manifest ${manifestPath}: ${error.message}`);
  }
  return validateManifest(parsed);
}

function atomicWriteJson(targetPath, value) {
  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;

  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, serialized, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

function normalizedHashSet(hashes) {
  return [...new Set(hashes)].sort();
}

function hasSameHashes(left, right) {
  const normalizedLeft = normalizedHashSet(left);
  const normalizedRight = normalizedHashSet(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((hash, index) => hash === normalizedRight[index]);
}

function findBySourceId(manifest, sourceId) {
  return manifest.imports.find(entry => entry.source.source_id === sourceId) || null;
}

function findBySourceItem(manifest, platform, itemId) {
  return manifest.imports.find(entry => (
    entry.source.platform === platform && entry.source.item_id === itemId
  )) || null;
}

function findByMediaSet(manifest, hashes) {
  return manifest.imports.find(entry => hasSameHashes(entry.media_sha256, hashes)) || null;
}

function findMediaChecksum(manifest, checksum) {
  return manifest.imports.find(entry => entry.media_sha256.includes(checksum)) || null;
}

function checkDuplicate(manifest, entry) {
  const sourceDuplicate = findBySourceId(manifest, entry.source.source_id)
    || findBySourceItem(manifest, entry.source.platform, entry.source.item_id);
  if (sourceDuplicate) {
    return { duplicate: true, reason: 'source', entry: sourceDuplicate };
  }
  const mediaDuplicate = findByMediaSet(manifest, entry.media_sha256);
  if (mediaDuplicate) {
    return { duplicate: true, reason: 'media', entry: mediaDuplicate };
  }
  return { duplicate: false, reason: null, entry: null };
}

function appendImport(manifestPath, entry, now = new Date()) {
  validateImportEntry(entry);
  const manifest = readManifest(manifestPath);
  const duplicate = checkDuplicate(manifest, entry);
  if (duplicate.duplicate) {
    return { added: false, ...duplicate, manifest };
  }

  const next = {
    ...manifest,
    updated_at: now.toISOString(),
    imports: [...manifest.imports, entry],
  };
  validateManifest(next);
  atomicWriteJson(manifestPath, next);
  return { added: true, duplicate: false, reason: null, entry, manifest: next };
}

module.exports = {
  SCHEMA_VERSION,
  appendImport,
  atomicWriteJson,
  checkDuplicate,
  emptyManifest,
  findByMediaSet,
  findBySourceId,
  findBySourceItem,
  findMediaChecksum,
  readManifest,
  validateContentRecord,
  validateImportEntry,
  validateManifest,
};
