const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jiawang-security-'));
process.env.DATA_DIR = path.join(temporaryRoot, 'data');
process.env.UPLOADS_DIR = path.join(temporaryRoot, 'uploads');
delete process.env.ADMIN_API_TOKEN;
process.env.CONTACT_FORM_ENABLED = 'false';

const { createApp, normalizeData, writeConfiguration } = require('../server');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('health endpoint is available without exposing framework details', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.deepEqual(await response.json(), { ok: true });
});

test('write and private endpoints fail closed without an admin token', async () => {
  const checks = [
    fetch(`${baseUrl}/api/upload`, { method: 'POST' }),
    fetch(`${baseUrl}/api/photos/1`, { method: 'DELETE' }),
    fetch(`${baseUrl}/api/messages`),
  ];
  const responses = await Promise.all(checks);
  assert.deepEqual(responses.map(response => response.status), [503, 503, 503]);
});

test('legacy login and administrator listing are permanently disabled', async () => {
  const login = await fetch(`${baseUrl}/api/login`, { method: 'POST' });
  const admins = await fetch(`${baseUrl}/api/admins`);
  assert.equal(login.status, 410);
  assert.equal(admins.status, 410);
});

test('contact form cannot claim success before durable delivery is enabled', async () => {
  const response = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '測試', email: 'test@example.com', message: '測試訊息' }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('runtime writes require the explicit durable storage gate', () => {
  const token = 'x'.repeat(32);
  assert.deepEqual(writeConfiguration({
    ADMIN_API_TOKEN: token,
    CONTACT_FORM_ENABLED: 'true',
    DURABLE_WRITES_ENABLED: 'false',
  }), {
    durableWritesEnabled: false,
    adminEnabled: false,
    contactFormEnabled: false,
  });
  assert.deepEqual(writeConfiguration({
    ADMIN_API_TOKEN: token,
    CONTACT_FORM_ENABLED: 'true',
    DURABLE_WRITES_ENABLED: 'true',
  }), {
    durableWritesEnabled: true,
    adminEnabled: true,
    contactFormEnabled: true,
  });
});

test('parseable runtime data with the wrong schema fails closed', () => {
  assert.deepEqual(normalizeData({ photos: [], messages: [] }), { photos: [], messages: [] });
  assert.throws(() => normalizeData({ photos: {}, messages: [] }), /photos 與 messages 必須是陣列/);
  assert.throws(() => normalizeData({ photos: [], messages: null }), /photos 與 messages 必須是陣列/);
  assert.throws(() => normalizeData([]), /根資料必須是物件/);
});

test('legacy browser pages no longer contain credentials or local data stores', async () => {
  for (const route of ['/admin.html', '/upload.html']) {
    const response = await fetch(`${baseUrl}${route}`);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.match(body, /維護中/);
    assert.doesNotMatch(body, /password|localStorage|預設管理|管理員密碼/i);
  }
});

test('homepage includes canonical and Organization metadata', async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /rel="canonical"/);
  assert.match(body, /"@type": "Organization"/);
  assert.match(body, /"logo": "https:\/\/jiawang-garden\.onrender\.com\/branding\/google-ads-logo-square\.png"/);
  assert.match(body, /rel="icon"[^>]+google-ads-logo-square\.png/);
  assert.match(body, /gardenjiawang@gmail\.com/);
  assert.match(body, /mailto:gardenjiawang@gmail\.com/);
  assert.match(body, /facebook\.com\/profile\.php\?id=61592853779683/);
  assert.doesNotMatch(body, /alia\.liu\.60365/);
  assert.match(body, /og\.png/);
});

test('social preview image is publicly available', async () => {
  const response = await fetch(`${baseUrl}/og.png`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
});

test('business logo is publicly available', async () => {
  const response = await fetch(`${baseUrl}/branding/google-ads-logo-square.png`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
});

test('server source, package metadata and environment templates are not public', async () => {
  for (const route of ['/server.js', '/package.json', '/package-lock.json', '/.env.example', '/IMPLEMENTATION_PLAN.md']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 404, route);
  }
});
