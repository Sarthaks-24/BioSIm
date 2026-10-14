# Release checklist (v3.2.0)

> **Branch (R118):** this release ships from the local branch `release/3.2`, made from tag `v3.2-rc`
> (step 1 says how). The tag marks the `v3` commit that holds all of v3.2 (the four new activities,
> reproduction behind the teacher switch, the 3D legs and "Whole body", and the v3.2 Teach step).
> Do not merge `v3` itself: work for later releases may land on it after the tag.

v3.2 adds four activities (football, cricket, badminton, sitting in class), Classes 8 to 10
reproduction behind the per-tab teacher switch "Growing up", 3D legs with a "Whole body" button,
and two Teach lessons (football or a walk; the lining of the uterus) with worksheets and "Why
different?" cards. The model version stays 3, sealed: v3.2 adds no new model numbers. The code side
is done on the `v3` branch. What is left are **your** steps, in this order. Tick each box.

Every command is for **Git Bash**, run from the main checkout `/e/BioSim`. Pushes go **by name
only**: never `git push --tags`, never `--force`. Hindi is paused (R47): do **not** set
`VITE_HINDI`.

## 0. v3.1 is live first

- [ ] Every step of `docs/RELEASE-v3.1.md` is done: `v3.1.0` is tagged and pushed, Vercel serves
      it, and its 2 GB phone check is written down.
- [ ] Check:

      git -C /e/BioSim tag -l v3.1.0                                   # prints v3.1.0
      git -C /e/BioSim log -1 --format=%s v3.1.0
      curl -s https://lifepeek.vercel.app/teach | grep -c "Control and coordination"   # 1 or more

## 1. Make `release/3.2` from the tag `v3.2-rc`

- [ ] The tag is there (the council sets it on `v3` once the v3.2 gate is green):

      git -C /e/BioSim tag -l v3.2-rc                                  # prints v3.2-rc
      git -C /e/BioSim log --oneline -1 v3.2-rc
      git -C /e/BioSim log --oneline v3.2-rc..v3                       # later work, if any: it stays out

  No `v3.2-rc`? Stop and ask the council which commit it is; do not tag the `v3` tip yourself.
  If the last command prints nothing, the `v3` tip and the tag are the same commit; use the branch
  all the same.
- [ ] Make the branch and see where it stands:

      cd /e/BioSim && git branch release/3.2 v3.2-rc && git checkout release/3.2
      cd /e/BioSim && npm ci && npm run release-gate

  It says `NOT READY` with one item of yours: the CHANGELOG heading `3.2.0 (unreleased)` (you
  change it in step 3).

## 2. Bring `main` into `release/3.2`, then check it

- [ ] Merge:

      cd /e/BioSim && git checkout release/3.2
      cd /e/BioSim && git merge main -m "Merge main (v3.1.0) into release/3.2"

  `CHANGELOG.md` will probably conflict: keep **all** entries, `## 3.2.0 (unreleased)` on top, then
  `## 3.1.0` and `## 3.0.0` as released (without "unreleased"). Any other conflict: stop and ask.
- [ ] All green (the e2e run takes about 30–40 minutes; it builds its own test site):

      cd /e/BioSim && npm ci && npm run check
      cd /e/BioSim && npm run budget -w @lifepeek/web
      cd /e/BioSim && CI=1 npm run e2e -w @lifepeek/web -- --workers=2
      cd /e/BioSim && npm run release-gate        # now lists only the CHANGELOG heading

  `npm run budget` says "v3 build: report" on the Track A line (R115): the v3 ratchets and the
  194 KB cap are the ones that must say `ok`.

## 3. Finish the CHANGELOG

- [ ] In `CHANGELOG.md` change `## 3.2.0 (unreleased)` to `## 3.2.0`. Commit it on `release/3.2`:

      cd /e/BioSim && git commit -am "v3.2.0: changelog"
      cd /e/BioSim && npm run release-gate        # must say READY

## 4. Merge `release/3.2` into `main`

- [ ] Merge:

      cd /e/BioSim && git checkout main
      cd /e/BioSim && git merge --no-ff release/3.2 -m "Merge release/3.2: LifePeek 3.2 (games, growing up, 3D legs)"
      cd /e/BioSim && npm ci && npm run check && npm run release-gate

## 5. Tag v3.2.0 and push

- [ ] Tag the merge commit:

      git -C /e/BioSim tag -a v3.2.0 -m "LifePeek v3.2.0: games, growing up (teacher switch), 3D legs"

- [ ] Push by name:

      git -C /e/BioSim push origin main
      git -C /e/BioSim push origin v3.2.0

- [ ] The release notes are the 3.2.0 entry of `CHANGELOG.md`:

      cd /e/BioSim && awk '/^## 3.2.0/{f=1;next} /^## /{f=0} f' CHANGELOG.md > /tmp/notes-3.2.0.md
      gh release create v3.2.0 -R Sarthaks-24/lifepeek --title "LifePeek v3.2.0" --notes-file /tmp/notes-3.2.0.md

- [ ] The GitHub Actions run for that push is green. Then GitHub → Actions → **Release gate → Run
      workflow** on the tag: it says `READY`.
- [ ] Merge `main` back into `v3`, so later work starts from the release:

      cd /e/BioSim && git checkout v3 && git merge main -m "Merge main (v3.2.0) into v3"

  A conflict here is only about later v3 work: keep both sides' changes, or stop and ask.

## 6. Deploy

