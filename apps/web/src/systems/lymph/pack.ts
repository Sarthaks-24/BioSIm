/**
 * The `lymph` pack as one lazy module (systems/load.ts `onePack`): Lymph & germ defence's words,
 * graphs and moment (U-5), the germ-defence card and the lymph map with its fat dots (A-11a, U-5),
 * and its English, fetched together the first time the system is lit (R71, R74: runtime cache
 * "lp-lazy", never the first download). Its catalog rows and moment come from the engine's chunk,
 * which has them already (as Kidneys' and Heart & blood's).
 */
import type { CatalogRow } from '../registry.ts'

/** Its rows and its one moment, from the engine's chunk (systems/load.ts PackModule.ROWS). */
export const ROWS = (): Promise<readonly CatalogRow[]> =>
  import('@lifepeek/engine/run').then((m) => [...Object.values(m.LYMPH_SIGNALS), ...Object.values(m.LYMPH_EVENTS)])
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.ts'
