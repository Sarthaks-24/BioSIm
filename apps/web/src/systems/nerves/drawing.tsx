import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CAROTID, CEREBELLUM, CORD, FOREBRAIN, LABELS, MEDULLA, NERVES, type NerveLabel, type Outline } from '../../anatomy/human/nerves.ts'
import { NERVE_TONE } from '../../anatomy/tones/nerves.ts'
import { onTick } from '../../lib/ticker.ts'
import type { View } from '../../anatomy/human/base.ts'
import type { LayerProps } from '../../registry/types.ts'
import { brainSugar } from './ui.tsx'

/*
 * The pack shares no code with the stage (a module shared with /sim would be split out of it into a
 * chunk of its own, on every first download). So the few lines it needs of the flat body are
 * written out here, and nerves.test.ts checks each against its original: `frameOf`
 * (flat/FlatBody.tsx frame) and LOOK (flat/look.ts FLAT_LOOK).
 */

/** Scene units → CSS px, front-on, fitting `view` into the picture (flat/FlatBody.tsx `frame`). */
export function frameOf(w: number, h: number, view: View) {
  const scale = Math.min(w / (view.maxX - view.minX), h / (view.maxY - view.minY))
  const oy = h / 2 + ((view.maxY + view.minY) / 2) * scale
  return { scale, X: (x: number) => w / 2 + x * scale, Y: (y: number) => oy - y * scale }
}

/** The outline's shade of an organ's colour and its width (flat/look.ts FLAT_LOOK). */
export const LOOK = { normal: { ink: 0.42, line: 1.25 }, projector: { ink: 0.2, line: 2 } } as const
type Look = (typeof LOOK)[keyof typeof LOOK]

