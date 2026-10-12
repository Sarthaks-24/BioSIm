import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_FRAME_SEC, startMealClock, useClock, type FrameSource } from './clock.ts'
import { DEFAULT_PACE, HORIZON_MIN, KNEE_MIN, timeToPos } from '../lib/time.ts'

const initial = useClock.getState()
beforeEach(() => useClock.setState(initial, true))

const clock = () => useClock.getState()

/** A hand-cranked requestAnimationFrame: frames run only when the test calls `frame(ms)`. */
function fakeFrames() {
  let next = 1
  const pending = new Map<number, (now: number) => void>()
  let requested = 0
  const source: FrameSource = {
    request: (cb) => {
      requested++
      pending.set(next, cb)
      return next++
    },
    cancel: (id) => void pending.delete(id),
  }
  let now = 0
  return {
    source,
    /** Runs the frames waiting now, `ms` after the previous one. */
    frame(ms = 1000 / 30) {
      now += ms
      const due = [...pending.values()]
      pending.clear()
      for (const cb of due) cb(now)
    },
    get waiting() {
      return pending.size
    },
    get requested() {
      return requested
    },
  }
}

describe('meal clock: moving it by hand', () => {
  it('starts paused at 0 and never plays by itself', () => {
    expect(clock().simMin).toBe(0)
    expect(clock().playing).toBe(false)
    expect(clock().pace).toBe(DEFAULT_PACE)
  })

  it('clamps setSimMin to the bar', () => {
    clock().setSimMin(-30)
    expect(clock().simMin).toBe(0)
    clock().setSimMin(HORIZON_MIN + 500)
    expect(clock().simMin).toBe(HORIZON_MIN)
    clock().setSimMin(Number.NaN)
    expect(clock().simMin).toBe(0)
  })

  it('steps by ± minutes, clamped, and pauses', () => {
    clock().play()
    clock().step(10)
    expect(clock().simMin).toBe(10)
    expect(clock().playing).toBe(false)
    clock().step(-60)
    expect(clock().simMin).toBe(0)
    clock().setSimMin(HORIZON_MIN - 5)
    clock().step(60)
    expect(clock().simMin).toBe(HORIZON_MIN)
  })

  it('steps to the next and previous key moment', () => {
    clock().setMoments([240, null, 35, 1500, 35, undefined, HORIZON_MIN + 100])
    expect(clock().moments).toEqual([35, 240, 1500, HORIZON_MIN])

    clock().stepToMoment(1)
    expect(clock().simMin).toBe(35)
    clock().stepToMoment(1)
    expect(clock().simMin).toBe(240)
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(35)
    // Before the first moment, "previous" goes back to the start.
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(0)

    // Between two moments.
    clock().setSimMin(1000)
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(240)

    // Past the last one, "next" stays put.
    clock().setSimMin(HORIZON_MIN)
    clock().stepToMoment(1)
    expect(clock().simMin).toBe(HORIZON_MIN)
  })

  it('stepping to a moment pauses', () => {
    clock().setMoments([60])
    clock().play()
    clock().stepToMoment(1)
    expect(clock()).toMatchObject({ simMin: 60, playing: false })
  })

  it('with no moments, next stays and previous goes to 0', () => {
    clock().setSimMin(100)
    clock().stepToMoment(1)
    expect(clock().simMin).toBe(100)
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(0)
  })
})

describe('meal clock: play and pause', () => {
  it('toggle plays and pauses', () => {
    clock().toggle()
    expect(clock().playing).toBe(true)
    clock().toggle()
    expect(clock().playing).toBe(false)
  })

  it('play at 48 h restarts from 0', () => {
    clock().setSimMin(HORIZON_MIN)
    clock().play()
    expect(clock()).toMatchObject({ simMin: 0, playing: true })
    // Play elsewhere keeps the time.
    clock().pause()
    clock().setSimMin(300)
    clock().toggle()
    expect(clock()).toMatchObject({ simMin: 300, playing: true })
  })

  it('advances at a steady speed along the bar (same knee as v1)', () => {
    clock().setPace(60)
    clock().play()
    // 0.1 s of 60 s for the whole bar = 1/600 of the bar.
    clock().advance(0.1)
    expect(timeToPos(clock().simMin)).toBeCloseTo(1 / 600, 9)
    // The first 6 hours are 60 % of the bar, so 36 s of play.
    clock().setSimMin(0)
    for (let i = 0; i < 360; i++) clock().advance(0.1)
    expect(clock().simMin).toBeCloseTo(KNEE_MIN, 6)
  })

  it('a long frame (tab in the background) advances at most one short step', () => {
    clock().play()
    clock().advance(30)
    expect(timeToPos(clock().simMin)).toBeCloseTo(MAX_FRAME_SEC / DEFAULT_PACE, 9)
  })

  it('does not advance while paused', () => {
    clock().setSimMin(50)
    clock().advance(0.1)
    expect(clock().simMin).toBe(50)
  })

  it('stops at the end of the bar', () => {
    clock().setSimMin(HORIZON_MIN - 1)
    clock().play()
    for (let i = 0; i < 10; i++) clock().advance(0.1)
    expect(clock()).toMatchObject({ simMin: HORIZON_MIN, playing: false })
  })
})

describe('meal clock: playback loop', () => {
  it('asks for no frames while paused', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    expect(frames.requested).toBe(0)
    clock().setSimMin(200)
    clock().step(10)
    expect(frames.requested).toBe(0)
    stop()
  })

  it('moves only after Play, one frame at a time, and stops asking for frames on pause', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().play()
    expect(frames.waiting).toBe(1)
    // The first frame only notes the start time: pressing Play never jumps.
    frames.frame()
    expect(clock().simMin).toBe(0)
    for (let i = 0; i < 30; i++) frames.frame(1000 / 30)
    // About 1 s of a 60 s bar.
    expect(timeToPos(clock().simMin)).toBeCloseTo(1 / 60, 6)

    clock().pause()
    expect(frames.waiting).toBe(0)
    const at = clock().simMin
    const before = frames.requested
    for (let i = 0; i < 10; i++) frames.frame()
    expect(frames.requested).toBe(before)
    expect(clock().simMin).toBe(at)
    stop()
  })

  it('stops asking for frames when it reaches the end', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().setSimMin(HORIZON_MIN - 1)
    clock().play()
    for (let i = 0; i < 20; i++) frames.frame(100)
    expect(clock()).toMatchObject({ simMin: HORIZON_MIN, playing: false })
    expect(frames.waiting).toBe(0)
    stop()
  })

  it('the stop function ends the loop and the subscription', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().play()
    stop()
    expect(frames.waiting).toBe(0)
    clock().pause()
    clock().play()
    expect(frames.waiting).toBe(0)
  })

  it('per-frame readers subscribe to simMin without a React render', () => {
    const seen: number[] = []
    const unsubscribe = useClock.subscribe(
      (s) => s.simMin,
      (min) => seen.push(min),
    )
    clock().setSimMin(5)
    clock().setSimMin(5)
    clock().pause()
    clock().setSimMin(6)
    unsubscribe()
    expect(seen).toEqual([5, 6])
  })
})
