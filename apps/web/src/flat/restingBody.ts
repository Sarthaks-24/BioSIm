import { simulate } from '@lifepeek/engine/run'
import { bodyStateAt } from '../anatomy/bodyState.ts'
import { VIEW, frame, paintStill, paintStomach } from './FlatBody.tsx'

/**
 * The picture on Home (R15, T9b): the stage's flat body at rest (no meal, as /sim draws it before a
 * food is picked), as an SVG file. It is drawn by FlatBody's own painters into a small recorder that
 * writes SVG instead of pixels, so it is the same drawing, not new art. Written to
 * src/assets/resting-body.svg by scripts/build-resting-body.ts; restingBody.test.ts fails when that
 * file no longer matches what FlatBody draws. Home only links the file: it never runs this code,
 * the model or the anatomy curves.
 */

/** The picture's size in CSS px (scale 100 px per scene unit); the SVG scales from it. */
export const RESTING_W = Math.round((VIEW.maxX - VIEW.minX) * 100)
export const RESTING_H = Math.round((VIEW.maxY - VIEW.minY) * 100)

const n = (v: number) => {
  const r = Math.round(v * 10) / 10
  return Object.is(r, -0) ? '0' : String(r)
}

/** The few Canvas 2D calls FlatBody's still layer and stomach make, recorded as SVG paths. */
class SvgRecorder {
  fillStyle = '#000'
  strokeStyle = '#000'
  lineWidth = 1
  lineJoin: CanvasLineJoin = 'miter'
  lineCap: CanvasLineCap = 'butt'
  readonly out: string[] = []
  private d: string[] = []
  private last = ''

  clearRect() {}
  setTransform() {}
  beginPath() {
    this.d = []
    this.last = ''
  }
  private point(cmd: 'M' | 'L', x: number, y: number) {
    const p = `${n(x)} ${n(y)}`
    // A run of samples that round to the same point draws nothing more.
    if (cmd === 'L' && p === this.last) return
    this.d.push(`${cmd}${p}`)
    this.last = p
  }
  moveTo(x: number, y: number) {
    this.point('M', x, y)
  }
  lineTo(x: number, y: number) {
    this.point('L', x, y)
  }
  closePath() {
    this.d.push('Z')
  }
  /** Whole ellipses only (all FlatBody draws): two half arcs. */
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number) {
    const c = Math.cos(rotation)
    const s = Math.sin(rotation)
    const deg = n((rotation * 180) / Math.PI)
    const a = `A${n(rx)} ${n(ry)} ${deg} 1 1`
    this.d.push(`M${n(x + rx * c)} ${n(y + rx * s)}${a} ${n(x - rx * c)} ${n(y - rx * s)}${a} ${n(x + rx * c)} ${n(y + rx * s)}Z`)
    this.last = ''
  }
  arc(x: number, y: number, r: number) {
    this.ellipse(x, y, r, r, 0)
  }
  fill() {
    this.out.push(`<path d="${this.d.join('')}" fill="${this.fillStyle}"/>`)
  }
  stroke() {
    const d = this.d.join('')
    const attrs = `fill="none" stroke="${this.strokeStyle}" stroke-width="${n(this.lineWidth)}" stroke-linejoin="${this.lineJoin}" stroke-linecap="${this.lineCap}"`
    // A fill and then a stroke of the same path: one element.
    const prev = this.out.at(-1)
    const filled = `<path d="${d}" fill="`
    if (prev?.startsWith(filled) && prev.endsWith('"/>') && !prev.includes('stroke=')) {
      this.out[this.out.length - 1] = `${prev.slice(0, -2)} ${attrs.replace('fill="none" ', '')}/>`
      return
    }
    this.out.push(`<path d="${d}" ${attrs}/>`)
  }
}

/** The resting body as an SVG document (FlatBody's normal look: the stage's, not the projector's). */
export function restingBodySvg(): string {
  const w = RESTING_W
  const h = RESTING_H
  const state = bodyStateAt(simulate({ items: [] }, { lookup: () => undefined, particles: 0 }), 0)
  const rec = new SvgRecorder()
  const ctx = rec as unknown as CanvasRenderingContext2D
  paintStill(ctx, w, h, state)
  const { scale, X, Y } = frame(w, h)
  paintStomach(ctx, X, Y, scale, state)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    '<!-- Written by scripts/build-resting-body.ts from src/flat/FlatBody.tsx; do not edit. -->',
    ...rec.out,
    '</svg>',
    '',
  ].join('\n')
}
