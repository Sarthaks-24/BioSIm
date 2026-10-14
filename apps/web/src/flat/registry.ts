import type { Framing } from '../anatomy/human/base.ts'
import { LIMB_KIT } from '../anatomy/human/kit.ts'
import type { ActivityBand } from '../anatomy/human/bands.ts'
import type { LayerComponent } from '../registry/types.ts'
import type { SystemDef, SystemId } from '../systems/registry.ts'

/**
 * The flat registry (A-0; anatomy plan §1, §2.0): how the flat body finds a system's picture. A
 * system's row (systems/registry.ts) names its framing (`camera.framing`, one of FRAMINGS) and its
 * flat drawing: Digestion's organs are the body's own (`draw: 'body'`, first paint); every other
 * system's drawing is a lazy module (`draw.layerFlat`) that loads the first time that system is lit
 * and never before (R71, R74), so no system's drawing code is in the first download.
 * systems/registry.test.ts checks every row: a flat drawing, a VIEW, outlines and callouts.
 */

const layers = new Map<SystemId, Promise<LayerComponent>>()

/**
 * The lit system's flat layer, loading it on first use (once: the same promise afterwards), or
 * null for Digestion, whose organs the body draws itself.
 */
export function flatLayer(system: SystemDef): Promise<LayerComponent> | null {
  if (system.draw === 'body') return null
  let layer = layers.get(system.id)
  if (!layer) {
    layer = system.draw.layerFlat().then((m) => m.default)
    // A failed load is asked again the next time the system is lit (R71: "Try again").
    layer.catch(() => layers.delete(system.id))
    layers.set(system.id, layer)
  }
  return layer
}

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
