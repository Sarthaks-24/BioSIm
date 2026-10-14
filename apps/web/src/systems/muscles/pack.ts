/**
 * The `effort` pack as one lazy module (systems/load.ts `onePack`; U-1): its catalog rows (muscles
 * and skin, S-1), its three systems' words, graphs and cards (Muscles, Skin & temperature, the Bones
 * card), its English and their flat drawings, fetched together the first time one of them is lit
 * (R71, R74: runtime cache "lp-lazy", never the first download).
 */
export { default as ROWS } from '@lifepeek/engine/catalog/effort'
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
