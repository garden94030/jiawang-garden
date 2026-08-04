#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createCopy } = require('./lib/ai-copy');
const {
  SUPPORTED_PLATFORMS,
  currentPlatformState,
  platformDisposition,
} = require('./lib/content-policy');
const defaultPublishers = require('./lib/publishers');
const { safeError } = require('./lib/publishers/base');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function updatePlatformState(record, platform, result, now, options = {}) {
  record.publishing = record.publishing && typeof record.publishing === 'object'
    ? record.publishing
    : {};
  const previous = currentPlatformState(record, platform);
  const next = {
    ...previous,
    ...result,
    attempts: Number(previous.attempts || 0) + (options.incrementAttempt === false ? 0 : 1),
    last_attempt_at: now,
  };
  delete next.platform;
  delete next.would_publish;
  delete next.missing;
  if (next.status === 'published' || next.status === 'source') {
    delete next.reason;
    delete next.error;
    delete next.upload_url;
  }
  if (next.status === 'published') next.published_at = now;
  record.publishing[platform] = next;
  record.updated_at = now;
  return next;
}

async function publishRecord(record, options = {}) {
  const platforms = options.platforms || SUPPORTED_PLATFORMS;
  const publishers = options.publishers || defaultPublishers;
  const env = options.env || process.env;
  const dryRun = options.dryRun !== false || options.allowLive !== true;
  const nowFactory = options.now || (() => new Date().toISOString());
  const results = {};
  const copy = await createCopy(record, {
    enabled: options.aiEnabled === true,
    generate: options.generateCopy,
    model: env.AI_COPY_MODEL,
    siteUrl: env.SITE_URL,
  });

  for (const platform of platforms) {
    const disposition = platformDisposition(record, platform, {
      retryFailed: options.retryFailed === true,
    });

    if (disposition.action === 'none') {
      results[platform] = { status: disposition.status, reason: disposition.reason, attempted: false };
      continue;
    }

    if (disposition.action === 'record') {
      const result = platform === 'facebook' && disposition.status === 'source'
        ? {
            status: 'source',
            reason: disposition.reason,
            post_id: record?.source?.post_id || null,
            url: record?.source?.permalink || null,
          }
        : { status: disposition.status, reason: disposition.reason };
      results[platform] = { ...result, attempted: false };
      if (!dryRun) updatePlatformState(record, platform, result, nowFactory());
      continue;
    }

    if (disposition.action === 'hold') {
      const result = { status: 'held', reason: disposition.reason };
      results[platform] = { ...result, attempted: false };
      if (!dryRun) updatePlatformState(record, platform, result, nowFactory());
      continue;
    }

    const adapter = publishers[platform];
    if (!adapter || typeof adapter.publish !== 'function') {
      const result = { status: 'skipped', reason: 'not_configured' };
      results[platform] = { ...result, attempted: false };
      if (!dryRun) updatePlatformState(record, platform, result, nowFactory());
      continue;
    }

    try {
      const result = await adapter.publish(record, {
        allowLive: options.allowLive === true,
        checkpoint: async (checkpoint) => {
          if (dryRun) return;
          updatePlatformState(record, platform, checkpoint, nowFactory(), { incrementAttempt: false });
          if (typeof options.persist === 'function') await options.persist(record);
        },
        copy,
        dryRun,
        env,
        fetchImpl: options.fetchImpl,
      });
      results[platform] = { ...result, attempted: result.status !== 'dry_run' };
      if (!dryRun && result.status !== 'dry_run') {
        updatePlatformState(record, platform, result, nowFactory());
      }
    } catch (error) {
      const result = { status: 'failed', reason: safeError(error) };
      results[platform] = { ...result, attempted: true };
      if (!dryRun) updatePlatformState(record, platform, result, nowFactory());
    }
  }

  return { record, results, dry_run: dryRun };
}

async function publishFile(filePath, options = {}) {
  const record = readJson(filePath);
  const result = await publishRecord(record, {
    ...options,
    persist: async (next) => writeJsonAtomic(filePath, next),
  });
  if (!result.dry_run) writeJsonAtomic(filePath, result.record);
  return { ...result, file: filePath };
}

function listUpdateFiles(rootDir) {
  const directory = path.join(rootDir, 'content', 'updates');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function publishAll(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  let files = listUpdateFiles(rootDir);
  if (options.content) {
    const requested = path.resolve(rootDir, options.content);
    files = files.filter((file) => file === requested || path.basename(file, '.json') === options.content);
  }
  const runs = [];
  for (const file of files) runs.push(await publishFile(file, options));
  return {
    dry_run: options.dryRun !== false || options.allowLive !== true,
    files: runs.length,
    runs,
  };
}

function parseArgs(argv) {
  const options = { dryRun: true, retryFailed: false };
  const platforms = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--live') options.dryRun = false;
    else if (value === '--dry-run') options.dryRun = true;
    else if (value === '--retry-failed') options.retryFailed = true;
    else if (value === '--platform' && argv[index + 1]) platforms.push(argv[++index]);
    else if (value.startsWith('--platform=')) platforms.push(value.slice('--platform='.length));
    else if (value === '--content' && argv[index + 1]) options.content = argv[++index];
    else if (value === '--root' && argv[index + 1]) options.rootDir = path.resolve(argv[++index]);
    else throw new Error(`不支援的參數：${value}`);
  }
  if (platforms.length) {
    const invalid = platforms.filter((platform) => !SUPPORTED_PLATFORMS.includes(platform));
    if (invalid.length) throw new Error(`不支援的平台：${invalid.join(', ')}`);
    options.platforms = [...new Set(platforms)];
  }
  options.allowLive = options.dryRun === false && process.env.SOCIAL_PUBLISH_LIVE === 'true';
  if (!options.allowLive) options.dryRun = true;
  return options;
}

function summary(result) {
  const counts = {};
  for (const run of result.runs) {
    for (const outcome of Object.values(run.results)) {
      counts[outcome.status] = (counts[outcome.status] || 0) + 1;
    }
  }
  return { dry_run: result.dry_run, files: result.files, statuses: counts };
}

if (require.main === module) {
  publishAll(parseArgs(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(summary(result), null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`社群發布失敗：${safeError(error)}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  listUpdateFiles,
  parseArgs,
  publishAll,
  publishFile,
  publishRecord,
  summary,
  updatePlatformState,
  writeJsonAtomic,
};
