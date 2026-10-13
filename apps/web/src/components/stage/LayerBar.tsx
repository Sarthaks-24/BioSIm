import { useTranslation } from 'react-i18next'
import { useRunStore } from '../../state/run.ts'
import { pickerSystems } from '../../systems/registry.ts'
import { Segmented } from '../kit/index.ts'

/**
 * Which body system is lit (UI-11, as a ready slot). The options come from the systems registry
 * (systems/registry.ts): the public rows, and a hidden one only while a `?preview=1` link has it
 * lit. v3.0 has one, Digestion; nothing is shown greyed out as "coming soon". The picker that
 * replaces this is U-2's (R41).
 */
export default function LayerBar({ className }: { className?: string }) {
  const { t } = useTranslation()
  const layer = useRunStore((s) => s.layer)
  return (
    <Segmented
      label={t('stage.layer')}
      options={pickerSystems(layer).map((s) => ({ id: s.id, label: t(`${s.i18nKey}.name`) }))}
      value={layer}
      onChange={(id) => useRunStore.getState().setLayer(id)}
      className={className}
    />
  )
}
