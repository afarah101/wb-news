// Parallax for the large photos: the homepage lead photo (.home-photo) and each issue's lead photo (.hero).
// The photo moves 12% slower than the page (6% on phones, --plx-k in issue.css) inside a frame that hides the overflow.
// Only the photo moves; text never does. Transform only, so scrolling causes no layout work.
// Where the browser supports CSS scroll-driven animation (animation-timeline: view()), issue.css moves the photo.
// Elsewhere this file moves it with requestAnimationFrame. With prefers-reduced-motion: reduce, nothing moves.
(function () {
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var frames = [];
  document.querySelectorAll('.home-photo > img, .hero > img').forEach(function (img) {
    var frame = img.parentNode;
    if (!frame.classList.contains('home-photo')) { // the hero figure also holds the caption: give the photo its own frame
      frame = document.createElement('span');
      img.parentNode.insertBefore(frame, img);
      frame.appendChild(img);
    }
    frame.classList.add('plx');
    frames.push(frame);
  });
  if (!frames.length) return;

  var css = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));
  var k = 0, vh = 0, ticking = false;

  // zoom just enough that no edge of the frame shows while that edge is on screen: 1 + k * (viewport - frame) / frame
  function measure() {
    k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--plx-k')) || 0;
    vh = window.innerHeight;
    frames.forEach(function (f) {
      var h = f.offsetHeight;
      if (!h) return; // hidden (e.g. the article behind an issue cover): measured again when it shows
      f.style.setProperty('--plx-s', (1 + Math.max(k * (vh - h) / h, 0) + 0.01).toFixed(4));
    });
    if (!css) update();
  }

  // fallback: offset = k * (viewport centre - frame centre), so the photo trails the page by k
  function update() {
    ticking = false;
    frames.forEach(function (f) {
      var r = f.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      f.style.setProperty('--plx-y', (k * (vh / 2 - (r.top + r.height / 2))).toFixed(2) + 'px');
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  measure();
  if (window.ResizeObserver) { var ro = new ResizeObserver(measure); frames.forEach(function (f) { ro.observe(f); }); }
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (!css) window.addEventListener('scroll', onScroll, { passive: true });
})();
