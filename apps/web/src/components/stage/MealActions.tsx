import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { ProfileId } from '@lifepeek/engine'
import { IconButton, LinkIcon } from '../kit/index.ts'
import { addEnglish } from '../../i18n/index.ts'
import linkText from 'virtual:lifepeek-en/link'

// "Share" and "Copy this link" come with the link notes' English (size budget, scripts/i18n-sections.mjs).
addEnglish(linkText)

/**
 * Shares the address: the link sync keeps it equal to this exact run (FP-6, B11). `toSheet`: the
 * share sheet, with the summary sentence too, in the language on screen, so the message says what
 * the link shows (council round 3; read from the sentence itself, SummaryLine); else the
 * clipboard. "manual": copying is blocked (some school browsers), and the link must be shown to
 * copy by hand.
 */
function shareLink(toSheet: boolean): Promise<'shared' | 'copied' | 'manual'> {
  const url = location.href
  if (toSheet) {
    const text = document.querySelector('[data-summary-headline]')?.textContent ?? undefined
    // Closing the sheet without sharing rejects: nothing more to do either way.
    return navigator.share({ title: 'LifePeek', text, url }).then(
      () => 'shared' as const,
      () => 'shared' as const,
    )
  }
  return (
    navigator.clipboard?.writeText(url).then(
      () => 'copied' as const,
      () => 'manual' as const,
    ) ?? Promise.resolve('manual' as const)
  )
}

/**
 * The meal bar's "⋯" panel (FP-1, ui-ux §2.1): on a phone "Keep to compare" and "Copy link" (or
 * "Share"; from 1024 px up both are on the bar), "Report a mistake", then whose body the model is,
 * with a link to the sources. Downloaded the first time "⋯" opens (MealBar). Keep and Report
 * come from the bar as elements, so this file shares no module with the stage's own code (nothing
 * is split out). `manual`: the bar's "Copy link" could not copy, so the link shows here to copy by hand.
 * It is a menu (FP-5): each action closes it (Overlay `menu`); "Copy link" closes it once it has
 * copied (`onCopied`: the bar says "Link copied"), and stays open with the link if copying is blocked.
 */
export default function MealActions({
  profile,
  keep,
  report,
  manual,
  onCopied,
}: {
  profile: ProfileId
  keep: ReactNode
  report: ReactNode
  manual: boolean
  onCopied: (copied: boolean) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <span className="lg:hidden">{keep}</span>
      <CopyLink manual={manual} onCopied={onCopied} />
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
 * Copy the address (shareLink). If copying is blocked (some school browsers), the link is shown
 * under the button, selected, to copy by hand. On a touch screen with a share sheet (`toSheet`) it
 * is "Share" and opens the sheet, as v1's share button did. Copied or shared, the menu closes
 * (`onCopied`: the bar says "Link copied" after a copy); the button is `data-stay`, so the menu waits for that.
 */
function CopyLink({ manual, onCopied }: { manual: boolean; onCopied: (copied: boolean) => void }) {
  const { t } = useTranslation()
  const toSheet = !!navigator.share && matchMedia('(pointer: coarse)').matches
  const [shown, setShown] = useState(manual)
  const copy = () =>
    void shareLink(toSheet).then((done) => {
      if (done === 'manual') setShown(true)
      else onCopied(done === 'copied')
    })
  return (
    // Not on the projector (§3.4). From 1024 px up it is on the bar, and shows here only with the
    // link to copy by hand.
    <span data-stay="" className={`in-data-[contrast=high]:hidden ${manual ? '' : 'lg:hidden'}`}>
      <IconButton
        icon={<LinkIcon />}
        label={t(toSheet ? 'link.shareTo' : 'sim.share')}
        title={t(toSheet ? 'link.shareTo' : 'sim.share')}
        onClick={copy}
      />
      {/* Copying blocked: the link to copy by hand, under the button, in the "⋯" panel. */}
      {shown && (
        <label className="block w-full px-2.5 pb-1 text-caption text-ink-muted">
          {t('link.shareManual')}
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
