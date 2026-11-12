// Match Centre API.
//   GET  /api/match?v=N   -> { v, same: true } if nothing changed since version N;
//                            { v, delta: { weeks, players, formers } } with just the nights changed since N;
//                            or { v, data } (everything) the first time, or after a night is deleted or a backup restored.
//   POST /api/match       -> admin only (header x-admin-pin). Body: { op, ... }
//        op "login"                          -> checks the PIN
//        op "apply"     { ops: [...], since } -> small changes (see match/ops.js), applied to the latest data in order.
//                                               Each has an id; one already applied is skipped, so retries are safe.
//                                               Returns { v, results: [{ id, ok, why }], delta|data }.
//        op "deleteWeek" { id }
//        op "putPlayer" { player, photo }    -> photo: data URL to set, "" to remove, absent to keep
//        op "deletePlayer" { id }            -> their name is kept (formers) so their goals still show
//        op "backups"                        -> the saved versions you can go back to
//        op "restore"   { i }                -> go back to one of them (the current state is saved first, so it can be undone)
//        op "putWeek"   { week }             -> replaces a whole night (only for pages opened before this version)
//
// Saving is check-and-set: the save only goes through if nobody else saved in between; otherwise the changes are
// worked out again on the newer data. A copy of the data is kept every 10 minutes and before anything is deleted,
// up to 60 copies. Ten wrong PINs from one address locks it out for 15 minutes.
const { configured, redis, pinOk, send, KEY_DATA, KEY_V, KEY_PHOTO } = require('./_store');
const Ops = require('../match/ops.js');

const KEY_HIST = 'wb:match:hist';      // list of earlier copies of the data, newest first
const KEY_HISTMETA = 'wb:match:histmeta'; // matching list of { v, at, what }
const KEY_SNAPAT = 'wb:match:snapat';  // when the last copy was kept
const KEY_FAIL = 'wb:match:fail:';     // + address: wrong PINs in the last 15 minutes
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const SNAP_EVERY = 10 * 60 * 1000, KEEP = 60, MAX_FAILS = 10, FAIL_WINDOW = 15 * 60, KEEP_DONE = 500;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Save only if the version is still the one we read. Optionally keep a copy of what was there first.
const CAS = `
local cur = redis.call('GET', KEYS[2]) or '0'
if cur ~= ARGV[1] then return 0 end
if ARGV[4] == '1' then
  local old = redis.call('GET', KEYS[1])
  if old then
    redis.call('LPUSH', KEYS[3], old); redis.call('LPUSH', KEYS[4], ARGV[5])
    redis.call('LTRIM', KEYS[3], 0, ${KEEP - 1}); redis.call('LTRIM', KEYS[4], 0, ${KEEP - 1})
  end
  redis.call('SET', KEYS[5], ARGV[6])
end
redis.call('SET', KEYS[1], ARGV[2]); redis.call('SET', KEYS[2], ARGV[3])
return 1`;

function parse(raw) {
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!data || typeof data !== 'object') data = { v: 0 };
  data.v = Number(data.v) || 0;
  data.players = data.players || {};
  data.formers = data.formers || {};
  data.weeks = data.weeks || {};
  data.wv = data.wv || {};
  for (const id of Object.keys(data.weeks)) Ops.normalizeWeek(data.weeks[id], id);
  return data;
}

