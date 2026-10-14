import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt } from '@lifepeek/engine'
import {
  BELLY_BANDS,
  LABELS,
  LIMB_LABELS,
  LIMB_MUSCLES,
  TENDONS,
  TRUNK_MUSCLES,
  WORKING,
  type MuscleGroup,
  type MusclesLabel,
} from '../../anatomy/human/muscles.ts'
import { MUSCLES_TONE } from '../../anatomy/tones/muscles.ts'
import type { CalloutSpec } from '../../anatomy/CalloutOverlay.tsx'
import { useClock } from '../../state/clock.ts'
import type { LayerProps } from '../../registry/types.ts'
import SkinLayer from '../skin/SkinLayer.tsx'
import BonesLayer from '../bones/BonesLayer.tsx'
import { hatchStep, lastKindAt, seriesOf, useSteady } from './effort.ts'
import {
  LOOK,
  crossFade,
  frameOf,
  inkOf,
  lighter,
  limbOf,
  mirrored,
  posedLabels,
  sized,
  smoothPath,
  stretchOutline,
  usePosed,
  type Frame,
  type Look,
  type Posed,
  type Pt,
} from './paint.ts'

/** One shape of the muscles' picture, in draw order: a muscle (its group), a tendon, or an arm in front that hides what is under it. */
type Shape = { kind: 'muscle'; group: MuscleGroup; pts: Pt[] } | { kind: 'tendon'; pts: Pt[] } | { kind: 'clear'; pts: Pt[] }

/**
 * The muscles' shapes in a pose, in the order they are drawn (anatomy plan §2.4): the arms that hang
 * beside the body (under the torso), the trunk's groups on both sides, the legs' groups and tendons,
 * then each arm whose hand comes forward (a brisk walk's, a run's): first what it hides is cleared
 * (its skin outline, flat/limbs.ts figure), then its own muscles.
 */
export function muscleShapes(posed: Posed): Shape[] {
  const out: Shape[] = []
  const limb = (which: 'leg' | 'arm', side: 1 | -1) => {
    const { curve, radius } = limbOf(posed, which, side)
    for (const s of LIMB_MUSCLES)
      if (s.limb === which) out.push({ kind: 'muscle', group: s.group, pts: stretchOutline(curve, radius, s, side, true) })
    for (const s of TENDONS) if (s.limb === which) out.push({ kind: 'tendon', pts: stretchOutline(curve, radius, s, side, false, 6) })
  }
  const arms = posed.limbs.arms
  for (const a of arms) if (!a.front) limb('arm', a.side)
  for (const { group, outline } of TRUNK_MUSCLES) {
    out.push({ kind: 'muscle', group, pts: outline.map(([x, y]) => [x, y] as const) })
    out.push({ kind: 'muscle', group, pts: mirrored(outline) })
  }
  limb('leg', 1)
  limb('leg', -1)
  posed.figure.over.forEach((pts, i) => {
    out.push({ kind: 'clear', pts })
    limb('arm', arms.filter((a) => a.front)[i]!.side)
  })
  return out
}

/** The bones under the muscles, faint (anatomy plan §2.4 "bones ghost"): the long bones' lines and the backbone. */
function paintGhost(ctx: CanvasRenderingContext2D, posed: Posed, m: Frame) {
  const { ghost } = MUSCLES_TONE
  const width = Math.max(2, 0.07 * m.scale)
  const stroke = (pts: Pt[]) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(m.X(x), m.Y(y)) : ctx.moveTo(m.X(x), m.Y(y))))
    ctx.strokeStyle = 'rgba(61,76,107,0.25)'
    ctx.lineWidth = width + 2
    ctx.stroke()
    ctx.strokeStyle = ghost
    ctx.lineWidth = width
    ctx.stroke()
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  stroke([
    [0, 2.45],
    [0, -1.0],
  ])
  for (const side of [1, -1] as const)
    for (const [which, u0, u1] of [
      ['leg', 0.02, 0.92],
      ['arm', 0.06, 0.86],
    ] as const) {
      const { curve, radius } = limbOf(posed, which, side)
      const line = stretchOutline(curve, radius, { u0, u1, off: 0, w: 0 }, side, false, 24)
      stroke(line.slice(0, 25))
    }
}

