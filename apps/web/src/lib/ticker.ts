/**
 * The real clock (architecture §1.7, anatomy plan §4; U-2): one requestAnimationFrame loop for every
 * rhythm drawn at its true speed (a breath now, a heartbeat with U-3), at most 30 frames a second.
 * Numbers never come from here: a drawing reads its rate from the run at the meal-clock minute on
 * screen (`valueAt`) and only moves its phase on this clock (`phase += rate / 60 · dt`), so pausing
 * the meal clock keeps that minute's rate.
 *
 * The loop runs only while a drawing listens and the tab is visible. A drawing listens only while
 * its rhythm system is lit and motion is allowed: with motion reduced it stops listening and stands
 * still at its mid pose (reduced-motion rule). It is in the pack that needs it (a lazy chunk), never
 * in /sim, and imports nothing of the stage.
 */

/** One frame: the real seconds since the last one (0 on the first), and the frame's time (ms). */
export type Tick = (dtSec: number, nowMs: number) => void

/** What the ticker needs of the page, so a test can drive it with a fake clock. */
export interface TickerEnv {
  request: (frame: (nowMs: number) => void) => number
  cancel: (id: number) => void
  /** The tab is shown. */
  allowed: () => boolean
  /** Calls `onChange` when `allowed()` may have changed. */
  watch: (onChange: () => void) => void
}

/** The most frames a second the ticker runs at. */
export const MAX_FPS = 30
/** A frame later than this after the last (a busy phone, a tab coming back) moves a rhythm by this much at most. */
const MAX_DT_SEC = 0.25

export function createTicker(env: TickerEnv) {
  const ticks = new Set<Tick>()
  let id = 0
  let last = 0
  const frame = (now: number) => {
    id = env.request(frame)
    // At most MAX_FPS: a 60 or 120 Hz screen skips every other frame (2 ms of slack for timer jitter).
    if (last && now - last < 1000 / MAX_FPS - 2) return
    const dt = last ? Math.min((now - last) / 1000, MAX_DT_SEC) : 0
    last = now
    for (const tick of ticks) tick(dt, now)
  }
  const sync = () => {
    const run = ticks.size > 0 && env.allowed()
    if (run && !id) {
      last = 0
      id = env.request(frame)
    } else if (!run && id) {
      env.cancel(id)
      id = 0
    }
  }
  env.watch(sync)
  return {
    /** Calls `tick` on every frame while it is allowed; returns the unsubscribe function. */
    onTick(tick: Tick): () => void {
      ticks.add(tick)
      sync()
      return () => {
        ticks.delete(tick)
        sync()
      }
    },
    /** Whether the loop is running now (tests, the CPU check). */
    running: () => id !== 0,
  }
}

/** The page's ticker, made on first use (so importing this file touches no page API). */
let page: ReturnType<typeof createTicker> | null = null

/** Calls `tick` on every frame of the page's real clock while it is allowed; returns the unsubscribe function. */
export const onTick = (tick: Tick) =>
  (page ??= createTicker({
    request: (f) => requestAnimationFrame(f),
    cancel: (id) => cancelAnimationFrame(id),
    allowed: () => document.visibilityState === 'visible',
    watch: (onChange) => document.addEventListener('visibilitychange', onChange),
  })).onTick(tick)
