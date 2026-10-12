import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, CloseIcon } from './icons.tsx'

interface Props {
  /** The food's picture (the emoji in data/foods.ts). */
  emoji: string
  /** Already in the reader's language. */
  name: string
  servings: number
  /** Opens the servings picker. Without it the food part is plain text. */
  onEdit?: () => void
  /** Whether the picker `onEdit` opens is showing. */
  expanded?: boolean
  onRemove: () => void
}

/**
 * One food in the meal bar: picture, name, servings, then a separate remove button. Flat (Sunk
 * fill, 6 px corners, no border, no pill), and the two halves are split by a 2 px gap of page
 * colour so each has its own clear target. The name never wraps; the meal bar scrolls instead.
 */
export default function FoodChip({ emoji, name, servings, onEdit, expanded, onRemove }: Props) {
  const { t } = useTranslation()
  const body = (
    <>
      <span aria-hidden="true">{emoji}</span>
      <span className="font-semibold">{name}</span>
      <span className="tabular text-ink-2">×{servings}</span>
    </>
  )
  const part = 'flex min-h-11 items-center gap-1.5 bg-sunk2 lg:min-h-9'
  return (
    <span className="inline-flex shrink-0 items-stretch gap-0.5 text-control whitespace-nowrap text-ink">
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-expanded={expanded}
          aria-label={`${name}, ${t('sim.servings')} ${servings}`}
          className={`${part} rounded-l-control pr-1.5 pl-2.5 hover:bg-sunk2-hover`}
        >
          {body}
          <ChevronDownIcon />
        </button>
      ) : (
        <span className={`${part} rounded-l-control pr-2 pl-2.5`}>{body}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('sim.remove', { name })}
        title={t('sim.remove', { name })}
        className={`${part} w-11 justify-center rounded-r-control text-ink-2 hover:bg-sunk2-hover hover:text-ink lg:w-9`}
      >
        <CloseIcon />
      </button>
    </span>
  )
}
