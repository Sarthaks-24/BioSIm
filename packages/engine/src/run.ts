// `@lifepeek/engine/run`: the engine itself (architecture §3.1, E-2). The web loads it with a plain
// `import()` when the stage mounts (hooks/useRun.ts), so the first download carries only the main
// entry (index.ts). Tests and scripts import it directly. Keep this list to the run: a dynamic
// import keeps every export of the chunk, so test-only helpers (the module-graph check, golden
// coverage) are imported by the tests from their own files, and anything the screen needs without
// running belongs in the main entry.
export { simulate, HUMAN_MODEL, ORGANISM_MODELS, type SimOptions } from './simulate.ts'
export {
  HUMAN_MODULES,
  HUMAN_PROVIDES,
  PROVIDES,
  activityModule,
  gutModule,
  energyModule,
  bloodSugarModule,
  gasModule,
  effortModule,
  circulationModule,
  waterModule,
} from './modules/index.ts'
// Every row a run's signals can carry: the lean catalog's and the packs' lazy rows (architecture §1.3).
export { RUN_EVENTS, RUN_EVENT_IDS, RUN_SIGNALS, RUN_SIGNAL_IDS, isRunEvent, isRunSignal } from './core/catalog/rows.ts'
export { BREATHING_SIGNALS, BREATHING_SIGNAL_IDS } from './core/catalog/breathing.ts'
export { EFFORT_SIGNALS, EFFORT_SIGNAL_IDS } from './core/catalog/effort.ts'
export { CIRCULATION_EVENTS, CIRCULATION_EVENT_IDS, CIRCULATION_SIGNALS, CIRCULATION_SIGNAL_IDS } from './core/catalog/circulation.ts'
export { PACK_PARAMS, type PackParams } from './packParams.ts'
export { KIDNEY_EVENTS, KIDNEY_EVENT_IDS, KIDNEY_SIGNALS, KIDNEY_SIGNAL_IDS } from './core/catalog/kidneys.ts'
export { CONTROL_EVENTS, CONTROL_EVENT_IDS, CONTROL_SIGNALS, CONTROL_SIGNAL_IDS } from './core/catalog/control.ts'
export { ABSORB_RATE_ID, CARBS_OUT, LEFTOVERS_IN_COLON, LEFT_WATER, stomachArrivalMin } from './modules/gut.ts'
export { ACTIVITY_CODES, ACTIVITY_MET, activityProblems } from './modules/activity.ts'
export { ENERGY_TOTAL } from './modules/energy.ts'
export { heatLoss, type HeatLoss } from './modules/effort.ts'
export { filtrateTakenBack, glucoseSpilled } from './modules/water.ts'
export { runModules } from './core/module.ts'
export { buildMoments, buildSignalTable } from './core/table.ts'
export { computeEvents } from './events.ts'
export { makeParticles } from './particles.ts'
export { bluntingFactor, glucoseCurve } from './glucose.ts'
export { energySignals, type EnergySeries } from './energy/energyBalance.ts'
