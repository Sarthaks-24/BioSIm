// Checks the size budgets (roadmap A8) of a finished build. Run after `npm run build`:
//   npm run budget -w @lifepeek/web
// It reads dist/.vite/manifest.json, follows each route's static imports (what the browser must
// download before the route can draw), gzips each file (node:zlib, default level) and compares the
// sum with the budget. 1 KB = 1000 bytes, as Vite prints them. Fonts are not counted: the browser
// fetches only the ones a page uses, after the CSS.
//
// "report" rows print but never fail; "enforce" rows exit 1 when over. A later WP flips a row.
// Today's numbers (2026-10-12, WP-03 build):
//   Home 426 KB, /sim before 3D 440 KB, three 250 KB, precache 1.82 MB.
//   Home and /sim are far over: the bundler puts modules that @react-three shares with the rest of
//   the app (React among them) into the `three` chunk, so the entry imports it and every page
//   downloads three.js. Both rows stay "report" until that is fixed; Home also needs WP-19 (no
//   `simulate` on Home).
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const KB = 1000

const BUDGETS = [
  { name: 'Home (/)', roots: ['index.html'], max: 120 * KB, mode: 'report' },
  { name: '/sim before 3D', roots: ['index.html', 'src/pages/Simulator.tsx'], max: 190 * KB, mode: 'report' },
  { name: 'three chunk', chunk: 'three', max: 270 * KB, mode: 'enforce' },
  { name: 'precache (raw)', precache: true, max: 2600 * KB, mode: 'enforce' },
]

const manifestFile = path.join(dist, '.vite', 'manifest.json')
if (!fs.existsSync(manifestFile)) {
  console.error(`No ${path.relative(process.cwd(), manifestFile)}. Run the build first.`)
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
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
  else if (b.chunk) {
    const chunk = Object.values(manifest).find((c) => c.name === b.chunk)
    if (!chunk) throw new Error(`No chunk named ${b.chunk}`)
    bytes = gzip(chunk.file)
  } else bytes = staticFiles(b.roots).reduce((sum, f) => sum + gzip(f), 0)
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
