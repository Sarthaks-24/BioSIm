import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { workboxPolicy } from './cache-policy.mjs'
import { CORE_ROOTS, ENGINE, HINDI, LAZY_URL, LESSON_PACKS, cacheTiers, packManifest, tierProblems } from './cache-tiers.mjs'

// Load on demand, small cache (T12d, R71): the tiers from a build manifest shaped like Vite's.
const manifest = {
  'index.html': {
    file: 'assets/index-a.js',
    isEntry: true,
    css: ['assets/index-a.css'],
    imports: ['_shared-a.js'],
    assets: [
      'assets/resting-body-a.svg',
      'assets/font-latin-400-normal-a.woff2',
      'assets/font-latin-400-normal-a.woff',
      'assets/font-latin-ext-400-normal-a.woff2',
    ],
  },
  '_shared-a.js': { file: 'assets/shared-a.js' },
  'src/pages/Simulator.tsx': { file: 'assets/Simulator-a.js', imports: ['index.html', '_clock-a.js'], isDynamicEntry: true },
  '_clock-a.js': { file: 'assets/clock-a.js', imports: ['index.html'] },
  ...Object.fromEntries(
    ['Teach', 'Science', 'About', 'Privacy', 'Stats'].map((p) => [
      `src/pages/${p}.tsx`,
      { file: `assets/${p}-a.js`, imports: ['index.html'] },
    ]),
  ),
  'src/components/HomeRace.tsx': { file: 'assets/HomeRace-a.js', imports: ['index.html'] },
  'src/components/stage/LinkNotes.tsx': { file: 'assets/LinkNotes-a.js', imports: ['index.html'] },
  'src/three/BodyCanvas.tsx': { file: 'assets/BodyCanvas-a.js', imports: ['_clock-a.js', 'src/pages/Simulator.tsx'], isDynamicEntry: true },
  ...Object.fromEntries(
    LESSON_PACKS.stage.roots.map((key) => [
      key,
      { file: `assets/${path.basename(key, '.tsx')}-a.js`, imports: ['index.html', '_sheet-text-a.js'] },
    ]),
  ),
  '_sheet-text-a.js': { file: 'assets/sheet-text-a.js' },
  'src/components/UpdateToast.tsx': { file: 'assets/UpdateToast-a.js', imports: ['index.html'] },
}
const files = [
  'index-a.js',
  'index-a.css',
  'resting-body-a.svg',
  'font-latin-400-normal-a.woff2',
  'font-latin-400-normal-a.woff',
  'font-latin-ext-400-normal-a.woff2',
]

describe('cache tiers', () => {
  const tiers = cacheTiers(manifest, files)

  it('the core: the entry, every page with the stage and the engine, Home race, link notes, the latin woff2 fonts', () => {
    for (const f of [
      'assets/index-a.js',
      'assets/index-a.css',
      'assets/shared-a.js',
      'assets/Simulator-a.js',
      'assets/clock-a.js',
      'assets/Teach-a.js',
      'assets/HomeRace-a.js',
      'assets/LinkNotes-a.js',
      'assets/resting-body-a.svg',
      'assets/font-latin-400-normal-a.woff2',
    ])
      expect(tiers.core.has(f), f).toBe(true)
  })

  it('lazy: the 3D body, the stage parts used on demand, the update note, latin-ext; never a .woff', () => {
    for (const f of ['assets/BodyCanvas-a.js', 'assets/Sheets-a.js', 'assets/UpdateToast-a.js', 'assets/font-latin-ext-400-normal-a.woff2'])
      expect(tiers.lazy.has(f), f).toBe(true)
    expect([...tiers.core, ...tiers.lazy].some((f) => f.endsWith('.woff'))).toBe(false)
    expect([...tiers.core].filter((f) => tiers.lazy.has(f))).toEqual([])
  })

  it("a lesson's packs: only lazy files (3D with WebGL only), each of them saveable", () => {
    expect(tiers.packs['3d']).toEqual({ webgl: true, files: ['assets/BodyCanvas-a.js'] })
    expect(tiers.packs.stage.webgl).toBe(false)
    expect(tiers.packs.stage.files).toContain('assets/Sheets-a.js')
    expect(tiers.packs.stage.files).toContain('assets/sheet-text-a.js')
    for (const pack of Object.values(tiers.packs)) for (const f of pack.files) expect(tiers.lazy.has(f), f).toBe(true)
  })

  it('pack-manifest.json: the core (with the shell) as precache, each pack as lazy, by URL', () => {
    const pm = packManifest(tiers)
    expect(pm.cache).toBe('lp-lazy')
    const core = pm.entries.find((e) => e.id === 'core')
    expect(core.tier).toBe('precache')
    expect(core.urls).toContain('/index.html')
    expect(core.urls).toContain('/assets/Simulator-a.js')
    expect(pm.entries.find((e) => e.id === '3d')).toEqual({ id: '3d', tier: 'lazy', webgl: true, urls: ['/assets/BodyCanvas-a.js'] })
    const lazyUrls = pm.entries.filter((e) => e.tier === 'lazy').flatMap((e) => e.urls)
    expect(lazyUrls.filter((u) => core.urls.includes(u))).toEqual([])
  })

  it('every core root is a page, the Home race or the link notes (the precache grows only by a ruling, R74)', () => {
    const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    for (const root of CORE_ROOTS) if (root !== 'index.html') expect(fs.existsSync(path.join(app, root)), root).toBe(true)
    expect(CORE_ROOTS).toHaveLength(9)
  })
})

