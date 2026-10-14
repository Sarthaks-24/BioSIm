import { brainRoute, nerveTimeline, reflexTime, type NerveLeg, type NerveTiming } from '@lifepeek/engine/demo'

/**
 * The nerve demo's numbers and paths (U-7; model §2.6, anatomy plan §2.8), pure, so nerves.test.ts
 * checks them without a browser. Every number comes from the engine's `reflexTime` (V-7's read
 * values, R92); nothing here is a new claim. Time is the model's: real milliseconds of the signal.
 *
 * The hot pan is run twice, side by side, on one slowed-down clock: the reflex (in on a thin
 * myelinated Aδ fibre, two synapses in the spinal cord, out on a thick myelinated Aα motor fibre)
 * and the route through the brain (the same legs plus thinking time). The longer of the two plays
 * over `PLAY_MS` (model §2.6: each scenario over 5–10 s), so the brain route's ≈ 3× shows as ≈ 3×
 * the time on screen. "Myelin off" (Beyond class 10) runs every leg as slow as a C fibre.
 */

/** Real ms on screen for the longer route (model §2.6: 5–10 s). */
export const PLAY_MS = 9000

/** One run of the demo: both routes' timings, and how many times slower than real life it plays. */
export interface Race {
  reflex: NerveTiming
  brain: NerveTiming
  /** Screen ms per model ms: the longer route takes PLAY_MS. */
  slow: number
}

/** The hot pan, with myelin (the fibres' own speeds) or without it (every leg a C fibre: the what-if). */
export function race(myelinOff: boolean): Race {
  const myelin = myelinOff ? 0 : 1
  const reflex = reflexTime('hotPan', { myelin })
  const brain = brainRoute('hotPan', { myelin })
  return { reflex, brain, slow: PLAY_MS / Math.max(reflex.totalMs, brain.totalMs) }
}

/** The whole ms a route's counter shows at model time `t`: the time so far, never past its total (counter = reflexTime ± 1 ms). */
export const counterMs = (timing: NerveTiming, t: number): number => Math.round(Math.min(Math.max(t, 0), timing.totalMs))

/** The steps shown with motion reduced (anatomy plan §4: 3–4 still frames with the numbers), in order. */
export type StepKey = 'start' | 'cord' | 'reflex' | 'brain'

/**
 * The still frames, at model times: the touch, the signal at the spinal cord (the relay neuron is
 * the next millisecond), the reflex at the muscle (the hand pulls back), the command through the
 * brain at the muscle.
 */
export function steps({ reflex, brain }: Race): { key: StepKey; t: number }[] {
  const legs = nerveTimeline(reflex)
  const end = (leg: NerveLeg) => legs.find((l) => l.leg === leg)!.endMs
  return [
    { key: 'start', t: 0 },
    { key: 'cord', t: end('in') },
    { key: 'reflex', t: reflex.totalMs },
    { key: 'brain', t: brain.totalMs },
  ]
}

/** A point of the demo's picture (its SVG's own units, 300 × 150). */
export type Pt = readonly [number, number]

/** A leg's path, and how its time is shared out between its segments (by length when not given). */
interface LegPath {
  pts: readonly Pt[]
  weights?: readonly number[]
}

/** Where the picture's parts are (NerveDemo.tsx draws them here). */
export const AT = {
  /** The fingertip on the pan: the heat receptor. */
  receptor: [262, 99] as Pt,
  /** Where the sensory neuron enters the spinal cord. */
  cordIn: [70, 92] as Pt,
  /** The relay neuron's middle, inside the cord. */
  relay: [59, 98] as Pt,
  /** Where the motor neuron leaves the cord. */
  cordOut: [70, 105] as Pt,
  /** The arm muscle (the effector): the end of the motor neuron. */
  muscle: [168, 117] as Pt,
  /** The brain, where the thinking happens. */
  brain: [60, 30] as Pt,
  /** The middle of the cord at the sensory neuron's height. */
  cordMid: [60, 92] as Pt,
}

/** The sensory neuron: fingertip → along the arm → into the spinal cord. */
export const SENSORY: readonly Pt[] = [AT.receptor, [215, 90], [130, 85], AT.cordIn]
/** The motor neuron: out of the cord → along the arm → the arm muscle. */
export const MOTOR: readonly Pt[] = [AT.cordOut, [110, 112], [150, 116], [160, 117]]
/** The relay neuron: from the sensory neuron's end to the motor neuron's start, inside the cord. */
export const RELAY: readonly Pt[] = [AT.cordIn, AT.relay, AT.cordOut]

/** Each route's legs as paths in the picture. The route through the brain: up the cord, thinking in the brain, back down. */
const PATHS: Record<'spinal' | 'brain', Partial<Record<NerveLeg, LegPath>>> = {
  spinal: {
    in: { pts: SENSORY },
    synapse: { pts: RELAY },
    out: { pts: MOTOR },
    nmj: { pts: [[160, 117], AT.muscle] },
  },
  brain: {
    in: { pts: SENSORY },
    synapse: { pts: [AT.cordIn, AT.cordMid] },
    // Up the cord (a fifth of the time), thinking in the brain (most of it), back down and out of the cord.
    thinking: { pts: [AT.cordMid, AT.brain, AT.brain, [60, 105], AT.cordOut], weights: [0.2, 0.6, 0.18, 0.02] },
    out: { pts: MOTOR },
    nmj: { pts: [[160, 117], AT.muscle] },
  },
}

/** The point a fraction `f` (0–1) of the way along a path, its time shared by `weights` or by length. */
export function along({ pts, weights }: LegPath, f: number): Pt {
  const n = pts.length - 1
  const lengths = Array.from({ length: n }, (_, i) => Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]))
  const share = weights ?? lengths
  const total = share.reduce((a, b) => a + b, 0)
  let left = Math.min(Math.max(f, 0), 1) * total
  for (let i = 0; i < n; i++) {
    const s = share[i]!
    if (left <= s || i === n - 1) {
      const k = s ? Math.min(left / s, 1) : 1
      const [a, b] = [pts[i]!, pts[i + 1]!]
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    }
    left -= s
  }
  return pts[n]!
}

/** Where a route's signal is drawn at model time `t`: on the leg it is running, or at the muscle once it has arrived. */
export function signalAt(timing: NerveTiming, t: number): Pt {
  const paths = PATHS[timing.route]
  for (const { leg, startMs, endMs } of nerveTimeline(timing))
    if (t < endMs) return along(paths[leg]!, endMs > startMs ? (t - startMs) / (endMs - startMs) : 1)
  return AT.muscle
}
