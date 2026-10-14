import { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { MODEL_VERSION } from '@lifepeek/engine'
import { useTranslation } from 'react-i18next'
import { TASKS, presetHref, type Lesson } from '../lib/presets.ts'
import { shownChapters, type TeachLesson } from '../lib/lessons.ts'
import { FLAGSHIP, LESSON_STATE, flagshipHref, flagshipShown, isPreview } from '../lib/flagship.ts'
import { systemOf } from '../systems/registry.ts'
import { QR_PATH } from '../lib/qrPath.ts'
import { SITE_URL } from '../lib/site.ts'
import { setProjector } from '../hooks/useProjector.ts'
import { useStripTab } from '../state/stripTab.ts'
import { addEnglish } from '../i18n/index.ts'
import { shortMealNames } from '../components/stage/mealText.ts'
// A file next to the page, never inlined into its code (D-QR: error level M). Made at build time
// from the site address (scripts/qr-code.mjs, R79); not committed.
import qrCode from '../assets/lifepeek-qr.svg?no-inline'
import teachText from 'virtual:lifepeek-en/teach'
import PageShell from '../components/PageShell.tsx'
import type { SheetKey } from '../lib/worksheets.ts'
import { LESSON_PACKS, canSave, isSaved, save } from '../lib/offlineSave.ts'

// A lesson's printable worksheet (X-3): its code, words, print CSS and QR codes load when one is opened.
const Worksheet = lazy(() => import('../components/Worksheet.tsx'))

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
function openLesson(e: MouseEvent, l: Pick<TeachLesson, 'system' | 'slot'>) {
  if (opensElsewhere(e)) return
  // Only where the stage has a projector size (from 1024 px up).
  if (window.matchMedia('(min-width: 64rem)').matches) setProjector(true)
  // Its graph in front, also when its system lights only once its pack is here (X-1).
  useStripTab.setState({ tab: l.slot, next: { layer: l.system, slot: l.slot } })
}

/** The guided lesson (X-1): projector-friendly as the ready lessons; its link's `state` brings the bar. */
const openFlagship = (e: MouseEvent) => openLesson(e, { system: FLAGSHIP.layer, slot: 'gut' })

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

/** A lesson's offline state: not known yet, saved, not saved, being saved, or the save failed. */
type Offline = 'unknown' | 'saved' | 'not' | 'saving' | 'failed'

/**
 * "Save for class offline" (T12d, R71): each lesson's state, and saving one lesson or all. On v2
 * every lesson needs the same files (lib/offlineSave.ts), so saving one saves them all; each
 * lesson still says its own state, ready for lessons that need different parts (v3 packs).
 */
function useOffline(lessons: readonly { key: string; packs: readonly string[] }[]) {
  const [state, setState] = useState<Record<string, Offline>>({})
  const packsOf = (keys: string[]) => [...new Set(lessons.filter((l) => keys.includes(l.key)).flatMap((l) => l.packs))]
  const check = () =>
    Promise.all(lessons.map(async (l) => [l.key, (await isSaved([...l.packs])) ? 'saved' : 'not'] as const)).then((all) =>
      setState(Object.fromEntries(all)),
    )
  const ids = lessons.map((l) => l.key).join()
  useEffect(() => {
    if (canSave()) void check()
    // Checked again only when the lessons shown change.
  }, [ids])
  const run = async (keys: string[]) => {
    setState((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, 'saving'])) }))
    const ok = await save(packsOf(keys)).catch(() => false)
    if (ok) await check()
    else setState((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, 'failed'])) }))
  }
  return { state, run }
}

/** The packs the guided lesson needs offline: the stage's parts, 3D, and each system it pauses on (skin's once public). */
const flagshipPacks = (preview: boolean) => [
  ...LESSON_PACKS,
  'breathing',
  'circulation',
  'kidneys',
  ...(preview || systemOf('skin')?.public ? ['effort'] : []),
  // v3.1: the insulin pause (R38).
  ...(preview || systemOf('hormones')?.public ? ['control'] : []),
]

