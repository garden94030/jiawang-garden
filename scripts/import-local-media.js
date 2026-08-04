#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  appendImport,
  atomicWriteJson,
  checkDuplicate,
  readManifest,
  validateContentRecord,
} = require('./lib/manifest');
const { DEFAULT_MAX_BYTES, inspectMedia, materializeMedia } = require('./lib/media');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CONTENT_DIR = path.join(PROJECT_ROOT, 'content');

function parseArguments(argv) {
  const options = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (['--content-dir', '--inbox', '--folder', '--max-bytes'].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === '--content-dir') options.contentDir = path.resolve(value);
      if (argument === '--inbox') options.inboxDir = path.resolve(value);
      if (argument === '--folder') options.folder = value;
      if (argument === '--max-bytes') options.maxBytes = Number(value);
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/import-local-media.js [options]',
    '',
    'Options:',
    '  --dry-run             Validate and report without writing files',
    '  --folder NAME         Import only one immediate inbox folder',
    '  --inbox PATH          Override the inbox directory',
    '  --content-dir PATH    Override content, media, updates and manifest root',
    '  --max-bytes NUMBER    Maximum allowed bytes per media file',
  ].join('\n');
}

function safeFolderName(name) {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new Error('folder must be one immediate inbox directory name');
  }
  return name;
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function dateFromFolder(folderName) {
  const match = folderName.match(/^(\d{4})-(\d{2})-(\d{2})(?:-|$)/);
  if (!match) return null;
  const value = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

function slugify(folderName) {
  const value = folderName
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return value || `garden-${crypto.createHash('sha256').update(folderName).digest('hex').slice(0, 8)}`;
}

function stableContentId(folderName) {
  const date = dateFromFolder(folderName)?.replaceAll('-', '') || 'undated';
  const digest = crypto.createHash('sha256').update(`local:${folderName}`).digest('hex').slice(0, 12);
  return `jw-${date}-local-${digest}`;
}

function readNote(folderPath) {
  const notePath = path.join(folderPath, 'note.txt');
  if (!fs.existsSync(notePath)) return '';
  return fs.readFileSync(notePath, 'utf8').replace(/^\uFEFF/, '').trim();
}

function titleFromNote(note, eventDate) {
  const firstLine = note.split(/\r?\n/).map(line => line.trim()).find(Boolean);
  if (firstLine) return firstLine.slice(0, 80);
  return eventDate ? `${eventDate} 佳旺景觀園藝紀錄` : '佳旺景觀園藝紀錄';
}

function listInboxFolders(inboxDirectory, selectedFolder) {
  if (!fs.existsSync(inboxDirectory)) return [];
  if (selectedFolder) {
    const name = safeFolderName(selectedFolder);
    const folderPath = path.join(inboxDirectory, name);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      throw new Error(`inbox folder does not exist: ${name}`);
    }
    return [{ name, path: folderPath }];
  }
  return fs.readdirSync(inboxDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'))
    .map(entry => ({ name: entry.name, path: path.join(inboxDirectory, entry.name) }));
}

function listMediaFiles(folderPath) {
  return fs.readdirSync(folderPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== 'note.txt' && !entry.name.startsWith('.'))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hant'))
    .map(entry => ({ name: entry.name, path: path.join(folderPath, entry.name) }));
}

function buildRecord({ folderName, note, media, contentDirectory, now }) {
  const sourceId = `local:${folderName}`;
  const contentId = stableContentId(folderName);
  const eventDate = dateFromFolder(folderName);
  const slug = slugify(folderName);
  const timestamp = now.toISOString();
  const contentBase = path.dirname(contentDirectory);

  return {
    schema_version: 1,
    id: contentId,
    source: {
      platform: 'local',
      item_id: folderName,
      source_id: sourceId,
      permalink: null,
      published_at: null,
      original_text: note,
    },
    content: {
      title: titleFromNote(note, eventDate),
      summary: note || '手動匯入的園藝照片或影片紀錄。',
      category: 'garden',
      species: null,
      location: null,
      event_date: eventDate,
      slug,
    },
    media: media.map((item, index) => ({
      id: `media-${String(index + 1).padStart(2, '0')}`,
      type: item.inspection.type,
      source_path: toPosix(path.relative(contentBase, item.sourcePath)),
      storage_path: toPosix(path.relative(contentBase, item.destinationPath)),
      storage_url: `/media/${path.basename(item.destinationPath)}`,
      sha256: item.inspection.sha256,
      mime_type: item.inspection.mime_type,
      size_bytes: item.inspection.size_bytes,
      alt: item.inspection.type === 'image' ? '佳旺景觀園藝現場紀錄' : '佳旺景觀園藝影片紀錄',
      width: null,
      height: null,
    })),
    publishing: {
      website: { status: 'pending', url: null },
      facebook: { status: 'pending', post_id: null },
      instagram: { status: 'pending', post_id: null },
      threads: { status: 'pending', post_id: null },
      youtube: media.some(item => item.inspection.type === 'video')
        ? { status: 'pending', post_id: null }
        : { status: 'skipped', post_id: null, reason: 'no_video' },
    },
    import: {
      status: 'draft',
      imported_at: timestamp,
      dry_run: false,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function cleanupCreated(paths) {
  for (const target of paths.reverse()) {
    try { fs.unlinkSync(target); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function importFolder(folder, configuration) {
  const {
    contentDirectory,
    manifestPath,
    mediaDirectory,
    updatesDirectory,
    dryRun,
    maxBytes,
    now,
    hooks,
  } = configuration;
  const note = readNote(folder.path);
  const files = listMediaFiles(folder.path);
  if (files.length === 0) {
    return { folder: folder.name, status: 'held', reason: 'no_media' };
  }

  let inspected;
  try {
    inspected = files.map(file => ({
      ...file,
      inspection: inspectMedia(file.path, { maxBytes }),
    }));
  } catch (error) {
    return { folder: folder.name, status: 'held', reason: 'invalid_media', error: error.message };
  }

  const contentId = stableContentId(folder.name);
  const source = {
    platform: 'local',
    item_id: folder.name,
    source_id: `local:${folder.name}`,
  };
  const entryDraft = {
    content_id: contentId,
    source,
    media_sha256: inspected.map(item => item.inspection.sha256),
    record_path: toPosix(path.relative(path.dirname(contentDirectory), path.join(updatesDirectory, `${contentId}.json`))),
    imported_at: now.toISOString(),
  };
  const duplicate = checkDuplicate(readManifest(manifestPath), entryDraft);
  if (duplicate.duplicate) {
    return {
      folder: folder.name,
      status: 'skipped',
      reason: `duplicate_${duplicate.reason}`,
      content_id: duplicate.entry.content_id,
    };
  }
  if (dryRun) {
    return {
      folder: folder.name,
      status: 'planned',
      content_id: contentId,
      media_count: inspected.length,
    };
  }

  const createdPaths = [];
  const recordPath = path.join(updatesDirectory, `${contentId}.json`);
  try {
    const media = inspected.map(item => {
      const materialized = materializeMedia(item.path, mediaDirectory, item.inspection);
      if (materialized.created) createdPaths.push(materialized.path);
      return {
        sourcePath: item.path,
        destinationPath: materialized.path,
        inspection: item.inspection,
      };
    });
    if (hooks?.afterMedia) hooks.afterMedia({ folder, media });

    const record = buildRecord({
      folderName: folder.name,
      note,
      media,
      contentDirectory,
      now,
    });
    validateContentRecord(record);
    atomicWriteJson(recordPath, record);
    createdPaths.push(recordPath);
    if (hooks?.beforeManifestCommit) hooks.beforeManifestCommit({ folder, record, entry: entryDraft });

    const committed = appendImport(manifestPath, entryDraft, now);
    if (!committed.added) {
      cleanupCreated(createdPaths);
      return {
        folder: folder.name,
        status: 'skipped',
        reason: `duplicate_${committed.reason}`,
        content_id: committed.entry.content_id,
      };
    }
    return {
      folder: folder.name,
      status: 'imported',
      content_id: contentId,
      media_count: media.length,
      record_path: entryDraft.record_path,
    };
  } catch (error) {
    cleanupCreated(createdPaths);
    return { folder: folder.name, status: 'failed', reason: 'write_failed', error: error.message };
  }
}

function importLocalMedia(options = {}) {
  const contentDirectory = path.resolve(options.contentDir || DEFAULT_CONTENT_DIR);
  const inboxDirectory = path.resolve(options.inboxDir || path.join(contentDirectory, 'inbox'));
  const manifestPath = path.join(contentDirectory, 'social-imports.json');
  const mediaDirectory = path.join(contentDirectory, 'media');
  const updatesDirectory = path.join(contentDirectory, 'updates');
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('maxBytes must be a positive integer');
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const folders = listInboxFolders(inboxDirectory, options.folder);
  const results = folders.map(folder => importFolder(folder, {
    contentDirectory,
    manifestPath,
    mediaDirectory,
    updatesDirectory,
    dryRun: options.dryRun === true,
    maxBytes,
    now,
    hooks: options.hooks,
  }));
  return {
    dry_run: options.dryRun === true,
    inbox: inboxDirectory,
    counts: results.reduce((counts, result) => {
      counts[result.status] = (counts[result.status] || 0) + 1;
      return counts;
    }, {}),
    results,
  };
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${usage()}\n`);
      process.exitCode = 0;
    } else {
      const summary = importLocalMedia(options);
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      if ((summary.counts.failed || 0) > 0 || (summary.counts.held || 0) > 0) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    process.stderr.write(`Import failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildRecord,
  importLocalMedia,
  parseArguments,
  stableContentId,
};
