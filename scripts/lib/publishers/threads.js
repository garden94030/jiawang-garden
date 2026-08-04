'use strict';

const { mediaItems, mediaType } = require('../content-policy');
const { configured, dryRun, graphVersion, notConfigured, postForm, publicMediaUrl } = require('./base');

const REQUIRED = ['META_GRAPH_API_VERSION', 'THREADS_USER_ID', 'THREADS_ACCESS_TOKEN'];

function isConfigured(env = process.env) {
  return configured(env, REQUIRED) && Boolean(graphVersion(env));
}

async function publish(record, context = {}) {
  const env = context.env || process.env;
  if (!isConfigured(env)) return notConfigured(REQUIRED.filter((name) => !env[name]));
  if (context.dryRun || context.allowLive !== true) return dryRun('threads');

  const representative = mediaItems(record)[0];
  const url = representative ? publicMediaUrl(representative) : null;
  if (representative && !url) return { status: 'held', reason: 'media_not_in_durable_public_storage' };

  const fetchImpl = context.fetchImpl || globalThis.fetch;
  const root = `https://graph.threads.net/${graphVersion(env)}`;
  const userId = env.THREADS_USER_ID;
  const token = env.THREADS_ACCESS_TOKEN;
  const type = representative ? mediaType(representative) : 'text';
  const fields = {
    media_type: type === 'image' ? 'IMAGE' : type === 'video' ? 'VIDEO' : 'TEXT',
    text: context.copy?.threads || record?.source?.original_text || '',
    image_url: type === 'image' ? url : undefined,
    video_url: type === 'video' ? url : undefined,
    access_token: token,
  };

  const container = await postForm(fetchImpl, `${root}/${userId}/threads`, fields, 'threads_container_failed');
  const result = await postForm(fetchImpl, `${root}/${userId}/threads_publish`, {
    creation_id: container.id,
    access_token: token,
  }, 'threads_publish_failed');
  return { status: 'published', post_id: result.id, creation_id: container.id };
}

module.exports = { isConfigured, publish };
