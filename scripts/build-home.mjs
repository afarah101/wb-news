// Builds the homepage (index.html): the newest issue as the hero, the squad strip (data/players.json), the last result (loaded by home.js), videos (data/videos.json) and earlier issues (issues.json).
// It also makes the link-preview images (assets/og/). Vercel runs this on every deploy (vercel.json): npm ci, then this script.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SITE = 'https://wb-news.vercel.app'; // link previews (WhatsApp) need full addresses
const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const issues = JSON.parse(readFileSync(join(root, 'issues.json'), 'utf8'));

// ---------- checks: a bad entry stops the deploy instead of publishing a broken homepage ----------
function check(ok, msg) { if (!ok) { console.error('build-home: ' + msg); process.exit(1); } }
const text = (v) => typeof v === 'string' && v.trim() !== '';
const file = (p) => text(p) && !p.startsWith('/') && !p.includes('..') && !p.includes(':') && existsSync(join(root, p));
check(Array.isArray(issues) && issues.length > 0, 'issues.json has no issues');
issues.forEach((it, i) => {
  const at = `issues.json entry ${i + 1} (${it?.slug ?? 'no slug'}): `;
  check(/^\d{4}-\d{2}-\d{2}$/.test(it.date) && !Number.isNaN(Date.parse(it.date)), at + 'date must be YYYY-MM-DD');
  check(text(it.slug) && text(it.type) && text(it.title), at + 'slug, type and title are needed');
  check(text(it.displayTitle) && it.displayTitle.toLowerCase() === it.title.toLowerCase(), at + 'displayTitle must be the title in sentence case, same words');
  check(typeof it.standfirst === 'string', at + 'standfirst must be text ("" when the issue has none)');
  check(Array.isArray(it.stories) && it.stories.length > 0 && it.stories.every(text), at + 'stories must list at least one story');
  check(file(`issues/${it.slug}/index.html`), at + `issues/${it.slug}/index.html is missing`);
  check(file(it.cover?.src), at + 'cover.src must point at an image in this repo');
  const f = it.cover.focus;
  check(f === undefined || (Array.isArray(f) && f.length === 2 && f.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)), at + 'cover.focus must be [x, y], each from 0 to 1');
  if (it.video) {
    check(file(it.video.src) && file(it.video.poster), at + 'video.src and video.poster must point at files in this repo');
    check(Number.isFinite(it.video.duration) && it.video.duration > 0, at + 'video.duration must be the length in seconds');
  }
  check(i === 0 || it.date < issues[i - 1].date, at + 'issues must be listed newest first'); // the menu reads the same order
});

// ---------- link-preview images: a 1200x630 JPG of each cover, centred on cover.focus ([x, y] from 0 to 1, default the middle) ----------
// Made on every build (Vercel included), so they are not committed.
const OG = { w: 1200, h: 630, max: 300 * 1024 };
const og = (it) => `assets/og/${it.date}.jpg`;
const clamp = (n, max) => Math.min(Math.max(Math.round(n), 0), max);
mkdirSync(join(root, 'assets/og'), { recursive: true });
for (const it of issues) {
  const src = join(root, it.cover.src), out = join(root, og(it));
  const [fx, fy] = it.cover.focus ?? [0.5, 0.5];
  const meta = await sharp(src).metadata();
  const { width, height } = meta.autoOrient ?? meta; // autoOrient: the size after a phone photo's rotation is applied
  const k = Math.max(OG.w / width, OG.h / height), w = Math.ceil(width * k), h = Math.ceil(height * k);
  await sharp(src).autoOrient().resize(w, h)
    .extract({ left: clamp(w * fx - OG.w / 2, w - OG.w), top: clamp(h * fy - OG.h / 2, h - OG.h), width: OG.w, height: OG.h })
    .jpeg({ quality: 82 }).toFile(out);
  check(statSync(out).size <= OG.max, `${og(it)} is over 300 KB`);
}

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const part = (it, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(it.date + 'T00:00:00Z'));
const dayMonth = (it) => `${part(it, { day: 'numeric' })} ${part(it, { month: 'short' })}`;
const shortDate = (it) => `${dayMonth(it)} ${part(it, { year: 'numeric' })}`;
const longDate = (it) => `${part(it, { weekday: 'long' })} ${part(it, { day: 'numeric' })} ${part(it, { month: 'long' })} ${part(it, { year: 'numeric' })}`;
const clock = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const story = (it) => `issues/${esc(it.slug)}/#story`; // #story opens the 5 Nov page on its article; other pages ignore it
const lines = (a) => a.filter(Boolean).join('\n');
// the photo slots crop to their own shape: hold the crop on cover.focus so the subject stays in frame
const focus = (it) => { const [x, y] = it.cover.focus ?? [0.5, 0.5]; return ` style="object-position:${Math.round(x * 100)}% ${Math.round(y * 100)}%"`; };