Vercel builds `main` on its own when it is pushed (the project from v2.1, with `VITE_SITE_URL`
set). The production build stops by itself if the model were not sealed (`model-seal.mjs`).

- [ ] vercel.com → the project → **Deployments**: the newest production deployment is the merge
      commit and says "Ready". If it failed, open its build log and send it to the council.

### What to check after the deploy

Replace the address if yours differs.

- [ ] Headers, pages and the real 404, as before:

      curl -sI https://lifepeek.vercel.app/ | grep -i -E "x-content-type|referrer-policy|content-security|permissions-policy"
      curl -s -o /dev/null -w "%{http_code}\n" https://lifepeek.vercel.app/teach            # 200
      curl -s -o /dev/null -w "%{http_code}\n" https://lifepeek.vercel.app/no-such-page     # 404

- [ ] The browser checks against the live site (must pass; tests that need the test build's extra
      language skip themselves):

      cd /e/BioSim && PLAYWRIGHT_BASE_URL=https://lifepeek.vercel.app npm run e2e -w @lifepeek/web -- --workers=2

- [ ] **The teacher switch**, by hand on a laptop, in a **new tab**:
  - Settings (the gear) shows "Growing up (Classes 8 to 10)", **off**. The systems list (the
    title above the body) has ten systems and no Reproduction; Teach has six chapters and no
    "Reproduction and growing up".
  - `https://lifepeek.vercel.app/sim?v=3&a=roti:1&layer=reproduction` opens **Digestion**, not
    Reproduction (no link can turn the switch on).
  - Switch it on. The systems list ends with Reproduction ("Teacher switch: on"). Pick it: two
    panels beside the body, nothing drawn on the body. "Why different? ›" by "Cycles differ: NCERT
    Class 9 says 21–35 days" opens the card with Class 9 p. 221 and Class 10 p. 124.
  - Teach now has seven chapters: "Reproduction and growing up" lists "Why does the lining of the
    uterus build up every month?" (Class 8 · Class 9 · Class 10). Its worksheet prints on one A4
    page; nothing on it asks about anyone's own cycle.
  - Close the tab and open the site in a new one: the switch is off again, and Reproduction is gone.
- [ ] **The activities**, on a laptop and on a phone:
  - `https://lifepeek.vercel.app/sim?v=3&a=roti:1&b=roti:1&t=45&layer=breathing&act=football.30.20&bact=walk.30.20`
    opens with football and no "left out" note; breaths about 30 a minute in the game, about 24 in
    the kept walk. Heart & blood: about 130 against 95 beats a minute.
  - The activity sheet shows "Walking and running", "Games" and "Sitting"; add cricket, badminton
    and sitting in class one at a time: each is kept in the link.
  - Teach → Respiration lists "Football or a walk: what do the heart and lungs do?" after the run;
    its worksheet prints on one A4 page and its QR code opens the game.
- [ ] **3D legs and "Whole body"**, on a laptop with 3D: add a run; the 3D body has legs in the
      running pose. "Whole body" (top right of the body) moves out to the whole standing body;
      pressed again, back. Try it on Breathing, Heart & blood and Kidneys & water. With 3D off,
      the flat drawing shows the same numbers.
- [ ] **Offline**: Teach → "Save all for class offline" → "Ready for class offline ✓" on every
      lesson; turn the network off; the football lesson still opens, and the guided lesson steps
      through all five stops (the last, blood fat, included).

## 7. 2 GB phone check

- [ ] On the 2 GB Android phone, Chrome, on the live site: follow `docs/PHONE-CHECK.md`
      (`?debug=fps`), then:
  - The football link above: Play for 1 minute with the 3D body (legs in the running pose), then
    press "Whole body" and play another minute. Write down the frame rate and whether the phone
    gets hot. (Measured on the build: about 48 thousand triangles and 9 draws at the 2 GB setting.)
  - **Input lag**: add football, switch to Heart & blood, press "Whole body", drag the timeline.
    Each should answer within about a tenth of a second; "Working it out…" over a dimmed picture
    for a moment is expected. Write down any tap that takes half a second or more.
  - Switch "Growing up" on and open Reproduction: the panels scroll, and "As a table" opens.
  - Send the notes to the council; do not change anything yourself.

## After the release

- Visual baselines: the screens changed (the 3D legs, the Whole body button, Teach), so run
  **Actions → Visual baselines** on `main` again and commit the new pictures as in
  `docs/RELEASE-v2.1.md` step 5.
- Clean-up of the build's scratch folders (not in the repo): `E:\tmp-r1-dl`, `E:\tmp-r1-base`,
  `E:\tmp-r1-scripts-en.py`, `E:\tmp-r1-scripts-size.cjs`, `E:\tmp-r1-fix.py`, `E:\tmp-t32-ncert`.

## Not in this release (on purpose)

- The liver and glycogen loop, and the change to how fast solid food leaves the stomach: they wait
  for a named physiology reviewer and would need a new model version.
- Hindi: paused (R47).

## Report-only on purpose (not your items)

- Hindi checks: Hindi is paused (R47).
- The Track A line in `npm run budget` (R115): the v3 ratchets and the 194 KB cap are enforced.
- WebKit and Firefox projects: nightly CI.
- 30 fps at 6× CPU and the absolute CPU per frame: the real phone (step 7) counts; the CPU ratio
  between builds is enforced on every PR.
- The engine's time checks and "first run ≤ 400 ms at 4× CPU" are strict only in CI's perf job
  (R110, R118); locally they allow more.
