---
name: Western Ballers FC news
description: Satirical Thursday-night team news, set like a broadsheet sports desk.
colors:
  ink: "#121212"
  ink-2: "#2b2b2b"
  muted: "#5c5c5c"
  rule: "#e6e3de"
  paper: "#fff"
  paper-2: "#f7f5f2"
  club-orange: "#F26B1D"
  club-orange-text: "#B4470C"
  on-ink: "#fff"
  on-ink-2: "#c9c9c9"
  ink-rule: "#3a3a3a"
  bezel: "#0b0b0b"
typography:
  display:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  story:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  standfirst:
    fontFamily: "Newsreader, Georgia, Times New Roman, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.35
  body:
    fontFamily: "Roboto, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Roboto, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.12em"
rounded:
  hairline: "2px"
  phone: "40px"
  phone-desktop: "48px"
spacing:
  half: "4px"
  s1: "8px"
  s2: "16px"
  s3: "24px"
  s4: "32px"
  s5: "40px"
  s6: "48px"
  s7: "56px"
  s8: "64px"
  s10: "80px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.hairline}"
    height: "56px"
    padding: "0 40px"
  button-primary-active:
    backgroundColor: "{colors.ink-2}"
  pill:
    backgroundColor: "{colors.club-orange-text}"
    textColor: "{colors.on-ink}"
    padding: "4px 8px"
  issue-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  issue-card-hover:
    backgroundColor: "{colors.paper-2}"
---

# Design System: Western Ballers FC news

## Overview

**Creative North Star: "The Thursday Back Page"**

A broadsheet sports desk that takes five-a-side far too seriously. The page reads like the back of a Sunday paper: a heavy serif headline, a hard ink rule under the masthead, flat paper, and one club colour used like a highlighter. The satire lives in the copy; the design plays it completely straight, which is why the jokes land.

Density is editorial, not app-like. One centred column of 1200px holds the masthead, the cover and the homepage; reading text narrows to 672px. Surfaces are flat. Depth comes from rules and weight, not shadows. The one place the page performs is the club crest, which builds itself once per visit and then docks in the masthead.

**Key Characteristics:**
- Newsreader headlines on Roboto furniture, one typographic voice per role.
- Flat white paper, warm off-white for secondary surfaces, near-black ink.
- Club orange as a highlighter for names, labels and the crest, never as a fill for large areas.
- Heavy 4px ink rules as structure; 1px warm rules between rows.
- Sharp corners. Only the phone mock-up is rounded.

## Colors

Ink on paper, with a single club orange that does all the shouting.

### Primary
- **Club Orange** (`club-orange`): the crest, the kicker bar, the live dot, the chyron tag and focus rings. Graphic use only: it fails contrast as text on white.
- **Club Orange, Text Weight** (`club-orange-text`): every orange word. Player names (`.n`), headline emphasis (`em`), labels, pills and dates. Use this one whenever orange is text.

### Neutral
- **Newsprint Ink** (`ink`): headlines, body, the masthead rule, the primary button.
- **Second Ink** (`ink-2`): standfirsts, decks and the pressed button.
- **Byline Grey** (`muted`): meta lines, captions and secondary labels.
- **Warm Rule** (`rule`): 1px dividers between rows and around cards.
- **Paper** (`paper`): the page.
- **Off-White Paper** (`paper-2`): hover and pressed rows, the drawer, rating cards.
- **On-Ink** (`on-ink`, `on-ink-2`, `ink-rule`): text and rules on the black chyron, the score and the drawer date block.
- **Bezel** (`bezel`): the phone mock-up frame only.

### Named Rules
**The Highlighter Rule.** Orange marks a name, a label or the crest. It never fills a section, a card or a button.

**The Two Oranges Rule.** `club-orange` for shapes, `club-orange-text` for words. Orange text in `club-orange` on paper fails WCAG AA.

## Typography

**Display Font:** Newsreader (with Georgia, Times New Roman)
**Body Font:** Roboto (with -apple-system, Helvetica Neue, Arial)

**Character:** A sharp, high-contrast news serif for every headline, paired with a condensed, heavy sans for labels. Both are self-declared `@font-face` files, latin only, weights 400 to 800.

### Hierarchy
The headline scale is one set of tokens (`--t-display` to `--t-h4`) that steps up at 521px and 901px.
- **Display** (700, 56 / 80 / 88px, 0.98): the cover wordmark only.
- **Headline** (700, 40 / 48 / 56px, 1.04): page and article headlines, the homepage lead, player names on profiles.
- **Section** (700, 28 / 32 / 36px, 1.15): section heads, pull quotes, the Match Centre date.
- **Title** (700, 24 / 24 / 28px): phone headline, the lead story row, squad card names.
- **Story** (600, 18 / 20 / 20px, 1.25): story rows, cards, next and previous links.
- **Standfirst** (400, 20px, 22px from 521px, 1.35): the deck under a headline.
- **Body** (400, 14 to 16px, 1.4 to 1.5): meta, captions, list text. Article body sits at the 672px reading width.
- **Label** (800, 12px, 0.12em, uppercase, 87.5% width): kickers, section labels, tags. Never smaller than 11px.

### Named Rules
**The Printed Headline Rule.** A headline stays exactly as printed. Emphasis inside it is `em` in club orange at the headline's own weight.

**The One Scale Rule.** Headline sizes come only from the `--t-*` tokens. No one-off font sizes for headings.

## Layout

One centred container (`--page`, 1200px) with a 16px gutter on phones and 24px from 521px. Reading text is capped at `--read` (672px). Spacing runs on an 8px scale (`--s1` 8px to `--s10` 80px) with a 4px half-step for chips only.