/** Every muscle and tendon at rest: the muscle tone, its outline, the belly's bands. */
function paintMuscles(ctx: CanvasRenderingContext2D, shapes: Shape[], look: Look, m: Frame) {
  const { muscle, tendon } = MUSCLES_TONE
  ctx.lineJoin = 'round'
  for (const s of shapes) {
    smoothPath(ctx, s.pts, m)
    if (s.kind === 'clear') {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fill()
      ctx.restore()
      continue
    }
    const tone = s.kind === 'muscle' ? muscle : tendon
    ctx.fillStyle = tone
    ctx.fill()
    ctx.strokeStyle = inkOf(tone, look)
    ctx.lineWidth = look.line
    ctx.stroke()
  }
  // The belly muscle's bands, across it on both sides.
  ctx.strokeStyle = inkOf(muscle, look)
  ctx.lineWidth = Math.max(1, look.line * 0.8)
  for (const y of BELLY_BANDS) {
    ctx.beginPath()
    ctx.moveTo(m.X(-0.29), m.Y(y))
    ctx.lineTo(m.X(-0.04), m.Y(y - 0.02))
    ctx.moveTo(m.X(0.04), m.Y(y - 0.02))
    ctx.lineTo(m.X(0.29), m.Y(y))
    ctx.stroke()
  }
}

/** The hatch's ink: a deep shade of the muscle tone, so a hatched muscle stays the same colour. */
const HATCH_INK = 'rgba(70,16,22,0.55)'
/** Space between hatch lines, CSS px. */
const HATCH_GAP = 9

/**
 * One hatch step over the working groups (anatomy plan §2.4, §4): step 1 lifts their fill one
 * lightness step (3 % towards white: under 10 % relative luminance) and draws sparse lines; step 2
 * adds lines between them; step 3 crosses them. Each step is its own canvas, faded in and out (300 ms).
 */
function paintHatch(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  working: readonly MuscleGroup[],
  step: 1 | 2 | 3,
  look: Look,
  m: Frame,
) {
  const shift = step === 2 ? HATCH_GAP / 2 : 0
  for (const s of shapes) {
    smoothPath(ctx, s.pts, m)
    if (s.kind === 'clear') {
      // An arm in front hides the hatch of what is under it too.
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fill()
      ctx.restore()
      continue
    }
    if (s.kind !== 'muscle' || !working.includes(s.group)) {
      // A muscle that is not working hides the hatch of what is under it (a back arm under the chest).
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fill()
      ctx.restore()
      continue
    }
    if (step === 1) {
      ctx.fillStyle = lighter(MUSCLES_TONE.muscle, 0.03)
      ctx.fill()
      ctx.strokeStyle = inkOf(MUSCLES_TONE.muscle, look)
      ctx.lineWidth = look.line
      ctx.stroke()
    }
    // The lines, clipped to this muscle, across its box only; every step's lines sit on one grid.
    const xs = s.pts.map(([x]) => m.X(x))
    const ys = s.pts.map(([, y]) => m.Y(y))
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const tall = y1 - y0
    ctx.save()
    ctx.clip()
    ctx.strokeStyle = HATCH_INK
    ctx.lineWidth = look === LOOK.projector ? 1.6 : 1.1
    ctx.beginPath()
    const first = Math.floor((x0 - tall - shift) / HATCH_GAP) * HATCH_GAP + shift
    for (let x = first; x < x1 + tall; x += HATCH_GAP) {
      // Lines up to the right (steps 1, 2), down to the right (3: the cross).
      if (step === 3) {
        ctx.moveTo(x, y0)
        ctx.lineTo(x + tall, y1)
      } else {
        ctx.moveTo(x, y1)
        ctx.lineTo(x + tall, y0)
      }
    }
    ctx.stroke()
    ctx.restore()
  }
}

/** The labels, the plan's first three on a narrow picture (anatomy plan §6). */
const LABEL_KEYS: readonly MusclesLabel[] = ['legs', 'arms', 'belly', 'tendon']

