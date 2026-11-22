// Homepage hero: one three.js football over giant "WB NEWS" letters, tied to scroll.
// One file, two uses: scripts/build-home.mjs imports heroCSS and hero() to write the markup into index.html,
// and the homepage loads this same file in the browser to run the 3D part. With no JS or no WebGL the SVG ball stays.

const THREE_URL = new URL('../assets/vendor/three.module.min.js', import.meta.url).href; // build-home.mjs copies it from node_modules

// ---------- build time: markup and styles (brand tokens from assets/issue.css only) ----------
export const heroCSS = `
.h3d{position:relative;background:var(--ink);color:var(--on-ink)}
.h3d.live{height:200vh;height:200svh} /* the stage pins for one screen of scroll */
.h3d-stage{position:relative;display:flex;flex-direction:column;height:100vh;height:100svh;overflow:hidden}
.h3d.live .h3d-stage{position:sticky;top:0}
.h3d canvas{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;opacity:0}
.h3d.gl canvas{opacity:1}
.h3d.gl .h3d-ball{display:none}
.h3d-word{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:0 .18em;font-family:var(--serif);font-weight:800;font-size:min(17vw,30vh);line-height:.8;letter-spacing:-.04em;user-select:none;-webkit-user-select:none}
.h3d-word span{display:block}
.h3d-news{color:var(--wb)}
.h3d-ball{position:absolute;inset:0;margin:auto;height:min(70%,50vw);aspect-ratio:1}
.h3d-ball .s{fill:none;stroke:var(--ink);stroke-width:1.6;stroke-linejoin:round} .h3d-ball .w{fill:var(--paper)} .h3d-ball .o{fill:var(--wb)}
.h3d-card{position:relative;z-index:2;align-self:flex-start;width:min(100% - 2 * var(--gutter),520px);margin:0 0 var(--s3) max(var(--gutter),calc((100% - var(--page)) / 2 + var(--gutter)));padding:var(--s3);background:var(--paper);color:var(--ink)}
.h3d-h{display:block;margin-top:var(--s1);font-family:var(--serif);font-weight:700;font-size:var(--t-h3);line-height:1.1;letter-spacing:-.015em;text-decoration:none;text-wrap:balance;overflow-wrap:anywhere}
.h3d-card .cta{margin-top:var(--s2)}
@media (hover:hover) and (pointer:fine){.h3d-h:hover{text-decoration:underline}}
@media (max-width:600px){.h3d-word{flex-direction:column;font-size:30vw;line-height:.78}}
`;

