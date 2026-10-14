/**
 * "Count yours" (X-2; ui-ux §8.2): the timer's steps, from the real time since Start was pressed
 * (`performance.now()`), so a slow phone or a hidden tab never stretches the 15 seconds. Only a
 * timer: nothing here takes, keeps or sends a count (R14).
 */

/** The "3, 2, 1" before counting starts (s). */
export const READY_S = 3
/** The counting time (s): the count times 4 is a minute. */
export const COUNT_S = 15
/** A count in 15 seconds times this is a minute. */
export const TIMES = 60 / COUNT_S

export type CountStep =
  | { phase: 'ready'; n: number }
  /** `left`: the whole seconds left (15 … 1); `part`: how much of the 15 s is left (1 … 0). */
  | { phase: 'run'; left: number; part: number }
  | { phase: 'done' }

/** Where the timer is `ms` after Start was pressed. */
export function stepAt(ms: number): CountStep {
  const s = Math.max(0, ms) / 1000
  if (s < READY_S) return { phase: 'ready', n: READY_S - Math.floor(s) }
  const into = s - READY_S
  if (into >= COUNT_S) return { phase: 'done' }
  return { phase: 'run', left: Math.ceil(COUNT_S - into - 1e-9), part: 1 - into / COUNT_S }
}

/**
 * What a screen reader hears as the timer moves from `before` to `now` (ui-ux §8.2, content §8.3):
 * the start, every 5 seconds (10 and 5 left), the end. Null: nothing new to say.
 */
export function spokenAt(before: CountStep | null, now: CountStep): 'started' | 'done' | number | null {
  if (now.phase === 'done') return before?.phase === 'done' ? null : 'done'
  if (now.phase !== 'run') return null
  if (before?.phase !== 'run') return 'started'
  if (now.left !== before.left && now.left % 5 === 0) return now.left
  return null
}

/** The worked examples beside the timer: a count in 15 s and its minute (content §8.3). */
export const EXAMPLES = { breaths: [4, 5, 6], pulse: [15, 18, 20] } as const
