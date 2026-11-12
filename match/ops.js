/* Match Centre changes, shared by the page (match.js) and the server (api/match.js) so both work them out the same way.
   The page sends small changes ("add this goal", "mark paid"), not the whole night. The server applies each one to the
   latest saved data, so two admins scoring at once don't overwrite each other, and a change sent twice (a retry after a
   lost connection) only counts once.

   A night:  { id, fee, target, teams: {A, B}, squad: {pid: 'A'|'B'}, paid: {pid: true}, games: [game] }
   A game:   { k, a, b, status: 'upcoming'|'live'|'ft', goals: [goal] }
   A goal:   { k, s: 'A'|'B' (team that gets it), by: pid | 'og' (own goal) | '' (not credited), as: pid | '' (no assist) }
   k is a short id, so a change can name the exact game or goal even if the list has moved on.
   target: first to N goals wins a game (default 3, 0 = no limit). The night goes to the team that wins the most games. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WBOps = factory();
})(this, function () {
  'use strict';
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var PID = /^[a-z0-9][a-z0-9-]{0,47}$/;
  var KEY = /^[a-z0-9]{1,20}$/;
  var COLOR = /^#[0-9a-fA-F]{6}$/;
  var STATUSES = ['upcoming', 'live', 'ft'];
  var MAX_GAMES = 30, MAX_GOALS = 198, MAX_SCORE = 99;
  var DEF = { A: { name: 'Bibs', color: '#F26B1D' }, B: { name: 'Non Bibs', color: '#2B63D9' } };

  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
  function int(v, lo, hi) { return Math.min(hi, Math.max(lo, Math.round(Number(v) || 0))); }
  function uid() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(-12); }
  function targetOf(w) { return w.target == null || w.target === '' ? 3 : int(w.target, 0, 20); }
  function score(g, s) { return +g[s === 'A' ? 'a' : 'b'] || 0; }
  function setScore(g, s, n) { g[s === 'A' ? 'a' : 'b'] = int(n, 0, MAX_SCORE); }
  function count(g, s) { return (g.goals || []).filter(function (x) { return x.s === s; }).length; }
  function isEmpty(g) { return !score(g, 'A') && !score(g, 'B') && !(g.goals || []).length; }
  function findGame(w, gk) { return (w.games || []).filter(function (g) { return g.k === gk; })[0] || null; }
  function cleanBy(by) { return by === 'og' || PID.test(by || '') ? by : ''; }
  function cleanAs(as, by) { return by && by !== 'og' && PID.test(as || '') && as !== by ? as : ''; }

  /* Fill in anything missing. Older saved data has no ids, so they're made from positions; the page and the server
     make the same ones, and they're stored from the next save. */
  function normalizeWeek(w, id) {
    w = w || {};
    w.id = id || w.id;
    w.squad = w.squad && typeof w.squad === 'object' ? w.squad : {};
    w.paid = w.paid && typeof w.paid === 'object' ? w.paid : {};
    w.games = Array.isArray(w.games) ? w.games : [];
    var seen = {};
    w.games.forEach(function (g, i) {
      if (!KEY.test(g.k || '') || seen[g.k]) g.k = 'g' + i + (seen['g' + i] ? 'x' : '');
      seen[g.k] = 1;
      g.goals = Array.isArray(g.goals) ? g.goals : [];
      g.goals.forEach(function (x, j) { if (!KEY.test(x.k || '') || seen[x.k]) x.k = g.k + 'l' + j; seen[x.k] = 1; });
    });
    return w;
  }

  /* The server checks every night before saving it. */
  function cleanWeek(w) {
    if (!w || !DATE.test(w.id || '')) throw new Error('Bad date');
    normalizeWeek(w);
    var team = function (t, d) {
      var nm = str(t && t.name, 24);
      return { name: (nm === 'Shirts' ? '' : nm) || d.name, color: COLOR.test((t && t.color) || '') ? t.color : d.color }; // 'Shirts' was the old default
    };
    var squad = {}, paid = {};
    Object.keys(w.squad).slice(0, 60).forEach(function (pid) { var s = w.squad[pid]; if (PID.test(pid) && (s === 'A' || s === 'B')) squad[pid] = s; });
    Object.keys(w.paid).forEach(function (pid) { if (squad[pid] && w.paid[pid] === true) paid[pid] = true; });
    var games = w.games.slice(0, MAX_GAMES).map(function (g) {
      var goals = g.goals.slice(0, MAX_GOALS).map(function (x) {
        var by = cleanBy(x && x.by);
        return { k: x.k, s: x && x.s === 'B' ? 'B' : 'A', by: by, as: cleanAs(x && x.as, by) };
      });
      var out = { k: g.k, a: 0, b: 0, status: STATUSES.indexOf(g.status) >= 0 ? g.status : 'upcoming', goals: goals };
      out.a = Math.max(int(g.a, 0, MAX_SCORE), count(out, 'A'));
      out.b = Math.max(int(g.b, 0, MAX_SCORE), count(out, 'B'));
      return out;
    });
    return {
      id: w.id,
      fee: Math.min(100, Math.max(0, Math.round((Number(w.fee) || 0) * 100) / 100)),
      target: targetOf(w),
      teams: { A: team(w.teams && w.teams.A, DEF.A), B: team(w.teams && w.teams.B, DEF.B) },
      squad: squad, paid: paid, games: games,
      updatedAt: Date.now()
    };
  }

  /* Only one game is live at a time: when one goes live, any other live game ends (or goes back to not started if empty). */
  function oneLive(w, keep) {
    w.games.forEach(function (g) { if (g !== keep && g.status === 'live') g.status = isEmpty(g) ? 'upcoming' : 'ft'; });
  }
  function maybeWin(w, g, nextK) { // after a new goal: end the game at the target and kick off the next one
    var t = targetOf(w);
    if (!t || g.status === 'ft' || Math.max(score(g, 'A'), score(g, 'B')) < t) return null;
    g.status = 'ft';
    if (w.games.length >= MAX_GAMES) return null;
    var k = KEY.test(nextK || '') && !findGame(w, nextK) ? nextK : uid();
    var ng = { k: k, a: 0, b: 0, status: 'live', goals: [] };
    w.games.push(ng);
    return ng;
  }
  function undoWin(w, g, before) { // after a goal comes off: if that undid the win, reopen the game, as long as the next one hasn't started
    var t = targetOf(w);
    if (!t || g.status !== 'ft' || before < t || Math.max(score(g, 'A'), score(g, 'B')) >= t) return null;
    var i = w.games.indexOf(g), nx = w.games[i + 1];
    if (nx && !isEmpty(nx)) return 'kept';
    if (nx && i + 1 === w.games.length - 1) w.games.splice(i + 1, 1);
    g.status = 'live'; oneLive(w, g);
    return 'reopened';
  }

  /* Apply one change to the whole data { weeks, players, ... }. Returns { ok, why?, ...details for the page }. */
  function apply(data, op) {
    if (!op || typeof op !== 'object') return { ok: false, why: 'bad' };
    data.weeks = data.weeks || {};
    var wid = String(op.wid || '');
    if (op.t === 'createWeek') {
      if (!DATE.test(wid)) return { ok: false, why: 'bad' };
      if (data.weeks[wid]) return { ok: false, why: 'exists' };
      data.weeks[wid] = { id: wid, fee: op.fee, target: op.target, teams: op.teams, squad: op.squad || {}, paid: {},
        games: [{ k: KEY.test(op.gk || '') ? op.gk : uid(), a: 0, b: 0, status: 'upcoming', goals: [] }] };
      return { ok: true };
    }
    var w = data.weeks[wid];
    if (!w) return { ok: false, why: 'no-night' };
    normalizeWeek(w, wid);
    var s = op.s === 'B' ? 'B' : 'A';
    switch (op.t) {
      case 'setNight':
        if (op.fee != null) w.fee = op.fee;
        if (op.target != null) w.target = op.target;
        if (op.teams) w.teams = op.teams;
        return { ok: true };
      case 'setSquad':
        if (!PID.test(op.pid || '')) return { ok: false, why: 'bad' };
        if (op.side === 'A' || op.side === 'B') w.squad[op.pid] = op.side; else { delete w.squad[op.pid]; delete w.paid[op.pid]; }
        return { ok: true };
      case 'setPaid':
        if (!w.squad[op.pid]) return { ok: false, why: 'not-playing' };
        if (op.paid) w.paid[op.pid] = true; else delete w.paid[op.pid];
        return { ok: true };
      case 'endNight': {
        // drop games that never got going (like the one that kicked off after the last win), keeping at least one
        var before = w.games.length, kept = w.games.filter(function (g) { return g.status === 'ft' || !isEmpty(g); });
        w.games = kept.length ? kept : w.games.slice(0, 1);
        var cut = before - w.games.length;
        w.games.forEach(function (g) { if (g.status === 'live') g.status = isEmpty(g) ? 'upcoming' : 'ft'; });
        return { ok: true, cut: cut };
      }
      case 'addGame': {
        if (w.games.length >= MAX_GAMES) return { ok: false, why: 'full' };
        var k = KEY.test(op.gk || '') && !findGame(w, op.gk) ? op.gk : uid();
        w.games.push({ k: k, a: 0, b: 0, status: 'upcoming', goals: [] });
        return { ok: true, gk: k };
      }
    }
    var g = findGame(w, op.gk);
    if (!g) return { ok: false, why: 'no-game' };
    var before = Math.max(score(g, 'A'), score(g, 'B'));
    switch (op.t) {
      case 'removeGame':
        if (w.games.length < 2) return { ok: false, why: 'last-game' };
        w.games.splice(w.games.indexOf(g), 1);
        return { ok: true };
      case 'setStatus':
        if (STATUSES.indexOf(op.status) < 0) return { ok: false, why: 'bad' };
        g.status = op.status;
        if (op.status === 'live') oneLive(w, g);
        return { ok: true };
      case 'addGoal': {
        var by = cleanBy(op.by);
        if (!by) return { ok: false, why: 'bad' };
        // A goal scored during play goes to the game that's live now: if another admin's goal has just won this game,
        // this one belongs to the next game, which has already kicked off.
        if (op.live && g.status === 'ft') { var lg = w.games.filter(function (y) { return y.status === 'live'; })[0]; if (lg) g = lg; }
        if (score(g, s) >= MAX_SCORE || g.goals.length >= MAX_GOALS) return { ok: false, why: 'full' };
        var gk = KEY.test(op.k || '') && !g.goals.some(function (x) { return x.k === op.k; }) ? op.k : uid();
        g.goals.push({ k: gk, s: s, by: by, as: cleanAs(op.as, by) });
        setScore(g, s, Math.max(score(g, s) + 1, count(g, s)));
        if (g.status !== 'live' && g.status !== 'ft') { g.status = 'live'; oneLive(w, g); }
        var ng = maybeWin(w, g, op.next);
        return { ok: true, gk: g.k, won: ng ? { gk: g.k, next: ng.k } : (g.status === 'ft' && targetOf(w) && Math.max(score(g, 'A'), score(g, 'B')) >= targetOf(w) ? { gk: g.k, next: null } : null) };
      }
      case 'creditGoal': { // name the scorer of a goal from before goals were recorded (the score doesn't change)
        var cb = cleanBy(op.by);
        if (!cb) return { ok: false, why: 'bad' };
        if (count(g, s) >= score(g, s)) return { ok: false, why: 'gone' };
        g.goals.unshift({ k: KEY.test(op.k || '') ? op.k : uid(), s: s, by: cb, as: cleanAs(op.as, cb) });
        return { ok: true };
      }
      case 'editGoal': {
        var x = g.goals.filter(function (y) { return y.k === op.k; })[0];
        if (!x) return { ok: false, why: 'gone' };
        var eb = cleanBy(op.by);
        if (!eb) return { ok: false, why: 'bad' };
        x.by = eb; x.as = cleanAs(op.as, eb);
        return { ok: true };
      }
      case 'deleteGoal': {
        var gs = s;
        if (op.k) {
          var di = -1;
          g.goals.forEach(function (y, i) { if (y.k === op.k) di = i; });
          if (di < 0) return { ok: false, why: 'gone' };
          gs = g.goals[di].s;
          g.goals.splice(di, 1);
        } else if (count(g, s) >= score(g, s)) return { ok: false, why: 'gone' }; // an older goal with no scorer
        setScore(g, gs, score(g, gs) - 1);
        return { ok: true, undo: undoWin(w, g, before) };
      }
      case 'popGoal': { // the − button: take off that team's most recent goal
        if (!score(g, s)) return { ok: false, why: 'nothing' };
        var removed = null;
        for (var j = g.goals.length - 1; j >= 0; j--) if (g.goals[j].s === s) { removed = g.goals.splice(j, 1)[0]; break; }
        setScore(g, s, score(g, s) - 1);
        return { ok: true, removed: removed, undo: undoWin(w, g, before) };
      }
    }
    return { ok: false, why: 'unknown' };
  }

  return { apply: apply, normalizeWeek: normalizeWeek, cleanWeek: cleanWeek, targetOf: targetOf, isEmpty: isEmpty, uid: uid, MAX_GAMES: MAX_GAMES, PID: PID, KEY: KEY };
});
