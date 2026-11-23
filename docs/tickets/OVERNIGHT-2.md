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

## T2 — Photo sizes (all issues)
- [ ] Every `<img>` in `issues/*/index.html` gets `width` and `height` from the real file. No alt, src or text changes.
- Checks: 0 `<img>` without width/height; slow-media CLS on 5 Nov ≤ 0.02; innerText unchanged.

## T3 — Squad profile transition
- [ ] In `squad/` only: a tapped card grows into the open profile; closing shrinks it back into the same card. View Transitions API; a plain instant change where it is not supported.
- [ ] Keep the black cards, cut-outs and data. Reduced motion: instant.
- Checks: open/close frames at 390 and 1440; focus moves to the profile and back to the card; Escape closes; CLS ≤ 0.02.

## T4 — Page transitions
- [ ] Cross-document view transitions between the homepage, issue pages, Squad and 404: a short fade, the masthead crest held still. Not in `match/`.
- [ ] Reduced motion: none. Unsupported browsers: normal loads.
- Checks: frames mid-transition home → issue → squad; `match/` byte-identical; no console errors.

## Verify (all tickets)
- [ ] Each ticket's checks with evidence in this file.
- [ ] innerText diff vs `main` = only the T1 transcript.
- [ ] `npm run build` passes; 0 console errors; no sideways scroll at 320/375; no undefined/null/NaN.
- [ ] `/impeccable audit` on changed pages: 0 P0, 0 P1.
- [ ] `git diff --name-only main` lists only ticket files.
