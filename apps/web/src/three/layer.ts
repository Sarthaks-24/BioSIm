import type { TFunction } from 'i18next'
import type { BufferGeometry } from 'three'
import type { RunResult } from '@lifepeek/engine'
import type { Framing } from '../anatomy/human/base.ts'
import type { Callout, LabelBox } from '../anatomy/callouts.ts'
import type { CalloutSpec, Project } from '../anatomy/CalloutOverlay.tsx'
import type { Kit3d } from './kit.ts'

/**
 * One system's lit 3D layer (A-0 3D half; anatomy plan §1, §10). Digestion's is in the 3D body's
 * own chunk (the first 3D view); every other system's loads on first use through its registry row
 * (`SystemDef.layer3d`), as a chunk of ≤ 20 KB gz (plan §8). Only types here: the registry imports
 * this file and must stay free of three.js.
 *
 * A layer is ONE merged mesh drawn twice (tissue, ink outline). Every part of it carries the same
 * attributes (LAYER_ATTRIBUTES; zero where a part has no use for one), so any two parts merge.
 */
export interface Layer3d {
  /** The system it draws. Also its shader programs' key: two layers never share a program by accident. */
  id: string
  /** Its organs, in the order of the `organ` attribute and the uState / uFill arrays. */
  organs: readonly string[]
  /**
   * Builds the merged mesh (CPU only; three/mount.ts caches it per tier and layer). `kit`: three.js
   * and the geometry kit, handed over so a lazy layer's chunk imports none of the 3D body (three/kit.ts).
   */
  build(tier: Tier, kit: Kit3d): BufferGeometry
  /**
   * Writes this frame's per-organ state and fill from the run at meal-clock minute `t`. `phase`: its
   * rhythm's phase on the real clock (0…1; `rhythm.still` with motion reduced), 0 for a layer without one.
   * `reduced`: motion is reduced (a size change is then a cut, not an ease: no frame follows to finish it).
   */
  write(out: LayerState, sim: RunResult, t: number, phase: number, reduced?: boolean): void
  /** Its framing (anatomy plan §1): the 3D body eases its camera there (a cut with motion reduced). `torso` when absent. */
  framing?: Framing
  /** False: the meal's food particles are not drawn with it (they belong to Digestion's picture, as in the flat one). */
  food?: boolean
  /**
   * How `inflate` moves a vertex as its organ fills. Absent: out along its normal (the stomach). With
   * `grow`: away from its organ's point (`origins`, one per organ), by `inflate` × uFill[organ] of
   * the way there, so a part grows as a whole, the way the flat drawing scales it (lungs, bronchi,
   * diaphragm from the lungs' top). uFill is then the extra size: 0.2 = 20 % bigger, −0.5 = half the size.
   */
  grow?: { origins: readonly (readonly [number, number, number])[] }
  /**
   * Dashes drawn on the tubes in the tissue shader (A-5: the blood along the vessels): `along` then
   * holds a vertex's distance from its tube's start in scene units, and an organ whose
   * `LayerState.dash` is above 0 shows short pale dashes down the middle of its tubes, that many
   * times as dense as at 1, moved forward by its `LayerState.flow` (scene units). Absent: the shader
   * has none (the other layers' programs are unchanged). A DashLook in place of `true` gives them
   * their own colour and width (A-6: the urine's dark drops, as the flat drawing's).
   */
  dashes?: boolean | DashLook
  /** A rhythm drawn at its true speed on the real clock (a breath, a beat; anatomy plan §4). */
  rhythm?: Rhythm3d
  /** Its own labels in place of Digestion's (anatomy/human/<system>.ts LABELS). */
  labels?: Labels3d
  /**
   * Draws over the canvas into `host` and moves with the picture each frame (air dashes, the still
   * frame's arrows); returns the clean-up. Plain DOM, so a layer's chunk carries no React of its own
   * (a lazy chunk that imports React but not the text hooks splits them out of /sim's chunks).
   */
  overlay?(host: HTMLElement, props: OverlayProps): () => void
}

