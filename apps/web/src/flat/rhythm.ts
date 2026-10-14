import { useMotion } from '../state/motion.ts'

/**
 * The rhythm layer (anatomy plan §2.0, §4): how a flat drawing shows a beat or a breath. The
 * moving organ is painted once into a small canvas of its own, on its own compositor layer
 * (`will-change: transform`), and each frame only its CSS `transform` changes: a size, never a
 * colour. The page is not repainted and the organ's pixels are not redrawn (the perf-probe result:
 * a transform on its own layer costs the main thread almost nothing).
 *
 * Flash safety (WCAG 2.3.1): rhythms change size only, at most 2.5 times a second as drawn (150 a
 * minute); a faster rate is drawn at 2.5 Hz and says "animation slowed" while the number stays
 * true. With motion reduced the organ stands still at mid-phase. The cap and the reduced-motion
 * still are enforced inside the layer (R93 #14): it is given the rate and the real clock, never a
 * phase, so no caller can draw faster than 2.5 Hz or move a reduced-motion picture.
 * The ticker (lib/ticker.ts, U-2) calls it on the real clock, ≤ 30 fps.
 */

/** The fastest rhythm drawn, in cycles per second (150 a minute). */
export const MAX_DRAWN_HZ = 2.5
/** The fastest breath drawn (48 a minute; ui-ux §4, architecture §1.7): a run's 33 a minute is 0.55 Hz. */
export const MAX_BREATH_HZ = 0.8

/** The phase a still (reduced motion) rhythm is drawn at: mid-way, as the plan's still frames are. */
export const STILL_PHASE = 0.5

/**
 * How fast a rhythm of `perMin` (beats or breaths a minute, from the run) is drawn: its rate in
 * Hz, capped at `max` (MAX_DRAWN_HZ; breaths MAX_BREATH_HZ), and whether it was slowed (the chip
 * then says "animation slowed").
 */
export function drawnRate(perMin: number, max = MAX_DRAWN_HZ): { hz: number; slowed: boolean } {
  // No number (a missing signal, NaN, ∞) draws nothing moving rather than a wild rate.
  if (!Number.isFinite(perMin)) return { hz: 0, slowed: false }
  const hz = Math.max(0, perMin) / 60
  return hz > max ? { hz: max, slowed: true } : { hz, slowed: false }
}

/**
 * The size of a rhythm element at `phase` (0…1, one cycle): 1 at the start of the cycle, 1 +
 * `amplitude` at its middle, a smooth (cosine) swell. Size only.
 */
export const rhythmScale = (phase: number, amplitude: number): number => 1 + amplitude * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase))

/** What a rhythm layer needs of its element: a style it can write a transform to. */
interface Styled {
  style: { transform: string; transformOrigin: string; willChange: string }
}

/**
 * A rhythm layer over the picture. `el` is its own small canvas, already painted with the organ;
 * `origin` is the point (CSS px, within the canvas) the organ grows from. `tick(perMin, nowMs)`
 * moves the cycle on by the real time since the last tick at the drawn (capped) rate and writes one
 * transform, only when the scale changed by a drawn amount; with motion reduced (`reduced`, the
 * app's setting by default) it writes the mid-phase still instead. `still()` puts it at mid-phase.
 * `max`: a lower cap (breaths: MAX_BREATH_HZ); never above MAX_DRAWN_HZ.
 */
export function rhythmLayer(
  el: Styled,
  origin: readonly [number, number],
  amplitude: number,
  { max = MAX_DRAWN_HZ, reduced = () => useMotion.getState().reduced }: { max?: number; reduced?: () => boolean } = {},
) {
  el.style.willChange = 'transform'
  el.style.transformOrigin = `${origin[0]}px ${origin[1]}px`
  let shown = ''
  const write = (scale: number) => {
    // Three decimals: under a thousandth of the organ's size is not a change anyone sees.
    const t = `scale(${scale.toFixed(3)})`
    if (t !== shown) el.style.transform = shown = t
  }
  const still = () => write(rhythmScale(STILL_PHASE, amplitude))
  let phase = 0
  let last = NaN
  return {
    /**
     * Draws the rhythm of `perMin` (beats or breaths a minute) at real time `nowMs`, at most
     * `max`; returns whether it was slowed (the chip then says "animation slowed").
     */
    tick(perMin: number, nowMs: number): boolean {
      const { hz, slowed } = drawnRate(perMin, Math.min(max, MAX_DRAWN_HZ))
      const dt = Number.isFinite(last) && Number.isFinite(nowMs) ? Math.max(0, nowMs - last) / 1000 : 0
      if (Number.isFinite(nowMs)) last = nowMs
      if (reduced()) still()
      else {
        phase = (phase + hz * dt) % 1
        write(rhythmScale(phase, amplitude))
      }
      return slowed
    },
    /** Reduced motion: the still, mid-phase pose. */
    still,
  }
}
