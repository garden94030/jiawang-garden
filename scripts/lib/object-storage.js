'use strict';

const fs = require('node:fs');
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const REQUIRED_STORAGE_ENV = [
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY_ID',
  'OBJECT_STORAGE_SECRET_ACCESS_KEY',
  'OBJECT_STORAGE_PUBLIC_BASE_URL',
];

function objectStorageConfig(env = process.env) {
  const missing = REQUIRED_STORAGE_ENV.filter(name => !String(env[name] || '').trim());
  const endpoint = String(env.OBJECT_STORAGE_ENDPOINT || '').trim();
  const publicBaseUrl = String(env.OBJECT_STORAGE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (endpoint && !/^https:\/\//i.test(endpoint)) missing.push('OBJECT_STORAGE_ENDPOINT_HTTPS');
  if (publicBaseUrl && !/^https:\/\//i.test(publicBaseUrl)) missing.push('OBJECT_STORAGE_PUBLIC_BASE_URL_HTTPS');
  return {
    configured: missing.length === 0,
    missing: [...new Set(missing)],
    endpoint,
    region: String(env.OBJECT_STORAGE_REGION || 'auto').trim() || 'auto',
    bucket: String(env.OBJECT_STORAGE_BUCKET || '').trim(),
    accessKeyId: String(env.OBJECT_STORAGE_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(env.OBJECT_STORAGE_SECRET_ACCESS_KEY || '').trim(),
    publicBaseUrl,
  };
}

function createObjectStorageClient(config) {
  if (!config.configured) throw new Error(`object_storage_not_configured: ${config.missing.join(',')}`);
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function publicObjectUrl(config, key) {
  return `${config.publicBaseUrl}/${String(key).split('/').map(encodeURIComponent).join('/')}`;
}

function notFound(error) {
  return error?.name === 'NotFound'
    || error?.name === 'NoSuchKey'
    || error?.$metadata?.httpStatusCode === 404;
}

async function uploadMediaObject(filePath, inspection, options = {}) {
  const config = options.config || objectStorageConfig(options.env || process.env);
  if (!config.configured) {
    return { status: 'held', reason: 'object_storage_not_configured', missing: config.missing };
  }
  const client = options.client || createObjectStorageClient(config);
  const key = `media/${inspection.sha256}${inspection.extension}`;
  try {
    const existing = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    const storedHash = existing?.Metadata?.sha256;
    if (storedHash && storedHash !== inspection.sha256) {
      throw new Error(`object_storage_checksum_collision: ${key}`);
    }
    if (storedHash === inspection.sha256) {
      return {
        status: 'stored',
        created: false,
        key,
        url: publicObjectUrl(config, key),
      };
    }
  } catch (error) {
    if (!notFound(error)) throw error;
  }

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: inspection.mime_type,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { sha256: inspection.sha256 },
  }));
  return {
    status: 'stored',
    created: true,
    key,
    url: publicObjectUrl(config, key),
  };
}

module.exports = {
  REQUIRED_STORAGE_ENV,
  createObjectStorageClient,
  objectStorageConfig,
  publicObjectUrl,
  uploadMediaObject,
};