// ---------- data for the homepage (read only) ----------
// data/players.json feeds the squad strip; data/videos.json the video row: [{ "title", "date": "YYYY-MM-DD", "src", "poster", "duration" }]
const players = JSON.parse(readFileSync(join(root, 'data/players.json'), 'utf8')).players.filter((p) => p && typeof p.id === 'string' && p.id);
const videos = JSON.parse(readFileSync(join(root, 'data/videos.json'), 'utf8'));
check(Array.isArray(videos), 'data/videos.json must be a list ([] when there are no videos)');
videos.forEach((v, i) => {
  const at = `data/videos.json entry ${i + 1}: `;
  check(text(v.title) && /^\d{4}-\d{2}-\d{2}$/.test(v.date), at + 'title and date (YYYY-MM-DD) are needed');
  check(file(v.src) && file(v.poster), at + 'src and poster must point at files in this repo');
  check(Number.isFinite(v.duration) && v.duration > 0, at + 'duration must be the length in seconds');
});
const SQUAD_PHOTO = /^assets\/squad\/([a-z0-9-]+)\.png$/;
const coverMeta = await sharp(join(root, issues[0].cover.src)).metadata();
const coverSize = coverMeta.autoOrient ?? coverMeta;

// ---------- the page ----------
const latest = issues[0];
const previous = issues.slice(1);
const name = `Western Ballers FC — ${latest.displayTitle}`;
const image = `${SITE}/${og(latest)}`;
const sha = process.env.VERCEL_GIT_COMMIT_SHA;
const summary = (it) => it.standfirst || it.stories.slice(1, 3).join(' · ');
const playerCard = (p) => {
  const m = SQUAD_PHOTO.exec(typeof p.photo === 'string' ? p.photo : '');
  const img = m
    ? `<picture><source type="image/avif" srcset="assets/squad/480/${esc(m[1])}.avif"><img src="${esc(p.photo)}" width="480" height="600" alt="" loading="lazy" decoding="async"></picture>`
    : '<img src="assets/squad/placeholder.svg" width="480" height="600" alt="" loading="lazy" decoding="async">';
  return `        <li><a class="hp-player" href="squad/#${esc(p.id)}">${img}<span>${esc(p.name)}</span></a></li>`;
};

