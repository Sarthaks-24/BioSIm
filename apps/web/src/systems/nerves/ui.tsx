import { useTranslation } from 'react-i18next'
import { StatusTag } from '../../components/kit/index.ts'
import type { NowProps, SystemUi } from '../registry.ts'
import NerveDemo from './NerveDemo.tsx'

/** The brain's sugar use, g an hour (control rows: brain.glucoseUse, a cited constant), to one decimal; null without it. */
export function brainSugar(run: NowProps['run']): string | null {
  const series = run.signals.get('brain.glucoseUse')
  const g = series?.values[0]
  return g === undefined ? null : g.toFixed(1)
}

/**
 * Brain & nerves' Now line (U-7; ui-ux §7 "about 4.4 g of sugar an hour, the same all day"): what the
 * brain uses, which no meal changes (model §2.5: a cited constant), and that nerves work in
 * thousandths of a second, which the demo beside it shows. Tagged "Model estimate".
 */
function NervesNow({ run, className = '' }: NowProps) {
  const { t } = useTranslation()
  const g = brainSugar(run)
  return (
    <p data-now="nerves" className={`text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <span className="mr-2 inline-block" style={{ verticalAlign: '-0.1em' }}>
        <StatusTag status="assumption" />
      </span>
      {g && `${t('sys.control.nerves.sugar', { g })} `}
      {t('sys.control.nerves.now')}
    </p>
  )
}

/**
 * Brain & nerves' words (U-7): the Now line, and the nerve demo in the graph column's place; no
 * summary, graphs or moments (not a time-series system: model D16). In the pack's chunk, so the
 * demo loads with the pack (one wait, the pack's loading and "Try again" words: R71). Nothing here
 * imports the stage's own modules (flat/layerKit.ts says why).
 */
export const NERVES_UI: SystemUi = {
  now: NervesNow,
  summary: () => null,
  stripSummary: () => null,
  moments: () => [],
  card: NerveDemo,
}
