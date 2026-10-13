import { useTranslation } from 'react-i18next'
import { HINDI } from '../i18n/language.ts'

/**
 * The header's English/Hindi switch. Not drawn while Hindi is paused (R47): a build without
 * `VITE_HINDI=1` is English only.
 */
export default function LanguageButton({ className, hindi = HINDI }: { className: string; hindi?: boolean }) {
  const { t, i18n } = useTranslation()
  if (!hindi) return null
  // The name starts with the words on the button (WCAG 2.5.3), read in their own language;
  // what the button does follows, for screen readers only, in the page's language.
  return (
    <button type="button" onClick={() => void i18n.changeLanguage(i18n.language === 'hi' ? 'en' : 'hi')} className={className}>
      <span lang={i18n.language === 'hi' ? 'en' : 'hi'}>{t('nav.language')}</span>
      <span className="sr-only"> ({t('nav.languageLabel')})</span>
    </button>
  )
}
