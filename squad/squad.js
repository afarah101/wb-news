/* Squad page: player cards grouped by line, and a profile view opened by #player-id.
   data/players.json is the only source of player data; nothing about a player is written here.
   Every value goes in with textContent. An empty value shows as a dash on a card and is left out of the profile tiles. */
(function () {
  var root = new URL('..', document.currentScript.src); // site root: this file lives in /squad/
  var listView = document.querySelector('[data-view="list"]');
  var profileView = document.querySelector('[data-view="profile"]');
  var groupsBox = document.querySelector('[data-groups]');
  var baseTitle = document.title;

  var GROUPS = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards']; // page order; empty groups are hidden
  var POSITIONS = {
    GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back',
    CDM: 'Defensive Midfielder', CM: 'Central Midfielder', CAM: 'Attacking Midfielder', B2B: 'Box-to-Box Midfielder', LW: 'Left Winger', RW: 'Right Winger', ST: 'Striker'
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
  function hashId() { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; } } // a mangled address shows the squad, not an error
  function positionName(code) { return POSITIONS[code] || shown(code); }
  // Each squad photo assets/squad/<id>.png (600x750) has two AVIF copies made from it: assets/squad/<id>.avif at full size
  // for the profile, and assets/squad/480/<id>.avif (480x600) for the cards. A browser without AVIF, or a photo without
  // its copies, falls back to the PNG; a photo that fails altogether falls back to the placeholder.
  var SQUAD_PHOTO = /^assets\/squad\/([a-z0-9-]+)\.png$/;
  function photo(p, cls, alt, eager, small) {
    var pic = el('picture'), img = el('img', cls);
    var m = SQUAD_PHOTO.exec(typeof p.photo === 'string' ? p.photo : '');
    if (m) {
      var src = el('source');
      src.type = 'image/avif';
      src.srcset = new URL('assets/squad/' + (small ? '480/' : '') + m[1] + '.avif', root).href;
      pic.append(src);
    }
    img.addEventListener('error', function () {
      var s = pic.querySelector('source');
      if (s) s.remove(); // the AVIF copy is missing: the browser now loads the PNG below
      else if (img.getAttribute('src') !== new URL(PLACEHOLDER, root).href) img.src = new URL(PLACEHOLDER, root).href;
    });
    img.alt = alt;
    img.width = small ? 480 : 600;
    img.height = small ? 600 : 750;
    img.decoding = 'async';
    if (eager) img.fetchPriority = 'high'; else img.loading = 'lazy';
    pic.append(img);
    img.src = new URL(shown(p.photo) === DASH ? PLACEHOLDER : p.photo, root).href; // set last, inside the <picture>, so only one file is fetched
    return pic;
  }

  var players = [];  // in page order: by group, then as listed in players.json
  var byId = {};

  // ---------- list view: one section per group, one card per player ----------
  function renderList() {
    groupsBox.textContent = '';
    var first = byId[hashId()] ? 0 : 3; // the first row of cards loads straight away (unless a profile is opening instead), the rest as they scroll into view
    var n = 0;
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
        a.append(photo(p, 'sq-img', '', n++ < first, true), txt);
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
    // a tile with nothing to say is left out
    [['Position', positionName(p.position)], ['From', shown(p.birthplace)], ['Signed for WB', shown(p.signedFor)], ['Fun Fact', shown(p.funFact)]].forEach(function (t) {
      if (t[1] === DASH) return;
      var d = tile(t[0], t[1]);
      if (t[0] === 'Fun Fact') d.className += ' wide';
      tiles.append(d);
    });

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
    var id = hashId();
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