Phones get one column, and the headline and the primary button must sit on the first screen. From 901px the homepage lead splits 5 / 7 (photo, then copy) and the cover splits phone mock-up and story list. The homepage opens with the crest hero, then the lead story, then the Watch row (a sideways swipe with snap), then three previous issues.

No page may scroll sideways at 320px or 375px.

## Elevation & Depth

Flat by default. Depth comes from a heavy 4px ink rule under the masthead and above each homepage row, 1px warm rules between rows, and the off-white surface for pressed or hovered rows. Shadows exist in exactly two places.

### Shadow Vocabulary
- **Phone lift** (`box-shadow: inset 0 0 0 1px var(--ink-2), 0 8px 16px rgba(18,18,18,.04), 0 40px 80px rgba(18,18,18,.05)`): the phone mock-up on the cover.
- **Drawer edge** (`box-shadow: 0 0 0 1px var(--rule), 8px 0 32px rgba(18,18,18,.12)`): the issues drawer over the scrim.

### Named Rules
**The Rule Not Shadow Rule.** Separate things with a rule or a tint. A new shadow needs a reason the two above do not cover.

## Shapes

Sharp. The primary button has a 2px corner, cards and photos have none, and the chyron tag uses a slanted clip on its right edge. The phone mock-up (40px, 48px on desktop) is the only rounded object. Dots (the live indicator) are full circles. The crest's shield silhouette is the one organic form on the page.

## Components

### Buttons
- **Shape:** near-square (2px).
- **Primary:** ink fill, white Roboto 700 at 18px, 56px tall; full width on phones, inline with 40px side padding from 901px.
- **Hover / Focus:** the arrow moves 4px right on hover; a 3px club-orange outline, offset 4px, on focus. Pressed: second ink and a 0.98 scale.

### Chips
- **Pill:** club-orange-text fill, white condensed caps, 4px by 8px. Used for the issue type in the masthead.

### Cards / Containers
- **Previous issue card:** photo then label then title, no border, no shadow; the row turns off-white on hover. Thumbnail rows on phones, three cards from 701px.
- **Rating card:** off-white with a 4px club-orange top rule.

### Navigation
- **Masthead:** menu button, crest and the two-line wordmark, a 4px ink rule beneath. On the homepage, with motion allowed, the masthead stays pinned so the crest has a place to dock.
- **Drawer:** a fixture-list panel from the left, transform and opacity only, with Esc, scrim tap and swipe to close.

### Crest Hero (signature)
The approved crest (`assets/wb-crest.svg`) inline above the lead story, in a box whose height is fixed in CSS (160px on phones, 320px from 901px) so nothing below it moves. It plays the opening once per browser session, then rides the scroll into the masthead logo spot. With reduced motion or no JavaScript it is simply the finished crest.

## Do's and Don'ts

### Do:
- **Do** route every colour through the `:root` tokens in `assets/issue.css`.
- **Do** use `club-orange-text` (#B4470C) for orange words and `club-orange` (#F26B1D) for shapes.
- **Do** take spacing from `--s1` to `--s10`, and `--half` only for chips.
- **Do** take headline sizes from `--t-display` to `--t-h4`.
- **Do** reserve the space of anything that animates, so the page never shifts.

### Don't:
- **Don't** add a third typeface or a system display face.
- **Don't** fill a large area with club orange.
- **Don't** add shadows beyond the two in the vocabulary.
- **Don't** round cards, photos or buttons.
- **Don't** set text below 11px.

## Motion

Motion is rare and earns its place. The page has three kinds.

### Durations
- **Feedback** (150 to 200ms): button press, hover arrow, row tint, pressed phone.
- **Panels** (200 to 240ms): the drawer and its scrim open in 240ms and close in 200ms.
- **The one authored moment** (about 2.2s, once per session): the crest opening on the homepage. Shield outline draws (0 to 0.7s); the five stars drop in, outer pair first and centre last, on a light spring (0.5 to 1.3s); WB rises and settles (0.9 to 1.6s); the ribbon unrolls left to right (1.4 to 2.0s); the ribbon text fades in (1.8 to 2.2s). Then the lead headline reveals word by word (about 0.6s).
- **Scroll-linked:** the crest's dock into the masthead is tied 1:1 to scroll position over the hero's height, in two straight legs. For the first 60% it shrinks to logo size and slides into the logo's column, just under the masthead rule. Then it rises straight into the logo spot, so it never crosses the wordmark. It has no duration of its own.

### Easing
- **`--ease`** (`cubic-bezier(.16,1,.3,1)`): the house curve for every CSS transition. Exponential ease-out: quick start, soft landing.
- **Spring** (bounce about 0.35): the falling stars only.
- **Linear:** scroll-linked motion only, so the crest tracks the finger exactly.
- No elastic or bounce curves elsewhere.

### Reduced motion
- `prefers-reduced-motion: reduce` removes all movement: no crest opening, no scroll docking, no headline reveal, no live-dot pulse, no lift or scale on press. The finished crest and the full headline show at once.
- State still shows: pressed controls dim to 85% opacity and the drawer cross-fades in 150ms.
- Without JavaScript the page looks exactly like the reduced-motion version. Nothing starts hidden unless a script that will reveal it is already running.
- If the animation script has not started 1.5s after the hero is parsed (slow network, blocked script), the page drops to the finished crest and the full headline.

### Named Rules
**The One Moment Rule.** One authored sequence per page. Everything else is feedback.

**The Any-Input-Skips Rule.** A scroll, tap or key press during the opening jumps straight to the finished crest, and the headline shows at once with no reveal.
