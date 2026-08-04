'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  appendImport,
  atomicWriteJson,
  emptyManifest,
  readManifest,
  validateContentRecord,
} = require('../scripts/lib/manifest');

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-manifest-'));
  try { callback(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function entry(overrides = {}) {
  return {
    content_id: overrides.content_id || 'jw-20260804-local-abc123',
    source: overrides.source || {
      platform: 'local',
      item_id: '2026-08-04-example',
      source_id: 'local:2026-08-04-example',
    },
    media_sha256: overrides.media_sha256 || ['a'.repeat(64)],
    record_path: overrides.record_path || 'content/updates/jw-20260804-local-abc123.json',
    imported_at: overrides.imported_at || '2026-08-04T01:00:00.000Z',
  };
}

test('atomicWriteJson leaves a complete parseable manifest', () => {
  withTemporaryDirectory(directory => {
    const manifestPath = path.join(directory, 'nested', 'social-imports.json');
    atomicWriteJson(manifestPath, emptyManifest());
    assert.deepEqual(readManifest(manifestPath), emptyManifest());
    assert.deepEqual(fs.readdirSync(path.dirname(manifestPath)), ['social-imports.json']);
  });
});

test('appendImport records one source and rejects repeated source IDs', () => {
  withTemporaryDirectory(directory => {
    const manifestPath = path.join(directory, 'social-imports.json');
    const first = appendImport(manifestPath, entry(), new Date('2026-08-04T01:00:00Z'));
    const second = appendImport(manifestPath, entry(), new Date('2026-08-04T02:00:00Z'));
    assert.equal(first.added, true);
    assert.equal(second.added, false);
    assert.equal(second.reason, 'source');
    assert.equal(readManifest(manifestPath).imports.length, 1);
  });
});

test('readManifest fails closed on malformed or duplicate entries', () => {
  withTemporaryDirectory(directory => {
    const manifestPath = path.join(directory, 'social-imports.json');
    fs.writeFileSync(manifestPath, '{bad json', 'utf8');
    assert.throws(() => readManifest(manifestPath), /cannot parse manifest/);

    fs.writeFileSync(manifestPath, JSON.stringify({
      schema_version: 1,
      updated_at: null,
      imports: [entry(), { ...entry(), content_id: 'another' }],
    }), 'utf8');
    assert.throws(() => readManifest(manifestPath), /duplicate source_id/);
  });
});

test('content schema rejects records without durable media metadata', () => {
  assert.throws(() => validateContentRecord({
    schema_version: 1,
    id: 'jw-example',
    source: {
      platform: 'local',
      item_id: 'example',
      source_id: 'local:example',
      original_text: '',
    },
    content: {
      title: '園藝紀錄',
      summary: '摘要',
      category: 'garden',
      slug: 'example',
    },
    media: [],
    publishing: {},
    created_at: '2026-08-04T01:00:00.000Z',
    updated_at: '2026-08-04T01:00:00.000Z',
  }), /media must contain at least one item/);
});
