import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LESSONS, QR_PATH, TASKS, presetHref, type Lesson } from '../lib/presets.ts'
import { SITE_URL } from '../lib/site.ts'
import { setProjector } from '../hooks/useProjector.ts'
import { useStripTab } from '../state/stripTab.ts'
import { addEnglish } from '../i18n/index.ts'
import { shortMealNames } from '../components/stage/mealText.ts'
// A file next to the page, never inlined into its code (D-QR: made with qrcode@1.5.4, error level M).
import qrCode from '../assets/lifepeek-qr.svg?no-inline'
import teachText from 'virtual:lifepeek-en/teach'
import PageShell from '../components/PageShell.tsx'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(teachText)

/** A click that opens the link elsewhere (a new tab or window): this tab stays as it is. */
const opensElsewhere = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

/**
 * A ready lesson opens projector-friendly (council round 2): projector mode on (on a laptop), the
 * lesson's graph in front, paused at its first key moment (the link's `t`). A copied or shared
 * link, or one opened in a new tab, is a plain link: the same meals and time, in whatever mode
 * the reader uses.
 */
function openLesson(e: MouseEvent, l: Lesson) {
  if (opensElsewhere(e)) return
  // Only where the stage has a projector size (from 1024 px up).
  if (window.matchMedia('(min-width: 64rem)').matches) setProjector(true)
  useStripTab.getState().show(l.strip)
}

/** A question starts on the first graph: a lesson's graph left in front would point at the answer. */
function openTask(e: MouseEvent) {
  if (!opensElsewhere(e)) useStripTab.setState({ tab: null })
}

/** A right-pointing chevron, drawn like the kit's icons. */
const Chevron = () => (
  <svg
    viewBox="0 0 20 20"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className="shrink-0 text-ink-muted group-hover:text-ink"
  >
    <path d="m8 5.5 4.5 4.5L8 14.5" />
  </svg>
)

const ROW = 'group flex items-center gap-4 py-3 pr-1 hover:bg-surface-sunk focus-visible:bg-surface-sunk sm:px-3 sm:-mx-3 sm:rounded-lg'

export default function Teach() {
  const { t, i18n } = useTranslation()
  const list = (key: string) => t(key, { returnObjects: true }) as string[]
  const meals = (l: { meal: Lesson['meal']; kept?: Lesson['kept'] }) =>
    l.kept?.length
      ? t('home.example', { meal: shortMealNames(l.meal, i18n.language), kept: shortMealNames(l.kept, i18n.language) })
      : shortMealNames(l.meal, i18n.language)
  return (
    <PageShell>
      <h1 className="text-display font-extrabold tracking-tight text-balance">{t('teach.title')}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t('teach.lead')}</p>
      {/* Teach → Science (T12a, internal links). */}
      <p className="mt-2">
        <Link to="/science" className="font-semibold underline underline-offset-2">
          {t('teach.scienceLink')}
        </Link>
      </p>

      <h2 className="mt-10 mb-3 text-h2 font-extrabold">{t('teach.plan')}</h2>
      <ol className="list-decimal space-y-3 pl-6">
        {list('teach.steps').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h2 className="mt-10 mb-2 text-h2 font-extrabold">{t('teach.lessonsTitle')}</h2>
      <p className="mb-3 text-ink-muted">{t('teach.lessonsLead')}</p>
      <ul className="divide-y divide-border border-y border-border">
        {LESSONS.map((l) => (
          <li key={l.key}>
            <Link to={presetHref(l)} onClick={(e) => openLesson(e, l)} className={ROW}>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">{t(`teach.lessons.${l.key}`)}</span>
                <span className="block text-ink-muted">
                  {meals(l)} ·{' '}
                  {t('teach.opensAt', {
                    time: l.t % 60 === 0 ? t('units.h', { n: l.t / 60 }) : t('units.min', { n: l.t }),
                    graph: t(`stage.strips.${l.strip}`),
                  })}
                </span>
                {/* What the class should see, where the graph alone could mislead (council round 3). */}
                {l.key === 'colaFour' && <span className="mt-1 block text-ink-muted">{t('teach.lessonNotes.colaFour')}</span>}
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-2 text-h2 font-extrabold">{t('teach.questionsTitle')}</h2>
      <p className="mb-3 text-ink-muted">{t('teach.questionsLead')}</p>
      <ol className="divide-y divide-border border-y border-border">
        {TASKS.map((q, i) => (
          <li key={q.key}>
            <Link to={presetHref(q)} onClick={openTask} className={ROW}>
              <span aria-hidden="true" className="tabular w-5 shrink-0 self-start text-lg font-extrabold text-ink-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 font-semibold">{t(`teach.tasks.${q.key}`)}</span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ol>
      {/* Closed, so a student looking at the page doesn't read them first. */}
      <details className="mt-3 rounded-lg bg-surface-sunk px-4 py-2">
        <summary className="cursor-pointer py-1 font-semibold">{t('teach.answersTitle')}</summary>
        <ol className="mt-1 mb-2 list-decimal space-y-1 pl-6 text-ink-muted">
          {list('teach.answers').map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>

      <h2 className="mt-10 mb-3 text-h2 font-extrabold">{t('teach.tipsTitle')}</h2>
      <ul className="list-disc space-y-2 pl-6">
        {list('teach.tips').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <section aria-labelledby="teach-qr" className="mt-10 flex flex-col gap-6 border-t border-border pt-10 sm:flex-row sm:items-center">
        <figure className="shrink-0">
          <img
            src={qrCode}
            alt={t('teach.qrAlt')}
            width={240}
            height={240}
            // At the end of the page: fetched when it is about to come into view (T12c).
            loading="lazy"
            decoding="async"
            className="size-60 rounded-lg bg-white"
          />
          {/* The address it opens (questions 1 to 3 start there), to type if a camera can't read the code. */}
          <figcaption className="tabular mt-2 text-center text-sm font-semibold" style={{ width: 240, overflowWrap: 'anywhere' }}>
            {SITE_URL.replace(/^https:\/\//, '') + QR_PATH}
          </figcaption>
        </figure>
        <div>
          <h2 id="teach-qr" className="mb-2 text-h2 font-extrabold">
            {t('teach.qrTitle')}
          </h2>
          <p className="text-ink-muted">{t('teach.qrCaption')}</p>
        </div>
      </section>
    </PageShell>
  )
}
