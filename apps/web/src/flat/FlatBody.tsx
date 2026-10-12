import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Vector3, type Curve } from 'three'
import { activeStage, type NutrientKind, type Simulation, type StageId } from '@biosim/engine'
import { useSim } from '../state/sim.ts'
import {
  ESOPHAGUS,
  LARGE_INTESTINE,
  PHARYNX,
  SMALL_INTESTINE,
  STAGE_LABEL_ANCHOR,
  STOMACH,
  TORSO_PROFILE,
  particlePosition,
  stomachRadius,
} from '../anatomy/anatomy.ts'
import { INK, NUTRIENT_COLOR, ORGAN_COLOR } from '../lib/colors.ts'

/**
 * Flat diagram for devices without WebGL. Uses the same anatomy curves and particle maths as
 * the 3D view, drawn front-on with Canvas 2D.
 */

/** Liver outline: tall right lobe (viewer's left) tapering to a thin left lobe over the stomach. */
const LIVER_OUTLINE: [number, number][] = [
  [-0.8, 1.05],
  [-0.62, 1.24],
  [-0.3, 1.28],
  [0.05, 1.2],
  [0.38, 1.1],
  [0.58, 1.02],
  [0.4, 0.96],
  [0.1, 0.92],
  [-0.2, 0.78],
  [-0.5, 0.56],
  [-0.72, 0.6],
]
const VIEW = { minX: -1.45, maxX: 1.45, minY: -1.9, maxY: 3.25 }

export default function FlatBody({ sim, label }: { sim: Simulation; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => paint(canvas, sim, useSim.getState().time, (s) => t(`stages.${s}.short`))
    draw()
    const unsub = useSim.subscribe((s, prev) => s.time !== prev.time && draw())
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => {
      unsub()
      ro.disconnect()
    }
  }, [sim, t])

  return <canvas ref={ref} role="img" aria-label={label} className="block h-full w-full" />
}

function paint(canvas: HTMLCanvasElement, sim: Simulation, time: number, stageName: (s: StageId) => string) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { clientWidth: w, clientHeight: h } = canvas
  if (w === 0 || h === 0) return
  // Reallocating the canvas every frame is slow on exactly the devices this fallback is for.
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const scale = Math.min(w / (VIEW.maxX - VIEW.minX), h / (VIEW.maxY - VIEW.minY))
  const ox = w / 2
  const oy = h / 2 + ((VIEW.maxY + VIEW.minY) / 2) * scale
  const X = (x: number) => ox + x * scale
  const Y = (y: number) => oy - y * scale

  // Body outline
  ctx.strokeStyle = 'rgba(70,83,110,0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  TORSO_PROFILE.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
  for (let i = TORSO_PROFILE.length - 1; i >= 0; i--) ctx.lineTo(X(-TORSO_PROFILE[i]![0]), Y(TORSO_PROFILE[i]![1]))
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(X(0), Y(2.84), 0.31 * scale, 0.39 * scale, 0, 0, Math.PI * 2)
  ctx.stroke()
  for (const sgn of [-1, 1]) {
    ctx.beginPath()
    ctx.roundRect(X(sgn * 1.17) - 0.17 * scale, Y(1.95), 0.34 * scale, 1.9 * scale, 0.17 * scale)
    ctx.stroke()
  }

  // Liver for context (not on the food's path).
  ctx.beginPath()
  LIVER_OUTLINE.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
  ctx.closePath()
  ctx.fillStyle = 'rgba(123,45,42,0.28)'
  ctx.fill()

  const stage = activeStage(sim, time)
  const p = new Vector3()
  const strokeCurve = (curve: Curve<Vector3>, width: number, s: StageId, samples = 120) => {
    ctx.beginPath()
    for (let i = 0; i <= samples; i++) {
      curve.getPointAt(i / samples, p)
      if (i === 0) ctx.moveTo(X(p.x), Y(p.y))
      else ctx.lineTo(X(p.x), Y(p.y))
    }
    ctx.strokeStyle = ORGAN_COLOR[s]
    ctx.globalAlpha = s === stage ? 0.75 : 0.4
    ctx.lineWidth = width * scale
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  strokeCurve(PHARYNX, 0.09, 'esophagus', 12)
  strokeCurve(ESOPHAGUS, 0.08, 'esophagus')
  strokeCurve(LARGE_INTESTINE, 0.16, 'largeIntestine')
  strokeCurve(SMALL_INTESTINE, 0.08, 'smallIntestine', 900)

  // Stomach: filled outline built from the radius function.
  const left: [number, number][] = []
  const right: [number, number][] = []
  const tangent = new Vector3()
  for (let i = 0; i <= 60; i++) {
    const u = i / 60
    STOMACH.getPointAt(u, p)
    STOMACH.getTangentAt(u, tangent)
    const r = stomachRadius(u)
    left.push([p.x - tangent.y * r, p.y + tangent.x * r])
    right.push([p.x + tangent.y * r, p.y - tangent.x * r])
  }
  ctx.beginPath()
  ;[...left, ...right.reverse()].forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
  ctx.closePath()
  ctx.fillStyle = ORGAN_COLOR.stomach
  ctx.globalAlpha = stage === 'stomach' ? 0.6 : 0.32
  ctx.fill()
  ctx.globalAlpha = 1

  // Particles
  for (const part of sim.particles) {
    const s = particlePosition(part, time, p)
    if (s <= 0) continue
    drawShape(ctx, part.kind, X(p.x), Y(p.y), Math.max(3.5, 0.055 * scale) * s)
  }

  // Active stage label
  const anchor = STAGE_LABEL_ANCHOR[stage]
  const text = stageName(stage)
  ctx.font = '600 12px "Atkinson Hyperlegible Next", "Noto Sans Devanagari", sans-serif'
  const tw = ctx.measureText(text).width
  const lx = Math.min(Math.max(X(anchor.x), tw / 2 + 6), w - tw / 2 - 6)
  const ly = Y(anchor.y)
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.roundRect(lx - tw / 2 - 6, ly - 10, tw + 12, 20, 10)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, lx, ly + 1)
}

function drawShape(ctx: CanvasRenderingContext2D, kind: NutrientKind, x: number, y: number, r: number) {
  ctx.fillStyle = NUTRIENT_COLOR[kind]
  ctx.beginPath()
  switch (kind) {
    case 'carbs':
      ctx.arc(x, y, r, 0, Math.PI * 2)
      break
    case 'protein':
      ctx.rect(x - r, y - r, r * 2, r * 2)
      break
    case 'fat':
      ctx.moveTo(x, y - r * 1.2)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x, y + r * 1.2)
      ctx.lineTo(x - r, y)
      break
    case 'fiber':
      ctx.rect(x - r * 0.35, y - r * 1.4, r * 0.7, r * 2.8)
      break
    case 'water':
      ctx.globalAlpha = 0.7
      ctx.arc(x, y, r * 0.65, 0, Math.PI * 2)
      break
  }
  ctx.fill()
  // White outline keeps particles visible against the pink tissue, especially on projectors.
  ctx.globalAlpha = 1
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
}
