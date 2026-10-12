import { useEffect, useRef, type RefObject } from 'react'
import { valueAt, type Series } from '@lifepeek/engine'
import { useClock } from '../../state/clock.ts'
import { xAt, yAt, type Domain } from '../../lib/axis.ts'

/** Readouts change at about 10 Hz while playing (plan-graphs §3.10): faster is unreadable and costs layout. */
const READOUT_MS = 100

interface Props {
  width: number
  height: number
  domain: Domain
  run: Pick<Series, 'values'>
  kept: Pick<Series, 'values'> | null
  /** A second line on the same axis (energy used), if the graph has one. */
  second?: Pick<Series, 'values'> | null
  /** Writes the values at `min` into the strip's readouts (text only). */
  readout: (min: number, run: number, kept: number | null) => void
}

/**
 * "Now" on one graph (G2): a vertical line at the meal clock's time, with a dot on each run's
 * line. It is ONE element moved with `transform` straight from the clock store
 * (`useClock.subscribe`), never through React state, so playing re-renders nothing and causes no
 * layout; the readouts are text written at ~10 Hz. Same x scale as the dock thumb (lib/axis.ts).
 */
export default function Playhead({ width, height, domain, run, kept, second = null, readout }: Props) {
  const head = useRef<HTMLDivElement>(null)
  const runDot = useRef<HTMLSpanElement>(null)
  const keptDot = useRef<HTMLSpanElement>(null)
  const secondDot = useRef<HTMLSpanElement>(null)
  // The latest readout writer, so a new function each render doesn't restart the subscription.
  const write = useRef(readout)
  write.current = readout

  useEffect(() => {
    let lastText = -Infinity
    const draw = (min: number) => {
      const r = valueAt(run, min)
      const k = kept ? valueAt(kept, min) : null
      if (width > 0) {
        head.current!.style.transform = `translateX(${xAt(min, width).toFixed(1)}px)`
        place(runDot, yAt(r, domain, height))
        if (k !== null) place(keptDot, yAt(k, domain, height))
        if (second) place(secondDot, yAt(valueAt(second, min), domain, height))
      }
      const now = performance.now()
      if (now - lastText >= READOUT_MS || !useClock.getState().playing) {
        lastText = now
        write.current(min, r, k)
      }
    }
    draw(useClock.getState().simMin)
    const offTime = useClock.subscribe((s) => s.simMin, draw)
    // On pause, write the exact values for where the clock stopped.
    const offPlay = useClock.subscribe(
      (s) => s.playing,
      (playing) => playing || draw(useClock.getState().simMin),
    )
    return () => {
      offTime()
      offPlay()
    }
  }, [width, height, domain, run, kept, second])

  return (
    <div
      ref={head}
      data-playhead=""
      aria-hidden="true"
      // A 2 px ink line centred on x (hence the -1 px); its dots hang off it.
      className="pointer-events-none absolute inset-y-0 -left-px w-0.5 bg-ink will-change-transform"
    >
      {kept && <span ref={keptDot} className="absolute top-0 left-1/2 size-2.5 rounded-full border-2 border-kept bg-shelf" />}
      {second && <span ref={secondDot} className="absolute top-0 left-1/2 size-3 rounded-full border-2 border-shelf bg-energy-used" />}
      <span ref={runDot} className="absolute top-0 left-1/2 size-3 rounded-full border-2 border-shelf bg-run" />
    </div>
  )
}

/** Centres a dot on y, with transform only (nothing is measured, so no layout is forced). */
function place(dot: RefObject<HTMLSpanElement | null>, y: number) {
  if (dot.current) dot.current.style.transform = `translate(-50%, calc(${y.toFixed(1)}px - 50%))`
}