// Read, change, save, and start again if someone else saved in between.
async function mutate(change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const [raw, v, snapAt] = await redis([['GET', KEY_DATA], ['GET', KEY_V], ['GET', KEY_SNAPAT]]);
    const data = parse(raw);
    const oldV = String(v == null ? (raw ? data.v : 0) : v);
    data.v = Number(oldV) || data.v;
    const out = change(data);
    if (out.error) return out;
    if (!out.changed) return { data, out };
    const newV = data.v + 1;
    for (const id of out.touched || []) if (data.weeks[id]) { data.weeks[id] = Ops.cleanWeek(data.weeks[id]); data.wv[id] = newV; }
    if (out.full) data.fullV = newV;
    data.v = newV;
    data.savedAt = Date.now();
    const snap = out.snapshot || Date.now() - (Number(snapAt) || 0) >= SNAP_EVERY;
    const meta = JSON.stringify({ v: Number(oldV), at: Date.now(), what: out.label || '' });
    const [ok] = await redis([['EVAL', CAS, '5', KEY_DATA, KEY_V, KEY_HIST, KEY_HISTMETA, KEY_SNAPAT,
      oldV, JSON.stringify(data), String(newV), snap ? '1' : '0', meta, String(Date.now())]]);
    if (Number(ok) === 1) {
      if (out.extra && out.extra.length) await redis(out.extra);
      return { data, out };
    }
    await new Promise(r => setTimeout(r, 30 + Math.random() * 120));
  }
  return { error: 'busy' };
}

// What a page that already has version `since` needs.
function payload(data, since) {
  since = Number(since) || 0;
  if (!since || since > data.v || since < (Number(data.fullV) || 0)) return { v: data.v, data };
  const weeks = {};
  for (const id of Object.keys(data.weeks)) if ((Number(data.wv[id]) || 0) > since) weeks[id] = data.weeks[id];
  return { v: data.v, delta: { weeks, players: data.players, formers: data.formers } };
}

function label(op, data) {
  const when = op.wid || op.id || '';
  const names = { createWeek: 'New night', setNight: 'Night settings', setSquad: 'Team change', setPaid: 'Subs', endNight: 'Ended the night',
    addGame: 'Added a game', removeGame: 'Removed a game', setStatus: 'Game status', addGoal: 'Goal', creditGoal: 'Scorer added',
    editGoal: 'Goal edited', deleteGoal: 'Goal deleted', popGoal: 'Goal taken off' };
  return (names[op.t] || op.t || 'Change') + (when ? ' (' + when + ')' : '');
}

function ip(req) { return str(String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'x', 64); }

