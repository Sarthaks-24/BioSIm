import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { readPref, writePref } from '../lib/prefs.ts'

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

/**
 * A small card on the first visit to the simulator. It never blocks the app (no modal, nothing to
 * agree to), and once closed it stays closed. If storage is blocked it comes back every visit,
 * which is fine.
 */
export function FirstRunNote() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => readPref('medicalNoteSeen') !== '1')
  if (!open) return null
  return (
    <section
      aria-labelledby="first-run-title"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-rule bg-surface-raised px-4 py-3 sm:flex-row sm:items-start"
    >
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <h2 id="first-run-title" className="font-semibold text-ink">
          {t('disclaimer.firstRun.title')}
        </h2>
        <p className="mt-0.5 max-w-[75ch] text-ink-muted">
          {t('disclaimer.firstRun.body')}{' '}
          <Link to={MEDICAL_HREF} className="whitespace-nowrap underline underline-offset-2 hover:text-ink">
            {t('disclaimer.more')}
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          writePref('medicalNoteSeen', '1')
          setOpen(false)
        }}
        className="self-end rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white sm:self-center"
      >
        {t('disclaimer.firstRun.ok')}
      </button>
    </section>
  )
}
