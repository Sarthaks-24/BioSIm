# Release checklist (v2.0.0)

> v2.0.0 was never released on its own: its work ships in **v2.1.0**. Use
> [RELEASE-v2.1.md](RELEASE-v2.1.md) for that release; this page is kept for its live-URL gate rows.

Tick each box before tagging. Every command is for **Git Bash**, run from `/e/BioSim` (the main
checkout, on `main`). Pushes go **by name only**: never `git push --tags`, never `--force`.

## 1. File checks (no browser needed)

- [ ] `npm run check` passes.
- [ ] `npm run release-gate` passes. It lists what is still missing; until it says `READY`, fix
      what it prints:
  - [ ] project email and launch date filled in on the privacy page (`apps/web/src/i18n/en.json`,
        `hi.json`, and the same rows in `REVIEW.md`);
  - [ ] the INDB email's sent date written in `DATA-SOURCES.md` (both places, as `2026-10-20`);
  - [ ] no model source still marked `toVerify` in `packages/engine/src/core/sources.ts`;
  - [ ] the Hindi reviewer has marked every row of `apps/web/src/i18n/REVIEW.md`
        `reviewed by <initials> <date>` (export the list with `node apps/web/scripts/hi-review.mjs`);
  - [ ] `GOVERNANCE.md` committed (you commit it yourself);
  - [ ] `CHANGELOG.md`: the 2.0.0 entry is finished (see step 7).

## 2. Push and wait for the live site

- [ ] `git -C /e/BioSim push origin main`
- [ ] The GitHub Actions run for that push is green.
- [ ] Vercel has deployed it: `https://lifepeek.vercel.app` shows the new version.
- [ ] Security headers are live:

      curl -sI https://lifepeek.vercel.app/ | grep -i -E "x-content-type|referrer-policy|content-security|permissions-policy"

  prints four lines (`nosniff`, `strict-origin-when-cross-origin`, `frame-ancestors 'none'`, `camera=()`).

## 3. Gate checks against the live URL

Run the whole browser suite against the deployed site:

    cd /e/BioSim && PLAYWRIGHT_BASE_URL=https://lifepeek.vercel.app npm run e2e -w @lifepeek/web

It must pass. Then tick each gate row (03 §0.4):

- [ ] No page scroll at 1280×800 and 1440×900 (`gate.spec.ts`, projects `desktop`, `projector`).
- [ ] Body, one graph and Play in the first phone screen, 390×844 (`gate.spec.ts`, project `phone`).
- [ ] 30 fps: `perf.spec.ts` passes **and** the real phone check in step 4.
- [ ] Hindi parity: `i18n.test.ts` (in `npm run check`) and `hindi.spec.ts` (no cut-off text in
      Hindi and the long test language).
- [ ] Offline: `offline.spec.ts` (load, go offline, reload, press Play).
- [ ] Flat fallback without 3D: project `nowebgl`.
- [ ] Reduced motion: project `reduced` (no auto-play, a paused page draws nothing).
- [ ] Text alternatives: `a11y.spec.ts` (no serious or critical axe issues), every graph has a
      summary and "Show as table", keyboard-only run.
- [ ] Deployed: all of the above ran against `https://lifepeek.vercel.app`, not localhost.

## 4. Real phone (2 GB Android Go)

Follow `docs/PHONE-CHECK.md` on the live URL (add `?debug=fps` to the screen's address).

- [ ] 3D body, English: ____ fps
- [ ] 3D body, Hindi: ____ fps
- [ ] Forced flat, English: ____ fps
- [ ] Forced flat, Hindi: ____ fps
- [ ] Phone model and Chrome version written down.

If any number is under 30, do WP-16b first and start this section again.

## 5. Projector

- [ ] With the partner teacher: projector mode on, photo from the back row, every label readable.

## 6. Classroom task test ("after")

- [ ] 5 students (class 8–9, cheap phone) and 1 teacher (projector), no help, the same 4 tasks as
      the "before" test.
- [ ] Pass: 4 of 5 students per task, and faster than with v1.
- [ ] Also asked: "Keep to compare" or "Pin to compare"? Is the stomach graph's half-empty mark clear?
- [ ] Results written in `cache/` (private); a one-line summary goes in the changelog.

## 7. Changelog, tag and release

- [ ] In `CHANGELOG.md`, finish the 2.0.0 entry: the fps line (step 4), the classroom line
      (step 6), lines for the swap and the removal of the old screen, the heading changed from
      "2.0.0 (unreleased)" to "2.0.0", and the reminder comment removed. Commit it.
- [ ] `npm run release-gate` says `READY`.
- [ ] `git -C /e/BioSim push origin main`
- [ ] `git -C /e/BioSim tag -a v2.0.0 -m "v2.0 Clean one-body screen"`
- [ ] `git -C /e/BioSim push origin v2.0.0`
- [ ] `gh release create v2.0.0 -R Sarthaks-24/lifepeek --title "LifePeek v2.0.0" --notes-file <file with the 2.0.0 entry>`
- [ ] Zenodo / DOI: **only** if the INDB permission question is settled (00 D-INDB, D-DOI). Otherwise skip.