/**
 * A rhythm (anatomy plan §4, architecture §1.7): the 3D body moves `phase` by `hz` on the real clock
 * (the layer's own lib/ticker.ts, ≤ 30 fps, only while the tab is visible) and redraws (`invalidate`);
 * with motion reduced it stands at `still` and nothing ticks. The cap (≤ 0.8 Hz a breath, ≤ 2.5 Hz a
 * beat) is in `hz`: the rate is never the caller's.
 */
export interface Rhythm3d {
  /** Its drawn rate (Hz, capped) at meal-clock minute `t`. */
  hz(sim: RunResult, t: number): number
  /** The phase drawn with motion reduced (mid-breath). */
  still: number
  /** Calls `tick` with the real seconds since the last frame, ≤ 30 times a second; returns the stop. */
  onTick(tick: (dtSec: number) => void): () => void
  /** What the picture shows now, as `data-*` attributes on the body (the e2e checks read them, as the flat layer's). */
  probe?(sim: RunResult, t: number, phase: number, reduced: boolean): Record<string, string>
}

/** A layer's labels: where they sit (scene units) and which show, as the flat layer's. */
export interface Labels3d {
  table: Readonly<Record<string, Callout>>
  specs(t: TFunction, width: number, height: number): CalloutSpec<string>[]
}

/** What a layer's overlay gets from the 3D body. */
export interface OverlayProps {
  reduced: boolean
  /** The page's text (a key the layer draws in its overlay: the heart's colour key). */
  t: TFunction
  /** The rhythm's phase and rate now (read, not React state: they change every frame). */
  rhythm: { phase: number; hz: number }
  /** Hands the 3D body a function it calls each frame it draws, with that frame's projection; returns the unregister. */
  register(place: (project: Project, width: number, height: number) => void): () => void
  /**
   * A box of the overlay's own (CSS px, in the body's box) that no organ label may take, or null for
   * none (R107: the heart's colour key, which a label lay over in a long language). The 3D body lays
   * the labels out again around it; the overlay calls it again when the box moves or resizes.
   */
  keepOut(box: LabelBox | null): void
}

/** A `dashes` layer's own dashes (Layer3d.dashes). The default is the blood's: pale (0.9 grey), `cover` 0.16. */
export interface DashLook {
  /** Their colour (sRGB hex). */
  ink: string
  /** How much of the tube's width they cover, as seen (0…1; from the middle out). */
  cover: number
}

/** What a layer writes per frame, one number per organ (Layer3d.organs order). */
export interface LayerState {
  /** −1 = empty, faded back; 0 = normal; 1 = the active one. */
  state: number[]
  /** How full a stretching organ is, 0…1 (stomach); with `Layer3d.grow`, its extra size (lungs, the bladder). 0 elsewhere. */
  fill: number[]
  /** With `Layer3d.dashes`: how dense an organ's dashes are (0 = none, 1 = the resting look). */
  dash: number[]
  /** With `Layer3d.dashes`: how far an organ's dashes have moved along its tubes (scene units). */
  flow: number[]
  /**
   * Set by a layer that wants one more frame in this many ms though nothing else may draw one (A-6:
   * its scrub gate held a size change back, and with motion reduced no rhythm ticks). The 3D body
   * draws it then and clears this. 0 or absent: none.
   */
  later?: number
}

/** Geometry tier (anatomy plan §9): a 2 GB phone builds lighter meshes. Part of the cache key. */
export type Tier = 'low' | 'high'

/**
 * The attribute set of every lit part. `organ`: index into Layer3d.organs. `along`: u along a tube
 * (0…1; flow and dots read it). `inflate`: how far a vertex moves out along its normal at full
 * fill. `chamber`: heart chamber (A-5). `seg`: body segment for posing (A-1b; 0 = torso).
 */
export const LAYER_ATTRIBUTES = ['position', 'normal', 'color', 'organ', 'along', 'inflate', 'chamber', 'seg'] as const
