/**
 * The v2 component kit (WP-07, plan-ui-ux §3.2): flat controls that replace v1's bordered cards
 * and pills. Colours come only from the v2 tokens in styles.css (paper2, shelf, sunk2, rule2,
 * ink, ink-2). Nothing in v1 uses the kit; the stage at /sim does (WP-11 on).
 */
export { default as Dock } from './Dock.tsx'
export { default as FoodChip } from './FoodChip.tsx'
export { default as IconButton } from './IconButton.tsx'
export { default as PersonTag } from './PersonTag.tsx'
export { default as PlayButton } from './PlayButton.tsx'
export { default as Segmented, type SegmentedOption } from './Segmented.tsx'
export { default as StatusTag } from './StatusTag.tsx'
export * from './icons.tsx'
