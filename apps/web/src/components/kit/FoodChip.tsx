import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, CloseIcon } from './icons.tsx'

interface Props {
  /** A food of the meal, or (v3, E-3b-ui) an activity bout: the same chip, the bout without servings. */
  kind?: 'food' | 'bout'
  /** The food's picture (the emoji in data/foods.ts), or the activity's. */
  emoji: string
  /** Already in the reader's language. A bout's is its whole text ("Walk 20 min, from 2:00"). */
  name: string
  /** A food's servings; a bout has none (and no chip shows kcal, ui-ux §2.1). */
  servings?: number
  /**
   * Opens the servings picker (a bout: the activity sheet on it, a dialog), given the chip's button
   * (the focus goes back to it). Without it the chip's words are plain text.
   */
  onEdit?: (button: HTMLButtonElement) => void
  /** Whether the picker `onEdit` opens is showing. */
  expanded?: boolean
  onRemove: () => void
}

/**
 * One chip of the plan strip (FP-1, ui-ux §2.1): a food (picture, name, servings) or an activity
 * bout (picture, its words), then a separate remove button. Flat (Sunk
 * fill, 6 px corners, no border, no pill), and the two halves are split by a 2 px gap of page
 * colour so each has its own clear target. The name never wraps; the meal bar scrolls instead,
 * and a chip wider than the whole row shortens its name ("Roti / chap…") before its servings or
 * ✕ would be cut off (council MUST 9).
 */
export default function FoodChip({ kind = 'food', emoji, name, servings, onEdit, expanded, onRemove }: Props) {
  const { t } = useTranslation()
  const body = (
    <>
      <span aria-hidden="true" className="shrink-0">
        {emoji}
      </span>
      {/* The name gives way first (it is in the button's name in full), never the servings or ✕. */}
      <span data-may-shorten="" className="min-w-8 truncate font-semibold">
        {name}
      </span>
      {servings != null && <span className="tabular shrink-0 text-ink-muted">×{servings}</span>}
    </>
  )
  const part = 'flex min-h-11 items-center gap-1.5 bg-surface-sunk lg:min-h-9'
  return (
    <span data-chip={kind} className="inline-flex max-w-full shrink-0 items-stretch gap-0.5 text-control whitespace-nowrap text-ink">
      {onEdit ? (
        <button
          type="button"
          onClick={(e) => onEdit(e.currentTarget)}
          aria-expanded={expanded}
          aria-haspopup={kind === 'bout' ? 'dialog' : undefined}
          aria-label={kind === 'bout' ? t('activity.edit', { bout: name }) : `${name}, ${t('sim.servings')} ${servings}`}
          className={`${part} min-w-0 rounded-l-control pr-1.5 pl-2.5 hover:bg-surface-sunk-hover`}
        >
          {body}
          {/* Under 360 px wide the chip needs the room for its servings (FP-1). */}
          <span className="contents max-[22.5rem]:hidden">
            <ChevronDownIcon />
          </span>
        </button>
      ) : (
        <span className={`${part} min-w-0 rounded-l-control pr-2 pl-2.5`}>{body}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('sim.remove', { name })}
        title={t('sim.remove', { name })}
        className={`${part} w-11 shrink-0 justify-center rounded-r-control text-ink-muted hover:bg-surface-sunk-hover hover:text-ink lg:w-9`}
      >
        <CloseIcon />
      </button>
    </span>
  )
}
