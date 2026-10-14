import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CORE_ROOTS, LESSON_PACKS, cacheTiers, packManifest } from './cache-tiers.mjs'

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
