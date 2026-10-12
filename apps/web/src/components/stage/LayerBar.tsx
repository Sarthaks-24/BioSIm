import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM } from '@lifepeek/engine'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import { Segmented } from '../kit/index.ts'

/**
 * Which body system is lit (UI-11, as a ready slot). The options come from the registry, so a new
 * system appears here with no change to the stage. v2.0 has one, Digestion; nothing is shown
 * greyed out as "coming soon".
 */
export default function LayerBar({ className }: { className?: string }) {
  const { t } = useTranslation()
  const layer = useRunStore((s) => s.layer)
  const systems = ORGANISMS[DEFAULT_ORGANISM].systems
  return (
    <Segmented
      label={t('stage.layer')}
      options={systems.map((s) => ({ id: s.id, label: t(`${s.i18nKey}.name`) }))}
      value={layer}
      onChange={(id) => useRunStore.getState().setLayer(id)}
      className={className}
    />
  )
}
