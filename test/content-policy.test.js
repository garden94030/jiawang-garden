'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  mediaType,
  platformDisposition,
  validateContent,
} = require('../scripts/lib/content-policy');

function record(overrides = {}) {
  return {
    id: 'jw-test-1',
    source: { platform: 'facebook', post_id: 'page_1', original_text: '蝴蝶園工作紀錄' },
    content: { title: '工作紀錄' },
    media: [{ type: 'image', storage_url: 'https://media.example/image.jpg' }],
    publishing: {},
    ...overrides,
  };
}

test('Facebook source is recorded but never republished to Facebook', () => {
  assert.deepEqual(platformDisposition(record(), 'facebook'), {
    action: 'record',
    status: 'source',
    reason: 'facebook_is_source',
  });
});

test('photo-only content is skipped for YouTube', () => {
  assert.deepEqual(platformDisposition(record(), 'youtube'), {
    action: 'record',
    status: 'skipped',
    reason: 'no_video',
  });
});

test('shared Facebook and unknown media are held', () => {
  const result = validateContent(record({
    source: { platform: 'facebook', is_shared: true },
    media: [{ type: 'document', storage_url: 'https://media.example/file.pdf' }],
  }));
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ['shared_facebook_post', 'unsupported_media_type']);
});

test('failed platform requires an explicit retry', () => {
  const failed = record({ publishing: { threads: { status: 'failed', reason: 'temporary' } } });
  assert.equal(platformDisposition(failed, 'threads').action, 'none');
  assert.equal(platformDisposition(failed, 'threads', { retryFailed: true }).action, 'publish');
});

test('a completed platform is never downgraded by a later malformed record', () => {
  const malformed = record({
    media: [{ type: 'document' }],
    publishing: { instagram: { status: 'published', post_id: 'existing' } },
  });
  assert.deepEqual(platformDisposition(malformed, 'instagram'), {
    action: 'none',
    status: 'published',
    reason: 'already_complete',
  });
});

test('media type may be derived from MIME without guessing unsupported files', () => {
  assert.equal(mediaType({ mime_type: 'image/jpeg' }), 'image');
  assert.equal(mediaType({ mimeType: 'video/mp4' }), 'video');
  assert.equal(mediaType({ mime_type: 'application/pdf' }), 'unknown');
});

test('draft imports are held instead of being published to social platforms', () => {
  const result = validateContent(record({ import: { status: 'draft' } }));
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ['import_draft']);
});
