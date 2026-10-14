// Checks the size budgets (roadmap A8) of a finished build. Run after `npm run build`:
//   npm run budget -w @lifepeek/web
// It reads dist/.vite/manifest.json, follows each route's static imports (what the browser must
// download before the route can draw), gzips each file (node:zlib, default level) and compares the
// sum with the budget. 1 KB = 1000 bytes, as Vite prints them. Fonts are not counted: the browser
// fetches only the ones a page uses, after the CSS.
//
// "report" rows print but never fail; "enforce" rows exit 1 when over. A later WP flips a row.
// History:
//   WP-03 (2026-10-12): Home 426 KB, /sim before 3D 440 KB, three 250 KB, precache 1.82 MB. A
//   manual `three` chunk swallowed React, so the entry imported it and every page loaded three.js.
//   WP-11: three.js is bundled from its source modules and only the 3D body imports most of it
//   (vite.config.ts); the client no longer ships zod (data/foods.ts); Hindi loads on demand
//   (i18n/index.ts). Home 151 KB, /sim and /next before 3D 179 KB, 3D body 250 KB.
//   WP-12b (2026-10-13): WP-12 + WP-16 + WP-13 had taken /next before 3D to 195 KB. The anatomy
//   curves no longer use three.js (anatomy/spline.ts; three's maths moved into the 3D chunk) and
//   the "How we know" panel + source list load when first opened: /sim 189.2 → 177.7 KB,
//   /next 195.0 → 181.4 KB, 3D body 249.2 → 258.9 KB.
//   WP-14 (2026-10-13): the dock's key moments, the Now line and the summary sentence are first
//   paint; the "More" stage text and the report form load on first use: /next 183.0 → 188.8 KB.
//   WP-17 follow-up (2026-10-13): merged main was /next 190.6 KB. The projector's graph marks
//   moved to one CSS block, the 3D look's colour maths into the 3D chunk, and the English text
//   only About, Privacy, Teach and Science use is fetched with those pages (i18n loadPageText):
//   /next 190.6 → 186.6 KB, /sim 181.1 → 177.8 KB, Home 157.3 → 154.0 KB.
//   WP-15 (2026-10-13): the key map, the graphs' summaries, the table and settings buttons and the
//   particle key are first paint; the table, the keys sheet and the food search load on first use
//   (one chunk, components/stage/Sheets.tsx). The English page texts are now cut at build time
//   (scripts/i18n-sections.mjs, replacing the list of named imports + loadPageText above): each
//   page imports only its own section, and Stats, the report form and v1's simulator texts leave
//   the first download too. /next 186.6 (main) → 188.6 KB with WP-15 (the named-import cut gave
//   190.1 KB with WP-15), /sim 177.8 → 179.2 KB, Home 154.0 → 153.4 KB.
//   FIX-C (2026-10-13): the Now line from the model (how much is where, the kept meal, "done"), the
//   louder summary, the squeezed-axis tint and the load boundaries took /next to 191.1 KB merged
//   with WP-15. Text only lazy parts show now loads with them (scripts/i18n-sections.mjs): the
//   known limits and the signals' long descriptions with "How we know", the full stage texts with
//   "More", the table and keys texts with the sheets, v1's own simulator texts with v1:
//   /next 191.1 → 188.9 KB, /sim 179.4 → 179.0 KB. Little room is left: anything new on the stage
//   that is not first paint must load on use.
//   FIX-D (2026-10-13): the load boundaries of the sheets and the food search, the key map's spoken
//   feedback and the reduced-motion CSS were paid for by leaving v1's store out of the stage (the
//   bodies' default clock is now the meal clock; v1 passes its own, hooks/useBodyClock.ts): /next
//   stays 188.9 KB (JS 0.1 KB smaller, CSS 0.2 KB larger), /sim 179.2 KB.
//   WP-18 (2026-10-13): the stage's Hindi layout fixes (Now line as a row, kept row, chips that
//   shorten, tick room, knee side) and the "Typical adult" strings: /next 188.9 (main with FIX-D)
//   → 189.2 KB. The pseudo-locale (i18n/pseudo.ts) is only in VITE_PSEUDO=1 builds, never here.
//   FIX-E (2026-10-13): "done" for big meals, an empty import as a load failure, the load box's
//   focus and the stricter motion pref were paid for by the Now line's word keys becoming their
//   JSON text (lib/nowWhere.ts): /next stays 189.2 KB (+2 bytes).
//   WP-19 (2026-10-13): the swap. /sim is the stage (pages/Stage.tsx), /next redirects to it, and
//   v1's simulator is no longer routed, so its row went. The first-screen "Press ▶" prompt, the
//   phone menu (with the projector switch in it) and the review fixes took /sim to 190.03 KB over
//   main's /next (189.4 KB with FIX-E, FIX-F and the perf commits). Home now draws its race from
//   data/hero.json instead of running the model, and fetches that file after its first paint, so
//   no page's first download carries it: /sim 190.03 → 189.5 KB, Home 154.0 → 145.5 KB. The e2e
//   build (pseudo-locale) now goes to dist-e2e, and this script refuses a dist that has it.
//   FIX-G (2026-10-13): the same-food summary (blood sugar raised longer, meals named by amount), the
//   marker pills, the share text and the lazy "new version" note (components/UpdateToast.tsx) took /sim
//   to 190.3 KB. Tailwind no longer scans v1's unrouted files (styles.css @source not; WP-20 deletes
//   them), which took 0.85 KB of their CSS off every page: /sim 189.5 KB, Home 145.5 → 144.9 KB.
//   WP-20 (2026-10-13): v1 deleted; the stage is pages/Simulator.tsx. v1's code had already left
//   the bundle with WP-19 (no route imported it), so what went now is what Tailwind still found in
//   v1's files (CSS), v1's texts (hi.json) and the registry's unused body loaders: /sim 189.5 →
//   187.5 KB, Home 145.5 → 144.6 KB, precache 1942.7 → 1929.0 KB. Merged with FIX-G (its
//   @source lines went with the files): /sim 188.2 KB, Home 144.9 KB, precache 1942.5 KB.
//   T0h (2026-10-13): Hindi paused behind VITE_HINDI (R47). Real builds have no hi.json chunk (the
//   precache loses it: 1942.5 → about 1872 KB), no language button, and a note for `?lang=hi`
//   links. Vite's lazy-import helper, which had ridden in the i18n chunk with the hi.json import,
//   is kept there by a chunk group (vite.config.ts) rather than becoming a file of its own:
//   /sim stays 188.2 KB, Home 144.9 → 144.8 KB.
//   FIX-H (2026-10-13): Hindi's font (Noto Sans Devanagari, 6 woff2 files) only in a Hindi build
//   (i18n/devanagari.css), and the English texts that named Hindi swapped for English-only ones
//   (scripts/i18n-sections.mjs): precache 1871.1 → 1730.4 KB, /sim 188.2 → 188.0 KB, Home 144.8 → 144.5 KB.
//   T1 / FP-10 (2026-10-13): one token set (longer semantic class names: surface-raised for shelf,
//   ink-muted for ink-2) and PageShell, which the not-found page in the entry chunk uses:
//   /sim 187.955 → 188.045 KB on main with FIX-H (+0.09; ledger row +0.1 against a planned −0.1),
//   Home 144.55 → 144.62 KB.
//   T2 / FP-1 (2026-10-14): the phone stage (rows, fit variant), the one-row plan strip with its
//   measured "+n" fold, the resting body in the empty state. "⋯" took Typical adult, Copy link and
//   Report off the bar: its panel (components/stage/MealActions.tsx) loads on first use, and gets
//   Keep and Report as elements so it shares no module with the stage (a shared one is split into
//   a chunk of its own). /sim 188.172 → 188.466 KB on main with T9a and T7 (+0.29; ledger row +0.3).
//   E-2 (2026-10-14, branch v3): the engine is a lazy chunk (`@lifepeek/engine/run`, loaded by
//   hooks/useRun.ts when /sim mounts); the main thread keeps the lean catalog (its definitions,
//   retired names and reserved rows moved to catalog-docs.ts), the codec and the view helpers
//   (view.ts): /sim 189.087 → 184.183 KB on v3 with T2 (−4.9), engine chunk 4.7 KB. The
//   "engine in /sim" guard below is enforced from here on.
//   T6 / FP-4 (2026-10-14): the squeezed zone a faint hatch with one knee rule, labelled once (on
//   the dock: each graph's "time squeezed" label and its placement went), the energy label's free
//   band, one value when a range's ends match, the carbs legend dot's dark edge, the stretched note's
//   own row on a phone: /sim 188.466 → 188.504 KB on main 19d7421 (+0.04; ledger row +0.04).
//   T5 / FP-3 (2026-10-14): the timeline's 44 px band and moments lane, Settings in its own cell,
//   hour labels thinned by measured width. The moments of both meals share one lane (one toolbar,
//   no range bars, no count badges, no width query) and a target's list loads with the sheets:
//   /sim 188.504 → 188.463 KB on main 78a6679 (−0.04; ledger row −0.04).
//   T8 / FP-6 (2026-10-14): Back closes sheets (their history code loads with the sheets), the
//   one-click Copy link on the bar from 1024 px (R60), `lang` only when chosen, and the codec's
//   `changes[]` (in the entry chunk, shared with Home: +0.2 of it). The link notes, "Update now" and
//   their text load only when a link has a note; the old link notes and the too-big-meal note moved
//   there too (−0.15): /sim 188.447 → 188.729 KB on main edcebce (+0.28; ledger row +0.28, planned +0.1).
//   T3 / FP-2 (2026-10-14): the short, wide stage (a CSS block: two columns, a 40 px header with the
//   links in its menu, a one-line footer), the summary under the graph on a small projector window
//   (a portal), the kept tag on one line, room over the head: /sim 188.447 → 188.797 KB on main
//   edcebce, measured on one machine (+0.35; ledger row planned +0.1).
//   T9b / FP-8 (2026-10-14): Home's promise beside the resting flat body (an SVG file drawn from
//   FlatBody at build time, flat/restingBody.ts: no drawing code in any download), the race's axis
//   text as HTML, the cola headline over the race. The race and its numbers (hero.json) are one
//   chunk loaded after Home's first paint (components/HomeRace.tsx), which takes its code out of the
//   entry every page shares: /sim 189.09 → 188.64 KB on main 647a379 (−0.45; ledger row −0.45,
//   planned 0), Home 144.5 KB.
//   T4 / FP-5 (2026-10-14): one lazy Overlay (components/Overlay.tsx: popover from 1024 px, sheet
//   below, Close, Esc + Back) replaces the first-paint Popover; "Report a mistake" leaves the bar's
//   code (it opens from "⋯"); the no-WebGL note is a Notes line; the phone menu gets a dimmed page:
//   /sim 188.636 → 188.396 KB on main bef54b1 (−0.24; ledger row planned +0.1), Home +0.18.
//   T10 / FP-9 (2026-10-14): dead code out (the store's swapKept and setPace, PersonTag, FirstRunNote)
//   and cold English loaded with its part: the "How we know" panel's own words, the rings' notes,
//   the units in words and whose body it is with the panel (whose body: the "⋯" panel too), the long
//   disclaimer with Science (scripts/i18n-sections.mjs); projector mode under 640 px keeps the phone's
//   type (CSS); Stats, About and Privacy use rules, not cards: /sim 188.396 → 187.998 KB on main
//   bd0f7b4 (−0.40; ledger row −0.40, planned −0.2), Home 144.66 → 144.27 KB. This script now
//   enforces the Home ratchet (147 KB, B26), the Track A total (R66: ≤ +1.0 KB over eee16c9, no
//   slack) and that every lazy chunk is precached.
//   W-1 (2026-10-14, branch v3): the systems registry (src/systems/: SystemIds, PackIds, SystemDef
//   with graph slots, SystemUi; digestion's Now line, summary and graph sentences moved into
//   systems/digestion/; keys 1–3 with S, B, E as digestion's aliases). The catalog's rows left the
//   first download (R67, architecture §1.3): core/catalog.ts keeps the IDs and types, the rows are
//   core/catalog/core.ts, which only the engine chunk imports (a pack brings its own rows file), and
//   the stage no longer checks a slot's row at run time (registry.test does). The sheets get the
//   system's words from the stage, so they split no stage code into new chunks: /sim 185.979 →
//   185.129 KB on v3 b0cc009 (−0.85: rows −1.08, registry +0.24); merged with v3 3924ecb (T4, S-2):
//   185.397 → 184.557 KB (−0.84); with v3 a5988f0 (T10, S-1): 184.233 KB, engine chunk 7.8 KB.
//   /sim's cap 190 → 194 KB, signed by the council as the LAST raise (R42): if a v3 step would pass
//   194, the engine worker (W-2) lands first; the cap never moves again. Load on demand (R71):
//   pack-manifest.json (scripts/pack-manifest.mjs) puts the engine and digestion's pack in the
//   precache tier and the 3D body, the other packs and Hindi in the lazy tier, which the service
//   worker keeps on first use ("lp-lazy", scripts/cache-policy.mjs: one policy object, as main's
//   T12d). The 3D body left the precache: 1791.0 → 823.3 KB raw on v3 3924ecb (828.4 KB with
//   a5988f0); the cap 2600 → 1300 KB (a ratchet). Tier checks and each pack ≤ 20 / 70 KB are
//   enforced; the lazy total is a report. The lazy-chunk check counts the lazy tier as offline.
//   "reactsToMeal" (a catalog row's field) joins the engine-not-in-/sim guard.
//   T12 (2026-10-14): load on demand, small cache (R71). The precache is the core only
//   (scripts/cache-tiers.mjs): 47 entries / 1777.6 KB → 35 / 756.4 KB raw; the 3D body, the
//   stage's on-use parts, the "new version" note and the latin-ext fonts are cached on first use
//   (lp-lazy, 1040 KB). The precache cap goes 2600 → 1300 KB, a ratchet that only moves down, and
//   "every lazy chunk is precached" becomes: every core file is precached, no lazy file is, nothing
//   else hashed is. The lazy total is reported. With T12a's build the bundler moved react-router's
//   hooks chunk into the entry (/sim 187.998 → 186.851 KB); the 3D body's slow, offline and failed
//   notes and its Try again (R71) took it back up: /sim 187.998 → 187.321 KB on main 1c1bbd5 (−0.68).
//   Merge of main adc6381 (T12) into v3 (2026-10-14): one caching implementation. scripts/cache-tiers.mjs
//   is the one tier source (main's core/lazy split with v3's packs: the engine and digestion's pack
//   join the core; every other pack, the 3D body, the stage's on-use parts, the update note and the
//   latin-ext fonts are lazy) and scripts/cache-policy.mjs the one Workbox config; pack-manifest.mjs
//   went into cache-tiers.mjs. v3's guards and main's precache-is-the-core check are kept.
//   I-1 (2026-10-14, branch v3): the section loader. Each pack's words are `sys.<packId>`, loaded
//   with the pack when its system is lit (systems/load.ts; none built yet). Home's words are a page
//   section that "/" loads with the app (main.tsx), and the texts of signals no graph shows load
//   with "How we know" (R76): /sim 184.233 → 183.972 KB on v3 a1d09e5 (−0.26), Home 145.260 →
//   145.393 KB (+0.13; its words are their own file now, counted in Home's roots). A lazy Home route
//   was tried and dropped: it split the entry's shared code into six files (+1.5 KB on /sim).
//   Merged into v3 after T12 (280b993): Home's words are in the core tier (cache-tiers.mjs), a
//   pack's section in its lazy pack; /sim 183.419 KB, Home 144.509 KB, precache 787.7 KB raw.
//   P-1 (2026-10-14, branch v3; R75 (1), R77, R78): PARAMS.gas, .effort and .water moved to
//   packParams.ts with circulation's, which only the engine chunk loads: /sim 184.318 → 184.021 KB
//   on v3 9d32d30 (−0.30), engine chunk 9.7 → 10.0 KB. One key of each pack's numbers joins the
//   engine-not-in-/sim guard.
//   Home's 120 KB stays the goal (report): React, the router and i18next alone are about 100 KB, and
//   every page shares one entry chunk with the stage's first-paint code (Layout, the English core text).
//   FIX-L (R87): the late notes lie over the body pane on a phone (Notes.tsx, +0.045) and the build puts
//   a vh fallback before every dvh (scripts/vh-fallback.mjs, +0.040; body's own min-height dropped,
//   Layout has it): /sim 187.286 → 187.372 KB on main 87f73a4 (+0.09).
//   U-2 (2026-10-14, branch v3): the system title (first paint: name, ‹ ›, the R71 loading words) and
//   its lazy picker (4.3 KB with the Overlay), breathing's row (its graphs, rhythm and texts come with
//   its pack, 8.5 KB), keys [ ] L, the switching state, the chip and graph-note hooks: /sim 185.283 →
//   186.515 KB on v3 94aa67e (+1.23; the title alone +0.55). The pack and the picker share no module
//   with the stage (props, written-out helpers; a vite group keeps the clock and the registry one
//   chunk): a shared module is otherwise split out of the route chunk (+1.9 KB measured).
//   U-3 (2026-10-14, branch v3): Heart & blood's row, the "one line at a time beside a kept plan" slot
//   (Where blood goes: Gut | Muscles), litres a minute to one decimal, its pack loader, its name and its
//   moment's name in the core text: /sim 186.876 → 187.151 KB on v3 6201885 (+0.28; its new utility
//   classes are inline styles, as Tailwind's CSS is in /sim). The pack (15.1 KB) takes its rows from the
//   engine chunk: importing the rows file split it out of the engine chunk (+0.3 KB on /sim + engine).
//   FIX-V3 (2026-10-14, branch v3; R93): focus goes back to the chip that opened the meal sheet (its
//   logic loads with the sheet) and to a sensible chip after ✕, the bout marks' download is tried
//   again, links name the layer with bouts: /sim 186.520 → 186.876 KB on v3 a2354c5 (+0.36), engine
//   10.662 KB. New enforced checks: the v3 ratchets (ledger `v3`: /sim 187.076, /sim + engine
//   197.838 KB), the system-chunk imports, and every lazy JS file in a pack-manifest entry (the legs'
//   chunk was in none) or on the allow-list.
//   U-1 (2026-10-14, branch v3): the effort pack (muscles, skin, the bones card) with three rows in the
//   first paint, their names, the mL-an-hour unit and the plumbing that keeps organ labels off a posed
//   arm (R89; the arm test is in the legs' chunk): /sim 186.876 → 187.153 KB on v3 6201885 (+0.28),
//   /sim + engine 197.815 KB. The pack takes its rows from the run chunk (a copy split them out of it:
//   +0.3 KB measured). Effort pack 13.5 KB gz (its entry with texts 16.3 KB).
//   X-1 (2026-10-14, branch v3): the flagship guided lesson. Its bar (components/LessonBar.tsx, with its
//   words and pauses), Home's lesson card and systems list (components/HomeLesson.tsx, loaded after
//   Home's first paint) and Teach's lessons by chapter are lazy; the stage keeps only the lesson store,
//   the bar's slot and the asked-for graph of a lit system: /sim 187.862 → 188.149 KB (+0.287), Home
//   144.6 → 145.0 KB. The bundler split the codec's meal and activity modules out of the entry when a
//   lazy chunk imported the codec without lib/presets.ts (+1.3 KB measured): the lesson's link goes
//   through presetHref (lib/flagship.ts).
//   A-0 3D half (2026-10-14, branch wp/a0-3d from v3 ce63198; v3.1): the 3D plumbing (three/mount.ts:
//   mount and dispose, the layer cache and LRU; per-layer program keys, uFill[N], the shared
//   attributes) and digestion's layer in three/layers/: "3D body (lazy)" is now "first 3D view",
//   259.7 → 260.7 KB (+1.0, enforced ≤ 270), plus the 3D-layer check (each other layer a lazy chunk
//   ≤ 20 KB). /sim 187.862 → 187.888 KB (+0.03: BodyView hands the row's layer to the 3D body),
//   under the ratchet, so no ledger row.
//   W-2 (2026-10-14, branch wp/w2-worker from v3 2a96599; v3.1): the engine worker. One classic iife
//   file (src/engine-worker.ts, assets/engine-worker-*.js) holding the run; lazy (R71: in lp-lazy on
//   first use, saved with the stage's lesson, never precached) and enforced at ≤ 45 KB gz / 150 raw.
//   /sim takes only its address and the page side of the async run; the wire format and the worker's
//   page side (toWire / fromWire, connectWorker) ride in the engine chunk. Ledger row W-2.
//   K-1 (2026-10-14, branch wp/k1-kinds from v3 a1e66ad; v3.2, R114): four more activity kinds shown.
//   /sim takes their chip names and pictures and the pose each is drawn in: 189.182 -> 189.298 KB
//   (+0.116). Ledger row K-1.
//   FIX-F2 (2026-10-14, branch wp/fix-f2 from v3 7fd594c; R120): the teacher switch's store and
//   its going off mid-load, [ ] during a load, Try again's and a system switch's focus: /sim
//   189.563 -> 189.899 KB (+0.336). Ledger row FIX-F2.
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import {
  ENGINE,
  PACK_SYSTEMS,
  SIM_ROOTS,
  WORKER,
  packManifest,
  staticFiles as manifestFiles,
  tierProblems,
  tiersOf,
} from './cache-tiers.mjs'
import { PARAMS_FILE, readSeal } from './model-seal.mjs'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const KB = 1000

