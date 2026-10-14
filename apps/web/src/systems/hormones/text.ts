import control from 'virtual:lifepeek-en/sys.control'
import signals from 'virtual:lifepeek-en/signals'
import units from 'virtual:lifepeek-en/units'

/**
 * The control pack's English (I-1, systems/load.ts `text`): its own section `sys.control`, and the
 * two lazy sections its graphs and moment read: the signals' names and descriptions
 * (`signals.blood.insulin`, `signals.brain.glucoseUse` and its moment's name, whose keys the
 * engine's catalog fixes as `signals.<id>`) and the units (× before eating, g an hour). Neither is in
 * the first download (scripts/i18n-sections.mjs); "How we know" loads the same two files, so they
 * are fetched once.
 */
const text: Record<string, unknown> = { ...signals, ...units, ...control }
export default text