/**
 * Muscles' flat picture (U-1; anatomy plan §2.4), over the base body in the `full` framing and in the
 * band's still pose (one per kind: rest, walk, brisk walk, run; R32, U-1a): about twelve muscle
 * groups with their tendons, the bones faint under them. The pose changes only at a band's edge,
 * cross-faded over 300 ms (a cut with motion reduced).
 *
 * The working groups (WORKING: the legs in any walk or run, the arms too in a brisk walk or a run,
 * the belly too in a run and the games, the trunk and forearm sitting in class) get a hatch step that follows `muscle.energyRate` at the meal-clock minute
 * on screen (hatchStep, with hysteresis), changing at most once a real second and fading over 300 ms.
 * No kcal on the body; no colour change, only a hatch and one lightness step.
 */
function MusclesLayer({ sim, view, band, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const posed = usePosed(band, kit)
  const main = useRef<HTMLCanvasElement>(null)
  const ghost = useRef<HTMLCanvasElement>(null)
  const hatch = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)]
  const look = projector ? LOOK.projector : LOOK.normal
  const m = frameOf(w, h, view)

  // The hatch step at the clock's minute (with hysteresis, from rest for each new run) and which
  // groups work (the bout's kind at this minute, or the last bout's while the muscles ease off):
  // both shown at most once a real second, so a hatch never changes faster than that.
  const prev = useRef(0)
  const selector = useMemo(() => {
    prev.current = 0
    return (s: { simMin: number }) => {
      const rate = seriesOf(sim, 'muscle.energyRate')
      prev.current = rate ? hatchStep(valueAt(rate, s.simMin, sim.stepMin), prev.current) : 0
      return `${prev.current}|${lastKindAt(sim.activity, s.simMin) ?? ''}`
    }
  }, [sim])
  const [shownStep, shownKind] = useSteady(useClock(selector)).split('|') as [string, string]
  const shown = Number(shownStep)
  const kind = (shownKind || null) as keyof typeof WORKING | null
  const shapes = useMemo(() => posed && muscleShapes(posed), [posed])
  const shownPose = useRef('')

  useEffect(() => {
    const c = main.current
    if (!posed || !shapes || !c || w === 0 || h === 0) return
    const pose = posed.limbs.band
    // At a band's edge the old picture, hatch and all, fades out over the new one.
    if (shownPose.current && shownPose.current !== pose && ghost.current)
      crossFade([c, ...hatch.map((r) => r.current)], ghost.current, reduced)
    shownPose.current = pose
    const ctx = sized(c, w, h)
    if (!ctx) return
    paintGhost(ctx, posed, m)
    paintMuscles(ctx, shapes, look, m)
  }, [posed, shapes, w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view; `band` comes with `posed`

  useEffect(() => {
    if (!shapes) return
    const working = kind ? WORKING[kind] : []
    hatch.forEach((ref, i) => {
      const ctx = ref.current && sized(ref.current, w, h)
      if (ctx) paintHatch(ctx, shapes, working, (i + 1) as 1 | 2 | 3, look, m)
    })
  }, [shapes, kind, w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view; refs are stable

  // The labels: the limbs' ones on the pose (LIMB_LABELS), placed when the size, pose or words change.
  const roomy = w >= 460
  const specs = useMemo<CalloutSpec<MusclesLabel>[]>(
    () => LABEL_KEYS.map((key, i) => ({ key, text: t(`sys.effort.muscles.label.${key}`), tone: 'stage', hidden: !roomy && i > 2 })),
    [t, roomy],
  )
  const table = useMemo(() => (posed ? posedLabels(LABELS, posed, LIMB_LABELS) : LABELS), [posed])
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), table)
  useEffect(() => void placeLabels())

  const fade = reduced ? 'none' : 'opacity 300ms linear'
  return (
    <div
      data-layer="muscles"
      data-pose={posed?.limbs.band}
      data-hatch={shown}
      data-working={kind ?? ''}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={main} aria-hidden="true" className="absolute top-0 left-0" />
      {hatch.map((ref, i) => (
        <canvas
          key={i}
          ref={ref}
          aria-hidden="true"
          className="absolute top-0 left-0"
          style={{ opacity: shown > i ? 1 : 0, transition: fade }}
        />
      ))}
      <canvas ref={ghost} aria-hidden="true" className="absolute top-0 left-0" style={{ opacity: 0 }} />
      {overlay}
    </div>
  )
}

/** The pack's drawings (systems/load.ts `drawing`): one per system it serves, all in one chunk with the pack. */
const DRAWINGS = { muscles: MusclesLayer, skin: SkinLayer, bones: BonesLayer }
export default DRAWINGS
