import type { Framing } from '../anatomy/human/base.ts'
import type { ActivityBand } from '../anatomy/human/bands.ts'

/**
 * Where the 3D body's camera looks (anatomy plan §1 framings; A-1a): a point on the body's upright
 * (scene y) and the distance it looks from. The camera's direction (a drag's orbit) is the viewer's.
 */
export interface CameraGoal {
  y: number
  distance: number
}

/**
 * The framings' 3D presets (anatomy plan §1). torso is Digestion's view (scene y −1.9 … 3.45, with
 * room over the head); chest (−0.6 … 3.5) the same fit, closer; full the whole standing body
 * (−6.0 … 3.5). A framing with no 3D preset (upper) is framed as torso.
 */
export const CAMERA: Readonly<Partial<Record<Framing, CameraGoal>>> = {
  torso: { y: 0.8, distance: 9.4 },
  chest: { y: 1.45, distance: 7.3 },
  full: { y: -1.35, distance: 17.4 },
}

/** The phone's close-up of the working legs (hips to feet, scene y −6.2 … −0.8), the torso's fit. */
export const LEGS: CameraGoal = { y: -3.5, distance: 9.4 }

/** A body box narrower than this (CSS px) is a phone's: the `full` framing starts close up there (plan §1). */
export const PHONE_PX = 520

/** What the 3D body shows: its framing, where the camera goes, and whether the legs and the whole-body switch show. */
export interface BodyView {
  /** The framing drawn: the lit layer's, or `full` with the whole body asked for. */
  framing: Framing
  goal: CameraGoal
  /** The shell has its legs (and its arms posed): the `full` framing, or a bout in any framing (flat/registry.ts limbsFor). */
  legs: boolean
  /** The whole-body switch is offered: the picture is a close-up of the body (or the whole body was asked for). */
  offerWhole: boolean
  /** How far a drag may zoom out. */
  maxDistance: number
}

/**
 * The view for a lit layer's framing, the band at the clock's minute, the whole-body switch and the
 * body box's width (A-1a). The `full` framing on a phone starts zoomed on the working region, the
 * legs in a bout and the chest at rest, and the switch shows the whole body (anatomy plan §1); in
 * any other framing the switch zooms out to the whole standing body, legs and all.
 */
export function bodyView(own: Framing, band: ActivityBand, whole: boolean, width: number): BodyView {
  const framing: Framing = whole ? 'full' : own
  const phoneZoom = framing === 'full' && !whole && width > 0 && width < PHONE_PX
  const goal = phoneZoom ? (band === 'rest' ? CAMERA.chest! : LEGS) : (CAMERA[framing] ?? CAMERA.torso!)
  return {
    framing,
    goal,
    legs: framing === 'full' || band !== 'rest',
    offerWhole: whole || own !== 'full' || phoneZoom,
    maxDistance: framing === 'full' ? 19 : 11,
  }
}
