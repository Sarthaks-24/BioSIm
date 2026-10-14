import type { Framing } from '../anatomy/human/base.ts'
import { LIMB_KIT } from '../anatomy/human/kit.ts'
import type { ActivityBand } from '../anatomy/human/bands.ts'

/**
 * The flat registry (A-0; anatomy plan §1, §2.0): how the flat body finds what it draws. A system's
 * row (systems/registry.ts) names its framing (`camera.framing`, one of FRAMINGS) and how it is
 * drawn: Digestion's organs are the body's own (`draw: 'body'`, first paint); every other system is
 * a flat layer from its pack's drawing module (systems/load.ts `PackDef.drawing`), which loads with
 * the pack when the system is first lit (R71, R74). The legs and poses are a lazy chunk of their
 * own, loaded here. systems/registry.test.ts checks every row: a drawing, a VIEW, outlines, labels.
 */

/** The posed body with legs (flat/limbs.ts), a lazy chunk. */
type Limbs = typeof import('./limbs.ts')
let limbs: Promise<Limbs> | null = null

/** Loads the legs and poses, once. */
export function loadLimbs(): Promise<Limbs> {
  if (!limbs) {
    limbs = import('./limbs.ts').then((m) => (m.takeKit(LIMB_KIT), m))
    limbs.catch(() => (limbs = null))
  }
  return limbs
}

/**
 * Whether a picture needs the legs and poses: the `full` framing shows the legs, and a bout poses
 * the arms (and the tops of the legs) in any framing. Digestion at rest needs neither.
 */
export const limbsFor = (framing: Framing, band: ActivityBand): boolean => framing === 'full' || band !== 'rest'
