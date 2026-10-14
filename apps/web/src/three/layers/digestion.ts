import { Color, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry } from 'three'
import type { RunResult } from '@lifepeek/engine'
import {
  APPENDIX,
  ESOPHAGUS,
  GALLBLADDER,
  LARGE_INTESTINE,
  LIVER,
  PANCREAS,
  PHARYNX,
  SMALL_INTESTINE,
  STOMACH,
  STOMACH_EMPTY,
  STOMACH_STRETCH,
  stomachRadius,
  stomachStretchWeight,
} from '../../anatomy/human/digestion.ts'
import { bodyStateAt } from '../../anatomy/bodyState.ts'
import { ILEUM_TONE, JEJUNUM_TONE, LIT_ORGANS, ORGAN_TONE, PYLORUS_TONE, type LitOrgan } from '../../anatomy/tones/digestion.ts'
import { layerGeometry, lerp, organTube, rounded, sculpt, smoothstep, type Part } from '../geometry.ts'
import type { Layer3d, LayerState } from '../layer.ts'

/**
 * Digestion's lit layer: liver, gallbladder, pancreas, oesophagus, stomach (which stretches as it
 * fills: `inflate` × its uFill slot), small and large intestine. It is part of the 3D body's own
 * chunk, because it is the first 3D view (anatomy plan §8: base + digestion ≤ 270 KB gz).
 */

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

const JEJUNUM = new Color(JEJUNUM_TONE)
const ILEUM = new Color(ILEUM_TONE)
const PYLORUS = new Color(PYLORUS_TONE)

function buildPylorus(): BufferGeometry {
  const geo = new TorusGeometry(0.046, 0.014, 10, 24)
  const tan = STOMACH.getTangentAt(1, new Vector3())
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tan)
  geo.applyMatrix4(new Matrix4().compose(STOMACH.getPointAt(1, new Vector3()), q, new Vector3(1, 1, 1)))
  return geo
}

function buildDigestion(): BufferGeometry {
  const haustraPouches = 34
  const samples = gutSamples()
  const parts: Part<LitOrgan>[] = [
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
  return layerGeometry(parts, LIT_ORGANS, ORGAN_TONE, samples)
}

const STOMACH_AT = LIT_ORGANS.indexOf('stomach')

/** Organ highlight per frame: −1 faded (empty), 0 normal, 1 where the meal is now; the stomach's fill. */
function write(out: LayerState, sim: RunResult, t: number) {
  const s = bodyStateAt(sim, t)
  out.fill[STOMACH_AT] = s.stomachFill
  const state = out.state
  for (let i = 0; i < LIT_ORGANS.length; i++) {
    const organ = LIT_ORGANS[i]!
    switch (organ) {
      case 'esophagus':
        state[i] = s.stage === 'mouth' || s.stage === 'esophagus' ? 1 : 0
        break
      case 'stomach':
      case 'smallIntestine':
      case 'largeIntestine':
        state[i] = s.stage === organ ? 1 : s.holds[organ] ? 0 : -1
        break
      default:
        state[i] = 0
    }
  }
}

export const DIGESTION_3D: Layer3d = {
  id: 'digestion',
  organs: LIT_ORGANS,
  // One tier for now: the 2 GB phone's lighter mesh (plan §9, radial × 0.5) comes with its own shots.
  build: (): BufferGeometry => buildDigestion(),
  write,
}
