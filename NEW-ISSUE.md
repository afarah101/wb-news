# Adding a new issue (every Thursday)

An **issue** is one Thursday's edition: a date, a type (Pre-match or Full-time), a title, a slug, a standfirst and its stories. `issues.json` is the only list of issues: the menu and the Previous / Next links read it.

The slug is the date: `YYYY-MM-DD`. The examples below use `2026-11-12`.

## 1. Folder

Copy the newest issue's page as a starting point:

```
issues/2026-11-12/index.html
```

- Set `<html lang="en-GB" data-issue="2026-11-12">`.
- Set the `<title>`, the `description` meta, and `<link rel="canonical" href="https://wb-news.vercel.app/issues/2026-11-12/">`.
- Replace the article with the new text. Paths stay `../../assets/...` and `../../crest.png`.

## 2. Images

- Put the photos in `assets/img/2026-11-12/`, as WebP, at most 1600px wide:
  `cwebp -q 82 -resize 1600 0 photo.jpg -o assets/img/2026-11-12/photo.webp` (drop `-resize` if the photo is narrower).
- Every photo goes in a `<figure>` with a title and its caption: `<figcaption><b>Exhibit A:</b> caption</figcaption>`. No caption? Use `<b>Exhibit A</b>` only.
- Give every `<img>` its `width`, `height` and a short `alt`. The shared photo grade in `assets/issue.css` applies on its own.

## 3. issues.json entry

Add the new issue at the **top** (newest first):

```json
{
  "date": "2026-11-12",
  "type": "Pre-match",
  "title": "…",
  "slug": "2026-11-12",
  "standfirst": "…",
  "stories": ["…", "…"]
}
```

Use the issue's own words. Leave `"standfirst": ""` when the issue has none.

## 4. Root update

The home page (`/`) always shows the latest issue:

- Copy `issues/2026-11-12/index.html` to `index.html`.
- In the copy, remove the `../../` from every path (`assets/...`, `crest.png`, images, audio).
- Keep the canonical link pointing at `https://wb-news.vercel.app/issues/2026-11-12/`.

## 5. Check

Open the preview (or `python3 -m http.server` in the repo) on a phone-width window (320px and 375px):

- The menu opens, lists the new issue first and marks it as current. Esc, a tap on the dark area and a swipe left close it.
- Previous / Next at the bottom of the new issue and of last week's issue point at each other.
- No sideways scrolling, every photo loads, and the browser console shows no errors.
