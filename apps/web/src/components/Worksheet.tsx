import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@lifepeek/engine'
import sheetText from 'virtual:lifepeek-en/sheet'
import { addEnglish } from '../i18n/index.ts'
import { SITE_URL } from '../lib/site.ts'
import { SHEETS, type Sheet, type SheetKey } from '../lib/worksheets.ts'
import type { Chapter } from '../lib/lessons.ts'
// Print CSS (A4, the app's header and footer hidden): with this lazy part only, never the pages'.
import './worksheet.css'

// The worksheets' words come with this part (scripts/i18n-sections.mjs), not with Teach.
addEnglish(sheetText)

/**
 * Each lesson's QR code, drawn at build time from this build's site address (scripts/qr-code.mjs):
 * files of their own, so only the open worksheet's picture is fetched and no QR code maker is in
 * the app's code (size budget). Keys are `../assets/qr/<lesson>.svg`.
 */
const QR = import.meta.glob<string>('../assets/qr/*.svg', { eager: true, query: '?no-inline', import: 'default' })

/** One answer, its parts in the order book, fixed value, model (book value first, content-i18n §8). */
interface Answer {
  q: string
  b?: string
  k?: string
  m?: string
}
const TAGS = ['b', 'k', 'm'] as const

/**
 * Empty axes to sketch on: time across (0 to `span`, a tick every `step`: hours, or ms for the nerve
 * demo), the lesson's graph up the side. Black on white.
 */
function Axes({ span, step, y, x: across, label }: { span: number; step: number; y: string; x: string; label: string }) {
  // The graph's name over the side axis, the time under the bottom one: both read across.
  const [w, h, left, top, bottom] = [300, 160, 10, 20, 34]
  const x = (at: number) => left + (at / span) * (w - left - 10)
  const rows = [1, 2, 3].map((i) => top + ((h - bottom - top) * i) / 4)
  return (
    <figure className="ws-axes">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <text x={left} y={12}>
          {y}
        </text>
        {Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => (
          <g key={i}>
            <line x1={x(i * step)} x2={x(i * step)} y1={top} y2={h - bottom} className="ws-grid" />
            <text x={x(i * step)} y={h - bottom + 13} textAnchor="middle">
              {i * step}
            </text>
          </g>
        ))}
        {rows.map((r) => (
          <line key={r} x1={left} x2={w - 10} y1={r} y2={r} className="ws-grid" />
        ))}
        <path d={`M${left} ${top}V${h - bottom}H${w - 10}`} className="ws-axis" />
        <text x={(left + w - 10) / 2} y={h - 4} textAnchor="middle">
          {across}
        </text>
      </svg>
    </figure>
  )
}

/** The lines a student writes an answer on (paper only: nothing is typed or kept). */
const Lines = ({ n }: { n: number }) => (
  <span className="ws-lines" aria-hidden="true">
    {Array.from({ length: n }, (_, i) => (
      <span key={i} />
    ))}
  </span>
)

/**
 * A Teach lesson's printable A4 worksheet (X-3; ui-ux §8.3, content-i18n §8.4): the title, its
 * classes and NCERT chapter, a QR code and the link to the lesson, what is on the screen, the book's
 * line first, four questions (one with empty axes to sketch on) and an exit question. "Print with
 * answers" makes the teacher's copy: the Book / Fixed value / Model answers in place of the lines.
 * Shown by Teach at `/teach?sheet=<lesson>` (lazy: Teach's own download only names the link). English
 * only while Hindi is paused (R47): its words, the title included, whatever the page's language, and
 * the link carries no `lang`.
 */
