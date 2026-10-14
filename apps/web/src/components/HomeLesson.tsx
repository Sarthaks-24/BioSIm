import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LESSON_STATE, flagshipHref, flagshipShown, isPreview } from '../lib/flagship.ts'
import { pickerSystems } from '../systems/registry.ts'

/** This page's `?preview=1`. */
const usePreview = () => isPreview(useLocation().search)

/**
 * Home's v3.0 parts (X-1, R15), loaded after Home's first paint (every page's first download is shared
 * with the stage, so none of this is in it; nor the systems registry they read). They show once a
 * system besides Digestion is public, or in a `?preview=1` session. `Lesson` is the first call to action, the guided lesson "One
 * roti, one walk" (once every system it pauses on is public); `Systems` a static list of the body
 * systems there are (names and what each shows, no numbers to work out).
 */
export function Lesson() {
  const { t } = useTranslation()
  const preview = usePreview()
  if (!flagshipShown(preview)) return null
  return (
    // The whole card is its link.
    <Link
      to={flagshipHref(preview)}
      state={LESSON_STATE}
      data-flagship=""
      className="mt-8 block max-w-[60ch] rounded-frame border border-border bg-surface-raised p-5 hover:bg-surface-sunk"
    >
      <span className="block text-title font-extrabold text-balance">{t('home.lesson.title')}</span>
      <span className="mt-1 block leading-relaxed text-ink-muted">{t('home.lesson.lead')}</span>
      <span className="mt-4 inline-block rounded-full bg-ink px-6 py-3 text-lg font-semibold text-white">{t('home.lesson.start')}</span>
    </Link>
  )
}

export function Systems() {
  const { t } = useTranslation()
  const systems = pickerSystems(usePreview())
  if (systems.length < 2) return null
  return (
    <section aria-labelledby="systems" data-systems="" className="border-t border-border py-12">
      <h2 id="systems" className="mb-2 text-h2 font-extrabold">
        {t('home.systems.title')}
      </h2>
      <p className="mb-6 max-w-[60ch] text-lg text-ink-muted">{t('home.systems.lead')}</p>
      <ul className="home-split">
        {systems.map(({ id }) => (
          <li key={id} data-system={id} className="border-t border-border py-3">
            <span className="block text-lg font-semibold">{t(`systems.${id}.name`)}</span>
            <span className="block text-ink-muted">{t(`home.systems.items.${id}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
