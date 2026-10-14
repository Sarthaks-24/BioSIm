import breathing from 'virtual:lifepeek-en/sys.breathing'
import signals from 'virtual:lifepeek-en/signals'
import units from 'virtual:lifepeek-en/units'

/**
 * The breathing pack's English (I-1, systems/load.ts `text`): its own section `sys.breathing`, and
 * the two lazy sections its graphs read when they are first drawn: the signals' names and
 * descriptions (`signals.lungs.*`, `signals.gas.*`, whose keys the engine's catalog fixes as
 * `signals.<id>`) and the units (breaths a minute, mL, mL a minute). Neither is in the first download
 * (scripts/i18n-sections.mjs); "How we know" loads the same two files, so they are fetched once.
 */
const text: Record<string, unknown> = { ...signals, ...units, ...breathing }
export default text
