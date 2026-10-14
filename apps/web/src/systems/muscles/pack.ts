/**
 * The `effort` pack as one lazy module (systems/load.ts; U-1): its three systems' words, graphs and
 * cards (Muscles, Skin & temperature, the Bones card), its English and their flat drawings, fetched
 * together the first time one of them is lit (R71, R74: runtime cache "lp-lazy", never the first
 * download). Its catalog rows (muscles and skin, S-1) are not here: load.ts takes them from the run
 * chunk, which has them already (a second copy would split them into a chunk of their own: +0.3 KB
 * on /sim + engine, measured).
 */
export { default as UIS, DEFS } from './ui.tsx'
export { default as TEXT } from './text.ts'
export { default as DRAWINGS } from './drawing.tsx'
