import { describe, expect, it } from 'vitest'
import { COUNT_S, EXAMPLES, READY_S, TIMES, spokenAt, stepAt, type CountStep } from './countTimer.ts'

describe('"Count yours" timer (X-2, ui-ux §8.2)', () => {
  it('3, 2, 1, then 15 seconds, then done; a count times 4 is a minute', () => {
    expect([READY_S, COUNT_S, TIMES]).toEqual([3, 15, 4])
    expect(stepAt(0)).toEqual({ phase: 'ready', n: 3 })
    expect(stepAt(1500)).toEqual({ phase: 'ready', n: 2 })
    expect(stepAt(2999)).toEqual({ phase: 'ready', n: 1 })
    expect(stepAt(3000)).toMatchObject({ phase: 'run', left: 15, part: 1 })
    expect(stepAt(3001)).toMatchObject({ phase: 'run', left: 15 })
    expect(stepAt(4000)).toMatchObject({ phase: 'run', left: 14 })
    expect(stepAt(17_999)).toMatchObject({ phase: 'run', left: 1 })
    expect(stepAt(18_000)).toEqual({ phase: 'done' })
    expect(stepAt(60_000)).toEqual({ phase: 'done' })
  })

  it('a screen reader hears the start, 10 and 5 seconds left, and the end, each once', () => {
    const heard: (string | number)[] = []
    let before: CountStep | null = null
    for (let ms = 0; ms <= 20_000; ms += 100) {
      const now = stepAt(ms)
      const said = spokenAt(before, now)
      if (said !== null) heard.push(said)
      before = now
    }
    expect(heard).toEqual(['started', 10, 5, 'done'])
  })

  it('the worked examples multiply by 4 (5 breaths in 15 s = 20 a minute)', () => {
    expect(EXAMPLES.breaths.map((n) => n * TIMES)).toEqual([16, 20, 24])
    expect(EXAMPLES.pulse.map((n) => n * TIMES)).toEqual([60, 72, 80])
  })
})