/** Home's first download: the app and Home's words, which "/" loads with it (main.tsx, I-1). */
const HOME_ROOTS = ['index.html', 'lifepeek-en-home']

const BUDGETS = [
  // 120 KB is the goal (report); 147 KB is the ratchet it may never pass again (B26, plan qa-fixes §0).
  { name: 'Home (/)', roots: HOME_ROOTS, max: 120 * KB, mode: 'report' },
  { name: 'Home ratchet', roots: HOME_ROOTS, max: 147 * KB, mode: 'enforce' },
  // The stage (pages/Simulator.tsx) is /sim since WP-19; /next only redirects to it.
  // 194 is the LAST raise (R42, W-1): if a v3 step would pass it, the engine worker (W-2) lands first.
  { name: '/sim before 3D', roots: SIM_ROOTS, max: 194 * KB, mode: 'enforce' },
  // The first 3D view (anatomy plan §8, A-0 3D half): what a device with WebGL downloads on top of
  // /sim, once, for the 3D body: three.js, @react-three, the base (shell, food) and digestion's lit
  // layer, which is in the same chunk. Every other system's layer is a lazy chunk of its own (the
  // 3D-layer check below). 270 KB gz, enforced.
  {
    name: 'first 3D view',
    roots: ['src/three/BodyCanvas.tsx'],
    minus: SIM_ROOTS,
    max: 270 * KB,
    mode: 'enforce',
  },
  // 1300 since W-1 / T12d (R71: only the core at install; the 3D body, the stage's on-use parts and
  // the other packs load on first use). It only goes down (a ratchet); a raise needs an explicit
  // ruling (R74), written in the history above.
  { name: 'precache (raw)', precache: true, max: 1300 * KB, mode: 'enforce' },
  // What loads on first use (lp-lazy): reported, not capped (R71).
  { name: 'lazy total (raw)', lazyTotal: true, max: Infinity, mode: 'report' },
  // The engine (E-2): loaded with a plain import() when /sim mounts, on top of /sim's first download.
  { name: 'engine (lazy)', roots: [ENGINE], minus: SIM_ROOTS, max: 45 * KB, mode: 'report' },
  // W-2: the engine worker, one lazy file (architecture §3.2: ≤ 45 KB gz / ≤ 150 KB raw, enforced).
  { name: 'engine worker (lazy)', worker: 'gz', max: 45 * KB, mode: 'enforce' },
  { name: 'engine worker (raw)', worker: 'raw', max: 150 * KB, mode: 'enforce' },
  // U-5 (v3.1): the lymph pack (its graphs' words, the germ-defence card, the map with its fat dots,
  // its English: one lazy module, systems/lymph/pack.ts), at most 20 KB gz like every system pack
  // (ui-ux §9, anatomy plan §8). A-11a's "germ card + map ≤ 5 KB" row measured the same chunk when it
  // held only the card and the map; the card alone stays far under 5 KB (it is unchanged but a prop).
  { name: 'lymph pack (lazy)', roots: ['src/systems/lymph/pack.ts'], minus: SIM_ROOTS, max: 20 * KB, mode: 'enforce' },
  // U-2: the body-system picker (ui-ux §9, architecture §4: ≤ 6 KB gz, lazy), with the Overlay it opens in.
  { name: 'picker (lazy)', roots: ['src/components/SystemPicker.tsx'], minus: SIM_ROOTS, max: 6 * KB, mode: 'enforce' },
  // U-1: the effort pack (muscles, skin, the bones card: rows, words, English, three flat layers), one
  // lazy module (systems/muscles/pack.ts); a system pack is at most 20 KB gz (ui-ux §9, anatomy plan §8).
  { name: 'effort pack (lazy)', roots: ['src/systems/muscles/pack.ts'], minus: SIM_ROOTS, max: 20 * KB, mode: 'enforce' },
  // U-7: the control pack (Brain & nerves: the nerve demo with its numbers, words, English and flat
  // brain), one lazy module (systems/nerves/pack.ts); at most 20 KB gz like every system pack.
  { name: 'control pack (lazy)', roots: ['src/systems/nerves/pack.ts'], minus: SIM_ROOTS, max: 20 * KB, mode: 'enforce' },
]