/** An organ colour's outline: the colour, shaded (flat/look.ts outlineOf). */
const ink = (hex: string, look: Look) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * look.ink)).join(',')})`

/** The cord's outline: a pale fill (L* > 85) gets a 3 px ink outline on the projector (anatomy plan §5). */
export const cordLine = (look: Look) => (look === LOOK.projector ? 3 : look.line)

/** The labels, most needed first (anatomy plan §6): a short picture names the brain, the cord and the nerves; a tall one the brain's parts too. */
const LABEL_KEYS: readonly NerveLabel[] = ['brain', 'cord', 'nerves', 'forebrain', 'cerebellum', 'medulla']

/** How fast the sugar dots climb the neck arteries at 4.4 g an hour, px a second (Drawing only: the same all day). */
const SUGAR_PX_PER_S = 14

/**
 * Brain & nerves' flat picture (U-7; anatomy plan §2.8), over the base body in the `upper` framing:
 * the brain (fore-brain, the cerebellum under it, the medulla), the spinal cord ending near L1–L2,
 * about ten nerves out to the arms, between the ribs and to the legs, and the two neck arteries.
 *
 * - Sugar dots climb the neck arteries at one steady speed ← `brain.glucoseUse` (a cited constant:
 *   "about the same all day"), on the real clock (lib/ticker.ts) while motion is allowed; with
 *   motion reduced, still dots and an arrow up each artery. Nothing "lights up" (anatomy plan §2.8),
 *   and nothing changes colour or flashes.
 * - The nerve signals are the demo's (NerveDemo.tsx), in the graph column: the body stays calm.
 */
function NervesLayer({ sim, view, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const dots = useRef<SVGGElement>(null)
  const m = frameOf(w, h, view)
  const look = projector ? LOOK.projector : LOOK.normal
  const sugar = brainSugar(sim)

  // The sugar dots, moving up at one speed (the brain's use does not change with the meal).
  useEffect(() => {
    if (reduced || !sugar) return
    const speed = SUGAR_PX_PER_S * (Number(sugar) / 4.4)
    let offset = 0
    return onTick((dt) => {
      offset -= speed * dt
      for (const path of dots.current?.querySelectorAll('path') ?? []) path.style.setProperty('stroke-dashoffset', offset.toFixed(1))
    })
  }, [reduced, sugar])

  // The labels, laid out by the stage's label overlay (handed over in `kit`), at the nerves' own places.
  const specs = useMemo(
    () =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.control.nerves.map.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: (h < 300 && i > 2) || (w < 340 && i > 2),
      })),
    [t, h, w],
  )
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), LABELS)
  useEffect(() => void placeLabels())

  const path = (pts: Outline) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${m.X(x).toFixed(1)} ${m.Y(y).toFixed(1)}`).join('')
  const mirror = (pts: Outline): Outline => pts.map(([x, y]) => [-x, y])
  const px = (u: number) => u * m.scale
  const organ = (tone: string, line: number = look.line) => ({ fill: tone, stroke: ink(tone, look), strokeWidth: line })
  const tube = (pts: Outline, width: number, tone: string, key: string) => (
    <g key={key}>
      <path d={path(pts)} stroke={ink(tone, look)} strokeWidth={px(width) + 2 * look.line} />
      <path d={path(pts)} stroke={tone} strokeWidth={px(width)} />
    </g>
  )
  const carotids = [CAROTID, mirror(CAROTID)]
  const dot = Math.max(3, px(0.035))
  const arrow = (pts: Outline) => {
    const [x, y] = [m.X(pts[2]![0]), m.Y(pts[2]![1])]
    const s = Math.max(4, px(0.04))
    return `M${x - s * 0.7} ${y + s * 0.5}L${x} ${y - s * 0.5}L${x + s * 0.7} ${y + s * 0.5}`
  }

  return (
    <div
      data-layer="nerves"
      data-drawn=""
      data-dots={reduced ? 'still' : 'moving'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        aria-hidden="true"
        width={w}
        height={h}
        className="absolute top-0 left-0"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* The nerves first, the cord over their roots. */}
        {NERVES.map((n, i) => tube(n, 0.022, NERVE_TONE.nerve, `n${i}`))}
        {carotids.map((c, i) => tube(c, 0.04, NERVE_TONE.artery, `a${i}`))}
        <rect
          x={m.X(-CORD.width / 2)}
          y={m.Y(CORD.top)}
          width={px(CORD.width)}
          height={px(CORD.top - CORD.bottom)}
          rx={px(CORD.width / 2)}
          {...organ(NERVE_TONE.cord, cordLine(look))}
        />
        <rect
          x={m.X(-MEDULLA.width / 2)}
          y={m.Y(MEDULLA.top)}
          width={px(MEDULLA.width)}
          height={px(MEDULLA.top - MEDULLA.bottom)}
          rx={px(MEDULLA.width / 2)}
          {...organ(NERVE_TONE.brain)}
        />
        {[1, -1].map((side) => (
          <ellipse
            key={side}
            cx={m.X(side * CEREBELLUM.x)}
            cy={m.Y(CEREBELLUM.y)}
            rx={px(CEREBELLUM.rx)}
            ry={px(CEREBELLUM.ry)}
            {...organ(NERVE_TONE.brain)}
          />
        ))}
        <ellipse cx={m.X(FOREBRAIN.x)} cy={m.Y(FOREBRAIN.y)} rx={px(FOREBRAIN.rx)} ry={px(FOREBRAIN.ry)} {...organ(NERVE_TONE.brain)} />
        {/* The fore-brain's two halves and a few folds: lines, not colour. */}
        <path
          d={`M${m.X(0)} ${m.Y(FOREBRAIN.y + FOREBRAIN.ry)}V${m.Y(FOREBRAIN.y - FOREBRAIN.ry * 0.7)}`}
          stroke={ink(NERVE_TONE.brain, look)}
          strokeWidth={look.line}
        />
        {sugar &&
          (reduced ? (
            <g data-arrows="" stroke={ink(NERVE_TONE.sugar, LOOK.projector)} strokeWidth="2">
              {carotids.map((c, i) => (
                <path key={i} d={arrow(c)} />
              ))}
            </g>
          ) : (
            <g ref={dots} data-sugar-dots="">
              {carotids.map((c, i) => (
                <g key={i}>
                  <path d={path(c)} stroke={ink(NERVE_TONE.sugar, LOOK.projector)} strokeWidth={dot + 2} strokeDasharray={`0 ${dot * 4}`} />
                  <path d={path(c)} stroke={NERVE_TONE.sugar} strokeWidth={dot} strokeDasharray={`0 ${dot * 4}`} />
                </g>
              ))}
            </g>
          ))}
      </svg>
      {overlay}
    </div>
  )
}

/** The `control` pack's flat drawings (systems/load.ts `PackDef.drawing`): Brain & nerves' (U-6 adds Hormones'). */
const DRAWINGS = { nerves: NervesLayer }
export default DRAWINGS
