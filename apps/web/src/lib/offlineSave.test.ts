import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// "Save for class offline" (lib/offlineSave.ts) against a fake Cache Storage: a lesson goes to
// lp-saved, which the service worker reads first and never expires (R120 #1), and a save while a new
// version waits saves the new version's files, then lets it take over (R120 #16).

vi.mock('./webgl.ts', () => ({ hasWebGL: () => true }))

type Manifest = { cache: string; entries: { id: string; tier: 'precache' | 'lazy'; webgl?: boolean; urls: string[] }[] }
const version = (v: string): Manifest => ({
  cache: 'lp-saved',
  entries: [
    { id: 'core', tier: 'precache', urls: ['/index.html', `/assets/index-${v}.js`] },
    { id: 'stage', tier: 'lazy', urls: [`/assets/Sheets-${v}.js`, '/assets/shared-AAAAAAAA.js'] },
    { id: '3d', tier: 'lazy', webgl: true, urls: [`/assets/BodyCanvas-${v}.js`] },
    { id: 'breathing', tier: 'lazy', urls: [`/assets/breathing-${v}.js`, '/assets/shared-AAAAAAAA.js'] },
  ],
})
const OLD = version('OOOOOOOO')
const NEW = version('NNNNNNNN')

/** Cache Storage with named caches of paths; `added` logs each addAll. */
function fakeCaches() {
  const store = new Map<string, Set<string>>()
  const added: { cache: string; urls: string[] }[] = []
  const cache = (name: string) => {
    if (!store.has(name)) store.set(name, new Set())
    const files = store.get(name)!
    return {
      addAll: async (urls: string[]) => {
        if (new Set(urls).size !== urls.length) throw new TypeError('duplicate requests')
        added.push({ cache: name, urls })
        for (const u of urls) files.add(u)
      },
      match: async (url: string) => (files.has(url) ? new Response('x') : undefined),
      keys: async () => [...files].map((u) => ({ url: `https://lifepeek.test${u}` })),
      delete: async (req: { url: string }) => files.delete(new URL(req.url).pathname),
    }
  }
  return {
    store,
    added,
    api: {
      open: async (name: string) => cache(name),
      match: async (url: string) => ([...store.values()].some((f) => f.has(url)) ? new Response('x') : undefined),
    },
  }
}

let fake: ReturnType<typeof fakeCaches>
let waiting: { postMessage: ReturnType<typeof vi.fn> } | null
let listeners: Record<string, () => void>
const reload = vi.fn()

beforeEach(() => {
  vi.resetModules()
  fake = fakeCaches()
  // The service worker's precache holds the current version's core.
  fake.store.set('workbox-precache', new Set(OLD.entries[0]!.urls))
  waiting = null
  listeners = {}
  reload.mockReset()
  vi.stubGlobal('caches', fake.api)
  vi.stubGlobal('location', { reload })
  vi.stubGlobal('navigator', {
    storage: { persist: async () => true },
    serviceWorker: {
      ready: Promise.resolve(),
      getRegistration: async () => ({ waiting }),
      addEventListener: (type: string, fn: () => void) => (listeners[type] = fn),
    },
  })
  // The page's pack-manifest.json is the precached one (OLD); the server has the deployed one.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({ ok: true, json: async () => (url === '/pack-manifest.json' ? OLD : (deployed ?? OLD)) })),
  )
  deployed = null
})
let deployed: Manifest | null = null

afterEach(() => {
  vi.unstubAllGlobals()
})

const load = () => import('./offlineSave.ts')

describe('Save for class offline (R120 #1)', () => {
  it('saves a lesson into lp-saved, each file once, and says it is saved', async () => {
    const { save, isSaved, LESSON_PACKS } = await load()
    expect(await isSaved([...LESSON_PACKS, 'breathing'])).toBe(false)
    expect(await save([...LESSON_PACKS, 'breathing'])).toBe(true)
    expect(fake.added).toEqual([
      {
        cache: 'lp-saved',
        urls: [
          '/assets/Sheets-OOOOOOOO.js',
          '/assets/shared-AAAAAAAA.js',
          '/assets/BodyCanvas-OOOOOOOO.js',
          '/assets/breathing-OOOOOOOO.js',
        ],
      },
    ])
    expect(await isSaved([...LESSON_PACKS, 'breathing'])).toBe(true)
  })

  it('only lp-saved counts: a file that lp-lazy happens to hold (and may push out) is not saved', async () => {
    fake.store.set('lp-lazy', new Set(['/assets/Sheets-OOOOOOOO.js', '/assets/shared-AAAAAAAA.js', '/assets/BodyCanvas-OOOOOOOO.js']))
    const { isSaved } = await load()
    expect(await isSaved(['stage', '3d'])).toBe(false)
    fake.store.set('lp-saved', new Set(fake.store.get('lp-lazy')))
    fake.store.delete('lp-lazy')
    expect(await isSaved(['stage', '3d'])).toBe(true)
  })

  it('lp-saved never expires by itself: the Teach page takes out a past version’s files, not this one’s', async () => {
    fake.store.set('lp-saved', new Set(['/assets/Sheets-OOOOOOOO.js', '/assets/Sheets-PASTPAST.js', '/assets/BodyCanvas-PASTPAST.js']))
    const { isSaved } = await load()
    await isSaved(['stage'])
    expect([...fake.store.get('lp-saved')!]).toEqual(['/assets/Sheets-OOOOOOOO.js'])
  })
})

describe('saving while a new version waits (R120 #16)', () => {
  it('saves the new version’s files (from the server, not the old precached list), then lets it take over and reloads', async () => {
    waiting = { postMessage: vi.fn() }
    deployed = NEW
    fake.store.set('lp-saved', new Set(['/assets/Sheets-PASTPAST.js']))
    const { save } = await load()
    const saving = save(['stage', '3d'])
    await vi.waitFor(() => expect(waiting!.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' }))
    expect(fake.added).toEqual([
      { cache: 'lp-saved', urls: ['/assets/Sheets-NNNNNNNN.js', '/assets/shared-AAAAAAAA.js', '/assets/BodyCanvas-NNNNNNNN.js'] },
    ])
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1)! as [string, RequestInit]
    expect(url).toMatch(/^\/pack-manifest\.json\?deployed=\d+$/)
    expect(init).toEqual({ cache: 'no-store' })
    // A past version's file goes; the old version's (still running) and the new one's stay.
    expect(fake.store.get('lp-saved')!.has('/assets/Sheets-PASTPAST.js')).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    listeners.controllerchange!()
    expect(await saving).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('the status check of an old page leaves the waiting version’s saved files alone', async () => {
    waiting = { postMessage: vi.fn() }
    fake.store.set('lp-saved', new Set(['/assets/Sheets-NNNNNNNN.js']))
    const { isSaved } = await load()
    expect(await isSaved(['stage'])).toBe(false)
    expect([...fake.store.get('lp-saved')!]).toEqual(['/assets/Sheets-NNNNNNNN.js'])
  })

  it('no new version waiting: no reload, no message', async () => {
    const { save } = await load()
    expect(await save(['stage'])).toBe(true)
    expect(reload).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.map(([u]) => u)).toEqual(['/pack-manifest.json'])
  })
})
