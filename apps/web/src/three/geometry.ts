import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  OctahedronGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { NutrientKind } from '@lifepeek/engine'
import { ARM, TORSO_PROFILE, armRadius } from '../anatomy/human/base.ts'
import { LAYER_ATTRIBUTES, type Tier } from './layer.ts'

/**
 * The 3D body's geometry kit. Every organ is modelled in code from the anatomy curves, so the
 * models, the flat fallback and the particle paths can never drift apart, and nothing has to be
 * downloaded (anatomy plan D1, D2).
 *
 * A system's lit layer (three/layers/<system>.ts) is ONE merged mesh (plan-systems-3d §3.1, §3.5):
 * per vertex it carries its colour (with soft cavity shading baked in), which organ it belongs to
 * (`organ`, so the shader can highlight or fade one organ), and the rest of LAYER_ATTRIBUTES
 * (three/layer.ts). One draw for the organs, one for their ink outline. The shell and the food
 * particles are the base, shared by every layer. three/mount.ts builds and caches all of it.
 */

interface TubeOptions {
  segments: number
  radial?: number
  /** Base radius along the tube (u = 0…1). */
  radius: (u: number) => number
  /** Extra multiplier by position and angle around the tube — pouches, grooves, folds. */
  shape?: (u: number, angle: number) => number
  /** Squash the cross-section front-to-back (towards the viewer); 1 = round. */
  flatten?: number
  /** Close both ends with caps, or only one (where the tube joins another, a cap would show a seam). */
  caps?: boolean | 'start' | 'end'
}

/** A curve a tube follows: the anatomy's Spline3, or three's own CatmullRomCurve3 (a lazy layer's: it imports nothing of /sim). */
export interface Curve3 {
  getPointAt(u: number, out: Vector3): unknown
  getTangentAt(u: number, out: Vector3): unknown
}

const WORLD_Z = new Vector3(0, 0, 1)
const WORLD_X = new Vector3(1, 0, 0)

/**
 * A tube with a varying, shaped cross-section. Frames are built against the body's front axis
 * rather than Frenet frames, so a flattened organ stays flat towards the viewer instead of
 * twisting along its length. Each ring closes on itself (no duplicated seam vertex), so the
 * shading has no seam line. The `along` attribute holds u for every vertex.
 */
export function organTube(curve: Curve3, o: TubeOptions): BufferGeometry {
  const radial = o.radial ?? 16
  const flatten = o.flatten ?? 1
  const positions: number[] = []
  const along: number[] = []
  const indices: number[] = []
  const p = new Vector3()
  const tan = new Vector3()
  const side = new Vector3()
  const front = new Vector3()

  for (let i = 0; i <= o.segments; i++) {
    const u = i / o.segments
    curve.getPointAt(u, p)
    curve.getTangentAt(u, tan)
    side.crossVectors(tan, WORLD_Z)
    if (side.lengthSq() < 1e-6) side.crossVectors(tan, WORLD_X)
    side.normalize()
    front.crossVectors(side, tan).normalize()
    const r = o.radius(u)
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const k = r * (o.shape ? o.shape(u, a) : 1)
      const cs = Math.cos(a) * k
      const sn = Math.sin(a) * k * flatten
      positions.push(p.x + side.x * cs + front.x * sn, p.y + side.y * cs + front.y * sn, p.z + side.z * cs + front.z * sn)
      along.push(u)
    }
  }
  for (let i = 0; i < o.segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const a1 = i * radial + ((j + 1) % radial)
      const b = a + radial
      const b1 = a1 + radial
      indices.push(a, b, a1, b, b1, a1) // counter-clockwise seen from outside: normals point out
    }
  }
  if (o.caps) {
    const ends = (
      [
        [0, 0],
        [o.segments, 1],
      ] as const
    ).filter(([, u]) => o.caps === true || o.caps === (u === 0 ? 'start' : 'end'))
    for (const [ring, u] of ends) {
      curve.getPointAt(u, p)
      const centre = positions.length / 3
      positions.push(p.x, p.y, p.z)
      along.push(u)
      for (let j = 0; j < radial; j++) {
        const a = ring * radial + j
        const a1 = ring * radial + ((j + 1) % radial)
        if (u === 0) indices.push(centre, a1, a)
        else indices.push(centre, a, a1)
      }
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('along', new Float32BufferAttribute(along, 1))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Round off a tube's ends over the first/last `end` of its length. */
export const rounded = (end: number) => (u: number) => {
  const e = Math.min(u, 1 - u) / end
  return e >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)))
}

