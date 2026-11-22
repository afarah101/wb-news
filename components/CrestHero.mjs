// Crest hero for the homepage: the approved crest (assets/wb-crest.svg) inline above the lead story.
// It plays a ~2.2s opening once per browser session, then rides the scroll into the masthead logo spot.
// With prefers-reduced-motion, or without JavaScript, it is the finished crest and nothing moves.
// scripts/build-home.mjs mounts the three parts: crestHeroHead() in <head>, crestHero(svg) above the lead story,
// crestHeroScript() before </body>. Motion values are documented in DESIGN.md (Motion).

export const ANIME_DIST = 'node_modules/animejs/dist/bundles/anime.esm.min.js'; // the one file shipped
export const ANIME_VENDOR = 'assets/vendor/anime.esm.min.js'; // copied here on every build; not committed

// ---------- CSS: existing tokens only. The hero's box is fixed so nothing below it moves. ----------
const css = `
  .crest-hero{display:flex;justify-content:center;height:calc(var(--s10) * 2 + var(--s3));padding-top:var(--s3)}
  .ch-mark{display:block;height:calc(var(--s10) * 2);aspect-ratio:280/344}
  .ch-mark svg{position:relative;z-index:6;display:block;width:100%;height:100%;overflow:visible;transform-origin:0 0;pointer-events:none}
  .ch-mark #stars path,.ch-mark #monogram,.ch-mark #ribbon-text{transform-box:fill-box;transform-origin:50% 50%}
  @media (min-width:901px){
    .crest-hero{height:calc(var(--s10) * 4 + var(--s4));padding-top:var(--s4)}
    .ch-mark{height:calc(var(--s10) * 4)}
    .ch-js{scroll-padding-top:calc(var(--s10) + var(--s3))}
  }
  /* motion mode only (set in <head> before first paint): the masthead stays put so the crest has somewhere to dock */
  .ch-js{scroll-padding-top:calc(var(--s10) + var(--s1))} /* keyboard focus never lands under the pinned masthead */
  .ch-js .top{position:sticky;top:0;z-index:5;background:var(--paper)}
  .ch-js:not(.ch-docked) .brand img{visibility:hidden}
  .ch-docked .ch-mark svg{visibility:hidden}
  .ch-play:not(.ch-live) .ch-mark svg > g{opacity:0}
  .ch-hold .home-lead h1{opacity:0}
`;

// ---------- <head>: decide before first paint, so the finished crest never flashes and then hides ----------
// Failsafe: if the module has not started within 4s (blocked or slow script), drop every class: finished crest, visible headline.
const head = `(function(){var d=document.documentElement;try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var seen=false;try{seen=sessionStorage.getItem('wb-crest')==='1'}catch(e){}d.classList.add('ch-js');if(!seen)d.classList.add('ch-play','ch-hold');setTimeout(function(){if(!d.classList.contains('ch-live'))d.classList.remove('ch-js','ch-play','ch-hold')},4000)}catch(e){}})();`;

export const crestHeroHead = () => `<style>${css.replace(/\n\s*/g, '')}</style>\n<script>${head}</script>`;

export const crestHero = (svg) => `  <div class="crest-hero">
    <span class="ch-mark">${svg.trim()}</span>
  </div>`;

