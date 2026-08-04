'use strict';

const SUPPORTED_PLATFORMS = Object.freeze([
  'facebook',
  'instagram',
  'threads',
  'youtube',
]);

const FINAL_STATUSES = new Set(['published', 'source']);
const VALID_STATUSES = new Set([
  'pending',
  'published',
  'source',
  'skipped',
  'failed',
  'held',
]);

function sourcePlatform(record) {
  return String(record?.source?.platform || '').trim().toLowerCase();
}

function mediaType(item) {
  const explicit = String(item?.type || '').trim().toLowerCase();
  if (explicit === 'image' || explicit === 'photo') return 'image';
  if (explicit === 'video') return 'video';

  const mime = String(item?.mime_type || item?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'unknown';
}

function mediaItems(record) {
  return Array.isArray(record?.media) ? record.media : [];
}

function hasMediaType(record, expected) {
  return mediaItems(record).some((item) => mediaType(item) === expected);
}

function isSharedFacebookPost(record) {
  return sourcePlatform(record) === 'facebook' && (
    record?.source?.is_shared === true ||
    record?.source?.is_own_post === false ||
    record?.source?.status_type === 'shared_story'
  );
}

function validateContent(record) {
  const reasons = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { eligible: false, status: 'held', reasons: ['invalid_record'] };
  }
  if (!String(record.id || '').trim()) reasons.push('missing_content_id');
  if (!sourcePlatform(record)) reasons.push('missing_source_platform');
  if (isSharedFacebookPost(record)) reasons.push('shared_facebook_post');

  const items = mediaItems(record);
  if (items.length === 0) reasons.push('missing_media');
  if (items.some((item) => mediaType(item) === 'unknown')) {
    reasons.push('unsupported_media_type');
  }

  return {
    eligible: reasons.length === 0,
    status: reasons.length === 0 ? 'eligible' : 'held',
    reasons,
  };
}

function currentPlatformState(record, platform) {
  const raw = record?.publishing?.[platform];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'pending' };
  }

  const status = VALID_STATUSES.has(raw.status) ? raw.status : 'pending';
  return { ...raw, status };
}

function platformDisposition(record, platform, options = {}) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return { action: 'hold', status: 'held', reason: 'unsupported_platform' };
  }

  // Never downgrade a platform that already has a durable remote identifier,
  // even when an unrelated field in the local record is later malformed.
  const current = currentPlatformState(record, platform);
  if (FINAL_STATUSES.has(current.status)) {
    return { action: 'none', status: current.status, reason: 'already_complete' };
  }
  if (current.status === 'held') {
    return { action: 'none', status: 'held', reason: current.reason || 'held' };
  }

  const validation = validateContent(record);
  if (!validation.eligible) {
    return {
      action: 'hold',
      status: 'held',
      reason: validation.reasons.join(','),
    };
  }

  if (platform === 'facebook' && sourcePlatform(record) === 'facebook') {
    return { action: 'record', status: 'source', reason: 'facebook_is_source' };
  }

  if (platform === 'youtube' && !hasMediaType(record, 'video')) {
    return { action: 'record', status: 'skipped', reason: 'no_video' };
  }

  if (current.status === 'skipped' && current.reason !== 'not_configured') {
    return { action: 'none', status: 'skipped', reason: current.reason || 'not_applicable' };
  }
  if (current.status === 'failed' && options.retryFailed !== true) {
    return { action: 'none', status: 'failed', reason: 'retry_not_requested' };
  }

  return { action: 'publish', status: 'pending' };
}

module.exports = {
  SUPPORTED_PLATFORMS,
  VALID_STATUSES,
  currentPlatformState,
  hasMediaType,
  isSharedFacebookPost,
  mediaItems,
  mediaType,
  platformDisposition,
  sourcePlatform,
  validateContent,
};
