import { useEffect } from 'react'
import { useSim } from '../state/sim.ts'
import { HORIZON_MIN, posToTime, timeToPos } from '../lib/time.ts'

/**
 * Advances simulated time while playing. One clock drives every view, so A and B stay in sync.
 * It moves along the timeline BAR at a steady pace, so the busy first hours (stomach, blood
 * sugar) get as much screen time as their share of the bar instead of flashing past.
 */
export function useClock() {
  const playing = useSim((s) => s.playing)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Clamp the step so a backgrounded tab doesn't jump hours when it comes back.
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { time, pace } = useSim.getState()
      const next = posToTime(timeToPos(time) + dt / pace)
      if (next >= HORIZON_MIN) {
        useSim.setState({ time: HORIZON_MIN, playing: false })
        return
      }
      useSim.setState({ time: next })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
}
