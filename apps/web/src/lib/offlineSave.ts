import { hasWebGL } from './webgl.ts'

/**
 * "Save for class offline" (Teach, T12d, R71). Only the core is saved when the app is installed;
 * the rest loads on first use. A teacher saves a lesson ahead of class: its lazy files (the stage's
 * on-use parts, and the 3D body on a device with WebGL) go into the runtime cache `lp-lazy` that
 * the service worker reads them from (vite.config.ts), and the browser is asked to keep them
 * (navigator.storage.persist()). The file list is dist/pack-manifest.json (scripts/cache-tiers.mjs),
 * which is precached, so a lesson's status shows offline too. Only Teach imports this.
 *
 * Privacy: nothing leaves the device; it only fetches the app's own files. No-backend: static files.
 */
interface PackManifest {
  cache: string
  entries: { id: string; tier: 'precache' | 'lazy'; webgl?: boolean; urls: string[] }[]
}

/** The lazy packs a lesson needs offline. On v2 every lesson needs the same: the stage's parts and 3D. */
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
async function files(packs: string[]) {
  const m = await packManifest()
  return {
    cache: m.cache,
    core: m.entries.find((e) => e.id === 'core')?.urls ?? [],
    lazy: [...new Set(m.entries.filter((e) => packs.includes(e.id) && (!e.webgl || hasWebGL())).flatMap((e) => e.urls))],
  }
}

/** Whether every file the lesson needs offline is saved (the core by the service worker, the rest in lp-lazy). */
export async function isSaved(packs: string[]): Promise<boolean> {
  if (!canSave()) return false
  try {
    const { core, lazy } = await files(packs)
    // The precache keeps the shell under its revision (index.html?__WB_REVISION__=…).
    const found = await Promise.all([...core, ...lazy].map((url) => caches.match(url, { ignoreSearch: true })))
    return found.every(Boolean)
  } catch {
    return false
  }
}

/** Saves a lesson's lazy files and asks the browser to keep them; true once all of the lesson is saved. */
export async function save(packs: string[]): Promise<boolean> {
  if (!canSave()) return false
  // The browser decides; saved files work offline either way, persist only protects them from clean-up.
  navigator.storage?.persist?.().catch(() => false)
  const { cache, lazy } = await files(packs)
  await (await caches.open(cache)).addAll(lazy)
  // The core comes with the service worker's install, which may still be running on a first visit.
  await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 30_000))])
  return isSaved(packs)
}
