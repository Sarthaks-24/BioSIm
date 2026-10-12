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
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Curve,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { NutrientKind } from '@lifepeek/engine'
import {
  APPENDIX,
  ARM,
  ESOPHAGUS,
  GALLBLADDER,
  LARGE_INTESTINE,
  LIVER,
  PANCREAS,
  PHARYNX,
  SMALL_INTESTINE,
  SPLEEN,
  STOMACH,
  STOMACH_EMPTY,
  STOMACH_STRETCH,
  TORSO_PROFILE,
  armRadius,
  stomachRadius,
  stomachStretchWeight,
} from '../anatomy/human.ts'
import { ILEUM_TONE, JEJUNUM_TONE, LIT_ORGANS, ORGAN_TONE, PYLORUS_TONE, type LitOrgan } from '../anatomy/tones.ts'

/**
 * Every organ is modelled in code from the anatomy curves, so the models, the flat fallback and
 * the particle paths can never drift apart, and nothing has to be downloaded.
 *
 * The lit digestion layer is ONE merged mesh (plan-systems-3d §3.1, §3.5): per vertex it carries
 * its colour (with soft cavity shading baked in), which organ it belongs to (`organ`, so the
 * shader can highlight or fade one organ), and how far it moves out when the stomach fills
 * (`inflate`, only on the stomach). One draw for the organs, one for their ink outline.
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

const WORLD_Z = new Vector3(0, 0, 1)
const WORLD_X = new Vector3(1, 0, 0)

/**
 * A tube with a varying, shaped cross-section. Frames are built against the body's front axis
 * rather than Frenet frames, so a flattened organ stays flat towards the viewer instead of
 * twisting along its length. Each ring closes on itself (no duplicated seam vertex), so the
 * shading has no seam line. The `along` attribute holds u for every vertex.
 */
export function organTube(curve: Curve<Vector3>, o: TubeOptions): BufferGeometry {
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
const rounded = (end: number) => (u: number) => {
  const e = Math.min(u, 1 - u) / end
  return e >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)))
}

/**
 * Sculpt a unit sphere (or any primitive) into a solid organ by remapping each vertex. The
 * primitive's seam and pole vertices are welded first, so the normals are smooth all round.
 */
function sculpt(source: BufferGeometry, fn: (v: Vector3) => void): BufferGeometry {
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

function buildLiver(): BufferGeometry {
  // Wedge: a thick, domed right lobe (viewer's left) tapering to a thin left lobe that lies over
  // the stomach. The top follows the diaphragm; underneath, the front edge is sharp (the liver's
  // inferior border) and the back is full.
  return sculpt(new SphereGeometry(1, 56, 40), (v) => {
    const s = (v.x + 1) / 2 // 0 = right lobe edge, 1 = left lobe tip
    // Direction around the long axis, and how far out from it (0–1) this vertex is.
    const ring = Math.sqrt(Math.max(1e-6, 1 - v.x * v.x))
    const ry = v.y / ring
    const rz = v.z / ring
    const out = Math.min(1, Math.hypot(v.y, v.z) / ring)
    // Superellipse end caps keep the lobes full instead of pinching to a point like a sphere.
    const blunt = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 4)), 0.25)
    const top = lerp(0.32, 0.07, Math.pow(s, 1.1)) // domed under the diaphragm
    const bottom = lerp(0.5, 0.0, Math.pow(s, 0.7)) // slanted lower edge: big right lobe, thin left lobe
    const deep = lerp(0.4, 0.12, s)
    // Lower front quarter pulled into a ridge: the sharp inferior border.
    const lowerFront = Math.max(0, -ry) * Math.max(0, rz)
    const y = ry > 0 ? ry * top : ry * bottom * (1 + 0.25 * lowerFront)
    const z = rz * deep * (ry < 0 ? 1 - 0.45 * Math.max(0, -ry) * (rz > 0 ? 1 : 0.3) : 1)
    // Shallow notch between the lobes (falciform ligament) on the front surface.
    const notch = 1 - 0.18 * Math.exp(-(((s - 0.58) / 0.05) ** 2)) * Math.max(0, rz)
    v.set(LIVER.center.x - 0.6 + s * 1.18, LIVER.center.y + y * out * blunt * notch, LIVER.center.z + z * out * blunt)
  })
}

function buildGallbladder(): BufferGeometry {
  // Pear tucked under the right lobe, tilted so its round fundus peeks below the liver's edge.
  return sculpt(new SphereGeometry(1, 24, 16), (v) => {
    const pear = v.y < 0 ? 1 : 0.62 - 0.22 * v.y
    const x = v.x * 0.05 * pear
    const y = v.y * 0.1
    v.set(GALLBLADDER.center.x + x + y * 0.35, GALLBLADDER.center.y + y, GALLBLADDER.center.z + v.z * 0.045 * pear)
  })
}

