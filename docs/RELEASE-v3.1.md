# Release checklist (v3.1.0)

> **Branch (R118):** this release ships from the local branch `release/3.1`, made from tag `v3.1-rc`. The `v3` branch tip already holds later work (3.1/3.2), so do not merge `v3` itself.

v3.1 adds Class 10's Control and coordination and the road fat takes to the blood: lymph and
blood-fat graphs, insulin (an open loop, not an injection guide), the hot-pan nerve demo, the
optional 3D lungs, heart and kidneys, Teach's sixth chapter, and the engine worker (the maths can
run off the main thread on supported browsers). The model version stays 3, sealed: v3.1 adds new
outputs only. The code side is done on the local branch `release/3.1` (tag `v3.1-rc` plus the final audit's fixes that apply to 3.1, R120). What is left are **your** steps, in this
order. Tick each box.

Every command is for **Git Bash**, run from the main checkout `/e/BioSim`. Pushes go **by name
only**: never `git push --tags`, never `--force`.

## 0. Where it stands

    cd /e/BioSim && git checkout release/3.1 && npm ci && npm run release-gate

It says `NOT READY` with one item of yours: the CHANGELOG heading `3.1.0 (unreleased)` (you change
it in step 3). Your v2.1 items (email, launch date, INDB date, `GOVERNANCE.md`) come from `main` in
step 2. Hindi is paused (R47): do **not** set `VITE_HINDI`.

## 1. v3.0 is live first

- [ ] Every step of `docs/RELEASE-v3.0.md` is done: `v3.0.0` is tagged and pushed, Vercel serves
      it, and its teacher pilot and 2 GB phone check are written down.
- [ ] Check:

      git -C /e/BioSim tag -l v3.0.0                                   # prints v3.0.0
      git -C /e/BioSim log -1 --format=%s v3.0.0
      curl -s https://lifepeek.vercel.app/teach | grep -c "Control and coordination"   # 0: v3.0 has five chapters

## 2. Bring `main` into `release/3.1`, then check `release/3.1`

- [ ] Merge:

      cd /e/BioSim && git checkout release/3.1
      cd /e/BioSim && git merge main -m "Merge main (v3.0.0) into release/3.1"

  `CHANGELOG.md` will probably conflict: keep **both** entries, `## 3.1.0 (unreleased)` on top and
  `## 3.0.0` (as released, without "unreleased") under it. Any other conflict: stop and ask.
- [ ] All green on `release/3.1` (the e2e run takes about 30–40 minutes; it builds its own test site):

      cd /e/BioSim && npm ci && npm run check
      cd /e/BioSim && npm run budget -w @lifepeek/web
      cd /e/BioSim && CI=1 npm run e2e -w @lifepeek/web -- --workers=2
      cd /e/BioSim && npm run release-gate        # now lists only the CHANGELOG heading

  `npm run budget` says "v3 build: report" on the Track A line (R115): on `release/3.1` the v3 ratchets and
  the 194 KB cap are the ones that must say `ok`.

## 3. Finish the CHANGELOG

- [ ] In `CHANGELOG.md` change `## 3.1.0 (unreleased)` to `## 3.1.0`. Commit it on `release/3.1`:

      cd /e/BioSim && git commit -am "v3.1.0: changelog"
      cd /e/BioSim && npm run release-gate        # must say READY

## 4. Merge `release/3.1` into `main`

- [ ] Merge:

      cd /e/BioSim && git checkout main
      cd /e/BioSim && git merge --no-ff release/3.1 -m "Merge release/3.1: LifePeek 3.1 (control and coordination, lymph, 3D)"
      cd /e/BioSim && npm ci && npm run check && npm run release-gate

  On `main` the Track A line stays a report too: `main` now has model version 3 and the ledger's
  `v3` table, so the v3 ratchets govern from here.

## 5. Tag v3.1.0 and push

- [ ] Tag the merge commit:

      git -C /e/BioSim tag -a v3.1.0 -m "LifePeek v3.1.0: control and coordination, lymph, 3D organs"

- [ ] Push by name:

      git -C /e/BioSim push origin main
      git -C /e/BioSim push origin v3.1.0

- [ ] The release notes are the 3.1.0 entry of `CHANGELOG.md`:

      cd /e/BioSim && awk '/^## 3.1.0/{f=1;next} /^## /{f=0} f' CHANGELOG.md > /tmp/notes-3.1.0.md
      gh release create v3.1.0 -R Sarthaks-24/lifepeek --title "LifePeek v3.1.0" --notes-file /tmp/notes-3.1.0.md

- [ ] The GitHub Actions run for that push is green. Then GitHub → Actions → **Release gate → Run
      workflow** on the tag: it says `READY`.

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

- [ ] By hand, on a laptop and on a phone:
  - The title above the body opens the systems: ten of them; Lymph & germ defence and Brain &
    nerves say "Model estimate", Bones "Drawing only".
  - `https://lifepeek.vercel.app/sim?v=3&a=cheeseburger:1,fries:1&b=roti:1&t=240&layer=lymph`:
    two graphs (Fat’s road, Blood fat); the burger's blood fat stays up for hours.
  - `https://lifepeek.vercel.app/sim?v=3&a=cola:1&b=water:1&t=27&layer=hormones`: the insulin
    graph, and under it "it is not an injection guide"; the water line stays at 1×.
  - `https://lifepeek.vercel.app/sim?v=3&a=roti:1&layer=nerves`: "Touch the hot pan" plays; the
    counters stop at 64 ms and 214 ms. "Sources and limits" → "Why different? ›" opens the card
    with NCERT Class 10, Ch 6, p. 102.
  - On a laptop with 3D: Breathing, Heart & blood and Kidneys & water draw their organs in 3D, and
    turning the view keeps the labels on them. With 3D off (or on a phone without it) the flat
    drawing shows the same numbers.
  - Home: the guided lesson still has five pauses (blood, breaths, sweat, water, blood fat); the last is
    about blood fat and says what insulin did. Next, Back and the clicker's Page Down work.
  - Teach: six chapters, eleven lessons; "Control and coordination" lists the hot pan, then
    insulin. The hot-pan worksheet prints on one A4 page (its sketch is in ms), and its QR code
    opens the demo.
  - Teach → "Save all for class offline" → "Ready for class offline ✓" on every lesson; turn the
    network off; the hot-pan lesson still opens.

## 7. 2 GB phone check, with input lag

- [ ] On the 2 GB Android phone, Chrome, on the live site: follow `docs/PHONE-CHECK.md`
      (`?debug=fps`), then for Lymph, Hormones and Brain & nerves:
  - Play for 1 minute (the hot pan: play it three times): the frame rate, and whether the phone
    gets hot.
  - **Input lag**: tap "+" on a food, add a walk, switch the system, drag the timeline. Each
    should answer within about a tenth of a second; "Working it out…" over a dimmed picture for a
    moment is expected on this phone. Write down any tap that takes half a second or more, and on
    which screen. Send the notes to the council; do not change anything yourself.

## After the release

- Visual baselines: the screens changed, so run **Actions → Visual baselines** on `main` again
  and commit the new pictures as in `docs/RELEASE-v2.1.md` step 5.
- Clean-up of the build's scratch folders (not in the repo): `E:\tmp-u6`, `E:\tmp-u7-ncert`,
  `E:\tmp-u7-scripts`.

## Report-only on purpose (not your items)

- Hindi checks: Hindi is paused (R47).
- The Track A line in `npm run budget` (R115): the v3 ratchets and the 194 KB cap are enforced.
- WebKit and Firefox projects: nightly CI.
- 30 fps at 6× CPU and the absolute CPU per frame: the real phone (step 7) counts; the CPU ratio
  between builds is enforced on every PR.
- The engine's time checks are strict only in CI's perf job (R110); locally they allow 3×.