// ---------- client script: anime.js v4 (createTimeline, createDrawable, onScroll, splitText) ----------
const client = `
import { animate, createTimeline, createDrawable, onScroll, splitText, spring, stagger, utils } from './${ANIME_VENDOR}';
const d = document.documentElement;
const hero = document.querySelector('.crest-hero');
const mark = hero && hero.querySelector('.ch-mark');
const svg = mark && mark.querySelector('svg');
const logo = document.querySelector('.brand img');
const h1 = document.querySelector('.home-lead h1');
// start after the first paint and its busy task, so the opening's first frames are not held up
await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
// any failure: back to the finished crest and the plain headline
const fail = () => {
  d.classList.remove('ch-js', 'ch-play', 'ch-hold', 'ch-docked');
  [svg, ...svg.querySelectorAll('*'), ...h1.querySelectorAll('*')].forEach((n) => { n.removeAttribute('style'); n.removeAttribute('stroke-dasharray'); n.removeAttribute('stroke-dashoffset'); });
};
if (d.classList.contains('ch-js') && svg && logo && h1) try {
  d.classList.add('ch-live');
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };

  // lead headline: word by word, once
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    try {
      const { words } = splitText(h1, { words: true });
      utils.set(words, { opacity: 0, translateY: '0.3em' });
      d.classList.remove('ch-hold');
      animate(words, { opacity: 1, translateY: 0, duration: 520, delay: stagger(40), ease: 'out(4)' });
    } catch (e) { fail(); }
  };
  const revealOnEnter = () => (inView(h1) ? reveal() : onScroll({ target: h1, onEnter: reveal }));

  // opening, once per session
  if (d.classList.contains('ch-play')) {
    try { sessionStorage.setItem('wb-crest', '1'); } catch (e) {}
    const [shield] = createDrawable(svg.querySelector('#shield path'));
    const s = svg.querySelectorAll('#stars path');
    const mono = svg.querySelector('#monogram');
    const ribbon = svg.querySelector('#ribbon');
    const text = svg.querySelector('#ribbon-text');
    const drop = { opacity: [0, 1], translateY: [-40, 0], ease: spring({ bounce: 0.35, duration: 420 }) };
    utils.set(shield, { draw: '0 0' });
    utils.set(s, { opacity: 0 });
    utils.set(mono, { opacity: 0 });
    utils.set(ribbon, { clipPath: 'inset(0% 100% 0% 0%)' });
    utils.set(text, { opacity: 0 });
    const done = () => {
      ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'].forEach((t) => removeEventListener(t, skip));
      d.classList.remove('ch-play');
      performance.mark('crest-opening-end');
      revealOnEnter();
    };
    performance.mark('crest-opening-start');
    const opening = createTimeline({ defaults: { ease: 'out(4)' }, onComplete: done })
      .add(shield, { draw: ['0 0', '0 1'], duration: 700, ease: 'inOut(2)' }, 0)
      .add([s[0], s[4]], drop, 500)
      .add([s[1], s[3]], drop, 640)
      .add(s[2], drop, 780)
      .add(mono, { opacity: [0, 1], translateY: [28, 0], duration: 700 }, 900)
      .add(ribbon, { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 600, ease: 'inOut(3)' }, 1400)
      .add(text, { opacity: [0, 1], duration: 400, ease: 'linear' }, 1800);
    function skip() { if (!opening.completed) opening.complete(); }
    ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'].forEach((t) => addEventListener(t, skip, { passive: true }));
  } else if (!inView(h1)) {
    d.classList.add('ch-hold');
    revealOnEnter();
  } else {
    revealed = true;
  }

  // scroll: the crest shrinks into the masthead logo spot over the hero's height, 1:1 with the scroll
  const top = () => mark.getBoundingClientRect().top + scrollY;
  let g;
  const measure = () => {
    const m = mark.getBoundingClientRect(), l = logo.getBoundingClientRect(), dist = hero.offsetHeight;
    g = { dist, x: l.left - m.left, y: l.top - (m.top + scrollY) + dist, k: l.width / m.width };
  };
  measure();
  const dock = animate(svg, {
    translateX: () => g.x, translateY: () => g.y, scale: () => g.k,
    ease: 'linear', duration: 1000,
    onRender: (a) => d.classList.toggle('ch-docked', a.progress >= 0.999),
    autoplay: onScroll({ target: mark, enter: () => ({ target: 0, container: top() }), leave: () => ({ target: 0, container: top() - g.dist }), sync: true }),
  });
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { measure(); dock.refresh(); }, 150); }, { passive: true });
} catch (e) {
  fail();
} else if (d.classList.contains('ch-js')) {
  d.classList.remove('ch-js', 'ch-play', 'ch-hold');
}
`;

export const crestHeroScript = () => `<script type="module">${client.trim()}</script>`;