/**
 * Sculpt a unit sphere (or any primitive) into a solid organ by remapping each vertex. The
 * primitive's seam and pole vertices are welded first, so the normals are smooth all round.
 */
export function sculpt(source: BufferGeometry, fn: (v: Vector3) => void): BufferGeometry {
  source.deleteAttribute('uv')
  source.deleteAttribute('normal')
  const geo = mergeVertices(source)
  const pos = geo.getAttribute('position')
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    fn(v)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/**
 * The skin shell: torso, head and tapering arms, drawn as a rim only. The spleen is not part of it
 * (A-0): it belongs to the lymph system (anatomy/human/lymph.ts) and is drawn with that layer.
 * `tier` 'low' (a 2 GB phone; anatomy plan §9, R99): half the sides round the torso, head and arms.
 */
export function buildShell(tier: Tier = 'high'): BufferGeometry {
  return mergeGeometries([...shellTrunk(tier), ...shellArms(tier)])!
}

/**
 * The shell's torso and head (position, normal). With limbs (A-1a: three/limbs.ts poses the arms and
 * legs) the hips are flattened a little, so the thighs come out of the torso's sides as a
 * mannequin's do, not out of a round bowl.
 */
export function shellTrunk(tier: Tier = 'high', limbs = false): BufferGeometry[] {
  const r = (n: number) => (tier === 'low' ? n / 2 : n)
  const profile = ([...TORSO_PROFILE, [0, 2.5]] as [number, number][]).map(([x, y]) => new Vector2(x!, y!))
  // Flatter at the back than the front, like a real chest and belly.
  const torso = sculpt(new LatheGeometry(profile, r(64)), (v) => {
    v.set(v.x, v.y, v.z * (v.z > 0 ? 0.58 : 0.5))
    // With legs the bowl tucks in behind the thighs' fronts, so no crease shows across them.
    if (limbs) v.set(v.x, hips(v.y), v.z * (1 - 0.4 * smoothstep(-1.15, -1.6, v.y)))
  })

  const head = sculpt(new SphereGeometry(0.37, r(48), r(32)), (v) => {
    const jaw = v.y < 0 ? 1 - 0.18 * (-v.y / 0.37) : 1
    v.set(v.x * 0.84 * jaw, v.y * 1.05 + 2.84, v.z * 0.95 * jaw + 0.02)
  })
  return [torso, head]
}

/** The torso's bowl, lifted towards the groin with legs (shellTrunk): below y −1.2 it is squeezed up by up to 40 %. */
const hips = (y: number) => (y < -1.2 ? -1.2 + (y + 1.2) * (1 - 0.4 * smoothstep(-1.2, -1.78, y)) : y)

/** The resting arms of the shell, hanging (the posed ones are three/limbs.ts's). */
function shellArms(tier: Tier): BufferGeometry[] {
  const r = (n: number) => (tier === 'low' ? n / 2 : n)
  return [1, -1].map((sgn) => {
    const arm = organTube(ARM, { segments: 64, radial: r(20), radius: armRadius, flatten: 0.85, caps: true })
    if (sgn < 0) {
      arm.applyMatrix4(new Matrix4().makeScale(-1, 1, 1))
      arm.index!.array.reverse() // mirroring flips the winding; put it back
      arm.computeVertexNormals()
    }
    arm.deleteAttribute('along')
    return arm
  })
}

/** A part of a lit layer, before `layerGeometry` gives it the shared attribute set. */
export interface Part<O extends string = string> {
  geo: BufferGeometry
  organ: O
  /** Colour per vertex; gets the vertex's `along` (u) if the part is a tube. */
  tint?: (u: number, base: Color, out: Color) => void
  /** Stretch along the normal (scene units) at full fill (stomach; later lungs, bladder). */
  inflate?: (u: number) => number
  /** Cavity shading from the samples (intestines). */
  occlude?: boolean
  /** Heart chamber (A-5); 0 elsewhere. */
  chamber?: number
  /** Body segment for posing (A-1b); 0 = torso. */
  seg?: number
}

/**
 * Fills in the per-vertex attributes the lit-layer shaders read (LAYER_ATTRIBUTES, zero defaults;
 * `along` is kept), and drops the rest.
 */
function prepare<O extends string>(part: Part<O>, organs: readonly O[], tones: Record<O, string>, samples?: Float32Array): BufferGeometry {
  const { geo } = part
  const n = geo.getAttribute('position').count
  const alongIn = geo.getAttribute('along')
  const base = new Color(tones[part.organ])
  const c = new Color()
  const colors = new Float32Array(n * 3)
  const organ = new Float32Array(n).fill(organs.indexOf(part.organ))
  const along = new Float32Array(n)
  const inflate = new Float32Array(n)
  const chamber = new Float32Array(n).fill(part.chamber ?? 0)
  const seg = new Float32Array(n).fill(part.seg ?? 0)
  const occlusion = part.occlude && samples ? bakeOcclusion(geo, samples) : null
  for (let i = 0; i < n; i++) {
    const u = alongIn ? alongIn.getX(i) : 0
    along[i] = u
    c.copy(base)
    part.tint?.(u, base, c)
    if (occlusion) c.multiplyScalar(occlusion[i]!)
    colors.set([c.r, c.g, c.b], i * 3)
    if (part.inflate) inflate[i] = part.inflate(u)
  }
  for (const name of Object.keys(geo.attributes)) if (!(LAYER_ATTRIBUTES as readonly string[]).includes(name)) geo.deleteAttribute(name)
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setAttribute('organ', new Float32BufferAttribute(organ, 1))
  geo.setAttribute('along', new Float32BufferAttribute(along, 1))
  geo.setAttribute('inflate', new Float32BufferAttribute(inflate, 1))
  geo.setAttribute('chamber', new Float32BufferAttribute(chamber, 1))
  geo.setAttribute('seg', new Float32BufferAttribute(seg, 1))
  return geo.index ? geo : mergeVertices(geo)
}

/** A layer's parts, prepared and merged into its one mesh. `samples`: points for the cavity shading. */
export function layerGeometry<O extends string>(parts: Part<O>[], organs: readonly O[], tones: Record<O, string>, samples?: Float32Array) {
  return mergeGeometries(parts.map((p) => prepare(p, organs, tones, samples)))!
}

/**
 * Soft cavity shading, baked once: a vertex is darker the more gut lies in front of it, close
 * by (points of the intestine centre lines in the half-space its normal faces). It gives the
 * coiled small intestine the depth cue a flat colour lacks, at no cost per frame.
 */
function bakeOcclusion(geo: BufferGeometry, samples: Float32Array): Float32Array {
  const R = 0.2
  const cell = R
  const grid = new Map<string, number[]>()
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
  for (let i = 0; i < samples.length; i += 3) {
    const k = key(samples[i]!, samples[i + 1]!, samples[i + 2]!)
    let list = grid.get(k)
    if (!list) grid.set(k, (list = []))
    list.push(i)
  }
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const out = new Float32Array(pos.count)
  for (let v = 0; v < pos.count; v++) {
    const px = pos.getX(v)
    const py = pos.getY(v)
    const pz = pos.getZ(v)
    const nx = nor.getX(v)
    const ny = nor.getY(v)
    const nz = nor.getZ(v)
    const cx = Math.floor(px / cell)
    const cy = Math.floor(py / cell)
    const cz = Math.floor(pz / cell)
    let occ = 0
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`)
          if (!list) continue
          for (const i of list) {
            const qx = samples[i]! - px
            const qy = samples[i + 1]! - py
            const qz = samples[i + 2]! - pz
            const d = Math.hypot(qx, qy, qz)
            if (d > R || d < 1e-4) continue
            const facing = (qx * nx + qy * ny + qz * nz) / d
            if (facing > 0.2) occ += (facing - 0.2) * (1 - d / R)
          }
        }
    out[v] = 1 - 0.5 * Math.min(1, occ / 6)
  }
  return out
}

/** The food particles, one shape per nutrient (shared by every layer). */
export function buildParticles(): Record<NutrientKind, BufferGeometry> {
  return {
    carbs: new SphereGeometry(0.03, 12, 8),
    protein: new BoxGeometry(0.045, 0.045, 0.045),
    fat: new OctahedronGeometry(0.036),
    fiber: new CylinderGeometry(0.01, 0.01, 0.09, 6),
    water: new IcosahedronGeometry(0.02, 1),
  }
}
