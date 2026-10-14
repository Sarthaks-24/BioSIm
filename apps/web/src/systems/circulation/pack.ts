/**
 * The `circulation` pack as one lazy module (systems/load.ts `onePack`): its system's words and
 * graphs, its English and its flat heart, fetched together the first time Heart & blood is lit (R71,
 * R74: runtime cache "lp-lazy", never the first download). Its catalog rows come from the engine's
 * chunk (systems/load.ts), which has them already.
 */
import type { CatalogRow } from '../registry.ts'

/** Its rows and its moment, from the engine's chunk (systems/load.ts PackModule.ROWS). */
export const ROWS = (): Promise<readonly CatalogRow[]> =>
  import('@lifepeek/engine/run').then((m) => [...Object.values(m.CIRCULATION_SIGNALS), ...Object.values(m.CIRCULATION_EVENTS)])
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
