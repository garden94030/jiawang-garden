'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFacebookImporter } = require('../scripts/lib/facebook-importer');
const { atomicWriteJson, emptyManifest, readManifest } = require('../scripts/lib/manifest');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-facebook-import-'));
  fs.mkdirSync(path.join(root, 'content'), { recursive: true });
  atomicWriteJson(path.join(root, 'content', 'social-imports.json'), emptyManifest());
  return root;
}

function storageConfig() {
  return {
    configured: true,
    missing: [],
    endpoint: 'https://storage.example.test',
    region: 'auto',
    bucket: 'jiawang',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    publicBaseUrl: 'https://media.example.test',
  };
}

test('Facebook importer saves verified media, content and manifest once', async () => {
  const root = fixture();
  let downloads = 0;
  let uploads = 0;
  const storageClient = {
    async send(command) {
      if (command.constructor.name === 'HeadObjectCommand') {
        const error = new Error('not found');
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }
      for await (const chunk of command.input.Body) assert.ok(chunk.length > 0);
      uploads += 1;
      return {};
    },
  };
  const importer = createFacebookImporter({
    rootDir: root,
    storageConfig: storageConfig(),
    storageClient,
    fetchImpl: async () => {
      downloads += 1;
      return new Response(JPEG, { status: 200, headers: { 'content-length': String(JPEG.length) } });
    },
    now: new Date('2026-08-04T01:00:00.000Z'),
  });
  const source = {
    source: {
      platform: 'facebook',
      post_id: 'page_42',
      permalink: 'https://www.facebook.com/page/posts/42',
      published_at: '2026-08-04T00:00:00+0000',
      original_text: '蝴蝶園植栽紀錄',
      is_own_post: true,
    },
    media: [{ type: 'image', source_url: 'https://scontent.xx.fbcdn.net/photo.jpg' }],
  };
  try {
    const first = await importer(source);
    const second = await importer(source);
    assert.equal(first.status, 'imported');
    assert.equal(second.status, 'skipped');
    assert.equal(second.reason, 'duplicate_source');
    assert.equal(downloads, 1);
    assert.equal(uploads, 1);
    assert.equal(readManifest(path.join(root, 'content', 'social-imports.json')).imports.length, 1);
    const recordPath = path.join(root, 'content', 'updates', `${first.content_id}.json`);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    assert.equal(record.import.status, 'published');
    assert.match(record.media[0].storage_url, /^https:\/\/media\.example\.test\/media\/[a-f0-9]{64}\.jpg$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Facebook importer holds content when durable storage is absent', async () => {
  const root = fixture();
  try {
    const importer = createFacebookImporter({ rootDir: root, env: {} });
    const result = await importer({ source: { post_id: 'page_43' }, media: [] });
    assert.equal(result.status, 'held');
    assert.equal(result.reason, 'object_storage_not_configured');
    assert.equal(readManifest(path.join(root, 'content', 'social-imports.json')).imports.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
