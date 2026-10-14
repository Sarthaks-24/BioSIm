import lymph from 'virtual:lifepeek-en/sys.lymph'
import signals from 'virtual:lifepeek-en/signals'
import units from 'virtual:lifepeek-en/units'

/**
 * The lymph pack's English (I-1, systems/load.ts `text`): its own section `sys.lymph` (the map's
 * labels, the germ-defence card, and since U-5 its graphs' words), and the lazy section its graphs
 * and moment read: the signals' names and descriptions (`signals.lymph.*`, `signals.blood.triglyceride`
 * and its moment's name, whose keys the engine's catalog fixes as `signals.<id>`) and the units (the
 * summary writes them as lib/formatSignal.ts does). "How we know" loads the same two files, so they
 * are fetched once.
 */
const text: Record<string, unknown> = { ...signals, ...units, ...lymph }
export default text