// v3's packs in the same tiers (W-1): the engine with the core rows, a breathing pack whose UI chunk
// shares a file with the stage and whose catalog rows and English text are its own, and Hindi.
const v3 = {
  ...manifest,
  'src/pages/Simulator.tsx': { ...manifest['src/pages/Simulator.tsx'], dynamicImports: [ENGINE] },
  [ENGINE]: { file: 'assets/run-AAAAAAAE.js', isDynamicEntry: true, imports: ['_clock-a.js', '_rows-core.js'] },
  '_rows-core.js': { file: 'assets/rows-core-AAAAAAAF.js' },
  [HINDI]: { file: 'assets/hi-AAAAAAAH.js', isDynamicEntry: true },
  'src/systems/breathing/ui.tsx': { file: 'assets/ui-AAAAAAAI.js', isDynamicEntry: true, imports: ['_clock-a.js', '_lung.js'] },
  '_lung.js': { file: 'assets/lung-AAAAAAAJ.js' },
  '../../packages/engine/src/core/catalog/breathing.ts': { file: 'assets/breathing-AAAAAAAK.js', isDynamicEntry: true },
  '__lifepeek-en-sys.breathing-AAAAAAAL.js': { file: 'assets/_lifepeek-en-sys.breathing-AAAAAAAL.js' },
  // A static (first-paint) file under a system's folder is not a pack's.
  'src/systems/digestion/NowLine.tsx': { file: 'assets/NowLine-AAAAAAAM.js' },
}

