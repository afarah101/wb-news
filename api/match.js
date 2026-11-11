// Match Centre API.
//   GET  /api/match?v=N   -> { v, same: true } if nothing changed since version N, else { v, data }
//   POST /api/match       -> admin only (header x-admin-pin). Body: { op, ... }
//        op "login"                         -> checks the PIN
//        op "putWeek"   { week }            -> creates or replaces one match night
//        op "deleteWeek" { id }
//        op "putPlayer" { player, photo }   -> photo: data URL to set, "" to remove, absent to keep
//        op "deletePlayer" { id }
const { configured, redis, pinOk, send, KEY_DATA, KEY_V, KEY_PHOTO } = require('./_store');

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const STATUSES = ['upcoming', 'live', 'ft'];
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

function cleanWeek(w) {
  if (!w || !DATE.test(w.id || '')) throw new Error('Bad date');
  const team = (t, name, color) => ({
    name: str(t && t.name, 24) || name,
    color: COLOR.test((t && t.color) || '') ? t.color : color
  });
  const squad = {}, paid = {};
  for (const [pid, side] of Object.entries(w.squad || {}).slice(0, 60)) if (PID.test(pid) && (side === 'A' || side === 'B')) squad[pid] = side;
  for (const pid of Object.keys(w.paid || {})) if (squad[pid] && w.paid[pid] === true) paid[pid] = true;
  const games = (Array.isArray(w.games) ? w.games : []).slice(0, 12).map(g => ({
    a: int(g && g.a, 0, 99), b: int(g && g.b, 0, 99),
    status: STATUSES.includes(g && g.status) ? g.status : 'upcoming'
  }));
  return {
    id: w.id,
    fee: Math.min(100, Math.max(0, Math.round((Number(w.fee) || 0) * 100) / 100)),
    teams: { A: team(w.teams && w.teams.A, 'Bibs', '#F26B1D'), B: team(w.teams && w.teams.B, 'Shirts', '#2B63D9') },
    squad, paid, games,
    updatedAt: Date.now()
  };
}

async function load() {
  const [raw] = await redis([['GET', KEY_DATA]]);
  const data = raw ? JSON.parse(raw) : null;
  return data && typeof data === 'object' ? data : { v: 0, players: {}, weeks: {} };
}

async function save(data, extra) {
  data.v = (Number(data.v) || 0) + 1;
  await redis([['SET', KEY_DATA, JSON.stringify(data)], ['SET', KEY_V, String(data.v)], ...(extra || [])]);
  return data;
}

module.exports = async (req, res) => {
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  try {
    if (req.method === 'GET') {
      const since = Number(req.query.v);
      if (since) {
        const [v] = await redis([['GET', KEY_V]]);
        if (Number(v) === since) return send(res, 200, { v: since, same: true });
      }
      const data = await load();
      return send(res, 200, { v: data.v, data });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!pinOk(req.headers['x-admin-pin'])) {
      await new Promise(r => setTimeout(r, 600)); // slows down guessing
      return send(res, 401, { error: 'wrong_pin' });
    }
    if (body.op === 'login') return send(res, 200, { ok: true });

    const data = await load();
    data.players = data.players || {};
    data.weeks = data.weeks || {};
    const extra = [];

    if (body.op === 'putWeek') {
      const w = cleanWeek(body.week);
      data.weeks[w.id] = w;
    } else if (body.op === 'deleteWeek') {
      delete data.weeks[String(body.id)];
    } else if (body.op === 'putPlayer') {
      const p = body.player || {};
      const name = str(p.name, 40);
      if (!name) return send(res, 400, { error: 'Name is required' });
      let id = p.id && data.players[p.id] ? p.id : 'x-' + Math.random().toString(36).slice(2, 10);
      const old = data.players[id] || {};
      const next = { name, nickname: str(p.nickname, 24), createdAt: old.createdAt || Date.now(), photoV: old.photoV || 0 };
      if (typeof body.photo === 'string') {
        if (body.photo === '') { next.photoV = 0; extra.push(['DEL', KEY_PHOTO + id]); }
        else if (PHOTO.test(body.photo) && body.photo.length < 400000) { next.photoV = Date.now(); extra.push(['SET', KEY_PHOTO + id, body.photo]); }
        else return send(res, 400, { error: 'That photo could not be used' });
      }
      data.players[id] = next;
    } else if (body.op === 'deletePlayer') {
      const id = String(body.id);
      delete data.players[id];
      extra.push(['DEL', KEY_PHOTO + id]);
    } else {
      return send(res, 400, { error: 'Unknown op' });
    }

    const saved = await save(data, extra);
    return send(res, 200, { v: saved.v, data: saved });
  } catch (e) {
    return send(res, e.message === 'Bad date' ? 400 : 500, { error: e.message === 'Bad date' ? 'Bad date' : 'server' });
  }
};