module.exports = async (req, res) => {
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  try {
    if (req.method === 'GET') {
      const since = Number(req.query.v);
      if (since) {
        const [v] = await redis([['GET', KEY_V]]);
        if (Number(v) === since) return send(res, 200, { v: since, same: true });
      }
      const [raw] = await redis([['GET', KEY_DATA]]);
      return send(res, 200, payload(parse(raw), since));
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Wrong PINs: ten from one address in 15 minutes locks it out for the rest of that time.
    const failKey = KEY_FAIL + ip(req);
    const [fails] = await redis([['GET', failKey]]);
    if (Number(fails) >= MAX_FAILS) return send(res, 429, { error: 'Too many wrong PINs. Try again in 15 minutes.' });
    if (!pinOk(req.headers['x-admin-pin'])) {
      await redis([['INCR', failKey], ['EXPIRE', failKey, String(FAIL_WINDOW)]]);
      await new Promise(r => setTimeout(r, 600));
      return send(res, 401, { error: 'wrong_pin' });
    }
    if (Number(fails)) await redis([['DEL', failKey]]);
    if (body.op === 'login') return send(res, 200, { ok: true });

    if (body.op === 'backups') {
      const list = await redis([['LRANGE', KEY_HISTMETA, '0', String(KEEP - 1)]]);
      return send(res, 200, { backups: (list[0] || []).map((m, i) => { try { return Object.assign({ i }, JSON.parse(m)); } catch (e) { return { i }; } }) });
    }

    let result;
    if (body.op === 'apply') {
      const ops = (Array.isArray(body.ops) ? body.ops : []).slice(0, 50);
      let results;
      result = await mutate(data => {
        const done = new Set(Array.isArray(data.done) ? data.done : []);
        const touched = new Set();
        results = ops.map(op => {
          const id = str(op && op.id, 40);
          if (!id) return { id, ok: false, why: 'bad' };
          if (done.has(id)) return { id, ok: true, dup: true };
          let r;
          try { r = Ops.apply(data, op); } catch (e) { r = { ok: false, why: 'bad' }; }
          done.add(id);
          if (r.ok) touched.add(String(op.wid));
          return { id, ok: !!r.ok, why: r.why };
        });
        const fresh = results.filter(r => !r.dup);
        if (!fresh.length) return { changed: false };
        data.done = Array.from(done).slice(-KEEP_DONE);
        const first = ops.find((op, i) => results[i].ok && !results[i].dup);
        return { changed: true, touched: Array.from(touched), label: first ? label(first, data) : 'Change',
          snapshot: ops.some((op, i) => results[i].ok && (op.t === 'removeGame' || op.t === 'endNight')) };
      });
      if (result.error) return send(res, 503, { error: 'busy' });
      return send(res, 200, Object.assign({ results }, payload(result.data, body.since)));
    }

    if (body.op === 'restore') {
      const [raw] = await redis([['LINDEX', KEY_HIST, String(Math.max(0, Number(body.i) || 0))]]);
      if (!raw) return send(res, 400, { error: 'That backup has gone' });
      const old = parse(raw);
      result = await mutate(data => {
        data.weeks = old.weeks; data.players = old.players; data.formers = old.formers;
        data.wv = {};
        return { changed: true, full: true, snapshot: true, touched: Object.keys(data.weeks), label: 'Went back to the version from v' + old.v };
      });
    } else result = await mutate(data => {
      if (body.op === 'putWeek') { // pages opened before this version still send whole nights
        const w = Ops.cleanWeek(body.week);
        data.weeks[w.id] = w;
        return { changed: true, touched: [w.id], label: 'Night saved (' + w.id + ')' };
      }
      if (body.op === 'deleteWeek') {
        const id = String(body.id);
        if (!data.weeks[id]) return { changed: false };
        delete data.weeks[id]; delete data.wv[id];
        return { changed: true, full: true, snapshot: true, label: 'Deleted night ' + id };
      }
      if (body.op === 'putPlayer') {
        const p = body.player || {};
        const name = str(p.name, 40);
        if (!name) return { error: 'Name is required' };
        const id = p.id && data.players[p.id] ? p.id : 'x-' + Math.random().toString(36).slice(2, 10);
        const old = data.players[id] || {};
        const next = { name, nickname: str(p.nickname, 24), createdAt: old.createdAt || Date.now(), photoV: old.photoV || 0 };
        const extra = [];
        if (typeof body.photo === 'string') {
          if (body.photo === '') { next.photoV = 0; extra.push(['DEL', KEY_PHOTO + id]); }
          else if (PHOTO.test(body.photo) && body.photo.length < 400000) { next.photoV = Date.now(); extra.push(['SET', KEY_PHOTO + id, body.photo]); }
          else return { error: 'That photo could not be used' };
        }
        data.players[id] = next;
        delete data.formers[id];
        return { changed: true, extra, label: (old.name ? 'Edited ' : 'Added ') + name };
      }
      if (body.op === 'deletePlayer') {
        const id = String(body.id);
        const p = data.players[id];
        if (!p) return { changed: false };
        data.formers[id] = { name: p.name, nickname: p.nickname || '' };
        delete data.players[id];
        return { changed: true, snapshot: true, extra: [['DEL', KEY_PHOTO + id]], label: 'Deleted player ' + (p.nickname || p.name) };
      }
      return { error: 'Unknown op' };
    });
    if (result.error === 'busy') return send(res, 503, { error: 'busy' });
    if (result.error) return send(res, 400, { error: result.error });
    return send(res, 200, { v: result.data.v, data: result.data });
  } catch (e) {
    return send(res, e.message === 'Bad date' ? 400 : 500, { error: e.message === 'Bad date' ? 'Bad date' : 'server' });
  }
};
