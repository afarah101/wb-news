# Western Ballers FC news (wb-news): house rules

Read this before any edit. Where another doc in this repo says something different, this file wins.

## Ahmed's rules

1. **Orange highlights.** Player names, nicknames and key titles are always highlighted in club orange.
   - Body text, sub-headings (`h2`), callouts and captions: `<span class="n">Sudz</span>`. The rule is `.n{color:var(--wb-text);font-weight:600}` at `assets/issue.css:28`. `--wb-text` is `#B4470C`.
   - Headlines (the article `h1` and the cover's phone-picture headline `.ph-h`): `<em>Sudz</em>`. The stylesheet colours `em` there in the same orange and keeps the headline's weight.
   - A possessive keeps its apostrophe outside the tag: `<span class="n">Skinz</span>'`.
   - Key titles are roles and named things the story leans on, as the 5 Nov issue does: `HR`, `physio`, `referee`, `security`.
   - Two story lists cannot take a highlight yet: the cover's `.heads` list (its layout gives every child element its own column) and the homepage list (built from `issues.json` as plain text). Leave them plain.
2. **New issues** follow `NEW-ISSUE.md` and copy the latest issue's template (cover page plus article, as in `issues/2026-11-12/`). Source text is used word-for-word.
3. **Tone:** satirical team news in the style of Sky Sports / The Athletic. British English.
4. **Player data** lives only in `data/players.json`. Fun facts are plain text, no HTML. Keep the `id` when a player is renamed.
5. **Squad cards** use the black design and the existing cut-outs. A new player uses the placeholder (`"photo": ""`) until a photo exists.
6. **Workflow:** work on a branch, open a pull request, Ahmed merges. Never push `main`. Mohammed works on `mo-dev`. Previews share the live database: use TEST data only.
7. **Before any pull request:** `npm run build` passes, no "undefined", "null" or "NaN" shows on any page, and no page scrolls sideways at 375px.
8. Player names: data/players.json is the source of truth. In any new or edited content (issues, fun facts, captions, titles, alt text), automatically change any name that clearly matches a profile to the exact profile name, and highlight it orange. If a name could match more than one player, or matches none, do not guess: list it for Ahmed before opening a PR.

## Brand

Tokens live only in `/tokens.css`, linked first on every page. Never write a raw colour, font or radius anywhere else; add a token.

- **Colours (Swoosh Bold, club orange kept):** `--ink` #111111 text and black panels; `--ink-hover` #292929; `--muted` #707072 secondary text; `--bg` #FFFFFF; `--surface` #F5F5F5 grey panels; `--border` #E5E5E5; `--wb` #F26B1D club orange for fills, the crest and highlights on dark only, never small text on white (3.05:1); `--wb-text` #B4470C orange text on light (5.46:1), used by the name highlight `.n`; `--success` #128A09; `--error` #D43F21. Supporting tokens in the same file: `--on-ink`, `--on-ink-2`, `--ink-rule`, `--black`, `--success-bg`, `--error-bg`, `--whatsapp`, scrims, shadows, tints, `--mask`.
- **Fonts:** Jost 700/900 (`--font-head`) for headlines: uppercase, letter-spacing -0.02em, line-height 0.95. Card titles, story rows and figures use Jost 700 in normal case. Inter 400/500 (`--font-body`) for everything else; bold text in body copy is 500. Loaded from Google Fonts with preconnect and `display=swap`.
- **Spacing:** the 4px scale 4, 8, 12, 16, 24, 32, 48, 64, 96 (`--half`, `--s1`, `--s1h`, `--s2`, `--s3`, `--s4`, `--s5`/`--s6`, `--s7`/`--s8`, `--s10`).
- **Radius:** 0 for images and the hero; `--r-chip` 8px for inputs and chips; `--r-btn` 30px for buttons.
- **Contrast:** body text at least 4.5:1, large text at least 3:1. Text over photos sits on a black tag or a scrim and is measured on the rendered page.
- **Homepage** (`scripts/build-home.mjs`, `home.css`, `home.js`): hero (newest cover), squad strip (`data/players.json`), last result (`/api/match`, "No result yet" when there is none), latest videos (`data/videos.json`, hidden when empty), earlier issues, footer.

## Rules already in NEW-ISSUE.md

- `issues.json` is the only list of issues. The menu, Previous / Next, the homepage and the link-preview image are all built from it.
- Nothing is built by hand. Vercel runs `scripts/build-home.mjs` on every deploy. Never edit `index.html` by hand; run `npm run build`. Never commit `assets/og/`.
- An issue's slug is its date, `YYYY-MM-DD`, and its page is `issues/<slug>/index.html`.
- On the issue page set `<html lang="en-GB" data-issue="<slug>">`, the `<title>`, the `description` meta and the canonical link. Keep the three icon links. Paths stay `../../assets/...` and `../../crest.png`.
- The headline stays exactly as printed.
- Photos go in `assets/img/<slug>/` as WebP, at most 1600px wide. Every photo sits in a `<figure>` with its caption, and every `<img>` has `width`, `height` and a short `alt`.
- The `issues.json` entry goes at the top (newest first). `title` is the headline exactly as printed. `displayTitle` is the same words in sentence case. `type` is `Pre-match` or `Full-time`. `standfirst` is `""` when there is none.
- `cover.src` is the lead photo. `cover.focus` is `[x, y]` from 0 to 1, where the subject sits; the link preview, the homepage photo and the Previous issues cards keep that point in frame.
- A video is optional: encode it and its poster as `NEW-ISSUE.md` shows, add `video` with `src`, `poster` and `duration` in seconds, and add the Watch block before the `issue-nav` line to show it on the issue page.
- The build stops, naming the entry, when a page, photo or video file is missing, when `displayTitle` uses different words, or when issues are not newest first.
- Check the preview at 320px, 375px and desktop width: the homepage leads with the new issue; the menu lists it first and marks it current; Previous / Next link it with last week's issue; `/assets/og/<slug>.jpg` shows the cover's subject; a new video plays; no sideways scroll; every photo loads; no console errors.
- Differences from this file: `NEW-ISSUE.md` says to copy the newest article-only page and to merge the pull request yourself. Rules 2 and 6 above replace both.

## Rules already in MATCH-CENTRE.md

- Everyone in `data/players.json` appears in the Match Centre automatically, with their squad photo. Guests and new faces are added in the Match Centre itself.
- Match nights, scores, payments and extra players are stored in Upstash Redis through `api/match.js` and `api/photo.js`. The settings `KV_REST_API_URL`, `KV_REST_API_TOKEN` and `ADMIN_PIN` are set in Vercel for all environments, never in this repo.
- Anyone can watch. Picking teams, scoring and marking subs need the admin PIN. Use a PIN of 6 digits or more; ten wrong PINs from one place lock it out for 15 minutes. To change it, edit `ADMIN_PIN` in Vercel and redeploy.
- A goal goes on the scoreboard only once its scorer and its assist (or "No assist") are both picked. The score can never be lower than the number of goals recorded.
- Each game is first to 3 by default; a level game counts for neither team; the night goes to the team that wins the most games. The table gives 3 points for a night won and 1 for a draw.
- Deleted players, and anyone taken off the squad page, keep their name so their goals and nights still count.
- The server keeps a backup every 10 minutes while things change and before anything is deleted, up to 60 copies. Restoring one keeps the current data as a backup first.
- `MATCH-CENTRE.md` has the full Thursday-night guide for admins.

## README.md

It holds only the project title. No rules.
