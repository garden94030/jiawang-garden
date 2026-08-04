'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildSite, loadUpdates } = require('../scripts/build-site');
const { escapeHtml, normalizeUpdate } = require('../scripts/lib/html');

const SITE_URL = 'https://garden.example';

function workspace() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-site-'));
  fs.mkdirSync(path.join(rootDir, 'content', 'updates'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'index.html'), `<!doctype html><html><body>
<section id="updates"><!-- UPDATES_LIST_START -->舊內容<!-- UPDATES_LIST_END --></section>
</body></html>`, 'utf8');
  return rootDir;
}

function writeUpdate(rootDir, filename, override = {}) {
  const fixture = {
    id: 'jw-20260804-facebook-123456',
    source: {
      platform: 'facebook',
      permalink: 'https://www.facebook.com/example/posts/123456',
      published_at: '2026-08-04T09:00:00+08:00',
      original_text: '蝴蝶園植栽與生態環境更新。'
    },
    content: {
      title: '校園蝴蝶園生態紀錄',
      summary: '記錄蝴蝶園的植栽與生態環境。',
      category: '蝴蝶園藝',
      species: null,
      location: null,
      event_date: null,
      slug: '2026-08-04-butterfly-garden'
    },
    media: [
      {
        id: 'media-image',
        type: 'image',
        storage_url: 'https://media.example/garden.jpg',
        alt: '蝴蝶園植栽與生態環境',
        width: 1600,
        height: 1200
      },
      {
        id: 'media-video',
        type: 'video',
        storage_url: 'https://media.example/garden.mp4',
        thumbnail_url: 'https://media.example/garden-poster.jpg',
        alt: '蝴蝶園現場影片'
      }
    ],
    publishing: { website: { status: 'pending' } },
    created_at: '2026-08-04T09:10:00+08:00',
    updated_at: '2026-08-04T09:10:00+08:00',
    ...override
  };
  fs.writeFileSync(path.join(rootDir, 'content', 'updates', filename), JSON.stringify(fixture, null, 2), 'utf8');
  return fixture;
}

test('HTML escaping covers text and attribute control characters', () => {
  assert.equal(escapeHtml(`<b title="x">Tom & 'Sue'</b>`), '&lt;b title=&quot;x&quot;&gt;Tom &amp; &#39;Sue&#39;&lt;/b&gt;');
});

test('empty content builds an index, robots and sitemap without failing', t => {
  const rootDir = workspace();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const result = buildSite({ rootDir, siteUrl: SITE_URL });

  assert.equal(result.count, 0);
  assert.match(fs.readFileSync(path.join(rootDir, 'updates', 'index.html'), 'utf8'), /更新內容準備中/);
  assert.match(fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8'), /目前尚無公開更新/);
  assert.equal(fs.readFileSync(path.join(rootDir, 'robots.txt'), 'utf8'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  const sitemap = fs.readFileSync(path.join(rootDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, new RegExp(`<loc>${SITE_URL}/</loc>`));
  assert.match(sitemap, new RegExp(`<loc>${SITE_URL}/updates/</loc>`));
});

test('build creates crawlable escaped pages and only real media schemas', t => {
  const rootDir = workspace();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  writeUpdate(rootDir, 'update.json', {
    content: {
      title: '蝴蝶園 <script>alert("x")</script>',
      summary: '實際紀錄 & 圖片',
      slug: 'garden-update',
      category: '園藝工程',
      species: null,
      location: null,
      event_date: null
    }
  });

  const result = buildSite({ rootDir, siteUrl: SITE_URL });
  const pagePath = path.join(rootDir, 'updates', 'garden-update', 'index.html');
  const page = fs.readFileSync(pagePath, 'utf8');
  const homepage = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const sitemap = fs.readFileSync(path.join(rootDir, 'sitemap.xml'), 'utf8');

  assert.equal(result.count, 1);
  assert.match(page, /<link rel="canonical" href="https:\/\/garden\.example\/updates\/garden-update\/">/);
  assert.match(page, /rel="icon"[^>]+google-ads-logo-square\.png/);
  assert.match(page, /蝴蝶園 &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(page, /<script>alert\("x"\)<\/script>/);
  assert.match(page, /<img[^>]+width="1600"[^>]+height="1200"/);
  assert.match(page, /<figcaption>蝴蝶園植栽與生態環境<\/figcaption>/);
  assert.match(homepage, /href="\/updates\/garden-update\/"/);
  assert.match(sitemap, /<loc>https:\/\/garden\.example\/updates\/garden-update\/<\/loc>/);

  const schemaSource = page.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1];
  const schema = JSON.parse(schemaSource);
  const types = schema['@graph'].map(item => item['@type']);
  assert.deepEqual(types, ['Article', 'ImageObject', 'VideoObject', 'BreadcrumbList']);
  assert.equal(schema['@graph'][0].headline, '蝴蝶園 <script>alert("x")</script>');
  assert.equal(schema['@graph'][0].publisher.logo.url, 'https://garden.example/branding/google-ads-logo-square.png');
  assert.equal(schema['@graph'][1].contentUrl, 'https://media.example/garden.jpg');
  assert.equal(schema['@graph'][2].contentUrl, 'https://media.example/garden.mp4');
});

test('draft imports are not published and unknown media is omitted', t => {
  const rootDir = workspace();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  writeUpdate(rootDir, 'draft.json', { import: { status: 'draft' } });

  assert.equal(loadUpdates(rootDir, SITE_URL).length, 0);
  assert.equal(normalizeUpdate({ id: 'x', content: { slug: 'x' }, media: [{ type: 'file', url: 'https://example.test/file.pdf' }] }, SITE_URL).media.length, 0);
});

test('invalid JSON is rejected before the existing homepage is overwritten', t => {
  const rootDir = workspace();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const original = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'content', 'updates', 'broken.json'), '{broken', 'utf8');

  assert.throws(() => buildSite({ rootDir, siteUrl: SITE_URL }), /不是有效 JSON/);
  assert.equal(fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8'), original);
  assert.equal(fs.existsSync(path.join(rootDir, 'updates', 'index.html')), false);
});

test('duplicate slugs are rejected instead of overwriting an update page', t => {
  const rootDir = workspace();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  writeUpdate(rootDir, 'first.json');
  writeUpdate(rootDir, 'second.json', { id: 'another-id' });

  assert.throws(() => buildSite({ rootDir, siteUrl: SITE_URL }), /重複的更新 slug/);
});

test('rebuild removes stale generated pages after content is archived', t => {
  const rootDir = workspace();
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const raw = writeUpdate(rootDir, 'update.json');
  buildSite({ rootDir, siteUrl: SITE_URL });
  const stalePage = path.join(rootDir, 'updates', raw.content.slug, 'index.html');
  assert.equal(fs.existsSync(stalePage), true);

  fs.writeFileSync(path.join(rootDir, 'content', 'updates', 'update.json'), JSON.stringify({ ...raw, archived_at: '2026-08-05T00:00:00Z' }), 'utf8');
  buildSite({ rootDir, siteUrl: SITE_URL });
  assert.equal(fs.existsSync(stalePage), false);
});
