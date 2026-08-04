'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const publishers = require('../scripts/lib/publishers');
const { buildVideoMetadata } = require('../scripts/lib/publishers/youtube');
const { publishFile, updatePlatformState } = require('../scripts/publish-content');
const { normalizeFacebookPost, syncFacebook } = require('../scripts/sync-facebook');

function imageRecord(source = 'manual') {
  return {
    id: 'jw-test-publish',
    source: { platform: source, post_id: source === 'facebook' ? 'page_42' : null, original_text: '工作紀錄' },
    content: { title: '蝴蝶園工作紀錄', summary: '依原始資料整理的紀錄' },
    media: [{ type: 'image', storage_url: 'https://media.example/image.jpg' }],
    publishing: {},
  };
}

test('all adapters are fail-closed without credentials and never call fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('network must not be called'); };
  for (const platform of ['facebook', 'instagram', 'threads']) {
    const result = await publishers[platform].publish(imageRecord(), {
      allowLive: true,
      dryRun: false,
      env: {},
      fetchImpl,
    });
    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'not_configured');
  }
  assert.equal(calls, 0);
});

test('Facebook sync is fail-closed without credentials and dry-run does not call fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('network must not be called'); };
  const missing = await syncFacebook({ env: {}, dryRun: false, allowLive: true, fetchImpl });
  const dryRun = await syncFacebook({
    env: {
      META_GRAPH_API_VERSION: 'v99.0',
      FACEBOOK_PAGE_ID: 'page',
      FACEBOOK_PAGE_ACCESS_TOKEN: 'secret',
    },
    dryRun: true,
    allowLive: true,
    fetchImpl,
  });
  assert.equal(missing.status, 'not_configured');
  assert.equal(dryRun.status, 'dry_run');
  assert.equal(calls, 0);
});

test('Facebook normalization keeps own media posts and rejects shared stories', () => {
  const own = normalizeFacebookPost({
    id: 'page_42',
    message: '園藝紀錄',
    attachments: { data: [{ media_type: 'photo', media: { image: { src: 'https://example.test/a.jpg' } } }] },
  }, 'page');
  const shared = normalizeFacebookPost({
    id: 'page_43',
    status_type: 'shared_story',
    attachments: { data: [{ media_type: 'photo', url: 'https://example.test/b.jpg' }] },
  }, 'page');
  assert.equal(own.source.post_id, 'page_42');
  assert.equal(own.media[0].type, 'image');
  assert.equal(shared, null);
});

test('configured dry-run adapters do not make network requests', async () => {
  let calls = 0;
  const result = await publishers.instagram.publish(imageRecord(), {
    allowLive: true,
    dryRun: true,
    env: {
      META_GRAPH_API_VERSION: 'v99.0',
      INSTAGRAM_ACCOUNT_ID: 'account',
      INSTAGRAM_ACCESS_TOKEN: 'secret',
    },
    fetchImpl: async () => { calls += 1; throw new Error('network must not be called'); },
  });
  assert.equal(result.status, 'dry_run');
  assert.equal(calls, 0);
});

test('Facebook source and photo-only YouTube content never call a network', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; throw new Error('network must not be called'); };
  const facebook = await publishers.facebook.publish(imageRecord('facebook'), {
    allowLive: true,
    dryRun: false,
    env: {},
    fetchImpl,
  });
  const youtube = await publishers.youtube.publish(imageRecord(), {
    allowLive: true,
    dryRun: false,
    env: {},
    fetchImpl,
  });
  assert.equal(facebook.status, 'source');
  assert.equal(youtube.reason, 'no_video');
  assert.equal(calls, 0);
});

test('YouTube metadata is always private even when an environment requests public', () => {
  const metadata = buildVideoMetadata(imageRecord(), {
    youtube: { title: '測試影片', description: '測試說明' },
  });
  assert.equal(metadata.status.privacyStatus, 'private');
});

test('single-platform retry updates only the failed platform and is idempotent after success', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-publish-'));
  const file = path.join(root, 'record.json');
  const value = imageRecord();
  value.publishing = {
    instagram: { status: 'published', post_id: 'ig-existing' },
    threads: { status: 'failed', reason: 'temporary', attempts: 1 },
    youtube: { status: 'skipped', reason: 'no_video' },
  };
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  let calls = 0;
  const adapters = {
    threads: {
      publish: async () => {
        calls += 1;
        return { status: 'published', post_id: 'thread-new' };
      },
    },
  };

  await publishFile(file, {
    allowLive: true,
    dryRun: false,
    platforms: ['threads'],
    publishers: adapters,
    retryFailed: true,
    now: () => '2026-08-04T01:00:00.000Z',
  });
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.publishing.threads.status, 'published');
  assert.equal(saved.publishing.threads.post_id, 'thread-new');
  assert.equal(saved.publishing.threads.attempts, 2);
  assert.equal(saved.publishing.instagram.post_id, 'ig-existing');
  assert.equal(saved.publishing.youtube.reason, 'no_video');

  await publishFile(file, {
    allowLive: true,
    dryRun: false,
    platforms: ['threads'],
    publishers: adapters,
    retryFailed: true,
  });
  assert.equal(calls, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('delivery intent is durable before the request and unknown results are never auto-retried', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-uncertain-'));
  const file = path.join(root, 'record.json');
  fs.writeFileSync(file, `${JSON.stringify(imageRecord('manual'), null, 2)}\n`);
  let calls = 0;
  const adapters = {
    threads: {
      publish: async () => {
        calls += 1;
        const checkpoint = JSON.parse(fs.readFileSync(file, 'utf8'));
        assert.equal(checkpoint.publishing.threads.status, 'attempting');
        assert.equal(checkpoint.publishing.threads.attempt_id, 'run-1-threads');
        throw new Error('network response lost');
      },
    },
  };
  try {
    await publishFile(file, {
      allowLive: true,
      dryRun: false,
      platforms: ['threads'],
      publishers: adapters,
      retryFailed: true,
      attemptId: 'run-1-threads',
    });
    let saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.publishing.threads.status, 'uncertain');
    assert.equal(saved.publishing.threads.reason, 'delivery_result_unknown');

    await publishFile(file, {
      allowLive: true,
      dryRun: false,
      platforms: ['threads'],
      publishers: adapters,
      retryFailed: true,
      attemptId: 'run-2-threads',
    });
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.publishing.threads.status, 'uncertain');
    assert.equal(calls, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('capability upload URLs are stripped from public publishing state', () => {
  const value = imageRecord();
  updatePlatformState(value, 'youtube', {
    status: 'pending',
    upload_url: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=secret',
  }, '2026-08-04T01:00:00.000Z');
  assert.equal(value.publishing.youtube.upload_url, undefined);
});
