# Skill sources

Vetted in a sandbox (`~/sandbox`) before install. Vetting date: 2026-11-22.

## impeccable — installed

- Repo: https://github.com/pbakaus/impeccable
- Pinned SHA: `b49177d32788f2dc585c42831d845dacf1ebed2c` (2026-11-18)
- Source folder: `.claude/skills/impeccable/` at that SHA (63 files). `LICENSE` and `NOTICE.md` copied from the repo root.
- Licence: Apache-2.0 (`LICENSE`, `NOTICE.md`)
- Result: PASS, 0 Critical.
- Scanners: gitleaks 0 findings. semgrep (local `semgrep/semgrep-rules` @ `a5ad171`; `semgrep.dev` blocked): `innerHTML` / `insertAdjacentHTML` findings in the localhost live-browser overlay only. osv-scanner: not run (`api.osv.dev` blocked by the network proxy).
- Warnings:
  - `scripts/impeccable` downloads a prebuilt engine binary from GitHub releases on first run. It is checked against `scripts/engine-checksums.txt`. The binary cannot be source-reviewed. The skill has a documented fallback when the launcher does not run.
  - `/impeccable hooks on` writes a design-detector hook to `.claude/settings.local.json`. It runs the detector after each edit to design files. It is off by default. Not installed here.
  - `scripts/live-browser.js` calls only `localhost`. No telemetry found.
- Engagement-farming check: PASS.

## soft-skill — NOT installed

- Repo: https://github.com/Leonxlnx/taste-skill
- Latest SHA: `f6b76575f949707b4e3c37cd86cb44b0b98643e8` (2026-11-07). soft-skill is not present: commit `825e306` deleted it.
- Last SHA with soft-skill: `b9ca2fd8047f4c72d7da90ebc1c1203e57c72cd2` (2026-10-19). Licence: MIT.
- Vetting at `b9ca2fd`: 0 Critical. gitleaks 0, semgrep 0. osv-scanner not applicable (no package files).
- Reason not installed (Warnings 1–4):
  1. Frontmatter `name` is `high-end-visual-design`, not `soft-skill`.
  2. `disable-model-invocation: true`: it runs only when called by name.
  3. Bans Roboto (a wb-news brand font), expects fonts the repo does not have (Geist, Clash Display), and assumes Tailwind.
  4. Eyebrow tags use `text-[10px]`, below the 11px minimum font size.
- The latest replacement skill (`design-taste-frontend`) adds a skill-scoped Stop hook. Not installed.
