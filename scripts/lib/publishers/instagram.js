'use strict';

const { mediaItems, mediaType } = require('../content-policy');
const { configured, dryRun, graphVersion, notConfigured, postForm, publicMediaUrl } = require('./base');

const REQUIRED = ['META_GRAPH_API_VERSION', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN'];

function isConfigured(env = process.env) {
  return configured(env, REQUIRED) && Boolean(graphVersion(env));
}

async function createContainer(fetchImpl, root, accountId, token, media, extra = {}) {
  const type = mediaType(media.item);
  const fields = {
    access_token: token,
    is_carousel_item: extra.isCarouselItem ? 'true' : undefined,
  };
  if (type === 'image') fields.image_url = media.url;
  if (type === 'video') {
    fields.video_url = media.url;
    fields.media_type = extra.isCarouselItem ? 'VIDEO' : 'REELS';
  }
  if (extra.caption) fields.caption = extra.caption;
  return postForm(fetchImpl, `${root}/${accountId}/media`, fields, 'instagram_container_failed');
}

async function publish(record, context = {}) {
  const env = context.env || process.env;
  if (!isConfigured(env)) return notConfigured(REQUIRED.filter((name) => !env[name]));
  if (context.dryRun || context.allowLive !== true) return dryRun('instagram');

  const usable = mediaItems(record).map((item) => ({ item, url: publicMediaUrl(item) }));
  if (usable.some(({ url }) => !url)) return { status: 'held', reason: 'media_not_in_durable_public_storage' };

  const fetchImpl = context.fetchImpl || globalThis.fetch;
  const root = `https://graph.facebook.com/${graphVersion(env)}`;
  const accountId = env.INSTAGRAM_ACCOUNT_ID;
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const caption = context.copy?.instagram || record?.source?.original_text || '';
  let creationId;

  if (usable.length === 1) {
    creationId = (await createContainer(fetchImpl, root, accountId, token, usable[0], { caption })).id;
  } else {
    const children = [];
    for (const media of usable.slice(0, 10)) {
      children.push((await createContainer(fetchImpl, root, accountId, token, media, { isCarouselItem: true })).id);
    }
    const parent = await postForm(fetchImpl, `${root}/${accountId}/media`, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption,
      access_token: token,
    }, 'instagram_carousel_failed');
    creationId = parent.id;
  }

  const result = await postForm(fetchImpl, `${root}/${accountId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  }, 'instagram_publish_failed');
  return { status: 'published', post_id: result.id, creation_id: creationId };
}

module.exports = { isConfigured, publish };
