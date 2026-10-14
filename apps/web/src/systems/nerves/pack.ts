/**
 * The `control` pack as one lazy module (systems/load.ts `onePack`): Brain & nerves' words, demo,
 * English and flat brain, fetched together the first time the row is lit (R71, R74: runtime cache
 * "lp-lazy", never the first download). The demo's numbers (@lifepeek/engine/demo) ride in it too:
 * no other chunk has them, and none of them is in /sim (check-budget's `nmjDelayMs` guard).
 * Its catalog rows (brain.glucoseUse for the Now line, and S-6's insulin rows) come from the
 * engine's chunk, which has them already. U-6 adds Hormones beside Nerves (one entry per row in
 * each export), so the pack stays one module.
 */
import type { CatalogRow, SystemId, SystemUi } from '../registry.ts'
import type { SystemParts } from '../load.ts'
import { NERVES_UI } from './ui.tsx'

/** Its rows and its moment, from the engine's chunk (systems/load.ts PackModule.ROWS). */
export const ROWS = (): Promise<readonly CatalogRow[]> =>
  import('@lifepeek/engine/run').then((m) => [...Object.values(m.CONTROL_SIGNALS), ...Object.values(m.CONTROL_EVENTS)])
export const UIS: { readonly [S in SystemId]?: SystemUi } = { nerves: NERVES_UI }
/** Nothing to add to Brain & nerves' row: it has no graphs, rhythms or limits of its own (row.ts). */
export const DEFS: { readonly [S in SystemId]?: SystemParts } = {}
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
