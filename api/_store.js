// Shared helpers for the Match Centre API (files starting with _ are not deployed as endpoints).
// Storage is Upstash Redis over its REST API, added to the Vercel project from Storage > Upstash for Redis.
// Vercel sets KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const KEY_DATA = 'wb:match:data';   // JSON: { v, players: {id: {...}}, weeks: {id: {...}} }
const KEY_V = 'wb:match:v';         // version number, bumped on every change
const KEY_PHOTO = 'wb:match:photo:'; // + player id: a data: URL

function configured() { return Boolean(URL_ && TOKEN); }

async function redis(commands) {
  const res = await fetch(URL_ + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!res.ok) throw new Error('redis ' + res.status);
  const out = await res.json();
  return out.map(r => { if (r.error) throw new Error(r.error); return r.result; });
}

function pinOk(given) {
  const want = process.env.ADMIN_PIN || '';
  if (!want || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

module.exports = { configured, redis, pinOk, send, KEY_DATA, KEY_V, KEY_PHOTO };
