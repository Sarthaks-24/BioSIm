import circulation from 'virtual:lifepeek-en/sys.circulation'
import signals from 'virtual:lifepeek-en/signals'
import units from 'virtual:lifepeek-en/units'

/**
 * The circulation pack's English (I-1, systems/load.ts `text`): its own section `sys.circulation`,
 * and the two lazy sections its graphs read when they are first drawn: the signals' names and
 * descriptions (`signals.heart.*`, `signals.blood.flow.*`) and the units (beats a minute, L a
 * minute, mL a minute). Neither is in the first download (scripts/i18n-sections.mjs); Breathing and
 * "How we know" load the same two files, so they are fetched once.
 */
const text: Record<string, unknown> = { ...signals, ...units, ...circulation }
export default text
