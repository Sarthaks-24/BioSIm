import effort from 'virtual:lifepeek-en/sys.effort'
import signals from 'virtual:lifepeek-en/signals'
import units from 'virtual:lifepeek-en/units'

/**
 * The effort pack's English (I-1, systems/load.ts `text`): its own section `sys.effort` (muscles,
 * skin and the bones card), and the two lazy sections its graphs read when they are first drawn: the
 * signals' names and descriptions (`signals.muscle.*`, `signals.skin.*`) and the units (kcal/h, mL,
 * mL an hour: R75). Neither is in the first download (scripts/i18n-sections.mjs); "How we know" and
 * the breathing pack load the same files, so they are fetched once.
 */
const text: Record<string, unknown> = { ...signals, ...units, ...effort }
export default text
