import type { BufferGeometry } from 'three'
import type { RunResult } from '@lifepeek/engine'

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
  /** Builds the merged mesh (CPU only; three/mount.ts caches it per tier and layer). */
  build(tier: Tier): BufferGeometry
  /** Writes this frame's per-organ state and fill from the run at meal-clock minute `t`. */
  write(out: LayerState, sim: RunResult, t: number): void
}

/** What a layer writes per frame, one number per organ (Layer3d.organs order). */
export interface LayerState {
  /** −1 = empty, faded back; 0 = normal; 1 = the active one. */
  state: number[]
  /** How full a stretching organ is, 0…1 (stomach, later lungs and bladder); 0 elsewhere. */
  fill: number[]
}

/** Geometry tier (anatomy plan §9): a 2 GB phone builds lighter meshes. Part of the cache key. */
export type Tier = 'low' | 'high'

/**
 * The attribute set of every lit part. `organ`: index into Layer3d.organs. `along`: u along a tube
 * (0…1; flow and dots read it). `inflate`: how far a vertex moves out along its normal at full
 * fill. `chamber`: heart chamber (A-5). `seg`: body segment for posing (A-1b; 0 = torso).
 */
export const LAYER_ATTRIBUTES = ['position', 'normal', 'color', 'organ', 'along', 'inflate', 'chamber', 'seg'] as const
