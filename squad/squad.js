/* Squad page: player cards grouped by line, and a profile view opened by #player-id.
   data/players.json is the only source of player data; nothing about a player is written here.
   Every value goes in with textContent, and an empty value shows as a dash. */
(function () {
  var root = new URL('..', document.currentScript.src); // site root: this file lives in /squad/
  var listView = document.querySelector('[data-view="list"]');
  var profileView = document.querySelector('[data-view="profile"]');
  var groupsBox = document.querySelector('[data-groups]');
  var baseTitle = document.title;

  var GROUPS = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards']; // page order; empty groups are hidden
  var POSITIONS = {
    GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back',
    CDM: 'Defensive Midfielder', CM: 'Central Midfielder', CAM: 'Attacking Midfielder', LW: 'Left Winger', RW: 'Right Winger', ST: 'Striker'
  };
  var DASH = '—';
  var PLACEHOLDER = 'assets/squad/placeholder.svg'; // shown when a player has no photo, or the photo fails to load

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (typeof text === 'string') e.textContent = text;
    return e;
  }
  function shown(v) { return typeof v === 'string' && v.trim() !== '' ? v : DASH; }
  function positionName(code) { return POSITIONS[code] || shown(code); }
  function photo(p, cls, alt, eager) {
    var img = el('img', cls);
    img.addEventListener('error', function () { img.src = new URL(PLACEHOLDER, root).href; }, { once: true });
    img.src = new URL(shown(p.photo) === DASH ? PLACEHOLDER : p.photo, root).href;
    img.alt = alt;
    img.width = 600;
    img.height = 750;
    img.decoding = 'async';
    if (!eager) img.loading = 'lazy';
    return img;
  }

  var players = [];  // in page order: by group, then as listed in players.json
  var byId = {};

  // ---------- list view: one section per group, one card per player ----------
  function renderList() {
    groupsBox.textContent = '';
    GROUPS.forEach(function (group) {
      var inGroup = players.filter(function (p) { return p.group === group; });
      if (!inGroup.length) return;
      var section = el('section', 'sq-group');
      var h2 = el('h2');
      h2.append(el('span', '', group), el('small', '', String(inGroup.length)));
      var ul = el('ul', 'sq-grid');
      inGroup.forEach(function (p) {
        var a = el('a', 'sq-card');
        a.href = '#' + p.id;
        a.id = 'card-' + p.id;
        var txt = el('span', 'sq-txt');
        txt.append(el('b', 'sq-name', shown(p.name)), el('span', 'sq-pos', positionName(p.position)), el('span', 'sq-born', shown(p.birthplace)));
        a.append(photo(p, 'sq-img', ''), txt);
        var li = el('li');
        li.append(a);
        ul.append(li);
      });
      section.append(h2, ul);
      groupsBox.append(section);
    });
  }

  // ---------- profile view ----------
  function tile(label, value) {
    var d = el('div', 'sq-tile');
    d.append(el('dt', '', label), el('dd', '', value));
    return d;
  }
  function navLink(p, cls, label) {
    var a = el('a', cls);
    a.href = '#' + p.id;
    a.append(el('small', '', label), el('span', '', shown(p.name)), el('time', '', positionName(p.position)));
    return a;
  }
  function renderProfile(p) {
    var i = players.indexOf(p);
    var prev = players[(i - 1 + players.length) % players.length];
    var next = players[(i + 1) % players.length];
    profileView.textContent = '';

    var back = el('a', 'sq-back', '← All players');
    back.href = '#';

    var hero = el('div', 'sq-hero');
    var txt = el('div', 'sq-hero-txt');
    var h1 = el('h1', '', shown(p.name));
    h1.tabIndex = -1;
    txt.append(el('p', 'sq-hero-kick', shown(p.group).replace(/s$/, '') + ' · ' + positionName(p.position)), h1,
      el('p', 'sq-hero-born', shown(p.birthplace)));
    hero.append(photo(p, 'sq-hero-img', shown(p.name), true), txt);

    var tiles = el('dl', 'sq-tiles');
    tiles.append(
      tile('Position', positionName(p.position)),
      tile('From', shown(p.birthplace)),
      tile('Signed for WB', shown(p.signedFor)),
      tile('Fun Fact', shown(p.funFact))
    );

    profileView.append(back, hero, tiles);

    // fakeStat: text, or {label, value}; anything empty hides the row
    var fs = p.fakeStat;
    var statLabel = fs && typeof fs === 'object' ? shown(fs.label) : 'Totally real stat';
    var statValue = fs && typeof fs === 'object' ? fs.value : fs;
    if ((typeof statValue === 'string' && statValue.trim() !== '') || typeof statValue === 'number') {
      var row = el('p', 'sq-stat');
      row.append(el('b', '', statLabel), el('span', '', String(statValue)));
      profileView.append(row);
    }

    var nav = el('nav', 'issue-nav sq-pn');
    nav.setAttribute('aria-label', 'Other players');
    nav.append(navLink(prev, 'prev', '← Previous player'), navLink(next, 'next', 'Next player →'));
    profileView.append(nav);
  }

  // ---------- routing: #player-id opens a profile, anything else shows the squad ----------
  var lastId = '';
  function route() {
    var id = decodeURIComponent(location.hash.slice(1));
    var p = byId[id];
    if (p) {
      renderProfile(p);
      listView.hidden = true;
      profileView.hidden = false;
      document.title = shown(p.name) + ' — ' + baseTitle;
      window.scrollTo(0, 0);
      profileView.querySelector('h1').focus({ preventScroll: true });
      lastId = id;
    } else {
      profileView.hidden = true;
      profileView.textContent = '';
      listView.hidden = false;
      document.title = baseTitle;
      var card = lastId && document.getElementById('card-' + lastId);
      if (card) { card.scrollIntoView({ block: 'center' }); card.focus({ preventScroll: true }); }
      lastId = '';
    }
  }

  // arrow keys step through profiles
  document.addEventListener('keydown', function (e) {
    if (profileView.hidden || e.altKey || e.metaKey || e.ctrlKey || document.documentElement.classList.contains('open')) return;
    var link = e.key === 'ArrowLeft' ? profileView.querySelector('.sq-pn .prev') : e.key === 'ArrowRight' ? profileView.querySelector('.sq-pn .next') : 0;
    if (link) { e.preventDefault(); location.hash = link.getAttribute('href'); }
  });

  fetch(new URL('data/players.json', root))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var list = Array.isArray(data && data.players) ? data.players : [];
      GROUPS.forEach(function (g) {
        list.forEach(function (p) { if (p && p.group === g && typeof p.id === 'string' && p.id) players.push(p); });
      });
      players.forEach(function (p) { byId[p.id] = p; });
      if (!players.length) throw new Error('no players');
      renderList();
      route();
      window.addEventListener('hashchange', route);
    })
    .catch(function () {
      groupsBox.textContent = '';
      groupsBox.append(el('p', 'sq-msg', 'The squad could not load. Probably stuck in traffic on the A40.'));
    });
})();
