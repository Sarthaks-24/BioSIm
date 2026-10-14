# Release checklist (v2.1.0)

v2.1 is the first public release of the new screen (Track A: the phone, landscape and projector
fixes, the overlays, links and Back, Home, page titles, load on demand). The code side is done
and its checks are enforced (T11). What is left are **your** steps, in this order. Tick each box.

Every command is for **Git Bash**, run from the main checkout `/e/BioSim` on `main`. Pushes go
**by name only**: never `git push --tags`, never `--force`.

## 0. Where it stands

    cd /e/BioSim && npm run release-gate

On the T11 build it says `NOT READY` and lists only your items:

- placeholders: the project email and the launch date (`apps/web/src/i18n/en.json`), the INDB
  sent date (`DATA-SOURCES.md`, two places);
- the INDB sent date check;
- `GOVERNANCE.md` missing;
- the CHANGELOG 2.1.0 entry: still "unreleased", the fps line and the classroom line to fill in;
- the project email on the privacy page (a `mailto:` link once it is an address).

Hindi is paused (R47): the Hindi review check runs only with `VITE_HINDI=1`, and a release
without Hindi does not need it. Do **not** set `VITE_HINDI` on Vercel.

## 1. Your text items

- [ ] **Project email** (B20). In `apps/web/src/i18n/en.json`, replace `<project email>` (privacy
      page, "Contact (grievances)") with the address, for example `lifepeek.project@gmail.com`.
      The page turns it into a tap-to-email (`mailto:`) link by itself.
- [ ] **Launch date**. In the same file, `"updated": "Last updated: <date of launch>"` → the date
      you will tag, for example `"Last updated: 1 December 2026"`.
- [ ] **INDB email**. Send the permission email (`DATA-SOURCES.md` says what to ask), then write
      its date in `DATA-SOURCES.md` in both places (`<date sent, from 00 §6>` and `<date>`), as
      `2026-11-20`.
- [ ] **GOVERNANCE.md**. Write it and commit it at the repo root (README and CONTRIBUTING link to it).
- [ ] Commit:

      cd /e/BioSim && git add apps/web/src/i18n/en.json DATA-SOURCES.md GOVERNANCE.md
      cd /e/BioSim && git commit -m "v2.1: project email, launch date, INDB sent date, governance"

- [ ] Once the email and the date are in, turn their checks on (they report until then):
  - `apps/web/e2e/helpers/gate.ts`, `RED_LIST`: `B20: 'report'` → `B20: 'enforce'`;
  - `.github/workflows/ci.yml`, step "Placeholders in shipped text": add ` -- --enforce` to
    `npm run lint:placeholders -w @lifepeek/web` (and drop "(report)" from its name).

  `npm run release-gate` reminds you if either is still report-only.

## 2. Student check (T2s)

- [ ] Run the student check from the kit (`cache/student-check/KIT.md`; 5 students, 5 tasks, the
      pass rule) on a local preview of `main`:

      cd /e/BioSim && npm run build -w @lifepeek/web
      cd /e/BioSim && npm run preview -w @lifepeek/web -- --host --port 4173

- [ ] Write the one-line result in `CHANGELOG.md`, 2.1.0 entry, in place of
      `<one line: tasks passed, from the student check>`. A failed task is fixed first, then tested
      again with 2 new students.

## 3. Real 2 GB phone and projector (device lab, about 60 min)

- [ ] **2 GB Android phone**, Chrome (and Samsung Internet if it has it), on the preview above or
      on the Vercel preview (step 4): follow `docs/PHONE-CHECK.md` (`?debug=fps`). Check: the
      body, a graph and Play on the first screen; 2 minutes of play (pace, does it get hot); Back
      after adding a food; install it, go offline, open it again; a 40-minute lesson.
- [ ] Write the fps in `CHANGELOG.md` in place of `<fps, 3D and flat, from the device check>`.
- [ ] **Laptop 1366×768 + projector** (1024×768 or 1280×800): projector mode on, the body fills the
      screen's middle, a photo from the back row, every label readable, the clicker works.
- [ ] Optional, if you can borrow one: iPhone or iPad (landscape, share, VoiceOver).

## 4. Vercel import and the site address

- [ ] Push `main` first (step 6 has the commands), so Vercel imports the release code.
- [ ] vercel.com → **Add New… → Project** → import `Sarthaks-24/lifepeek`. Framework preset
      "Other": `vercel.json` already sets the build (`npm run build`), the output
      (`apps/web/dist`), the headers, the page rewrites and the real 404.
