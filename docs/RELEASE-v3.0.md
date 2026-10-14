# Release checklist (v3.0.0)

v3.0 is "Class 10 Life Processes, complete": breathing, heart and blood, kidneys and water,
muscles, skin, and bones and lymph as drawings, the guided lesson, worksheets and the "Why
different?" cards. Model version 3 is sealed (R103). The code side is done on the `v3` branch and
its checks are enforced (H-1). What is left are **your** steps, in this order. Tick each box.

Every command is for **Git Bash**, run from the main checkout `/e/BioSim`. Pushes go **by name
only**: never `git push --tags`, never `--force`.

## 0. Where it stands

    cd /e/BioSim && git checkout v3 && npm ci && npm run release-gate

On the H-1 build it says `NOT READY` and lists only your items (the same as for v2.1, plus one):

- placeholders: the project email and the launch date (`apps/web/src/i18n/en.json`), the INDB
  sent date (`DATA-SOURCES.md`);
- the INDB sent date check;
- `GOVERNANCE.md` missing;
- the project email on the privacy page;
- the CHANGELOG entry: `3.0.0 (unreleased)` (you change the heading in step 3).

The model seal (check 7) passes: model version 3 is sealed and has its seal file
(`packages/engine/test/sealed/v3.json`). Hindi is paused (R47): do **not** set `VITE_HINDI`.

## 1. v2.1 is live first

v3.0 goes out only after v2.1.0 is tagged and in production (R103).

- [ ] Every step of `docs/RELEASE-v2.1.md` is done: the email, launch date, INDB date and
      `GOVERNANCE.md` are committed on `main`, `v2.1.0` is tagged and pushed, Vercel serves it.
- [ ] Check:

      git -C /e/BioSim tag -l v2.1.0                                   # prints v2.1.0
      curl -s https://lifepeek.vercel.app/sim | grep -o "<title>[^<]*</title>"

## 2. Bring `main` into `v3`, then check `v3`

Your v2.1 text items are on `main`; `v3` needs them before it can pass the release gate.

- [ ] Merge:

      cd /e/BioSim && git checkout v3
      cd /e/BioSim && git merge main -m "Merge main (v2.1.0) into v3"

  If git reports conflicts, stop and ask (they are usually the CHANGELOG, `en.json` or a `v=2`
  e2e link that should be `v=3`, R63).
- [ ] All green on `v3` (the e2e run takes about 30 minutes; it builds its own test site):

      cd /e/BioSim && npm ci && npm run check
      cd /e/BioSim && CI=1 npm run e2e -w @lifepeek/web
      cd /e/BioSim && npm run release-gate        # now lists only the CHANGELOG heading

## 3. Merge `v3` into `main` (model version 3 reaches production here)

- [ ] In `CHANGELOG.md` change the heading `## 3.0.0 (unreleased)` to `## 3.0.0`. Commit it on `v3`:

      cd /e/BioSim && git commit -am "v3.0.0: changelog"
      cd /e/BioSim && npm run release-gate        # must say READY

- [ ] Merge into `main`:

      cd /e/BioSim && git checkout main
      cd /e/BioSim && git merge --no-ff v3 -m "Merge v3: LifePeek 3.0 (model version 3, sealed)"
      cd /e/BioSim && npm ci && npm run check && npm run release-gate

## 4. Tag v3.0.0

- [ ] Tag the merge commit:

      git -C /e/BioSim tag -a v3.0.0 -m "LifePeek v3.0.0: Class 10 Life Processes, complete"

## 5. Push

- [ ] By name:

      git -C /e/BioSim push origin main
      git -C /e/BioSim push origin v3.0.0

- [ ] The release notes are the 3.0.0 entry of `CHANGELOG.md`:

      cd /e/BioSim && awk '/^## 3.0.0/{f=1;next} /^## /{f=0} f' CHANGELOG.md > /tmp/notes-3.0.0.md
      gh release create v3.0.0 -R Sarthaks-24/lifepeek --title "LifePeek v3.0.0" --notes-file /tmp/notes-3.0.0.md

- [ ] The GitHub Actions run for that push is green. Then GitHub → Actions → **Release gate → Run
      workflow** on the tag: it says `READY`.

## 6. Deploy