function buildSpleen(): BufferGeometry {
  return sculpt(new SphereGeometry(1, 24, 16), (v) => {
    // Bean shape: concave on the side facing the stomach.
    const dent = v.x < 0 ? 1 - 0.35 * Math.exp(-(v.y * v.y) / 0.2) : 1
    v.set(SPLEEN.center.x + v.x * 0.07 * dent, SPLEEN.center.y + v.y * 0.15, SPLEEN.center.z + v.z * 0.06)
  })
}

/**
 * The skin shell: torso, head and tapering arms, plus the spleen as a ghost (it is not a
 * digestive organ in NCERT, so it is not lit with the digestion layer). Drawn as a rim only.
 */
function buildShell(): BufferGeometry {
  const profile = ([...TORSO_PROFILE, [0, 2.5]] as [number, number][]).map(([x, y]) => new Vector2(x!, y!))
  // Flatter at the back than the front, like a real chest and belly.
  const torso = sculpt(new LatheGeometry(profile, 64), (v) => v.set(v.x, v.y, v.z * (v.z > 0 ? 0.58 : 0.5)))

  const head = sculpt(new SphereGeometry(0.37, 48, 32), (v) => {
    const jaw = v.y < 0 ? 1 - 0.18 * (-v.y / 0.37) : 1
    v.set(v.x * 0.84 * jaw, v.y * 1.05 + 2.84, v.z * 0.95 * jaw + 0.02)
  })

  const arms = [1, -1].map((sgn) => {
    const arm = organTube(ARM, { segments: 64, radial: 20, radius: armRadius, flatten: 0.85, caps: true })
    if (sgn < 0) {
      arm.applyMatrix4(new Matrix4().makeScale(-1, 1, 1))
      arm.index!.array.reverse() // mirroring flips the winding; put it back
      arm.computeVertexNormals()
    }
    arm.deleteAttribute('along')
    return arm
  })
  return mergeGeometries([torso, head, ...arms, buildSpleen()])!
}

/** Organs of the digestion layer, in the order the shader's state array uses. */
export const ORGANS = LIT_ORGANS
const organIndex = (o: LitOrgan) => ORGANS.indexOf(o)

interface Part {
  geo: BufferGeometry
  organ: LitOrgan
  /** Colour per vertex; gets the vertex's `along` (u) if the part is a tube. */
  tint?: (u: number, base: Color, out: Color) => void
  /** Stretch along the normal (scene units) at full fill; stomach only. */
  inflate?: (u: number) => number
  /** Cavity shading from the surrounding loops (intestines). */
  occlude?: boolean
}

const JEJUNUM = new Color(JEJUNUM_TONE)
const ILEUM = new Color(ILEUM_TONE)
const PYLORUS = new Color(PYLORUS_TONE)

/** Fills in the per-vertex attributes the lit-layer shader reads, and drops the rest. */
function prepare(part: Part, samples: Float32Array): BufferGeometry {
  const { geo } = part
  const n = geo.getAttribute('position').count
  const along = geo.getAttribute('along')
  const base = new Color(ORGAN_TONE[part.organ])
  const c = new Color()
  const colors = new Float32Array(n * 3)
  const organ = new Float32Array(n).fill(organIndex(part.organ))
  const inflate = new Float32Array(n)
  const occlusion = part.occlude ? bakeOcclusion(geo, samples) : null
  for (let i = 0; i < n; i++) {
    const u = along ? along.getX(i) : 0
    c.copy(base)
    part.tint?.(u, base, c)
    if (occlusion) c.multiplyScalar(occlusion[i]!)
    colors.set([c.r, c.g, c.b], i * 3)
    if (part.inflate) inflate[i] = part.inflate(u)
  }
  geo.deleteAttribute('along')
  geo.deleteAttribute('uv')
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geo.setAttribute('organ', new Float32BufferAttribute(organ, 1))
  geo.setAttribute('inflate', new Float32BufferAttribute(inflate, 1))
  return geo.index ? geo : mergeVertices(geo)
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

/** Points along the gut's centre lines, for the cavity shading. */
function gutSamples(): Float32Array {
  const pts: number[] = []
  const p = new Vector3()
  for (const [curve, n] of [
    [SMALL_INTESTINE, 700],
    [LARGE_INTESTINE, 220],
    [STOMACH, 40],
  ] as const) {
    for (let i = 0; i <= n; i++) {
      curve.getPointAt(i / n, p)
      pts.push(p.x, p.y, p.z)
    }
  }
  return new Float32Array(pts)
}

function buildPylorus(): BufferGeometry {
  const geo = new TorusGeometry(0.046, 0.014, 10, 24)
  const tan = STOMACH.getTangentAt(1)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tan)
  geo.applyMatrix4(new Matrix4().compose(STOMACH.getPointAt(1), q, new Vector3(1, 1, 1)))
  return geo
}

