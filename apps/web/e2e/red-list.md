# Red list (T0)

The QA sweep's bugs (cache/plans/v3/qa/bug-sweep.md §3, B1–B26) as report tests, run on
**eee16c9** (the code the sweep tested: the e2e build, `VITE_PSEUDO=1`, Chromium, 2026-10-13).
Plan: qa-fixes §0 ("a report test counts only if it was seen failing on eee16c9") and §1.1.

- Tests: `e2e/redlist.spec.ts`, project `redlist`. Modes: `RED_LIST` in `e2e/helpers/gate.ts`.
- Raw result: `e2e/red-list.json` (what each test measured), made with
  `PLAYWRIGHT_JSON_OUTPUT_FILE=red.json npx playwright test --project=redlist --reporter=json`
  then `node scripts/red-list.mjs red.json --commit eee16c9 --write`.
- While a bug's mode is `report`, its test prints `[gate report] redlist red Bn: …` and passes.
  **The T-step that fixes it flips its mode to `enforce`** (then the test must pass) and reruns the
  script, so the JSON shows it green.
- A step that cannot finish (a button not there, a wait that times out) is one more problem of its
  bug, never a failed test while the bug reports. Tests that need Hindi (B7, B9, B13, B20's Hindi
  half) skip on a build without it (R47); the script counts them as skipped, and joins B20's two
  halves (English, and Hindi read from the saved language, as on B9's Home).

## Seen failing on eee16c9 (22 of 26)

| Bug | Measured on eee16c9 | Fix | T-step |
|---|---|---|---|
| B1 | body picture 0 px tall at 360×640 and 320×568, EN and HI, ± kept | FP-1 | T2 |
| B2 | meal bar: 3 rows of controls, 153 px tall, at 320/360/375 | FP-1 | T2 |
| B3 | body 0 px at 640×360, 844×390, 640×400 (200 % zoom) | FP-2 | T3 |
| B4 | "Keys and settings" overlaps the timeline by 44×12 (EN) / 47×13 px (HI) at 390 and 360 | FP-3 | T5 |
| B5 | "How we know" at 360×640: top 8 px, above the header's bottom (49); no visible Close | FP-5 | T4 |
| B6 | Back with the Add food sheet open goes to `about:blank` | FP-6 | T8 |
| B7 | Hindi header 82 px tall at 360 and 320 (limit 56) | FP-1 | T2 |
| B8 | Home chart: all 10 labels under 12 px at 360 (smallest 8 px) | FP-8 | T9b |
| B9 | Hindi Home 360×640: "Open the simulator" ends at y 803 | FP-8 | T9b |
| B10 | phone menu stays open after switching projector mode on (the tab clip did not show at 390) | FP-5 (FP-4) | T4 (T6) |
| B11 | no Copy link / Share at 360×640, 768×1024, 800×1280 | FP-6 | T8 |
| B12 | projector 1024×768 kept: body 15 % of the stage, EN and HI (1280×800 and 1366×768 pass ≥ 40 %) | FP-2 | T3 |
| B13 | Hindi projector ticks "0 घं" / "1 घं" 7.2 px apart (limit 8) | FP-3 | T5 |
| B15 | 6 foods: 2 of 6 chips wholly visible at 1440, 1 of 6 at 360, no "+n" | FP-1 | T2 |
| B18 | with 250 ms frames the clock runs at 37 % of its pace (3.7 vs 9.9 sim min/s) | FP-7 | T7 |
| B19 | `THREE.Clock: This module has been deprecated` warning on /sim | FP-7 | T7 |
| B20 | /privacy shows `<project email>` and `<date of launch>` (EN and HI) | FP-8 + user | T9a |
| B21 | `a=cola:999` → `cola:5`, 8 foods → 6, `t=99999` → 2880, no note | FP-6 | T8 |
| B22 | `lang=en` added to a link that had none | FP-6 | T8 |
| B23 | lesson opens at 35 min; step 2 says only "press Play" | FP-8 | T9a |
| B24 | report form: 2 privacy warnings | FP-8 | T9a |
| B25 | `swapKept` defined in state/run.ts, never called | FP-9 | T10 |

## Not on the red list

| Bug | Why | Where it is checked |
|---|---|---|
| B14 | Not reproduced: at 1440×900 the energy label sits 11 px clear of the kept line (kept lessons at 0–6 h); at 1280 the label is not drawn. Fix speculative. | FP-4 visual shots (§3.3); device lab |
| B16 | Intermittent (seen once in the sweep, not in 3 tries); needs two builds and two pages at once. | T7 adds the two-pages negative + A→B positive test; Firefox fresh profile (device lab) |
| B17 | WebKit under load only; Playwright WebKit on Windows is not Safari. | T7 (WebKit 1/3/6 s, report); iPhone/iPad (device lab) |
| B26 | Not a browser bug: Home 144.8 KB > 120 (report row), fps 27.7 < 30 (report). | `npm run budget` (Home row, Track A ledger), `perf.spec.ts` (fps, CPU per frame), `scripts/cpu-ratio.mjs` |

## Invariant projects (report)

`e2e/invariants.spec.ts` runs the §3.2 invariants on the new projects (`phone-small`, `phone-560`,
`phone-xs`, `tablet-portrait`, `landscape`, `projector-sizes`, `storage-blocked`; `webkit-*` and
`firefox-desktop` with `E2E_ENGINES=1`). On eee16c9 they report, among others: body 0 px on every
phone and landscape size, no body in the empty state (U2), the tablet page scrolls (1088 px in
1024), "Keys and settings" and the key-moment markers overlapping the timeline track, the
"Typical adult" popover without a Close button, `lang=en` added to links, every `dvh` without a `vh`
fallback. Their modes are in `INVARIANTS` (one per project); T2, T3 and T7 flip theirs.
They run in English and the +40 % pseudo-locale (`?lang=pseudo`), not Hindi (R47: Hindi is paused);
the one `lang=hi` link of the round-trip check reports whatever its project's mode.
