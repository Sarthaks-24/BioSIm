import { useTranslation } from 'react-i18next'
import { StatusTag } from '../../components/kit/index.ts'
import type { NowProps, SystemUi } from '../registry.ts'
import Panels from './Panels.tsx'

/**
 * Reproduction's Now line (R-1; ui-ux §10 "Different clock: days"): the two panels are beside the
 * body, never on it, and keep their own clock (days of a cycle), so nothing here follows the meal
 * clock. Tagged "Model estimate", as the hormone panel is.
 */
function ReproductionNow({ className = '' }: NowProps) {
  const { t } = useTranslation()
  return (
    <p data-now="reproduction" className={`text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <span className="mr-2 inline-block" style={{ verticalAlign: '-0.1em' }}>
        <StatusTag status="assumption" />
      </span>
      {t('sys.reproduction.now')}
    </p>
  )
}

/**
 * Reproduction's words (R-1): the Now line and the two panels in the graph column's place; no
 * summary, graphs or moments (static data, not a time series). Nothing here imports the stage's
 * own modules (flat/layerKit.ts says why).
 */
const UI: SystemUi = {
  now: ReproductionNow,
  summary: () => null,
  stripSummary: () => null,
  moments: () => [],
  card: Panels,
}

const UIS = { reproduction: UI }
export default UIS
