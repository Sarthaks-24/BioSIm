// Load on demand, small cache (R71; T12d on main, W-1 on v3): the one source of truth for which
// built files the service worker saves at install (the core, "precache") and which only once they
// are first used (the runtime cache `lp-lazy`, scripts/cache-policy.mjs).
//
// The core is what a page needs to draw and work offline: the entry (shell, router, English core
// text, CSS), each page's code (route chunks: the stage with the digestion model), the engine and
// digestion's pack (`core`: its rows and text, so a cold offline start of the core simulator keeps
// working), Home's race, the link notes, the pictures they show (resting body, QR), the latin woff2
// fonts and the icons. Everything else loads when first used and is runtime-cached: the 3D body
// (three.js, about 970 KB), the stage's on-use parts (sheets, "More", "How we know", overlays, the
// "⋯" panel, the report form), the "new version" note, the latin-ext fonts, every other system
// pack, Hindi. A new lazy part is lazy by default: the precache grows only by an explicit ruling
// (R74), which is a new entry in CORE_ROOTS. The `.woff` fallbacks are never saved (no modern
// browser asks for them).
//
// A system pack's files are found by where their code lives, so a new pack needs no entry here:
//   - its lazy chunks: the dynamic entries under src/systems/<system>/ for each system of the pack,
//     and its catalog rows, packages/engine/src/core/catalog/<packId>.ts, with what they import;
//   - its English and Hindi sections: the chunks of `sys.<packId>` (I-1).
//
// Used by the build (vite.config.ts: the precache list, globIgnores and dist/pack-manifest.json),
// by scripts/check-budget.mjs (the tier checks and sizes) and, through pack-manifest.json, by
// Teach's "Save for class offline" (lib/offlineSave.ts). All from Vite's build manifest.
import fs from 'node:fs'
import path from 'node:path'

/** Build-manifest keys whose files (and their static imports) are the core tier, with ENGINE and the `core` pack. */
export const CORE_ROOTS = [
  'index.html',
  'src/pages/Simulator.tsx',
  'src/pages/Teach.tsx',
  'src/pages/Science.tsx',
  'src/pages/About.tsx',
  'src/pages/Privacy.tsx',
  'src/pages/Stats.tsx',
  // Drawn on every visit to Home, right after its first paint.
  'src/components/HomeRace.tsx',
  // What an opened link needs said (an older or newer version, foods that no longer exist), which
  // a student may open offline: the notes and their text (FP-6, R79).
  'src/components/stage/LinkNotes.tsx',
]

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

/** The engine entry's key in the Vite manifest (packages/engine/src/run.ts, relative to apps/web): core (E-2). */
export const ENGINE = '../../packages/engine/src/run.ts'
/** The 3D body's entry (three.js and the scene): lazy, never needed for the core simulator (R71). */
export const THREE_D = 'src/three/BodyCanvas.tsx'
/** Hindi's one file (a Hindi build only: R47). */
export const HINDI = 'src/i18n/hi.json'
/** /sim's first download: what every lazy part can count on. */
export const SIM_ROOTS = ['index.html', 'src/pages/Simulator.tsx']

/**
 * Lazy parts that Teach's "Save for class offline" saves for a lesson: the stage's on-use parts,
 * and the 3D body (only on a device with WebGL). Keys of the build manifest.
 */
export const LESSON_PACKS = {
  '3d': { webgl: true, roots: [THREE_D] },
  stage: {
    roots: [
      'src/components/stage/Sheets.tsx',
      'src/components/stage/StageMore.tsx',
      'src/components/graphs/HowWeKnowPanel.tsx',
      'src/components/Overlay.tsx',
      'src/components/stage/MealActions.tsx',
      'src/components/FeedbackDialog.tsx',
    ],
  },
}

/** The runtime cache for lazy files (scripts/cache-policy.mjs, lib/offlineSave.ts through pack-manifest.json). */
export const LAZY_CACHE = 'lp-lazy'

/**
 * What lp-lazy keeps (scripts/cache-policy.mjs): hashed build files under /assets/ (a new version
 * has new names, so a kept copy is never stale), never a .woff fallback. Every lazy URL must match.
 */
export const LAZY_URL = /^\/assets\/[^/]+-[\w-]{8}\.(?:js|css|woff2|svg|png)$/

const isFont = (file) => /\.woff2?$/.test(file)
/** A font file the core keeps: latin woff2 (not latin-ext, never the .woff fallbacks). */
const coreFont = (file) => /\.woff2$/.test(file) && !/-latin-ext-/.test(file)

/** Every file of these manifest keys: their chunk, its static imports, CSS and assets (fonts filtered by `font`). */
function closure(manifest, roots, font) {
  const files = new Set()
  const seen = new Set()
  const walk = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new Error(`cache-tiers: not in the build manifest: ${key}`)
    files.add(chunk.file)
    for (const css of chunk.css ?? []) files.add(css)
    for (const asset of chunk.assets ?? []) if (!isFont(asset) || font(asset)) files.add(asset)
    for (const dep of chunk.imports ?? []) walk(dep)
  }
  roots.forEach(walk)
  return files
}

/** JS and CSS files of the roots and their static imports (what a route downloads before it can draw). */
export function staticFiles(manifest, roots) {
  return [...closure(manifest, roots, () => false)].filter((f) => /\.(?:js|css)$/.test(f))
}

