# Overnight tickets 2 (branch `feat/overnight-polish`)

One branch, one commit per ticket, one pull request to `main` with the label `needs-ahmed`. Nobody merges it overnight.
A ticket that hits a STOP rule is marked BLOCKED with the reason.

Shared rules: do not touch `match/`, `api/`, `data/`, `components/CrestHero.mjs`, `.env` or `CLAUDE.md`. Change no wording except the T1 transcript.

## T1 — 5 Nov transcript — DONE
- [x] Transcribed `post-match.m4a` locally with Whisper small (OpenAI weights, transformers.js ONNX q8 export `Xenova/whisper-small`). No cloud API.
  - Choice: faster-whisper installed, but its model host (huggingface.co) is blocked by this environment's network. The same weights came from the npm package `sts-whisper-small@1.0.0`, downloaded as data only (no install scripts).
  - Provenance check against the official `Xenova/whisper-small` repo (read through the Hugging Face connector): `encoder_model_quantized.onnx` 92,324,809 bytes and `decoder_model_merged_quantized.onnx` 156,780,950 bytes, both identical in size to the byte; `preprocessor_config.json` byte-identical.
  - Whisper tiny was tried first and rejected: two runs gave two different short sentences.
  - Whisper small gave the same text on 3 runs (greedy, timestamps, 5-beam search).
- [x] Names checked against `data/players.json` (21 profiles): the clip names no player. The key title "referee" is highlighted (rule 1).
- [x] Added under the audio in `issues/2026-11-05/index.html`, in `<details class="transcript"><summary>Read the transcript</summary>…</details>`. Styles in `assets/issue.css` (`.transcript`): 48px summary target, white text on the black panel, names in club orange (`--wb`, because `#B4470C` fails contrast on ink).
- Transcript: “…and blame your football. Football, body. The problem is that I think the referee is for them. The referee is for them.”
- **Unsure (for Ahmed):** the opening "…and blame your football. Football, body." The clip starts mid-sentence and the speech is fast over background noise. "body" may be a nickname or another word. No player name was guessed.
- Checks: transcript present (closed by default, 48px summary, opens on tap: frames in the PR evidence); the audit's missing-transcript P1 is re-checked in the final audit (see Verify).

## T2 — Photo sizes (all issues) — DONE
- [x] 16 `<img>` tags had no size: 10 crests (`crest.png`, 240×293) in mastheads, phone mock-ups and footers, plus 6 photos: `nappy.jpg` 1200×1600 (×2), `security.jpg` 1600×893, `soods-hanad.jpg` 896×1174. Each now has `width` and `height` read from the file with Pillow, inserted after `src`. No alt, src, class or text changed.
- Checks:
  - `<img>` without width/height in `issues/*/index.html`: **0** (was 16).
  - Slow-media CLS (images delayed 1.5s) on 5 Nov story: **0 / 0 / 0 / 0** at 375 / 390 / 1440, 0.0002 at 320 (was 0.48 / 0.69 / 0.50 / 0.15 on `main`).
  - innerText and the rendered box of every image, 7 page states × 4 widths: **56 of 56 files identical** before and after.

## T3 — Squad profile transition — DONE
- [x] `squad/squad.js`: opening a profile (tap, Enter or a `#player-id` link from the list) runs `document.startViewTransition`. The tapped card and the profile hero carry the same `view-transition-name` (`sq-player`), one in the old state and one in the new, so the card grows into the hero. Closing (back link, browser Back or Escape) shrinks the hero back into the same card.
  - The update waits up to 250ms for the profile photo to decode, so the hero does not arrive empty.
  - Profile to profile (Previous / Next, arrow keys) and the first load stay instant.
- [x] Without `startViewTransition`, or with `prefers-reduced-motion: reduce`, the change is instant (same code path as before). `squad/squad.css` also turns the view-transition animations off under reduced motion.
- [x] New: Escape closes an open profile (ignored while the issues menu is open).
- [x] Black cards, cut-outs, data and wording are unchanged. Timing: open 320ms, close 240ms (exit faster than entrance), house curve `--ease`.
- Checks (headless Chromium, Ragz card):
  - Frames list → mid-open → profile → mid-close → list, at 390 and 1440 (mid frames: transition paused at 50%). Animation found: `::view-transition-group(sq-player)` 320ms open, 240ms close, at both widths.
  - Focus: after opening, `H1 "Ragz"`; after Escape, `#card-ragz` (focus ring visible). Hash cleared, profile hidden.
  - CLS across open and close: 0 at 390, 0 at 1440. Console errors: 0.
  - Reduced motion: 0 view-transition animations, profile shown at once.
  - Reduced motion, 390 and 1440: `startViewTransition` called 0 times; 16ms after the tap the profile is fully shown (0 animations, focus on the H1); 16ms after Escape the list is back (0 animations, focus on `#card-ragz`).
  - Black cards, cut-outs and data unchanged: full-page screenshots of the Squad list and the Ragz profile at 390 and 1440 are pixel-identical to `main` (4 of 4).

