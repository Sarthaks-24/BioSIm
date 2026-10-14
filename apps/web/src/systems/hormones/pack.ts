/**
 * The `control` pack as one lazy module (systems/load.ts `onePack`): Hormones' words and graphs, its
 * English and its flat pancreas, fetched together the first time Hormones is lit (R71, R74: runtime
 * cache "lp-lazy", never the first download). Its catalog rows and moment come from the engine's
 * chunk, which has them already (as the kidneys', U-4). Brain & nerves (U-7) joins this module: one
 * pack, one chunk.
 */
import type { CatalogRow } from '../registry.ts'

/** Its rows and its one moment, from the engine's chunk (systems/load.ts PackModule.ROWS). */
export const ROWS = (): Promise<readonly CatalogRow[]> =>
  import('@lifepeek/engine/run').then((m) => [...Object.values(m.CONTROL_SIGNALS), ...Object.values(m.CONTROL_EVENTS)])
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
