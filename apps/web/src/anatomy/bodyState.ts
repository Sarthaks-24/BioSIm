import { activeStage, valueAt, type ActiveSignalId, type Simulation, type StageId } from '@lifepeek/engine'
import { ORGANISMS } from '../registry/index.ts'
import { stomachFill } from './human.ts'

/**
 * What the body picture shows at one moment, read from the run's signals. The 3D body and the
 * flat diagram both call this, so they always agree. The registry says which signal drives which
 * organ (`drives.fill`); this file only reads them, through `valueAt`, so a frame between two
 * model minutes is interpolated, not stepped.
 */
export interface BodyState {
  /** Where most of the meal is now: that organ is highlighted. */
  stage: StageId
  /** Stomach stretch, 0 (empty) … 1 (full); see stomachFill. */
  stomachFill: number
  /** Organs on the food's path that hold food now. The others fade back, so the eye goes to the meal. */
  holds: Record<'stomach' | 'smallIntestine' | 'largeIntestine', boolean>
}

const ORGANS = ORGANISMS.human.organs
const fillSignal = (organ: string): ActiveSignalId => {
  const id = ORGANS.find((o) => o.id === organ)?.drives?.fill
  if (!id) throw new Error(`registry: organ ${organ} has no fill signal`)
  return id
}

/** Signals behind each organ's fill, looked up once from the registry. */
export const FILL_SIGNAL = {
  stomach: fillSignal('stomach'),
  smallIntestine: fillSignal('smallIntestine'),
  largeIntestine: fillSignal('largeIntestine'),
} as const

/** Grams below which an organ counts as empty (a few crumbs left in the model's tail). */
const HOLDS_G = { stomach: 2, smallIntestine: 1, largeIntestine: 1 } as const

/** Grams in an organ at t (minutes), from its fill signal. 0 if the run has no such signal. */
export function gramsIn(sim: Simulation, organ: keyof typeof FILL_SIGNAL, tMin: number): number {
  const series = sim.signals.get(FILL_SIGNAL[organ])
  return series ? valueAt(series, tMin, sim.stepMin) : 0
}

export function bodyStateAt(sim: Simulation, tMin: number): BodyState {
  const stomach = gramsIn(sim, 'stomach', tMin)
  return {
    stage: activeStage(sim, tMin),
    stomachFill: stomachFill(stomach),
    holds: {
      stomach: stomach > HOLDS_G.stomach,
      smallIntestine: gramsIn(sim, 'smallIntestine', tMin) > HOLDS_G.smallIntestine,
      largeIntestine: gramsIn(sim, 'largeIntestine', tMin) > HOLDS_G.largeIntestine,
    },
  }
}