## T4 — Page transitions — DONE
- [x] New `assets/transitions.css`: `@view-transition{navigation:auto}` inside `@media (prefers-reduced-motion:no-preference)`. The root cross-fade is 200ms. The masthead crest (`.brand img`, name `wb-crest`) has no animation, so it stays still and sharp while the page fades.
- [x] Linked only from the pages in the ticket: the homepage (`scripts/build-home.mjs` template, then `npm run build`), the 5 issues, `squad/index.html` and `404.html`.
  - Choice: not in `assets/issue.css`, because the Match Centre loads that file too. The Match Centre never opts in, and `match/` is untouched.
- [x] `assets/menu.js`: a page going to `/match/` skips its transition in `pageswap`. Without this, Chrome aborts the half-made transition and logs a console error on the Match Centre.
- [x] Reduced motion: no transition. Browsers without cross-document View Transitions ignore the rule and load pages normally.
- Checks (headless Chromium 390×844, mid frames at 50%):
  - home → issue: `::view-transition-group(root)` runs (old/new 200ms); 3 runs out of 3.
  - issue → squad: runs.
  - squad → Match Centre: no transition, no transition error.
  - Also checked: home → squad, issue → home, squad → home, issue → issue (previous / next), and the homepage scrolled 0 / 60 / 184 / 400px (crest docking): all transition.
  - Reduced motion: no transition on any navigation (`pagereveal` gives no `viewTransition` for squad → home and home → issue, at 390 and 1440).
  - `git diff main -- match/`: empty (byte-identical).
  - Console errors on the changed pages: 0. The only error in the chain is the Match Centre's `GET /api/match` 404, which happens because the local static server has no API; it is the same on `main` and unrelated to this ticket.
  - With T3, the crest also stays still while a squad card opens.

## Verify (all tickets)
Run on this branch (port 8080) against `main` (worktree, port 8081): 10 page states (home, 5 issues incl. both #story views, Squad, 404) × 320 / 375 / 390 / 1440.
- [x] Each ticket's checks with evidence: see T1–T4 above.
- [x] innerText diff vs `main`: 40 files, 4 differ, all on the 5 Nov story (one per width), each by exactly one added line: "Read the transcript" (the T1 summary; the transcript text shows when opened).
- [x] `npm run build` passes. Console errors: 0. Sideways scroll at 320 / 375: none. undefined / null / NaN: none. CLS (cold load, motion on): max 0.0011.
- [x] `/impeccable audit` on the changed pages: **0 P0, 0 P1**, 0 P2, 3 P3; score 16/20 (Good). The missing-transcript P1 is resolved (WCAG 1.2.1 passes; summary text 18.7:1, highlighted name 6.15:1 on the black panel; keyboard Enter/Space opens and closes it). The detector found no new findings compared with `main`. The 3 P3s all predate this branch: the profile h1 gets focus with no visible ring; `security.jpg` loads eagerly and is a JPEG; `#000` and the chrome sizes are outside the tokens. Also noted (not counted, needs a listen): the two Watch videos have no captions track.
- [x] `git diff --name-only main`: `404.html`, `assets/issue.css`, `assets/menu.js`, `assets/transitions.css`, `docs/tickets/OVERNIGHT-2.md`, `index.html` (build output), the 5 `issues/*/index.html`, `scripts/build-home.mjs`, `squad/index.html`, `squad/squad.css`, `squad/squad.js`. All are ticket files; `match/`, `api/`, `data/`, `components/CrestHero.mjs`, `.env` and `CLAUDE.md` are untouched.

## Open items for Ahmed (outside the four tickets)
- T1 wording: confirm the transcript's opening words, "…and blame your football. Football, body." No player name was guessed.
- Watch videos (`assets/video/2026-10-15.mp4`, `2026-10-22.mp4`): checked with the same Whisper small model. Both **do contain speech** (pitch-side shouting and dialogue over music, e.g. "All right, boys, boys, no time", "2-2", "It's three in three"). They have no `<track kind="captions">`, which WCAG 1.2.2 (level A) requires. This predates this branch, and captions are not part of these tickets, so nothing was changed. Suggested next ticket: a WebVTT captions file for each video.
- Already on `main` (audit P3): the profile heading shows no focus ring when it takes focus; `security.jpg` is a JPEG and loads eagerly.
