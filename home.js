/* Homepage: the last result and line-ups, read from /api/match. Any error, or no finished game yet, shows "No result yet".
   Names come from data/players.json, then from players added in the Match Centre. Every value goes in with textContent. */
(function () {
  var box = document.querySelector('[data-result]');
  if (!box) return;
  var root = new URL('.', document.currentScript.src);
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function empty() { box.textContent = ''; box.append(el('p', 'hp-empty', 'No result yet')); }
  function longDate(id) {
    var d = new Date(id + 'T00:00:00Z');
    return isNaN(d) ? id : new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  }
  function getJSON(u) { return fetch(new URL(u, root), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  Promise.all([getJSON('api/match'), getJSON('data/players.json').catch(function () { return { players: [] }; })]).then(function (res) {
    var data = res[0] && res[0].data, squad = (res[1] && res[1].players) || [];
    if (!data || !data.weeks) return empty();
    var names = {};
    Object.keys(data.formers || {}).forEach(function (id) { var f = data.formers[id] || {}; names[id] = f.nickname || f.name || id; });
    Object.keys(data.players || {}).forEach(function (id) { var p = data.players[id] || {}; names[id] = p.nickname || p.name || id; });
    squad.forEach(function (p) { if (p && p.id) names[p.id] = p.name; });

    // the newest night with at least one finished game
    var id = Object.keys(data.weeks).sort().reverse().filter(function (k) {
      var gs = data.weeks[k] && data.weeks[k].games;
      return Array.isArray(gs) && gs.some(function (g) { return g && g.status === 'ft'; });
    })[0];
    if (!id) return empty();
    var w = data.weeks[id], teams = w.teams || {};
    var tA = (teams.A && teams.A.name) || 'Bibs', tB = (teams.B && teams.B.name) || 'Non Bibs';
    var won = { A: 0, B: 0 }, lines = [];
    w.games.filter(function (g) { return g && g.status === 'ft'; }).forEach(function (g, i) {
      var a = +g.a || 0, b = +g.b || 0;
      if (a > b) won.A++; else if (b > a) won.B++;
      lines.push('Game ' + (i + 1) + ': ' + a + '–' + b);
    });

    box.textContent = '';
    var left = el('div');
    left.append(el('p', 'hp-date', longDate(id)));
    var score = el('div', 'hp-score');
    score.setAttribute('aria-label', tA + ' ' + won.A + ', ' + tB + ' ' + won.B + ', games won');
    score.append(el('span', null, tA), el('b', null, won.A + '–' + won.B), el('span', null, tB));
    left.append(score, el('p', 'hp-games', 'Games won. ' + lines.join(' · ')));

    var ups = el('div', 'hp-lineups');
    ['A', 'B'].forEach(function (side) {
      var col = el('div'), ul = el('ul');
      col.append(el('h3', null, side === 'A' ? tA : tB));
      Object.keys(w.squad || {}).filter(function (pid) { return w.squad[pid] === side; })
        .map(function (pid) { return names[pid] || pid; }).sort()
        .forEach(function (n) { ul.append(el('li', null, n)); });
      if (!ul.children.length) ul.append(el('li', null, '—'));
      col.append(ul); ups.append(col);
    });
    box.append(left, ups);
  }).catch(empty);
})();
