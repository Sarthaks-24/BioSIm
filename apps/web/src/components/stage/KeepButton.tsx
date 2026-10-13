import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeys } from '../../lib/keys.ts'
import { useRunStore } from '../../state/run.ts'
import { runKey } from '../../hooks/useRun.ts'
import { IconButton, KeepIcon } from '../kit/index.ts'

/**
 * "Keep to compare" (UI-3): copies this meal into the kept run, which the graphs draw as a dashed
 * grey line. Pressing it again later keeps the new meal instead. Off when there is nothing new to
 * keep: an empty meal, or the meal that is already kept.
 *
 * Off is `aria-disabled`, not `disabled` (verify-1 A7): the button stays in the Tab order and a
 * screen reader still hears why it is off, from its description ("This meal is the one kept").
 * Its words stay beside the icon after keeping too (council SHOULD 11): it is the meal bar's main
 * action, and an icon of two lines says little on its own.
 */
export default function KeepButton() {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const profile = useRunStore((s) => s.profile)
  const kept = useRunStore((s) => s.kept)
  const why = useId()
  const keysOff = useKeys((s) => s.off)
  const same = !!kept && runKey(kept.items, kept.profile) === runKey(meal, profile)
  const off = meal.length === 0 || same
  const reason = same ? t('keep.already') : meal.length === 0 ? t('stage.empty') : t('keep.help')
  return (
    <>
      <IconButton
        icon={<KeepIcon />}
        label={t('keep.button')}
        // A tooltip for the mouse; screen readers get the same words from the description.
        title={reason}
        aria-disabled={off || undefined}
        aria-describedby={why}
        aria-keyshortcuts={keysOff ? undefined : 'P'}
        onClick={() => !off && useRunStore.getState().keep()}
        className="aria-disabled:cursor-not-allowed aria-disabled:text-ink-2 aria-disabled:hover:bg-transparent"
      />
      <span id={why} hidden>
        {reason}
      </span>
    </>
  )
}
