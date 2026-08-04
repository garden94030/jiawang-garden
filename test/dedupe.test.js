'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importLocalMedia } = require('../scripts/import-local-media');
const { readManifest, atomicWriteJson, emptyManifest } = require('../scripts/lib/manifest');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-dedupe-'));
  const contentDir = path.join(root, 'content');
  fs.mkdirSync(path.join(contentDir, 'inbox'), { recursive: true });
  atomicWriteJson(path.join(contentDir, 'social-imports.json'), emptyManifest());
  return { root, contentDir };
}

function addFolder(contentDir, folderName, fileName, contents = JPEG) {
  const folder = path.join(contentDir, 'inbox', folderName);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, fileName), contents);
  fs.writeFileSync(path.join(folder, 'note.txt'), '蝴蝶園植栽紀錄\n僅使用已確認文字。', 'utf8');
}

test('same source folder is imported only once', () => {
  const { root, contentDir } = fixture();
  try {
    addFolder(contentDir, '2026-08-04-example', 'first.jpg');
    const first = importLocalMedia({ contentDir });
    const second = importLocalMedia({ contentDir });
    assert.equal(first.results[0].status, 'imported');
    assert.equal(second.results[0].status, 'skipped');
    assert.equal(second.results[0].reason, 'duplicate_source');
    assert.equal(readManifest(path.join(contentDir, 'social-imports.json')).imports.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('same bytes with a new filename and folder are deduplicated by SHA-256', () => {
  const { root, contentDir } = fixture();
  try {
    addFolder(contentDir, '2026-08-04-first', 'original.jpg');
    let result = importLocalMedia({ contentDir });
    assert.equal(result.results[0].status, 'imported');

    addFolder(contentDir, '2026-08-05-renamed', 'renamed-copy.jpeg');
    result = importLocalMedia({ contentDir, folder: '2026-08-05-renamed' });
    assert.equal(result.results[0].status, 'skipped');
    assert.equal(result.results[0].reason, 'duplicate_media');
    assert.equal(readManifest(path.join(contentDir, 'social-imports.json')).imports.length, 1);
    assert.equal(fs.readdirSync(path.join(contentDir, 'media')).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('file extension cannot disguise unsupported content', () => {
  const { root, contentDir } = fixture();
  try {
    addFolder(contentDir, '2026-08-04-invalid', 'not-really.jpg', Buffer.from('plain text'));
    const result = importLocalMedia({ contentDir });
    assert.equal(result.results[0].status, 'held');
    assert.equal(result.results[0].reason, 'invalid_media');
    assert.equal(readManifest(path.join(contentDir, 'social-imports.json')).imports.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