const manifestFile = path.join(dist, '.vite', 'manifest.json')
if (!fs.existsSync(manifestFile)) {
  console.error(`No ${path.relative(process.cwd(), manifestFile)}. Run the build first.`)
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
// A build with the test-only pseudo-locale (VITE_PSEUDO=1, i18n/pseudo.ts) is not what ships, and
// it is bigger. The e2e build goes to dist-e2e (playwright.config.ts); the one measured here must be real.
const assets = path.join(dist, 'assets')
const pseudo = fs
  .readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .find((f) => fs.readFileSync(path.join(assets, f), 'utf8').includes('en-XA'))
if (pseudo) {
  console.error(`dist/assets/${pseudo} has the pseudo-locale (en-XA): a VITE_PSEUDO=1 test build. Build again without it.`)
  process.exit(1)
}
const size = (file) => fs.statSync(path.join(dist, file)).size
const gzip = (file) => gzipSync(fs.readFileSync(path.join(dist, file))).length

/** JS and CSS files a route downloads before it can draw: the roots and their static imports. */
const staticFiles = (roots) => manifestFiles(manifest, roots)

/** Every URL in the service worker's precache list. */
function precacheFiles() {
  const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8')
  return [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))]
}

const tiers = tiersOf(dist)
/** The engine worker's file (W-2): lazy, one file. */
const workerFiles = [...tiers.lazy].filter((f) => WORKER.test(f))

