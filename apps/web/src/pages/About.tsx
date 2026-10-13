import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import RichText from '../components/RichText.tsx'
import { MAKER } from '../lib/credits.ts'
import { REPO_URL } from '../lib/site.ts'
import { addEnglish } from '../i18n/index.ts'
import aboutText from 'virtual:lifepeek-en/about'
import feedbackText from 'virtual:lifepeek-en/feedback'
import PageShell from '../components/PageShell.tsx'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(aboutText, feedbackText)

const file = (name: string) => `${REPO_URL}/blob/main/${name}`
const link = 'underline underline-offset-2 hover:text-ink'

/** Who made LifePeek, the full medical note, where the numbers come from, licences, and how to report a mistake. */
export default function About() {
  const { t } = useTranslation()
  const { hash } = useLocation()

  // Footer and chart links point at a section (#medical, #licences). The page loads lazily, so
  // the router can't find the section when it scrolls; do it once the page is here.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash])

  const licences: { text: string; href: string; label: string }[] = [
    { text: t('about.licenceCode'), href: file('LICENSE'), label: 'LICENSE' },
    { text: t('about.licenceContent', { name: MAKER.name }), href: file('LICENSE-CONTENT.md'), label: 'LICENSE-CONTENT.md' },
    { text: t('about.licenceData'), href: file('DATA-SOURCES.md'), label: 'DATA-SOURCES.md' },
    { text: t('about.licenceName'), href: file('TRADEMARKS.md'), label: 'TRADEMARKS.md' },
  ]
  const h2 = 'mt-10 mb-3 scroll-mt-6 text-h2 font-extrabold'

  return (
    <PageShell>
      <h1 className="text-display font-extrabold tracking-tight">{t('about.title')}</h1>
      <p className="mt-4 text-lg font-semibold">{t('about.tagline')}</p>
      <p className="mt-1 max-w-[68ch] text-lg text-ink-muted">{t('about.lead')}</p>

      <section className="max-w-[68ch]">
        <h2 className={h2}>{t('about.makerTitle')}</h2>
        <p>
          {t('about.maker', { name: MAKER.name })}{' '}
          <a href={MAKER.github} target="_blank" rel="noreferrer" className={link}>
            GitHub: @{MAKER.github.split('/').pop()}
          </a>
        </p>
      </section>

      <section className="max-w-[68ch]">
        <h2 id="medical" className={h2}>
          {t('about.medicalTitle')}
        </h2>
        {/* A rule at its side, not a card (ui-audit #5, T10). */}
        <p className="border-l-2 border-ink py-1 pl-4">{t('about.medical')}</p>
      </section>

      <section className="max-w-[68ch]">
        <h2 className={h2}>{t('about.sourcesTitle')}</h2>
        <p>{t('about.sources')}</p>
        <p className="mt-3">
          <Link to="/science" className={`font-semibold ${link}`}>
            {t('about.sourcesLink')}
          </Link>
        </p>
      </section>

      <section className="max-w-[68ch]">
        <h2 id="licences" className={h2}>
          {t('about.licencesTitle')}
        </h2>
        <ul className="list-disc space-y-2 pl-6">
          {licences.map((l) => (
            <li key={l.label}>
              <RichText text={l.text} />{' '}
              <a href={l.href} target="_blank" rel="noreferrer" className={`whitespace-nowrap ${link}`}>
                {l.label}
              </a>
            </li>
          ))}
          <li>
            {t('about.licenceLibraries')} {/* A plain file on the server, not an app page: a normal link, not a router link. */}
            <a href="/THIRD_PARTY_NOTICES.txt" className={link}>
              {t('footer.notices')}
            </a>
          </li>
        </ul>
      </section>

      <section className="max-w-[68ch]">
        <h2 className={h2}>{t('about.reportTitle')}</h2>
        <p>{t('about.report')}</p>
        <p className="mt-3">
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className={`font-semibold ${link}`}>
            {t('about.openIssue')}
          </a>
        </p>
        <p className="mt-2 text-sm text-ink-muted">{t('feedback.publicWarning')}</p>
      </section>

      <section className="max-w-[68ch]">
        <h2 className={h2}>{t('about.privacyTitle')}</h2>
        <p>
          {t('about.privacy')}{' '}
          <Link to="/privacy" className={link}>
            {t('about.privacyLink')}
          </Link>
        </p>
      </section>
    </PageShell>
  )
}
