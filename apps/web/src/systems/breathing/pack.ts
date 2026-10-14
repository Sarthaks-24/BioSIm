/**
 * The `breathing` pack as one lazy module (systems/load.ts `onePack`): its catalog rows, its
 * system's words and graphs, its English and its flat lungs, fetched together the first time
 * Breathing is lit (R71, R74: runtime cache "lp-lazy", never the first download).
 */
export { default as ROWS } from '@lifepeek/engine/catalog/breathing'
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