const rows = BUDGETS.map((b) => {
  let bytes
  if (b.precache) bytes = precacheFiles().reduce((sum, f) => sum + size(f), 0)
  else if (b.lazyTotal) bytes = [...tiers.lazy].reduce((sum, f) => sum + size(f), 0)
  else if (b.worker) bytes = workerFiles.reduce((sum, f) => sum + (b.worker === 'gz' ? gzip(f) : size(f)), 0)
  else {
    const already = new Set(b.minus ? staticFiles(b.minus) : [])
    bytes = staticFiles(b.roots)
      .filter((f) => !already.has(f))
      .reduce((sum, f) => sum + gzip(f), 0)
  }
  const over = bytes > b.max
  return { ...b, bytes, over, failed: over && b.mode === 'enforce' }
})

const kb = (n) => (n === Infinity ? '–' : `${(n / KB).toFixed(1)} KB`)
const pad = (s, n) => String(s).padEnd(n)
console.log(`${pad('Budget', 18)}${pad('Size', 12)}${pad('Max', 12)}${pad('Mode', 9)}Result`)
for (const r of rows) {
  const result = r.over ? (r.failed ? 'OVER (fails)' : 'over (report only)') : 'ok'
  console.log(`${pad(r.name, 18)}${pad(kb(r.bytes), 12)}${pad(kb(r.max), 12)}${pad(r.mode, 9)}${result}`)
}