// Static ball (no JS, no WebGL): an orange centre pentagon, five edge pentagons beyond its corners, the seams between, clipped to a circle.
const pts = (cx, cy, r, a0) => Array.from({ length: 5 }, (_, k) => [cx + r * Math.cos(a0 + k * 1.2566), cy + r * Math.sin(a0 + k * 1.2566)]);
const poly = (p) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const near = (o, [x, y]) => o.reduce((b, p) => (Math.hypot(p[0] - x, p[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? p : b));
function ballSVG() {
  const up = -Math.PI / 2, inner = pts(50, 50, 15, up), seams = [];
  const centres = inner.map((_, k) => [50 + 44 * Math.cos(up + k * 1.2566), 50 + 44 * Math.sin(up + k * 1.2566)]);
  const outer = centres.map(([x, y], k) => pts(x, y, 13, up + k * 1.2566 + Math.PI)); // one corner points at the centre
  outer.forEach((o, k) => {
    const j = (k + 1) % 5;
    seams.push([inner[k], near(o, [50, 50])], [near(o, centres[j]), near(outer[j], centres[k])]); // hexagon edges
  });
  return `<svg class="h3d-ball" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="h3d-clip"><circle cx="50" cy="50" r="48"/></clipPath></defs>
      <circle class="w" cx="50" cy="50" r="48"/><g clip-path="url(#h3d-clip)">${[inner, ...outer].map((p) => `<polygon class="o s" points="${poly(p)}"/>`).join('')}${seams.map((s) => `<polyline class="s" points="${poly(s)}"/>`).join('')}</g>
      <circle class="s" cx="50" cy="50" r="48"/></svg>`;
}

// Values must be HTML-escaped by the caller (build-home.mjs has esc()).
export const hero = ({ href, kicker, title }) => `
<section class="h3d" aria-label="Latest issue">
  <div class="h3d-stage">
    <div class="h3d-word" aria-hidden="true"><span class="h3d-wb">WB</span><span class="h3d-news">NEWS</span>
      ${ballSVG()}
    </div>
    <div class="h3d-card">
      <div class="kick">${kicker}</div>
      <a class="h3d-h" href="${href}">${title}</a>
      <a class="cta" href="${href}">Read the full story
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>
  </div>
</section>`;

// ---------- browser: the 3D ball ----------
const clamp = (v) => Math.min(Math.max(v, 0), 1);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Truncated icosahedron painted onto an equirectangular canvas (SphereGeometry's own UV layout).
// A direction belongs to the face plane its ray hits first: the largest (dir · normal) / plane distance.
async function ballTexture(T, W, colors) {
  const H = W / 2, c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const g = (1 + Math.sqrt(5)) / 2, faces = [];
  const add = (x, y, z, pent) => { const l = Math.hypot(x, y, z); faces.push([x / l, y / l, z / l, pent ? 1 / 2.32744 : 1 / 2.26728, pent]); }; // plane distances for edge 1
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    add(0, a, b * g, 1); add(a, b * g, 0, 1); add(b * g, 0, a, 1); // 12 pentagons: icosahedron vertices
    add(a / g, 0, b * g, 0); add(0, a * g, b / g, 0); add(a * g, b / g, 0, 0); // 20 hexagons: icosahedron face centres
    for (const e of [-1, 1]) add(a, b, e, 0);
  }
  const [hex, pent, seam] = colors;
  let slice = performance.now();
  for (let j = 0; j < H; j++) {
    if (performance.now() - slice > 12) { await new Promise((r) => setTimeout(r)); slice = performance.now(); } // no long task: taps and scroll stay responsive
    const th = ((j + 0.5) / H) * Math.PI, st = Math.sin(th), y = Math.cos(th);
    for (let i = 0; i < W; i++) {
      const ph = ((i + 0.5) / W) * Math.PI * 2, x = -Math.cos(ph) * st, z = Math.sin(ph) * st;
      let best = -9, second = -9, bp = 0;
      for (const f of faces) {
        const s = (x * f[0] + y * f[1] + z * f[2]) * f[3];
        if (s > best) { second = best; best = s; bp = f[4]; } else if (s > second) second = s;
      }
      const k = smooth(0.0022, 0.0048, best - second), col = bp ? pent : hex, o = (j * W + i) * 4; // k = 0 on a seam
      for (let n = 0; n < 3; n++) d[o + n] = seam[n] + (col[n] - seam[n]) * k;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

async function start(section) {
  const stage = section.querySelector('.h3d-stage'), word = section.querySelector('.h3d-word');
  const wb = section.querySelector('.h3d-wb'), news = section.querySelector('.h3d-news'), card = section.querySelector('.h3d-card');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tilt = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // the card keeps the headline on screen even while the masthead pushes the stage's bottom below the fold
  const lift = (off) => { card.style.transform = `translate3d(0,${-off}px,0)`; };
  const docOff = () => Math.max(0, stage.getBoundingClientRect().top + scrollY + stage.offsetHeight - innerHeight);
  let resize = () => lift(docOff()); // static version; replaced once the ball runs
  new ResizeObserver(() => resize()).observe(stage);

  const probe = document.createElement('canvas').getContext('webgl2'); // three r185 needs WebGL 2
  if (!probe) return; // static SVG ball stays
  probe.getExtension('WEBGL_lose_context')?.loseContext();

  const T = await import(THREE_URL);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const css = getComputedStyle(document.documentElement), pen = document.createElement('canvas').getContext('2d');
  const rgb = (name) => { pen.fillStyle = css.getPropertyValue(name).trim(); const n = parseInt(pen.fillStyle.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }; // the canvas turns any opaque CSS colour (#fff too) into #rrggbb
  const tex = await ballTexture(T,innerWidth > 600 ? 2048 : 1024, [rgb('--paper'), rgb('--wb'), rgb('--ink')]);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 8;
  scene.add(new T.HemisphereLight(0xffffff, 0x2b2b2b, 1.4));
  const sun = new T.DirectionalLight(0xffffff, 2.4); sun.position.set(3, 4, 5); scene.add(sun);
  const pivot = new T.Group(), ball = new T.Mesh(new T.SphereGeometry(1, 64, 48), new T.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  pivot.add(ball); scene.add(pivot);
  stage.prepend(canvas);

  const L = { w: 1, h: 1, x: 0, y: 0, s: 1, half: 1, cardLift: 0 };
  const layout = () => {
    L.w = stage.clientWidth; L.h = stage.clientHeight;
    renderer.setSize(L.w, L.h, false);
    camera.aspect = L.w / L.h; camera.updateProjectionMatrix();
    L.half = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z; // half the view height in world units at z = 0
    const unit = L.h / (2 * L.half), r = word.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    L.x = ((r.left + r.width / 2 - sr.left) / L.w - 0.5) * 2 * L.half * camera.aspect; // the ball sits on the letters' centre
    L.y = (0.5 - (r.top + r.height / 2 - sr.top) / L.h) * 2 * L.half;
    L.s = Math.min(r.height * 0.7, L.w * 0.5) / (2 * unit);
    L.cardLift = card.offsetTop + card.offsetHeight / 2 - L.h / 2; // moves the card's centre to the stage's centre
  };

  let p = 0, tx = 0, ty = 0, px = 0, py = 0, raf = 0, onScreen = true, last = 0;
  const draw = (now) => {
    const t = now / 1000, f = Math.min((now - last) / 16.7, 6); // frames at 60 Hz since the last draw: same speed on 60 and 120 Hz screens
    last = now;
    const r = section.getBoundingClientRect(), goal = still ? 0 : clamp(-r.top / (r.height - L.h));
    p += (goal - p) * (1 - 0.8 ** f); if (Math.abs(goal - p) < 1e-4) p = goal;
    const roll = smooth(0, 0.7, p), drop = smooth(0.65, 1, p);
    const k = 1 - 0.92 ** f; tx += (px - tx) * k; ty += (py - ty) * k;
    pivot.position.set(L.x, L.y + (still ? 0 : Math.sin(t * 1.6) * 0.06 * (1 - roll)) - drop * 9, roll * 4);
    pivot.rotation.set(ty * 0.25, tx * 0.35, 0);
    pivot.scale.setScalar(L.s);
    ball.rotation.set(0.35 + p * Math.PI * 3, still ? 0.6 : t * 0.35, 0); // rolls toward the camera as p grows; scrolling up reverses it
    if (!still) {
      wb.style.transform = `translate3d(${-roll * L.w * 0.5}px,0,0)`;
      news.style.transform = `translate3d(${roll * L.w * 0.5}px,0,0)`;
      const off = Math.max(0, stage.getBoundingClientRect().bottom - innerHeight);
      lift(off + drop * (L.cardLift - off));
    }
    renderer.render(scene, camera);
  };
  const loop = (now) => { draw(now); raf = !still && onScreen && !document.hidden ? requestAnimationFrame(loop) : 0; };
  const wake = () => { if (!raf && !still && onScreen && !document.hidden) raf = requestAnimationFrame(loop); };

  try {
    if (!still) { // pin only once the ball can move; if the reader is already below the hero, keep what they see in place
      const ref = section.nextElementSibling, y0 = ref.getBoundingClientRect().top;
      section.classList.add('live');
      if (section.getBoundingClientRect().bottom < 0) scrollBy(0, ref.getBoundingClientRect().top - y0); // 0 when the browser's scroll anchoring already did it
    }
    layout();
    draw(performance.now());
    section.classList.add('gl');
  } catch (e) { // back to the static version: no pin over an empty screen
    section.classList.remove('live', 'gl'); canvas.remove(); lift(docOff());
    throw e;
  }
  resize = () => { layout(); if (still) { lift(docOff()); draw(performance.now()); } };
  if (still) return;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; wake(); }).observe(section);
  document.addEventListener('visibilitychange', wake);
  if (tilt) addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
  wake();
}

if (typeof document !== 'undefined') {
  const section = document.querySelector('.h3d');
  if (section) start(section).catch(() => {}); // any failure (no WebGL, blocked file): the static SVG ball stays
}
