import { useTranslation } from 'react-i18next'
import { StatusTag } from '../../components/kit/index.ts'
import type { NowProps, SystemUi } from '../registry.ts'
import GermCard from './GermCard.tsx'

/**
 * Lymph's Now line: what lymph does, and that the picture is a drawing (R11, R13: the "Drawing
 * only" tag, never a fourth one). Nothing in it moves with the meal clock: v3.0 has no lymph model.
 */
function LymphNow({ className = '' }: NowProps) {
  const { t } = useTranslation()
  return (
    <p data-now="lymph" className={`text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <span className="mr-2 inline-block" style={{ verticalAlign: '-0.1em' }}>
        <StatusTag status="illustration" />
      </span>
      {t('sys.lymph.now')}
    </p>
  )
}

/**
 * Lymph & germ defence's words (A-11a): a Now line and the germ-defence card, which the graph
 * column shows in the graphs' place; no summary, graphs or moments until S-5. In the pack's one
 * chunk (pack.ts), so the card loads with the pack (no second wait, and the pack's loading and
 * "Try again" words cover it: R71); the whole chunk is at most 5 KB gz (check-budget).
 * Nothing here imports the stage's own modules (flat/layerKit.ts says why).
 */
export const LYMPH_UI: SystemUi = {
  now: LymphNow,
  summary: () => null,
  stripSummary: () => null,
  moments: () => [],
  card: GermCard,
}
