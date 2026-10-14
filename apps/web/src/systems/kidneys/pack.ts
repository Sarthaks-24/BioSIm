/**
 * The `kidneys` pack as one lazy module (systems/load.ts `onePack`): its system's words and graphs,
 * its English and its flat kidneys and bladder, fetched together the first time Kidneys & water is
 * lit (R71, R74: runtime cache "lp-lazy", never the first download). Its catalog rows and moments
 * come from the engine's chunk (systems/load.ts), which has them already (as Heart & blood's, U-3).
 */
import type { CatalogRow } from '../registry.ts'

/** Its rows and its two moments, from the engine's chunk (systems/load.ts PackModule.ROWS). */
export const ROWS = (): Promise<readonly CatalogRow[]> =>
  import('@lifepeek/engine/run').then((m) => [...Object.values(m.KIDNEY_SIGNALS), ...Object.values(m.KIDNEY_EVENTS)])
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