// Track A ledger (T0; plan qa-fixes §0): one row per FP, planned gross, claw-back and net, and the
// net its T-step measured. Enforced since T10: /sim must stay ≤ netLimitKB over eee16c9's /sim
// (R66: +1.0 KB; it was +0.5 with 0.05 of slack), measured to the byte, no slack.
// R115: that line is main's. It is enforced only on a main build; a v3 build (model version 3 or
// later in params.ts, or a ledger with its `v3` table: both travel with the files, not the branch
// name) shows it as a report, and the v3 ratchets below with the 194 KB cap govern /sim.
let trackAOver = false
{
  const ledger = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'budget-ledger.json'), 'utf8'))
  const v3Build = readSeal(fs.readFileSync(PARAMS_FILE, 'utf8')).version >= 3 || Boolean(ledger.v3)
  const sim = rows.find((r) => r.name.startsWith('/sim'))
  const sign = (n) => (n == null ? '–' : `${n > 0 ? '+' : ''}${n.toFixed(1)}`)
  console.log(`\nTrack A ledger (/sim KB gz, base ${ledger.base.simKB} at ${ledger.base.commit}, net limit +${ledger.netLimitKB})`)
  console.log(`${pad('FP', 7)}${pad('Step', 6)}${pad('Gross', 7)}${pad('Claw', 7)}${pad('Net', 7)}${pad('Measured', 10)}What`)
  for (const r of ledger.rows) {
    console.log(
      `${pad(r.fp, 7)}${pad(r.step, 6)}${pad(sign(r.grossKB), 7)}${pad(sign(r.clawbackKB), 7)}${pad(sign(r.plannedNetKB), 7)}${pad(sign(r.measuredNetKB), 10)}${r.what}`,
    )
  }
  const planned = ledger.rows.reduce((s, r) => s + r.plannedNetKB, 0)
  const measured = ledger.rows.filter((r) => r.measuredNetKB != null).reduce((s, r) => s + r.measuredNetKB, 0)
  const now = sim.bytes / KB - ledger.base.simKB
  const over = now > ledger.netLimitKB
  trackAOver = over && !v3Build
  const verdict = !over ? 'ok' : trackAOver ? 'OVER (fails)' : 'over (report only on a v3 build, R115: the v3 ratchets govern)'
  console.log(
    `Planned net ${sign(planned)} KB; measured rows ${sign(measured)} KB; /sim now ${(sim.bytes / KB).toFixed(3)} KB = ${now > 0 ? '+' : ''}${now.toFixed(3)} KB over the base (${v3Build ? 'v3 build: report' : 'main build: enforce'}): ${verdict}`,
  )
  // R61: on v3 the rows above compare against main's T-steps only (v3 also has E-2's lazy engine);
  // this line says where this build stands against main itself. Update `main` when main merges in.
  if (ledger.main) {
    const vsMain = sim.bytes / KB - ledger.main.simKB
    console.log(
      `v3 vs main (report): /sim ${kb(sim.bytes)} against main's ${ledger.main.simKB} KB at ${ledger.main.commit} = ${sign(vsMain)} KB`,
    )
  }
}

