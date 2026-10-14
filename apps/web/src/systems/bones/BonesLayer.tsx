import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  COLLARBONE,
  LABELS,
  LONG_BONES,
  PELVIS,
  RIB_ROWS,
  SACRUM_TOP,
  SKULL,
  SPINE_Y,
  STERNUM,
  type BonesLabel,
} from '../../anatomy/human/bones.ts'
import { BONES_TONE } from '../../anatomy/tones/bones.ts'
import type { CalloutSpec } from '../../anatomy/CalloutOverlay.tsx'
import type { LayerProps } from '../../registry/types.ts'
import {
  LOOK,
  crossFade,
  frameOf,
  inkOf,
  limbOf,
  limbPoint,
  mirrored,
  polyPath,
  posedLabels,
  sized,
  smoothPath,
  stretchOutline,
  usePosed,
  type Frame,
  type Look,
  type Posed,
  type Pt,
} from '../muscles/paint.ts'

/** Where the knee is along a leg (anatomy/human/limbs.ts KNEE_U: thigh 2.15 of 4.45). */
const KNEE_U = 2.15 / 4.45

/**
 * Paints the skeleton in a pose (anatomy plan §2.6), in CSS px of the picture: the arms that hang
 * beside the body, the backbone (vertebrae with cartilage between), ribs and breastbone, collarbones,
 * pelvis, skull, the legs, then each arm in front (what it hides cleared first). The hip's ball and
 * socket and the knee's hinge are marked in the joint tone. Bone is pale, so its outline is 3 px of
 * ink on the projector (§5).
 */
export function paintBones(ctx: CanvasRenderingContext2D, posed: Posed, look: Look, m: Frame) {
  const { bone, cartilage, joint } = BONES_TONE
  const edge = inkOf(bone, look)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const fill = (tone: string = bone) => {
    ctx.fillStyle = tone
    ctx.fill()
    ctx.strokeStyle = tone === bone ? edge : inkOf(tone, look)
    ctx.lineWidth = look.pale
    ctx.stroke()
  }
  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    ctx.beginPath()
    ctx.ellipse(m.X(x), m.Y(y), rx * m.scale, ry * m.scale, 0, 0, Math.PI * 2)
  }
  /** A rib as a band: three points, a smooth open curve, its outline then the bone inside it. */
  const band = (pts: readonly Pt[], width: number, tone: string = bone) => {
    const draw = () => {
      ctx.beginPath()
      ctx.moveTo(m.X(pts[0]![0]), m.Y(pts[0]![1]))
      if (pts.length === 3) ctx.quadraticCurveTo(m.X(pts[1]![0]), m.Y(pts[1]![1]), m.X(pts[2]![0]), m.Y(pts[2]![1]))
      else ctx.lineTo(m.X(pts[1]![0]), m.Y(pts[1]![1]))
    }
    draw()
    ctx.strokeStyle = tone === bone ? edge : inkOf(tone, look)
    ctx.lineWidth = width * m.scale + 2 * look.pale
    ctx.stroke()
    draw()
    ctx.strokeStyle = tone
    ctx.lineWidth = width * m.scale
    ctx.stroke()
  }

  const limb = (which: 'leg' | 'arm', side: 1 | -1) => {
    const { curve, radius } = limbOf(posed, which, side)
    for (const b of LONG_BONES)
      if (b.limb === which) {
        smoothPath(ctx, stretchOutline(curve, radius, { u0: b.u0, u1: b.u1, off: b.off, w: b.w }, side, false, 16), m)
        fill()
      }
    if (which === 'arm') {
      // The hand's bones, as one pale shape.
      smoothPath(ctx, stretchOutline(curve, radius, { u0: 0.86, u1: 0.98, off: 0, w: 0.55 }, side, true, 8), m)
      fill()
      return
    }
    // The thigh bone's head in the hip's socket: the ball-and-socket joint, ringed.
    const [hx, hy] = limbPoint(curve, radius, 0.02, -0.25, side)
    ellipse(hx, hy, 0.11, 0.11)
    fill()
    ellipse(hx, hy, 0.15, 0.15)
    ctx.strokeStyle = joint
    ctx.lineWidth = Math.max(2, 0.03 * m.scale)
    ctx.stroke()
    // The kneecap, the knee's hinge (a bar across the joint) and the foot.
    smoothPath(ctx, stretchOutline(curve, radius, { u0: KNEE_U - 0.012, u1: KNEE_U + 0.012, off: 0, w: 0.62 }, side, false, 2), m)
    fill(joint)
    const [kx, ky] = limbPoint(curve, radius, KNEE_U - 0.03, 0.05, side)
    ellipse(kx, ky, 0.07, 0.085)
    fill(cartilage)
    smoothPath(ctx, stretchOutline(curve, radius, { u0: 0.93, u1: 1, off: 0.05, w: 0.6 }, side, true, 8), m)
    fill()
  }

  const arms = posed.limbs.arms
  for (const a of arms) if (!a.front) limb('arm', a.side)

  // The backbone: a column of cartilage with the vertebrae over it, small at the neck, big low down.
  band(
    [
      [0, SPINE_Y[0]!],
      [0, SACRUM_TOP],
    ],
    0.08,
    cartilage,
  )
  for (let y = SPINE_Y[0]! - 0.04; y > SACRUM_TOP + 0.04; y -= 0.135) {
    const half = 0.05 + 0.05 * Math.min(1, (SPINE_Y[0]! - y) / 2.6)
    ctx.beginPath()
    ctx.roundRect(m.X(-half), m.Y(y), half * 2 * m.scale, 0.1 * m.scale, 0.02 * m.scale)
    fill()
  }

  // The ribs (each from beside the backbone round the side to the front), their cartilage to the
  // breastbone (the top seven; the next three to the cartilage above; the last two float).
  for (const s of [1, -1] as const)
    RIB_ROWS.forEach(([y, cage], i) => {
      const front: Pt = [s * cage * 0.62, y - 0.36]
      band(
        i >= 10
          ? [
              [s * 0.08, y - 0.02],
              [s * cage * 0.9, y - 0.14],
            ]
          : [[s * 0.08, y - 0.02], [s * cage * 0.86, y - 0.14], front],
        0.045,
      )
      if (i < 10) band([front, [s * 0.07, i < 7 ? Math.min(1.9, Math.max(1.0, y - 0.42)) : 0.98]], 0.03, cartilage)
    })
  polyPath(ctx, STERNUM, m)
  fill()
  for (const c of [COLLARBONE, mirrored(COLLARBONE)]) band([c[0]!, c[1]!, c[3]!], 0.05)

  // The pelvis (both hip bones) and the sacrum between them.
  for (const p of [PELVIS, mirrored(PELVIS)]) {
    smoothPath(ctx, p, m)
    fill()
  }
  polyPath(
    ctx,
    [
      [-0.16, SACRUM_TOP],
      [0.16, SACRUM_TOP],
      [0.04, -1.5],
      [-0.04, -1.5],
    ],
    m,
  )
  fill()

  // The skull: the braincase, the eye sockets and the jaw.
  ellipse(SKULL.center.x, SKULL.center.y, SKULL.rx, SKULL.ry)
  fill()
  smoothPath(ctx, SKULL.jaw, m)
  fill()
  for (const s of [1, -1]) {
    ellipse(s * SKULL.eye.x, SKULL.eye.y, SKULL.eye.rx, SKULL.eye.ry)
    ctx.fillStyle = edge
    ctx.fill()
  }

  limb('leg', 1)
  limb('leg', -1)
  posed.figure.over.forEach((pts, i) => {
    polyPath(ctx, pts, m)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill()
    ctx.restore()
    limb('arm', arms.filter((a) => a.front)[i]!.side)
  })
}

