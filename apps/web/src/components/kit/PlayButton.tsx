import { useTranslation } from 'react-i18next'
import { PauseIcon, PlayIcon } from './icons.tsx'

interface Props {
  playing: boolean
  onToggle: () => void
}

/**
 * Play / pause: the main action, so it is the one fully round control in the kit (plan-ui-ux
 * §3.2). Filled ink with a white icon; 48 px everywhere so it is easy to hit and to find.
 */
export default function PlayButton({ playing, onToggle }: Props) {
  const { t } = useTranslation()
  const name = playing ? t('sim.pause') : t('sim.play')
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={name}
      title={name}
      className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-[color-mix(in_oklab,var(--color-ink)_85%,white)]"
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  )
}
