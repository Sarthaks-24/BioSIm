/**
 * What one run takes and gives (architecture §1.6, E-2). The run itself is in the lazy
 * `@lifepeek/engine/run` entry (run.ts); these types, and the view helpers that read a result
 * (view.ts), are in the main entry, so the screen can be typed and drawn without the engine.
 */
import type { Meal } from './meal.ts'
import type { FoodPhase } from './schema.ts'
import type { EmptyingCurve } from './stomach.ts'
import type { SimEvents } from './events.ts'
import type { Particle } from './particles.ts'
import type { SignalTable } from './core/signal.ts'
import type { HumanInput, ProfileId } from './core/organism.ts'

/**
 * One run's input: the foods (looked up by id), the organism and the stated person. Later: the
 * activity bouts (E-3b), and `| { organism: 'plant'; conditions: {...}; profile: 'leaf-ref' }`.
 */
export type RunInput = HumanInput

/**
 * One run, as the screen reads it: the signal table (catalog ID → Series), the moments and rhythms,
 * and the few things that are not signals: the meal, the emptying curves and the minute the meal
 * reaches the stomach (the view helpers use them), the events (summaries and graph marks read
 * `noNutrients` and `firstExit`) and the particles for the picture. In v3.0 it is the engine's own
 * object, on the main thread; the worker's wire form is W-2's (§3.2).
 *
 * The gut and blood arrays are signals only (E-2 deleted the raw Float64 copies the run used to
 * carry as well): `signals.get('gut.stomach.liquidG')` and so on.
 */
export interface RunResult extends SignalTable {
  modelVersion: number
  meal: Meal
  /** The stated person this run is about (energy.usedRate). Run metadata, not a signal. */
  profile: ProfileId
  curves: Record<FoodPhase, EmptyingCurve>
  /** Minute the meal starts arriving in the stomach (end of eating + swallow). */
  stomachArrivalMin: number
  events: SimEvents
  particles: Particle[]
}