// v3 ratchets (R93 #8, #9; enforced): /sim's first download, and /sim plus the engine chunk (what
// a cold start downloads before the first run), may not pass the last row of the ledger's `v3`
// table: measured + 0.2 KB (/sim) and + 0.3 KB (/sim + engine) when the row was written. A WP that
// grows either adds its own row (its measured sizes, its new ratchets), so every growth is a line
// someone signed. The 194 KB cap (R42) stays above them and never moves.
const ratchetProblems = []
{
  const ledger = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'budget-ledger.json'), 'utf8'))
  const last = ledger.v3?.rows?.at(-1)
  const sim = rows.find((r) => r.name.startsWith('/sim')).bytes / KB
  const engine = rows.find((r) => r.name.startsWith('engine')).bytes / KB
  if (!last) ratchetProblems.push('budget-ledger.json has no v3 ratchet row')
  else {
    if (sim > last.simRatchetKB)
      ratchetProblems.push(`/sim ${sim.toFixed(3)} KB is over the v3 ratchet ${last.simRatchetKB} KB (${last.wp})`)
    if (sim + engine > last.simEngineRatchetKB)
      ratchetProblems.push(
        `/sim + engine ${(sim + engine).toFixed(3)} KB is over the v3 ratchet ${last.simEngineRatchetKB} KB (${last.wp})`,
      )
    console.log(
      `\nv3 ratchets (enforce; ledger row ${last.wp}): /sim ${sim.toFixed(3)} of ${last.simRatchetKB} KB; /sim + engine ${(sim + engine).toFixed(3)} of ${last.simEngineRatchetKB} KB: ${ratchetProblems.length ? 'FAILS' : 'ok'}`,
    )
  }
}

