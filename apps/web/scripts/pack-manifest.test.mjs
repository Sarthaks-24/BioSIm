import { describe, expect, it } from 'vitest'
import { workboxPolicy } from './cache-policy.mjs'
import { ENGINE, HINDI, THREE_D, packManifest, tierProblems } from './pack-manifest.mjs'

// A made-up Vite manifest: /sim (entry + stage), the engine with the core rows, the 3D body, Hindi,
// and a breathing pack whose UI chunk shares a file with the stage and whose catalog rows and
// English text are their own.
const MANIFEST = {
  'index.html': { file: 'assets/index-AAAAAAAA.js', css: ['assets/index-AAAAAAAB.css'], imports: ['_shared.js'] },
  'src/pages/Simulator.tsx': { file: 'assets/Simulator-AAAAAAAC.js', isDynamicEntry: true, imports: ['_shared.js'] },
  '_shared.js': { file: 'assets/shared-AAAAAAAD.js' },
  [ENGINE]: { file: 'assets/run-AAAAAAAE.js', isDynamicEntry: true, imports: ['_shared.js', '_rows-core.js'] },
  '_rows-core.js': { file: 'assets/rows-core-AAAAAAAF.js' },
  [THREE_D]: { file: 'assets/BodyCanvas-AAAAAAAG.js', isDynamicEntry: true, imports: ['_shared.js'] },
  [HINDI]: { file: 'assets/hi-AAAAAAAH.js', isDynamicEntry: true },
  'src/systems/breathing/ui.tsx': { file: 'assets/ui-AAAAAAAI.js', isDynamicEntry: true, imports: ['_shared.js', '_lung.js'] },
  '_lung.js': { file: 'assets/lung-AAAAAAAJ.js' },
  '../../packages/engine/src/core/catalog/breathing.ts': { file: 'assets/breathing-AAAAAAAK.js', isDynamicEntry: true },
  '__lifepeek-en-sys.breathing-AAAAAAAL.js': { file: 'assets/_lifepeek-en-sys.breathing-AAAAAAAL.js' },
  // A static (first-paint) file under a system's folder is /sim's, not the pack's.
  'src/systems/digestion/NowLine.tsx': { file: 'assets/NowLine-AAAAAAAM.js' },
}

describe('pack-manifest.json (W-1; R71 load on demand)', () => {
  const out = packManifest(MANIFEST)

  it("finds a pack's English section by the key a real build gives it: a lazy entry with no hash (I-1)", () => {
    const kidneys = { 'lifepeek-en-sys.kidneys': { file: 'assets/_lifepeek-en-sys.kidneys-AAAAAAAN.js', isDynamicEntry: true } }
    const built = packManifest({ ...MANIFEST, ...kidneys })
    expect(built.entries.kidneys).toEqual({ tier: 'lazy', files: ['assets/_lifepeek-en-sys.kidneys-AAAAAAAN.js'] })
    expect(built.entries.breathing).toEqual(out.entries.breathing)
  })

  it('puts the engine (with the core rows) in the precache tier: a cold offline start of the core simulator', () => {
    expect(out.entries.engine).toEqual({ tier: 'precache', files: ['assets/run-AAAAAAAE.js', 'assets/rows-core-AAAAAAAF.js'] })
    expect(out.precache).toEqual(['/assets/run-AAAAAAAE.js', '/assets/rows-core-AAAAAAAF.js'])
  })

  it('finds a pack by where its code lives (lazy chunks, catalog rows, text), never /sim files; 3D and Hindi are lazy', () => {
    expect(out.entries.breathing).toEqual({
      tier: 'lazy',
      files: [
        'assets/ui-AAAAAAAI.js',
        'assets/lung-AAAAAAAJ.js',
        'assets/breathing-AAAAAAAK.js',
        'assets/_lifepeek-en-sys.breathing-AAAAAAAL.js',
      ],
    })
    expect(out.entries['3d']).toEqual({ tier: 'lazy', files: ['assets/BodyCanvas-AAAAAAAG.js'] })
    expect(out.entries.hindi).toEqual({ tier: 'lazy', files: ['assets/hi-AAAAAAAH.js'] })
    expect([...out.precache, ...out.lazy].some((u) => u.includes('shared') || u.includes('NowLine'))).toBe(false)
  })

  it('checks the tiers: precache entries precached, nothing in both, every lazy URL saveable', () => {
    expect(tierProblems(out, ['assets/run-AAAAAAAE.js', '/assets/rows-core-AAAAAAAF.js'])).toEqual([])
    expect(tierProblems(out, ['/assets/run-AAAAAAAE.js', '/assets/BodyCanvas-AAAAAAAG.js'])).toEqual([
      '/assets/rows-core-AAAAAAAF.js (precache tier) is not precached',
      '/assets/BodyCanvas-AAAAAAAG.js (lazy tier) is precached: it should load on first use',
    ])
    const both = { ...out, lazy: [...out.lazy, '/assets/run-AAAAAAAE.js', '/logo.svg'] }
    expect(tierProblems(both, out.precache, (url) => url !== '/assets/hi-AAAAAAAH.js')).toEqual([
      '/assets/hi-AAAAAAAH.js (lazy tier) is not in the build',
      '/assets/run-AAAAAAAE.js is in both tiers',
      '/logo.svg (lazy tier) is not a hashed /assets/ file: lp-lazy would not keep it',
    ])
  })

  it('the service worker keeps the lazy tier out of the precache and in lp-lazy on first use', async () => {
    const policy = workboxPolicy({ hindi: false, lazy: new Set(out.lazy) })
    const [drop] = policy.manifestTransforms
    const { manifest } = await drop([{ url: 'assets/run-AAAAAAAE.js' }, { url: 'assets/BodyCanvas-AAAAAAAG.js' }])
    expect(manifest).toEqual([{ url: 'assets/run-AAAAAAAE.js' }])
    const lazy = policy.runtimeCaching.find((r) => r.options.cacheName === 'lp-lazy')
    const keeps = (pathname) => lazy.urlPattern({ url: new URL(`https://x.test${pathname}`), sameOrigin: true })
    for (const url of out.lazy) expect(keeps(url), url).toBe(true)
    expect(keeps('/stats.json')).toBe(false)
    expect(lazy.options.expiration).toEqual({ maxEntries: 40, maxAgeSeconds: 90 * 24 * 60 * 60, purgeOnQuotaError: true })
    expect(policy.maximumFileSizeToCacheInBytes).toBe(512 * 1024)
  })
})
