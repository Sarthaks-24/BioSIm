import { curve } from './base.ts'
import { RIB_POINTS, SPINE_POINTS, STERNUM_POINTS } from './landmarks.ts'

/**
 * Landmarks (anatomy plan §1) as curves: the backbone, breastbone, ribs and hip bones, in scene
 * units (base.ts), from landmarks.ts's points. Faint in the flat body of the systems that need a
 * bearing (breathing's ribs, the Bones card's skeleton, U-1); in 3D a one-draw ghost (A-1a,
 * three/limbs.ts, which builds it from the same points). Digestion does not draw them.
 */

/** Backbone, top of the neck (under the skull) to the tailbone. */
export const SPINE = curve([...SPINE_POINTS])

/** Breastbone, the notch between the collarbones to the tip under the heart. */
export const STERNUM = curve([...STERNUM_POINTS])

/** The viewer's right ribs (+x; the left are their mirror), each from the backbone round to the front. */
export const RIBS = RIB_POINTS.map((pts) => curve([...pts]))

export { PELVIS } from './landmarks.ts'
