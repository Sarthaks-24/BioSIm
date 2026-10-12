import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Curve,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { NutrientKind } from '@lifepeek/engine'
import {
  APPENDIX,
  ESOPHAGUS,
  GALLBLADDER,
  LARGE_INTESTINE,
  LIVER,
  PANCREAS,
  PHARYNX,
  SMALL_INTESTINE,
  SPLEEN,
  STOMACH,
  TORSO_PROFILE,
  stomachRadius,
} from '../anatomy/anatomy.ts'

/**
 * Every organ is modelled in code from the anatomy curves, so the models, the flat fallback and
 * the particle paths can never drift apart, and nothing has to be downloaded.
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
  /** Close both ends with caps. */
  caps?: boolean
}

const WORLD_Z = new Vector3(0, 0, 1)
const WORLD_X = new Vector3(1, 0, 0)

/**
 * A tube with a varying, shaped cross-section. Frames are built against the body's front axis
 * rather than Frenet frames, so a flattened organ stays flat towards the viewer instead of
 * twisting along its length.
 */
export function organTube(curve: Curve<Vector3>, o: TubeOptions): BufferGeometry {
  const radial = o.radial ?? 16
  const flatten = o.flatten ?? 1
  const positions: number[] = []
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
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const k = r * (o.shape ? o.shape(u, a) : 1)
      const cs = Math.cos(a) * k
      const sn = Math.sin(a) * k * flatten
      positions.push(p.x + side.x * cs + front.x * sn, p.y + side.y * cs + front.y * sn, p.z + side.z * cs + front.z * sn)
    }
  }
  for (let i = 0; i < o.segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j
      const b = a + radial + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  if (o.caps) {
    for (const [ring, u] of [
      [0, 0],
      [o.segments, 1],
    ] as const) {
      curve.getPointAt(u, p)
      const centre = positions.length / 3
      positions.push(p.x, p.y, p.z)
      for (let j = 0; j < radial; j++) {
        const a = ring * (radial + 1) + j
        if (u === 0) indices.push(centre, a + 1, a)
        else indices.push(centre, a, a + 1)
      }
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Round off a tube's ends over the first/last `end` of its length. */
const rounded = (end: number) => (u: number) => {
  const e = Math.min(u, 1 - u) / end
  return e >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e)))
}

/** Sculpt a unit sphere into a solid organ by remapping each vertex. */
function sculpt(geo: BufferGeometry, fn: (v: Vector3) => void): BufferGeometry {
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

function buildLiver(): BufferGeometry {
  // Wedge: thick, domed right lobe (viewer's left) tapering to a thin left lobe that lies over
  // the stomach. Top follows the diaphragm; the underside is flatter.
  return sculpt(new SphereGeometry(1, 72, 48), (v) => {
    const s = (v.x + 1) / 2 // 0 = right lobe edge, 1 = left lobe tip
    // Direction around the long axis, and how far out from it (0–1) this vertex is.
    const ring = Math.sqrt(Math.max(1e-6, 1 - v.x * v.x))
    const ry = v.y / ring
    const rz = v.z / ring
    const out = Math.min(1, Math.hypot(v.y, v.z) / ring)
    // Superellipse end caps keep the lobes full instead of pinching to a point like a sphere.
    const blunt = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * s - 1), 4)), 0.25)
    const top = lerp(0.3, 0.07, Math.pow(s, 1.1)) // domed under the diaphragm
    const bottom = lerp(0.5, 0.0, Math.pow(s, 0.7)) // slanted lower edge: big right lobe, thin left lobe
    const deep = lerp(0.38, 0.12, s)
    const y = ry > 0 ? ry * top : ry * bottom
    // Shallow notch between the lobes (falciform ligament) on the front surface.
    const notch = 1 - 0.2 * Math.exp(-(((s - 0.58) / 0.05) ** 2)) * Math.max(0, rz)
    v.set(LIVER.center.x - 0.6 + s * 1.18, LIVER.center.y + y * out * blunt * notch, LIVER.center.z + rz * out * blunt * deep)
  })
}

function buildGallbladder(): BufferGeometry {
  return sculpt(new SphereGeometry(1, 24, 16), (v) => {
    const pear = v.y < 0 ? 1 : 0.7 - 0.2 * v.y
    v.set(GALLBLADDER.center.x + v.x * 0.045 * pear, GALLBLADDER.center.y + v.y * 0.085, GALLBLADDER.center.z + v.z * 0.04 * pear)
  })
}

function buildSpleen(): BufferGeometry {
  return sculpt(new SphereGeometry(1, 32, 20), (v) => {
    // Bean shape: concave on the side facing the stomach.
    const dent = v.x < 0 ? 1 - 0.35 * Math.exp(-(v.y * v.y) / 0.2) : 1
    v.set(SPLEEN.center.x + v.x * 0.07 * dent, SPLEEN.center.y + v.y * 0.15, SPLEEN.center.z + v.z * 0.06)
  })
}

