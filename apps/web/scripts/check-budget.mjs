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
//   Home stays "report": React, the router and i18next alone are about 100 KB, and every page
//   shares one entry chunk with the stage's first-paint code (Layout, the English core text).
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const KB = 1000

/** The engine entry's key in the manifest (packages/engine/src/run.ts, relative to apps/web). */
const ENGINE = '../../packages/engine/src/run.ts'

const BUDGETS = [
  { name: 'Home (/)', roots: ['index.html'], max: 120 * KB, mode: 'report' },
  // The stage (pages/Simulator.tsx) is /sim since WP-19; /next only redirects to it.
  { name: '/sim before 3D', roots: ['index.html', 'src/pages/Simulator.tsx'], max: 190 * KB, mode: 'enforce' },
  // What a device with WebGL downloads on top, once, for the 3D body (three.js, @react-three).
  {
    name: '3D body (lazy)',
    roots: ['src/three/BodyCanvas.tsx'],
    minus: ['index.html', 'src/pages/Simulator.tsx'],
    max: 270 * KB,
    mode: 'enforce',
  },
  { name: 'precache (raw)', precache: true, max: 2600 * KB, mode: 'enforce' },
  // The engine (E-2): loaded with a plain import() when /sim mounts, on top of /sim's first download.
  { name: 'engine (lazy)', roots: [ENGINE], minus: ['index.html', 'src/pages/Simulator.tsx'], max: 45 * KB, mode: 'report' },
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
function staticFiles(roots) {
  const files = new Set()
  const seen = new Set()
  const walk = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Not in the manifest: ${key}`)
    files.add(chunk.file)
    for (const css of chunk.css ?? []) files.add(css)
    for (const dep of chunk.imports ?? []) walk(dep)
  }
  roots.forEach(walk)
  return [...files]
}

/** Every URL in the service worker's precache list. */
function precacheFiles() {
  const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8')
  return [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]))]
}

const rows = BUDGETS.map((b) => {
  let bytes
  if (b.precache) bytes = precacheFiles().reduce((sum, f) => sum + size(f), 0)
  else {
    const already = new Set(b.minus ? staticFiles(b.minus) : [])
    bytes = staticFiles(b.roots)
      .filter((f) => !already.has(f))
      .reduce((sum, f) => sum + gzip(f), 0)
  }
  const over = bytes > b.max
  return { ...b, bytes, over, failed: over && b.mode === 'enforce' }
})

const kb = (n) => `${(n / KB).toFixed(1)} KB`
const pad = (s, n) => String(s).padEnd(n)
console.log(`${pad('Budget', 18)}${pad('Size', 12)}${pad('Max', 12)}${pad('Mode', 9)}Result`)
for (const r of rows) {
  const result = r.over ? (r.failed ? 'OVER (fails)' : 'over (report only)') : 'ok'
  console.log(`${pad(r.name, 18)}${pad(kb(r.bytes), 12)}${pad(kb(r.max), 12)}${pad(r.mode, 9)}${result}`)
}

// Track A ledger (T0; plan qa-fixes §0): one row per FP, planned gross, claw-back and net, and the
// net its T-step measured. Report only: the Track A total must stay ≤ +0.5 KB over eee16c9's /sim.
{
  const ledger = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'budget-ledger.json'), 'utf8'))
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
  const over = now > ledger.netLimitKB + 0.05
  console.log(
    `Planned net ${sign(planned)} KB; measured rows ${sign(measured)} KB; /sim now ${kb(sim.bytes)} = ${sign(now)} KB over the base: ${over ? 'over (report only)' : 'ok'}`,
  )
}

// Every lazy chunk is precached (plan qa-fixes §3.2), so a part loaded on first use works offline.
// Report only until T10 (FP-9) enforces it.
{
  const precached = new Set(precacheFiles())
  const lazy = new Set()
  for (const chunk of Object.values(manifest)) for (const key of chunk.dynamicImports ?? []) if (manifest[key]) lazy.add(manifest[key].file)
  const missing = [...lazy].filter((f) => !precached.has(f))
  console.log(
    `\nLazy chunks precached: ${lazy.size - missing.length} of ${lazy.size}${missing.length ? ` (report only; missing: ${missing.join(', ')})` : ' ok'}`,
  )
}

// Engine not in /sim (E-2, architecture §4; enforced): /sim's first download must not carry the
// engine (its own error text) or any other system's signals (the first ID of each, as the lean
// catalog and the packs keep them out). The engine chunk is a lazy, precached file, and a production
// build has dropped ctx.get's development checks (core/module.ts GUARDS).
const guardProblems = []
{
  const NOT_IN_SIM = [
    'simulate: unknown organism',
    'heart.rate', // circulation
    'lungs.breathRate', // breathing
    'kidney.filtrationRate', // kidneys
    'blood.insulin', // hormones
    'brain.glucoseUse', // nerves
  ]
  for (const f of staticFiles(['index.html', 'src/pages/Simulator.tsx'])) {
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
  console.log(`\nEngine not in /sim (enforce): ${guardProblems.length ? `FAILS\n  ${guardProblems.join('\n  ')}` : 'ok'}`)
}

if (guardProblems.length) {
  console.error('\nThe engine guard failed. See apps/web/scripts/check-budget.mjs.')
  process.exit(1)
}

if (rows.some((r) => r.failed)) {
  console.error('\nAn enforced size budget is over. See apps/web/scripts/check-budget.mjs.')
  process.exit(1)
}