const html = `<!DOCTYPE html>
<!-- Built by scripts/build-home.mjs from issues.json, data/players.json and data/videos.json. Do not edit this file by hand. -->
<html lang="en-GB" data-issue="${esc(latest.slug)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="scripts/build-home.mjs${sha ? ' @ ' + esc(sha.slice(0, 7)) : ''}">
${lines([
  `<meta name="description" content="${esc(latest.standfirst || latest.displayTitle)}">`,
  '<meta property="og:site_name" content="Western Ballers FC">',
  '<meta property="og:type" content="website">',
  `<meta property="og:url" content="${SITE}/">`,
  `<meta property="og:title" content="${esc(name)}">`,
  latest.standfirst && `<meta property="og:description" content="${esc(latest.standfirst)}">`,
  `<meta property="og:image" content="${esc(image)}">`,
  `<meta property="og:image:width" content="${OG.w}">`,
  `<meta property="og:image:height" content="${OG.h}">`,
  `<meta property="og:image:alt" content="${esc(latest.displayTitle)}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:title" content="${esc(name)}">`,
  latest.standfirst && `<meta name="twitter:description" content="${esc(latest.standfirst)}">`,
  `<meta name="twitter:image" content="${esc(image)}">`,
])}
<title>${esc(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Jost:wght@700;900&display=swap">
<link rel="stylesheet" href="assets/issue.css">
<link rel="stylesheet" href="home.css">
<link rel="canonical" href="${SITE}/">
<link rel="icon" href="favicon.ico" sizes="32x32">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/icon-180.png">
</head>
<body>

<header class="top">
  <div class="top-in">
    <div class="lead">
      <button class="icon-btn menu" id="menu" type="button" aria-label="Open issues menu" aria-expanded="false" aria-controls="drawer">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <a class="brand" href="./">
        <img src="crest.png" width="40" height="49" alt="Western Ballers FC crest">
        <span><b>Western Ballers FC</b><small>THURSDAY NIGHT FOOTBALL</small></span>
      </a>
    </div>
    <div class="tags"><span class="pill">${esc(latest.type.toUpperCase())}</span><span>THURSDAY SESSION</span><span>${esc(dayMonth(latest).toUpperCase())}</span></div>
  </div>
</header>

<main class="hp">
  <section class="hp-hero" aria-labelledby="hp-title">
    <img class="hp-hero-img" src="${esc(latest.cover.src)}" width="${coverSize.width}" height="${coverSize.height}" alt="" fetchpriority="high"${focus(latest)}>
    <div class="hp-hero-txt">
      <p class="hp-eyebrow"><time datetime="${esc(latest.date)}">${esc(longDate(latest))}</time> · ${esc(latest.type)}</p>
      <h1 id="hp-title">${esc(latest.title)}</h1>
      <a class="hp-btn" href="${story(latest)}">Read issue</a>
    </div>
  </section>

  <section class="hp-sec" aria-labelledby="hp-squad">
    <div class="hp-head"><h2 id="hp-squad">The squad</h2><a href="squad/">All players</a></div>
    <ul class="hp-strip">
${players.map(playerCard).join('\n')}
    </ul>
  </section>

  <section class="hp-sec hp-result" aria-labelledby="hp-res">
    <div class="hp-head"><h2 id="hp-res">Last result</h2><a href="match/">Match Centre</a></div>
    <div class="hp-result-box" data-result aria-live="polite"><p class="hp-empty">Checking the last result…</p></div>
    <noscript><p class="hp-empty">No result yet</p></noscript>
  </section>
${lines([
  videos.length > 0 && `
  <section class="hp-sec" aria-labelledby="hp-vid">
    <div class="hp-head"><h2 id="hp-vid">Latest videos</h2></div>
    <div class="hp-videos">
${videos.map((v) => `      <figure class="hp-video">
        <video controls playsinline preload="none" poster="${esc(v.poster)}" src="${esc(v.src)}" aria-label="${esc(v.title)}"></video>
        <figcaption><b>${esc(v.title)}</b><time datetime="${esc(v.date)}">${esc(shortDate(v))}</time> · ${clock(v.duration)}</figcaption>
      </figure>`).join('\n')}
    </div>
  </section>`,
  previous.length > 0 && `
  <section class="hp-sec" aria-labelledby="hp-iss">
    <div class="hp-head"><h2 id="hp-iss">Earlier issues</h2></div>
    <ol class="hp-issues">
${previous.map((it) => `      <li><a class="hp-issue" href="${story(it)}">
        <span class="hp-issue-meta"><time datetime="${esc(it.date)}">${esc(shortDate(it))}</time><span class="hp-tag">${esc(it.type)}</span></span>
        <h3>${esc(it.displayTitle)}</h3>
        ${summary(it) ? `<p>${esc(summary(it))}</p>` : ''}
      </a></li>`).join('\n')}
    </ol>
  </section>`,
])}

  <footer class="foot">
    <div class="foot-brand"><img src="crest.png" width="32" height="39" alt=""><span><b>Western Ballers FC</b><small>THURSDAY NIGHT FOOTBALL</small></span></div>
  </footer>
</main>

<script src="assets/menu.js"></script>
<script src="home.js"></script>
</body>
</html>
`;

writeFileSync(join(root, 'index.html'), html);
console.log(`build-home: index.html now leads with ${latest.slug} "${latest.title}" (${players.length} players, ${videos.length} videos, ${previous.length} earlier issues)`);
