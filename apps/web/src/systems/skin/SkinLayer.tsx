import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt } from '@lifepeek/engine'
import { DROPS, HEAD, LABELS, SKIN_VESSELS, type SkinLabel } from '../../anatomy/human/skin.ts'
import { SKIN_TONE } from '../../anatomy/tones/skin.ts'
import type { CalloutSpec } from '../../anatomy/CalloutOverlay.tsx'
import { useClock } from '../../state/clock.ts'
import type { LayerProps } from '../../registry/types.ts'
import { dropCount, seriesOf, useSteady, vesselsWide } from '../muscles/effort.ts'
import {
  LOOK,
  crossFade,
  frameOf,
  inkOf,
  limbOf,
  limbPoint,
  polyPath,
  posedLabels,
  sized,
  stretchOutline,
  usePosed,
  type Frame,
  type Look,
  type Posed,
  type Pt,
} from '../muscles/paint.ts'

/** Where each drop sits in this pose, in scene units (DROPS: forehead, arms, trunk). */
export function dropPlaces(posed: Posed): Pt[] {
  return DROPS.map((d) => {
    if ('at' in d) return d.at
    const { curve, radius } = limbOf(posed, 'arm', d.arm)
    return limbPoint(curve, radius, d.u, d.off, d.arm)
  })
}

/**
 * The skin's rim: a band of the rim tone just inside the posed outline (arms under the torso, the
 * torso with the legs, arms in front of it) and round the head, then the outline, 3 px of ink on the
 * projector (anatomy plan §5: the rim is pale). An arm in front hides the rim behind it.
 */
function paintRim(ctx: CanvasRenderingContext2D, posed: Posed, look: Look, m: Frame) {
  const { rim } = SKIN_TONE
  const band = Math.max(3, 0.05 * m.scale)
  const head = () => {
    ctx.beginPath()
    ctx.ellipse(m.X(HEAD.center.x), m.Y(HEAD.center.y), HEAD.rx * m.scale, HEAD.ry * m.scale, 0, 0, Math.PI * 2)
  }
  const ring = (path: () => void) => {
    ctx.save()
    path()
    ctx.clip()
    path()
    ctx.strokeStyle = rim
    ctx.lineWidth = band * 2
    ctx.stroke()
    ctx.restore()
    path()
    ctx.strokeStyle = inkOf(rim, look)
    ctx.lineWidth = look.pale
    ctx.stroke()
  }
  ctx.lineJoin = 'round'
  for (const pts of posed.figure.under) ring(() => polyPath(ctx, pts, m))
  ring(() => polyPath(ctx, posed.figure.body, m))
  ring(head)
  for (const pts of posed.figure.over) {
    polyPath(ctx, pts, m)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill()
    ctx.restore()
    ring(() => polyPath(ctx, pts, m))
  }
}

/** The forearms' skin vessels: wavy lines along each forearm, `wide` one step wider (Drawing only). */
function paintVessels(ctx: CanvasRenderingContext2D, posed: Posed, wide: boolean, m: Frame) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = SKIN_TONE.vessel
  ctx.lineWidth = Math.max(1, (wide ? 0.03 : 0.016) * m.scale)
  for (const side of [1, -1] as const) {
    const { curve, radius } = limbOf(posed, 'arm', side)
    for (const v of SKIN_VESSELS) {
      const line = stretchOutline(curve, radius, { ...v, w: 0 }, side, false, 16).slice(0, 17)
      ctx.beginPath()
      line.forEach(([x, y], i) => {
        // A gentle wave across the line, so it reads as a vessel, not a seam.
        const wave = Math.sin(i * 1.3) * 0.012
        return i ? ctx.lineTo(m.X(x + wave), m.Y(y)) : ctx.moveTo(m.X(x), m.Y(y))
      })
      ctx.stroke()
    }
  }
}

/** A sweat drop's outline, pointing up, `r` px wide at its round end (drops do not fall: anatomy plan §2.5). */
const dropPath = (x: number, y: number, r: number) =>
  `M${x} ${y - 1.7 * r}C${x + 0.6 * r} ${y - 0.7 * r} ${x + r} ${y - 0.2 * r} ${x + r} ${y + 0.35 * r}A${r} ${r} 0 0 1 ${x - r} ${y + 0.35 * r}C${x - r} ${y - 0.2 * r} ${x - 0.6 * r} ${y - 0.7 * r} ${x} ${y - 1.7 * r}Z`

const LABEL_KEYS: readonly SkinLabel[] = ['skin', 'sweat', 'vessels']