export default function Worksheet({
  lesson,
  title,
  classes,
  chapter,
  back,
}: {
  lesson: SheetKey
  /** Its title's key (Teach's words). */
  title: string
  /** The NCERT classes it fits. */
  classes: readonly number[]
  /** Its chapter on Teach; none for the guided lesson, which spans Class 10's Life Processes. */
  chapter?: Pick<Chapter, 'key' | 'c10'>
  /** Teach's address (a preview stays a preview). */
  back: string
}) {
  const { i18n } = useTranslation()
  const t = i18n.getFixedT('en')
  const [answers, setAnswers] = useState(false)
  const sheet: Sheet = SHEETS[lesson]
  /** This lesson's own words (`sheet.lessons.<lesson>.<part>`). */
  const own = <T = string,>(part: string, objects = false) => t(`sheet.lessons.${lesson}.${part}`, { returnObjects: objects }) as T
  const tasks = own<Answer[]>('tasks', true)
  // Hours after eating, or milliseconds after the touch (the nerve demo: a tick every 50 ms).
  const y = own('y')
  const axes =
    'ms' in sheet.sketch
      ? { span: sheet.sketch.ms, step: 50, x: t('sheet.timeMs'), label: t('sheet.axesMs', { y, ms: sheet.sketch.ms }) }
      : { span: sheet.sketch.hours, step: 1, x: t('sheet.time'), label: t('sheet.axes', { y, hours: sheet.sketch.hours }) }
  const exit = own<Answer>('exit', true)
  const link = SITE_URL + sheet.link
  // "Class 6 · Class 7 · Class 10 — NCERT Class 10, Life Processes: Respiration".
  const part = chapter && t(`teach.chapters.${chapter.key}`)
  const tags = `${classes.map((n) => t('teach.classTag', { n })).join(' · ')} — ${
    chapter && !chapter.c10 ? part : [t('sheet.c10'), part].filter(Boolean).join(': ')
  }`
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())

  const answer = (a: Answer, lines: number) =>
    answers ? (
      <span className="ws-answer">
        {TAGS.filter((tag) => a[tag]).map((tag) => (
          <span key={tag} className="ws-part">
            <b>{t(`sheet.tags.${tag}`)}:</b> {a[tag]}
          </span>
        ))}
      </span>
    ) : (
      <Lines n={lines} />
    )

  return (
    <div lang="en">
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center gap-x-4 gap-y-3 px-4">
        <Link to={back} className="font-semibold underline underline-offset-2">
          ‹ {t('sheet.back')}
        </Link>
        <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" checked={answers} onChange={(e) => setAnswers(e.target.checked)} className="size-5" />
          {t('sheet.withAnswers')}
        </label>
        <button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-ink px-6 font-semibold text-white">
          {t('sheet.print')}
        </button>
        <p className="basis-full text-sm text-ink-muted">{t('sheet.hint')}</p>
      </div>

      <article className="ws" data-worksheet={lesson} data-answers={answers ? '' : undefined} aria-labelledby="ws-title">
        <header className="ws-head">
          <div className="ws-titles">
            <p className="ws-brand">
              {t('sheet.brand')}
              {answers && <> · {t('sheet.teacherCopy')}</>}
            </p>
            <h1 id="ws-title">{t(title)}</h1>
            <p className="ws-tags">{tags}</p>
            <p className="ws-fields" aria-hidden="true">
              <span>{t('sheet.name')}</span>
              <span>{t('sheet.class')}</span>
              <span>{t('sheet.date')}</span>
            </p>
            <p className="ws-url">
              {t('sheet.type')} <span>{link.replace(/^https?:\/\//, '')}</span>
            </p>
          </div>
          <figure className="ws-qr">
            <img src={QR[`../assets/qr/${lesson}.svg`]} alt={t('sheet.qrAlt')} width={120} height={120} />
            <figcaption>{t('sheet.scan')}</figcaption>
          </figure>
        </header>

        <p className="ws-box">
          <b>{t('sheet.setup')}:</b> {own('setup')}
        </p>
        <p className="ws-box ws-book">
          <b>{t('sheet.book')}:</b> {own('book')}
        </p>

        <h2>{t('sheet.tasks')}</h2>
        <ol className="ws-tasks">
          {tasks.map((task, i) => (
            <li key={i} className={i === sheet.sketch.task ? 'ws-sketch' : undefined}>
              <span className="ws-q">{task.q}</span>
              {i === sheet.sketch.task && <Axes {...axes} y={y} />}
              {answer(task, 2)}
            </li>
          ))}
        </ol>

        <h2>{t('sheet.exit')}</h2>
        <p className="ws-q">{exit.q}</p>
        {answer(exit, 2)}

        {/* The "Why does the model differ from the book?" card (X-4) is not printed here: its rows are in the
            packs' text sections (sys.<pack>.why), which Teach does not load. */}
        {answers && <p className="ws-key">{t('sheet.tagKey')}</p>}

        <footer className="ws-foot">
          <span>{t('sheet.footer')}</span>
          <span>{t('sheet.version', { version: MODEL_VERSION, date })}</span>
        </footer>
      </article>
    </div>
  )
}
