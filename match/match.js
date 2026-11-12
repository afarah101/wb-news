/* Match Centre: match nights (two teams), live scores, the table, payments and player profiles.
   Squad players come from data/players.json. Everything else comes from /api/match, which keeps one JSON document:
   { v, players: {id: {name, nickname, photoV}}, weeks: {"YYYY-MM-DD": {fee, teams, squad, paid, games}} }.
   A night also has target (first to N goals, default 3). Each game is {a, b, status, goals}; goals lists every goal with the team, the scorer ('og' for an own goal) and the assist.
   Everyone can read; changes need the admin PIN (the ADMIN_PIN setting in Vercel).
   Viewers poll for changes: every 3 s while a game is live, every 15 s otherwise, never while the tab is hidden. */
(function () {
  'use strict';
  var root = new URL('..', document.currentScript.src); // site root: this file lives in /match/
  var API = new URL('api/match', root).href;
  var PLACEHOLDER = new URL('assets/squad/placeholder.svg', root).href;
  var DEF_TEAMS = { A: { name: 'Bibs', color: '#F26B1D' }, B: { name: 'Non Bibs', color: '#2B63D9' } };
  var PIN_KEY = 'wb-match-pin';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var okColor = function (c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : null; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var money = function (n) { return '£' + (Number.isInteger(n) ? n : n.toFixed(2)); };

  var S = {
    state: 'loading', v: 0, data: { players: {}, weeks: {} }, squad: [],
    players: new Map(), weeks: [], stats: {},
    pin: null, admin: false, offline: false,
    view: 'tonight', weekId: null, gameIdx: null, picking: false, pickQuery: ''
  };
  try { S.pin = localStorage.getItem(PIN_KEY); S.admin = !!S.pin; } catch (e) {}

  /* ---------- helpers ---------- */
  function isoLocal(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function nextThursday() { var t = new Date(); t.setDate(t.getDate() + ((4 - t.getDay() + 7) % 7)); return isoLocal(t); }
  function fmtDate(id, long) {
    var p = String(id).split('-').map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return dt.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  function teamOf(w, side) {
    var t = (w.teams && w.teams[side]) || {};
    var nm = String(t.name || DEF_TEAMS[side].name).slice(0, 24);
    if (nm === 'Shirts') nm = DEF_TEAMS.B.name; // the old default name for team 2
    return { name: nm, color: okColor(t.color) || DEF_TEAMS[side].color };
  }
  function pName(p) { return p ? (p.nickname || p.name || 'Player') : 'Former player'; }
  function initials(p) { var n = (p && (p.nickname || p.name)) || '?'; return n.trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase(); }
  function avatar(p, cls) {
    return p && p.photo
      ? '<img class="av ' + cls + '" src="' + esc(p.photo) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + PLACEHOLDER + '\'">'
      : '<span class="av ' + cls + '" aria-hidden="true">' + esc(initials(p)) + '</span>';
  }
  function byName(a, b) { return pName(a).localeCompare(pName(b)); }
  function games(w) { return Array.isArray(w.games) ? w.games : []; }
  function currentWeek() { return S.weeks.find(function (w) { return w.id === S.weekId; }) || S.weeks[0] || null; }
  function gameIndex(w) {
    var gs = games(w), i = S.gameIdx;
    if (i == null || i >= gs.length) { i = gs.findIndex(function (g) { return g.status === 'live'; }); if (i < 0) i = gs.length - 1; }
    return i;
  }
  /* Goals: game.goals = [{ s: 'A'|'B', by: player id | 'og' | '', as: player id | '' }].
     Games scored before goals were recorded only have a number, so the gap shows as goals still to credit (idx -1). */
  function goalList(g) {
    var gl = (Array.isArray(g.goals) ? g.goals : []).map(function (x, i) { return { s: x.s === 'B' ? 'B' : 'A', by: x.by || '', as: x.as || '', idx: i }; });
    ['A', 'B'].forEach(function (s) {
      var extra = (+g[s === 'A' ? 'a' : 'b'] || 0) - gl.filter(function (x) { return x.s === s; }).length;
      for (var k = 0; k < extra; k++) gl.push({ s: s, by: '', as: '', idx: -1 });
    });
    return gl;
  }
  /* First to N: when a team reaches the night's target the game ends and the next one kicks off by itself. 0 = play on until Full time. */
  var MAX_GAMES = 30;
  function targetOf(w) { return w.target == null ? 3 : Math.max(0, Math.min(20, Math.round(+w.target) || 0)); }
  function maybeWin(x, gi) { // after a new goal: returns the new game's index, or -1
    var g = x.games[gi], t = targetOf(x);
    if (!t || g.status === 'ft' || Math.max(+g.a || 0, +g.b || 0) < t) return -1;
    g.status = 'ft';
    if (x.games.length >= MAX_GAMES) return -1;
    x.games.push({ a: 0, b: 0, status: 'live', goals: [] });
    return x.games.length - 1;
  }
  function undoWin(x, gi, before) { // after a goal comes off: if that undid the win, reopen the game and drop the empty game that followed it
    var g = x.games[gi], t = targetOf(x);
    if (!t || g.status !== 'ft' || before < t || Math.max(+g.a || 0, +g.b || 0) >= t) return false;
    g.status = 'live';
    var nx = x.games[gi + 1];
    if (nx && gi + 1 === x.games.length - 1 && !(+nx.a) && !(+nx.b) && !(nx.goals || []).length) x.games.splice(gi + 1, 1);
    return true;
  }
  /* The night goes to the team that wins the most games. Only finished games count; a drawn game counts for neither. */
  function nightResult(w) {
    var r = { A: 0, B: 0, played: 0, winner: null, open: false };
    games(w).forEach(function (g) {
      if (g.status !== 'ft') { if (g.status === 'live' && ((+g.a || 0) + (+g.b || 0) > 0)) r.open = true; return; }
      r.played++;
      if ((+g.a || 0) > (+g.b || 0)) r.A++; else if ((+g.b || 0) > (+g.a || 0)) r.B++;
    });
    if (r.played) r.winner = r.A > r.B ? 'A' : r.B > r.A ? 'B' : 'D';
    return r;
  }
  function nightLine(w, nr, verbs) { // "Bibs win the night 3–2 on games"
    var A = teamOf(w, 'A'), B = teamOf(w, 'B');
    if (nr.winner === 'D') return (verbs ? 'Level' : 'Night drawn') + ' at ' + nr.A + '–' + nr.B + ' on games';
    var t = nr.winner === 'A' ? A : B, hi = Math.max(nr.A, nr.B), lo = Math.min(nr.A, nr.B);
    return t.name + (verbs ? ' lead ' : ' win the night ') + hi + '–' + lo + ' on games';
  }
  function scorerName(id) { return id === 'og' ? 'Own goal' : pName(S.players.get(id)); }
  function nightTotals(w) { // { goals: {pid: n}, assists: {pid: n}, open: goals still without a scorer }
    var t = { goals: {}, assists: {}, open: 0 };
    games(w).forEach(function (g) {
      goalList(g).forEach(function (x) {
        if (!x.by) { t.open++; return; }
        if (x.by !== 'og') t.goals[x.by] = (t.goals[x.by] || 0) + 1;
        if (x.as) t.assists[x.as] = (t.assists[x.as] || 0) + 1;
      });
    });
    return t;
  }
  function tally(map) { // "Shamz 2, Mo Bouch 1"
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a] || scorerName(a).localeCompare(scorerName(b)); })
      .map(function (id) { return scorerName(id) + (map[id] > 1 ? ' ' + map[id] : ''); }).join(', ');
  }
  function anyLive() { return S.weeks.some(function (w) { return games(w).some(function (g) { return g.status === 'live'; }); }); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }

  /* ---------- data ---------- */
  function rebuild() {
    var players = new Map();
    S.squad.forEach(function (p) { players.set(p.id, p); });
    Object.keys(S.data.players || {}).forEach(function (id) {
      var p = S.data.players[id];
      players.set(id, { id: id, name: p.name, nickname: p.nickname || '', photo: p.photoV ? new URL('api/photo?id=' + encodeURIComponent(id) + '&v=' + p.photoV, root).href : null, own: true });
    });
    S.players = players;
    S.weeks = Object.keys(S.data.weeks || {}).filter(function (id) { return /^\d{4}-\d{2}-\d{2}$/.test(id); })
      .map(function (id) { var w = S.data.weeks[id]; w.id = id; return w; })
      .sort(function (a, b) { return b.id.localeCompare(a.id); });
    computeStats();
  }

  function computeStats() {
    var st = {};
    S.players.forEach(function (p) { st[p.id] = { p: 0, w: 0, d: 0, l: 0, g: 0, a: 0, nights: 0, owed: 0, unpaid: [], form: [], log: [] }; });
    S.weeks.slice().reverse().forEach(function (w) {
      var fee = +w.fee || 0, tot = nightTotals(w);
      Object.keys(tot.goals).forEach(function (pid) { if (st[pid]) st[pid].g += tot.goals[pid]; });
      Object.keys(tot.assists).forEach(function (pid) { if (st[pid]) st[pid].a += tot.assists[pid]; });
      Object.keys(w.squad || {}).forEach(function (pid) {
        var s = st[pid], side = w.squad[pid];
        if (!s || (side !== 'A' && side !== 'B')) return;
        s.nights++;
        if (fee > 0 && !(w.paid && w.paid[pid])) { s.owed += fee; s.unpaid.push(w.id); }
        // One result per night: W if your team won more games, D if level, L if fewer.
        var res = [], nr = nightResult(w);
        if (nr.played) {
          var mine = nr[side], theirs = nr[side === 'A' ? 'B' : 'A'];
          var r = mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
          s.p++; s[r.toLowerCase()]++; s.form.push(r); res.push({ r: r, mine: mine, theirs: theirs });
        }
        s.log.push({ wid: w.id, side: side, res: res, g: tot.goals[pid] || 0, a: tot.assists[pid] || 0 });
      });
    });
    Object.keys(st).forEach(function (k) { var s = st[k]; s.pts = s.w * 3 + s.d; s.pct = s.p ? Math.round(s.w / s.p * 100) : 0; s.form = s.form.slice(-5); s.log.reverse(); });
    S.stats = st;
  }
  function formHtml(f) {
    return f.length ? '<span class="form" aria-label="Last ' + f.length + ': ' + f.join(' ') + '">' + f.map(function (r) { return '<i class="' + r + '">' + r + '</i>'; }).join('') + '</span>' : '<span class="muted">—</span>';
  }

  /* ---------- server ---------- */
  var queue = [], sending = false, pollT = null;
  function busy() { return sending || queue.length > 0; }

  function send(op) {
    if (op.op === 'putWeek') queue = queue.filter(function (q) { return !(q.op === 'putWeek' && q.week.id === op.week.id); });
    queue.push(op);
    if (!sending) flush();
  }
  async function flush() {
    sending = true;
    while (queue.length) {
      var op = queue.shift();
      try {
        var j = await post(op);
        if (!queue.length) { S.v = j.v; S.data = j.data; rebuild(); render(); }
      } catch (e) {
        if (e.status === 401) { signOut(); toast('The admin PIN has changed. Sign in again.'); queue = []; }
        else toast(e.message || 'Couldn\'t save just now. Check your connection and try again.');
        poll(true);
      }
    }
    sending = false;
  }
  async function post(body, pin) {
    var r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin || S.pin || '' }, body: JSON.stringify(body) });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error(r.status === 400 && j.error ? j.error : r.status === 503 ? 'The Match Centre database isn\'t set up yet.' : ''); err.status = r.status; throw err; }
    return j;
  }
  async function poll(force) {
    clearTimeout(pollT);
    if (document.hidden && !force) return;
    try {
      var r = await fetch(API + '?v=' + (force ? 0 : S.v), { cache: 'no-store' });
      if (r.status === 503) { S.state = 'setup'; render(); return; }
      if (!r.ok) throw new Error(r.status);
      var j = await r.json();
      var was = S.state, wasOff = S.offline;
      S.offline = false; S.state = 'ready';
      if (!j.same && !busy()) { S.v = j.v; S.data = j.data || { players: {}, weeks: {} }; rebuild(); render(); }
      else if (was !== 'ready' || wasOff) render();
    } catch (e) {
      if (!S.offline) { S.offline = true; render(); }
    }
    pollT = setTimeout(poll, anyLive() ? 3000 : 15000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });

  function mutateWeek(wid, fn) {
    var w = S.data.weeks[wid]; if (!w) return;
    var copy = clone(w); copy.id = wid; fn(copy);
    S.data.weeks[wid] = copy;
    rebuild(); render();
    send({ op: 'putWeek', week: copy });
  }
  function signOut() { S.pin = null; S.admin = false; S.picking = false; try { localStorage.removeItem(PIN_KEY); } catch (e) {} render(); }

  /* ---------- render ---------- */
  function render() {
    document.querySelectorAll('.mc-tabs a').forEach(function (a) {
      if (a.dataset.view === S.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.mc-view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + S.view); });
    $('#adminBtn').textContent = S.admin ? 'Sign out of admin' : 'Admin sign in';
    $('#mc-banner').innerHTML = S.offline && S.state === 'ready' ? '<div class="notice">Can\'t reach the Match Centre right now, so scores may be out of date. It keeps trying.</div>' : '';
    ({ tonight: renderTonight, table: renderTable, players: renderPlayers, history: renderHistory })[S.view]();
  }
  function gate(el) {
    if (S.state === 'setup') {
      el.innerHTML = '<div class="hero-empty"><h2>Not connected yet</h2><p>The Match Centre needs its database switched on in Vercel. The steps are in <code>MATCH-CENTRE.md</code> in the repo.</p></div>';
      return false;
    }
    if (S.state === 'loading') {
      el.innerHTML = '<p class="mc-msg">' + (S.offline ? 'Can\'t reach the Match Centre. Check your connection; this page keeps trying.' : 'Warming up…') + '</p>';
      return false;
    }
    return true;
  }

  function payChip(w, pid) {
    var fee = +w.fee || 0; if (!fee) return '';
    var paid = !!(w.paid && w.paid[pid]);
    var txt = paid ? 'Paid' : 'Owes ' + money(fee);
    return S.admin
      ? '<button class="pay ' + (paid ? 'paid' : 'owes') + '" data-action="toggle-paid" data-pid="' + esc(pid) + '" data-wid="' + esc(w.id) + '" aria-pressed="' + paid + '" title="Tap to change">' + txt + '</button>'
      : '<span class="pay ' + (paid ? 'paid' : 'owes') + '">' + txt + '</span>';
  }

  function renderTonight() {
    var el = $('#view-tonight');
    if (!gate(el)) return;
    var w = currentWeek();
    if (!w) {
      el.innerHTML = '<div class="hero-empty"><h2>No match nights yet</h2><p>' +
        (S.admin ? 'Set up Thursday\'s game, then pick the two teams.' : 'Thursday\'s teams and the live score will show here once the night is set up.') + '</p>' +
        (S.admin ? '<button class="btn primary" data-action="new-night">Set up ' + fmtDate(nextThursday()) + '</button>' : '') + '</div>';
      return;
    }
    var gs = games(w), gi = gameIndex(w), g = gs[gi], nightNow = nightResult(w);
    var A = teamOf(w, 'A'), B = teamOf(w, 'B');
    function sq(side) {
      return Object.keys(w.squad || {}).filter(function (pid) { return w.squad[pid] === side && S.players.has(pid); })
        .map(function (pid) { return S.players.get(pid); }).sort(byName);
    }
    var sA = sq('A'), sB = sq('B'), fee = +w.fee || 0;
    var total = sA.length + sB.length;
    var paidCount = sA.concat(sB).filter(function (p) { return w.paid && w.paid[p.id]; }).length;

    function side(s, t, goals) {
      return '<div class="side" style="--team:' + t.color + '"><span class="tname">' + esc(t.name) + '</span>' +
        '<span class="goals" aria-label="' + esc(t.name) + ' ' + goals + '">' + goals + '</span>' +
        (S.admin ? '<div class="ctrls"><button class="btn" data-action="score" data-side="' + s + '" data-d="-1" aria-label="Take a goal off ' + esc(t.name) + '">−</button>' +
          '<button class="btn plus" data-action="score" data-side="' + s + '" data-d="1" aria-label="Goal for ' + esc(t.name) + '">+</button></div>' : '') + '</div>';
    }

    var board;
    if (g) {
      var label = g.status === 'live' ? 'Live' : g.status === 'ft' ? 'Full time' : 'Not started';
      var chips = (gs.length > 1 || S.admin) ? gs.map(function (x, i) {
        return '<button class="chip num" data-action="pick-game" data-i="' + i + '" aria-pressed="' + (i === gi) + '">Game ' + (i + 1) + ' · ' +
          (x.status === 'live' ? 'LIVE ' : x.status === 'ft' ? 'FT ' : '') + (+x.a || 0) + '–' + (+x.b || 0) + '</button>';
      }).join('') : '';
      var admin = S.admin ? (
        (g.status !== 'live' ? '<button class="btn sm' + (g.status === 'ft' ? '' : ' wb') + '" data-action="game-status" data-s="live">' + (g.status === 'ft' ? 'Reopen game' : 'Kick off') + '</button>' : '') +
        (g.status === 'live' ? '<button class="btn sm wb" data-action="game-status" data-s="ft">Full time</button>' : '') +
        '<button class="btn sm" data-action="add-game">Add another game</button>' +
        (gs.length > 1 ? '<button class="btn sm danger" data-action="remove-game">Remove game ' + (gi + 1) + '</button>' : '')) : '';
      board = '<div class="board"><div class="board-top"><span class="label">' + (gs.length > 1 ? 'Game ' + (gi + 1) + ' of ' + gs.length : 'Tonight\'s game') + (targetOf(w) ? ' · First to ' + targetOf(w) : '') + '</span><span class="spacer"></span>' +
        '<span class="mc-status ' + (g.status === 'live' ? 'live' : g.status === 'ft' ? 'ft' : '') + '">' + label + '</span></div>' +
        '<div class="mc-score">' + side('A', A, +g.a || 0) + '<span class="dash">–</span>' + side('B', B, +g.b || 0) + '</div>' +
        scorersHtml(g) +
        (nightNow.played ? '<div class="nightbar"><span class="label">' + (nightNow.open ? 'Tonight so far' : 'Tonight') + '</span><b>' + esc(nightLine(w, nightNow, nightNow.open)) + '</b>' +
          (S.admin && !nightNow.open ? '<span class="spacer"></span><button class="btn sm wa" data-action="share-wa">Send result to WhatsApp</button>' : '') + '</div>' : '') +
        (chips || admin ? '<div class="board-foot">' + chips + (chips && admin ? '<span class="spacer"></span>' : '') + admin + '</div>' : '') + '</div>';
    } else {
      board = '<div class="board"><div class="board-empty">' + (S.admin ? '<button class="btn sm wb" data-action="add-game">Add a game</button>' : 'No game set up for this night yet.') + '</div></div>';
    }

    function teamCard(t, list) {
      return '<div class="team" style="--team:' + t.color + '"><h3><span class="dot"></span>' + esc(t.name) + '<span class="spacer"></span><span class="muted num">' + list.length + '</span></h3>' +
        (list.length ? '<ul>' + list.map(function (p) { return '<li>' + avatar(p, 'av36') + '<span class="nm">' + esc(pName(p)) + '</span>' + payChip(w, p.id) + '</li>'; }).join('') + '</ul>'
          : '<p class="empty">' + (S.admin ? 'Use Pick teams to add players.' : 'Teams not picked yet.') + '</p>') + '</div>';
    }

    function scorersHtml(game) {
      var gl = goalList(game); if (!gl.length) return '';
      var open = gl.filter(function (x) { return !x.by; }).length;
      function col(s) {
        return '<ul class="scorers-col">' + gl.filter(function (x) { return x.s === s; }).map(function (x) {
          var who = x.by ? esc(scorerName(x.by)) : '<span class="tbc">' + (S.admin ? 'Add scorer' : 'Scorer to come') + '</span>';
          var inner = '<span class="who">' + who + (S.admin && x.by ? '<span class="edit-tag" aria-hidden="true">Edit</span>' : '') + '</span>' + (x.as ? '<span class="ast">Assist: ' + esc(scorerName(x.as)) + '</span>' : '');
          return '<li>' + (S.admin ? '<button class="goal-btn" data-action="edit-goal" data-i="' + x.idx + '" data-side="' + s + '">' + inner + '</button>' : inner) + '</li>';
        }).join('') + '</ul>';
      }
      var credited = gl.length - open;
      return '<div class="scorers">' + col('A') + col('B') + '</div>' +
        (S.admin && credited ? '<div class="scorers-hint">Got one wrong? Tap a goal to change the scorer or the assist.</div>' : '') +
        (S.admin && open ? '<div class="scorers-open">' + open + ' goal' + (open === 1 ? '' : 's') + ' still need' + (open === 1 ? 's' : '') + ' a scorer. Tap ' + (open === 1 ? 'it' : 'each one') + ' to add who scored and who assisted.</div>' : '');
    }

    var weekOpts = S.weeks.map(function (x, i) { return '<option value="' + esc(x.id) + '"' + (x.id === w.id ? ' selected' : '') + '>' + fmtDate(x.id) + (i === 0 ? ' (latest)' : '') + '</option>'; }).join('');

    el.innerHTML =
      '<div class="night row"><div><div class="label">' + (fee ? money(fee) + ' a head' + (total ? ' · ' + paidCount + ' of ' + total + ' paid' : '') : 'Match night') + '</div>' +
      '<h2>' + fmtDate(w.id, true) + '</h2></div><span class="spacer"></span>' +
      (S.weeks.length > 1 ? '<select class="btn" id="weekSel" aria-label="Choose a night">' + weekOpts + '</select>' : '') +
      (gs.some(function (x) { return goalList(x).length; }) ? '<button class="btn" data-action="copy-stats">Copy stats</button><button class="btn wa" data-action="share-wa">Send to WhatsApp</button>' : '') + '</div>' +
      (S.admin ? '<div class="row"><button class="btn' + (S.picking ? ' primary' : '') + '" data-action="toggle-pick" aria-expanded="' + S.picking + '">' + (S.picking ? 'Done picking' : 'Pick teams') + '</button>' +
        '<button class="btn" data-action="edit-night">Edit night</button><button class="btn" data-action="new-night">New night</button></div>' : '') +
      (S.admin && S.picking ? pickerHtml(w, A, B, sA.length, sB.length) : '') +
      board +
      '<div class="teams">' + teamCard(A, sA) + teamCard(B, sB) + '</div>';
  }

  function pickerHtml(w, A, B, nA, nB) {
    var q = S.pickQuery.trim().toLowerCase(), squad = w.squad || {};
    var list = Array.from(S.players.values()).sort(byName).filter(function (p) { return !q || ((p.name || '') + ' ' + (p.nickname || '')).toLowerCase().indexOf(q) >= 0; });
    return '<div class="picker"><div class="row"><span class="label">Pick teams</span><span class="spacer"></span>' +
      '<b class="num"><span style="color:' + A.color + '">' + esc(A.name) + ' ' + nA + '</span> v <span style="color:' + B.color + '">' + nB + ' ' + esc(B.name) + '</span></b></div>' +
      '<div class="row" style="margin-top:12px;flex-wrap:nowrap"><input type="search" id="pickSearch" placeholder="Find a player" aria-label="Find a player" value="' + esc(S.pickQuery) + '">' +
      '<button class="btn" data-action="add-player">Add player</button></div><ul>' +
      (list.map(function (p) {
        var s = squad[p.id] || '';
        return '<li>' + avatar(p, 'av36') + '<span class="nm">' + esc(pName(p)) + '</span><span class="seg" role="group" aria-label="Team for ' + esc(pName(p)) + '">' +
          '<button data-action="squad" data-pid="' + esc(p.id) + '" data-side="A" aria-pressed="' + (s === 'A') + '" style="--team:' + A.color + '" title="' + esc(A.name) + '">' + esc(A.name.slice(0, 8)) + '</button>' +
          '<button data-action="squad" data-pid="' + esc(p.id) + '" data-side="" aria-pressed="' + !s + '" title="Not playing">Out</button>' +
          '<button data-action="squad" data-pid="' + esc(p.id) + '" data-side="B" aria-pressed="' + (s === 'B') + '" style="--team:' + B.color + '" title="' + esc(B.name) + '">' + esc(B.name.slice(0, 8)) + '</button></span></li>';
      }).join('') || '<li class="muted">No player matches that.</li>') + '</ul></div>';
  }

  function renderTable() {
    var el = $('#view-table');
    if (!gate(el)) return;
    var rows = Array.from(S.players.values()).map(function (p) { return { p: p, s: S.stats[p.id] }; })
      .sort(function (a, b) { return b.s.pts - a.s.pts || b.s.pct - a.s.pct || b.s.p - a.s.p || byName(a.p, b.p); });
    var done = S.weeks.filter(function (w) { return nightResult(w).played; }).length;
    function leaders(key, title, unit) {
      var top = rows.filter(function (r) { return r.s[key] > 0; })
        .sort(function (a, b) { return b.s[key] - a.s[key] || a.s.p - b.s.p || byName(a.p, b.p); }).slice(0, 5);
      return '<div class="leaders-col"><div class="label">' + title + '</div>' + (top.length ? '<ol>' + top.map(function (r) {
        return '<li data-action="open-player" data-pid="' + esc(r.p.id) + '">' + avatar(r.p, 'av36') + '<span class="nm">' + esc(pName(r.p)) + '</span><b class="num">' + r.s[key] + '</b></li>';
      }).join('') + '</ol>' : '<p class="muted" style="font-size:14px;margin-top:8px">No ' + unit + ' recorded yet.</p>') + '</div>';
    }
    el.innerHTML = '<div><div class="label">All Thursdays · ' + done + ' night' + (done === 1 ? '' : 's') + ' played</div>' +
      '<p class="muted" style="margin-top:6px;font-size:14px">Each night is won by the team that wins the most games. W, D and L are nights: 3 points for a night won, 1 for a draw. Only finished games count.</p></div>' +
      '<div class="leaders">' + leaders('g', 'Top scorers', 'goals') + leaders('a', 'Most assists', 'assists') + '</div>' +
      '<div class="tbl"><table><thead><tr><th>#</th><th class="pl">Player</th><th title="Nights played">P</th><th title="Won">W</th><th title="Drawn">D</th><th title="Lost">L</th><th title="Points">Pts</th><th title="Goals">G</th><th title="Assists">A</th><th>Form</th><th>Owes</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr data-action="open-player" data-pid="' + esc(r.p.id) + '" tabindex="0"><td class="rank muted">' + (i + 1) + '</td>' +
          '<td class="pl"><div class="row">' + avatar(r.p, 'av36') + '<b>' + esc(pName(r.p)) + '</b></div></td>' +
          '<td>' + r.s.p + '</td><td>' + r.s.w + '</td><td>' + r.s.d + '</td><td>' + r.s.l + '</td><td class="pts">' + r.s.pts + '</td><td>' + r.s.g + '</td><td>' + r.s.a + '</td>' +
          '<td>' + formHtml(r.s.form) + '</td><td>' + (r.s.owed ? '<span class="pay owes">' + money(r.s.owed) + '</span>' : '<span class="pay paid">Paid</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderPlayers() {
    var el = $('#view-players');
    if (!gate(el)) return;
    var list = Array.from(S.players.values()).sort(byName);
    var owed = list.reduce(function (n, p) { return n + S.stats[p.id].owed; }, 0);
    el.innerHTML = '<div class="row"><span class="label">' + list.length + ' players' + (owed ? ' · ' + money(owed) + ' owed in total' : '') + '</span><span class="spacer"></span>' +
      (S.admin ? '<button class="btn primary" data-action="add-player">Add player</button>' : '') + '</div>' +
      '<ul class="grid">' + list.map(function (p) {
        var s = S.stats[p.id];
        return '<li><button class="pcard" data-action="open-player" data-pid="' + esc(p.id) + '">' + avatar(p, 'av96') +
          '<span class="nick">' + esc(pName(p)) + '</span>' + (p.nickname && p.name ? '<span class="real">' + esc(p.name) + '</span>' : '') +
          '<span class="rec num">W' + s.w + ' · D' + s.d + ' · L' + s.l + '</span>' +
          '<span class="rec num muted">' + s.g + ' goal' + (s.g === 1 ? '' : 's') + ' · ' + s.a + ' assist' + (s.a === 1 ? '' : 's') + '</span>' +
          (s.owed ? '<span class="pay owes">Owes ' + money(s.owed) + '</span>' : '<span class="pay paid">All paid</span>') + '</button></li>';
      }).join('') + '</ul>';
  }

  function renderHistory() {
    var el = $('#view-history');
    if (!gate(el)) return;
    if (!S.weeks.length) { el.innerHTML = '<div class="hero-empty"><h2>No nights yet</h2><p>Every Thursday\'s results will be kept here.</p></div>'; return; }
    el.innerHTML = S.weeks.map(function (w) {
      var A = teamOf(w, 'A'), B = teamOf(w, 'B'), gs = games(w), fee = +w.fee || 0;
      function n(side) { return Object.keys(w.squad || {}).filter(function (pid) { return w.squad[pid] === side && S.players.has(pid); }).length; }
      var res = gs.map(function (g, i) {
        var tag = g.status === 'live' ? ' <span class="mc-status live">Live</span>' : g.status === 'ft' ? '' : ' <span class="muted">not played</span>';
        return '<span class="num">' + (gs.length > 1 ? 'G' + (i + 1) + ': ' : '') + '<span style="color:' + A.color + '">' + esc(A.name) + '</span> ' + (+g.a || 0) + '–' + (+g.b || 0) + ' <span style="color:' + B.color + '">' + esc(B.name) + '</span>' + tag + '</span>';
      }).join('');
      var ids = Object.keys(w.squad || {}).filter(function (pid) { return S.players.has(pid); });
      var unpaid = fee ? ids.filter(function (pid) { return !(w.paid && w.paid[pid]); }).length : 0;
      var tot = nightTotals(w), gl = tally(tot.goals), al = tally(tot.assists), nr = nightResult(w);
      return '<button class="hist" data-action="open-week" data-wid="' + esc(w.id) + '"><span class="row"><b class="d">' + fmtDate(w.id, true) + '</b><span class="spacer"></span><span class="muted num">' + n('A') + ' v ' + n('B') + '</span></span>' +
        '<span class="res">' + (res || '<span class="muted">No games</span>') + '</span>' +
        (nr.played ? '<span class="hist-night">' + esc(nightLine(w, nr, nr.open)) + (nr.open ? ' (still playing)' : '') + '</span>' : '') +
        (gl ? '<span class="hist-st"><b>Goals</b> ' + esc(gl) + '</span>' : '') +
        (al ? '<span class="hist-st"><b>Assists</b> ' + esc(al) + '</span>' : '') +
        (tot.open ? '<span class="hist-st" style="color:#a12a17">' + tot.open + ' goal' + (tot.open === 1 ? '' : 's') + ' without a scorer</span>' : '') +
        (fee ? '<span style="font-size:14px;color:' + (unpaid ? '#a12a17' : 'var(--muted)') + '">' + (unpaid ? unpaid + ' still owe ' + money(fee) : 'Everyone paid') + '</span>' : '') + '</button>';
    }).join('');
  }

  /* ---------- sheets ---------- */
  var lastFocus = null;
  function openSheet(html, label) {
    lastFocus = document.activeElement;
    var sh = $('#sheet'); sh.innerHTML = html; sh.setAttribute('aria-label', label);
    $('#scrim').classList.add('on');
    var f = sh.querySelector('input:not([type=file]):not([disabled]),button'); if (f) f.focus();
  }
  function closeSheet() { $('#scrim').classList.remove('on'); $('#sheet').innerHTML = ''; if (lastFocus && lastFocus.isConnected) lastFocus.focus(); }

  function playerSheet(pid) {
    var p = S.players.get(pid); if (!p) return;
    var s = S.stats[pid];
    var log = s.log.map(function (e) {
      var w = S.weeks.find(function (x) { return x.id === e.wid; }); if (!w) return '';
      var t = teamOf(w, e.side);
      var r = e.res.length ? e.res.map(function (x) { return '<span class="form"><i class="' + x.r + '">' + x.r + '</i></span> <span class="num">' + x.mine + '–' + x.theirs + ' games</span>'; }).join(' &nbsp;') : '<span class="muted">No result</span>';
      var ga = [e.g ? e.g + ' goal' + (e.g === 1 ? '' : 's') : '', e.a ? e.a + ' assist' + (e.a === 1 ? '' : 's') : ''].filter(Boolean).join(', ');
      return '<li><span class="num" style="min-width:96px">' + fmtDate(e.wid) + '</span><span class="row" style="flex:1;gap:6px"><span class="dot" style="--team:' + t.color + '"></span>' + esc(t.name) + '</span><span>' + r + '</span>' +
        (ga ? '<span class="num muted" style="flex-basis:100%;font-size:14px">' + ga + '</span>' : '') + '</li>';
    }).join('');
    var unpaid = s.unpaid.map(function (wid) {
      var w = S.weeks.find(function (x) { return x.id === wid; });
      return '<li><span style="flex:1">' + fmtDate(wid, true) + '</span><span class="pay owes">' + money(+w.fee || 0) + '</span>' +
        (S.admin ? '<button class="btn sm" data-action="toggle-paid" data-pid="' + esc(pid) + '" data-wid="' + esc(wid) + '" data-from="sheet">Mark paid</button>' : '') + '</li>';
    }).join('');
    openSheet(
      '<div class="row" style="flex-wrap:nowrap">' + avatar(p, 'av96') + '<div style="min-width:0"><h2>' + esc(pName(p)) + '</h2>' +
      (p.nickname && p.name ? '<div class="muted">' + esc(p.name) + '</div>' : '') + '<div class="muted" style="font-size:14px">' + s.nights + ' night' + (s.nights === 1 ? '' : 's') + ' played</div></div></div>' +
      '<div class="label" style="margin-bottom:-8px">Nights</div><div class="tiles"><div class="tile"><b>' + s.p + '</b><span>Played</span></div><div class="tile"><b>' + s.w + '</b><span>Won</span></div><div class="tile"><b>' + s.d + '</b><span>Drawn</span></div><div class="tile"><b>' + s.l + '</b><span>Lost</span></div><div class="tile"><b>' + s.pct + '%</b><span>Win rate</span></div></div>' +
      '<div class="tiles t3"><div class="tile"><b>' + s.g + '</b><span>Goals</span></div><div class="tile"><b>' + s.a + '</b><span>Assists</span></div><div class="tile"><b>' + (s.g + s.a) + '</b><span>Goals + assists</span></div></div>' +
      '<div class="row"><span class="label">Form</span>' + formHtml(s.form) + '</div>' +
      '<div><div class="row"><span class="label">Subs</span><span class="spacer"></span>' + (s.owed ? '<span class="pay owes">Owes ' + money(s.owed) + '</span>' : '<span class="pay paid">All paid</span>') + '</div>' +
      (unpaid ? '<ul class="log" style="margin-top:8px">' + unpaid + '</ul>' + (S.admin && s.unpaid.length > 1 ? '<button class="btn sm" data-action="pay-all" data-pid="' + esc(pid) + '" style="margin-top:8px">Mark all paid</button>' : '') : '') + '</div>' +
      (log ? '<div><div class="label">Week by week</div><ul class="log" style="margin-top:8px">' + log + '</ul></div>' : '') +
      '<div class="row">' + (S.admin && p.own ? '<button class="btn" data-action="edit-player" data-pid="' + esc(pid) + '">Edit profile</button>' : '') +
      (!p.own ? '<a class="mc-link" href="../squad/#' + encodeURIComponent(pid) + '">Squad profile</a>' : '') +
      '<span class="spacer"></span><button class="btn" data-action="close">Close</button></div>', pName(p));
  }

  var draftPhoto;
  function playerForm(pid) {
    var p = pid ? S.players.get(pid) : null;
    draftPhoto = undefined;
    openSheet('<h2>' + (p ? 'Edit player' : 'Add player') + '</h2>' +
      '<form id="playerForm" class="field" style="gap:16px" data-pid="' + esc(pid || '') + '">' +
      '<div class="row"><span id="pf-preview">' + (p && p.photo ? '<img class="av av120" src="' + esc(p.photo) + '" alt="">' : '<span class="av av120" aria-hidden="true">' + (p ? esc(initials(p)) : '?') + '</span>') + '</span>' +
      '<div class="field"><label class="btn" for="pf-photo">' + (p && p.photo ? 'Change photo' : 'Add photo') + '</label><input type="file" id="pf-photo" accept="image/*" hidden><span class="muted" style="font-size:13px">Cropped to a square</span></div></div>' +
      '<div class="field"><label for="pf-name">Name</label><input type="text" id="pf-name" maxlength="40" required autocomplete="off" value="' + esc(p ? p.name : '') + '"></div>' +
      '<div class="field"><label for="pf-nick">Nickname <span class="muted">(optional, shown first)</span></label><input type="text" id="pf-nick" maxlength="24" autocomplete="off" value="' + esc(p ? p.nickname : '') + '"></div>' +
      '<div class="row"><button type="submit" class="btn primary">' + (p ? 'Save changes' : 'Add player') + '</button><button type="button" class="btn" data-action="close">Cancel</button><span class="spacer"></span>' +
      (p ? '<button type="button" class="btn danger" data-action="delete-player" data-pid="' + esc(pid) + '">Delete</button>' : '') + '</div></form>' +
      (p ? '' : '<p class="muted" style="font-size:14px">Regulars with a Squad page profile are already here. Add guests and new faces in this form.</p>'), p ? 'Edit player' : 'Add player');
  }

  function nightForm(wid) {
    var w = wid ? S.weeks.find(function (x) { return x.id === wid; }) : null;
    var base = w || S.weeks[0] || null;
    var A = base ? teamOf(base, 'A') : DEF_TEAMS.A, B = base ? teamOf(base, 'B') : DEF_TEAMS.B;
    var fee = base ? (+base.fee || 0) : 0, target = base ? targetOf(base) : 3;
    openSheet('<h2>' + (w ? 'Edit night' : 'New match night') + '</h2>' +
      '<form id="nightForm" class="field" style="gap:16px" data-wid="' + esc(wid || '') + '">' +
      '<div class="field"><label for="nf-date">Date</label>' + (w ? '<input type="text" id="nf-date" value="' + fmtDate(w.id, true) + '" disabled>' : '<input type="date" id="nf-date" required value="' + nextThursday() + '">') + '</div>' +
      '<div class="field"><label for="nf-fee">Cost per player (£)</label><input type="number" id="nf-fee" min="0" step="0.5" inputmode="decimal" value="' + fee + '"><span class="muted" style="font-size:13px">Set to 0 to switch off subs for this night.</span></div>' +
      '<div class="field"><label for="nf-target">First to (goals)</label><input type="number" id="nf-target" min="0" max="20" step="1" inputmode="numeric" value="' + target + '"><span class="muted" style="font-size:13px">A game ends when a team gets this many, and the next game kicks off by itself. Set to 0 to play on until you tap Full time.</span></div>' +
      '<div class="field"><label for="nf-an">Team 1</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="nf-an" maxlength="24" value="' + esc(A.name) + '"><input type="color" id="nf-ac" value="' + A.color.toLowerCase() + '" aria-label="Team 1 colour"></div></div>' +
      '<div class="field"><label for="nf-bn">Team 2</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="nf-bn" maxlength="24" value="' + esc(B.name) + '"><input type="color" id="nf-bc" value="' + B.color.toLowerCase() + '" aria-label="Team 2 colour"></div></div>' +
      (!w && S.weeks.length ? '<label class="row" style="gap:8px;font-size:15px"><input type="checkbox" id="nf-copy"> Start with the same teams as ' + fmtDate(S.weeks[0].id) + '</label>' : '') +
      '<div class="row"><button type="submit" class="btn primary">' + (w ? 'Save' : 'Create night') + '</button><button type="button" class="btn" data-action="close">Cancel</button><span class="spacer"></span>' +
      (w ? '<button type="button" class="btn danger" data-action="delete-night" data-wid="' + esc(w.id) + '">Delete night</button>' : '') + '</div></form>', w ? 'Edit night' : 'New match night');
  }

  function loginForm() {
    openSheet('<h2>Admin sign in</h2><form id="loginForm" class="field" style="gap:16px">' +
      '<div class="field"><label for="lf-pin">Admin PIN</label><input type="password" id="lf-pin" required autocomplete="current-password" inputmode="numeric"></div>' +
      '<p class="muted" style="font-size:14px">Admins pick the teams, update the score and mark subs. Everyone else can watch.</p>' +
      '<div class="row"><button type="submit" class="btn primary">Sign in</button><button type="button" class="btn" data-action="close">Cancel</button></div></form>', 'Admin sign in');
  }

  /* Who scored and who assisted. Nothing is saved until both are picked (an own goal needs no assist).
     S.goal = { wid, gi, idx (index in game.goals, -1 = an older goal still to credit), s, all, fresh (a new goal), by (scorer picked so far) } */
  function goalSheet(step) {
    var G = S.goal, w = G && S.weeks.find(function (x) { return x.id === G.wid; }), g = w && games(w)[G.gi];
    if (!g) { closeSheet(); return; }
    var x = G.idx >= 0 ? (g.goals || [])[G.idx] : { s: G.s, by: '', as: '' };
    if (!x || x.s !== G.s) { closeSheet(); toast('That goal has just changed. Tap it again.'); return; }
    var t = teamOf(w, G.s), squad = w.squad || {};
    if (step === 'menu') { // a goal that's already in: change the scorer, the assist, or delete it
      G.by = x.by; G.menu = true;
      var row = function (lbl, val, stepTo) {
        return '<li><span class="muted" style="min-width:64px">' + lbl + '</span><b style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(val) + '</b>' +
          (stepTo ? '<button class="btn sm" data-action="goal-step" data-step="' + stepTo + '">Change</button>' : '') + '</li>';
      };
      openSheet('<div><div class="label" style="color:' + t.color + '">Goal for ' + esc(t.name) + ' · Game ' + (G.gi + 1) + '</div><h2 style="margin-top:6px">Edit goal</h2></div>' +
        '<ul class="log">' + row('Scorer', scorerName(x.by), 'by') + (x.by === 'og' ? '' : row('Assist', x.as ? scorerName(x.as) : 'No assist', 'as')) + '</ul>' +
        '<div class="row"><button class="btn danger" data-action="delete-goal">Delete goal</button><span class="spacer"></span><button class="btn" data-action="close">Done</button></div>', 'Edit goal');
      return;
    }
    var mates = Object.keys(squad).filter(function (pid) { return squad[pid] === G.s && S.players.has(pid); }).map(function (pid) { return S.players.get(pid); });
    var list = (G.all || !mates.length ? Array.from(S.players.values()) : mates).sort(byName);
    if (step === 'as') list = list.filter(function (p) { return p.id !== G.by; });
    var sameScorer = G.idx >= 0 && x.by === G.by;
    var cur = step === 'as' ? (sameScorer ? x.as : null) : G.by;
    function pick(p) {
      return '<li><button class="pick" data-action="goal-' + step + '" data-v="' + esc(p.id) + '" aria-pressed="' + (cur === p.id) + '">' + avatar(p, 'av36') + '<span class="nm">' + esc(pName(p)) + '</span></button></li>';
    }
    var more = mates.length ? '<button class="mc-link" data-action="goal-all" data-step="' + step + '">' + (G.all ? 'Only show ' + esc(t.name) : 'Not listed? Show every player') + '</button>' : '';
    var html = step === 'as'
      ? '<div><div class="label" style="color:' + t.color + '">Goal for ' + esc(t.name) + ' · ' + esc(scorerName(G.by)) + '</div><h2 style="margin-top:6px">Who set it up?</h2></div>' +
        '<ul class="picks">' + list.map(pick).join('') + '<li><button class="pick" data-action="goal-as" data-v="" aria-pressed="' + (sameScorer && !x.as) + '"><span class="nm">No assist</span><span class="muted" style="font-size:13px">Solo goal, penalty, rebound</span></button></li></ul>' +
        '<div class="row">' + more + '<span class="spacer"></span><button class="btn" data-action="goal-step" data-step="' + (G.menu && G.by === x.by ? 'menu' : 'by') + '">Back</button></div>'
      : '<div><div class="label" style="color:' + t.color + '">Goal for ' + esc(t.name) + '</div><h2 style="margin-top:6px">Who scored?</h2></div>' +
        '<ul class="picks">' + list.map(pick).join('') + '<li><button class="pick" data-action="goal-by" data-v="og" aria-pressed="' + (G.by === 'og') + '"><span class="nm">Own goal</span><span class="muted" style="font-size:13px">Put in by the other team</span></button></li></ul>' +
        '<div class="row">' + more + '<span class="spacer"></span>' +
        (G.menu ? '<button class="btn" data-action="goal-step" data-step="menu">Back</button>' : (G.fresh ? '' : '<button class="btn danger" data-action="delete-goal">Delete goal</button>') + '<button class="btn" data-action="close">Cancel</button>') + '</div>' +
        (G.fresh ? '<p class="muted" style="font-size:14px">The goal goes on the scoreboard once you\'ve picked the scorer and the assist.</p>' : '');
    openSheet(html, step === 'as' ? 'Who set it up?' : 'Who scored?');
  }
  function commitGoal(by, as) { // returns false if the game has gone
    var G = S.goal, ok = false, next = -1;
    mutateWeek(G.wid, function (x) {
      var g = x.games && x.games[G.gi]; if (!g) return;
      g.goals = Array.isArray(g.goals) ? g.goals : [];
      var k = G.s === 'A' ? 'a' : 'b', n = +g[k] || 0, e;
      if (G.idx >= 0) { e = g.goals[G.idx]; if (!e || e.s !== G.s) return; }
      else { if (G.fresh && n >= 99) return; e = { s: G.s }; if (G.fresh) g.goals.push(e); else g.goals.unshift(e); } // an older goal goes before the newer ones, so − still takes off the latest
      e.by = by; e.as = by === 'og' ? '' : as;
      var cnt = g.goals.filter(function (y) { return y.s === G.s; }).length;
      g[k] = G.fresh ? Math.max(n + 1, cnt) : Math.max(n, cnt);
      if (G.fresh && (!g.status || g.status === 'upcoming')) g.status = 'live';
      if (G.fresh) next = maybeWin(x, G.gi);
      ok = true;
    });
    if (next >= 0) {
      var w = S.weeks.find(function (y) { return y.id === G.wid; }), win = teamOf(w, G.s).name;
      S.gameIdx = next; render();
      setTimeout(function () { toast(win + ' win game ' + (G.gi + 1) + '. Game ' + (next + 1) + ' has kicked off.'); }, 50);
    }
    return ok;
  }
  function waLink(w) { return 'https://wa.me/?text=' + encodeURIComponent(statsText(w, true)); }
  /* Line-ups for the night with each player's goals and assists, best first. */
  function lineups(w) {
    var tot = nightTotals(w), squad = w.squad || {};
    function side(sd) {
      return Object.keys(squad).filter(function (pid) { return squad[pid] === sd && S.players.has(pid); }).map(function (pid) {
        return { p: S.players.get(pid), g: tot.goals[pid] || 0, a: tot.assists[pid] || 0 };
      }).sort(function (x, y) { return y.g - x.g || y.a - x.a || byName(x.p, y.p); });
    }
    return { A: side('A'), B: side('B'), tot: tot };
  }
  function playedGames(w) { return games(w).map(function (g, i) { return { g: g, n: i + 1 }; }).filter(function (x) { return x.g.status === 'ft' || goalList(x.g).length; }); }
  function gaText(r) { return [r.g ? '⚽ ' + r.g : '', r.a ? '🅰️ ' + r.a : ''].filter(Boolean).join('  '); }
  function statsText(w, wa) {
    var bold = function (x) { return wa ? '*' + x + '*' : x; };
    var A = teamOf(w, 'A'), B = teamOf(w, 'B'), lu = lineups(w), nr = nightResult(w), lines = [bold('Western Ballers FC · ' + fmtDate(w.id, true))];
    if (nr.played) lines.push(bold((nr.open ? 'So far: ' : '') + nightLine(w, nr, nr.open)));
    ['A', 'B'].forEach(function (sd) {
      if (!lu[sd].length) return;
      lines.push('', bold(teamOf(w, sd).name));
      lu[sd].forEach(function (r) { var ga = gaText(r); lines.push(pName(r.p) + (ga ? '  ' + ga : '')); });
    });
    var pg = playedGames(w);
    if (pg.length) {
      lines.push('', bold('Games'));
      pg.forEach(function (x) { lines.push('Game ' + x.n + ': ' + A.name + ' ' + (+x.g.a || 0) + '–' + (+x.g.b || 0) + ' ' + B.name + (x.g.status === 'live' ? ' (still playing)' : '')); });
    }
    if (lu.tot.open) lines.push('', lu.tot.open + ' goal' + (lu.tot.open === 1 ? '' : 's') + ' still without a scorer');
    return lines.join('\n');
  }

  /* The results card: a picture of the night for the group chat. Line-ups with photos and goals/assists, then each game's score. */
  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var i = new Image(), done = false;
      var fin = function (v) { if (!done) { done = true; res(v); } };
      i.onload = function () { fin(i); }; i.onerror = function () { fin(null); }; setTimeout(function () { fin(null); }, 6000);
      i.src = src;
    });
  }
  async function renderCard(w) {
    try { await document.fonts.ready; } catch (e) {}
    var A = teamOf(w, 'A'), B = teamOf(w, 'B'), lu = lineups(w), nr = nightResult(w), pg = playedGames(w);
    var W = 1080, P = 56, SANS = '"Roboto", "Helvetica Neue", Arial, sans-serif', SERIF = '"Newsreader", Georgia, serif';
    var INK = '#121212', PAPER = '#ffffff', PAPER2 = '#f7f5f2', MUTED = '#5c5c5c', WB = '#F26B1D';
    var ROW = 92, rows = Math.max(lu.A.length, lu.B.length, 1);
    var hHead = 200, hRes = 150, hLine = 90 + rows * ROW + 30, hGames = pg.length ? 90 + pg.length * 78 + 30 : 0, hFoot = 80;
    var H = hHead + hRes + hLine + hGames + hFoot;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var all = lu.A.concat(lu.B);
    var imgs = await Promise.all([loadImg(new URL('crest.png', root).href)].concat(all.map(function (r) { return loadImg(r.p.photo); })));
    var crest = imgs[0], photo = new Map(); all.forEach(function (r, k) { photo.set(r.p.id, imgs[k + 1]); });
    function fit(t, max, font) { x.font = font; if (x.measureText(t).width <= max) return t; while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
    function txt(t, X, Y, font, color, align) { x.font = font; x.fillStyle = color; x.textAlign = align || 'left'; x.textBaseline = 'middle'; x.fillText(t, X, Y); }
    // header
    x.fillStyle = INK; x.fillRect(0, 0, W, hHead);
    if (crest) x.drawImage(crest, P, (hHead - 120) / 2, 120 * crest.naturalWidth / crest.naturalHeight, 120);
    var hx = P + (crest ? 120 * crest.naturalWidth / crest.naturalHeight + 32 : 0);
    txt('Western Ballers FC', hx, 82, '700 54px ' + SERIF, PAPER);
    txt(fmtDate(w.id, true).toUpperCase(), hx, 138, '800 26px ' + SANS, WB);
    // result band
    var winT = nr.winner === 'A' ? A : nr.winner === 'B' ? B : null;
    x.fillStyle = winT ? winT.color : '#3a3a3a'; x.fillRect(0, hHead, W, hRes);
    var head = !nr.played ? 'RESULTS' : nr.winner === 'D' ? (nr.open ? 'ALL LEVEL SO FAR' : 'NIGHT DRAWN') : (winT.name.toUpperCase() + (nr.open ? ' LEAD THE NIGHT' : ' WIN THE NIGHT'));
    txt(fit(head, W - 2 * P, '900 62px ' + SANS), P, hHead + 62, '900 62px ' + SANS, '#ffffff');
    if (nr.played) txt(Math.max(nr.A, nr.B) + '–' + Math.min(nr.A, nr.B) + ' on games' + (nr.open ? ' · still playing' : ''), P, hHead + 116, '700 30px ' + SANS, 'rgba(255,255,255,.9)');
    // line-ups
    var y0 = hHead + hRes; x.fillStyle = PAPER; x.fillRect(0, y0, W, hLine + hGames + hFoot);
    var colW = (W - 2 * P - 40) / 2;
    [['A', A], ['B', B]].forEach(function (pair, ci) {
      var sd = pair[0], t = pair[1], cx = P + ci * (colW + 40), y = y0 + 40;
      x.fillStyle = t.color; x.fillRect(cx, y, colW, 8);
      txt(t.name.toUpperCase(), cx, y + 42, '800 30px ' + SANS, INK);
      y += 80;
      lu[sd].forEach(function (r, k) {
        var cy = y + k * ROW + ROW / 2, R = 34, im = photo.get(r.p.id);
        x.save(); x.beginPath(); x.arc(cx + R, cy, R, 0, Math.PI * 2); x.closePath(); x.fillStyle = PAPER2; x.fill(); x.clip();
        if (im) { var sz = Math.min(im.naturalWidth, im.naturalHeight); x.drawImage(im, (im.naturalWidth - sz) / 2, (im.naturalHeight - sz) * 0.12, sz, sz, cx, cy - R, 2 * R, 2 * R); }
        else txt(initials(r.p), cx + R, cy + 1, '800 24px ' + SANS, MUTED, 'center');
        x.restore();
        // badges from the right
        var bx = cx + colW, font = '800 24px ' + SANS;
        [['A', r.a, INK], ['G', r.g, WB]].forEach(function (b) {
          if (!b[1]) return;
          var label = b[1] + ' ' + b[0]; x.font = font; var bw = x.measureText(label).width + 24;
          bx -= bw; x.fillStyle = b[2]; x.beginPath(); if (x.roundRect) x.roundRect(bx, cy - 20, bw, 40, 6); else x.rect(bx, cy - 20, bw, 40); x.fill();
          txt(label, bx + bw / 2, cy + 1, font, b[0] === 'G' ? INK : '#ffffff', 'center'); bx -= 8;
        });
        txt(fit(pName(r.p), bx - (cx + 2 * R + 18) - 6, '700 30px ' + SANS), cx + 2 * R + 18, cy, '700 30px ' + SANS, INK);
        if (k < lu[sd].length - 1) { x.fillStyle = '#e6e3de'; x.fillRect(cx, cy + ROW / 2, colW, 2); }
      });
      if (!lu[sd].length) txt('No players picked', cx, y + 40, '400 26px ' + SANS, MUTED);
    });
    x.font = '700 20px ' + SANS;
    // games
    var gy = y0 + hLine;
    if (pg.length) {
      x.fillStyle = INK; x.fillRect(P, gy, W - 2 * P, 4);
      txt('GAMES', P, gy + 46, '800 26px ' + SANS, MUTED);
      pg.forEach(function (it, k) {
        var cy = gy + 90 + k * 78 + 39, g = it.g, a = +g.a || 0, b = +g.b || 0;
        x.fillStyle = k % 2 ? PAPER : PAPER2; x.fillRect(P, cy - 39, W - 2 * P, 78);
        txt('GAME ' + it.n, P + 20, cy, '800 24px ' + SANS, MUTED);
        txt(A.name, W / 2 - 70, cy, (a > b ? '800' : '500') + ' 32px ' + SANS, a > b ? A.color : INK, 'right');
        txt(a + '–' + b, W / 2, cy, '900 36px ' + SANS, INK, 'center');
        txt(B.name, W / 2 + 70, cy, (b > a ? '800' : '500') + ' 32px ' + SANS, b > a ? B.color : INK, 'left');
        if (g.status === 'live') txt('LIVE', W - P - 20, cy, '800 22px ' + SANS, '#d93025', 'right');
      });
    }
    // footer
    x.fillStyle = WB; x.fillRect(0, H - hFoot, W, 6);
    txt('wb-news.vercel.app/match', W / 2, H - hFoot / 2 + 4, '700 24px ' + SANS, MUTED, 'center');
    return c;
  }
  var shareFile = null;
  async function shareSheet(w) {
    shareFile = null;
    openSheet('<h2>Send to WhatsApp</h2><p class="muted" id="sh-status">Making the results card…</p><div id="sh-card"></div><div class="row" id="sh-btns"></div>', 'Send to WhatsApp');
    var c;
    try { c = await renderCard(w); } catch (e) { $('#sh-status').textContent = 'The picture couldn\'t be made, but you can still send the results as text.'; }
    var blob = c ? await new Promise(function (r) { c.toBlob(r, 'image/png'); }) : null;
    if (!$('#sh-btns')) return; // sheet closed meanwhile
    var name = 'western-ballers-' + w.id + '.png', url = blob ? URL.createObjectURL(blob) : '';
    if (blob) { try { shareFile = new File([blob], name, { type: 'image/png' }); } catch (e) { shareFile = null; } }
    var canShare = !!(shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] }));
    if (blob) {
      $('#sh-card').innerHTML = '<img class="share-card" src="' + url + '" alt="Results card for ' + esc(fmtDate(w.id, true)) + '">';
      $('#sh-status').textContent = canShare ? 'Tap Share, choose WhatsApp, then your group. The results go with it as a message.' : 'Save the picture (or press and hold it), then send it in your WhatsApp group. Open WhatsApp sends the results as text.';
    }
    $('#sh-btns').innerHTML = (canShare ? '<button class="btn wa" data-action="share-go">Share</button>' : '') +
      (blob && !canShare ? '<a class="btn" href="' + url + '" download="' + name + '">Save picture</a>' : '') +
      '<a class="btn' + (canShare ? '' : ' wa') + '" href="' + esc(waLink(w)) + '" target="_blank" rel="noopener">Open WhatsApp' + (blob ? ' (text only)' : '') + '</a>' +
      '<button class="btn" data-action="copy-stats">Copy text</button><span class="spacer"></span><button class="btn" data-action="close">Close</button>';
  }

  async function fileToPhoto(file) {
    var url = URL.createObjectURL(file);
    try {
      var img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = url; });
      var size = 320, c = document.createElement('canvas'); c.width = c.height = size;
      var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
      c.getContext('2d').drawImage(img, (w - s) / 2, h > w ? (h - s) * 0.25 : 0, s, s, 0, 0, size, size); // portrait: keep the face, which sits high
      return c.toDataURL('image/jpeg', 0.82);
    } finally { URL.revokeObjectURL(url); }
  }

  function armOrRun(btn, fn) {
    if (btn.classList.contains('armed')) { fn(); return; }
    btn.classList.add('armed'); var old = btn.textContent; btn.textContent = 'Tap again to confirm';
    setTimeout(function () { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = old; } }, 3500);
  }
  async function direct(op, done) {
    try { var j = await post(op); S.v = j.v; S.data = j.data; rebuild(); render(); if (done) done(); }
    catch (e) { if (e.status === 401) { signOut(); toast('Wrong PIN. Sign in again.'); } else toast(e.message || 'Couldn\'t save just now. Try again.'); throw e; }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    if (e.target === $('#scrim')) { closeSheet(); return; }
    if (e.target.id === 'adminBtn') { if (S.admin) { signOut(); toast('Signed out of admin'); } else loginForm(); return; }
    var t = e.target.closest('[data-action]'); if (!t) return;
    var a = t.dataset.action, w = currentWeek();
    switch (a) {
      case 'close': closeSheet(); break;
      case 'open-player': playerSheet(t.dataset.pid); break;
      case 'add-player': playerForm(null); break;
      case 'edit-player': playerForm(t.dataset.pid); break;
      case 'delete-player': armOrRun(t, function () { direct({ op: 'deletePlayer', id: t.dataset.pid }, function () { closeSheet(); toast('Player deleted'); }).catch(function () {}); }); break;
      case 'new-night': nightForm(null); break;
      case 'edit-night': if (w) nightForm(w.id); break;
      case 'delete-night': armOrRun(t, function () {
        var id = t.dataset.wid;
        direct({ op: 'deleteWeek', id: id }, function () { if (S.weekId === id) S.weekId = null; closeSheet(); toast('Night deleted'); }).catch(function () {});
      }); break;
      case 'toggle-pick': S.picking = !S.picking; render(); break;
      case 'squad': if (w) mutateWeek(w.id, function (x) {
        x.squad = x.squad || {}; x.paid = x.paid || {};
        if (t.dataset.side) x.squad[t.dataset.pid] = t.dataset.side; else { delete x.squad[t.dataset.pid]; delete x.paid[t.dataset.pid]; }
      }); break;
      case 'toggle-paid': {
        var pid = t.dataset.pid;
        mutateWeek(t.dataset.wid, function (x) { x.paid = x.paid || {}; if (x.paid[pid]) delete x.paid[pid]; else x.paid[pid] = true; });
        if (t.dataset.from === 'sheet') playerSheet(pid);
        break;
      }
      case 'pay-all': {
        var id = t.dataset.pid;
        S.stats[id].unpaid.slice().forEach(function (wid) { mutateWeek(wid, function (x) { x.paid = x.paid || {}; x.paid[id] = true; }); });
        playerSheet(id); toast('All nights marked paid'); break;
      }
      case 'pick-game': S.gameIdx = +t.dataset.i; render(); break;
      case 'score': if (w) {
        // + asks who scored and who assisted, and only then adds the goal; − takes off that team's most recent goal.
        var gi = gameIndex(w), sd = t.dataset.side, removed = null;
        if (+t.dataset.d > 0) { S.goal = { wid: w.id, gi: gi, idx: -1, s: sd, all: false, fresh: true, by: '' }; goalSheet('by'); break; }
        var reopened = false;
        mutateWeek(w.id, function (x) {
          var g = x.games[gi]; if (!g) return; var k = sd === 'A' ? 'a' : 'b', n = +g[k] || 0;
          if (!n) return;
          var before = Math.max(+g.a || 0, +g.b || 0);
          g.goals = Array.isArray(g.goals) ? g.goals : [];
          for (var j = g.goals.length - 1; j >= 0; j--) if (g.goals[j].s === sd) { removed = g.goals.splice(j, 1)[0]; break; }
          g[k] = n - 1;
          reopened = undoWin(x, gi, before);
        });
        if (reopened) { S.gameIdx = gi; render(); }
        if (removed && removed.by) toast('Took off ' + (removed.by === 'og' ? 'the own goal' : scorerName(removed.by) + '\'s goal'));
      } break;
      case 'edit-goal': if (w) {
        var egi = gameIndex(w), ei = +t.dataset.i, eg = (games(w)[egi] || {}).goals || [];
        S.goal = { wid: w.id, gi: egi, idx: ei, s: t.dataset.side, all: false, fresh: false, by: ei >= 0 && eg[ei] ? eg[ei].by || '' : '' };
        goalSheet(S.goal.by ? 'menu' : 'by');
      } break;
      case 'goal-step': goalSheet(t.dataset.step); break;
      case 'goal-all': S.goal.all = !S.goal.all; goalSheet(t.dataset.step); break;
      case 'goal-by':
        S.goal.by = t.dataset.v;
        if (S.goal.by !== 'og') { goalSheet('as'); break; }
        closeSheet(); toast(commitGoal('og', '') ? 'Own goal added' : 'That game has changed. Try again.');
        break;
      case 'goal-as': {
        var sc = S.goal.by, as = t.dataset.v;
        if (!sc) { goalSheet('by'); break; }
        closeSheet();
        toast(commitGoal(sc, as) ? 'Goal: ' + scorerName(sc) + (as ? ', assist ' + scorerName(as) : ', no assist') : 'That game has changed. Try again.');
        break;
      }
      case 'delete-goal': armOrRun(t, function () {
        var G = S.goal;
        mutateWeek(G.wid, function (x) {
          var g = x.games && x.games[G.gi]; if (!g) return; var k = G.s === 'A' ? 'a' : 'b';
          var before = Math.max(+g.a || 0, +g.b || 0);
          if (G.idx >= 0) { if (!g.goals || !g.goals[G.idx] || g.goals[G.idx].s !== G.s) return; g.goals.splice(G.idx, 1); }
          g[k] = Math.max(0, (+g[k] || 0) - 1);
          if (undoWin(x, G.gi, before)) S.gameIdx = G.gi;
        });
        closeSheet(); toast('Goal deleted');
      }); break;
      case 'share-wa': if (w) shareSheet(w); break;
      case 'share-go': if (w && shareFile) {
        navigator.share({ files: [shareFile], text: statsText(w, true) }).catch(function (e) {
          if (e && e.name === 'AbortError') return;
          navigator.share({ files: [shareFile] }).catch(function () { toast('Couldn\'t open sharing here. Save the picture and send it in WhatsApp.'); });
        });
      } break;
      case 'copy-stats': if (w) {
        var txt = statsText(w);
        var showIt = function () { openSheet('<h2>Stats for ' + fmtDate(w.id) + '</h2><textarea class="stats-text" readonly rows="12">' + esc(txt) + '</textarea><div class="row"><span class="spacer"></span><button class="btn" data-action="close">Close</button></div>', 'Stats'); var ta = $('.stats-text'); ta.focus(); ta.select(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Stats copied. Paste them anywhere.'); }, showIt);
        else showIt();
      } break;
      case 'game-status': if (w) { var i2 = gameIndex(w); S.gameIdx = i2; mutateWeek(w.id, function (x) { if (x.games[i2]) x.games[i2].status = t.dataset.s; }); } break;
      case 'add-game': if (w && games(w).length >= MAX_GAMES) { toast('That\'s the most games one night can hold.'); break; } if (w) { S.gameIdx = games(w).length; mutateWeek(w.id, function (x) { x.games = games(x).concat([{ a: 0, b: 0, status: 'upcoming' }]); }); } break;
      case 'remove-game': if (w) armOrRun(t, function () { var i3 = gameIndex(w); S.gameIdx = null; mutateWeek(w.id, function (x) { x.games.splice(i3, 1); }); }); break;
      case 'open-week': S.weekId = t.dataset.wid; S.gameIdx = null; S.picking = false; location.hash = '#tonight'; window.scrollTo(0, 0); break;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#scrim').classList.contains('on')) closeSheet();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-action]')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('change', async function (e) {
    if (e.target.id === 'weekSel') { S.weekId = e.target.value; S.gameIdx = null; S.picking = false; render(); }
    if (e.target.id === 'pf-photo' && e.target.files && e.target.files[0]) {
      try { draftPhoto = await fileToPhoto(e.target.files[0]); $('#pf-preview').innerHTML = '<img class="av av120" src="' + draftPhoto + '" alt="">'; }
      catch (err) { toast('That file couldn\'t be read as a photo. Try a JPEG or PNG.'); }
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'pickSearch') return;
    S.pickQuery = e.target.value; var pos = e.target.selectionStart;
    render(); var el = $('#pickSearch'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} }
  });
  document.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('[type=submit]');
    if (f.id === 'loginForm') {
      var pin = $('#lf-pin').value.trim(); if (!pin) return;
      btn.disabled = true;
      try {
        await post({ op: 'login' }, pin);
        S.pin = pin; S.admin = true; try { localStorage.setItem(PIN_KEY, pin); } catch (x) {}
        closeSheet(); render(); toast('Signed in as admin');
      } catch (err) { btn.disabled = false; toast(err.status === 401 ? 'That PIN isn\'t right.' : (err.message || 'Couldn\'t sign in just now.')); }
    }
    if (f.id === 'playerForm') {
      var name = $('#pf-name').value.trim(), nickname = $('#pf-nick').value.trim();
      if (!name) { $('#pf-name').focus(); return; }
      var body = { op: 'putPlayer', player: { id: f.dataset.pid || undefined, name: name, nickname: nickname } };
      if (draftPhoto) body.photo = draftPhoto;
      btn.disabled = true;
      direct(body, function () { closeSheet(); toast(f.dataset.pid ? 'Saved' : (nickname || name) + ' added'); }).catch(function () { btn.disabled = false; });
    }
    if (f.id === 'nightForm') {
      var wid = f.dataset.wid;
      var fee = Math.max(0, Math.round((parseFloat($('#nf-fee').value) || 0) * 100) / 100);
      var target = Math.max(0, Math.min(20, parseInt($('#nf-target').value, 10) || 0));
      var teams = {
        A: { name: $('#nf-an').value.trim() || DEF_TEAMS.A.name, color: okColor($('#nf-ac').value) || DEF_TEAMS.A.color },
        B: { name: $('#nf-bn').value.trim() || DEF_TEAMS.B.name, color: okColor($('#nf-bc').value) || DEF_TEAMS.B.color }
      };
      if (wid) { mutateWeek(wid, function (x) { x.fee = fee; x.target = target; x.teams = teams; }); closeSheet(); return; }
      var date = $('#nf-date').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('#nf-date').focus(); return; }
      if (S.data.weeks[date]) { S.weekId = date; closeSheet(); toast('That night already exists, so it\'s open now.'); location.hash = '#tonight'; render(); return; }
      var copy = $('#nf-copy') && $('#nf-copy').checked && S.weeks[0];
      var week = { id: date, fee: fee, target: target, teams: teams, squad: copy ? clone(copy.squad || {}) : {}, paid: {}, games: [{ a: 0, b: 0, status: 'upcoming' }] };
      btn.disabled = true;
      direct({ op: 'putWeek', week: week }, function () { S.weekId = date; S.gameIdx = null; S.picking = true; closeSheet(); location.hash = '#tonight'; render(); }).catch(function () { btn.disabled = false; });
    }
  });

  function route() {
    var h = location.hash.slice(1);
    S.view = ['tonight', 'table', 'players', 'history'].indexOf(h) >= 0 ? h : 'tonight';
    render();
  }
  window.addEventListener('hashchange', route);

  /* ---------- start ---------- */
  route();
  fetch(new URL('data/players.json', root))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      S.squad = (j.players || []).filter(function (p) { return p && /^[a-z0-9][a-z0-9-]*$/.test(p.id || ''); })
        .map(function (p) { return { id: p.id, name: p.name, nickname: '', photo: p.photo ? new URL(p.photo, root).href : null, own: false }; });
    })
    .catch(function () { S.squad = []; })
    .then(function () { rebuild(); poll(true); });
})();
