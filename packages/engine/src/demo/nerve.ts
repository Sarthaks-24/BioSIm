// `@lifepeek/engine/demo`: the nerve demo (S-7, model §2.6). A pure function, not a simulation
// module: it reads no run, adds no signal and changes no output of simulate(). The web loads this
// entry with a plain `import()` when the nerve panel first opens, so none of it is in /sim's first
// download (R71/R74). Numbers and the pages they were read on: nerveParams.ts (V-7).
//
//   reflex time = L_in / v_in + synapses · d_syn + L_out / v_out + d_nmj
//   route through the brain = the same legs + thinking time
//
// Limits: the clock stops when the muscle gets the signal (receptor time, heat soaking through the
// skin and the muscle's own contraction are left out); one adult arm; single speeds from ranges;
// "myelin off" is a what-if (real motor nerves always have myelin).
import { NERVE_PARAMS, type NerveParams, type NerveSourceId } from './nerveParams.ts'

export { NERVE_PARAMS, NERVE_SOURCES, type NerveParams, type NerveSourceId } from './nerveParams.ts'

/** A fibre type of Kiernan's table: thick myelinated motor (aAlpha), thin myelinated heat/pain (aDelta), thin unmyelinated (c). */
export type FibreType = 'aAlpha' | 'aDelta' | 'c'

export interface NerveScenario {
  id: NerveScenarioId
  /** Sensory leg: from the receptor to the spinal cord. */
  inPath: { lengthM: (p: NerveParams) => number; fibre: Exclude<FibreType, 'c'> }
  /** Motor leg: from the spinal cord to the muscle. */
  outPath: { lengthM: (p: NerveParams) => number; fibre: Exclude<FibreType, 'c'> }
  /** Synapses inside the spinal cord on the reflex path. */
  synapses: number
  /** The pages its lengths, fibres and synapse count were read on. */
  sources: readonly NerveSourceId[]
}

/**
 * The demo's scenarios. The knee tap comes later (model §2.6): its golden is read (Khatun 2024,
 * NERVE_PARAMS.kneeJerkMs) but the leg's path lengths are not yet, so it is not offered.
 */
export type NerveScenarioId = 'hotPan'

export const NERVE_SCENARIOS: Readonly<Record<NerveScenarioId, NerveScenario>> = {
  /** Touch a hot pan, pull the hand back: heat in on an Aδ fibre, two spinal synapses, out on an Aα motor fibre. */
  hotPan: {
    id: 'hotPan',
    inPath: { lengthM: (p) => p.pathM.fingertipToCord, fibre: 'aDelta' },
    outPath: { lengthM: (p) => p.pathM.cordToArmMuscles, fibre: 'aAlpha' },
    synapses: 2,
    sources: ['kiernan2003', 'khosrawi2018', 'davisIuReflexes', 'byrneNeuroOnline'],
  },
}

export interface NerveOptions {
  /** 'spinal' (the reflex, default) or 'brain' (the same legs plus thinking time). */
  route?: 'spinal' | 'brain'
  /**
   * The myelin slider ("Beyond class 10"), 0–1: 1 = the fibres' own speeds (default), 0 = no myelin,
   * every leg as slow as an unmyelinated C fibre. In between, the speed moves in a straight line (a
   * teaching assumption).
   */
  myelin?: number
  /** Other numbers (tests, what-ifs); default NERVE_PARAMS. */
  params?: NerveParams
}

/** One trip's time, ms, leg by leg. totalMs is their sum. */
export interface NerveTiming {
  route: 'spinal' | 'brain'
  /** Sensory leg: receptor to spinal cord. */
  inMs: number
  /** All synapses in the spinal cord. */
  synapseMs: number
  /** Motor leg: spinal cord to muscle. */
  outMs: number
  /** Nerve to muscle (neuromuscular junction). */
  nmjMs: number
  /** What the brain adds (0 on the spinal route). */
  thinkingMs: number
  totalMs: number
  /** The speeds used, m/s. */
  inSpeedMPerS: number
  outSpeedMPerS: number
}

/** A fibre's speed with the myelin slider at `myelin` (0–1), m/s. */
export function fibreSpeed(fibre: FibreType, myelin: number, p: NerveParams = NERVE_PARAMS): number {
  const slow = p.fibreSpeedMPerS.c
  return slow + myelin * (p.fibreSpeedMPerS[fibre] - slow)
}

/** How long the signal takes from the stimulus to the muscle, ms, leg by leg (model §2.6). */
export function reflexTime(scenario: NerveScenarioId | NerveScenario, options: NerveOptions = {}): NerveTiming {
  const s = typeof scenario === 'string' ? NERVE_SCENARIOS[scenario] : scenario
  if (!s) throw new Error(`reflexTime: unknown scenario "${String(scenario)}"`)
  const p = options.params ?? NERVE_PARAMS
  const route = options.route ?? 'spinal'
  const myelin = options.myelin ?? 1
  if (!(myelin >= 0 && myelin <= 1)) throw new Error(`reflexTime: myelin must be 0–1, got ${myelin}`)
  const inSpeedMPerS = fibreSpeed(s.inPath.fibre, myelin, p)
  const outSpeedMPerS = fibreSpeed(s.outPath.fibre, myelin, p)
  const inMs = (s.inPath.lengthM(p) / inSpeedMPerS) * 1000
  const synapseMs = s.synapses * p.synapseDelayMs
  const outMs = (s.outPath.lengthM(p) / outSpeedMPerS) * 1000
  const nmjMs = p.nmjDelayMs
  const thinkingMs = route === 'brain' ? p.thinkingMs : 0
  return {
    route,
    inMs,
    synapseMs,
    outMs,
    nmjMs,
    thinkingMs,
    totalMs: inMs + synapseMs + thinkingMs + outMs + nmjMs,
    inSpeedMPerS,
    outSpeedMPerS,
  }
}

/** The route through the brain: reflexTime with route 'brain'. */
export const brainRoute = (scenario: NerveScenarioId | NerveScenario, options: Omit<NerveOptions, 'route'> = {}): NerveTiming =>
  reflexTime(scenario, { ...options, route: 'brain' })

export type NerveLeg = 'in' | 'synapse' | 'thinking' | 'out' | 'nmj'

/**
 * The legs in the order the signal runs them, with start and end in real ms, for the slowed-down
 * animation's counter (model §2.6: each scenario plays over 5–10 s, the counter shows real ms).
 * The last leg ends at totalMs. The spinal route has no thinking leg.
 */
export function nerveTimeline(t: NerveTiming): { leg: NerveLeg; startMs: number; endMs: number }[] {
  const legs: [NerveLeg, number][] = [
    ['in', t.inMs],
    ['synapse', t.synapseMs],
    ...(t.route === 'brain' ? ([['thinking', t.thinkingMs]] as [NerveLeg, number][]) : []),
    ['out', t.outMs],
    ['nmj', t.nmjMs],
  ]
  let at = 0
  return legs.map(([leg, ms]) => {
    const startMs = at
    at += ms
    return { leg, startMs, endMs: at }
  })
}
