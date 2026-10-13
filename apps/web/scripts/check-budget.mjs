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
//   Home stays "report": React, the router and i18next alone are about 100 KB, and every page
//   shares one entry chunk with the stage's first-paint code (Layout, the English core text).
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const KB = 1000

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
if (rows.some((r) => r.failed)) {
  console.error('\nAn enforced size budget is over. See apps/web/scripts/check-budget.mjs.')
  process.exit(1)
}
