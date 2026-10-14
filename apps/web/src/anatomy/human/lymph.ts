import type { Callout } from '../callouts.ts'
import type { Writable, XYZ } from '../spline.ts'

/**
 * Lymph & germ defence (the `lymph` pack; anatomy plan §2.7). The spleen lives here, not in the
 * skin shell (A-0): it is not a digestive organ in NCERT, so the body no longer draws it as a ghost
 * with digestion, and the lymph map (A-11a) draws it lit. Scene units as in base.ts: the person's
 * left is the viewer's right (+x).
 *
 * The static lymph map (A-11a, v3.0 "Drawing only"): lymph vessels from the limbs, the head and the
 * gut to the main lymph duct (thoracic duct), which climbs beside the backbone and empties into the
 * left neck vein; the right lymph duct takes the right arm, the right side of the head and the right
 * chest to the right neck vein. Nodes are drawn merged, a few clusters (neck, armpit, gut, groin),
 * labelled once as "Lymph nodes" (council: no 20 labelled clusters). The vessels of the arms and
 * legs follow the pose, so they are built in the layer (systems/lymph/LymphLayer.tsx) from the
 * limb curves; everything here is in the trunk and the head, where no pose moves it.
 *
 * Plain data, importing nothing at run time: the lazy lymph layer reads it, and importing base.ts
 * (in /sim's route chunk) from there would split that chunk (flat/layerKit.ts). The ducts and the
 * neck vein are point lists; the layer runs a curve (Spline3, tension 0.5) through them.
 */

const v = (x: number, y: number, z: number): XYZ => ({ x, y, z })

/** The spleen: its centre and half-sizes (a bean about 12 cm tall). */
export const SPLEEN = { center: v(0.74, 0.74, -0.16), rx: 0.07, ry: 0.15, rz: 0.06 }

/**
 * A point of the spleen's surface from a point of the unit sphere: the bean is concave on the side
 * facing the stomach (−x). The 3D layer (A-10) sculpts a sphere with it; the flat map samples it.
 */
export function spleenPoint(unit: { x: number; y: number; z: number }, out: Writable): Writable {
  const dent = unit.x < 0 ? 1 - 0.35 * Math.exp(-(unit.y * unit.y) / 0.2) : 1
  const { center: c, rx, ry, rz } = SPLEEN
  out.set(c.x + unit.x * rx * dent, c.y + unit.y * ry, c.z + unit.z * rz)
  return out
}

/** Where lymph from the legs and the gut gathers before it climbs (the cisterna chyli), in front of the low back. */
export const LYMPH_SAC = { center: v(0.03, 0.12, -0.2), rx: 0.05, ry: 0.11 }

/**
 * The main lymph duct (thoracic duct): from the sac up beside the backbone, a little to the
 * person's right in the chest, across behind the gullet, then an arch over into the left neck vein.
 */
export const MAIN_DUCT: readonly XYZ[] = [
  v(0.03, 0.2, -0.2),
  v(0.0, 0.8, -0.3),
  v(-0.03, 1.4, -0.3),
  v(0.03, 1.9, -0.2),
  v(0.12, 2.18, -0.1),
  v(0.2, 2.25, -0.05),
  v(0.25, 2.12, -0.02),
]

/** The right lymph duct: short, from the right armpit and neck vessels into the right neck vein. */
export const RIGHT_DUCT: readonly XYZ[] = [v(-0.12, 1.92, -0.05), v(-0.2, 2.0, -0.03), v(-0.25, 2.1, -0.02)]

/**
 * Where each duct empties: the angle where the neck vein (jugular) meets the vein from the arm
 * (subclavian), on each side. Lymph joins the blood here.
 */
export const NECK_VEIN_JOIN = v(0.26, 2.08, 0)

/** The neck veins the ducts empty into (drawn faint: they are the blood's, not the lymph's), the viewer's right side; mirror for the left. */
export const NECK_VEIN: readonly XYZ[] = [v(0.22, 2.48, 0), v(0.25, 2.25, 0), v(0.27, 2.08, 0), v(0.5, 2.0, 0), v(0.8, 1.93, 0)]

