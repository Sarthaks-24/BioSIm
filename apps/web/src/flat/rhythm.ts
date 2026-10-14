/**
 * The rhythm layer (anatomy plan §2.0, §4): how a flat drawing shows a beat or a breath. The
 * moving organ is painted once into a small canvas of its own, on its own compositor layer
 * (`will-change: transform`), and each frame only its CSS `transform` changes: a size, never a
 * colour. The page is not repainted and the organ's pixels are not redrawn (the perf-probe result:
 * a transform on its own layer costs the main thread almost nothing).
 *
 * Flash safety (WCAG 2.3.1): rhythms change size only, at most 2.5 times a second as drawn (150 a
 * minute); a faster rate is drawn at 2.5 Hz and says "animation slowed" while the number stays
 * true. With motion reduced there is no ticker: the organ stands still at mid-phase.
 * The ticker (lib/ticker.ts, U-2) gives the phase on the real clock, ≤ 30 fps.
 */

/** The fastest rhythm drawn, in cycles per second (150 a minute). */
export const MAX_DRAWN_HZ = 2.5

/** The phase a still (reduced motion) rhythm is drawn at: mid-way, as the plan's still frames are. */
export const STILL_PHASE = 0.5

/**
 * How fast a rhythm of `perMin` (beats or breaths a minute, from the run) is drawn: its rate in
 * Hz, capped at MAX_DRAWN_HZ, and whether it was slowed (the chip then says "animation slowed").
 */
export function drawnRate(perMin: number): { hz: number; slowed: boolean } {
  const hz = Math.max(0, perMin) / 60
  return hz > MAX_DRAWN_HZ ? { hz: MAX_DRAWN_HZ, slowed: true } : { hz, slowed: false }
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
 * `origin` is the point (CSS px, within the canvas) the organ grows from. `set(scale)` writes one
 * transform, and only when the scale changed by a drawn amount; `still()` puts it at mid-phase.
 */
export function rhythmLayer(el: Styled, origin: readonly [number, number], amplitude: number) {
  el.style.willChange = 'transform'
  el.style.transformOrigin = `${origin[0]}px ${origin[1]}px`
  let shown = ''
  const write = (scale: number) => {
    // Three decimals: under a thousandth of the organ's size is not a change anyone sees.
    const t = `scale(${scale.toFixed(3)})`
    if (t !== shown) el.style.transform = shown = t
  }
  return {
    /** Draws the organ at this phase of its cycle (0…1). */
    set: (phase: number) => write(rhythmScale(phase, amplitude)),
    /** Reduced motion: the still, mid-phase pose. */
    still: () => write(rhythmScale(STILL_PHASE, amplitude)),
  }
}
