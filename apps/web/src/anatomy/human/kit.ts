import { Spline3, Vec3 } from '../spline.ts'
import { ARM, ELBOW_U, TORSO_PROFILE, armRadius } from './base.ts'
import type { LimbKit } from './limbs.ts'

/** The body base the limbs borrow (limbs.ts `LimbKit`: why it is handed over, not imported). */
export const LIMB_KIT: LimbKit = { Spline3, Vec3, ARM, ELBOW_U, TORSO_PROFILE, armRadius }
