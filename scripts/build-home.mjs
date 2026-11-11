// Builds the homepage (index.html) from issues.json: the newest issue leads, then the videos, then older issues.
// Vercel runs this on every deploy (vercel.json). To run it yourself: node scripts/build-home.mjs [site folder]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
// ffmpeg makes them wherever it is installed (your machine). Vercel has no ffmpeg, so there the committed files are used.
const OG = { w: 1200, h: 630, max: 300 * 1024 };
const og = (it) => `assets/og/${it.date}.jpg`;
let ffmpeg = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { ffmpeg = false; }
function jpegSize(buf) { // [width, height] from the JPEG frame header
  for (let i = 2; i + 9 < buf.length && buf[i] === 0xff; i += 2 + buf.readUInt16BE(i + 2)) {
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
  }
  return [];
}
issues.forEach((it) => {
  const out = join(root, og(it));
  if (ffmpeg) {
    const [fx, fy] = it.cover.focus ?? [0.5, 0.5];
    mkdirSync(dirname(out), { recursive: true });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(root, it.cover.src), '-vf',
      `scale=${OG.w}:${OG.h}:force_original_aspect_ratio=increase:flags=lanczos,` +
      `crop=${OG.w}:${OG.h}:clip(iw*${fx}-${OG.w / 2}\\,0\\,iw-${OG.w}):clip(ih*${fy}-${OG.h / 2}\\,0\\,ih-${OG.h})`,
      '-frames:v', '1', '-q:v', '2', '-map_metadata', '-1', '-fflags', '+bitexact', out]);
  }
  check(existsSync(out), `${og(it)} is missing: run this script on a machine with ffmpeg, then commit the file`);
  const [w, h] = jpegSize(readFileSync(out));
  check(w === OG.w && h === OG.h, `${og(it)} must be ${OG.w}x${OG.h}, found ${w}x${h}`);
  check(statSync(out).size <= OG.max, `${og(it)} is over 300 KB`);
});

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const part = (it, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(it.date + 'T00:00:00Z'));
const dayMonth = (it) => `${part(it, { day: 'numeric' })} ${part(it, { month: 'short' })}`;
const shortDate = (it) => `${dayMonth(it)} ${part(it, { year: 'numeric' })}`;
const longDate = (it) => `${part(it, { weekday: 'long' })} ${part(it, { day: 'numeric' })} ${part(it, { month: 'long' })} ${part(it, { year: 'numeric' })}`;
const clock = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const story = (it) => `issues/${esc(it.slug)}/#story`; // #story opens the 5 Nov page on its article; other pages ignore it
const lines = (a) => a.filter(Boolean).join('\n');

// ---------- the page ----------
const latest = issues[0];
const videos = issues.filter((it) => it.video);
const previous = issues.slice(1, 4);
const name = `Western Ballers FC — ${latest.title}`;
const image = `${SITE}/${og(latest)}`;
const sha = process.env.VERCEL_GIT_COMMIT_SHA;

const html = `<!DOCTYPE html>
<!-- Built by scripts/build-home.mjs from issues.json. Do not edit this file by hand: edit issues.json. -->
<html lang="en-GB" data-issue="${esc(latest.slug)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="scripts/build-home.mjs${sha ? ' @ ' + esc(sha.slice(0, 7)) : ''}">
${lines([
  `<meta name="description" content="${esc(latest.standfirst || latest.title)}">`,
  '<meta property="og:site_name" content="Western Ballers FC">',
  '<meta property="og:type" content="website">',
  `<meta property="og:url" content="${SITE}/">`,
  `<meta property="og:title" content="${esc(name)}">`,
  latest.standfirst && `<meta property="og:description" content="${esc(latest.standfirst)}">`,
  `<meta property="og:image" content="${esc(image)}">`,
  `<meta property="og:image:width" content="${OG.w}">`,
  `<meta property="og:image:height" content="${OG.h}">`,
  `<meta property="og:image:alt" content="${esc(latest.title)}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:title" content="${esc(name)}">`,
  latest.standfirst && `<meta name="twitter:description" content="${esc(latest.standfirst)}">`,
  `<meta name="twitter:image" content="${esc(image)}">`,
])}
<title>${esc(name)}</title>
<link rel="preload" href="https://fonts.gstatic.com/s/newsreader/v26/cY9AfjOCX1hbuyalUrK4397yjIJFJpc.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="https://fonts.gstatic.com/s/roboto/v51/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/issue.css">
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
        <img src="crest.png" alt="Western Ballers FC crest">
        <span><b>Western Ballers FC</b><small>THURSDAY NIGHT FOOTBALL</small></span>
      </a>
    </div>
    <div class="tags"><span class="pill">${esc(latest.type.toUpperCase())}</span><span>THURSDAY SESSION</span><span>${esc(dayMonth(latest).toUpperCase())}</span></div>
  </div>
</header>

<main class="home">
  <section class="home-lead">
    <a class="home-photo" href="${story(latest)}" tabindex="-1" aria-hidden="true"><img src="${esc(latest.cover.src)}" alt="" fetchpriority="high"></a>
    <div class="home-copy">
      <div class="kick">${esc(latest.type.toUpperCase())} · THURSDAY NIGHT FOOTBALL</div>
      <h1>${esc(latest.title)}</h1>
${lines([
  latest.standfirst && `      <p class="standfirst">${esc(latest.standfirst)}</p>`,
  `      <div class="meta"><b>Western Ballers Media</b><time datetime="${esc(latest.date)}">${esc(longDate(latest))}</time></div>`,
  '      <ol class="heads">',
  ...latest.stories.map((s, i) => `        <li><span>${String(i + 1).padStart(2, '0')}</span>${esc(s)}</li>`),
  '      </ol>',
])}
      <a class="cta" href="${story(latest)}">Read the full story
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    </div>
  </section>
${lines([
  videos.length > 0 && `
  <section class="home-row" aria-labelledby="watch">
    <h2 id="watch">Watch</h2>
    <div class="reel">
${videos.map((it) => `      <figure class="clip">
        <video controls playsinline preload="none" poster="${esc(it.video.poster)}" src="${esc(it.video.src)}" aria-label="${esc(it.title)}"></video>
        <figcaption><b>${esc(it.title)}</b><time datetime="${esc(it.date)}">${esc(shortDate(it))}</time> · ${clock(it.video.duration)}</figcaption>
      </figure>`).join('\n')}
    </div>
  </section>`,
  previous.length > 0 && `
  <section class="home-row" aria-labelledby="previous">
    <h2 id="previous">Previous issues</h2>
    <div class="prev">
${previous.map((it) => `      <a class="card" href="${story(it)}">
        <img src="${esc(it.cover.src)}" alt="" loading="lazy">
        <span><small>${esc(it.type)} · <time datetime="${esc(it.date)}">${esc(shortDate(it))}</time></small><b>${esc(it.title)}</b></span>
      </a>`).join('\n')}
    </div>
  </section>`,
])}

  <footer class="foot">
    <div class="foot-brand"><img src="crest.png" alt=""><span><b>Western Ballers FC</b><small>THURSDAY NIGHT FOOTBALL</small></span></div>
  </footer>
</main>

<script src="assets/menu.js"></script>
</body>
</html>
`;

writeFileSync(join(root, 'index.html'), html);
console.log(`build-home: index.html now leads with ${latest.slug} "${latest.title}" (${videos.length} videos, ${previous.length} previous issues)`);
