# Adding a new issue (every Thursday)

An **issue** is one Thursday's edition: a date, a type (Pre-match or Full-time), a title, a slug, a standfirst, its stories, a cover photo and (sometimes) a video. `issues.json` is the only list of issues. The menu, the Previous / Next links and the homepage are all built from it.

**The homepage builds itself.** On every deploy Vercel runs `scripts/build-home.mjs` (see `vercel.json`), which writes `index.html` from `issues.json`: the newest issue leads, with its link preview (WhatsApp), the Watch row and the Previous issues row. Never edit `index.html` by hand.

The slug is the date: `YYYY-MM-DD`. The examples below use `2026-11-12`.

## 1. Add the issue folder

Copy the newest article-only page (for example `issues/2026-10-15/index.html`) to:

```
issues/2026-11-12/index.html
```

- Set `<html lang="en-GB" data-issue="2026-11-12">`.
- Set the `<title>`, the `description` meta, and `<link rel="canonical" href="https://wb-news.vercel.app/issues/2026-11-12/">`.
- Replace the article with the new text. Paths stay `../../assets/...` and `../../crest.png`.

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
  "slug": "2026-11-12",
  "standfirst": "…",
  "stories": ["…", "…"],
  "cover": { "src": "assets/img/2026-11-12/photo.webp" }
}
```

- Use the issue's own words. Leave `"standfirst": ""` when the issue has none.
- `cover.src` is the issue's lead photo. It is the homepage photo and the link-preview image.

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
  <video controls playsinline preload="none" poster="../../assets/video/2026-11-12.webp" src="../../assets/video/2026-11-12.mp4" aria-label="The issue title"></video>
</figure>
```

## 3. Push the branch

Commit the new folder, the photos, the video files and `issues.json`, then push the branch. Vercel builds a preview and rebuilds the homepage from `issues.json`.

If an entry is wrong (a missing page, photo or video file, or issues not newest first), the build stops with a message that names the entry, and nothing is published.

To see the homepage before pushing: `node scripts/build-home.mjs`, then `python3 -m http.server`.

## 4. Check the preview

Open the preview at phone width (320px and 375px) and at desktop width:

- The homepage leads with the new issue: photo, headline, story list, and "Read the full story" opens the new page.
- The menu lists the new issue first and marks it as current. Previous / Next on the new issue and on last week's issue point at each other.
- A new video plays in the Watch row and on its issue page.
- No sideways scrolling of the page, every photo loads, and the browser console shows no errors.