const SAVE_BUTTON = 'min-h-11 shrink-0 rounded-full border border-border px-4 font-semibold hover:bg-surface-sunk lg:min-h-9'

const ROW = 'group flex items-center gap-4 py-3 pr-1 hover:bg-surface-sunk focus-visible:bg-surface-sunk sm:px-3 sm:-mx-3 sm:rounded-lg'

export default function Teach() {
  const { t, i18n } = useTranslation()
  const { search } = useLocation()
  const preview = isPreview(search)
  const chapters = shownChapters(preview)
  const lessons = chapters.flatMap((c) => c.lessons)
  const flagship = flagshipShown(preview)
  const offline = useOffline([...(flagship ? [{ key: FLAGSHIP.key, packs: flagshipPacks(preview) }] : []), ...lessons])
  const keys = [...(flagship ? [FLAGSHIP.key] : []), ...lessons.map((l) => l.key)]
  const saveable = canSave()
  const allSaved = keys.every((k) => offline.state[k] === 'saved')
  const offlineText: Record<Offline, string> = {
    unknown: '',
    saved: t('teach.offline.saved'),
    not: t('teach.offline.notSaved'),
    saving: t('teach.offline.saving'),
    failed: t('teach.offline.failed'),
  }
  const list = (key: string) => t(key, { returnObjects: true }) as string[]
  const meals = (l: { meal: Lesson['meal']; kept?: Lesson['kept'] }) =>
    l.kept?.length
      ? t('home.example', { meal: shortMealNames(l.meal, i18n.language), kept: shortMealNames(l.kept, i18n.language) })
      : shortMealNames(l.meal, i18n.language)
  const time = (min: number) => (min % 60 === 0 ? t('units.h', { n: min / 60 }) : t('units.min', { n: min }))
  const classes = (list: readonly number[]) => list.map((n) => t('teach.classTag', { n })).join(' · ')
  /** A lesson's offline state, and its Save button when it is not saved. */
  const saveState = (key: string, name: string) => {
    const state = offline.state[key]
    if (!saveable || !state || state === 'unknown') return null
    return (
      <>
        <span role="status" className={state === 'saved' ? 'font-semibold text-ink' : 'text-ink-muted'}>
          {offlineText[state]}
        </span>
        {(state === 'not' || state === 'failed') && (
          <button
            type="button"
            onClick={() => void offline.run([key])}
            aria-label={`${t('teach.offline.save')}: ${name}`}
            className={SAVE_BUTTON}
          >
            {t('teach.offline.save')}
          </button>
        )}
      </>
    )
  }
  /** A lesson's worksheet (X-3) and its offline state, under its row. */
  const sheetHref = (key: string) => `/teach?sheet=${key}${preview ? '&preview=1' : ''}`
  const below = (key: string, name: string) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-sm sm:px-3 sm:-mx-3">
      <Link
        to={sheetHref(key)}
        aria-label={t('teach.worksheetFor', { lesson: name })}
        className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 lg:min-h-9"
      >
        {t('teach.worksheet')}
      </Link>
      {saveState(key, name)}
    </div>
  )

  // `?sheet=<lesson>`: that lesson's worksheet in place of the page (a lesson this session lists).
  const sheet = new URLSearchParams(search).get('sheet')
  const sheetChapter = chapters.find((c) => c.lessons.some((l) => l.key === sheet))
  const sheetLesson = sheetChapter?.lessons.find((l) => l.key === sheet)
  const sheetFor =
    sheetLesson && sheetChapter
      ? { title: `teach.lessons.${sheetLesson.key}`, classes: sheetLesson.classes, chapter: sheetChapter }
      : flagship && sheet === FLAGSHIP.key
        ? { title: 'teach.flagship.title', classes: [7, 10] }
        : null
  if (sheetFor)
    return (
      <div className="py-8">
        <Suspense fallback={<p className="p-10 text-center text-ink-muted">…</p>}>
          <Worksheet lesson={sheet as SheetKey} {...sheetFor} back={preview ? '/teach?preview=1' : '/teach'} />
        </Suspense>
      </div>
    )
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

      {flagship && (
        // The guided lesson at the top of Teach (ui-ux §8.1), once every system it pauses on is public.
        <section
          aria-labelledby="flagship"
          data-flagship=""
          data-release={FLAGSHIP.release}
          className="mt-8 rounded-frame border border-border bg-surface-raised p-5"
        >
          <h2 id="flagship" className="text-h2 font-extrabold text-balance">
            {t('teach.flagship.title')}
          </h2>
          <p className="mt-1 text-sm font-semibold text-ink-muted">{classes([7, 10])}</p>
          <p className="mt-3 text-ink-muted">{t('teach.flagship.lead')}</p>
          <p className="mt-4">
            <Link
              to={flagshipHref(preview)}
              state={LESSON_STATE}
              onClick={openFlagship}
              className="inline-block rounded-full bg-ink px-6 py-3 font-semibold text-white"
            >
              {t('teach.flagship.start')}
            </Link>
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer font-semibold">{t('teach.flagship.exit')}</summary>
            <p className="mt-1 text-ink-muted">{t('teach.flagship.exitAnswer')}</p>
          </details>
          <div className="mt-2">{below(FLAGSHIP.key, t('teach.flagship.title'))}</div>
        </section>
      )}

      <h2 className="mt-10 mb-3 text-h2 font-extrabold">{t('teach.plan')}</h2>
      <ol className="list-decimal space-y-3 pl-6">
        {list('teach.steps').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h2 className="mt-10 mb-2 text-h2 font-extrabold">{t('teach.lessonsTitle')}</h2>
      <p className="mb-3 text-ink-muted">{t('teach.lessonsLead')}</p>
      {saveable && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="basis-full text-ink-muted">{t('teach.offline.lead')}</p>
          <button
            type="button"
            disabled={allSaved || keys.some((k) => offline.state[k] === 'saving')}
            onClick={() => void offline.run(keys)}
            className={`${SAVE_BUTTON} disabled:opacity-60`}
          >
            {t('teach.offline.saveAll')}
          </button>
        </div>
      )}
      {/* By NCERT chapter (R15): Class 10's Life Processes in its order, then moving and body heat. */}
      {chapters.map((c, i) => (
        <section key={c.key} aria-labelledby={`chapter-${c.key}`} data-chapter={c.key} className="mt-6">
          {c.c10 && !chapters[i - 1]?.c10 && <p className="mb-2 text-sm font-semibold text-ink-muted">{t('teach.chapters.c10')}</p>}
          <h3 id={`chapter-${c.key}`} className="mb-2 text-lg font-extrabold">
            {t(`teach.chapters.${c.key}`)}
          </h3>
          <ul className="divide-y divide-border border-y border-border">
            {c.lessons.map((l) => (
              <li key={l.key} data-lesson={l.key} data-release={l.release}>
                <Link to={l.href(preview)} onClick={(e) => openLesson(e, l)} className={ROW}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold">{t(`teach.lessons.${l.key}`)}</span>
                    <span className="block text-ink-muted">
                      {l.preset ? meals(l.preset) : t(`teach.lessonQuestions.${l.key}`)} ·{' '}
                      {l.preset
                        ? t('teach.opensAt', { time: time(l.t), graph: t(`stage.strips.${l.slot}`) })
                        : t('teach.opensAtTime', { time: time(l.t) })}
                    </span>
                    <span className="block text-sm text-ink-muted">{classes(l.classes)}</span>
                    {/* What the class should see, where the graph alone could mislead (council round 3). */}
                    {l.key === 'colaFour' && <span className="mt-1 block text-ink-muted">{t('teach.lessonNotes.colaFour')}</span>}
                  </span>
                  <Chevron />
                </Link>
                {below(l.key, t(`teach.lessons.${l.key}`))}
              </li>
            ))}
          </ul>
        </section>
      ))}

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

      {/* What moved since the last model version, for a teacher with notes from before (E-3a, MODEL D12). */}
      <h2 className="mt-10 mb-3 text-h2 font-extrabold">{t('teach.changedTitle')}</h2>
      <p className="text-ink-muted">{t('teach.changed', { version: MODEL_VERSION })}</p>
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
