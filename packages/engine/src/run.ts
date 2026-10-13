// `@lifepeek/engine/run`: the engine itself (architecture §3.1, E-2). The web loads it with a plain
// `import()` when the stage mounts (hooks/useRun.ts), so the first download carries only the main
// entry (index.ts). Tests and scripts import it directly. Keep this list to the run: a dynamic
// import keeps every export of the chunk, so test-only helpers (the module-graph check, golden
// coverage) are imported by the tests from their own files, and anything the screen needs without
// running belongs in the main entry.
export { simulate, HUMAN_MODEL, ORGANISM_MODELS, type SimOptions } from './simulate.ts'
export { HUMAN_MODULES, HUMAN_PROVIDES, PROVIDES, gutModule, energyModule, bloodSugarModule } from './modules/index.ts'
export { CARBS_OUT, LEFTOVERS_IN_COLON, stomachArrivalMin } from './modules/gut.ts'
export { runModules } from './core/module.ts'
export { buildMoments, buildSignalTable } from './core/table.ts'
export { computeEvents } from './events.ts'
export { makeParticles } from './particles.ts'
export { bluntingFactor, glucoseCurve } from './glucose.ts'
export { energySignals, type EnergySeries } from './energy/energyBalance.ts'