function buildBody(): BufferGeometry {
  const profile = ([...TORSO_PROFILE, [0, 2.48]] as [number, number][]).map(([x, y]) => new Vector2(x!, y!))
  const torso = new LatheGeometry(profile, 64)
  // Flatter at the back than the front, like a real chest and belly.
  sculpt(torso, (v) => v.set(v.x, v.y, v.z * (v.z > 0 ? 0.58 : 0.5)))

  const head = new SphereGeometry(0.37, 48, 32)
  sculpt(head, (v) => {
    const jaw = v.y < 0 ? 1 - 0.18 * (-v.y / 0.37) : 1
    v.set(v.x * 0.84 * jaw, v.y * 1.05 + 2.84, v.z * 0.95 * jaw + 0.02)
  })

  const arms = [-1, 1].map((sgn) => {
    const arm = new CapsuleGeometry(0.17, 1.55, 8, 24)
    arm.rotateZ(sgn * 0.12)
    arm.translate(sgn * 1.17, 1.02, -0.02)
    return arm
  })
  return mergeGeometries([torso.toNonIndexed(), head.toNonIndexed(), ...arms.map((a) => a.toNonIndexed())])
}

let cache: ReturnType<typeof build> | null = null

function build() {
  const haustraPouches = 34
  return {
    body: buildBody(),
    liver: buildLiver(),
    gallbladder: buildGallbladder(),
    spleen: buildSpleen(),
    pancreas: organTube(PANCREAS, { segments: 60, radius: (u) => lerp(0.075, 0.032, u) * rounded(0.12)(u), flatten: 0.55, caps: true }),
    pharynx: organTube(PHARYNX, { segments: 16, radius: () => 0.05, radial: 12 }),
    esophagus: organTube(ESOPHAGUS, {
      segments: 80,
      radial: 14,
      // Slight narrowings where the aorta and diaphragm press on it.
      radius: (u) => 0.042 * (1 - 0.18 * Math.exp(-(((u - 0.35) / 0.05) ** 2)) - 0.15 * Math.exp(-(((u - 0.82) / 0.05) ** 2))),
      flatten: 0.8,
    }),
    stomach: organTube(STOMACH, {
      segments: 120,
      radial: 28,
      radius: stomachRadius,
      flatten: 0.72,
      caps: true,
      // Very gentle longitudinal folding on the greater curvature.
      shape: (u, a) => 1 + 0.025 * Math.sin(u * 46) * Math.max(0, Math.cos(a)),
    }),
    pylorus: new TorusGeometry(0.05, 0.016, 10, 24),
    smallIntestine: organTube(SMALL_INTESTINE, { segments: 900, radial: 12, radius: (u) => (u < 0.08 ? 0.05 : 0.043) * rounded(0.004)(u) }),
    largeIntestine: organTube(LARGE_INTESTINE, {
      segments: 520,
      radial: 24,
      radius: (u) => {
        if (u < 0.05) return lerp(0.11, 0.09, u / 0.05) * rounded(0.012)(u) // caecum
        if (u > 0.9) return lerp(0.075, 0.05, (u - 0.9) / 0.1) * rounded(0.01)(u) // rectum → anal canal
        return 0.085
      },
      shape: (u, a) => {
        if (u > 0.88) return 1
        // Haustra: the colon's row of pouches, pinched between three taeniae coli bands.
        const pouch = 0.5 - 0.5 * Math.cos(u * haustraPouches * Math.PI * 2)
        const band = Math.pow(Math.max(0, Math.cos(3 * a)), 10)
        return 0.9 + 0.16 * pouch - 0.1 * band
      },
      caps: true,
    }),
    appendix: organTube(APPENDIX, { segments: 24, radial: 10, radius: (u) => 0.018 * rounded(0.2)(u), caps: true }),
    particles: {
      carbs: new SphereGeometry(0.03, 12, 8),
      protein: new BoxGeometry(0.045, 0.045, 0.045),
      fat: new OctahedronGeometry(0.036),
      fiber: new CylinderGeometry(0.01, 0.01, 0.09, 6),
      water: new IcosahedronGeometry(0.02, 1),
    } satisfies Record<NutrientKind, BufferGeometry>,
  }
}

/** Geometry is shared by both bodies (Meal A and Meal B) and built once. */
export function sharedGeometry() {
  cache ??= build()
  return cache
}

/** Pylorus ring sits at the end of the stomach, facing along the tube. */
export function pylorusTransform() {
  const pos = STOMACH.getPointAt(1)
  const tan = STOMACH.getTangentAt(1)
  return { pos, tan }
}
