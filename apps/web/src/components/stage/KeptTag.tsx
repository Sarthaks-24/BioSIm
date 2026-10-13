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
      {/* Never cut short: the words wrap when the meal bar is full (on a phone the tag has its own
          row). Its kcal is for the wider screens: a phone's first screen has no room for it (WP-18). */}
      <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{t('keep.tag', { meal: names })}</span>
      <span className="tabular shrink-0 whitespace-nowrap text-ink-muted max-lg:sr-only">{t('units.kcal', { n: mealKcalRounded(kept.items) })}</span>
      <UnkeepButton meal={names} className="rounded-r-control lg:size-9" />
    </span>
  )
}

/** "Stop comparing with …": ends the kept run. In the kept tag, and on a phone in the Now line's kept row. */
export function UnkeepButton({ meal, className = '' }: { meal: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => useRunStore.getState().unkeep()}
      aria-label={t('keep.remove', { meal })}
      title={t('keep.remove', { meal })}
      className={`grid size-11 shrink-0 place-items-center text-ink-muted hover:bg-surface-sunk hover:text-ink ${className}`}
    >
      <CloseIcon />
    </button>
  )
}