function buildDigestion(): BufferGeometry {
  const haustraPouches = 34
  const samples = gutSamples()
  const parts: Part[] = [
    { organ: 'liver', geo: buildLiver() },
    { organ: 'gallbladder', geo: buildGallbladder() },
    {
      organ: 'pancreas',
      geo: organTube(PANCREAS, {
        segments: 48,
        radial: 14,
        radius: (u) => lerp(0.078, 0.034, u) * rounded(0.12)(u),
        flatten: 0.55,
        caps: true,
      }),
      // Lobulated look: a faint lighter/darker ripple along its length.
      tint: (u, base, out) => out.copy(base).multiplyScalar(0.94 + 0.06 * Math.sin(u * 60)),
    },
    { organ: 'esophagus', geo: organTube(PHARYNX, { segments: 12, radius: (u) => lerp(0.05, 0.043, u), radial: 14, caps: 'start' }) },
    {
      organ: 'esophagus',
      geo: organTube(ESOPHAGUS, {
        segments: 60,
        radial: 14,
        // Slight narrowings where the aorta and diaphragm press on it.
        radius: (u) => 0.042 * (1 - 0.18 * Math.exp(-(((u - 0.35) / 0.05) ** 2)) - 0.15 * Math.exp(-(((u - 0.82) / 0.05) ** 2))),
        flatten: 0.8,
      }),
    },
    {
      organ: 'stomach',
      // Built empty; the shader stretches it along the normals as it fills (ends pinned).
      geo: organTube(STOMACH, {
        segments: 96,
        radial: 28,
        radius: (u) => stomachRadius(u) * STOMACH_EMPTY,
        flatten: 0.72,
        caps: true,
        // Very gentle longitudinal folding on the greater curvature.
        shape: (u, a) => 1 + 0.025 * Math.sin(u * 46) * Math.max(0, Math.cos(a)),
      }),
      inflate: (u) => stomachRadius(u) * STOMACH_STRETCH * stomachStretchWeight(u),
      // Darker towards the pylorus's muscular antrum.
      tint: (u, base, out) => out.copy(base).lerp(PYLORUS, smoothstep(0.75, 1, u) * 0.5),
    },
    { organ: 'stomach', geo: buildPylorus(), tint: (_u, _base, out) => out.copy(PYLORUS) },
    {
      organ: 'smallIntestine',
      geo: organTube(SMALL_INTESTINE, {
        segments: 560,
        radial: 10,
        radius: (u) => (u < 0.08 ? 0.056 : 0.052) * rounded(0.004)(u),
        caps: true,
      }),
      // The jejunum (first part) is slightly redder, the ileum (last part) paler.
      tint: (u, base, out) => {
        out.copy(base)
        if (u < 0.45) out.lerp(JEJUNUM, 0.4 * (1 - u / 0.45))
        else out.lerp(ILEUM, 0.45 * smoothstep(0.45, 1, u))
      },
      occlude: true,
    },
    {
      organ: 'largeIntestine',
      geo: organTube(LARGE_INTESTINE, {
        segments: 320,
        radial: 16,
        radius: (u) => {
          if (u < 0.05) return lerp(0.11, 0.09, u / 0.05) * rounded(0.012)(u) // caecum
          if (u > 0.9) return lerp(0.075, 0.05, (u - 0.9) / 0.1) * rounded(0.01)(u) // rectum → anal canal
          return 0.085
        },
        shape: (u, a) => {
          if (u > 0.88) return 1
          // Haustra: the colon's row of pouches, pinched between three taeniae coli bands (soft).
          const pouch = 0.5 - 0.5 * Math.cos(u * haustraPouches * Math.PI * 2)
          const band = Math.pow(Math.max(0, Math.cos(3 * a)), 10)
          return 0.92 + 0.12 * pouch - 0.07 * band
        },
        caps: true,
      }),
      occlude: true,
    },
    { organ: 'largeIntestine', geo: organTube(APPENDIX, { segments: 20, radial: 10, radius: (u) => 0.018 * rounded(0.2)(u), caps: true }) },
  ]
  return mergeGeometries(parts.map((p) => prepare(p, samples)))!
}

let cache: ReturnType<typeof build> | null = null

function build() {
  return {
    shell: buildShell(),
    digestion: buildDigestion(),
    particles: {
      carbs: new SphereGeometry(0.03, 12, 8),
      protein: new BoxGeometry(0.045, 0.045, 0.045),
      fat: new OctahedronGeometry(0.036),
      fiber: new CylinderGeometry(0.01, 0.01, 0.09, 6),
      water: new IcosahedronGeometry(0.02, 1),
    } satisfies Record<NutrientKind, BufferGeometry>,
  }
}

/** Geometry is built once and shared by every body on the page. */
export function sharedGeometry() {
  cache ??= build()
  return cache
}
