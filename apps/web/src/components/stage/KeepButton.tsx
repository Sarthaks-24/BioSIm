import { useTranslation } from 'react-i18next'
import { useRunStore } from '../../state/run.ts'
import { runKey } from '../../hooks/useRun.ts'
import { IconButton, KeepIcon } from '../kit/index.ts'

/**
 * "Keep to compare" (UI-3): copies this meal into the kept run, which the graphs draw as a dashed
 * grey line. Pressing it again later keeps the new meal instead. Off when there is nothing new to
 * keep: an empty meal, or the meal that is already kept. `compact` shows only its icon (beside
 * the kept tag, which already says what keeping does).
 */
export default function KeepButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const profile = useRunStore((s) => s.profile)
  const kept = useRunStore((s) => s.kept)
  const same = !!kept && runKey(kept.items, kept.profile) === runKey(meal, profile)
  const why = same ? t('keep.already') : meal.length === 0 ? t('stage.empty') : t('keep.help')
  return (
    <IconButton
      icon={<KeepIcon />}
      label={t('keep.button')}
      title={why}
      disabled={meal.length === 0 || same}
      onClick={() => useRunStore.getState().keep()}
      // Beside the kept tag (from 1024 px up) the icon is enough; the words stay as its name.
      className={compact ? 'lg:w-9 lg:justify-center lg:px-0 [&>span]:lg:sr-only' : ''}
    />
  )
}