describe("cache tiers with v3's packs (W-1; R71 load on demand)", () => {
  const tiers = cacheTiers(v3, files)

  it("finds a pack's English section by the key a real build gives it (a lazy entry, no hash), and keeps Home's words in the core (I-1)", () => {
    const built = cacheTiers(
      {
        ...v3,
        'lifepeek-en-sys.kidneys': { file: 'assets/_lifepeek-en-sys.kidneys-AAAAAAAN.js', isDynamicEntry: true },
        'lifepeek-en-home': { file: 'assets/_lifepeek-en-home-AAAAAAAO.js', isDynamicEntry: true },
      },
      files,
    )
    expect(built.packs.kidneys).toEqual({ webgl: false, files: ['assets/_lifepeek-en-sys.kidneys-AAAAAAAN.js'] })
    expect(built.packs.breathing).toEqual(tiers.packs.breathing)
    expect(built.core.has('assets/_lifepeek-en-home-AAAAAAAO.js')).toBe(true)
    expect(built.lazy.has('assets/_lifepeek-en-home-AAAAAAAO.js')).toBe(false)
  })

  it('puts the engine (with the core rows) in the core: a cold offline start of the core simulator', () => {
    for (const f of ['assets/run-AAAAAAAE.js', 'assets/rows-core-AAAAAAAF.js']) expect(tiers.core.has(f), f).toBe(true)
  })

  it('finds a pack by where its code lives (lazy chunks, catalog rows, text), never core files; 3D and Hindi are lazy', () => {
    expect(tiers.packs.breathing).toEqual({
      webgl: false,
      files: [
        'assets/ui-AAAAAAAI.js',
        'assets/lung-AAAAAAAJ.js',
        'assets/breathing-AAAAAAAK.js',
        'assets/_lifepeek-en-sys.breathing-AAAAAAAL.js',
      ],
    })
    expect(tiers.packs.hindi).toEqual({ webgl: false, files: ['assets/hi-AAAAAAAH.js'] })
    expect(tiers.packs.core).toBeUndefined()
    for (const pack of Object.values(tiers.packs)) for (const f of pack.files) expect(tiers.lazy.has(f), f).toBe(true)
    expect(Object.values(tiers.packs).some((p) => p.files.some((f) => f.includes('clock') || f.includes('NowLine')))).toBe(false)
    const pm = packManifest(tiers)
    expect(pm.entries.map((e) => [e.id, e.tier])).toEqual([
      ['core', 'precache'],
      ['3d', 'lazy'],
      ['stage', 'lazy'],
      ['breathing', 'lazy'],
      ['hindi', 'lazy'],
    ])
  })

  it('checks the tiers: the precache is the core exactly, nothing in both, every lazy file saveable', () => {
    const t = { core: new Set(['assets/run-AAAAAAAE.js']), lazy: new Set(['assets/BodyCanvas-AAAAAAAG.js', 'assets/hi-AAAAAAAH.js']) }
    expect(tierProblems(t, ['/assets/run-AAAAAAAE.js', 'index.html'])).toEqual([])
    expect(tierProblems(t, ['/assets/BodyCanvas-AAAAAAAG.js', 'assets/stray-AAAAAAAN.js'], (f) => f !== 'assets/hi-AAAAAAAH.js')).toEqual([
      'assets/run-AAAAAAAE.js (core) is not precached',
      'assets/stray-AAAAAAAN.js is precached but in no tier',
      'assets/BodyCanvas-AAAAAAAG.js (lazy) is precached: it should load on first use',
      'assets/hi-AAAAAAAH.js (lazy) is not in the build',
    ])
    const both = { core: t.core, lazy: new Set(['assets/run-AAAAAAAE.js', 'logo.svg']) }
    expect(tierProblems(both, ['assets/run-AAAAAAAE.js'])).toEqual([
      'assets/run-AAAAAAAE.js is in both tiers',
      'logo.svg (lazy) is not a hashed /assets/ file: lp-lazy would not keep it',
    ])
  })

  it('the service worker keeps the lazy tier out of the precache and in lp-lazy on first use', async () => {
    const lazy = new Set(['assets/BodyCanvas-AAAAAAAG.js', 'assets/ui-AAAAAAAI.js'])
    const lists = []
    const transform = async (entries) => ({ manifest: entries.filter((e) => !lazy.has(e.url)), warnings: [] })
    const policy = workboxPolicy({ hindi: false, tiers: { ignoreLazyIn: (list) => lists.push(list), manifestTransform: transform } })
    expect(lists).toEqual([policy.globIgnores])
    expect(policy.manifestTransforms).toEqual([transform])
    const rule = policy.runtimeCaching.find((r) => r.options.cacheName === 'lp-lazy')
    const keeps = (pathname) => rule.urlPattern({ url: new URL(`https://x.test${pathname}`), sameOrigin: true })
    for (const f of lazy) expect(keeps(`/${f}`), f).toBe(true)
    for (const url of ['/stats.json', '/og-image.png', '/assets/font-latin-400-normal-AAAAAAAA.woff', '/robots.txt'])
      expect(keeps(url), url).toBe(false)
    // Workbox writes the function's text into sw.js: it may name nothing from outside (LAZY_URL is written out).
    expect(rule.urlPattern.toString()).toContain(`/${LAZY_URL.source}/.test(url.pathname)`)
    expect(rule.urlPattern.toString()).not.toContain('LAZY_URL')
    expect(rule.options.expiration).toEqual({ maxEntries: 40, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true })
    expect(policy.maximumFileSizeToCacheInBytes).toBe(512 * 1024)
  })
})
