'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importLocalMedia, stableContentId } = require('../scripts/import-local-media');
const { atomicWriteJson, emptyManifest, readManifest } = require('../scripts/lib/manifest');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-retry-'));
  const contentDir = path.join(root, 'content');
  const folderName = '2026-08-04-retry';
  const folder = path.join(contentDir, 'inbox', folderName);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'photo.jpg'), JPEG);
  atomicWriteJson(path.join(contentDir, 'social-imports.json'), emptyManifest());
  return { root, contentDir, folderName };
}

test('failure before manifest commit rolls back files and is safely retryable', () => {
  const { root, contentDir, folderName } = fixture();
  try {
    const failed = importLocalMedia({
      contentDir,
      hooks: { beforeManifestCommit: () => { throw new Error('simulated interruption'); } },
    });
    assert.equal(failed.results[0].status, 'failed');
    assert.equal(readManifest(path.join(contentDir, 'social-imports.json')).imports.length, 0);
    assert.equal(fs.existsSync(path.join(contentDir, 'updates', `${stableContentId(folderName)}.json`)), false);
    assert.deepEqual(fs.existsSync(path.join(contentDir, 'media')) ? fs.readdirSync(path.join(contentDir, 'media')) : [], []);

    const retried = importLocalMedia({ contentDir });
    assert.equal(retried.results[0].status, 'imported');
    assert.equal(readManifest(path.join(contentDir, 'social-imports.json')).imports.length, 1);
    const record = JSON.parse(fs.readFileSync(path.join(contentDir, 'updates', `${stableContentId(folderName)}.json`), 'utf8'));
    assert.match(record.media[0].storage_url, /^\/media\/[a-f0-9]{64}\.jpg$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('dry-run performs validation without changing manifest or content files', () => {
  const { root, contentDir } = fixture();
  try {
    const before = fs.readFileSync(path.join(contentDir, 'social-imports.json'), 'utf8');
    const result = importLocalMedia({ contentDir, dryRun: true });
    assert.equal(result.results[0].status, 'planned');
    assert.equal(fs.readFileSync(path.join(contentDir, 'social-imports.json'), 'utf8'), before);
    assert.equal(fs.existsSync(path.join(contentDir, 'media')), false);
    assert.equal(fs.existsSync(path.join(contentDir, 'updates')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