const LABEL_KEYS: readonly BonesLabel[] = ['skull', 'backbone', 'ribs', 'pelvis', 'ballSocket', 'hinge']
/** On a narrow picture, the skull and the two joints NCERT asks about (anatomy plan §6: the first three). */
const NARROW: readonly BonesLabel[] = ['skull', 'ballSocket', 'hinge']

/**
 * Bones' flat picture (U-1 card; anatomy plan §2.6, Drawing only): the skeleton over the base body in
 * the `full` framing, in the same still pose as Muscles, with the hip's ball and socket and the knee's
 * hinge marked. Nothing moves: bones don't change during one meal or one game (the card in the
 * graphs' place says so). Drawn again only when the size, the pose or the projector look changes;
 * a pose's edge is cross-faded over 300 ms (a cut with motion reduced).
 */
export default function BonesLayer({ view, band, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const posed = usePosed(band, kit)
  const main = useRef<HTMLCanvasElement>(null)
  const ghost = useRef<HTMLCanvasElement>(null)
  const look = projector ? LOOK.projector : LOOK.normal
  const m = frameOf(w, h, view)
  const shownPose = useRef('')

  useEffect(() => {
    const c = main.current
    if (!posed || !c || w === 0 || h === 0) return
    const pose = posed.limbs.band
    if (shownPose.current && shownPose.current !== pose && ghost.current) crossFade([c], ghost.current, reduced)
    shownPose.current = pose
    const ctx = sized(c, w, h)
    if (ctx) paintBones(ctx, posed, look, m)
  }, [posed, w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view; `band` comes with `posed`

  const roomy = w >= 460
  const specs = useMemo<CalloutSpec<BonesLabel>[]>(
    () =>
      LABEL_KEYS.map((key) => ({ key, text: t(`sys.effort.bones.label.${key}`), tone: 'stage', hidden: !roomy && !NARROW.includes(key) })),
    [t, roomy],
  )
  const table = useMemo(() => (posed ? posedLabels(LABELS, posed, { hinge: { limb: 'leg', side: 1, u: KNEE_U } }) : LABELS), [posed])
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), table)
  useEffect(() => void placeLabels())

  return (
    <div
      data-layer="bones"
      data-pose={posed?.limbs.band}
      data-outline={look.pale}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={main} aria-hidden="true" className="absolute top-0 left-0" />
      <canvas ref={ghost} aria-hidden="true" className="absolute top-0 left-0" style={{ opacity: 0 }} />
      {overlay}
    </div>
  )
}
