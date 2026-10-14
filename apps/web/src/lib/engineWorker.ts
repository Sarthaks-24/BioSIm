import type { WorkerPort } from '@lifepeek/engine/run'
import url from '../engine-worker.ts?worker&url'

/**
 * Makes the engine worker (W-2): only its file's address is in /sim's first download. The built
 * file is a classic script (vite.config.ts `worker.format`); the dev server serves it as a module.
 * Throws where there are no workers (connectWorker then runs everything on the page).
 */
export const openEngineWorker = (): WorkerPort =>
  new Worker(url, import.meta.env.DEV ? { type: 'module' } : undefined) as unknown as WorkerPort
