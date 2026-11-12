/* Issue menu (drawer C) and Previous / Next issue links. Both show displayTitle; the printed headline stays on the issue page.
   issues.json is the only list of issues: the drawer and the links are built from it.
   The page marks its own issue with <html data-issue="YYYY-MM-DD">. */
(function () {
  var root = document.documentElement;
  var current = root.getAttribute('data-issue');
  var base = new URL('..', document.currentScript.src); // site root: this file lives in /assets/
  var btn = document.getElementById('menu');
  if (!btn) return;

  var fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  var fmtLong = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  function part(d, k) { var o = { timeZone: 'UTC' }; o[k] = 'short'; return new Intl.DateTimeFormat('en-GB', o).format(d).toUpperCase(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function day(it) { return new Date(it.date + 'T00:00:00Z'); }
  function issueUrl(slug) { return new URL('issues/' + slug + '/', base).href; }

  // ---------- drawer markup ----------
  var scrim = el('div', 'scrim');
  var drawer = el('nav', 'drawer');
  drawer.id = 'drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'drawer-title');
  drawer.setAttribute('inert', '');
  drawer.innerHTML =
    '<div class="dr-head"><h2 id="drawer-title">Issues</h2>' +
    '<button class="icon-btn" type="button" aria-label="Close issues menu">' +
    '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    '</button></div><ol class="issues"><li><a class="issue" href="' + base.href + '"' + (location.pathname.replace(/index\.html$/, '') === base.pathname ? ' aria-current="page"' : '') + '>' +
    '<span class="db" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>' +
    '<span class="tt"><span class="tag"><span>Front page</span></span><span class="t">Home</span></span></a></li></ol>' +
    '<div class="season">THURSDAY SESSIONS · NEWEST FIRST</div><ol class="issues" data-sessions></ol>' +
    '<div class="season">THE TEAM</div><ol class="issues"><li><a class="issue" href="' + new URL('squad/', base).href + '"' +
    (location.pathname.replace(/index\.html$/, '') === new URL('squad/', base).pathname ? ' aria-current="page"' : '') + '>' +
    '<span class="db" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>' +
    '<span class="tt"><span class="tag"><span>Players</span></span><span class="t">Squad</span></span></a></li>' +
    '<li><a class="issue" href="' + new URL('match/', base).href + '"' +
    (location.pathname.replace(/index\.html$/, '') === new URL('match/', base).pathname ? ' aria-current="page"' : '') + '>' +
    '<span class="db" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>' +
    '<span class="tt"><span class="tag"><span>Scores &amp; subs</span></span><span class="t">Match Centre</span></span></a></li></ol>';
  document.body.append(scrim, drawer);
  var list = drawer.querySelector('[data-sessions]');
  var closeBtn = drawer.querySelector('.icon-btn');

  function renderDrawer(issues) {
    list.textContent = '';
    issues.forEach(function (it) {
      var d = day(it), cur = it.slug === current;
      var li = el('li'), a = el('a', 'issue');
      a.href = issueUrl(it.slug);
      if (cur) a.setAttribute('aria-current', 'page');
      var db = el('time', 'db');
      db.dateTime = it.date;
      db.setAttribute('aria-label', fmt.format(d));
      db.append(el('b', null, String(d.getUTCDate()).padStart(2, '0')), el('small', null, part(d, 'month')), el('small', null, part(d, 'weekday')));
      var tag = el('span', 'tag');
      tag.append(el('span', null, it.type));
      if (cur) tag.append(el('span', 'now', 'Current issue'));
      var tt = el('span', 'tt');
      tt.append(tag, el('span', 't', it.displayTitle));
      a.append(db, tt);
      li.append(a);
      list.append(li);
    });
  }

  // ---------- Previous / Next issue (issues.json is newest first) ----------
  function renderNav(issues) {
    var box = document.querySelector('[data-issue-nav]');
    var i = issues.findIndex(function (it) { return it.slug === current; });
    if (!box || i < 0) return;
    function link(it, cls, label) {
      var a = el('a', cls);
      a.href = issueUrl(it.slug);
      a.append(el('small', null, label), el('span', null, it.displayTitle), el('time', null, fmtLong.format(day(it))));
      box.append(a);
    }
    if (issues[i + 1]) link(issues[i + 1], 'prev', '← Previous issue');
    if (issues[i - 1]) link(issues[i - 1], 'next', 'Next issue →');
  }

  // ---------- the crest goes to the homepage; every footer gets the same site links ----------
  document.querySelectorAll('.brand').forEach(function (a) { a.href = base.href; });
  var here = location.pathname.replace(/index\.html$/, '');
  var footLinks = el('nav', 'foot-links');
  footLinks.setAttribute('aria-label', 'Site');
  function footLink(text, href) { var a = el('a', null, text); a.href = href; footLinks.append(a); return a; }
  footLink('Home', base.href);
  footLink('Squad', new URL('squad/', base).href);
  footLink('Match Centre', new URL('match/', base).href);
  var latest = footLink('Latest issue', base.href); // the homepage leads with the latest issue until issues.json says which one it is
  function markCurrent() {
    Array.prototype.forEach.call(footLinks.children, function (a) {
      if (new URL(a.href).pathname === here && !(a === latest && here === base.pathname)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  markCurrent();
  var foot = document.querySelector('.foot');
  if (foot) foot.append(footLinks);

  fetch(new URL('issues.json', base))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (issues) { renderDrawer(issues); renderNav(issues); if (issues[0]) latest.href = issueUrl(issues[0].slug); markCurrent(); })
    .catch(function () { list.append(el('li', 'err', 'The issue list could not load.')); });

  // ---------- open / close: transform + opacity only, Esc, backdrop, swipe-left, focus trap ----------
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function outside() {
    return Array.prototype.filter.call(document.body.children, function (n) { return n !== drawer && n !== scrim && n.tagName !== 'SCRIPT'; });
  }
  function isOpen() { return root.classList.contains('open'); }
  function open() {
    root.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    drawer.removeAttribute('inert');
    outside().forEach(function (n) { n.setAttribute('inert', ''); });
    closeBtn.focus();
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('inert', '');
    outside().forEach(function (n) { n.removeAttribute('inert'); });
    btn.focus();
  }
  // Back on a phone often restores the previous page from cache with the drawer still open
  window.addEventListener('pageshow', function (e) { if (e.persisted) close(); });
  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { // inert does most of the trap; this keeps Tab cycling inside the drawer
      var f = drawer.querySelectorAll('a[href],button'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // swipe left to close: follows the finger 1:1; a fling or a 30% drag closes it
  var x0 = null, y0 = 0, t0 = 0, dx = 0, dragging = false, dragged = false;
  drawer.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    x0 = e.clientX; y0 = e.clientY; t0 = e.timeStamp; dx = 0; dragging = false;
  });
  drawer.addEventListener('pointermove', function (e) {
    if (x0 === null) return;
    var mx = e.clientX - x0, my = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        dragging = true;
        drawer.classList.add('dragging');
        try { drawer.setPointerCapture(e.pointerId); } catch (_) {}
      } else if (Math.abs(my) > 8) { x0 = null; return; }
      else return;
    }
    dx = Math.min(0, mx);
    if (!reduce.matches) {
      drawer.style.transform = 'translateX(' + dx + 'px)';
      scrim.style.opacity = String(1 + dx / drawer.offsetWidth);
    }
  });
  function end(e) {
    if (x0 === null) return;
    var was = dragging, v = Math.abs(dx) / Math.max(1, e.timeStamp - t0);
    x0 = null; dragging = false;
    drawer.classList.remove('dragging');
    drawer.style.transform = '';
    scrim.style.opacity = '';
    if (was) {
      dragged = true;
      setTimeout(function () { dragged = false; }, 0);
      if (dx < -drawer.offsetWidth * 0.3 || v > 0.11) close();
    }
  }
  drawer.addEventListener('pointerup', end);
  drawer.addEventListener('pointercancel', end);
  drawer.addEventListener('click', function (e) { if (dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('touchstart', function () {}, { passive: true }); // iOS Safari applies :active only with a touch listener
})();
