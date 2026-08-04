'use strict';

const fs = require('node:fs/promises');
const { mediaItems, mediaType } = require('../content-policy');
const { configured, dryRun, notConfigured, responseJson } = require('./base');

const REQUIRED = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];

function isConfigured(env = process.env) {
  return configured(env, REQUIRED);
}

function buildVideoMetadata(record, copy) {
  return {
    snippet: {
      title: copy?.youtube?.title || record?.content?.title || '佳旺景觀園藝影片紀錄',
      description: copy?.youtube?.description || record?.content?.summary || record?.source?.original_text || '',
    },
    status: {
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
  };
}

async function accessToken(fetchImpl, env) {
  const body = new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID,
    client_secret: env.YOUTUBE_CLIENT_SECRET,
    refresh_token: env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  return (await responseJson(response, 'youtube_token_refresh_failed')).access_token;
}

async function loadVideo(fetchImpl, media) {
  if (media.local_path) return fs.readFile(media.local_path);
  const url = String(media.storage_url || '');
  if (!/^https:\/\//i.test(url)) throw new Error('youtube_media_not_available');
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`youtube_media_download_failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function processingState(fetchImpl, token, videoId) {
  const response = await fetchImpl(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${encodeURIComponent(videoId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await responseJson(response, 'youtube_status_failed');
  return body?.items?.[0]?.status?.uploadStatus || 'uploaded';
}

async function uploadBytes(fetchImpl, uploadUrl, bytes, mime, startAt = 0) {
  const remaining = bytes.subarray(startAt);
  const response = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-length': String(remaining.length),
      'content-range': `bytes ${startAt}-${bytes.length - 1}/${bytes.length}`,
      'content-type': mime,
    },
    body: remaining,
  });
  return responseJson(response, 'youtube_upload_failed');
}

async function resumeUpload(fetchImpl, uploadUrl, bytes, mime) {
  const probe = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-length': '0',
      'content-range': `bytes */${bytes.length}`,
    },
  });
  if (probe.ok) return responseJson(probe, 'youtube_upload_probe_failed');
  if (probe.status === 308) {
    const match = String(probe.headers.get('range') || '').match(/bytes=0-(\d+)/i);
    const nextByte = match ? Number(match[1]) + 1 : 0;
    if (nextByte >= bytes.length) throw new Error('youtube_upload_complete_without_video_id');
    return uploadBytes(fetchImpl, uploadUrl, bytes, mime, nextByte);
  }
  if (probe.status === 404 || probe.status === 410) {
    throw new Error('youtube_upload_session_expired_manual_check_required');
  }
  return responseJson(probe, 'youtube_upload_probe_failed');
}

async function publish(record, context = {}) {
  const env = context.env || process.env;
  const video = mediaItems(record).find((item) => mediaType(item) === 'video');
  if (!video) return { status: 'skipped', reason: 'no_video' };
  if (!isConfigured(env)) return notConfigured(REQUIRED.filter((name) => !env[name]));
  if (context.dryRun || context.allowLive !== true) return dryRun('youtube');

  const fetchImpl = context.fetchImpl || globalThis.fetch;
  const bytes = await loadVideo(fetchImpl, video);
  const mime = video.mime_type || video.mimeType || 'video/mp4';
  const token = await accessToken(fetchImpl, env);
  const existingVideoId = record?.publishing?.youtube?.post_id || record?.publishing?.youtube?.video_id;
  if (existingVideoId) {
    const state = await processingState(fetchImpl, token, existingVideoId);
    if (state === 'processed') return { status: 'published', post_id: existingVideoId, privacy: 'private' };
    if (state === 'failed' || state === 'rejected') {
      return { status: 'failed', reason: `youtube_processing_${state}`, post_id: existingVideoId };
    }
    return { status: 'pending', reason: 'youtube_processing', post_id: existingVideoId, privacy: 'private' };
  }

  const metadata = buildVideoMetadata(record, context.copy);
  const start = await fetchImpl('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(bytes.length),
      'x-upload-content-type': mime,
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) await responseJson(start, 'youtube_upload_session_failed');
  const uploadUrl = start.headers.get('location');
  if (!uploadUrl) throw new Error('youtube_upload_session_missing');
  // The resumable upload URL is a capability secret. Keep it only in memory;
  // the public content repository must never persist or commit it.

  const result = await uploadBytes(fetchImpl, uploadUrl, bytes, mime);
  const videoId = result.id;
  if (!videoId) throw new Error('youtube_upload_missing_video_id');
  const state = await processingState(fetchImpl, token, videoId);
  if (state === 'processed') return { status: 'published', post_id: videoId, privacy: 'private' };
  return { status: 'pending', reason: 'youtube_processing', post_id: videoId, privacy: 'private' };
}

module.exports = { buildVideoMetadata, isConfigured, publish, resumeUpload, uploadBytes };
