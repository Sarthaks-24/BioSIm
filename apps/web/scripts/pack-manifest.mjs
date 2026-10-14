// pack-manifest.json (W-1; architecture §4, R71 "load on demand, small cache"): every file the stage
// may load after its first paint, by what it is for, each entry in one of two tiers:
//   - precache: saved when the app is installed. Only the core: the engine and digestion's pack, so
//     a cold offline start of the core simulator keeps working;
//   - lazy: saved the first time it is used, in the service worker's "lp-lazy" cache
//     (scripts/cache-policy.mjs): the 3D body, every other system pack, Hindi.
// vite.config.ts writes it into dist/ after the bundle, and removes the lazy tier from the
// precache list (scripts/cache-policy.mjs). check-budget.mjs checks both tiers against the service
// worker and prints each pack's size and the lazy total. /teach's "Save for class offline" (R71,
// later) fetches the lazy URLs into lp-lazy. By hand: node apps/web/scripts/pack-manifest.mjs
//
// A pack's files are found by where their code lives, so a new pack needs no entry here:
//   - its lazy chunks: the dynamic entries under src/systems/<system>/ for each system of the pack,
//     and its catalog rows, packages/engine/src/core/catalog/<packId>.ts, with what they import
//     that /sim's first download does not already have;
//   - its English and Hindi sections: the chunks of `sys.<packId>` (I-1).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** PackIds and the systems each serves (architecture §0; systems/registry.test.ts checks them against the registry). */
export const PACK_SYSTEMS = {
  core: ['digestion'],
  breathing: ['breathing'],
  circulation: ['circulation'],
  kidneys: ['kidneys'],
  effort: ['muscles', 'skin', 'bones'],
  lymph: ['lymph'],
  control: ['hormones', 'nerves'],
  reproduction: ['reproduction'],
}

/** The engine entry's key in the Vite manifest (packages/engine/src/run.ts, relative to apps/web). */
export const ENGINE = '../../packages/engine/src/run.ts'
/** The 3D body's entry (three.js and the scene): lazy, never needed for the core simulator (R71). */
export const THREE_D = 'src/three/BodyCanvas.tsx'
/** Hindi's one file (a Hindi build only: R47). */
export const HINDI = 'src/i18n/hi.json'
/** /sim's first download: what every lazy part can count on. */
export const SIM_ROOTS = ['index.html', 'src/pages/Simulator.tsx']

/** JS and CSS files of the roots and their static imports. */
export function staticFiles(manifest, roots) {
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

/**
 * The manifest of a finished build, from Vite's: `entries` by name (`engine`, `3d`, `hindi`, and
 * each pack with any file), each `{ tier, files }`; then every URL of each tier once, as the
 * service worker serves it (`precache`, `lazy`).
 */
export function packManifest(manifest) {
  const sim = new Set(staticFiles(manifest, SIM_ROOTS))
  const beyondSim = (roots) => [...new Set(staticFiles(manifest, roots).filter((f) => !sim.has(f)))]
  const keys = Object.keys(manifest)
  const entries = {}
  if (manifest[ENGINE]) entries.engine = { tier: 'precache', files: beyondSim([ENGINE]) }
  for (const [pack, systems] of Object.entries(PACK_SYSTEMS)) {
    const roots = keys.filter(
      (k) =>
        manifest[k].isDynamicEntry &&
        (systems.some((s) => k.startsWith(`src/systems/${s}/`)) || k === `../../packages/engine/src/core/catalog/${pack}.ts`),
    )
    const sections = keys
      // `lifepeek-en-sys.<pack>` when only the pack's loader imports it (a real build: I-1),
      // `__lifepeek-en-sys.<pack>-<hash>.js` when it is a chunk shared by several.
      .filter((k) => new RegExp(`^_*lifepeek-(en|hi)-sys\\.${pack}(-|$)`).test(k))
      .map((k) => manifest[k].file)
    const files = [...new Set([...beyondSim(roots), ...sections])]
    if (files.length) entries[pack] = { tier: pack === 'core' ? 'precache' : 'lazy', files }
  }
  if (manifest[THREE_D]) entries['3d'] = { tier: 'lazy', files: beyondSim([THREE_D]) }
  if (manifest[HINDI]) entries.hindi = { tier: 'lazy', files: beyondSim([HINDI]) }
  const tier = (t) => [
    ...new Set(
      Object.values(entries)
        .filter((e) => e.tier === t)
        .flatMap((e) => e.files)
        .map((f) => `/${f}`),
    ),
  ]
  return { entries, precache: tier('precache'), lazy: tier('lazy') }
}

/**
 * The tier tests (R71): every precache URL is in the service worker's precache list; no URL is in
 * both tiers; every lazy URL is saveable (a hashed /assets/ file that exists, which the lp-lazy
 * cache keeps, and not precached). `precached`: the service worker's URLs; `exists(url)`: on disk.
 */
export function tierProblems(packs, precached, exists = () => true) {
  const have = new Set(precached.map((u) => (u.startsWith('/') ? u : `/${u}`)))
  const problems = []
  for (const url of packs.precache) if (!have.has(url)) problems.push(`${url} (precache tier) is not precached`)
  for (const url of packs.lazy) {
    if (packs.precache.includes(url)) problems.push(`${url} is in both tiers`)
    else if (have.has(url)) problems.push(`${url} (lazy tier) is precached: it should load on first use`)
    if (!/^\/assets\/[^/]+-[\w-]{8}\.\w+$/.test(url))
      problems.push(`${url} (lazy tier) is not a hashed /assets/ file: lp-lazy would not keep it`)
    else if (!exists(url)) problems.push(`${url} (lazy tier) is not in the build`)
  }
  return problems
}

// Run as a script: write dist/pack-manifest.json.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] ?? 'dist')
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, '.vite', 'manifest.json'), 'utf8'))
  const out = packManifest(manifest)
  fs.writeFileSync(path.join(dist, 'pack-manifest.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log(`pack-manifest.json: ${out.precache.length} precache, ${out.lazy.length} lazy (${Object.keys(out.entries).join(', ')})`)
}
