'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 250 * 1024 * 1024;

function isPrefix(buffer, bytes) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function ascii(buffer, start, end) {
  return buffer.subarray(start, end).toString('ascii');
}

function detectMedia(buffer, fileSize) {
  if (buffer.length >= 4 && isPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return { type: 'image', mime_type: 'image/jpeg', extension: '.jpg' };
  }
  if (buffer.length >= 8 && isPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { type: 'image', mime_type: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 6 && (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a')) {
    return { type: 'image', mime_type: 'image/gif', extension: '.gif' };
  }
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    return { type: 'image', mime_type: 'image/webp', extension: '.webp' };
  }
  if (buffer.length >= 12 && ascii(buffer, 4, 8) === 'ftyp') {
    const brand = ascii(buffer, 8, 12);
    if (brand === 'qt  ') {
      return { type: 'video', mime_type: 'video/quicktime', extension: '.mov' };
    }
    return { type: 'video', mime_type: 'video/mp4', extension: '.mp4' };
  }
  if (buffer.length >= 4 && isPrefix(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { type: 'video', mime_type: 'video/webm', extension: '.webm' };
  }
  throw new Error(`unsupported or unrecognized media content (${fileSize} bytes)`);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead > 0) hash.update(chunk.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function inspectMedia(filePath, options = {}) {
  const maximumBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error('media path is not a regular file');
  if (stat.size === 0) throw new Error('media file is empty');
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error('maxBytes must be a positive integer');
  }
  if (stat.size > maximumBytes) {
    throw new Error(`media file exceeds ${maximumBytes} byte limit`);
  }

  const descriptor = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(Math.min(64, stat.size));
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  const detected = detectMedia(header, stat.size);
  return {
    ...detected,
    size_bytes: stat.size,
    sha256: sha256File(filePath),
  };
}

function materializeMedia(sourcePath, mediaDirectory, inspection) {
  const details = inspection || inspectMedia(sourcePath);
  fs.mkdirSync(mediaDirectory, { recursive: true });
  const destinationPath = path.join(mediaDirectory, `${details.sha256}${details.extension}`);
  if (fs.existsSync(destinationPath)) {
    if (sha256File(destinationPath) !== details.sha256) {
      throw new Error(`checksum collision at ${destinationPath}`);
    }
    return { path: destinationPath, created: false, details };
  }

  const temporaryPath = path.join(
    mediaDirectory,
    `.${details.sha256}.${process.pid}.${Date.now()}.tmp`,
  );
  let descriptor;
  try {
    fs.copyFileSync(sourcePath, temporaryPath, fs.constants.COPYFILE_EXCL);
    descriptor = fs.openSync(temporaryPath, 'r');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (sha256File(temporaryPath) !== details.sha256) {
      throw new Error(`copied media checksum mismatch for ${sourcePath}`);
    }
    fs.renameSync(temporaryPath, destinationPath);
    return { path: destinationPath, created: true, details };
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  detectMedia,
  inspectMedia,
  materializeMedia,
  sha256File,
};
