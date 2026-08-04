#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { atomicWriteJson, validateContentRecord } = require('./lib/manifest');

function parseArguments(argv) {
  const options = { all: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--all') options.all = true;
    else if (value === '--content' && argv[index + 1]) options.content = argv[++index];
    else if (value === '--root' && argv[index + 1]) options.rootDir = path.resolve(argv[++index]);
    else throw new Error(`不支援的參數：${value}`);
  }
  if (!options.all && !options.content) throw new Error('請指定 --content CONTENT_ID 或 --all');
  if (options.all && options.content) throw new Error('--content 與 --all 只能選一個');
  return options;
}

function contentFiles(rootDir) {
  const directory = path.join(rootDir, 'content', 'updates');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(directory, entry.name))
    .sort();
}

function approveContent(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const requested = String(options.content || '').replace(/\.json$/i, '');
  const selected = contentFiles(rootDir).filter(file => options.all || path.basename(file, '.json') === requested);
  if (!options.all && selected.length === 0) throw new Error(`找不到內容：${requested}`);
  const now = options.now instanceof Date ? options.now : new Date();
  const results = [];
  for (const file of selected) {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    validateContentRecord(record);
    const current = String(record?.import?.status || '').toLowerCase();
    if (current !== 'draft') {
      results.push({ content_id: record.id, status: 'skipped', reason: `import_${current || 'unknown'}` });
      continue;
    }
    record.import.status = 'published';
    record.import.approved_at = now.toISOString();
    record.updated_at = now.toISOString();
    atomicWriteJson(file, record);
    results.push({ content_id: record.id, status: 'approved' });
  }
  return {
    approved: results.filter(result => result.status === 'approved').length,
    skipped: results.filter(result => result.status === 'skipped').length,
    results,
  };
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(approveContent(parseArguments(process.argv.slice(2))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`內容核准失敗：${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { approveContent, contentFiles, parseArguments };
