'use strict';

function configured(env, required) {
  return required.every((name) => String(env[name] || '').trim());
}

function notConfigured(missing) {
  return { status: 'skipped', reason: 'not_configured', missing };
}

function dryRun(platform) {
  return { status: 'dry_run', platform, would_publish: true };
}

function safeError(error) {
  return String(error?.message || error || 'unknown_error')
    .replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .slice(0, 500);
}

async function responseJson(response, context) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = body?.error?.message || body?.error_description || `${response.status}`;
    throw new Error(`${context}: ${detail}`);
  }
  return body || {};
}

async function postForm(fetchImpl, url, fields, context) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
  }
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  return responseJson(response, context);
}

function graphVersion(env) {
  const version = String(env.META_GRAPH_API_VERSION || '').trim();
  if (!/^v\d+\.\d+$/.test(version)) return null;
  return version;
}

function publicMediaUrl(item) {
  const value = String(item?.storage_url || '').trim();
  return /^https:\/\//i.test(value) ? value : null;
}

module.exports = {
  configured,
  dryRun,
  graphVersion,
  notConfigured,
  postForm,
  publicMediaUrl,
  responseJson,
  safeError,
};
