import kidneys from 'virtual:lifepeek-en/sys.kidneys'
import signals from 'virtual:lifepeek-en/signals'
import units from 'virtual:lifepeek-en/units'

/**
 * The kidneys pack's English (I-1, systems/load.ts `text`): its own section `sys.kidneys`, and the
 * two lazy sections its graphs and moments read: the signals' names and descriptions
 * (`signals.kidney.*`, `signals.water.*` and its two moments' names, whose keys the engine's catalog
 * fixes as `signals.<id>`) and the units (mL, mL an hour). Neither is in the first download
 * (scripts/i18n-sections.mjs); "How we know" loads the same two files, so they are fetched once.
 */
const text: Record<string, unknown> = { ...signals, ...units, ...kidneys }
export default text
