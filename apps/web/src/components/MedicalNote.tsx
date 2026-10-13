import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

/** Where the full "not medical advice" text lives. */
export const MEDICAL_HREF = '/about#medical'

/**
 * The "educational, not medical advice" line, with a link to the full note on the About page.
 * `short` sits in the footer of every page; `graph` sits under the blood-sugar chart, always
 * visible (never in a tooltip).
 */
export default function MedicalNote({ text, className = '' }: { text: 'short' | 'graph'; className?: string }) {
  const { t } = useTranslation()
  return (
    <p className={className}>
      {text === 'graph' ? t('disclaimer.graph') : t('disclaimer.short')}{' '}
      <Link to={MEDICAL_HREF} className="whitespace-nowrap underline underline-offset-2 hover:text-ink">
        {t('disclaimer.more')}
      </Link>
    </p>
  )
}
