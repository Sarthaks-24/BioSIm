import control from 'virtual:lifepeek-en/sys.control'
import units from 'virtual:lifepeek-en/units'

/**
 * Hormones' English (I-1, systems/load.ts `text`): the pack's own section `sys.control`, and the
 * units (× before eating, g an hour), whose section is lazy and small. The insulin graph's name and
 * its moment's name are the engine catalog's keys (`signals.blood.insulin`, `signals.event.insulinPeak`),
 * in the lazy signals section; rather than fetch that whole section (2.8 KB gz, the control pack is
 * at most 20 KB), the pack brings the few names its graph and dock show as `sys.control.sig.*`
 * (content-i18n §5: a pack's own signal is `sys.<pack>.sig.<name>`) and adds them under the
 * catalog's keys. hormones.test.ts checks they are the same words. "How we know" loads the signals
 * section for the long description and the band, as for every graph.
 */
/** Where the pack keeps them. */
const SIG = 'sys.control.sig'
const sig = SIG.split('.').reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, control)
const text: Record<string, unknown> = {
  ...units,
  ...control,
  signals: { blood: { insulin: sig.insulin }, event: { insulinPeak: sig.insulinPeak } },
}
export default text