/**
 * Skin & temperature's flat picture (U-1; anatomy plan §2.5), over the base body in the `full`
 * framing and the band's still pose: the skin's neutral rim, the forearms' skin vessels and at most
 * 12 sweat drops (forehead, arms, chest). The drops' count follows `skin.sweatRate` at the meal-clock
 * minute on screen (dropCount: one drop for every 80 mL an hour, with hysteresis), changes at most
 * once a real second and fades in over 300 ms; drops do not fall. The vessels widen one step while
 * sweat is made (Drawing only). Nothing is ever red or an alarm (ui-ux §7); the thermometer card says
 * body temperature is kept within a narrow range (systems/muscles/ui.tsx).
 */
export default function SkinLayer({ sim, view, band, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const posed = usePosed(band, kit)
  const main = useRef<HTMLCanvasElement>(null)
  const ghost = useRef<HTMLCanvasElement>(null)
  const narrow = useRef<HTMLCanvasElement>(null)
  const wide = useRef<HTMLCanvasElement>(null)
  const look = projector ? LOOK.projector : LOOK.normal
  const m = frameOf(w, h, view)

  // The drops' count and the vessels' step at the clock's minute, with hysteresis; each shown at most once a real second.
  const last = useRef({ n: 0, wide: false })
  const sweat = useClock(
    useMemo(() => {
      // A new run starts from no sweat.
      last.current = { n: 0, wide: false }
      return (s: { simMin: number }) => {
        const rate = seriesOf(sim, 'skin.sweatRate')
        const v = rate ? valueAt(rate, s.simMin, sim.stepMin) : 0
        last.current = { n: dropCount(v, last.current.n), wide: vesselsWide(v, last.current.wide) }
        return `${last.current.n}|${last.current.wide ? 1 : 0}`
      }
    }, [sim]),
  )
  const [count, widened] = useSteady(sweat).split('|').map(Number) as [number, number]

  const shownPose = useRef('')
  useEffect(() => {
    const c = main.current
    if (!posed || !c || w === 0 || h === 0) return
    const pose = posed.limbs.band
    if (shownPose.current && shownPose.current !== pose && ghost.current)
      crossFade([narrow.current, wide.current, c], ghost.current, reduced)
    shownPose.current = pose
    const ctx = sized(c, w, h)
    if (ctx) paintRim(ctx, posed, look, m)
    for (const [ref, isWide] of [
      [narrow, false],
      [wide, true],
    ] as const) {
      const v = ref.current && sized(ref.current, w, h)
      if (v) paintVessels(v, posed, isWide, m)
    }
  }, [posed, w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view; `band` comes with `posed`

  const places = useMemo(() => posed && dropPlaces(posed), [posed])
  const r = Math.max(3.5, 0.045 * m.scale)

  const roomy = w >= 460
  const specs = useMemo<CalloutSpec<SkinLabel>[]>(
    () => LABEL_KEYS.map((key) => ({ key, text: t(`sys.effort.skin.label.${key}`), tone: 'stage', hidden: !roomy && key === 'vessels' })),
    [t, roomy],
  )
  const table = useMemo(() => (posed ? posedLabels(LABELS, posed, { vessels: { limb: 'arm', side: -1, u: 0.68 } }) : LABELS), [posed])
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), table)
  useEffect(() => void placeLabels())

  const fade = reduced ? 'none' : 'opacity 300ms linear'
  return (
    <div
      data-layer="skin"
      data-pose={posed?.limbs.band}
      data-drops={count}
      data-vessels={widened ? 'wide' : 'narrow'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={narrow} aria-hidden="true" className="absolute top-0 left-0" style={{ opacity: widened ? 0 : 1, transition: fade }} />
      <canvas ref={wide} aria-hidden="true" className="absolute top-0 left-0" style={{ opacity: widened ? 1 : 0, transition: fade }} />
      <canvas ref={main} aria-hidden="true" className="absolute top-0 left-0" />
      <canvas ref={ghost} aria-hidden="true" className="absolute top-0 left-0" style={{ opacity: 0 }} />
      <svg aria-hidden="true" width={w} height={h} className="absolute top-0 left-0 overflow-visible">
        {places?.map(([x, y], i) => (
          <g key={i} data-drop={i < count ? 'on' : 'off'} style={{ opacity: i < count ? 1 : 0, transition: fade }}>
            <path d={dropPath(m.X(x), m.Y(y), r)} fill={SKIN_TONE.sweat} stroke={inkOf(SKIN_TONE.sweat, look)} strokeWidth={look.line} />
            <circle cx={m.X(x) - r * 0.35} cy={m.Y(y) - r * 0.1} r={r * 0.28} fill="white" opacity="0.7" />
          </g>
        ))}
      </svg>
      {overlay}
    </div>
  )
}
