import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { ProfileId } from '@lifepeek/engine'
import { IconButton, LinkIcon } from '../kit/index.ts'

/**
 * The meal bar's "⋯" panel (FP-1, ui-ux §2.1): on a phone "Keep to compare" (from 1024 px up it is
 * on the bar), "Copy link", "Report a mistake", then whose body the model is, with a link to the
 * sources. Downloaded the first time "⋯" opens (MealBar). Keep and Report come from the bar as
 * elements, so this file shares no module with the stage's own code (nothing is split out).
 */
export default function MealActions({ profile, keep, report }: { profile: ProfileId; keep: ReactNode; report: ReactNode }) {
  const { t } = useTranslation()
  return (
    <>
      <span className="lg:hidden">{keep}</span>
      <CopyLink />
      {report}
      <div className="mt-1 w-full border-t border-border px-2.5 pt-1.5 pb-1">
        <p className="text-control font-semibold">{t(`profiles.${profile}.tag`)}</p>
        <p className="mt-0.5 text-caption text-ink-muted">
          {t(`profiles.${profile}.desc`)}{' '}
          <Link to="/science" className="font-semibold whitespace-nowrap underline underline-offset-2">
            {t('nav.science')}
          </Link>
        </p>
      </div>
    </>
  )
}

/**
 * Copy the address: the link sync keeps it equal to this exact run. If copying is blocked (some
 * school browsers), the link is shown under the button to copy by hand. On a touch screen with a share sheet it
 * opens the sheet instead, as v1's share button did.
 */
function CopyLink() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const refill = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(refill.current)
    },
    [],
  )

  const copy = () => {
    // A touch screen with a share sheet (a tablet) shares the link with the summary sentence, in
    // the language on screen, so the message says what the link shows (council round 3). Read
    // from the sentence itself (SummaryLine): it is the stage's answer, already worded.
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      const text = document.querySelector('[data-summary-headline]')?.textContent ?? undefined
      navigator.share({ title: 'LifePeek', text, url: window.location.href }).catch(() => undefined)
      return
    }
    const done = navigator.clipboard?.writeText(window.location.href)
    if (!done) return setStatus('manual')
    done.then(
      () => {
        // A second copy while "Link copied" still shows must be said again (review 14-17, LOW 9):
        // empty the status region first, then fill it 80 ms later (one frame apart, some screen
        // readers merge the two changes and say nothing: FIX-C review, item 7).
        setStatus('idle')
        clearTimeout(refill.current)
        clearTimeout(timer.current)
        refill.current = setTimeout(() => {
          setStatus('copied')
          timer.current = setTimeout(() => setStatus('idle'), 2500)
        }, 80)
      },
      () => setStatus('manual'),
    )
  }
  return (
    // Not on the projector (§3.4).
    <span className="in-data-[contrast=high]:hidden">
      <IconButton
        icon={<LinkIcon />}
        label={status === 'copied' ? t('sim.shareCopied') : t('sim.share')}
        title={t('sim.share')}
        onClick={copy}
      />
      {/* Said once by screen readers when the link is copied (verify-1 A5): a status region of its own. */}
      <span role="status" className="sr-only">
        {status === 'copied' ? t('sim.shareCopied') : ''}
      </span>
      {/* Copying blocked: the link to copy by hand, under the button, in the "⋯" panel. */}
      {status === 'manual' && (
        <label className="block w-full px-2.5 pb-1 text-caption text-ink-muted">
          {t('sim.shareManual')}
          <input
            readOnly
            autoFocus
            value={window.location.href}
            onFocus={(e) => e.target.select()}
            className="mt-1 block w-full rounded-control bg-surface-sunk px-2 py-1.5 text-control text-ink"
          />
        </label>
      )}
    </span>
  )
}
