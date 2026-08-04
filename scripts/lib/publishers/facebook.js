'use strict';

const { mediaItems, mediaType, sourcePlatform } = require('../content-policy');
const { configured, dryRun, graphVersion, notConfigured, postForm, publicMediaUrl } = require('./base');

const REQUIRED = ['META_GRAPH_API_VERSION', 'FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'];

function isConfigured(env = process.env) {
  return configured(env, REQUIRED) && Boolean(graphVersion(env));
}

async function publish(record, context = {}) {
  const env = context.env || process.env;
  if (sourcePlatform(record) === 'facebook') {
    return {
      status: 'source',
      post_id: record?.source?.post_id || null,
      url: record?.source?.permalink || null,
      reason: 'facebook_is_source',
    };
  }
  if (!isConfigured(env)) return notConfigured(REQUIRED.filter((name) => !env[name]));
  if (context.dryRun || context.allowLive !== true) return dryRun('facebook');

  const items = mediaItems(record);
  const usable = items.map((item) => ({ item, type: mediaType(item), url: publicMediaUrl(item) }));
  if (usable.some(({ url }) => !url)) return { status: 'held', reason: 'media_not_in_durable_public_storage' };

  const fetchImpl = context.fetchImpl || globalThis.fetch;
  const root = `https://graph.facebook.com/${graphVersion(env)}`;
  const pageId = env.FACEBOOK_PAGE_ID;
  const token = env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const message = context.copy?.facebook || record?.source?.original_text || '';

  if (usable.length === 1 && usable[0].type === 'image') {
    const result = await postForm(fetchImpl, `${root}/${pageId}/photos`, {
      url: usable[0].url,
      caption: message,
      access_token: token,
    }, 'facebook_photo_publish_failed');
    return { status: 'published', post_id: result.post_id || result.id, media_id: result.id };
  }

  if (usable.length === 1 && usable[0].type === 'video') {
    const result = await postForm(fetchImpl, `${root}/${pageId}/videos`, {
      file_url: usable[0].url,
      description: message,
      access_token: token,
    }, 'facebook_video_publish_failed');
    return { status: 'published', post_id: result.id };
  }

  if (usable.some(({ type }) => type !== 'image')) {
    return { status: 'held', reason: 'facebook_mixed_or_multiple_video_not_supported' };
  }

  const attached = [];
  for (const media of usable) {
    const uploaded = await postForm(fetchImpl, `${root}/${pageId}/photos`, {
      url: media.url,
      published: 'false',
      access_token: token,
    }, 'facebook_unpublished_photo_failed');
    attached.push({ media_fbid: uploaded.id });
  }
  const result = await postForm(fetchImpl, `${root}/${pageId}/feed`, {
    message,
    attached_media: JSON.stringify(attached),
    access_token: token,
  }, 'facebook_album_publish_failed');
  return { status: 'published', post_id: result.id };
}

module.exports = { isConfigured, publish };
