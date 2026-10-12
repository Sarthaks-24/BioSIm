import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LatheGeometry,
  OctahedronGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
  type Curve,
} from 'three'
import type { NutrientKind } from '@biosim/engine'
import { ESOPHAGUS, LARGE_INTESTINE, SMALL_INTESTINE, STOMACH, stomachRadius } from '../anatomy/anatomy.ts'

/** A tube whose radius changes along its length (TubeGeometry only does constant radius). */
export function variableTube(curve: Curve<Vector3>, radius: (u: number) => number, segments: number, radial = 14): BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, false)
  const positions: number[] = []
  const indices: number[] = []
  const p = new Vector3()
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    curve.getPointAt(u, p)
    const r = radius(u)
    const n = frames.normals[i]!
    const b = frames.binormals[i]!
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      positions.push(p.x + r * (c * n.x + s * b.x), p.y + r * (c * n.y + s * b.y), p.z + r * (c * n.z + s * b.z))
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j
      const b = (i + 1) * (radial + 1) + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Closed ends taper so tubes don't look cut off. */
const taper = (base: number, end = 0.04) => (u: number) => base * Math.min(1, u / end, (1 - u) / end, 1) + 0.004

let cache: ReturnType<typeof build> | null = null

function build() {
  const torsoProfile = [
    [0.0, -1.75], [0.55, -1.7], [0.85, -1.45], [0.92, -1.1], [0.86, -0.6], [0.78, -0.1], [0.82, 0.4],
    [0.95, 1.0], [1.02, 1.6], [1.05, 1.95], [0.9, 2.12], [0.5, 2.2], [0.2, 2.26], [0.16, 2.36], [0.15, 2.52],
  ].map(([x, y]) => new Vector2(x!, y!))
  const torso = new LatheGeometry(torsoProfile, 48)
  torso.scale(1, 1, 0.55)

  const head = new SphereGeometry(0.36, 32, 24)
  head.scale(0.85, 1, 0.95)
  head.translate(0, 2.8, 0)

  const liver = new SphereGeometry(1, 24, 16)
  const pancreas = new SphereGeometry(1, 16, 10)

  return {
    torso,
    head,
    liver,
    pancreas,
    esophagus: variableTube(ESOPHAGUS, taper(0.045), 48, 10),
    stomach: variableTube(STOMACH, stomachRadius, 64, 20),
    smallIntestine: variableTube(SMALL_INTESTINE, taper(0.05, 0.01), 420, 10),
    largeIntestine: variableTube(LARGE_INTESTINE, (u) => (u > 0.86 ? 0.06 : 0.085) * Math.min(1, (1 - u) / 0.02) + 0.004, 220, 14),
    particles: {
      carbs: new SphereGeometry(0.032, 10, 8),
      protein: new BoxGeometry(0.05, 0.05, 0.05),
      fat: new OctahedronGeometry(0.038),
      fiber: new CylinderGeometry(0.011, 0.011, 0.1, 6),
      water: new IcosahedronGeometry(0.022, 0),
    } satisfies Record<NutrientKind, BufferGeometry>,
  }
}

/** Geometry is shared by both bodies (Meal A and Meal B) and built once. */
export function sharedGeometry() {
  cache ??= build()
  return cache
}