/** A system pack's manifest keys: its systems' lazy chunks, its catalog rows, its text sections. */
function packRoots(manifest, pack) {
  const systems = PACK_SYSTEMS[pack]
  return Object.keys(manifest).filter(
    (k) =>
      (manifest[k].isDynamicEntry &&
        (systems.some((s) => k.startsWith(`src/systems/${s}/`)) || k === `../../packages/engine/src/core/catalog/${pack}.ts`)) ||
      (/^_*lifepeek-(en|hi)-sys\./.test(k) && k.replace(/^_+/, '').slice('lifepeek-en-sys.'.length).startsWith(`${pack}-`)),
  )
}

/**
 * The tiers of a build: `core` (precache) and `lazy` (runtime cache), as dist-relative paths
 * ("assets/…"), and `packs`, the lazy files of each lazy entry: LESSON_PACKS (Teach's lessons),
 * each other system pack with any file, and Hindi. `assetFiles` lists dist/assets (fonts the CSS
 * names are in the manifest too, but this catches anything else). Nothing is in both tiers.
 */
export function cacheTiers(manifest, assetFiles) {
  const roots = [...CORE_ROOTS, ...(manifest[ENGINE] ? [ENGINE] : []), ...packRoots(manifest, 'core')]
  const core = closure(manifest, roots, coreFont)
  const all = new Set([...Object.values(manifest).map((c) => c.file), ...assetFiles.map((f) => `assets/${f}`)])
  for (const chunk of Object.values(manifest)) for (const css of chunk.css ?? []) all.add(css)
  const lazy = new Set([...all].filter((f) => !core.has(f) && !f.endsWith('.woff')))
  const lazyOf = (keys) => [...closure(manifest, keys, () => false)].filter((f) => lazy.has(f))
  const packs = {}
  for (const [id, pack] of Object.entries(LESSON_PACKS))
    if (pack.roots.every((k) => manifest[k])) packs[id] = { webgl: !!pack.webgl, files: lazyOf(pack.roots) }
  for (const id of Object.keys(PACK_SYSTEMS)) {
    if (id === 'core') continue
    const files = lazyOf(packRoots(manifest, id))
    if (files.length) packs[id] = { webgl: false, files }
  }
  if (manifest[HINDI]) packs.hindi = { webgl: false, files: lazyOf([HINDI]) }
  return { core, lazy, packs }
}

/** The tiers of a finished build in `dir` (dist), from its .vite/manifest.json. */
export function tiersOf(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.vite', 'manifest.json'), 'utf8'))
  return cacheTiers(manifest, fs.readdirSync(path.join(dir, 'assets')))
}

/**
 * dist/pack-manifest.json: each entry tiered precache or lazy (R71), with its URLs. The Teach page
 * reads it (precached, so offline too) to save a lesson's lazy files and to say whether it is saved.
 */
export function packManifest({ core, packs }) {
  const urls = (files) => [...files].sort().map((f) => `/${f}`)
  return {
    cache: LAZY_CACHE,
    entries: [
      // The app shell too: offline, every page is drawn from it.
      { id: 'core', tier: 'precache', urls: ['/index.html', ...urls(core)] },
      ...Object.entries(packs).map(([id, p]) => ({ id, tier: 'lazy', ...(p.webgl ? { webgl: true } : {}), urls: urls(p.files) })),
    ],
  }
}

/**
 * The tier checks (R71): the precache is the core exactly (every core file in it, no lazy file, no
 * other hashed file), nothing is in both tiers, and every lazy file is saveable (a hashed /assets/
 * file that lp-lazy keeps, which exists). `precached`: the service worker's URLs; `exists(file)`: on disk.
 */
export function tierProblems({ core, lazy }, precached, exists = () => true) {
  const have = new Set(precached.map((u) => u.replace(/^\//, '')))
  const problems = []
  for (const f of core) if (!have.has(f)) problems.push(`${f} (core) is not precached`)
  for (const f of have) if (f.startsWith('assets/') && !core.has(f) && !lazy.has(f)) problems.push(`${f} is precached but in no tier`)
  for (const f of lazy) {
    if (core.has(f)) problems.push(`${f} is in both tiers`)
    else if (have.has(f)) problems.push(`${f} (lazy) is precached: it should load on first use`)
    if (!LAZY_URL.test(`/${f}`)) problems.push(`${f} (lazy) is not a hashed /assets/ file: lp-lazy would not keep it`)
    else if (!exists(f)) problems.push(`${f} (lazy) is not in the build`)
  }
  return problems
}

/**
 * The Vite plugin: after the build is written it works out the tiers, writes pack-manifest.json,
 * adds the lazy files to the globIgnores it was given (`ignoreLazyIn`, scripts/cache-policy.mjs),
 * and gives the service worker its precache list (`manifestTransform`: of dist/assets only the
 * core; the other precached files are the shell, the web manifest, the icons and pack-manifest.json).
 */
export default function cacheTiersPlugin() {
  let tiers = null
  const ignores = []
  return {
    name: 'lifepeek-cache-tiers',
    apply: 'build',
    writeBundle(options) {
      tiers = tiersOf(options.dir)
      for (const list of ignores) list.push(...tiers.lazy)
      fs.writeFileSync(path.join(options.dir, 'pack-manifest.json'), `${JSON.stringify(packManifest(tiers), null, 1)}\n`)
    },
    /** Fills this globIgnores list with the lazy tier once the bundle is written (R71: generated from the lazy list). */
    ignoreLazyIn(list) {
      ignores.push(list)
    },
    /** Workbox manifestTransform: of the hashed files, only the core is precached. */
    manifestTransform: async (entries) => {
      if (!tiers) throw new Error('cache-tiers: the service worker was built before the tiers')
      return { manifest: entries.filter((e) => !e.url.startsWith('assets/') || tiers.core.has(e.url)), warnings: [] }
    },
  }
}