// The lazy-layer trap (R93 #8; enforced): a system's lazy code (a dynamic entry under src/systems/)
// may import statically, of /sim's first download, only the chunks every lazy part can count on:
// the entry (index), React's jsx-runtime, i18n and the kit. A stage module it imports is split out of
// /sim's route chunk with everything the two share (+1.9 KB gz on /sim for the lymph map before
// flat/layerKit.ts). Two named exceptions cost /sim nothing: the route chunk itself (a whole chunk,
// nothing is cut out of it) and `clock`, a chunk group in vite.config.ts whose contents are fixed
// (U-2: the meal clock and the registry, which the breathing pack reads). A chunk outside /sim's
// first download (the pack's words, code it shares with the engine) moves nothing out of /sim; the
// engine's side of it is in the /sim + engine ratchet above.
const SYSTEM_SHARED = ['jsx-runtime', 'i18n', 'kit']
const SYSTEM_SHARED_GROUPS = ['clock']
const trapProblems = []
{
  const simKeys = new Set()
  const walk = (key) => {
    if (simKeys.has(key) || !manifest[key]) return
    simKeys.add(key)
    for (const dep of manifest[key].imports ?? []) walk(dep)
  }
  SIM_ROOTS.forEach(walk)
  const allowed = (dep) =>
    dep === 'index.html' ||
    SIM_ROOTS.includes(dep) ||
    [...SYSTEM_SHARED, ...SYSTEM_SHARED_GROUPS].some((n) => new RegExp(`^_*${n}-`).test(dep))
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.isDynamicEntry || !key.startsWith('src/systems/')) continue
    for (const dep of chunk.imports ?? [])
      if (simKeys.has(dep) && !allowed(dep))
        trapProblems.push(`${key} imports ${dep} statically: of /sim only index, jsx-runtime, i18n, kit (hand it over, flat/layerKit.ts)`)
  }
}
console.log(
  `System chunks take from /sim only index, jsx-runtime, i18n, kit, the route, clock (enforce): ${trapProblems.length ? 'FAILS' : 'ok'}`,
)

// 3D layers (anatomy plan §3, §8; A-0 3D half): digestion's is in the first 3D view; every other
// system's layer (three/layers/<id>.ts, SystemDef.layer3d) is a lazy chunk of ≤ 20 KB gz on top of
// the first 3D view, so lighting a system never grows what every WebGL device downloads first.
const LAYER_MAX = 20 * KB
const layerProblems = []
{
  if (manifest['src/three/layers/digestion.ts']?.isDynamicEntry)
    layerProblems.push('src/three/layers/digestion.ts is a lazy chunk: it belongs in the first 3D view')
  const first = new Set(staticFiles(['src/three/BodyCanvas.tsx', ...SIM_ROOTS]))
  const lines = []
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.isDynamicEntry || !key.startsWith('src/three/layers/')) continue
    const bytes = staticFiles([key])
      .filter((f) => !first.has(f))
      .reduce((sum, f) => sum + gzip(f), 0)
    lines.push(`${key} ${kb(bytes)}`)
    if (bytes > LAYER_MAX) layerProblems.push(`${key} is ${kb(bytes)} gz, over ${kb(LAYER_MAX)}`)
  }
  console.log(
    `\n3D layers: digestion's in the first 3D view, each other ≤ ${kb(LAYER_MAX)} (enforce): ${lines.length ? lines.join(', ') : 'none lazy yet'}; ${layerProblems.length ? 'FAILS' : 'ok'}`,
  )
}

// Every lazy JS file works offline once saved (plan qa-fixes §3.2, as R71 and R93 #7 changed it): it is
// in at least one entry of pack-manifest.json, so Teach's "Save for class offline" saves it, or on
// this allow-list of files a lesson never needs (the "new version" note and its service-worker helper).
const OFFLINE_ALLOW = ['src/components/UpdateToast.tsx', '../../node_modules/workbox-window/build/workbox-window.prod.es5.mjs']
let unsaved = 0
{
  const inEntry = new Set(Object.values(tiers.packs).flatMap((p) => p.files))
  const allowed = new Set(OFFLINE_ALLOW.map((k) => manifest[k]?.file).filter(Boolean))
  const lazyJs = [...tiers.lazy].filter((f) => f.endsWith('.js'))
  const missing = lazyJs.filter((f) => !inEntry.has(f) && !allowed.has(f))
  unsaved = missing.length
  console.log(
    `\nLazy JS in a pack-manifest entry or allow-listed (enforce): ${lazyJs.length - missing.length} of ${lazyJs.length}${missing.length ? ` (FAILS; in no entry: ${missing.join(', ')})` : ' ok'}`,
  )
}

