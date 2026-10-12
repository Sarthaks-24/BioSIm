import { useEffect } from 'react'
import { useSim } from '../state/sim.ts'
import { HORIZON_MIN } from '../lib/time.ts'

/** Advances simulated time while playing. One clock drives every view, so A and B stay in sync. */
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
      const { time, speed } = useSim.getState()
      const next = time + speed * dt
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
