import { useTranslation } from 'react-i18next'
import type { ProfileId } from '@lifepeek/engine'
import { InfoIcon } from './icons.tsx'

interface Props {
  profile: ProfileId
  /** Opens "How we know" for the person. Without it the tag is plain text. */
  onInfo?: () => void
}

/**
 * Whose body the model is: "Adult model ⓘ" in the meal bar (`profiles.<id>.tag`; the longer
 * `.desc` is its tooltip). Quiet ink-2 text, so it informs without competing with the meal.
 */
export default function PersonTag({ profile, onInfo }: Props) {
  const { t } = useTranslation()
  const tag = t(`profiles.${profile}.tag`)
  const desc = t(`profiles.${profile}.desc`)
  const look = 'inline-flex shrink-0 items-center gap-1 text-control font-semibold whitespace-nowrap text-ink-2'
  if (!onInfo) {
    return (
      <span className={look} title={desc}>
        {tag}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onInfo}
      title={desc}
      className={`${look} min-h-11 rounded-control px-2 hover:bg-sunk2 hover:text-ink lg:min-h-9`}
    >
      {tag}
      <InfoIcon />
    </button>
  )
}
