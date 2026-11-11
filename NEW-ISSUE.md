# Adding a new issue (every Thursday)

An **issue** is one Thursday's edition. `issues.json` is the only list of issues: the menu, the Previous / Next links, the homepage and the link-preview image (WhatsApp) are all built from it.

**Nothing is built by hand.** On every deploy Vercel installs one tool (sharp) and runs `scripts/build-home.mjs` (see `vercel.json`). The script writes `index.html` and makes a 1200x630 link-preview image for each issue in `assets/og/`. Never edit `index.html` by hand, and never commit `assets/og/`.

The slug is the date: `YYYY-MM-DD`. The examples below use `2026-11-12`.

## 1. Add the issue folder and images

Copy the newest article-only page (for example `issues/2026-10-15/index.html`) to:

```
issues/2026-11-12/index.html
```

- Set `<html lang="en-GB" data-issue="2026-11-12">`.
- Set the `<title>`, the `description` meta, and `<link rel="canonical" href="https://wb-news.vercel.app/issues/2026-11-12/">`.
- Keep the three icon links in the `<head>` (`favicon.ico`, `icon.svg`, `apple-touch-icon`).
- Replace the article with the new text. The headline stays exactly as printed. Paths stay `../../assets/...` and `../../crest.png`.

Photos go in `assets/img/2026-11-12/`, as WebP, at most 1600px wide:

```
cwebp -q 82 -resize 1600 0 photo.jpg -o assets/img/2026-11-12/photo.webp
```

(Drop `-resize` if the photo is narrower.) Every photo goes in a `<figure>` with its caption, and every `<img>` gets its `width`, `height` and a short `alt`.

## 2. Add the issues.json entry

Add the new issue at the **top** (newest first):

```json
{
  "date": "2026-11-12",
  "type": "Pre-match",
  "title": "…",
  "displayTitle": "…",
  "slug": "2026-11-12",
  "standfirst": "…",
  "stories": ["…", "…"],
  "cover": { "src": "assets/img/2026-11-12/photo.webp", "focus": [0.5, 0.4] }
}
```

- `title` is the headline exactly as printed. It is the big headline on the homepage.
- `displayTitle` is the same words in sentence case (names keep their capitals). The menu, Previous / Next, the homepage cards, the Watch captions and the link preview use it. When the printed headline is already in sentence case, `displayTitle` is the same as `title`.
- `type` is `Pre-match` or `Full-time`.
- Leave `"standfirst": ""` when the issue has none.
- `cover.src` is the issue's lead photo: the homepage photo and the source of the link-preview image.
- `cover.focus` is where the subject sits in the photo, as `[x, y]` from 0 to 1 (`[0, 0]` is the top-left corner, `[0.5, 0.5]` the middle). The wide link-preview crop is centred there. Leave it out to centre on the middle.

### Optional: a video

Encode the video and take a poster frame (pick a clear second for `-ss`):

```
ffmpeg -i in.mp4 -map_metadata -1 -vf "scale='min(1280,iw)':-2" -c:v libx264 -crf 23 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart assets/video/2026-11-12.mp4
ffmpeg -ss 5 -i assets/video/2026-11-12.mp4 -frames:v 1 poster.png
cwebp -q 80 poster.png -o assets/video/2026-11-12.webp
```

Add it to the entry (`duration` is the length in seconds):

```json
"video": { "src": "assets/video/2026-11-12.mp4", "poster": "assets/video/2026-11-12.webp", "duration": 58 }
```

The homepage Watch row picks it up. To show it on the issue page too, add this before the `<nav class="issue-nav">` line:

```html
<h2>Watch</h2>
<figure class="clip">
  <video controls playsinline preload="none" poster="../../assets/video/2026-11-12.webp" src="../../assets/video/2026-11-12.mp4" aria-label="The displayTitle"></video>
</figure>
```

## 3. Push the branch

Commit the new folder, the photos, the video files and `issues.json`, then push the branch. Vercel builds a preview: the homepage and the link-preview images are made there.

If an entry is wrong (a missing page, photo or video file, a `displayTitle` with different words, or issues not newest first), the build stops with a message that names the entry, and nothing is published.

## 4. Check the preview

Open the preview at phone width (320px and 375px) and at desktop width:

- The homepage leads with the new issue: photo, headline, and "Read the full story" opens the new page.
- The menu lists the new issue first and marks it as current. Previous / Next on the new issue and on last week's issue point at each other.
- `/assets/og/2026-11-12.jpg` opens and shows the subject of the cover. If it is cut off, adjust `cover.focus` and push again.
- A new video plays in the Watch row and on its issue page.
- No sideways scrolling of the page, every photo loads, and the browser console shows no errors.

## 5. Merge

When the preview is right, open a pull request from the branch into `main` and merge it. Vercel rebuilds the live site the same way, and the WhatsApp preview follows the new issue.
