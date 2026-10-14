import { useCallouts } from '../anatomy/CalloutOverlay.tsx'
import { loadLimbs } from './registry.ts'

/**
 * What a system's flat layer borrows from the stage (A-11a): the flat body hands it to the layer
 * (registry/types.ts `LayerProps.kit`) rather than the layer importing it. The stage's modules are in /sim's route chunk; a
 * lazy layer that imports one makes the bundler move it, and everything the two share, out into
 * chunks of their own: +1.9 KB gz on /sim for the lymph map (measured), the same trap as the legs'
 * (anatomy/human/limbs.ts `LimbKit`). Handed over, a layer shares no module with the stage.
 *
 * `loadLimbs`: the legs and poses; once it resolves, anatomy/human/limbs.ts `limbKit()` also hands
 * over the body base (Spline3, Vec3, ARM). `useCallouts`: the labels over the picture, with the
 * layer's own table (anatomy/human/<system>.ts `LABELS`).
 */
export const LAYER_KIT = { loadLimbs, useCallouts }
export type LayerKit = typeof LAYER_KIT