/** Merged node clusters (centre, size in scene units), the viewer's right side; `mirror` ones on both. */
export const NODES: readonly { x: number; y: number; r: number; mirror: boolean }[] = [
  // Neck, under the jaw and down the side of the neck.
  { x: 0.16, y: 2.42, r: 0.05, mirror: true },
  { x: 0.2, y: 2.3, r: 0.045, mirror: true },
  // Armpit.
  { x: 0.78, y: 1.58, r: 0.07, mirror: true },
  { x: 0.7, y: 1.46, r: 0.05, mirror: true },
  // Gut (round the roots of the intestines), on the midline.
  { x: 0.12, y: -0.18, r: 0.06, mirror: false },
  { x: -0.1, y: -0.28, r: 0.05, mirror: false },
  { x: 0.02, y: -0.45, r: 0.05, mirror: false },
  // Groin.
  { x: 0.5, y: -1.52, r: 0.07, mirror: true },
  { x: 0.4, y: -1.62, r: 0.05, mirror: true },
]

/**
 * Trunk and head vessels (each a polyline in scene units, the viewer's right side), all ending at a
 * node, the sac or a duct. `mirror`: drawn on both sides; the left side's arm and neck vessels go to
 * the main duct, the right side's to the right duct (the ends below say which).
 */
export const TRUNK_VESSELS: readonly { pts: readonly (readonly [number, number])[]; mirror: boolean }[] = [
  // Groin nodes up the pelvis to the sac.
  {
    pts: [
      [0.47, -1.48],
      [0.38, -1.05],
      [0.22, -0.55],
      [0.06, 0.05],
    ],
    mirror: true,
  },
  // From the gut, past its nodes, to the sac.
  {
    pts: [
      [0.45, -0.75],
      [0.25, -0.5],
      [0.02, -0.45],
      [-0.1, -0.28],
      [0.12, -0.18],
      [0.04, 0.02],
    ],
    mirror: false,
  },
  {
    pts: [
      [-0.5, -0.55],
      [-0.25, -0.4],
      [-0.1, -0.28],
    ],
    mirror: false,
  },
  // The chest wall to the armpit nodes.
  {
    pts: [
      [0.42, 0.75],
      [0.58, 1.15],
      [0.7, 1.46],
    ],
    mirror: true,
  },
  // Armpit nodes over to the duct's end (the left side: the main duct's arch; the right: the right duct).
  {
    pts: [
      [0.78, 1.58],
      [0.55, 1.82],
      [0.3, 1.98],
      [0.2, 2.03],
    ],
    mirror: true,
  },
  // Face and scalp down to the neck nodes, then into the duct's end.
  {
    pts: [
      [0.24, 2.85],
      [0.2, 2.6],
      [0.16, 2.42],
      [0.2, 2.3],
      [0.22, 2.12],
    ],
    mirror: true,
  },
]

/** The thymus, two lobes behind the top of the breastbone (largest in children). */
export const THYMUS = [
  { x: -0.07, y: 1.7, rx: 0.075, ry: 0.15, tilt: -0.15 },
  { x: 0.07, y: 1.68, rx: 0.07, ry: 0.14, tilt: 0.15 },
] as const

/** The map's labels (anatomy plan §6): ids are `sys.lymph.map.<id>` texts. */
export type LymphLabel = 'vessels' | 'nodes' | 'mainDuct' | 'spleen' | 'rightDuct' | 'thymus' | 'neckVein'

/**
 * Where each label sits (the flat callouts, as anatomy/callouts.ts's): the anchor on the part, the
 * label beside it in empty space. The vessel's anchor is on the standing thigh (a stride moves the
 * thigh mostly in depth, so it stays on the vessel). Checked by systems/registry.test.ts.
 */
export const LABELS: Readonly<Record<LymphLabel, Callout>> = {
  vessels: { anchor: v(-0.28, -2.6, 0), at: v(-0.85, -2.7, 0), side: 'left' },
  nodes: { anchor: v(0.5, -1.52, 0), at: v(0.98, -1.6, 0), side: 'right' },
  mainDuct: { anchor: v(-0.01, 1.05, 0), at: v(0.32, 1.2, 0), side: 'right' },
  spleen: { anchor: v(0.78, 0.74, 0), at: v(1.0, 0.55, 0), side: 'right' },
  rightDuct: { anchor: v(-0.2, 2.0, 0), at: v(-0.5, 2.3, 0), side: 'left' },
  thymus: { anchor: v(-0.08, 1.7, 0), at: v(-0.4, 1.55, 0), side: 'left' },
  neckVein: { anchor: NECK_VEIN_JOIN, at: v(0.45, 2.42, 0), side: 'right' },
}
