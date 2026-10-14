import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the `effort` pack). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Skin & temperature (the `effort` pack; anatomy plan §2.5): the skin's rim, the skin's blood vessels
 * of the forearms and at most 12 sweat drops, front-on, in scene units as base.ts. Drawn flat in the
 * `full` framing by systems/skin/SkinLayer.tsx over the base body in the band's still pose: the rim
 * follows the posed outline, the vessels and the arms' drops their arm. Plain data, importing nothing
 * at run time (flat/layerKit.ts says why).
 */

/** The head, front-on (base.ts HEAD, written out; effort.test.ts checks they match). */
export const HEAD = { center: v(0, 2.84, 0), rx: 0.31, ry: 0.39 }

/**
 * Where a sweat drop sits, in the order drops appear as sweating grows (at most 12, anatomy plan
 * §2.5): on the forehead, on an arm (`arm`: the viewer's right +1 or left −1, at `u` along it, `off`
 * × its radius outwards), or on the trunk. Drops never fall: they show where sweat is, not a flow.
 */
export type DropPlace = { at: readonly [number, number] } | { arm: 1 | -1; u: number; off: number }

export const DROPS: readonly DropPlace[] = [
  { at: [0, 3.02] },
  { at: [-0.14, 2.98] },
  { at: [0.14, 2.98] },
  { arm: 1, u: 0.3, off: 0.55 },
  { arm: -1, u: 0.3, off: 0.55 },
  { at: [0, 1.62] },
  { arm: 1, u: 0.66, off: 0.5 },
  { arm: -1, u: 0.66, off: 0.5 },
  { at: [0.42, 1.95] },
  { at: [-0.42, 1.95] },
  { at: [0.58, 0.55] },
  { at: [-0.58, 0.55] },
]

/** The most drops drawn (anatomy plan §2.5). */
export const MAX_DROPS = DROPS.length

/** The forearm's skin vessels: wavy lines along the arm from `u0` to `u1`, `off` × its radius from its middle. */
export const SKIN_VESSELS: readonly { u0: number; u1: number; off: number }[] = [
  { u0: 0.55, u1: 0.84, off: -0.3 },
  { u0: 0.58, u1: 0.8, off: 0.35 },
]

/** The labels skin's picture shows (anatomy plan §6). */
export type SkinLabel = 'skin' | 'sweat' | 'vessels'

/**
 * Their anchors and places at rest: the skin at the side of the waist, the sweat glands at a drop on
 * the forehead, the skin's blood vessels on the viewer's left forearm (the layer moves this one with
 * the pose).
 */
export const LABELS: Readonly<Record<SkinLabel, Callout>> = {
  skin: { anchor: v(0.8, -0.35, 0), at: v(1.05, -0.5, 0), side: 'right' },
  sweat: { anchor: v(0.14, 2.98, 0), at: v(0.5, 3.12, 0), side: 'right' },
  vessels: { anchor: v(-1.22, 0.55, 0), at: v(-1.42, 0.3, 0), side: 'left' },
}
