import { hasWebGL } from './webgl.ts'

/**
 * "Save for class offline" (Teach, T12d, R71). Only the core is saved when the app is installed;
 * the rest loads on first use. A teacher saves a lesson ahead of class: its lazy files (the stage's
 * on-use parts, the 3D body on a device with WebGL, each system pack the lesson needs) go into the
 * cache `lp-saved` (pack-manifest.json's `cache`), which the service worker reads before its own
 * bounded `lp-lazy` (scripts/cache-policy.mjs). lp-saved never expires, so browsing other parts
 * never pushes a saved lesson out (R120 #1); and the browser is asked to keep it
 * (navigator.storage.persist()). The file list is dist/pack-manifest.json (scripts/cache-tiers.mjs),
 * which is precached, so a lesson's status shows offline too. Only Teach imports this.
 *
 * The API, by pack list (a lesson's packs: LESSON_PACKS plus its systems' pack ids):
 *   - `canSave()`: this browser can keep files for offline use;
 *   - `isSaved(packs)`: every file those packs need offline is saved (the core by the service
 *     worker, the rest in lp-saved);
 *   - `save(packs)`: saves them; true once all of it is saved.
 *
 * Privacy: nothing leaves the device; it only fetches the app's own files. No-backend: static files.
 */
interface PackManifest {
  cache: string
  entries: { id: string; tier: 'precache' | 'lazy'; webgl?: boolean; urls: string[] }[]
}

/** The lazy packs every lesson needs offline: the stage's parts and 3D. A system's lesson adds its pack. */
export const LESSON_PACKS = ['stage', '3d']

/** The browser can keep files for offline use here (not in a school browser that blocks it). */
export const canSave = () => typeof caches !== 'undefined' && 'serviceWorker' in navigator

let manifest: Promise<PackManifest> | null = null
function packManifest() {
  manifest ??= fetch('/pack-manifest.json').then((r) => {
    if (!r.ok) throw new Error(`pack-manifest.json: ${r.status}`)
    return r.json() as Promise<PackManifest>
  })
  manifest.catch(() => (manifest = null))
  return manifest
}

/**
 * The core's files and a lesson's lazy files (3D only with WebGL), each once: packs share chunks (the
 * stage and the system packs share WhyCard and the signal texts), and `Cache.addAll` rejects a list
 * with the same URL twice, which failed every save of a system lesson (H-1).
 */
function files(m: PackManifest, packs: readonly string[]) {
  return {
    cache: m.cache,
    core: m.entries.find((e) => e.id === 'core')?.urls ?? [],
    lazy: [...new Set(m.entries.filter((e) => packs.includes(e.id) && (!e.webgl || hasWebGL())).flatMap((e) => e.urls))],
  }
}

/** Every lazy URL this version's packs name: what lp-saved may keep. */
const lazyUrls = (m: PackManifest) => m.entries.filter((e) => e.tier === 'lazy').flatMap((e) => e.urls)

/**
 * Takes out of lp-saved what no pack of this version names (a past version's files: lp-saved never
 * expires by itself). `keep`: the versions whose files stay. Once per page load from `isSaved`.
 */
async function prune(cache: string, keep: PackManifest[]) {
  const wanted = new Set(keep.flatMap(lazyUrls))
  const saved = await caches.open(cache)
  for (const req of await saved.keys()) if (!wanted.has(new URL(req.url).pathname)) await saved.delete(req)
}
let pruned: Promise<void> | null = null

/** Whether every file the lesson needs offline is saved (the core by the service worker, the rest in lp-saved). */
export async function isSaved(packs: readonly string[]): Promise<boolean> {
  if (!canSave()) return false
  try {
    const m = await packManifest()
    const { cache, core, lazy } = files(m, packs)
    pruned ??= prune(cache, [m]).catch(() => undefined)
    await pruned
    const saved = await caches.open(cache)
    const found = await Promise.all([
      // The precache keeps the shell under its revision (index.html?__WB_REVISION__=…).
      ...core.map((url) => caches.match(url, { ignoreSearch: true })),
      // Only lp-saved counts: lp-lazy may push a file out (R120 #1).
      ...lazy.map((url) => saved.match(url, { ignoreVary: true })),
    ])
    return found.every(Boolean)
  } catch {
    return false
  }
}

/** Saves a lesson's lazy files and asks the browser to keep them; true once all of the lesson is saved. */
export async function save(packs: readonly string[]): Promise<boolean> {
  if (!canSave()) return false
  // The browser decides; saved files work offline either way, persist only protects them from clean-up.
  navigator.storage?.persist?.().catch(() => false)
  const m = await packManifest()
  const { cache, lazy } = files(m, packs)
  await (await caches.open(cache)).addAll(lazy)
  // The core comes with the service worker's install, which may still be running on a first visit.
  await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 30_000))])
  return isSaved(packs)
}
