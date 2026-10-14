// Load on demand, small cache (T12d, R71): which built files the service worker saves at install
// (the core, "precache") and which only once they are first used (the runtime cache `lp-lazy`).
//
// The core is what a page needs to draw and work offline: the entry (shell, router, English core
// text, CSS), each page's code (route chunks: the stage with the digestion model and the engine,
// Teach, Science, About, Privacy, Stats), Home's race, the pictures they show (resting body, QR),
// the latin woff2 fonts and the icons. Everything else loads when first used and is runtime-cached:
// the 3D body (three.js, about 970 KB), the stage's on-use parts (sheets, "More", "How we know",
// overlays, the "⋯" panel, link notes, the report form), the "new version" note, the latin-ext
// fonts. A new lazy part is lazy by default: the precache grows only by an explicit ruling (R74),
// which is a new entry in CORE_ROOTS. The `.woff` fallbacks are never saved (no modern browser
// asks for them).
//
// Used by the build (vite.config.ts: the precache list and dist/pack-manifest.json) and by
// scripts/check-budget.mjs (the precache checks), from Vite's build manifest.
import fs from 'node:fs'
import path from 'node:path'

/** Build-manifest keys whose files (and their static imports) are the core tier. */
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
  // a student may open offline: the notes and their text (FP-6).
  'src/components/stage/LinkNotes.tsx',
]

/**
 * Lazy parts that Teach's "Save for class offline" saves for a lesson: the stage's on-use parts,
 * and the 3D body (only on a device with WebGL). Keys of the build manifest.
 */
export const LESSON_PACKS = {
  '3d': { webgl: true, roots: ['src/three/BodyCanvas.tsx'] },
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

/** The runtime cache for lazy files (vite.config.ts, pages/Teach.tsx). */
export const LAZY_CACHE = 'lp-lazy'

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

/**
 * The tiers of a build: `core` (precache) and `lazy` (runtime cache), as dist-relative paths
 * ("assets/…"), and `packs`, the lazy files of each LESSON_PACKS entry. `assetFiles` lists
 * dist/assets (fonts the CSS names are in the manifest too, but this catches anything else).
 * Nothing is in both tiers.
 */
export function cacheTiers(manifest, assetFiles) {
  const core = closure(manifest, CORE_ROOTS, coreFont)
  const all = new Set([...Object.values(manifest).map((c) => c.file), ...assetFiles.map((f) => `assets/${f}`)])
  for (const chunk of Object.values(manifest)) for (const css of chunk.css ?? []) all.add(css)
  const lazy = new Set([...all].filter((f) => !core.has(f) && !f.endsWith('.woff')))
  const packs = Object.fromEntries(
    Object.entries(LESSON_PACKS).map(([id, pack]) => [
      id,
      { webgl: !!pack.webgl, files: [...closure(manifest, pack.roots, () => false)].filter((f) => lazy.has(f)) },
    ]),
  )
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
 * The Vite plugin: after the build is written it works out the tiers, writes pack-manifest.json,
 * and gives the service worker its precache list (`manifestTransform`, a Workbox manifestTransform that
 * keeps of dist/assets only the core; the other precached files are the shell, the manifest, the
 * icons and pack-manifest.json, by vite.config.ts globPatterns and globIgnores).
 */
export default function cacheTiersPlugin() {
  let tiers = null
  return {
    name: 'lifepeek-cache-tiers',
    apply: 'build',
    writeBundle(options) {
      tiers = tiersOf(options.dir)
      fs.writeFileSync(path.join(options.dir, 'pack-manifest.json'), `${JSON.stringify(packManifest(tiers), null, 1)}\n`)
    },
    /** Workbox manifestTransform: of the hashed files, only the core is precached. */
    manifestTransform: async (entries) => {
      if (!tiers) throw new Error('cache-tiers: the service worker was built before the tiers')
      return { manifest: entries.filter((e) => !e.url.startsWith('assets/') || tiers.core.has(e.url)), warnings: [] }
    },
  }
}
