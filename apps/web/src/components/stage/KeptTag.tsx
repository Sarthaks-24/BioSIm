import { useTranslation } from 'react-i18next'
import { KEPT, KEPT_DASH } from '../../lib/colors.ts'
import { useRunStore } from '../../state/run.ts'
import { CloseIcon } from '../kit/index.ts'
import { mealKcalRounded, mealNames } from './mealText.ts'

/** The line sample the graphs use for each run (and energy used), so the meal bar doubles as their key. */
export function LineSwatch({ kept = false, color = 'var(--color-run)' }: { kept?: boolean; color?: string }) {
  return (
    <svg viewBox="0 0 22 4" width="22" height="4" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
      <line
        x1="1"
        y1="2"
        x2="21"
        y2="2"
        strokeWidth="3"
        strokeLinecap={kept ? 'butt' : 'round'}
        style={{ stroke: kept ? KEPT : color }}
        strokeDasharray={kept ? KEPT_DASH : undefined}
      />
    </svg>
  )
}

/**
 * The kept run in the meal bar: "Kept: Cheeseburger + Fries", its kcal, and a button to stop
 * comparing. Dashed, like its line on the graphs; the words say it, so the grey is never the only
 * cue.
 */
export default function KeptTag() {
  const { t, i18n } = useTranslation()
  const kept = useRunStore((s) => s.kept)
  if (!kept) return null
  const names = mealNames(kept.items, i18n.language)
  return (
    <span className="inline-flex min-h-11 max-w-full min-w-0 shrink items-center gap-2 rounded-control border-[1.5px] border-dashed border-kept pl-2.5 text-control text-ink lg:min-h-9">
      <LineSwatch kept />
      {/* Never cut short: on a phone the tag has its own row and the words may wrap. */}
      <span className="min-w-0 font-semibold whitespace-nowrap max-lg:whitespace-normal">{t('keep.tag', { meal: names })}</span>
      <span className="tabular shrink-0 whitespace-nowrap text-ink-2">{t('units.kcal', { n: mealKcalRounded(kept.items) })}</span>
      <button
        type="button"
        onClick={() => useRunStore.getState().unkeep()}
        aria-label={t('keep.remove', { meal: names })}
        title={t('keep.remove', { meal: names })}
        className="grid size-11 shrink-0 place-items-center rounded-r-control text-ink-2 hover:bg-sunk2 hover:text-ink lg:size-9"
      >
        <CloseIcon />
      </button>
    </span>
  )
}
