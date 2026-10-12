# Phone check (roadmap A10): 30 fps on a 2 GB Android Go phone

The release gate needs the body to play at 30 frames a second on a cheap phone. The Playwright
check (`e2e/perf.spec.ts`: flat body, CPU slowed 6×) is a stand-in; this is the real thing.
Run it on every WP that changes the body (first in WP-16) and in the release gate (WP-22).

## What you need

- A phone with **2 GB of memory or less** running Android Go (for example a Samsung Galaxy A03
  Core, Nokia C-series, Redmi A-series). Write down its exact model.
- Chrome on the phone, up to date. Note its version (`chrome://version`, first line).
- The phone and the computer on the same home Wi-Fi.

## Steps

1. In the worktree being checked (before it is merged):

   ```bash
   cd /e/BioSim/.claude/worktrees/wp-NN && npm run build -w @lifepeek/web
   cd /e/BioSim/.claude/worktrees/wp-NN && npm run preview -w @lifepeek/web -- --host --port 4173
   ```

   Vite prints a `Network:` address such as `http://192.168.1.23:4173/`.

2. On the phone, open that address followed by `/next?debug=fps`. Close the medical note.
3. A small dark box appears in the body's top-right corner, updated every second:
   `31 fps · dpr 2.75 · 3D 31 draws/s · 9 calls · 89.0k tris`.
   - **fps**: frames the browser managed per second. This is the number that counts.
   - **draws/s**: how often the 3D body was drawn (it draws only while the clock moves).
   - **calls**, **tris**: draw calls and triangles of the last 3D frame (budget: ≤ 30 calls,
     triangles as low as the look allows). `flat` instead means the phone shows the flat body.
   - **dpr** is the screen's pixel ratio; the body itself renders at most at 1.25 on a 2 GB
     phone (1.5 otherwise).
4. Play each meal below from the start (Home on the timeline, or reload) and watch the fps for
   at least 20 seconds of playing. Write down the **lowest steady value** (ignore the first
   second after pressing Play):
   - `/next?v=2&a=cola:1&debug=fps` (a drink: food in the gut quickly)
   - `/next?v=2&a=roti:2,dal:1,milk:1&debug=fps` (the Indian staple meal)
   - `/next?v=2&a=cheeseburger:1,fries:1&b=cola:1&debug=fps` (big meal, with a kept run)
5. Repeat step 4 in Hindi (`&lang=hi`) for one meal, and once with the phone in landscape.
6. Pause and leave the page for 30 seconds: the phone should not get warm (a paused body draws
   nothing; the debug box itself keeps the page drawing, so close it with a reload without
   `?debug=fps` for this part).

## Where to write the result

- In the WP's **merge commit message**, one line:
  `Phone check: <model>, Chrome <version>, Android <version>: cola 34, roti+dal+milk 31, burger+kept 30 fps (lowest steady).`
- If any meal is **below 30 fps**, schedule **WP-16b** (quality tiers with a matcap material and
  a frame governor) before WP-22.