- [ ] **Environment variable** (Settings → Environment Variables, Production and Preview):
      `VITE_SITE_URL` = the address Vercel gives the project, for example
      `https://lifepeek.vercel.app` (no slash at the end). Canonical links, link previews, the
      sitemap and the Teach QR code are made from it at build time. If the name differs from
      `lifepeek.vercel.app`, set it and **redeploy**. Nothing else is needed: no `VITE_HINDI`, no
      `VITE_PSEUDO`, no `VITE_API_URL`.
- [ ] Check the live site (replace the address if yours differs):

      curl -sI https://lifepeek.vercel.app/ | grep -i -E "x-content-type|referrer-policy|content-security|permissions-policy"
      curl -s -o /dev/null -w "%{http_code}\n" https://lifepeek.vercel.app/teach            # 200
      curl -s -o /dev/null -w "%{http_code}\n" https://lifepeek.vercel.app/no-such-page     # 404
      curl -s https://lifepeek.vercel.app/teach | grep -o "<title>[^<]*</title>"

  Four header lines; 200; 404; Teach's own title. On `/teach`, scan the QR code with a phone: it
  opens `/sim?a=cola:1` on your address.
- [ ] The browser checks against the live site (must pass):

      cd /e/BioSim && PLAYWRIGHT_BASE_URL=https://lifepeek.vercel.app npm run e2e -w @lifepeek/web

## 5. Visual baselines (once, on GitHub)

The visual shots (`apps/web/e2e/visual.spec.ts`) compare against Linux pictures that only CI can
make (R62).

- [ ] GitHub → **Actions → Visual baselines → Run workflow** (on `main`), or
      `gh workflow run visual-baselines.yml -R Sarthaks-24/lifepeek --ref main`.
- [ ] Download the `visual-baselines` artifact
      (`gh run download -R Sarthaks-24/lifepeek -n visual-baselines -D apps/web/e2e/visual.spec.ts-snapshots`),
      look at every picture (desktop, projector, 390 and 360; flat and one 3D), then commit them:

      cd /e/BioSim && git add apps/web/e2e/visual.spec.ts-snapshots
      cd /e/BioSim && git commit -m "Visual baselines for v2.1 (Linux, from the workflow)"

## 6. Changelog, tag and push

- [ ] In `CHANGELOG.md`: the two lines filled in (steps 2 and 3), the heading changed from
      `2.1.0 (unreleased)` to `2.1.0`, and the reminder comment under the entry removed. Commit it:

      cd /e/BioSim && git commit -am "v2.1.0: changelog"

- [ ] All green:

      cd /e/BioSim && npm run check
      cd /e/BioSim && npm run e2e -w @lifepeek/web
      cd /e/BioSim && npm run release-gate          # must say READY

- [ ] Tag and push (by name):

      git -C /e/BioSim push origin main
      git -C /e/BioSim tag -a v2.1.0 -m "LifePeek v2.1.0: the new screen, fixed for phones, landscape and projectors"
      git -C /e/BioSim push origin v2.1.0
      gh release create v2.1.0 -R Sarthaks-24/lifepeek --title "LifePeek v2.1.0" --notes-file <a file with the 2.1.0 entry>

- [ ] The GitHub Actions run for that push is green; Vercel shows the new version in production.
- [ ] GitHub → Actions → **Release gate → Run workflow** on the tag: it says `READY`.
- [ ] Then merge `main` into `v3` (edit any new `v=2` e2e links to `v=3`, R63).

## Report-only on purpose (not your items)

These checks print `[gate report]` lines and do not fail, each for a reason:

- Hindi checks (B13, the Hindi half of B9 and B20, Hindi links): Hindi is paused (R47).
- B20 and the CI placeholder lint: until your email and date are in (step 1).
- B17 (loading frames, `e2e/loading.spec.ts`): enforce on or after 2026-10-21 if it stays clean (R59).
- WebKit and Firefox projects: nightly CI, a clean week first (qa-fixes §3.1).
- Play and the graph on the first screen of a 360×560 and a 320×568 window (the body is enforced).
- 30 fps at 6× CPU and the absolute CPU per frame: the real phone (step 3) counts; the CPU ratio
  between builds is enforced on every PR.
