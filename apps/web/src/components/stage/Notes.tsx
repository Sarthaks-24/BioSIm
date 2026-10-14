import { Suspense, useState, type ComponentProps } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION, type RunResult } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { readPref, writePref } from '../../lib/prefs.ts'
import { retry3d, useBodyNote, type BodyNote } from '../../lib/webgl.ts'
import { useRunStore } from '../../state/run.ts'
import { MEDICAL_HREF } from '../MedicalNote.tsx'
import { LoadBoundary, lazyWithRetry } from '../LoadBoundary.tsx'
import { CloseIcon, InfoIcon } from '../kit/index.ts'
import type LinkNotes from './LinkNotes.tsx'

/** What the body's note says (lib/webgl.ts). */
const BODY_NOTE = { webgl: 'sim.noWebgl', slow: 'sim.slow3d', offline: 'sim.needsInternet', failed: 'sim.failed3d' } as const

/** The notes about an opened link (and a meal too big, which only a link makes) load only when one shows (size budget). */
const linkNotes = lazyWithRetry<ComponentProps<typeof LinkNotes>>(() => import('./LinkNotes.tsx'))

/**
 * Short notes under the meal bar, only when they apply: the first-visit medical note (until
 * "Got it"), the notes about an opened link (LinkNotes: Hindi later, an older or newer version,
 * foods that no longer exist, what changed on load, a meal over the size the model is good for),
 * and why the body is the flat diagram (no 3D here, the 3D file slow, needing the internet once, or
 * failed with Try again: R71; until its ✕: FP-5, U9).
 * The "too big" alert for a food being added sits where it is added (food sheet, servings).
 */
export default function Notes({ run, kept }: { run: RunResult; kept: RunResult | null }) {
  const { t, i18n } = useTranslation()
  // Whether LinkNotes has anything to say (lib/linkNotes.ts).
  const linked = useRunStore(
    (s) =>
      s.hindiLater ||
      s.unknownOrganism !== null ||
      (s.linkModelVersion ?? MODEL_VERSION) !== MODEL_VERSION ||
      s.droppedFoods > 0 ||
      s.changes.length > 0,
  )
  const [firstRun, setFirstRun] = useState(() => readPref('medicalNoteSeen') !== '1')
  // The body note closed with ✕: that one stays closed, another one shows.
  const [bodySeen, setBodySeen] = useState<BodyNote>('')
  const bodyNote = useBodyNote()
  const flat = bodyNote !== bodySeen && bodyNote

  const over = [run.meal.overCap, !!kept?.meal.overCap]
  const link = linked || over.includes(true)

  if (!firstRun && !link && !flat) return null
  return (
    <div className="border-b border-border bg-surface-raised px-3 py-1.5 lg:px-4">
      <ul className="flex flex-col gap-1">
        {firstRun && (
          // On a phone the card is small (legal/medical-note.md: "a small dismissible card"): its
          // title and "More about this" beside "Got it", caption-sized. The full text stays for
          // screen readers and is one tap away; the graph's note and the footer say "not medical
          // advice" too. In Hindi the whole card took 200 px and left the body almost no room (WP-18).
          <li data-first-run="" className="flex items-start gap-x-3 gap-y-1 lg:flex-wrap lg:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-caption lg:basis-80 lg:text-control">
              <span className="mt-px text-ink-muted">
                <InfoIcon />
              </span>
              <span>
                <strong className="font-semibold">{t('disclaimer.firstRun.title')}</strong>{' '}
                <span className="text-ink-muted max-lg:sr-only">{t('disclaimer.firstRun.body')}</span>{' '}
                {/* A phone keeps the card to one line (FP-1): the footer links the full note too. */}
                <Link to={MEDICAL_HREF} className="font-semibold whitespace-nowrap underline underline-offset-2 max-sm:hidden">
                  {t('disclaimer.more')}
                </Link>
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                writePref('medicalNoteSeen', '1')
                setFirstRun(false)
              }}
              // Quiet (FP-1): Play stays the strongest thing on the first screen.
              className="ml-auto min-h-11 shrink-0 rounded-control bg-surface-sunk px-4 text-control font-semibold text-ink hover:bg-surface-sunk-hover lg:min-h-9"
            >
              {t('disclaimer.firstRun.ok')}
            </button>
          </li>
        )}
        {flat && (
          <li className="flex items-center gap-2 text-caption text-ink-muted">
            <p className="min-w-0 flex-1">{t(BODY_NOTE[flat])}</p>
            {flat === 'failed' && (
              <button
                type="button"
                onClick={retry3d}
                className="min-h-11 shrink-0 rounded-control bg-surface-sunk px-3 font-semibold text-ink hover:bg-surface-sunk-hover lg:min-h-9"
              >
                {t('graph.retry')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setBodySeen(flat)}
              aria-label={t('stage.close')}
              title={t('stage.close')}
              className="grid size-11 shrink-0 place-items-center rounded-control hover:bg-surface-sunk hover:text-ink lg:size-9"
            >
              <CloseIcon />
            </button>
          </li>
        )}
        {link && (
          // If its file does not arrive, the notes are left out: the stage works without them.
          <LoadBoundary fallback={null} onFail={linkNotes.reset}>
            <Suspense fallback={null}>
              <linkNotes.Component store={useRunStore} food={(id) => localized(lookupFood(id)?.name, i18n.language) || id} over={over} />
            </Suspense>
          </LoadBoundary>
        )}
      </ul>
    </div>
  )
}