Vercel builds `main` on its own when it is pushed (the project from v2.1, with `VITE_SITE_URL`
set). The production build stops by itself if the model were not sealed (`model-seal.mjs`).

- [ ] vercel.com → the project → **Deployments**: the newest production deployment is the merge
      commit and says "Ready". If it failed, open its build log and send it to the council.

### What to check after the deploy

Replace the address if yours differs.

- [ ] Headers, pages and the real 404, as for v2.1:

      curl -sI https://lifepeek.vercel.app/ | grep -i -E "x-content-type|referrer-policy|content-security|permissions-policy"
      curl -s -o /dev/null -w "%{http_code}\n" https://lifepeek.vercel.app/teach            # 200
      curl -s -o /dev/null -w "%{http_code}\n" https://lifepeek.vercel.app/no-such-page     # 404

- [ ] The browser checks against the live site (must pass; the tests that need the test build's
      extra language skip themselves):

      cd /e/BioSim && PLAYWRIGHT_BASE_URL=https://lifepeek.vercel.app npm run e2e -w @lifepeek/web

- [ ] By hand, on a laptop and on a phone:
  - Home: "One roti, one walk" is the first card; it opens the lesson; Next goes through five
    pauses (stomach, blood, breaths, sweat, water) and ends with Finish.
  - The title above the body opens the systems: all eight are there, Bones and Lymph say
    "Drawing only".
  - `https://lifepeek.vercel.app/sim?v=3&a=roti:1&act=walk.30.20` opens on Heart & blood.
  - A link from v2 still opens, with its note: `https://lifepeek.vercel.app/sim?v=2&a=cola:1`.
  - Kidneys & water: the graphs say "0–12 h shown · 48 h ›".
  - Teach: five chapters; a worksheet prints on one A4 page, and its QR code opens the lesson.
  - Teach → "Save all for class offline" → "Ready for class offline ✓" on every lesson; turn the
    network off; a system lesson (Why do you breathe faster when you run?) still opens.
  - "Why different?" next to a book value opens the card with the NCERT page.

## 7. Teacher pilot

- [ ] One teacher runs the guided lesson and one worksheet with a class (projector and clicker).
      Write down: did the five pauses work with the clicker, could the students answer the
      worksheet, anything they found confusing. A problem found here is fixed in 3.0.1 (send the
      notes to the council).

## 8. 2 GB phone check, with input lag

- [ ] On the 2 GB Android phone, Chrome, on the live site: follow `docs/PHONE-CHECK.md`
      (`?debug=fps`), then for each of Digestion, Breathing, Heart & blood and Kidneys & water:
  - Play for 1 minute: the frame rate, and whether the phone gets hot.
  - **Input lag**: tap "+" on a food, add a walk, switch the system, drag the timeline. Each
    should answer within about a tenth of a second. Write down any tap that takes noticeably
    longer (half a second or more), and on which screen.
- [ ] If there is lag: the engine worker (**W-2**) moves forward from v3.1 into a 3.0.x release
      (architecture §3.1). Tell the council with your notes; do not change anything yourself.

## After the release

- Do not delete `v3` yourself: the council merges the held v3.1 branches (S-5, S-6, S-7, the 3D
  layers) one at a time after the seal, each proven not to change any sealed output (R103), and
  says when `v3` goes (R46).
- Visual baselines: the screens changed, so run **Actions → Visual baselines** on `main` again
  and commit the new pictures as in `docs/RELEASE-v2.1.md` step 5.

## Report-only on purpose (not your items)

- Hindi checks (B13, the Hindi half of B9 and B20, Hindi links): Hindi is paused (R47).
- B20 and the CI placeholder lint: until your email and date are in (v2.1, step 1).
- WebKit and Firefox projects: nightly CI, a clean week first.
- Play and the graph on the first screen of a 360×560 and a 320×568 window (the body is enforced).
- 30 fps at 6× CPU and the absolute CPU per frame: the real phone (step 8) counts; the CPU ratio
  between builds is enforced on every PR.
- The gut module's own time (v2's digestion, 2–8 ms) has a 15 ms ratchet instead of 2 ms: making
  it faster changes how its sums round, which after the seal is model version 4. The whole run
  stays within its 20 ms.