// Tiers (R71 "load on demand, small cache"; scripts/cache-tiers.mjs, one source for main's T12d and
// v3's W-1): the precache is the core tier exactly (the shell, every page, the engine and
// digestion's pack: a cold offline start of the core simulator), and the lazy tier (the 3D body,
// the stage's on-use parts, the update note, latin-ext fonts, every other pack, Hindi) is kept by
// the service worker on first use. Enforced: every core file precached, no lazy or untiered hashed
// file precached, nothing in both tiers, every lazy file saveable, dist/pack-manifest.json matches
// this build; each system pack at most 20 KB gz / 70 KB raw. The lazy total is a report.
const packProblems = []
{
  const precached = precacheFiles()
  const file = path.join(dist, 'pack-manifest.json')
  if (!fs.existsSync(file)) packProblems.push('dist/pack-manifest.json is missing (vite.config.ts writes it)')
  else if (JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))) !== JSON.stringify(packManifest(tiers)))
    packProblems.push('dist/pack-manifest.json does not match this build')
  packProblems.push(...tierProblems(tiers, precached, (f) => fs.existsSync(path.join(dist, f))))
  const sizes = (files) => [files.reduce((n, f) => n + gzip(f), 0), files.reduce((n, f) => n + size(f), 0)]
  console.log(
    `\nPrecache: ${precached.length} files, the core's ${[...tiers.core].filter((f) => precached.includes(f)).length} of ${tiers.core.size}; lazy (lp-lazy): ${tiers.lazy.size} files.`,
  )
  console.log('Lazy entries (pack-manifest.json; gz / raw; a system pack at most 20 / 70 KB, enforce)')
  for (const [id, e] of Object.entries(tiers.packs)) {
    const [gz, raw] = sizes(e.files)
    const pack = id in PACK_SYSTEMS
    const over = pack && (gz > 20 * KB || raw > 70 * KB)
    if (over) packProblems.push(`pack ${id} is ${kb(gz)} gz / ${kb(raw)} raw, over 20 / 70 KB`)
    console.log(`${pad(id, 14)}${pad(kb(gz), 10)}${pad(kb(raw), 10)}${over ? 'OVER (fails)' : pack ? 'ok' : ''}`)
  }
  const unbuilt = Object.keys(PACK_SYSTEMS).filter((id) => id !== 'core' && !tiers.packs[id])
  if (unbuilt.length) console.log(`${pad('not built yet', 14)}${unbuilt.join(', ')}`)
  const [lgz, lraw] = sizes([...tiers.lazy])
  console.log(
    `${pad('lazy total', 14)}${pad(kb(lgz), 10)}${pad(kb(lraw), 10)}report: what a device fetches only when a part is first opened`,
  )
  console.log(`Tier checks (enforce): ${packProblems.length ? 'FAILS' : 'ok'}`)
}

// Engine not in /sim (E-2, architecture §4; enforced): /sim's first download must not carry the
// engine (its own error text), any other system's signals (the first ID of each, as the lean
// catalog and the packs keep them out) or a pack's numbers (packParams.ts, P-1). The engine chunk is a lazy, precached file, and a production
// build has dropped ctx.get's development checks (core/module.ts GUARDS).
const guardProblems = []
{
  const NOT_IN_SIM = [
    'simulate: unknown organism',
    // A catalog row (its field name survives minifying): rows load with the run or their pack (W-1, architecture §1.3).
    'reactsToMeal',
    'heart.rate', // circulation
    'lungs.breathRate', // breathing
    'kidney.filtrationRate', // kidneys
    'blood.insulin', // hormones
    'brain.glucoseUse', // nerves
    // A pack's numbers (P-1, R75 (1), R77, R78): one distinctive key of each, as packParams.ts keeps them in the run chunk.
    'weirCo2', // breathing (gas)
    'muscleMassShare', // muscles and skin (effort)
    'adhTauMin', // water and kidneys
    'restAvdo2MlPerL', // heart and blood (circulation)
    'raGainPerGPerMin', // hormones (insulin, S-6)
    // The nerve demo (S-7): its own lazy entry, @lifepeek/engine/demo (demo/nerveParams.ts).
    'nmjDelayMs',
    // Lymph (S-5, U-5; R108): its first graph's signal and one of its pack's numbers (packParams.ts lymph).
    'lymph.fatFlowRate',
    'packTauMin',
  ]
  for (const f of staticFiles(SIM_ROOTS)) {
    const text = fs.readFileSync(path.join(dist, f), 'utf8')
    for (const s of NOT_IN_SIM) if (text.includes(s)) guardProblems.push(`${f} (in /sim's first download) has "${s}"`)
  }
  const engine = manifest[ENGINE]
  if (!engine?.isDynamicEntry) guardProblems.push(`${ENGINE} is not a lazy chunk of its own`)
  else {
    const text = fs.readFileSync(path.join(dist, engine.file), 'utf8')
    if (!text.includes('simulate: unknown organism'))
      guardProblems.push(`${engine.file} is not the engine (no "simulate: unknown organism")`)
    if (text.includes('not in needs')) guardProblems.push(`${engine.file} still has ctx.get's development checks ("not in needs")`)
    if (!precacheFiles().includes(engine.file)) guardProblems.push(`${engine.file} is not precached: /sim would not run offline`)
  }
  // W-2: one engine worker file, lazy (the tier checks keep it out of the precache), and it is the engine.
  if (workerFiles.length !== 1) guardProblems.push(`expected one lazy engine worker file, found ${workerFiles.length}`)
  for (const f of workerFiles)
    if (!fs.readFileSync(path.join(dist, f), 'utf8').includes('simulate: unknown organism'))
      guardProblems.push(`${f} is not the engine (no "simulate: unknown organism")`)
  console.log(`\nEngine not in /sim (enforce): ${guardProblems.length ? `FAILS\n  ${guardProblems.join('\n  ')}` : 'ok'}`)
}

if (packProblems.length) {
  console.error(`\nThe tier check failed:\n  ${packProblems.join('\n  ')}\nSee apps/web/scripts/cache-tiers.mjs.`)
  process.exit(1)
}

if (guardProblems.length) {
  console.error('\nThe engine guard failed. See apps/web/scripts/check-budget.mjs.')
  process.exit(1)
}

if (ratchetProblems.length || trapProblems.length || layerProblems.length) {
  console.error(
    `\nA v3 ratchet, the system-chunk or the 3D-layer check failed:\n  ${[...ratchetProblems, ...trapProblems, ...layerProblems].join('\n  ')}`,
  )
  process.exit(1)
}

if (rows.some((r) => r.failed) || trackAOver || unsaved) {
  console.error('\nAn enforced size budget is over. See apps/web/scripts/check-budget.mjs.')
  process.exit(1)
}
